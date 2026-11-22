# NorthWallEg — website and employee workspace

This is the approved NorthWallEg website and employee-workspace source for **23samjessen/NorthWall_EG**. The public presentation combines Nordic visual clarity with Egyptian architectural imagery. The employee workspace uses server-side identity, membership checks, persistent records and an administrator audit trail.

**Hosted app:** https://northwalleg-design-demo.dark-hawk-6582.chatgpt.site/

**GitHub source:** https://github.com/23samjessen/NorthWall_EG

The full application lives in this repository's root. This clean repository contains the current app and its verification workflow; it has no legacy website subtree or GitHub Pages publication workflow. The original website is maintained separately in **23samjessen/NorthWall**. The new app runs on Worker/D1 hosting at the link above.

**The hosted site remains private for review. Publish it only after company registration and the owner's launch instruction.** A public source repository does not open the private site or its employee data.

Pushing to GitHub saves source changes. It does **not** automatically update the hosted app, and edits are not automatically synchronised in both directions. See [docs/GITHUB_AND_DEPLOYMENT.md](docs/GITHUB_AND_DEPLOYMENT.md) for the exact distinction and Git commands.

## Start here

| What you need | Read this |
|---|---|
| Everyday maintenance, company details, people, photos, users and launch | [MAINTENANCE_MANUAL.md](MAINTENANCE_MANUAL.md) |
| Exact public company JSON fields and examples | [docs/COMPANY_CONTENT.md](docs/COMPANY_CONTENT.md) |
| Clone, update and push this repository; understand deployment | [docs/GITHUB_AND_DEPLOYMENT.md](docs/GITHUB_AND_DEPLOYMENT.md) |
| Hostinger domain, hosting choices and future launch checklist | [docs/HOSTINGER_AND_DOMAIN.md](docs/HOSTINGER_AND_DOMAIN.md) |
| Eight-step review of the design and functions | [docs/REVIEW_GUIDE.md](docs/REVIEW_GUIDE.md) |
| Commands, users, colours, images, fields and code locations | [docs/CUSTOMISATION.md](docs/CUSTOMISATION.md) |
| Employee workspace guide | [docs/WORKSPACE.md](docs/WORKSPACE.md) |
| Identity, permissions, database, audit and API details | [docs/BACKEND.md](docs/BACKEND.md) |
| SEO decisions and public-launch configuration | [docs/SEO.md](docs/SEO.md) |
| Image and logo sources | [docs/ASSETS.md](docs/ASSETS.md) |
| Verification performed | [docs/VERIFICATION.md](docs/VERIFICATION.md) |

## What to review

### Public presentation

- New NorthWallEg name, editable NW vector monogram and architectural Egyptian hero.
- Three selectable colour directions: **Limestone**, **Midnight**, **Nile**.
- English and Arabic pages, including nine detailed service pages in both languages.
- Featured **Microsoft 365 & Cloud** and **Cyber Defence** panels, with the remaining seven services in an expandable **More services** icon grid and existing detail/options views.
- Searchable services, three industry views, a project brief builder, FAQ and contact details.
- Public team cards for Pernille Jessen (**CEO; IoT Engineer**) and Sam Jessen (**Network & Cybersecurity Engineer**), with one replaceable monogram image per person.
- Configurable additional phones, emails, locations, hours, links and content cards. Unprovided registration fields remain empty and hidden.
- English IT and cybersecurity publisher headlines, original publication dates and explicit retrieval status.
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

There is no shared NorthWallEg demo password. The hosted site uses the owner's approved sign-in identity; the backend then checks active employee membership. Initial administrator setup is controlled by `ADMIN_EMAILS`. After setup, add or edit colleagues in **Admin settings → Team**.

The earlier browser-only prototype's sample username/password does not apply. Change the real sign-in password in the identity provider's own account settings. This repository contains no passwords, password hashes or production API keys.

Adding a member does not send email and does not change the private site's audience. Both site access and employee membership must be granted before a colleague can enter.

Public team cards do not create employee accounts. No sign-in email has been supplied for Pernille, so her public profile is not an invitation or an administrator account. Each employee edits their own profile; administrators manage access separately.

## Quick commands

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
| News API, runtime cache and fallback status | `app/api/news/route.ts` |
| Saved headline fallback / refresh command | `lib/news-snapshot.json`, `npm run news:refresh` |
| Page titles, social metadata | `app/layout.tsx`, `app/[locale]/services/[id]/page.tsx` |
| Repository verification workflow | `.github/workflows/check.yml` |

Employee records, direct messages, notes and audit history are stored in the hosted D1 database. Employee photo bytes use protected R2 object storage through the `BUCKET` binding; member records retain photo metadata. Neither belongs in Git. A source ZIP or GitHub checkout is not a database or uploaded-photo backup. Local `.dev.vars`, `.wrangler/`, dependency folders and generated builds are excluded from normal source commits.

## Review boundaries

This is a working **single-company review demo**, not a multi-customer production SOC platform. All active employees share the team's tickets. Personal notes and direct messages have narrower visibility. Changes persist on the server; local storage is used only for presentation preferences.

The audit chain detects changes relative to a trusted exported head; it is not immutable or certified forensic storage. Database administrators remain a separate trust boundary. Chat polling and in-app alerts work while the app is open; this build does not deliver push notifications, email invitations, SMS or external messaging.

ISO entries are summaries and official catalogue links. Licensed standards are not copied into the repository. The Microsoft 365 handbook is original operational guidance linked to official documentation; tenant privileges, licensing and approved change procedures still apply.

The hosted review site remains private and intentionally `noindex`. The design has been approved; company registration, the final domain and a launch instruction are still required before opening the marketing website. Keep employee access protected after launch. SEO foundations cannot guarantee a first-place Google ranking.

A different hosting provider requires a verified authentication integration. The current backend trusts only identity headers inserted by the supported hosting gateway. See `docs/BACKEND.md` before moving the app to another server.
