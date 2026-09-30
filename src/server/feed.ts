import {safeUrl,textContent} from './security';
export type Article={title:string;url:string;text:string;date:string;dateKind:'published'|'discovered'};
const tag=(xml:string,name:string)=>{const match=xml.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`,'i'));return match?textContent(match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1')):'';};
export function parseFeed(xml:string,base:string):Article[]{
 return [...xml.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)].slice(0,40).flatMap(([, ,block])=>{
  const link=tag(block,'link')||block.match(/<link\b[^>]*href=["']([^"']+)["']/i)?.[1];
  const title=tag(block,'title');if(!link||!title)return [];
  let url:string;try{url=safeUrl(new URL(link,base).href).href}catch{return []}
  const rawDate=tag(block,'pubDate')||tag(block,'published')||tag(block,'updated')||tag(block,'dc:date');const date=new Date(rawDate);
  return [{title,url,text:tag(block,'content:encoded')||tag(block,'description')||tag(block,'summary')||title,date:Number.isFinite(date.getTime())?date.toISOString().slice(0,10):new Date().toISOString().slice(0,10),dateKind:Number.isFinite(date.getTime())?'published':'discovered'} as Article];
 });
}
