import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import ts from 'typescript';

// Tests the real adapters and their deferred commands. No SDK is downloaded.
// A fake load completion is used only to inspect the provider call contract.
const IDS = { meta: '123456789012345', tiktok: 'C1234567890ABCDEF1234' };
const NONCE = '0123456789abcdef0123456789abcdef0123456789abcdef';
const source = readFileSync(new URL('../lib/marketing/providers.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const plain = value => JSON.parse(JSON.stringify(value));
const event = {
  name: 'service_view', meta: 'ViewContent', tiktok: 'ViewContent', custom: false,
  properties: { page_type: 'service', service_id: 'microsoft-365' }, eventId: 'fake-event-1',
};

function browser(options = {}) {
  const scripts = [];
  const timers = new Map();
  let sequence = 0;
  const window = {
    setTimeout(callback, delay) { const id = ++sequence; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    ...options.existing,
  };
  const document = {
    querySelector(selector) { return selector === 'script[nonce]' && options.nonce !== false ? { nonce: NONCE } : null; },
    createElement(tag) {
      assert.equal(tag, 'script');
      return { removed: false, remove() { this.removed = true; } };
    },
    head: { appendChild(script) { scripts.push(script); } },
  };
  const exports = {};
  runInContext(compiled, createContext({ exports, window, document, AbortController, encodeURIComponent, Date }), {
    filename: 'lib/marketing/providers.ts',
  });
  return {
    api: exports, window, scripts, timers,
    load(provider, signal) { return exports[provider === 'meta' ? 'loadMeta' : 'loadTikTok'](IDS[provider], signal); },
    commands(provider) { return plain(provider === 'meta' ? window.fbq.queue : Array.from(window.ttq)); },
    simulateReady(provider) {
      const calls = [];
      if (provider === 'meta') window.fbq.callMethod = (...args) => calls.push(plain(args));
      else for (const method of window.ttq.methods) window.ttq[method] = (...args) => calls.push([method, ...plain(args)]);
      scripts.at(-1).onload();
      return calls;
    },
  };
}

function assertOnlyDenial(b, provider) {
  const commands = b.commands(provider);
  if (provider === 'meta') {
    assert.ok(commands.some(command => command[0] === 'consent' && command[1] === 'revoke'));
    assert.equal(commands.some(command => command[0] === 'consent' && command[1] === 'grant'), false);
    assert.equal(commands.some(command => ['init', 'track', 'trackSingle', 'trackSingleCustom'].includes(command[0])), false);
  } else {
    assert.ok(commands.some(command => command[0] === 'holdConsent'));
    assert.ok(commands.some(command => command[0] === 'revokeConsent'));
    assert.ok(commands.some(command => command[0] === 'disableCookie'));
    assert.equal(commands.some(command => ['grantConsent', 'page', 'track', 'identify'].includes(command[0])), false);
  }
}

test('adapters make no script request without the page nonce', async () => {
  for (const provider of ['meta', 'tiktok']) {
    const b = browser({ nonce: false });
    await assert.rejects(b.load(provider, new AbortController().signal), /trusted script context/);
    assert.equal(b.scripts.length, 0);
    assertOnlyDenial(b, provider);
  }
});

test('SDK scripts carry the trusted nonce and suppress the script referrer', async () => {
  for (const provider of ['meta', 'tiktok']) {
    const b = browser();
    const control = new AbortController();
    const promise = b.load(provider, control.signal);
    assert.equal(b.scripts.length, 1);
    const script = b.scripts[0];
    assert.equal(script.nonce, NONCE);
    assert.equal(script.referrerPolicy, 'no-referrer');
    assert.equal(script.async, true);
    assert.equal(script.src, provider === 'meta'
      ? 'https://connect.facebook.net/en_US/fbevents.js'
      : `https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${IDS.tiktok}&lib=ttq`);
    control.abort();
    await assert.rejects(promise, /withdrawn/);
  }
});

test('Meta initialization disables auto-configuration and passes no advanced-matching identity', async () => {
  const b = browser();
  const control = new AbortController();
  const promise = b.load('meta', control.signal);
  const commands = b.commands('meta');
  assert.deepEqual(commands, [
    ['consent', 'revoke'], ['set', 'autoConfig', false, IDS.meta], ['init', IDS.meta], ['consent', 'grant'],
  ]);
  assert.equal(b.window.fbq.disablePushState, true);
  assert.equal(b.window.fbq, b.window._fbq);
  control.abort();
  await assert.rejects(promise);
});

test('TikTok initialization disables history observation and does not queue identity or automatic page events', async () => {
  const b = browser();
  const control = new AbortController();
  const promise = b.load('tiktok', control.signal);
  assert.equal(b.window.ttq._o[IDS.tiktok].historyObserver, false);
  assert.deepEqual(b.commands('tiktok'), [['holdConsent'], ['grantConsent']]);
  assert.equal(b.window.TiktokAnalyticsObject, 'ttq');
  control.abort();
  await assert.rejects(promise);
});

test('aborting an in-flight SDK removes the script and retains denial for any late execution', async () => {
  for (const provider of ['meta', 'tiktok']) {
    const b = browser();
    const control = new AbortController();
    const promise = b.load(provider, control.signal);
    // Represents a queued provider event from an unexpected concurrent caller.
    if (provider === 'meta') b.window.fbq('trackSingle', IDS.meta, 'PageView');
    else b.window.ttq.page();
    control.abort();
    await assert.rejects(promise, /withdrawn/);
    assert.equal(b.scripts[0].removed, true);
    assert.equal(b.scripts[0].onload, null);
    assert.equal(b.timers.size, 0);
    assertOnlyDenial(b, provider);
  }
});

test('a signal already aborted before loading never appends an SDK or leaves grant commands', async () => {
  for (const provider of ['meta', 'tiktok']) {
    const b = browser();
    const control = new AbortController();
    control.abort();
    await assert.rejects(b.load(provider, control.signal), /no longer active/);
    assert.equal(b.scripts.length, 0);
    assertOnlyDenial(b, provider);
  }
});

test('script errors and timeouts leave no pending grants or events', async () => {
  for (const provider of ['meta', 'tiktok']) for (const failure of ['error', 'timeout']) {
    const b = browser();
    const promise = b.load(provider, new AbortController().signal);
    if (failure === 'error') b.scripts[0].onerror();
    else {
      const timer = [...b.timers.values()][0];
      assert.equal(timer.delay, 8000);
      timer.callback();
    }
    await assert.rejects(promise, /unavailable/);
    assert.equal(b.scripts[0].removed, true);
    assert.equal(b.timers.size, 0);
    assertOnlyDenial(b, provider);
  }
});

test('existing unknown tags are not adopted or configured', async () => {
  for (const provider of ['meta', 'tiktok']) {
    const existing = provider === 'meta' ? { fbq() {} } : { ttq: [] };
    const b = browser({ existing });
    await assert.rejects(b.load(provider, new AbortController().signal), /already installed/);
    assert.equal(b.scripts.length, 0);
    assert.equal(provider === 'meta' ? b.window.fbq : b.window.ttq, provider === 'meta' ? existing.fbq : existing.ttq);
  }
});

test('Meta uses single-pixel standard/custom events with the eventID options argument', async () => {
  const b = browser();
  const control = new AbortController();
  const promise = b.load('meta', control.signal);
  const calls = b.simulateReady('meta');
  const adapter = await promise;
  adapter.send(event);
  adapter.send({ ...event, name: 'whatsapp_click', meta: 'WhatsAppClick', custom: true });
  assert.deepEqual(calls, [
    ['trackSingle', IDS.meta, 'ViewContent', event.properties, { eventID: event.eventId }],
    ['trackSingleCustom', IDS.meta, 'WhatsAppClick', event.properties, { eventID: event.eventId }],
  ]);
  assert.equal(b.timers.size, 0);
  control.abort();
  const before = calls.length;
  adapter.send(event);
  assert.equal(calls.length, before);
});

test('TikTok receives page properties and event_id; custom/standard tracking passes options separately', async () => {
  const b = browser();
  const control = new AbortController();
  const promise = b.load('tiktok', control.signal);
  const calls = b.simulateReady('tiktok');
  const adapter = await promise;
  adapter.send({ ...event, name: 'page_view', tiktok: 'PageView' });
  adapter.send(event);
  adapter.send({ ...event, name: 'brief_download', tiktok: 'BriefDownloaded', custom: true });
  assert.deepEqual(calls, [
    ['page', { ...event.properties, event_id: event.eventId }],
    ['track', 'ViewContent', event.properties, { event_id: event.eventId }],
    ['track', 'BriefDownloaded', event.properties, { event_id: event.eventId }],
  ]);
  assert.equal(b.timers.size, 0);
  control.abort();
  const before = calls.length;
  adapter.send(event);
  assert.equal(calls.length, before);
});

test('direct adapter revocation permanently blocks future sends even without aborting the controller', async () => {
  for (const provider of ['meta', 'tiktok']) {
    const b = browser();
    const promise = b.load(provider, new AbortController().signal);
    const calls = b.simulateReady(provider);
    const adapter = await promise;
    adapter.revoke();
    const before = calls.length;
    adapter.send(event);
    assert.equal(calls.length, before, provider);
  }
});
