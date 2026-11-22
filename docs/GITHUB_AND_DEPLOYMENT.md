# NorthWallEg — GitHub and deployment

The current NorthWallEg application belongs in [23samjessen/NorthWall_EG](https://github.com/23samjessen/NorthWall_EG). The review application uses separate hosting:

[Open the private NorthWallEg review site](https://northwalleg-design-demo.dark-hawk-6582.chatgpt.site/)

GitHub stores source. The running employee application, database, uploaded photos and hosting access policy are separate. A GitHub push does not automatically deploy the application or make the private review site public.

## 1. What is in the new repository?

| Location | Purpose |
| --- | --- |
| Root `app/`, `components/`, `lib/`, `worker/` | Current NorthWallEg website and employee application |
| `lib/company-profile.json` | Public company, contact, team, registration and website settings |
| `db/` and `drizzle/` | Database schema and ordered migrations |
| `public/assets/` | Public website imagery and brand assets; public team placeholders/photos |
| `docs/` and `MAINTENANCE_MANUAL.md` | User, setup, maintenance and deployment guides |
| `.github/workflows/check.yml` | Dependency installation, type checking, backend checks and build verification |
| `.openai/hosting.json` | Hosted project identity and storage bindings |

This is a clean current-app repository. There is no `legacy/` website folder and no Pages deployment workflow. The earlier website belongs in the separate [23samjessen/NorthWall](https://github.com/23samjessen/NorthWall) repository. During the repository move, verify the new repository before restoring the original one.

## 2. Clone the new project once

```sh
git clone https://github.com/23samjessen/NorthWall_EG.git
cd NorthWall_EG
cp .env.example .dev.vars
npm ci
npm run build
```

Use Node.js **22.13.0 or newer**. Run the copy command only for a fresh local setup; review an existing `.dev.vars` before replacing it. The safe example enables the portable local development identity, not a production login.

Apply the initial **local** migration once:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_clean_silk_fever.sql
npm run dev
```

Use the URL printed in the terminal. Local state is separate from the hosted employee database.

If you already have the old repository on your computer, keep that checkout for the original website and clone `NorthWall_EG` into a separate folder. This avoids accidentally pushing current-app changes to the original project.

## 3. Get the latest source

From the `NorthWall_EG` checkout:

```sh
git remote -v
git status --short
git switch main
git pull --ff-only origin main
```

Check that `origin` names **23samjessen/NorthWall_EG**. Keep any local changes you need before pulling. `--ff-only` stops if local and remote history have diverged; review and resolve that situation instead of forcing an overwrite.

Run `npm ci` again when the lockfile changes. Review new migrations before applying them locally.

## 4. Save a deliberate edit

Example after changing public company details:

```sh
git status --short
git diff
git add lib/company-profile.json
git diff --cached
git commit -m "Update NorthWallEg public company details"
git push origin main
```

Replace the path with the files you actually changed. If you added a public photograph, stage that intended asset too. Check the staged diff before committing. Use your normal GitHub credential manager; credentials do not belong in source files or remote URLs.

For code changes, run:

```sh
npx tsc --noEmit
npm run test:backend
npm run build
```

These are commands to run, not a claim that every future revision has passed. Review the actual check result for the commit being released. `.github/workflows/check.yml` verifies source; it is not a deployment pipeline.

## 5. Keep source and deployment aligned

| Destination | What changes it |
| --- | --- |
| New GitHub repository | A reviewed commit pushed to `23samjessen/NorthWall_EG` |
| Hosted NorthWallEg app | An explicit source synchronisation, matching build, saved version and deployment through the supported hosting workflow |
| Local preview | Edits in the local checkout and `npm run dev` |
| Original NorthWall website | A separate change in `23samjessen/NorthWall` and its own original deployment workflow |

No automatic two-way synchronisation is configured between GitHub and the current hosting platform. A maintainer should:

1. Pull and identify the intended GitHub commit.
2. Review the changes, run the relevant checks and build that version.
3. Synchronise the intended source through the hosting platform's supported source workflow. Preserve the existing project's identity and database/object-storage bindings.
4. Save and deploy the matching source/build as a new hosted version, retaining the private audience during review.
5. Verify the deployment and record its corresponding GitHub commit.

If work starts in the hosted development workspace, bring it back into this GitHub repository as a reviewed commit. A successful GitHub push proves source was saved; it does not prove the hosted application was updated.

The new app needs server-side authentication, membership checks, data writes, audit recording and RSS fetching. A static GitHub Pages upload cannot provide those Worker/D1 operations. Keep `.github/workflows/check.yml` as verification unless a separately reviewed supported deployment integration is deliberately added.

## 6. Data and backups

The D1 database stores members, tickets, messages, notes, calendar events, workspace settings and audit history. Employee photo bytes are stored in protected R2 object storage through `BUCKET`; the database keeps the associated metadata. These runtime records are separate from Git.

- A source ZIP contains code, public assets, schema migrations and documentation.
- `lib/workspace-seed.ts` contains labelled fictional examples, not a working database export.
- `.wrangler/state` is local development data and is excluded from Git.
- The administrator's evidence export contains audit records. It is not a complete workspace/database/photo backup.

Before a major migration, preserve the database and relevant uploaded objects using the hosting provider's supported export/backup procedure. Keep backups and evidence exports in access-controlled storage outside the public repository. A source rollback does not undo database migrations or recover deleted runtime records.

## 7. Where settings live

| Setting | Location |
| --- | --- |
| Public company, team, contact arrays, legal fields, origin, hero image | `lib/company-profile.json`; see [COMPANY_CONTENT.md](COMPANY_CONTENT.md) |
| Validated public configuration | `lib/site-config.ts` |
| English and Arabic service/industry copy | `lib/marketing-content.js` |
| Public styles, composition and logo | `app/globals.css`, `components/marketing.tsx`, `components/brand.tsx` |
| Private employee profile details/photo | **My profile** in the running workspace |
| Members, access roles, columns, fields and rules | **Admin settings** in the running workspace |
| Initial local administrator | Ignored `.dev.vars`, copied from `.env.example` |
| Initial hosted administrator | Hosted `ADMIN_EMAILS` runtime setting, before first setup |
| Access checks and server mutations | `lib/workspace-server.ts` |
| Protected profile photo route | `app/api/profile-photo/route.ts` |
| News feeds / parser | `NEWS_FEEDS` in `lib/news-source.ts` |
| News cache / saved fallback | `app/api/news/route.ts`, `lib/news-snapshot.json` |
| Employee knowledge content | `lib/knowledge-resources.json` |
| Search metadata and crawl rules | `app/layout.tsx`, `app/robots.txt/route.ts`, `app/sitemap.xml/route.ts` |

There is no local NorthWallEg password store. `ADMIN_EMAILS` controls initial setup only; it does not rewrite the saved member list. The public team list does not create a login. See [BACKEND.md](BACKEND.md) before changing the authentication integration.

## 8. Original website and rollback

The original website and its history belong in **23samjessen/NorthWall**. They are intentionally separate from this new app. Use that repository for original-site maintenance; use **NorthWall_EG** for the approved redesign.

For a current-app rollback, choose a known compatible source commit or saved hosting version and assess database compatibility before deployment. Do not copy the original static website over this application to simulate a backend rollback.

## 9. Launch remains separate

The current site remains private and `noindex` until company registration and the owner's launch instruction. Buying or attaching a Hostinger domain does not itself change that access policy. See [HOSTINGER_AND_DOMAIN.md](HOSTINGER_AND_DOMAIN.md) for the supported domain connection and launch sequence, and [MAINTENANCE_MANUAL.md](../MAINTENANCE_MANUAL.md) for everyday maintenance.
