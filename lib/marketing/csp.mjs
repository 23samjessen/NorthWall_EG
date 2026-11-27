import {
  CONSENT_COOKIE, cookieValue, parseConsent, publicRoute, hasEmployeeCookie,
  isPrivacySignal, safeMarketingLocation, safeMarketingReferrer,
} from './policy.mjs';

/** Extend only the current public document's policy, after valid consent. */
export function marketingDocumentPolicy(request, baseCsp, config, publicLaunch, guideSlugs = [], campaigns = [], now = Date.now()) {
  const url = new URL(request.url);
  const cookies = request.headers.get('cookie') || '';
  const eligible = config.enabled && publicLaunch === true && Boolean(publicRoute(url.pathname, guideSlugs)) &&
    !hasEmployeeCookie(cookies) && !isPrivacySignal(request.headers.get('sec-gpc')) && !isPrivacySignal(request.headers.get('dnt')) &&
    safeMarketingLocation(url.href, campaigns) && safeMarketingReferrer(request.headers.get('referer'), url.origin, guideSlugs);
  const consent = eligible ? parseConsent(cookieValue(cookies, CONSENT_COOKIE), config, now) : null;
  const vendors = { meta: Boolean(consent?.choices.meta), tiktok: Boolean(consent?.choices.tiktok) };
  const origins = [
    ...(vendors.meta ? ['https://www.facebook.com', 'https://connect.facebook.net'] : []),
    ...(vendors.tiktok ? ['https://analytics.tiktok.com', 'https://analytics-ipv6.tiktokw.us'] : []),
  ];
  let csp = baseCsp;
  if (origins.length && csp) {
    // Script execution remains nonce/strict-dynamic controlled. No unsafe-inline,
    // wildcard, private-route, frame or form-action exceptions are introduced.
    csp = csp.replace("connect-src 'self'", "connect-src 'self' " + origins.join(' '));
    csp = csp.replace("img-src 'self' data: blob:", "img-src 'self' data: blob: " + origins.join(' '));
  }
  return { eligible, vendors, csp };
}
