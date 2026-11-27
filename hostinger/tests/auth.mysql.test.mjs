import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createAuthService, initializeAuthSchema, AUTH_COOKIES, AUTH_POLICY } from '../auth/index.mjs';

const database=process.env.NW_AUTH_TEST_DB_NAME;

test('real MySQL: gated login, OTP consumption, enrollment and owner-revocation row lock',{
  skip:!database?'Set dedicated NW_AUTH_TEST_DB_* variables to run the real MySQL integration test.':false,
  timeout:60000,
},async t=>{
  assert.equal(database,'northwall_test_auth_ci','Refusing any database except the dedicated auth CI database.');
  const host=process.env.NW_AUTH_TEST_DB_HOST||'127.0.0.1';
  assert.ok(['127.0.0.1','localhost'].includes(host),'Refusing a non-local database host.');
  const user=process.env.NW_AUTH_TEST_DB_USER,password=process.env.NW_AUTH_TEST_DB_PASSWORD;
  assert.ok(user&&password,'Dedicated test database credentials must be explicitly provided.');
  const {createPool}=await import('mysql2/promise');
  const pool=createPool({host,port:Number(process.env.NW_AUTH_TEST_DB_PORT||3306),user,password,database,connectionLimit:5,multipleStatements:false});
  const origin='https://mysql-auth.example.test',owner='owner@mysql-auth.example.test';
  const temporary='Qx6!mR8?',replacement='Synthetic MySQL replacement credential 865';
  let now=Date.now(),waitForLock=false,notifyLock;
  const mail=[],resetMail=[],lockChecks=[];
  let lockedConnection;
  try {
    const [existing]=await pool.execute('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=?',[database]);
    assert.equal(existing.length,0,'Refusing to operate on a non-empty database. No tables are dropped or reset.');
    await initializeAuthSchema(pool);
    await pool.execute('CREATE TABLE nw_auth_test_invitations (email VARCHAR(254) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY, member_id VARCHAR(100) NOT NULL, invitation_id VARCHAR(100) NOT NULL, status VARCHAR(20) NOT NULL, expires_at BIGINT UNSIGNED NOT NULL, identity_anchor VARCHAR(191) NULL) ENGINE=InnoDB');
    const service=createAuthService({pool,origin,secret:randomBytes(32).toString('hex'),ownerEmail:owner,clock:()=>now,minResetResponseMs:0,sendCode:async message=>{mail.push({...message});},sendReset:async message=>{resetMail.push({...message});},getInvitation:async(email,context)=>{
      const connection=context?.connection||pool;
      lockChecks.push({email,lock:!!context?.lock,samePoolConnection:!!context?.connection});
      if(waitForLock&&context?.lock&&email==='race@mysql-auth.example.test')notifyLock?.();
      const [rows]=await connection.execute(`SELECT member_id AS memberId,invitation_id AS invitationId,status,expires_at AS expiresAt,identity_anchor AS identityAnchorUserId FROM nw_auth_test_invitations WHERE email=?${context?.lock?' FOR UPDATE':''}`,[email]);
      return rows[0]||null;
    }});
    const makeClient=()=>({cookies:new Map()});
    const cookieHeader=client=>[...client.cookies].map(([key,value])=>`${key}=${value}`).join('; ');
    async function call(client,endpoint,input){
      const response=await service.handle(new Request(`${origin}/api/auth/${endpoint}`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookieHeader(client)},body:JSON.stringify(input)}),{clientIp:'198.51.100.51'});
      for(const value of response.headers.getSetCookie()){const part=value.split(';')[0],index=part.indexOf('='),key=part.slice(0,index),raw=part.slice(index+1);if(raw)client.cookies.set(key,raw);else client.cookies.delete(key);}
      return{status:response.status,data:await response.json()};
    }
    const identity=client=>service.getIdentity(new Request(`${origin}/workspace`,{headers:{Cookie:cookieHeader(client)}}));
    const invite=async(email,id)=>pool.execute('INSERT INTO nw_auth_test_invitations(email,member_id,invitation_id,status,expires_at,identity_anchor) VALUES(?,?,?,?,?,NULL)',[email,`member-${id}`,`invitation-${id}`,'invited',now+7*86400000]);

    await t.test('owner password, OTP and forced replacement all precede identity',async()=>{
      await service.createOwner(owner,temporary,{temporary:true,userId:'reviewed-mysql-owner-id'});
      const client=makeClient();
      assert.equal((await call(client,'login',{email:owner,password:temporary})).data.step,'verify_email');
      assert.equal(await identity(client),null);
      assert.equal((await call(client,'verify',{code:mail.at(-1).code})).data.step,'change_password');
      assert.equal(await identity(client),null);
      assert.equal((await call(client,'password',{password:replacement})).data.step,'complete');
      assert.equal((await identity(client)).userId,'reviewed-mysql-owner-id');
      const [rows]=await pool.execute('SELECT must_change_password,temporary_expires_at FROM nw_auth_accounts WHERE email=?',[owner]);
      assert.equal(Number(rows[0].must_change_password),0);assert.equal(rows[0].temporary_expires_at,null);
    });

    await t.test('concurrent SQL transactions consume a code once and reject replay',async()=>{
      const first=makeClient();await call(first,'login',{email:owner,password:replacement});
      const second=makeClient();second.cookies=new Map(first.cookies);const stale=makeClient();stale.cookies=new Map(first.cookies);
      const code=mail.at(-1).code;
      const results=await Promise.all([call(first,'verify',{code}),call(second,'verify',{code})]);
      assert.deepEqual(results.map(r=>r.status).sort(),[200,400]);
      assert.equal((await call(stale,'verify',{code})).status,400);
    });

    await t.test('server expiry rejects a still-known code',async()=>{
      const client=makeClient();await call(client,'login',{email:owner,password:replacement});const code=mail.at(-1).code;
      now+=AUTH_POLICY.codeTtlMs;
      assert.equal((await call(client,'verify',{code})).status,400);assert.equal(await identity(client),null);
      now+=900000;
    });

    await t.test('fresh invitee creates a new identity only after locked invitation recheck',async()=>{
      const email='fresh@mysql-auth.example.test';await invite(email,'fresh');const client=makeClient();
      assert.equal((await call(client,'enroll',{email})).status,200);
      assert.equal((await call(client,'verify',{code:mail.at(-1).code})).data.step,'set_password');assert.equal(await identity(client),null);
      assert.equal((await call(client,'password',{password:'Synthetic MySQL employee credential 239'})).data.step,'complete');
      assert.equal((await identity(client)).email,email);
      assert.ok(lockChecks.filter(check=>check.email===email&&check.lock&&check.samePoolConnection).length>=2);
      const [rows]=await pool.execute('SELECT status FROM nw_auth_test_invitations WHERE email=?',[email]);assert.equal(rows[0].status,'invited');
    });

    await t.test('owner revocation wins while final enrollment waits on the invitation row lock',async()=>{
      const email='race@mysql-auth.example.test';await invite(email,'race');const client=makeClient();
      await call(client,'enroll',{email});await call(client,'verify',{code:mail.at(-1).code});
      lockedConnection=await pool.getConnection();await lockedConnection.beginTransaction();
      await lockedConnection.execute('SELECT email FROM nw_auth_test_invitations WHERE email=? FOR UPDATE',[email]);
      await lockedConnection.execute('UPDATE nw_auth_test_invitations SET status=? WHERE email=?',['revoked',email]);
      const reached=new Promise(resolve=>{notifyLock=resolve;});waitForLock=true;
      const choosing=call(client,'password',{password:'Synthetic MySQL rejected credential 957'});
      let timeout;
      try {
        await Promise.race([reached,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('Enrollment did not reach the locked invitation check.')),10000);})]);
        await lockedConnection.commit();lockedConnection.release();lockedConnection=null;
        const result=await choosing;assert.equal(result.status,400);assert.equal(await identity(client),null);
        const [accounts]=await pool.execute('SELECT id FROM nw_auth_accounts WHERE email=?',[email]);assert.equal(accounts.length,0);
      } finally {
        clearTimeout(timeout);waitForLock=false;
        if(lockedConnection){await lockedConnection.rollback();lockedConnection.release();lockedConnection=null;}
        await choosing.catch(()=>{});
      }
    });

    await t.test('real MySQL reset link is hashed, single-use, and revokes the old owner session',async()=>{
      const ownerClient=makeClient();
      await call(ownerClient,'login',{email:owner,password:replacement});
      await call(ownerClient,'verify',{code:mail.at(-1).code});
      assert.equal((await identity(ownerClient)).email,owner);
      assert.equal((await call(ownerClient,'forgot',{email:owner})).status,200);
      const link=new URL(resetMail.at(-1).url),token=link.searchParams.get('token');
      assert.equal(link.origin,origin);
      const [stored]=await pool.execute('SELECT token_hash FROM nw_auth_resets');
      assert.equal(stored.length,1);assert.notEqual(stored[0].token_hash,token);
      assert.equal((await call(ownerClient,'reset',{token,password:'Dedicated MySQL reset password number 2026'})).status,200);
      assert.equal(await identity(ownerClient),null);
      assert.equal((await call(ownerClient,'reset',{token,password:'Different password for replay should fail 2026'})).status,400);
      const [remaining]=await pool.execute('SELECT token_hash FROM nw_auth_resets');assert.equal(remaining.length,0);
      const fresh=makeClient();assert.equal((await call(fresh,'login',{email:owner,password:'Dedicated MySQL reset password number 2026'})).data.step,'verify_email');
      assert.equal(await identity(fresh),null);
    });

    const [engines]=await pool.execute('SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=?',[database]);
    assert.ok(engines.every(row=>row.ENGINE==='InnoDB'));
    const [events]=await pool.execute('SELECT detail FROM nw_auth_events');
    assert.ok(events.length>0);assert.ok(events.every(row=>row.detail.length<=200));
  } finally {
    if(lockedConnection){await lockedConnection.rollback();lockedConnection.release();}
    await pool.end();
  }
});
