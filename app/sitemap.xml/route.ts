import { services } from '@/lib/marketing-content';
import { siteConfig } from '@/lib/site-config';
export function GET(){const paths=['/','/en','/ar',...['en','ar'].flatMap(l=>services.map(s=>`/${l}/services/${s.id}`))];return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+paths.map(p=>`<url><loc>${siteConfig.origin}${p}</loc></url>`).join('')+'</urlset>',{headers:{'Content-Type':'application/xml; charset=utf-8'}});}
