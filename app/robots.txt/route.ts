import { siteConfig } from '@/lib/site-config';

// Access remains a separate hosting setting. Review mode always excludes the site.
export function GET() {
  const body = siteConfig.isReviewDemo
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nAllow: /\nDisallow: /workspace\nDisallow: /api/\nDisallow: /signin-with-chatgpt\nDisallow: /signout-with-chatgpt\nDisallow: /callback\nSitemap: ${siteConfig.origin}/sitemap.xml\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
