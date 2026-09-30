import {database,runtime} from './runtime';
import {sendSmtp,type MailMessage} from './smtp';

export async function sendAuthMail(tokenHash:string,to:string,subject:string,text:string,expires:number){
 const id=crypto.randomUUID(),message:MailMessage={id:`auth:${id}`,to,subject,text};
 const db=database();await db.prepare("INSERT INTO auth_mail(id,token_hash,payload,status,attempts,next_attempt,expires_at) VALUES(?,?,?,'sending',1,?,?)").bind(id,tokenHash,JSON.stringify(message),Date.now()+120000,expires).run();
 // Local integration tests inspect a private, local outbox; never expose tokens in an API.
 const local=['localhost','127.0.0.1'].includes(new URL(runtime().SITE_URL||'https://invalid').hostname);
 if(local&&runtime().AUTH_MAIL_TEST_STORE==='true'){await db.prepare("UPDATE auth_mail SET status='pending',attempts=0,next_attempt=0 WHERE id=?").bind(id).run();return;}
 try{await sendSmtp(message);await db.prepare("UPDATE auth_mail SET status='sent',payload='' WHERE id=?").bind(id).run();}
 catch{await db.prepare("UPDATE auth_mail SET status='pending',next_attempt=? WHERE id=?").bind(Date.now()+60000,id).run();console.error('Authentication email queued for retry.');}
}
export async function claimAuthMail(){const now=Date.now(),db=database();const rows=await db.prepare("SELECT id,payload FROM auth_mail WHERE status IN ('pending','sending') AND next_attempt<=? AND expires_at>? AND attempts<5 ORDER BY expires_at LIMIT 10").bind(now,now).all<{id:string;payload:string}>();const messages:MailMessage[]=[];for(const row of rows.results){const claim=await db.prepare("UPDATE auth_mail SET status='sending',attempts=attempts+1,next_attempt=? WHERE id=? AND next_attempt<=? AND status IN ('pending','sending') RETURNING id").bind(now+900000,row.id,now).first();if(claim)messages.push(JSON.parse(row.payload));}return messages;}
export async function ackAuthMail(id:string,success:boolean,unattempted=false){await database().prepare("UPDATE auth_mail SET status=?,payload=CASE WHEN ? THEN '' ELSE payload END,attempts=attempts-?,next_attempt=? WHERE id=? AND status='sending'").bind(success?'sent':'pending',success?1:0,unattempted?1:0,Date.now()+60000,id).run();}
