# NorthWallEg on Hostinger

Updated 23 November 2026. Domain: **northwallegy.com**. Repository: **23samjessen/NorthWall_EG**.

## Delivery status

The project includes a standard Next.js Node server, MySQL workspace and private-photo storage, email/password sign-in with an email verification code, mandatory temporary-password replacement, and owner-controlled invitations and approval. The existing private review Site retains its original hosting and gateway login.

The Node production build and local checks pass. **The application has not been deployed or configured in your Hostinger account.** No actual database/mailbox credentials have been supplied, no real email code has been delivered, and no owner password has been provisioned there. Real MySQL CI/staging evidence is recorded separately in VERIFICATION.md.

Your screenshot showing **Coming soon** is Hostinger's placeholder. Your File Manager screenshot shows public_html; putting the source ZIP there will not start the Node server. Use **Deploy Your Web App**, then **Connect with GitHub** or **Upload your files**. Hostinger supports both workflows. [1]

## 1. Application and build settings

**Replacement upload profile:** `hostinger/package-upload.py` exports a flat ZIP containing a standard Next.js application. Its build writes **`.next` at the project root**, including `.next/standalone/server.js`. Authentication and workspace protection run in native Route Handlers and server-page guards. The generated output includes public/static assets and private maintenance commands. See `START_HERE_HOSTINGER.md` in the ZIP or `hostinger/UPLOAD_NEXT_README.md` in the Git source.

| Hostinger setting | Value for the replacement ZIP |
| --- | --- |
| Website type | Node.js web application |
| Framework preset | **Next.js** |
| Node version | **24.x recommended**; 22.13.0 or later is supported |
| Package manager | npm |
| Root directory | `./` — directory containing package.json |
| Install command, if requested | `npm ci` |
| Build command | `npm run build` |
| Output directory | **`.next`** |
| Entry file | Automatic/default; leave empty |
| Start command, if requested | `npm start` |
| Internal port | Provider-assigned `PORT`, default 3000 |

Upload the replacement archive through **Deployments → Redeploy → Upload new files**. Do not reuse the older ZIP. The shared Git repository's default remains the Sites/Worker preview; a direct source download is not the transformed upload. To use Git auto-deployment, maintain the generated native profile in a deployment branch rather than connecting the shared source with the wrong preset. No Git auto-deployment is created by this ZIP.

The build runs **next build --webpack**. Hostinger requires webpack for Next.js 16.3.3 and newer on the build servers described in its guide; this project uses 16.4.5. [2] Native routes reconstruct the configured canonical HTTPS origin and do not trust visitor-supplied forwarding or identity headers. Each protected handler verifies its cookie session before accessing data.

**Legacy custom-server target:** existing deployments can still export it explicitly with `--profile custom-server`. That separate profile uses Other, `.hostinger-app` and `hostinger/server.mjs`. These older settings do not apply to the replacement Next.js ZIP.

The exact plan and resources still need confirmation. A domain alone does not supply a running application, database or sending mailbox. Check the current account before buying an upgrade.

## 2. Persistent database and sending mailbox

Create a MySQL database and user in the website database settings. Use Hostinger's complete account-prefixed names. Its documented same-service connection uses **127.0.0.1:3306**. [3]

Workspace state, audit events, authentication and private portrait BLOBs use InnoDB. Preflight requires max_allowed_packet of at least 4 MiB; portraits remain limited to 2 MiB. Schema setup never drops or resets existing records.

Configure an actual sending mailbox. **Your Hostinger login email is not automatically an SMTP mailbox.** Hostinger mail uses smtp.hostinger.com, port 465 with TLS or 587 with mandatory STARTTLS. Port 25 is not used. [4]

Hostinger replaces deployment directories during redeployment. Records and private portraits are therefore stored in MySQL. Do not keep live uploads, SQLite databases, credentials or backups in public_html, hbuilds or .hostinger-app. [1]

### Verify HTTPS before running setup

Attach the intended domain, enable its valid certificate and **Force HTTPS**, then verify that HTTP redirects to HTTPS and the certificate is valid. This can be checked while Hostinger's placeholder is still displayed; the NorthWallEg server does not need to be running for the hosting-level check. The app adds HSTS but cannot issue or renew certificates. [5]

Only after that verification set **EDGE_HTTPS_CONFIRMED=true**. Setup, preflight and private-service initialization require this setting. The native server can render sign-in before setup, but authentication/workspace APIs remain unavailable while private configuration is incomplete. Complete this hosting step before the commands in section 4.

The application uses a fixed canonical origin and ignores visitor-selected proxy/identity headers. Hostinger warns that forwarding headers can be forged outside its trusted CDN path. [5]

## 3. Private environment settings

Use Hostinger's **Environment Variables** settings. The blank template is hostinger/.env.example. Never commit actual values, include them in the ZIP or show them in screenshots.

| Setting | Value or purpose |
| --- | --- |
| NORTHWALL_RUNTIME | Not required by the replacement ZIP; only the legacy Git-source selector uses this |
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

Open the uploaded application through a **private Node application terminal/SSH session** with Node 24. Work from the deployed directory containing `hostinger/setup.mjs`, or from the full exported source directory containing package.json. File Manager's public_html view is not a terminal and does not run these commands. Keep the same private configuration as the managed application, including the HTTPS confirmation completed above.

The deployed files must be available in that private application environment before provisioning. The native server and sign-in page can start before setup; authentication and workspace APIs return a controlled unavailable response until the database and sending provider are ready. Complete this section and preflight, then retry sign-in. Redeploy if you changed environment settings. The server never creates tables or an owner automatically.

Hostinger's application environment settings may not be supplied to an SSH shell automatically. If needed, use a private environment file outside the project and all public/deployment directories; never include it in the ZIP.

From the deployed directory containing the maintenance commands:

```bash
node hostinger/setup.mjs
node hostinger/check.mjs --smtp
```

In the complete source project, install dependencies with `npm ci`; the equivalent setup command is `npm run hostinger:setup`.

If your SSH shell does not already have the application settings, replace the example path below with your actual private environment-file path and use Node's environment-file option for setup:

```bash
node --env-file=/absolute/private/path/northwalleg.env hostinger/setup.mjs
```

Use the same method for preflight when required: `node --env-file=/absolute/private/path/northwalleg.env hostinger/check.mjs --smtp`. Hostinger's managed application still needs its settings in the dashboard separately.

Setup creates missing tables without replacing records. It asks for a temporary owner password and confirmation **with terminal input hidden**. The password supplied in chat is deliberately absent from source and the archive and has not been set remotely. Enter it only through this private setup prompt. A temporary credential expires after 24 hours.

First sign-in requires:

1. Email username and temporary password.
2. A six-digit email code.
3. A different password of 15–128 characters, enforced on the server.
4. A full identity session, then workspace access.

Schema only: `npm run hostinger:setup -- --schema-only`.

Explicit owner recovery: `npm run hostinger:setup -- --recover-owner`. This changes the owner's credential and revokes existing sessions while preserving identity; do not run it during routine deployment.

For an imported verified workspace, setup checks and preserves its existing owner identity. Historical non-owner identities require reviewed migration mapping. Public email enrollment cannot claim their old IDs or private history.

## 5. Preflight and deployment

```bash
npm run hostinger:check
npm run hostinger:check -- --smtp
```

Preflight checks configuration, tables, packet capacity and owner provisioning. The optional SMTP check authenticates to the mailbox without sending email; real sign-in is still needed to test delivery.

Choose **Deploy** or **Redeploy** with the section 1 Next.js preset, build `npm run build`, output `.next` and automatic entry. If shown, the start command is `npm start`. Hostinger runs the generated standalone server; a second listener does not need to be started from SSH. Complete HTTPS, private settings, schema, owner provisioning and preflight before relying on sign-in.

If an earlier start failed because these prerequisites were missing, redeploy after completing them. A successful source upload or build alone does not confirm that the server, database or email delivery is working. **Actual setup and deployment in your Hostinger account remain pending.**

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

Each call removes up to 1,000 expired records per category and authentication events older than 30 days. The first successful private-service initialization also performs one bounded cleanup. Workspace audit history is not deleted. There is no always-running background worker.

After company registration, complete legal/tax/contact fields in lib/company-profile.json, set PUBLIC_LAUNCH=true, rebuild and deploy. Verify canonical URLs, sitemap, robots, contact details and HTTPS before submitting the sitemap to Google Search Console. Employee routes remain private/noindex. No search-ranking or traffic guarantee is made.

Same-email replacement staff, imported non-owner accounts and non-owner password recovery require a controlled offline retirement/provisioning procedure. Public enrollment deliberately refuses to reuse historical authentication identity. SMS is not implemented; email verification becomes operational after configuring SMTP.

## Primary references

[1] Hostinger, “How to add a Node.js web app in Hostinger.” https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/

[2] Hostinger, “How to fix Next.js 16 Turbopack build errors on Hostinger.” https://www.hostinger.com/support/how-to-fix-next-js-16-turbopack-build-errors-on-hostinger/

[3] Hostinger, “Connecting a Hostinger MySQL database to a Node.js application.” https://www.hostinger.com/support/connecting-a-hostinger-mysql-database-to-a-node-js-application/

[4] Hostinger, “How to fix SMTP email sending errors on Hostinger.” https://www.hostinger.com/support/how-to-fix-smtp-email-sending-errors-on-hostinger/

[5] Hostinger, “CDN visitor IP addresses” and “How to enable or disable HTTPS.” https://www.hostinger.com/support/hostinger-cdn-visitor-ip-addresses-in-logs-and-analytics/ ; https://www.hostinger.com/support/1583201-how-to-enable-or-disable-https-for-your-website-at-hostinger/
