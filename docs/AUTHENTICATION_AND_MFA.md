# Authentication, HTTPS and employee verification

## Current status: implemented Hostinger code, deployment still pending

The standalone Hostinger service is implemented in `hostinger/auth/`; **32 local authentication tests pass** using the real state machine, transactional test storage and fake email delivery. All five real-MySQL authentication scenarios also passed in [GitHub Actions run 45096520691](https://github.com/23samjessen/NorthWall_EG/actions/runs/45096520691), using a dedicated empty database and fake delivery. This verifies the storage adapter and invitation row locks, not a real mailbox.
The current private Sites demo still uses its existing hosting identity gateway. Its login has not been replaced by the Hostinger service.
Real Hostinger database setup, SMTP configuration, account provisioning and delivery verification have **not** been completed. No real authentication emails have been sent, and no supplied temporary password is stored in this repository, archive or documentation.
Follow [HOSTINGER_AND_DOMAIN.md](HOSTINGER_AND_DOMAIN.md) for exact deployment settings and setup steps; keep the review Site private until the deployment checks are complete.

The replacement ZIP builds the service into native Next.js Route Handlers. Every workspace/photo handler verifies the session cookie itself, then establishes an AsyncLocalStorage identity context for the existing backend. Server-rendered protected pages independently verify their session. The generated standalone server does not require a separate custom HTTP entry.

## HTTPS and trust boundary

- The Hostinger server requires a canonical HTTPS origin. All authentication writes require the exact origin, JSON and bounded request bodies; cookies require HTTPS.
- Deployment still needs a valid automatically renewed certificate, HTTP-to-HTTPS navigation redirects, correctly configured HSTS and no mixed content. Never accept credentials over HTTP.
- Native Next.js handlers have no verified peer socket address. They ignore visitor-supplied forwarded-IP headers and use the authentication service's conservative shared-client rate-limit bucket, alongside account and global limits. The legacy custom listener can additionally supply its actual peer socket address.
- Never trust visitor-supplied `oai-authenticated-*` headers. The Hostinger server resolves its own completed auth session before supplying identity to the workspace.

## Authentication and employee authorization are separate

All usernames are normalized email addresses. The configured initial owner is **23samjessen@gmail.com**; only the stable workspace owner can invite people, approve access or grant roles.

1. Existing credential holders enter their email and password, then verify an email code.
2. If a temporary password is flagged, they must replace it in a restricted gate after the code succeeds. No full authenticated identity is returned before all these steps finish.
3. A new invitee uses invitation enrollment: an exact, current owner invitation is required; the invitee verifies email, then chooses their own password. The server rechecks and locks that invitation before creating credentials.
4. A completed Hostinger session proves identity. It does **not** approve employee access, create a workspace member or grant a role.
5. The invited person must still accept the workspace invitation; the owner must then approve it. Membership and permissions are checked on every protected workspace request. See [USER_ACCESS.md](USER_ACCESS.md).

New public enrollment requires an explicitly empty historical identity anchor. It cannot adopt an earlier person's identity merely because the email matches.
**SMS is disabled.** Passkeys, security keys and TOTP are recommendations for a future stronger authentication option, not implemented features.
Email codes provide lower assurance, depend on mailbox security and remain susceptible to phishing [1]. NIST SP 800-63B-4 excludes email as an out-of-band authenticator; this service must not be described as NIST AAL2 compliant [2]. Prefer phishing-resistant passkeys/security keys for administrators; TOTP is an alternative but is not phishing-resistant [1], [2].

## Implemented password, code and session policy

| Control | Implemented behavior |
|---|---|
| Ordinary new password | 15–128 characters; normalized consistently; small common-password rejection list |
| Temporary owner password | Offline provisioning only, 8–128 characters, expires after 24 hours |
| First-use replacement | Required after email verification; must differ from the temporary password; replacement disables the old credential |
| Password storage | Salted asynchronous scrypt, `N=131072`, `r=8`, `p=1`; two concurrent jobs and a bounded queue [3] |
| Email code | Six cryptographically generated digits; five-minute server-enforced expiry |
| Attempts | Five incorrect code attempts per challenge, plus durable account, IP and global throttles |
| Resend | Minimum 60 seconds; rotates the code and pending token without resetting failure counts |
| Code storage and use | HMAC with `AUTH_SECRET`; pending-session binding, constant-time comparison and atomic consumption |
| Password-selection gate | Ten minutes after successful code verification; invitation/temporary expiry is rechecked before completion |
| Session token | Random 256-bit opaque value; only its hash is stored in MySQL |
| Session cookie | Host-only `__Host-` cookie; `Secure`, `HttpOnly`, `SameSite=Lax` |
| Session lifetime | Eight hours absolute; 30 minutes idle; enforced on the server |
| Logout/password change | Revoke all account sessions and pending login challenges |

Scrypt uses an explicit memory ceiling; capacity planning must allow roughly 128 MiB per running hash plus process overhead. The common-password list is limited, not a comprehensive breached-password screening service.
Global throttles run before per-IP/account writes. Requests blocked at that limit cannot create unlimited new buckets, flows or per-denial audit entries. Provider failure never bypasses verification.
Enrollment responses are generic; they are not a claim that all timing or delivery-related account-enumeration signals have been eliminated.

## Provisioning, return to work and recovery

- Offline owner provisioning is exposed through `createOwner()`. Temporary credentials are never accepted through a public provisioning endpoint; ordinary password-selection endpoints retain the 15-character minimum.
- Explicit offline owner recovery preserves the existing immutable user ID, resets the temporary deadline and revokes old sessions/challenges. It cannot remap the account to another person.
- A returning employee with an existing local account uses that same account. A reissued workspace invitation still requires acceptance and owner approval; it does not reset the password or historical identity.
- Imported Sites employee identities without local credentials need a separately reviewed offline migration procedure. Automated non-owner migration and non-owner password recovery are not implemented.
- A recycled email assigned to a different person must not inherit the old person's account, messages or evidence. Existing local credentials intentionally block public enrollment for that email; controlled offline retirement/replacement is required and is not automated.
- There is no public password-reset fallback, SMS recovery, recovery-code feature or factor-change workflow. Do not bypass these limits by editing identity anchors, resetting another person's identity or disabling the approval gate.

## Evidence, secrets and retention

Authentication events are stored separately in `nw_auth_events`, with timestamps, account references, HMAC identifiers and bounded outcome metadata. There is no public authentication-audit endpoint. The workspace's existing administrator Evidence log separately records invitation and role actions.
Passwords, OTPs, raw session tokens, provider credentials and full message bodies are excluded from auth audit records. Credential verifiers, pending challenges and sessions belong in the restricted MySQL tables, not exports or public configuration.
Keep `AUTH_SECRET`, database and SMTP credentials in deployment secrets. Review database/admin access and backup retention before launch.
The cleanup function removes expired challenges, sessions and rate buckets in bounded batches. Authentication event retention defaults to 30 days, configurable from 1 to 90 days. Schedule the documented cleanup command; expiry enforcement alone does not delete stored records.

## Validation and launch gate

Run `node --test hostinger/tests/auth.test.mjs` for the 32 local cases. They cover all gates, temporary expiry, concurrent code replay, stale invitations, revocation, session expiry, transaction/provider failure and rate-limit persistence.
`hostinger/tests/auth.mysql.test.mjs` is opt-in and refuses any non-local, non-dedicated or non-empty test database. A local skip is **not** a passed real-engine test. The observed real-engine success is recorded for the exact CI revision in VERIFICATION.md.
Before enabling production access, verify real HTTPS/proxy behavior, real MySQL transactions, authorized test-email delivery, owner provisioning, invitation acceptance/approval, logout and recovery procedures. Do not describe the current private Sites demo as running this Hostinger login.

## References

[1] OWASP, “Multifactor Authentication Cheat Sheet,” accessed Nov. 23, 2026. https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html

[2] NIST, “Digital Identity Guidelines: Authentication and Authenticator Management,” SP 800-63B-4, accessed Nov. 23, 2026. https://pages.nist.gov/800-63-4/sp800-63b.html

[3] OWASP, “Password Storage Cheat Sheet,” accessed Nov. 23, 2026. https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
