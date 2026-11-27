import { getNews } from '@/lib/news-service';

export const dynamic = 'force-dynamic';
export async function GET(){
  const data=await getNews();
  return Response.json(data,{headers:{'Cache-Control':`public, max-age=${data.status==='cached'||data.status==='unavailable'?60:120}`,'X-Content-Type-Options':'nosniff'}});
}
