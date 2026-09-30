import {parseDocument} from 'htmlparser2';

type Node={type:string;name?:string;data?:string;attribs?:Record<string,string>;children?:Node[]};
function find(root:Node,predicate:(node:Node)=>boolean):Node|undefined{
 const pending=[root];while(pending.length){const node=pending.pop()!;if(predicate(node))return node;if(node.children)for(let i=node.children.length-1;i>=0;i--)pending.push(node.children[i]);}
}
function plainText(root:Node,paragraphs:boolean){
 const parts:string[]=[],pending:(Node|string)[]=[root];
 while(pending.length){
  const node=pending.pop()!;if(typeof node==='string'){parts.push(node);continue;}
  if(node.type==='text'){parts.push((node.data||'').replace(/\s+/g,' '));continue;}
  if(/^(script|style|nav|footer|header|noscript|form|button|aside)$/.test(node.name||''))continue;
  const boundary=/^(p|div|section|article|main|h[1-6]|li|ul|ol|tr|blockquote|br|hr)$/.test(node.name||'');
  if(boundary){parts.push(paragraphs?'\n\n':' ');pending.push(paragraphs?'\n\n':' ');}
  if(node.children)for(let i=node.children.length-1;i>=0;i--)pending.push(node.children[i]);
 }
 return parts.join('').replace(/[ \t\u00a0]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}
export function textContent(html:string){return plainText(parseDocument(html),false);}
export function articleText(html:string){
 const doc=parseDocument(html);
 // The Swiss Federal Supreme Court's legacy template has navigation before its judgment.
 const judgment=find(doc,n=>n.attribs?.id==='highlight_content');
 const root=(judgment&&find(judgment,n=>n.attribs?.class?.split(/\s+/).includes('content')||false))||judgment||find(doc,n=>n.name==='article')||find(doc,n=>n.name==='main')||find(doc,n=>n.name==='body')||doc;
 return plainText(root,true);
}
export async function limitedText(response:Response,max=2_000_000){
 const reader=response.body?.getReader();if(!reader)return '';
 let size=0;const chunks:Uint8Array[]=[];
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw Error('Source document too large.');}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 const declared=response.headers.get('content-type')?.match(/charset\s*=\s*["']?([^\s;"']+)/i)?.[1];
 const head=new TextDecoder('windows-1252').decode(bytes.subarray(0,4096));
 const fallback=head.match(/<meta\b[^>]*charset\s*=\s*["']?([^\s;"'/>]+)/i)?.[1]||head.match(/<\?xml\b[^>]*encoding=["']([^"']+)/i)?.[1]||'utf-8';
 let decoder:TextDecoder;try{decoder=new TextDecoder(declared||fallback);}catch{decoder=new TextDecoder();}
 return decoder.decode(bytes);
}
