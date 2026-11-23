# Verification record — NorthWallEg source and deployment

## Current source validation — 23 November 2026

These results describe the current source. The existing private Site, trusted platform gateway, D1 records and private R2 objects are retained. Preparing the separate Node target has not deployed the application to Hostinger, provisioned a real owner password, connected SMTP delivery or transferred production data.

| Suite | Recorded result | Scope |
| --- | --- | --- |
| Shared workspace/backend | **92 passed** | Actual backend with transactional SQLite and private-object fixtures |
| Shared news | **33 passed** | Deterministic source/parser, fetch, security, cache and timestamp cases |
| Shared HTTP/security | **17 passed** | HTTPS, nonces, method restrictions, trusted-header handling and private response policy |
| Core total | **142 passed** | 92 + 33 + 17; not a real MySQL or hosted employee-session result |
| Node authentication | **32 passed** | Authentication service, temporary-password gate, invitation enrollment, session and abuse-control fixtures |
| Node storage adapter | **15 passed** | Fixed SQL translation, prepared values, transaction/rollback contract and private BLOB adapter |
| Node HTTP boundary | **7 passed** | Canonical request origin, trusted identity boundary and HTTP handling |
| Built Next SSR/API origin | **1 passed** | Actual built Next application in an isolated loopback HTTP fixture |

The backend suite now covers owner-only invitation creation, separate acceptance and approval, seven-day acceptance/approval expiry, generation-bound replay and CAS races, delegated-admin limits, fail-closed legacy/sample accounts and no protected data before approval. It also verifies owner-only **empty real workspace** setup through `workspace.initialize`, labelled sample setup through `demo.initialize`, and refusal to overwrite either existing workspace.

Identity-continuity checks cover revoke/reissue for the same original identity, rejection of a different identity with a recycled email, repeated reissues retaining the anchor, legacy bound-ID retention and lost-binding failure. Replacement staff receive a separate record without the old employee's private notes, DMs or portrait. Non-owner responses and shared audit metadata omit the anchor field.

The Node adapter tests verify exact known SQL, bound literal values, binary identifier/hash conversion, one consistent audit snapshot, paired workspace/audit affected counts, rollback on errors and `INSERT IGNORE` warning handling. Portrait tests cover private BLOB bytes, limits and metadata. These scripted-driver cases do not demonstrate MySQL engine locking or a hosting account's capacity.

The built-Next test uses the actual compiled application and confirms matching script/CSP nonces, private/no-store and noindex responses, preserved request-body bytes, the canonical HTTPS API origin, rejection of cross-origin writes and refusal to treat forged visitor headers as authenticated identity. It intentionally stops before database access and uses no real employee account, production session or mailbox.

Integrated nonincremental TypeScript and diff checks passed. The current Worker and Node production builds passed, as did the built-Next render test. These source/build results are separate from historical Site publication evidence below. The authentication, storage and request-boundary source also received focused review; this is implementation review, not an independent penetration test or certification.

## Observed deployment checks and remaining gates

- **Real MySQL CI passed.** [GitHub Actions run 45096520691](https://github.com/23samjessen/NorthWall_EG/actions/runs/45096520691) completed successfully for `ab76a95da154d190c6d5027c59ad6ff8dc402d06` (matching Site source `ce3ac6872d7eb97ace67caafc419a02037403a0a`). The Node suite reported **68 passed, 0 failed, 0 skipped**: 54 unit/contract cases, seven real workspace/storage scenarios, five real authentication scenarios and two parent integration cases. Separate empty databases used the official MySQL 8.4 service. These checked actual setup/CAS concurrency, invitation persistence, consistent audit reads during a concurrent write, audit-failure rollback, a 2 MiB BLOB round trip, photo orphan cleanup, gated sign-in, atomic OTP consumption, enrollment and owner-revocation row locks. The duplicate-setup path uses a fixed `SHOW WARNINGS` query on the transaction connection because MySQL cannot prepare that diagnostic; all data statements remain bound. The same successful run passed TypeScript, all 142 core checks, dependency audit with zero findings, Worker and Node production builds, and the actual built-Next SSR/API check. Later changes to these verification documents do not change application code.
- **Private Site version 7 is deployed and its HTTP verification passed.** It was published from `8767a1d0747af706653a91cf6903cae0a0979863` on 23 November 2026. The supported private-service check made nine bounded requests without an employee identity: four HTML responses had distinct matching script/CSP nonces, no-store/noindex and no ETag; protected APIs denied anonymous access; unsupported writes/actions were rejected. News returned 48 live headlines from eight publishers with no feed errors at `2026-11-23T01:39:08.305Z`. These observations do not verify a real employee browser session or Hostinger deployment. The later MySQL compatibility change affects the separate Node target.
- **Hostinger deployment is not verified.** The selected plan/runtime, actual MySQL schema/packet allowance, HTTPS/renewal/redirect behavior, secure sessions and staged restore still require destination checks.
- **No live SMTP delivery or real owner-password provisioning is claimed.** Code and fixture checks exist. Mailbox credentials, hidden terminal provisioning, email-code delivery and the first-use password-change journey must be verified on the destination.
- **Existing data and identity migration are not complete.** Preserve the current Site while reviewing D1/R2 backups, MySQL import, authentication identity mapping and independent restore evidence. A source archive or audit export is not a complete backup.

## Historical security-hardening revision and Site v5 — 23 November 2026

- Integrated TypeScript check passed after the framework, build tool and validator updates.
- **106 automated checks passed:** 56 workspace/backend checks, 33 news checks and 17 HTTP security/validator checks. These use local fixtures, transactional SQLite and a private-object test adapter; they do not impersonate a production employee or scan third-party systems.
- SQL-looking values remained literal bound data. Malicious record selectors did not widen access or modify the schema. Employee/manager restrictions, private notes and direct messages, disabled accounts, upload permissions and administrator evidence access passed their regression checks.
- New request-body cases cover omitted, misleading and oversized Content-Length values. Workspace JSON is streamed within 64 KiB; photo-deletion JSON within 4 KiB. Exact JSON media-type validation rejects lookalike values.
- Audit-export checks covered a concurrent valid write, administrator revocation during export and an oversized UTF-8 history. The export uses one transactionally consistent snapshot, rechecks authorization and rejects over 10,000 events or 8 MiB of stored event-column data before retrieving event rows.
- New HTTP checks cover production HTTP-to-HTTPS redirects without trusting visitor forwarding headers, unpredictable per-request script nonces, visitor-header replacement, public method/action restrictions, private HTML/RSC/API caching, noindex, browser headers and preservation of the photo response's stricter sandbox. The unsupported generic Node startup path fails closed.
- A fresh full `npm audit --json --audit-level=high` completed successfully with **0 info, 0 low, 0 moderate, 0 high and 0 critical vulnerabilities** in the resolved dependency tree. This is a time-specific advisory scan, not a guarantee that the software has no vulnerabilities.
- The production Worker, SSR and client build passed. Upstream source-map and route-classification warnings remained; no compilation error occurred.
- The scoped esbuild override was verified with the actual Drizzle configuration/schema through its legacy loader, followed by schema generation into a disposable directory. Both commands exited successfully. The existing configuration, schema, package, lock and migration files remained unchanged; no database migration was applied.
- A separate read-only review confirmed Vinext 1.2.0 propagates the request CSP nonce to framework bootstrap and streamed scripts and excludes those requests from its shared response cache. Post-publication HTTP verification is recorded separately from these local checks; browser sign-in/hydration and authenticated employee journeys remain outside this local evidence.

**Historical deployment evidence:** private Site version 5 was deployed from `ea5ff9fa500b6087c380918c41b5dfc5ad32c855`. Supported service-access HTTP verification passed for four HTML responses with distinct matching script/CSP nonces, private/no-store caching and noindex; protected workspace/photo APIs returned 401 without employee identity; public POST and unsupported action dispatch returned 405/400. News returned live coverage with 48 headlines across eight publishers and no errors, fetched at `2026-11-23T00:49:38.531Z`. These checks did not exercise browser hydration or a real employee session and do not verify a later source revision.

See [SECURITY_REVIEW.md](SECURITY_REVIEW.md) for scope, versions and remaining risks. At the time of this historical Site check, the Node target had not been added. The current source includes that separate target, while actual Hostinger deployment and migration remain pending as listed above.

## Historical expanded-news, contact and insights revision — 23 November 2026

- Integrated TypeScript check passed. The existing 44 workspace/backend checks and the new 22 deterministic news checks passed. The news suite covers unsafe links/redirects, XML declarations, language, real date handling, topic evidence and negation, source balance, duplicate articles, partial/total failure, shared caching and fallback timestamps.
- A real eight-source refresh returned 48 headlines, six per configured source, with no feed errors at `2026-11-23T00:04:05.183Z`. Eight selected articles matched explicit SOAR evidence. The saved snapshot contains these actual responses; publisher publication dates were retained.
- The local browser showed all eight publishers and the labelled cached state when that preview could not reach upstream feeds. Combined **Splunk Security Advisories + SOAR** filters returned two relevant advisories. Cisco filtering returned six stories. An unmatched text search showed the empty state; clearing restored results. **Show 12 more headlines** expanded the display from 12 to 24 while filters continued to cover all 48.
- Browser review covered the seven technology controls, a SOAR options dialog, Sam's **Country Manager — Egypt** card and the preferred-contact selection carried into the brief form. Contact details label the supplied telephone as a shared company line. Social placeholders are labelled **Coming soon** and have no invented destinations.
- The insights hub and an original Microsoft 365 guide were visually reviewed. Guide navigation, numbered official references and related-service links rendered. Read-only metadata inspection confirmed the canonical URL, Egyptian Open Graph image, organization/article/breadcrumb structured data and `noindex, nofollow`.
- Narrow-layout inspection at 454 and 340 CSS pixels using browser zoom found no horizontal document overflow; the guide collapsed to one column and news filters stacked with readable controls. Desktop zoom was restored after inspection. This was responsive layout QA, not physical-device testing.
- Public-contact configuration checks confirmed the first-title hierarchy, English/Arabic records, rejected unsafe or mismatched social URLs and hidden unconfigured socials with review mode disabled in an isolated render. The delivered configuration keeps `website.isReviewDemo: true`.
- No employee identity, role, database schema or stored photo was changed by this revision. The production build and exact-source publication are performed by the publishing workflow after these source/UI checks; hosted deployment results are reported with the delivered version.

The observations below are retained as evidence from earlier revisions. Their three-source news counts describe the earlier deployment, not the expanded feed above.

## Earlier automated checks

- TypeScript: `npx tsc --noEmit` passed on the integrated source.
- Production Worker/client build: Sites build helper passed.
- Backend: `node scripts/test-workspace.mjs` passed 44 meaningful checks against the actual backend with transactional SQLite and an R2 test adapter, including the profile/photo revision dated 23 November 2026.
- News: the same allowlisted parser retrieved 24 current publisher headlines from Microsoft Security, Microsoft Blog and Cloudflare. A targeted total-outage test returned the saved real headlines with `cached` status, preserved original retrieval time, separate attempt time and a one-minute retry window.

The backend checks cover missing identity, unauthorized bootstrap, same-origin enforcement, active membership, privilege escalation, one-time setup, private notes/DMs, inaccessible forwarding, admin-only evidence, private-content redaction, stable identity binding, working automation, required fields, member deactivation, stale/concurrent writes and audit tamper detection.

## Earlier browser observations

The development preview was opened in the browser and visually inspected. The new hero image, NW branding, public page composition, English navigation, Arabic RTL layout, service filtering, Midnight colour switching and a service-detail modal/page rendered. The signed-out workspace displayed the intended access screen, without private records. The managed local preview does not simulate employee identity.

The separate review site uses production hosting. The earlier public NorthWall site is outside this demo's deployment and is not modified.

## Earlier hosted deployment observations — 22 November 2026

- Private publication succeeded at `https://northwalleg-design-demo.dark-hawk-6582.chatgpt.site/` on 22 November 2026. The confirmed Site audience is the owner only.
- The hosted D1 binding `DB` contains the migrated `workspace` and `audit_events` tables.
- A supported private-service read of the deployed `/api/news` endpoint returned HTTP 200, `status: live`, **24 headlines**, three publishers and no feed errors. Its successful retrieval/attempt timestamp was `2026-11-22T22:06:06.216Z`. Publishers were Microsoft Security, Microsoft Blog and Cloudflare Blog.
- The browser displayed the intended private-site sign-in gate. That browser did not have the owner's authenticated session. No password was collected, no identity headers were fabricated and no production authentication bypass was introduced.
- Consequently, end-user hosted sign-in, first-use sample initialisation and authenticated hosted writes were **not exercised in that browser**. The owner can review these by opening the demo, signing in and choosing **Load sample workspace**. The schema is deployed, but this record does not claim an observed owner-authenticated production write.

## Earlier isolated workspace interaction checks

The production workspace component and styles were bundled into a separate, clearly labelled visual-test fixture. It used fictional in-browser records and the actual action reducer, with no access to the hosted database or real employee accounts. These checks validate interaction and layout separately from deployed authentication and persistence:

- Created an assigned high-priority ticket with a due date and Cairo/Copenhagen location. Dashboard totals changed from 12 to 13 and open work from nine to ten.
- Added a comment with a teammate mention, a targeted reply showing the original quoted comment, and a counted emoji reaction.
- Created a calendar event with start/end times, location and an attendee; confirmed it in the agenda.
- Opened a troubleshooting runbook with steps, evidence notes and source controls.
- Added an administrator workflow column and confirmed its name and ticket count in the settings screen.
- Viewed the administrator evidence table and inspected an event's actor, UTC timestamp, action, change, request ID and previous/current hashes. These particular browser events belonged to the synthetic fixture; actual server audit integrity is covered by the backend tests.
- Fixed a calendar CSS selector that accidentally constrained event labels to the date-number width. Rebuilt the fixture and visually confirmed events use the available cell width.

That review also corrected nullable news retrieval timestamps, preserved the last successful retrieval time during failures, separated checks from retrievals and aligned both interfaces to poll every two minutes. Its account-link labels reflected the then-current first-write binding. Current source supersedes that behavior with explicit invitation acceptance, separate owner approval and a retained identity-continuity anchor.

## Historical profile and company-content revision — 23 November 2026

- The integrated TypeScript check passed with the new employee profile component, member fields and private photo endpoint.
- Backend checks cover required profile fields, field-length limits, self/admin permissions, rejected role or identity escalation, active-member photo reads, MIME/signature/dimension bounds, same-origin writes, one-photo replacement, stale-revision rejection and orphan cleanup.
- Tests verify that photo audit records include server timestamps, actor, target and image metadata/hash without the original filename, binary bytes or R2 object key. Existing members receive derived completion metadata without a database reset.
- The public team section was visually reviewed with separate monogram placeholders and the requested Pernille Jessen and Sam Jessen titles. Blank registration/contact templates remain hidden. Public photograph configuration accepts local assets consistent with the deployed image policy.
- In the clearly labelled isolated browser fixture, a profile title, department and location were edited and saved; the updated title appeared in the profile, directory and sidebar. The directory search selected a teammate and opened the administrator editor.
- The same fixture exercised the file chooser, PNG preview, save, completion change from 1/2 to 2/2, directory portrait, removal confirmation and return to initials. These photo operations used synthetic browser-memory storage; they did not upload real employee data or exercise hosted R2.
- Hosted authenticated employee writes remain subject to the earlier browser limitation. No real employee photograph or new employee account was created during this review. Production image bytes are retained as supplied, including embedded metadata; no image re-encoding or metadata stripping is claimed.
- The final service hierarchy was visually inspected in the Limestone and Midnight designs and Arabic RTL: Microsoft 365 & Cloud and Cyber Defence are the two primary panels. A Networks & VPN icon opened its eight detailed options and full-page link. Hiding the secondary grid and searching for IoT reopened the matching icon with its five options. The seven secondary services remain available under More services.

## Scope of assurance

These checks provide concrete implementation evidence. They are not an independent penetration test, a compliance certification, a load test, a formal forensic accreditation or a guarantee of zero vulnerabilities. A final customer-facing release needs its approved domain/company details, chosen identity and data-retention model, real team access, service delivery arrangements and independent backup/monitoring procedures.
