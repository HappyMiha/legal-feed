import {z} from 'zod';
import {hash,safeUrl} from './security';
import {limitedText} from './source-text';
import type {Source} from '../domain/monitoring';

type SearchConfig={SEARCH_SERVICE_URL?:string;SEARCH_SERVICE_TOKEN?:string};
const resultSchema=z.object({title:z.string().min(1).max(1000),link:z.string().max(8000),snippet:z.string().max(5000)});
const responseSchema=z.object({provider:z.literal('SearXNG'),partial:z.boolean(),results:z.array(resultSchema).max(12)});
export type SearchResult=z.infer<typeof resultSchema>;
type SearchResponse=z.infer<typeof responseSchema>;

export function withinSource(value:string,source:Source):boolean{
 try{const url=safeUrl(source.url!),domain=url.hostname.replace(/^www\./,''),u=safeUrl(value);
  return (u.hostname.replace(/^www\./,'')===domain||u.hostname.endsWith('.'+domain))&&(source.section!=='signal'||url.pathname==='/'||u.pathname===url.pathname||u.pathname.startsWith(url.pathname.replace(/\/$/,'')+'/'));
 }catch{return false;}
}
export function scopedResults(data:SearchResponse,source:Source):SearchResult[]{
 const results=data.results.filter(item=>withinSource(item.link,source));
 if(data.partial&&!results.length)throw Error('Some search engines are unavailable. Automatic retry scheduled.');
 return results;
}

export async function searchPublications(db:D1Database,config:SearchConfig,profileId:string,query:string):Promise<SearchResponse>{
 if(!config.SEARCH_SERVICE_URL||!config.SEARCH_SERVICE_TOKEN)throw Error('Public search is not configured.');
 const endpoint=safeUrl(config.SEARCH_SERVICE_URL).href;
 const id=await hash(JSON.stringify([profileId,endpoint,query]));
 const cached=await db.prepare('SELECT data FROM search_cache WHERE id=? AND profile_id=? AND expires_at>?').bind(id,profileId,Date.now()).first<{data:string}>();
 if(cached){const parsed=responseSchema.safeParse(JSON.parse(cached.data));if(parsed.success)return parsed.data;}
 let response:Response;
 try{response=await fetch(endpoint,{method:'POST',redirect:'manual',headers:{authorization:`Bearer ${config.SEARCH_SERVICE_TOKEN}`,'content-type':'application/json','user-agent':'LegalFeed/1.0 (+https://github.com/HappyMiha/legal-feed)'},body:JSON.stringify({query}),signal:AbortSignal.timeout(25000)});}
 catch(error){console.error('Public search transport failed',JSON.stringify({kind:error instanceof Error?error.name:'unknown'}));throw Error('Public search is temporarily unavailable. Automatic retry scheduled.');}
 if(!response.ok){console.error('Public search service failed',JSON.stringify({status:response.status,request_id:response.headers.get('cf-ray')}));await response.body?.cancel();throw Error(response.status===401?'Public search connection needs administrator attention.':'Public search is temporarily unavailable. Automatic retry scheduled.');}
 let data:z.infer<typeof responseSchema>;
 try{data=responseSchema.parse(JSON.parse(await limitedText(response,150000)));}
 catch{throw Error('Public search returned an invalid response. Automatic retry scheduled.');}
 // A failed engine with no candidates is not evidence that nothing was published.
 if(data.partial&&!data.results.length)throw Error('Some search engines are unavailable. Automatic retry scheduled.');
 const safe=data.results.filter(item=>{try{safeUrl(item.link);return true;}catch{return false;}});
 if(data.results.length&&!safe.length)throw Error('Public search returned invalid source links. Automatic retry scheduled.');
 data.results=safe;
 await db.prepare('INSERT INTO search_cache(id,profile_id,data,expires_at) SELECT ?,?,?,? FROM profiles WHERE id=? ON CONFLICT(id) DO UPDATE SET data=excluded.data,expires_at=excluded.expires_at').bind(id,profileId,JSON.stringify(data),Date.now()+(data.partial?10:60)*60000,profileId).run();
 return data;
}
