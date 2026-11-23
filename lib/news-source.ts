export const NEWS_TOPICS = ['SOAR','Security automation','Malware','Ransomware','Active exploitation','Vulnerabilities','Threat intelligence','Cloud security','Cyberattacks','Security updates'] as const;
export type NewsTopic = typeof NEWS_TOPICS[number];
export type NewsFeed = {id:string;name:string;url:string;category:string;hosts:readonly string[];topic?:NewsTopic};
export const NEWS_FEEDS:readonly NewsFeed[] = [
  {id:'microsoft-security',name:'Microsoft Security',url:'https://www.microsoft.com/en-us/security/blog/feed/',category:'Cybersecurity',hosts:['www.microsoft.com','microsoft.com']},
  {id:'microsoft-blog',name:'Microsoft Blog',url:'https://blogs.microsoft.com/feed/',category:'Technology',hosts:['blogs.microsoft.com','www.microsoft.com','microsoft.com']},
  {id:'cloudflare',name:'Cloudflare Blog',url:'https://blog.cloudflare.com/rss/',category:'Technology & security',hosts:['blog.cloudflare.com']},
  {id:'cisco-talos',name:'Cisco Talos',url:'https://blog.talosintelligence.com/rss/',category:'Threat research',hosts:['blog.talosintelligence.com']},
  {id:'splunk-advisories',name:'Splunk Security Advisories',url:'https://advisory.splunk.com/feed.xml',category:'Security advisories',hosts:['advisory.splunk.com']},
  {id:'palo-alto-soar',name:'Palo Alto Networks',url:'https://www.paloaltonetworks.com/blog/tag/soar-2/feed/',category:'Security operations',hosts:['www.paloaltonetworks.com'],topic:'SOAR'},
  {id:'unit42',name:'Unit 42',url:'https://unit42.paloaltonetworks.com/feed/',category:'Threat research',hosts:['unit42.paloaltonetworks.com']},
  {id:'cert-eu',name:'CERT-EU',url:'https://cert.europa.eu/publications/security-advisories-rss',category:'Security advisories',hosts:['cert.europa.eu']},
];
export const NEWS_MAX_ITEMS=48;
const MAX_FEED_ITEMS=40;
const MAX_PER_SOURCE=12;
const MAX_FEED_BYTES=2_000_000;
const FEED_TIMEOUT_MS=7000;
class NewsFeedError extends Error {constructor(public code:string){super(code);}}
const feedFailure=(error:unknown)=>error instanceof NewsFeedError?error.code:error instanceof Error&&error.name==='AbortError'?'timeout':'network_unavailable';
export type NewsItem={id:string;title:string;url:string;source:string;category:string;publishedAt:string|null;topics?:string[]};
export type NewsSourceCoverage={id:string;name:string;feedUrl:string;category:string;topic?:string;status:'available'|'empty'|'unavailable';availableCount:number;selectedCount:number};
export type NewsTopicCoverage={count:number;status:'available'|'no_matches';message:string};
export type NewsResult={items:NewsItem[];status:'live'|'partial'|'unavailable'|'cached';fetchedAt:string|null;checkedAt:string;cacheSeconds:number;errors:{source:string;message:string;code?:string}[];language:'en';snapshotFetchedAt?:string;sources?:NewsSourceCoverage[];topicCoverage?:Record<string,NewsTopicCoverage>;selectionPolicy?:'source-balanced'};

function decode(value:string){
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]*>/g,' ')
    .replace(/&#x([a-f0-9]+);/gi,(_,x)=>{const n=parseInt(x,16);return n<=0x10ffff?String.fromCodePoint(n):'';})
    .replace(/&#(\d+);/g,(_,x)=>{const n=Number(x);return n<=0x10ffff?String.fromCodePoint(n):'';})
    .replace(/&(amp|quot|apos|lt|gt|nbsp);/g,(_,x)=>(({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '} as Record<string,string>)[x]||''))
    .replace(/<[^>]*>/g,' ').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/\s+/g,' ').trim();
}
const field=(entry:string,name:string)=>entry.match(new RegExp('<'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+name+'>','i'))?.[1]||'';
function categories(entry:string){
  const values=[...entry.matchAll(/<category(?:\s[^>]*)?>([\s\S]*?)<\/category>/gi)].map(match=>decode(match[1]));
  values.push(...[...entry.matchAll(/<category\b[^>]*\bterm=["']([^"']+)["'][^>]*\/?\s*>/gi)].map(match=>decode(match[1])));
  return values.slice(0,40);
}
export function classifyNewsTopics(title:string,summary='',tags:string[]=[]):NewsTopic[]{
  // Use only individual article text/tags. A publisher name or site-wide footer
  // is not evidence that a particular article covers SOAR or an actual attack.
  const text=[title,summary.slice(0,2000),...tags].join(' ');
  const normal=text.replace(/[^a-z0-9]+/gi,' ').toLowerCase();
  const matched=new Set<NewsTopic>();
  if(/\bSOAR\b/.test(text)||/\bxsoar\b/i.test(text)||tags.some(tag=>/^soar$/i.test(tag.trim()))||/\bsecurity orchestration(?: and)? automation(?: and)? response\b/.test(normal))matched.add('SOAR');
  if(matched.has('SOAR')||/\bsecurity (?:automation|orchestration)\b/i.test(text))matched.add('Security automation');
  if(/\b(?:malware|ransomware|trojans?|infostealers?|botnets?|rootkits?|computer virus(?:es)?|malicious software)\b/i.test(text))matched.add('Malware');
  if(/\bransomware\b/i.test(text))matched.add('Ransomware');
  const sentences=[title,...summary.split(/(?<=[.!?])\s+/),...tags];
  if(sentences.some(sentence=>/\b(?:actively exploited|exploited in the wild|known exploited|ongoing exploitation|observed exploitation|exploitation observed)\b/i.test(sentence)&&!/\b(?:no (?:evidence|reports?|known|indications?|signs)|not (?:aware|known|observed|believed|been)|unaware|not (?:currently |actively |yet )?exploited|not being exploited|hasn['’]t been|haven['’]t been|isn['’]t (?:being |actively )?exploited|could be|may be|might be|potential exploitation)\b/i.test(sentence)))matched.add('Active exploitation');
  if(/\b(?:vulnerabilit(?:y|ies)|cve-\d{4}-\d{4,}|security advisor(?:y|ies)|security patches|security patch|patch tuesday)\b/i.test(text))matched.add('Vulnerabilities');
  if(/\b(?:threat intelligence|threat actors?|threat hunting|threat report|threat analysis|cyber ?espionage|espionage campaign|apt\d+)\b/i.test(text))matched.add('Threat intelligence');
  if(/\bcloud security\b/i.test(text)||/\b(?:azure|aws|google cloud|gcp|cloud)\b.{0,100}\b(?:security|attack|breach|vulnerabilit\w*|misconfiguration)\b/i.test(text)||/\b(?:security|attack|breach|vulnerabilit\w*|misconfiguration)\b.{0,100}\b(?:azure|aws|google cloud|gcp|cloud)\b/i.test(text))matched.add('Cloud security');
  if(/\b(?:cyber ?attacks?|data breach(?:es)?|security breach(?:es)?|ddos|phishing|vishing|credential theft|supply[- ]chain attacks?|intrusion campaign)\b/i.test(text))matched.add('Cyberattacks');
  if(/\b(?:security updates?|security patches|security patch|patch tuesday)\b/i.test(text))matched.add('Security updates');
  return NEWS_TOPICS.filter(topic=>matched.has(topic));
}
export function parseNewsDate(value:string):string|null{
  const raw=decode(value).replace(/\bCEST\b/g,'+0200').replace(/\bCET\b/g,'+0100');
  if(!raw)return null;const date=new Date(raw);return Number.isFinite(date.getTime())?date.toISOString():null;
}
function stableItemId(feedId:string,url:string){let hash=2166136261;for(const char of url){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}return `${feedId}-${(hash>>>0).toString(16)}`;}
function approvedUrl(value:string,base:string,feed:NewsFeed):URL|null{
  try{const url=new URL(value,base);if(url.protocol!=='https:'||url.username||url.password||!feed.hosts.includes(url.hostname))return null;url.hash='';return url;}catch{return null;}
}
export function parseNewsFeed(xml:string,feed:NewsFeed):NewsItem[]{
  if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw new NewsFeedError('unsupported_xml_declaration');
  if(!/<(?:rss|feed)(?:\s|>)/i.test(xml))throw new NewsFeedError('invalid_feed_format');
  const language=decode(field(xml,'language'))||xml.match(/<(?:rss|feed|channel)\b[^>]*\bxml:lang=["']([^"']+)["']/i)?.[1]||'';
  if(language&&!/^en(?:[-_]|$)/i.test(language))throw new NewsFeedError('non_english_feed');
  // Talos' official English feed omits language metadata; its English provenance
  // is verified in NEWS.md. Explicit non-English metadata is always rejected.
  const entries=xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi)||xml.match(/<entry(?:\s[^>]*)?>[\s\S]*?<\/entry>/gi)||[];
  const seen=new Set<string>();const items:NewsItem[]=[];
  for(const entry of entries.slice(0,MAX_FEED_ITEMS)){
    const itemLanguage=entry.match(/^<(?:item|entry)\b[^>]*\bxml:lang=["']([^"']+)["']/i)?.[1]||entry.match(/<title\b[^>]*\bxml:lang=["']([^"']+)["']/i)?.[1];
    if(itemLanguage&&!/^en(?:[-_]|$)/i.test(itemLanguage))continue;
    const title=decode(field(entry,'title')).slice(0,240);if(!title)continue;
    const atomLinks=[...entry.matchAll(/<link\b([^>]+)\/?\s*>/gi)].map(match=>match[1]);
    const alternate=atomLinks.find(attrs=>! /\brel=/.test(attrs)||/\brel=["']alternate["']/i.test(attrs));
    const rawLink=decode(field(entry,'link'))||alternate?.match(/\bhref=["']([^"']+)["']/i)?.[1]||'';
    if(!rawLink||rawLink.length>2048)continue;const link=approvedUrl(decode(rawLink),feed.url,feed);if(!link||seen.has(link.toString()))continue;
    const summary=decode(field(entry,'description')||field(entry,'summary')).slice(0,2000);const topics=classifyNewsTopics(title,summary,categories(entry));
    if(feed.topic&&!topics.includes(feed.topic))continue;
    const url=link.toString();seen.add(url);
    items.push({id:stableItemId(feed.id,url),title,url,source:feed.name,category:feed.category,publishedAt:parseNewsDate(field(entry,'pubDate')||field(entry,'published')||field(entry,'updated')),topics});
  }
  return items.sort((a,b)=>(b.publishedAt||'').localeCompare(a.publishedAt||''));
}
async function boundedText(response:Response){
  if(!response.body)throw new NewsFeedError('empty_feed');const reader=response.body.getReader();let length=0;const chunks:Uint8Array[]=[];
  while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>MAX_FEED_BYTES){await reader.cancel();throw new NewsFeedError('feed_too_large');}chunks.push(value);}
  const out=new Uint8Array(length);let at=0;for(const chunk of chunks){out.set(chunk,at);at+=chunk.length;}return new TextDecoder().decode(out);
}
async function fetchFeed(feed:NewsFeed):Promise<NewsItem[]>{
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),FEED_TIMEOUT_MS);
  try{
    const initial=approvedUrl(feed.url,feed.url,feed);if(!initial)throw new NewsFeedError('invalid_source_url');
    let url:URL=initial;
    for(let redirects=0;redirects<=3;redirects++){
      const response:Response=await fetch(url.toString(),{signal:controller.signal,headers:{Accept:'application/rss+xml, application/atom+xml, application/xml, text/xml','User-Agent':'NorthWallEg-News/1.0'},redirect:'manual'});
      if([301,302,303,307,308].includes(response.status)){
        const location:string|null=response.headers.get('location');const next:URL|null=location?approvedUrl(location,url.toString(),feed):null;if(!next)throw new NewsFeedError('unexpected_redirect_host');url=next;continue;
      }
      if(!response.ok)throw new NewsFeedError('publisher_http_'+response.status);
      if(response.url&&!approvedUrl(response.url,url.toString(),feed))throw new NewsFeedError('unexpected_redirect_host');
      return parseNewsFeed(await boundedText(response),feed);
    }
    throw new NewsFeedError('too_many_redirects');
  }finally{clearTimeout(timer);}
}
export function selectBalancedNews(groups:readonly NewsItem[][],maximum=NEWS_MAX_ITEMS):NewsItem[]{
  // Merge metadata for duplicate URLs, then take one article per source in turn.
  // A high-volume publisher cannot consume the complete display limit.
  const topicUnion=new Map<string,Set<string>>();for(const group of groups)for(const item of group){const tags=topicUnion.get(item.url)||new Set<string>();for(const tag of item.topics||[])tags.add(tag);topicUnion.set(item.url,tags);}
  const queues=groups.map(group=>{const seen=new Set<string>();return group.filter(item=>{if(seen.has(item.url))return false;seen.add(item.url);return true;}).slice().sort((a,b)=>(b.publishedAt||'').localeCompare(a.publishedAt||'')).slice(0,MAX_PER_SOURCE);});
  const selected:NewsItem[]=[];const seen=new Set<string>();const offsets=queues.map(()=>0);const limit=Math.max(0,Math.min(NEWS_MAX_ITEMS,Math.floor(maximum)));
  while(selected.length<limit){let advanced=false;for(let source=0;source<queues.length&&selected.length<limit;source++){
    let item:NewsItem|undefined;while(offsets[source]<queues[source].length){const candidate=queues[source][offsets[source]++];if(!seen.has(candidate.url)){item=candidate;break;}}
    if(!item)continue;advanced=true;seen.add(item.url);selected.push({...item,topics:[...(topicUnion.get(item.url)||[])]});
  }if(!advanced)break;}
  return selected;
}
export function newsTopicCoverage(items:readonly NewsItem[]):Record<string,NewsTopicCoverage>{
  return Object.fromEntries(NEWS_TOPICS.map(topic=>{const count=items.filter(item=>item.topics?.includes(topic)).length;return [topic,{count,status:count?'available':'no_matches',message:count?`${count} displayed publisher article${count===1?'':'s'} match${count===1?'es':''} this topic.`:topic==='SOAR'?'No explicit SOAR matches in the displayed publisher articles.':'No matching articles in the displayed publisher set.'}];}));
}
export async function fetchNews():Promise<NewsResult>{
  const results=await Promise.allSettled(NEWS_FEEDS.map(fetchFeed));const errors:NewsResult['errors']=[];const groups:NewsItem[][]=[];const sources:NewsSourceCoverage[]=[];
  results.forEach((result,i)=>{
    const feed=NEWS_FEEDS[i];const items=result.status==='fulfilled'?result.value:[];groups.push(items);
    sources.push({id:feed.id,name:feed.name,feedUrl:feed.url,category:feed.category,...(feed.topic?{topic:feed.topic}:{}),status:result.status==='rejected'?'unavailable':items.length?'available':'empty',availableCount:items.length,selectedCount:0});
    if(result.status==='rejected')errors.push({source:feed.name,message:'The publisher feed is temporarily unavailable.',code:feedFailure(result.reason)});
  });
  const items=selectBalancedNews(groups);for(const source of sources)source.selectedCount=items.filter(item=>item.source===source.name).length;
  const now=new Date().toISOString();return {items,status:items.length?(errors.length?'partial':'live'):'unavailable',fetchedAt:items.length?now:null,checkedAt:now,cacheSeconds:items.length?600:60,errors,language:'en',sources,topicCoverage:newsTopicCoverage(items),selectionPolicy:'source-balanced'};
}
