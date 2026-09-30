import { HttpError } from './errors';
export function safeUrl(value:string) {
 const u=new URL(value);
 const host=u.hostname.toLowerCase();
 if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443')||!host.includes('.')||host.includes(':')||/^[\d.]+$/.test(host)||/(^|\.)(localhost|local|internal|test|invalid)$/.test(host)||host.endsWith('.local')||host.endsWith('.internal')) throw new HttpError(400,'Use a public HTTPS URL.');
 u.hash=''; return u;
}
function privateIp(ip:string) {return /^(0\.|10\.|127\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|192\.0\.|198\.(1[89])\.|2[2-5]\d\.)/.test(ip)||/^(::|fc|fd|fe[89ab])/i.test(ip);}
export async function publicFetch(value:string):Promise<Response> {
 let url=safeUrl(value);
 for(let i=0;i<4;i++) {
  const dns=await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(url.hostname)}&type=A`,{headers:{accept:'application/dns-json'},signal:AbortSignal.timeout(8000)});
  if(!dns.ok) throw Error('Source DNS lookup failed.');
  const data=await dns.json() as {Answer?:{type:number;data:string}[]};
  const addresses=(data.Answer||[]).filter(a=>a.type===1);
  if(!addresses.length||addresses.some(a=>privateIp(a.data))) throw new HttpError(400,'Source must resolve to a public address.');
  const response=await fetch(url,{redirect:'manual',headers:{'user-agent':'LegalFeed/1.0 (+https://github.com/HappyMiha/legal-feed)','accept':'text/html,application/rss+xml,application/atom+xml,application/xml,text/xml,application/json'},signal:AbortSignal.timeout(15000)});
  if([301,302,303,307,308].includes(response.status)){const location=response.headers.get('location');await response.body?.cancel();if(!location)throw Error('Invalid source redirect.');url=safeUrl(new URL(location,url).href);continue;}
  if(!response.ok){await response.body?.cancel();throw Error(`Source returned HTTP ${response.status}.`);}
  return response;
 }
 throw Error('Too many source redirects.');
}
export async function limitedText(response:Response,max=2_000_000){
 const reader=response.body?.getReader();if(!reader)return '';let size=0,result='';const decoder=new TextDecoder();
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw Error('Source document too large.');}result+=decoder.decode(value,{stream:true});}return result+decoder.decode();
}
export function textContent(html:string){return html.replace(/<(script|style|nav|footer|header)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/\s+/g,' ').trim();}
export async function hash(value:string){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('');}
export async function passwordHash(password:string,salt:string){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);const b=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},key,256);return Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('');}
export function equalSecret(a:string,b:string){if(a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0;}
