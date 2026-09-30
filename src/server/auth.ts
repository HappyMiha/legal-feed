import {z} from 'zod';
import {database,runtime,HttpError,rateLimit} from './runtime';
import {hash} from './security';
import {randomToken,createSession,logout,getSession,loginPasswordHash,matchesPassword,safeReturnTo} from './auth-session';
import {defaultAccount} from './store';
import {sendAuthMail} from './auth-mail';
import {verifyEmail} from './email-verification';

const emailSchema=z.string().trim().email().max(254).transform(v=>v.toLowerCase());
const passwordSchema=z.string().min(10,'Use at least 10 characters.').max(128,'Use at most 128 characters.');
const json=(value:unknown,status=200,cookie?:string)=>Response.json(value,{status,headers:{'cache-control':'private, no-store','referrer-policy':'no-referrer',...cookie?{'set-cookie':cookie}:{}}});
const generic={ok:true,message:'Check your inbox for the next step. If you already have an account, sign in or reset your password.'};
type Identity={owner_id:string;email:string};
type Token={kind:string;email:string;owner_id:string|null;data:string};
async function readBody(request:Request){const text=await request.text();if(text.length>10000)throw new HttpError(413,'Request too large.');try{return JSON.parse(text)}catch{throw new HttpError(400,'Invalid request.');}}
const identity=(email:string)=>database().prepare('SELECT owner_id,email FROM auth_identities WHERE email=?').bind(email).first<Identity>();
async function legacyOwner(email:string){const rows=await database().prepare("SELECT a.id FROM accounts a LEFT JOIN auth_identities i ON i.owner_id=a.id WHERE lower(json_extract(a.data,'$.email'))=? AND i.owner_id IS NULL AND a.id NOT LIKE 'guest:%' LIMIT 2").bind(email).all<{id:string}>();return rows.results.length===1?rows.results[0].id:null;}
async function issueToken(kind:'signup'|'reset',email:string,owner:string|null,data:unknown){
 const token=randomToken(),tokenHash=await hash(token),expires=Date.now()+30*60000;
 await database().prepare('INSERT INTO auth_tokens(token_hash,kind,email,owner_id,data,expires_at) VALUES(?,?,?,?,?,?)').bind(tokenHash,kind,email,owner,JSON.stringify(data),expires).run();
 const page=kind==='signup'?'verify-email':'reset-password',url=`${runtime().SITE_URL}/${page}#token=${token}`;
 await sendAuthMail(tokenHash,email,kind==='signup'?'Confirm your Legal Feed account':'Reset your Legal Feed password',`${kind==='signup'?'Confirm your email address to finish creating your Legal Feed account.':'Choose a new password for your Legal Feed account.'}\n\n${url}\n\nThis link expires in 30 minutes and can be used once. If you did not request it, ignore this email.`,expires);
}
async function consumeToken(token:unknown,kind:string){if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))throw new HttpError(400,'This link is invalid or expired.');const row=await database().prepare('DELETE FROM auth_tokens WHERE token_hash=? AND kind=? AND expires_at>? RETURNING kind,email,owner_id,data').bind(await hash(token),kind,Date.now()).first<Token>();if(!row)throw new HttpError(400,'This link has expired or has already been used. Request a new one.');return row;}
async function throttle(request:Request,scope:string,email?:string){await rateLimit('auth-ip',await hash((request.headers.get('cf-connecting-ip')||'local')+':'+scope),40);if(email)await rateLimit('auth-email',await hash(email+':'+scope),scope==='login'?15:5);}
export async function handleAuth(request:Request,path:string[]){
 const url=new URL(request.url),action=path.join('/');
 try{
  if(request.method!=='POST')throw new HttpError(405,'POST required.');
  if(request.headers.get('origin')!==url.origin)throw new HttpError(403,'Request origin is not allowed.');
  const data=await readBody(request),db=database();
  if(action==='register'){
   const input=z.object({name:z.string().trim().min(1).max(120),email:emailSchema,password:passwordSchema,returnTo:z.string().optional()}).parse(data);
   await throttle(request,'register',input.email);
   const salt=randomToken(),password=await loginPasswordHash(input.password,salt);
   if(!await identity(input.email))await issueToken('signup',input.email,null,{name:input.name,password,salt,returnTo:safeReturnTo(input.returnTo||null)});
   return json(generic,202);
  }
  if(action==='login'){
   const input=z.object({email:emailSchema,password:z.string().min(1).max(256)}).parse(data);await throttle(request,'login',input.email);
   const row=await db.prepare('SELECT i.owner_id,a.password_hash,a.password_salt FROM auth_identities i JOIN accounts a ON a.id=i.owner_id WHERE i.email=?').bind(input.email).first<{owner_id:string;password_hash:string|null;password_salt:string|null}>();
   // Hash even an unknown account to avoid a cheap email-enumeration timing oracle.
   const valid=await matchesPassword(input.password,row?.password_salt||'unregistered-email',row?.password_hash||'v2:'+ '0'.repeat(64));
   if(!row||!valid)throw new HttpError(401,'The email or password is incorrect. Confirm your email before signing in.');
   return json({ok:true},200,await createSession(row.owner_id,url.href,row.password_hash||undefined));
  }
  if(action==='forgot-password'){
   const {email}=z.object({email:emailSchema}).parse(data);await throttle(request,'reset',email);
   const owner=(await identity(email))?.owner_id||await legacyOwner(email);
   if(owner)await issueToken('reset',email,owner,{});
   return json({ok:true,message:'If this email has an account, a password reset link will arrive shortly.'},202);
  }
  if(action==='verify'){
   await throttle(request,'verify');const row=await consumeToken(data.token,'signup');
   let owner=(await identity(row.email))?.owner_id;
   const pending=JSON.parse(row.data) as {name:string;password:string;salt:string;returnTo:string};
   if(!owner){
    owner=await legacyOwner(row.email)||crypto.randomUUID();
    await db.batch([
     db.prepare('INSERT INTO accounts(id,data,password_hash,password_salt,created_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(owner,JSON.stringify(defaultAccount(pending.name,row.email)),pending.password,pending.salt,new Date().toISOString()),
     db.prepare('INSERT INTO auth_identities(owner_id,email) VALUES(?,?)').bind(owner,row.email),
     db.prepare('UPDATE accounts SET password_hash=?,password_salt=? WHERE id=?').bind(pending.password,pending.salt,owner),
    ]);
   }
   return json({ok:true,returnTo:safeReturnTo(pending.returnTo)},200,await createSession(owner,url.href));
  }
  if(action==='reset-password'){
   const input=z.object({token:z.string(),password:passwordSchema}).parse(data);await throttle(request,'verify');
   const salt=randomToken(),password=await loginPasswordHash(input.password,salt);
   const tokenHash=await hash(input.token),row=await db.prepare("SELECT kind,email,owner_id,data FROM auth_tokens WHERE token_hash=? AND kind='reset' AND expires_at>?").bind(tokenHash,Date.now()).first<Token>();
   if(!row?.owner_id)throw new HttpError(400,'This reset link is invalid or expired.');
   const gate="EXISTS(SELECT 1 FROM auth_tokens WHERE token_hash=? AND kind='reset' AND expires_at>?)";
   const results=await db.batch([
    db.prepare("UPDATE accounts SET password_hash=?,password_salt=?,data=json_remove(data,'$.pending_email') WHERE id=? AND lower(json_extract(data,'$.email'))=? AND "+gate).bind(password,salt,row.owner_id,row.email,tokenHash,Date.now()),
    db.prepare('INSERT INTO auth_identities(owner_id,email) SELECT ?,? WHERE '+gate+" AND EXISTS(SELECT 1 FROM accounts WHERE id=? AND password_hash=?) ON CONFLICT(owner_id) DO NOTHING").bind(row.owner_id,row.email,tokenHash,Date.now(),row.owner_id,password),
    db.prepare('DELETE FROM auth_sessions WHERE owner_id=? AND '+gate).bind(row.owner_id,tokenHash,Date.now()),
    db.prepare('DELETE FROM email_verifications WHERE owner_id=? AND '+gate).bind(row.owner_id,tokenHash,Date.now()),
    db.prepare('DELETE FROM auth_tokens WHERE (owner_id=? OR email=?) AND '+gate).bind(row.owner_id,row.email,tokenHash,Date.now()),
   ]);
   if(!results[0].meta.changes)throw new HttpError(400,'This reset link is no longer valid.');
   return json({ok:true},200,await createSession(row.owner_id,url.href,password));
  }
  if(action==='verify-email-change'){
   await throttle(request,'verify');const verified=await verifyEmail(z.string().max(200).parse(data.token));
   return json({ok:true},200,await createSession(verified.owner,url.href,verified.passwordHash));
  }
  if(action==='logout')return json({ok:true},200,await logout(request.headers,url.href));
  if(action==='change-password'){
   const session=await getSession(request.headers,url.href);if(!session)throw new HttpError(401,'Sign in to continue.');
   const input=z.object({currentPassword:z.string().max(256),newPassword:passwordSchema}).parse(data);await throttle(request,'password',session.email);
   const row=await db.prepare('SELECT password_hash,password_salt FROM accounts WHERE id=?').bind(session.owner_id).first<{password_hash:string;password_salt:string}>();
   if(!row||!await matchesPassword(input.currentPassword,row.password_salt,row.password_hash))throw new HttpError(400,'The current password is incorrect.');
   const salt=randomToken(),password=await loginPasswordHash(input.newPassword,salt);
   const gate='EXISTS(SELECT 1 FROM accounts WHERE id=? AND password_hash=?)';
   const results=await db.batch([db.prepare("UPDATE accounts SET password_hash=?,password_salt=?,data=json_remove(data,'$.pending_email') WHERE id=? AND password_hash=?").bind(password,salt,session.owner_id,row.password_hash),db.prepare('DELETE FROM auth_sessions WHERE owner_id=? AND '+gate).bind(session.owner_id,session.owner_id,password),db.prepare('DELETE FROM auth_tokens WHERE (owner_id=? OR email=?) AND '+gate).bind(session.owner_id,session.email,session.owner_id,password),db.prepare('DELETE FROM email_verifications WHERE owner_id=? AND '+gate).bind(session.owner_id,session.owner_id,password)]);
   if(!results[0].meta.changes)throw new HttpError(409,'Your password changed. Sign in and try again.');
   return json({ok:true},200,await createSession(session.owner_id,url.href,password));
  }
  throw new HttpError(404,'Unknown account action.');
 }catch(error){if(error instanceof z.ZodError)return json({error:error.issues[0]?.message||'Invalid input.'},400);if(error instanceof HttpError)return json({error:error.message},error.status);console.error('Account request failed',error instanceof Error?error.name:'unknown');return json({error:'We could not complete this request. Please try again.'},500);}
}
