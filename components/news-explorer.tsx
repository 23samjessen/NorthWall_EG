'use client';

import { useId, useMemo, useState } from 'react';
import { ExternalLink, Filter, Search, X } from 'lucide-react';
import './news-explorer.css';

export type ExplorerNewsItem = {
  id?: string;
  title: string;
  url: string;
  source?: string;
  publisher?: string;
  publishedAt?: string | null;
  category?: string;
  topics?: string[];
};

function safeArticleUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function dateLabel(value?: string | null) {
  if (!value) return 'Publication date unavailable';
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    : 'Publication date unavailable';
}

/** Shared, English-only publisher browser for the public ticker and team workspace. */
export default function NewsExplorer({ items }: { items: ExplorerNewsItem[] }) {
  const prefix = useId();
  const [query, setQuery] = useState('');
  const [source, setSource] = useState('');
  const [topic, setTopic] = useState('');
  const [visibleCount, setVisibleCount] = useState(12);
  const articles = useMemo(() => items.flatMap(item => {
    const href = safeArticleUrl(item.url);
    return href ? [{ ...item, href, publisherName: item.source || item.publisher || 'Publisher', topics: item.topics || [] }] : [];
  }), [items]);
  const sources = useMemo(() => [...new Set(articles.map(item => item.publisherName))].sort(), [articles]);
  const topics = useMemo(() => [...new Set(articles.flatMap(item => item.topics))].sort(), [articles]);
  const needle = query.trim().toLocaleLowerCase('en');
  const filtered = articles.filter(item =>
    (!source || item.publisherName === source) &&
    (!topic || item.topics.includes(topic)) &&
    (!needle || `${item.title} ${item.publisherName} ${item.category || ''} ${item.topics.join(' ')}`.toLocaleLowerCase('en').includes(needle))
  );
  const filteredActive = !!(query || source || topic);
  function clear() { setQuery(''); setSource(''); setTopic(''); setVisibleCount(12); }

  return <div className="nw-news-explorer" dir="ltr">
    <div className="nw-news-explorer-controls">
      <label className="nw-news-explorer-search" htmlFor={`${prefix}-query`}>
        <span>Search headlines</span>
        <div><Search size={17} aria-hidden="true"/><input id={`${prefix}-query`} type="search" value={query} onChange={event => { setQuery(event.target.value); setVisibleCount(12); }} placeholder="Search Cisco, SOAR, cloud security…" autoComplete="off"/></div>
      </label>
      <label htmlFor={`${prefix}-source`}><span>Publisher</span><select id={`${prefix}-source`} value={source} onChange={event => { setSource(event.target.value); setVisibleCount(12); }}>
        <option value="">All publishers</option>
        {source && !sources.includes(source) && <option value={source}>{source} · no current headlines</option>}
        {sources.map(name => <option value={name} key={name}>{name}</option>)}
      </select></label>
      <label htmlFor={`${prefix}-topic`}><span>Topic</span><select id={`${prefix}-topic`} value={topic} onChange={event => { setTopic(event.target.value); setVisibleCount(12); }}>
        <option value="">All topics</option>
        {topic && !topics.includes(topic) && <option value={topic}>{topic} · no current headlines</option>}
        {topics.map(name => <option value={name} key={name}>{name}</option>)}
      </select></label>
    </div>
    <div className="nw-news-explorer-summary"><p role="status" aria-live="polite"><Filter size={14} aria-hidden="true"/>{filtered.length} of {articles.length} headlines{filtered.length > visibleCount ? ` · ${visibleCount} shown` : ''}</p>{filteredActive && <button type="button" onClick={clear}><X size={14} aria-hidden="true"/>Clear filters</button>}</div>
    <div className="nw-news-explorer-articles">
      {filtered.slice(0, visibleCount).map(item => <article className="nw-news-explorer-article" key={item.url}>
        <div className="nw-news-explorer-meta"><strong>{item.publisherName}</strong><span>{dateLabel(item.publishedAt)}</span></div>
        <a href={item.href} target="_blank" rel="noopener noreferrer"><h3>{item.title}</h3><ExternalLink size={17} aria-hidden="true"/><span className="nw-news-explorer-sr"> (opens the original article in a new tab)</span></a>
        {!!item.topics.length && <ul className="nw-news-explorer-topics" aria-label="Article topics">{item.topics.map(name => <li key={name}><button type="button" onClick={() => { setTopic(previous => previous === name ? '' : name); setVisibleCount(12); }} aria-pressed={topic === name} aria-label={`Filter topic: ${name}`}>{name}</button></li>)}</ul>}
      </article>)}
      {!filtered.length && <div className="nw-news-explorer-empty"><Search size={24} aria-hidden="true"/><h3>{articles.length ? 'No headlines match these filters' : 'Publisher headlines are not available yet'}</h3><p>{articles.length ? 'Try another search, publisher or topic.' : 'The news feed will check again automatically while this page is open.'}</p>{filteredActive && <button type="button" onClick={clear}>Show all headlines</button>}</div>}
    </div>
    {filtered.length > visibleCount && <button type="button" className="nw-news-explorer-more" onClick={() => setVisibleCount(count => count + 12)}>Show {Math.min(12, filtered.length - visibleCount)} more headlines</button>}
    {!!articles.length && <p className="nw-news-explorer-note">Headlines link to the original publishers. Topic labels describe the article; publication dates belong to the publisher and are shown in UTC.</p>}
  </div>;
}
