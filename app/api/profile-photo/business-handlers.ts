import { uploadProfilePhoto, removeProfilePhoto, readProfilePhoto, apiFailure } from '@/lib/workspace-server';
export const dynamic = 'force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Vary':'Cookie'};
export async function GET(request:Request){try{return await readProfilePhoto(request);}catch(error){return apiFailure(error);}}
export async function POST(request:Request){try{return Response.json(await uploadProfilePhoto(request),{headers});}catch(error){return apiFailure(error);}}
export async function DELETE(request:Request){try{return Response.json(await removeProfilePhoto(request),{headers});}catch(error){return apiFailure(error);}}
