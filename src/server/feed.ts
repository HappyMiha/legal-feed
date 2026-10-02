import {safeUrl,textContent} from './security';
export type Article={title:string;url:string;text:string;date:string;dateKind:'published'|'discovered'};
const tag=(xml:string,name:string)=>{const match=xml.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`,'i'));return match?textContent(match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1')):'';};
export function parseNewsSitemap(xml:string):{title:string;url:string;date:string}[]{
 if(!/<urlset\b/.test(xml)||!/<\/urlset>/.test(xml))throw Error('Publisher returned an invalid news sitemap.');
 const blocks=[...xml.matchAll(/<url\b[^>]*>([\s\S]*?)<\/url>/gi)];
 if(blocks.length!==[...xml.matchAll(/<url\b/gi)].length)throw Error('Publisher returned an incomplete news sitemap.');
 return blocks.slice(0,12).map(([,block])=>{
  const title=tag(block,'news:title'),date=new Date(tag(block,'news:publication_date')),link=tag(block,'loc');
  if(!title||!link||!Number.isFinite(date.getTime()))throw Error('Publisher returned an invalid news publication.');
  return {title,url:safeUrl(link).href,date:date.toISOString().slice(0,10)};
 });
}
export function parseFeed(xml:string,base:string):Article[]{
 return [...xml.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)].slice(0,40).flatMap(([, ,block])=>{
  const link=tag(block,'link')||block.match(/<link\b[^>]*href=["']([^"']+)["']/i)?.[1];
  const title=tag(block,'title');if(!link||!title)return [];
  let url:string;try{url=safeUrl(new URL(link,base).href).href}catch{return []}
  const rawDate=tag(block,'pubDate')||tag(block,'published')||tag(block,'updated')||tag(block,'dc:date');const date=new Date(rawDate);
  return [{title,url,text:tag(block,'content:encoded')||tag(block,'description')||tag(block,'summary')||title,date:Number.isFinite(date.getTime())?date.toISOString().slice(0,10):new Date().toISOString().slice(0,10),dateKind:Number.isFinite(date.getTime())?'published':'discovered'} as Article];
 });
}
