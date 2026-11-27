'use client';

import { marketingConfig, marketingGuideSlugs, marketingCampaigns } from './config';
import { loadMeta, loadTikTok, type MarketingProvider } from './providers';
import {
  CONSENT_COOKIE, CAMPAIGN_COOKIE, CONSENT_MAX_AGE, CAMPAIGN_MAX_AGE, CONSENT_VERSION,
  createConsent, parseConsent, cookieValue, publicRoute, isPrivacySignal,
  campaignFromUrl, safeMarketingLocation, safeMarketingReferrer, cleanEvent,
} from './policy.mjs';

export const COOKIE_SETTINGS_EVENT = 'nw:cookie-settings';
const CHANGE_KEY = 'nw.marketing.consent-change';
type Choices = { meta: boolean; tiktok: boolean };
export type MarketingSnapshot = {
  ready: boolean; hasDecision: boolean; choices: Choices; available: Choices;
  privacySignal: boolean; storageAvailable: boolean; expiresAt: number | null;
};
export type MarketingEventName = 'page_view' | 'service_view' | 'enquiry_open' | 'brief_download' |
  'whatsapp_click' | 'phone_click' | 'email_click' | 'engaged_visit' | 'scroll_depth';
type Campaign = { source: string; medium: string; campaign: string; expiresAt: number };
type PreparedEvent = NonNullable<ReturnType<typeof cleanEvent>> & { eventId: string };

let snapshot: MarketingSnapshot = {
  ready: false, hasDecision: false, choices: { meta: false, tiktok: false },
  available: { meta: marketingConfig.meta.enabled, tiktok: marketingConfig.tiktok.enabled },
  privacySignal: false, storageAvailable: true, expiresAt: null,
};
const listeners = new Set<() => void>();
const providers: Partial<Record<keyof Choices, MarketingProvider>> = {};
const controllers: Partial<Record<keyof Choices, AbortController>> = {};
const waiting: Record<keyof Choices, PreparedEvent[]> = { meta: [], tiktok: [] };
const deduplicated = new Set<string>();
let booted = false;
let stopped = false;
let campaign: Campaign | null = null;
let storedDecision = '';
let expiryTimer: ReturnType<typeof setTimeout> | undefined;
let changeTimer: ReturnType<typeof setInterval> | undefined;

function publish() { for (const listener of listeners) listener(); }
function browserSignal() {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };
  return isPrivacySignal(nav.globalPrivacyControl) || isPrivacySignal(nav.doNotTrack) || isPrivacySignal(nav.msDoNotTrack);
}
function documentEligible() {
  return window.location.protocol === 'https:' && document.querySelector<HTMLMetaElement>('meta[name="northwall-marketing-eligible"]')?.content === '1';
}
function documentVendors(): Choices {
  const permitted = (document.querySelector<HTMLMetaElement>('meta[name="northwall-marketing-vendors"]')?.content || '').split(',');
  return { meta: permitted.includes('meta'), tiktok: permitted.includes('tiktok') };
}
function browserCookies() {
  try { return document.cookie; }
  catch { snapshot = { ...snapshot, storageAvailable: false }; return ''; }
}
function readDecision() { return parseConsent(cookieValue(browserCookies(), CONSENT_COOKIE), marketingConfig); }
function setCookie(name: string, value: string, seconds: number) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${seconds}; SameSite=Lax; Secure`;
}
function reloadCleanDocument() { window.location.reload(); }
function stopProviders() {
  stopped = true;
  if (expiryTimer) clearTimeout(expiryTimer);
  if (changeTimer) clearInterval(changeTimer);
  for (const key of ['meta', 'tiktok'] as const) {
    try { providers[key]?.revoke(); } catch {}
    controllers[key]?.abort();
    delete providers[key]; waiting[key].length = 0;
  }
}

/** Only known advertising storage is removed; employee sessions/design choice survive. */
function clearMarketingStorage() {
  campaign = null;
  const matches = (name: string) => ['_fbp', '_fbc', '_ttp', '_tt_enable_cookie', 'ttclid', CAMPAIGN_COOKIE].includes(name) || /^ttcsid(?:_|$)/.test(name);
  const names = browserCookies().split(';').map(part => part.trim().split('=')[0]).filter(matches);
  if (!names.includes(CAMPAIGN_COOKIE)) names.push(CAMPAIGN_COOKIE);
  const host = window.location.hostname;
  const domains = new Set([host, host.replace(/^www\./, '')]);
  for (const name of names) {
    try {
      document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax; Secure`;
      if (!name.startsWith('__Host-')) for (const domain of domains) {
        document.cookie = `${name}=; Path=/; Domain=${domain}; Max-Age=0; SameSite=Lax; Secure`;
        document.cookie = `${name}=; Path=/; Domain=.${domain}; Max-Age=0; SameSite=Lax; Secure`;
      }
    } catch { /* Cookie restrictions must not prevent withdrawal in this document. */ }
  }
  for (const name of ['localStorage', 'sessionStorage'] as const) {
    try {
      const storage = window[name];
      for (let index = storage.length - 1; index >= 0; index--) {
        const key = storage.key(index);
        if (key && (matches(key) || key.startsWith('ttcsid_'))) storage.removeItem(key);
      }
    } catch { /* Storage restrictions must not affect the website. */ }
  }
}

function syncSnapshot() {
  const decision = readDecision();
  snapshot = { ...snapshot, ready: true, hasDecision: Boolean(decision), privacySignal: browserSignal(),
    choices: decision?.choices || { meta: false, tiktok: false }, expiresAt: decision?.expiresAt || null };
  if (snapshot.privacySignal || !snapshot.storageAvailable) snapshot.choices = { meta: false, tiktok: false };
  publish();
}

function announceChange() {
  try { localStorage.setItem(CHANGE_KEY, JSON.stringify({ changedAt: Date.now(), nonce: crypto.randomUUID() })); } catch {}
}

function captureConsentedCampaign() {
  if (!(snapshot.choices.meta || snapshot.choices.tiktok)) return;
  const url = new URL(window.location.href);
  const current = campaignFromUrl(url.href, marketingCampaigns);
  if (current) {
    campaign = { ...current, expiresAt: Date.now() + CAMPAIGN_MAX_AGE * 1000 };
    setCookie(CAMPAIGN_COOKIE, JSON.stringify(campaign), CAMPAIGN_MAX_AGE);
  } else {
    try {
      const saved = JSON.parse(cookieValue(browserCookies(), CAMPAIGN_COOKIE) || 'null');
      const check = saved && campaignFromUrl('https://campaign.invalid/?' + new URLSearchParams({ utm_source: saved.source, utm_medium: saved.medium, utm_campaign: saved.campaign }), marketingCampaigns);
      if (check && Number.isSafeInteger(saved.expiresAt) && saved.expiresAt > Date.now() && saved.expiresAt <= Date.now() + CAMPAIGN_MAX_AGE * 1000) campaign = { ...check, expiresAt: saved.expiresAt };
    } catch { campaign = null; }
  }
  // Genuine platform click IDs are stored only after consent for that provider.
  const fbclid = url.searchParams.get('fbclid');
  if (snapshot.choices.meta && fbclid && /^[A-Za-z0-9_-]{20,512}$/.test(fbclid)) setCookie('_fbc', `fb.1.${Date.now()}.${fbclid}`, 90 * 24 * 60 * 60);
  const ttclid = url.searchParams.get('ttclid');
  if (snapshot.choices.tiktok && ttclid && /^[A-Za-z0-9_-]{20,512}$/.test(ttclid)) setCookie('ttclid', ttclid, CAMPAIGN_MAX_AGE);
  // All accepted parameters are known campaign/click identifiers. SDKs see the
  // clean page URL; unknown parameters are neither removed nor tracked.
  if (url.search) window.history.replaceState(window.history.state, '', url.pathname + url.hash);
}

function eligibleContext() {
  return documentEligible() && !browserSignal() && snapshot.storageAvailable &&
    Boolean(publicRoute(window.location.pathname, marketingGuideSlugs)) &&
    safeMarketingLocation(window.location.href, marketingCampaigns) &&
    safeMarketingReferrer(document.referrer, window.location.origin, marketingGuideSlugs);
}
function eligibleNow() { return !stopped && eligibleContext(); }

export function trackMarketingEvent(name: MarketingEventName, details: { serviceId?: string; percent?: number } = {}) {
  if (!booted || !eligibleNow()) return;
  const consent = readDecision();
  if (!consent) return;
  const route = publicRoute(window.location.pathname, marketingGuideSlugs);
  const prepared = cleanEvent(name, details, route, campaign && campaign.expiresAt > Date.now() ? campaign : null, marketingCampaigns);
  if (!prepared) return;
  const key = `${name}|${details.serviceId || ''}|${details.percent || ''}`;
  if (['page_view', 'service_view', 'engaged_visit', 'scroll_depth'].includes(name)) {
    if (deduplicated.has(key)) return;
    deduplicated.add(key);
  }
  const event: PreparedEvent = { ...prepared, eventId: crypto.randomUUID() };
  const allowed = documentVendors();
  for (const provider of ['meta', 'tiktok'] as const) {
    if (!consent.choices[provider] || !allowed[provider] || !controllers[provider]) continue;
    if (providers[provider]) { try { providers[provider]!.send(event); } catch {} }
    else if (!controllers[provider]!.signal.aborted && waiting[provider].length < 20) waiting[provider].push(event);
  }
}

function onContactClick(event: MouseEvent) {
  if (!event.isTrusted || event.defaultPrevented || !(event.target instanceof Element)) return;
  const link = event.target.closest<HTMLAnchorElement>('a[href]');
  if (!link) return;
  const href = link.getAttribute('href') || '';
  if (href.startsWith('https://wa.me/')) trackMarketingEvent('whatsapp_click');
  else if (href.startsWith('tel:')) trackMarketingEvent('phone_click');
  else if (href.startsWith('mailto:')) trackMarketingEvent('email_click');
}

function checkDecisionChange() {
  const raw = cookieValue(browserCookies(), CONSENT_COOKIE) || '';
  if (raw !== storedDecision || browserSignal() !== snapshot.privacySignal || (snapshot.expiresAt !== null && snapshot.expiresAt <= Date.now())) {
    stopProviders(); clearMarketingStorage(); syncSnapshot(); reloadCleanDocument();
  }
}

function watchExpiry() {
  if (expiryTimer) clearTimeout(expiryTimer);
  if (stopped || !snapshot.expiresAt) return;
  expiryTimer = setTimeout(() => {
    checkDecisionChange();
    if (!stopped) watchExpiry();
  }, Math.max(10, Math.min(snapshot.expiresAt - Date.now(), 2147483647)));
}

function initialize() {
  if (booted || typeof window === 'undefined') return;
  booted = true; stopped = false; syncSnapshot();
  storedDecision = cookieValue(browserCookies(), CONSENT_COOKIE) || '';
  if (!snapshot.hasDecision || snapshot.privacySignal) clearMarketingStorage();
  watchExpiry();
  window.addEventListener('storage', event => { if (event.key === CHANGE_KEY) checkDecisionChange(); });
  window.addEventListener('focus', checkDecisionChange);
  window.addEventListener('pagehide', stopProviders);
  window.addEventListener('pageshow', event => { if (event.persisted) { stopProviders(); reloadCleanDocument(); } });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkDecisionChange(); });
  document.addEventListener('click', onContactClick);
  const locationChanged = () => {
    if (!publicRoute(window.location.pathname, marketingGuideSlugs) || !safeMarketingLocation(window.location.href, marketingCampaigns)) {
      stopProviders(); reloadCleanDocument();
    }
  };
  window.addEventListener('hashchange', locationChanged);
  window.addEventListener('popstate', locationChanged);
  if (!eligibleNow() || !(snapshot.choices.meta || snapshot.choices.tiktok)) return;
  try { captureConsentedCampaign(); }
  catch { snapshot = { ...snapshot, storageAvailable: false }; publish(); return; }
  if (!eligibleNow()) return;
  // A cookie change is shared between tabs even when localStorage events are blocked.
  changeTimer = setInterval(checkDecisionChange, 2000);
  const permitted = documentVendors();
  for (const provider of ['meta', 'tiktok'] as const) {
    if (!snapshot.choices[provider] || !permitted[provider]) continue;
    const control = new AbortController(); controllers[provider] = control;
    const load = provider === 'meta' ? loadMeta : loadTikTok;
    load(marketingConfig[provider].id, control.signal).then(adapter => {
      if (control.signal.aborted || !eligibleNow() || !readDecision()?.choices[provider]) { adapter.revoke(); return; }
      providers[provider] = adapter;
      for (const event of waiting[provider].splice(0)) { try { adapter.send(event); } catch {} }
    }).catch(() => { control.abort(); waiting[provider].length = 0; });
  }
  trackMarketingEvent('page_view');
  const route = publicRoute(window.location.pathname, marketingGuideSlugs);
  if (route && 'serviceId' in route) trackMarketingEvent('service_view', { serviceId: route.serviceId });
  let visibleSeconds = 0;
  const engagement = window.setInterval(() => {
    if (stopped) { window.clearInterval(engagement); return; }
    if (document.visibilityState === 'visible' && eligibleNow()) visibleSeconds++;
    if (visibleSeconds >= 30) { trackMarketingEvent('engaged_visit'); window.clearInterval(engagement); }
  }, 1000);
  let scrollPending = false;
  window.addEventListener('scroll', () => {
    if (scrollPending || stopped || document.visibilityState !== 'visible') return;
    scrollPending = true;
    requestAnimationFrame(() => {
      scrollPending = false;
      const height = document.documentElement.scrollHeight - window.innerHeight;
      if (height < window.innerHeight / 2) return;
      const percent = 100 * window.scrollY / height;
      if (percent >= 50) trackMarketingEvent('scroll_depth', { percent: 50 });
      if (percent >= 90) trackMarketingEvent('scroll_depth', { percent: 90 });
    });
  }, { passive: true });
}

export function startMarketing(listener: () => void) {
  listeners.add(listener); initialize(); listener();
  return () => { listeners.delete(listener); };
}
export function getMarketingSnapshot(): MarketingSnapshot { return snapshot; }

export function saveMarketingConsent(choices: Choices): { saved: boolean } {
  stopProviders();
  const requested = browserSignal() ? { meta: false, tiktok: false } : choices;
  const value = createConsent(requested, marketingConfig);
  try {
    setCookie(CONSENT_COOKIE, JSON.stringify(value), CONSENT_MAX_AGE);
    const saved = readDecision();
    if (!saved || saved.decidedAt !== value.decidedAt || saved.choices.meta !== value.choices.meta || saved.choices.tiktok !== value.choices.tiktok) throw new Error('Storage unavailable.');
    clearMarketingStorage();
    snapshot = { ...snapshot, storageAvailable: true };
    syncSnapshot(); announceChange();
    // Capture only consented, allowlisted campaign metadata before the refresh.
    if (eligibleContext()) captureConsentedCampaign();
    reloadCleanDocument();
    return { saved: true };
  } catch {
    clearMarketingStorage();
    // Best-effort removal prevents a previous opt-in being reused after failed withdrawal.
    try { setCookie(CONSENT_COOKIE, '', 0); } catch {}
    snapshot = { ...snapshot, ready: true, storageAvailable: false, choices: { meta: false, tiktok: false } };
    announceChange(); publish();
    return { saved: false };
  }
}

export function exportConsentReceipt(): string | null {
  const consent = readDecision();
  if (!consent) return null;
  return JSON.stringify({ website: window.location.origin, policyVersion: CONSENT_VERSION,
    recordedAt: new Date(consent.decidedAt).toISOString(), expiresAt: new Date(consent.expiresAt).toISOString(),
    necessary: true, metaFacebookInstagram: consent.choices.meta, tiktok: consent.choices.tiktok,
    browserPrivacySignal: browserSignal(), note: 'Local browser preference receipt. This is not a server-side consent audit record.' }, null, 2);
}

export function openMarketingPreferences() { document.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT)); }
