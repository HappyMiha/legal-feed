import type {MonitoringProfile} from '../domain/monitoring';
import {database} from './runtime';
import {collect,analyse} from './ingestion';
import {eligible} from './delivery';
import {hash} from './security';
import {AnalysisDeferred,InvalidAnalysis,providerReadyAt} from './ai-provider';
import {MAX_ANALYSIS_ARTICLES} from './analysis-contract';
import {invalidAnalysisRetry} from './monitor-policy';
import {nextMonitoringProfile} from './monitor-maintenance';
export async function monitorNext(owner?:string,profileId?:string){
 const db=database(),now=Date.now(),token=crypto.randomUUID();
 const readyAt=await providerReadyAt(db);
 if(readyAt>now)return {processed:false,status:'retrying',retry_at:readyAt};
 const candidate=await nextMonitoringProfile(db,now,owner,profileId);
 if(!candidate){
  const due=await db.prepare(`SELECT min(max(next_run,lease_until)) AS ready FROM profiles WHERE status='active' ${owner?'AND owner_id=?':''} ${profileId?'AND id=?':''}`).bind(...owner?[owner]:[],...profileId?[profileId]:[]).first<{ready:number|null}>();
  return {processed:false,...due?.ready&&due.ready>now&&due.ready<now+120000?{retry_at:due.ready}:{}};
 }
 const lock=await db.prepare("UPDATE profiles SET lease_until=?,lease_token=? WHERE id=? AND status='active' AND lease_until<? RETURNING id,data").bind(now+180000,token,candidate.id,now).first<{id:string;data:string}>();if(!lock)return {processed:false};
 const profile=JSON.parse(lock.data) as MonitoringProfile;
 try{
  const checks=await db.prepare('SELECT source_id,next_run,analysis_attempts,status FROM source_checks WHERE profile_id=?').bind(profile.id).all<{source_id:string;next_run:number;analysis_attempts:number;status:string}>();
  const due=new Map(checks.results.map(r=>[r.source_id,r.next_run]));
  const retrying=new Set(checks.results.filter(check=>['error','retrying'].includes(check.status)&&check.next_run<=now).map(check=>check.source_id));
  const source=profile.sources.filter(s=>s.active).sort((a,b)=>Number(retrying.has(b.id))-Number(retrying.has(a.id))||(due.get(a.id)||0)-(due.get(b.id)||0))[0];
  if(!source||(due.get(source.id)||0)>now){await db.prepare('UPDATE profiles SET next_run=? WHERE id=? AND lease_token=?').bind(source?due.get(source.id)!:now+15*60000,profile.id,token).run();return {processed:true,idle:true};}
  let count=0,status='ok',detail='',nextRun=now+3600000,retryAt:number|undefined;
  let analysisAttempts=checks.results.find(check=>check.source_id===source.id)?.analysis_attempts||0;
  try{
   const articles=await collect(source,profile);const existing=await db.prepare('SELECT canonical_url FROM updates WHERE profile_id=?').bind(profile.id).all<{canonical_url:string}>();const known=new Set(existing.results.map(r=>r.canonical_url));
   const config=JSON.stringify(profile.topics.filter(t=>t.selected));
   const fingerprints=await Promise.all(articles.map(a=>hash(profile.id+config+a.url+a.text)));
   const processed=await db.prepare('SELECT id FROM processed_documents WHERE profile_id=?').bind(profile.id).all<{id:string}>();const seen=new Set(processed.results.map(r=>r.id));
   const remaining=articles.filter((a,i)=>!known.has(a.url)&&!seen.has(fingerprints[i]));
   const fresh=remaining.slice(0,analysisAttempts>0?1:MAX_ANALYSIS_ARTICLES);
   const matches=await analyse(fresh,source,profile);
   analysisAttempts=0;
   const statements=[];
   for(const {update,sourceText} of matches){
    statements.push(db.prepare("INSERT INTO updates(id,owner_id,profile_id,canonical_url,data,source_text,discovered_at) SELECT ?,?,?,?,?,?,? FROM profiles WHERE id=? AND status='active' AND lease_token=? ON CONFLICT(profile_id,canonical_url) DO NOTHING").bind(update.id,candidate.owner_id,profile.id,update.url!,JSON.stringify(update),sourceText,new Date().toISOString(),profile.id,token));
    if(profile.delivery.frequency!=='weekly'&&eligible(profile,[update]).length){const deliveryId=await hash(`${profile.id}:instant:${update.id}`);statements.push(db.prepare("INSERT INTO outbox(id,owner_id,profile_id,data,status,attempts,next_attempt,created_at) SELECT ?,?,?,?,'pending',0,0,? FROM profiles WHERE id=? AND status='active' AND lease_token=? ON CONFLICT(id) DO NOTHING").bind(deliveryId,candidate.owner_id,profile.id,JSON.stringify({kind:'instant',update_ids:[update.id]}),new Date().toISOString(),profile.id,token));}
   }
   for(const a of fresh){const id=await hash(profile.id+config+a.url+a.text);statements.push(db.prepare("INSERT INTO processed_documents(id,profile_id,source_id,processed_at) SELECT ?,?,?,? FROM profiles WHERE id=? AND status='active' AND lease_token=? ON CONFLICT(id) DO NOTHING").bind(id,profile.id,source.id,new Date().toISOString(),profile.id,token));}
   if(statements.length)await db.batch(statements);
   count=matches.length;
   detail=`Checked ${fresh.length} new publications; ${count} new relevant updates.`;
   if(remaining.length>fresh.length){status='queued';nextRun=Date.now();detail+=` ${remaining.length-fresh.length} publications queued for analysis.`;}
  }catch(error){
   if(error instanceof InvalidAnalysis){const retry=invalidAnalysisRetry(analysisAttempts);analysisAttempts=retry.attempts;status=retry.status;nextRun=retry.nextRun;detail=retry.detail;if(status==='retrying')retryAt=nextRun;}
   else if(error instanceof AnalysisDeferred){status='retrying';nextRun=retryAt=error.retryAt;detail='Analysis delayed by the provider. Automatic retry scheduled.';}
   else{status='error';detail=error instanceof Error?error.message:'Source check failed.';nextRun=Date.now()+15*60000;}
  }
  await db.prepare(`INSERT INTO source_checks(id,profile_id,source_id,checked_at,status,detail,next_run,analysis_attempts) SELECT ?,?,?,?,?,?,?,? FROM profiles WHERE id=? AND status='active' AND lease_token=?
   ON CONFLICT(id) DO UPDATE SET checked_at=excluded.checked_at,status=excluded.status,detail=excluded.detail,next_run=excluded.next_run,analysis_attempts=excluded.analysis_attempts`).bind(`${profile.id}:${source.id}`,profile.id,source.id,new Date().toISOString(),status,detail,nextRun,analysisAttempts,profile.id,token).run();
  return {processed:true,profile:profile.id,source:source.name,status,updates:count,detail,...retryAt?{retry_at:retryAt}:{}};
 }finally{await db.prepare('UPDATE profiles SET lease_until=0,lease_token=NULL,next_run=CASE WHEN next_run>? THEN next_run ELSE ? END WHERE id=? AND lease_token=?').bind(Date.now(),Date.now(),candidate.id,token).run();}
}
