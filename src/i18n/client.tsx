"use client";
import {createContext,useCallback,useContext,useEffect,useState,type ReactNode} from 'react';
import {locales,localeNames,normalizeLocale,translate,type Locale,type Values} from './core';
type Context={signedIn:boolean;locale:Locale;t:(key:string,values?:Values)=>string;setLocale:(locale:Locale)=>Promise<void>;busy:boolean};
const I18nContext=createContext<Context>({signedIn:false,locale:'en',t:key=>key,setLocale:async()=>{},busy:false});
export function I18nProvider({initialLocale,signedIn,children}:{initialLocale:Locale;signedIn:boolean;children:ReactNode}){
 const [locale,updateLocale]=useState(initialLocale),[busy,setBusy]=useState(false);
 useEffect(()=>{document.documentElement.lang=locale==='en'?'en-CH':locale;document.cookie=`legalfeed_locale=${locale}; Path=/; SameSite=Lax; Max-Age=31536000${location.protocol==='https:'?'; Secure':''}`;},[locale]);
 const setLocale=useCallback(async(value:Locale)=>{
  const next=normalizeLocale(value);setBusy(true);
  try{
   if(signedIn){const response=await fetch('/api/account/language',{method:'PUT',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({locale:next})});if(!response.ok)throw Error('Could not save the language.');}
   updateLocale(next);
  }finally{setBusy(false);}
 },[signedIn]);
 const t=useCallback((key:string,values?:Values)=>translate(locale,key,values),[locale]);
 return <I18nContext.Provider value={{signedIn,locale,t,setLocale,busy}}>{children}</I18nContext.Provider>;
}
export const useI18n=()=>useContext(I18nContext);
export function LanguageSwitcher(){
 const {locale,t,setLocale,busy}=useI18n();const [error,setError]=useState('');
 return <div className="language-control"><label><span>{t('Language')}</span><select aria-label={t('Language')} value={locale} disabled={busy} onChange={e=>{setError('');void setLocale(e.target.value as Locale).catch(()=>setError('Could not save the language.'));}}>{locales.map(l=><option value={l} key={l}>{localeNames[l]}</option>)}</select></label>{error&&<span className="error" role="alert">{t(error)}</span>}</div>;
}
