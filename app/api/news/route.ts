import { fetchNews, type NewsResult } from '@/lib/news-source';
import snapshot from '@/lib/news-snapshot.json';

export const dynamic = 'force-dynamic';
let memory:{expires:number;data:NewsResult}|null=null;
let lastGood:NewsResult|null=null;
function response(data:NewsResult){
  return Response.json(data,{headers:{'Cache-Control':`public, max-age=${data.status==='cached'||data.status==='unavailable'?60:120}`,'X-Content-Type-Options':'nosniff'}});
}
export async function GET(){
  if(memory&&memory.expires>Date.now())return response(memory.data);
  const live=await fetchNews();
  for(const error of live.errors)console.warn('NorthWallEg news source unavailable',error.source,error.code||'unavailable');
  const errors=live.errors.map(({source,message,code})=>({source,message,...(import.meta.env?.DEV?{code}:{})}));
  let data:NewsResult={...live,errors};
  if(live.items.length){
    lastGood={...live,errors:[]};
  } else {
    const cached=lastGood?.items.length&&lastGood.fetchedAt?lastGood:snapshot;
    if(cached.items.length&&cached.fetchedAt){
      data={...live,errors,items:cached.items,status:'cached',fetchedAt:cached.fetchedAt,snapshotFetchedAt:cached.fetchedAt,cacheSeconds:60};
    }
  }
  // Failed upstream fetches retry after one minute, even when a saved snapshot is shown.
  memory={expires:Date.now()+(live.items.length?600000:60000),data};
  return response(data);
}
