import LegalFeedApp from "@/src/app";
import AuthForm from '@/src/features/auth';
import {headers} from 'next/headers';
import {getSession} from '@/src/server/auth-session';
import {runtime} from '@/src/server/runtime';
export const dynamic="force-dynamic";
export default async function Home(){
 if(!await getSession(await headers(),runtime().SITE_URL||'https://legalfeed.helveticlens.ch'))return <AuthForm mode="register"/>;
 return <LegalFeedApp config={{summaryNotice:true,processingModel:"Swisscom Apertus 1.5 70B",deployment:"Production",hostingLocation:"Cloudflare · AI processing: Swisscom"}}/>;
}
