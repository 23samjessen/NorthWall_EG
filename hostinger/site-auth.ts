import { redirect } from 'next/navigation';
import { trustedIdentity } from '@/hostinger/runtime-env';
export type ChatGPTUser={userId:string;displayName:string;email:string;fullName:string|null};
export async function getChatGPTUser():Promise<ChatGPTUser|null>{const identity=trustedIdentity();return identity?{userId:identity.userId,displayName:identity.name||identity.email,email:identity.email,fullName:identity.name||null}:null;}
export async function requireChatGPTUser(returnTo:string):Promise<ChatGPTUser>{const user=await getChatGPTUser();if(user)return user;redirect(chatGPTSignInPath(returnTo));}
function safe(value:string){if(!value.startsWith('/')||value.startsWith('//')||/[\\\u0000-\u001f]/.test(value))return '/workspace';try{const url=new URL(value,'https://return.invalid');return url.origin==='https://return.invalid'&&!/^\/(?:sign-in|api|signin-with-chatgpt|signout-with-chatgpt)(?:\/|$)/.test(url.pathname)?url.pathname+url.search+url.hash:'/workspace';}catch{return '/workspace';}}
export function chatGPTSignInPath(returnTo:string){return '/sign-in?return_to='+encodeURIComponent(safe(returnTo));}
export function chatGPTSignOutPath(returnTo='/'){return '/sign-in?mode=logout&return_to='+encodeURIComponent(safe(returnTo));}
