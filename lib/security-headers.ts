/** Shared HTTP controls. A destination host must apply these before rendering. */
export const NONCE_HEADER = 'x-northwall-script-nonce';

export function httpsRedirect(request: Request, production: boolean): Response | null {
  const url = new URL(request.url);
  if (!production || url.protocol !== 'http:') return null;
  url.protocol = 'https:';
  // Use the runtime's request URL, never a visitor-supplied forwarding header.
  // The destination proxy must establish this URL from its verified TLS context.
  return Response.redirect(url.toString(), 308);
}

export function requestSecurity(request: Request, production: boolean) {
  const headers = new Headers(request.headers);
  // A visitor must never choose the nonce that our renderer trusts.
  headers.delete(NONCE_HEADER);
  headers.delete('content-security-policy');
  headers.delete('content-security-policy-report-only');
  const nonce = production
    ? Array.from(crypto.getRandomValues(new Uint8Array(24)), byte => byte.toString(16).padStart(2, '0')).join('')
    : undefined;
  const csp = nonce ? [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-src 'none'",
    "frame-ancestors 'self' https://chatgpt.com",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ].join('; ') : undefined;
  if (nonce && csp) {
    headers.set(NONCE_HEADER, nonce);
    // Vinext/Next extract this nonce for their own bootstrap and streamed scripts.
    headers.set('content-security-policy', csp);
  }
  return { request: new Request(request, { headers }), nonce, csp };
}

export function allowedRequestMethods(pathname: string): readonly string[] {
  if (pathname === '/api/workspace') return ['GET', 'HEAD', 'POST'];
  if (pathname === '/api/profile-photo') return ['GET', 'HEAD', 'POST', 'DELETE'];
  return ['GET', 'HEAD'];
}

export function requestRejection(request: Request): Response | null {
  const allowed = allowedRequestMethods(new URL(request.url).pathname);
  // This application uses explicit API routes and has no Server Actions.
  // Do not expose the framework's unused action deserializer on public pages.
  if (request.headers.has('next-action')) {
    return Response.json({ error: 'unsupported_action', message: 'Use the supported application API.' }, { status: 400 });
  }
  if (!allowed.includes(request.method)) {
    return Response.json({ error: 'method_not_allowed', message: 'This request method is not supported.' }, {
      status: 405, headers: { Allow: allowed.join(', ') },
    });
  }
  return null;
}

export function secureResponse(response: Response, pathname: string, production: boolean, csp: string | undefined, noindex: boolean) {
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  headers.delete('X-Powered-By');
  if (noindex) headers.set('X-Robots-Tag', 'noindex, nofollow');
  else headers.delete('X-Robots-Tag');
  if (production) {
    // Private image/download routes may deliberately use a stricter sandbox.
    if (csp && !headers.has('Content-Security-Policy')) headers.set('Content-Security-Policy', csp);
    headers.set('Strict-Transport-Security', 'max-age=31536000');
  }
  const privateRoute = /^\/(?:workspace|api\/workspace|api\/profile-photo)(?:\/|$)/.test(pathname);
  const renderedDocument = /^(?:text\/html|text\/x-component)(?:;|$)/i.test(headers.get('Content-Type') || '');
  if (privateRoute || renderedDocument || response.status >= 400) {
    // Nonced documents must not be served with a nonce from a different request.
    headers.set('Cache-Control', 'private, no-store');
    headers.delete('ETag');
    const vary = new Set((headers.get('Vary') || '').split(',').map(value => value.trim()).filter(Boolean));
    vary.add('Cookie');
    headers.set('Vary', [...vary].join(', '));
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
