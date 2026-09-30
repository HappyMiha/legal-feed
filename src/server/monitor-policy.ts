export function invalidAnalysisRetry(previousAttempts:number,now=Date.now()){
 const attempts=Math.min(3,Math.max(0,previousAttempts)+1);
 return {
  attempts,
  status:attempts<3?'retrying':'error',
  nextRun:now+(attempts<3?attempts*31000:3600000),
  detail:attempts<3?'The AI response needs another analysis. Automatic retry scheduled.':'AI analysis could not be validated after repeated attempts. Another check is scheduled; publications remain queued.',
 };
}
