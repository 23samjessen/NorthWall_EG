import type { Metadata } from 'next';
import ResetPasswordPage from '@/hostinger/reset-page';
import '@/hostinger/login.css';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Reset your password | NorthWallEg',robots:{index:false,follow:false},referrer:'no-referrer'};
export default function Page(){return <ResetPasswordPage/>;}
