import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { request as httpRequest } from 'node:http';
import { cp, mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { fixtureOwner, fixtureEmployee, fixtureTemporaryPassword, fixtureReplacementPassword, fixtureEmployeePassword } from './native-fixture-data.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const fixtureFiles = ['auth-store.mjs', 'native-fixture.mjs', 'native-fixture-data.mjs'];

// Node's fetch replaces a caller-supplied Host with the loopback URL authority.
// Use HTTP directly so the test models a reverse proxy preserving the public Host.
function localRequest(url, {method = 'GET', headers = {}, body, signal} = {}) {
  return new Promise((resolve, reject) => {
    const request = httpRequest(url, {method, headers: Object.fromEntries(new Headers(headers)), signal}, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('error', reject);
      response.on('end', () => {
        const responseHeaders = new Headers();
        for (let index = 0; index < response.rawHeaders.length; index += 2) responseHeaders.append(response.rawHeaders[index], response.rawHeaders[index + 1]);
        const status = response.statusCode;
        const payload = method === 'HEAD' || [204, 205, 304].includes(status) ? null : Buffer.concat(chunks);
        resolve(new Response(payload, {status, headers: responseHeaders}));
      });
    });
    request.on('error', reject);
    request.end(body);
  });
}

async function unusedPort() {
  const socket = createServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
  const {port} = socket.address(); await new Promise(resolve => socket.close(resolve)); return port;
}
function isolatedEnvironment(origin, port) {
  const environment = {...process.env};
  for (const key of Object.keys(environment)) if (/^(?:DB_|SMTP_|AUTH_|NW_|OWNER_EMAIL$|ADMIN_EMAILS$|APP_ORIGIN$|PUBLIC_LAUNCH$|EDGE_HTTPS_CONFIRMED$|NORTHWALL_RUNTIME$|NODE_OPTIONS$)/.test(key)) delete environment[key];
  return {...environment, NODE_ENV: 'production', NODE_OPTIONS: '', HOSTNAME: '127.0.0.1', PORT: String(port), APP_ORIGIN: origin, PUBLIC_LAUNCH: 'false', NEXT_TELEMETRY_DISABLED: '1'};
}
async function startStandalone(directory, origin, fixture) {
  const port = await unusedPort();
  const args = fixture ? ['--import', pathToFileURL(join(directory, 'hostinger/tests/native-fixture.mjs')).href, 'server.js'] : ['server.js'];
  const child = spawn(process.execPath, args, {cwd: directory, env: isolatedEnvironment(origin, port), stdio: ['ignore', 'pipe', 'pipe', 'ipc']});
  let output = ''; const mail = [];
  child.stdout.on('data', data => { output = (output + data.toString()).slice(-12000); });
  child.stderr.on('data', data => { output = (output + data.toString()).slice(-12000); });
  child.on('message', message => { if (message?.type === 'native-fixture-mail') mail.push(message); });
  const base = `http://127.0.0.1:${port}`;
  let closed = false;
  async function stop() {
    if (closed) return; closed = true;
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit'); child.kill('SIGTERM');
      await Promise.race([exited, delay(5000)]);
      if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await exited; }
    }
  }
  try {
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null || child.signalCode !== null) throw new Error('The generated standalone server exited before accepting requests.');
      try {
        const response = await localRequest(base + '/sign-in', {headers: {Host: new URL(origin).host}, signal: AbortSignal.timeout(1200)});
        await response.arrayBuffer();
        return {base, child, mail, stop, output: () => output};
      } catch { await delay(150); }
    }
    throw new Error('The generated standalone server did not become available within 45 seconds.');
  } catch (error) { await stop(); throw error; }
}
class BrowserFixture {
  constructor(server, origin) { this.server = server; this.origin = origin; this.cookies = new Map(); }
  fork() { const copy = new BrowserFixture(this.server, this.origin); copy.cookies = new Map(this.cookies); return copy; }
  async request(path, {method = 'GET', input, headers = {}, body} = {}) {
    const incoming = new Headers({Host: new URL(this.origin).host, Cookie: [...this.cookies].map(([key, value]) => `${key}=${value}`).join('; '), ...headers});
    if (method !== 'GET' && method !== 'HEAD') {
      if (!incoming.has('Origin')) incoming.set('Origin', this.origin);
      if (!incoming.has('Sec-Fetch-Site')) incoming.set('Sec-Fetch-Site', 'same-origin');
      if (!incoming.has('Content-Type')) incoming.set('Content-Type', 'application/json');
    }
    const response = await localRequest(this.server.base + path, {method, headers: incoming, ...(method !== 'GET' && method !== 'HEAD' ? {body: body ?? JSON.stringify(input ?? {})} : {}), signal: AbortSignal.timeout(15000)});
    for (const value of response.headers.getSetCookie()) {
      const first = value.split(';')[0], separator = first.indexOf('='), key = first.slice(0, separator), raw = first.slice(separator + 1);
      if (raw) this.cookies.set(key, raw); else this.cookies.delete(key);
    }
    const text = await response.text(); let data; try { data = JSON.parse(text); } catch {}
    return {response, status: response.status, data, text};
  }
  auth(endpoint, input) { return this.request('/api/auth/' + endpoint, {method: 'POST', input}); }
}
function privateHeaders(result) {
  const cache = result.response.headers.get('cache-control') || '';
  assert.match(cache, /no-store/); assert.match(cache, /private/);
  assert.equal(result.response.headers.get('etag'), null);
  assert.equal(result.response.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.equal(result.response.headers.get('x-powered-by'), null);
}
function securityNonce(result) {
  privateHeaders(result);
  const policy = result.response.headers.get('content-security-policy') || '';
  const nonce = /nonce-([a-f0-9]{48})/.exec(policy)?.[1]; assert.ok(nonce, 'The response carries a fresh cryptographic nonce.');
  return nonce;
}
async function capturedCode(server, email, after = 0) {
  for (let i = 0; i < 30; i++) {
    const message = server.mail.slice(after).find(item => item.to === email);
    if (message) return message.code;
    await delay(20);
  }
  throw new Error('The isolated email fixture did not receive the expected code.');
}

test('relocated generated Next standalone server preserves authentication, approval, private routes and request security', {timeout: 180000}, async t => {
  const standalone = join(root, '.next/standalone');
  assert.ok((await stat(join(standalone, 'server.js'))).isFile(), 'Build the native Next upload before running this gate.');
  const manifest = JSON.parse(await readFile(join(standalone, 'hostinger-build.json'), 'utf8'));
  assert.equal(manifest.profile, 'hostinger-nextjs'); assert.equal(manifest.publicLaunch, false);
  const origin = manifest.origin;
  const temporary = await mkdtemp(join(tmpdir(), 'northwall-native-next-'));
  const relocated = join(temporary, 'application'); let server;
  try {
    await cp(standalone, relocated, {recursive: true, dereference: true});
    await mkdir(join(relocated, 'hostinger/tests'), {recursive: true});
    for (const name of fixtureFiles) await cp(join(root, 'hostinger/tests', name), join(relocated, 'hostinger/tests', name));

    await t.test('missing private settings return safe unavailable responses without blocking the sign-in shell', async () => {
      server = await startStandalone(relocated, origin, false);
      try {
        const client = new BrowserFixture(server, origin);
        const page = await client.request('/sign-in'); assert.equal(page.status, 200); assert.match(page.text, /Welcome to your workspace/); securityNonce(page);
        for (const path of ['/api/auth/status', '/api/workspace', '/api/workspace?view=audit', '/api/profile-photo?memberId=owner']) {
          const denied = await client.request(path); assert.equal(denied.status, 503, path); privateHeaders(denied);
          assert.doesNotMatch(denied.text, /(?:Missing required|DB_PASSWORD|SMTP_PASSWORD|AUTH_SECRET|node_modules|at\s+\S+\s*\()/);
        }
      } finally {
        await server.stop(); server = null;
      }
    });

    server = await startStandalone(relocated, origin, true);
    const anonymous = new BrowserFixture(server, origin), owner = new BrowserFixture(server, origin);
    await t.test('real HTML has nonce-matched scripts and relocated static/public assets load', async () => {
      const page = await anonymous.request('/sign-in'); assert.equal(page.status, 200); assert.match(page.text, /Welcome to your workspace/);
      const nonce = securityNonce(page), scripts = [...page.text.matchAll(/<script\b([^>]*)>/gi)]; assert.ok(scripts.length >= 3);
      for (const script of scripts) assert.match(script[1], new RegExp(`nonce="${nonce}"`), 'Every framework and authored script uses the response nonce.');
      const scriptPath = /<script\b[^>]*src="([^\"]*\/_next\/static\/[^\"]+)"/i.exec(page.text)?.[1]; assert.ok(scriptPath);
      const chunk = await anonymous.request(new URL(scriptPath, origin).pathname); assert.equal(chunk.status, 200); assert.match(chunk.response.headers.get('content-type') || '', /javascript/);
      const asset = await anonymous.request('/favicon.svg'); assert.equal(asset.status, 200); assert.match(asset.text, /<svg/);
      const second = await anonymous.request('/sign-in'); assert.notEqual(securityNonce(second), nonce);
    });
    await t.test('anonymous and forged identities cannot access workspace, audit, portraits or private company content', async () => {
      const forged = {'oai-authenticated-user-id': 'native-fixture-owner', 'oai-authenticated-user-email': fixtureOwner, 'x-middleware-subrequest': 'proxy:proxy:proxy:proxy:proxy', 'x-forwarded-host': new URL(origin).host, 'x-forwarded-proto': 'https', forwarded: `host=${new URL(origin).host};proto=https`, 'x-northwall-script-nonce': 'forged', 'content-security-policy': "script-src *"};
      for (const path of ['/api/workspace', '/api/workspace?view=audit', '/api/profile-photo?memberId=owner']) {
        for (const headers of [{}, forged]) { const denied = await anonymous.request(path, {headers}); assert.equal(denied.status, 401, path); privateHeaders(denied); }
      }
      const workspace = await anonymous.request('/workspace'); assert.ok([303, 307].includes(workspace.status)); assert.match(workspace.response.headers.get('location') || '', /\/sign-in/);
      for (const path of ['/', '/en', '/insights', '/api/news']) {
        const denied = await anonymous.request(path); assert.ok([303, 307, 401].includes(denied.status), path);
        if (denied.status !== 401) assert.match(denied.response.headers.get('location') || '', /\/sign-in/);
        privateHeaders(denied);
      }
      const badHost = await anonymous.request('/api/workspace', {headers: {Host: 'untrusted.example.test', 'x-forwarded-host': new URL(origin).host}}); assert.equal(badHost.status, 400);
      const forgedOrigin = await anonymous.request('/api/auth/login', {method: 'POST', headers: {Origin: 'https://untrusted.example.test', 'x-forwarded-host': 'untrusted.example.test', 'x-forwarded-proto': 'https'}, input: {email: fixtureOwner, password: fixtureTemporaryPassword}}); assert.equal(forgedOrigin.status, 403);
    });
    await t.test('temporary owner requires password, one-use email code and a new password before protected access', async () => {
      const mailBefore = server.mail.length;
      const login = await owner.auth('login', {email: fixtureOwner, password: fixtureTemporaryPassword}); assert.equal(login.status, 200); assert.equal(login.data.step, 'verify_email');
      assert.ok(login.response.headers.getSetCookie().length >= 2, 'Pending and cleared-session cookies remain separate.');
      for (const cookie of login.response.headers.getSetCookie()) { assert.match(cookie, /; Secure/i); assert.match(cookie, /; HttpOnly/i); assert.doesNotMatch(cookie, /; Domain=/i); }
      assert.equal((await owner.request('/api/workspace')).status, 401);
      const stale = owner.fork(), code = await capturedCode(server, fixtureOwner, mailBefore);
      const verified = await owner.auth('verify', {code}); assert.equal(verified.status, 200); assert.equal(verified.data.step, 'change_password');
      assert.equal((await owner.request('/api/workspace')).status, 401);
      assert.equal((await stale.auth('verify', {code})).status, 400);
      const changed = await owner.auth('password', {password: fixtureReplacementPassword}); assert.equal(changed.status, 200); assert.equal(changed.data.step, 'complete');
      const status = await owner.request('/api/auth/status'); assert.equal(status.status, 200); assert.equal(status.data.authenticated, true); assert.equal(status.data.email, fixtureOwner);
      const body = await owner.request('/api/workspace', {method: 'POST', input: {action: '', payload: {}, revision: 0}}); assert.equal(body.status, 400); assert.equal(body.data.code, 'invalid_input');
      const cross = await owner.request('/api/workspace', {method: 'POST', input: {action: '', payload: {}, revision: 0}, headers: {Origin: 'https://untrusted.example.test', 'Sec-Fetch-Site': 'cross-site'}}); assert.equal(cross.status, 403);
    });
    await t.test('real workspace mutations preserve invitation, employee approval and admin boundaries through native routes', async () => {
      let result = await owner.request('/api/workspace', {method: 'POST', input: {action: 'workspace.initialize', payload: {}, revision: 0}}); assert.equal(result.status, 200); let snapshot = result.data;
      result = await owner.request('/api/workspace', {method: 'POST', input: {action: 'member.invite', payload: {name: 'Native fixture employee', email: fixtureEmployee, jobTitle: 'Fixture only'}, revision: snapshot.revision}}); assert.equal(result.status, 200); snapshot = result.data;
      const member = snapshot.state.users.find(item => item.email === fixtureEmployee); assert.ok(member);
      const employee = new BrowserFixture(server, origin), mailBefore = server.mail.length;
      assert.equal((await employee.auth('enroll', {email: fixtureEmployee})).status, 200);
      const code = await capturedCode(server, fixtureEmployee, mailBefore);
      assert.equal((await employee.auth('verify', {code})).data.step, 'set_password');
      assert.equal((await employee.auth('password', {password: fixtureEmployeePassword})).data.step, 'complete');
      assert.equal((await employee.request('/api/workspace')).status, 403);
      const invitation = await employee.request('/api/workspace?view=onboarding'); assert.equal(invitation.status, 200); assert.equal(invitation.data.status, 'invited');
      const accepted = await employee.request('/api/workspace', {method: 'POST', input: {action: 'invitation.accept', payload: {invitationId: invitation.data.invitationId}}}); assert.equal(accepted.status, 200);
      assert.equal((await employee.request('/api/workspace')).status, 403);
      snapshot = (await owner.request('/api/workspace')).data;
      result = await owner.request('/api/workspace', {method: 'POST', input: {action: 'member.approve', payload: {id: member.id}, revision: snapshot.revision}}); assert.equal(result.status, 200); snapshot = result.data;
      const approved = await employee.request('/api/workspace'); assert.equal(approved.status, 200); assert.equal(approved.data.user.id, member.id); assert.equal(approved.data.user.role, 'employee');
      const forged = {'oai-authenticated-user-id': 'native-fixture-owner', 'oai-authenticated-user-email': fixtureOwner};
      assert.equal((await employee.request('/api/workspace?view=audit', {headers: forged})).status, 403);
      const escalated = await employee.request('/api/workspace', {method: 'POST', headers: forged, input: {action: 'member.update', payload: {id: member.id, role: 'admin'}, revision: snapshot.revision}}); assert.equal(escalated.status, 403);
      const audit = await owner.request('/api/workspace?view=audit'); assert.equal(audit.status, 200); assert.equal(audit.data.chainValid, true);
    });
    await t.test('uninvited enrollment sends no code and logout invalidates copied sessions', async () => {
      const outsider = new BrowserFixture(server, origin), count = server.mail.length;
      const response = await outsider.auth('enroll', {email: 'not-invited@example.test'}); assert.equal(response.status, 200); assert.equal(response.data.step, 'verify_email');
      await delay(50); assert.equal(server.mail.length, count);
      assert.equal((await outsider.auth('verify', {code: '123456'})).status, 400); assert.equal((await outsider.request('/api/workspace')).status, 401);
      const copied = owner.fork(); assert.equal((await owner.auth('logout', {})).status, 200);
      assert.equal((await owner.request('/api/workspace')).status, 401); assert.equal((await copied.request('/api/workspace')).status, 401);
    });
  } finally {
    if (server) await server.stop();
    await rm(temporary, {recursive: true, force: true});
  }
});
