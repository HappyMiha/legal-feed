// Only enabled sources belong to the current monitoring status; retain older checks as history.
export const CURRENT_CHECKS=`FROM source_checks c JOIN profiles p ON p.id=c.profile_id
 JOIN json_each(p.data,'$.sources') s ON json_extract(s.value,'$.id')=c.source_id AND json_extract(s.value,'$.active')=1`;

export async function retryFailedChecks(db:D1Database,owner?:string,profileId?:string){
 const now=Date.now();
 const scope=`SELECT c.id ${CURRENT_CHECKS} WHERE p.status='active' AND p.lease_until<=? AND c.status='error' ${owner?'AND p.owner_id=?':''} ${profileId?'AND p.id=?':''}`;
 const args=[now,...owner?[owner]:[],...profileId?[profileId]:[]];
 // Keep the previous failure visible until a genuine check replaces it. Never break a live lease.
 return db.batch([
  db.prepare(`UPDATE profiles SET next_run=0 WHERE id IN (SELECT c.profile_id ${CURRENT_CHECKS} WHERE c.id IN (${scope}))`).bind(...args),
  db.prepare(`UPDATE source_checks SET next_run=0,analysis_attempts=0 WHERE id IN (${scope})`).bind(...args),
 ]);
}
