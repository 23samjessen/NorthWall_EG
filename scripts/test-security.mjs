import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';

const directory = await mkdtemp(join(tmpdir(), 'northwall-http-security-'));
let passed = 0;
const check = async (name, run) => { await run(); console.log(`PASS ${++passed} ${name}`); };
try {
  const source = await readFile(new URL('../lib/security-headers.ts', import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  await writeFile(join(directory, 'security.mjs'), output);
  const { requestSecurity, requestRejection, secureResponse, httpsRedirect, NONCE_HEADER } = await import(pathToFileURL(join(directory, 'security.mjs')).href);
  const request = (path = '/', options = {}) => new Request(`https://northwallegy.example${path}`, options);

  await check('production HTTP redirects to HTTPS while preserving the destination path and query', () => {
    const redirect = httpsRedirect(new Request('http://northwallegy.example/workspace?view=board', { headers: { 'X-Forwarded-Proto': 'https', 'X-Forwarded-Host': 'attacker.example' } }), true);
    assert.equal(redirect.status, 308);
    assert.equal(redirect.headers.get('location'), 'https://northwallegy.example/workspace?view=board');
  });
  await check('HTTPS does not loop and local development HTTP remains usable', () => {
    assert.equal(httpsRedirect(request('/', { headers: { 'X-Forwarded-Proto': 'http' } }), true), null);
    assert.equal(httpsRedirect(new Request('http://127.0.0.1:3000/workspace'), false), null);
  });

  await check('each production response uses an unpredictable, distinct script nonce', () => {
    const nonces = new Set(Array.from({ length: 100 }, () => requestSecurity(request(), true).nonce));
    assert.equal(nonces.size, 100);
    for (const nonce of nonces) assert.match(nonce, /^[a-f0-9]{48}$/);
  });
  await check('visitor-supplied nonce and CSP cannot control the renderer policy', () => {
    const context = requestSecurity(request('/', { headers: { [NONCE_HEADER]: 'attacker', 'Content-Security-Policy': "script-src * 'unsafe-inline'", 'Content-Security-Policy-Report-Only': "default-src *" } }), true);
    assert.notEqual(context.nonce, 'attacker');
    assert.equal(context.request.headers.get(NONCE_HEADER), context.nonce);
    assert.equal(context.request.headers.get('content-security-policy'), context.csp);
    assert.equal(context.request.headers.get('content-security-policy-report-only'), null);
    assert.ok(context.csp.includes(`'nonce-${context.nonce}'`));
    assert.ok(!context.csp.split(';').find(value => value.trim().startsWith('script-src ')).includes('unsafe-inline'));
    assert.ok(context.csp.includes("script-src-attr 'none'"));
  });
  await check('security context preserves the API body and identity gateway fields', async () => {
    const context = requestSecurity(request('/api/workspace', { method: 'POST', headers: { 'Content-Type': 'application/json', 'oai-authenticated-user-id': 'test-gateway-identity' }, body: '{"action":"test"}' }), true);
    assert.equal(await context.request.text(), '{"action":"test"}');
    assert.equal(context.request.headers.get('oai-authenticated-user-id'), 'test-gateway-identity');
  });
  await check('unused framework action dispatch is rejected before rendering', async () => {
    for (const path of ['/', '/workspace', '/api/workspace']) {
      const rejection = requestRejection(request(path, { method: 'POST', headers: { 'Next-Action': 'untrusted-action-id' }, body: 'payload' }));
      assert.equal(rejection.status, 400);
      assert.equal((await rejection.json()).error, 'unsupported_action');
    }
  });
  await check('public routes accept reads and reject unsupported writes', () => {
    for (const path of ['/', '/insights', '/api/news', '/not-a-route']) {
      assert.equal(requestRejection(request(path)), null);
      assert.equal(requestRejection(request(path, { method: 'HEAD' })), null);
      assert.equal(requestRejection(request(path, { method: 'POST', body: 'x' })).status, 405);
    }
  });
  await check('the intended workspace and portrait methods remain available', () => {
    for (const [path, method] of [['/api/workspace', 'POST'], ['/api/profile-photo', 'POST'], ['/api/profile-photo', 'DELETE']]) {
      assert.equal(requestRejection(request(path, { method, body: 'x' })), null);
    }
    assert.equal(requestRejection(request('/api/workspace', { method: 'DELETE' })).status, 405);
  });
  await check('nonced HTML is not shared or served using a previous ETag', () => {
    const context = requestSecurity(request(), true);
    const response = secureResponse(new Response('<!doctype html>', { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600', ETag: 'previous', Vary: 'RSC' } }), '/', true, context.csp, true);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(response.headers.get('etag'), null);
    assert.ok(response.headers.get('vary').includes('Cookie'));
    assert.ok(response.headers.get('vary').includes('RSC'));
    assert.equal(response.headers.get('content-security-policy'), context.csp);
  });
  await check('employee API and portrait responses stay private even if a route sets public caching', () => {
    for (const path of ['/workspace', '/api/workspace', '/api/profile-photo']) {
      const response = secureResponse(Response.json({ example: true }, { headers: { 'Cache-Control': 'public, max-age=9999' } }), path, true, "default-src 'self'", true);
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
    }
  });
  await check('all response types receive transport and browser protections without framework disclosure', () => {
    const response = secureResponse(new Response('Error', { status: 500, headers: { 'X-Powered-By': 'framework-version' } }), '/', true, "default-src 'self'", true);
    assert.equal(response.status, 500);
    assert.equal(response.headers.get('x-powered-by'), null);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('strict-transport-security'), 'max-age=31536000');
    assert.equal(response.headers.get('cross-origin-resource-policy'), 'same-origin');
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
  });
  await check('public caching and indexing policy remain explicit for ordinary static assets', () => {
    const response = secureResponse(new Response('image bytes', { headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=3600', 'X-Robots-Tag': 'noindex' } }), '/assets/example.webp', true, "default-src 'self'", false);
    assert.equal(response.headers.get('cache-control'), 'public, max-age=3600');
    assert.equal(response.headers.get('x-robots-tag'), null);
  });
  await check('the private portrait sandbox is never weakened by page headers', () => {
    const response = secureResponse(new Response('portrait', { headers: { 'Content-Type': 'image/png', 'Content-Security-Policy': "default-src 'none'; sandbox" } }), '/api/profile-photo', true, "default-src 'self'; script-src 'nonce-page'", true);
    assert.equal(response.headers.get('content-security-policy'), "default-src 'none'; sandbox");
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  });
  await check('development never trusts a visitor nonce or enables production HSTS on HTTP', () => {
    const context = requestSecurity(request('/', { headers: { [NONCE_HEADER]: 'attacker', 'Content-Security-Policy': "default-src *" } }), false);
    assert.equal(context.nonce, undefined);
    assert.equal(context.request.headers.get(NONCE_HEADER), null);
    assert.equal(context.request.headers.get('content-security-policy'), null);
    assert.equal(secureResponse(new Response('Development'), '/', false, undefined, true).headers.get('strict-transport-security'), null);
  });
  await check('a generic Node production start refuses an unconfigured identity boundary', () => {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./production-host-check.mjs', import.meta.url))], { encoding: 'utf8' });
    assert.equal(result.status, 78);
    assert.match(result.stderr, /configure NORTHWALL_RUNTIME=hostinger/);
  });
  const { invocationSchema, driverMessageSchema } = await import('./connector-preview/protocol.mjs');
  await check('updated validator accepts legitimate preview argument records and rejects extra authority fields', () => {
    const invocation = { connectorId: 'fixture', actionName: 'read', arguments: { text: 'example', limit: 3, enabled: true } };
    assert.deepEqual(invocationSchema.parse(invocation), invocation);
    assert.equal(invocationSchema.safeParse({ ...invocation, accountId: 'not-allowed' }).success, false);
    assert.equal(invocationSchema.safeParse({ ...invocation, arguments: ['not-a-record'] }).success, false);
  });
  await check('updated validator preserves strict result and stop envelopes', () => {
    const result = { jsonrpc: '2.0', id: '11111111-1111-4111-8111-111111111111', result: { items: [{ title: 'fixture' }], ok: true } };
    assert.deepEqual(driverMessageSchema.parse(result), result);
    assert.equal(driverMessageSchema.safeParse({ jsonrpc: '2.0', method: 'stop', override: true }).success, false);
    assert.deepEqual(driverMessageSchema.parse({ jsonrpc: '2.0', method: 'stop' }), { jsonrpc: '2.0', method: 'stop' });
  });
  console.log(`\n${passed} HTTP security checks passed. Tests used only local fixtures.`);
} finally {
  await rm(directory, { recursive: true, force: true });
}
