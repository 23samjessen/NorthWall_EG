import http from 'node:http';
import { AsyncLocalStorage } from 'node:async_hooks';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import mysql from 'mysql2/promise';
import next from 'next';
import { readConfig } from './config.mjs';
import { createStorage, checkStorage } from './storage.mjs';
import { createAuthService, AuthError } from './auth/index.mjs';
import { createMail } from './mail.mjs';
import { incomingUrl, publicBeforeLaunch, rendererHeaders, safeReturnPath, trustedClientIp, requestLogId, toWebRequest, applyResponseSecurity } from './http.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const appDirectory=resolve(root,'.hostinger-app');
const config=readConfig();
const build=JSON.parse(await readFile(resolve(appDirectory,'hostinger-build.json'),'utf8'));
if (build.origin!==config.origin || build.publicLaunch!==config.publicLaunch) throw new Error('Origin/launch settings changed. Rebuild the Hostinger application before starting.');
const {requestSecurity,requestRejection}=await import(pathToFileURL(resolve(appDirectory,'hostinger/security-controls.mjs')).href);
const pool=mysql.createPool(config.database);
await checkStorage(pool);
const storage=createStorage(pool);
const identityContext=new AsyncLocalStorage();
globalThis[Symbol.for('northwalleg.hostinger.runtime')]={...storage,ADMIN_EMAILS:config.ownerEmail,identityContext};
const mail=createMail(config);
const getInvitation=async (email,context={})=>{
  const record=context.connection
    ? (await context.connection.execute('SELECT `id`,`payload`,`revision`,`last_hash`,`updated_at` FROM `workspace` WHERE `id` = ?'+(context.lock?' FOR UPDATE':''),['main']))[0][0]
    : await storage.DB.prepare('SELECT id,payload,revision,last_hash,updated_at FROM workspace WHERE id = ?').bind('main').first();
  if(!record)return null;
  const state=JSON.parse(record.payload);
  const candidates=state.users.filter(u=>u.id!=='owner'&&!u.sample&&u.email?.toLowerCase()===email&&u.onboarding?.status==='invited'&&u.onboarding.invitedBy==='owner'&&!u.active&&!u.userId);
  if(candidates.length!==1)return null;
  const member=candidates[0];
  const anchor=member.onboarding.identityAnchorUserId;
  if(anchor!==null && (typeof anchor!=='string'||!anchor))return null;
  return {memberId:member.id,invitationId:member.onboarding.invitationId,expiresAt:member.onboarding.expiresAt,status:'invited',identityAnchorUserId:anchor};
};
const auth=createAuthService({pool,origin:config.origin,secret:config.secret,ownerEmail:config.ownerEmail,sendCode:mail.sendCode,sendReset:mail.sendPasswordReset,getInvitation});
await auth.cleanup();
// Next constructs app-route Request.url from this public port. The separate HTTP
// listener below uses Hostinger's internal port3000 behind its TLS terminator.
const app=next({dev:false,dir:appDirectory,hostname:new URL(config.origin).hostname,port:443});
await app.prepare();
const handle=app.getRequestHandler();

async function send(response,result,method){
  response.statusCode=result.status;
  for(const [name,value] of result.headers){if(name!=='set-cookie')response.setHeader(name,value);}
  const cookies=result.headers.getSetCookie();if(cookies.length)response.setHeader('Set-Cookie',cookies);
  if(method==='HEAD'||!result.body){response.end();return;}
  for await(const chunk of result.body){if(!response.write(chunk))await new Promise(resolve=>response.once('drain',resolve));}
  response.end();
}
const server=http.createServer({maxHeaderSize:16384,requestTimeout:30000,headersTimeout:15000},async(request,response)=>{
  const url=incomingUrl(request.url,config.origin);
  const host=String(request.headers.host||'').toLowerCase();
  if(!url||!config.allowedHosts.has(host)){
    response.writeHead(400,{'Content-Type':'text/plain','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});response.end('Invalid request.');return;
  }
  const security=requestSecurity(new Request(url,{headers:new Headers()}),true);
  applyResponseSecurity(response,url.pathname,security.csp,config);
  if(host!==new URL(config.origin).host){
    await send(response,['GET','HEAD'].includes(request.method)?Response.redirect(url.href,308):Response.json({error:'Use the canonical website address.'},{status:400}),request.method);return;
  }
  try {
    if(request.headers['next-action']){await send(response,Response.json({error:'Unsupported action.'},{status:400}),request.method);return;}
    const webRequest=toWebRequest(request,url.href,url.pathname.startsWith('/api/auth/'));
    const context={clientIp:trustedClientIp(request.socket)};
    if(url.pathname.startsWith('/api/auth/')){
      const result=await auth.handle(webRequest,context);
      await send(response,result||Response.json({error:'Not found.'},{status:404}),request.method);return;
    }
    const rejected=requestRejection(webRequest);
    if(rejected){await send(response,rejected,request.method);return;}
    if(url.pathname==='/signin-with-chatgpt'||url.pathname==='/signout-with-chatgpt'){
      const query=new URLSearchParams({return_to:safeReturnPath(url.searchParams.get('return_to'))});
      if(url.pathname==='/signout-with-chatgpt')query.set('mode','logout');
      await send(response,Response.redirect(config.origin+'/sign-in?'+query,303),request.method);return;
    }
    const identity=await auth.getIdentity(webRequest,context);
    if(!config.publicLaunch&&!identity&&!publicBeforeLaunch(url.pathname)){
      await send(response,Response.redirect(config.origin+'/sign-in?return_to='+encodeURIComponent(url.pathname+url.search),303),request.method);return;
    }
    request.headers=rendererHeaders(request.headers,config.origin,identity,security.nonce,security.csp);
    request.rawHeaders=Object.entries(request.headers).flatMap(([name,value])=>[name,Array.isArray(value)?value.join(', '):String(value)]);
    request.url=url.pathname+url.search;
    await identityContext.run({identity},()=>handle(request,response));
  }catch(error){
    if(error instanceof AuthError&&!response.headersSent){await send(response,Response.json({error:'This request is not allowed.'},{status:error.status}),request.method);return;}
    const requestId=requestLogId();
    // No exception message/stack, SQL, credentials, user data or code appears in logs.
    console.error('NorthWallEg request failed',{requestId,name:error instanceof Error?error.name:'Error'});
    if(!response.headersSent)await send(response,Response.json({error:'The request could not be completed.',requestId},{status:500}),request.method);
    else response.destroy();
  }
});
server.keepAliveTimeout=5000;
server.maxRequestsPerSocket=100;
server.listen(config.port,'0.0.0.0',()=>console.log(`NorthWallEg Node service listening on port ${config.port}. Public launch: ${config.publicLaunch}.`));
let closing=false;
async function close(){if(closing)return;closing=true;server.close();server.closeIdleConnections();mail.close();await pool.end();await app.close();process.exit(0);}
process.once('SIGTERM',close);process.once('SIGINT',close);
