import LegalFeedApp from "@/src/app";
import Landing from '@/src/features/landing';
import {headers} from 'next/headers';
import {getSession} from '@/src/server/auth-session';
import {runtime} from '@/src/server/runtime';
export const dynamic="force-dynamic";
export default async function Home(){
 if(!await getSession(await headers(),runtime().SITE_URL||'https://legalfeed.helveticlens.ch'))return <Landing/>;
 return <LegalFeedApp config={{summaryNotice:true,processingModel:"Swisscom Apertus 1.5 70B",deployment:"Production",hostingLocation:"Cloudflare · AI processing: Swisscom"}}/>;
}
