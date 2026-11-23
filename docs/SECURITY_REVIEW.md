# NorthWallEg security review and hardening record

**Review date:** 23 November 2026  
**Application:** NorthWallEg website and employee workspace  
**Scope:** Repository source, dependency advisories, local regression tests and production build  
**Release/source:** The Git commit containing this report; exact hosted revision is recorded below.  
**Updated private-host verification:** HTTP verification passed against private Site version 7 on 23 November 2026; the current record is in VERIFICATION.md. The version-5 details below remain historical evidence.

## 1. Assessment

The reviewed changes strengthen request handling, database evidence consistency, browser protections, publisher-feed parsing and dependency maintenance. The integrated checks now pass **142 core regression checks**, plus **55 Hostinger authentication/storage/HTTP/render checks**, TypeScript and the production Worker/client build, including the final HTTPS redirect addition. A fresh dependency audit reports **zero known findings at every severity** for the scanned dependency graph on the review date.

**Full migration to Hostinger is not complete.** The owner has selected **northwallegy.com** and wants the complete application running on Hostinger. The exact account resources remain unconfirmed. A standard Next.js Node entry, MySQL/private-photo adapter and independent password/email-code authentication are now implemented. The Node variant resolves identity exclusively from a verified AsyncLocalStorage request context, so visitor authority headers cannot impersonate employees. Real Hostinger provisioning, SMTP delivery, data migration and domain verification remain incomplete.

The existing Site remains the private review environment. Private Site version 7 was deployed successfully and checked through the supported service-access path without an employee identity. The evidence below separates those HTTP checks from authenticated browser journeys that have not been completed. Public launch and indexing remain disabled until the intended launch decision. This report is a focused engineering security review, not a guarantee against compromise, an independent penetration-test certificate or a claim of production readiness.

### Verified evidence and remaining verification

| Check | Recorded result |
| --- | --- |
| Backend regression suite | **92 passed** |
| News regression suite | **33 passed** |
| HTTP security regression suite | **17 passed**, including production HTTPS redirection and HTTPS-loop/forwarded-header cases |
| Total regression checks | **142 passed** |
| TypeScript | **Passed**: `npx tsc --noEmit` |
| Dependency audit | **Passed, exit 0**, 23 November 2026: info 0, low 0, moderate 0, high 0, critical 0, total 0 |
| Worker/client production build | **Passed**, including the HTTPS redirect; upstream sourcemap/static-classification warnings remain |
| Patch whitespace validation | **Passed**: `git diff --check` |
| Final installed override/configuration smoke evidence | Passed: actual Drizzle configuration/schema loaded through the legacy loader with esbuild 0.25.12; disposable generation produced both tables without changing the seven checked source/package/migration files or touching a database |
| Deployment revision and private audience | **Version 5 succeeded**; owner-only audience retained; runtime environment revision 1 |
| Hosted CSP/nonce, API rejection and news checks | **Passed** for four HTML responses, two protected API rejections, two unsupported-action/method rejections and the live news response; browser hydration not exercised |
| Hostinger deployment | **Not completed**; destination plan and architecture must be confirmed |

Dependency results describe the advisory database and resolved graph at scan time. They do not prove that all application logic is secure or predict future advisories. Test counts are regression checks, not vulnerability counts.

## 2. Review method and boundaries

The review inspected `lib/workspace-server.ts`, API routes, the database schema, profile storage handling, `lib/security-headers.ts`, `worker/index.ts`, news parsing/cache modules, framework configuration and dependency manifests. Local fixtures exercised the actual backend using transactional SQLite and a substitute object-store binding. News and HTTP tests used controlled fixtures. Application security controls were compared with the primary OWASP guidance listed below.

No intrusive scan of a deployed site or extraction of private employee runtime data was used for this review. The work did not assess Hostinger's infrastructure, the current identity provider's internals, third-party network controls, staff account security or an unconfigured future destination. A package advisory's presence was not treated as proof that every exploit prerequisite existed in this application.

## 3. Findings and implemented changes

Severity describes the practical concern in the stated context; these are qualitative engineering ratings, not assigned CVSS scores.

| ID | Severity/context | Finding and response | Status |
| --- | --- | --- | --- |
| NW-01 | **Critical if migrated without trusted authentication** | Incoming `oai-authenticated-*` values are trusted only because the current hosting gateway supplies them. A directly exposed server accepting visitor-selected values could permit impersonation. The default startup guard refuses an unselected runtime; the Hostinger variant uses verified server sessions and request-scoped identity, never client authority headers. | Implemented; built Next API rejects forged identity headers. Actual destination provisioning remains required. |
| NW-02 | **Medium — availability** | Workspace POST formerly buffered its entire body before applying the 64 KiB check. It now counts streamed bytes, stops on overflow and rejects invalid/oversized declared lengths early. | Implemented; regression covered. |
| NW-03 | **Medium — evidence integrity** | Separate reads of the audit head and events could falsely report tampering during a legitimate concurrent write. A transactional read batch now captures a consistent snapshot and rechecks administrator access within it. | Implemented; concurrent-write and access-revocation tests pass. |
| NW-04 | **Medium — availability** | A row-count limit alone allowed a large audit export to consume excessive memory. SQL now measures stored bytes and returns no event rows when either export limit is exceeded. | Implemented; oversized UTF-8 fixture verifies zero event rows returned. |
| NW-05 | **Medium — constrained upstream-input risk** | Malformed publisher markup could cause excessive scanning in the former regex-based parsing. Forward-moving parsing, bounded fields/tags/attributes and malformed-input rejection replace that path. | Implemented; news regressions pass. |
| NW-06 | **Low — configuration hardening** | An unset administrator allowlist previously selected a built-in email. Missing or empty `ADMIN_EMAILS` now denies empty-workspace setup. | Implemented; explicit current-host configuration is retained. |
| NW-07 | **Low — input-contract hardening** | Prefix matching accepted JSON-like media types. JSON routes now require the exact `application/json` media type, with normal parameters allowed. | Implemented; workspace and photo-deletion tests pass. |
| NW-08 | **Browser/request hardening** | General inline script permission and broad framework dispatch increased unnecessary exposure. Production uses fresh script nonces; unused action dispatch and unsupported HTTP methods are rejected. The portrait's stricter CSP is preserved. | Source, fixtures and deployed HTTP/script-markup behaviour verified; browser hydration remains unverified. |
| NW-09 | **Dependency risk varies by advisory** | Framework, runtime tooling and selected transitive dependencies were updated. Narrow overrides address specific remaining dependency paths. | Integrated tests/build and fresh audit pass; configuration/schema smoke and disposable generation also passed. |

### SQL injection and business authorization

No concrete SQL injection was identified in the reviewed workspace queries. Query structure is application-owned; variable values use prepared statements and `.bind(...)`. The audit byte expression is a fixed list of known columns, not a client-provided SQL fragment. Custom workflow fields are validated data inside the workspace model and do not become table or column names.

Regression inputs containing quotes, SQL comments and SQL-looking statements remain literal ticket text, checklist identifiers, comments and audit actor names. SQL-looking record selectors fail to match records, the schema remains unchanged and the audit chain remains valid. This is the separation of query structure from data recommended by OWASP. Parameterisation does not replace authorization. [1]

Protected operations independently check active membership and the required role. Employees cannot grant themselves administration, managers cannot read administrator evidence, and self-profile updates reject role/email/identity changes. Private notes are filtered by ownership; direct messages require participation for reads, forwarding and reactions. Deactivated members fail subsequent protected requests. OWASP recommends default denial and permission checks on every request; the tests exercise those boundaries explicitly. [2]

Team tickets and ordinary channels are intentionally shared among active employees. This is a single-company workspace, not an isolated customer-tenant portal. An authorized participant can intentionally forward accessible discussion content; that feature is not a confidentiality barrier against the participant.

## 4. Authentication, CSRF and request limits

The application has no shared demo password. Current identity comes from the trusted Sites gateway, followed by the application's own membership lookup. Owner-created invitations bind to the stable platform user ID only when the invited person explicitly accepts. Acceptance grants no employee access; separate owner approval is required. Non-owner legacy records without approval fail closed. `ADMIN_EMAILS` controls only setup of an empty workspace; changing it does not promote users in an existing workspace.

State-changing requests enforce the origin and Fetch Metadata checks. Cross-site requests and requests marked as coming from sibling origins are rejected; the provided origin must match the destination. If Origin is absent, the request must still establish `Sec-Fetch-Site: same-origin`. JSON API routes reject simple text/form content types and JSON media-type lookalikes. These controls address browser CSRF; they are not proof of a caller's identity and cannot replace verified sessions on Hostinger. [3]

| Input or export | Enforced bound |
| --- | --- |
| Workspace JSON POST | 65,536 bytes, checked while streaming before parsing |
| Profile-photo JSON DELETE | 4,096 bytes, checked while streaming |
| Uploaded portrait | 2 MiB per image |
| Complete multipart portrait request | 2 MiB plus 16 KiB of form overhead |
| Portrait dimensions | At most 8,192 pixels per side and 16 million pixels total |
| Stored workspace payload | 1,500,000 encoded bytes |
| Application audit export | At most 10,000 events and 8 MiB of stored event-column data |
| Publisher-feed response | 2,000,000 bytes and a seven-second fetch deadline |

Absent or understated `Content-Length` cannot bypass the streaming caps. Per-request bounds do not provide a deployment-wide rate limiter or a denial-of-service guarantee. Destination rate controls, resource quotas and monitoring still need to be configured and tested.

### Requested Hostinger sign-in verification

The Hostinger variant implements password verification followed by a one-time code sent to the account email. SMTP delivery must be configured and tested in the actual account. SMS is disabled and not implemented. The existing private Site retains its provider sign-in. The Node service withholds full identity until code verification and any mandatory initial-password replacement succeed. Email codes provide a lower-assurance second step; they are not a basis for claiming NIST AAL2 conformity. Stronger passkey or authenticator-based protection is recommended for administrators. The detailed expiry, attempt, resend, enrollment and recovery requirements are in [AUTHENTICATION_AND_MFA.md](AUTHENTICATION_AND_MFA.md).

## 5. Audit consistency and evidence limits

Every successful workspace mutation records a server-generated UTC timestamp, actor, action, object, request identifier, change evidence and previous/current SHA-256 hashes. State changes and audit insertion share a transactional compare-and-swap operation using the previous revision and hash. A stale writer receives a conflict without losing another user's update or adding a successful-change event.

For exports, one transaction obtains the workspace head, totals and conditionally selected events. SQL counts the bytes of **every stored audit column**, including multibyte UTF-8, before history rows enter application memory. Above either bound the row query returns zero rows and the API responds with `413 export_too_large`. The 8 MiB limit measures stored column data; serialized JSON framing can make the download larger. A complete protected database backup is the appropriate route for history beyond the application export limit.

The chain verifies event sequence/hash consistency against the stored head. It does not cryptographically attest every byte of the current workspace payload or provide immutable storage. A database operator can alter data and reconstruct hashes. Independent retention of trusted exports/heads is needed when evidence preservation matters; there is no WORM retention, independent signing authority or certified chain-of-custody process. OWASP distinguishes useful logging from protected log retention and tamper detection. [7]

Private-note titles/bodies and direct-message bodies are represented in audit evidence by hashes and metadata, rather than the original text. Hashing is not encryption and should not be described as anonymity. Ordinary team-discussion evidence can contain its text. Successful application changes are recorded; complete sign-in, denied-request, infrastructure and read-access logging require the relevant platform and operational logs.

## 6. Browser protections and request dispatch

Production requests receive a cryptographically random script nonce. Visitor-supplied nonce and CSP request headers are removed before the trusted values are passed to rendering. The script policy uses the generated nonce and `strict-dynamic`; it omits `unsafe-inline` for scripts and blocks inline event-handler attributes. The renderer applies the nonce to intended scripts rather than blindly adding it to arbitrary markup. This follows the nonce-based CSP approach described by OWASP. [4]

**HTTPS is mandatory.** Production HTTP requests receive an HTTP **308 redirect to HTTPS**, and requests already using HTTPS do not enter a redirect loop. Visitor-supplied forwarded-protocol headers do not establish that a request is secure. Production responses also carry HSTS. Destination TLS certificates, automatic renewal and the HTTP-to-HTTPS redirect must be configured and verified on Hostinger; HSTS does not issue or renew a certificate.

Rendered documents, employee APIs and error responses use private/no-store caching, with stale entity tags removed where required. Response handling adds `nosniff`, HTTPS transport policy in production, resource/referrer restrictions and browser permission limits. Existing stricter portrait/download policies survive the common response wrapper. Inline styles remain permitted for the current interface; CSP is an additional layer, not a substitute for safe output handling.

The application uses explicit API routes and does not expose a business workflow through Server Actions. Requests carrying `Next-Action` are rejected before framework handling. Public routes accept read methods; mutation methods are allowed only on the intended workspace/photo paths. These guards reduce unused attack surface and do not replace framework patches. Hosted nonce and API behaviour are recorded below. Browser hydration, client navigation and authenticated employee journeys remain outside this HTTP-only verification.

## 7. Private portrait handling

Portrait upload requires active membership, profile ownership or administrator permission, same-origin checks and a current revision. Only PNG, JPEG and WebP are accepted. MIME labels are checked against signatures, structural headers and dimensions; SVG, GIF, animated PNG/WebP, oversized input and incompatible content are rejected.

Storage keys are generated by the server, and original upload filenames do not become paths. The R2 bucket is private; the authenticated image route returns fixed raster MIME, `nosniff`, same-origin resource policy, private/no-store caching and a restrictive sandbox CSP. Replacements store a new object before committing the pointer, remove the old object only after success and clean up the unused new object after a known revision conflict.

These controls apply the layered type, size, filename, authorization and storage protections recommended for uploads. [5] They do not fully decode/re-encode the image, strip EXIF metadata or perform malware scanning. Embedded metadata remains in retained bytes. On Hostinger, private storage must remain outside the public asset path and survive restarts/deployments; copying the Git repository does not migrate portraits.

## 8. Official-feed processing

News URLs come from a fixed eight-source allowlist. Users cannot submit arbitrary server-fetch URLs. Requests and article links require HTTPS, approved exact hostnames, no credentials and no nondefault port. Redirects are handled manually and checked before following, with at most three redirects. These controls address the allowlist/redirect risks discussed by OWASP for server-side requests. [6]

The parser rejects external-entity/DOCTYPE declarations and explicitly non-English metadata. It uses bounded, forward-moving scans, caps tags/attributes and raw text, and masks comments/CDATA in its search view so quoted markup cannot become a new entry or link. Display text is stripped of markup and rendered as text. The retained article set is source-balanced and limited to 48 headlines.

Cached headlines retain their actual successful-fetch and publication timestamps; a current attempt has its own timestamp. Empty SOAR coverage is not labelled as a publisher outage. These are accuracy controls as well as operational safeguards. Publisher compromise, outages and previously unknown parser bugs remain residual risks; the source allowlist is not a blanket statement that all upstream content is safe.

## 9. Dependency remediation

The current manifest records the following changes. The exact resolved graph belongs to `package-lock.json`; an advisory's applicability depends on the affected feature and runtime being reachable.

| Dependency area | Updated version(s) | Evidence and scope |
| --- | --- | --- |
| React, React DOM, React Server DOM Webpack | 19.2.9 | The RSC advisory identifies 19.2.9 as a patched branch version. Its exploit prerequisites are specific; no successful application exploit was asserted. [9] |
| Next.js and matching ESLint configuration | 16.4.5 | The cited Next.js fix concerns sensitive cookie values on certain Edge-runtime responses. The package was updated without assuming this app exercised that exact path. [10] |
| Vinext and Vite RSC plugin | 1.2.0 and 0.5.37 | The maintainer requires the paired update for the closure-binding fixes; the application additionally rejects unused action dispatch. [11] |
| Vite and Cloudflare tooling | Vite 8.3.8; Vite plugin 1.70.1; Wrangler 4.164.0; Worker types 5.20261117.1 | Updated toolchain recorded in the manifest and covered by the integrated build/audit. Tooling findings can concern development/build contexts rather than deployed request paths. |
| Zod | 4.6.7 | Manifest update covered by integrated typing, tests and build. |

Two overrides are deliberately narrow:

- **`fflate@0.7.3` → `0.7.5`:** selects the fixed patch within that branch for the exact affected version. The advisory concerns malformed ZIP64 handling. This does not establish that the public workspace accepts ZIP uploads. [12]
- **`@esbuild-kit/core-utils@3.3.2` → `esbuild@0.25.12`:** updates the legacy transitive path without forcing one esbuild version throughout unrelated tooling. The cited advisory concerns the development server's cross-origin behaviour; it is not evidence of a production database exploit. The configuration-load smoke result should be retained with the final verification. [13]

The former Miniflare/Sharp pin was removed as part of the toolchain update. No advisory suppression or cosmetic version-string change is counted as remediation. OWASP recommends managing vulnerable components continuously and testing compatibility after changes; a clean advisory scan is a time-bounded result. [8]

## 10. Hostinger migration and remaining operational work

The intended destination is the **full application on Hostinger using northwallegy.com**. The supplied screenshots show the Node web-app import flow and a separate File Manager view. Use Node deployment with the custom entry and the settings in HOSTINGER_AND_DOMAIN.md; a source upload into public_html cannot start the backend.

Before destination access is enabled, complete and verify:

1. Configure and deploy the implemented Node entry with `npm run build:hostinger` and `hostinger/server.mjs`. Keep `PUBLIC_LAUNCH=false` until the owner decides to launch.
2. Real server-verified authentication, secure sessions and stable member identity mapping. Strip visitor-supplied gateway identity headers; never use them as a standalone login protocol.
3. Transactional destination storage and a verified transfer of workspace records, memberships, revision and audit history without resetting the demo or rewriting historical hashes.
4. Durable private portrait storage, object/reference transfer and authorization checks after restarts and redeployments.
5. Protected backups, a demonstrated restoration, request-rate controls, monitoring, patch ownership and a rollback/cutover procedure that avoids conflicting writes in two systems.
6. Mandatory HTTPS with a valid certificate for northwallegy.com and the selected additional hostnames, automatic certificate renewal, verified HTTP-to-HTTPS redirects without loops, final origin/callback settings and tests of anonymous, employee, manager, administrator and disabled-member access.

Keep the approved design and workspace features during migration. Preserve the current private Site and its data while destination verification is incomplete. `noindex` is not an access-control mechanism; the new staging environment needs its own protection. See [HOSTINGER_AND_DOMAIN.md](HOSTINGER_AND_DOMAIN.md) for the detailed migration plan and [BACKEND.md](BACKEND.md) for current contracts.

## 11. Reproducible checks and release completion

From a clean checkout with the approved lockfile and a supported patched Node.js runtime:

```sh
npm ci
npx tsc --noEmit
npm run test:backend
npm run test:news
npm run test:security
npm run audit:dependencies
npm run build
git diff --check
```

Retain the scan date and resolved lockfile with the release. Review newly reported advisories and their actual prerequisites; rerun the relevant regression checks after a targeted change. Database/photo backups and credentials belong in protected operational storage, not the public repository.

### Hosted verification and remaining deployment work

- **Verified application source:** `ea5ff9fa500b6087c380918c41b5dfc5ad32c855`, private Site **version 5**. This is historical version-5 evidence. Later invitation and Hostinger source changes have their own local checks and publication records; this entry does not claim to verify those later versions.
- **Publication:** succeeded on 23 November 2026 with runtime environment revision 1. The owner-only audience was retained.
- **Verification completed:** `2026-11-23T00:50:09.265208+00:00` (UTC). Nine bounded HTTP requests used the platform-provided service token for this exact Site. No employee identity was supplied or fabricated, and no workspace mutation was performed.
- **HTTPS and documents:** HTTPS requests succeeded. Four responses (`/` twice, `/insights`, `/workspace`) used four distinct nonce values; every rendered script tag matched its response CSP nonce. HTML had private/no-store caching, no ETag, nosniff and noindex/nofollow.
- **Access rejection:** `/api/workspace` and `/api/profile-photo` returned 401 without an employee identity. A public POST returned 405; unsupported `Next-Action` dispatch returned 400.
- **News:** the deployed endpoint returned `live`, **48 headlines**, all **eight** configured sources and no feed errors. Successful fetch time: `2026-11-23T00:49:38.531Z` (UTC).
- **Build and dependency checks:** final production build including HTTPS redirect passed; full dependency audit reported zero known findings. The Drizzle loader/configuration/schema smoke and disposable generation passed with the scoped esbuild override; no database was accessed or migrated.
- **Still unverified:** browser hydration/client navigation under the new CSP, real employee MFA/sign-in and role journeys, and Hostinger infrastructure/runtime/TLS certificate renewal and final-domain redirects. The current Node variant implements email-code verification, but live delivery and Hostinger employee sessions remain unverified; SMS is not implemented.

HTTP markup checks confirm nonce propagation but do not execute browser JavaScript. The service token opens the private Site transport boundary and supplies no employee identity. Hostinger migration and public launch are not claimed by these results.

## References

Primary guidance and advisories checked 23 November 2026. The OWASP references guide control selection; citing them does not assert complete compliance with every recommendation.

[1] OWASP, “SQL Injection Prevention Cheat Sheet.” <https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html>

[2] OWASP, “Authorization Cheat Sheet.” <https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html>

[3] OWASP, “Cross-Site Request Forgery Prevention Cheat Sheet.” <https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html>

[4] OWASP, “Content Security Policy Cheat Sheet.” <https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html>

[5] OWASP, “File Upload Cheat Sheet.” <https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html>

[6] OWASP, “Server Side Request Forgery Prevention Cheat Sheet.” <https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html>

[7] OWASP, “Logging Cheat Sheet.” <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>

[8] OWASP, “Vulnerable Dependency Management Cheat Sheet.” <https://cheatsheetseries.owasp.org/cheatsheets/Vulnerable_Dependency_Management_Cheat_Sheet.html>

[9] React/GitHub Advisory Database, GHSA-xqc2-xf4c-x3h3, React Server Components advisory. <https://github.com/advisories/GHSA-xqc2-xf4c-x3h3>

[10] Vercel/GitHub Advisory Database, GHSA-f3mh-rxg3-f5g2, Next.js Edge response-cookie advisory. <https://github.com/advisories/GHSA-f3mh-rxg3-f5g2>

[11] Cloudflare, Vinext security advisory GHSA-8969-277p-8rrm. <https://github.com/cloudflare/vinext/security/advisories/GHSA-8969-277p-8rrm>

[12] GitHub Advisory Database, GHSA-px8p-9vwx-vf98, fflate ZIP64 parsing advisory. <https://github.com/advisories/GHSA-px8p-9vwx-vf98>

[13] esbuild/GitHub Advisory Database, GHSA-67mh-4wv8-2f99, development-server cross-origin advisory. <https://github.com/advisories/GHSA-67mh-4wv8-2f99>

## 13. Owner approval and Hostinger source revision

The owner alone creates, reissues, approves and revokes invitations or changes roles. Acceptance binds the verified identity but leaves the member inactive. Approval grants employee access; administrator promotion is separate. The seven-day invitation deadline applies to both acceptance and approval. Stable identity anchors survive reissue/revocation, preventing a recycled email from inheriting a historical member record. Non-owner legacy records without valid approval fail closed. Both clean and sample initialization are one-time owner actions. The backend suite now passes 92 checks.

The new Node implementation passes 32 authentication checks, 15 MySQL adapter contract checks, seven HTTP/configuration checks and one actual built-Next SSR/API integration check. The latter verifies fresh nonce coverage on framework/authored scripts, no-store, canonical HTTPS request origins, preserved POST bodies, cross-origin denial and 401 for forged authority headers without verified request context. Local fake-mail/memory-store checks are not claims of delivered emails or live MySQL operation. The two opt-in MySQL suites passed all seven workspace/storage and five authentication scenarios in GitHub Actions run 45096520691, with no skipped Node cases. That run also passed both production builds, the built-Next integration check and dependency audit with zero findings; VERIFICATION.md records its exact commit. These isolated MySQL results do not establish a configured Hostinger account or real email delivery.

Authentication uses scrypt N=131072/r=8/p=1, unique salts and bounded concurrent KDF work. Six-digit code verifiers are secret-keyed HMACs, expire in five minutes and allow five attempts; resends rotate the code/pending token after at least 60 seconds. Full sessions use random 256-bit opaque tokens stored only by hash, with Secure/HttpOnly/__Host-/SameSite=Lax cookies, an eight-hour absolute lifetime and 30-minute idle limit. Offline-only temporary owner credentials expire after 24 hours and require a different 15–128-character password after email verification. No user-supplied credential appears in source or has been provisioned on Hostinger.

The Node MySQL schema keeps private portraits outside replaceable deployment directories. Only fixed workspace SQL is admitted; data uses bound parameters, writes pair state and audit in one transaction, and evidence reads use an explicit repeatable-read snapshot. MySQL2 3.24.6 and Nodemailer 10.6.1 were added; the fresh resolved dependency audit still reports zero findings. Existing Worker HTTPS controls are preserved. Hostinger must independently provide verified TLS/Force HTTPS at its edge; an application HSTS header does not establish that operational fact.

Material limits: real Hostinger database/mailbox/owner provisioning, live delivery, domain/TLS and data restore/redeployment checks remain outstanding. Non-owner credential recovery and same-email replacement/imported identity mapping require a controlled offline procedure; public enrollment cannot reset or reuse old identity. SMS, phishing-resistant MFA and external immutable evidence retention are not implemented. Authentication events are stored separately in nw_auth_events with bounded maintenance/30-day retention; they are not falsely presented as the existing workspace hash chain.
