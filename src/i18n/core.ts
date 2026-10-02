import de from './de-CH.json';
import fr from './fr-CH.json';
import it from './it-CH.json';
export const locales=['en','de-CH','fr-CH','it-CH'] as const;
export type Locale=typeof locales[number];
export const localeNames:Record<Locale,string>={en:'English','de-CH':'Deutsch (Schweiz)','fr-CH':'Français','it-CH':'Italiano'};
export function normalizeLocale(value:unknown):Locale{return typeof value==='string'&&locales.includes(value as Locale)?value as Locale:'en';}
export const localeFromCookie=(cookie:string)=>normalizeLocale(cookie.split(';').map(v=>v.trim()).find(v=>v.startsWith('legalfeed_locale='))?.split('=')[1]);
export const dictionaries:Record<Exclude<Locale,'en'>,Record<string,string>>={'de-CH':de,'fr-CH':fr,'it-CH':it};
export type Values=Record<string,string|number|null|undefined>;
const lookup=(locale:Exclude<Locale,'en'>,key:string)=>Object.hasOwn(dictionaries[locale],key)?dictionaries[locale][key]:undefined;
const escape=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const patterns=Object.keys(de).filter(key=>/\{\d+\}/.test(key)).sort((a,b)=>b.length-a.length).map(key=>({key,regex:new RegExp('^'+key.split(/(\{\d+\})/).map(part=>/^\{\d+\}$/.test(part)?'([\\s\\S]*?)':escape(part)).join('')+'$'),names:[...key.matchAll(/\{(\d+)\}/g)].map(x=>x[1])}));
export function translate(locale:Locale,key:string,values?:Values):string{
 let template=key,args=values;
 if(locale!=='en'&&!lookup(locale,template)&&!values){
  const match=patterns.map(p=>({p,m:p.regex.exec(key)})).find(x=>x.m);
  if(match){template=match.p.key;args=Object.fromEntries(match.p.names.map((n,i)=>[n,template.startsWith('Cantonal ')?(lookup(locale,match.m![i+1])??match.m![i+1]):match.m![i+1]]));}
 }
 const result=locale==='en'?template:(lookup(locale,template)??template);
 return result.replace(/\{(\d+)\}/g,(whole,n)=>args&&n in args?String(args[n]??''):whole);
}
export function languageInstruction(locale:Locale){
 const writing=locale==='en'?'Write generated titles, descriptions, summaries and explanations in English.':locale==='de-CH'?'Write generated titles, descriptions, summaries and explanations in Swiss Standard German. In your own prose, use ss instead of ß or ẞ.':locale==='fr-CH'?'Write generated titles, descriptions, summaries and explanations in Swiss French.':'Write generated titles, descriptions, summaries and explanations in Swiss Italian.';
 return writing+' Preserve original proper names, verbatim quotations and legal citations exactly as provided; do not translate or respell them. Keep JSON field names and enum values unchanged.';
}
