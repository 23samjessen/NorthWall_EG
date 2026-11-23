import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BookOpen, ExternalLink, Plus } from 'lucide-react';
import InsightsShell from '@/components/insights-shell';
import { insightGuides } from '@/lib/insights-content';
import { services } from '@/lib/marketing-content';
import { absoluteUrl, jsonLd, openGraphBase, publicRobots } from '@/lib/seo';

type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params; const guide = insightGuides.find(item => item.slug === slug);
  if (!guide) return {};
  return { title: guide.title, description: guide.summary, robots: publicRobots, alternates: { canonical: absoluteUrl(`/insights/${guide.slug}`) }, openGraph: { ...openGraphBase, type: 'article', title: guide.title, description: guide.summary, url: absoluteUrl(`/insights/${guide.slug}`) } };
}
export default async function InsightGuidePage({ params }: Props) {
  const { slug } = await params; const guide = insightGuides.find(item => item.slug === slug); if (!guide) notFound();
  const related = services.filter(service => guide.serviceIds.includes(service.id));
  const schema = { '@context': 'https://schema.org', '@type': 'Article', headline: guide.title, description: guide.summary, inLanguage: 'en', articleSection: guide.category, dateModified: guide.updatedAt, mainEntityOfPage: absoluteUrl(`/insights/${guide.slug}`), author: { '@type': 'Organization', name: 'NorthWallEg', url: absoluteUrl('/') }, publisher: { '@id': absoluteUrl('/#organization') } };
  const breadcrumbs = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'NorthWallEg', item: absoluteUrl('/') }, { '@type': 'ListItem', position: 2, name: 'Security insights', item: absoluteUrl('/insights') }, { '@type': 'ListItem', position: 3, name: guide.title, item: absoluteUrl(`/insights/${guide.slug}`) }] };
  return <InsightsShell><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd([schema, breadcrumbs]) }}/><div className="nw-insights-container nw-guide-layout">
    <article className="nw-guide-article"><nav className="nw-guide-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><a href="/insights">Security insights</a></nav><span className="nw-insights-eyebrow">{guide.category}</span><h1>{guide.title}</h1><p className="nw-guide-intro">{guide.intro}</p><div className="nw-guide-meta"><span><BookOpen size={16}/>{guide.readingMinutes} minute read</span><span>NorthWallEg · Updated <time dateTime={guide.updatedAt}>{new Date(`${guide.updatedAt}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}</time></span></div>
      <nav className="nw-guide-contents" aria-label="In this guide"><strong>In this guide</strong>{guide.sections.map((section, index) => <a href={`#section-${index + 1}`} key={section.heading}>{section.heading}</a>)}</nav>
      {guide.sections.map((section, index) => <section id={`section-${index + 1}`} className="nw-guide-section" key={section.heading}><h2>{section.heading}</h2>{section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}{!!section.checklist?.length && <ul>{section.checklist.map(point => <li key={point}>{point}</li>)}</ul>}{!!section.sourceIds?.length && <p className="nw-guide-citations">Official references: {section.sourceIds.map(id => { const number = guide.sources.findIndex(source => source.id === id) + 1; return number > 0 ? <a key={id} href={`#reference-${number}`}>[{number}]</a> : null; })}</p>}</section>)}
      <section className="nw-guide-sources" aria-labelledby="guide-sources"><h2 id="guide-sources">Official sources</h2><ol>{guide.sources.map((source, index) => <li id={`reference-${index + 1}`} key={source.id}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.label} <ExternalLink size={14}/></a></li>)}</ol><p>Check the linked vendor guidance for current product requirements and supported versions. This guide supports planning; it does not certify an environment or replace an agreed incident-response procedure.</p></section>
    </article><aside className="nw-guide-sidebar"><span className="nw-insights-eyebrow">A PRACTICAL NEXT STEP</span><h2>Bring the plan into your workplace.</h2><p>Discuss the systems you use, the people responsible and the outcome you need.</p><a className="nw-guide-cta" href="/#contact">Talk to the team <Plus size={17}/></a><h3>Related services</h3>{related.map(service => <a className="nw-guide-related" href={`/en/services/${service.id}`} key={service.id}>{service.name.en}<Plus size={14}/></a>)}<a className="nw-guide-all-news" href="/insights#latest-news">Read current security headlines</a></aside>
  </div></InsightsShell>;
}
