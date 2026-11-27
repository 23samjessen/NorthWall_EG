import { requireCompanyAccess } from '@/hostinger/native/site-auth';
import type { Metadata } from 'next';
import { BookOpen, ShieldCheck, Radio, Plus } from 'lucide-react';
import InsightsShell from '@/components/insights-shell';
import InsightsFeed from '@/components/insights-feed';
import { getNews } from '@/lib/news-service';
import { insightGuides } from '@/lib/insights-content';
import { absoluteUrl, jsonLd, openGraphBase, publicRobots } from '@/lib/seo';
import { scriptNonce } from '@/lib/script-nonce';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Cybersecurity News, Malware Alerts & IT Security Guides',
  description: 'Follow international attack research, malware and ransomware updates, Cisco and Splunk advisories, and SOAR news. Read practical Microsoft 365 and cybersecurity guidance for teams in Egypt.',
  robots: publicRobots,
  alternates: { canonical: absoluteUrl('/insights') },
  openGraph: { ...openGraphBase, type: 'website', title: 'Security insights | NorthWallEg', description: 'Verified publisher headlines and practical security guidance for growing teams.', url: absoluteUrl('/insights') },
};
export default async function InsightsPage() { await requireCompanyAccess('/insights');
  const nonce = await scriptNonce();
  const news = await getNews();
  const schema = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'NorthWallEg security insights', url: absoluteUrl('/insights'), inLanguage: 'en', description: 'Selected publisher headlines and original practical IT security guides.', publisher: { '@id': absoluteUrl('/#organization') }, hasPart: insightGuides.map(guide => ({ '@type': 'Article', headline: guide.title, url: absoluteUrl(`/insights/${guide.slug}`) })) };
  return <InsightsShell><script nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schema) }}/>
    <section className="nw-insights-hero"><div><span className="nw-insights-eyebrow">NORTHWALLEG · SECURITY INSIGHTS</span><h1>Stay informed.<br/><em>Know your next step.</em></h1><p>International security updates, with practical guidance for the people running businesses in Egypt. Understand the change, check your exposure and plan the work.</p><div className="nw-insights-hero-links"><a href="#latest-news"><Radio size={18}/>Read the latest headlines</a><a href="#practical-guides"><BookOpen size={18}/>Explore practical guides</a></div></div><aside><ShieldCheck size={34} strokeWidth={1.4}/><h2>Good decisions start with clear information.</h2><p>Original publishers. Visible dates. Useful context.</p><span>ENGLISH NEWS & GUIDANCE</span></aside></section>
    <div className="nw-insights-container"><InsightsFeed initialData={news}/>
      <section id="practical-guides" className="nw-insights-guides" aria-labelledby="guides-title"><div className="nw-insights-section-heading"><div><span className="nw-insights-eyebrow">FROM INFORMATION TO ACTION</span><h2 id="guides-title">Practical guides for your team.</h2></div><p>Use these planning guides to prepare questions, assign responsibilities and choose a useful starting point.</p></div><div className="nw-insights-guide-grid">{insightGuides.map(guide => <article key={guide.slug}><span className="nw-insights-eyebrow">{guide.category}</span><h3><a href={`/insights/${guide.slug}`}>{guide.title}</a></h3><p>{guide.summary}</p><div><small>{guide.readingMinutes} minute read</small><a href={`/insights/${guide.slug}`} aria-label={`Read ${guide.title}`}>Read the guide <Plus size={16}/></a></div></article>)}</div></section>
      <section className="nw-insights-next"><div><span className="nw-insights-eyebrow">MAKE IT RELEVANT TO YOUR BUSINESS</span><h2>Turn a concern into a clear plan.</h2><p>Start with your accounts, devices, networks and the information your team depends on. We can help define the scope and the next practical step.</p></div><a href="/#contact">Talk to NorthWallEg <Plus size={18}/></a></section>
      <section className="nw-insights-editorial"><h2>How we select and present information</h2><p>News headlines link directly to the original publishers. Topics are based on the individual story’s wording or publisher category; they are not independently verified severity ratings. Our guides provide general planning context and link to official documentation. Relevant products, licences, affected versions and local business responsibilities still need to be checked for your environment.</p><p>We keep publisher dates separate from feed retrieval times and label refresh failures. We do not republish full vendor articles or imply that a listed attack has affected your organisation.</p></section>
    </div></InsightsShell>;
}
