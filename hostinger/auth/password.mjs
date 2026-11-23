import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

// OWASP Password Storage Cheat Sheet: scrypt N=2^17, r=8, p=1.
// Two concurrent jobs require about 256 MiB for the KDFs, plus process overhead.
const PARAMETERS = Object.freeze({ N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 });
const MAX_CONCURRENT = 2;
const MAX_QUEUED = 8;
let running = 0;
const waiting = [];

async function acquire() {
  if (running < MAX_CONCURRENT) { running++; return; }
  if (waiting.length >= MAX_QUEUED) {
    const error = new Error('Authentication is busy. Please try again shortly.');
    error.code = 'AUTH_KDF_BUSY';
    throw error;
  }
  await new Promise(resolve => waiting.push(resolve));
}
function release() {
  const next = waiting.shift();
  if (next) next();
  else running--;
}
function normalizedPassword(value) {
  if (typeof value !== 'string' || value.length > 512) return null;
  const password = value.normalize('NFC');
  if (Buffer.byteLength(password, 'utf8') > 1024) return null;
  return password;
}
function validatePassword(value,minimum) {
  const password = normalizedPassword(value);
  if (password === null || [...password].length < minimum || [...password].length > 128)
    throw new Error(`Use a password between ${minimum} and 128 characters.`);
  if (new Set(['passwordpassword', 'passwordpasswordpassword', '123456789012345', '1234567890123456', 'qwertyqwertyqwerty', 'correcthorsebatterystaple']).has(password.toLowerCase()))
    throw new Error('Choose a password that is not commonly used.');
  return password;
}
export const validateNewPassword=value=>validatePassword(value,15);
async function derive(password, salt) {
  await acquire();
  try {
    return await new Promise((resolve, reject) => scrypt(password, salt, 64, PARAMETERS, (error, key) => error ? reject(error) : resolve(key)));
  } finally { release(); }
}
async function encodePassword(value,minimum) {
  const password = validatePassword(value,minimum);
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt$1$131072$8$1$${salt.toString('base64url')}$${key.toString('base64url')}`;
}
export const hashPassword=value=>encodePassword(value,15);
// Offline owner provisioning only. No HTTP endpoint can select this policy.
export const hashTemporaryPassword=value=>encodePassword(value,8);
// A missing account still performs the same bounded KDF work. This is not a login credential.
export const DUMMY_PASSWORD_HASH = `scrypt$1$131072$8$1$${Buffer.alloc(16, 0x7d).toString('base64url')}$${Buffer.alloc(64, 0xa3).toString('base64url')}`;
export async function verifyPassword(value, encoded = DUMMY_PASSWORD_HASH) {
  const password = normalizedPassword(value);
  if (password === null) return false;
  const fields = String(encoded).split('$');
  const valid = fields.length === 7 && fields.slice(0, 5).join('$') === 'scrypt$1$131072$8$1' && /^[A-Za-z0-9_-]{22}$/.test(fields[5]) && /^[A-Za-z0-9_-]{86}$/.test(fields[6]);
  const record = valid ? fields : DUMMY_PASSWORD_HASH.split('$');
  const salt = Buffer.from(record[5], 'base64url');
  const expected = Buffer.from(record[6], 'base64url');
  const actual = await derive(password, salt);
  return valid && expected.length === actual.length && timingSafeEqual(expected, actual);
}
