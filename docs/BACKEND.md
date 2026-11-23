# NorthWallEg backend and security guide

This guide describes the current source, including the existing Sites runtime and the separate Node target prepared for Hostinger. The private review Site and its existing gateway, D1 records and R2 objects are retained. The new Site publication and actual Hostinger deployment are separate release gates recorded in [VERIFICATION.md](VERIFICATION.md). Sample companies, people, tickets and discussions are labelled as examples; they are not evidence of delivered customer work or certification.

## Where the backend lives

| File | Purpose |
| --- | --- |
| `lib/workspace-server.ts` | Identity, membership, role checks, input validation, all workspace mutations, private-data filtering, transactional persistence and audit verification |
| `lib/workspace-types.ts` | Shared types and the supported action names |
| `lib/workspace-seed.ts` | Initial columns, channels and clearly labelled sample records |
| `db/schema.ts` | Drizzle definitions for the workspace and audit tables |
| `drizzle/0000_clean_silk_fever.sql` | Initial schema-only migration; never edit after it has been applied |
| `app/api/workspace/route.ts` | Protected employee API, self-profile changes and administrator audit export |
| `app/api/profile-photo/route.ts` | Authenticated private profile portrait upload, retrieval and removal |
| `app/api/news/route.ts` | Public English news API and HTTP cache headers |
| `lib/news-source.ts` | Fixed publisher allowlist, fetch limits and the shared RSS parser |
| `lib/news-service.ts` | Shared server news loader, runtime cache and clearly labelled saved-headline fallback |
| `lib/news-snapshot.json` | Real, dated headlines saved by the refresh script for publisher downtime |
| `scripts/refresh-news.mjs` | Refresh the saved headline snapshot using the same sources and parser |
| `lib/knowledge-resources.json` | Server-side resource library, original troubleshooting checklists and official links |
| `scripts/test-workspace.mjs` | Transactional SQLite tests of the actual server's authorization and audit behaviour |
| `lib/security-headers.ts` | Shared request-method restrictions, script nonces, response protections and private caching policy |
| `scripts/test-security.mjs` | Fixture-based checks for the HTTP security controls |
| `hostinger/server.mjs`, `hostinger/http.mjs` | Node/Next request boundary, trusted session identity, canonical origin and HTTP protections |
| `hostinger/auth/` | Node password verification, email-code challenges, sessions, throttling and authentication schema |
| `hostinger/storage.mjs`, `hostinger/schema.sql` | Fixed-statement MySQL adapter, transactional workspace/audit writes and private portrait BLOB storage |
| `hostinger/setup.mjs`, `hostinger/check.mjs` | Explicit schema/owner provisioning and destination preflight; no request-time DDL |
| `hostinger/tests/` | Node authentication, storage, HTTP, built-render and opt-in real-database tests |

The hosting manifest uses the D1 binding `DB` and the private R2 binding `BUCKET` for employee portraits. Keep runtime secrets out of this file and source control. The app currently needs no news API key.

## Sign-in, usernames and passwords

The **existing Sites runtime** receives identity from the hosting platform. It does not store application passwords or password hashes; its sign-in button starts the platform's supported flow. The **separate Node target** implements email-address login, salted scrypt password hashes, email-code verification and secure server sessions. Neither target has a shared default password. A credential from an older static prototype is not a credential for either target.

The identity headers used by Sites must be injected by its trusted gateway. They are not a standalone authentication protocol. The Node build replaces that adapter with a server-side authenticated request context and rejects/strips visitor identity headers at its boundary. Do not run the unchanged gateway-dependent backend behind a generic server that trusts visitor-supplied identity headers. Real Hostinger session, HTTPS and email-delivery verification are still required before launch.

Node authentication code provides invitation-only new-account enrollment, password plus email-code verification, and mandatory replacement of an offline-provisioned temporary password before issuing a workspace session. A temporary owner password expires after 24 hours. Its setup prompt is private and interactive; no password has been installed by preparing this source. SMTP credentials, mailbox access and real delivery have not been configured or verified as part of these code checks. SMS is not implemented. See [AUTHENTICATION_AND_MFA.md](AUTHENTICATION_AND_MFA.md) for the authentication boundary and pending deployment steps.

An authenticated platform identity is necessary but does not automatically grant employee access. Every protected request requires an active approved membership bound to the verified identity. Invitation acceptance binds the stable platform user ID without granting access; the owner must approve separately. A non-owner legacy record without this approval cannot authenticate by email matching alone.

`ADMIN_EMAILS` is a comma-separated **server runtime configuration value**, used only to identify who may initialize an empty workspace. It must be explicitly configured with verified administrator email addresses. Missing, empty or whitespace-only configuration denies initial setup; there is no built-in bootstrap email fallback. The existing Sites deployment has its own explicitly configured value. Configure the destination separately during migration and keep runtime configuration out of Git. Changing this value after setup does not overwrite membership or grant additional administrator roles.

### Add or change users

Only the stable owner account can create/reissue invitations, approve or revoke access and assign roles. The first setup creates one real administrator. Other approved administrators retain ordinary workspace and safe-profile administration, but cannot change account permissions.

1. As owner, open **Admin settings → Team → Create invitation** with the person's verified sign-in email, display name and title. New records are inactive employees.
2. Share the workspace invitation instructions through your chosen channel. The application does not currently send email/SMS. Private Site audience permission must separately allow the recipient to reach the Site.
3. The invited person signs in and accepts their own current invitation before its seven-day expiry. Acceptance binds the stable identity but grants no employee data access.
4. The owner explicitly approves the accepted invitation before expiry. Only then is employee access active.
5. The owner may separately grant an approved employee a manager/admin role, revoke access or reissue an invitation. Reissue invalidates the earlier acceptance and requires the full process again.

Sample identities cannot sign in or become real accounts. Legacy non-owner records without explicit approval evidence fail closed until re-invited, accepted and approved. Records and historical work are preserved. See [USER_ACCESS.md](USER_ACCESS.md).

### Reissued invitations preserve identity continuity

An accepted or previously bound member retains `onboarding.identityAnchorUserId` when access is revoked or an invitation is reissued. Active binding is cleared, but the historical identity anchor is preserved. Only that same verified identity can accept a reissued historical record; matching a recycled email address is insufficient. Existing bound legacy records establish continuity from their stored identity. An older lifecycle record whose binding has already been lost fails closed and cannot be reissued by guessing a replacement identity.

The owner may create a **separate member record** for replacement staff at the same email only after all previous matching records are revoked, inactive and unbound. The new member does not inherit the earlier person's private notes, DMs or portrait. Reissuing an old record is blocked while another current record uses that email. The anchor is visible only in the owner roster and omitted from employee/self/onboarding responses and shared audit metadata; existing administrator evidence still records its normal actor/binding fields.

The Node public enrollment flow cannot adopt an imported identity anchor. Existing identities require a reviewed migration mapping or an already authenticated account; entering the same email is not identity recovery. Owner provisioning is an offline administrative operation, separate from public enrollment.

### Role permissions

| Capability | Employee | Manager | Administrator |
| --- | --- | --- | --- |
| Read/create/update team tickets and assignments | Yes | Yes | Yes |
| Update own profile and portrait | Yes | Yes | Yes |
| Read active teammates’ internal portraits | Yes | Yes | Yes |
| Update another member’s profile or portrait | No | No | Yes |
| Reply, react and forward accessible discussion content | Yes | Yes | Yes |
| Create own notes and calendar events | Yes | Yes | Yes |
| Edit or remove own notes | Yes | Yes | Yes |
| Read another person's private note | No | No | No |
| Read a direct message they do not participate in | No | No | No |
| Send team alerts or create channels | No | Yes | Yes |
| Manage columns, custom fields and automation rules | No | No | Yes |
| Invite, approve, revoke or assign account roles | No | No | Owner only |
| Read or export audit evidence | No | No | Yes |

This is a single-company workspace: team tickets and ordinary channel discussions are visible to every active member. It is not a customer-isolated service portal. Do not add separate customers as employees and assume tenant separation. Calendar events are team-visible; personal notes have an explicit private mode.

## API contract

`GET /api/workspace` returns the current member, their filtered state, the current revision and the protected knowledge resources. The owner receives `needsSetup: true` when the database is empty. `POST /api/workspace` accepts:

```json
{
  "action": "ticket.create",
  "payload": {
    "title": "Review the approved change",
    "priority": "medium"
  },
  "revision": 7
}
```

A successful mutation returns the refreshed workspace. The server rejects a stale revision with HTTP 409; refresh before retrying. This prevents a second user from silently overwriting a newer change. Ordinary workspace writes require authenticated approved active membership, JSON and a same-origin browser request. The separate `invitation.accept` action accepts only the signed-in person's current invitation identifier, needs no global revision and returns their own onboarding status without workspace data. The server assigns actor IDs and timestamps itself.

Workspace POST bodies are limited to **64 KiB (65,536 bytes)** while streaming, before JSON parsing. Oversized streams are cancelled even when `Content-Length` is missing or falsely small; invalid or oversized declared lengths are rejected before reading. The media type must be exactly `application/json`, with optional parameters such as `charset=utf-8`. Lookalikes such as `application/jsonp` are rejected. JSON profile deletion has a separate **4 KiB** streaming cap; portrait uploads use the bounded multipart contract below. Cross-site and same-site requests from a different origin are rejected, and the origin must agree with the application's own origin.

At revision `0`, a configured bootstrap owner chooses one setup action: **`workspace.initialize`** creates an empty real workspace with only the owner, default columns/channels, `settings.demo: false` and an audit event with `sampleData: false`; **`demo.initialize`** loads the labelled review records. The UI offers **Start empty workspace** and **Load sample workspace**. Both actions are one-time operations and reject repeats without resetting or erasing existing records.

The `WorkspaceAction` type lists all implemented mutations. Adding a visual control alone does not create a server permission: implement and validate the action in `applyAction` as well. Define data fields in the shared types, update the server validation, then expose them in the UI.

## Employee profiles and private portraits

Each active employee can use **My profile** to maintain a display name, job title, department, work phone, location and short bio. Saving a self-profile requires both the name and job title. The server limits name/job title to 120 characters each, department to 80, phone to 40, location to 120 and bio to 600. Contact details are internal team profile information; members should enter the work information they want colleagues to see.

`profile.update` always applies to the authenticated member. It rejects role, email, account ID and photo URL changes. Administrators can maintain another member's safe profile fields through `member.update`; changing account access is restricted to the stable workspace owner. A manager cannot edit another member's profile or portrait.

Existing member records remain usable without the new fields. The API derives `profileCompletion` with `hasPhoto`, `hasJobTitle` and `complete` flags for the editor and roster. Incomplete profiles do not block the existing demo. Fresh initialisation under the verified Sam owner email gives that new owner the title **Network & Cybersecurity Engineer**; existing saved titles are never automatically overwritten.

### Profile API

| Request | Body/result |
| --- | --- |
| `POST /api/workspace` | `{action:"profile.update",payload:{name,jobTitle,department,workPhone,location,bio},revision}`; returns the updated `WorkspaceResponse` |
| `POST /api/profile-photo` | Multipart form with exactly one `file`, `memberId` and `revision`; returns the updated `WorkspaceResponse` |
| `DELETE /api/profile-photo` | JSON `{memberId,revision}`; returns the updated `WorkspaceResponse` |
| `GET /api/profile-photo?memberId=...` | Returns that member's portrait only to an active authenticated workspace member; an administrator can also view a disabled member's retained portrait |

Portrait writes are allowed for the owner of that profile or an administrator. They require the same-origin browser checks and current revision used by other mutations. The API supplies `photoUrl` and `photoUpdatedAt`; it does not accept remote image URLs. The URL includes a content version value so replacements appear correctly in avatars. All photo responses are private/no-store, with a fixed image content type, `nosniff` and same-origin resource policy.

### Accepted images and storage

One active portrait is retained per member. Acceptable files are **PNG, JPEG or WebP, up to 2 MiB**, with no more than **8192 pixels on either side and 16 million pixels in total**. The backend checks the submitted MIME type against file signatures, structural headers and declared dimensions. Animated PNG/WebP, SVG, GIF, empty files, oversized files and incompatible signatures are rejected. The full multipart body is streamed with a limit of **2 MiB plus 16 KiB of form overhead** before parsing.

In Sites, images are stored in private R2 `BUCKET` objects under unique `profile-photos/` keys. D1 contains the current pointer, format, dimensions, byte count, digest and upload timestamp. In the Node target, the compatible `BUCKET` adapter stores those private objects in the MySQL `profile_photos` table as bounded `MEDIUMBLOB` values. Image bytes remain outside the workspace JSON and audit payload in both targets. Internal object keys and storage metadata are removed from API member records; the source ZIP/Git repository contains no employee uploads.

A replacement uploads a new unique object, then commits the D1 pointer and metadata-only audit event with the normal revision/hash checks. Only after a successful commit is the old object removed. A known revision conflict deletes the unused new object and preserves the previously committed portrait. An ambiguous commit failure is checked before cleanup so a potentially committed image is not deleted. Storage cleanup failures are logged for an administrator's later storage check; the application does not make the old object public.

The Node adapter follows the same sequence using MySQL object storage and an atomic workspace/audit transaction. Private portraits are not written into the replaced deployment directory. Database backups for this target must include the portrait table as well as workspace, evidence and authentication records.

Removal first commits the empty photo pointer and its audit event, then removes the previous object. Photo audit entries include the target member, authenticated actor, server time, format, size, dimensions and digest, without image bytes, original filenames or R2 keys. The existing audit consistency limits still apply.

These checks do not decode/re-encode, crop, scan for malware or strip embedded EXIF metadata. The supplied image bytes are retained. Use a suitable work portrait. Internal profile photos and titles are separate from the public company's team placeholders: updating **My profile** does not publish the portrait or personal details on the public website.

No Sites schema migration or data reset is required for these JSON member fields. The Sites manifest must enable `r2: "BUCKET"`; local previews use that declared binding with local storage. Sites access remains platform-authenticated and its bucket must remain private. The Node target uses its separately initialized MySQL schema; changing runtimes does not automatically import D1 records, R2 objects or verified identity mappings.

## Audit and evidence

Only administrators can call `GET /api/workspace?view=audit`. Add `&format=json` for a downloadable JSON evidence file.

Each successful workspace mutation records:

- A unique event ID and monotonic sequence.
- A server-generated UTC timestamp.
- The authenticated member's ID and display name.
- Action name, affected object and request ID.
- Relevant before/after changes or action metadata.
- The preceding event hash and this event's SHA-256 hash.

The state update and audit insert run together in a transactional D1 batch, guarded by the old revision and hash. A stale writer changes neither the state nor the audit chain. Failed or rejected requests do not appear as successful changes.

In Node, `hostinger/storage.mjs` accepts only the six known workspace SQL statements, binds values through `mysql2.execute()` and requires a workspace write plus audit insertion in one InnoDB transaction. It rejects unmatched row counts and rolls back failures. Read batches use explicit REPEATABLE READ consistent snapshots; the complete audit-byte expression uses `OCTET_LENGTH`. Binary identifier/hash columns preserve exact comparisons. The real-engine CI gate remains pending until its result is recorded; local adapter-contract tests alone do not prove hosted database behavior.

Verification obtains the workspace head and audit history from one **transactional D1 read batch**, recomputes the chain, checks sequence continuity and compares its final hash with that snapshot's stored head. A legitimate concurrent write therefore cannot create a false tampering result by mixing two different database states. Administrator membership is checked again against the consistent snapshot, so an access change after the initial check is respected. The export includes `chainValid`, `headHash`, `exportedAt` and a statement of its limits. Save evidence exports independently if they matter to an investigation.

Exports accept at most **10,000 events and 8 MiB of stored audit-column data**. In the same transaction, SQL totals all event columns using byte lengths, including multibyte UTF-8 text. The event-row query is conditional on both limits; oversized history returns no event rows to the worker and produces HTTP **413 `export_too_large`**. Use a protected administrator database backup for the complete history above these bounds. The byte cap measures stored column contents, not the exact final JSON download size; JSON framing adds overhead. An evidence export is not a full workspace/photo backup.

Private direct-message text is not included in audit changes. Its hash, length, participants and related metadata are logged instead. All notes log title/body hashes, visibility, ownership and body length; note text is omitted even across visibility changes or deletion. Ordinary team discussion text can appear in change evidence. Deleted comments and messages leave their earlier audit evidence; administrators cannot delete or alter audit events through the app API.

This is **tamper-evident application history**, not immutable or certified forensic storage. A database administrator who can rewrite both data and hashes can reconstruct a chain. There is no independent signing service, WORM retention, trusted external timestamping or legal chain-of-custody workflow. Hosted sign-in failures and platform access logs are separate from these application mutation records. Page views and ordinary reads are not exhaustively audited.

## Automation and alerts

Rules run on the server during `ticket.created` and `ticket.updated`. They can match a priority, assign a member, move a ticket to a column and create in-app notifications. They do not execute user-provided code. Alerts, mentions, replies and assignments are stored as in-app records.

These work notifications do not send email, SMS or browser push. The Node authentication email-code transport is a separate component and does not convert ticket alerts into email. Polling refreshes open workspace views; no background scheduling, chat delivery/read-receipt guarantee or staffed 24/7 response is implied.

## News behaviour

The `/api/news` endpoint reads eight official English feeds: **Microsoft Security, Microsoft Blog, Cloudflare Blog, Cisco Talos, Splunk Security Advisories, Palo Alto Networks' dedicated SOAR topic feed, Unit 42 and CERT-EU**. Its source list is fixed in `lib/news-source.ts`; visitors cannot supply arbitrary feed URLs. It rejects explicitly non-English metadata, restricts redirects and article links to approved HTTPS publisher hosts, limits fetched bytes and time, strips markup, and returns plain text for React rendering. Talos is a verified English source whose RSS omits a language declaration.

The shared `getNews()` loader in `lib/news-service.ts` serves both the API and the server-rendered insights page. Up to 48 headlines are selected fairly across sources, newest first within each source. SOAR is an article topic, not a fabricated publisher; a healthy topic feed with no explicit matches is an empty result rather than an outage. See [NEWS.md](NEWS.md) for sources, topic rules, coverage fields and limits.

News is fetched on request. The worker caches a successful result for 10 minutes per isolate. When all sources fail, the failure cache expires after one minute and a new upstream attempt becomes eligible on the next request. Both interfaces poll every two minutes while open. If current fetching fails, it can show the most recent successful runtime result or the verified build snapshot with `status: cached`. The original `fetchedAt` and `snapshotFetchedAt` are preserved; `checkedAt` is the current attempt time. Saved headlines must be visibly labelled as cached, not live. `unavailable` with a null `fetchedAt` remains the result if no usable data exists.

Browser responses can be cached for 120 seconds when live/partial and 60 seconds when cached/unavailable. Each headline retains its publisher and article publication timestamp. No headline is invented or redated. The snapshot contains titles and original article links, not copied article bodies.

Before building a new publication, refresh the verified snapshot with:

```sh
npm run news:refresh
```

This uses the same allowlisted sources and parser as the live route. The file is replaced atomically only when all configured feeds succeed; any failure leaves the previous good snapshot unchanged. It is a build/maintenance command, not a background scheduled job. Adding a new source requires updating the allowlist and checking its language, licensing and URL behaviour.

## Local development and migrations

Install dependencies according to the project README. With `NORTHWALL_RUNTIME` unset, start the default Sites local development server with:

```sh
npm run dev
```

Run `npm run build` separately to produce the current Worker build. Generate a new migration with `npm run db:generate` only after deliberately changing `db/schema.ts`; the request/audit hardening in this revision needs no schema migration.

After the first build, apply the initial migration **once** to the local database:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_clean_silk_fever.sql
```

Local and hosted databases are separate. Hosted publication applies the committed schema migrations. For schema changes, update `db/schema.ts`, generate and inspect a new migration, then apply the new migration. Do not edit applied SQL or put sample data into migration files.

The starter's portable, loopback-only development profile has its own mock sign-in identity (`local_seedy`, `seedy@sites.test`). For that local profile only, configure `ADMIN_EMAILS=seedy@sites.test` in the ignored local runtime environment. The managed preview does not enable mock authentication; production uses platform identity. Never deploy a development bypass or a fake role selector as real authorization.

Run the security and application verification with a supported patched Node.js release meeting the repository's engine requirement; CI currently uses Node.js 24:

```sh
npm run test:backend
npm run test:news
npm run test:security
npx tsc --noEmit
npm run audit:dependencies
npm run build
```

The backend script transpiles the real implementation into a private temporary directory and substitutes transactional database/R2 test bindings and module imports. Its **92 checks** cover owner-only empty/sample setup, separate invitation acceptance and approval, deadline and generation checks, stable identity continuity, replacement-record isolation, legacy/sample restrictions, delegated-admin limits, preapproval API denial, same-origin/JSON/stream limits, private notes/messages, concurrent writes and evidence integrity. SQL-looking text remains literal or is rejected as an invalid selector. Audit tests cover consistent concurrent exports, revocation during export and oversized multibyte history rejected before allocation. Profile checks cover permissions, image limits, replacement/removal, metadata-only evidence and orphan cleanup.

The news and HTTP security suites use deterministic local fixtures. HTTP checks include fresh script nonces, rejection of visitor-selected nonces and unsupported methods, private/no-store responses and preservation of the portrait's stricter sandbox policy. These suites do not access employee runtime data. Dependency auditing checks the installed dependency graph against the registry's advisory data; review its result and keep the manifest and lockfile aligned when applying a targeted update.

The current core total is **142 passed checks: 92 backend, 33 news and 17 HTTP/security**. Separate Node checks recorded **32 authentication, 15 storage-contract, 7 HTTP and 1 actual built-Next SSR/API-origin test passed**. Real MySQL storage and auth suites contain seven and five scenarios respectively; their GitHub CI execution is pending observation. See [VERIFICATION.md](VERIFICATION.md) for the distinction between source tests, historical Site checks and current release gates.

## Node target setup and database requirements

The Node target is selected explicitly with `NORTHWALL_RUNTIME=hostinger`; `npm run build:hostinger` and `npm run start:hostinger` are the direct commands. Default Sites commands and its persisted data are unchanged. The generated `.hostinger-app` directory is reproducible build output and must not hold runtime data.

Prepare the private destination variables using `hostinger/.env.example` as a field reference. Configuration requires the canonical HTTPS origin, confirmed edge HTTPS enforcement, an independently generated authentication secret, MySQL credentials and the SMTP account settings. The example is not a provisioned environment. Keep `PUBLIC_LAUNCH=false` until launch is authorized.

After destination credentials and plan capabilities are verified, use an approved private terminal:

```sh
npm run hostinger:setup -- --schema-only
npm run hostinger:setup
npm run hostinger:check
npm run build:hostinger
npm run start:hostinger
```

The first command explicitly initializes `workspace`, `audit_events`, `profile_photos` and the five `nw_auth_*` tables. It preserves existing records. The second also provisions the configured owner through a hidden interactive temporary-password prompt; it must not receive a password in command arguments. `--recover-owner` is the separate controlled recovery mode. `hostinger:check` verifies storage/authentication tables and owner provisioning. Optional `npm run hostinger:check -- --smtp` verifies the configured mailbox connection without sending an email; real delivery still requires a sign-in test.

All storage tables must use InnoDB and `max_allowed_packet` must be at least **4 MiB** for the allowed 2 MiB portraits. The MySQL schema is separate from the D1 migration files; do not run Drizzle's SQLite migration against it. Only setup performs DDL. Server requests and startup checks do not silently create tables or owners.

Run Node tests with `npm run test:hostinger`; run the built-render gate with `npm run test:hostinger-render` after its build prerequisites. Real-engine tests require dedicated empty `NW_TEST_DB_*` fixture databases separate from production. The storage suite never resets existing tables. CI uses a separate database for authentication tests. A reviewed import, identity mapping and independent backup/restore test are required before moving existing Site records and portraits. No Hostinger deployment, live SMTP delivery, owner password installation or production data transfer is claimed here.

## Operational limits before wider rollout

The demo bounds records and request sizes to keep its single-document persistence predictable: 1,000 total tickets including archived tickets, 5,000 comments, 5,000 messages, 500 notes, 1,000 events, 100 members, 30 channels, 30 custom fields, 30 rules, 12 columns, a 64 KiB workspace write request and roughly 1.5 MB serialized workspace state. Audit export is bounded to 10,000 events and 8 MiB of stored audit-column data. These limits are explicit in the server.

A production expansion should move high-volume entities into separate indexed tables, define customer isolation and add independent backup/restore, retention and external evidence procedures. The focused review and checks are not a complete independent penetration test, certification or availability guarantee. The Node runtime, authentication and database adapters now exist in source; actual database CI, hosting configuration, identity/data migration and deployment validation remain release gates. See [HOSTINGER_AND_DOMAIN.md](HOSTINGER_AND_DOMAIN.md).
