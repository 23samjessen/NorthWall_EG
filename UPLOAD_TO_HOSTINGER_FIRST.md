# Start here: upload NorthWallEg to Hostinger

This is the complete source project, including the website and employee workspace. The corrected **Hostinger upload ZIP** includes `START_HERE_HOSTINGER.md` and selects the Node builder with ordinary `npm run build` and `npm start`. Use its exact settings. If working from Git source, generate that profile with `npm run hostinger:package -- --output /absolute/path/NorthWallEg-Hostinger-Upload.zip`; the repository keeps its separate Sites preview default. Use Hostinger's **Node.js web-app deployment**. Uploading its source into a PHP/HTML `public_html` folder does not start the server.

1. Open **Deploy Your Web App**.
2. Choose **Connect with GitHub** and `23samjessen/NorthWall_EG`, or **Upload your files** and the supplied ZIP.
3. Select **Other**, **Node 24**, **npm**, root **`.`**, build **`npm run build:hostinger`**, output **`.hostinger-app`**, entry **`hostinger/server.mjs`**. If asked for a start command, use **`npm run start:hostinger`**.
4. Create the MySQL database and sending mailbox. Attach the intended domain, enable its certificate and **Force HTTPS**, then verify the certificate and HTTP-to-HTTPS redirect. Only after that verification set `EDGE_HTTPS_CONFIRMED=true` with the other private settings from `hostinger/.env.example`.
5. Open the uploaded or cloned source in a **private Node application terminal/SSH session**, from the directory containing `package.json`. Follow `docs/HOSTINGER_AND_DOMAIN.md` to run schema setup, the hidden-prompt owner provisioning and preflight **before a successful Node startup**.
6. Deploy or redeploy with the settings above, then test the first sign-in and email-code delivery. If the importer attempts to start the app before setup is complete, finish the prerequisites through the private terminal and **redeploy**. The server does not create its database tables or owner account automatically at startup.

**Hostinger setup is still pending.** The supplied ZIP contains the source; uploading it alone does not configure MySQL, SMTP, HTTPS or the owner account. Use the Node deployment workflow to make the source available to its application terminal/SSH session. Keep private environment files outside the project and all public/deployment directories.

Keep `PUBLIC_LAUNCH=false` until registration and your launch decision. The owner username is **23samjessen@gmail.com**. No actual password, SMTP credential or database credential is included. Enter the temporary owner password privately during setup; email verification and password replacement are required before workspace access.

The Hostinger “Coming soon” page remains until the Node application is successfully deployed and attached to the domain. The full guide distinguishes the source upload from separate migration of existing employee records and portraits.

## Included manuals

- `docs/HOSTINGER_AND_DOMAIN.md` — deployment, private settings, HTTPS, backups and migration.
- `MAINTENANCE_MANUAL.md` — contacts, photographs, colours, images, commands and code map.
- `docs/USER_ACCESS.md` — invitations, approval, administrator roles and revocation.
- `docs/AUTHENTICATION_AND_MFA.md` — email codes, passwords and recovery boundaries.
- `docs/SECURITY_REVIEW.md` and `docs/VERIFICATION.md` — tested controls and remaining verification.
