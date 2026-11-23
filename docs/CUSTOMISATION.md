# NorthWallEg — setup, users and customisation

This guide is for Sam and the person maintaining the NorthWallEg review demo. It explains which settings an administrator can change in the workspace and which changes require editing the source.

The current app belongs in `23samjessen/NorthWall_EG` and has its own site, database and object storage. The original website is maintained separately in `23samjessen/NorthWall`. Start with [MAINTENANCE_MANUAL.md](../MAINTENANCE_MANUAL.md) for everyday changes, [COMPANY_CONTENT.md](COMPANY_CONTENT.md) for the exact public JSON fields, and [REVIEW_GUIDE.md](REVIEW_GUIDE.md) for the design review.

## 1. Run the project on your computer

Open the project folder in VS Code, then open its integrated terminal. The commands below run from the folder containing `package.json`.

Requirements: Node.js **22.13.0 or later**, npm and enough disk space for the dependencies and build output. The project uses React, Vinext and a Cloudflare Worker with D1 storage.

### Install the supplied versions

```sh
node --version
npm --version
cp .env.example .dev.vars
npm ci
```

Copy `.env.example` only for a fresh local checkout; review an existing `.dev.vars` before replacing it. The example contains the local development bootstrap email and no production credentials. `npm ci` installs from the included `package-lock.json`. Use the following command when intentionally adding or changing a dependency; it also updates the lockfile:

```sh
npm install
```

Do not run two installers at once. Keep `package.json` and `package-lock.json` together when sharing the source.

### Build and initialise the local database

```sh
npm run build
```

The build generates `dist/server/wrangler.json`. On a new local checkout, apply the initial migration once:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_clean_silk_fever.sql
```

This command creates the **local** `workspace` and `audit_events` tables. It does not change the hosted database. Do not replay the initial migration on a database where its tables already exist.

### Start development

```sh
npm run dev
```

Use the URL printed in the terminal. A clean portable checkout normally starts at `http://localhost:5173`. Keep the development server on your own computer's loopback interface.

To choose another local port:

```sh
npm run dev -- --port 5174
```

Use **Ctrl+C** in that terminal to stop the server.

### Check the built application locally

```sh
npm run build
npm start
```

Use the URL printed by Wrangler. The built preview uses the same local `.wrangler/state` storage. It does not publish the site and does not provide the portable development sign-in simulator.

## 2. Where are the username and password?

**This version does not have a NorthWallEg username/password database or a shared administrator password.** Hosted sign-in is supplied by the hosting platform. The backend receives the verified account identity and checks whether that identity is an active workspace member.

The sample credentials in the earlier static `NorthWall_Approval_Demo` package are obsolete for this version. They do not log in to the new workspace. Sample names such as Nora, Omar and Maya are fictional assignment/demo records; they are not working accounts.

| Task | Correct place |
| --- | --- |
| Change the password used to sign in | The identity provider's account settings; no password is stored in this repository |
| Change the initial administrator allowlist | Server runtime variable `ADMIN_EMAILS` |
| Add a real colleague after initial setup | **Admin settings → Team** |
| Change a member's role, display name, title or active status | **Admin settings → Team** |
| Change authentication or membership implementation | `lib/workspace-server.ts` and `app/chatgpt-auth.ts` |
| Inspect member and role types | `lib/workspace-types.ts` |

### Initial administrator

`bootstrapAllowed()` in `lib/workspace-server.ts` reads a comma-separated `ADMIN_EMAILS` runtime value. The review build defaults to Sam's owner account if that value is absent. Set the explicit runtime variable when changing ownership or preparing a separate installation.

The first authorised administrator opens the workspace and initialises its sample dataset. Initialisation is allowed once; it does not overwrite an existing workspace. After initialisation, the database's member records control access. Changing `ADMIN_EMAILS` later does **not** automatically promote a new user inside an existing workspace.

Keep runtime configuration out of browser bundles. A production runtime setting is separate from a local `.dev.vars` file, and hosted configuration changes need to be applied through the site's deployment workflow.

### Local sign-in for development

A clean portable checkout includes a loopback-only development sign-in simulator. For a new local database, create `.dev.vars` in the project root with:

```dotenv
ADMIN_EMAILS="seedy@sites.test"
```

Start `npm run dev` and use the sign-in link in the workspace. The simulator uses the local identity `local_seedy`, email `seedy@sites.test`, and display name `Seedy`. This is a local development identity with no password. It is disabled in the managed preview environment and is absent from production builds.

If the local database was already initialised under a different identity, adding this email to `ADMIN_EMAILS` does not change that database's members. Use an existing administrator or a separate disposable development database instead of deleting a database that contains work you need.

### Add a real colleague

1. Sign in as an administrator.
2. Open **Admin settings → Team**.
3. Enter the colleague's real sign-in email, name, job title and appropriate role.
4. Save the member record.
5. Ensure the colleague also has permission to open the hosted review site. Site audience permissions and employee membership are two separate checks.
6. The colleague signs in with that same account. On the first successful workspace write, the server associates the approved member record with the platform's stable user ID. Until then, the member list shows **Pending account link**.

Adding a member **does not send an invitation email**. It creates the access record. The review site remains owner-private until its owner explicitly changes its audience. Do not interpret an entry in the member list as proof that a colleague can open the site.

The backend prevents an administrator from suspending or demoting their own account and protects the last active administrator. Another active administrator must change an administrator's own access.

### Public people and private employee profiles

The compact public people cards under **Contact** are configured in `lib/company-profile.json`. Pernille Jessen's first title is **CEO**, with **IoT Engineer** in the details. Sam Jessen's first title is **Country Manager — Egypt**, with **Network & Cybersecurity Engineer** in the details. Their images are labelled monogram placeholders until photographs are supplied. Optional personal contact fields stay blank until approved. This content does not create logins or grant roles. Pernille has no supplied sign-in email in this configuration.

An employee opens **My profile** to update their display name, job title, department, work phone, location and biography. Display name and job title are required when saving profile details. A complete profile has a job title and one photograph. The demo shows completion reminders while allowing employees to continue working.

Choose **Choose photograph** or **Choose replacement**, then **Save photograph**. The upload accepts JPEG, PNG or WebP up to 2 MiB (the UI labels this 2 MB). Save changed text details before changing the photo. **Remove photograph** returns the avatar to initials after confirmation. The server checks the image type and structure; SVGs and remote image URLs are not accepted for employee uploads.

Administrators see title, avatar and completion status in **Admin settings → Team** and can open **Manage profile**. An employee can edit only their own profile; administrators can manage other employee profiles. A job title is descriptive text and does not change the access role.

Employee photo bytes live in private R2 storage through `BUCKET`; D1 retains metadata. The protected `/api/profile-photo` route requires workspace membership. These are team-visible employee profiles, separate from public team photographs under `public/assets/team/`. See [WORKSPACE.md](WORKSPACE.md) for the user steps.

## 3. Roles and visibility

This demo is one shared internal team workspace. It does not implement separate customer tenants or confidential ticket queues.

| Capability | Employee | Manager | Administrator |
| --- | --- | --- | --- |
| Read and work on shared team tickets | Yes | Yes | Yes |
| Assign tickets and change their workflow status | Yes | Yes | Yes |
| Write comments, replies and reactions | Yes | Yes | Yes |
| Use team channels and their own direct conversations | Yes | Yes | Yes |
| Create notes and calendar entries | Yes | Yes | Yes |
| Read another person's private note | No | No | No through the workspace API |
| Send an alert to selected members | No | Yes | Yes |
| Create team channels | No | Yes | Yes |
| Manage members, columns, fields, rules and workspace settings | No | No | Yes |
| Read or export the audit trail | No | No | Yes |

Team notes are readable by the team. Private notes are returned only to their owner. Direct-message records are returned only to their sender and recipient. Database operators remain a separate trust boundary because they can access the underlying storage.

The server enforces these checks. Hiding a navigation button is not the access-control mechanism. Review the checks in `applyAction()`, `visibleState()`, `memberFor()` and `readAudit()` before changing permissions.

## 4. Source map: where to change each part

| What you want to change | File or folder | What belongs there |
| --- | --- | --- |
| Public company, phones, emails, locations, team, registration and hero settings | `lib/company-profile.json` | Public content and enabled/disabled templates |
| Public content validation and derived configuration | `lib/site-config.ts` | Filters populated records and validates links/images |
| NW monogram and public wordmark | `components/brand.tsx` | `NWMark` SVG and `Brand` component |
| Browser tab icon | `public/favicon.svg` | Favicon artwork |
| Reusable monogram asset | `public/assets/nw-monogram.svg` | Standalone logo asset |
| Public page composition and interactions | `components/marketing.tsx` | Navigation, hero, sections and public interaction flow |
| Featured service selection, summary chips and More services layout | `components/marketing.tsx` | `featuredServiceIds`, `featuredServiceOptions` and remaining service icon grid |
| English and Arabic service/industry content | `lib/marketing-content.js` | `copy`, `services` and `industries` data |
| Public styles, spacing and design colours | `app/globals.css` | Global and public-design CSS |
| Employee workspace layout and controls | `components/workspace.tsx` | Dashboard, board, ticket details, chat, calendar and admin UI |
| Employee profile form, photo controls and directory | `components/employee-profile.tsx` | Private profile presentation and interaction |
| Protected employee photo read/upload/remove | `app/api/profile-photo/route.ts` | Membership-checked object-storage endpoint |
| Employee workspace colours and responsive styles | `app/workspace/workspace.css` | Styles scoped to `.nw-workspace` |
| Root, English and Arabic homepage routes | `app/page.tsx`, `app/en/page.tsx`, `app/ar/page.tsx` | Pages that render the marketing component |
| English/Arabic individual service routes | `app/[locale]/services/[id]/page.tsx` | Service details, canonical links and language alternates |
| Robots and sitemap output | `app/robots.txt/route.ts`, `app/sitemap.xml/route.ts` | Review crawl blocking and public-route sitemap |
| Workspace page and its no-index metadata | `app/workspace/page.tsx` | Protected-workspace entry surface |
| Default titles, descriptions and share-card metadata | `app/layout.tsx` | Search and social metadata |
| Server workspace API | `app/api/workspace/route.ts` | Read, mutation and audit-export HTTP entry points |
| Validation, access checks, actions and audit storage | `lib/workspace-server.ts` | Authoritative backend behaviour |
| Record fields, role names and action names | `lib/workspace-types.ts` | TypeScript data contracts |
| Initial sample columns, people, tickets and rules | `lib/workspace-seed.ts` | New-workspace demo seed only |
| ISO links, useful resources and Microsoft 365 runbooks | `lib/knowledge-resources.json` | Protected resource-library content |
| News publishers and RSS parser | `lib/news-source.ts` | `NEWS_FEEDS` allowlist, article host and language checks |
| News retrieval, cache and saved fallback | `lib/news-service.ts`, `app/api/news/route.ts` | Shared server loader and API freshness behaviour |
| News filters and public insight pages | `components/news-explorer.tsx`, `app/insights/` | Search, publisher/topic controls, server-rendered hub and guide routes |
| Original public security guidance | `lib/insights-content.ts` | Guide text, review dates, sources and related services |
| Capability and social icons | `lib/company-profile.json`, `components/public-icons.tsx` | Public options, platform slots and approved account URLs |
| Database table definitions | `db/schema.ts` | Drizzle schema |
| Database changes | `drizzle/` | Ordered SQL migrations |
| Local/start/build commands | `package.json` and `scripts/` | Runtime entry points |
| Site identity and storage bindings | `.openai/hosting.json` | Preserve the existing `project_id` when updating this demo |

Generated files in `dist/` are replaced by the next build. Edit the source files above, then rebuild.

## 5. Colours, logo, images and wording

### Colours

The public demo offers **Limestone**, **Midnight** and **Nile** in **Explore the look**. The selection changes your browser's review preference; it does not change the site's database or choose a final design for everyone.

Change the public palette in `app/globals.css`: `.nw-marketing` defines `--ink`, `--muted`, `--paper`, `--soft`, `--line`, `--clay`, `--clay-dark` and `--accent`; `.theme-midnight` and `.theme-nile` override them. The initial theme and selector live in `components/marketing.tsx`. Clear the browser's `nw-design-theme` preference when checking a changed default.

Change the employee workspace's colour tokens near the beginning of `app/workspace/workspace.css`:

```css
.nw-workspace {
  --nw-ink: #132c33;
  --nw-muted: #667a7e;
  --nw-accent: #bb593d;
  --nw-accent-light: #f7ece7;
  --nw-line: #e0e6e5;
  --nw-paper: #ffffff;
  --nw-bg: #f3f5f4;
  --nw-green: #25816b;
}
```

These tokens control the main ink, secondary text, accent, borders, cards, background and success colour. Some illustrations, note colours and status styles use explicit colour values elsewhere in the same stylesheet. Use VS Code's search to find the value when adjusting those details. Check text contrast, focus indicators and mobile views after a palette change.

### Images

Image files live under `public/assets/`. Their browser URLs start with `/assets/`, not `/public/assets/`.

The hero path is `public/assets/egypt-hero.webp`, configured by `website.heroImage` in `lib/company-profile.json` and exposed as `siteConfig.heroImage`. The Nile-theme image is selected separately in `components/marketing.tsx`. Other service images include `cyber-defense.webp`, `network.webp`, `collaboration.webp`, `employee-app.webp`, `team-workspace.webp`, `website-design.webp`, `school-healthcare.webp` and `egypt-office.webp`.

Replace an asset under the same filename to preserve its references, or add a new optimised image and update the relevant component/configuration. Update its alternative text and any Open Graph dimensions when the image changes. Do not insert staff photographs, customer logos or testimonials without verified source material and permission.

### Company details and services

Edit public company content in **`lib/company-profile.json`**. `lib/site-config.ts` derives validated values from that JSON; it is not the normal place to change phone numbers or team members. The central file contains legal/registration fields, repeatable phone/email/social/hour/location entries, team cards, optional content and extra links. Empty legal fields and disabled entries stay hidden. Follow [COMPANY_CONTENT.md](COMPANY_CONTENT.md) for exact examples.

Each public person has one `image` and separate English/Arabic title arrays. Replace the two current monogram assets with supplied photographs, update image paths and alternative text, and set `imageIsPlaceholder` to `false`. Add people by copying the disabled team template with a unique ID, name, title and valid image. This remains public presentation content; employee membership is managed in the workspace.

Review `components/brand.tsx` and `lib/marketing-content.js` for intentionally written brand wording as well. Additional cards/links can be configured through `additionalContent` and `additionalLinks` without adding a new route.

For a new service, add one object to the `services` array in `lib/marketing-content.js`, following a neighbouring entry. Use a stable unique `id` and provide both Arabic and English content for `name`, `tag`, `description`, `items`, `result` and `scope`. Check `iconMap`, `visuals`, `groups` and any curated service shortlist in the public component. The `/en/services/<id>` and `/ar/services/<id>` pages and sitemap entries are generated from the services array.

The homepage features **Microsoft 365 & Cloud** and **Cyber Defence**. In `components/marketing.tsx`, `featuredServiceIds` contains the ordered IDs `microsoft-365` and `cyber-defense`, while `featuredServiceOptions` holds the short English/Arabic summary chips. Edit those constants and the presentation labels to change the primary panels. Full modal/detail-page options come from localized service `items` in `lib/marketing-content.js`; keep the summaries aligned with that catalogue scope.

The other seven services appear under **More services** as compact icon buttons, shown by default with **Hide services** / **Show services** controls. Each opens the existing modal with **Full service page** and **Discuss this service** actions. Search and category changes reopen matching secondary services. Keep IDs stable so existing detail-page links continue to work.

For a new industry, follow the `industries` array's `id`, `name`, `intro`, `needs` and `pilot` structure. Add real, supportable claims; sample customers and sample operational records do not belong in marketing evidence.

### Contact and project brief

The **Let’s talk** flow in `components/marketing.tsx` collects selected services, team size and location. **Download brief** creates a local text file. **Save demo enquiry** requires an authorised, initialised workspace and creates a ticket through the existing workspace API; it does not send an email. Use fictional enquiry details during design review.

To introduce a public enquiry intake later, design its server-side delivery, validation and abuse controls explicitly. Removing the membership check from the private workspace API is not the way to make the form public.

## 6. Change the workflow without editing code

An administrator can change columns and fields in **Admin settings → Workflow**, automation rules in **Automations**, and the workspace name/time zone in **Settings**. These settings are persisted in the database. Editing `lib/workspace-seed.ts` affects a newly initialised workspace; it does not overwrite existing saved settings.

### Columns

Open **Admin settings → Workflow**. Create or rename a column, choose its colour and decide whether it counts as a completed state. The `isDone` flag controls whether its tickets count as resolved/completed in dashboard totals; the column's written name alone does not decide this.

The default workflow is New, In progress, Waiting and Resolved. A column cannot be deleted while a ticket or automation rule references it. Move the affected tickets and update the rules first. Use the reorder controls to change column order. The backend requires every column ID exactly once for a reorder operation.

### Custom ticket fields

Use the custom-fields panel in **Admin settings → Workflow**. Supported field types are **text, number, date, select and checkbox**. Supply an option list for a select field and choose whether the field is required. Example fields include Customer reference, Change approval, Site code and Contract renewal date.

Use stable field IDs. A field type already used on tickets cannot simply be changed into another type; create a new field and migrate the values deliberately. Deleting a field removes its saved values from tickets, so review the impact before doing it.

### Rules

Open **Admin settings → Automations**. Rules run on a **ticket-created** or **ticket-updated** action. A rule can match any priority or one selected priority, then assign a member, move the ticket to a column and send selected members an in-app notification.

Example: when a critical ticket is created, assign the duty owner and notify the administrator. Test with a clearly labelled sample ticket. Multiple matching rules execute in stored order, so avoid conflicting rules that overwrite the same assignment or status.

These are event-triggered rules. They do not run on a background timer, send external email, invoke Microsoft services, execute arbitrary code or implement an SLA escalation scheduler.

### Add an entirely new feature

1. Define the data and permitted actions in `lib/workspace-types.ts`.
2. Implement server validation and role/object checks in `lib/workspace-server.ts`.
3. Add the controls and failure states in `components/workspace.tsx`.
4. Add scoped styles in `app/workspace/workspace.css`.
5. Record its action in the audit flow and update these guides.
6. If database tables change, create a migration and verify the feature with the relevant roles before publishing.

Administrator customisation covers the supported settings above. Adding a new integration or an entirely new module still requires code and validation.

## 7. News configuration and freshness

The public news endpoint is **`GET /api/news`**. The `NEWS_FEEDS` array in `lib/news-source.ts` contains:

- Microsoft Security Blog: cybersecurity.
- The Official Microsoft Blog: general technology.
- Cloudflare Blog: technology and security.
- Cisco Talos: threat research and security updates.
- Splunk Security Advisories: product security bulletins, including SOAR when published.
- Palo Alto Networks SOAR: dedicated orchestration and automation articles.
- Unit 42: threat research and attack campaigns.
- CERT-EU: security advisories and important vulnerability alerts.

The server fetches these publishers' English RSS feeds and checks available feed/entry language metadata. No third-party news API key is required. Each source has an explicit URL and allowed host list. Adding a feed means editing this array, checking its language and licence/usage terms, and verifying both the feed and article hosts. The `/insights` hub and public/workspace news dialogs use the shared text, publisher and topic filters in `components/news-explorer.tsx`. See [NEWS.md](NEWS.md) for the exact source and cache contract.

The current implementation fetches on request and caches successful results in a Worker instance for **10 minutes**. If every source is unavailable, that attempt is cached for **one minute**; a new upstream attempt becomes eligible on the next request after that window. Both website and workspace request news every **two minutes** while open. HTTP responses permit **120 seconds** of browser caching for live/partial results and **60 seconds** for cached/unavailable results. These caches are not a scheduled collector or durable news archive.

`publishedAt` is the publisher's article date. `checkedAt` records the retrieval attempt, while `fetchedAt` records a successful retrieval. If every feed fails, the API can return a recent successful runtime result or the verified saved snapshot with `status: cached`, preserving its original `fetchedAt` and identifying it as cached. When there are no usable saved items, it returns `status: unavailable` and `fetchedAt: null`. Other results are `live` or `partial`. Missing article dates remain missing. A source outage must not be disguised by invented headlines, a fabricated publication date or a new successful-retrieval timestamp.

The endpoint returns short text headlines and source links, not copies of whole articles. CISA's feed was excluded from the enabled set after it returned HTTP 403 during verification.

## 8. Employee knowledge library

Edit `lib/knowledge-resources.json`. It contains:

- `resources`: 32 official-link entries with title, category, publisher, summary, tags and access notes.
- `runbooks`: 12 original Microsoft 365 operational checklists with steps, evidence and escalation criteria.
- `newsFeeds` and implementation notes: research/configuration reference material. The running news endpoint is controlled by `NEWS_FEEDS` in `lib/news-source.ts`.

The library is returned through the authenticated workspace API. Its current official links and original checklists are also included in the public source repository. Page protection does not make a tracked JSON file confidential. Keep future confidential procedures in separately protected backend storage rather than committing them to this JSON or moving them into `public/`.

The ISO entries contain official catalogue links and original summaries. Full ISO standards require the appropriate licence. The handbook is a working checklist with sources, not a replacement for Microsoft documentation or an assertion that a customer's licence includes every feature.

To add a runbook, copy a neighbouring entry and fill `title`, `product`, `summary`, `steps`, `evidence`, `escalateWhen`, `sourceUrls` and `verifiedOn`. Keep operational facts tied to an official source and update the review date after checking them.

## 9. Audit trail and investigation evidence

Open **Evidence log** to inspect the administrator audit view. Its API routes are:

```text
GET /api/workspace?view=audit
GET /api/workspace?view=audit&format=json
```

The second route downloads `NorthWallEg-audit-evidence.json` for an authenticated administrator. The backend records a server-generated UTC timestamp, actor ID and name, action, target object, request ID, change details, sequence number, previous hash and current hash.

Audit changes are stored with the workspace mutation. Optimistic revision checks reject a stale update with a conflict response so that concurrent edits are not silently overwritten. Reload the latest state, review the other change and retry your intended edit.

The JSON export reports the chain-check result, total events, head hash and export time. Retain exports and their head hashes in separately controlled evidence storage when an investigation requires independent preservation. A database administrator could rewrite both the records and hashes; the hash chain alone is not immutable storage, a digital signature or proof of who was physically at a keyboard.

Note titles and content are not written to the audit payload; their hashes, lengths, owner and visibility are recorded instead. Private-message audit entries retain metadata and content hash/length instead of message text. Shared ticket comments and team-channel changes may include their text. Do not put passwords, access tokens or other secrets into messages or tickets.

The audit view covers accepted workspace changes. Platform login events, denied access, infrastructure events and external Microsoft tenant activity require their respective platform/security logs. The application is not a complete SIEM or a forensic acquisition tool.

## 10. Database changes and capacity

After intentionally changing `db/schema.ts`, generate a migration:

```sh
npm run db:generate
```

Review the generated SQL. Rebuild when bindings change, then apply each new pending migration locally with the command in section 1, replacing the filename. Do not modify an already-applied migration to represent a new schema change. Hosted migration application belongs to the deployment workflow, not the `--local` command.

The demo currently keeps workspace records in one versioned JSON payload, with audit events in a separate table. It is intentionally bounded: up to 100 members, 12 columns, 30 custom fields, 30 rules, 1,000 tickets, 5,000 comments, 5,000 messages, 500 notes, 1,000 calendar events and 30 channels, plus a 1.5 MB workspace-payload limit. The payload limit can be reached before an individual count limit. Archived tickets still count. The notification list retains its most recent 2,000 records. Audit export is bounded to 10,000 events.

Employee photo bytes are outside that JSON payload in the configured R2 bucket. Back up both the database and associated uploaded objects before a storage migration. An evidence export or source ZIP is not a complete backup.

These are implementation limits for the review system, not a recommendation for a larger production service desk. Growing beyond them requires storage, pagination, retention and workload changes, not simply raising every constant.

## 11. SEO and approval before launch

The review site uses **no-index** metadata so that the demo does not compete with the eventual public company site. `lib/seo.ts` coordinates public metadata and response headers from `website.isReviewDemo`; the employee workspace has its own no-index metadata in `app/workspace/page.tsx`. `app/robots.txt/route.ts` currently disallows all crawling, and `app/sitemap.xml/route.ts` lists only public page routes, including `/insights` and its original guides.

Keep the site private until company registration and the owner's launch instruction. Before launch, set `website.origin` in `lib/company-profile.json` to the real canonical origin, verify company/contact details, and review the public-page index metadata and robots route together. `website.isReviewDemo` is not a substitute for hosting audience controls or DNS configuration. Keep private routes excluded. See [HOSTINGER_AND_DOMAIN.md](HOSTINGER_AND_DOMAIN.md) for the supported domain connection sequence.

Use clear service headings and useful content for Microsoft 365, cybersecurity, managed IT support, networks, cloud, employee portals and software services in Egypt. Adding many repeated keywords cannot guarantee a top Google position. Do not add invented customer counts, office addresses, qualifications, certifications or 24/7 response promises.

## 12. Practical troubleshooting

| Symptom | Check |
| --- | --- |
| Workspace asks for sign-in | Complete the site's sign-in flow; public sample credentials from the old ZIP do not apply |
| Signed in but membership is refused | Check the account email, active member record and hosted site audience |
| First setup is refused | Check `ADMIN_EMAILS` in the runtime that is actually running the code |
| Local database tables are missing | Build, then apply the initial local migration once |
| A change reports a revision conflict | Reload the workspace and retry after reviewing the latest saved version |
| News is partially available | Review `/api/news` source status; one publisher may be unavailable |
| A column cannot be deleted | Move its tickets and remove automation references |
| A field type cannot change | Create a new field when existing tickets already use the old type |
| A design edit does not appear | Edit source, rebuild and deploy the new version; do not edit generated `dist/` files |
| A member receives no email | Membership and alerts are currently in-app; outbound email is not configured |
| A public team card is missing | Check its enabled flag, nonempty name/title and valid image in `lib/company-profile.json` |
| A photo upload is refused | Use JPEG, PNG or WebP within the 2 MiB limit; reduce oversized dimensions and save pending profile text first |
| A profile save reports a conflict | Use **Reload saved details**, review the saved version and re-enter the intended change; reloading discards unsaved text |


## 13. Useful keyboard and review controls

- **Cmd/Ctrl+K** focuses workspace search.
- **Cmd/Ctrl+Enter** sends the text in a discussion composer.
- **Escape** closes workspace overlays.
- **Work board** offers Board and List views; ticket details also provide an explicit status selector for moving work without drag-and-drop.
- **Calendar** offers Month and Agenda views. Calendar inputs and event displays follow the browser's local time; audit timestamps remain UTC.
- Open workspace views poll for changes every **15 seconds**. There are no fabricated online/typing states or delivery/read receipts.

For implementation details and the current backend verification command, see [BACKEND.md](BACKEND.md).


## News resilience update

Refresh the stored publisher snapshot with `npm run news:refresh`; the script keeps the existing snapshot unless all configured feeds succeed. Feed parsing and allowlists live in `lib/news-source.ts`; snapshot data is in `lib/news-snapshot.json`. See section 7 for freshness and retry behaviour. The workspace settings time zone controls the additional header clock; calendar inputs use browser local time and audit records use UTC.
