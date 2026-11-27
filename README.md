# NorthWallEg — November 2026 Recovery & Google Reviews update

Read `docs/PASSWORD_RECOVERY_AND_GOOGLE_REVIEWS.md` before upgrading. Keep the existing database. Only an idempotent `--schema-only` migration is needed; do not recreate the owner. A real Google Business Profile review URL is needed to activate the icon.

# NorthWallEg — standard Next.js upload for Hostinger

## Marketing and cookie update — 26 November 2026

This complete replacement ZIP adds consent-controlled Meta (Facebook/Instagram) and TikTok integration, separate visitor choices and public interaction events. The floating WhatsApp button remains included. The existing three designs, images, website content and employee workspace are preserved; the privacy text now describes the optional integrations.

**Advertising is disabled until you add your own Pixel IDs and finish the provider settings review.** No paid campaign has been created. Read **`docs/MARKETING_AND_COOKIES.md`** for the activation steps, event definitions, storage policy and verification procedure. All optional `NEXT_PUBLIC_*` marketing settings take effect at build time, so save them in Hostinger and redeploy when activating or changing a Pixel.

Upload this source ZIP as a new deployment of the existing Node.js website, using the Next.js settings below. **Keep your working database, email, authentication, domain and `PUBLIC_LAUNCH` values. Do not run first-owner setup again for this update.** No database migration is needed for marketing or cookie preferences.

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



---

## Original project reference

The following reference describes the shared preview source and legacy custom-server target. For this exported ZIP, follow the standard Next.js deployment instructions above.

# NorthWallEg — website and employee workspace

This is the approved NorthWallEg website and employee-workspace source for **23samjessen/NorthWall_EG**. The public presentation combines Nordic visual clarity with Egyptian architectural imagery. The employee workspace uses server-side identity, membership checks, persistent records and an administrator audit trail.

**Hosted app:** https://northwalleg-design-demo.dark-hawk-6582.chatgpt.site/

**GitHub source:** https://github.com/23samjessen/NorthWall_EG

**Hostinger destination:** `northwallegy.com`, including the full employee workspace. This repository now includes a standard Next.js Node variant with MySQL/private-photo storage and password + email-code sign-in. Its build and local security checks pass; account configuration, real email delivery, data transfer and live Hostinger deployment remain to be completed. Start with [UPLOAD_TO_HOSTINGER_FIRST.md](UPLOAD_TO_HOSTINGER_FIRST.md) and [the complete hosting guide](docs/HOSTINGER_AND_DOMAIN.md). The source ZIP belongs in Node.js web-app deployment, not a PHP/HTML `public_html` upload.

The full application lives in this repository's root. This clean repository contains the current app and its verification workflow; it has no legacy website subtree or GitHub Pages publication workflow. The original website is maintained separately in **23samjessen/NorthWall**. The new app runs on Worker/D1 hosting at the link above.

**The hosted site remains private for review. Publish it only after company registration and the owner's launch instruction.** A public source repository does not open the private site or its employee data.

Pushing to GitHub saves source changes. It does **not** update the existing private Sites deployment. If you connect this repository to Hostinger and enable Git deployment, pushes can trigger that separately configured Node deployment; edits are not automatically synchronised in both directions. See [docs/GITHUB_AND_DEPLOYMENT.md](docs/GITHUB_AND_DEPLOYMENT.md) for the exact distinction and Git commands.

## Start here

| What you need | Read this |
|---|---|
| Everyday maintenance, company details, people, photos, users and launch | [MAINTENANCE_MANUAL.md](MAINTENANCE_MANUAL.md) |
| Exact public company JSON fields and examples | [docs/COMPANY_CONTENT.md](docs/COMPANY_CONTENT.md) |
| Clone, update and push this repository; understand deployment | [docs/GITHUB_AND_DEPLOYMENT.md](docs/GITHUB_AND_DEPLOYMENT.md) |
| Hostinger Node upload, database, email verification, HTTPS and launch | [docs/HOSTINGER_AND_DOMAIN.md](docs/HOSTINGER_AND_DOMAIN.md) |
| Eight-step review of the design and functions | [docs/REVIEW_GUIDE.md](docs/REVIEW_GUIDE.md) |
| Commands, users, colours, images, fields and code locations | [docs/CUSTOMISATION.md](docs/CUSTOMISATION.md) |
| Owner invitation and approval guide | [docs/USER_ACCESS.md](docs/USER_ACCESS.md) |
| Passwords, email verification and owner recovery | [docs/AUTHENTICATION_AND_MFA.md](docs/AUTHENTICATION_AND_MFA.md) |
| Employee workspace guide | [docs/WORKSPACE.md](docs/WORKSPACE.md) |
| Identity, permissions, database, audit and API details | [docs/BACKEND.md](docs/BACKEND.md) |
| Security fixes, test evidence and remaining launch requirements | [docs/SECURITY_REVIEW.md](docs/SECURITY_REVIEW.md) |
| SEO decisions and public-launch configuration | [docs/SEO.md](docs/SEO.md) |
| News publishers, refresh behaviour and topic filters | [docs/NEWS.md](docs/NEWS.md) |
| Search intent, useful content and search-launch plan | [docs/SEO_AND_CONTENT_PLAN.md](docs/SEO_AND_CONTENT_PLAN.md) |
| Prioritised future improvements and dependencies | [docs/FUTURE_ROADMAP.md](docs/FUTURE_ROADMAP.md) |
| Image and logo sources | [docs/ASSETS.md](docs/ASSETS.md) |
| Verification performed | [docs/VERIFICATION.md](docs/VERIFICATION.md) |

## What to review

### Public presentation

- New NorthWallEg name, editable NW vector monogram and architectural Egyptian hero.
- Three selectable colour directions: **Limestone**, **Midnight**, **Nile**.
- English and Arabic pages, including nine detailed service pages in both languages.
- Featured **Microsoft 365 & Cloud** and **Cyber Defence** panels, with the remaining seven services in an expandable **More services** icon grid and existing detail/options views.
- Searchable services, three industry views, a project brief builder, FAQ and contact details.
- Compact contact cards for Pernille Jessen (**CEO**, with **IoT Engineer** in the details) and Sam Jessen (**Country Manager — Egypt**, with **Network & Cybersecurity Engineer** in the details). Each opens a contact dialog with one replaceable image and a preferred-contact action.
- Clickable Microsoft 365, Cisco, Splunk, SOAR and Cloud Security capability icons, with practical options and links into the existing service enquiry flow.
- Footer social icon slots for Facebook, Instagram, TikTok, LinkedIn and YouTube. Unconfigured accounts are labelled **Coming soon** during private review and hidden at launch; approved account URLs are required before links become active.
- Configurable additional phones, emails, locations, hours, links and content cards. Unprovided registration fields remain empty and hidden.
- English IT and cybersecurity headlines from eight selected publisher feeds, including Cisco Talos, Splunk advisories, SOAR, Unit 42 threat research and CERT-EU alerts. Search by text, publisher and topic in the news dialogs and at **[/insights](https://northwalleg-design-demo.dark-hawk-6582.chatgpt.site/insights)**.
- Three original public security guides with official references, related service links and explicit review dates. Search metadata, structured data and sitemap entries are prepared for the future public launch.
- Cairo/Copenhagen clocks, responsive layouts, keyboard focus and reduced-motion support.
- A project brief can be downloaded. A signed-in member can save a fictional enquiry as a workspace ticket. The form sends no email.

### Employee workspace

- Live ticket totals, open/resolved breakdown, workload and status visualisations.
- Draggable work board, table view, search/filter, assignment, priority, due date, location, tags, checklists and archive.
- Comment threads, targeted replies, mentions, emoji reactions, edit/remove and internal forwarding.
- Channels and direct conversations, with private-message filtering on the server.
- Calendar/agenda, event editing and calendar export.
- Private/team notes, pins and search.
- In-app alerts for mentions, assignment and administrator/manager announcements.
- Protected knowledge centre: **32 official resources** and **12 original Microsoft 365 troubleshooting runbooks**.
- Administrator control over members/roles, workflow columns, typed custom fields and ticket automation rules.
- Employee **My profile** details, one protected profile photo per person, and profile completion status in the administrator's team view.
- Administrator-only timestamped audit history and JSON evidence export with hash-chain verification.

The administrator starts the labelled sample workspace once. Sample colleagues are assignment examples, not working logins. Follow the review guide to add a task, reply, calendar event and custom field.

## Sign-in and passwords

**Implemented Hostinger login:** password followed by an email verification code, with mandatory replacement of an initial temporary password. The replacement upload uses native Next.js routes and the existing authentication service. Real MySQL, SMTP, HTTPS and owner provisioning are still required in the hosting account. SMS is not implemented. See [Authentication and MFA](docs/AUTHENTICATION_AND_MFA.md).

There is no shared NorthWallEg demo password. The private Sites preview uses its hosting gateway and `ADMIN_EMAILS`; the Hostinger version uses `OWNER_EMAIL` and private offline owner provisioning. In both, the backend checks active employee membership. Only the owner can invite colleagues in **Admin settings → Team**. They must accept their invitation and receive separate owner approval before access; the owner can later grant admin roles. See [User access](docs/USER_ACCESS.md).

The earlier browser-only prototype's sample username/password does not apply. Sites credentials are managed at its identity provider; Hostinger passwords are managed by the local authentication service and documented recovery commands. This repository contains no production passwords, credential verifiers or API keys.

Adding a workspace invitation does not itself send email. Hostinger enrollment sends a verification code only after an eligible invitee starts enrollment. Sites audience access remains a separate requirement for the private Sites preview.

Public team cards do not create employee accounts. No sign-in email has been supplied for Pernille, so her public profile is not an invitation or an administrator account. Each employee edits their own profile; only the owner manages account invitations, approvals and roles.

## Sites preview commands (Git source)

These commands apply to the shared Git source and its Worker/D1 preview. For the exported Hostinger ZIP, use `START_HERE_HOSTINGER.md`; its ordinary build/start commands target Next.js instead.

Use Node.js **22.13.0 or newer**. Run commands from this project's root.

```sh
cp .env.example .dev.vars
npm ci
npm run build
```

Run the copy command for a fresh local checkout. If `.dev.vars` already exists, review it instead of overwriting it. The supplied example sets `ADMIN_EMAILS="seedy@sites.test"` for the portable development identity; it contains no production password or API key.

Initialise a new **local** database once:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_clean_silk_fever.sql
```

Start the portable development preview:

```sh
npm run dev
```

The terminal prints the local URL. See `docs/CUSTOMISATION.md` for the loopback-only development identity and `.dev.vars` configuration. Hosted identity is different; do not expose a local development server to the internet.

Useful checks:

```sh
npx tsc --noEmit
node scripts/test-workspace.mjs
npm run test:news
npm run test:security
npm run audit:dependencies
npm run build
```

Generate a new schema migration after changing `db/schema.ts`:

```sh
npm run db:generate
```

Do not edit or replay an already applied migration. Review the generated SQL and apply only the new local migration file. The hosting deployment workflow applies production migrations separately.

## Where to make changes

| Change | Location |
|---|---|
| Public company, contact, team, registration and hero settings | `lib/company-profile.json` |
| Validation and derived public configuration | `lib/site-config.ts` |
| English/Arabic services and industry copy | `lib/marketing-content.js` |
| Home-page layout and contact flow | `components/marketing.tsx` |
| Public colours and responsive layout | `app/globals.css` |
| Logo | `components/brand.tsx`, `public/assets/nw-monogram.svg`, `public/favicon.svg` |
| Photos | `public/assets/` |
| Workspace views and controls | `components/workspace.tsx` |
| Employee profile photo endpoint | `app/api/profile-photo/route.ts` |
| Workspace colours and layout | `app/workspace/workspace.css` |
| Role checks, actions and validation | `lib/workspace-server.ts` |
| Types and new data fields | `lib/workspace-types.ts` |
| Starting demo records | `lib/workspace-seed.ts` |
| Employee handbook and official links | `lib/knowledge-resources.json` |
| News publisher allowlist and RSS parser | `lib/news-source.ts` |
| News API, shared runtime cache and fallback status | `app/api/news/route.ts`, `lib/news-service.ts` |
| Headline search, publisher and topic filters | `components/news-explorer.tsx` |
| Security news hub and original guides | `app/insights/`, `lib/insights-content.ts`, `components/insights*.tsx` |
| Technology capability icons and social profile slots | `platforms`, `contact.socialLinks` in `lib/company-profile.json`; `components/public-icons.tsx` |
| Saved headline fallback / refresh command | `lib/news-snapshot.json`, `npm run news:refresh` |
| Page titles, structured data and indexing policy | `lib/seo.ts`, `app/layout.tsx`, page metadata, robots/sitemap routes and `worker/index.ts` |
| Repository verification workflow | `.github/workflows/check.yml` |

In the private Sites preview, employee records, direct messages, notes and audit history use D1, and photo bytes use protected R2 storage. The Hostinger version stores workspace records, authentication and private photo BLOBs in MySQL. Neither deployment's runtime records belong in Git. A source ZIP or GitHub checkout is not a database or uploaded-photo backup. Local `.dev.vars`, `.wrangler/`, dependency folders and generated builds are excluded from normal source commits.

## Review boundaries

This is a working **single-company review demo**, not a multi-customer production SOC platform. All active employees share the team's tickets. Personal notes and direct messages have narrower visibility. Changes persist on the server; local storage is used only for presentation preferences.

The audit chain detects changes relative to a trusted exported head; it is not immutable or certified forensic storage. Database administrators remain a separate trust boundary. Chat polling and in-app alerts work while the app is open; this build does not deliver push notifications, email invitations, SMS or external messaging.

ISO entries are summaries and official catalogue links. Licensed standards are not copied into the repository. The Microsoft 365 handbook is original operational guidance linked to official documentation; tenant privileges, licensing and approved change procedures still apply.

The hosted review site remains private and intentionally `noindex`. The design has been approved; company registration, the final domain and a launch instruction are still required before opening the marketing website. Keep employee access protected after launch. SEO foundations cannot guarantee a first-place Google ranking.

The Sites version uses identity inserted by its trusted hosting gateway. Native Hostinger handlers independently verify opaque session cookies and establish a process-local request context before calling the same workspace logic. Visitor-supplied identity headers never authenticate the Hostinger application. See `docs/BACKEND.md` before adding another hosting provider.

## Hostinger command reference

Run these commands in the **exported Next.js upload project**, with the documented private server environment for setup and preflight:

```bash
npm ci
npm run hostinger:setup
npm run hostinger:check -- --smtp
npm run build
npm start
```

Setup requires private environment settings and a private terminal for the hidden owner-password prompt. Do not run setup against an unrelated database. The default owner username is **23samjessen@gmail.com**; no actual credential is shipped. `PUBLIC_LAUNCH=false` keeps the destination behind sign-in until the owner decides to launch. See the hosting guide before using these commands.

## Corrected Hostinger upload ZIP

Run `npm run hostinger:package -- --output /absolute/path/NorthWallEg-Hostinger-Nextjs.zip` to create the replacement upload profile. It builds standard Next.js at the upload root, includes build dependencies even with `NODE_ENV=production`, and adds `START_HERE_HOSTINGER.md`. Choose **Next.js**, output **`.next`**, build **`npm run build`**, and the automatic/default entry. The generated server is `.next/standalone/server.js`; public/static assets and maintenance commands are included in that output. The full instructions are [hostinger/UPLOAD_NEXT_README.md](hostinger/UPLOAD_NEXT_README.md).

The Git source retains its Sites preview default. Export the profile before uploading; a GitHub source download is not the transformed Hostinger project. The old custom-server target is retained only for existing deployments and can be exported explicitly with `--profile custom-server`. No real credentials or runtime records are exported.
