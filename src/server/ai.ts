import {z} from 'zod';
import {runtime,database} from './runtime';
import {providerJson} from './ai-provider';
import type {Topic} from '../domain/monitoring';
export async function aiJson<T>(system:string,input:unknown,schema:z.ZodType<T>,maxTokens=2200):Promise<T>{
 return providerJson(database(),runtime(),system,input,schema,maxTokens);
}
export async function suggestTopics(input:string):Promise<Topic[]>{
 const result=await aiJson('You help Swiss legal professionals define monitoring topics. Given their input, return {"topics":[{"title":"...","description":"...","legal_basis":"..."}]}. Produce 3 to 6 distinct specific Swiss legal topics in English, applicable to the input, covering relevant tax, employment, regulatory or corporate issues only where applicable. Do not assume ESOP unless requested. Never invent case numbers or legal citations. Leave legal_basis empty if uncertain. Describe questions to monitor, not conclusions about what the law requires. Do not assert VAT on employee shares, employee board representation, works council rights or dismissal protection unless specifically supported by supplied material. Topic descriptions should include useful German and French legal search terms in parentheses, without keyword stuffing.',{input},z.object({topics:z.array(z.object({title:z.string().min(1).max(300),description:z.string().max(2000),legal_basis:z.string().max(1000)})).min(1).max(8)}));
 return result.topics.map(t=>({...t,id:crypto.randomUUID(),origin:'ai',selected:true}));
}
