import { readFile } from 'node:fs/promises';

// A deliberately small adapter for the fixed statements in workspace-server.ts.
// It is not a general SQLite-to-MySQL translator or a client-supplied SQL API.
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
export const REQUIRED_MAX_ALLOWED_PACKET = 4 * 1024 * 1024;
const MAX_BOUND_TEXT_BYTES = 2 * 1024 * 1024;
const TABLE_NAMES = Object.freeze(['workspace', 'audit_events', 'profile_photos']);
const AUDIT_COLUMNS = Object.freeze(['id', 'sequence', 'timestamp', 'actor_id', 'actor_name', 'action', 'object_id', 'request_id', 'changes', 'previous_hash', 'hash']);
const TEXT_COLUMNS = new Set([...AUDIT_COLUMNS.filter(name => name !== 'sequence'), 'payload', 'last_hash', 'updated_at']);
const quote = name => '`' + name + '`'; // Used only with the fixed names above.
const SQLITE_AUDIT_BYTES = 'COALESCE(SUM(' + AUDIT_COLUMNS.map(name => 'length(CAST(' + name + ' AS BLOB))').join('+') + '),0)';
const MYSQL_AUDIT_BYTES = 'COALESCE(SUM(' + AUDIT_COLUMNS.map(name => 'OCTET_LENGTH(' + quote(name) + ')').join('+') + '),0)';

export const WORKSPACE_SQL = Object.freeze({
  read: 'SELECT id,payload,revision,last_hash,updated_at FROM workspace WHERE id = ?',
  update: 'UPDATE workspace SET payload=?,revision=?,last_hash=?,updated_at=? WHERE id=? AND revision=? AND last_hash=?',
  initialize: 'INSERT OR IGNORE INTO workspace(id,payload,revision,last_hash,updated_at) VALUES(?,?,?,?,?)',
  auditInsert: 'INSERT INTO audit_events(id,sequence,timestamp,actor_id,actor_name,action,object_id,request_id,changes,previous_hash,hash) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM workspace WHERE id=? AND revision=? AND last_hash=?)',
  auditTotals: 'SELECT COUNT(*) AS total,' + SQLITE_AUDIT_BYTES + ' AS bytes FROM audit_events',
  auditRows: 'SELECT id,sequence,timestamp,actor_id,actor_name,action,object_id,request_id,changes,previous_hash,hash FROM audit_events WHERE (SELECT COUNT(*) <= ? AND ' + SQLITE_AUDIT_BYTES + ' <= ? FROM audit_events) ORDER BY sequence ASC LIMIT ?',
});
const MYSQL_SQL = Object.freeze({
  read: 'SELECT `id`,`payload`,`revision`,`last_hash`,`updated_at` FROM `workspace` WHERE `id` = ?',
  update: 'UPDATE `workspace` SET `payload`=?,`revision`=?,`last_hash`=?,`updated_at`=? WHERE `id`=? AND `revision`=? AND `last_hash`=?',
  initialize: 'INSERT IGNORE INTO `workspace`(`id`,`payload`,`revision`,`last_hash`,`updated_at`) VALUES(?,?,?,?,?)',
  auditInsert: 'INSERT INTO `audit_events`(' + AUDIT_COLUMNS.map(quote).join(',') + ') SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM `workspace` WHERE `id`=? AND `revision`=? AND `last_hash`=?)',
  auditTotals: 'SELECT COUNT(*) AS `total`,' + MYSQL_AUDIT_BYTES + ' AS `bytes` FROM `audit_events`',
  auditRows: 'SELECT ' + AUDIT_COLUMNS.map(quote).join(',') + ' FROM `audit_events` WHERE (SELECT COUNT(*) <= ? AND ' + MYSQL_AUDIT_BYTES + ' <= ? FROM `audit_events`) ORDER BY `sequence` ASC LIMIT ?',
});
const normalize = sql => sql.trim().replace(/\s+/g, ' ');
const SQL_ENTRIES = new Map(Object.entries(WORKSPACE_SQL).map(([kind, sql]) => [normalize(sql), Object.freeze({kind, sql:MYSQL_SQL[kind], parameters:(sql.match(/\?/g) || []).length, read:['read', 'auditTotals', 'auditRows'].includes(kind)})]));
const PHOTO_INSERT = 'INSERT INTO `profile_photos` (`object_key`,`body`,`byte_length`,`content_type`,`http_metadata`,`custom_metadata`,`updated_at`) VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE `body`=VALUES(`body`),`byte_length`=VALUES(`byte_length`),`content_type`=VALUES(`content_type`),`http_metadata`=VALUES(`http_metadata`),`custom_metadata`=VALUES(`custom_metadata`),`updated_at`=VALUES(`updated_at`)';
const PHOTO_READ = 'SELECT `body`,`byte_length`,`content_type`,`http_metadata`,`custom_metadata`,`updated_at` FROM `profile_photos` WHERE `object_key`=? AND `byte_length`<=? AND OCTET_LENGTH(`body`)<=? LIMIT 1';
const PHOTO_DELETE = 'DELETE FROM `profile_photos` WHERE `object_key`=?';
const STORAGE_INFO = 'SELECT @@version AS `version`,@@max_allowed_packet AS `max_allowed_packet`';
const TABLE_INFO = 'SELECT TABLE_NAME AS `table_name`,ENGINE AS `engine` FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (?,?,?)';

export class StorageError extends Error {
  constructor(code, message) { super(message); this.name = 'StorageError'; this.code = code; }
}
const fail = (code, message) => { throw new StorageError(code, message); };
function safeDatabaseError(error) {
  if (error instanceof StorageError) return error;
  // Driver errors can include query parameters. Do not attach them as a cause,
  // print them, or return their original messages through the application.
  return new StorageError('database_operation_failed', 'The database operation could not be completed.');
}
function validatePool(pool) {
  if (!pool || typeof pool.getConnection !== 'function' || typeof pool.execute !== 'function') fail('invalid_pool', 'A mysql2 promise pool is required.');
  const config = pool.pool?.config?.connectionConfig || pool.config?.connectionConfig;
  if (config?.multipleStatements || config?.rowsAsArray || config?.namedPlaceholders) fail('unsafe_pool_configuration', 'Use individual statements, object rows and positional prepared parameters.');
}
function safeNumber(value, field) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) fail('invalid_database_result', 'A stored ' + field + ' is outside the supported integer range.');
  return number;
}
function normalizeRows(rows) {
  if (!Array.isArray(rows)) fail('invalid_database_result', 'The database did not return rows.');
  return rows.map(row => {
    if (!row || Array.isArray(row) || typeof row !== 'object') fail('invalid_database_result', 'The database returned an unsupported row.');
    const result = {...row};
    for (const key of ['revision', 'sequence', 'total', 'bytes']) if (Object.hasOwn(result, key)) result[key] = safeNumber(result[key], key);
    for (const key of TEXT_COLUMNS) if (Buffer.isBuffer(result[key])) {
      const text = result[key].toString('utf8');
      if (!Buffer.from(text, 'utf8').equals(result[key])) fail('invalid_database_result', 'A stored text field is not valid UTF-8.');
      result[key] = text;
    }
    return result;
  });
}
function validateParameters(entry, values) {
  if (values.length !== entry.parameters) fail('invalid_parameters', 'The prepared statement requires its exact positional parameters.');
  for (const value of values) {
    if (value === null) continue;
    if (typeof value === 'number' && Number.isSafeInteger(value)) continue;
    if (typeof value === 'string' && value.isWellFormed() && Buffer.byteLength(value, 'utf8') <= MAX_BOUND_TEXT_BYTES) continue;
    fail('invalid_parameters', 'Prepared values must be bounded text, safe integers or null.');
  }
}
async function checkWarnings(connection, header, kind) {
  if (!header?.warningStatus) return;
  const [warnings] = await connection.execute('SHOW WARNINGS');
  // INSERT IGNORE also suppresses truncation and invalid values. Only its
  // duplicate-key/no-insert case is an expected workspace revision conflict.
  if (kind === 'initialize' && Number(header.affectedRows) === 0 && Array.isArray(warnings) && warnings.length && warnings.every(warning => Number(warning.Code ?? warning.code) === 1062)) return;
  fail('database_write_warning', 'The database could not preserve the complete write without warnings.');
}
async function executeEntry(connection, statement) {
  const {entry, values} = statement;
  const [result] = await connection.execute(entry.sql, values);
  if (entry.read) return {success:true, results:normalizeRows(result), meta:{changes:0}};
  await checkWarnings(connection, result, entry.kind);
  const changes = safeNumber(result?.affectedRows, 'affected row count');
  if (changes > 1) fail('invalid_database_result', 'A workspace write affected more than one row.');
  return {success:true, results:[], meta:{changes}};
}
async function transaction(pool, readOnly, work) {
  let connection;
  try { connection = await pool.getConnection(); } catch (error) { throw safeDatabaseError(error); }
  let discard = false;
  try {
    // Control statements are fixed strings; all data statements use execute().
    // MySQL/MariaDB consistent snapshots require explicit REPEATABLE READ.
    await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await connection.query(readOnly ? 'START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY' : 'START TRANSACTION READ WRITE');
    const value = await work(connection);
    await connection.commit();
    return value;
  } catch (error) {
    try { await connection.rollback(); } catch { discard = true; }
    throw safeDatabaseError(error);
  } finally {
    if (discard && typeof connection.destroy === 'function') connection.destroy();
    else connection.release();
  }
}

export function createStorage(pool) {
  validatePool(pool);
  const statements = new WeakMap();
  const prepare = (sql, initialValues = []) => {
    if (typeof sql !== 'string' || sql.length > 16000) fail('unsupported_sql', 'Only known workspace statements are supported.');
    const entry = SQL_ENTRIES.get(normalize(sql));
    if (!entry) fail('unsupported_sql', 'Only known workspace statements are supported.');
    const values = Object.freeze([...initialValues]);
    const details = {entry, values};
    const run = async () => {
      validateParameters(entry, values);
      if (!entry.read) fail('audited_batch_required', 'Workspace writes require their matching audit entry in one batch.');
      try { return await executeEntry(pool, details); } catch (error) { throw safeDatabaseError(error); }
    };
    const statement = Object.freeze({
      bind(...bound) { validateParameters(entry, bound); return prepare(sql, bound); },
      async first() { const result = await run(); return result.results[0] ?? null; },
      all:run,
      run,
    });
    statements.set(statement, details);
    return statement;
  };
  const DB = Object.freeze({
    prepare,
    async batch(batch) {
      if (!Array.isArray(batch) || !batch.length || batch.length > 3) fail('unsupported_batch', 'Use the bounded workspace transaction shape.');
      const prepared = batch.map(statement => {
        const details = statements.get(statement);
        if (!details) fail('unsupported_batch', 'Only statements prepared by this storage instance may be batched.');
        validateParameters(details.entry, details.values);
        return details;
      });
      const readOnly = prepared.every(statement => statement.entry.read);
      if (!readOnly && !(prepared.length === 2 && ['update', 'initialize'].includes(prepared[0].entry.kind) && prepared[1].entry.kind === 'auditInsert')) fail('audited_batch_required', 'A workspace write and its audit entry must commit together.');
      return transaction(pool, readOnly, async connection => {
        const results = [];
        for (const statement of prepared) results.push(await executeEntry(connection, statement));
        if (!readOnly && results[0].meta.changes !== results[1].meta.changes) fail('audit_write_failed', 'The workspace and its audit event could not be committed together.');
        return results;
      });
    },
  });
  const BUCKET = Object.freeze({
    async put(key, value, options = {}) {
      validatePhotoKey(key);
      if (!(value instanceof ArrayBuffer) && !ArrayBuffer.isView(value)) fail('invalid_photo', 'Portrait storage accepts bounded binary data only.');
      if (!value.byteLength || value.byteLength > MAX_PHOTO_BYTES) fail('photo_size', 'Portrait storage accepts files up to 2 MiB.');
      const bytes = value instanceof ArrayBuffer ? Buffer.from(new Uint8Array(value)) : Buffer.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
      const contentType = options.httpMetadata?.contentType;
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(contentType)) fail('photo_type', 'Only PNG, JPEG and WebP portraits are supported.');
      const httpMetadata = {contentType, cacheControl:'private, no-store'};
      const customMetadata = metadataObject(options.customMetadata || {});
      const values = [Buffer.from(key, 'ascii'), bytes, bytes.byteLength, contentType, JSON.stringify(httpMetadata), JSON.stringify(customMetadata), new Date().toISOString()];
      await transaction(pool, false, async connection => {
        const [result] = await connection.execute(PHOTO_INSERT, values);
        await checkWarnings(connection, result, 'photo');
      });
      return {key, size:bytes.byteLength};
    },
    async get(key) {
      validatePhotoKey(key);
      try {
        const [rows] = await pool.execute(PHOTO_READ, [Buffer.from(key, 'ascii'), MAX_PHOTO_BYTES, MAX_PHOTO_BYTES]);
        if (!rows.length) return null;
        const row = rows[0];
        if (!Buffer.isBuffer(row.body) || row.body.byteLength !== safeNumber(row.byte_length, 'portrait byte length') || row.body.byteLength > MAX_PHOTO_BYTES) fail('invalid_photo', 'Stored portrait integrity could not be verified.');
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(row.content_type)) fail('invalid_photo', 'Stored portrait content type is unsupported.');
        const httpMetadata = {contentType:row.content_type, cacheControl:'private, no-store'};
        const customMetadata = metadataObject(JSON.parse(row.custom_metadata));
        return {key, body:new Uint8Array(row.body), size:row.body.byteLength, uploaded:new Date(row.updated_at), httpMetadata, customMetadata};
      } catch (error) { throw safeDatabaseError(error); }
    },
    async delete(key) {
      validatePhotoKey(key);
      try { await pool.execute(PHOTO_DELETE, [Buffer.from(key, 'ascii')]); } catch (error) { throw safeDatabaseError(error); }
    },
  });
  return Object.freeze({DB, BUCKET});
}

function validatePhotoKey(key) {
  if (typeof key !== 'string' || Buffer.byteLength(key, 'utf8') > 512 || !/^profile-photos\/(?:[A-Za-z0-9_.!~*'()-]|%[0-9A-Fa-f]{2}){1,300}\/[0-9a-fA-F-]{36}\.(?:png|jpg|webp)$/.test(key)) fail('invalid_photo_key', 'Use an internal portrait object key.');
}
function metadataObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > 16) fail('invalid_photo_metadata', 'Portrait metadata must be a bounded object.');
  const metadata = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(key) || typeof entry !== 'string' || entry.length > 300) fail('invalid_photo_metadata', 'Portrait metadata must contain bounded text fields.');
    Object.defineProperty(metadata, key, {value:entry, enumerable:true, configurable:true, writable:true});
  }
  return metadata;
}

export async function initializeSchema(pool) {
  validatePool(pool);
  const source = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
  const statements = source.split('-- statement-breakpoint').map(part => part.replace(/^--.*$/gm, '').trim().replace(/;$/, ''));
  if (statements.length !== TABLE_NAMES.length || statements.some((sql, index) => !sql.startsWith('CREATE TABLE IF NOT EXISTS `' + TABLE_NAMES[index] + '` (') || sql.includes(';'))) fail('invalid_schema', 'The checked-in storage schema is not in its expected form.');
  try { for (const sql of statements) await pool.execute(sql); } catch (error) { throw safeDatabaseError(error); }
  return {tables:[...TABLE_NAMES]};
}

export async function checkStorage(pool) {
  validatePool(pool);
  try {
    const [[info]] = await pool.execute(STORAGE_INFO);
    const maxAllowedPacket = safeNumber(info?.max_allowed_packet, 'maximum packet size');
    if (maxAllowedPacket < REQUIRED_MAX_ALLOWED_PACKET) fail('database_packet_limit', 'The database must allow packets of at least 4 MiB for 2 MiB private portraits. Confirm the hosting database limit before launch.');
    const [tables] = await pool.execute(TABLE_INFO, TABLE_NAMES);
    for (const name of TABLE_NAMES) {
      const table = tables.find(value => value.table_name === name);
      if (!table || String(table.engine).toLowerCase() !== 'innodb') fail('database_schema_required', 'Initialize and verify every workspace storage table as InnoDB before starting the application.');
    }
    return {version:String(info.version), maxAllowedPacket, requiredMaxAllowedPacket:REQUIRED_MAX_ALLOWED_PACKET, tables:TABLE_NAMES.map(name => ({name, engine:'InnoDB'}))};
  } catch (error) { throw safeDatabaseError(error); }
}
