/** Vendor adapters. Constructed only after consent and public-document checks. */
type EventPayload = {
  name: string; meta: string; tiktok: string; custom: boolean;
  properties: Record<string, unknown>; eventId: string;
};
export type MarketingProvider = {
  send: (event: EventPayload) => void;
  revoke: () => void;
};
type MetaPixel = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][]; push: MetaPixel; loaded: boolean; version: string; disablePushState: boolean;
};
type PixelWindow = Window & { fbq?: MetaPixel; _fbq?: MetaPixel; ttq?: any; TiktokAnalyticsObject?: string };

function loadScript(source: string, id: string, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new Error('Consent is no longer active.'));
    const nonce = document.querySelector<HTMLScriptElement>('script[nonce]')?.nonce;
    if (!nonce) return reject(new Error('No trusted script context.'));
    const script = document.createElement('script');
    script.id = id; script.async = true; script.src = source;
    script.nonce = nonce; script.referrerPolicy = 'no-referrer';
    const timeout = window.setTimeout(() => finish(new Error('Marketing connection unavailable.')), 8000);
    const cancel = () => finish(new Error('Consent withdrawn.'));
    function finish(error?: Error) {
      window.clearTimeout(timeout); signal.removeEventListener('abort', cancel);
      script.onload = null; script.onerror = null;
      if (error) { script.remove(); reject(error); } else resolve();
    }
    script.onload = () => finish();
    script.onerror = () => finish(new Error('Marketing connection unavailable.'));
    signal.addEventListener('abort', cancel, { once: true });
    document.head.appendChild(script);
  });
}

export async function loadMeta(id: string, signal: AbortSignal): Promise<MarketingProvider> {
  const target = window as PixelWindow;
  // An unexpected tag is not adopted or mixed with this site's reviewed settings.
  if (target.fbq) throw new Error('A Meta integration is already installed.');
  const pixel = function (...args: unknown[]) {
    if (pixel.callMethod) pixel.callMethod(...args); else pixel.queue.push(args);
  } as MetaPixel;
  pixel.queue = []; pixel.push = pixel; pixel.loaded = true; pixel.version = '2.0';
  pixel.disablePushState = true;
  target.fbq = target._fbq = pixel;
  pixel('consent', 'revoke');
  pixel('set', 'autoConfig', false, id);
  pixel('init', id); // Never include an advanced-matching identity object.
  pixel('consent', 'grant');
  let revoked = false;
  // Keep the denial queued if a removed script finishes loading after withdrawal.
  const revoke = () => { revoked = true; try { pixel.queue.length = 0; pixel('consent', 'revoke'); } catch {} };
  signal.addEventListener('abort', revoke, { once: true });
  try { await loadScript('https://connect.facebook.net/en_US/fbevents.js', 'nw-meta-pixel', signal); }
  catch (error) { revoke(); throw error; }
  return {
    send(event) {
      if (signal.aborted || revoked) return;
      pixel(event.custom ? 'trackSingleCustom' : 'trackSingle', id, event.meta, event.properties, { eventID: event.eventId });
    },
    revoke,
  };
}

export async function loadTikTok(id: string, signal: AbortSignal): Promise<MarketingProvider> {
  const target = window as PixelWindow;
  if (target.ttq) throw new Error('A TikTok integration is already installed.');
  // The provider's documented deferred queue; no identify/advanced-matching data.
  const pixel: any = [];
  target.TiktokAnalyticsObject = 'ttq'; target.ttq = pixel;
  pixel.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie', 'holdConsent', 'revokeConsent', 'grantConsent'];
  pixel.setAndDefer = (queue: any, method: string) => { queue[method] = (...args: unknown[]) => { queue.push([method, ...args]); }; };
  for (const method of pixel.methods) pixel.setAndDefer(pixel, method);
  pixel.instance = (instance: string) => {
    const queue = pixel._i[instance] || [];
    for (const method of pixel.methods) pixel.setAndDefer(queue, method);
    return queue;
  };
  pixel._i = {}; pixel._i[id] = [];
  pixel._i[id]._u = 'https://analytics.tiktok.com/i18n/pixel/events.js';
  pixel._t = { [id]: Date.now() }; pixel._o = { [id]: { historyObserver: false } };
  pixel.holdConsent(); pixel.grantConsent();
  let revoked = false;
  const revoke = () => {
    revoked = true;
    try { pixel.length = 0; pixel.holdConsent(); pixel.revokeConsent(); pixel.disableCookie(); } catch {}
  };
  signal.addEventListener('abort', revoke, { once: true });
  try { await loadScript(`https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${encodeURIComponent(id)}&lib=ttq`, 'nw-tiktok-pixel', signal); }
  catch (error) { revoke(); throw error; }
  return {
    send(event) {
      if (signal.aborted || revoked) return;
      if (event.name === 'page_view') pixel.page({ ...event.properties, event_id: event.eventId });
      else pixel.track(event.tiktok, event.properties, { event_id: event.eventId });
    },
    revoke,
  };
}
