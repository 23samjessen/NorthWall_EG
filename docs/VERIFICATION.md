# Verification record — NorthWallEg review demo

## Expanded news, contact and insights revision — 23 November 2026

- Integrated TypeScript check passed. The existing 44 workspace/backend checks and the new 22 deterministic news checks passed. The news suite covers unsafe links/redirects, XML declarations, language, real date handling, topic evidence and negation, source balance, duplicate articles, partial/total failure, shared caching and fallback timestamps.
- A real eight-source refresh returned 48 headlines, six per configured source, with no feed errors at `2026-11-23T00:04:05.183Z`. Eight selected articles matched explicit SOAR evidence. The saved snapshot contains these actual responses; publisher publication dates were retained.
- The local browser showed all eight publishers and the labelled cached state when that preview could not reach upstream feeds. Combined **Splunk Security Advisories + SOAR** filters returned two relevant advisories. Cisco filtering returned six stories. An unmatched text search showed the empty state; clearing restored results. **Show 12 more headlines** expanded the display from 12 to 24 while filters continued to cover all 48.
- Browser review covered the seven technology controls, a SOAR options dialog, Sam's **Country Manager — Egypt** card and the preferred-contact selection carried into the brief form. Contact details label the supplied telephone as a shared company line. Social placeholders are labelled **Coming soon** and have no invented destinations.
- The insights hub and an original Microsoft 365 guide were visually reviewed. Guide navigation, numbered official references and related-service links rendered. Read-only metadata inspection confirmed the canonical URL, Egyptian Open Graph image, organization/article/breadcrumb structured data and `noindex, nofollow`.
- Narrow-layout inspection at 454 and 340 CSS pixels using browser zoom found no horizontal document overflow; the guide collapsed to one column and news filters stacked with readable controls. Desktop zoom was restored after inspection. This was responsive layout QA, not physical-device testing.
- Public-contact configuration checks confirmed the first-title hierarchy, English/Arabic records, rejected unsafe or mismatched social URLs and hidden unconfigured socials with review mode disabled in an isolated render. The delivered configuration keeps `website.isReviewDemo: true`.
- No employee identity, role, database schema or stored photo was changed by this revision. The production build and exact-source publication are performed by the publishing workflow after these source/UI checks; hosted deployment results are reported with the delivered version.

The observations below are retained as evidence from earlier revisions. Their three-source news counts describe the earlier deployment, not the expanded feed above.

## Automated checks

- TypeScript: `npx tsc --noEmit` passed on the integrated source.
- Production Worker/client build: Sites build helper passed.
- Backend: `node scripts/test-workspace.mjs` passed 44 meaningful checks against the actual backend with transactional SQLite and an R2 test adapter, including the profile/photo revision dated 23 November 2026.
- News: the same allowlisted parser retrieved 24 current publisher headlines from Microsoft Security, Microsoft Blog and Cloudflare. A targeted total-outage test returned the saved real headlines with `cached` status, preserved original retrieval time, separate attempt time and a one-minute retry window.

The backend checks cover missing identity, unauthorized bootstrap, same-origin enforcement, active membership, privilege escalation, one-time setup, private notes/DMs, inaccessible forwarding, admin-only evidence, private-content redaction, stable identity binding, working automation, required fields, member deactivation, stale/concurrent writes and audit tamper detection.

## Browser observations

The development preview was opened in the browser and visually inspected. The new hero image, NW branding, public page composition, English navigation, Arabic RTL layout, service filtering, Midnight colour switching and a service-detail modal/page rendered. The signed-out workspace displayed the intended access screen, without private records. The managed local preview does not simulate employee identity.

The separate review site uses production hosting. The earlier public NorthWall site is outside this demo's deployment and is not modified.

## Hosted deployment observations

- Private publication succeeded at `https://northwalleg-design-demo.dark-hawk-6582.chatgpt.site/` on 22 November 2026. The confirmed Site audience is the owner only.
- The hosted D1 binding `DB` contains the migrated `workspace` and `audit_events` tables.
- A supported private-service read of the deployed `/api/news` endpoint returned HTTP 200, `status: live`, **24 headlines**, three publishers and no feed errors. Its successful retrieval/attempt timestamp was `2026-11-22T22:06:06.216Z`. Publishers were Microsoft Security, Microsoft Blog and Cloudflare Blog.
- The browser displayed the intended private-site sign-in gate. That browser did not have the owner's authenticated session. No password was collected, no identity headers were fabricated and no production authentication bypass was introduced.
- Consequently, end-user hosted sign-in, first-use sample initialisation and authenticated hosted writes were **not exercised in that browser**. The owner can review these by opening the demo, signing in and choosing **Load sample workspace**. The schema is deployed, but this record does not claim an observed owner-authenticated production write.

## Isolated workspace interaction checks

The production workspace component and styles were bundled into a separate, clearly labelled visual-test fixture. It used fictional in-browser records and the actual action reducer, with no access to the hosted database or real employee accounts. These checks validate interaction and layout separately from deployed authentication and persistence:

- Created an assigned high-priority ticket with a due date and Cairo/Copenhagen location. Dashboard totals changed from 12 to 13 and open work from nine to ten.
- Added a comment with a teammate mention, a targeted reply showing the original quoted comment, and a counted emoji reaction.
- Created a calendar event with start/end times, location and an attendee; confirmed it in the agenda.
- Opened a troubleshooting runbook with steps, evidence notes and source controls.
- Added an administrator workflow column and confirmed its name and ticket count in the settings screen.
- Viewed the administrator evidence table and inspected an event's actor, UTC timestamp, action, change, request ID and previous/current hashes. These particular browser events belonged to the synthetic fixture; actual server audit integrity is covered by the backend tests.
- Fixed a calendar CSS selector that accidentally constrained event labels to the date-number width. Rebuilt the fixture and visually confirmed events use the available cell width.

Final review also corrected nullable news retrieval timestamps, preserved the last successful retrieval time during refresh failures, distinguished checks from retrievals, and aligned both interfaces to request news every two minutes while open. Account-link labels now match the backend's first-successful-write binding behaviour.

## Profile and company-content revision — 23 November 2026

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
