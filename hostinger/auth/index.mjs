import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { createMySqlAuthStore, initializeAuthSchema } from './mysql-store.mjs';
import { DUMMY_PASSWORD_HASH, hashPassword, hashTemporaryPassword, validateNewPassword, verifyPassword } from './password.mjs';

export { initializeAuthSchema, hashPassword, verifyPassword };
export const AUTH_COOKIES = Object.freeze({ pending:'__Host-nw_pending', session:'__Host-nw_session' });
export const AUTH_POLICY = Object.freeze({ codeTtlMs:300000, maxCodeAttempts:5, resendMs:60000, passwordGateTtlMs:600000, temporaryPasswordMs:86400000, absoluteSessionMs:28800000, idleSessionMs:1800000, maxBodyBytes:16384 });
const ENDPOINTS = new Set(['status','login','enroll','verify','resend','password','logout','change-password']);
const LIMITS = Object.freeze({
  login:{ account:10,ip:40,global:500,window:900000 },
  enroll:{ account:5,ip:20,global:100,window:3600000 },
  resend:{ account:5,ip:30,global:150,window:3600000 },
  verify:{ account:15,ip:60,global:1000,window:900000 },
  password:{ account:5,ip:20,global:200,window:900000 },
  change:{ account:5,ip:20,global:200,window:900000 },
});
export class AuthError extends Error {
  constructor(status,code,message,retryAfter) { super(message); this.status=status; this.code=code; this.retryAfter=retryAfter; }
}
const failure = (status=400,code='invalid_verification',message='Verification could not be completed. Start again or request a new code.') => ({ failure:{status,code,message} });
function checked(result) { if(result?.failure) throw new AuthError(result.failure.status,result.failure.code,result.failure.message); return result; }
const iso = time => new Date(Number(time)).toISOString();
const token = () => randomBytes(32).toString('base64url');
const tokenHash = value => createHash('sha256').update(value).digest('hex');
export function normalizeEmail(value) {
  if(typeof value!=='string'||value.length>254) return null;
  const email=value.trim().toLowerCase();
  // Keep normalization identical to workspace email binding. No Unicode alias folding.
  return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/.test(email)&&email.length<=254&&!email.includes('..') ? email : null;
}
const maskedEmail = email => { const [local,domain]=email.split('@'); return `${local.slice(0,1)}${'*'.repeat(Math.min(5,Math.max(2,local.length-1)))}@${domain}`; };
function cookieValue(request,name) {
  const values=(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(`${name}=`));
  if(values.length!==1) return null;
  const value=values[0].slice(name.length+1);
  return /^[A-Za-z0-9_-]{43}$/.test(value)?value:null;
}
const cookie = (name,value,maxAge) => `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
const clearCookies = () => [cookie(AUTH_COOKIES.pending,'',0),cookie(AUTH_COOKIES.session,'',0)];
function json(value,status=200,cookies=[],retryAfter) {
  const headers=new Headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Pragma':'no-cache','X-Content-Type-Options':'nosniff'});
  cookies.forEach(value=>headers.append('Set-Cookie',value));
  if(retryAfter) headers.set('Retry-After',String(retryAfter));
  return new Response(JSON.stringify(value),{status,headers});
}
async function body(request,fields) {
  if((request.headers.get('content-type')||'').split(';')[0].trim().toLowerCase()!=='application/json') throw new AuthError(415,'json_required','Send a JSON request.');
  const length=request.headers.get('content-length');
  if(length&&(!/^\d+$/.test(length)||Number(length)>AUTH_POLICY.maxBodyBytes)) throw new AuthError(413,'request_too_large','The request is too large.');
  const reader=request.body?.getReader();
  let bytes=0; const chunks=[];
  if(reader) try { for(;;) { const {value,done}=await reader.read(); if(done) break; bytes+=value.byteLength; if(bytes>AUTH_POLICY.maxBodyBytes) { await reader.cancel(); throw new AuthError(413,'request_too_large','The request is too large.'); } chunks.push(value); } } finally { reader.releaseLock(); }
  let input;
  try { input=JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new AuthError(400,'invalid_request','The request is invalid.'); }
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!fields.includes(key))) throw new AuthError(400,'invalid_request','The request is invalid.');
  return input;
}

export function createAuthService({pool,store:injectedStore,origin,secret,ownerEmail,sendCode,getInvitation,clock=Date.now,eventRetentionDays=30}={}) {
  let canonical;
  try { canonical=new URL(origin); } catch { throw new Error('A canonical HTTPS AUTH origin is required.'); }
  if(canonical.protocol!=='https:'||canonical.username||canonical.password||canonical.pathname!=='/'||canonical.search||canonical.hash) throw new Error('A canonical HTTPS AUTH origin is required.');
  origin=canonical.origin;
  if(typeof secret!=='string'||Buffer.byteLength(secret)<32) throw new Error('AUTH_SECRET must contain at least 32 bytes of securely generated secret material.');
  ownerEmail=normalizeEmail(ownerEmail);
  if(!ownerEmail) throw new Error('A valid owner email is required.');
  if(typeof sendCode!=='function') throw new Error('Email delivery must be configured before authentication starts.');
  if(typeof getInvitation!=='function') throw new Error('An owner-invitation lookup is required.');
  if(!Number.isInteger(eventRetentionDays)||eventRetentionDays<1||eventRetentionDays>90) throw new Error('Authentication event retention must be between 1 and 90 days.');
  const store=injectedStore||createMySqlAuthStore(pool);
  const mac=(...parts)=>createHmac('sha256',secret).update(JSON.stringify(parts)).digest('hex');
  const ipFor=context=>{ const value=typeof context?.clientIp==='string'?context.clientIp:''; const normalized=value.startsWith('::ffff:')&&isIP(value.slice(7))===4?value.slice(7):value; return isIP(normalized)?normalized:'shared-untrusted-client'; };
  const audit=(tx,event,outcome,{accountId=null,email=null,context={},detail=''}={})=>tx.event({id:randomUUID(),accountId,emailKey:email?mac('email',email):null,ipKey:mac('ip',ipFor(context)),event,outcome,detail:String(detail).replace(/[^a-zA-Z0-9_.:-]/g,'_').slice(0,200),createdAt:clock()});
  function requestBoundary(request,write=false) {
    if(new URL(request.url).origin!==origin) throw new AuthError(403,'origin_rejected','This request is not allowed.');
    const supplied=request.headers.get('origin'),fetchSite=request.headers.get('sec-fetch-site');
    if((write&&supplied!==origin)||(!write&&supplied&&supplied!==origin)||(fetchSite&&!['same-origin','none'].includes(fetchSite))) throw new AuthError(403,'origin_rejected','This request is not allowed.');
  }
  async function throttle(action,email,context) {
    const rule=LIMITS[action],now=clock();
    // Global, then IP, then account: once saturated, rotating attacker input
    // cannot create additional bucket rows, flow rows or per-denial audit rows.
    const buckets=[{key:mac('limit',action,'global'),limit:rule.global},{key:mac('limit',action,'ip',ipFor(context)),limit:rule.ip},{key:mac('limit',action,'account',email),limit:rule.account}];
    const denied=await store.transaction(async tx=>{ for(const b of buckets) { const result=await tx.rate(b.key,b.limit,rule.window,now); if(!result.allowed) return result.retryAt; } return 0; });
    if(denied) throw new AuthError(429,'rate_limited','Too many attempts. Please wait before trying again.',Math.max(1,Math.ceil((denied-now)/1000)));
  }
  async function invitation(email,flow,transaction) {
    const current=await getInvitation(email,transaction?{connection:transaction.connection,lock:true}:undefined);
    if(!current||current.status!=='invited'||typeof current.memberId!=='string'||!current.memberId||typeof current.invitationId!=='string'||!current.invitationId||current.memberId.length>191||current.invitationId.length>191||current.identityAnchorUserId!==null) return null;
    const expires=typeof current.expiresAt==='number'?current.expiresAt:Date.parse(current.expiresAt);
    if(!Number.isFinite(expires)||expires<=clock()) return null;
    if(flow&&(flow.invitationId!==current.invitationId||flow.memberId!==current.memberId)) return null;
    return current;
  }
  const flowValid=(flow,now)=>!!flow&&Number(flow.expiresAt)>now&&Number(flow.otpAttempts)<AUTH_POLICY.maxCodeAttempts;
  const accountUsable=(account,now=clock())=>!!account?.enabled&&(!account.mustChangePassword||(Number.isFinite(Number(account.temporaryExpiresAt))&&Number(account.temporaryExpiresAt)>now));
  async function lockFlow(tx,snapshot,hash) {
    const account=snapshot.accountId?await tx.accountById(snapshot.accountId):await tx.accountByEmail(snapshot.email);
    const flow=await tx.flowByHash(hash);
    return {account,flow};
  }
  async function issueSession(tx,account,now,context) {
    const raw=token();
    await tx.insertSession({tokenHash:tokenHash(raw),accountId:account.id,passwordVersion:Number(account.passwordVersion),createdAt:now,lastSeenAt:now,absoluteExpiresAt:now+AUTH_POLICY.absoluteSessionMs});
    await audit(tx,'session.created','success',{accountId:account.id,email:account.email,context});
    return raw;
  }
  const completed=(raw)=>json({ok:true,authenticated:true,step:'complete'},200,[cookie(AUTH_COOKIES.session,raw,AUTH_POLICY.absoluteSessionMs/1000),cookie(AUTH_COOKIES.pending,'',0)]);
  function pendingResponse(flow,raw) {
    return json({ok:true,authenticated:false,step:flow.stage,maskedEmail:maskedEmail(flow.email),expiresAt:iso(flow.expiresAt),resendAfter:iso(flow.resendAt),smsEnabled:false},200,[cookie(AUTH_COOKIES.pending,raw,Math.max(1,Math.ceil((Number(flow.expiresAt)-clock())/1000))),cookie(AUTH_COOKIES.session,'',0)]);
  }
  async function deliver(flow,raw,code,context,real=true) {
    if(real) {
      try { await sendCode({to:flow.email,code,purpose:flow.purpose,expiresInMinutes:5}); }
      catch {
        await store.transaction(async tx=>{ await tx.deleteFlow(flow.tokenHash); await audit(tx,'email.delivery','failure',{accountId:flow.accountId,email:flow.email,context,detail:'provider_failed'}); });
        throw new AuthError(503,'verification_unavailable','Verification is temporarily unavailable. Please try again later.');
      }
    }
    const delivered=await store.transaction(async tx=>{ const current=await tx.flowByHash(flow.tokenHash); if(!flowValid(current,clock())||current.otpGeneration!==flow.otpGeneration) return null; current.delivered=true; await tx.updateFlow(current); await audit(tx,'email.delivery',real?'success':'denied',{accountId:flow.accountId,email:flow.email,context,detail:real?'provider_accepted':'generic_enrollment_response'}); return current; });
    if(!delivered) throw new AuthError(400,'invalid_verification','Verification could not be completed. Start again.');
    return pendingResponse(delivered,raw);
  }
  async function startFlow(request,email,account,currentInvitation,context,purpose) {
    const now=clock(),raw=token(),code=String(randomInt(0,1000000)).padStart(6,'0'),id=randomUUID();
    const flow={id,tokenHash:tokenHash(raw),accountId:account?.id||null,email,purpose,stage:'verify_email',invitationId:currentInvitation?.invitationId||null,memberId:currentInvitation?.memberId||null,accountVersion:account?Number(account.passwordVersion):null,otpMac:mac('otp',id,1,code),otpGeneration:1,otpAttempts:0,expiresAt:now+AUTH_POLICY.codeTtlMs,resendAt:now+AUTH_POLICY.resendMs,verifiedAt:null,delivered:false,createdAt:now};
    const valid=await store.transaction(async tx=>{
      if(account) { const locked=await tx.accountById(account.id); if(!accountUsable(locked)||Number(locked.passwordVersion)!==Number(account.passwordVersion)) return false; }
      if(account||currentInvitation) await tx.deleteFlowsForEmail(email);
      const oldSession=cookieValue(request,AUTH_COOKIES.session); if(oldSession) await tx.deleteSession(tokenHash(oldSession));
      const oldPending=cookieValue(request,AUTH_COOKIES.pending); if(oldPending) await tx.deleteFlow(tokenHash(oldPending));
      await tx.insertFlow(flow); await audit(tx,`${purpose}.started`,'success',{accountId:flow.accountId,email,context}); return true;
    });
    if(!valid) throw new AuthError(401,'invalid_credentials','Sign-in could not be completed. Check your details and try again.');
    return deliver(flow,raw,code,context,purpose==='login'||!!currentInvitation);
  }
  async function login(request,input,context) {
    const email=normalizeEmail(input.email);
    if(!email||typeof input.password!=='string'||input.password.length>512) throw new AuthError(401,'invalid_credentials','Sign-in could not be completed. Check your details and try again.');
    await throttle('login',email,context);
    const account=await store.readAccountByEmail(email);
    const valid=await verifyPassword(input.password,account?.passwordHash||DUMMY_PASSWORD_HASH);
    if(!valid||!accountUsable(account)) { await store.transaction(tx=>audit(tx,'login.password','failure',{email,context,detail:'invalid_credentials'})); throw new AuthError(401,'invalid_credentials','Sign-in could not be completed. Check your details and try again.'); }
    return startFlow(request,email,account,null,context,'login');
  }
  async function enroll(request,input,context) {
    const email=normalizeEmail(input.email);
    if(!email) throw new AuthError(400,'invalid_request','Enter a valid email address.');
    await throttle('enroll',email,context);
    const account=await store.readAccountByEmail(email);
    const current=account||email===ownerEmail?null:await invitation(email);
    // Unknown, existing and uninvited addresses receive the same public envelope.
    // Their decoy challenge can never create an account or an identity session.
    return startFlow(request,email,null,current,context,'enroll');
  }
  async function verify(request,input,context) {
    const raw=cookieValue(request,AUTH_COOKIES.pending),hash=raw?tokenHash(raw):null;
    const snapshot=hash?await store.readFlow(hash):null;
    await throttle('verify',snapshot?.email||'unknown-pending',context);
    if(!snapshot||typeof input.code!=='string'||!/^\d{6}$/.test(input.code)) throw new AuthError(400,'invalid_verification','Verification could not be completed. Check the code or start again.');
    const result=await store.transaction(async tx=>{
      const {account,flow}=await lockFlow(tx,snapshot,hash),now=clock();
      if(!flowValid(flow,now)||flow.stage!=='verify_email'||!flow.delivered) return failure();
      if(flow.purpose==='login'&&(!accountUsable(account,now)||Number(account.passwordVersion)!==Number(flow.accountVersion))) { await tx.deleteFlow(hash); return failure(); }
      const expected=Buffer.from(flow.otpMac,'hex'),provided=Buffer.from(mac('otp',flow.id,flow.otpGeneration,input.code),'hex');
      if(expected.length!==provided.length||!timingSafeEqual(expected,provided)) {
        flow.otpAttempts=Number(flow.otpAttempts)+1; await tx.updateFlow(flow);
        await audit(tx,'code.verify','failure',{accountId:flow.accountId,email:flow.email,context,detail:flow.otpAttempts>=AUTH_POLICY.maxCodeAttempts?'attempts_exhausted':'incorrect_code'});
        return failure();
      }
      if(flow.purpose==='enroll'&&(!flow.invitationId||account||!await invitation(flow.email,flow,tx))) { await tx.deleteFlow(hash); await audit(tx,'enrollment.verify','denied',{email:flow.email,context,detail:'invitation_unavailable'}); return failure(); }
      flow.verifiedAt=now; flow.otpMac=mac('consumed',flow.id,randomBytes(32).toString('hex'));
      await audit(tx,'code.verify','success',{accountId:flow.accountId,email:flow.email,context});
      if(flow.purpose==='enroll'||account.mustChangePassword) {
        const next=token(); flow.tokenHash=tokenHash(next); flow.stage=flow.purpose==='enroll'?'set_password':'change_password'; flow.expiresAt=now+AUTH_POLICY.passwordGateTtlMs; await tx.updateFlow(flow); return {flow,raw:next};
      }
      await tx.deleteFlowsForAccount(account.id);
      return {session:await issueSession(tx,account,now,context)};
    });
    checked(result);
    return result.session?completed(result.session):pendingResponse(result.flow,result.raw);
  }
  async function resend(request,context) {
    const raw=cookieValue(request,AUTH_COOKIES.pending),hash=raw?tokenHash(raw):null;
    const snapshot=hash?await store.readFlow(hash):null;
    await throttle('resend',snapshot?.email||'unknown-pending',context);
    if(!snapshot) throw new AuthError(400,'invalid_verification','Verification could not be completed. Start again.');
    const next=token(); let code=String(randomInt(0,1000000)).padStart(6,'0');
    const result=await store.transaction(async tx=>{
      const {account,flow}=await lockFlow(tx,snapshot,hash),now=clock();
      if(!flowValid(flow,now)||flow.stage!=='verify_email'||!flow.delivered) return failure();
      if(Number(flow.resendAt)>now) return {failure:{status:429,code:'resend_wait',message:'Wait 60 seconds between code requests.'},retryAfter:Math.ceil((Number(flow.resendAt)-now)/1000)};
      if(flow.purpose==='login'&&(!accountUsable(account,now)||Number(account.passwordVersion)!==Number(flow.accountVersion))) { await tx.deleteFlow(hash); return failure(); }
      const real=flow.purpose==='login'||!!(flow.invitationId&&!account&&await invitation(flow.email,flow,tx));
      if(flow.purpose==='enroll'&&flow.invitationId&&!real) { await tx.deleteFlow(hash); return failure(); }
      while(mac('otp',flow.id,flow.otpGeneration,code)===flow.otpMac) code=String(randomInt(0,1000000)).padStart(6,'0');
      flow.tokenHash=tokenHash(next); flow.otpGeneration=Number(flow.otpGeneration)+1; flow.otpMac=mac('otp',flow.id,flow.otpGeneration,code); flow.expiresAt=now+AUTH_POLICY.codeTtlMs; flow.resendAt=now+AUTH_POLICY.resendMs; flow.delivered=false;
      // otpAttempts deliberately survives resend; the durable account limit also survives.
      await tx.updateFlow(flow); await audit(tx,'code.resent','success',{accountId:flow.accountId,email:flow.email,context}); return {flow,real};
    });
    if(result.failure) throw new AuthError(result.failure.status,result.failure.code,result.failure.message,result.retryAfter);
    return deliver(result.flow,next,code,context,result.real);
  }
  async function setPassword(request,input,context) {
    const raw=cookieValue(request,AUTH_COOKIES.pending),hash=raw?tokenHash(raw):null;
    const snapshot=hash?await store.readFlow(hash):null;
    await throttle('password',snapshot?.email||'unknown-pending',context);
    if(!snapshot||!flowValid(snapshot,clock())||!snapshot.verifiedAt||!['set_password','change_password'].includes(snapshot.stage)) throw new AuthError(400,'invalid_verification','Complete email verification before choosing a password.');
    let normalized;
    try { normalized=validateNewPassword(input.password); } catch(error) { throw new AuthError(400,'password_policy',error.message); }
    const prior=snapshot.accountId?await store.readAccountById(snapshot.accountId):null;
    if(prior&&await verifyPassword(normalized,prior.passwordHash)) throw new AuthError(400,'password_policy','Choose a different password from the temporary password.');
    const passwordHash=await hashPassword(normalized); // Never hold MySQL locks during a KDF.
    const result=await store.transaction(async tx=>{
      let {account,flow}=await lockFlow(tx,snapshot,hash); const now=clock();
      if(!flowValid(flow,now)||!flow.verifiedAt||!['set_password','change_password'].includes(flow.stage)) return failure();
      if(flow.purpose==='enroll') {
        if(account||flow.stage!=='set_password'||!await invitation(flow.email,flow,tx)) { await tx.deleteFlow(hash); return failure(); }
        account={id:randomUUID(),userId:`local:${randomUUID()}`,email:flow.email,name:flow.email.split('@')[0].slice(0,120),passwordHash,mustChangePassword:false,temporaryExpiresAt:null,enabled:true,passwordVersion:1,createdAt:now,updatedAt:now};
        await tx.insertAccount(account); await audit(tx,'account.enrolled','success',{accountId:account.id,email:account.email,context});
      } else {
        if(!accountUsable(account,now)||!account.mustChangePassword||flow.stage!=='change_password'||Number(account.passwordVersion)!==Number(flow.accountVersion)||Number(account.passwordVersion)!==Number(prior?.passwordVersion)) return failure();
        account.passwordHash=passwordHash; account.mustChangePassword=false; account.temporaryExpiresAt=null; account.passwordVersion=Number(account.passwordVersion)+1; account.updatedAt=now; await tx.updateAccount(account);
        await tx.revokeSessions(account.id); await audit(tx,'password.initial_replaced','success',{accountId:account.id,email:account.email,context});
      }
      await tx.deleteFlowsForEmail(account.email);
      return {session:await issueSession(tx,account,now,context)};
    });
    checked(result); return completed(result.session);
  }
  async function sessionFor(request,{touch=true}={}) {
    const raw=cookieValue(request,AUTH_COOKIES.session),hash=raw?tokenHash(raw):null;
    const snapshot=hash?await store.readSession(hash):null;
    if(!snapshot) return null;
    return store.transaction(async tx=>{
      const account=await tx.accountById(snapshot.accountId),session=await tx.sessionByHash(hash),now=clock();
      if(!session||!account?.enabled||account.mustChangePassword||Number(account.passwordVersion)!==Number(session.passwordVersion)||Number(session.absoluteExpiresAt)<=now||Number(session.lastSeenAt)+AUTH_POLICY.idleSessionMs<=now) { if(session) await tx.deleteSession(hash); return null; }
      if(touch&&now-Number(session.lastSeenAt)>=60000) await tx.touchSession(hash,now);
      return {account,session,hash};
    });
  }
  async function status(request) {
    const current=await sessionFor(request);
    if(current) return json({authenticated:true,step:'complete',email:current.account.email,name:current.account.name,canChangePassword:true,smsEnabled:false});
    const raw=cookieValue(request,AUTH_COOKIES.pending),flow=raw?await store.readFlow(tokenHash(raw)):null;
    if(flowValid(flow,clock())&&flow.delivered) return json({authenticated:false,step:flow.stage,maskedEmail:maskedEmail(flow.email),expiresAt:iso(flow.expiresAt),resendAfter:iso(flow.resendAt),smsEnabled:false});
    return json({authenticated:false,step:'password',smsEnabled:false},200,clearCookies());
  }
  async function logout(request,context) {
    const current=await sessionFor(request,{touch:false});
    const pending=cookieValue(request,AUTH_COOKIES.pending);
    await store.transaction(async tx=>{
      if(current) {
        const account=await tx.accountById(current.account.id),session=await tx.sessionByHash(current.hash);
        if(account&&session&&Number(account.passwordVersion)===Number(current.account.passwordVersion)&&Number(session.passwordVersion)===Number(account.passwordVersion)) { await tx.revokeSessions(account.id); await tx.deleteFlowsForAccount(account.id); await audit(tx,'session.logout_all','success',{accountId:account.id,email:account.email,context}); }
      }
      if(pending) await tx.deleteFlow(tokenHash(pending));
    });
    return json({ok:true,authenticated:false,step:'password'},200,clearCookies());
  }
  async function changePassword(request,input,context) {
    const current=await sessionFor(request,{touch:false});
    if(!current) throw new AuthError(401,'sign_in_required','Sign in again before changing your password.');
    await throttle('change',current.account.email,context);
    if(typeof input.currentPassword!=='string'||!await verifyPassword(input.currentPassword,current.account.passwordHash)) { await store.transaction(tx=>audit(tx,'password.change','failure',{accountId:current.account.id,email:current.account.email,context,detail:'invalid_credentials'})); throw new AuthError(401,'invalid_credentials','The password could not be changed. Check your details and try again.'); }
    let normalized;
    try { normalized=validateNewPassword(input.newPassword); } catch(error) { throw new AuthError(400,'password_policy',error.message); }
    if(await verifyPassword(normalized,current.account.passwordHash)) throw new AuthError(400,'password_policy','Choose a different new password.');
    const passwordHash=await hashPassword(normalized);
    const result=await store.transaction(async tx=>{
      const account=await tx.accountById(current.account.id),session=await tx.sessionByHash(current.hash),now=clock();
      if(!account?.enabled||!session||Number(account.passwordVersion)!==Number(current.account.passwordVersion)||Number(session.absoluteExpiresAt)<=now||Number(session.lastSeenAt)+AUTH_POLICY.idleSessionMs<=now) return failure(401,'sign_in_required','Sign in again before changing your password.');
      account.passwordHash=passwordHash; account.passwordVersion=Number(account.passwordVersion)+1; account.mustChangePassword=false; account.temporaryExpiresAt=null; account.updatedAt=now; await tx.updateAccount(account); await tx.revokeSessions(account.id); await tx.deleteFlowsForAccount(account.id); await audit(tx,'password.changed','success',{accountId:account.id,email:account.email,context}); return {ok:true};
    });
    checked(result); return json({ok:true,authenticated:false,step:'password'},200,clearCookies());
  }
  async function handle(request,context={}) {
    const pathname=new URL(request.url).pathname;
    if(!pathname.startsWith('/api/auth/')) return null;
    const endpoint=pathname.slice('/api/auth/'.length);
    try {
      if(!ENDPOINTS.has(endpoint)) throw new AuthError(404,'not_found','This authentication endpoint does not exist.');
      if(endpoint==='status') { if(request.method!=='GET') throw new AuthError(405,'method_not_allowed','This method is not allowed.'); requestBoundary(request); return await status(request); }
      if(request.method!=='POST') throw new AuthError(405,'method_not_allowed','This method is not allowed.');
      requestBoundary(request,true);
      const fields={login:['email','password'],enroll:['email'],verify:['code'],resend:[],password:['password'],logout:[],'change-password':['currentPassword','newPassword']};
      const input=await body(request,fields[endpoint]);
      if(endpoint==='login') return await login(request,input,context);
      if(endpoint==='enroll') return await enroll(request,input,context);
      if(endpoint==='verify') return await verify(request,input,context);
      if(endpoint==='resend') return await resend(request,context);
      if(endpoint==='password') return await setPassword(request,input,context);
      if(endpoint==='logout') return await logout(request,context);
      return await changePassword(request,input,context);
    } catch(error) {
      if(error instanceof AuthError) return json({error:error.message,code:error.code},error.status,[],error.retryAfter);
      if(error?.code==='AUTH_KDF_BUSY') return json({error:'Authentication is busy. Please try again shortly.',code:'authentication_busy'},503,[],5);
      // Do not return or log provider, SQL, password, code or token details.
      return json({error:'Authentication is temporarily unavailable. Please try again later.',code:'authentication_unavailable'},503);
    }
  }
  async function getIdentity(request) {
    // Passive session resolution also runs for normal links from search/email.
    // Only explicit auth reads use the stricter Fetch Metadata policy above.
    if(['GET','HEAD'].includes(request.method)) {
      if(new URL(request.url).origin!==origin) throw new AuthError(403,'origin_rejected','This request is not allowed.');
    } else requestBoundary(request,true);
    const current=await sessionFor(request);
    return current?{userId:current.account.userId,email:current.account.email,name:current.account.name}:null;
  }
  async function createOwner(email,password,{temporary=true,name='Workspace owner',userId,replace=false}={}) {
    email=normalizeEmail(email);
    if(email!==ownerEmail) throw new Error('Owner provisioning is restricted to the configured owner email.');
    if(typeof name!=='string'||!name.trim()||name.length>120) throw new Error('Owner name must contain 1 to 120 characters.');
    if(userId!==undefined&&(typeof userId!=='string'||!userId||userId.length>191||/[\u0000-\u001f\u007f]/.test(userId))) throw new Error('The reviewed identity mapping is invalid.');
    const passwordHash=await (temporary?hashTemporaryPassword(password):hashPassword(password));
    return store.transaction(async tx=>{
      let account=await tx.accountByEmail(email); const now=clock(),created=!account;
      if(account&&!replace) throw new Error('The owner account already exists. Explicit offline recovery is required to replace its password.');
      if(account&&userId&&userId!==account.userId) throw new Error('Offline recovery cannot change the existing owner identity.');
      if(account) { account.passwordHash=passwordHash; account.mustChangePassword=!!temporary; account.temporaryExpiresAt=temporary?now+AUTH_POLICY.temporaryPasswordMs:null; account.passwordVersion=Number(account.passwordVersion)+1; account.enabled=true; account.updatedAt=now; account.name=name.trim(); await tx.updateAccount(account); await tx.revokeSessions(account.id); await tx.deleteFlowsForAccount(account.id); }
      else { account={id:randomUUID(),email,userId:userId||`local:${randomUUID()}`,name:name.trim(),passwordHash,mustChangePassword:!!temporary,temporaryExpiresAt:temporary?now+AUTH_POLICY.temporaryPasswordMs:null,enabled:true,passwordVersion:1,createdAt:now,updatedAt:now}; await tx.insertAccount(account); }
      await audit(tx,created?'owner.provisioned':'owner.recovered','success',{accountId:account.id,email,detail:'offline_operator'});
      return {created,email:account.email,userId:account.userId,mustChangePassword:!!account.mustChangePassword};
    });
  }
  return Object.freeze({handle,getIdentity,createOwner,cleanup:()=>store.cleanup(clock(),eventRetentionDays*86400000),close:async()=>{}});
}
