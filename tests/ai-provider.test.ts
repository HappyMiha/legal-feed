import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {z} from 'zod';
import {providerJson,AnalysisDeferred,InvalidAnalysis,retryDelay,providerReadyAt} from '../src/server/ai-provider';
import {analysisContract,ANALYSIS_SYSTEM} from '../src/server/analysis-contract';
import {invalidAnalysisRetry} from '../src/server/monitor-policy';
import {articleText,limitedText,textContent} from '../src/server/source-text';

function database(){
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec('CREATE TABLE ai_provider_state(id TEXT PRIMARY KEY,next_request_at INTEGER,lease_until INTEGER,lease_token TEXT,failures INTEGER)');
 const db={prepare(sql:string){let args:(string|number|null)[]=[];const query={bind(...values:typeof args){args=values;return query;},async first(){return sqlite.prepare(sql).get(...args)||null;},async run(){return sqlite.prepare(sql).run(...args);}};return query;}} as unknown as D1Database;
 return {db,sqlite};
}
const config={LLM_API_KEY:'test-only',LLM_BASE_URL:'https://provider.example.invalid'};
const schema=z.object({ok:z.boolean()});
const success=()=>Response.json({choices:[{message:{content:'{"ok":true}'},finish_reason:'stop'}]});
test('provider honors seconds, HTTP dates and provider reset headers',()=>{
 const now=Date.parse('2026-09-30T10:00:00Z');
 assert.equal(retryDelay(new Headers({'Retry-After':'90'}),now,60000),90000);
 assert.equal(retryDelay(new Headers({'Retry-After':'Wed, 30 Sep 2026 10:02:00 GMT'}),now,60000),120000);
 assert.equal(retryDelay(new Headers({'X-Ratelimit-Reset':'45s'}),now,60000),45000);
 assert.equal(retryDelay(new Headers(),now,60000),60000);
});
test('shared permit prevents concurrent AI calls and survives request completion',async(t)=>{
 const {db,sqlite}=database();let requests=0;
 t.mock.method(globalThis,'fetch',async()=>{requests++;return success();});
 const results=await Promise.allSettled([providerJson(db,config,'test',{},schema),providerJson(db,config,'test',{},schema)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(requests,1);
 assert.ok((results.find(r=>r.status==='rejected') as PromiseRejectedResult).reason instanceof AnalysisDeferred);
 await assert.rejects(providerJson(db,config,'test',{},schema),AnalysisDeferred);assert.equal(requests,1);
 assert.ok(await providerReadyAt(db)>Date.now());sqlite.close();
});
test('429 schedules a durable retry, releases lease, then recovers without hidden retries',async(t)=>{
 const {db,sqlite}=database();let requests=0;
 t.mock.method(globalThis,'fetch',async()=>++requests===1?new Response('Busy',{status:429,headers:{'Retry-After':'90'}}):success());
 await assert.rejects(providerJson(db,config,'test',{},schema),(error:unknown)=>error instanceof AnalysisDeferred&&error.retryAt>=Date.now()+89000);
 const row=sqlite.prepare('SELECT * FROM ai_provider_state').get()!;
 assert.equal(row.failures,1);assert.equal(row.lease_until,0);assert.equal(row.lease_token,null);assert.equal(requests,1);
 await assert.rejects(providerJson(db,config,'test',{},schema),AnalysisDeferred);assert.equal(requests,1);
 sqlite.exec('UPDATE ai_provider_state SET next_request_at=0');
 assert.deepEqual(await providerJson(db,config,'test',{},schema),{ok:true});
 assert.equal(sqlite.prepare('SELECT failures FROM ai_provider_state').get()!.failures,0);sqlite.close();
});
test('legacy source charset, HTML entities and judgment paragraphs remain readable',async()=>{
 const html='<meta charset="utf-8"><body><nav>Skip navigation</nav><div>Browser warning</div><div id="highlight_content"><div class="content"><div class="paraatf">Öffentlich für &uuml;berm&auml;ssig &#xDF;.</div><div class="paratf">Second <b>paragraph</b> &amp; &lt;literal&gt;.</div><script>Ignore this</script></div></div></body>';
 const decoded=await limitedText(new Response(Buffer.from(html,'latin1'),{headers:{'Content-Type':'text/html;charset=iso-8859-1'}}));
 assert.equal(articleText(decoded),'Öffentlich für übermässig ß.\n\nSecond paragraph & <literal>.');
 assert.equal(textContent('Named &eacute; &ndash; &#xFC; &nbsp; entities'),'Named é – ü entities');
 await assert.rejects(limitedText(new Response('oversized'),3),/too large/);
});
test('valid JSON from a truncated completion cannot mark documents as processed',async(t)=>{
 const {db,sqlite}=database();
 t.mock.method(globalThis,'fetch',async()=>Response.json({choices:[{message:{content:'{"ok":true}'},finish_reason:'length'}]}));
 t.mock.method(console,'error',()=>{});
 await assert.rejects(providerJson(db,config,'test',{},schema),(error:unknown)=>error instanceof InvalidAnalysis&&error.kind==='incomplete');sqlite.close();
});
test('monitoring requests compact JSON and an unambiguous empty-match result',async(t)=>{
 const {db,sqlite}=database(),contract=analysisContract(1,['topic-1']);let sent:{response_format?:{type:string};messages?:{content:string}[]}|undefined;
 t.mock.method(globalThis,'fetch',async(_url:RequestInfo|URL,init?:RequestInit)=>{sent=JSON.parse(String(init?.body));return Response.json({choices:[{message:{content:'{"matches":[]}'},finish_reason:'stop'}]});});
 assert.deepEqual(await providerJson(db,config,ANALYSIS_SYSTEM,{},contract,5000,'legal_matches'),{matches:[]});
 assert.equal(sent?.response_format?.type,'json_object');assert.ok(sent?.messages?.[0].content.includes('compact valid JSON on one line'));
 assert.ok(ANALYSIS_SYSTEM.includes('return exactly {"matches":[]}'));assert.ok(!ANALYSIS_SYSTEM.includes('[] is correct'));sqlite.close();
});
test('malformed or semantically invalid AI results stay failures instead of becoming empty matches',async(t)=>{
 const {db,sqlite}=database(),contract=analysisContract(2,['topic-1']);
 const match={index:0,topic_ids:['topic-1'],relevance:'high',summary:'A factual summary of the supplied publication.',why_it_matters:'Direct relevance to this monitoring topic.',legal_basis:''};
 let raw='not JSON';const diagnostics:unknown[]=[];
 t.mock.method(console,'error',(...args:unknown[])=>{diagnostics.push(args);});
 t.mock.method(globalThis,'fetch',async()=>Response.json({id:'test-request',choices:[{message:{content:raw},finish_reason:'stop'}]}));
 for(const bad of ['not JSON','[]','{"matches":null}',JSON.stringify({matches:[{...match,topic_ids:['unknown-private-topic']}]}),JSON.stringify({matches:[match,match]}),JSON.stringify({matches:[{...match,index:2}]}),JSON.stringify({matches:[{...match,summary:''}]})]){
  raw=bad;sqlite.exec('DELETE FROM ai_provider_state');
  await assert.rejects(providerJson(db,config,ANALYSIS_SYSTEM,{},contract,5000,'legal_matches'),InvalidAnalysis);
 }
 assert.equal(diagnostics.length,7);assert.ok(!JSON.stringify(diagnostics).includes('unknown-private-topic'));
 sqlite.exec('DELETE FROM ai_provider_state');raw=JSON.stringify({matches:[match]});
 assert.deepEqual(await providerJson(db,config,ANALYSIS_SYSTEM,{},contract,5000,'legal_matches'),{matches:[match]});sqlite.close();
});
test('invalid analyses receive two prompt retries, then back off without discarding the source',()=>{
 const first=invalidAnalysisRetry(0,1000),second=invalidAnalysisRetry(first.attempts,1000),third=invalidAnalysisRetry(second.attempts,1000);
 assert.equal(first.status,'retrying');assert.equal(first.nextRun,32000);assert.equal(second.status,'retrying');assert.equal(second.nextRun,63000);
 assert.equal(third.status,'error');assert.equal(third.nextRun,3601000);assert.equal(invalidAnalysisRetry(100).attempts,3);
});
