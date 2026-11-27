import type { Metadata } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import { siteConfig } from '@/lib/site-config';
import { jsonLd, organizationSchema, publicRobots } from '@/lib/seo';
import { scriptNonce } from '@/lib/script-nonce';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.origin),
  title: {default:'NorthWallEg | IT Services, Microsoft 365 & Cybersecurity in Egypt',template:'%s | NorthWallEg'},
  description:'IT services for businesses in Egypt: Microsoft 365, cybersecurity, managed IT support, network design, cloud infrastructure, employee portals and custom software. Danish perspective. Egyptian ambition.',
  robots:publicRobots,
  openGraph:{type:'website',locale:'en_GB',siteName:'NorthWallEg',title:'NorthWallEg — IT. Security. People.',description:'Technology built around your business. Explore a new perspective on IT services in Egypt.',images:[{url:'/assets/egypt-hero.webp',width:1536,height:1024,alt:'Egyptian architecture and pyramids in warm evening light'}]},
  icons:{icon:'/favicon.svg',shortcut:'/favicon.svg'},
};
export default async function RootLayout({children}:{children:React.ReactNode}) {
  const nonce = await scriptNonce();
  const requestHeaders = await headers();
  const marketingEligible = requestHeaders.get('x-northwall-marketing-eligible') === '1';
  const marketingVendors = (requestHeaders.get('x-northwall-marketing-vendors') || '').split(',').filter(value => value === 'meta' || value === 'tiktok').join(',');
  return <html lang="en"><head><meta name="northwall-marketing-eligible" content={marketingEligible ? '1' : '0'}/><meta name="northwall-marketing-vendors" content={marketingVendors}/></head><body><script nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(organizationSchema())}}/>{children}</body></html>;
}
