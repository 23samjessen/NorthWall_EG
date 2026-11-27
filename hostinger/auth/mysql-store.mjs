import { readFile } from 'node:fs/promises';

const ACCOUNT = 'id,email,user_id AS userId,name,password_hash AS passwordHash,must_change_password AS mustChangePassword,temporary_expires_at AS temporaryExpiresAt,enabled,password_version AS passwordVersion,created_at AS createdAt,updated_at AS updatedAt';
const FLOW = 'id,token_hash AS tokenHash,account_id AS accountId,email,purpose,stage,invitation_id AS invitationId,member_id AS memberId,account_version AS accountVersion,otp_mac AS otpMac,otp_generation AS otpGeneration,otp_attempts AS otpAttempts,expires_at AS expiresAt,resend_at AS resendAt,verified_at AS verifiedAt,delivered,created_at AS createdAt';
const SESSION = 'token_hash AS tokenHash,account_id AS accountId,password_version AS passwordVersion,created_at AS createdAt,last_seen_at AS lastSeenAt,absolute_expires_at AS absoluteExpiresAt';
const accountValues = a => [a.id,a.email,a.userId,a.name,a.passwordHash,a.mustChangePassword,a.temporaryExpiresAt??null,a.enabled,a.passwordVersion,a.createdAt,a.updatedAt];
const flowValues = f => [f.id,f.tokenHash,f.accountId,f.email,f.purpose,f.stage,f.invitationId,f.memberId,f.accountVersion,f.otpMac,f.otpGeneration,f.otpAttempts,f.expiresAt,f.resendAt,f.verifiedAt,f.delivered,f.createdAt];
const one = async (connection, sql, params) => (await connection.execute(sql, params))[0][0] || null;

export async function initializeAuthSchema(pool) {
  if (!pool?.execute) throw new Error('A MySQL promise pool is required.');
  const sql = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
  // This is a fixed, repository-owned DDL file, never request input.
  const statements=sql.replace(/^\s*--[^\n]*$/gm,'').split(';').map(s=>s.trim()).filter(Boolean);
  for (const statement of statements) await pool.execute(statement);
}

export function createMySqlAuthStore(pool) {
  if (!pool?.getConnection || !pool?.execute) throw new Error('A MySQL promise pool is required.');
  const methods = connection => ({
    connection,
    accountByEmail: email => one(connection, `SELECT ${ACCOUNT} FROM nw_auth_accounts WHERE email=? FOR UPDATE`, [email]),
    accountById: id => one(connection, `SELECT ${ACCOUNT} FROM nw_auth_accounts WHERE id=? FOR UPDATE`, [id]),
    async insertAccount(a) { await connection.execute('INSERT INTO nw_auth_accounts(id,email,user_id,name,password_hash,must_change_password,temporary_expires_at,enabled,password_version,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)', accountValues(a)); },
    async updateAccount(a) { await connection.execute('UPDATE nw_auth_accounts SET name=?,password_hash=?,must_change_password=?,temporary_expires_at=?,enabled=?,password_version=?,updated_at=? WHERE id=?', [a.name,a.passwordHash,a.mustChangePassword,a.temporaryExpiresAt??null,a.enabled,a.passwordVersion,a.updatedAt,a.id]); },
    resetByHash: hash => one(connection, 'SELECT token_hash AS tokenHash,account_id AS accountId,password_version AS passwordVersion,created_at AS createdAt,expires_at AS expiresAt FROM nw_auth_resets WHERE token_hash=? FOR UPDATE', [hash]),
    async insertReset(reset) { await connection.execute('INSERT INTO nw_auth_resets(token_hash,account_id,password_version,created_at,expires_at) VALUES(?,?,?,?,?)', [reset.tokenHash,reset.accountId,reset.passwordVersion,reset.createdAt,reset.expiresAt]); },
    async deleteReset(hash) { await connection.execute('DELETE FROM nw_auth_resets WHERE token_hash=?', [hash]); },
    async deleteResetsForAccount(id) { await connection.execute('DELETE FROM nw_auth_resets WHERE account_id=?', [id]); },
    flowByHash: hash => one(connection, `SELECT ${FLOW} FROM nw_auth_flows WHERE token_hash=? FOR UPDATE`, [hash]),
    async insertFlow(f) { await connection.execute('INSERT INTO nw_auth_flows(id,token_hash,account_id,email,purpose,stage,invitation_id,member_id,account_version,otp_mac,otp_generation,otp_attempts,expires_at,resend_at,verified_at,delivered,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', flowValues(f)); },
    async updateFlow(f) { await connection.execute('UPDATE nw_auth_flows SET token_hash=?,stage=?,otp_mac=?,otp_generation=?,otp_attempts=?,expires_at=?,resend_at=?,verified_at=?,delivered=? WHERE id=?', [f.tokenHash,f.stage,f.otpMac,f.otpGeneration,f.otpAttempts,f.expiresAt,f.resendAt,f.verifiedAt,f.delivered,f.id]); },
    async deleteFlow(hash) { await connection.execute('DELETE FROM nw_auth_flows WHERE token_hash=?', [hash]); },
    async deleteFlowsForEmail(email) { await connection.execute('DELETE FROM nw_auth_flows WHERE email=?', [email]); },
    async deleteFlowsForAccount(id) { await connection.execute('DELETE FROM nw_auth_flows WHERE account_id=?', [id]); },
    sessionByHash: hash => one(connection, `SELECT ${SESSION} FROM nw_auth_sessions WHERE token_hash=? FOR UPDATE`, [hash]),
    async insertSession(s) { await connection.execute('INSERT INTO nw_auth_sessions(token_hash,account_id,password_version,created_at,last_seen_at,absolute_expires_at) VALUES(?,?,?,?,?,?)', [s.tokenHash,s.accountId,s.passwordVersion,s.createdAt,s.lastSeenAt,s.absoluteExpiresAt]); },
    async touchSession(hash, time) { await connection.execute('UPDATE nw_auth_sessions SET last_seen_at=? WHERE token_hash=?', [time,hash]); },
    async deleteSession(hash) { await connection.execute('DELETE FROM nw_auth_sessions WHERE token_hash=?', [hash]); },
    async revokeSessions(id) { await connection.execute('DELETE FROM nw_auth_sessions WHERE account_id=?', [id]); },
    async rate(key, limit, windowMs, now) {
      await connection.execute('INSERT IGNORE INTO nw_auth_limits(bucket_key,started_at,attempts,expires_at) VALUES(?,?,0,?)', [key,now,now+windowMs]);
      const row = await one(connection, 'SELECT started_at AS startedAt,attempts,expires_at AS expiresAt FROM nw_auth_limits WHERE bucket_key=? FOR UPDATE', [key]);
      if (Number(row.expiresAt) <= now) { await connection.execute('UPDATE nw_auth_limits SET started_at=?,attempts=1,expires_at=? WHERE bucket_key=?', [now,now+windowMs,key]); return { allowed:true,retryAt:now+windowMs }; }
      if (Number(row.attempts) >= limit) return { allowed:false,retryAt:Number(row.expiresAt) };
      await connection.execute('UPDATE nw_auth_limits SET attempts=attempts+1 WHERE bucket_key=?', [key]);
      return { allowed:true,retryAt:Number(row.expiresAt) };
    },
    async event(e) { await connection.execute('INSERT INTO nw_auth_events(id,account_id,email_key,ip_key,event,outcome,detail,created_at) VALUES(?,?,?,?,?,?,?,?)', [e.id,e.accountId,e.emailKey,e.ipKey,e.event,e.outcome,e.detail,e.createdAt]); },
  });
  return {
    readAccountByEmail: email => one(pool, `SELECT ${ACCOUNT} FROM nw_auth_accounts WHERE email=?`, [email]),
    readAccountById: id => one(pool, `SELECT ${ACCOUNT} FROM nw_auth_accounts WHERE id=?`, [id]),
    readReset: hash => one(pool, 'SELECT token_hash AS tokenHash,account_id AS accountId,password_version AS passwordVersion,created_at AS createdAt,expires_at AS expiresAt FROM nw_auth_resets WHERE token_hash=?', [hash]),
    readFlow: hash => one(pool, `SELECT ${FLOW} FROM nw_auth_flows WHERE token_hash=?`, [hash]),
    readSession: hash => one(pool, `SELECT ${SESSION} FROM nw_auth_sessions WHERE token_hash=?`, [hash]),
    async transaction(callback) {
      const connection = await pool.getConnection();
      try { await connection.beginTransaction(); const value=await callback(methods(connection)); await connection.commit(); return value; }
      catch (error) { await connection.rollback(); throw error; }
      finally { connection.release(); }
    },
    async cleanup(now, eventRetentionMs) {
      // Bounded batches keep maintenance from monopolising the MySQL pool.
      await pool.execute('DELETE FROM nw_auth_resets WHERE expires_at<? LIMIT 1000', [now]);
      await pool.execute('DELETE FROM nw_auth_flows WHERE expires_at<? LIMIT 1000', [now]);
      await pool.execute('DELETE FROM nw_auth_sessions WHERE absolute_expires_at<? OR last_seen_at<? LIMIT 1000', [now,now-30*60*1000]);
      await pool.execute('DELETE FROM nw_auth_limits WHERE expires_at<? LIMIT 1000', [now]);
      await pool.execute('DELETE FROM nw_auth_events WHERE created_at<? LIMIT 1000', [now-eventRetentionMs]);
    },
  };
}
