import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getPublicConfig, resolveNativeRequest, nativeRequestHeaders,
  nativeRequestRejection, applyNativeResponsePolicy,
} from '../native/public-config.mjs';

const built = { format: 1, origin: 'https://northwallegy.com', publicLaunch: false };
const config = getPublicConfig({}, built);
const request = (path, init = {}) => new Request('https://northwallegy.com' + path, { ...init, headers: { host: 'northwallegy.com', ...init.headers } });

test('Native public configuration uses only non-secret build defaults and rejects runtime audience changes', () => {
  assert.equal(config.origin, built.origin);
  assert.equal(config.publicLaunch, false);
  assert.deepEqual([...config.allowedHosts], ['northwallegy.com']);
  assert.equal(Object.hasOwn(config, 'secret'), false);
  assert.equal(getPublicConfig({ APP_ORIGIN: built.origin, PUBLIC_LAUNCH: 'false' }, built).publicLaunch, false);
  assert.throws(() => getPublicConfig({ APP_ORIGIN: 'https://other.example' }, built), /Rebuild/);
  assert.throws(() => getPublicConfig({ PUBLIC_LAUNCH: 'true' }, built), /Rebuild/);
  for (const value of ['', 'FALSE', '1', 'yes']) assert.throws(() => getPublicConfig({ PUBLIC_LAUNCH: value }, built));
  assert.throws(() => getPublicConfig({}, { ...built, publicLaunch: 'false' }));
  assert.equal(getPublicConfig({ PUBLIC_LAUNCH: 'true' }, { ...built, publicLaunch: true }).publicLaunch, true);
});

test('Native origins and aliases reject credentials, ports, routing syntax and wildcard domains', () => {
  for (const origin of ['http://northwallegy.com', 'https://user:pass@northwallegy.com', 'https://northwallegy.com:443', 'https://northwallegy.com:8443', 'https://northwallegy.com/path', 'https://northwallegy.com?x=1', 'https://northwallegy.com#fragment', 'not a URL']) {
    assert.throws(() => getPublicConfig({}, { ...built, origin }));
  }
  for (const host of ['*.northwallegy.com', 'https://www.northwallegy.com', 'www.northwallegy.com:443', 'www.northwallegy.com/path', '.northwallegy.com', 'www..northwallegy.com', '-bad.example', 'example.test\nInjected: yes']) {
    assert.throws(() => getPublicConfig({ ADDITIONAL_HOSTS: host }, built));
  }
  const aliases = getPublicConfig({ ADDITIONAL_HOSTS: 'WWW.northwallegy.com, preview.example.test' }, built);
  assert.deepEqual([...aliases.allowedHosts], ['northwallegy.com', 'www.northwallegy.com', 'preview.example.test']);
});

test('Native authority comes from exact allowlisted Host, never forwarded origin, and preserves legitimate query strings', () => {
  const good = resolveNativeRequest(request('/workspace?tab=team', { headers: { 'x-forwarded-host': 'evil.example', 'x-forwarded-proto': 'http' } }), config);
  assert.equal(good.url.href, 'https://northwallegy.com/workspace?tab=team');
  assert.equal(good.isCanonical, true);
  for (const host of ['evil.example', 'northwallegy.com.evil.example', 'northwallegy.com:443', '']) assert.equal(resolveNativeRequest(request('/', { headers: { host } }), config), null);
  for (const path of ['//evil.example/path', '/api%2fauth/status', '/api%5cauth/status', '/%00hidden', '/%0d%0aheader']) assert.equal(resolveNativeRequest(request(path), config), null);
  const aliases = getPublicConfig({ ADDITIONAL_HOSTS: 'www.northwallegy.com' }, built);
  const alias = resolveNativeRequest(request('/en?a=1', { headers: { host: 'www.northwallegy.com' } }), aliases);
  assert.equal(alias.isCanonical, false);
  assert.equal(alias.url.href, 'https://northwallegy.com/en?a=1');
});

test('Native forwarding strips forged identity, internal state and nonce while preserving the cookie and body headers', async () => {
  const body = JSON.stringify({ action: 'ticket.create', title: 'A real request body' });
  const original = request('/api/workspace', { method: 'POST', body, headers: {
    cookie: '__Host-northwall_session=opaque-cookie', 'content-type': 'application/json',
    'oai-authenticated-user-id': 'forged-owner', 'oai-authenticated-user-email': 'owner@example.test',
    'x-middleware-subrequest': 'proxy', 'x-nextjs-data': '1', 'x-forwarded-for': '1.2.3.4',
    'x-forwarded-host': 'evil.example', 'x-real-ip': '1.2.3.4', forwarded: 'host=evil.example',
    'cf-connecting-ip': '1.2.3.4', 'x-northwall-script-nonce': 'forged', 'x-northwall-identity': 'owner',
    'content-security-policy': 'unsafe', 'content-security-policy-report-only': 'unsafe',
  } });
  const headers = nativeRequestHeaders(original.headers, config, 'a'.repeat(48), 'trusted-policy');
  for (const name of ['oai-authenticated-user-id', 'oai-authenticated-user-email', 'x-middleware-subrequest', 'x-nextjs-data', 'x-forwarded-for', 'x-real-ip', 'forwarded', 'cf-connecting-ip', 'x-northwall-identity', 'content-security-policy-report-only']) assert.equal(headers.has(name), false);
  assert.equal(headers.get('host'), 'northwallegy.com');
  assert.equal(headers.get('x-forwarded-host'), 'northwallegy.com');
  assert.equal(headers.get('x-forwarded-proto'), 'https');
  assert.equal(headers.get('x-forwarded-port'), '443');
  assert.equal(headers.get('x-northwall-script-nonce'), 'a'.repeat(48));
  assert.equal(headers.get('content-security-policy'), 'trusted-policy');
  assert.equal(headers.get('cookie'), '__Host-northwall_session=opaque-cookie');
  assert.equal(headers.get('content-type'), 'application/json');
  assert.equal(original.bodyUsed, false);
  assert.equal(await original.text(), body);
});

test('Native method policy keeps auth POST and photo DELETE, rejects unused server actions and page writes', () => {
  for (const [path, method] of [['/api/auth/login', 'POST'], ['/api/auth/status', 'GET'], ['/api/workspace', 'POST'], ['/api/profile-photo', 'DELETE']]) assert.equal(nativeRequestRejection(request(path, { method }), path), null);
  const rejected = nativeRequestRejection(request('/en', { method: 'POST' }), '/en');
  assert.equal(rejected.status, 405);
  assert.equal(rejected.headers.get('allow'), 'GET, HEAD');
  assert.equal(nativeRequestRejection(request('/api/auth/login', { method: 'DELETE' }), '/api/auth/login').status, 405);
  assert.equal(nativeRequestRejection(request('/api/workspace', { method: 'POST', headers: { 'next-action': 'forged' } }), '/api/workspace').status, 400);
});

test('Native private responses and errors stay uncacheable and photos retain sandbox policy', () => {
  for (const path of ['/sign-in', '/workspace', '/api/auth/status', '/api/workspace', '/en']) {
    const response = applyNativeResponsePolicy(Response.json({}, { headers: { 'cache-control': 'public, max-age=3600', etag: 'stale', 'x-powered-by': 'Next.js' } }), path, 'trusted-policy', config);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(response.headers.get('etag'), null);
    assert.equal(response.headers.get('x-powered-by'), null);
    assert.equal(response.headers.get('content-security-policy'), 'trusted-policy');
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
    assert.match(response.headers.get('vary'), /Cookie/);
  }
  const photo = applyNativeResponsePolicy(new Response('image'), '/api/profile-photo', 'trusted-policy', { publicLaunch: true });
  assert.equal(photo.headers.get('content-security-policy'), "default-src 'none'; sandbox");
  assert.equal(photo.headers.get('cache-control'), 'private, no-store');
  assert.equal(photo.headers.get('x-robots-tag'), 'noindex, nofollow');
  const asset = applyNativeResponsePolicy(new Response('asset', { headers: { 'cache-control': 'public, max-age=31536000, immutable' } }), '/_next/static/chunk.js', 'trusted-policy', { publicLaunch: true });
  assert.equal(asset.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  const failure = applyNativeResponsePolicy(new Response('error', { status: 503 }), '/_next/static/chunk.js', 'trusted-policy', { publicLaunch: true });
  assert.equal(failure.headers.get('cache-control'), 'private, no-store');
  assert.equal(failure.headers.get('x-robots-tag'), 'noindex, nofollow');
});
