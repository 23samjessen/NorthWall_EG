'use client';
import { useEffect, useState } from 'react';
import { Activity, Clock3, Globe2 } from 'lucide-react';
import type { NewsResult } from '@/lib/news-source';
import NewsExplorer from './news-explorer';

function stamp(value?: string | null) {
  if (!value) return 'No successful retrieval yet';
  return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC';
}

export default function InsightsFeed({ initialData }: { initialData: NewsResult }) {
  const [data, setData] = useState(initialData);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    async function refresh() {
      try {
        const response = await fetch('/api/news');
        if (!response.ok) throw new Error('News unavailable');
        const next = await response.json() as NewsResult;
        if (!alive) return;
        setData(previous => next.status === 'unavailable' && previous.items.length
          ? { ...previous, status: 'cached', checkedAt: next.checkedAt, errors: next.errors, cacheSeconds: next.cacheSeconds }
          : next);
        setFailed(false);
      } catch { if (alive) setFailed(true); }
    }
    const timer = setInterval(() => void refresh(), 120000);
    return () => { alive = false; clearInterval(timer); };
  }, []);
  const state = failed && data.items.length ? 'cached' : failed ? 'unavailable' : data.status;
  const label = { live: 'Live publisher feeds', partial: 'Some feeds unavailable', cached: 'Cached publisher headlines', unavailable: 'Feeds temporarily unavailable' }[state];
  const sources = [...new Set(data.items.map(item => item.source))];
  return <section className="nw-insights-feed" id="latest-news" aria-labelledby="latest-news-title">
    <div className="nw-insights-section-heading"><div><span className="nw-insights-eyebrow">THE SECURITY BRIEF</span><h2 id="latest-news-title">What deserves your attention.</h2></div><p>Selected international reporting on attacks, malware, vulnerabilities and security operations. Every headline keeps its publisher and original publication date.</p></div>
    <div className={`nw-insights-feed-status status-${state}`}><span><Activity size={17}/><strong>{label}</strong></span><span><Globe2 size={16}/>{sources.length} publishers represented</span><span><Clock3 size={16}/>Retrieved: {stamp(data.fetchedAt)}</span></div>
    {(state === 'cached' || state === 'partial' || state === 'unavailable') && <p className="nw-insights-feed-notice">{state === 'cached' ? 'The current refresh did not provide usable headlines. Previously retrieved headlines remain available with their original dates.' : state === 'partial' ? 'Available publisher updates are shown. A feed that could not respond will be checked again.' : 'There are no usable publisher headlines at the moment. The feed will check again automatically.'}</p>}
    <NewsExplorer items={data.items}/>
    <details className="nw-insights-source-details"><summary>Sources and refresh policy</summary><p>Configured feeds: {(data.sources?.map(source => source.name) || sources).join(' · ') || 'Publisher feeds are being checked.'}</p><p>Last server check: {stamp(data.checkedAt)}. Open pages check every two minutes. Successful upstream results are cached for ten minutes and refreshed on the next request after expiry. Publication dates can be older than the retrieval time. This is a selected news collection, not a complete incident-monitoring service.</p>{!!data.errors.length && <p>Sources unavailable at the last server check: {data.errors.map(error => error.source).join(', ')}.</p>}{data.topicCoverage?.SOAR?.status === 'no_matches' && <p>{data.topicCoverage.SOAR.message}</p>}</details>
  </section>;
}
