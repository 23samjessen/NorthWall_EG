import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { safeReturnPath } from '../http.mjs';
import { canonicalizeNativeRequest, hasNativeSessionCookie } from './handlers';
import { getNativeRuntime } from './runtime.mjs';
import { getPublicConfig } from './public-config.mjs';

export type ChatGPTUser = { userId: string; displayName: string; email: string; fullName: string | null };

/** Server components verify the cookie themselves; no transported identity is trusted. */
export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  try {
    const requestHeaders = new Headers(await headers());
    if (!hasNativeSessionCookie(requestHeaders)) return null;
    const config = getPublicConfig();
    const request = canonicalizeNativeRequest(new Request(config.origin + '/workspace', { headers: requestHeaders }), config);
    const runtime = await getNativeRuntime();
    const identity = await runtime.auth.getIdentity(request);
    return identity ? { userId: identity.userId, displayName: identity.name || identity.email, email: identity.email, fullName: identity.name || null } : null;
  } catch {
    // Unavailable storage/configuration never turns a request into an identity.
    return null;
  }
}

export async function requireChatGPTUser(returnTo: string): Promise<ChatGPTUser> {
  const identity = await getChatGPTUser();
  if (identity) return identity;
  redirect(chatGPTSignInPath(returnTo));
}

export async function requireCompanyAccess(returnTo = '/'): Promise<void> {
  if (getPublicConfig().publicLaunch) return;
  await requireChatGPTUser(returnTo);
}

export function chatGPTSignInPath(returnTo: string): string {
  return '/sign-in?return_to=' + encodeURIComponent(safeReturnPath(returnTo));
}

export function chatGPTSignOutPath(returnTo = '/'): string {
  return '/sign-in?mode=logout&return_to=' + encodeURIComponent(safeReturnPath(returnTo));
}
