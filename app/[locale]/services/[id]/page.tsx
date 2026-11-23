import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import MarketingSite from '@/components/marketing';
import { services } from '@/lib/marketing-content';
import { siteConfig } from '@/lib/site-config';
import { absoluteUrl, jsonLd, openGraphBase, publicRobots } from '@/lib/seo';
type Props={params:Promise<{locale:string;id:string}>};
export async function generateMetadata({params}:Props):Promise<Metadata>{
 const {locale,id}=await params;const l=locale==='ar'?'ar':'en';const service=services.find(s=>s.id===id);if(!service)return {};
 return {title:service.name[l]+(l==='en'?' in Egypt':''),description:service.description[l],robots:publicRobots,alternates:{canonical:`${siteConfig.origin}/${l}/services/${id}`,languages:{en:`${siteConfig.origin}/en/services/${id}`,ar:`${siteConfig.origin}/ar/services/${id}`}},openGraph:{...openGraphBase,type:'website',title:service.name[l]+' | NorthWallEg',description:service.description[l],url:absoluteUrl(`/${l}/services/${id}`),locale:l==='ar'?'ar_EG':'en_GB'}};
}
export default async function ServicePage({params}:Props){
 const {locale,id}=await params;const service=services.find(item=>item.id===id);
 if(!['en','ar'].includes(locale)||!service)notFound();const language=locale as 'en'|'ar';
 const schema={'@context':'https://schema.org','@type':'Service',name:service.name[language],description:service.description[language],url:absoluteUrl(`/${locale}/services/${id}`),provider:{'@id':absoluteUrl('/#organization')},areaServed:siteConfig.contactRegions.map(name=>({'@type':'Country',name}))};
 return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(schema)}}/><MarketingSite language={language} serviceId={id}/></>;
}
