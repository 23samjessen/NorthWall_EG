import { requireCompanyAccess } from '@/hostinger/native/site-auth';
import MarketingSite from '@/components/marketing';
import { homeMetadata } from '@/lib/seo';
export const metadata = homeMetadata('en');
export default async function Home() { await requireCompanyAccess('/en'); return <MarketingSite language="en"/>; }
