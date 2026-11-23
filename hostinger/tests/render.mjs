import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { AsyncLocalStorage } from 'node:async_hooks';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import next from 'next';
import { applyResponseSecurity,rendererHeaders } from '../http.mjs';

// Isolated loopback fixture for actual Next SSR/request-origin integration.
// It has no production database, user session, mailbox or external identity.
test('built Next app preserves nonce policy, body bytes and canonical HTTPS API origin',async()=>{
  const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
  const appDirectory=resolve(root,'.hostinger-app');
  const build=JSON.parse(await readFile(resolve(appDirectory,'hostinger-build.json'),'utf8'));
  const origin=build.origin;
  const {requestSecurity}=await import(pathToFileURL(resolve(appDirectory,'hostinger/security-controls.mjs')).href);
  let databaseTouched=false;
  const identityContext=new AsyncLocalStorage();
  globalThis[Symbol.for('northwalleg.hostinger.runtime')]={identityContext,ADMIN_EMAILS:'render-fixture@example.test',DB:{prepare(){databaseTouched=true;throw new Error('This render fixture must stop before database access.');}}};
  const app=next({dev:false,dir:appDirectory,hostname:new URL(origin).hostname,port:443});await app.prepare();
  const handler=app.getRequestHandler();
  const server=http.createServer(async(req,res)=>{
    const security=requestSecurity(new Request(new URL(req.url,origin)),true);
    applyResponseSecurity(res,new URL(req.url,origin).pathname,security.csp,{publicLaunch:false});
    const identity=new URL(req.url,origin).searchParams.get('fixture')==='anonymous'?null:{userId:'render-fixture-only',email:'render-fixture@example.test',name:'Render fixture'};
    req.headers=rendererHeaders(req.headers,origin,identity,security.nonce,security.csp);
    if(!identity){req.headers['oai-authenticated-user-id']='forged-owner';req.headers['oai-authenticated-user-email']='render-fixture@example.test';}
    req.rawHeaders=Object.entries(req.headers).flatMap(([key,value])=>[key,String(value)]);
    try{await identityContext.run({identity},()=>handler(req,res));}catch{res.statusCode=500;res.end('Render fixture failed.');}
  });server.listen(0,'127.0.0.1');await once(server,'listening');
  try{
    const base=`http://127.0.0.1:${server.address().port}`;
    const response=await fetch(base+'/sign-in');assert.equal(response.status,200);
    const csp=response.headers.get('content-security-policy'),nonce=/nonce-([a-f0-9]{48})/.exec(csp)?.[1];assert.ok(nonce);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');
    const html=await response.text();assert.match(html,/Welcome to your workspace/);
    const scripts=[...html.matchAll(/<script\b([^>]*)>/gi)];assert.ok(scripts.length>=3);
    for(const script of scripts)assert.match(script[1],new RegExp(`nonce="${nonce}"`),'Every framework and authored script uses the request nonce.');
    const second=await fetch(base+'/sign-in');assert.notEqual(second.headers.get('content-security-policy'),csp);await second.text();
    const correct=await fetch(base+'/api/workspace',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,'Sec-Fetch-Site':'same-origin'},body:JSON.stringify({action:'',payload:{},revision:0})});
    assert.equal(correct.status,400);assert.equal((await correct.json()).code,'invalid_input','Body and public HTTPS origin reached the actual workspace validator.');
    const cross=await fetch(base+'/api/workspace',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://other.example.test','Sec-Fetch-Site':'cross-site'},body:JSON.stringify({action:'',payload:{}})});
    assert.equal(cross.status,403);assert.equal((await cross.json()).code,'origin_rejected');
    const forged=await fetch(base+'/api/workspace?fixture=anonymous');assert.equal(forged.status,401);assert.equal((await forged.json()).code,'sign_in_required');assert.equal(databaseTouched,false);
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await app.close();delete globalThis[Symbol.for('northwalleg.hostinger.runtime')];}
});
