'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';

export default function ResetPasswordPage(){
 const [token,setToken]=useState('');
 const [loaded,setLoaded]=useState(false);
 const [password,setPassword]=useState('');
 const [confirmation,setConfirmation]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState(false);
 useEffect(()=>{
   const url=new URL(window.location.href);
   const raw=url.searchParams.get('token')||'';
   if(/^[A-Za-z0-9_-]{43}$/.test(raw))setToken(raw);
   // Remove the bearer token from the URL, address bar and future referrers.
   if(url.searchParams.has('token')){url.searchParams.delete('token');window.history.replaceState({},'',url.pathname);}
   setLoaded(true);
 },[]);
 async function submit(event:FormEvent<HTMLFormElement>){
   event.preventDefault();if(busy||!token)return;
   if(password!==confirmation){setError('The passwords do not match.');return;}
   setBusy(true);setError('');
   try{
    const response=await fetch('/api/auth/reset',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,password})});
    const data=await response.json().catch(()=>({})) as {error?:string};
    if(!response.ok)throw new Error(typeof data.error==='string'?data.error:'The reset link could not be used. Request a new link.');
    setToken('');setPassword('');setConfirmation('');setSuccess(true);
   }catch(error){setError(error instanceof Error?error.message:'Password reset was unsuccessful.');}
   finally{setBusy(false);}
 }
 return <main className="nw-auth"><section className="nw-auth-story"><a className="nw-auth-brand" href="/"><span>NW</span>NorthWallEg</a><div className="nw-auth-story-copy"><span className="nw-auth-eyebrow">PRIVATE ACCOUNT RECOVERY</span><h1>Protected.<br/>Restored.</h1><p>Secure account recovery for approved NorthWallEg employees and administrators.</p><div className="nw-auth-features"><span><ShieldCheck size={18}/>Secure, single-use email link</span><span><LockKeyhole size={18}/>Existing sessions revoked after reset</span></div></div><footer>Danish perspective. Egyptian ambition.</footer></section><section className="nw-auth-panel"><div className="nw-auth-card"><div className="nw-auth-symbol"><KeyRound/></div><span className="nw-auth-eyebrow">EMPLOYEE ACCESS</span><h2>Reset your password</h2><p className="nw-auth-description">Choose a new password. The link expires after 15 minutes and can only be used once.</p>
 {error&&<div className="nw-auth-alert error" role="alert">{error}</div>}
 {success?<div role="status" className="nw-auth-alert">Your password was changed. Your previous sessions have been signed out. Sign in again and verify your email code.</div>:
 loaded&&!token?<div role="alert" className="nw-auth-alert error">The reset link is missing or invalid. Request a new link from the sign-in page.</div>:
 <form onSubmit={submit}><label>New password<input type="password" autoComplete="new-password" minLength={15} maxLength={128} required disabled={busy||!loaded} value={password} onChange={e=>setPassword(e.target.value)}/></label><small className="nw-auth-hint">Use a unique password of at least 15 characters.</small><label>Confirm new password<input type="password" autoComplete="new-password" minLength={15} maxLength={128} required disabled={busy||!loaded} value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label><button type="submit" className="nw-auth-button" disabled={busy||!loaded}>{busy?'Updating password…':'Save new password'}</button></form>}
 <div className="nw-auth-note"><ShieldCheck size={18}/><p>You must still verify your email during sign-in. Password recovery does not change your employee role or approval status.</p></div><a className="nw-auth-back" href="/sign-in"><ArrowLeft size={15}/>Back to employee sign-in</a></div></section></main>;
}
