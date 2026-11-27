import { withPublicRequest } from '@/hostinger/native/handlers';
import { GET as readNews } from './business-handlers';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){return withPublicRequest(request,()=>readNews());}
