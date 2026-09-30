import {database} from './runtime';
import {extractArticle} from './ingestion';

// A bounded maintenance operation for copies saved by the old UTF-8-only reader.
// Preserve the update, its publication URL, notes, read/save and feedback state.
export async function repairSourceCopies(){
 const db=database();
 const rows=await db.prepare("SELECT id,canonical_url FROM updates WHERE json_extract(data,'$.source_text_version') IS NULL AND (instr(source_text,'�')>0 OR source_text LIKE '%&%uml;%' OR (length(source_text)>1000 AND instr(source_text,char(10))=0)) LIMIT 5").all<{id:string;canonical_url:string}>();
 let repaired=0,failed=0;
 for(const row of rows.results){try{
  const article=await extractArticle(row.canonical_url);
  if(article.text.includes('�'))throw Error('Source still contains invalid characters.');
  await db.prepare("UPDATE updates SET source_text=?,data=json_set(data,'$.source_text_version',2) WHERE id=? AND canonical_url=?").bind(article.text,row.id,row.canonical_url).run();repaired++;
 }catch{failed++;}}
 return {repaired,failed};
}
