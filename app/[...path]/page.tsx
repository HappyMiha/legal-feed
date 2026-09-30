import LegalFeedApp from "@/src/app";
import {requireChatGPTUser} from "../chatgpt-auth";
export const dynamic="force-dynamic";
async function Protected({returnTo}:{returnTo:string}){await requireChatGPTUser(returnTo);return <LegalFeedApp config={{summaryNotice:true,processingModel:"Swisscom Apertus 1.5 70B",deployment:"Production",hostingLocation:"Cloudflare · AI processing: Swisscom"}}/>;}
export default async function Page({params,searchParams}:{params:Promise<{path:string[]}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {path}=await params,query=await searchParams;const search=new URLSearchParams();for(const [key,value] of Object.entries(query)){if(Array.isArray(value))value.forEach(v=>search.append(key,v));else if(value!==undefined)search.set(key,value);}
 return <Protected returnTo={'/'+path.map(encodeURIComponent).join('/')+(search.size?'?'+search:'')}/>;
}
