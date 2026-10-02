import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {searchPublications,scopedResults} from '../src/server/search-provider';

function database(){
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec('PRAGMA foreign_keys=ON; CREATE TABLE profiles(id TEXT PRIMARY KEY); INSERT INTO profiles VALUES (\'one\'),(\'two\');');
 sqlite.exec(readFileSync(new URL('../drizzle/0006_serious_enchantress.sql',import.meta.url),'utf8'));
 const db={prepare(sql:string){let args:(string|number|null)[]=[];const query={bind(...values:typeof args){args=values;return query;},async first(){return sqlite.prepare(sql).get(...args)||null;},async run(){return sqlite.prepare(sql).run(...args);}};return query;}} as unknown as D1Database;
 return {db,sqlite};
}
const config={SEARCH_SERVICE_URL:'https://helveticlens.ch/api/integrations/legal-feed/search',SEARCH_SERVICE_TOKEN:'test-only'};
const result={title:'Public decision',link:'https://bger.ch/decision',snippet:'Public source excerpt'};
const body={provider:'SearXNG' as const,partial:false,results:[result]};
test('analysis retries reuse search; changed topics, owners and expired caches get fresh results',async(t)=>{
 const {db,sqlite}=database();let calls=0;
 t.mock.method(globalThis,'fetch',async(url:RequestInfo|URL,init?:RequestInit)=>{calls++;assert.equal(url,config.SEARCH_SERVICE_URL);assert.equal(init?.redirect,'manual');assert.equal(new Headers(init?.headers).get('authorization'),'Bearer test-only');return Response.json(body);});
 assert.deepEqual(await searchPublications(db,config,'one','site:bger.ch Ozempic'),body);
 assert.deepEqual(await searchPublications(db,config,'one','site:bger.ch Ozempic'),body);assert.equal(calls,1);
 await searchPublications(db,config,'two','site:bger.ch Ozempic');
 await searchPublications(db,config,'one','site:bger.ch Tax');assert.equal(calls,3);
 sqlite.exec('UPDATE search_cache SET expires_at=0');await searchPublications(db,config,'one','site:bger.ch Ozempic');assert.equal(calls,4);
 sqlite.exec("DELETE FROM profiles WHERE id='one'");assert.equal(sqlite.prepare("SELECT count(*) n FROM search_cache WHERE profile_id='one'").get()!.n,0);sqlite.close();
});
test('outage, authentication failure and malformed results never become cached no-match successes',async(t)=>{
 const {db,sqlite}=database();let next=()=>new Response('private detail',{status:503});let calls=0;
 t.mock.method(globalThis,'fetch',async()=>{calls++;return next();});
 for(const response of [()=>new Response('private detail',{status:503}),()=>new Response('private detail',{status:401}),()=>new Response(null,{status:302,headers:{location:'https://other.example/steal'}}),()=>Response.json({results:[]}),()=>Response.json({...body,partial:true,results:[]}),()=>Response.json({...body,results:[{...result,title:null}]})]){
  next=response;await assert.rejects(searchPublications(db,config,'one','site:bger.ch Ozempic'),error=>error instanceof Error&&!error.message.includes('private detail'));
  assert.equal(sqlite.prepare('SELECT count(*) n FROM search_cache').get()!.n,0);
 }
 assert.equal(calls,6);next=()=>Response.json({...body,results:[]});assert.deepEqual(await searchPublications(db,config,'one','site:bger.ch Ozempic'),{...body,results:[]});assert.equal(sqlite.prepare('SELECT count(*) n FROM search_cache').get()!.n,1);sqlite.close();
});
test('an unconfigured connection makes no requests, and partial results expire sooner',async(t)=>{
 const {db,sqlite}=database();let calls=0;
 t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json({...body,partial:true});});
 await assert.rejects(searchPublications(db,{},'one','site:bger.ch Ozempic'));assert.equal(calls,0);
 assert.deepEqual(await searchPublications(db,config,'one','site:bger.ch Ozempic'),{...body,partial:true});
 const expires=Number(sqlite.prepare('SELECT expires_at FROM search_cache').get()!.expires_at);assert.ok(expires>Date.now()+590000&&expires<=Date.now()+600000);sqlite.close();
});

test('partial results keep their failure status through cached domain and path filtering',async(t)=>{
 const {db,sqlite}=database();let calls=0;
 const offScope={...body,partial:true,results:[{...result,link:'https://other.example/publication'}]};
 t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json(offScope);});
 const source={id:'signal',name:'Source',section:'signal' as const,type:'website' as const,active:true,url:'https://bger.ch/news'};
 for(let i=0;i<2;i++)assert.throws(()=>scopedResults(offScope,source),/unavailable/);
 for(let i=0;i<2;i++){const data=await searchPublications(db,config,'one','site:bger.ch Ozempic');assert.throws(()=>scopedResults(data,source),/unavailable/);}assert.equal(calls,1);
 assert.throws(()=>scopedResults({...offScope,results:[{...result,link:'https://127.0.0.1/private'}]},source),/unavailable/);
 assert.deepEqual(scopedResults({...body,results:[{...result,link:'https://bger.ch/news-other'}]},source),[]);
 assert.equal(scopedResults({...body,results:[{...result,link:'https://bger.ch/news/decision'}]},source).length,1);sqlite.close();
});
