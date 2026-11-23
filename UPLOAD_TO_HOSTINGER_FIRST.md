# Start here: upload NorthWallEg to Hostinger

This is the complete source project, including the website and employee workspace. Use Hostinger's **Node.js web-app deployment**. Uploading its source into a PHP/HTML `public_html` folder does not start the server.

1. Open **Deploy Your Web App**.
2. Choose **Connect with GitHub** and `23samjessen/NorthWall_EG`, or **Upload your files** and the supplied ZIP.
3. Select **Other**, **Node 24**, **npm**, root **`.`**, build **`npm run build:hostinger`**, output **`.hostinger-app`**, entry **`hostinger/server.mjs`**. If asked for a start command, use **`npm run start:hostinger`**.
4. Configure a MySQL database, a sending mailbox and the private settings in `hostinger/.env.example`.
5. Follow `docs/HOSTINGER_AND_DOMAIN.md` for HTTPS, schema setup, hidden-prompt owner provisioning and the first sign-in test.

Keep `PUBLIC_LAUNCH=false` until registration and your launch decision. The owner username is **23samjessen@gmail.com**. No actual password, SMTP credential or database credential is included. Enter the temporary owner password privately during setup; email verification and password replacement are required before workspace access.

The Hostinger “Coming soon” page remains until the Node application is successfully deployed and attached to the domain. The full guide distinguishes the source upload from separate migration of existing employee records and portraits.

## Included manuals

- `docs/HOSTINGER_AND_DOMAIN.md` — deployment, private settings, HTTPS, backups and migration.
- `MAINTENANCE_MANUAL.md` — contacts, photographs, colours, images, commands and code map.
- `docs/USER_ACCESS.md` — invitations, approval, administrator roles and revocation.
- `docs/AUTHENTICATION_AND_MFA.md` — email codes, passwords and recovery boundaries.
- `docs/SECURITY_REVIEW.md` and `docs/VERIFICATION.md` — tested controls and remaining verification.
