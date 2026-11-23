import { isIP } from 'node:net';

const required = (env, name) => {
  const value = env[name];
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing required server setting: ${name}`);
  return value.trim();
};

/** Read server-only configuration. Never serialize this object to a response or log. */
export function readConfig(env = process.env) {
  const origin = new URL(required(env, 'APP_ORIGIN'));
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.port || origin.pathname !== '/' || origin.search || origin.hash) {
    throw new Error('APP_ORIGIN must be one canonical HTTPS origin without a path or port.');
  }
  if (env.EDGE_HTTPS_CONFIRMED !== 'true') throw new Error('Enable and verify Hostinger Force HTTPS, then set EDGE_HTTPS_CONFIRMED=true.');
  const secret = required(env, 'AUTH_SECRET');
  if (!/^[a-f0-9]{64,128}$/i.test(secret)) throw new Error('AUTH_SECRET must contain 32–64 cryptographically random bytes encoded as hex.');
  const ownerEmail = (env.OWNER_EMAIL || '23samjessen@gmail.com').trim().toLowerCase();
  if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(ownerEmail)) throw new Error('OWNER_EMAIL must be an email address.');
  const smtpPort = Number(env.SMTP_PORT || 465);
  if (![465, 587].includes(smtpPort)) throw new Error('SMTP_PORT must be 465 (TLS) or 587 (required STARTTLS).');
  const smtpHost = required(env, 'SMTP_HOST');
  if (isIP(smtpHost) || !/^[a-z0-9.-]+$/i.test(smtpHost)) throw new Error('SMTP_HOST must be the mail provider hostname used by its TLS certificate.');
  const smtpUser = required(env, 'SMTP_USER');
  const smtpFrom = (env.SMTP_FROM || smtpUser).trim();
  if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(smtpFrom)) throw new Error('SMTP_FROM must be a single mailbox address.');
  const dbHost = env.DB_HOST || '127.0.0.1';
  const dbPort = Number(env.DB_PORT || 3306);
  if (!Number.isInteger(dbPort) || dbPort < 1 || dbPort > 65535) throw new Error('DB_PORT is invalid.');
  const localDb = ['127.0.0.1', 'localhost', '::1'].includes(dbHost);
  if (!localDb && !env.DB_SSL_CA_BASE64) throw new Error('A remote database requires DB_SSL_CA_BASE64 and verified TLS.');
  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT is invalid.');
  const allowedHosts = new Set([origin.host]);
  for (const host of (env.ADDITIONAL_HOSTS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean)) {
    if (!/^[a-z0-9.-]+$/.test(host)) throw new Error('ADDITIONAL_HOSTS must contain exact hostnames, without ports or paths.');
    allowedHosts.add(host);
  }
  return {
    origin: origin.origin, ownerEmail, secret, port, allowedHosts,
    publicLaunch: env.PUBLIC_LAUNCH === 'true',
    database: {
      host: dbHost, port: dbPort, user: required(env, 'DB_USER'), password: required(env, 'DB_PASSWORD'),
      database: required(env, 'DB_NAME'), charset: 'utf8mb4', timezone: 'Z',
      waitForConnections: true, connectionLimit: 5, queueLimit: 30,
      multipleStatements: false, rowsAsArray: false, enableKeepAlive: true,
      connectTimeout: 10000, supportBigNumbers: true, bigNumberStrings: false,
      ...(localDb ? {} : { ssl: { ca: Buffer.from(env.DB_SSL_CA_BASE64, 'base64').toString('utf8'), rejectUnauthorized: true } }),
    },
    smtp: { host: smtpHost, port: smtpPort, secure: smtpPort === 465, requireTLS: true,
      auth: { user: smtpUser, pass: required(env, 'SMTP_PASSWORD') },
      tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true, servername: smtpHost },
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
      disableFileAccess: true, disableUrlAccess: true, logger: false, debug: false },
    smtpFrom,
  };
}
