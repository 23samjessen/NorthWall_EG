import { requireCompanyAccess } from '@/hostinger/native/site-auth';
import MarketingSite from '@/components/marketing';
import { homeMetadata } from '@/lib/seo';
export const metadata = homeMetadata('ar');
export default async function Home() { await requireCompanyAccess('/ar'); return <MarketingSite language="ar"/>; }
