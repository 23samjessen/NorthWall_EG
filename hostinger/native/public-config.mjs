import buildSettings from './build-settings.json' with { type: 'json' };

/** Non-secret configuration used before authentication or database initialization. */
function canonicalOrigin(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('A canonical HTTPS origin is required.');
  const raw = value.trim();
  let url;
  try { url = new URL(raw); } catch { throw new Error('The configured origin is invalid.'); }
  const authority = raw.match(/^https:\/\/([^/?#]+)\/?$/i)?.[1];
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash || !authority || authority.toLowerCase() !== url.hostname.toLowerCase()) {
    throw new Error('The configured origin must be one HTTPS origin without credentials, a port, path, query or fragment.');
  }
  return url.origin;
}

function exactHost(value) {
  return typeof value === 'string' && value.length <= 253 && /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$/.test(value);
}

/**
 * Missing environment settings inherit only generated, public build values.
 * An explicit launch/origin mismatch fails closed instead of silently changing
 * the audience of a previously built application.
 */
export function getPublicConfig(env = process.env, built = buildSettings) {
  const origin = canonicalOrigin(built.origin);
  if (typeof built.publicLaunch !== 'boolean') throw new Error('The build launch setting is invalid.');
  if (env.APP_ORIGIN !== undefined && canonicalOrigin(env.APP_ORIGIN) !== origin) {
    throw new Error('APP_ORIGIN changed. Rebuild the application before starting it.');
  }
  if (env.PUBLIC_LAUNCH !== undefined) {
    if (!['true', 'false'].includes(env.PUBLIC_LAUNCH)) throw new Error('PUBLIC_LAUNCH must be true or false.');
    if ((env.PUBLIC_LAUNCH === 'true') !== built.publicLaunch) {
      throw new Error('PUBLIC_LAUNCH changed. Rebuild the application before starting it.');
    }
  }
  const additional = env.ADDITIONAL_HOSTS ?? '';
  if (typeof additional !== 'string') throw new Error('ADDITIONAL_HOSTS must be a list of exact hostnames.');
  const allowedHosts = new Set([new URL(origin).host]);
  for (const host of additional.split(',').map(item => item.trim().toLowerCase()).filter(Boolean)) {
    if (!exactHost(host)) throw new Error('ADDITIONAL_HOSTS accepts exact hostnames without ports, paths or wildcards.');
    allowedHosts.add(host);
  }
  return { origin, publicLaunch: built.publicLaunch, allowedHosts };
}

/** Resolve authority only from an allowlisted Host; never trust forwarding headers. */
export function resolveNativeRequest(request, config) {
  const host = (request.headers.get('host') || '').toLowerCase();
  if (!config.allowedHosts.has(host)) return null;
  let source;
  try { source = new URL(request.url); } catch { return null; }
  const path = source.pathname + source.search;
  if (!path.startsWith('/') || path.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(path) || /%(?:2f|5c|00|0a|0d)/i.test(source.pathname)) return null;
  const url = new URL(path, config.origin);
  if (url.origin !== config.origin) return null;
  return { url, host, isCanonical: host === new URL(config.origin).host };
}

/** Request headers passed to the renderer contain no client-chosen identity. */
export function nativeRequestHeaders(source, config, nonce, csp) {
  const headers = new Headers();
  for (const [name, value] of source) {
    const key = name.toLowerCase();
    if (/^(?:oai-|x-middleware-|x-nextjs-|x-forwarded-|x-northwall-|cf-)/.test(key) || ['forwarded', 'x-real-ip', 'content-security-policy', 'content-security-policy-report-only', 'host'].includes(key)) continue;
    headers.set(name, value);
  }
  const url = new URL(config.origin);
  headers.set('host', url.host);
  headers.set('x-forwarded-host', url.host);
  headers.set('x-forwarded-proto', 'https');
  headers.set('x-forwarded-port', '443');
  headers.set('x-northwall-script-nonce', nonce);
  headers.set('content-security-policy', csp);
  return headers;
}

export function nativeAllowedMethods(pathname) {
  if (pathname === '/api/auth' || pathname.startsWith('/api/auth/')) return ['GET', 'HEAD', 'POST'];
  if (pathname === '/api/workspace') return ['GET', 'HEAD', 'POST'];
  if (pathname === '/api/profile-photo') return ['GET', 'HEAD', 'POST', 'DELETE'];
  return ['GET', 'HEAD'];
}

/** Read metadata only; the handler remains the sole consumer of the body. */
export function nativeRequestRejection(request, pathname) {
  if (request.headers.has('next-action')) return Response.json({ error: 'unsupported_action', message: 'Use the supported application API.' }, { status: 400 });
  const allowed = nativeAllowedMethods(pathname);
  if (!allowed.includes(request.method)) {
    return Response.json({ error: 'method_not_allowed', message: 'This request method is not supported.' }, { status: 405, headers: { Allow: allowed.join(', ') } });
  }
  return null;
}

/** Apply to mutable responses created by the proxy, including early rejections. */
export function applyNativeResponsePolicy(response, pathname, csp, config) {
  const headers = response.headers;
  headers.set('Content-Security-Policy', pathname === '/api/profile-photo' ? "default-src 'none'; sandbox" : csp);
  headers.set('Strict-Transport-Security', 'max-age=31536000');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  headers.delete('X-Powered-By');
  const privatePath = /^\/(?:workspace|api\/(?:workspace|profile-photo|auth)|sign-in)(?:\/|$)/.test(pathname);
  if (!config.publicLaunch || privatePath || response.status >= 400) headers.set('X-Robots-Tag', 'noindex, nofollow');
  const publicAsset = pathname.startsWith('/_next/static/') || pathname.startsWith('/assets/') || pathname === '/favicon.svg';
  if (!publicAsset || response.status >= 400) {
    headers.set('Cache-Control', 'private, no-store');
    headers.delete('ETag');
    const vary = new Set((headers.get('Vary') || '').split(',').map(item => item.trim()).filter(Boolean));
    vary.add('Cookie');
    headers.set('Vary', [...vary].join(', '));
  }
  return response;
}
