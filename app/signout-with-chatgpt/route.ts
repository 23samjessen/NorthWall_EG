import { NextResponse } from 'next/server';
import { safeReturnPath } from '@/hostinger/http.mjs';
import { getPublicConfig } from '@/hostinger/native/public-config.mjs';
export const dynamic='force-dynamic';
export function GET(request:Request){const config=getPublicConfig();const url=new URL(request.url);const target=new URL('/sign-in',config.origin);target.searchParams.set('return_to',safeReturnPath(url.searchParams.get('return_to')));target.searchParams.set('mode','logout');return NextResponse.redirect(target,303);}
