import type { Metadata } from 'next';
import MarketingSite from '@/components/marketing';
export const metadata: Metadata = {title: 'تكنولوجيا وحماية ودعم لشركتك في مصر',description:'خدمات Microsoft 365 والأمن السيبراني والشبكات والدعم الفني والتطبيقات للشركات والمدارس والعيادات في مصر.'};
export default function Home() { return <MarketingSite language="ar"/>; }
