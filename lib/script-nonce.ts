import { headers } from 'next/headers';
import { NONCE_HEADER } from './security-headers';

export async function scriptNonce() {
  const nonce = (await headers()).get(NONCE_HEADER);
  return nonce && /^[a-f0-9]{48}$/.test(nonce) ? nonce : undefined;
}
