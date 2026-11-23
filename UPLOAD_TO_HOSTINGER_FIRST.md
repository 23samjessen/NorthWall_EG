# Start here: replacement Next.js ZIP for Hostinger

Use the **replacement Next.js upload ZIP** and follow [hostinger/UPLOAD_NEXT_README.md](hostinger/UPLOAD_NEXT_README.md). That manual is also included as `START_HERE_HOSTINGER.md` at the root of the exported ZIP.

1. Open **Hostinger → Websites → northwallegy.com → Deployments → Redeploy**.
2. Choose **Upload new files** and select the new ZIP.
3. Select **Next.js**, Node **24.x** (22.13.0 or later also supported), **npm**, root **`./`**, build **`npm run build`**, output **`.next`**, and the automatic/default entry. If a start command is shown, use **`npm start`**.
4. Preserve the private database/mailbox settings. Keep `APP_ORIGIN=https://northwallegy.com` and `PUBLIC_LAUNCH=false`. Use the full manual for missing settings and private owner setup.
5. Save and redeploy. The new build should report `Next.js output verified: .next/standalone/server.js`.

This profile uses native Next.js routes for authentication and the employee workspace. The older **Other / `.hostinger-app` / `hostinger/server.mjs`** settings do not apply to this ZIP. Do not upload the source into PHP/HTML `public_html`.

The sign-in page can run before private services are configured. Authentication and workspace APIs fail closed until MySQL, SMTP, verified HTTPS and private owner setup are complete. Uploading a ZIP does not create a real database/mailbox/account or migrate existing employee records and photographs.

The owner email is **23samjessen@gmail.com**. Passwords, email codes and server credentials are not included in the archive. The setup command asks privately for a temporary owner password; first use requires an email code and password replacement.

## Recreate the upload from Git

```bash
npm run hostinger:package -- --output /absolute/path/NorthWallEg-Hostinger-Nextjs.zip
```

The shared repository's ordinary commands still serve the existing Sites preview. Export first: downloading GitHub's source ZIP or connecting the shared source directly is not the same as this transformed Next.js upload.

## Included manuals

- `hostinger/UPLOAD_NEXT_README.md` — exact replacement ZIP settings and first-use steps.
- `docs/HOSTINGER_AND_DOMAIN.md` — private settings, database, HTTPS, backups and migration.
- `MAINTENANCE_MANUAL.md` — contacts, photographs, colours, images, commands and code map.
- `docs/USER_ACCESS.md` — invitations, approval, roles and revocation.
- `docs/AUTHENTICATION_AND_MFA.md` — email codes, passwords and recovery.
