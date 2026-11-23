import type { AsyncLocalStorage } from 'node:async_hooks';

export type NativeIdentity = { userId: string; email: string; name: string };
export type NativeRuntime = {
  config: {
    origin: string;
    publicLaunch: boolean;
    ownerEmail: string;
    allowedHosts: Set<string>;
  };
  auth: {
    getIdentity(request: Request, context?: { clientIp?: string }): Promise<NativeIdentity | null>;
    handle(request: Request, context?: { clientIp?: string }): Promise<Response | null>;
    close(): Promise<void>;
  };
  identityContext: AsyncLocalStorage<{ identity: NativeIdentity | null }>;
  storage: Pick<Cloudflare.Env, 'DB' | 'BUCKET'>;
  close(): Promise<void>;
};
export const NATIVE_RUNTIME_SYMBOL: symbol;
export function getNativeRuntime(): Promise<NativeRuntime>;
