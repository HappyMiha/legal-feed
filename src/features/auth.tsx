"use client";
import {useI18n,LanguageSwitcher} from '../i18n/client';

import {useEffect,useState} from 'react';
import {BrandLockup} from '../components/brand';
import {Button} from '../components/controls';
import {locales,type Locale} from '../i18n/core';
import {Input} from '@/components/ui/input';

export type AuthMode='register'|'login'|'forgot-password'|'reset-password'|'verify-email';
const titles:Record<AuthMode,string>={register:'Create your Legal Feed account',login:'Sign in to Legal Feed','forgot-password':'Reset your password','reset-password':'Choose a new password','verify-email':'Confirm your email'};
export default function AuthForm({mode='register'}:{mode?:AuthMode}){
 const {t:tr,locale,setLocale,signedIn}=useI18n();

 const [name,setName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState('');
 const [token,setToken]=useState(''),[change,setChange]=useState(false),[returnTo,setReturnTo]=useState('/');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{const lang=new URLSearchParams(location.search).get('lang');if(!signedIn&&lang&&locales.includes(lang as Locale))void setLocale(lang as Locale).catch(()=>{});const fragment=new URLSearchParams(location.hash.slice(1));setToken(fragment.get('token')||fragment.get('change')||'');setChange(fragment.has('change'));const target=new URLSearchParams(location.search).get('return_to');if(target){try{const u=new URL(target,location.origin);if(u.origin===location.origin&&u.pathname.startsWith('/')&&!/^\/(api|login|register|forgot-password|reset-password|verify-email)(\/|$)/.test(u.pathname))setReturnTo(u.pathname+u.search);}catch{}}if(location.hash)history.replaceState(null,'',location.pathname+location.search);},[]);
 const submit=async(e:React.FormEvent)=>{
  e.preventDefault();setError('');setBusy(true);
  try{
   if((mode==='register'||mode==='reset-password')&&password!==confirm)throw Error('The passwords do not match.');
   const action=mode==='verify-email'?(change?'verify-email-change':'verify'):mode;
   const response=await fetch('/api/auth/'+action,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({name,email,password,token,returnTo,locale})});
   const data=await response.json() as {error?:string;message?:string;returnTo?:string};
   if(!response.ok)throw Error(data.error||'Please try again.');
   if(mode==='register'||mode==='forgot-password'){setMessage(data.message||'Check your inbox for the next step.');setPassword('');setConfirm('');}
   else location.assign(mode==='verify-email'&&change?'/settings':data.returnTo||returnTo);
  }catch(err){setError(err instanceof Error?err.message:tr("Please try again."));}finally{setBusy(false);}
 };
 return <main className="auth-page"><section className="auth-card" aria-labelledby="auth-title">
  <a className="auth-brand" href="/"><BrandLockup/></a>
  <LanguageSwitcher/><div className="auth-heading"><h1 id="auth-title">{message?tr("Check your email"):tr(titles[mode])}</h1><p className="muted">{mode==='register'?tr("Follow Swiss legal topics in your personal feed and receive updates by email. Confirm your email to start setting up your first monitoring profile."):mode==='login'?tr("Continue to your monitoring profiles, saved articles and legal updates."):mode==='forgot-password'?tr("We will email you a link to choose a new password."):mode==='reset-password'?tr("Use at least 10 characters. Your other sessions will be signed out."):tr("Confirm this address to continue to Legal Feed.")}</p></div>
  {message?<div className="auth-message" role="status"><p>{tr(message)}</p><p className="muted">{tr("Check your spam folder too. Verification links expire after 30 minutes.")}</p><Button variant="outline" onClick={()=>setMessage('')}>{tr("Try again")}</Button></div>:<form onSubmit={submit} className="auth-form">
   {mode==='register'&&<label className="field">{tr("Name")}<Input autoComplete="name" required maxLength={120} value={name} onChange={e=>setName(e.target.value)}/></label>}
   {(mode==='register'||mode==='login'||mode==='forgot-password')&&<label className="field">{tr("Email")}<Input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label>}
   {(mode==='register'||mode==='login'||mode==='reset-password')&&<label className="field">{tr("Password")}<Input type="password" autoComplete={mode==='login'?'current-password':'new-password'} required minLength={mode==='login'?1:10} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/>{mode==='register'&&<span className="muted">{tr("At least 10 characters.")}</span>}</label>}
   {(mode==='register'||mode==='reset-password')&&<label className="field">{tr("Confirm password")}<Input type="password" autoComplete="new-password" required minLength={10} maxLength={128} value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>}
   {error&&<p className="error" role="alert">{tr(error)}</p>}
   {(mode==='verify-email'||mode==='reset-password')&&!token?<p role="alert">{tr("Open the link from your email to continue.")}</p>:<Button type="submit" disabled={busy}>{busy?tr("Please wait…"):mode==='register'?tr("Create Legal Feed account"):mode==='login'?tr("Sign in"):mode==='forgot-password'?tr("Send reset link"):mode==='reset-password'?tr("Save password"):tr("Confirm email")}</Button>}
   {mode==='login'&&<a className="auth-link" href="/forgot-password">{tr("Forgot password?")}</a>}
  </form>}
  <div className="auth-footer">{mode==='register'?<>{tr("Already have an account?")} <a href={'/login?return_to='+encodeURIComponent(returnTo)}>{tr("Sign in")}</a></>:mode==='login'?<>{tr("New to Legal Feed?")} <a href={'/register?return_to='+encodeURIComponent(returnTo)}>{tr("Create an account")}</a></>:<a href="/login">{tr("Back to sign in")}</a>}</div>
 </section></main>;
}
