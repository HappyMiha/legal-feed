import LegalFeedApp from "@/src/app";
import { requireChatGPTUser } from "./chatgpt-auth";
export const dynamic="force-dynamic";
export default async function Home(){
 await requireChatGPTUser('/');
 return <LegalFeedApp config={{summaryNotice:true,processingModel:"Swisscom Apertus 1.5 70B",deployment:"Production",hostingLocation:"Cloudflare · AI processing: Swisscom"}}/>;
}
