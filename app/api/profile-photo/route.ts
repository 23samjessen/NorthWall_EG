import { withWorkspaceRequest } from '@/hostinger/native/handlers';
import * as business from './business-handlers';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){return withWorkspaceRequest(request,business.GET);}
export async function POST(request:Request){return withWorkspaceRequest(request,business.POST);}
export async function DELETE(request:Request){return withWorkspaceRequest(request,business.DELETE);}
