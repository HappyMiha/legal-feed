import {normalizeLocale,translate} from '../i18n/core';
import {getAccount} from './store';
import {database,runtime,HttpError,rateLimit} from './runtime';
import {hash} from './security';
import {sendSmtp} from './smtp';
export async function requestEmailChange(owner:string,email:string,expectedHash?:string){
 const taken=await database().prepare('SELECT owner_id FROM auth_identities WHERE email=? AND owner_id<>?').bind(email.toLowerCase(),owner).first();if(taken)throw new HttpError(400,'This address is already registered.');
 await rateLimit(owner,'email-change',3);
 const token=crypto.randomUUID()+crypto.randomUUID(),id=crypto.randomUUID(),tokenHash=await hash(token);
 const locale=normalizeLocale((await getAccount(owner)).locale),tr=(key:string)=>translate(locale,key);
 const url=`${runtime().SITE_URL}/verify-email?lang=${locale}#change=${encodeURIComponent(token)}`;
 const payload={id:`verify:${id}`,to:email,subject:tr('Verify your Legal Feed email'),text:`${tr('Confirm this email address for Legal Feed notifications:')}\n\n${url}\n\n${tr('The link expires in 24 hours. If you did not request this change, ignore this email.')}`};
 const results=await database().batch([
  database().prepare('DELETE FROM email_verifications WHERE owner_id=? AND EXISTS(SELECT 1 FROM accounts WHERE id=? AND password_hash=?)').bind(owner,owner,expectedHash||''),
  database().prepare('INSERT INTO email_verifications(id,owner_id,email,token_hash,payload,status,attempts,next_attempt,expires_at) SELECT ?,?,?,?,?,\'sending\',1,?,? WHERE EXISTS(SELECT 1 FROM accounts WHERE id=? AND password_hash=?)').bind(id,owner,email,tokenHash,JSON.stringify(payload),Date.now()+120000,Date.now()+86400000,owner,expectedHash||''),
  database().prepare("UPDATE accounts SET data=json_set(data,'$.pending_email',?) WHERE id=? AND password_hash=?").bind(email,owner,expectedHash||''),
 ]);
 if(!results[1].meta.changes)throw new HttpError(401,'Your credentials changed. Sign in and try again.');
 const local=['localhost','127.0.0.1'].includes(new URL(runtime().SITE_URL||'https://invalid').hostname);
 if(local&&runtime().AUTH_MAIL_TEST_STORE==='true'){await database().prepare("UPDATE email_verifications SET status='pending',attempts=0,next_attempt=0 WHERE id=?").bind(id).run();return;}
 try{await sendSmtp(payload);await database().prepare("UPDATE email_verifications SET status='sent',payload='' WHERE id=?").bind(id).run();}catch{await database().prepare("UPDATE email_verifications SET status='pending',next_attempt=? WHERE id=?").bind(Date.now()+60000,id).run();}
}
export async function verifyEmail(token:string){
 if(token.length>200)throw new HttpError(400,'Invalid verification link.');
 const db=database(),row=await db.prepare('SELECT id,owner_id,email FROM email_verifications WHERE token_hash=? AND expires_at>?').bind(await hash(token),Date.now()).first<{id:string;owner_id:string;email:string}>();
 if(!row)throw new HttpError(400,'This verification link is invalid or expired.');
 const taken=await db.prepare('SELECT owner_id FROM auth_identities WHERE email=? AND owner_id<>?').bind(row.email.toLowerCase(),row.owner_id).first();if(taken)throw new HttpError(400,'This email is already registered.');
 const credentials=await db.prepare('SELECT password_hash FROM accounts WHERE id=?').bind(row.owner_id).first<{password_hash:string}>();
 const gate="EXISTS(SELECT 1 FROM accounts a JOIN email_verifications v ON v.owner_id=a.id WHERE a.id=? AND v.id=? AND v.expires_at>? AND json_extract(a.data,'$.email')=? AND json_extract(a.data,'$.pending_email') IS NULL)";
 const args=[row.owner_id,row.id,Date.now(),row.email];
 const results=await db.batch([
  db.prepare("UPDATE accounts SET data=json_remove(json_set(data,'$.email',?),'$.pending_email') WHERE id=? AND json_extract(data,'$.pending_email')=? AND EXISTS(SELECT 1 FROM email_verifications WHERE id=? AND expires_at>?)").bind(row.email,row.owner_id,row.email,row.id,Date.now()),
  db.prepare('UPDATE auth_identities SET email=? WHERE owner_id=? AND '+gate).bind(row.email.toLowerCase(),row.owner_id,...args),
  db.prepare('DELETE FROM auth_sessions WHERE owner_id=? AND '+gate).bind(row.owner_id,...args),
  db.prepare('DELETE FROM auth_tokens WHERE owner_id=? AND '+gate).bind(row.owner_id,...args),
  db.prepare('DELETE FROM email_verifications WHERE id=?').bind(row.id),
 ]);
 if(!results[0].meta.changes)throw new HttpError(400,'This email change is no longer pending.');
 return {owner:row.owner_id,passwordHash:credentials?.password_hash};
}
export async function claimVerifications(){
 const now=Date.now(),db=database();const rows=await db.prepare("SELECT id,payload FROM email_verifications WHERE status IN ('pending','sending') AND next_attempt<=? AND expires_at>? AND attempts<5 LIMIT 10").bind(now,now).all<{id:string;payload:string}>();const items=[];
 for(const row of rows.results){const r=await db.prepare("UPDATE email_verifications SET status='sending',attempts=attempts+1,next_attempt=? WHERE id=? AND next_attempt<=? RETURNING id").bind(now+900000,row.id,now).first();if(r)items.push(JSON.parse(row.payload));}return items;
}
export async function ackVerification(id:string,success:boolean,unattempted=false){if(unattempted){await database().prepare("UPDATE email_verifications SET status='pending',attempts=max(0,attempts-1),next_attempt=? WHERE id=? AND status='sending'").bind(Date.now()+1800000,id).run();return;}await database().prepare("UPDATE email_verifications SET status=?,payload=CASE WHEN ? THEN '' ELSE payload END,next_attempt=? WHERE id=? AND status='sending'").bind(success?'sent':'pending',success?1:0,Date.now()+1800000,id).run();}
