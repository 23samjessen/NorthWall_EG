import type { Metadata } from 'next';
import './globals.css';
import { siteConfig } from '@/lib/site-config';
export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.origin),
  title: {default:'NorthWallEg | IT Services, Microsoft 365 & Cybersecurity in Egypt',template:'%s | NorthWallEg'},
  description:'IT services for businesses in Egypt: Microsoft 365, cybersecurity, managed IT support, network design, cloud infrastructure, employee portals and custom software. Danish perspective. Egyptian ambition.',
  robots:{index:false,follow:false},
  openGraph:{type:'website',locale:'en_GB',siteName:'NorthWallEg',title:'NorthWallEg — IT. Security. People.',description:'Technology built around your business. Explore a new perspective on IT services in Egypt.',images:[{url:'/assets/egypt-hero.webp',width:1536,height:1024,alt:'Egyptian architecture and pyramids in warm evening light'}]},
  icons:{icon:'/favicon.svg',shortcut:'/favicon.svg'},
};
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body>{children}</body></html>;
}
