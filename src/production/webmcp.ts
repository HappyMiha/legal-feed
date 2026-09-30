import {stateStore,createDraft} from '../platform/storage';
import {monitoringBackend} from './backend';
type Tool={name:string;title:string;description:string;inputSchema:object;annotations:{readOnlyHint:boolean;untrustedContentHint:boolean};execute:(input:unknown)=>Promise<unknown>};
export function registerMonitoringTools(go:(path:string)=>void){
 const context=(document as Document&{modelContext?:{registerTool:(tool:Tool,options:{signal:AbortSignal})=>void|Promise<void>}}).modelContext;
 if(!context?.registerTool)return ()=>{};
 const lifecycle=new AbortController();
 const empty=(value:unknown)=>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length)throw Error('Expected an empty object.');};
 const tools:Tool[]=[{
  name:'list_monitoring_profiles',title:'List monitoring profiles',description:'Read the signed-in account’s monitoring profiles and status.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},async execute(input){empty(input);return (await monitoringBackend.getProfiles()).map(p=>({id:p.id,name:p.name,status:p.status}));}
 },{
  name:'start_monitoring_profile',title:'Start a monitoring profile',description:'Open the visible profile wizard. This prepares an unfinished draft; it does not activate monitoring.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},async execute(input){empty(input);const state=stateStore.read();if(!state.account_id)throw Error('Sign in first.');if(!state.draft||state.draft.editing_id)stateStore.write({...state,draft:createDraft(structuredClone(state.account.defaults))});go('/monitoring/new/topics');return {status:'draft',route:'/monitoring/new/topics'};}
 }];
 for(const tool of tools)void Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});
 return ()=>lifecycle.abort();
}
