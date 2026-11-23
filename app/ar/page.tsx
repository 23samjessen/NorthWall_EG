import MarketingSite from '@/components/marketing';
import { homeMetadata } from '@/lib/seo';
export const metadata = homeMetadata('ar');
export default function Home() { return <MarketingSite language="ar"/>; }
