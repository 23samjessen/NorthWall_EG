import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import MarketingSite from '@/components/marketing';
import { services } from '@/lib/marketing-content';
import { siteConfig } from '@/lib/site-config';
type Props={params:Promise<{locale:string;id:string}>};
export async function generateMetadata({params}:Props):Promise<Metadata>{
 const {locale,id}=await params;const l=locale==='ar'?'ar':'en';const service=services.find(s=>s.id===id);if(!service)return {};
 return {title:service.name[l]+(l==='en'?' in Egypt':''),description:service.description[l],alternates:{canonical:`${siteConfig.origin}/${l}/services/${id}`,languages:{en:`${siteConfig.origin}/en/services/${id}`,ar:`${siteConfig.origin}/ar/services/${id}`}},openGraph:{title:service.name[l]+' | NorthWallEg',description:service.description[l],locale:l==='ar'?'ar_EG':'en_GB'}};
}
export default async function ServicePage({params}:Props){const {locale,id}=await params;if(!['en','ar'].includes(locale)||!services.some(s=>s.id===id))notFound();return <MarketingSite language={locale as 'en'|'ar'} serviceId={id}/>;}
