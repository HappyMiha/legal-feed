import {z} from 'zod';
import {hash} from './security';
import {HttpError} from './errors';
import type {FeedLimitRequest,FeedLimitReview,FeedQuota,MonitoringProfile} from '../domain/monitoring';

export const limitRequestInput=z.object({requested_limit:z.number().int().min(4).max(1000),reason:z.string().trim().min(1,'Explain why you need more feeds.').max(2000)}).strict();
export const reviewTokenInput=z.object({token:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
export const limitDecisionInput=z.discriminatedUnion('decision',[
 z.object({token:reviewTokenInput.shape.token,decision:z.literal('approve'),approved_limit:z.number().int().min(4).max(1000)}).strict(),
 z.object({token:reviewTokenInput.shape.token,decision:z.literal('reject')}).strict(),
]);
const visibleColumns='id,requested_limit,reason,status,approved_limit,created_at,expires_at,decided_at';
export async function getFeedQuota(db:D1Database,owner:string):Promise<FeedQuota>{
 const account=await db.prepare('SELECT feed_limit AS limit_value,(SELECT count(*) FROM profiles WHERE owner_id=accounts.id) AS used FROM accounts WHERE id=?').bind(owner).first<{limit_value:number;used:number}>();
 if(!account)throw new HttpError(404,'Account unavailable.');
 const request=await db.prepare(`SELECT ${visibleColumns} FROM feed_limit_requests WHERE owner_id=? ORDER BY rowid DESC LIMIT 1`).bind(owner).first<FeedLimitRequest>();
 if(request?.status==='pending'&&request.expires_at<=Date.now())request.status='expired';
 return {limit:account.limit_value,used:account.used,request};
}
export async function insertLimitedProfile(db:D1Database,owner:string,p:MonitoringProfile){
 const saved=await db.prepare(`INSERT INTO profiles(id,owner_id,data,status,next_run,lease_until)
 SELECT ?,id,?,?,0,0 FROM accounts WHERE id=? AND (SELECT count(*) FROM profiles WHERE owner_id=accounts.id)<feed_limit
 ON CONFLICT(id) DO NOTHING RETURNING id`).bind(p.id,JSON.stringify(p),p.status,owner).first();
 if(!saved){
  const existing=await db.prepare('SELECT data FROM profiles WHERE id=? AND owner_id=?').bind(p.id,owner).first<{data:string}>();
  if(existing)return JSON.parse(existing.data) as MonitoringProfile;
  const quota=await getFeedQuota(db,owner);throw new HttpError(409,`Your feed limit is ${quota.limit}. Request a higher limit in Feed limit, or delete a feed before creating another.`);
 }
 return p;
}
export async function expireLimitRequests(db:D1Database){
 await db.prepare("UPDATE feed_limit_requests SET status='expired',mail_status='cancelled',mail_payload='' WHERE status='pending' AND expires_at<=?").bind(Date.now()).run();
}
export async function requestFeedLimit(db:D1Database,owner:string,input:unknown,siteUrl:string){
 const {requested_limit,reason}=limitRequestInput.parse(input),quota=await getFeedQuota(db,owner);
 if(requested_limit<=quota.limit||requested_limit<quota.used)throw new HttpError(400,`Request a total of at least ${Math.max(quota.limit+1,quota.used)} feeds.`);
 await expireLimitRequests(db);
 const account=await db.prepare('SELECT a.data,i.email FROM accounts a JOIN auth_identities i ON i.owner_id=a.id WHERE a.id=?').bind(owner).first<{data:string;email:string}>();
 if(!account)throw new HttpError(401,'Verify your account email first.');
 const id=crypto.randomUUID(),token=Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
 const now=Date.now(),expires=now+7*86400000,base=new URL('/feed-limit-review',siteUrl).href;
 const link=(action:string)=>`${base}#token=${token}&action=${action}`;
 const message={id:`limit:${id}`,to:'info@helveticlens.ch',subject:`Legal Feed: request for ${requested_limit} feeds`,text:
  `Feed limit increase request\n\nAccount: ${JSON.parse(account.data).name}\nVerified email: ${account.email}\nFeeds used: ${quota.used}\nCurrent total limit: ${quota.limit}\nRequested total limit: ${requested_limit}\n\nReason supplied by the user:\n${reason}\n\nApprove ${requested_limit} total feeds:\n${link('approve')}\n\nDecline this request:\n${link('reject')}\n\nApprove a different total:\n${link('custom')}\n\nEach link opens a review page. A decision is saved only after you press its confirmation button. These private links expire in 7 days. Do not forward them.`};
 const row=await db.prepare(`INSERT INTO feed_limit_requests(id,owner_id,requested_limit,reason,token_hash,expires_at,created_at,mail_payload)
 SELECT ?,id,?,?,?,?,?,? FROM accounts WHERE id=? AND feed_limit<? AND (SELECT count(*) FROM profiles WHERE owner_id=accounts.id)<=?
 AND NOT EXISTS(SELECT 1 FROM feed_limit_requests WHERE owner_id=accounts.id AND status='pending')
 ON CONFLICT DO NOTHING RETURNING id`).bind(id,requested_limit,reason,await hash(token),expires,new Date(now).toISOString(),JSON.stringify(message),owner,requested_limit,requested_limit).first();
 if(!row)throw new HttpError(409,'A request is already pending, or your feed limit changed. Refresh and try again.');
 return id;
}
export async function readLimitReview(db:D1Database,token:string):Promise<FeedLimitReview>{
 reviewTokenInput.parse({token});
 const row=await db.prepare(`SELECT r.id,r.requested_limit,r.reason,r.status,r.approved_limit,r.created_at,r.expires_at,r.decided_at,
 json_extract(a.data,'$.name') AS name,i.email,a.feed_limit AS limit_value,(SELECT count(*) FROM profiles WHERE owner_id=a.id) AS used
 FROM feed_limit_requests r JOIN accounts a ON a.id=r.owner_id JOIN auth_identities i ON i.owner_id=a.id WHERE r.token_hash=?`).bind(await hash(token)).first<FeedLimitRequest & {name:string;email:string;limit_value:number;used:number}>();
 if(!row)throw new HttpError(404,'This review link is invalid or the account was deleted.');
 if(row.expires_at<=Date.now())throw new HttpError(410,'This review link has expired. The user can submit a new request.');
 const {limit_value,...rest}=row;return {...rest,limit:limit_value};
}
export async function decideFeedLimit(db:D1Database,input:unknown){
 const decision=limitDecisionInput.parse(input),review=await readLimitReview(db,decision.token),approved=decision.decision==='approve'?decision.approved_limit:null;
 if(review.status!=='pending')throw new HttpError(409,'This request has already been decided.');
 if(approved!==null&&(approved<=review.limit||approved<review.used))throw new HttpError(400,`The approved total must be at least ${Math.max(review.limit+1,review.used)}.`);
 const nonce=crypto.randomUUID(),tokenHash=await hash(decision.token),now=Date.now();
 const results=await db.batch([
  db.prepare(`UPDATE feed_limit_requests SET status=?,approved_limit=?,decision_nonce=?,decided_at=?,mail_status='cancelled',mail_payload=''
  WHERE token_hash=? AND status='pending' AND expires_at>? AND (? IS NULL OR EXISTS(SELECT 1 FROM accounts a WHERE a.id=owner_id AND a.feed_limit<? AND (SELECT count(*) FROM profiles WHERE owner_id=a.id)<=?))`)
  .bind(approved===null?'rejected':'approved',approved,nonce,new Date(now).toISOString(),tokenHash,now,approved,approved,approved),
  db.prepare(`UPDATE accounts SET feed_limit=? WHERE ? IS NOT NULL AND EXISTS(SELECT 1 FROM feed_limit_requests r WHERE r.owner_id=accounts.id AND r.token_hash=? AND r.status='approved' AND r.decision_nonce=?)`).bind(approved,approved,tokenHash,nonce),
 ]);
 if(!results[0].meta.changes)throw new HttpError(409,'This request changed or expired. Use Reload request to check its status.');
 return readLimitReview(db,decision.token);
}
