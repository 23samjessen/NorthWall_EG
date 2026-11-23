import { services } from '@/lib/marketing-content';
import { siteConfig } from '@/lib/site-config';
import { insightGuides } from '@/lib/insights-content';

const xml = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[character]!));
export function GET() {
  const paths: Array<{ path: string; modified?: string }> = [
    { path: '/' }, { path: '/ar' },
    ...['en', 'ar'].flatMap(locale => services.map(service => ({ path: `/${locale}/services/${service.id}` }))),
    { path: '/insights' },
    ...insightGuides.map(guide => ({ path: `/insights/${guide.slug}`, modified: guide.updatedAt })),
  ];
  const body = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    + paths.map(item => `<url><loc>${xml(siteConfig.origin + item.path)}</loc>${item.modified ? `<lastmod>${xml(item.modified)}</lastmod>` : ''}</url>`).join('') + '</urlset>';
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
