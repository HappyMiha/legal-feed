import test from 'node:test';
import assert from 'node:assert/strict';
import {dictionaries,locales,normalizeLocale,localeFromCookie,translate,languageInstruction} from '../src/i18n/core';
import {summaryText} from '../src/platform/export';
import type {Update} from '../src/domain/monitoring';

test('all translated locales have complete keys, matching placeholders and Swiss German spelling',()=>{
 const keys=Object.keys(dictionaries['de-CH']).sort();
 for(const dictionary of Object.values(dictionaries)){
  assert.deepEqual(Object.keys(dictionary).sort(),keys);
  for(const [key,value] of Object.entries(dictionary)){assert.ok(value.trim(),key);assert.deepEqual([...value.matchAll(/\{\d+\}/g)].map(m=>m[0]).sort(),[...key.matchAll(/\{\d+\}/g)].map(m=>m[0]).sort(),key);}
 }
 assert.doesNotMatch(Object.values(dictionaries['de-CH']).join('\n'),/[ßẞ]/);
});
test('locale selection uses an allowlist and never accepts other cookies as language',()=>{
 for(const locale of locales)assert.equal(normalizeLocale(locale),locale);
 for(const invalid of [null,'de','fr','constructor','<script>','de-CH; anything',42])assert.equal(normalizeLocale(invalid),'en');
 assert.equal(localeFromCookie('session=hidden; legalfeed_locale=fr-CH; other=en'),'fr-CH');
 assert.equal(localeFromCookie('not_legalfeed_locale=it-CH'),'en');
});
test('dynamic errors and Swiss canton labels localize without altering interpolated user text',()=>{
 assert.equal(translate('de-CH','Your feed limit is 3. Request a higher limit in Feed limit, or delete a feed before creating another.'),translate('de-CH','Your feed limit is {0}. Request a higher limit in Feed limit, or delete a feed before creating another.',{0:3}));
 assert.match(translate('fr-CH','Cantonal legislation — Geneva'),/Genève/);
 assert.match(translate('it-CH','Cantonal legislation — Zurich'),/Zurigo/);
 assert.equal(translate('fr-CH','Why it matters for {0}',{0:'Weiß GmbH $& {0}'}).endsWith('Weiß GmbH $& {0}'),true);
 assert.equal(translate('de-CH','Unrecognized source text: Maßnahme'),'Unrecognized source text: Maßnahme');
});
test('copy exports translate labels while retaining stored publication content and user data',()=>{
 const update={headline:'Original: Maßnahmen',source_name:'Federal Supreme Court',source_section:'government_federal',published_at:'2026-10-02',summary:'«Maßnahmen» in original quotation',why_it_matters:'Stored explanation',client_name:'Weiß GmbH',url:'https://example.test/original'} as Update;
 const text=summaryText(update,true,'fr-CH');assert.match(text,/Tribunal fédéral/);assert.match(text,/Incidence pour/);assert.ok(text.includes(update.headline));assert.ok(text.includes(update.summary));assert.ok(text.includes(update.client_name));assert.ok(text.includes(update.url!));
});
test('AI language instructions preserve source evidence and schema fields',()=>{
 assert.match(languageInstruction('de-CH'),/Swiss Standard German.*ss instead of ß/);
 for(const locale of locales){assert.match(languageInstruction(locale),/Preserve original proper names, verbatim quotations and legal citations exactly/);assert.match(languageInstruction(locale),/JSON field names and enum values unchanged/);}
});
