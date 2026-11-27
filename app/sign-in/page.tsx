import SignIn from '@/hostinger/login-page';
import '@/hostinger/login.css';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const metadata={title:'Employee sign in | NorthWallEg',robots:{index:false,follow:false}};
export default function Page(){return <SignIn/>;}
