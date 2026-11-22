export const NEWS_FEEDS = [
  {name:'Microsoft Security',url:'https://www.microsoft.com/en-us/security/blog/feed/',category:'Cybersecurity',hosts:['www.microsoft.com','microsoft.com']},
  {name:'Microsoft Blog',url:'https://blogs.microsoft.com/feed/',category:'Technology',hosts:['blogs.microsoft.com','www.microsoft.com','microsoft.com']},
  {name:'Cloudflare Blog',url:'https://blog.cloudflare.com/rss/',category:'Technology & security',hosts:['blog.cloudflare.com']},
];
class NewsFeedError extends Error { constructor(public code:string){super(code);} }
const feedFailure=(error:unknown)=>error instanceof NewsFeedError?error.code:error instanceof Error&&error.name==='AbortError'?'timeout':'network_unavailable';
export type NewsItem={id:string;title:string;url:string;source:string;category:string;publishedAt:string|null};
export type NewsResult={items:NewsItem[];status:'live'|'partial'|'unavailable'|'cached';fetchedAt:string|null;checkedAt:string;cacheSeconds:number;errors:{source:string;message:string;code?:string}[];language:'en';snapshotFetchedAt?:string};
function decode(value:string){return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]*>/g,' ').replace(/&#x([a-f0-9]+);/gi,(_,x)=>{const n=parseInt(x,16);return n<=0x10ffff?String.fromCodePoint(n):'';}).replace(/&#(\d+);/g,(_,x)=>{const n=Number(x);return n<=0x10ffff?String.fromCodePoint(n):'';}).replace(/&(amp|quot|apos|lt|gt|nbsp);/g,(_,x)=>(({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '} as Record<string,string>)[x]||'')).replace(/\s+/g,' ').trim();}
const field=(entry:string,name:string)=>entry.match(new RegExp('<'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+name+'>','i'))?.[1]||'';
async function boundedText(response:Response){if(!response.body)throw new NewsFeedError('empty_feed');const reader=response.body.getReader();let length=0;const chunks:Uint8Array[]=[];while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>2_000_000){await reader.cancel();throw new NewsFeedError('feed_too_large');}chunks.push(value);}const out=new Uint8Array(length);let at=0;for(const chunk of chunks){out.set(chunk,at);at+=chunk.length;}return new TextDecoder().decode(out);}
async function fetchFeed(feed:typeof NEWS_FEEDS[number]):Promise<NewsItem[]>{
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),7000);
  try{
    const response=await fetch(feed.url,{signal:controller.signal,headers:{Accept:'application/rss+xml, application/atom+xml, application/xml, text/xml', 'User-Agent':'NorthWallEg-News/1.0'},redirect:'follow'});
    if(!response.ok)throw new NewsFeedError('publisher_http_'+response.status);
    const feedHost=new URL(response.url||feed.url).hostname;if(!feed.hosts.includes(feedHost))throw new NewsFeedError('unexpected_redirect_host');
    const xml=await boundedText(response);const language=decode(field(xml,'language'));if(language&&!/^en(?:[-_]|$)/i.test(language))throw new NewsFeedError('non_english_feed');const entries=xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi)||xml.match(/<entry(?:\s[^>]*)?>[\s\S]*?<\/entry>/gi)||[];
    return entries.slice(0,12).flatMap((entry,i)=>{
      const language=entry.match(/xml:lang=["']([^"']+)["']/i)?.[1];if(language&&!/^en(?:[-_]|$)/i.test(language))return [];
      const title=decode(field(entry,'title')).slice(0,240);const rawLink=decode(field(entry,'link'))||entry.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i)?.[1]||'';
      let link:URL;try{link=new URL(rawLink,feed.url);}catch{return [];}
      if(link.protocol!=='https:'||!feed.hosts.includes(link.hostname)||!title)return [];
      const rawDate=decode(field(entry,'pubDate')||field(entry,'published')||field(entry,'updated'));const date=new Date(rawDate);const publishedAt=Number.isFinite(date.getTime())?date.toISOString():null;
      return [{id:feed.name.toLowerCase().replace(/\W/g,'-')+'-'+i,title,url:link.toString(),source:feed.name,category:feed.category,publishedAt}];
    });
  }finally{clearTimeout(timer);}
}
export async function fetchNews():Promise<NewsResult>{
  const results=await Promise.allSettled(NEWS_FEEDS.map(fetchFeed));const errors:{source:string;message:string;code?:string}[]=[];const collected:NewsItem[]=[];
  results.forEach((result,i)=>{if(result.status==='fulfilled'&&result.value.length)collected.push(...result.value);else {const code=result.status==='rejected'?feedFailure(result.reason):'no_valid_entries';errors.push({source:NEWS_FEEDS[i].name,message:'The publisher feed is temporarily unavailable.',code});}});
  const seen=new Set<string>();const items=collected.filter(item=>{if(seen.has(item.url))return false;seen.add(item.url);return true;}).sort((a,b)=>(b.publishedAt||'').localeCompare(a.publishedAt||'')).slice(0,24);
  const now=new Date().toISOString();return {items,status:items.length?(errors.length?'partial':'live'):'unavailable',fetchedAt:items.length?now:null,checkedAt:now,cacheSeconds:items.length?600:60,errors,language:'en'};
}
