import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

// Deterministic checks of the production parser, source selection and cache.
// All publisher responses here are fixtures; this test never contacts a network.
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const temporary=await mkdtemp(join(tmpdir(),'northwalleg-news-test-'));
const originalFetch=globalThis.fetch;
const originalNow=Date.now;
const originalWarn=console.warn;
// Verify the published news response shape, including redaction of error codes.
const originalNodeEnv=process.env.NODE_ENV;
process.env.NODE_ENV='production';
let passed=0;
const test=async(name,run)=>{await run();console.log(`ok ${++passed} - ${name}`);};
const compile=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const xmlEscape=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const rss=(entries,language='en-US')=>`<?xml version="1.0"?><rss version="2.0"><channel><title>Test publisher</title>${language?`<language>${language}</language>`:''}${entries.join('')}</channel></rss>`;
const row=({title='Security update',url='https://example.test/post',date='Wed, 18 Nov 2026 18:30:42 CET',description='',tags=[],lang='' }={})=>`<item${lang?` xml:lang="${lang}"`:''}><title>${xmlEscape(title)}</title><link>${xmlEscape(url)}</link><pubDate>${date}</pubDate><description>${xmlEscape(description)}</description>${tags.map(tag=>`<category>${xmlEscape(tag)}</category>`).join('')}</item>`;
try {
  await writeFile(join(temporary,'news-source.mjs'),compile(await readFile(join(root,'lib/news-source.ts'),'utf8')));
  const {NEWS_FEEDS,parseNewsFeed,parseNewsDate,classifyNewsTopics,selectBalancedNews,fetchNews}=await import(pathToFileURL(join(temporary,'news-source.mjs')).href);
  const fixtureFeed={id:'fixture',name:'Fixture publisher',url:'https://example.test/feed',category:'Security advisories',hosts:['example.test']};
  await test('eight distinct official publishers/feed scopes remain configured',()=>{
    assert.equal(NEWS_FEEDS.length,8);assert.equal(new Set(NEWS_FEEDS.map(feed=>feed.id)).size,8);
    assert.equal(NEWS_FEEDS.find(feed=>feed.id==='palo-alto-soar').topic,'SOAR');
    assert.equal(NEWS_FEEDS.find(feed=>feed.id==='splunk-advisories').name,'Splunk Security Advisories');
  });
  await test('RSS uses publisher dates, decodes text and derives explicit article topics',()=>{
    const [item]=parseNewsFeed(rss([row({title:'SOAR & security update',tags:['Vulnerabilities']})]),fixtureFeed);
    assert.equal(item.title,'SOAR & security update');assert.equal(item.publishedAt,'2026-11-18T17:30:42.000Z');
    assert.ok(item.topics.includes('SOAR'));assert.ok(item.topics.includes('Vulnerabilities'));
  });
  await test('Atom alternate links, dates and category terms are supported',()=>{
    const xml='<feed xml:lang="en"><entry><title>Automation guide</title><link rel="self" href="https://example.test/api"/><link rel="alternate" href="https://example.test/article"/><published>2026-07-30T14:00:23Z</published><category term="SOAR"/></entry></feed>';
    const [item]=parseNewsFeed(xml,fixtureFeed);assert.equal(item.url,'https://example.test/article');assert.equal(item.publishedAt,'2026-07-30T14:00:23.000Z');assert.ok(item.topics.includes('SOAR'));
  });
  await test('CET and CEST normalize correctly; missing/invalid dates are never invented',()=>{
    assert.equal(parseNewsDate('Wed, 18 Nov 2026 18:30:42 CET'),'2026-11-18T17:30:42.000Z');
    assert.equal(parseNewsDate('Thu, 30 Jul 2026 16:00:23 CEST'),'2026-07-30T14:00:23.000Z');assert.equal(parseNewsDate(''),null);assert.equal(parseNewsDate('not a date'),null);
  });
  await test('declared non-English feeds are rejected and non-English entries skipped',()=>{
    assert.throws(()=>parseNewsFeed(rss([row()],'ar'),fixtureFeed),/non_english_feed/);
    assert.equal(parseNewsFeed(rss([row({lang:'de'}),row({url:'https://example.test/english',lang:'en-GB'})]),fixtureFeed).length,1);
    assert.throws(()=>parseNewsFeed(rss([row()],'not-en'),fixtureFeed),/non_english_feed/);
  });
  await test('verified source without language metadata remains usable',()=>assert.equal(parseNewsFeed(rss([row()],''),fixtureFeed).length,1));
  await test('external, insecure, credential-bearing and executable article links are discarded',()=>{
    const links=['https://attacker.test/x','http://example.test/x','https://user:password@example.test/x','javascript:alert(1)','https://example.test.evil.test/x','https://example.test/safe#section'];
    const items=parseNewsFeed(rss(links.map(url=>row({url}))),fixtureFeed);assert.equal(items.length,1);assert.equal(items[0].url,'https://example.test/safe');
  });
  await test('XML external entity/doctype declarations and HTML impostors are rejected',()=>{
    assert.throws(()=>parseNewsFeed('<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///secret">]>'+rss([row()]),fixtureFeed),/unsupported_xml_declaration/);
    assert.throws(()=>parseNewsFeed('<html>Publisher maintenance</html>',fixtureFeed),/invalid_feed_format/);
  });
  await test('article links permit standard HTTPS only, including normalized explicit port 443',()=>{
    const links=['https://example.test:8443/blocked','https://example.test:80/blocked','https://example.test:443/standard'];
    const items=parseNewsFeed(rss(links.map(url=>row({url}))),fixtureFeed);
    assert.deepEqual(items.map(item=>item.url),['https://example.test/standard']);
  });
  await test('CDATA, escaped markup, numeric entities and quoted attributes remain readable',()=>{
    const xml='<feed\n xml:lang = "en"><entry><title><![CDATA[<b>SOAR</b> &amp; &#x41; &#66; &lt;i&gt;guide&lt;/i&gt;]]></title><link\t rel = "alternate" href = "https://example.test/post?q=a>b"/><category term="SOAR"/></entry></feed>';
    const [item]=parseNewsFeed(xml,fixtureFeed);assert.equal(item.title,'SOAR & A B guide');
    assert.equal(item.url,'https://example.test/post?q=a%3Eb');assert.ok(item.topics.includes('SOAR'));
  });
  await test('Unicode case folding cannot shift XML tag offsets',()=>{
    const xml=rss([row({title:'İstanbul security update — café',description:'İstanbul cloud security'})]).replace('<title>Test publisher</title>','<title>İstanbul publisher</title>');
    const [item]=parseNewsFeed(xml,fixtureFeed);assert.equal(item.title,'İstanbul security update — café');assert.ok(item.topics.includes('Cloud security'));
  });
  await test('comments and CDATA cannot introduce extra articles or replace article links',()=>{
    const xml=rss([`<!--${row({title:'Comment impostor',url:'https://example.test/comment'})}-->`,`<item><title>Actual headline</title><description><![CDATA[<link>https://example.test/quoted</link>]]></description><link>https://example.test/actual</link></item>`]);
    const items=parseNewsFeed(xml,fixtureFeed);assert.equal(items.length,1);assert.equal(items[0].url,'https://example.test/actual');
    assert.throws(()=>parseNewsFeed(rss(['<item><title><![CDATA[unterminated</title></item>']),fixtureFeed),/malformed_xml_text/);
  });
  await test('unterminated angle-bracket fields are bounded and discarded without backtracking',()=>{
    const xml=rss([`<item><title>${'<'.repeat(32000)}</title><link>https://example.test/bad</link></item>`,row({title:'Safe following headline',url:'https://example.test/good'})]);
    const started=performance.now();const items=parseNewsFeed(xml,fixtureFeed);assert.equal(items.length,1);assert.equal(items[0].title,'Safe following headline');
    assert.ok(performance.now()-started<1000,'Bounded local fixture must not spend a second cleaning 32k malformed title characters.');
  });
  await test('repeated unterminated item and Atom entry openers terminate in one forward scan',()=>{
    for(const tag of ['item','entry']){
      const xml=rss([`<${tag}>`.repeat(12000)]);const started=performance.now();assert.deepEqual(parseNewsFeed(xml,fixtureFeed),[]);
      assert.ok(performance.now()-started<1000,'Repeated unmatched entry starts must not trigger repeated whole-feed scans.');
    }
  });
  await test('oversized tag headers and excessive attributes fail closed before extraction',()=>{
    assert.throws(()=>parseNewsFeed(`<rss ${' '.repeat(8192)}><channel/></rss>`,fixtureFeed),/malformed_xml_tag/);
    const attrs=Array.from({length:33},(_,i)=>` p${i}="x"`).join('');assert.throws(()=>parseNewsFeed(`<rss${attrs}><channel/></rss>`,fixtureFeed),/malformed_xml_attribute/);
    assert.throws(()=>parseNewsFeed('<rss xml:lang="en><channel/></rss>',fixtureFeed),/malformed_xml_tag/);
  });
  await test('direct parser calls enforce the same overall input ceiling',()=>assert.throws(()=>parseNewsFeed('x'.repeat(2_000_001),fixtureFeed),/feed_too_large/));
  await test('oversized article links are rejected rather than truncated into other destinations',()=>{
    const items=parseNewsFeed(rss([row({url:'https://example.test/'+('a'.repeat(9000))}),row({url:'https://example.test/safe'})]),fixtureFeed);
    assert.deepEqual(items.map(item=>item.url),['https://example.test/safe']);
  });
  await test('large title/summary/category fields are bounded before classification',()=>{
    const [item]=parseNewsFeed(rss([row({title:'A'.repeat(100000),description:'x'.repeat(20000)+' SOAR',tags:['x'.repeat(30000)+' SOAR']})]),fixtureFeed);
    assert.equal(item.title.length,240);assert.ok(!item.topics.includes('SOAR'));
  });
  await test('SOAR requires explicit product, taxonomy or expanded phrase evidence',()=>{
    for(const title of ['SOAR security update','Cortex XSOAR guide','Security orchestration, automation and response'])assert.ok(classifyNewsTopics(title).includes('SOAR'));
    assert.ok(classifyNewsTopics('A product guide','',['soar']).includes('SOAR'));
    assert.ok(!classifyNewsTopics('Profits soar after new product release').includes('SOAR'));
    assert.ok(!classifyNewsTopics('Security automation workflow').includes('SOAR'));
    assert.ok(classifyNewsTopics('Security automation workflow').includes('Security automation'));
  });
  await test('active exploitation labels require affirmative evidence, not denial or possibility',()=>{
    assert.ok(classifyNewsTopics('Vendor advisory','The vulnerability is actively exploited in the wild.').includes('Active exploitation'));
    for(const text of ['No evidence of this vulnerability being actively exploited.','The vendor is not aware of any reports of this vulnerability being actively exploited in the wild.','This vulnerability has not been actively exploited.','There are no reports of ongoing exploitation.','This vulnerability might be actively exploited.','This vulnerability is not known to be actively exploited.'])assert.ok(!classifyNewsTopics('Vendor advisory',text).includes('Active exploitation'),text);
  });
  await test('malware, ransomware and breach topics follow individual article wording',()=>{
    const topics=classifyNewsTopics('Ransomware attack causes a data breach');assert.ok(topics.includes('Malware'));assert.ok(topics.includes('Ransomware'));assert.ok(topics.includes('Cyberattacks'));
    assert.deepEqual(classifyNewsTopics('A new office opens'),[]);
  });
  const groups=Array.from({length:8},(_,source)=>Array.from({length:12},(_,index)=>({id:`${source}-${index}`,title:`Fixture ${source}/${index}`,url:`https://example.test/${source}/${index}`,source:`Source ${source}`,category:'Test',publishedAt:source===5?'2026-07-30T14:00:23.000Z':`2026-11-${String(20-Math.min(index,9)).padStart(2,'0')}T00:00:00.000Z`,topics:source===5?['SOAR']:[]})));
  await test('source-balanced 48-headline selection preserves all eight publishers including older SOAR articles',()=>{
    const items=selectBalancedNews(groups);assert.equal(items.length,48);
    for(let source=0;source<8;source++)assert.equal(items.filter(item=>item.source===`Source ${source}`).length,6);
    assert.equal(items.filter(item=>item.topics.includes('SOAR')).length,6);
  });
  await test('URL duplicates display once and retain explicit topic metadata from both feeds',()=>{
    const duplicate={...groups[0][0],source:'Second publisher',topics:['SOAR']};
    const items=selectBalancedNews([[groups[0][0]],[duplicate]]);assert.equal(items.length,1);assert.ok(items[0].topics.includes('SOAR'));
    assert.equal(selectBalancedNews([groups[0]],999).length,12);
  });
  await test('valid dedicated topic feed can contain no explicit matches without parser failure',()=>assert.deepEqual(parseNewsFeed(rss([row({title:'General company news'})]),{...fixtureFeed,topic:'SOAR'}),[]));
  const feedFor=url=>NEWS_FEEDS.find(feed=>feed.url===String(url));
  const feedBody=(feed,{emptySoar=false}={})=>rss([row({title:feed.topic&&!emptySoar?'SOAR security update':'Security update',url:`https://${feed.hosts[0]}/fixture/${feed.id}`,tags:feed.topic&&!emptySoar?[feed.topic]:[]})]);
  await test('healthy empty SOAR feed reports no matches without reporting an outage',async()=>{
    globalThis.fetch=async url=>new Response(feedBody(feedFor(url),{emptySoar:true}));const result=await fetchNews();
    assert.equal(result.status,'live');assert.equal(result.errors.length,0);assert.equal(result.sources.find(source=>source.topic==='SOAR').status,'empty');assert.equal(result.topicCoverage.SOAR.status,'no_matches');assert.equal(result.topicCoverage.SOAR.count,0);
  });
  await test('one failed publisher produces partial coverage and a transparent source error',async()=>{
    globalThis.fetch=async url=>feedFor(url).id==='cisco-talos'?new Response('Unavailable',{status:503}):new Response(feedBody(feedFor(url)));
    const result=await fetchNews();assert.equal(result.status,'partial');assert.equal(result.errors.length,1);assert.equal(result.errors[0].source,'Cisco Talos');assert.equal(result.errors[0].code,'publisher_http_503');assert.ok(result.fetchedAt);
  });
  await test('all failed publishers leave fetchedAt null; an attempt time remains available',async()=>{
    globalThis.fetch=async()=>{throw new TypeError('Network fixture unavailable');};const result=await fetchNews();assert.equal(result.status,'unavailable');assert.equal(result.fetchedAt,null);assert.ok(result.checkedAt);assert.equal(result.errors.length,8);assert.equal(result.cacheSeconds,60);
  });
  await test('off-allowlist redirect is blocked before any request reaches its target',async()=>{
    const requested=[];globalThis.fetch=async url=>{requested.push(String(url));return feedFor(url).id==='cisco-talos'?new Response(null,{status:302,headers:{location:'https://attacker.test/stolen'}}):new Response(feedBody(feedFor(url)));};
    const result=await fetchNews();assert.equal(result.errors.find(error=>error.source==='Cisco Talos').code,'unexpected_redirect_host');assert.equal(requested.length,8);assert.ok(requested.every(url=>!url.includes('attacker.test')));
  });
  await test('same-publisher redirect to a nonstandard HTTPS port is blocked before fetching',async()=>{
    const requested=[];globalThis.fetch=async url=>{requested.push(String(url));return feedFor(url).id==='cisco-talos'?new Response(null,{status:302,headers:{location:'https://blog.talosintelligence.com:8443/internal'}}):new Response(feedBody(feedFor(url)));};
    const result=await fetchNews();assert.equal(result.errors.find(error=>error.source==='Cisco Talos').code,'unexpected_redirect_host');assert.equal(requested.length,8);assert.ok(requested.every(url=>!url.includes(':8443')));
  });
  await test('oversized feeds are rejected at the bounded body reader',async()=>{
    globalThis.fetch=async url=>new Response(feedFor(url).id==='cloudflare'?'x'.repeat(2_000_001):feedBody(feedFor(url)));
    const result=await fetchNews();assert.equal(result.errors.find(error=>error.source==='Cloudflare Blog').code,'feed_too_large');assert.equal(result.status,'partial');
  });
  const snapshot=JSON.parse(await readFile(join(root,'lib/news-snapshot.json'),'utf8'));
  const serviceSource=(await readFile(join(root,'lib/news-service.ts'),'utf8')).replace("from './news-source'","from './news-source.mjs'").replace("import snapshot from './news-snapshot.json';",`const snapshot=${JSON.stringify(snapshot)};`);
  await writeFile(join(temporary,'news-service.mjs'),compile(serviceSource));
  console.warn=()=>{};
  let now=originalNow();Date.now=()=>now;let calls=0;
  globalThis.fetch=async url=>{calls++;return new Response(feedBody(feedFor(url)));};
  const {getNews}=await import(pathToFileURL(join(temporary,'news-service.mjs')).href);
  let first;
  await test('shared loader coalesces concurrent requests and caches successful reads for ten minutes',async()=>{
    const [a,b]=await Promise.all([getNews(),getNews()]);first=a;assert.equal(calls,8);assert.equal(a.status,'live');assert.deepEqual(a,b);
    a.items[0].title='Caller mutation';const again=await getNews();assert.notEqual(again.items[0].title,'Caller mutation');assert.equal(calls,8);
    now+=599_000;await getNews();assert.equal(calls,8);
  });
  await test('outage fallback retains the original fetch date, tracks the attempt and retries after one minute',async()=>{
    now+=2_000;globalThis.fetch=async()=>{calls++;throw new Error('Fixture unavailable');};
    const cached=await getNews();assert.equal(cached.status,'cached');assert.equal(cached.fetchedAt,first.fetchedAt);assert.equal(cached.snapshotFetchedAt,first.fetchedAt);assert.ok(cached.checkedAt);assert.equal(cached.errors.length,8);assert.ok(cached.errors.every(error=>!('code' in error)));assert.equal(calls,16);
    now+=59_000;await getNews();assert.equal(calls,16);now+=2_000;
    globalThis.fetch=async url=>{calls++;return new Response(feedBody(feedFor(url)));};assert.equal((await getNews()).status,'live');assert.equal(calls,24);
  });
  await test('cold-start outage serves only saved real snapshot data with its original timestamp',async()=>{
    globalThis.fetch=async()=>{throw new Error('Fixture unavailable');};
    const cold=await import(pathToFileURL(join(temporary,'news-service.mjs')).href+'?cold');const result=await cold.getNews();
    assert.equal(result.status,'cached');assert.deepEqual(result.items,snapshot.items);assert.equal(result.fetchedAt,snapshot.fetchedAt);assert.equal(result.snapshotFetchedAt,snapshot.fetchedAt);assert.equal(result.cacheSeconds,60);
  });
  console.log(`\n${passed} news checks passed. No external network requests were made.`);
} finally {
  globalThis.fetch=originalFetch;Date.now=originalNow;console.warn=originalWarn;
  if(originalNodeEnv===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=originalNodeEnv;
  await rm(temporary,{recursive:true,force:true});
}
