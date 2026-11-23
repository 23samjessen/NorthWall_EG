import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createStorage, initializeSchema, checkStorage, WORKSPACE_SQL, MAX_PHOTO_BYTES } from '../storage.mjs';

// Opt-in real-engine gate. Never point it at the application's database.
// Required: NW_TEST_DB_NAME, NW_TEST_DB_USER. Optional: NW_TEST_DB_HOST (defaults
// to loopback), NW_TEST_DB_PORT, NW_TEST_DB_PASSWORD. Remote hosts also require
// NW_TEST_DB_TLS=true, with NW_TEST_DB_CA_FILE when a private CA is needed.
// The name must be [account_]northwall_test_* and the database must be EMPTY.
// This test creates fixture tables and leaves them for review; it never resets,
// truncates or drops an existing database. Use a new empty test database per run.
// Run: node --test hostinger/tests/storage.mysql.test.mjs
const database = process.env.NW_TEST_DB_NAME;
test('real MySQL/MariaDB workspace, audit and portrait integration', {skip:database ? false : 'Set NW_TEST_DB_NAME to a dedicated empty test database to run this staging gate.'}, async t => {
  assert.match(database, /^(?:[A-Za-z0-9]+_)?northwall_test_[A-Za-z0-9_]+$/);
  assert.ok(database.length <= 64);
  for (const production of [process.env.DB_NAME, process.env.DB_DATABASE, process.env.NW_DB_NAME]) assert.notEqual(database.toLowerCase(), production?.toLowerCase(), 'The test database must be separate from production.');
  assert.ok(process.env.NW_TEST_DB_USER, 'Set a dedicated test database user.');
  const host = process.env.NW_TEST_DB_HOST || '127.0.0.1';
  const port = Number(process.env.NW_TEST_DB_PORT || 3306);
  assert.ok(Number.isInteger(port) && port > 0 && port <= 65535);
  const local = ['127.0.0.1', '::1', 'localhost'].includes(host);
  assert.ok(local || process.env.NW_TEST_DB_TLS === 'true', 'Remote integration databases require verified TLS.');
  const ssl = process.env.NW_TEST_DB_TLS === 'true' ? {rejectUnauthorized:true, ...(process.env.NW_TEST_DB_CA_FILE ? {ca:await readFile(process.env.NW_TEST_DB_CA_FILE, 'utf8')} : {})} : undefined;
  const mysqlModule = await import('mysql2/promise');
  const mysql = mysqlModule.default || mysqlModule;
  const pool = mysql.createPool({host, port, user:process.env.NW_TEST_DB_USER, password:process.env.NW_TEST_DB_PASSWORD || '', database, ssl, charset:'utf8mb4', multipleStatements:false, namedPlaceholders:false, rowsAsArray:false, supportBigNumbers:true, bigNumberStrings:true, connectionLimit:4, waitForConnections:true, queueLimit:8, connectTimeout:10000});
  let temporary;
  let afterSnapshotHead = null;
  const hookedPool = {
    pool:pool.pool,
    execute:pool.execute.bind(pool),
    async getConnection() {
      const connection = await pool.getConnection();
      let readOnly = false;
      return {
        async query(sql) { readOnly ||= sql.includes('WITH CONSISTENT SNAPSHOT, READ ONLY'); return connection.query(sql); },
        async execute(sql, values) {
          const result = await connection.execute(sql, values);
          if (readOnly && afterSnapshotHead && sql.startsWith('SELECT `id`,`payload`,`revision`')) { const hook = afterSnapshotHead; afterSnapshotHead = null; await hook(); }
          return result;
        },
        commit:connection.commit.bind(connection), rollback:connection.rollback.bind(connection), release:connection.release.bind(connection), destroy:connection.destroy.bind(connection),
      };
    },
  };
  try {
    const [[existing]] = await pool.execute('SELECT COUNT(*) AS total FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()');
    assert.equal(Number(existing.total), 0, 'Use a fresh EMPTY dedicated test database. Existing tables will not be altered.');
    await initializeSchema(pool);
    await checkStorage(pool);
    const storage = createStorage(hookedPool);
    const env = {DB:storage.DB, BUCKET:storage.BUCKET, ADMIN_EMAILS:'owner@db-fixture.example'};
    globalThis.__northwallMysqlTestEnv = env;
    temporary = await mkdtemp(join(tmpdir(), 'northwall-mysql-'));
    const ts = (await import('typescript')).default;
    const compile = source => ts.transpileModule(source, {compilerOptions:{target:ts.ScriptTarget.ES2022, module:ts.ModuleKind.ES2022}}).outputText;
    const seed = await readFile(new URL('../../lib/workspace-seed.ts', import.meta.url), 'utf8');
    const source = (await readFile(new URL('../../lib/workspace-server.ts', import.meta.url), 'utf8')).replace("import { env } from 'cloudflare:workers';", 'const env=globalThis.__northwallMysqlTestEnv;').replace("from './workspace-seed'", "from './workspace-seed.mjs'").replace("import resources from './knowledge-resources.json';", 'const resources={resources:[],runbooks:[]};');
    await writeFile(join(temporary, 'workspace-seed.mjs'), compile(seed));
    await writeFile(join(temporary, 'workspace-server.mjs'), compile(source));
    const api = await import(pathToFileURL(join(temporary, 'workspace-server.mjs')).href);
    const identities = {owner:['mysql-fixture-owner', 'owner@db-fixture.example'], employee:['mysql-fixture-employee', 'employee@db-fixture.example']};
    const request = (who, action, payload = {}, revision) => {
      const [id, email] = identities[who];
      const headers = {'Content-Type':'application/json', Origin:'https://mysql-fixture.example', 'Sec-Fetch-Site':'same-origin', 'oai-authenticated-user-id':id, 'oai-authenticated-user-email':email, 'oai-authenticated-user-full-name':'Database fixture ' + who};
      return new Request('https://mysql-fixture.example/api/workspace', {method:action ? 'POST' : 'GET', headers, ...(action ? {body:JSON.stringify({action, payload, revision})} : {})});
    };
    const photo = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+kOnIAAAAASUVORK5CYII=', 'base64');
    const uploadRequest = revision => {
      const headers = new Headers(request('owner').headers); headers.delete('Content-Type');
      const form = new FormData(); form.set('file', new File([photo], 'fixture.png', {type:'image/png'})); form.set('memberId', 'owner'); form.set('revision', String(revision));
      return new Request('https://mysql-fixture.example/api/profile-photo', {method:'POST', headers, body:form});
    };
    let snapshot;
    await t.test('concurrent first setup creates one owner, one head and one audit event', async () => {
      const attempts = await Promise.allSettled([api.mutateWorkspace(request('owner', 'workspace.initialize', {}, 0)), api.mutateWorkspace(request('owner', 'workspace.initialize', {}, 0))]);
      assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 1);
      assert.equal(attempts.find(result => result.status === 'rejected').reason.status, 409);
      snapshot = await api.readWorkspace(request('owner'));
      assert.equal(snapshot.revision, 1);
      assert.equal(snapshot.state.settings.demo, false);
      assert.deepEqual(snapshot.state.users.map(user => user.id), ['owner']);
      const audit = await api.readAudit(request('owner')); assert.equal(audit.total, 1); assert.equal(audit.chainValid, true);
    });
    await t.test('actual invitation, acceptance and approval persist through the MySQL adapter', async () => {
      snapshot = await api.mutateWorkspace(request('owner', 'member.invite', {name:'Database fixture employee', email:identities.employee[1]}, snapshot.revision));
      const member = snapshot.state.users.find(user => user.email === identities.employee[1]);
      const invitation = await api.readInvitationStatus(request('employee'));
      await api.mutateWorkspace(request('employee', 'invitation.accept', {invitationId:invitation.invitationId}));
      await assert.rejects(api.readWorkspace(request('employee')), error => error.status === 403);
      snapshot = await api.readWorkspace(request('owner'));
      snapshot = await api.mutateWorkspace(request('owner', 'member.approve', {id:member.id}, snapshot.revision));
      assert.equal((await api.readWorkspace(request('employee'))).user.id, member.id);
    });
    await t.test('competing writes keep one successful CAS and a valid complete audit chain', async () => {
      const revision = snapshot.revision;
      const attempts = await Promise.allSettled([api.mutateWorkspace(request('owner', 'ticket.create', {title:"Fixture O'Neil'); DROP TABLE workspace; --"}, revision)), api.mutateWorkspace(request('owner', 'ticket.create', {title:"Concurrent 'fixture'; -- literal text"}, revision))]);
      assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 1);
      assert.equal(attempts.find(result => result.status === 'rejected').reason.status, 409);
      snapshot = await api.readWorkspace(request('owner'));
      assert.equal(snapshot.revision, revision + 1);
      assert.equal(snapshot.state.tickets.at(-1).title, attempts.find(result => result.status === 'fulfilled').value.state.tickets.at(-1).title);
      const audit = await api.readAudit(request('owner')); assert.equal(audit.total, snapshot.revision); assert.equal(audit.chainValid, true);
    });
    await t.test('a write committed between audit SELECTs cannot mix snapshots or falsely mark tampering', async () => {
      const before = snapshot.revision;
      afterSnapshotHead = async () => { snapshot = await api.mutateWorkspace(request('owner', 'ticket.create', {title:'Committed while audit snapshot is open'}, before)); };
      const audit = await api.readAudit(request('owner'));
      assert.equal(snapshot.revision, before + 1);
      assert.equal(audit.total, before);
      assert.equal(audit.chainValid, true);
      assert.equal((await api.readAudit(request('owner'))).total, before + 1);
    });
    await t.test('an actual audit constraint failure rolls back the workspace head update', async () => {
      const before = await storage.DB.prepare(WORKSPACE_SQL.read).bind('main').first();
      const duplicate = (await api.readAudit(request('owner'))).audit[0];
      const next = before.revision + 1; const candidateHash = 'f'.repeat(64); const timestamp = new Date().toISOString();
      await assert.rejects(storage.DB.batch([
        storage.DB.prepare(WORKSPACE_SQL.update).bind(before.payload, next, candidateHash, timestamp, 'main', before.revision, before.last_hash),
        storage.DB.prepare(WORKSPACE_SQL.auditInsert).bind(duplicate.id, next, timestamp, 'owner', 'Fixture', 'ticket.create', 'fixture', 'fixture', '{}', before.last_hash, candidateHash, 'main', next, candidateHash),
      ]));
      const after = await storage.DB.prepare(WORKSPACE_SQL.read).bind('main').first();
      assert.equal(after.revision, before.revision); assert.equal(after.last_hash, before.last_hash); assert.equal(after.payload, before.payload);
      assert.equal((await api.readAudit(request('owner'))).chainValid, true);
    });
    await t.test('a 2 MiB private BLOB round-trips within the host packet limit', async () => {
      const key = 'profile-photos/fixture/00000000-0000-4000-8000-000000000002.png';
      const bytes = Buffer.alloc(MAX_PHOTO_BYTES, 0xa7);
      await storage.BUCKET.put(key, bytes, {httpMetadata:{contentType:'image/png'}, customMetadata:{memberId:'fixture'}});
      const stored = await storage.BUCKET.get(key); assert.equal(stored.size, MAX_PHOTO_BYTES); assert.deepEqual(Buffer.from(stored.body), bytes);
      await storage.BUCKET.delete(key); assert.equal(await storage.BUCKET.get(key), null);
    });
    await t.test('profile upload persists a private portrait and a failed later CAS removes only its new orphan', async () => {
      snapshot = await api.uploadProfilePhoto(uploadRequest(snapshot.revision));
      const firstUrl = snapshot.user.photoUrl;
      const base = snapshot.revision;
      env.BUCKET = {...storage.BUCKET, async put(...args) {
        const result = await storage.BUCKET.put(...args);
        snapshot = await api.mutateWorkspace(request('owner', 'profile.update', {name:'Fixture owner', jobTitle:'Database integration fixture'}, base));
        return result;
      }};
      try { await assert.rejects(api.uploadProfilePhoto(uploadRequest(base)), error => error.status === 409); } finally { env.BUCKET = storage.BUCKET; }
      const current = await api.readWorkspace(request('owner')); assert.equal(current.user.photoUrl, firstUrl);
      const [[count]] = await pool.execute('SELECT COUNT(*) AS total FROM `profile_photos`'); assert.equal(Number(count.total), 1);
      const response = await api.readProfilePhoto(new Request('https://mysql-fixture.example/api/profile-photo?memberId=owner', {headers:request('owner').headers}));
      assert.equal(response.headers.get('cache-control'), 'private, no-store'); assert.deepEqual(Buffer.from(await response.arrayBuffer()), photo);
      assert.equal((await api.readAudit(request('owner'))).chainValid, true);
    });
  } catch (error) {
    if (error?.sqlState || error?.sql) throw new Error('A database fixture operation failed. Connection values and driver SQL have been withheld.');
    throw error;
  } finally {
    delete globalThis.__northwallMysqlTestEnv;
    if (temporary) await rm(temporary, {recursive:true, force:true});
    await pool.end();
  }
});
