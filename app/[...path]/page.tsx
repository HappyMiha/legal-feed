import Home from '../page';
import AuthForm,{type AuthMode} from '@/src/features/auth';
import {headers} from 'next/headers';
import {redirect} from 'next/navigation';
import {getSession} from '@/src/server/auth-session';
import {runtime} from '@/src/server/runtime';
export const dynamic='force-dynamic';
const modes:AuthMode[]=['register','login','forgot-password','reset-password','verify-email'];
export default async function Page({params}:{params:Promise<{path:string[]}>}){
 const {path}=await params;
 if(path.length===1&&modes.includes(path[0] as AuthMode))return <AuthForm mode={path[0] as AuthMode}/>;
 if(!await getSession(await headers(),runtime().SITE_URL||'https://legalfeed.helveticlens.ch'))redirect('/login?return_to='+encodeURIComponent('/'+path.map(encodeURIComponent).join('/')));
 return <Home/>;
}
