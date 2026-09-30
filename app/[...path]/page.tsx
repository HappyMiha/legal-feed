import Home from '../page';
import AuthForm,{type AuthMode} from '@/src/features/auth';
export const dynamic='force-dynamic';
const modes:AuthMode[]=['register','login','forgot-password','reset-password','verify-email'];
export default async function Page({params}:{params:Promise<{path:string[]}>}){
 const {path}=await params;
 if(path.length===1&&modes.includes(path[0] as AuthMode))return <AuthForm mode={path[0] as AuthMode}/>;
 return <Home/>;
}
