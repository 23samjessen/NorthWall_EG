import type { Metadata } from 'next';
import { siteConfig } from './site-config';

export const openGraphBase = {
  siteName: 'NorthWallEg',
  images: [{ url: '/assets/egypt-hero.webp', width: 1536, height: 1024, alt: 'Egyptian architecture and pyramids in warm evening light' }],
};
export const publicRobots = { index: !siteConfig.isReviewDemo, follow: !siteConfig.isReviewDemo };
export function absoluteUrl(path = '/') { return `${siteConfig.origin}${path.startsWith('/') ? path : `/${path}`}`; }
export function jsonLd(value: unknown) { return JSON.stringify(value).replace(/</g, '\\u003c'); }
export function homeMetadata(language: 'en' | 'ar' = 'en'): Metadata {
  const arabic = language === 'ar';
  const title = arabic ? 'خدمات Microsoft 365 والأمن السيبراني للشركات في مصر' : 'IT Services, Microsoft 365 & Cybersecurity in Egypt';
  const description = arabic
    ? 'خدمات Microsoft 365 والشبكات والدعم الفني والأمن السيبراني للشركات في مصر. اكتشف الحلول والأخبار الأمنية وتواصل مع فريق NorthWallEg.'
    : 'Microsoft 365, cybersecurity, cloud security, network design and managed IT support for organisations in Egypt. Explore services, security news and practical guidance from NorthWallEg.';
  return { title, description, robots: publicRobots,
    alternates: { canonical: absoluteUrl(arabic ? '/ar' : '/'), languages: { en: absoluteUrl('/'), ar: absoluteUrl('/ar'), 'x-default': absoluteUrl('/') } },
    openGraph: { ...openGraphBase, type: 'website', title: `${title} | NorthWallEg`, description, url: absoluteUrl(arabic ? '/ar' : '/'), locale: arabic ? 'ar_EG' : 'en_GB', alternateLocale: arabic ? 'en_GB' : 'ar_EG' },
  };
}
export function organizationSchema() {
  return { '@context': 'https://schema.org', '@type': 'Organization', '@id': absoluteUrl('/#organization'),
    name: siteConfig.name, url: absoluteUrl('/'), logo: absoluteUrl('/assets/nw-monogram.svg'),
    description: 'Microsoft 365, IT support, network and cybersecurity services for organisations in Egypt.',
    ...(siteConfig.phone ? { telephone: siteConfig.phone } : {}),
    ...(siteConfig.emails.length ? { email: siteConfig.emails[0].address } : {}),
    ...(siteConfig.socialLinks.filter(link => !!link.href).length ? { sameAs: siteConfig.socialLinks.filter(link => !!link.href).map(link => link.href) } : {}),
    areaServed: siteConfig.contactRegions.map(name => ({ '@type': 'Country', name })),
  };
}

/** Publishing is a separate Site access action; this only coordinates search directives. */
export function shouldNoIndex(pathname: string) {
  return siteConfig.isReviewDemo || /^\/(?:workspace|api|signin-with-chatgpt|signout-with-chatgpt|callback)(?:\/|$)/.test(pathname);
}
