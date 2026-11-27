'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, Check, CheckCircle2, KeyRound, Loader2, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';

type AuthState = { authenticated?: boolean; step: 'password'|'verify_email'|'set_password'|'change_password'|'complete'; maskedEmail?: string; email?: string; name?: string; expiresAt?: string; resendAfter?: string|number; smsEnabled?: boolean };
const initial:AuthState={step:'password'};
function authPayload(value:unknown):AuthState&{error?:string}{const data=value&&typeof value==='object'?value as Record<string,unknown>:{};const allowed=['password','verify_email','set_password','change_password','complete'];return {step:typeof data.step==='string'&&allowed.includes(data.step)?data.step as AuthState['step']:'password',authenticated:data.authenticated===true,...Object.fromEntries(['maskedEmail','email','name','expiresAt','resendAfter','error'].filter(key=>typeof data[key]==='string').map(key=>[key,data[key]]))};}
function safeReturn(value:string|null){if(!value||!value.startsWith('/')||value.startsWith('//')||/[\\\u0000-\u001f]/.test(value))return '/workspace';try{const url=new URL(value,window.location.origin);if(url.origin!==window.location.origin||/^\/(?:sign-in|api|signin-with-chatgpt|signout-with-chatgpt)(?:\/|$)/.test(url.pathname))return '/workspace';return url.pathname+url.search+url.hash;}catch{return '/workspace';}}

export default function SignIn(){
  const [state,setState]=useState<AuthState>(initial);
  const [mode,setMode]=useState<'login'|'enroll'|'logout'|'manage'|'forgot'>('login');
  const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [confirmation,setConfirmation]=useState('');const [code,setCode]=useState('');const [currentPassword,setCurrentPassword]=useState('');
  const [busy,setBusy]=useState(true);const [error,setError]=useState('');const [notice,setNotice]=useState('');const [returnTo,setReturnTo]=useState('/workspace');const [now,setNow]=useState(Date.now());
  useEffect(()=>{const query=new URLSearchParams(window.location.search);setReturnTo(safeReturn(query.get('return_to')));if(query.get('mode')==='logout')setMode('logout');let cancelled=false;fetch('/api/auth/status',{credentials:'same-origin',cache:'no-store'}).then(async response=>{const data=authPayload(await response.json());if(!response.ok)throw new Error('Sign-in is temporarily unavailable. Please contact the workspace owner.');if(!cancelled)setState(data);}).catch(e=>{if(!cancelled)setError(e.message);}).finally(()=>{if(!cancelled)setBusy(false);});return()=>{cancelled=true;};},[]);
  useEffect(()=>{const interval=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(interval);},[]);
  async function submit(path:string,payload:Record<string,unknown>={}){
    setBusy(true);setError('');setNotice('');
    try{
      const response=await fetch('/api/auth/'+path,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),cache:'no-store'});
      const data=authPayload(await response.json().catch(()=>({error:'The server could not be reached. Please try again.'})));
      if(!response.ok)throw new Error(typeof data.error==='string'?data.error:'The request could not be completed.');
      if(path==='forgot'){setNotice('If that address has an active account, a password reset link will be sent. Check your inbox and spam folder.');setPassword('');return;}
      if(path==='logout'){setState(initial);setMode('login');setPassword('');setConfirmation('');setCode('');setCurrentPassword('');setNotice('You have signed out.');return;}
      if(path==='change-password'){setState(initial);setMode('login');setPassword('');setConfirmation('');setCurrentPassword('');setNotice('Password updated. Sign in again and verify your email code.');return;}
      setState({...data,step:data.step||'password'});setPassword('');setConfirmation('');setCode('');
      if(data.step==='complete'){window.location.assign(returnTo);return;}
    }catch(e){setError(e instanceof Error?e.message:'The request could not be completed.');}
    finally{setBusy(false);}
  }
  function onSubmit(event:FormEvent){event.preventDefault();if(busy)return;if(mode==='logout'){void submit('logout');return;}
    if(mode==='forgot'){void submit('forgot',{email});return;}
    if(mode==='manage'){if(password!==confirmation){setError('The new passwords do not match.');return;}void submit('change-password',{currentPassword,newPassword:password});return;}
    if(state.step==='verify_email'){void submit('verify',{code});return;}
    if(state.step==='set_password'||state.step==='change_password'){if(password!==confirmation){setError('The new passwords do not match.');return;}void submit('password',{password});return;}
    void submit(mode==='enroll'?'enroll':'login',mode==='enroll'?{email}:{email,password});
  }
  const passwordStep=state.step==='set_password'||state.step==='change_password'||mode==='manage';
  const complete=state.authenticated||state.step==='complete';
  const resendTime=typeof state.resendAfter==='number'?state.resendAfter:Date.parse(state.resendAfter||'');
  const waitSeconds=Number.isFinite(resendTime)?Math.max(0,Math.ceil((resendTime-now)/1000)):0;
  const title=mode==='forgot'?'Forgot your password?':mode==='logout'?'Sign out of your workspace':mode==='manage'?'Change your password':complete?'You’re signed in':state.step==='verify_email'?'Check your email':state.step==='change_password'?'Choose your new password':state.step==='set_password'?'Set up your password':mode==='enroll'?'Accept your invitation':'Welcome to your workspace';
  const description=mode==='forgot'?'Enter your registered email address. If there is an active account, we will send a secure link to create a new password.':mode==='logout'?'This ends all sign-in sessions for your account.':mode==='manage'?'Your other sessions will end. You will verify an email code when you sign in again.':complete?'Continue to your approved workspace, or manage your sign-in.':state.step==='verify_email'?`Enter the six-digit code sent to ${state.maskedEmail||'your email address'}. It expires in five minutes.`:state.step==='change_password'?'Your temporary password must be replaced before you can access the workspace.':state.step==='set_password'?'Your email is verified. Choose a password, then accept your invitation and wait for owner approval.':mode==='enroll'?'Use the exact email address the owner invited. An account can only be created from a valid invitation.':'Sign in with your email and password. Then verify the code sent to your email.';
  return <main className="nw-auth"><section className="nw-auth-story"><a className="nw-auth-brand" href="/"><span>NW</span>NorthWallEg</a><div className="nw-auth-story-copy"><span className="nw-auth-eyebrow">THE TEAM, CONNECTED</span><h1>Good work.<br/>Protected.</h1><p>Your projects, conversations and knowledge. One workspace, built around the people behind it.</p><div className="nw-auth-features"><span><ShieldCheck size={18}/>Owner-approved access</span><span><Mail size={18}/>Email verification</span><span><LockKeyhole size={18}/>Private employee tools</span></div></div><footer>Danish perspective. Egyptian ambition.</footer></section>
    <section className="nw-auth-panel"><div className="nw-auth-card"><div className="nw-auth-symbol">{complete?<CheckCircle2/>:state.step==='verify_email'?<Mail/>:passwordStep?<KeyRound/>:<LockKeyhole/>}</div><span className="nw-auth-eyebrow">EMPLOYEE ACCESS</span><h2>{title}</h2><p className="nw-auth-description">{description}</p>
      {!complete&&mode!=='logout'&&mode!=='manage'&&mode!=='forgot'&&<ol className="nw-auth-steps" aria-label="Sign-in verification"><li className={state.step!=='password'?'done':'current'}><span>{state.step!=='password'?<Check size={13}/>:1}</span>{mode==='enroll'?'Invitation':'Password'}</li><li className={passwordStep?'done':state.step==='verify_email'?'current':''}><span>{passwordStep?<Check size={13}/>:2}</span>Email code</li><li className={passwordStep?'current':''}><span>3</span>{passwordStep?'New password':'Workspace'}</li></ol>}
      {error&&<div className="nw-auth-alert error" role="alert">{error}</div>}{notice&&<div className="nw-auth-alert" role="status">{notice}</div>}
      {complete&&mode!=='logout'&&mode!=='manage'?<div className="nw-auth-buttons"><p className="nw-auth-account">{state.email||state.name||'Your verified account'}</p><a className="nw-auth-button" href={returnTo}>Open workspace</a><button className="nw-auth-button secondary" onClick={()=>setMode('manage')}>Change password</button><button className="nw-auth-link" onClick={()=>setMode('logout')}>Sign out</button></div>:<form onSubmit={onSubmit}>
        {mode==='manage'&&<label>Current password<input type="password" autoComplete="current-password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} required maxLength={128} disabled={busy}/></label>}
        {state.step==='password'&&mode!=='logout'&&mode!=='manage'&&<><label>Email address<input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com" maxLength={254} required disabled={busy}/></label>{mode==='login'&&<label>Password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required maxLength={128} disabled={busy}/></label>}</>}
        {state.step==='verify_email'&&mode!=='logout'&&<label>Verification code<input className="nw-auth-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} placeholder="000000" required disabled={busy}/></label>}
        {passwordStep&&mode!=='logout'&&<><label>New password<input type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} minLength={15} maxLength={128} required disabled={busy}/></label><small className="nw-auth-hint">Use at least 15 characters. A unique passphrase works well.</small><label>Confirm new password<input type="password" autoComplete="new-password" value={confirmation} onChange={e=>setConfirmation(e.target.value)} minLength={15} maxLength={128} required disabled={busy}/></label></>}
        {mode==='login'&&state.step==='password'&&<button type="button" className="nw-auth-link nw-auth-forgot" disabled={busy} onClick={()=>{setMode('forgot');setError('');setNotice('');setPassword('');}}>Forgot password?</button>}<button className="nw-auth-button" type="submit" disabled={busy}>{busy?<><Loader2 size={17} className="nw-auth-spinner"/>Please wait</>:mode==='logout'?'Sign out':passwordStep?'Save new password':state.step==='verify_email'?'Verify code':mode==='enroll'?'Verify invitation email':mode==='forgot'?'Email reset link':'Continue securely'}</button>
      </form>}
      {state.step==='verify_email'&&mode!=='logout'&&<div className="nw-auth-resend"><span>Didn’t receive the code? Check your junk folder.</span><button className="nw-auth-link" disabled={busy||waitSeconds>0} onClick={()=>void submit('resend')}>{waitSeconds>0?`Resend in ${waitSeconds}s`:'Send a new code'}</button></div>}
      {state.step==='password'&&!complete&&mode!=='logout'&&mode!=='forgot'&&<button className="nw-auth-link nw-auth-switch" disabled={busy} onClick={()=>{setMode(mode==='enroll'?'login':'enroll');setError('');setPassword('');}}>{mode==='enroll'?'Already have an account? Sign in':'Have an owner invitation? Set up access'}</button>}
      {mode==='forgot'&&<button className="nw-auth-link nw-auth-switch" type="button" onClick={()=>{setMode('login');setNotice('');setError('');}}>Back to sign in</button>}
      {state.step!=='password'&&!complete&&mode!=='logout'&&mode!=='forgot'&&<button className="nw-auth-link nw-auth-switch" disabled={busy} onClick={()=>void submit('logout')}>Use another email address</button>}
      <div className="nw-auth-note"><ShieldCheck size={18}/><p>Only the owner can invite and approve employees. Verifying your email does not grant workspace access by itself.</p></div><a className="nw-auth-back" href="/"><ArrowLeft size={15}/>NorthWallEg website</a>
    </div></section></main>;
}
