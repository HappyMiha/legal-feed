import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {z} from 'zod';
import {providerJson,AnalysisDeferred,retryDelay,providerReadyAt} from '../src/server/ai-provider';
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
 await assert.rejects(providerJson(db,config,'test',{},schema),/did not complete/);sqlite.close();
});
