import profile from './company-profile.json';

/** Public content only. Credentials, member roles and access policy belong on the server. */
export type PublicLanguage = 'en' | 'ar';
export type LocalizedText = { en: string; ar: string };
type PublicLinkInput = { id?: string; enabled?: boolean; label: LocalizedText; url: string };
type TeamInput = {
  id: string; enabled: boolean; name: string;
  titles: { en: string[]; ar: string[] }; bio: LocalizedText;
  image: string; imageAlt: LocalizedText; imageIsPlaceholder: boolean;
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
  return [{ ...person, name: clean(person.name), titles, image, links: links(person.links) }];
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
  socialLinks: links(profile.contact.socialLinks),
  officeHours: profile.contact.officeHours.filter(item => item.enabled && hasText(item.value)),
  locations,
  team,
  additionalContent,
  additionalLinks: links(profile.additionalLinks),
};
