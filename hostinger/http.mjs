import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';

const AUTH_PATHS = new Set(['/sign-in', '/signin-with-chatgpt', '/signout-with-chatgpt']);
export function safeReturnPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(value)) return '/workspace';
  try {
    const url = new URL(value, 'https://return.invalid');
    if (url.origin !== 'https://return.invalid' || AUTH_PATHS.has(url.pathname) || url.pathname.startsWith('/api/')) return '/workspace';
    return url.pathname + url.search + url.hash;
  } catch { return '/workspace'; }
}
export function incomingUrl(raw, origin) {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(raw)) return null;
  try {
    const url = new URL(raw, origin);
    if (url.origin !== origin) return null;
    // Prevent encoded separators from changing route decisions inside a framework.
    if (/%(?:2f|5c|00|0a|0d)/i.test(url.pathname)) return null;
    return url;
  } catch { return null; }
}
/** No browser-supplied identity, proxy or internal middleware headers survive. */
export function rendererHeaders(source, origin, identity, nonce, csp) {
  const headers = {};
  for (const [name, value] of Object.entries(source)) {
    if (value === undefined) continue;
    const key = name.toLowerCase();
    if (/^(?:oai-|x-middleware-|x-nextjs-|x-forwarded-|cf-)/.test(key) || ['forwarded','x-real-ip','x-northwall-script-nonce','content-security-policy','content-security-policy-report-only','host'].includes(key)) continue;
    headers[key] = value;
  }
  const url = new URL(origin);
  headers.host = url.host;
  headers['x-forwarded-host'] = url.host;
  headers['x-forwarded-proto'] = 'https';
  headers['x-forwarded-port'] = '443';
  headers['x-northwall-script-nonce'] = nonce;
  headers['content-security-policy'] = csp;
  if (identity) {
    headers['oai-authenticated-user-id'] = identity.userId;
    headers['oai-authenticated-user-email'] = identity.email;
    headers['oai-authenticated-user-full-name'] = encodeURIComponent(identity.name || identity.email);
    headers['oai-authenticated-user-full-name-encoding'] = 'percent-encoded-utf-8';
  }
  return headers;
}
export function publicBeforeLaunch(pathname) {
  return pathname === '/sign-in' || pathname.startsWith('/api/auth/') || pathname === '/workspace' || pathname.startsWith('/workspace/') || pathname === '/api/workspace' || pathname === '/api/profile-photo' || pathname.startsWith('/_next/static/') || pathname === '/favicon.svg' || pathname.startsWith('/assets/');
}
export function privatePath(pathname) {
  return /^\/(?:workspace|api\/(?:workspace|profile-photo|auth)|sign-in)(?:\/|$)/.test(pathname);
}
export function trustedClientIp(socket) {
  // A shared upstream may make this conservative. Do not use spoofable X-Forwarded-For.
  return socket?.remoteAddress || 'unknown-upstream';
}
export function requestLogId() { return createHash('sha256').update(crypto.randomUUID()).digest('hex').slice(0,20); }

export function toWebRequest(request,url,includeBody=false){
  const headers=new Headers();
  for(const [name,value] of Object.entries(request.headers)){
    if(value!==undefined)headers.set(name,Array.isArray(value)?value.join(name==='cookie'?'; ':', '):value);
  }
  return new Request(url,{method:request.method,headers,...(includeBody&&!['GET','HEAD'].includes(request.method)?{body:Readable.toWeb(request),duplex:'half'}:{})});
}

/** Apply final policy after explicit writeHead headers, before bytes leave the server. */
export function applyResponseSecurity(response,pathname,csp,{publicLaunch}){
  const writeHead=response.writeHead;
  response.writeHead=function(statusCode,statusMessage,explicitHeaders){
    const supplied=typeof statusMessage==='string'?explicitHeaders:statusMessage;
    if(supplied){
      if(Array.isArray(supplied)){for(let i=0;i<supplied.length;i+=2)this.setHeader(supplied[i],supplied[i+1]);}
      else for(const [name,value] of Object.entries(supplied))this.setHeader(name,value);
    }
    const type=String(this.getHeader('Content-Type')||'');
    if(pathname!=='/api/profile-photo'||!this.hasHeader('Content-Security-Policy'))this.setHeader('Content-Security-Policy',csp);
    this.setHeader('Strict-Transport-Security','max-age=31536000');
    this.setHeader('X-Content-Type-Options','nosniff');
    this.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
    this.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    this.setHeader('Cross-Origin-Resource-Policy','same-origin');
    this.removeHeader('X-Powered-By');
    if(!publicLaunch||privatePath(pathname))this.setHeader('X-Robots-Tag','noindex, nofollow');
    if(privatePath(pathname)||/^(?:text\/html|text\/x-component)(?:;|$)/i.test(type)||statusCode>=400){
      this.setHeader('Cache-Control','private, no-store');this.removeHeader('ETag');
      const vary=new Set(String(this.getHeader('Vary')||'').split(',').map(x=>x.trim()).filter(Boolean));vary.add('Cookie');this.setHeader('Vary',[...vary].join(', '));
    }
    return typeof statusMessage==='string'?writeHead.call(this,statusCode,statusMessage):writeHead.call(this,statusCode);
  };
}
