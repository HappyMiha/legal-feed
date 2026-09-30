import { env } from 'cloudflare:workers';
export type Runtime = { DB: D1Database; AUTH_SECRET?: string; SMTP_HOST?: string; SMTP_USER?: string; SMTP_PASSWORD?: string; AUTH_MAIL_TEST_STORE?: string; LLM_API_KEY?: string; LLM_BASE_URL?: string; LLM_MODEL?: string; SEARCH_API_KEY?: string; CRON_SECRET?: string; RESEND_API_KEY?: string; EMAIL_FROM?: string; SITE_URL?: string; };
export const runtime = () => env as unknown as Runtime;
export const database = () => { const db = runtime().DB; if(!db) throw new Error('Database unavailable.'); return db; };
export { HttpError } from './errors';
import { HttpError } from './errors';
export async function rateLimit(owner:string,scope:string,max=60) {
 const db=database(), bucket=Math.floor(Date.now()/3600000),id=`${owner}:${scope}:${bucket}`;
 const row=await db.prepare('INSERT INTO rate_limits(id,count,expires_at) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count').bind(id,(bucket+1)*3600000).first<{count:number}>();
 if((row?.count||0)>max) throw new HttpError(429,'Too many requests. Please try again later.');
}
