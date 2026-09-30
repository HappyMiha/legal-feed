import {database,runtime,HttpError,rateLimit} from './runtime';
import {hash} from './security';
export async function requestEmailChange(owner:string,email:string){
 await rateLimit(owner,'email-change',3);
 const token=crypto.randomUUID()+crypto.randomUUID(),id=crypto.randomUUID(),tokenHash=await hash(token);
 const url=`${runtime().SITE_URL}/api/verify-email?token=${encodeURIComponent(token)}`;
 const payload={id:`verify:${id}`,to:email,subject:'Verify your Legal Feed email',text:`Confirm this email address for Legal Feed notifications:\n\n${url}\n\nThe link expires in 24 hours. If you did not request this change, ignore this email.`};
 await database().batch([
  database().prepare('DELETE FROM email_verifications WHERE owner_id=?').bind(owner),
  database().prepare('INSERT INTO email_verifications(id,owner_id,email,token_hash,payload,status,attempts,next_attempt,expires_at) VALUES(?,?,?,?,?,\'pending\',0,0,?)').bind(id,owner,email,tokenHash,JSON.stringify(payload),Date.now()+86400000),
  database().prepare("UPDATE accounts SET data=json_set(data,'$.pending_email',?) WHERE id=?").bind(email,owner),
 ]);
}
export async function verifyEmail(token:string){
 if(token.length>200)throw new HttpError(400,'Invalid verification link.');
 const db=database(),row=await db.prepare('SELECT id,owner_id,email FROM email_verifications WHERE token_hash=? AND expires_at>?').bind(await hash(token),Date.now()).first<{id:string;owner_id:string;email:string}>();
 if(!row)throw new HttpError(400,'This verification link is invalid or expired.');
 await db.batch([db.prepare("UPDATE accounts SET data=json_remove(json_set(data,'$.email',?),'$.pending_email') WHERE id=? AND json_extract(data,'$.pending_email')=?").bind(row.email,row.owner_id,row.email),db.prepare('DELETE FROM email_verifications WHERE id=?').bind(row.id)]);
}
export async function claimVerifications(){
 const now=Date.now(),db=database();const rows=await db.prepare("SELECT id,payload FROM email_verifications WHERE status IN ('pending','sending') AND next_attempt<=? AND expires_at>? AND attempts<5 LIMIT 10").bind(now,now).all<{id:string;payload:string}>();const items=[];
 for(const row of rows.results){const r=await db.prepare("UPDATE email_verifications SET status='sending',attempts=attempts+1,next_attempt=? WHERE id=? AND next_attempt<=? RETURNING id").bind(now+900000,row.id,now).first();if(r)items.push(JSON.parse(row.payload));}return items;
}
export async function ackVerification(id:string,success:boolean,unattempted=false){if(unattempted){await database().prepare("UPDATE email_verifications SET status='pending',attempts=max(0,attempts-1),next_attempt=? WHERE id=? AND status='sending'").bind(Date.now()+1800000,id).run();return;}await database().prepare("UPDATE email_verifications SET status=?,payload=CASE WHEN ? THEN '' ELSE payload END,next_attempt=? WHERE id=? AND status='sending'").bind(success?'sent':'pending',success?1:0,Date.now()+1800000,id).run();}
