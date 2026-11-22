# NorthWallEg backend and security guide

This review app is a working, persistent demo. Its sample companies, people, tickets and discussions are labelled as examples. It is not evidence of delivered customer work, an operating security operations centre, or a certified management system.

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
| `app/api/news/route.ts` | Public English news API, runtime cache and clearly labelled saved-headline fallback |
| `lib/news-source.ts` | Fixed publisher allowlist, fetch limits and the shared RSS parser |
| `lib/news-snapshot.json` | Real, dated headlines saved by the refresh script for publisher downtime |
| `scripts/refresh-news.mjs` | Refresh the saved headline snapshot using the same sources and parser |
| `lib/knowledge-resources.json` | Server-side resource library, original troubleshooting checklists and official links |
| `scripts/test-workspace.mjs` | Transactional SQLite tests of the actual server's authorization and audit behaviour |

The hosting manifest uses the D1 binding `DB` and the private R2 binding `BUCKET` for employee portraits. Keep runtime secrets out of this file and source control. The app currently needs no news API key.

## Sign-in, usernames and passwords

Hosted identity is supplied by the hosting platform. The application does not store passwords, password hashes or a shared administrator password. The sign-in button starts the platform's supported sign-in flow. A username or password in an older static prototype is not a credential for this app.

The identity headers used by this deployment must be injected by the trusted hosting gateway, which owns sign-in. They are not a standalone authentication protocol. When moving this backend to another host, integrate and verify that host’s supported identity/session system and strip visitor-supplied identity headers before enabling employee routes. Do not expose the unchanged API behind a server that accepts those headers directly from visitors.

An authenticated platform identity is necessary but does not automatically grant employee access. Every protected request checks a separate, active membership record. After an invited person first writes a permitted action, their invitation is bound to the stable platform user ID. Subsequent authorization uses that ID.

`ADMIN_EMAILS` is a comma-separated **runtime configuration value**, used only to identify who may initialize an empty workspace. If unset, the demo's bootstrap email is `23samjessen@gmail.com`, taken from the owner's account when this demo was prepared. To configure another installation, set `ADMIN_EMAILS` to its verified administrator email before its first setup. Changing this variable after setup does not overwrite membership or grant additional administrator roles.

### Add or change users

1. Sign in as an active administrator and open Administration.
2. Add the person's correct email, display name and role. This creates an allowlisted invitation record; it does **not** send an email.
3. If the hosted Site is still owner-private, its owner must explicitly share access with that person through the hosting platform as a separate action. An application invitation does not bypass the Site's access policy.
4. The person signs in with the invited account and opens the workspace.
5. Change role or deactivate the member in Administration. A deactivated member immediately fails the server's membership checks on later requests.

Sample users ending in `@demo.invalid` are assignment examples, not sign-in accounts. The last active real administrator cannot be removed. An administrator cannot disable or demote their own account with a self-directed change.

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
| Manage users, columns, custom fields and automation rules | No | No | Yes |
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

A successful mutation returns the refreshed workspace. The server rejects a stale revision with HTTP 409; refresh before retrying. This prevents a second user from silently overwriting a newer change. All writes require an authenticated active membership, JSON and a same-origin browser request. The server assigns actor IDs and timestamps itself.

The first setup action is `demo.initialize` at revision `0`, permitted only for a configured bootstrap administrator. It inserts labelled sample data. Repeating initialization cannot reset or erase existing records.

The `WorkspaceAction` type lists all implemented mutations. Adding a visual control alone does not create a server permission: implement and validate the action in `applyAction` as well. Define data fields in the shared types, update the server validation, then expose them in the UI.

## Employee profiles and private portraits

Each active employee can use **My profile** to maintain a display name, job title, department, work phone, location and short bio. Saving a self-profile requires both the name and job title. The server limits name/job title to 120 characters each, department to 80, phone to 40, location to 120 and bio to 600. Contact details are internal team profile information; members should enter the work information they want colleagues to see.

`profile.update` always applies to the authenticated member. It rejects role, email, account ID and photo URL changes. Administrators can maintain another member's safe profile fields through `member.update`; changing access still follows the existing administrator permissions. A manager cannot edit another member's profile or portrait.

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

One active portrait is retained per member. Acceptable files are **PNG, JPEG or WebP, up to 2 MiB**, with no more than **8192 pixels on either side and 16 million pixels in total**. The backend checks the submitted MIME type against file signatures, structural headers and declared dimensions. Animated PNG/WebP, SVG, GIF, empty files, oversized files and incompatible signatures are rejected. The full multipart body is also bounded before parsing.

Images are stored in the private R2 `BUCKET`, under a unique `profile-photos/` object key. D1 contains the current pointer, format, dimensions, byte count, SHA-256 digest and upload timestamp; it does not contain image binary data. Internal object keys and storage metadata are removed from workspace API member records. The source ZIP/Git repository does not contain employees' uploaded portraits.

A replacement uploads a new unique object, then commits the D1 pointer and metadata-only audit event with the normal revision/hash checks. Only after a successful commit is the old object removed. A known revision conflict deletes the unused new object and preserves the previously committed portrait. An ambiguous commit failure is checked before cleanup so a potentially committed image is not deleted. Storage cleanup failures are logged for an administrator's later storage check; the application does not make the old object public.

Removal first commits the empty photo pointer and its audit event, then removes the previous object. Photo audit entries include the target member, authenticated actor, server time, format, size, dimensions and digest, without image bytes, original filenames or R2 keys. The existing audit consistency limits still apply.

These checks do not decode/re-encode, crop, scan for malware or strip embedded EXIF metadata. The supplied image bytes are retained. Use a suitable work portrait. Internal profile photos and titles are separate from the public company's team placeholders: updating **My profile** does not publish the portrait or personal details on the public website.

No schema migration or data reset is required for these JSON member fields. The hosting manifest must enable `r2: "BUCKET"`; the supported hosting workflow provisions the bucket. Local previews use the same declared binding with local storage. Hosted access remains platform-authenticated, and the bucket must not be exposed as a public asset bucket.

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

Verification recomputes the chain, checks sequence continuity and compares its final hash with the workspace's stored head. The export includes `chainValid`, `headHash`, `exportedAt` and a statement of its limits. Save evidence exports independently if they matter to an investigation.

Private direct-message text is not included in audit changes. Its hash, length, participants and related metadata are logged instead. All notes log title/body hashes, visibility, ownership and body length; note text is omitted even across visibility changes or deletion. Ordinary team discussion text can appear in change evidence. Deleted comments and messages leave their earlier audit evidence; administrators cannot delete or alter audit events through the app API.

This is **tamper-evident application history**, not immutable or certified forensic storage. A database administrator who can rewrite both data and hashes can reconstruct a chain. There is no independent signing service, WORM retention, trusted external timestamping or legal chain-of-custody workflow. Hosted sign-in failures and platform access logs are separate from these application mutation records. Page views and ordinary reads are not exhaustively audited.

## Automation and alerts

Rules run on the server during `ticket.created` and `ticket.updated`. They can match a priority, assign a member, move a ticket to a column and create in-app notifications. They do not execute user-provided code. Alerts, mentions, replies and assignments are stored as in-app records.

These features do not send email, SMS or browser push notifications. Polling refreshes open workspace views; no background scheduling, chat delivery/read-receipt guarantees or staffed 24/7 response is implied.

## News behaviour

The `/api/news` endpoint fetches English RSS feeds from Microsoft Security, Microsoft Blog and Cloudflare Blog. Its source list is fixed in `lib/news-source.ts`; visitors cannot supply arbitrary feed URLs. It checks English language metadata when present, restricts article links to approved HTTPS publisher hosts, limits fetched bytes and time, strips markup, and returns text for React rendering.

News is fetched on request. The worker caches a successful result for 10 minutes per isolate. When all sources fail, the failure cache expires after one minute and a new upstream attempt becomes eligible on the next request. Both interfaces poll every two minutes while open. If current fetching fails, it can show the most recent successful runtime result or the verified build snapshot with `status: cached`. The original `fetchedAt` and `snapshotFetchedAt` are preserved; `checkedAt` is the current attempt time. Saved headlines must be visibly labelled as cached, not live. `unavailable` with a null `fetchedAt` remains the result if no usable data exists.

Browser responses can be cached for 120 seconds when live/partial and 60 seconds when cached/unavailable. Each headline retains its publisher and article publication timestamp. No headline is invented or redated. The snapshot contains titles and original article links, not copied article bodies.

Before building a new publication, refresh the verified snapshot with:

```sh
node scripts/refresh-news.mjs
```

This uses the same allowlisted sources and parser as the live route. The file is replaced atomically only when all configured feeds succeed; any failure leaves the previous good snapshot unchanged. It is a build/maintenance command, not a background scheduled job. Adding a new source requires updating the allowlist and checking its language, licensing and URL behaviour.

## Local development and migrations

Install dependencies according to the project README, then run:

```sh
npm run dev
npm run db:generate
npm run build
```

After the first build, apply the initial migration **once** to the local database:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_clean_silk_fever.sql
```

Local and hosted databases are separate. Hosted publication applies the committed schema migrations. For schema changes, update `db/schema.ts`, generate and inspect a new migration, then apply the new migration. Do not edit applied SQL or put sample data into migration files.

The starter's portable, loopback-only development profile has its own mock sign-in identity (`local_seedy`, `seedy@sites.test`). For that local profile only, configure `ADMIN_EMAILS=seedy@sites.test` in the ignored local runtime environment. The managed preview does not enable mock authentication; production uses platform identity. Never deploy a development bypass or a fake role selector as real authorization.

Run the backend verification with Node.js 22.13+ (Node.js 24 is used for this demo):

```sh
node scripts/test-workspace.mjs
```

The script transpiles the real backend into a private temporary directory and substitutes the transactional database/R2 test bindings and module imports. It exercises anonymous access, bootstrap restrictions, same-origin checks, member roles, private notes and messages, audit restrictions and hashes, automation, required fields, deactivation, stale writes, concurrent writes and tamper detection against transactional SQLite. Profile checks cover self/administrator permissions, required and bounded fields, protected image retrieval, MIME/signature/dimension/size rejection, one-photo replacement and removal, metadata-only audit events, and orphan cleanup after a conflicting upload. It does not write to the hosted database.

## Operational limits before wider rollout

The demo bounds records and request sizes to keep its single-document persistence predictable: 1,000 total tickets including archived tickets, 5,000 comments, 5,000 messages, 500 notes, 1,000 events, 100 members, 30 channels, 30 custom fields, 30 rules, 12 columns, a 64 KiB write request and roughly 1.5 MB serialized workspace state. Audit export is bounded to 10,000 events. These limits are explicit in the server.

A production expansion should migrate high-volume entities into separate indexed tables, define customer isolation, add independent backup/restore and retention policies, and integrate the selected identity provider, notification delivery and external evidence storage through supported platform capabilities. No claim of a security audit, penetration test, compliance certification or availability guarantee is made by this demo.
