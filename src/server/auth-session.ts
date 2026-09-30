import {database, runtime, HttpError} from './runtime';
import {hash,passwordHash,equalSecret} from './security';

const DURATION=30*86400;
export const randomToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
const local=(url:string)=>['localhost','127.0.0.1'].includes(new URL(url).hostname);
export const cookieName=(url:string,kind='session')=>`${local(url)?'':'__Host-'}legalfeed_${kind}`;
export const readCookie=(headers:Headers,name:string)=>headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1)||'';
export function authCookie(url:string,token='',kind='session',seconds=DURATION){return `${cookieName(url,kind)}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token?seconds:0}${local(url)?'':'; Secure'}`;}
export async function getSession(headers:Headers,url:string){
 const token=readCookie(headers,cookieName(url));if(!/^[a-f0-9]{64}$/.test(token))return null;
 return database().prepare('SELECT s.owner_id,i.email FROM auth_sessions s JOIN auth_identities i ON i.owner_id=s.owner_id WHERE s.token_hash=? AND s.expires_at>?').bind(await hash(token),Date.now()).first<{owner_id:string;email:string}>();
}
export async function createSession(owner:string,url:string,expectedHash?:string){const token=randomToken();const result=await database().prepare('INSERT INTO auth_sessions(token_hash,owner_id,expires_at) SELECT ?,id,? FROM accounts WHERE id=? AND (? IS NULL OR password_hash=?) RETURNING token_hash').bind(await hash(token),Date.now()+DURATION*1000,owner,expectedHash??null,expectedHash??null).first();if(!result)throw new HttpError(401,'Your credentials changed. Please sign in again.');return authCookie(url,token);}
export async function logout(headers:Headers,url:string){const token=readCookie(headers,cookieName(url));if(token)await database().prepare('DELETE FROM auth_sessions WHERE token_hash=?').bind(await hash(token)).run();return authCookie(url);}
export function safeReturnTo(value:string|null){if(!value||!value.startsWith('/')||value.startsWith('//'))return '/';const url=new URL(value,'https://legalfeed.local');return url.origin==='https://legalfeed.local'&&!/^\/(api|login|register|reset-password|verify-email|forgot-password|signin-with-chatgpt|signout-with-chatgpt|callback)(\/|$)/.test(url.pathname)?url.pathname+url.search:'/';}
export async function loginPasswordHash(password:string,salt:string){
 const secret=runtime().AUTH_SECRET;if(!secret||secret.length<32)throw new HttpError(503,'Account security is not configured.');
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const peppered=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(password))),v=>v.toString(16).padStart(2,'0')).join('');
 return 'v2:'+await passwordHash(peppered,salt);
}
export async function matchesPassword(password:string,salt:string|null,expected:string|null){if(!salt||!expected)return false;return equalSecret(expected,expected.startsWith('v2:')?await loginPasswordHash(password,salt):await passwordHash(password,salt));}
export async function cleanupAuth(){const db=database(),now=Date.now();await db.batch([db.prepare('DELETE FROM auth_sessions WHERE expires_at<=?').bind(now),db.prepare('DELETE FROM auth_tokens WHERE expires_at<=?').bind(now)]);}
