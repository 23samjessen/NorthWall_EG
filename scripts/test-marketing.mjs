import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONSENT_COOKIE, CONSENT_VERSION, CONSENT_MAX_AGE, SERVICE_IDS,
  readMarketingConfig, cookieValue, hasEmployeeCookie, isPrivacySignal,
  createConsent, parseConsent, publicRoute, campaignFromUrl,
  safeMarketingLocation, safeMarketingReferrer, cleanEvent,
} from '../lib/marketing/policy.mjs';
import { marketingDocumentPolicy } from '../lib/marketing/csp.mjs';

// Synthetic identifiers only. These tests never load a vendor or make network calls.
const ORIGIN = 'https://northwallegy.com';
const NOW = Date.UTC(2026, 10, 26, 12);
const GUIDES = ['microsoft-365-security-basics', 'incident-response-planning'];
const CAMPAIGNS = ['m365-eg', 'cyber-eg', 'northwall-eg'];
const ENV = Object.freeze({
  NEXT_PUBLIC_MARKETING_ENABLED: 'true',
  NEXT_PUBLIC_META_PIXEL_ID: '123456789012345',
  NEXT_PUBLIC_TIKTOK_PIXEL_ID: 'C1234567890ABCDEF1234',
  NEXT_PUBLIC_META_MANUAL_MODE_CONFIRMED: 'true',
  NEXT_PUBLIC_TIKTOK_MANUAL_MODE_CONFIRMED: 'true',
});
const CONFIG = readMarketingConfig(ENV);
const BASE_CSP = "default-src 'self'; script-src 'self' 'nonce-test-nonce' 'strict-dynamic'; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-src 'none'; frame-ancestors 'self' https://chatgpt.com; form-action 'self'; upgrade-insecure-requests";

function consentCookie(choices = { meta: true, tiktok: true }, config = CONFIG, now = NOW) {
  return `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(createConsent(choices, config, now)))}`;
}
function rawConsentCookie(value) {
  return `${CONSENT_COOKIE}=${encodeURIComponent(typeof value === 'string' ? value : JSON.stringify(value))}`;
}
function evaluate(path = '/', options = {}) {
  const request = new Request(new URL(path, ORIGIN), {
    headers: { cookie: options.cookie ?? consentCookie(), ...options.headers },
  });
  return marketingDocumentPolicy(request, BASE_CSP, options.config ?? CONFIG,
    options.publicLaunch ?? true, GUIDES, CAMPAIGNS, options.now ?? NOW);
}
function assertDenied(result, reason = '') {
  assert.deepEqual(result.vendors, { meta: false, tiktok: false }, reason);
  assert.equal(result.csp, BASE_CSP, reason);
}
function directives(csp) {
  return Object.fromEntries(csp.split(';').map(part => part.trim()).filter(Boolean).map(part => {
    const [name, ...values] = part.split(/\s+/);
    return [name, values.join(' ')];
  }));
}

test('activation requires explicit master switch, valid provider IDs and manual-mode confirmation', () => {
  assert.equal(CONFIG.enabled, true);
  for (const env of [{}, { ...ENV, NEXT_PUBLIC_MARKETING_ENABLED: 'false' }, { ...ENV, NEXT_PUBLIC_MARKETING_ENABLED: 'TRUE' }]) {
    const config = readMarketingConfig(env);
    assert.equal(config.enabled, false);
    assert.equal(config.meta.id, '');
    assert.equal(config.tiktok.id, '');
    assertDenied(evaluate('/', { config }));
  }
  for (const id of ['', '1234', 'sam@example.test', '<script>', '123456\nalert(1)', '1'.repeat(26)]) {
    assert.equal(readMarketingConfig({ ...ENV, NEXT_PUBLIC_META_PIXEL_ID: id }).meta.enabled, false);
  }
  for (const id of ['', 'short', 'sam@example.test', 'C1234567890/../../', '<script>', 'A'.repeat(36)]) {
    assert.equal(readMarketingConfig({ ...ENV, NEXT_PUBLIC_TIKTOK_PIXEL_ID: id }).tiktok.enabled, false);
  }
  assert.equal(readMarketingConfig({ ...ENV, NEXT_PUBLIC_META_MANUAL_MODE_CONFIRMED: undefined }).meta.enabled, false);
  assert.equal(readMarketingConfig({ ...ENV, NEXT_PUBLIC_TIKTOK_MANUAL_MODE_CONFIRMED: 'false' }).tiktok.enabled, false);
});

test('no choice, rejection, malformed or duplicated cookies never expand CSP', () => {
  for (const cookie of ['', 'another_cookie=1', rawConsentCookie('{bad json'), rawConsentCookie(null), rawConsentCookie([]), `${CONSENT_COOKIE}=%ZZ`, consentCookie({ meta: false, tiktok: false }), `${consentCookie()}; ${consentCookie()}`]) {
    assertDenied(evaluate('/', { cookie }), cookie);
  }
  assert.equal(cookieValue(`${CONSENT_COOKIE}_other=not-consent`, CONSENT_COOKIE), null);
  assert.equal(cookieValue(undefined, CONSENT_COOKIE), null);
});

test('fresh consent grants only configured, explicitly chosen providers', () => {
  const choice = createConsent({ meta: true, tiktok: false }, CONFIG, NOW);
  assert.deepEqual(parseConsent(JSON.stringify(choice), CONFIG, NOW).choices, { meta: true, tiktok: false });
  const metaOnly = evaluate('/', { cookie: consentCookie({ meta: true, tiktok: false }) });
  assert.deepEqual(metaOnly.vendors, { meta: true, tiktok: false });
  assert.match(metaOnly.csp, /https:\/\/www\.facebook\.com/);
  assert.match(metaOnly.csp, /https:\/\/connect\.facebook\.net/);
  assert.doesNotMatch(metaOnly.csp, /tiktok/);
  const tiktokOnly = evaluate('/', { cookie: consentCookie({ meta: false, tiktok: true }) });
  assert.deepEqual(tiktokOnly.vendors, { meta: false, tiktok: true });
  assert.match(tiktokOnly.csp, /https:\/\/analytics\.tiktok\.com/);
  assert.doesNotMatch(tiktokOnly.csp, /facebook/);
  const disabledMeta = readMarketingConfig({ ...ENV, NEXT_PUBLIC_META_MANUAL_MODE_CONFIRMED: 'false' });
  assert.deepEqual(createConsent({ meta: true, tiktok: true }, disabledMeta, NOW).choices, { meta: false, tiktok: true });
  assert.deepEqual(createConsent({ meta: 'true', tiktok: 1 }, CONFIG, NOW).choices, { meta: false, tiktok: false });
});

test('expiry, invalid timestamps and extended retention invalidate consent', () => {
  const valid = createConsent({ meta: true, tiktok: true }, CONFIG, NOW);
  const invalid = [
    { ...valid, expiresAt: NOW },
    { ...valid, decidedAt: NOW - 1000, expiresAt: NOW - 1 },
    { ...valid, expiresAt: valid.expiresAt + 1 },
    { ...valid, decidedAt: -1 },
    { ...valid, decidedAt: NOW + 0.5 },
    { ...valid, expiresAt: Infinity },
    { ...valid, decidedAt: '2026-11-26' },
    { ...valid, choices: { meta: 'true', tiktok: true } },
    { ...valid, choices: { meta: true } },
  ];
  for (const value of invalid) {
    assert.equal(parseConsent(JSON.stringify(value), CONFIG, NOW), null);
    assertDenied(evaluate('/', { cookie: rawConsentCookie(value) }));
  }
  assert.equal(parseConsent(JSON.stringify(valid), CONFIG, valid.expiresAt), null);
  assert.equal(valid.expiresAt - valid.decidedAt, CONSENT_MAX_AGE * 1000);
  assert.equal(parseConsent('x'.repeat(1401), CONFIG, NOW), null);
});

test('future-dated consent is not treated as an existing decision', () => {
  const future = createConsent({ meta: true, tiktok: true }, CONFIG, NOW + 1);
  assert.equal(parseConsent(JSON.stringify(future), CONFIG, NOW), null);
  assertDenied(evaluate('/', { cookie: rawConsentCookie(future) }));
});

test('a changed policy version, pixel ID or vendor configuration requires a fresh decision', () => {
  const value = createConsent({ meta: true, tiktok: true }, CONFIG, NOW);
  assert.equal(parseConsent(JSON.stringify({ ...value, version: CONSENT_VERSION + '-old' }), CONFIG, NOW), null);
  assert.equal(parseConsent(JSON.stringify({ ...value, context: value.context + '-other' }), CONFIG, NOW), null);
  for (const config of [
    readMarketingConfig({ ...ENV, NEXT_PUBLIC_META_PIXEL_ID: '987654321098765' }),
    readMarketingConfig({ ...ENV, NEXT_PUBLIC_TIKTOK_PIXEL_ID: 'C9876543210ABCDEF5678' }),
    readMarketingConfig({ ...ENV, NEXT_PUBLIC_TIKTOK_MANUAL_MODE_CONFIRMED: 'false' }),
  ]) assertDenied(evaluate('/', { config, cookie: rawConsentCookie(value) }));
});

test('only exact company routes and explicitly supplied guide slugs qualify', () => {
  for (const path of ['/', '/en', '/ar', '/insights']) assert.ok(publicRoute(path, GUIDES));
  for (const service of SERVICE_IDS) {
    for (const language of ['en', 'ar']) {
      assert.deepEqual(publicRoute(`/${language}/services/${service}`, GUIDES), { page: 'service', language, serviceId: service });
    }
  }
  assert.deepEqual(publicRoute('/insights/microsoft-365-security-basics', GUIDES), { page: 'guide', language: 'en', guideId: 'microsoft-365-security-basics' });
  assert.equal(publicRoute('/insights/microsoft-365-security-basics'), null);
  for (const path of ['/en/', '/fr', '/fr/services/microsoft-365', '/en/services/not-a-service', '/en/services/microsoft-365/extra', '/insights/not-curated', '/insights/', '//workspace', '/en/services/%6dicrosoft-365']) {
    assert.equal(publicRoute(path, GUIDES), null, path);
  }
});

test('private, API, asset and unknown routes retain the complete original CSP even with valid consent', () => {
  for (const path of ['/workspace', '/workspace/tickets', '/sign-in', '/signin-with-chatgpt', '/signout-with-chatgpt', '/api/auth/login', '/api/auth/status', '/api/workspace', '/api/profile-photo', '/api/news', '/robots.txt', '/sitemap.xml', '/assets/egypt-hero.webp', '/_next/static/chunk.js', '/not-found']) {
    const result = evaluate(path);
    assert.equal(result.eligible, false, path);
    assertDenied(result, path);
  }
  assertDenied(evaluate('/', { publicLaunch: false }));
});

test('employee session or pending verification cookies suppress tracking on otherwise public pages', () => {
  for (const cookie of ['__Host-nw_session=synthetic-session', '__Host-nw_pending=synthetic-pending']) {
    assert.equal(hasEmployeeCookie(cookie), true);
    assertDenied(evaluate('/', { cookie: `${consentCookie()}; ${cookie}` }));
  }
  assert.equal(hasEmployeeCookie('__Host-nw_session='), false);
  assert.equal(hasEmployeeCookie('prefix__Host-nw_session=not-our-cookie'), false);
  assert.equal(hasEmployeeCookie('__Host-nw_session_backup=unrelated'), false);
});

test('GPC and DNT prevent marketing regardless of a stored opt-in', () => {
  for (const value of [true, 1, '1']) assert.equal(isPrivacySignal(value), true);
  for (const value of [false, 0, '0', null, undefined, '']) assert.equal(isPrivacySignal(value), false);
  assertDenied(evaluate('/', { headers: { 'Sec-GPC': '1' } }));
  assertDenied(evaluate('/', { headers: { DNT: '1' } }));
  assert.deepEqual(evaluate('/', { headers: { 'Sec-GPC': '0', DNT: '0' } }).vendors, { meta: true, tiktok: true });
});

test('unknown query fields, duplicate campaign fields and arbitrary fragments prevent vendor activation', () => {
  for (const suffix of ['?email=sam%40example.test', '?q=private-search', '?return_to=%2Fworkspace', '?token=secret', '#sam@example.test', '#ticket-001', '?utm_source=facebook&utm_source=tiktok&utm_medium=paid_social&utm_campaign=m365-eg', '?utm_source=facebook', '?fbclid=short', '?ttclid=user%40example.test']) {
    assert.equal(safeMarketingLocation(ORIGIN + '/' + suffix, CAMPAIGNS), false, suffix);
    assertDenied(evaluate('/' + suffix), suffix);
  }
  for (const suffix of ['', '#contact', '#section-2', '?utm_source=facebook&utm_medium=paid_social&utm_campaign=m365-eg', '?fbclid=' + 'A'.repeat(32)]) {
    assert.equal(safeMarketingLocation(ORIGIN + '/' + suffix, CAMPAIGNS), true, suffix);
  }
});

test('referrer checks reject credentials, private paths, query strings and unknown external paths', () => {
  for (const raw of [ORIGIN + '/workspace', ORIGIN + '/sign-in', ORIGIN + '/api/auth/verify', ORIGIN + '/?email=sam@example.test', ORIGIN + '/#private', 'https://facebook.com/someone/profile', 'https://user:pass@facebook.com/', 'javascript:alert(1)', 'not a URL']) {
    assert.equal(safeMarketingReferrer(raw, ORIGIN, GUIDES), false, raw);
    assertDenied(evaluate('/', { headers: { Referer: raw } }), raw);
  }
  for (const raw of ['', ORIGIN + '/', ORIGIN + '/en/services/microsoft-365', ORIGIN + '/insights/microsoft-365-security-basics', 'https://www.facebook.com/']) {
    assert.equal(safeMarketingReferrer(raw, ORIGIN, GUIDES), true, raw);
  }
});

test('campaign attribution accepts only curated codes and known source/medium combinations', () => {
  const valid = `${ORIGIN}/?utm_source=facebook&utm_medium=paid_social&utm_campaign=m365-eg`;
  assert.deepEqual(campaignFromUrl(valid, CAMPAIGNS), { source: 'facebook', medium: 'paid_social', campaign: 'm365-eg' });
  for (const url of [
    `${ORIGIN}/?utm_source=facebook&utm_medium=paid_social&utm_campaign=sam%40example.test`,
    `${ORIGIN}/?utm_source=sam%40example.test&utm_medium=paid_social&utm_campaign=m365-eg`,
    `${ORIGIN}/?utm_source=facebook&utm_medium=private-message&utm_campaign=m365-eg`,
    `${ORIGIN}/?utm_source=facebook&utm_medium=paid_social&utm_campaign=unknown-campaign`,
    'not a URL',
  ]) assert.equal(campaignFromUrl(url, CAMPAIGNS), null, url);
});

test('a mistakenly configured personal address is not accepted as a campaign code', () => {
  const personal = 'sam@example.test';
  assert.equal(campaignFromUrl(`${ORIGIN}/?utm_source=facebook&utm_medium=paid_social&utm_campaign=${encodeURIComponent(personal)}`, [personal]), null);
});

test('manual events discard free text, form data, contact identifiers and arbitrary properties', () => {
  const details = { serviceId: 'microsoft-365', email: 'visitor@example.test', phone: '+4512345678', message: 'Private message', company: 'Private company', text: 'Arbitrary element text', url: ORIGIN + '/?secret=1', value: 1000 };
  const event = cleanEvent('service_view', details, publicRoute('/'));
  assert.deepEqual(event.properties, { page_type: 'home', language: 'en', service_id: 'microsoft-365', content_ids: ['microsoft-365'], content_category: 'IT services' });
  const serialized = JSON.stringify(event);
  for (const forbidden of [details.email, details.phone, details.message, details.company, details.text, details.url]) assert.equal(serialized.includes(forbidden), false);
  for (const action of ['enquiry_open', 'brief_download', 'whatsapp_click', 'phone_click', 'email_click', 'engaged_visit']) {
    const result = cleanEvent(action, details, publicRoute('/ar'));
    assert.deepEqual(result.properties, { page_type: 'home', language: 'ar' });
    assert.equal(result.custom, true);
  }
});

test('unsupported lead, purchase and internal-ticket events are never converted into marketing claims', () => {
  for (const name of ['Lead', 'lead', 'SubmitForm', 'form_submit', 'enquiry_submit', 'ticket_created', 'Purchase', 'CompleteRegistration', '__proto__']) {
    assert.equal(cleanEvent(name, {}, publicRoute('/')), null, name);
  }
  assert.equal(cleanEvent('page_view', {}, null), null);
  assert.equal(cleanEvent('service_view', { serviceId: 'visitor@example.test' }, publicRoute('/')), null);
  for (const percent of [-1, 0, 25, 100, '50', 'visitor@example.test']) assert.equal(cleanEvent('scroll_depth', { percent }, publicRoute('/')), null);
  for (const percent of [50, 90]) assert.equal(cleanEvent('scroll_depth', { percent }, publicRoute('/')).properties.percent, percent);
});

test('untrusted campaign objects cannot smuggle personal data through a clean event', () => {
  const injected = { source: 'facebook', medium: 'paid_social', campaign: 'visitor@example.test', email: 'another@example.test' };
  const event = cleanEvent('page_view', {}, publicRoute('/'), injected, CAMPAIGNS);
  assert.equal(JSON.stringify(event).includes('visitor@example.test'), false);
  assert.equal(JSON.stringify(event).includes('another@example.test'), false);
});

test('CSP opt-in preserves nonce enforcement, framing, forms and the base policy outside network destinations', () => {
  const before = directives(BASE_CSP);
  const after = directives(evaluate('/').csp);
  for (const [name, values] of Object.entries(before)) {
    if (name !== 'connect-src' && name !== 'img-src') assert.equal(after[name], values, name);
  }
  assert.equal(after['connect-src'], "'self' https://www.facebook.com https://connect.facebook.net https://analytics.tiktok.com https://analytics-ipv6.tiktokw.us");
  assert.equal(after['img-src'], "'self' data: blob: https://www.facebook.com https://connect.facebook.net https://analytics.tiktok.com https://analytics-ipv6.tiktokw.us");
  assert.equal(after['frame-src'], "'none'");
  assert.equal(after['form-action'], "'self'");
  assert.equal(after['script-src'], before['script-src']);
});
