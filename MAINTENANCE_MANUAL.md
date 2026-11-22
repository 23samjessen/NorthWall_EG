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
| Approve an employee, change their role or disable access | **Admin settings → Team** |
| Add ticket stages or extra ticket fields | **Admin settings → Workflow** |
| Add assignment/movement/notification rules | **Admin settings → Automations** |
| Change the team name or reference clock timezone | **Admin settings → Settings** |
| Read who changed a workspace record and when | **Evidence log**, as an administrator |
| Change protected handbook content or employee links | `lib/knowledge-resources.json` |
| Change news sources | `NEWS_FEEDS` in `lib/news-source.ts` |
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

Empty, disabled or invalid contact values are omitted. Adding a public email address creates a contact link; it does not configure a sending service for the enquiry form.

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
| `sam-jessen` | Sam Jessen | Network & Cybersecurity Engineer | `public/assets/team/sam-jessen.svg` |

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

Edit the strings or add another title to the relevant array. The interface joins the titles into the public title line. Use `bio.en` and `bio.ar` for an optional supplied biography.

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

The completion indicator counts a title and a photograph: `0/2`, `1/2` or `2/2`. The demo reminds people to finish their profiles while allowing them to continue working. It does not introduce a blocking onboarding gate. A job title is descriptive text; it never grants a role.

The optional biography has a 600-character limit. Display name/title allow 120 characters, department 80, work phone 40 and location 120. These are professional details visible within the active team workspace.

If another person saves while your form is open, a revision conflict can occur. **Reload saved details** loads the current record and discards unsaved typed text. Review it, re-enter the intended change and save again.

### Administrators: approve and manage employees

1. Open **Admin settings → Team → Add member**.
2. Enter the person's actual sign-in email, display name, job title and appropriate role.
3. Select **Approve member**.
4. Separately grant access to the private hosted site if that person is not already in its permitted audience.
5. Have the person sign in with the approved account and open the workspace.

This creates a membership record; it does not send an invitation email. The account shows **Pending account link** until its stable hosting identity is bound on its first successful workspace write. Sample `.invalid` accounts are examples and cannot sign in.

The team table shows the person's image/title and **Complete**, **Photo needed**, **Title needed** or **Photo + title needed**. Choose **Manage profile** to edit their details or replace/remove their photo. Use **Edit member** for the account role and access status. Employees can manage only their own profiles; administrators can manage other members.

The backend prevents self-lockout and protects the last active real administrator. Have another active administrator make changes to an administrator's own access. Disabling a member removes their access on subsequent protected requests; it does not delete the history of their work.

### Passwords and account identity

There is no shared NorthWallEg password and no password database in this source. The hosted sign-in provider owns passwords and account recovery. Change those details in the provider's account settings.

`ADMIN_EMAILS` is a server runtime allowlist for **initial setup of an empty workspace**. It does not promote people in an existing workspace. The local example uses `seedy@sites.test` for the loopback-only development simulator; production uses verified hosting identity. Earlier static-prototype credentials do not apply.

The profile form cannot change a member's sign-in email, identity binding or access role. A change of sign-in account needs a deliberate membership change by an administrator, preserving the person's work and the remaining administrator's access. Do not change identity by editing browser data.

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

The allowlist and RSS parser are in **`lib/news-source.ts`**. The current publishers are Microsoft Security, Microsoft Blog and Cloudflare Blog. The route `app/api/news/route.ts` fetches and caches headlines and reports live, partial, cached or unavailable status.

Refresh the saved fallback before an intended release when the sources are available:

```sh
npm run news:refresh
```

The command replaces `lib/news-snapshot.json` only when all configured feeds succeed. It is not a scheduled job. Review source/language checks before adding a feed. Preserve article dates, publisher links and successful retrieval timestamps; cached headlines must stay labelled as cached.

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

For a built local preview, run `npm run build` followed by `npm start`. This does not publish anything and does not supply the portable development sign-in simulator.

Before releasing a code change:

```sh
npx tsc --noEmit
npm run test:backend
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
2. Purchase the chosen domain and confirm the exact canonical hostname.
3. Prefer connecting the Hostinger-bought domain to the existing application host. Request the real custom-domain records from that host and add those exact values at the authoritative DNS provider.
4. Verify ownership, HTTPS and intended root/`www` redirects while review access stays private.
5. Update `website.origin` in `lib/company-profile.json`, then review the demo flag, public metadata, sitemap and robots rules together. `website.isReviewDemo` alone does not publish the site or connect DNS.
6. Check sign-in, employee membership, protected photos/library, ticket writes and evidence behavior on the final hostname. Check the public contact links and responsive layouts.
7. After your launch instruction, open the intended marketing audience and enable appropriate public indexing. Keep employee routes protected and out of public search.

Follow [docs/HOSTINGER_AND_DOMAIN.md](docs/HOSTINGER_AND_DOMAIN.md) for current hosting choices and DNS instructions. The app's Worker, D1 and trusted gateway dependencies mean the current ZIP is not a drop-in Hostinger Node deployment. A domain connection does not require moving compute.

## 11. Quick troubleshooting

| Symptom | First action |
| --- | --- |
| A public phone, link or team card is missing | Check `enabled`, required values and valid URL/image formats in the JSON |
| A public change appears locally but not on the review site | Build and explicitly deploy the matching source; pushing GitHub alone does not update the site |
| A legal label is missing | Blank legal fields are intentionally omitted; add the real value when ready |
| Signed in but employee access is refused | Check the actual account email, member active status and private Site audience |
| An approved colleague receives no invitation | The app creates membership but does not send email; share access through the intended channel separately |
| Profile photo cannot upload | Save pending text first; use a valid JPEG/PNG/WebP within size/dimension limits |
| Profile save reports a concurrent change | Reload saved details, review and re-enter the intended edit |
| Avatar remains initials | Check whether the photo saved and the authenticated photo request succeeds |
| Local workspace reports missing tables | Build and apply the initial local migration once |
| A column cannot be deleted | Move referenced tickets and update related automation rules |
| News is marked cached | The live refresh failed; the shown retrieval date belongs to the preserved real headlines |
| You need to change a password | Use the sign-in provider's account settings; there is no source password to edit |

For a review of what has actually been verified in this delivery, use [docs/VERIFICATION.md](docs/VERIFICATION.md). For implementation details, use [docs/BACKEND.md](docs/BACKEND.md) and [docs/CUSTOMISATION.md](docs/CUSTOMISATION.md).
