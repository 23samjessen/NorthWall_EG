/** Pure, shared consent rules. No browser APIs, account data or secrets here. */
export const CONSENT_VERSION = '2026-11-26.1';
export const CONSENT_COOKIE = '__Host-nw_marketing';
export const CAMPAIGN_COOKIE = '__Host-nw_campaign';
export const CONSENT_MAX_AGE = 180 * 24 * 60 * 60;
export const CAMPAIGN_MAX_AGE = 30 * 24 * 60 * 60;
export const EMPTY_CHOICES = Object.freeze({ meta: false, tiktok: false });
export const SERVICE_IDS = Object.freeze([
  'microsoft-365', 'cyber-defense', 'managed-it', 'employee-platform',
  'networks-vpn', 'websites-apps', 'business-automation', 'cloud-continuity', 'iot-integration',
]);

export function readMarketingConfig(env = {}) {
  const master = env.NEXT_PUBLIC_MARKETING_ENABLED === 'true';
  const metaId = typeof env.NEXT_PUBLIC_META_PIXEL_ID === 'string' ? env.NEXT_PUBLIC_META_PIXEL_ID.trim() : '';
  const tiktokId = typeof env.NEXT_PUBLIC_TIKTOK_PIXEL_ID === 'string' ? env.NEXT_PUBLIC_TIKTOK_PIXEL_ID.trim() : '';
  const meta = master && /^\d{5,25}$/.test(metaId) && env.NEXT_PUBLIC_META_MANUAL_MODE_CONFIRMED === 'true';
  const tiktok = master && /^[A-Z0-9]{15,35}$/.test(tiktokId) && env.NEXT_PUBLIC_TIKTOK_MANUAL_MODE_CONFIRMED === 'true';
  return Object.freeze({
    enabled: meta || tiktok,
    meta: Object.freeze({ enabled: meta, id: meta ? metaId : '' }),
    tiktok: Object.freeze({ enabled: tiktok, id: tiktok ? tiktokId : '' }),
    context: `${CONSENT_VERSION}|${meta ? metaId : '-'}|${tiktok ? tiktokId : '-'}`,
  });
}

export function cookieValue(cookies, name) {
  if (typeof cookies !== 'string') return null;
  const values = cookies.split(';').map(part => part.trim()).filter(part => part.startsWith(name + '='));
  if (values.length !== 1) return null;
  try { return decodeURIComponent(values[0].slice(name.length + 1)); } catch { return null; }
}

export function hasEmployeeCookie(cookies) {
  return /(?:^|;)\s*__Host-nw_(?:session|pending)=[^;]+/.test(cookies || '');
}

export function isPrivacySignal(value) {
  return value === true || value === 1 || value === '1';
}

export function createConsent(choices, config, now = Date.now()) {
  return {
    version: CONSENT_VERSION, context: config.context,
    decidedAt: now, expiresAt: now + CONSENT_MAX_AGE * 1000,
    choices: { meta: config.meta.enabled && choices?.meta === true, tiktok: config.tiktok.enabled && choices?.tiktok === true },
  };
}

export function parseConsent(raw, config, now = Date.now()) {
  if (typeof raw !== 'string' || raw.length > 1400) return null;
  try {
    const value = JSON.parse(raw);
    if (!value || value.version !== CONSENT_VERSION || value.context !== config.context ||
        !Number.isSafeInteger(value.decidedAt) || !Number.isSafeInteger(value.expiresAt) ||
        value.decidedAt > now || value.decidedAt < 0 || value.expiresAt <= now ||
        value.expiresAt <= value.decidedAt || value.expiresAt - value.decidedAt > CONSENT_MAX_AGE * 1000 ||
        typeof value.choices?.meta !== 'boolean' || typeof value.choices?.tiktok !== 'boolean') return null;
    return { version: value.version, context: value.context, decidedAt: value.decidedAt, expiresAt: value.expiresAt,
      choices: { meta: config.meta.enabled && value.choices.meta, tiktok: config.tiktok.enabled && value.choices.tiktok } };
  } catch { return null; }
}

/** Curated public pages only: unknown URLs and all private/API routes fail closed. */
export function publicRoute(path, guideSlugs = []) {
  if (['/', '/en', '/ar'].includes(path)) return { page: 'home', language: path === '/ar' ? 'ar' : 'en' };
  if (path === '/insights') return { page: 'insights', language: 'en' };
  const service = /^\/(en|ar)\/services\/([a-z0-9-]+)$/.exec(path);
  if (service && SERVICE_IDS.includes(service[2])) return { page: 'service', language: service[1], serviceId: service[2] };
  const guide = /^\/insights\/([a-z0-9-]+)$/.exec(path);
  if (guide && guideSlugs.includes(guide[1])) return { page: 'guide', language: 'en', guideId: guide[1] };
  return null;
}

/** Campaign values are selected from a company-owned list, never arbitrary URL text. */
export function campaignFromUrl(input, allowedCampaigns = []) {
  let url;
  try { url = new URL(input); } catch { return null; }
  const sources = new Set(['facebook', 'instagram', 'tiktok', 'linkedin', 'google', 'bing', 'newsletter']);
  const mediums = new Set(['paid_social', 'cpc', 'social', 'email']);
  const source = url.searchParams.get('utm_source') || '';
  const medium = url.searchParams.get('utm_medium') || '';
  const campaign = url.searchParams.get('utm_campaign') || '';
  if (!sources.has(source) || !mediums.has(medium) || !/^[a-z][a-z0-9-]{1,63}$/.test(campaign) || !allowedCampaigns.includes(campaign)) return null;
  return { source, medium, campaign };
}

/** No SDK is started while the URL contains unknown search parameters or fragments. */
export function safeMarketingLocation(input, allowedCampaigns = []) {
  let url;
  try { url = new URL(input); } catch { return false; }
  const anchors = /^(?:#(?:main|expertise|industries|platforms|about|contact|latest-news|practical-guides|section-\d{1,2}|reference-\d{1,2}))?$/;
  if (!anchors.test(url.hash)) return false;
  const allowedKeys = new Set(['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'ttclid']);
  for (const [key, value] of url.searchParams) {
    if (!allowedKeys.has(key) || url.searchParams.getAll(key).length !== 1) return false;
    if (['fbclid', 'ttclid'].includes(key) && !/^[A-Za-z0-9_-]{20,512}$/.test(value)) return false;
  }
  if ([...url.searchParams.keys()].some(key => key.startsWith('utm_')) && !campaignFromUrl(url.href, allowedCampaigns)) return false;
  return true;
}

export function safeMarketingReferrer(raw, origin, guideSlugs = []) {
  if (!raw) return true;
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) return false;
    // Only a bare external origin is accepted. Same-site private paths never qualify.
    return url.origin === origin ? Boolean(publicRoute(url.pathname, guideSlugs)) : url.pathname === '/';
  } catch { return false; }
}

/** This allowlist is the sole source for manually transmitted event properties. */
export function cleanEvent(name, details, route, campaign, allowedCampaigns = []) {
  if (!route || !['home', 'service', 'insights', 'guide'].includes(route.page) || !['en', 'ar'].includes(route.language)) return null;
  const mapping = {
    page_view: ['PageView', 'PageView', false],
    service_view: ['ViewContent', 'ViewContent', false],
    enquiry_open: ['EnquiryFormOpened', 'EnquiryFormOpened', true],
    brief_download: ['BriefDownloaded', 'BriefDownloaded', true],
    whatsapp_click: ['WhatsAppClick', 'WhatsAppClick', true],
    phone_click: ['PhoneClick', 'PhoneClick', true],
    email_click: ['EmailClick', 'EmailClick', true],
    engaged_visit: ['EngagedVisit', 'EngagedVisit', true],
    scroll_depth: ['ScrollDepth', 'ScrollDepth', true],
  };
  if (!Object.hasOwn(mapping, name)) return null;
  const [meta, tiktok, custom] = mapping[name];
  const properties = { page_type: route.page, language: route.language };
  if (name === 'service_view') {
    if (!SERVICE_IDS.includes(details?.serviceId)) return null;
    properties.service_id = details.serviceId;
    properties.content_ids = [details.serviceId];
    properties.content_category = 'IT services';
  }
  if (name === 'scroll_depth') {
    if (![50, 90].includes(details?.percent)) return null;
    properties.percent = details.percent;
  }
  if (campaign) {
    const checked = campaignFromUrl('https://campaign.invalid/?' + new URLSearchParams({
      utm_source: campaign.source, utm_medium: campaign.medium, utm_campaign: campaign.campaign,
    }), allowedCampaigns);
    if (checked) {
      properties.campaign_source = checked.source;
      properties.campaign_medium = checked.medium;
      properties.campaign_code = checked.campaign;
    }
  }
  return { name, meta, tiktok, custom, properties };
}
