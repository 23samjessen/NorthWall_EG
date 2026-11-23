import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Readable } from 'node:stream';
import { once } from 'node:events';
import { incomingUrl, rendererHeaders, safeReturnPath, publicBeforeLaunch, trustedClientIp, applyResponseSecurity, toWebRequest } from '../http.mjs';
import { readConfig } from '../config.mjs';

const origin='https://northwall.test';
const configuration={APP_ORIGIN:origin,EDGE_HTTPS_CONFIRMED:'true',AUTH_SECRET:'a'.repeat(64),OWNER_EMAIL:'owner@example.test',DB_USER:'fixture',DB_NAME:'fixture',DB_PASSWORD:'fixture-only',SMTP_HOST:'smtp.example.test',SMTP_USER:'sender@example.test',SMTP_PASSWORD:'fixture-only'};
test('Destination configuration fails closed without canonical HTTPS, edge confirmation, database, mail and random-secret format',()=>{
  const good=readConfig(configuration);assert.equal(good.publicLaunch,false);assert.equal(good.database.multipleStatements,false);assert.equal(good.smtp.tls.rejectUnauthorized,true);assert.equal(good.smtp.requireTLS,true);
  for(const change of [{APP_ORIGIN:'http://northwall.test'},{APP_ORIGIN:'https://evil:secret@northwall.test/'},{APP_ORIGIN:'https://northwall.test/path'},{EDGE_HTTPS_CONFIRMED:'false'},{AUTH_SECRET:'short'},{DB_PASSWORD:''},{SMTP_PASSWORD:''},{SMTP_PORT:'25'},{DB_HOST:'db.example.test'}])assert.throws(()=>readConfig({...configuration,...change}));
});
test('Request URL and return paths cannot change origin or smuggle encoded routing separators',()=>{
  for(const value of ['https://evil.test/','//evil.test/','/\\evil.test/','/api%2fauth/status','/%5cfoo','/bad\npath'])assert.equal(incomingUrl(value,origin),null);
  assert.equal(incomingUrl('/a/../workspace?tab=team',origin).href,origin+'/workspace?tab=team');
  for(const value of ['//evil.test','https://evil.test','/\\evil.test','/api/auth/logout','/sign-in'])assert.equal(safeReturnPath(value),'/workspace');
  assert.equal(safeReturnPath('/workspace?tab=team'),'/workspace?tab=team');
});
test('Renderer identity and nonce exclusively come from verified server values',()=>{
  const forged={'oai-authenticated-user-id':'attacker','OAI-Authenticated-User-Email':'owner@example.test','x-middleware-subrequest':'middleware','x-nextjs-data':'1','x-forwarded-proto':'http','x-forwarded-host':'evil.test',forwarded:'host=evil','cf-ray':'forged-evidence','x-northwall-script-nonce':'attacker','content-security-policy':"script-src *",cookie:'safe-cookie','user-agent':'fixture',host:'evil.test'};
  const anonymous=rendererHeaders(forged,origin,null,'fresh','safe-csp');assert.equal(anonymous['oai-authenticated-user-id'],undefined);assert.equal(anonymous['oai-authenticated-user-email'],undefined);assert.equal(anonymous['cf-ray'],undefined);assert.equal(anonymous['x-middleware-subrequest'],undefined);assert.equal(anonymous['x-nextjs-data'],undefined);assert.equal(anonymous.host,'northwall.test');assert.equal(anonymous['x-forwarded-proto'],'https');assert.equal(anonymous['x-northwall-script-nonce'],'fresh');assert.equal(anonymous['content-security-policy'],'safe-csp');assert.equal(anonymous.cookie,'safe-cookie');
  const verified=rendererHeaders(forged,origin,{userId:'verified-1',email:'employee@example.test',name:'Employee Æ'},'fresh','safe-csp');assert.equal(verified['oai-authenticated-user-id'],'verified-1');assert.equal(decodeURIComponent(verified['oai-authenticated-user-full-name']),'Employee Æ');
});
test('Prelaunch access allows only sign-in, gated employee paths and essential public assets',()=>{
  for(const path of ['/','/insights','/api/news','/.env','/hostinger/config.mjs','/_next/server/app.js'])assert.equal(publicBeforeLaunch(path),false);
  for(const path of ['/sign-in','/api/auth/status','/workspace','/api/workspace','/api/profile-photo','/_next/static/chunk.js'])assert.equal(publicBeforeLaunch(path),true);
  assert.equal(trustedClientIp({remoteAddress:'127.0.0.1'}),'127.0.0.1');assert.equal(trustedClientIp({}),'unknown-upstream');
});
test('Headers-only session checks leave the Node request body for Next.js',async()=>{
  const request=Readable.from(['{"action":"ticket.create"}']);request.method='POST';request.headers={'content-type':'application/json',cookie:'fixture'};
  const inspected=toWebRequest(request,origin+'/api/workspace',false);assert.equal(inspected.body,null);await new Promise(resolve=>setImmediate(resolve));let received='';for await(const part of request)received+=part;assert.equal(received,'{"action":"ticket.create"}');
});
test('Auth requests have exactly one body consumer',async()=>{
  const request=Readable.from([Buffer.from('{"code":"123456"}')]);request.method='POST';request.headers={'content-type':'application/json'};
  const body=toWebRequest(request,origin+'/api/auth/verify',true);assert.deepEqual(await body.json(),{code:'123456'});
});
test('Final HTTP headers cannot override no-store, nonce policy or noindex through writeHead',async()=>{
  const server=http.createServer((request,response)=>{
    applyResponseSecurity(response,request.url,'trusted-policy',{publicLaunch:true});
    response.setHeader('Vary','RSC');
    if(request.url==='/api/profile-photo')response.writeHead(200,{'Content-Type':'image/png','Content-Security-Policy':"default-src 'none'; sandbox"});
    else if(request.url==='/error')response.writeHead(503,'Unavailable',{'Cache-Control':'public,max-age=3600',ETag:'stale'});
    else response.writeHead(200,{'Content-Type':'text/html','Cache-Control':'public,max-age=3600',ETag:'stale','Content-Security-Policy':'unsafe-policy','X-Powered-By':'fixture','X-Robots-Tag':'index, follow'});
    response.end('fixture');
  });server.listen(0,'127.0.0.1');await once(server,'listening');
  try{const address=`http://127.0.0.1:${server.address().port}`;
    for(const path of ['/sign-in','/workspace','/error']){const response=await fetch(address+path);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('etag'),null);assert.equal(response.headers.get('content-security-policy'),'trusted-policy');assert.equal(response.headers.get('x-powered-by'),null);assert.match(response.headers.get('vary'),/Cookie/);if(path!=='/error')assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');}
    const photo=await fetch(address+'/api/profile-photo');assert.equal(photo.headers.get('content-security-policy'),"default-src 'none'; sandbox");assert.equal(photo.headers.get('cache-control'),'private, no-store');
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
