> **Latest release, 27 November 2026:** Existing database and user accounts are preserved. Add the password reset table with `node --env-file="$ENVFILE" hostinger/setup.mjs --schema-only` after uploading the new ZIP. Read `docs/PASSWORD_RECOVERY_AND_GOOGLE_REVIEWS.md`. Google Reviews is hidden until an official review link is configured.

# NorthWallEg — standard Next.js upload for Hostinger

This package is for Hostinger's **Next.js** preset. It contains the complete website and employee workspace. Its build produces **`.next` at the project root**, including the standard standalone server. Sign-in and the protected workspace run inside native Next.js routes.

## Upload this ZIP

1. In Hostinger, open **Websites → northwallegy.com → Deployments → Redeploy**.
2. Under **Source files**, choose **Upload new files** and select this replacement ZIP.
3. Keep **Next.js** as the framework. Review the settings below.
4. Keep existing private environment settings. Add the documented settings below if missing.
5. Select **Save and Redeploy** and read the new build result.

| Field | Value for this ZIP |
| --- | --- |
| Framework | **Next.js** |
| Root directory | `./` |
| Node.js | **24.x recommended**; the project also supports 22.13.0 or later |
| Package manager | `npm` |
| Build command | `npm run build` |
| Output directory | **`.next`** |
| Entry file | **Leave the Next.js preset default / empty** |
| Start command, if shown | `npm start` |

The archive is flat: `package.json`, `app/`, and `next.config.mjs` are at its root. Upload it through the Node.js deployment flow. The legacy `Other` / `.hostinger-app` / `hostinger/server.mjs` settings do not apply to this replacement profile.

## What changed

- Standard `next build --webpack` now runs at the upload root and creates `.next/standalone/server.js`.
- The email/password and email-code API is implemented through native Next.js route handlers, using the existing authentication service.
- Every workspace and profile-photo request independently verifies its session before invoking the existing business logic. Visitor-supplied identity headers cannot create a session.
- Marketing pages and news remain private before launch. Password replacement, invitation acceptance, and owner approval remain required where applicable.
- The generated standalone output includes public images, CSS/JavaScript assets, and the private setup/check commands.
- Production `.env` files are excluded from the source ZIP and removed from generated standalone output.

## Build success and first sign-in are separate steps

The project can compile without a database or sending mailbox. The sign-in page can render, but protected APIs return a safe unavailable response until private configuration and database setup are complete. The ZIP contains no production users, database records, uploaded employee portraits, passwords, or email credentials.

Use **Hostinger → Environment variables**. Preserve any existing values. Never paste secrets into chat, commit them to Git, or place them in the uploaded ZIP.

| Variable | Value or source |
| --- | --- |
| `APP_ORIGIN` | `https://northwallegy.com` |
| `PUBLIC_LAUNCH` | `false` until the company is ready to publish |
| `OWNER_EMAIL` | `23samjessen@gmail.com` |
| `NODE_ENV` | `production` |
| `AUTH_SECRET` | Existing valid private value; if absent, generate 32 random bytes encoded as 64 hex characters |
| `EDGE_HTTPS_CONFIRMED` | `true` only after the domain certificate and Force HTTPS have been verified |
| `DB_HOST`, `DB_PORT` | Actual database endpoint; same-host defaults are `127.0.0.1`, `3306` |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Actual full database name, user and private password |
| `SMTP_HOST`, `SMTP_PORT` | Actual authenticated sending provider; port 465 or 587 with verified TLS |
| `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Actual sending mailbox account and sender address |

`OWNER_EMAIL` identifies the administrator; it does not supply an SMTP account. `ADMIN_EMAILS` alone does not create a Hostinger account. Email verification is implemented; SMS verification is not configured by this package.

`APP_ORIGIN` and `PUBLIC_LAUNCH` must have the same values when building and running. Changing either requires rebuilding. No anonymous public launch is enabled by default.

## Initialize the database and administrator privately

In the private application terminal or an SSH session, use the same server environment settings and change to the deployed Node.js directory. Then run:

```bash
node hostinger/setup.mjs
node hostinger/check.mjs --smtp
```

In a full source checkout, the equivalent commands are `npm run hostinger:setup` and `npm run hostinger:check -- --smtp`.

Setup preserves existing records and initializes missing tables. It asks for the owner's temporary password through a hidden terminal prompt. It does not put a password into source code. A first sign-in requires an email code and replacement of that temporary password. The SMTP check verifies connection and credentials without sending mail; the real sign-in verifies delivery.

Hostinger dashboard variables may not automatically be loaded into SSH. The detailed guide at `docs/HOSTINGER_AND_DOMAIN.md` explains a private environment file outside the website tree. Keep that file out of ZIPs and Git. Do not reset an existing database to resolve a connection error.

## Open the application

- Website: `https://northwallegy.com/`
- Sign-in: `https://northwallegy.com/sign-in`
- Employee workspace: `https://northwallegy.com/workspace`

With `PUBLIC_LAUNCH=false`, company pages redirect to sign-in. The workspace continues to require an approved account after email verification.

## Run or maintain this exported project

```bash
npm ci
npm run build
npm start
```

For local HTTPS testing, use a suitable TLS reverse proxy and the configured canonical origin. The application's `Secure` cookies are not weakened for plain HTTP development.

- Contacts, staff titles, phone numbers, tax-registration placeholder, images and colours: `MAINTENANCE_MANUAL.md` and `lib/company-profile.json`.
- Employee invitations, approval and roles: `docs/USER_ACCESS.md`.
- Authentication, email codes and owner recovery: `docs/AUTHENTICATION_AND_MFA.md`.
- Database, HTTPS, private environment, backups and migration: `docs/HOSTINGER_AND_DOMAIN.md`. Use this file's Next.js settings for this ZIP.
- The source ZIP does not migrate the private preview's live database or uploaded portraits. Use the documented data-migration procedure if there are existing records to preserve.

In the Git source, recreate this profile with:

```bash
npm run hostinger:package -- --output /absolute/path/NorthWallEg-Hostinger-Nextjs.zip
```

The exporter records the exact source commit in `hostinger-upload.json`. It excludes dependencies, generated build folders, runtime records and private environment files.

## Diagnosing the next result

- Build log should report **Output directory: `.next`** and end with **Next.js output verified: .next/standalone/server.js**.
- If the build passes but sign-in is unavailable, inspect **Runtime logs** and run the private preflight above. Missing database/email/HTTPS configuration is a different issue from build-output discovery.
- `PUBLIC_LAUNCH=false` intentionally keeps company pages private. Successful deployment is not authorization to publish the company publicly.

