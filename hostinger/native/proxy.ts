import { NextResponse, type NextRequest } from 'next/server';
import { requestSecurity } from '@/lib/security-headers';
import { marketingDocumentPolicy } from '@/lib/marketing/csp.mjs';
import { marketingConfig, marketingGuideSlugs, marketingCampaigns } from '@/lib/marketing/config';
import { safeReturnPath } from '@/hostinger/http.mjs';
import {
  getPublicConfig, resolveNativeRequest, nativeRequestHeaders,
  nativeRequestRejection, applyNativeResponsePolicy,
} from '@/hostinger/native/public-config.mjs';

/** Copied to the Next project root by the upload exporter. No identity is trusted here. */
export function proxy(request: NextRequest) {
  try {
    const config = getPublicConfig();
    const resolved = resolveNativeRequest(request, config);
    // Generate policy from a separate, body-free Request so the actual body is
    // consumed exactly once later by the selected native Route Handler.
    const security = requestSecurity(new Request(resolved?.url || config.origin), true);
    const marketingRequest = new Request(resolved?.url || config.origin, { headers: {
      Cookie: request.headers.get('cookie') || '',
      DNT: request.headers.get('dnt') || '',
      'Sec-GPC': request.headers.get('sec-gpc') || '',
      Referer: request.headers.get('referer') || '',
    } });
    const marketing = marketingDocumentPolicy(marketingRequest, security.csp!, marketingConfig, config.publicLaunch, marketingGuideSlugs, marketingCampaigns);
    const csp = marketing.csp!;
    const finish = (response: Response, path = resolved?.url.pathname || '/') => applyNativeResponsePolicy(response, path, csp, config);
    if (!resolved) return finish(NextResponse.json({ error: 'invalid_request', message: 'Use the configured website address.' }, { status: 400 }));
    const rejected = nativeRequestRejection(request, resolved.url.pathname);
    if (rejected) return finish(rejected);
    if (!resolved.isCanonical) {
      return finish(['GET', 'HEAD'].includes(request.method)
        ? NextResponse.redirect(resolved.url, 308)
        : NextResponse.json({ error: 'invalid_origin', message: 'Use the canonical website address.' }, { status: 400 }));
    }
    if (['/signin-with-chatgpt', '/signout-with-chatgpt'].includes(resolved.url.pathname)) {
      const target = new URL('/sign-in', config.origin);
      target.searchParams.set('return_to', safeReturnPath(resolved.url.searchParams.get('return_to')));
      if (resolved.url.pathname === '/signout-with-chatgpt') target.searchParams.set('mode', 'logout');
      return finish(NextResponse.redirect(target, 303));
    }
    const headers = nativeRequestHeaders(request.headers, config, security.nonce!, csp);
    headers.set('x-northwall-marketing-eligible', marketing.eligible ? '1' : '0');
    headers.set('x-northwall-marketing-vendors', [marketing.vendors.meta ? 'meta' : '', marketing.vendors.tiktok ? 'tiktok' : ''].filter(Boolean).join(','));
    // Pass headers internally, never echo the request headers into the response.
    // All protected APIs and pages independently verify the cookie session.
    return finish(NextResponse.next({ request: { headers } }));
  } catch {
    const response = NextResponse.json({ error: 'configuration_unavailable', message: 'The website configuration is unavailable. Please contact the administrator.' }, { status: 503 });
    return applyNativeResponsePolicy(response, '/', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'", { publicLaunch: false });
  }
}

export const config = { matcher: '/:path*' };
