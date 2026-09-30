import type {MonitoringProfile,Source,Update} from '../domain/monitoring';
import {publicFetch,limitedText,textContent,safeUrl,hash} from './security';
import {runtime} from './runtime';
import {aiJson} from './ai';
import {analysisContract,ANALYSIS_SYSTEM} from './analysis-contract';
import {InvalidAnalysis} from './ai-provider';
import {parseFeed,type Article} from './feed';
import {articleText} from './source-text';
const tag=(html:string,name:string)=>textContent(html.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`,'i'))?.[1]||'');
export async function extractArticle(url:string,title=''):Promise<Article>{
 const response=await publicFetch(url);const type=response.headers.get('content-type')||'';
 if(!/html|xml|text|json/.test(type))throw Error('Source document is not readable text.');
 const html=await limitedText(response);if(/incapsula|captcha|access denied|just a moment/i.test(html.slice(0,5000)))throw Error('Source requires interactive access.');
 const body=articleText(html);if(body.length<120)throw Error('Source requires JavaScript or has no readable text.');
 const dateMatch=html.match(/(?:datePublished|article:published_time)["']?\s*(?:content\s*=|:|[^>]*content=)\s*["']([^"']+)["']/i)?.[1]||html.match(/<time\b[^>]*datetime=["']([^"']+)/i)?.[1];
 const date=new Date(dateMatch||'');
 return {url:safeUrl(response.url||url).href,title:title||textContent(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||tag(html,'title')),text:body,date:Number.isFinite(date.getTime())?date.toISOString().slice(0,10):new Date().toISOString().slice(0,10),dateKind:Number.isFinite(date.getTime())?'published':'discovered'};
}
async function search(source:Source,profile:MonitoringProfile):Promise<Article[]>{
 const key=runtime().SEARCH_API_KEY;if(!key)throw Error('Search connector unavailable.');
 const url=safeUrl(source.url!);const topics=profile.topics.filter(t=>t.selected).map(t=>t.title).join(' OR ');
 const scope=source.section==='signal'?`${url.hostname}${url.pathname==='/'?'':url.pathname}`:url.hostname.replace(/^www\./,'');
 const query=`site:${scope} (${topics}) ${source.canton?source.name:''}`;
 const res=await fetch('https://api.search1api.com/search',{method:'POST',headers:{authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify({query,search_service:'google',max_results:6}),signal:AbortSignal.timeout(30000)});
 if(!res.ok)throw Error(`Search connector returned HTTP ${res.status}.`);
 const json=await res.json() as {results?:{title:string;link:string;snippet:string}[]};
 const found=(json.results||[]).filter(r=>{try{const u=safeUrl(r.link);return (u.hostname===url.hostname||u.hostname.replace(/^www\./,'')===url.hostname.replace(/^www\./,'')||u.hostname.endsWith('.'+url.hostname.replace(/^www\./,'')))&&(source.section!=='signal'||url.pathname==='/'||u.pathname.startsWith(url.pathname));}catch{return false;}});
 const articles:Article[]=[];let errors=0;
 for(const item of found.slice(0,4)){try{articles.push(await extractArticle(item.link,item.title));}catch{if(item.snippet?.length>80){articles.push({url:safeUrl(item.link).href,title:item.title,text:'Public search excerpt (full publication unavailable): '+item.snippet,date:new Date().toISOString().slice(0,10),dateKind:'discovered'});}else errors++;}}
 if(found.length&&errors===found.slice(0,4).length)throw Error('Search found publications, but the publisher blocked full-text access.');
 return articles;
}
export async function collect(source:Source,profile:MonitoringProfile):Promise<Article[]>{
 if(!source.url)throw Error('Source URL is missing.');
 if(source.type==='linkedin')return search(source,profile);
 if(source.type==='rss'||/rss.*\.xml|\/feed\/?$/.test(source.url)){
  const text=await limitedText(await publicFetch(source.url));const feed=parseFeed(text,source.url);if(!feed.length&&!/<(rss|feed)\b/.test(text))throw Error('The URL is not an RSS or Atom feed.');return feed;
 }
 if(['estv','bsv'].includes(source.id)){
  const now=new Date(),start=new Date(now);start.setUTCFullYear(start.getUTCFullYear()-1);
  const url=new URL('https://d-nsbc-p.admin.ch/v1/search');
  for(const [key,value] of Object.entries({languages:'de',publisherIDs:source.id==='estv'?'45':'23',start_date:start.toISOString(),end_date:now.toISOString(),offset:'0',limit:'30',sort:'DESC'}))url.searchParams.set(key,value);
  const data=JSON.parse(await limitedText(await publicFetch(url.href))) as {items:{title:string;description:string;text:string[];publishDate:string;langGroupId:string}[]};
  return data.items.map(a=>({title:a.title,text:textContent([a.description,...a.text||[]].join(' ')),url:`https://www.${source.id}.admin.ch/de/newnsb/${a.langGroupId}`,date:new Date(a.publishDate).toISOString().slice(0,10),dateKind:'published' as const}));
 }
 if(source.id==='administrative-court'){
  const data=JSON.parse(await limitedText(await publicFetch(`https://www.bvger.ch/de/api/json/media-releases/list?filter=${new Date().getUTCFullYear()}`))) as {data:{items:{title:string;lead:string;detailUrl:string;date:number}[]}};
  return data.data.items.slice(0,30).map(a=>({title:a.title,text:textContent(a.lead),url:safeUrl(a.detailUrl).href,date:new Date(a.date*1000).toISOString().slice(0,10),dateKind:'published' as const}));
 }
 if(source.id==='zurich-authorities'){
  const data=JSON.parse(await limitedText(await publicFetch('https://www.zh.ch/de/news-uebersicht/_jcr_content.zhweb-news.zhweb-cache.json'))) as {news:{title:string;date:string;link:string;teaserText?:string}[]};
  return data.news.slice(0,30).map(a=>({title:a.title,text:textContent(a.teaserText||a.title),url:safeUrl(new URL(a.link,'https://www.zh.ch').href).href,date:a.date.split('.').reverse().join('-'),dateKind:'published' as const}));
 }
 if(source.section==='signal'){
  const html=await limitedText(await publicFetch(source.url));
  if(/<(rss|feed)\b/.test(html))return parseFeed(html,source.url);
  const feed=html.match(/<link[^>]*type=["']application\/(?:rss|atom)\+xml["'][^>]*href=["']([^"']+)/i)?.[1]||html.match(/<link[^>]*href=["']([^"']+)["'][^>]*type=["']application\/(?:rss|atom)\+xml/i)?.[1];
  if(feed){const feedUrl=safeUrl(new URL(feed,source.url).href).href;return parseFeed(await limitedText(await publicFetch(feedUrl)),feedUrl);}
 }
 return search(source,profile);
}
export async function analyse(articles:Article[],source:Source,profile:MonitoringProfile):Promise<{update:Update;sourceText:string}[]>{
 if(!articles.length)return [];
 const topics=profile.topics.filter(t=>t.selected);
 const contract=analysisContract(articles.length,topics.map(topic=>topic.id));
 const result=await aiJson(ANALYSIS_SYSTEM,{profile:profile.name,topics:topics.map(({id,title,description})=>({id,title,description})),articles:articles.map((a,index)=>({index,title:a.title,date:a.date,date_kind:a.dateKind,text:a.text.slice(0,6500)}))},contract,5000,'legal_matches');
 const output:{update:Update;sourceText:string}[]=[];
 const indices=new Set<number>();
 for(const match of result.matches){const a=articles[match.index];const selected=topics.filter(t=>match.topic_ids.includes(t.id));if(!a||!selected.length||match.topic_ids.some(id=>!topics.some(t=>t.id===id))||indices.has(match.index))throw new InvalidAnalysis('references');indices.add(match.index);
  const id=await hash(profile.id+':'+a.url);output.push({sourceText:a.text,update:{id,profile_id:profile.id,source_id:source.id,topic_ids:selected.map(t=>t.id),headline:a.title,summary:match.summary,why_it_matters:match.why_it_matters,relevance:match.relevance,url:a.url,published_at:a.date,read:false,saved:false,hidden:false,client_name:profile.name.split(':')[0].trim(),source_name:source.name,source_section:source.section,topic_title:selected.map(t=>t.title).join(' · '),legal_basis:match.legal_basis&&a.text.includes(match.legal_basis)?match.legal_basis:'Not specified in the source',date_kind:a.dateKind}});
 }return output;
}
