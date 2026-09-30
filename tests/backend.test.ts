import test from 'node:test';
import assert from 'node:assert/strict';
import {safeUrl,hash,passwordHash} from '../src/server/security';
import {parseFeed} from '../src/server/feed';
import {isQuiet,zurichTime,eligible} from '../src/server/delivery-policy';
import {sources,cantonSources,canonicalSource} from '../src/server/catalog';
import {profileSchema} from '../src/server/validation';
import type {Account,MonitoringProfile,Update} from '../src/domain/monitoring';
test('URL validation excludes private targets and credentials',()=>{
 for(const url of ['http://example.com','https://127.0.0.1/','https://2130706433/','https://[::1]/','https://user:password@example.com/','https://metadata.internal/','https://example.com:8080/'])assert.throws(()=>safeUrl(url));
 assert.equal(safeUrl('https://www.admin.ch/news#fragment').href,'https://www.admin.ch/news');
});
test('RSS and Atom preserve canonical provenance and publication date',()=>{
 const rss='<rss><channel><item><title>Actual &amp; attributed</title><link>https://example.com/record</link><pubDate>Wed, 30 Sep 2026 09:00:00 GMT</pubDate><description><![CDATA[<p>Source excerpt.</p>]]></description></item></channel></rss>';
 const [record]=parseFeed(rss,'https://example.com/feed');assert.equal(record.title,'Actual & attributed');assert.equal(record.text,'Source excerpt.');assert.equal(record.date,'2026-09-30');assert.equal(record.dateKind,'published');
 const [atom]=parseFeed('<feed><entry><title>Atom</title><link href="https://example.com/atom"/><summary>Text</summary></entry></feed>','https://example.com/feed');assert.equal(atom.dateKind,'discovered');assert.equal(atom.url,'https://example.com/atom');
 assert.deepEqual(parseFeed('<rss><item><title>Unsafe</title><link>https://127.0.0.1/</link></item></rss>','https://example.com'),[]);
});
test('Swiss quiet hours handle overnight intervals and daylight-saving transitions',()=>{
 const account={quiet_start:'22:00',quiet_end:'07:00'} as Account;
 assert.equal(zurichTime(new Date('2026-03-29T01:30:00Z')).time,'03:30');
 assert.equal(zurichTime(new Date('2026-10-25T01:30:00Z')).time,'02:30');
 assert.equal(isQuiet(account,new Date('2026-09-30T21:00:00Z')),true);
 assert.equal(isQuiet(account,new Date('2026-09-30T10:00:00Z')),false);
 assert.equal(isQuiet({...account,quiet_start:'07:00'} as Account),false);
});
test('Delivery threshold and negative feedback govern actual eligible items',()=>{
 const profile={delivery:{relevance_threshold:'high'}} as MonitoringProfile;
 const items=[{id:'1',relevance:'high',hidden:false},{id:'2',relevance:'medium',hidden:false},{id:'3',relevance:'high',hidden:true}] as Update[];
 assert.deepEqual(eligible(profile,items).map(u=>u.id),['1']);
});
test('Source catalogue canonicalization prevents user URL substitution',()=>{
 const fedlex=sources.find(s=>s.id==='fedlex')!;assert.equal(canonicalSource({...fedlex,url:'https://evil.example'}).url,fedlex.url);
 assert.equal(cantonSources('Zurich').length,5);assert.throws(()=>cantonSources('Unknown'));assert.throws(()=>profileSchema.parse({}));
});
test('Passwords are salted and opaque identifiers deterministic',async()=>{
 assert.notEqual(await passwordHash('same password','salt1'),await passwordHash('same password','salt2'));
 assert.equal(await hash('same canonical URL'),await hash('same canonical URL'));
});
