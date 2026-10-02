import {database,runtime} from './runtime';
import {sendSmtp,type MailMessage} from './smtp';

async function claim(id:string){
 const now=Date.now();
 return database().prepare(`UPDATE feed_limit_requests SET mail_status='sending',mail_attempts=mail_attempts+1,mail_next_attempt=?
 WHERE id=? AND status='pending' AND expires_at>? AND mail_status IN ('pending','sending') AND mail_attempts<8 AND mail_next_attempt<=? RETURNING mail_payload`).bind(now+900000,id,now,now).first<{mail_payload:string}>();
}
export async function ackLimitMail(id:string,success:boolean,unattempted=false){
 await database().prepare("UPDATE feed_limit_requests SET mail_status=?,mail_payload=CASE WHEN ? THEN '' ELSE mail_payload END,mail_attempts=max(0,mail_attempts-?),mail_next_attempt=? WHERE id=? AND mail_status='sending'")
 .bind(success?'sent':'pending',success?1:0,unattempted?1:0,Date.now()+60000,id).run();
}
export async function sendLimitMail(id:string){
 const env=runtime(),local=['localhost','127.0.0.1'].includes(new URL(env.SITE_URL||'https://invalid').hostname);
 if(local&&env.AUTH_MAIL_TEST_STORE==='true')return;
 const row=await claim(id);if(!row)return;
 try{await sendSmtp(JSON.parse(row.mail_payload));await ackLimitMail(id,true);}
 catch{await ackLimitMail(id,false);console.error('Feed limit request email queued for retry.');}
}
export async function claimLimitMail(){
 const now=Date.now(),rows=await database().prepare("SELECT id FROM feed_limit_requests WHERE status='pending' AND expires_at>? AND mail_status IN ('pending','sending') AND mail_next_attempt<=? AND mail_attempts<8 ORDER BY created_at LIMIT 10").bind(now,now).all<{id:string}>();
 const messages:MailMessage[]=[];
 for(const {id} of rows.results){const row=await claim(id);if(row)messages.push(JSON.parse(row.mail_payload));}
 return messages;
}
