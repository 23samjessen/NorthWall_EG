# NorthWallEg maintenance manual

Maintenance revision: **23 November 2026**.

For Sam and anyone maintaining the website or employee workspace. This manual explains the ordinary editing tasks, the files behind them, and the steps needed to release a change without losing employee data.

**Current source:** [23samjessen/NorthWall_EG](https://github.com/23samjessen/NorthWall_EG)  
**Private review site:** [NorthWallEg](https://northwalleg-design-demo.dark-hawk-6582.chatgpt.site/)

Keep the hosted site private until company registration and your instruction to launch. The public source repository, hosting audience, domain connection and employee membership are separate settings. The original website is maintained separately in `23samjessen/NorthWall`; this new repository contains the current app only.

## 1. Choose the right place to edit

| I want to… | Where to do it |
| --- | --- |
| Change public phones, emails, hours, locations or registration details | `lib/company-profile.json` |
| Change the public Pernille/Sam cards or add another public person | The `team` array in `lib/company-profile.json` |
| Replace public team photographs | `public/assets/team/`, then update the person's JSON image path |
| Add a public information card or useful company link | `additionalContent` / `additionalLinks` in the same JSON |
| Change a service or industry description | `lib/marketing-content.js` |
| Change the two featured services or their short option chips | `featuredServiceIds` and `featuredServiceOptions` in `components/marketing.tsx` |
| Change website colours, spacing or layout | `app/globals.css` and `components/marketing.tsx` |
| Change the NW mark or wordmark | `components/brand.tsx`; update related SVG assets too |
| Update my employee name, title, professional details or photo | **My profile** in the workspace |
| Invite/approve an employee, change their role or revoke access | Owner: **Admin settings → Team** |
| Add ticket stages or extra ticket fields | **Admin settings → Workflow** |
| Add assignment/movement/notification rules | **Admin settings → Automations** |
| Change the team name or reference clock timezone | **Admin settings → Settings** |
| Read who changed a workspace record and when | **Evidence log**, as an administrator |
| Change protected handbook content or employee links | `lib/knowledge-resources.json` |
| Change news sources | `NEWS_FEEDS` in `lib/news-source.ts` |
| Change technology icons and their option dialogs | `platforms` in `lib/company-profile.json` |
| Activate social account icons | `contact.socialLinks` in `lib/company-profile.json` |
| Add or update an original security guide | `lib/insights-content.ts` |
| Understand domain and hosting options | [docs/HOSTINGER_AND_DOMAIN.md](docs/HOSTINGER_AND_DOMAIN.md) |

Public source changes need a new build and deployment to appear on the hosted site. Saved workspace settings and employee profiles are runtime data; they do not require a source commit.

## 2. Public company information

### Open the central file

Open **`lib/company-profile.json`** in your editor. It contains public presentation content only. The companion `lib/site-config.ts` reads and validates that file; normally edit the JSON instead of changing its TypeScript conversion code.

JSON uses double quotes, commas between records and no comments or trailing commas. Keep each record's `id` unique. An `enabled: false` record is a prepared slot that remains hidden until you fill and enable it.

The exact field guide is [docs/COMPANY_CONTENT.md](docs/COMPANY_CONTENT.md).

### Add more phone numbers, emails or hours

The file already includes the supplied main phone and disabled blank slots for later details.

1. Find the appropriate array under `contact`.
2. Copy an existing record or fill its disabled placeholder.
3. Give a copied record a unique `id`.
4. Enter the real value and English/Arabic label.
5. Set `enabled` to `true` after the value is ready.
6. Check the rendered contact area in both languages.

| Array | Value field | Notes |
| --- | --- | --- |
| `contact.phones` | `number` | Use the actual telephone number. Keep one enabled record with `primary: true`. |
| `contact.emails` | `address` | Enter an actual public mailbox; its mail link is generated automatically. |
| `contact.socialLinks` | `url` | Supply the approved HTTPS profile and a meaningful label. |
| `contact.officeHours` | `value.en`, `value.ar` | Include the actual days, times and timezone. |
| `contact.locations` | `name`, `kind`, `address`, `mapUrl` | Use a real service area or office; optional address/map fields may remain blank. |

Empty, disabled or invalid contact values are omitted. The exception is an explicitly configured social review slot: `showInPreview: true` shows its icon with **Coming soon** while `website.isReviewDemo` is true. Adding a public email address creates a contact link; it does not configure a sending service for the enquiry form.

### Activate the social channel icons

Facebook, Instagram, TikTok, LinkedIn and YouTube have prepared slots under `contact.socialLinks`. Paste your approved account's HTTPS URL into its `url` and set `enabled: true`. Keep `platform` and `icon` equal to that platform's identifier (`facebook`, `instagram`, `tiktok`, `linkedin` or `youtube`). The URL must be on the matching platform's host and include the profile/channel path. Blank slots do not navigate anywhere. They disappear automatically when review mode is turned off.

These are ordinary profile links. They do not create accounts, place advertisements, install tracking pixels or grant advertising-account access. Use [docs/FUTURE_ROADMAP.md](docs/FUTURE_ROADMAP.md) to plan campaigns and measurement later.

### Add a location

The existing Egypt and Denmark records describe **service areas**. They do not claim a registered office or street address.

Copy `additional-location`, change its ID, fill `name.en` and `name.ar`, and set `enabled: true`. Keep `kind: "service-area"` for an area you serve. Use `kind: "office"` only for an actual office you want to identify. Fill `address` and `mapUrl` when those details are known. The company's registered legal address is a separate field.

### Add company registration details later

These `company` fields are intentionally empty:

- `legalName`
- `taxRegistrationNumber`
- `commercialRegistrationNumber`
- `vatNumber`
- `registeredAddress`

Enter the exact public details when supplied. A blank field produces no public label, and the whole company-information block stays hidden while all legal fields are empty. Do not put placeholder numbers into a field that should later be treated as real company information.

`company.displayName` is the presentation name, currently NorthWallEg. Changing it does not rewrite text intentionally drawn in the logo or written into service copy; review `components/brand.tsx` and `lib/marketing-content.js` if the brand ever changes.

## 3. Public people, titles and photographs

The initial public directory contains:

| ID | Person | Titles | Current asset |
| --- | --- | --- | --- |
| `pernille-jessen` | Pernille Jessen | CEO and IoT Engineer | `public/assets/team/pernille-jessen.svg` |
| `sam-jessen` | Sam Jessen | Country Manager — Egypt; Network & Cybersecurity Engineer | `public/assets/team/sam-jessen.svg` |

The current SVGs are labelled monogram placeholders. They are not photographs. No biography or sign-in email has been invented for Pernille.

### Replace one person's public photograph

1. Put the approved image in `public/assets/team/`, for example `pernille-jessen.webp`.
2. In that person's JSON record, change `image` to `/assets/team/pernille-jessen.webp`. The browser path omits `public`.
3. Update `imageAlt.en` and `imageAlt.ar` to describe the photograph.
4. Set `imageIsPlaceholder` to `false`.
5. Review the crop on desktop and mobile, then commit the intended image and JSON change together.

Each public profile has **one image field**. Replacing its path changes that single image. Public photographs placed here are intentionally part of the public source package; they are separate from protected employee uploads.

### Change titles or add another person

Titles use one array per language. Pernille's current English value is:

```json
"titles": {
  "en": ["CEO", "IoT Engineer"],
  "ar": ["الرئيسة التنفيذية", "مهندسة إنترنت الأشياء"]
}
```

Edit the strings or add another title to the relevant array. The compact card under **Contact** shows the first title; its contact dialog shows the primary and secondary titles. Sam's first title is **Country Manager — Egypt** and his second is **Network & Cybersecurity Engineer**. This public wording does not change his ownership or administrator role. Use `bio.en` and `bio.ar` for an optional supplied biography.

Each person's optional `contact.email` and `contact.phone` fields create validated direct contact actions when populated. Leave them blank until the person approves the details. The existing company telephone is labelled as a shared company line in the dialog. **Choose as preferred contact** selects a preferred contact in the project brief; it does not silently send a message or assign a workspace task.

To add a person, copy the disabled `additional-team-member` object, give it a unique ID, fill the name, at least one title and a valid image, then enable it. Add a real photograph or an honestly labelled monogram placeholder. Optional `links` can point to approved professional profiles.

A public card is shown only when it is enabled and has a name, title and valid image. A public team card **does not create a login, grant an administrator role or update an employee profile**. Use the workspace's membership controls separately after the person's real sign-in email is known.

## 4. Employee profiles and sign-in access

### Employees: update your profile

Open **My profile** in the workspace sidebar.

1. Enter **Display name** and **Job title**, which are required when saving details.
2. Optionally enter department, work phone, work location and **About your work**.
3. Select **Save profile**.
4. Select **Choose photograph**, inspect the chosen image preview, then select **Save photograph**.

The photo limit is **2 MiB (2,097,152 bytes)**, displayed as 2 MB in the interface. Supported employee uploads are JPEG, PNG and WebP. The server also validates image structure and dimensions; use a reasonably sized portrait, with neither side above 8,192 pixels and no more than 16 million pixels. SVGs, remote photo URLs and animated formats are not employee-upload inputs.

Use **Choose replacement** to replace the single current image. **Remove photograph** asks for confirmation and returns the avatar to initials. Save pending text details before changing the photograph.

The completion indicator counts a title and a photograph: `0/2`, `1/2` or `2/2`. The demo reminds people to finish their profiles while allowing them to continue working. Profile completion is a reminder after account approval; it does not replace or bypass the owner-controlled account approval gate. A job title is descriptive text; it never grants a role.

The optional biography has a 600-character limit. Display name/title allow 120 characters, department 80, work phone 40 and location 120. These are professional details visible within the active team workspace.

If another person saves while your form is open, a revision conflict can occur. **Reload saved details** loads the current record and discards unsaved typed text. Review it, re-enter the intended change and save again.

### Owner: invite, approve and manage employees

1. Open **Admin settings → Team → Create invitation** as the owner.
2. Enter the colleague's real sign-in email, display name and job title. The invitation starts inactive with employee permissions.
3. Copy and share the invitation instructions through your chosen channel. The current app does not deliver invitation emails or SMS. Separately grant private Site audience access when you choose to admit the person to the review Site.
4. The person signs in with the exact invited account and accepts the invitation. They can see only their own onboarding status.
5. Review **Awaiting approval** in Team and explicitly approve them. Only then can they enter the employee workspace.
6. If needed, separately grant manager or administrator access to an approved member. No invitation grants administration automatically.

Both acceptance and owner approval must occur before the seven-day expiry. Reissuing creates a new invitation, clears acceptance/approval and stops old requests from accepting the new invitation. Revocation removes access on subsequent protected requests while retaining history.

Only the owner can manage invitations and account permissions. Other approved administrators can manage workspace settings, safe profiles and audit evidence. The owner cannot be disabled or demoted through these controls. Legacy non-owner records without approval evidence need a new invitation; sample colleagues cannot become working accounts. See [USER_ACCESS.md](docs/USER_ACCESS.md).

The team view also shows profile images, titles and completion. Safe profile changes do not change account permission. A person's title is descriptive, not an administrator role.

### Passwords and account identity

The private review Site continues to use its hosting provider for passwords and recovery. The separate Hostinger variant stores salted scrypt password verifiers in MySQL and uses email-code verification. Provision the owner through `npm run hostinger:setup` using its hidden terminal prompt; a temporary password expires after 24 hours and must be replaced after email verification. A signed-in Hostinger user can open `/sign-in` to change a password. Explicit owner recovery uses `npm run hostinger:setup -- --recover-owner` and revokes sessions. Do not edit hashes by hand or put passwords in source. No actual owner credential has been configured remotely.

`ADMIN_EMAILS` is a server runtime allowlist for **initial setup of an empty workspace**. It does not promote people in an existing workspace. The local example uses `seedy@sites.test` for the loopback-only development simulator; production uses verified hosting identity. Earlier static-prototype credentials do not apply.

The profile form cannot change a member's sign-in email, identity binding or access role. A change of sign-in account needs a deliberate owner-controlled invitation/enrollment process, preserving historical work and the owner's access. Do not change identity by editing browser data.

### Where private photos are stored

Private employee image bytes are in the R2 object-storage binding **`BUCKET`**. D1 retains associated metadata. The `/api/profile-photo` route checks active membership before returning an image; uploads/removals also require ownership or administrator permission.

These uploaded photos are not in Git and are not automatically copied into the public team directory. Keep their backup and retention separate from public marketing assets. See [docs/BACKEND.md](docs/BACKEND.md) for the storage and identity implementation.

## 5. Configure the workspace without code

### Columns and ticket counts

Use **Admin settings → Workflow → Board columns** to add, rename, colour or reorder stages. Mark completed stages using **Counts as completed**. Dashboard open/resolved totals follow that flag, not the written column name.

Move tickets and remove rule references before deleting a column. Archived tickets still exist and count toward storage limits. Use the ticket status selector when drag-and-drop is inconvenient.

### Extra ticket fields

Under **Workflow → Custom ticket fields**, choose text, number, date, select or checkbox. Supply select options one per line and mark a field required only when existing and future tickets can provide it.

Useful examples are asset ID, customer reference, site code, change approval or contract-renewal date. If saved tickets already use a field type, introduce a new field instead of converting their historical values silently. Deleting a field removes its ticket values; review its use first.

### Assignment and notification rules

Use **Admin settings → Automations → New rule**. Choose ticket creation or ticket update, optionally match a priority, then assign a member, move the ticket and/or notify selected people. Review the result with a clearly labelled sample ticket.

Rules run when a ticket is saved. They do not run scheduled background escalation, execute arbitrary code or send email/SMS/push notifications. Internal alerts appear in the workspace. Managers and administrators can also use **Send a team alert** in the notification centre.

### Add a new module or integration

The administrator controls the supported fields and rules; a new module still needs code. Define its data/actions in `lib/workspace-types.ts`, implement server validation and permissions in `lib/workspace-server.ts`, add the interface in `components/workspace.tsx` or a dedicated component, and add scoped workspace styles. Preserve audit recording and private-data filtering. Add a schema migration only if the database structure changes.

Verify the new behavior with the roles and data it affects. An administrator-only button needs an administrator check on the server too. [docs/WORKSPACE.md](docs/WORKSPACE.md) describes the existing tickets, discussion, calendar, notes and chat controls.

## 6. Add public content and tune the design

### More information and links

Use `additionalContent` for an extra company information card. Supply a unique ID, enabled flag, nonempty localized title and body. Image and destination link are optional. Use `additionalLinks` for a supplementary public footer link. Links need a label and valid HTTPS address, same-site path or existing section anchor.

Use `lib/marketing-content.js` for a new service or industry. Copy the existing record shape, keep a stable service ID and provide both English/Arabic text. Service detail routes and sitemap entries are driven by that data. Check the public component's icon map, visuals and curated service groups when introducing a new service.

### Featured services and More services

The two primary panels are **Microsoft 365 & Cloud** and **Cyber Defence**. The `featuredServiceIds` constant in `components/marketing.tsx` contains their ordered IDs: `microsoft-365` and `cyber-defense`. Change that selection and its presentation labels there if you later want different primary services. The remaining seven catalogue entries appear in the **More services** icon grid, shown by default with **Hide services** / **Show services** controls.

Edit `featuredServiceOptions` in `components/marketing.tsx` to change the short English/Arabic summary chips on a primary panel. The full options shown in the service modal and detailed service pages remain in each service's localized `items` in `lib/marketing-content.js`. Keep those two descriptions consistent when the service scope changes.

Each secondary icon opens the existing modal with **Full service page** and **Discuss this service** controls. Featured title links still open the detailed service routes. Keep service IDs stable to preserve those URLs. Search and category filters apply across both groups and reopen matching secondary results when changed.

The separate **Platforms & capabilities** row is configured in `lib/company-profile.json` under `platforms`. Each entry has a unique `id`, `enabled`, an allowed `icon`, localised `label`/`summary`, localised `options` arrays, and an existing `serviceId`. Change the text and option bullets there; add a supported icon in `components/public-icons.tsx` and its validation in `lib/site-config.ts` only if a new icon is needed. Product references describe possible project scope and do not claim vendor partnership or certification.

The project-brief builder downloads a text brief. Saving a demo enquiry requires an authorised workspace and creates a ticket. It does not send email. A future public submission pipeline needs its own validated backend/delivery integration.

### Colours, logo and images

| Area | Edit |
| --- | --- |
| Public colour tokens | `.nw-marketing` in `app/globals.css`: `--ink`, `--muted`, `--paper`, `--soft`, `--line`, `--clay`, `--clay-dark`, `--accent` |
| Alternative review themes | `.theme-midnight` and `.theme-nile` in `app/globals.css` |
| Workspace colours | `.nw-workspace` tokens in `app/workspace/workspace.css` |
| NW vector/wordmark | `components/brand.tsx` |
| Browser and standalone marks | `public/favicon.svg`, `public/assets/nw-monogram.svg` |
| Standard hero | `website.heroImage` in the company JSON; current file `public/assets/egypt-hero.webp` |
| Public team images | `public/assets/team/` and each person's JSON image field |
| Other Egyptian/service imagery and layout | `components/marketing.tsx`, `public/assets/` |

The **Explore the look** preference is stored per browser. Clear the `nw-design-theme` preference when checking a changed default. Review text contrast, keyboard focus, small screens and Arabic layout after style changes. Edit source rather than generated `dist/` files.

## 7. News and the employee knowledge library

The allowlist and RSS parser are in **`lib/news-source.ts`**. Eight configured feeds cover Microsoft Security, Microsoft Blog, Cloudflare, Cisco Talos, Splunk Security Advisories, Palo Alto Networks SOAR, Unit 42 and CERT-EU. The shared **`lib/news-service.ts`** loader supplies both `/api/news` and the server-rendered **`/insights`** hub. The hub and the public/workspace news dialogs support text, publisher and topic filters.

Open pages check every two minutes. Successful upstream responses are cached for ten minutes and refreshed on a subsequent request; a total failure is retried after a one-minute cache. Status labels distinguish live, partial, cached and unavailable results. Publisher publication dates remain separate from successful retrieval and attempted-check times. Topic labels come from individual headlines, summaries or publisher categories. A SOAR feed can contain older relevant articles; an old article does not become new because it was retrieved today. See [docs/NEWS.md](docs/NEWS.md) for exact sources, limits and diagnostics.

Refresh the saved fallback before an intended release when the sources are available:

```sh
npm run news:refresh
```

The command replaces `lib/news-snapshot.json` only when all configured feeds succeed. It is not a scheduled job. Review source/language checks before adding a feed. Preserve article dates, publisher links and successful retrieval timestamps; cached headlines must stay labelled as cached.

Public planning guides live in **`lib/insights-content.ts`** and render at `/insights/<slug>`. Each guide includes original text, a stable slug, related service IDs, an explicit `updatedAt` date and official references mapped to its sections. Update the date only after reviewing the content. Add genuinely useful guidance and approved company evidence instead of copying publisher articles into many near-duplicate pages. The sitemap automatically includes the guides. The search plan is [docs/SEO_AND_CONTENT_PLAN.md](docs/SEO_AND_CONTENT_PLAN.md).

Edit **`lib/knowledge-resources.json`** for official resource links and original Microsoft 365 runbooks. Follow a neighboring record's shape, use official source URLs, and update its review date only after checking the content. Paid ISO standards are linked, not reproduced. The website returns the library after membership checks, but this resource file is included in the public source repository. Keep confidential company procedures in separately protected backend storage rather than adding them to this JSON or `public/`.

## 8. Commands for local work

Install Node.js **22.13.0 or newer**, then open a terminal in the folder containing `package.json`.

### Fresh checkout

```sh
git clone https://github.com/23samjessen/NorthWall_EG.git
cd NorthWall_EG
cp .env.example .dev.vars
npm ci
npm run build
```

Copy the environment example only once for a fresh checkout; do not overwrite an existing local configuration without reviewing it. `npm ci` installs the locked dependency versions. Use `npm install` only when deliberately updating dependencies, and keep `package.json` and `package-lock.json` together.

Apply the initial local database migration once:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_clean_silk_fever.sql
```

This targets the local database. It is not a hosted migration command and must not be replayed after its tables already exist.

### Work, check and stop

```sh
npm run dev
```

Open the URL printed in the terminal. Keep the local preview bound to your own computer; it uses a development identity that is not production sign-in. Press **Ctrl+C** to stop it. To request another port, use `npm run dev -- --port 5174`.

For a built local preview, run `npm run build` followed by `npm run preview:worker`. This does not publish anything and does not supply the portable development sign-in simulator. For Hostinger, use `npm run build:hostinger` and `npm run start:hostinger` with the private configuration in `hostinger/.env.example`. Ordinary `npm start` selects that server only when `NORTHWALL_RUNTIME=hostinger`; otherwise the guard refuses to expose the Worker gateway contract.

Before releasing a code change:

```sh
npx tsc --noEmit
npm run test:backend
npm run test:news
npm run test:security
npm run audit:dependencies
npm run build
```

These are verification instructions, not a record of test results. The delivered revision's actual evidence belongs in [docs/VERIFICATION.md](docs/VERIFICATION.md).

### Save source changes

```sh
git status --short
git diff
git add lib/company-profile.json
git diff --cached
git commit -m "Update NorthWallEg company details"
git push origin main
```

Stage only the intended files, including any approved new public assets. Verify `git remote -v` points to `23samjessen/NorthWall_EG`. GitHub push and Sites deployment are separate; follow [docs/GITHUB_AND_DEPLOYMENT.md](docs/GITHUB_AND_DEPLOYMENT.md) to keep the deployed source aligned.

## 9. Data, migrations and evidence

### Preserve all three kinds of data

| Item | Where it lives | What preserves it |
| --- | --- | --- |
| Application code, public content, public images, schema definitions | Git repository | Reviewed Git commits and source packages |
| Employee workspace records and audit history | Hosted D1 database | Supported database backup/export and restore procedure |
| Uploaded employee photo bytes | R2 `BUCKET` | Protected object-storage backup/export with the matching metadata |

A source ZIP does not include live employee data. An **Evidence log** JSON export is an audit export, not a full workspace or photo backup. There is no full-workspace restore button in this demo. Use the host's supported data-management procedure and verify a restoration in an isolated environment before relying on it.

Before changing storage or schema, identify the project and its current bindings, record the deployed source revision, preserve the database and related objects, and document how to return to a compatible version. Keep backups and evidence exports outside the public repository. Preserve local work separately if you need it; `.wrangler/state` is not part of the source package.

### Database changes

After changing `db/schema.ts`:

```sh
npm run db:generate
```

Review the newly generated SQL in `drizzle/`. Never edit an already applied migration to represent a new change. Build again when needed, then apply only the new file locally using the initial command above with that new filename. Hosted migrations are applied through the supported deployment workflow.

Keep migrations structural. Do not embed real member records, customer tickets or secret values. Do not rerun **Load sample workspace** to update a live workspace; it is a one-time initialization, and seed-file edits do not overwrite existing data.

The demo has explicit capacity limits, including 1,000 total tickets and a bounded JSON workspace. Archiving does not free a ticket slot. See [docs/BACKEND.md](docs/BACKEND.md) before planning higher volumes; growing the application may require indexed tables, pagination and retention work.

### Audit evidence

Administrators open **Evidence log** to inspect server-generated UTC timestamps, actors, actions and recorded changes. Its JSON export is available through:

```text
/api/workspace?view=audit&format=json
```

Successful mutations are recorded; this is not a log of every read or every platform sign-in attempt. Note content and private-message bodies are represented by hashes/metadata in audit records. The application checks the hash chain, but a database operator who can rewrite data and hashes remains a separate trust boundary. Save significant exports and their head hashes independently when preservation matters.

## 10. Launch after registration and domain setup

Keep the private review audience and no-index policy while preparing. The sequence is:

1. Confirm company registration, approve public company/contact/team details, and populate only the real registration fields you want shown.
2. The purchased domain is **northwallegy.com**. Confirm the Hostinger application-hosting plan from **Websites**; the Domain Overview screen alone does not identify a hosting plan.
3. Prepare the full Hostinger application: production Node entry point, transactional database, protected photo storage, verified sign-in/session handling, secrets and data transfer. Preserve the existing design and workspace features. Keep the existing private deployment available until the destination is verified.
4. Test the Hostinger installation on a protected temporary address. Then attach the domain using Hostinger's actual deployment records, verify HTTPS and intended root/`www` redirects, and test rollback. The previously prepared external-host records are not the destination for this migration.
5. Update `website.origin` in `lib/company-profile.json`, then review the demo flag, public metadata, sitemap and robots rules together. `website.isReviewDemo` alone does not publish the site or connect DNS.
6. Check sign-in, employee membership, protected photos/library, ticket writes and evidence behavior on the final hostname. Check the public contact links and responsive layouts.
7. After your launch instruction, open the intended marketing audience and enable appropriate public indexing. Keep employee routes protected and out of public search.

Follow [docs/HOSTINGER_AND_DOMAIN.md](docs/HOSTINGER_AND_DOMAIN.md) for the full Hostinger migration. The source ZIP now includes the Node application and setup tools. Hostinger database/mailbox settings, schema/owner provisioning, live email delivery, data transfer and domain verification remain account-side work; deployment is not claimed. Follow [docs/SECURITY_REVIEW.md](docs/SECURITY_REVIEW.md) for verified fixes and the destination security checks that remain.

## 11. Quick troubleshooting

| Symptom | First action |
| --- | --- |
| A public phone, link or team card is missing | Check `enabled`, required values and valid URL/image formats in the JSON |
| A public change appears locally but not on the review site | Build and explicitly deploy the matching source; pushing GitHub alone does not update the site |
| A legal label is missing | Blank legal fields are intentionally omitted; add the real value when ready |
| Signed in but employee access is refused | Check the actual account email, member active status and private Site audience |
| An invited colleague receives no email | The app creates an inactive invitation but does not send email; share the invitation instructions through the intended channel, then require acceptance and owner approval |
| Profile photo cannot upload | Save pending text first; use a valid JPEG/PNG/WebP within size/dimension limits |
| Profile save reports a concurrent change | Reload saved details, review and re-enter the intended edit |
| Avatar remains initials | Check whether the photo saved and the authenticated photo request succeeds |
| Local workspace reports missing tables | Build and apply the initial local migration once |
| A column cannot be deleted | Move referenced tickets and update related automation rules |
| News is marked cached | The live refresh failed; the shown retrieval date belongs to the preserved real headlines |
| You need to change a password | Private Site: provider settings. Hostinger: verified password change or explicit offline owner recovery; never edit a source password |

For a review of what has actually been verified in this delivery, use [docs/VERIFICATION.md](docs/VERIFICATION.md). For implementation details, use [docs/BACKEND.md](docs/BACKEND.md) and [docs/CUSTOMISATION.md](docs/CUSTOMISATION.md).

## Hostinger runtime and sign-in code map

| Change | File or command |
| --- | --- |
| Node build/export | `hostinger/prepare.mjs`, `hostinger/build.mjs` |
| Private server settings | Hostinger Environment Variables; blank `hostinger/.env.example` |
| HTTPS origin, trusted request context and Node entry | `hostinger/server.mjs`, `hostinger/http.mjs`, `hostinger/runtime-env.ts` |
| Email/password/code interface and colours | `hostinger/login-page.tsx`, `hostinger/login.css` |
| Password and OTP policies | `hostinger/auth/index.mjs`, `hostinger/auth/password.mjs` |
| Authentication tables | `hostinger/auth/schema.sql` |
| Workspace/private portrait tables | `hostinger/schema.sql`, `hostinger/storage.mjs` |
| Mail transport | `hostinger/mail.mjs`; actual mailbox settings stay outside source |
| Initialize / recover owner | `npm run hostinger:setup`; recovery is an explicit separate flag |
| Check database and SMTP connection | `npm run hostinger:check -- --smtp` |
| Build / start | `npm run build:hostinger`; `npm run start:hostinger` |
| Bounded authentication cleanup | `npm run hostinger:setup -- --cleanup` |

Choose **Start empty workspace** for real operations or **Load sample workspace** for review. Existing data cannot be reset with either initialization action. Runtime data and uploaded portraits are not included in a source ZIP. Read the hosting and user-access guides for identity-continuity limits and separate data migration.
