# NorthWallEg on Hostinger

Updated 23 November 2026. Domain: **northwallegy.com**. Repository: **23samjessen/NorthWall_EG**.

## Delivery status

The project includes a standard Next.js Node server, MySQL workspace and private-photo storage, email/password sign-in with an email verification code, mandatory temporary-password replacement, and owner-controlled invitations and approval. The existing private review Site retains its original hosting and gateway login.

The Node production build and local checks pass. **The application has not been deployed or configured in your Hostinger account.** No actual database/mailbox credentials have been supplied, no real email code has been delivered, and no owner password has been provisioned there. Real MySQL CI/staging evidence is recorded separately in VERIFICATION.md.

Your screenshot showing **Coming soon** is Hostinger's placeholder. Your File Manager screenshot shows public_html; putting the source ZIP there will not start the Node server. Use **Deploy Your Web App**, then **Connect with GitHub** or **Upload your files**. Hostinger supports both workflows. [1]

## 1. Application and build settings

Connect the existing repository directly and grant access only to 23samjessen/NorthWall_EG if GitHub offers repository selection. The supplied source ZIP is an alternative, with package.json at its root. Do not upload node_modules, private environment files or generated builds.

| Hostinger setting | Value |
| --- | --- |
| Website type | Node.js web application |
| Framework preset | **Other**, so the custom authenticated entry is used |
| Node version | **24**; local checks used 24.22.3 |
| Package manager | npm |
| Root directory | `.` — directory containing package.json |
| Branch | `main` |
| Install command, if requested | `npm ci` |
| Build command | `npm run build:hostinger` |
| Output directory, if requested | `.hostinger-app` |
| Entry file | `hostinger/server.mjs`, relative to project root |
| Start command, if requested | `npm run start:hostinger` |
| Internal port | `3000` |

The build creates .hostinger-app/.next, copies public assets and prepares Node-specific bindings. Keep the generated application directory alongside the root hostinger entry and installed dependencies. Do not select static export or bypass the custom entry with next start: protected identity comes from its verified request context.

The build explicitly runs **next build --webpack**. Hostinger requires webpack for Next.js 16.3.3 and newer on its current build servers; this project uses 16.4.5. [2] Next receives the public HTTPS origin/port 443 while the separate HTTP listener uses internal port 3000. An actual built-Next test verifies this distinction.

The exact plan and resources still need confirmation. A domain alone does not supply a running application, database or sending mailbox. Check the current account before buying an upgrade.

## 2. Persistent database and sending mailbox

Create a MySQL database and user in the website database settings. Use Hostinger's complete account-prefixed names. Its documented same-service connection uses **127.0.0.1:3306**. [3]

Workspace state, audit events, authentication and private portrait BLOBs use InnoDB. Preflight requires max_allowed_packet of at least 4 MiB; portraits remain limited to 2 MiB. Schema setup never drops or resets existing records.

Configure an actual sending mailbox. **Your Hostinger login email is not automatically an SMTP mailbox.** Hostinger mail uses smtp.hostinger.com, port 465 with TLS or 587 with mandatory STARTTLS. Port 25 is not used. [4]

Hostinger replaces deployment directories during redeployment. Records and private portraits are therefore stored in MySQL. Do not keep live uploads, SQLite databases, credentials or backups in public_html, hbuilds or .hostinger-app. [1]

## 3. Private environment settings

Use Hostinger's **Environment Variables** settings. The blank template is hostinger/.env.example. Never commit actual values, include them in the ZIP or show them in screenshots.

| Setting | Value or purpose |
| --- | --- |
| NORTHWALL_RUNTIME | `hostinger`; also selects the Node variant for ordinary npm build/start |
| NODE_ENV | `production` |
| PORT | `3000` |
| APP_ORIGIN | `https://northwallegy.com` |
| ADDITIONAL_HOSTS | `www.northwallegy.com`, only when attached with a valid certificate |
| PUBLIC_LAUNCH | **`false`** until registration and the owner's launch decision |
| EDGE_HTTPS_CONFIRMED | `true` only after verifying Hostinger SSL and Force HTTPS |
| OWNER_EMAIL | `23samjessen@gmail.com` |
| AUTH_SECRET | Unique random 32-byte secret encoded as 64 hexadecimal characters |
| DB_HOST / DB_PORT | Usually `127.0.0.1` / `3306` |
| DB_NAME / DB_USER / DB_PASSWORD | Private database settings from your account |
| SMTP_HOST / SMTP_PORT | `smtp.hostinger.com` / `465`, or your actual verified-TLS provider |
| SMTP_USER / SMTP_PASSWORD / SMTP_FROM | Actual sending mailbox and credentials |

Generate AUTH_SECRET in a private terminal:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Save it securely. It is not the owner's password. Rotation invalidates pending-code verification and changes pseudonymous rate/audit keys, so plan rotations as maintenance.

A remote database requires DB_SSL_CA_BASE64 and verified TLS. Local Hostinger MySQL does not require that setting.

APP_ORIGIN and PUBLIC_LAUNCH must match the build manifest; rebuild after changing either. With public launch disabled, unauthenticated visitors reach sign-in before marketing pages. Employee records remain separately protected by membership approval. Search indexing stays disabled.

## 4. Initialize storage and provision the owner

Use a private application terminal/SSH session with Node 24 and the same server environment settings. If those are not supplied to the terminal automatically, load a private environment file outside all public/deployment directories. Do not put that file in the project.

From the directory containing package.json:

```bash
npm ci
npm run hostinger:setup
```

Setup creates missing tables without replacing records. It asks for a temporary owner password and confirmation **with terminal input hidden**. The password supplied in chat is deliberately absent from source and the archive and has not been set remotely. Enter it only through this private setup prompt. A temporary credential expires after 24 hours.

First sign-in requires:

1. Email username and temporary password.
2. A six-digit email code.
3. A different password of 15–128 characters, enforced on the server.
4. A full identity session, then workspace access.

Schema only: `npm run hostinger:setup -- --schema-only`.

Explicit owner recovery: `npm run hostinger:setup -- --recover-owner`. This changes the owner's credential and revokes existing sessions while preserving identity; do not run it during routine deployment.

For an imported verified workspace, setup checks and preserves its existing owner identity. Historical non-owner identities require reviewed migration mapping. Public email enrollment cannot claim their old IDs or private history.

## 5. Preflight, HTTPS and deployment

```bash
npm run hostinger:check
npm run hostinger:check -- --smtp
npm run build:hostinger
npm run start:hostinger
```

Preflight checks configuration, tables, packet capacity and owner provisioning. The optional SMTP check authenticates to the mailbox without sending email; real sign-in is still needed to test delivery. Hostinger normally runs build/start after the deployment settings are complete.

Enable a valid domain certificate and **Force HTTPS**. Verify HTTP redirects to HTTPS and the certificate is valid. The app adds HSTS but cannot issue or renew certificates. It uses a fixed canonical origin and ignores visitor-selected proxy/identity headers; Hostinger warns that forwarding headers can be forged outside its trusted CDN path. [5]

| Intended page | URL |
| --- | --- |
| Company website | https://northwallegy.com/ |
| Sign-in | https://northwallegy.com/sign-in |
| Employee workspace | https://northwallegy.com/workspace |
| Security insights | https://northwallegy.com/insights |

These are destination URLs, **not a claim that deployment has succeeded**. With PUBLIC_LAUNCH=false, sign in before viewing company pages.

On an empty workspace choose **Start empty workspace** for real work or **Load sample workspace** for design review. Both initializers refuse to overwrite an existing workspace.

Test invitation enrollment, acceptance, denial before approval, owner approval, role boundaries and revocation. Verify a private portrait and audit export, then redeploy and confirm records/photos persist.

## 6. Existing data is a separate migration

The original private Site uses D1/R2. Git and the source ZIP contain neither its live employee database nor uploaded portraits.

Obtain an authorized complete export and record the cutover time. Preserve member IDs, workspace JSON, revisions, UTC strings, audit ordering/hashes and portrait associations. Import portraits into the new BLOB table under their original object keys and verify byte sizes/hashes. Restore into a fresh staging database and verify the audit chain before cutover. Provision identity mappings explicitly; never infer a historical identity from a recycled email address.

Back up both systems, stop competing writes during cutover and retain a tested rollback copy. No live records or portraits were exported, replaced or reset during this source revision. Starting a fresh workspace instead of retaining demonstration data is a separate owner decision.

## 7. Maintenance and later public launch

Git covers source only. Back up the MySQL database, including profile_photos, through private account controls and test restoration separately. Workspace audit history is tamper-evident; database administrators can replace stored data, so independent evidence copies matter.

Run bounded authentication cleanup through an available Hostinger cron/maintenance facility:

```bash
npm run hostinger:setup -- --cleanup
```

Each call removes up to 1,000 expired records per category and authentication events older than 30 days. Startup also performs one bounded cleanup. Workspace audit history is not deleted. There is no always-running background worker.

After company registration, complete legal/tax/contact fields in lib/company-profile.json, set PUBLIC_LAUNCH=true, rebuild and deploy. Verify canonical URLs, sitemap, robots, contact details and HTTPS before submitting the sitemap to Google Search Console. Employee routes remain private/noindex. No search-ranking or traffic guarantee is made.

Same-email replacement staff, imported non-owner accounts and non-owner password recovery require a controlled offline retirement/provisioning procedure. Public enrollment deliberately refuses to reuse historical authentication identity. SMS is not implemented; email verification becomes operational after configuring SMTP.

## Primary references

[1] Hostinger, “How to add a Node.js web app in Hostinger.” https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/

[2] Hostinger, “How to fix Next.js 16 Turbopack build errors on Hostinger.” https://www.hostinger.com/support/how-to-fix-next-js-16-turbopack-build-errors-on-hostinger/

[3] Hostinger, “Connecting a Hostinger MySQL database to a Node.js application.” https://www.hostinger.com/support/connecting-a-hostinger-mysql-database-to-a-node-js-application/

[4] Hostinger, “How to fix SMTP email sending errors on Hostinger.” https://www.hostinger.com/support/how-to-fix-smtp-email-sending-errors-on-hostinger/

[5] Hostinger, “CDN visitor IP addresses” and “How to enable or disable HTTPS.” https://www.hostinger.com/support/hostinger-cdn-visitor-ip-addresses-in-logs-and-analytics/ ; https://www.hostinger.com/support/1583201-how-to-enable-or-disable-https-for-your-website-at-hostinger/
