/** Populated by the private Node entry point before Next.js handles a request. */
const RUNTIME = Symbol.for('northwalleg.hostinger.runtime');
type VerifiedIdentity = {userId:string;email:string;name:string};
type Runtime = Cloudflare.Env & {identityContext:{getStore:()=>{identity:VerifiedIdentity|null}|undefined}};
export function trustedIdentity():VerifiedIdentity|null {
  const runtime=(globalThis as unknown as Record<symbol,Runtime>)[RUNTIME];
  return runtime?.identityContext?.getStore()?.identity||null;
}
export const env = new Proxy({} as Cloudflare.Env, {
  get(_target, property) {
    const value = (globalThis as unknown as Record<symbol, Cloudflare.Env>)[RUNTIME];
    if (!value) throw new Error('The Hostinger runtime has not been initialized.');
    return Reflect.get(value, property);
  },
});
