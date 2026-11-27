import { fetchNews, newsTopicCoverage, type NewsResult } from './news-source';
import snapshot from './news-snapshot.json';

let memory:{expires:number;data:NewsResult}|null=null;
let lastGood:NewsResult|null=null;
let inFlight:Promise<NewsResult>|null=null;
async function refreshNews():Promise<NewsResult>{
  const live=await fetchNews();
  for(const error of live.errors)console.warn('NorthWallEg news source unavailable',error.source,error.code||'unavailable');
  const errors=live.errors.map(({source,message,code})=>({source,message,...(process.env.NODE_ENV !== 'production'?{code}:{})}));
  let data:NewsResult={...live,errors};
  if(live.items.length){
    lastGood={...live,errors:[]};
  } else {
    const cached=lastGood?.items.length&&lastGood.fetchedAt?lastGood:snapshot;
    if(cached.items.length&&cached.fetchedAt){
      data={...live,errors,items:cached.items,status:'cached',fetchedAt:cached.fetchedAt,snapshotFetchedAt:cached.fetchedAt,cacheSeconds:60,
        sources:live.sources?.map(source=>({...source,selectedCount:cached.items.filter(item=>item.source===source.name).length})),
        topicCoverage:newsTopicCoverage(cached.items)};
    }
  }
  // One-minute outage retry eligibility is request-driven; no background task runs.
  memory={expires:Date.now()+(live.items.length?600000:60000),data};
  return data;
}
/** Shared server loader for the API and server-rendered insights pages. */
export async function getNews():Promise<NewsResult>{
  if(memory&&memory.expires>Date.now())return structuredClone(memory.data);
  if(!inFlight)inFlight=refreshNews().finally(()=>{inFlight=null;});
  return structuredClone(await inFlight);
}
