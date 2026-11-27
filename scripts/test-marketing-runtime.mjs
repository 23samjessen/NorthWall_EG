import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import ts from 'typescript';
import * as policy from '../lib/marketing/policy.mjs';

// Executes the actual controller in a deterministic, network-free browser harness.
// Provider loaders are deliberately deferred: consent can change while they load.
const ORIGIN = 'https://northwallegy.com';
const NOW = Date.UTC(2026, 10, 26, 12);
const ENV = {
  NEXT_PUBLIC_MARKETING_ENABLED: 'true',
  NEXT_PUBLIC_META_PIXEL_ID: '123456789012345',
  NEXT_PUBLIC_TIKTOK_PIXEL_ID: 'C1234567890ABCDEF1234',
  NEXT_PUBLIC_META_MANUAL_MODE_CONFIRMED: 'true',
  NEXT_PUBLIC_TIKTOK_MANUAL_MODE_CONFIRMED: 'true',
};
const CONFIG = policy.readMarketingConfig(ENV);
const GUIDES = ['microsoft-365-security-basics'];
const CAMPAIGNS = ['m365-eg', 'cyber-eg', 'northwall-eg'];
const MAX_TIMER = 2147483647;
const CHANGE_KEY = 'nw.marketing.consent-change';
const source = readFileSync(new URL('../lib/marketing/runtime.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function decision(choices = { meta: true, tiktok: true }, config = CONFIG, when = NOW) {
  return policy.createConsent(choices, config, when);
}

class Events {
  handlers = new Map();
  addEventListener(type, callback) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type).add(callback);
  }
  removeEventListener(type, callback) { this.handlers.get(type)?.delete(callback); }
  dispatchEvent(event) {
    for (const callback of this.handlers.get(event.type) || []) callback(event);
    return true;
  }
  emit(type, fields = {}) { this.dispatchEvent({ type, ...fields }); }
}

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

function browser(options = {}) {
  let now = options.now ?? NOW;
  let sequence = 0;
  let url = new URL(options.path ?? '/', ORIGIN);
  let reloads = 0;
  let cookieReadsThrow = Boolean(options.cookieReadsThrow);
  let cookieWritesFail = options.cookieWritesFail || false;
  const cookies = new Map();
  const writes = [];
  const timeouts = new Map();
  const intervals = new Map();
  const config = options.config ?? CONFIG;
  const loads = [];
  const sends = [];
  const revokes = [];
  const local = memoryStorage(options.localStorage);
  const session = memoryStorage(options.sessionStorage);
  const window = new Events();
  const document = new Events();
  const navigator = { globalPrivacyControl: options.gpc ?? false, doNotTrack: options.dnt ?? null };
  const seed = (name, value) => cookies.set(name, { value: encodeURIComponent(value), expiresAt: Infinity });
  if (options.decision) seed(policy.CONSENT_COOKIE, JSON.stringify(options.decision));
  for (const [name, value] of Object.entries(options.cookies || {})) seed(name, value);
  Object.defineProperty(document, 'cookie', {
    get() {
      if (cookieReadsThrow) throw new Error('Cookie storage access is blocked.');
      for (const [name, entry] of cookies) if (entry.expiresAt <= now) cookies.delete(name);
      return [...cookies].map(([name, entry]) => `${name}=${entry.value}`).join('; ');
    },
    set(value) {
      if (cookieWritesFail === 'throw') throw new Error('Cookie writes are blocked.');
      if (cookieWritesFail) return;
      writes.push(value);
      const [pair, ...attributes] = value.split(';');
      const equals = pair.indexOf('=');
      const name = pair.slice(0, equals);
      const encoded = pair.slice(equals + 1);
      const maxAge = attributes.find(item => item.trim().toLowerCase().startsWith('max-age='));
      const age = maxAge ? Number(maxAge.split('=')[1]) : Infinity;
      if (age <= 0) cookies.delete(name);
      else cookies.set(name, { value: encoded, expiresAt: now + age * 1000 });
    },
  });
  document.referrer = options.referrer ?? '';
  document.visibilityState = 'visible';
  document.documentElement = { scrollHeight: 4000 };
  document.querySelector = selector => {
    if (selector === 'meta[name="northwall-marketing-eligible"]') return { content: options.eligible === false ? '0' : '1' };
    if (selector === 'meta[name="northwall-marketing-vendors"]') return { content: options.vendors ?? 'meta,tiktok' };
    return null;
  };
  const location = { reload() { reloads++; } };
  for (const field of ['href', 'origin', 'pathname', 'hostname', 'protocol', 'hash', 'search']) {
    Object.defineProperty(location, field, { get: () => url[field] });
  }
  window.location = location;
  window.history = { state: null, replaceState(state, _title, next) { this.state = state; url = new URL(next, url); } };
  window.innerHeight = 800;
  window.scrollY = 0;
  window.setTimeout = (callback, delay) => {
    const id = ++sequence;
    timeouts.set(id, { callback, delay, due: now + delay });
    return id;
  };
  window.clearTimeout = id => timeouts.delete(id);
  window.setInterval = (callback, delay) => {
    const id = ++sequence;
    intervals.set(id, { callback, delay });
    return id;
  };
  window.clearInterval = id => intervals.delete(id);
  for (const [name, storage] of [['localStorage', local], ['sessionStorage', session]]) {
    Object.defineProperty(window, name, { get() {
      if (options.storageGettersThrow) throw new Error('Storage getter blocked by browser policy.');
      return storage;
    } });
  }
  function load(provider, id, signal) {
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    const adapter = {
      send(event) { sends.push({ provider, event: JSON.parse(JSON.stringify(event)) }); },
      revoke() { revokes.push(provider); },
    };
    loads.push({ provider, id, signal, resolve: () => resolve(adapter), reject });
    return promise;
  }
  class ClockDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  const exports = {};
  const sandbox = {
    exports, window, document, navigator, URL, URLSearchParams, AbortController,
    Event: class { constructor(type) { this.type = type; } },
    Element: class {}, Date: ClockDate,
    crypto: { randomUUID: () => `test-event-${++sequence}` },
    setTimeout: window.setTimeout, clearTimeout: window.clearTimeout,
    setInterval: window.setInterval, clearInterval: window.clearInterval,
    requestAnimationFrame: callback => callback(),
    require(name) {
      if (name === './config') return { marketingConfig: config, marketingGuideSlugs: GUIDES, marketingCampaigns: CAMPAIGNS };
      if (name === './providers') return { loadMeta: (id, signal) => load('meta', id, signal), loadTikTok: (id, signal) => load('tiktok', id, signal) };
      if (name === './policy.mjs') return {
        ...policy,
        createConsent: (choices, current, timestamp = now) => policy.createConsent(choices, current, timestamp),
        parseConsent: (raw, current, timestamp = now) => policy.parseConsent(raw, current, timestamp),
      };
      throw new Error(`Unexpected import: ${name}`);
    },
  };
  for (const name of ['localStorage', 'sessionStorage']) {
    Object.defineProperty(sandbox, name, { get: () => window[name] });
  }
  runInContext(compiled, createContext(sandbox), { filename: 'lib/marketing/runtime.ts' });
  return {
    api: exports, window, document, navigator, loads, sends, revokes, writes, local, session,
    get reloads() { return reloads; },
    get now() { return now; },
    get pendingTimeouts() { return [...timeouts.values()].map(timer => ({ delay: timer.delay, due: timer.due })); },
    start() { return exports.startMarketing(() => {}); },
    setCookie(name, value) { seed(name, value); },
    getCookie(name) { return policy.cookieValue(document.cookie, name); },
    setCookieReadFailure(value) { cookieReadsThrow = value; },
    setCookieWriteFailure(value) { cookieWritesFail = value; },
    navigate(path) { url = new URL(path, url); },
    async settle() { await Promise.resolve(); await Promise.resolve(); },
    async resolveProviders() { for (const item of loads) item.resolve(); await this.settle(); },
    fireInterval(delay) {
      const timer = [...intervals.values()].find(item => item.delay === delay);
      assert.ok(timer, `Expected a ${delay} ms consent watchdog.`);
      now += delay; timer.callback();
    },
    fireNextTimeout() {
      const entry = [...timeouts.entries()].sort((a, b) => a[1].due - b[1].due)[0];
      assert.ok(entry, 'Expected a pending consent-expiry timer.');
      const [id, timer] = entry;
      timeouts.delete(id); now = timer.due; timer.callback();
      return timer.delay;
    },
  };
}

test('no decision, expired consent and disabled provider configuration never load a provider', () => {
  const expired = decision(undefined, CONFIG, NOW - (policy.CONSENT_MAX_AGE + 1) * 1000);
  const disabled = policy.readMarketingConfig({ ...ENV, NEXT_PUBLIC_META_PIXEL_ID: '', NEXT_PUBLIC_TIKTOK_PIXEL_ID: '' });
  for (const options of [{}, { decision: expired }, { config: disabled, decision: decision(undefined, disabled) }]) {
    const b = browser(options);
    b.start();
    b.api.trackMarketingEvent('service_view', { serviceId: 'microsoft-365' });
    assert.equal(b.loads.length, 0);
    assert.equal(b.sends.length, 0);
    assert.equal(b.api.getMarketingSnapshot().ready, true);
  }
});

test('protected or unknown routes, server-ineligible documents and unsafe context suppress loading', () => {
  const cases = [
    { path: '/workspace' }, { path: '/sign-in' }, { path: '/api/workspace' },
    { path: '/insights/private-employee-note' }, { path: '/', eligible: false },
    { path: '/?email=employee%40example.test' },
    { referrer: ORIGIN + '/workspace' }, { referrer: ORIGIN + '/?email=employee%40example.test' },
    { path: 'http://northwallegy.com/' },
  ];
  for (const options of cases) {
    const b = browser({ decision: decision(), ...options });
    b.start();
    b.api.trackMarketingEvent('page_view');
    assert.equal(b.loads.length, 0, JSON.stringify(options));
    assert.equal(b.sends.length, 0);
  }
});

test('server-denied vendors cannot be enabled by changing only the client cookie', () => {
  const b = browser({ decision: decision(), vendors: '' });
  b.start();
  b.api.trackMarketingEvent('whatsapp_click');
  assert.equal(b.loads.length, 0);
  assert.equal(b.sends.length, 0);
});

test('each provider requires its own consent and receives only post-consent events', async () => {
  for (const provider of ['meta', 'tiktok']) {
    const b = browser({ decision: decision({ meta: provider === 'meta', tiktok: provider === 'tiktok' }) });
    b.start();
    assert.deepEqual(b.loads.map(item => item.provider), [provider]);
    assert.equal(b.sends.length, 0, 'Events wait for SDK readiness.');
    await b.resolveProviders();
    b.api.trackMarketingEvent('whatsapp_click');
    assert.deepEqual(b.sends.map(item => [item.provider, item.event.name]), [[provider, 'page_view'], [provider, 'whatsapp_click']]);
  }
});

test('interactions before consent are never replayed after the consent refresh', async () => {
  const first = browser({ vendors: '' });
  first.start();
  first.api.trackMarketingEvent('service_view', { serviceId: 'cyber-defense' });
  first.api.trackMarketingEvent('whatsapp_click');
  assert.equal(first.api.saveMarketingConsent({ meta: true, tiktok: false }).saved, true);
  assert.equal(first.reloads, 1);
  assert.equal(first.loads.length, 0, 'Saving does not loosen the old document CSP or start an SDK.');
  const second = browser({ decision: JSON.parse(first.getCookie(policy.CONSENT_COOKIE)), vendors: 'meta' });
  second.start();
  await second.resolveProviders();
  assert.deepEqual(second.sends.map(item => item.event.name), ['page_view']);
});

test('withdrawal aborts pending loads and discards events even if the SDK resolves late', async () => {
  const b = browser({ decision: decision() });
  b.start();
  b.api.trackMarketingEvent('service_view', { serviceId: 'cyber-defense' });
  assert.equal(b.api.saveMarketingConsent({ meta: false, tiktok: false }).saved, true);
  assert.equal(b.reloads, 1);
  assert.ok(b.loads.every(item => item.signal.aborted));
  await b.resolveProviders();
  b.api.trackMarketingEvent('whatsapp_click');
  assert.equal(b.sends.length, 0);
  assert.deepEqual(b.revokes.sort(), ['meta', 'tiktok']);
});

test('withdrawal revokes ready adapters and removes advertising storage only', async () => {
  const b = browser({
    decision: decision(),
    cookies: { _fbp: 'fake-meta', _ttp: 'fake-tiktok', __Host_nw_other: 'essential-example' },
    localStorage: { _fbp: 'fake', 'nw-design-theme': 'limestone', essential: 'keep' },
    sessionStorage: { ttcsid_123: 'fake', workflow: 'keep' },
  });
  b.start();
  await b.resolveProviders();
  const before = b.sends.length;
  assert.equal(b.api.saveMarketingConsent({ meta: false, tiktok: false }).saved, true);
  b.api.trackMarketingEvent('email_click');
  assert.equal(b.sends.length, before);
  assert.deepEqual(b.revokes.sort(), ['meta', 'tiktok']);
  assert.equal(b.getCookie('_fbp'), null);
  assert.equal(b.getCookie('_ttp'), null);
  assert.equal(b.getCookie('__Host_nw_other'), 'essential-example');
  assert.equal(b.local.getItem('nw-design-theme'), 'limestone');
  assert.equal(b.local.getItem('essential'), 'keep');
  assert.equal(b.local.getItem('_fbp'), null);
  assert.equal(b.session.getItem('ttcsid_123'), null);
  assert.equal(b.session.getItem('workflow'), 'keep');
});

test('throwing browser storage getters do not crash initialization or withdrawal', async () => {
  const b = browser({ decision: decision(), storageGettersThrow: true });
  assert.doesNotThrow(() => b.start());
  await b.resolveProviders();
  assert.equal(b.api.saveMarketingConsent({ meta: false, tiktok: false }).saved, true);
  assert.ok(b.loads.every(item => item.signal.aborted));
  assert.equal(b.api.getMarketingSnapshot().ready, true);
  assert.equal(b.reloads, 1);
  const empty = browser({ storageGettersThrow: true });
  assert.doesNotThrow(() => empty.start());
  assert.equal(empty.loads.length, 0);
});

test('unreadable cookies fail closed; failed withdrawal stops this document without false success', async () => {
  const blocked = browser({ decision: decision(), cookieReadsThrow: true });
  blocked.start();
  assert.equal(blocked.loads.length, 0);
  assert.equal(blocked.api.getMarketingSnapshot().storageAvailable, false);
  assert.equal(blocked.api.saveMarketingConsent({ meta: true, tiktok: true }).saved, false);
  for (const failure of [true, 'throw']) {
    const b = browser({ decision: decision() });
    b.start(); await b.resolveProviders();
    const before = b.sends.length;
    b.setCookieWriteFailure(failure);
    assert.equal(b.api.saveMarketingConsent({ meta: false, tiktok: false }).saved, false);
    b.api.trackMarketingEvent('whatsapp_click');
    assert.ok(b.loads.every(item => item.signal.aborted));
    assert.equal(b.sends.length, before);
    assert.equal(b.api.getMarketingSnapshot().storageAvailable, false);
  }
});

test('GPC and DNT keep providers off without repeated focus reloads', () => {
  for (const signal of [{ gpc: true }, { dnt: '1' }]) {
    const b = browser({ decision: decision(), ...signal });
    b.start();
    for (let index = 0; index < 3; index++) {
      b.window.emit('focus'); b.document.emit('visibilitychange');
    }
    assert.equal(b.loads.length, 0);
    assert.equal(b.reloads, 0);
    assert.equal(b.api.getMarketingSnapshot().choices.meta, false);
    assert.equal(b.api.getMarketingSnapshot().choices.tiktok, false);
  }
});

test('a newly enabled privacy signal revokes loaded vendors before a refresh', async () => {
  const b = browser({ decision: decision() });
  b.start(); await b.resolveProviders();
  const before = b.sends.length;
  b.navigator.globalPrivacyControl = true;
  b.window.emit('focus');
  b.api.trackMarketingEvent('phone_click');
  assert.equal(b.reloads, 1);
  assert.ok(b.loads.every(item => item.signal.aborted));
  assert.equal(b.sends.length, before);
});

test('cross-tab withdrawal stops pending SDKs and does not replay queued events', async () => {
  const b = browser({ decision: decision() });
  b.start();
  b.api.trackMarketingEvent('brief_download');
  b.setCookie(policy.CONSENT_COOKIE, JSON.stringify(decision({ meta: false, tiktok: false })));
  b.window.emit('storage', { key: CHANGE_KEY });
  await b.resolveProviders();
  assert.equal(b.reloads, 1);
  assert.ok(b.loads.every(item => item.signal.aborted));
  assert.equal(b.sends.length, 0);
});

test('cross-tab withdrawal is detected without localStorage events or a focus change', async () => {
  const b = browser({ decision: decision(), storageGettersThrow: true });
  b.start();
  b.api.trackMarketingEvent('brief_download');
  b.setCookie(policy.CONSENT_COOKIE, JSON.stringify(decision({ meta: false, tiktok: false })));
  // No storage/focus event: the active document must observe the changed cookie.
  b.fireInterval(2000);
  await b.resolveProviders();
  assert.equal(b.reloads, 1);
  assert.ok(b.loads.every(item => item.signal.aborted));
  assert.equal(b.sends.length, 0);
});

test('long-duration consent expiry is rescheduled and ultimately revokes providers', async () => {
  const b = browser({ decision: decision() });
  b.start(); await b.resolveProviders();
  assert.equal(b.pendingTimeouts[0].delay, MAX_TIMER);
  assert.equal(b.fireNextTimeout(), MAX_TIMER);
  assert.equal(b.reloads, 0);
  assert.equal(b.pendingTimeouts.length, 1, 'The remaining expiry must be scheduled again.');
  let iterations = 0;
  while (!b.reloads && iterations++ < 10) b.fireNextTimeout();
  assert.equal(b.reloads, 1);
  assert.equal(b.now, NOW + policy.CONSENT_MAX_AGE * 1000);
  assert.ok(b.loads.every(item => item.signal.aborted));
  assert.equal(b.pendingTimeouts.length, 0);
});

test('pagehide stops pending providers and bfcache restoration requires a fresh document', async () => {
  const b = browser({ decision: decision() });
  b.start();
  b.window.emit('pagehide', { persisted: true });
  await b.resolveProviders();
  assert.ok(b.loads.every(item => item.signal.aborted));
  assert.equal(b.sends.length, 0);
  b.window.emit('pageshow', { persisted: true });
  assert.equal(b.reloads, 1);
});

test('unsafe hash and private history navigation revoke active providers', async () => {
  for (const [path, event] of [['/#email=employee@example.test', 'hashchange'], ['/workspace', 'popstate']]) {
    const b = browser({ decision: decision() });
    b.start(); await b.resolveProviders();
    const before = b.sends.length;
    b.navigate(path); b.window.emit(event);
    b.api.trackMarketingEvent('page_view');
    assert.ok(b.loads.every(item => item.signal.aborted));
    assert.equal(b.sends.length, before);
    assert.equal(b.reloads, 1);
  }
});

test('provider load failures never retry or flush queued interactions', async () => {
  const b = browser({ decision: decision() });
  b.start();
  b.api.trackMarketingEvent('whatsapp_click');
  for (const item of b.loads) item.reject(new Error('Simulated blocked SDK.'));
  await b.settle();
  b.api.trackMarketingEvent('brief_download');
  assert.ok(b.loads.every(item => item.signal.aborted));
  assert.equal(b.loads.length, 2);
  assert.equal(b.sends.length, 0);
});

test('ineligible documents cannot collect advertising attribution when preferences are saved', () => {
  const path = '/?utm_source=facebook&utm_medium=paid_social&utm_campaign=m365-eg&fbclid=ABCDEFGHIJKLMNOPQRSTUVWXYZ123456';
  for (const context of [{ eligible: false }, { referrer: ORIGIN + '/workspace' }]) {
    const b = browser({ path, vendors: '', ...context });
    b.start();
    assert.equal(b.api.saveMarketingConsent({ meta: true, tiktok: false }).saved, true);
    assert.equal(b.loads.length, 0);
    assert.equal(b.getCookie(policy.CAMPAIGN_COOKIE), null);
    assert.equal(b.getCookie('_fbc'), null);
  }
});
