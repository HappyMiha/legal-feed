import type {Account,MonitoringProfile,Update} from '../domain/monitoring';
import {database,runtime} from './runtime';
import {getAccount,getProfiles} from './store';
import {hash} from './security';
import {claimVerifications,ackVerification} from './email-verification';
import {claimAuthMail,ackAuthMail} from './auth-mail';
import {claimLimitMail,ackLimitMail} from './feed-limit-mail';
export {zurichTime,isQuiet,eligible} from './delivery-policy';
import {zurichTime,isQuiet,eligible} from './delivery-policy';
export async function queueDelivery(owner:string,profile:MonitoringProfile,items:Update[],kind:'instant'|'weekly'){
 if(!items.length||!profile.delivery.channels.includes('email'))return;
 const batch=kind==='weekly'?zurichTime().date:items.map(u=>u.id).sort().join(',');const id=await hash(`${profile.id}:${kind}:${batch}`);
 await database().prepare('INSERT INTO outbox(id,owner_id,profile_id,data,status,attempts,next_attempt,created_at) VALUES(?,?,?,?,\'pending\',0,0,?) ON CONFLICT(id) DO NOTHING').bind(id,owner,profile.id,JSON.stringify({kind,update_ids:items.map(u=>u.id)}),new Date().toISOString()).run();
}
export async function queueWeekly(){
 const now=zurichTime();const rows=await database().prepare("SELECT DISTINCT owner_id FROM profiles WHERE status='active'").all<{owner_id:string}>();
 for(const {owner_id} of rows.results){for(const p of await getProfiles(owner_id)){if(p.status!=='active'||p.delivery.frequency==='instant'||now.day!==(p.delivery.digest_day||'monday')||now.time<(p.delivery.digest_time||'07:00'))continue;
 const since=new Date(Date.now()-7*86400000).toISOString();const updates=await database().prepare('SELECT data FROM updates WHERE profile_id=? AND discovered_at>=?').bind(p.id,since).all<{data:string}>();await queueDelivery(owner_id,p,eligible(p,updates.results.map(r=>JSON.parse(r.data))),'weekly');}}
}
export async function claimDeliveries(){
 await queueWeekly();const db=database(),now=Date.now();
 await db.prepare("UPDATE outbox SET status='failed',error=coalesce(error,'Delivery attempt limit reached') WHERE status IN ('pending','sending') AND attempts>=8 AND next_attempt<=?").bind(now).run();
 const clock=zurichTime().time;
 const rows=await db.prepare(`SELECT o.* FROM outbox o JOIN profiles p ON p.id=o.profile_id JOIN accounts a ON a.id=o.owner_id
 WHERE (o.status='pending' OR o.status='sending') AND o.next_attempt<=? AND o.attempts<8 AND p.status='active'
 AND length(coalesce(json_extract(a.data,'$.email'),''))>0
 AND NOT (CASE WHEN json_extract(a.data,'$.quiet_start')=json_extract(a.data,'$.quiet_end') THEN 0
 WHEN json_extract(a.data,'$.quiet_start')<json_extract(a.data,'$.quiet_end') THEN ? >=json_extract(a.data,'$.quiet_start') AND ? <json_extract(a.data,'$.quiet_end')
 ELSE ? >=json_extract(a.data,'$.quiet_start') OR ? <json_extract(a.data,'$.quiet_end') END)
 ORDER BY o.created_at LIMIT 30`).bind(now,clock,clock,clock,clock).all<{id:string;owner_id:string;profile_id:string;data:string;status:string;attempts:number}>();
 const result=[...await claimLimitMail(),...await claimAuthMail(),...await claimVerifications()];
 for(const row of rows.results){if(result.length>=30)break;const account=await getAccount(row.owner_id);if(isQuiet(account)||!account.email)continue;
 const profiles=await getProfiles(row.owner_id),p=profiles.find(p=>p.id===row.profile_id);if(!p||p.status!=='active')continue;
 const {update_ids,kind}=JSON.parse(row.data) as {update_ids:string[];kind:string};if((kind==='instant'&&p.delivery.frequency==='weekly')||(kind==='weekly'&&p.delivery.frequency==='instant')){await db.prepare("UPDATE outbox SET status='cancelled' WHERE id=?").bind(row.id).run();continue;}const records=await db.prepare('SELECT data FROM updates WHERE profile_id=? AND owner_id=?').bind(row.profile_id,row.owner_id).all<{data:string}>();const items=eligible(p,records.results.map(r=>JSON.parse(r.data) as Update)).filter(u=>update_ids.includes(u.id));
 if(!items.length){await db.prepare("UPDATE outbox SET status='cancelled' WHERE id=?").bind(row.id).run();continue;}
 const claimed=await db.prepare("UPDATE outbox SET status='sending',attempts=attempts+1,next_attempt=? WHERE id=? AND next_attempt<=? RETURNING id").bind(now+15*60000,row.id,now).first();if(!claimed)continue;
 const origin=runtime().SITE_URL||'';const text=`${kind==='weekly'?'Weekly digest':'New legal update'} · ${p.name}\n\n`+items.map(u=>`${u.headline}\n${u.source_name} · ${u.date_kind==='discovered'?'Discovered':'Published'} ${u.published_at}\n\n${u.summary}\n\nWhy it matters: ${u.why_it_matters}\nSource: ${u.url}\nOpen: ${origin}/updates/${u.id}`).join('\n\n──────────\n\n')+`\n\nManage delivery or pause monitoring: ${origin}/profiles/${p.id}\nLegal Feed · AI-assisted summaries; consult the linked original source.`;
 result.push({id:row.id,to:account.email,subject:`Legal Feed: ${items.length} ${items.length===1?'update':'updates'} for ${p.name}`,text});
 }return result;
}
export async function acknowledgeDelivery(id:string,success:boolean,error?:string,unattempted=false){if(id.startsWith('limit:'))return ackLimitMail(id.slice(6),success,unattempted);if(id.startsWith('auth:'))return ackAuthMail(id.slice(5),success,unattempted);if(id.startsWith('verify:'))return ackVerification(id.slice(7),success,unattempted);if(unattempted){await database().prepare("UPDATE outbox SET status='pending',attempts=max(0,attempts-1),next_attempt=?,error=? WHERE id=? AND status='sending'").bind(Date.now()+1800000,error?.slice(0,500)||null,id).run();return;}await database().prepare("UPDATE outbox SET status=CASE WHEN ?='pending' AND attempts>=8 THEN 'failed' ELSE ? END,sent_at=?,error=?,next_attempt=? WHERE id=? AND status='sending'").bind(success?'sent':'pending',success?'sent':'pending',success?new Date().toISOString():null,error?.slice(0,500)||null,Date.now()+30*60000,id).run();}
