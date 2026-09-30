import type {MonitoringProfile} from '../domain/monitoring';
import {database} from './runtime';
import {collect,analyse} from './ingestion';
import {eligible} from './delivery';
import {hash} from './security';
export async function monitorNext(owner?:string,profileId?:string){
 const db=database(),now=Date.now(),token=crypto.randomUUID();
 const candidate=await db.prepare(`SELECT id,owner_id,data FROM profiles WHERE status='active' AND lease_until<? AND next_run<=? ${owner?'AND owner_id=?':''} ${profileId?'AND id=?':''} ORDER BY next_run LIMIT 1`).bind(now,now,...owner?[owner]:[],...profileId?[profileId]:[]).first<{id:string;owner_id:string;data:string}>();
 if(!candidate)return {processed:false};
 const lock=await db.prepare("UPDATE profiles SET lease_until=?,lease_token=? WHERE id=? AND status='active' AND lease_until<? RETURNING id,data").bind(now+180000,token,candidate.id,now).first<{id:string;data:string}>();if(!lock)return {processed:false};
 const profile=JSON.parse(lock.data) as MonitoringProfile;
 try{
  const checks=await db.prepare('SELECT source_id,checked_at FROM source_checks WHERE profile_id=?').bind(profile.id).all<{source_id:string;checked_at:string}>();
  const checked=new Map(checks.results.map(r=>[r.source_id,new Date(r.checked_at).getTime()]));
  const source=profile.sources.filter(s=>s.active).sort((a,b)=>(checked.get(a.id)||0)-(checked.get(b.id)||0))[0];
  if(!source||now-(checked.get(source.id)||0)<3600000){await db.prepare('UPDATE profiles SET next_run=? WHERE id=? AND lease_token=?').bind(now+15*60000,profile.id,token).run();return {processed:true,idle:true};}
  let count=0,status='ok',detail='';
  try{
   const articles=await collect(source,profile);const existing=await db.prepare('SELECT canonical_url FROM updates WHERE profile_id=?').bind(profile.id).all<{canonical_url:string}>();const known=new Set(existing.results.map(r=>r.canonical_url));
   const config=JSON.stringify(profile.topics.filter(t=>t.selected));
   const fingerprints=await Promise.all(articles.map(a=>hash(profile.id+config+a.url+a.text)));
   const processed=await db.prepare('SELECT id FROM processed_documents WHERE profile_id=?').bind(profile.id).all<{id:string}>();const seen=new Set(processed.results.map(r=>r.id));
   const fresh=articles.filter((a,i)=>!known.has(a.url)&&!seen.has(fingerprints[i])).slice(0,12);
   const matches=await analyse(fresh,source,profile);
   const statements=[];
   for(const {update,sourceText} of matches){
    statements.push(db.prepare("INSERT INTO updates(id,owner_id,profile_id,canonical_url,data,source_text,discovered_at) SELECT ?,?,?,?,?,?,? FROM profiles WHERE id=? AND status='active' AND lease_token=? ON CONFLICT(profile_id,canonical_url) DO NOTHING").bind(update.id,candidate.owner_id,profile.id,update.url!,JSON.stringify(update),sourceText,new Date().toISOString(),profile.id,token));
    if(profile.delivery.frequency!=='weekly'&&eligible(profile,[update]).length){const deliveryId=await hash(`${profile.id}:instant:${update.id}`);statements.push(db.prepare("INSERT INTO outbox(id,owner_id,profile_id,data,status,attempts,next_attempt,created_at) SELECT ?,?,?,?,'pending',0,0,? FROM profiles WHERE id=? AND status='active' AND lease_token=? ON CONFLICT(id) DO NOTHING").bind(deliveryId,candidate.owner_id,profile.id,JSON.stringify({kind:'instant',update_ids:[update.id]}),new Date().toISOString(),profile.id,token));}
   }
   for(const a of fresh){const id=await hash(profile.id+config+a.url+a.text);statements.push(db.prepare("INSERT INTO processed_documents(id,profile_id,source_id,processed_at) SELECT ?,?,?,? FROM profiles WHERE id=? AND status='active' AND lease_token=? ON CONFLICT(id) DO NOTHING").bind(id,profile.id,source.id,new Date().toISOString(),profile.id,token));}
   if(statements.length)await db.batch(statements);
   count=matches.length;
   detail=`Checked ${articles.length} publications; ${count} new relevant updates.`;
  }catch(error){status='error';detail=error instanceof Error?error.message:'Source check failed.';}
  await db.prepare('INSERT INTO source_checks(id,profile_id,source_id,checked_at,status,detail) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET checked_at=excluded.checked_at,status=excluded.status,detail=excluded.detail').bind(`${profile.id}:${source.id}`,profile.id,source.id,new Date().toISOString(),status,detail).run();
  return {processed:true,profile:profile.id,source:source.name,status,updates:count,detail};
 }finally{await db.prepare('UPDATE profiles SET lease_until=0,lease_token=NULL,next_run=CASE WHEN next_run>? THEN next_run ELSE ? END WHERE id=? AND lease_token=?').bind(Date.now(),Date.now(),candidate.id,token).run();}
}
