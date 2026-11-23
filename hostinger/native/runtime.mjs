import { AsyncLocalStorage } from 'node:async_hooks';
import mysql from 'mysql2/promise';
import { readConfig } from '../config.mjs';
import { createStorage, checkStorage } from '../storage.mjs';
import { createAuthService } from '../auth/index.mjs';
import { createMail } from '../mail.mjs';
import { getPublicConfig } from './public-config.mjs';

/**
 * Process-local service registry. This is never populated from request headers,
 * cookies, environment-encoded identities or a public setup endpoint.
 * An isolated test process may install an explicit fixture before Next starts.
 */
export const NATIVE_RUNTIME_SYMBOL = Symbol.for('northwalleg.hostinger.native-runtime');
const INITIALIZING = Symbol.for('northwalleg.hostinger.native-runtime-initializing');
const WORKSPACE_RUNTIME = Symbol.for('northwalleg.hostinger.runtime');

function exposeWorkspaceRuntime(runtime) {
  globalThis[WORKSPACE_RUNTIME] = {
    ...runtime.storage,
    ADMIN_EMAILS: runtime.config.ownerEmail,
    identityContext: runtime.identityContext,
  };
  return runtime;
}

function verifyRuntime(runtime, publicConfig) {
  if (!runtime || runtime.config?.origin !== publicConfig.origin
    || runtime.config?.publicLaunch !== publicConfig.publicLaunch
    || typeof runtime.auth?.getIdentity !== 'function'
    || typeof runtime.auth?.handle !== 'function'
    || typeof runtime.identityContext?.run !== 'function'
    || !runtime.storage) {
    throw new Error('The private application runtime is unavailable.');
  }
  return exposeWorkspaceRuntime(runtime);
}

async function initialize(publicConfig) {
  // These two values have already been checked against the compiled public
  // configuration. Their safe defaults contain no credential or identity.
  const config = readConfig({
    ...process.env,
    APP_ORIGIN: publicConfig.origin,
    PUBLIC_LAUNCH: String(publicConfig.publicLaunch),
  });
  if (config.origin !== publicConfig.origin || config.publicLaunch !== publicConfig.publicLaunch) {
    throw new Error('Rebuild the application after changing its public configuration.');
  }

  const pool = mysql.createPool(config.database);
  let mail;
  try {
    await checkStorage(pool);
    const storage = createStorage(pool);
    const identityContext = new AsyncLocalStorage();
    mail = createMail(config);

    // Preserve the existing invitation lock and identity-continuity rules.
    const getInvitation = async (email, context = {}) => {
      const record = context.connection
        ? (await context.connection.execute(
          'SELECT `id`,`payload`,`revision`,`last_hash`,`updated_at` FROM `workspace` WHERE `id` = ?'
            + (context.lock ? ' FOR UPDATE' : ''), ['main'],
        ))[0][0]
        : await storage.DB.prepare('SELECT id,payload,revision,last_hash,updated_at FROM workspace WHERE id = ?').bind('main').first();
      if (!record) return null;
      const state = JSON.parse(record.payload);
      const candidates = state.users.filter(member => member.id !== 'owner' && !member.sample
        && member.email?.toLowerCase() === email && member.onboarding?.status === 'invited'
        && member.onboarding.invitedBy === 'owner' && !member.active && !member.userId);
      if (candidates.length !== 1) return null;
      const member = candidates[0];
      const anchor = member.onboarding.identityAnchorUserId;
      if (anchor !== null && (typeof anchor !== 'string' || !anchor)) return null;
      return {
        memberId: member.id,
        invitationId: member.onboarding.invitationId,
        expiresAt: member.onboarding.expiresAt,
        status: 'invited',
        identityAnchorUserId: anchor,
      };
    };

    const auth = createAuthService({
      pool, origin: config.origin, secret: config.secret, ownerEmail: config.ownerEmail,
      sendCode: mail.sendCode, getInvitation,
    });
    // Missing authentication tables fail closed. Startup never creates an owner
    // or changes existing account/database records through implicit bootstrap.
    await auth.cleanup();

    let closing = false;
    const runtime = {
      config, auth, identityContext, storage,
      async close() {
        if (closing) return;
        closing = true;
        mail.close();
        await auth.close();
        await pool.end();
        if (globalThis[NATIVE_RUNTIME_SYMBOL] === runtime) {
          delete globalThis[NATIVE_RUNTIME_SYMBOL];
          delete globalThis[WORKSPACE_RUNTIME];
        }
      },
    };
    return runtime;
  } catch (error) {
    mail?.close();
    await pool.end().catch(() => {});
    throw error;
  }
}

/** Build/import is credential-free; private services start on their first use. */
export async function getNativeRuntime() {
  const publicConfig = getPublicConfig();
  if (globalThis[NATIVE_RUNTIME_SYMBOL]) return verifyRuntime(globalThis[NATIVE_RUNTIME_SYMBOL], publicConfig);
  if (!globalThis[INITIALIZING]) {
    globalThis[INITIALIZING] = initialize(publicConfig).then(runtime => {
      globalThis[NATIVE_RUNTIME_SYMBOL] = runtime;
      return runtime;
    });
  }
  const pending = globalThis[INITIALIZING];
  try {
    return verifyRuntime(await pending, publicConfig);
  } finally {
    if (globalThis[INITIALIZING] === pending) delete globalThis[INITIALIZING];
  }
}
