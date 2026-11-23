# NorthWallEg — corrected Hostinger upload

This ZIP contains the full website and employee workspace with the Hostinger build selected by default. Upload the ZIP as a **Node.js Web App**.

## 1. Open the deployment settings

Go to **Hostinger → Websites → northwallegy.com → Dashboard → Settings & Redeploy**. Upload this new ZIP as the code source. If you are still in onboarding, use **Deploy Your Web App → Upload your files → Continue** instead.

Choose **Other** in the framework preset, even if automatic detection suggests Next.js. The application needs its custom authenticated server entry. Hostinger's Next.js preset ignores that custom entry and expects a different output layout.

| Field | Enter exactly |
| --- | --- |
| Framework preset | **Other** |
| Node version | **24.x** |
| Package manager | **npm** |
| Root directory | `./` |
| Build command | `npm run build` |
| Output directory | `.hostinger-app` |
| Entry file | `hostinger/server.mjs` |
| Start command, if shown | `npm start` |
| Internal port, if shown | `3000` |

Upload the ZIP itself. Its `package.json` is at the archive root. Do not use the older generic project ZIP or extract this source through File Manager to start the app.

## 2. What was fixed

The old default build could select Vinext and produce `dist/standalone`, which Hostinger rejected under its Next.js preset. In **this ZIP**:

- `npm run build` calls `node hostinger/build.mjs`, which prepares the Hostinger application and runs real `next build --webpack`.
- The generated application is in `.hostinger-app`, with Next output in `.hostinger-app/.next`.
- `npm start` calls `node hostinger/server.mjs`, preserving the verified-session authentication boundary.
- `.npmrc` includes development and optional dependencies during installation, including when `NODE_ENV=production`; the build needs TypeScript, PostCSS and native build packages.
- `NORTHWALL_RUNTIME` is not needed to select the build or start command in this ZIP.

The employee workspace, MySQL storage, private portraits, invitations, owner approval, audit history and email-code authentication remain included. No authentication checks were removed to make the build pass.

## 3. Complete the private server settings

The build itself requires no real password, database or mailbox. **Running the complete application does require them.** A successful build is separate from a configured Hostinger server.

Use Hostinger's Environment Variables page and the blank `hostinger/.env.example` reference:

| Setting | Required value |
| --- | --- |
| `APP_ORIGIN` | `https://northwallegy.com` |
| `OWNER_EMAIL` | `23samjessen@gmail.com` |
| `PUBLIC_LAUNCH` | `false` until the company's public launch |
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `EDGE_HTTPS_CONFIRMED` | `true` only after verifying the valid certificate and Force HTTPS |
| `AUTH_SECRET` | A private, independently generated 64-character hexadecimal secret |
| `DB_HOST`, `DB_PORT` | Usually `127.0.0.1`, `3306` for the same Hostinger service |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Actual account-prefixed database settings |
| `SMTP_HOST`, `SMTP_PORT` | Actual sending provider; Hostinger mail uses `smtp.hostinger.com`, `465` |
| `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Actual sending mailbox settings |

`ADMIN_EMAILS` by itself does not create an account or configure the database/mailbox. The Hostinger variant uses `OWNER_EMAIL`. No real credentials are in the ZIP.

## 4. Initialize the database and owner

First verify HTTPS at the hosting level. Then open the private application terminal or SSH session with Node 24 and the same server environment settings. From the project directory:

```bash
npm ci
npm run hostinger:setup
npm run hostinger:check -- --smtp
```

The setup command creates missing tables without resetting existing records. It prompts privately for the owner's temporary password. Email-code verification and a new password are required on the first sign-in. The SMTP check connects/authenticates without sending an email; first sign-in verifies actual delivery.

The detailed guide explains using a private environment file if Hostinger's dashboard settings are not automatically available in SSH. If the importer started the app before setup, finish these steps and redeploy. The server intentionally refuses to start with missing configuration or database tables.

## 5. Deploy and verify

After the settings, HTTPS, database and owner setup are complete, click **Deploy** or **Redeploy**. Hostinger manages the process; you do not need a second server running in SSH.

- Company page: `https://northwallegy.com/`
- Sign-in: `https://northwallegy.com/sign-in`
- Employee workspace: `https://northwallegy.com/workspace`

With `PUBLIC_LAUNCH=false`, sign in before reviewing company pages. The private review Site keeps its existing sign-in and data. Its database and uploaded photos are not contained in a source ZIP; transfer of those existing records requires the migration steps in the full guide.

## Manuals

- `docs/HOSTINGER_AND_DOMAIN.md` — complete setup, HTTPS, environment, backups and data migration.
- `MAINTENANCE_MANUAL.md` — contacts, photographs, colours, services and code map.
- `docs/USER_ACCESS.md` — invite, accept, owner approval, roles and revocation.
- `docs/AUTHENTICATION_AND_MFA.md` — email codes, temporary passwords and recovery.
- `docs/VERIFICATION.md` — prior application verification and its limits.

To recreate this upload profile from the Git source (Python 3 and Git required):

```bash
npm run hostinger:package -- --output /absolute/path/NorthWallEg-Hostinger-Upload.zip
```

Review and commit your intended source changes first for a clean source reference. The exporter excludes runtime records, private environment files, dependencies and generated builds. The original Git source retains its separate Sites preview build; this ZIP deliberately defaults to Hostinger.

## Official hosting instructions

1. Hostinger, “How to add a Node.js web app in Hostinger”: https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/
2. Hostinger, “How to fix changes not showing after a Node.js deployment”: https://www.hostinger.com/support/how-to-fix-changes-not-showing-after-a-node-js-deployment-at-hostinger/
3. Hostinger, “How to fix Next.js 16 Turbopack build errors”: https://www.hostinger.com/support/how-to-fix-next-js-16-turbopack-build-errors-on-hostinger/
