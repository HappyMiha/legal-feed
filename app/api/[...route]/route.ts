import { z } from 'zod';
import { getChatGPTUser } from '../../chatgpt-auth';
import { database, runtime, HttpError, rateLimit } from '@/src/server/runtime';
import { ensureAccount, state, getProfile, getUpdate, getAccount, health } from '@/src/server/store';
import { profileSchema, accountSchema, patchSchema } from '@/src/server/validation';
import { sources, cantonSources, canonicalSource } from '@/src/server/catalog';
import {requestEmailChange,verifyEmail} from '@/src/server/email-verification';
import { suggestTopics } from '@/src/server/ai';
import { safeUrl, passwordHash, equalSecret } from '@/src/server/security';
import { monitorNext } from '@/src/server/monitor';
import { claimDeliveries, acknowledgeDelivery } from '@/src/server/delivery';
import type { MonitoringProfile } from '@/src/domain/monitoring';
export const dynamic='force-dynamic';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
async function body(request:Request){if(Number(request.headers.get('content-length'))>150000)throw new HttpError(413,'Request too large.');const raw=await request.text();if(raw.length>150000)throw new HttpError(413,'Request too large.');try{return JSON.parse(raw)}catch{throw new HttpError(400,'Invalid JSON.');}}
async function handle(request:Request){try{
 const url=new URL(request.url),path=url.pathname.replace(/^\/api\//,'').split('/'),method=request.method,db=database();
 if(path[0]==='jobs'){
  if(!runtime().CRON_SECRET||!equalSecret(request.headers.get('authorization')||'',`Bearer ${runtime().CRON_SECRET}`))throw new HttpError(401,'Unauthorized.');
  if(method!=='POST')throw new HttpError(405,'POST required.');
  if(path[1]==='monitor')return json(await monitorNext());
  if(path[1]==='deliveries')return json(await claimDeliveries());
  if(path[1]==='ack'){const input=z.object({id:z.string(),success:z.boolean(),error:z.string().optional(),unattempted:z.boolean().optional()}).parse(await body(request));await acknowledgeDelivery(input.id,input.success,input.error,input.unattempted);return json({ok:true});}
  if(path[1]==='cleanup'){await db.batch([db.prepare('DELETE FROM rate_limits WHERE expires_at<?').bind(Date.now()),db.prepare('DELETE FROM email_verifications WHERE expires_at<?').bind(Date.now())]);return json({ok:true});}
  throw new HttpError(404,'Unknown job.');
 }
 if(path[0]==='verify-email'&&method==='GET'){await verifyEmail(url.searchParams.get('token')||'');return new Response('<!doctype html><html lang="en"><meta charset="utf-8"><title>Email verified · Legal Feed</title><body><h1>Email verified</h1><p>Your Legal Feed notification address is updated.</p><a href="/settings">Return to settings</a></body></html>',{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','referrer-policy':'no-referrer'}});}
 const user=await getChatGPTUser();if(!user)throw new HttpError(401,'Sign in to continue.');
 if(method!=='GET'&&request.headers.get('origin')!==url.origin)throw new HttpError(403,'Request origin is not allowed.');
 await ensureAccount(user);const owner=user.userId;
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
  if(method==='POST'&&path[2]==='monitor'){await rateLimit(owner,'monitor',30);return json(await monitorNext(owner,id));}
 }
 if(path[0]==='updates'){
  const {update,sourceText}=await getUpdate(owner,path[1]);
  if(method==='GET'&&path[2]==='source')return json({update,title:update.headline,body:sourceText,disclosure:'Original publisher content; rights remain with the publisher.'});
  if(method==='PATCH'){const patch=patchSchema.parse(await body(request));const next={...update,...patch,...patch.feedback?{hidden:patch.feedback==='not_relevant'}:{}};await db.prepare('UPDATE updates SET data=json_patch(data,?) WHERE id=? AND owner_id=?').bind(JSON.stringify({...patch,...patch.feedback?{hidden:patch.feedback==='not_relevant'}:{}}),update.id,owner).run();return json((await getUpdate(owner,update.id)).update);}
  if(method==='GET')return json(update);
 }
 if(path[0]==='account'){
  if(method==='PUT'){
   const account=accountSchema.parse(await body(request)),existing=await getAccount(owner),requested=account.email;
   const changing=requested.toLowerCase()!==existing.email.toLowerCase();
   if(changing)account.email=existing.email;
   await db.prepare('UPDATE accounts SET data=? WHERE id=?').bind(JSON.stringify({...account,...existing.pending_email?{pending_email:existing.pending_email}:{}}),owner).run();
   if(changing)await requestEmailChange(owner,requested);
   return json(await getAccount(owner));
  }
  if(path[1]==='password'&&method==='POST'){
   await rateLimit(owner,'password',10);const input=z.object({currentPassword:z.string().max(256).optional(),newPassword:z.string().min(8).max(256)}).parse(await body(request));
   const row=await db.prepare('SELECT password_hash,password_salt FROM accounts WHERE id=?').bind(owner).first<{password_hash:string|null;password_salt:string|null}>();if(row?.password_hash&&!equalSecret(await passwordHash(input.currentPassword||'',row.password_salt!),row.password_hash))throw new HttpError(400,'The current password is incorrect.');const salt=crypto.randomUUID();await db.prepare('UPDATE accounts SET password_hash=?,password_salt=? WHERE id=?').bind(await passwordHash(input.newPassword,salt),salt,owner).run();return json({ok:true});
  }
  if(path[1]==='export'&&method==='GET'){const data=await state(owner);const checks=await health(owner);return json({...data,monitoring:checks});}
  if(method==='DELETE'){await rateLimit(owner,'password',10);const input=z.object({password:z.string().max(256),confirmation:z.literal('DELETE')}).parse(await body(request));const row=await db.prepare('SELECT password_hash,password_salt FROM accounts WHERE id=?').bind(owner).first<{password_hash:string|null;password_salt:string|null}>();if(!row?.password_hash||!equalSecret(await passwordHash(input.password,row.password_salt!),row.password_hash))throw new HttpError(400,'The password is incorrect.');await db.prepare('DELETE FROM accounts WHERE id=?').bind(owner).run();return json({ok:true});}
 }
 throw new HttpError(404,'Not found.');
}catch(error){if(error instanceof z.ZodError)return json({error:error.issues[0]?.message||'Invalid input.'},400);if(error instanceof HttpError)return json({error:error.message},error.status);console.error('Legal Feed request failed',error instanceof Error?error.message:'unknown');return json({error:'The service could not complete this request. Please try again.'},500);}}
export const GET=handle;export const POST=handle;export const PUT=handle;export const PATCH=handle;export const DELETE=handle;
