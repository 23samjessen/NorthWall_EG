// Loaded only by an explicit node --import in native-render.mjs. Production code
// does not select this fixture using an environment variable or an HTTP header.
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import { createAuthService } from '../auth/index.mjs';
import { readConfig } from '../config.mjs';
import { MemoryAuthStore } from './auth-store.mjs';
import { fixtureOwner, fixtureTemporaryPassword } from './native-fixture-data.mjs';

if (!process.send) throw new Error('The native fixture requires its isolated test IPC process.');
const manifest = JSON.parse(await readFile(new URL('../../hostinger-build.json', import.meta.url), 'utf8'));
if (manifest.publicLaunch !== false) throw new Error('The native fixture requires a private prelaunch build.');
const config = readConfig({
  APP_ORIGIN: manifest.origin,
  PUBLIC_LAUNCH: 'false',
  EDGE_HTTPS_CONFIRMED: 'true',
  OWNER_EMAIL: fixtureOwner,
  AUTH_SECRET: randomBytes(32).toString('hex'),
  DB_HOST: '127.0.0.1', DB_NAME: 'native_fixture_only', DB_USER: 'native_fixture_only', DB_PASSWORD: 'synthetic-unused',
  SMTP_HOST: 'smtp.example.test', SMTP_USER: 'native-sender@example.test', SMTP_PASSWORD: 'synthetic-unused',
});
const sqlite = new DatabaseSync(':memory:');
sqlite.exec(`
  CREATE TABLE workspace (id TEXT PRIMARY KEY NOT NULL,payload TEXT NOT NULL,revision INTEGER NOT NULL,last_hash TEXT NOT NULL,updated_at TEXT NOT NULL);
  CREATE TABLE audit_events (id TEXT PRIMARY KEY NOT NULL,sequence INTEGER NOT NULL UNIQUE,timestamp TEXT NOT NULL,actor_id TEXT NOT NULL,actor_name TEXT NOT NULL,action TEXT NOT NULL,object_id TEXT NOT NULL,request_id TEXT NOT NULL,changes TEXT NOT NULL,previous_hash TEXT NOT NULL,hash TEXT NOT NULL UNIQUE);
`);
function statement(sql, params = []) {
  return {
    sql,
    bind(...values) { return statement(sql, values); },
    async first() { return sqlite.prepare(sql).get(...params) || null; },
    async all() { return {results: sqlite.prepare(sql).all(...params)}; },
    run() {
      if (/^SELECT\b/i.test(sql.trim())) return {results: sqlite.prepare(sql).all(...params), meta: {changes: 0}};
      return {meta: {changes: Number(sqlite.prepare(sql).run(...params).changes)}};
    },
  };
}
const photos = new Map();
const storage = {
  DB: {
    prepare: statement,
    async batch(statements) {
      sqlite.exec('BEGIN IMMEDIATE');
      try { const result = statements.map(item => item.run()); sqlite.exec('COMMIT'); return result; }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  },
  BUCKET: {
    async put(key, bytes) { const copy = new Uint8Array(bytes); photos.set(key, copy); return {key, size: copy.byteLength}; },
    async get(key) { const bytes = photos.get(key); return bytes ? {body: bytes.slice(), size: bytes.byteLength} : null; },
    async delete(key) { photos.delete(key); },
  },
};
const getInvitation = async email => {
  const record = sqlite.prepare('SELECT payload FROM workspace WHERE id=?').get('main');
  if (!record) return null;
  const members = JSON.parse(record.payload).users.filter(member => member.id !== 'owner' && !member.sample && member.email?.toLowerCase() === email && member.onboarding?.status === 'invited' && member.onboarding.invitedBy === 'owner' && !member.active && !member.userId);
  if (members.length !== 1) return null;
  const member = members[0];
  return {memberId: member.id, invitationId: member.onboarding.invitationId, status: 'invited', expiresAt: member.onboarding.expiresAt, identityAnchorUserId: member.onboarding.identityAnchorUserId};
};
const store = new MemoryAuthStore();
const auth = createAuthService({
  store, origin: config.origin, secret: config.secret, ownerEmail: config.ownerEmail,
  getInvitation,
  sendCode: async ({to, code}) => {
    // IPC stays in the test harness; codes are never written to process output.
    process.send({type: 'native-fixture-mail', to, code});
  },
});
await auth.createOwner(fixtureOwner, fixtureTemporaryPassword, {temporary: true, userId: 'native-fixture-owner'});
globalThis[Symbol.for('northwalleg.hostinger.native-runtime')] = {
  config, auth, identityContext: new AsyncLocalStorage(), storage,
  async close() { sqlite.close(); },
};
process.send({type: 'native-fixture-ready'});
