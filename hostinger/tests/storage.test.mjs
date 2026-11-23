import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createStorage, initializeSchema, checkStorage, WORKSPACE_SQL, MAX_PHOTO_BYTES, REQUIRED_MAX_ALLOWED_PACKET } from '../storage.mjs';

// Driver-contract tests. These exercise the real adapter with a scripted mysql2
// pool; they intentionally do not claim real MySQL/MariaDB engine coverage.
const time = '2026-11-23T12:00:00.000Z';
const hash = 'a'.repeat(64);
const updateValues = ['{"literal":"O\'Neil; DROP TABLE workspace; --"}', 2, hash, time, 'main', 1, 'b'.repeat(64)];
const auditValues = ['audit-test', 2, time, 'owner', 'Owner', 'ticket.create', 'ticket-test', 'request-test', '{}', 'b'.repeat(64), hash, 'main', 2, hash];
const photoKey = 'profile-photos/owner/00000000-0000-4000-8000-000000000001.png';
const photo = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+kOnIAAAAASUVORK5CYII=', 'base64');
function fixture(handler = () => undefined, options = {}) {
  const events = [];
  let connectionId = 0;
  const execute = async (sql, values = [], scope = 'pool') => {
    events.push({type:'execute', sql, values, scope});
    // MySQL rejects diagnostic statements in the prepared-statement protocol.
    // Model that distinction so the duplicate-initialization path cannot pass
    // against a fixture while failing on an actual MySQL connection.
    if (sql === 'SHOW WARNINGS') throw Object.assign(new Error('Diagnostic statements cannot be prepared.'), {code:'ER_UNSUPPORTED_PS', errno:1295});
    const response = await handler(sql, values, scope);
    return [response ?? (/^SELECT|^SHOW/.test(sql) ? [] : {affectedRows:1, warningStatus:0}), []];
  };
  const pool = {
    pool:{config:{connectionConfig:{multipleStatements:false, rowsAsArray:false, namedPlaceholders:false, ...options}}},
    execute:(sql, values) => execute(sql, values),
    async getConnection() {
      const scope = 'connection-' + (++connectionId);
      events.push({type:'borrow', scope});
      return {
        execute:(sql, values) => execute(sql, values, scope),
        async query(sql) {
          events.push({type:sql === 'SHOW WARNINGS' ? 'diagnostic' : 'control', sql, scope});
          return [sql === 'SHOW WARNINGS' ? await handler(sql, [], scope) ?? [] : [], []];
        },
        async commit() { events.push({type:'commit', scope}); },
        async rollback() { events.push({type:'rollback', scope}); },
        release() { events.push({type:'release', scope}); },
        destroy() { events.push({type:'destroy', scope}); },
      };
    },
  };
  return {pool, events, ...createStorage(pool)};
}
function writeBatch(DB) { return [DB.prepare(WORKSPACE_SQL.update).bind(...updateValues), DB.prepare(WORKSPACE_SQL.auditInsert).bind(...auditValues)]; }
const code = expected => error => error.code === expected;

test('only exact workspace SQL is accepted; arbitrary identifiers, comments and extra statements never reach the driver', () => {
  const f = fixture();
  for (const sql of ['SELECT * FROM workspace', WORKSPACE_SQL.read + '; DROP TABLE workspace', WORKSPACE_SQL.read + ' -- comment', WORKSPACE_SQL.read.replace('workspace', 'auth_users'), 'x'.repeat(16001)]) assert.throws(() => f.DB.prepare(sql), code('unsupported_sql'));
  assert.equal(f.events.length, 0);
});

test('all actual workspace statements are covered by the fixed allowlist', async () => {
  const source = await readFile(new URL('../../lib/workspace-server.ts', import.meta.url), 'utf8');
  const bytes = source.match(/const AUDIT_BYTES_SQL='([^']+)'/)[1];
  const actual = [...source.matchAll(/\.prepare\((?:'([^']*)'|`([^`]*)`)\)/g)].map(match => (match[1] || match[2]).replace('${AUDIT_BYTES_SQL}', bytes));
  assert.equal(new Set(actual).size, 6);
  const f = fixture();
  for (const sql of actual) assert.doesNotThrow(() => f.DB.prepare(sql));
});

test('prepared parameters preserve SQL-looking text literally and reject unsupported or oversized values', async () => {
  const literal = "main' OR 1=1; DROP TABLE audit_events; --";
  const f = fixture(() => []);
  assert.equal(await f.DB.prepare(WORKSPACE_SQL.read).bind(literal).first(), null);
  assert.deepEqual(f.events[0].values, [literal]);
  assert.ok(!f.events[0].sql.includes(literal));
  for (const value of [undefined, {}, [], NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '\ud800', 'x'.repeat(2 * 1024 * 1024 + 1)]) assert.throws(() => f.DB.prepare(WORKSPACE_SQL.read).bind(value), code('invalid_parameters'));
  assert.throws(() => f.DB.prepare(WORKSPACE_SQL.read).bind('main', 'extra'), code('invalid_parameters'));
});

test('binary identifiers and safe numeric strings return the original D1-compatible row shape', async () => {
  const f = fixture(() => [{id:Buffer.from('main'), payload:'{}', revision:'17', last_hash:Buffer.from(hash), updated_at:Buffer.from(time)}]);
  const row = await f.DB.prepare(WORKSPACE_SQL.read).bind('main').first();
  assert.deepEqual(row, {id:'main', payload:'{}', revision:17, last_hash:hash, updated_at:time});
  assert.equal((await f.DB.prepare(WORKSPACE_SQL.read).bind('main').all()).meta.changes, 0);
  const corrupt = fixture(() => [{revision:'9007199254740993'}]);
  await assert.rejects(corrupt.DB.prepare(WORKSPACE_SQL.read).bind('main').first(), code('invalid_database_result'));
});

test('audit reads use one explicit consistent snapshot and translate complete UTF-8 byte accounting', async () => {
  const f = fixture(sql => sql.includes('COUNT(*) AS `total`') ? [{total:'0', bytes:'0'}] : []);
  const result = await f.DB.batch([f.DB.prepare(WORKSPACE_SQL.read).bind('main'), f.DB.prepare(WORKSPACE_SQL.auditTotals), f.DB.prepare(WORKSPACE_SQL.auditRows).bind(10000, 8388608, 10001)]);
  assert.equal(result.length, 3);
  const controls = f.events.filter(event => event.type === 'control');
  assert.deepEqual(controls.map(event => event.sql), ['SET TRANSACTION ISOLATION LEVEL REPEATABLE READ', 'START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY']);
  const reads = f.events.filter(event => event.type === 'execute');
  assert.equal(new Set(reads.map(event => event.scope)).size, 1);
  assert.ok(reads.every(event => event.scope !== 'pool'));
  assert.equal((reads[1].sql.match(/OCTET_LENGTH\(/g) || []).length, 11);
  assert.ok(!reads[1].sql.includes('AS BLOB'));
  assert.match(reads[2].sql, /ORDER BY `sequence` ASC LIMIT \?/);
  assert.deepEqual(reads[2].values, [10000, 8388608, 10001]);
  assert.equal(f.events.at(-2).type, 'commit');
  assert.equal(f.events.at(-1).type, 'release');
});

test('workspace CAS and audit insertion share one transaction and preserve exact affected-row counts', async () => {
  const f = fixture(() => ({affectedRows:1, changedRows:99, warningStatus:0}));
  const results = await f.DB.batch(writeBatch(f.DB));
  assert.deepEqual(results.map(result => result.meta.changes), [1, 1]);
  const writes = f.events.filter(event => event.type === 'execute');
  assert.equal(writes.length, 2);
  assert.equal(writes[0].scope, writes[1].scope);
  assert.deepEqual(writes[0].values, updateValues);
  assert.match(writes[0].sql, /WHERE `id`=\? AND `revision`=\? AND `last_hash`=\?/);
  assert.match(writes[1].sql, /`sequence`,`timestamp`/);
  assert.ok(writes[1].sql.includes('`changes`'));
});

test('a lost CAS returns two zero changes while a missing audit row rolls the transaction back', async () => {
  const lost = fixture(() => ({affectedRows:0, warningStatus:0}));
  assert.deepEqual((await lost.DB.batch(writeBatch(lost.DB))).map(result => result.meta.changes), [0, 0]);
  const mismatch = fixture(sql => ({affectedRows:sql.startsWith('UPDATE') ? 1 : 0, warningStatus:0}));
  await assert.rejects(mismatch.DB.batch(writeBatch(mismatch.DB)), code('audit_write_failed'));
  assert.ok(mismatch.events.some(event => event.type === 'rollback'));
  assert.ok(!mismatch.events.some(event => event.type === 'commit'));
});

test('database errors roll back both writes and do not expose driver SQL or credentials', async () => {
  const f = fixture(sql => { if (sql.startsWith('INSERT')) throw new Error('password=fixture-secret INSERT private SQL'); return {affectedRows:1}; });
  await assert.rejects(f.DB.batch(writeBatch(f.DB)), error => error.code === 'database_operation_failed' && !error.message.includes('fixture-secret') && error.cause === undefined);
  assert.ok(f.events.some(event => event.type === 'rollback'));
  assert.ok(!f.events.some(event => event.type === 'commit'));
  assert.equal(f.events.at(-1).type, 'release');
});

test('INSERT IGNORE reads diagnostics without preparing them, tolerates only duplicate-key no-insert warnings and rejects lossy writes', async () => {
  for (const warning of [1062, 1265]) {
    const f = fixture(sql => sql === 'SHOW WARNINGS' ? [{Code:warning, Message:'private diagnostic'}] : {affectedRows:0, warningStatus:sql.startsWith('INSERT IGNORE') ? 1 : 0});
    const batch = [f.DB.prepare(WORKSPACE_SQL.initialize).bind('main', '{}', 1, hash, time), f.DB.prepare(WORKSPACE_SQL.auditInsert).bind(...auditValues)];
    if (warning === 1062) assert.deepEqual((await f.DB.batch(batch)).map(result => result.meta.changes), [0, 0]);
    else { await assert.rejects(f.DB.batch(batch), code('database_write_warning')); assert.ok(f.events.some(event => event.type === 'rollback')); }
    const diagnostic = f.events.filter(event => event.type === 'diagnostic');
    assert.equal(diagnostic.length, 1);
    assert.equal(diagnostic[0].sql, 'SHOW WARNINGS');
    assert.equal(diagnostic[0].scope, f.events.find(event => event.sql?.startsWith('INSERT IGNORE')).scope);
    assert.ok(!f.events.some(event => event.type === 'execute' && event.sql === 'SHOW WARNINGS'));
  }
});

test('standalone writes, mixed batches and foreign prepared statements cannot skip the audit pairing', async () => {
  const f = fixture();
  await assert.rejects(f.DB.prepare(WORKSPACE_SQL.update).bind(...updateValues).run(), code('audited_batch_required'));
  await assert.rejects(f.DB.batch([f.DB.prepare(WORKSPACE_SQL.update).bind(...updateValues)]), code('audited_batch_required'));
  await assert.rejects(f.DB.batch([fixture().DB.prepare(WORKSPACE_SQL.read).bind('main')]), code('unsupported_batch'));
  assert.equal(f.events.length, 0);
});

test('portrait BLOB writes and reads retain bytes, force private metadata and bind object keys', async () => {
  let saved;
  const f = fixture((sql, values) => {
    if (sql.startsWith('INSERT INTO `profile_photos`')) { saved = values; return {affectedRows:1}; }
    if (sql.startsWith('SELECT `body`')) return [{body:saved[1], byte_length:saved[2], content_type:saved[3], http_metadata:'{"cacheControl":"public"}', custom_metadata:saved[5], updated_at:saved[6]}];
    return {affectedRows:1};
  });
  const original = Buffer.from(photo);
  const result = await f.BUCKET.put(photoKey, original, {httpMetadata:{contentType:'image/png', cacheControl:'public'}, customMetadata:{memberId:'owner', sha256:hash}});
  original.fill(0);
  assert.equal(result.size, photo.length);
  assert.deepEqual(saved[0], Buffer.from(photoKey));
  assert.deepEqual(saved[1], photo);
  const stored = await f.BUCKET.get(photoKey);
  assert.deepEqual(Buffer.from(stored.body), photo);
  assert.equal(stored.httpMetadata.cacheControl, 'private, no-store');
  assert.equal(stored.customMetadata.memberId, 'owner');
  const read = f.events.find(event => event.sql?.startsWith('SELECT `body`'));
  assert.deepEqual(read.values.slice(1), [MAX_PHOTO_BYTES, MAX_PHOTO_BYTES]);
  assert.ok(read.sql.includes('OCTET_LENGTH(`body`)<=?'));
  await f.BUCKET.delete(photoKey);
  assert.deepEqual(f.events.at(-1).values, [Buffer.from(photoKey)]);
});

test('portrait storage rejects oversized, remote, unsupported-type and path inputs before the driver', async () => {
  const f = fixture();
  await assert.rejects(f.BUCKET.put(photoKey, Buffer.alloc(MAX_PHOTO_BYTES + 1), {httpMetadata:{contentType:'image/png'}}), code('photo_size'));
  await assert.rejects(f.BUCKET.put(photoKey, 'https://example.invalid/photo.png', {httpMetadata:{contentType:'image/png'}}), code('invalid_photo'));
  await assert.rejects(f.BUCKET.put(photoKey, photo, {httpMetadata:{contentType:'image/svg+xml'}}), code('photo_type'));
  for (const key of ['../../secret', 'https://example.invalid/photo.png', 'profile-photos/owner/arbitrary.svg']) await assert.rejects(f.BUCKET.get(key), code('invalid_photo_key'));
  assert.equal(f.events.length, 0);
});

test('schema creation is explicit, idempotent DDL with InnoDB and binary identity comparisons', async () => {
  const f = fixture();
  assert.equal(f.events.length, 0);
  await initializeSchema(f.pool);
  assert.equal(f.events.length, 3);
  assert.ok(f.events.every(event => event.sql.startsWith('CREATE TABLE IF NOT EXISTS') && event.sql.includes('ENGINE=InnoDB')));
  assert.ok(f.events[0].sql.includes('`id` VARBINARY(400)'));
  assert.ok(f.events[2].sql.includes('`body` MEDIUMBLOB'));
});

test('storage preflight requires packet capacity and every transactional table without returning credentials', async () => {
  const tables = ['workspace', 'audit_events', 'profile_photos'].map(table_name => ({table_name, engine:'InnoDB'}));
  const f = fixture(sql => sql.includes('@@version') ? [{version:'fixture-MariaDB', max_allowed_packet:REQUIRED_MAX_ALLOWED_PACKET}] : tables);
  const report = await checkStorage(f.pool);
  assert.equal(report.maxAllowedPacket, REQUIRED_MAX_ALLOWED_PACKET);
  assert.equal(report.tables.length, 3);
  assert.ok(!JSON.stringify(report).includes('password'));
  const small = fixture(() => [{version:'fixture', max_allowed_packet:1024}]);
  await assert.rejects(checkStorage(small.pool), code('database_packet_limit'));
  const wrongEngine = fixture(sql => sql.includes('@@version') ? [{version:'fixture', max_allowed_packet:REQUIRED_MAX_ALLOWED_PACKET}] : [{table_name:'workspace', engine:'MyISAM'}]);
  await assert.rejects(checkStorage(wrongEngine.pool), code('database_schema_required'));
});

test('unsafe mysql2 pool modes are rejected before executing SQL', () => {
  for (const option of ['multipleStatements', 'rowsAsArray', 'namedPlaceholders']) assert.throws(() => fixture(undefined, {[option]:true}), code('unsafe_pool_configuration'));
});
