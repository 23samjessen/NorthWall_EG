import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { createAuthService, AUTH_COOKIES, AUTH_POLICY, hashPassword, verifyPassword } from '../auth/index.mjs';
import { MemoryAuthStore } from './auth-store.mjs';

const ORIGIN='https://auth.example.test';
const OWNER='owner@example.test';
const FIXTURE_PASSWORD='Synthetic owner credential for isolated tests 734';
const NEW_PASSWORD='Different synthetic credential for isolated tests 982';
const EMPLOYEE_PASSWORD='Synthetic employee credential for isolated tests 625';
const sharedHash=hashPassword(FIXTURE_PASSWORD);
const digest=value=>createHash('sha256').update(value).digest('hex');

async function fixture({temporary=false,deliveryFails=false,seedOwner=true}={}) {
  const store=new MemoryAuthStore(),mail=[],invitations=new Map(),lookupCalls=[];
  let now=Date.parse('2035-01-01T10:00:00Z');
  const secret=randomBytes(32).toString('hex');
  if(seedOwner)store.data.accounts.set('owner-account',{id:'owner-account',userId:'reviewed-owner-fixture-id',email:OWNER,name:'Synthetic owner',passwordHash:await sharedHash,mustChangePassword:temporary,temporaryExpiresAt:temporary?now+AUTH_POLICY.temporaryPasswordMs:null,enabled:true,passwordVersion:1,createdAt:now,updatedAt:now});
  const options={store,origin:ORIGIN,secret,ownerEmail:OWNER,clock:()=>now,minResetResponseMs:0,sendCode:async message=>{if(deliveryFails)throw new Error('Synthetic transport failure');mail.push({...message});},getInvitation:async(email,context)=>{lookupCalls.push({email,lock:!!context?.lock,connection:!!context?.connection});return structuredClone(invitations.get(email)||null);}};
  const service=createAuthService(options);
  return{service,store,mail,invitations,lookupCalls,options,advance:ms=>{now+=ms;},time:()=>now,invite(email,extra={}){invitations.set(email,{memberId:`member-${email}`,invitationId:`invite-${email}`,status:'invited',expiresAt:new Date(now+7*86400000).toISOString(),identityAnchorUserId:null,...extra});}};
}
class Client {
  constructor(f,{service=f.service,context={clientIp:'198.51.100.22'}}={}){this.f=f;this.service=service;this.context=context;this.cookies=new Map();}
  cookieHeader(){return[...this.cookies].map(([name,value])=>`${name}=${value}`).join('; ');}
  async call(endpoint,input,options={}){
    const method=options.method||'POST';
    const headers=new Headers({cookie:this.cookieHeader(),...(method==='POST'?{'Content-Type':'application/json',Origin:ORIGIN}:{}),...options.headers});
    const request=new Request(`${ORIGIN}/api/auth/${endpoint}`,{method,headers,...(method==='POST'?{body:options.rawBody??JSON.stringify(input??{})}:{})});
    const response=await this.service.handle(request,this.context);
    for(const value of response.headers.getSetCookie()){const part=value.split(';')[0],at=part.indexOf('='),name=part.slice(0,at),raw=part.slice(at+1);if(!raw)this.cookies.delete(name);else this.cookies.set(name,raw);}
    return{response,status:response.status,data:await response.json()};
  }
  identity(headers={}){return this.service.getIdentity(new Request(`${ORIGIN}/workspace`,{headers:{cookie:this.cookieHeader(),...headers}}),this.context);}
  fork(){const next=new Client(this.f,{service:this.service,context:this.context});next.cookies=new Map(this.cookies);return next;}
}
async function loginToCode(f,client=new Client(f),password=FIXTURE_PASSWORD){const result=await client.call('login',{email:OWNER,password});assert.equal(result.status,200);assert.equal(result.data.step,'verify_email');return client;}
async function completeLogin(f,client=new Client(f),password=FIXTURE_PASSWORD){await loginToCode(f,client,password);const result=await client.call('verify',{code:f.mail.at(-1).code});assert.equal(result.status,200);assert.equal(result.data.step,'complete');return client;}

test('configuration requires HTTPS, a secret and a delivery provider',()=>{
  const base={store:new MemoryAuthStore(),origin:ORIGIN,secret:'x'.repeat(64),ownerEmail:OWNER,sendCode:async()=>{},getInvitation:async()=>null};
  assert.throws(()=>createAuthService({...base,origin:'http://auth.example.test'}),/HTTPS/);
  assert.throws(()=>createAuthService({...base,secret:'short'}),/AUTH_SECRET/);
  assert.throws(()=>createAuthService({...base,sendCode:undefined}),/Email delivery/);
});

test('scrypt hashes are salted, bounded-format records and verify actual passwords',async()=>{
  const first=await sharedHash,second=await hashPassword(FIXTURE_PASSWORD);
  assert.notEqual(first,second);assert.match(first,/^scrypt\$1\$131072\$8\$1\$/);
  assert.equal(await verifyPassword(FIXTURE_PASSWORD,first),true);
  assert.equal(await verifyPassword('Wrong synthetic credential 113',first),false);
  assert.equal(await verifyPassword(FIXTURE_PASSWORD,'malformed'),false);
});

test('password then email code is required before issuing any identity',async()=>{
  const f=await fixture(),c=await loginToCode(f);
  assert.equal(await c.identity(),null);assert.equal(c.cookies.has(AUTH_COOKIES.session),false);
  const result=await c.call('verify',{code:f.mail.at(-1).code});
  assert.equal(result.data.step,'complete');assert.equal((await c.identity()).email,OWNER);
  assert.equal(c.cookies.has(AUTH_COOKIES.pending),false);
});

test('temporary owner must replace password after OTP and cannot reuse it',async()=>{
  const f=await fixture({temporary:true}),c=await loginToCode(f);
  assert.equal((await c.call('password',{password:NEW_PASSWORD})).status,400);
  assert.equal((await c.call('verify',{code:f.mail.at(-1).code})).data.step,'change_password');
  assert.equal(await c.identity(),null);
  assert.equal((await c.call('password',{password:FIXTURE_PASSWORD})).status,400);
  const result=await c.call('password',{password:NEW_PASSWORD});assert.equal(result.data.step,'complete');
  assert.equal((await c.identity()).userId,'reviewed-owner-fixture-id');
  assert.equal((await f.store.readAccountByEmail(OWNER)).mustChangePassword,false);
  const other=new Client(f);assert.equal((await other.call('login',{email:OWNER,password:FIXTURE_PASSWORD})).status,401);
  assert.equal((await other.call('login',{email:OWNER,password:NEW_PASSWORD})).status,200);
});

test('uninvited enrollment sends no message and creates no account or identity',async()=>{
  const f=await fixture(),c=new Client(f),before=f.store.data.accounts.size;
  const result=await c.call('enroll',{email:'uninvited@example.test'});
  assert.equal(result.status,200);assert.equal(result.data.step,'verify_email');assert.equal(f.mail.length,0);
  assert.equal((await c.call('verify',{code:'123456'})).status,400);
  assert.equal((await c.call('password',{password:EMPLOYEE_PASSWORD})).status,400);
  assert.equal(f.store.data.accounts.size,before);assert.equal(await c.identity(),null);
});

test('invited enrollment requires OTP and locks the exact current invitation before account creation',async()=>{
  const f=await fixture(),c=new Client(f),email='invitee@example.test';f.invite(email);
  assert.equal((await c.call('enroll',{email:'  INVITEE@example.test  '})).status,200);
  assert.equal((await c.call('verify',{code:f.mail.at(-1).code})).data.step,'set_password');
  assert.equal(await c.identity(),null);assert.equal(await f.store.readAccountByEmail(email),null);
  assert.equal((await c.call('password',{password:EMPLOYEE_PASSWORD})).data.step,'complete');
  const identity=await c.identity();assert.equal(identity.email,email);assert.match(identity.userId,/^local:/);
  assert.equal(f.invitations.get(email).status,'invited'); // Workspace acceptance/approval remains separate.
  assert.ok(f.lookupCalls.filter(x=>x.lock&&x.connection).length>=2);
});

test('reissued invitation cannot be accepted by an earlier email-code flow',async()=>{
  const f=await fixture(),c=new Client(f),email='replace@example.test';f.invite(email);
  await c.call('enroll',{email});const code=f.mail.at(-1).code;
  f.invitations.get(email).invitationId='new-owner-invitation';
  assert.equal((await c.call('verify',{code})).status,400);
  assert.equal(await f.store.readAccountByEmail(email),null);assert.equal(await c.identity(),null);
});

test('revocation after OTP still prevents final password enrollment',async()=>{
  const f=await fixture(),c=new Client(f),email='revoke@example.test';f.invite(email);
  await c.call('enroll',{email});await c.call('verify',{code:f.mail.at(-1).code});
  f.invitations.get(email).status='revoked';
  assert.equal((await c.call('password',{password:EMPLOYEE_PASSWORD})).status,400);
  assert.equal(await f.store.readAccountByEmail(email),null);assert.equal(await c.identity(),null);
});

test('public enrollment cannot adopt an imported historical identity anchor',async()=>{
  const f=await fixture(),c=new Client(f),email='historical@example.test';f.invite(email,{identityAnchorUserId:'old-person-history'});
  assert.equal((await c.call('enroll',{email})).status,200);assert.equal(f.mail.length,0);
  assert.equal(await f.store.readAccountByEmail(email),null);
});

test('a missing identity-anchor field is not treated as permission for a new identity',async()=>{
  const f=await fixture(),c=new Client(f),email='unknown-anchor@example.test';f.invite(email);
  delete f.invitations.get(email).identityAnchorUserId;
  assert.equal((await c.call('enroll',{email})).status,200);assert.equal(f.mail.length,0);
  assert.equal(await f.store.readAccountByEmail(email),null);
});

test('five incorrect codes remain consumed across transactions and block a later correct code',async()=>{
  const f=await fixture(),c=await loginToCode(f),correct=f.mail.at(-1).code,wrong=correct==='000000'?'111111':'000000';
  for(let n=0;n<5;n++)assert.equal((await c.call('verify',{code:wrong})).status,400);
  assert.equal([...f.store.data.flows.values()][0].otpAttempts,5);
  assert.equal((await c.call('verify',{code:correct})).status,400);assert.equal(await c.identity(),null);
});

test('codes expire after five minutes using server time',async()=>{
  const f=await fixture(),c=await loginToCode(f),code=f.mail.at(-1).code;f.advance(AUTH_POLICY.codeTtlMs);
  assert.equal((await c.call('verify',{code})).status,400);assert.equal(await c.identity(),null);
});

test('resend enforces cooldown, rotates token/code and retains previous failure counts',async()=>{
  const f=await fixture(),c=await loginToCode(f),oldCode=f.mail.at(-1).code,oldCookie=c.cookies.get(AUTH_COOKIES.pending),stale=c.fork();
  assert.equal((await c.call('resend',{})).status,429);
  const wrong=oldCode==='000000'?'111111':'000000';await c.call('verify',{code:wrong});f.advance(60000);
  assert.equal((await c.call('resend',{})).status,200);
  const next=f.mail.at(-1).code;assert.notEqual(next,oldCode);assert.notEqual(c.cookies.get(AUTH_COOKIES.pending),oldCookie);
  assert.equal([...f.store.data.flows.values()][0].otpAttempts,1);
  assert.equal((await stale.call('verify',{code:next})).status,400);
  assert.equal((await c.call('verify',{code:oldCode})).status,400);
  assert.equal((await c.call('verify',{code:next})).data.step,'complete');
});

test('two concurrent verification requests cannot consume the same code twice',async()=>{
  const f=await fixture(),first=await loginToCode(f),second=first.fork(),code=f.mail.at(-1).code;
  const results=await Promise.all([first.call('verify',{code}),second.call('verify',{code})]);
  assert.deepEqual(results.map(x=>x.status).sort(),[200,400]);assert.equal(f.store.data.sessions.size,1);
});

test('a code cannot be used in another pending browser session',async()=>{
  const f=await fixture(),first=await loginToCode(f),code=f.mail.at(-1).code,second=new Client(f);
  assert.equal((await second.call('verify',{code})).status,400);
  assert.equal((await first.call('verify',{code})).data.step,'complete');
});

test('provider failure never leaves a usable OTP or full session',async()=>{
  const f=await fixture({deliveryFails:true}),c=new Client(f);
  assert.equal((await c.call('login',{email:OWNER,password:FIXTURE_PASSWORD})).status,503);
  assert.equal(f.store.data.flows.size,0);assert.equal(f.store.data.sessions.size,0);assert.equal(await c.identity(),null);
});

test('transaction failure cannot issue an authenticated session',async()=>{
  const f=await fixture(),c=await loginToCode(f),code=f.mail.at(-1).code;
  const original=f.store.transaction.bind(f.store);let count=0;
  f.store.transaction=async callback=>{count++;if(count===2)f.store.failNextCommit=true;return original(callback);};
  assert.equal((await c.call('verify',{code})).status,503);assert.equal(f.store.data.sessions.size,0);assert.equal(await c.identity(),null);
});

test('session cookies are host-only secure HttpOnly Lax and persisted tokens are hashes',async()=>{
  const f=await fixture(),c=await loginToCode(f),pending=c.cookies.get(AUTH_COOKIES.pending);
  assert.equal(pending.length,43);assert.ok(f.store.data.flows.has(digest(pending)));
  assert.notEqual([...f.store.data.flows.values()][0].otpMac,f.mail.at(-1).code);
  const result=await c.call('verify',{code:f.mail.at(-1).code});
  const value=result.response.headers.getSetCookie().find(x=>x.startsWith(`${AUTH_COOKIES.session}=`));
  assert.match(value,/Path=\/; HttpOnly; Secure; SameSite=Lax/);assert.doesNotMatch(value,/Domain=/);
  assert.ok(f.store.data.sessions.has(digest(c.cookies.get(AUTH_COOKIES.session))));
  assert.equal(JSON.stringify([...f.store.data.accounts.values()]).includes(FIXTURE_PASSWORD),false);
  for(const event of f.store.data.events)assert.deepEqual(Object.keys(event).sort(),['accountId','createdAt','detail','emailKey','event','id','ipKey','outcome'].sort());
});

test('idle and absolute session lifetimes are enforced on the server',async()=>{
  const f=await fixture(),c=await completeLogin(f);f.advance(AUTH_POLICY.idleSessionMs);
  assert.equal(await c.identity(),null);
  f.advance(900000);await completeLogin(f,c);
  for(let n=0;n<16;n++){f.advance(29*60000);assert.ok(await c.identity());}
  f.advance(17*60000);assert.equal(await c.identity(),null);
});

test('logout revokes all account sessions and pending login challenges',async()=>{
  const f=await fixture(),first=await completeLogin(f),second=await completeLogin(f,new Client(f)),pending=await loginToCode(f,new Client(f));
  assert.equal((await first.call('logout',{})).status,200);
  assert.equal(await second.identity(),null);assert.equal(f.store.data.sessions.size,0);assert.equal(f.store.data.flows.size,0);
  assert.equal((await pending.call('verify',{code:f.mail.at(-1).code})).status,400);
});

test('password change requires current password and revokes every session/challenge',async()=>{
  const f=await fixture(),first=await completeLogin(f),second=await completeLogin(f,new Client(f));
  assert.equal((await first.call('change-password',{currentPassword:'Wrong synthetic password 114',newPassword:NEW_PASSWORD})).status,401);
  const result=await first.call('change-password',{currentPassword:FIXTURE_PASSWORD,newPassword:NEW_PASSWORD});
  assert.equal(result.data.step,'password');assert.equal(await first.identity(),null);assert.equal(await second.identity(),null);
  assert.equal(await verifyPassword(NEW_PASSWORD,(await f.store.readAccountByEmail(OWNER)).passwordHash),true);
});

test('all writes reject cross-origin, missing Origin, non-JSON, overposting and oversized bodies',async()=>{
  const f=await fixture(),c=new Client(f);
  assert.equal((await c.call('login',{email:OWNER,password:FIXTURE_PASSWORD},{headers:{Origin:'https://evil.example.test'}})).status,403);
  assert.equal((await c.call('login',{email:OWNER,password:FIXTURE_PASSWORD},{headers:{Origin:''}})).status,403);
  assert.equal((await c.call('login',{email:OWNER,password:FIXTURE_PASSWORD},{headers:{'Content-Type':'text/plain'}})).status,415);
  assert.equal((await c.call('enroll',{email:'candidate@example.test',role:'admin'})).status,400);
  assert.equal((await c.call('login',{}, {rawBody:JSON.stringify({email:OWNER,password:'x'.repeat(20000)})})).status,413);
  assert.equal(f.mail.length,0);assert.equal(f.store.data.sessions.size,0);
});

test('status disallows cross-site reads but normal incoming page navigation can resolve a session',async()=>{
  const f=await fixture(),c=await completeLogin(f);
  assert.equal((await c.call('status',undefined,{method:'GET',headers:{'Sec-Fetch-Site':'cross-site'}})).status,403);
  assert.equal((await c.identity({'Sec-Fetch-Site':'cross-site','Sec-Fetch-Mode':'navigate'})).email,OWNER);
  const result=await c.call('status',undefined,{method:'GET'});assert.equal(result.data.email,OWNER);assert.equal(result.data.smsEnabled,false);
});

test('account rate limits persist across service instances',async()=>{
  const f=await fixture(),email='limited@example.test',first=new Client(f),second=new Client(f,{service:createAuthService(f.options),context:{clientIp:'203.0.113.77'}});
  for(let n=0;n<5;n++)assert.equal((await(n%2?first:second).call('enroll',{email})).status,200);
  assert.equal((await second.call('enroll',{email})).status,429);
});

test('forged forwarded-IP headers cannot bypass the shared untrusted-client bucket',async()=>{
  const f=await fixture(),c=new Client(f,{context:{}});
  for(let n=0;n<20;n++)assert.equal((await c.call('enroll',{email:`person${n}@example.test`},{headers:{'X-Forwarded-For':`203.0.113.${n+1}`,'CF-Connecting-IP':`203.0.113.${n+1}`}})).status,200);
  assert.equal((await c.call('enroll',{email:'person21@example.test'},{headers:{'X-Forwarded-For':'192.0.2.31'}})).status,429);
});

test('global send/request guard remains effective across many trusted IPs and emails',async()=>{
  const f=await fixture();
  for(let n=0;n<100;n++){const c=new Client(f,{context:{clientIp:`198.51.100.${n+1}`}});assert.equal((await c.call('enroll',{email:`global${n}@example.test`})).status,200);}
  const counts=()=>({limits:f.store.data.limits.size,flows:f.store.data.flows.size,events:f.store.data.events.length});
  const saturated=counts();
  for(let n=0;n<50;n++){const c=new Client(f,{context:{clientIp:`203.0.113.${n+1}`}});assert.equal((await c.call('enroll',{email:`blocked${n}@example.test`})).status,429);}
  assert.deepEqual(counts(),saturated);
});

test('owner provisioning is offline, restricted, temporary and preserves identity on explicit recovery',async()=>{
  const f=await fixture({seedOwner:false});
  await assert.rejects(f.service.createOwner('someone@example.test',FIXTURE_PASSWORD,{temporary:true}),/restricted/);
  const created=await f.service.createOwner(OWNER,FIXTURE_PASSWORD,{temporary:true,userId:'reviewed-import-owner-id'});
  assert.equal(created.mustChangePassword,true);assert.equal(created.userId,'reviewed-import-owner-id');
  assert.equal((await f.store.readAccountByEmail(OWNER)).temporaryExpiresAt,f.time()+AUTH_POLICY.temporaryPasswordMs);
  await assert.rejects(f.service.createOwner(OWNER,NEW_PASSWORD),/already exists/);
  await assert.rejects(f.service.createOwner(OWNER,NEW_PASSWORD,{replace:true,userId:'different-person'}),/cannot change/);
  f.advance(3600000);
  const reset=await f.service.createOwner(OWNER,NEW_PASSWORD,{replace:true,temporary:true});assert.equal(reset.userId,created.userId);assert.equal(reset.mustChangePassword,true);
  assert.equal((await f.store.readAccountByEmail(OWNER)).temporaryExpiresAt,f.time()+AUTH_POLICY.temporaryPasswordMs);
  assert.equal(f.mail.length,0);
});

test('only offline provisioning permits an eight-character temporary password',async()=>{
  const f=await fixture({seedOwner:false}),temporary='Fx7!tQ2?';
  await assert.rejects(hashPassword(temporary),/15 and 128/);
  await f.service.createOwner(OWNER,temporary,{temporary:true});
  const c=await loginToCode(f,new Client(f),temporary);
  assert.equal((await c.call('verify',{code:f.mail.at(-1).code})).data.step,'change_password');
  assert.equal((await c.call('password',{password:temporary})).status,400);assert.equal(await c.identity(),null);
  assert.equal((await c.call('password',{password:NEW_PASSWORD})).data.step,'complete');
  assert.equal((await f.store.readAccountByEmail(OWNER)).temporaryExpiresAt,null);
});

test('temporary expiry blocks login and a still-unexpired email code',async()=>{
  const f=await fixture({temporary:true});f.advance(AUTH_POLICY.temporaryPasswordMs-60000);
  const c=await loginToCode(f),code=f.mail.at(-1).code;f.advance(60000);
  assert.equal((await c.call('verify',{code})).status,400);assert.equal(await c.identity(),null);
  assert.equal((await new Client(f).call('login',{email:OWNER,password:FIXTURE_PASSWORD})).status,401);
});

test('temporary expiry after OTP blocks the final password replacement gate',async()=>{
  const f=await fixture({temporary:true});f.advance(AUTH_POLICY.temporaryPasswordMs-60000);
  const c=await loginToCode(f);assert.equal((await c.call('verify',{code:f.mail.at(-1).code})).data.step,'change_password');
  f.advance(60000);assert.equal((await c.call('password',{password:NEW_PASSWORD})).status,400);assert.equal(await c.identity(),null);
});

test('stale logout cannot revoke sessions created after offline password recovery',async()=>{
  const f=await fixture(),stale=await completeLogin(f),fresh=new Client(f);
  const original=f.store.transaction.bind(f.store);let calls=0;
  f.store.transaction=async callback=>{
    calls++;
    if(calls===2){
      await f.service.createOwner(OWNER,NEW_PASSWORD,{replace:true,temporary:false});
      await completeLogin(f,fresh,NEW_PASSWORD);
    }
    return original(callback);
  };
  assert.equal((await stale.call('logout',{})).status,200);
  assert.ok(await fresh.identity());assert.equal(f.store.data.sessions.size,1);
});

test('expired challenges and authentication evidence are removed by bounded maintenance',async()=>{
  const f=await fixture(),c=await loginToCode(f);assert.ok(f.store.data.flows.size);
  f.advance(31*86400000);await f.service.cleanup();assert.equal(f.store.data.flows.size,0);assert.equal(f.store.data.events.length,0);assert.equal(await c.identity(),null);
});

test('forgot password has uniform responses for known, missing and disabled accounts; tokens are hashed',async()=>{
  const f=await fixture(), client=new Client(f);
  const delivered=[];
  const service=createAuthService({...f.options,sendReset:async message=>delivered.push(message)});
  const c=new Client(f,{service});
  const absent=await c.call('forgot',{email:'nobody@example.test'});
  const known=await c.call('forgot',{email:OWNER});
  assert.equal(absent.status,200);assert.equal(known.status,200);
  assert.deepEqual(absent.data,known.data);
  assert.equal(delivered.length,1);assert.equal(delivered[0].to,OWNER);
  const sent=new URL(delivered[0].url);
  assert.equal(sent.origin,ORIGIN);assert.equal(sent.pathname,'/reset-password');
  const raw=sent.searchParams.get('token');assert.match(raw,/^[A-Za-z0-9_-]{43}$/);
  assert.equal(f.store.data.resets.size,1);
  assert.ok(f.store.data.resets.has(digest(raw)));
  assert.equal(JSON.stringify(f.store.data.resets).includes(raw),false);
  // Account status is never returned to the requester.
  const entry=f.store.data.accounts.get('owner-account');entry.enabled=false;
  assert.deepEqual((await c.call('forgot',{email:OWNER})).data,known.data);
  assert.equal(delivered.length,1);
  assert.equal(await client.identity(),null);
});

test('reset link changes password once, revokes sessions, and normal two-factor login is still required',async()=>{
  const f=await fixture(),mail=[];
  const service=createAuthService({...f.options,sendReset:async message=>mail.push(message)});
  const owner=new Client(f,{service});
  await loginToCode(f,owner);await owner.call('verify',{code:f.mail.at(-1).code});
  assert.equal((await owner.identity()).email,OWNER);
  const copied=owner.fork();
  assert.equal((await owner.call('forgot',{email:OWNER})).status,200);
  const raw=new URL(mail[0].url).searchParams.get('token');
  assert.equal((await owner.call('reset',{token:raw,password:NEW_PASSWORD})).status,200);
  assert.equal(await owner.identity(),null);assert.equal(await copied.identity(),null);
  assert.equal((await owner.call('reset',{token:raw,password:'Another new and distinct password from old 8'})).status,400);
  assert.equal(f.store.data.resets.size,0);
  const old=new Client(f,{service});assert.equal((await old.call('login',{email:OWNER,password:FIXTURE_PASSWORD})).status,401);
  const fresh=await old.call('login',{email:OWNER,password:NEW_PASSWORD});
  assert.equal(fresh.status,200);assert.equal(fresh.data.step,'verify_email');
  assert.equal(await old.identity(),null);
});

test('reset links expire; password policy, origin and token tampering are enforced',async()=>{
  const f=await fixture(),messages=[];
  const service=createAuthService({...f.options,sendReset:async message=>messages.push(message)});
  const c=new Client(f,{service});
  await c.call('forgot',{email:OWNER});
  const raw=new URL(messages.at(-1).url).searchParams.get('token');
  assert.equal((await c.call('reset',{token:raw,password:'short'})).status,400);
  assert.equal((await c.call('reset',{token:raw,password:FIXTURE_PASSWORD})).status,400);
  assert.equal((await c.call('reset',{token:'x'.repeat(43),password:NEW_PASSWORD})).status,400);
  assert.equal((await c.call('reset',{token:raw,password:NEW_PASSWORD},{headers:{Origin:'https://untrusted.example.test'}})).status,403);
  f.advance(AUTH_POLICY.resetTtlMs+1);
  assert.equal((await c.call('reset',{token:raw,password:NEW_PASSWORD})).status,400);
  assert.equal(await verifyPassword(FIXTURE_PASSWORD,(await f.store.readAccountByEmail(OWNER)).passwordHash),true);
});

test('failed email delivery keeps responses generic and destroys unusable reset token',async()=>{
  const f=await fixture(),service=createAuthService({...f.options,sendReset:async()=>{throw Error('Fake SMTP failure and credentials');}});
  const c=new Client(f,{service});
  const res=await c.call('forgot',{email:OWNER});
  assert.equal(res.status,200);
  assert.match(res.data.message,/If this address/);
  assert.equal(f.store.data.resets.size,0);
  assert.ok(f.store.data.events.some(e=>e.event==='password.reset.delivery'&&e.outcome==='failure'));
});

test('older reset link is superseded; replay and simultaneous submissions cannot succeed twice',async()=>{
  const f=await fixture(),mail=[];
  const service=createAuthService({...f.options,sendReset:async x=>mail.push(x)});
  const c=new Client(f,{service});
  await c.call('forgot',{email:OWNER});
  await c.call('forgot',{email:OWNER});
  const first=new URL(mail[0].url).searchParams.get('token');
  const last=new URL(mail[1].url).searchParams.get('token');
  assert.equal((await c.call('reset',{token:first,password:NEW_PASSWORD})).status,400);
  const results=await Promise.all([
    c.call('reset',{token:last,password:NEW_PASSWORD}),
    c.call('reset',{token:last,password:'Yet another valid password phrase for reset 1002'}),
  ]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,400]);
  assert.equal(f.store.data.resets.size,0);
});

test('reset links never carry account identifiers in the response and rate limits apply',async()=>{
 const f=await fixture(),messages=[];
 const service=createAuthService({...f.options,sendReset:async m=>messages.push(m)});
 const c=new Client(f,{service});
 for(let n=0;n<3;n++) assert.equal((await c.call('forgot',{email:OWNER})).status,200);
 const limited=await c.call('forgot',{email:OWNER});
 assert.equal(limited.status,429);assert.equal(messages.length,3);
 assert.doesNotMatch(JSON.stringify(limited.data),/owner@example.test|token|database|sql/i);
});
