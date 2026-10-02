import { z } from 'zod';
import { getSession, authCookie, matchesPassword, cleanupAuth } from '@/src/server/auth-session';
import {handleAuth} from '@/src/server/auth';
import {sendSmtp} from '@/src/server/smtp';
import { database, runtime, HttpError, rateLimit } from '@/src/server/runtime';
import { state, getProfile, getUpdate, getAccount, health } from '@/src/server/store';
import { profileSchema, accountSchema, patchSchema } from '@/src/server/validation';
import { sources, cantonSources, canonicalSource } from '@/src/server/catalog';
import {requestEmailChange,verifyEmail} from '@/src/server/email-verification';
import { suggestTopics } from '@/src/server/ai';
import {AnalysisDeferred} from '@/src/server/ai-provider';
import {repairSourceCopies} from '@/src/server/repair-sources';
import { safeUrl, equalSecret } from '@/src/server/security';
import { monitorNext } from '@/src/server/monitor';
import {CURRENT_CHECKS,retryFailedChecks} from '@/src/server/monitor-maintenance';
import { claimDeliveries, acknowledgeDelivery } from '@/src/server/delivery';
import type { MonitoringProfile } from '@/src/domain/monitoring';
export const dynamic='force-dynamic';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
async function body(request:Request){if(Number(request.headers.get('content-length'))>150000)throw new HttpError(413,'Request too large.');const raw=await request.text();if(raw.length>150000)throw new HttpError(413,'Request too large.');try{return JSON.parse(raw)}catch{throw new HttpError(400,'Invalid JSON.');}}
async function handle(request:Request){try{
 const url=new URL(request.url),path=url.pathname.replace(/^\/api\//,'').split('/'),method=request.method,db=database();
 if(path[0]==='auth')return handleAuth(request,path.slice(1));
 if(path[0]==='jobs'){
  if(!runtime().CRON_SECRET||!equalSecret(request.headers.get('authorization')||'',`Bearer ${runtime().CRON_SECRET}`))throw new HttpError(401,'Unauthorized.');
  if(method!=='POST')throw new HttpError(405,'POST required.');
  if(path[1]==='auth-health'){await sendSmtp();return json({smtp:'connected'});}
  if(path[1]==='repair-sources')return json(await repairSourceCopies());
  if(path[1]==='monitor')return json(await monitorNext());
  if(path[1]==='monitor-status')return json((await db.prepare(`SELECT c.source_id,c.status,c.detail,count(*) AS checks,min(c.next_run) AS next_run ${CURRENT_CHECKS} WHERE p.status='active' GROUP BY c.source_id,c.status,c.detail`).all()).results);
  if(path[1]==='retry-failed'){await retryFailedChecks(db);return json({ok:true});}
  if(path[1]==='deliveries')return json(await claimDeliveries());
  if(path[1]==='ack'){const input=z.object({id:z.string(),success:z.boolean(),error:z.string().optional(),unattempted:z.boolean().optional()}).parse(await body(request));await acknowledgeDelivery(input.id,input.success,input.error,input.unattempted);return json({ok:true});}
  if(path[1]==='cleanup'){await cleanupAuth();await db.batch([db.prepare('DELETE FROM rate_limits WHERE expires_at<?').bind(Date.now()),db.prepare('DELETE FROM email_verifications WHERE expires_at<?').bind(Date.now()),db.prepare('DELETE FROM search_cache WHERE expires_at<?').bind(Date.now())]);return json({ok:true});}
  throw new HttpError(404,'Unknown job.');
 }
 if(path[0]==='verify-email'&&method==='GET')return new Response(null,{status:302,headers:{location:'/verify-email#change='+encodeURIComponent(url.searchParams.get('token')||''),'cache-control':'no-store','referrer-policy':'no-referrer'}});
 if(method!=='GET'&&request.headers.get('origin')!==url.origin)throw new HttpError(403,'Request origin is not allowed.');
 const session=await getSession(request.headers,url.href);if(!session)throw new HttpError(401,'Sign in to continue.');
 const owner=session.owner_id;
 if(method==='GET'&&path[0]==='state')return json(await state(owner));
 if(method==='GET'&&path[0]==='health')return json(await health(owner));
 if(path[0]==='topics'&&method==='POST'){await rateLimit(owner,'topics',30);const {input}=z.object({input:z.string().trim().min(2).max(3000)}).parse(await body(request));return json(await suggestTopics(input));}
 if(path[0]==='sources'&&method==='GET')return json(path[1]==='cantons'?cantonSources(decodeURIComponent(path[2])):sources);
 if(path[0]==='preview'&&method==='POST'){const input=await body(request);const current=await state(owner);const ids=new Set((input.profile?.topics||[]).filter((t:{selected:boolean})=>t.selected).map((t:{id:string})=>t.id));return json(current.updates.find(u=>u.topic_ids.some(id=>ids.has(id)))||null);}
 if(path[0]==='profiles'){
  if(method==='POST'&&!path[1]){
   await rateLimit(owner,'create-profile',20);const count=await db.prepare('SELECT COUNT(*) n FROM profiles WHERE owner_id=?').bind(owner).first<{n:number}>();if((count?.n||0)>=50)throw new HttpError(400,'Your account can have up to 50 profiles.');
   const p=profileSchema.parse(await body(request));p.sources=p.sources.map(canonicalSource);for(const s of p.sources)if(s.url)safeUrl(s.url);
   const now=new Date().toISOString();p.created_at=now;p.updated_at=now;
   const collision=await db.prepare('SELECT owner_id FROM profiles WHERE id=?').bind(p.id).first<{owner_id:string}>();if(collision){if(collision.owner_id!==owner)throw new HttpError(409,'Profile ID already exists.');return json(await getProfile(owner,p.id));}
   const saved=await db.prepare('INSERT INTO profiles(id,owner_id,data,status,next_run,lease_until) SELECT ?,?,?,?,0,0 WHERE (SELECT count(*) FROM profiles WHERE owner_id=?)<50 RETURNING id').bind(p.id,owner,JSON.stringify(p),p.status,owner).first();if(!saved)throw new HttpError(400,'Your account can have up to 50 profiles.');return json(p,201);
  }
  const id=path[1],existing=await getProfile(owner,id);
  if(method==='PUT'){
   const p=profileSchema.parse(await body(request));if(p.id!==id)throw new HttpError(400,'Profile ID does not match.');p.sources=p.sources.map(canonicalSource);for(const s of p.sources)if(s.url)safeUrl(s.url);p.created_at=existing.created_at;p.updated_at=new Date().toISOString();
   await db.prepare('UPDATE profiles SET data=?,status=?,next_run=0,lease_until=0,lease_token=NULL WHERE id=? AND owner_id=?').bind(JSON.stringify(p),p.status,id,owner).run();return json(p);
  }
  if(method==='DELETE'){const {confirmation}=await body(request);if(confirmation!==existing.name)throw new HttpError(400,'Enter the exact profile name.');await db.prepare('DELETE FROM profiles WHERE id=? AND owner_id=?').bind(id,owner).run();return json({ok:true});}
  if(method==='POST'&&path[2]==='duplicate'){await rateLimit(owner,'create-profile',20);const now=new Date().toISOString(),p:MonitoringProfile={...existing,id:crypto.randomUUID(),name:`Copy of ${existing.name}`.slice(0,120),created_at:now,updated_at:now};const saved=await db.prepare('INSERT INTO profiles(id,owner_id,data,status,next_run,lease_until) SELECT ?,?,?,?,0,0 WHERE (SELECT count(*) FROM profiles WHERE owner_id=?)<50 RETURNING id').bind(p.id,owner,JSON.stringify(p),p.status,owner).first();if(!saved)throw new HttpError(400,'Your account can have up to 50 profiles.');return json(p,201);}
  if(method==='POST'&&path[2]==='monitor'){await rateLimit(owner,'monitor',30);await retryFailedChecks(db,owner,id);return json(await monitorNext(owner,id));}
 }
 if(path[0]==='updates'){
  const {update,sourceText}=await getUpdate(owner,path[1]);
  if(method==='GET'&&path[2]==='source')return json({update,title:update.headline,body:sourceText,disclosure:'Original publisher content; rights remain with the publisher.'});
  if(method==='PATCH'){const patch=patchSchema.parse(await body(request));const next={...update,...patch,...patch.feedback?{hidden:patch.feedback==='not_relevant'}:{}};await db.prepare('UPDATE updates SET data=json_patch(data,?) WHERE id=? AND owner_id=?').bind(JSON.stringify({...patch,...patch.feedback?{hidden:patch.feedback==='not_relevant'}:{}}),update.id,owner).run();return json((await getUpdate(owner,update.id)).update);}
  if(method==='GET')return json(update);
 }
 if(path[0]==='account'){
  if(method==='PUT'){
   const input=await body(request),account=accountSchema.parse(input),existing=await getAccount(owner),requested=account.email.toLowerCase();account.email=requested;
   const changing=requested.toLowerCase()!==existing.email.toLowerCase();
   let authenticatedHash:string|undefined;
   if(changing){await rateLimit(owner,'password',10);const credentials=await db.prepare('SELECT password_hash,password_salt FROM accounts WHERE id=?').bind(owner).first<{password_hash:string;password_salt:string}>();if(!credentials||!await matchesPassword(typeof input.currentPassword==='string'?input.currentPassword:'',credentials.password_salt,credentials.password_hash))throw new HttpError(400,'Enter your current password to change your email.');authenticatedHash=credentials.password_hash;}
   if(changing)account.email=existing.email;
   const {email:_email,...editable}=account;await db.prepare('UPDATE accounts SET data=json_patch(data,?) WHERE id=?').bind(JSON.stringify(editable),owner).run();
   if(changing)await requestEmailChange(owner,requested,authenticatedHash);
   return json(await getAccount(owner));
  }
  if(path[1]==='password'&&method==='POST')return handleAuth(request,['change-password']);
  if(path[1]==='export'&&method==='GET'){const data=await state(owner);const checks=await health(owner);return json({...data,monitoring:checks});}
  if(method==='DELETE'){await rateLimit(owner,'password',10);const input=z.object({password:z.string().max(256),confirmation:z.literal('DELETE')}).parse(await body(request));const row=await db.prepare('SELECT password_hash,password_salt FROM accounts WHERE id=?').bind(owner).first<{password_hash:string|null;password_salt:string|null}>();if(!row?.password_hash||!await matchesPassword(input.password,row.password_salt,row.password_hash))throw new HttpError(400,'The password is incorrect.');const removed=await db.prepare('DELETE FROM accounts WHERE id=? AND password_hash=? RETURNING id').bind(owner,row.password_hash).first();if(!removed)throw new HttpError(409,'Your password changed. Sign in and try again.');const response=json({ok:true});response.headers.set('set-cookie',authCookie(url.href));return response;}
 }
 throw new HttpError(404,'Not found.');
}catch(error){if(error instanceof z.ZodError)return json({error:error.issues[0]?.message||'Invalid input.'},400);if(error instanceof AnalysisDeferred){const response=json({error:error.message,retry_at:error.retryAt},503);response.headers.set('retry-after',String(Math.max(1,Math.ceil((error.retryAt-Date.now())/1000))));return response;}if(error instanceof HttpError)return json({error:error.message},error.status);console.error('Legal Feed request failed',error instanceof Error?error.message:'unknown');return json({error:'The service could not complete this request. Please try again.'},500);}}
export const GET=handle;export const POST=handle;export const PUT=handle;export const PATCH=handle;export const DELETE=handle;
