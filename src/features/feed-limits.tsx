"use client";
import {useEffect,useRef,useState} from 'react';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {Button} from '../components/controls';
import {BrandLockup} from '../components/brand';
import {api} from '../production/api';
import {stateStore} from '../platform/storage';
import type {FeedQuota,FeedLimitReview} from '../domain/monitoring';

export function FeedLimitPage({quota}:{quota:FeedQuota}){
 const minimum=Math.max(quota.limit+1,quota.used),[amount,setAmount]=useState(String(minimum)),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>setAmount(String(minimum)),[minimum]);
 const pending=quota.request?.status==='pending';
 const submit=async(e:React.FormEvent)=>{
  e.preventDefault();if(busy)return;setBusy(true);setError('');
  try{const owner=stateStore.read().account_id,result=await api<FeedQuota>('feed-limit-request','POST',{requested_limit:Number(amount),reason});if(stateStore.read().account_id===owner){stateStore.replace({...stateStore.read(),feed_quota:result});void stateStore.refresh().catch(()=>{});}setReason('');}
  catch(err){setError(err instanceof Error?err.message:'Could not submit your request.');}
  finally{setBusy(false);}
 };
 return <div className="settings-page">
  <div className="page-heading"><h1>Feed limit</h1></div>
  <section className="panel"><h2>{quota.used} of {quota.limit} feeds used</h2><p className="muted">Each monitoring profile creates one feed. Active and paused profiles both count toward your limit.</p></section>
  {quota.request&&<section className="panel" aria-live="polite"><h2>{pending?'Request pending':quota.request.status==='approved'?'Request approved':quota.request.status==='rejected'?'Request declined':'Request expired'}</h2>
   <p>{pending?`You requested a total limit of ${quota.request.requested_limit} feeds. Your request has been submitted for review.`:quota.request.status==='approved'?`Your request was approved for a total of ${quota.request.approved_limit} feeds.`:quota.request.status==='rejected'?'Your limit has not changed. You can submit a new request with more information.':'The review link expired. You can submit a new request.'}</p>
   <p className="muted">Requested {new Date(quota.request.created_at).toLocaleDateString()}{pending?` · Review link valid until ${new Date(quota.request.expires_at).toLocaleDateString()}`:''}</p>
   <p className="request-reason">{quota.request.reason}</p>
  </section>}
  {!pending&&quota.limit<1000&&<section className="settings-section"><h2>Request a higher limit</h2><p className="muted">Tell us the total number of feeds you need and why. The Legal Feed team will review your request.</p>
   <form onSubmit={submit} className="auth-form">
    <label className="field">Requested total number of feeds<Input type="number" min={minimum} max={1000} step={1} required value={amount} onChange={e=>setAmount(e.target.value)}/><span className="muted">Total feeds after approval, including your existing feeds.</span></label>
    <label className="field">Reason for the increase<Textarea required maxLength={2000} rows={5} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Explain which additional topics or clients you need to monitor."/></label>
    {error&&<p role="alert" className="error">{error}</p>}
    <Button disabled={busy||!reason.trim()}>{busy?'Submitting…':'Submit request'}</Button>
   </form>
  </section>}
 </div>;
}

export function FeedLimitReviewPage(){
 const initialized=useRef(false),[token,setToken]=useState(''),[review,setReview]=useState<FeedLimitReview|null>(null),[choice,setChoice]=useState('approve'),[amount,setAmount]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const call=async(path:string,data:unknown)=>{const response=await fetch('/api/limit-review/'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data),cache:'no-store'});const result=await response.json() as FeedLimitReview & {error?:string};if(!response.ok)throw Error(result.error||'The request could not be completed.');return result;};
 useEffect(()=>{if(initialized.current)return;initialized.current=true;
  const fragment=new URLSearchParams(location.hash.slice(1)),value=fragment.get('token')||'',action=fragment.get('action')||'approve';
  history.replaceState(null,'',location.pathname);setToken(value);setChoice(['approve','reject','custom'].includes(action)?action:'approve');
  if(!value){setError('Open the private review link from the email sent to info@helveticlens.ch.');setLoading(false);return;}
  void call('read',{token:value}).then(data=>{setReview(data);setAmount(String(data.requested_limit));}).catch(err=>setError(err.message)).finally(()=>setLoading(false));
 },[]);
 const submit=async(e:React.FormEvent)=>{
  e.preventDefault();if(busy||!review)return;setBusy(true);setError('');
  try{setReview(await call('decide',choice==='reject'?{token,decision:'reject'}:{token,decision:'approve',approved_limit:choice==='custom'?Number(amount):review.requested_limit}));}
  catch(err){setError(err instanceof Error?err.message:'Could not save the decision.');}
  finally{setBusy(false);}
 };
 const reload=async()=>{setLoading(true);setError('');try{const data=await call('read',{token});setReview(data);setAmount(value=>value||String(data.requested_limit));}catch(err){setError(err instanceof Error?err.message:'Could not load the request.');}finally{setLoading(false);}};
 return <main className="auth-page"><section className="auth-card quota-review" aria-labelledby="review-title">
  <a className="auth-brand" href="/"><BrandLockup/></a><h1 id="review-title">Review feed limit request</h1>
  {loading&&<p role="status">Loading request…</p>}
  {error&&<p role="alert" className="error">{error}</p>}
  {error&&token&&<Button type="button" variant="outline" disabled={busy||loading} onClick={()=>void reload()}>Reload request</Button>}
  {review&&<>
   <dl className="quota-details"><dt>Account</dt><dd>{review.name}</dd><dt>Verified email</dt><dd>{review.email}</dd><dt>Feeds used</dt><dd>{review.used}</dd><dt>Current total limit</dt><dd>{review.limit}</dd><dt>Requested total limit</dt><dd>{review.requested_limit}</dd></dl>
   <h2>Reason supplied by the user</h2><p className="request-reason">{review.reason}</p>
   {review.status==='pending'?<form onSubmit={submit} className="auth-form">
    <label className="field">Decision<select value={choice} onChange={e=>setChoice(e.target.value)}><option value="approve">Approve {review.requested_limit} total feeds</option><option value="custom">Approve a different total</option><option value="reject">Decline request</option></select></label>
    {choice==='custom'&&<label className="field">Approved total number of feeds<Input type="number" min={Math.max(review.limit+1,review.used)} max={1000} step={1} required value={amount} onChange={e=>setAmount(e.target.value)}/></label>}
    <p className="muted">{choice==='reject'?'The current feed limit will stay unchanged.':`The account’s total feed limit will be set to ${choice==='custom'?amount:review.requested_limit}. Existing feeds are included in this total.`}</p>
    <Button disabled={busy} variant={choice==='reject'?'destructive':'default'}>{busy?'Saving…':choice==='reject'?'Confirm decline':'Confirm new limit'}</Button>
   </form>:<p className="auth-message" role="status">{review.status==='approved'?`Approved. The total feed limit is now ${review.approved_limit}.`:'This request has been declined. The feed limit was not changed.'}</p>}
  </>}
 </section></main>;
}
