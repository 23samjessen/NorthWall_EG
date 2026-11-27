import profile from './company-profile.json';
import { services } from './marketing-content';

/** Public content only. Credentials, member roles and access policy belong on the server. */
export type PublicLanguage = 'en' | 'ar';
export type LocalizedText = { en: string; ar: string };
type PublicLinkInput = { id?: string; enabled?: boolean; label: LocalizedText; url: string };
export type SocialPlatform = 'facebook' | 'instagram' | 'tiktok' | 'linkedin' | 'youtube';
export type CapabilityIconName = 'microsoft' | 'network' | 'splunk' | 'workflow' | 'cloud-shield' | 'shield' | 'identity';
type SocialLinkInput = PublicLinkInput & { platform: string; icon: string; showInPreview?: boolean };
type PlatformInput = {
  id: string; enabled: boolean; icon: string; label: LocalizedText; summary: LocalizedText;
  serviceId: string; options: { en: string[]; ar: string[] };
};
type TeamInput = {
  id: string; enabled: boolean; name: string;
  titles: { en: string[]; ar: string[] }; bio: LocalizedText;
  image: string; imageAlt: LocalizedText; imageIsPlaceholder: boolean;
  contact?: { email?: string; phone?: string };
  links: PublicLinkInput[];
};
const clean = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
export function publicText(value: LocalizedText, language: PublicLanguage): string {
  return clean(value[language]) || clean(value.en) || clean(value.ar);
}
const hasText = (value: LocalizedText) => Boolean(publicText(value, 'en'));

/** Permit HTTPS, same-site paths and anchors; reject script/data/protocol-relative URLs. */
export function safePublicUrl(value: string): string | null {
  const input = clean(value);
  if (!input || /[\u0000-\u001f\u007f\\]/.test(input)) return null;
  if (/^#[A-Za-z][\w:.-]*$/.test(input)) return input;
  if (input.startsWith('/') && !input.startsWith('//')) {
    try {
      const url = new URL(input, 'https://northwall-content.invalid');
      if (url.origin !== 'https://northwall-content.invalid') return null;
      return `${url.pathname}${url.search}${url.hash}`;
    } catch { return null; }
  }
  try {
    const url = new URL(input);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

/** Public photos use local assets, matching the deployed self-only image policy. */
export function safePublicImage(value: string): string | null {
  const input = clean(value);
  if (!input) return null;
  if (input.startsWith('/')) {
    if (!/^\/assets\/[A-Za-z0-9_./-]+\.(?:avif|webp|png|jpe?g|gif|svg)$/i.test(input) || input.split('/').includes('..')) return null;
    return input;
  }
  return null;
}
function phoneUrl(value: string): string | null {
  const input = clean(value);
  if (!/^\+?[\d\s().-]+$/.test(input)) return null;
  const digits = input.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  return `tel:${input.startsWith('+') ? '+' : ''}${digits}`;
}
function emailUrl(value: string): string | null {
  const input = clean(value);
  if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(input)) return null;
  const [local, domain] = input.split('@');
  return `mailto:${encodeURIComponent(local)}@${domain}`;
}
const socialHosts: Record<SocialPlatform, string[]> = {
  facebook: ['facebook.com', 'www.facebook.com', 'm.facebook.com'],
  instagram: ['instagram.com', 'www.instagram.com'],
  tiktok: ['tiktok.com', 'www.tiktok.com'],
  linkedin: ['linkedin.com', 'www.linkedin.com'],
  youtube: ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'],
};
/** Social slots require HTTPS, a supported platform host and a populated profile path. */
export function safeSocialUrl(value: string, platform: string): string | null {
  if (!Object.hasOwn(socialHosts, platform)) return null;
  const href = safePublicUrl(value);
  if (!href?.startsWith('https://')) return null;
  const url = new URL(href);
  if (url.port || !socialHosts[platform as SocialPlatform].includes(url.hostname) || url.pathname === '/') return null;
  return href;
}
/** Review link supplied by the verified Business Profile owner. Never invent reviews or ratings. */
export function safeGoogleReviewUrl(value: string): string | null {
  const href = safePublicUrl(value);
  if(!href?.startsWith('https://')) return null;
  const url = new URL(href);
  if(url.port || url.username || url.password || url.hash) return null;
  if(url.hostname === 'g.page' && /^\/r\/[A-Za-z0-9_-]+\/review\/?$/.test(url.pathname) && !url.search) return href;
  if((url.hostname === 'search.google.com' || url.hostname === 'www.google.com') && url.pathname === '/local/writereview' && /^[A-Za-z0-9_-]{10,180}$/.test(url.searchParams.get('placeid')||'') && url.searchParams.size===1) return href;
  return null;
}
function links(items: PublicLinkInput[]) {
  return items.flatMap(item => {
    const href = safePublicUrl(item.url);
    return item.enabled !== false && hasText(item.label) && href ? [{ ...item, href }] : [];
  });
}
const phones = profile.contact.phones.flatMap(item => {
  const href = phoneUrl(item.number);
  return item.enabled && href ? [{ ...item, number: clean(item.number), href }] : [];
});
const emails = profile.contact.emails.flatMap(item => {
  const href = emailUrl(item.address);
  return item.enabled && href ? [{ ...item, address: clean(item.address), href }] : [];
});
const locations = profile.contact.locations.filter(item => item.enabled && hasText(item.name)).map(item => ({
  ...item, address: clean(item.address), mapHref: safePublicUrl(item.mapUrl),
}));
const team = (profile.team as TeamInput[]).flatMap(person => {
  const image = safePublicImage(person.image);
  const titles = { en: person.titles.en.map(clean).filter(Boolean), ar: person.titles.ar.map(clean).filter(Boolean) };
  if (!person.enabled || !clean(person.name) || !image || (!titles.en.length && !titles.ar.length)) return [];
  const email = clean(person.contact?.email);
  const phone = clean(person.contact?.phone);
  return [{ ...person, name: clean(person.name), titles, image, links: links(person.links),
    contact: { email, emailHref: emailUrl(email), phone, phoneHref: phoneUrl(phone) },
  }];
});
const socialChannels = (profile.contact.socialLinks as SocialLinkInput[]).flatMap(item => {
  if (!Object.hasOwn(socialHosts, item.platform) || !hasText(item.label)) return [];
  const platform = item.platform as SocialPlatform;
  // A configured platform determines its icon so mismatched brands cannot be rendered.
  if (item.icon !== platform) return [];
  const href = item.enabled ? safeSocialUrl(item.url, platform) : null;
  if (!href && !(profile.website.isReviewDemo && item.showInPreview)) return [];
  return [{ ...item, platform, icon: platform, href, configured: Boolean(href) }];
});
const capabilityIcons = new Set<CapabilityIconName>(['microsoft', 'network', 'splunk', 'workflow', 'cloud-shield', 'shield', 'identity']);
const serviceIds = new Set(services.map(service => service.id));
const platforms = (profile.platforms as PlatformInput[]).flatMap(item => {
  const options = { en: item.options.en.map(clean).filter(Boolean), ar: item.options.ar.map(clean).filter(Boolean) };
  if (!item.enabled || !/^[a-z0-9][a-z0-9-]*$/.test(item.id) || !hasText(item.label) || !hasText(item.summary) || !serviceIds.has(item.serviceId) || !capabilityIcons.has(item.icon as CapabilityIconName) || (!options.en.length && !options.ar.length)) return [];
  return [{ ...item, icon: item.icon as CapabilityIconName, options }];
});
const additionalContent = profile.additionalContent.filter(item => item.enabled && hasText(item.title) && hasText(item.body)).map(item => ({
  ...item, image: safePublicImage(item.image),
  link: links([item.link])[0] || null,
}));
const primaryPhone = phones.find(phone => phone.primary) || phones[0];
const configuredOrigin = safePublicUrl(profile.website.origin);
const origin = configuredOrigin?.startsWith('https://')
  ? new URL(configuredOrigin).origin
  : 'https://northwalleg-design-demo.dark-hawk-6582.chatgpt.site';

export const siteConfig = {
  // Compatible with existing metadata, service routes and the original public component.
  name: clean(profile.company.displayName) || 'NorthWallEg',
  origin,
  phone: primaryPhone?.number || '',
  phoneHref: primaryPhone?.href || '',
  isReviewDemo: profile.website.isReviewDemo,
  heroImage: safePublicImage(profile.website.heroImage) || '/assets/egypt-hero.webp',
  contactRegions: locations.map(location => publicText(location.name, 'en')),
  company: Object.fromEntries(Object.entries(profile.company).map(([key, value]) => [key, clean(value)])) as typeof profile.company,
  phones,
  emails,
  socialLinks: socialChannels.filter((item): item is typeof item & { href: string } => Boolean(item.href)),
  socialChannels,
  googleReviews: (() => {
    const entry = profile.contact.googleReviews;
    if (!entry.enabled) return null;
    const href = safeGoogleReviewUrl(entry.url);
    return href ? { href, label: entry.label } : null;
  })(),
  officeHours: profile.contact.officeHours.filter(item => item.enabled && hasText(item.value)),
  locations,
  team,
  platforms,
  additionalContent,
  additionalLinks: links(profile.additionalLinks),
};
