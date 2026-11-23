import 'server-only';
import { AUTH_COOKIES, AuthError } from '../auth/index.mjs';
import { safeReturnPath } from '../http.mjs';
import { requestSecurity } from '../../lib/security-headers';
import { getNativeRuntime } from './runtime.mjs';
import {
  getPublicConfig, resolveNativeRequest, nativeRequestRejection,
  applyNativeResponsePolicy,
} from './public-config.mjs';

type PublicConfiguration = { origin: string; publicLaunch: boolean; allowedHosts: Set<string> };
type RequestHandler = (request: Request) => Response | Promise<Response>;

class RequestBoundaryError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}

/** Revalidate at the data boundary; Proxy headers are never proof of identity. */
export function canonicalizeNativeRequest(request: Request, configuration = getPublicConfig()): Request {
  const config = configuration as PublicConfiguration;
  const resolved = resolveNativeRequest(request, config);
  const expectedHost = new URL(config.origin).host;
  if (!resolved) {
    throw new RequestBoundaryError(400, 'invalid_host', 'Invalid request.');
  }
  if (!resolved.isCanonical) {
    throw new RequestBoundaryError(400, 'canonical_origin_required', 'Use the canonical website address.');
  }

  const headers = new Headers(request.headers);
  for (const name of [...headers.keys()]) {
    if (/^(?:oai-|x-middleware-|x-nextjs-|x-forwarded-|x-northwall-|cf-)/i.test(name)
      || ['forwarded', 'x-real-ip', 'content-security-policy', 'content-security-policy-report-only'].includes(name.toLowerCase())) {
      headers.delete(name);
    }
  }
  headers.set('host', expectedHost);
  const init: RequestInit & { duplex?: 'half' } = { method: request.method, headers, signal: request.signal };
  if (!['GET', 'HEAD'].includes(request.method) && request.body) {
    init.body = request.body;
    init.duplex = 'half';
  }
  return new Request(resolved.url, init);
}

export function hasNativeSessionCookie(headers: Pick<Headers, 'get'>): boolean {
  const values = (headers.get('cookie') || '').split(';').map(value => value.trim())
    .filter(value => value.startsWith(`${AUTH_COOKIES.session}=`));
  return values.length === 1 && /^[A-Za-z0-9_-]{43}$/.test(values[0].slice(AUTH_COOKIES.session.length + 1));
}

function failure(error: unknown): Response {
  if (error instanceof RequestBoundaryError) {
    return Response.json({ error: error.message, code: error.code }, { status: error.status });
  }
  if (error instanceof AuthError) {
    return Response.json({ error: 'This request is not allowed.', code: error.code }, { status: error.status });
  }
  // Never serialize configuration, provider errors, SQL, codes or credentials.
  return Response.json({ error: 'This service is temporarily unavailable. Please contact the workspace owner.', code: 'service_unavailable' }, { status: 503 });
}

function protectResponse(response: Response, pathname: string, config: PublicConfiguration): Response {
  const security = requestSecurity(new Request(new URL(pathname, config.origin)), true);
  // Redirect and fetch responses may have immutable headers. Copy first, while
  // retaining every Set-Cookie value returned by the authentication service.
  const mutable = new Response(response.body, { status: response.status, statusText: response.statusText, headers: new Headers(response.headers) });
  return applyNativeResponsePolicy(mutable, pathname, security.csp!, config);
}

async function atBoundary(request: Request, handler: (request: Request, config: PublicConfiguration) => Promise<Response>): Promise<Response> {
  let config: PublicConfiguration;
  try { config = getPublicConfig() as PublicConfiguration; }
  catch { return Response.json({ error: 'This service is temporarily unavailable.', code: 'service_unavailable' }, { status: 503, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow' } }); }
  const pathname = new URL(request.url).pathname;
  let response: Response;
  try {
    const canonical = canonicalizeNativeRequest(request, config);
    response = nativeRequestRejection(canonical, pathname) || await handler(canonical, config);
  } catch (error) { response = failure(error); }
  return protectResponse(response, pathname, config);
}

export async function withWorkspaceRequest(request: Request, callback: RequestHandler): Promise<Response> {
  return atBoundary(request, async (canonical, config) => {
    // Reject cross-origin requests before opening private services. This mirrors
    // the auth boundary without depending on Error-class identity across bundles.
    const write = !['GET', 'HEAD'].includes(canonical.method);
    const origin = canonical.headers.get('origin');
    const fetchSite = canonical.headers.get('sec-fetch-site');
    if ((write && origin !== config.origin) || (!write && origin && origin !== config.origin)
      || (fetchSite && !['same-origin', 'none'].includes(fetchSite))) {
      throw new RequestBoundaryError(403, 'origin_rejected', 'This request is not allowed.');
    }
    const runtime = await getNativeRuntime();
    // Next's native request API does not expose a verified peer socket address.
    // Omit clientIp: existing auth applies its conservative shared-client limit.
    const identity = await runtime.auth.getIdentity(canonical);
    if (!identity) return Response.json({ error: 'Sign in to access the employee workspace.', code: 'sign_in_required' }, { status: 401 });
    return runtime.identityContext.run({ identity }, () => callback(canonical));
  });
}

export async function handleAuthRequest(request: Request): Promise<Response> {
  return atBoundary(request, async canonical => {
    const runtime = await getNativeRuntime();
    return await runtime.auth.handle(canonical) || Response.json({ error: 'Not found.', code: 'not_found' }, { status: 404 });
  });
}

export async function withPublicRequest(request: Request, callback: RequestHandler): Promise<Response> {
  return atBoundary(request, async (canonical, config) => {
    if (!config.publicLaunch) {
      const runtime = hasNativeSessionCookie(canonical.headers) ? await getNativeRuntime() : null;
      const identity = runtime ? await runtime.auth.getIdentity(canonical) : null;
      if (!identity) {
        const returnTo = safeReturnPath(new URL(canonical.url).pathname + new URL(canonical.url).search);
        return Response.redirect(config.origin + '/sign-in?return_to=' + encodeURIComponent(returnTo), 303);
      }
    }
    return callback(canonical);
  });
}
