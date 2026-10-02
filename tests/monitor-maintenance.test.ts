import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {CURRENT_CHECKS,retryFailedChecks,nextMonitoringProfile} from '../src/server/monitor-maintenance';

test('current health excludes disabled/removed sources; recheck preserves failures and active leases',async()=>{
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec('CREATE TABLE profiles(id TEXT PRIMARY KEY,owner_id TEXT,data TEXT,status TEXT,next_run INTEGER,lease_until INTEGER,lease_token TEXT); CREATE TABLE source_checks(id TEXT PRIMARY KEY,profile_id TEXT,source_id TEXT,checked_at TEXT,status TEXT,detail TEXT,next_run INTEGER,analysis_attempts INTEGER)');
 const sources=[{id:'enabled',active:true},{id:'disabled',active:false}];
 for(const [id,owner,status,lease] of [['mine','one','active',0],['other','two','active',0],['paused','one','paused',0],['busy','one','active',Date.now()+60000]] as const){
  sqlite.prepare('INSERT INTO profiles VALUES(?,?,?,?,?,?,?)').run(id,owner,JSON.stringify({sources}),status,123456,lease,lease?'live-token':null);
  for(const source of ['enabled','disabled','removed'])sqlite.prepare('INSERT INTO source_checks VALUES(?,?,?,?,?,?,?,?)').run(id+':'+source,id,source,'2026-10-02','error','Real previous failure',123456,3);
 }
 sqlite.prepare('INSERT INTO source_checks VALUES(?,?,?,?,?,?,?,?)').run('mine:ok','mine','enabled','2026-10-02','ok','Real previous success',123456,0);
 const db={prepare(sql:string){let args:(string|number|null)[]=[];const query={bind(...values:typeof args){args=values;return query;},run(){return sqlite.prepare(sql).run(...args);}};return query;},async batch(statements:{run:()=>unknown}[]){sqlite.exec('BEGIN');try{const results=statements.map(s=>s.run());sqlite.exec('COMMIT');return results;}catch(error){sqlite.exec('ROLLBACK');throw error;}}} as unknown as D1Database;
 const health=sqlite.prepare(`SELECT c.source_id ${CURRENT_CHECKS} WHERE p.owner_id=?`).all('one');assert.ok(health.every(row=>row.source_id==='enabled'));
 await retryFailedChecks(db,'one','mine');
 const refreshed=sqlite.prepare("SELECT * FROM source_checks WHERE id='mine:enabled'").get()!;
 assert.equal(refreshed.next_run,0);assert.equal(refreshed.analysis_attempts,0);assert.equal(refreshed.status,'error');assert.equal(refreshed.checked_at,'2026-10-02');assert.equal(refreshed.detail,'Real previous failure');
 for(const id of ['mine:disabled','mine:removed','mine:ok','other:enabled','paused:enabled','busy:enabled'])assert.equal(sqlite.prepare('SELECT next_run FROM source_checks WHERE id=?').get(id)!.next_run,123456);
 assert.equal(sqlite.prepare("SELECT next_run FROM profiles WHERE id='mine'").get()!.next_run,0);
 assert.equal(sqlite.prepare("SELECT lease_token FROM profiles WHERE id='busy'").get()!.lease_token,'live-token');
 await retryFailedChecks(db);assert.equal(sqlite.prepare("SELECT next_run FROM source_checks WHERE id='other:enabled'").get()!.next_run,0);
 assert.equal(sqlite.prepare("SELECT next_run FROM source_checks WHERE id='busy:enabled'").get()!.next_run,123456);sqlite.close();
});

test('due enabled failures take priority without bypassing owners, backoff, pauses or leases',async()=>{
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec('CREATE TABLE profiles(id TEXT,owner_id TEXT,data TEXT,status TEXT,next_run INTEGER,lease_until INTEGER); CREATE TABLE source_checks(profile_id TEXT,source_id TEXT,status TEXT,next_run INTEGER)');
 for(const [id,owner,next,status,lease] of [['backlog','one',0,'active',0],['recovery','two',10,'active',0],['busy','two',0,'active',1000],['paused','two',0,'paused',0]] as const){
  sqlite.prepare('INSERT INTO profiles VALUES(?,?,?,?,?,?)').run(id,owner,JSON.stringify({sources:[{id:'enabled',active:true},{id:'disabled',active:false}]}),status,next,lease);
  sqlite.prepare('INSERT INTO source_checks VALUES(?,?,?,?)').run(id,id==='backlog'?'disabled':'enabled','error',0);
 }
 const db={prepare(sql:string){let args:(string|number)[]=[];const query={bind(...values:typeof args){args=values;return query;},async first(){return sqlite.prepare(sql).get(...args)||null;}};return query;}} as unknown as D1Database;
 assert.equal((await nextMonitoringProfile(db,100))?.id,'recovery');
 assert.equal((await nextMonitoringProfile(db,100,'one'))?.id,'backlog');
 assert.equal(await nextMonitoringProfile(db,100,'one','recovery'),null);
 assert.equal(await nextMonitoringProfile(db,100,undefined,'busy'),null);
 assert.equal(await nextMonitoringProfile(db,100,undefined,'paused'),null);
 sqlite.exec("UPDATE source_checks SET next_run=200 WHERE profile_id='recovery'");assert.equal((await nextMonitoringProfile(db,100))?.id,'backlog');
 sqlite.exec("UPDATE source_checks SET status='ok',next_run=0 WHERE profile_id='recovery'");assert.equal((await nextMonitoringProfile(db,100))?.id,'backlog');
 sqlite.exec("UPDATE source_checks SET status='retrying' WHERE profile_id='recovery'");assert.equal((await nextMonitoringProfile(db,100))?.id,'recovery');sqlite.close();
});
