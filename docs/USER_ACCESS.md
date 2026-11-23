# Owner-controlled invitations and employee access

## Current deployment status

The private Sites demo still uses the hosting platform's sign-in gateway. The separate Hostinger email/password and email-code service has been implemented and passes 32 local authentication tests; it has not been provisioned against a real Hostinger database, SMTP mailbox or owner account. No real authentication email has been sent. See [HOSTINGER_AND_DOMAIN.md](HOSTINGER_AND_DOMAIN.md) for deployment settings and [AUTHENTICATION_AND_MFA.md](AUTHENTICATION_AND_MFA.md) for the implemented controls and remaining checks.

## Access policy

The initial owner account is **23samjessen@gmail.com**. Email addresses are sign-in usernames. There is no public registration or automatic workspace membership when someone signs in. Hostinger's invitation enrollment can create credentials only for an existing, current owner-created invitation; it cannot create its own workspace invitation or grant access.

The first authorized setup creates one real administrator: the stable `owner` member. Fictional sample colleagues are assignment examples and cannot sign in. The server's explicit `ADMIN_EMAILS` setting controls initial workspace setup; changing it later does not create or promote an account. Hostinger owner credential provisioning is a separate offline setup step.

Only the owner can create or renew invitations, approve or revoke employee access, and grant roles. Approved delegated administrators can manage ordinary workspace features, safe profile fields and evidence; they cannot take ownership, invite people, approve or revoke accounts, or grant roles. The owner cannot be disabled or demoted through Team settings.

## Invite, accept, approve

1. As owner, open **Admin settings → Team → Create invitation**. Enter the person's actual sign-in email and name; the job title is optional. The new invitation is inactive and starts with the employee role.
2. Use **Copy invitation message** or copy the workspace link, then share it through your chosen channel. Invitation creation does not send an email or SMS. Hostinger's email-code transport, once configured, is separate from invitation-message delivery.
3. For the private review Site, separately grant permission to reach the Site when you decide to share it. Hosting audience access and workspace membership are different controls; neither sharing nor publication happens automatically.
4. The person signs in with the exact invited identity. On a configured Hostinger deployment, an existing local account uses password plus email code; an eligible new invitee verifies the invitation email and chooses their own password first.
5. The person selects **Accept invitation** on their own workspace invitation screen. Acceptance binds the record to the verified identity and records a timestamp. It does not expose tickets, conversations, notes, resources, employee photos or audit evidence.
6. The person sees **Waiting for owner approval** and can select **Check approval status**. The owner opens **Ready for your approval → Review & approve → Approve employee access** in the Team tab. Only then does active employee access begin.
7. If needed, the owner separately selects **Change role** for an approved employee. Granting an administrator role requires the explicit **Grant administrator role** confirmation. An invitation or acceptance never grants administration automatically.

Invitations expire after seven days. Acceptance and owner approval must both happen before the deadline. **Create new invitation** generates a new identifier, clears earlier acceptance/approval and requires acceptance again; delayed acceptance of an older invitation is rejected. **Revoke access** removes authorization on subsequent protected requests without deleting historical work.

## Status and access

| Status | Employee data access | Next action |
| --- | --- | --- |
| No invitation | None | Owner creates an invitation |
| Invited | None | Invited person authenticates and accepts before expiry |
| Waiting for owner approval | None | Owner approves before expiry |
| Approved and active | Permitted by assigned role | Normal work |
| Expired | None | Owner creates a new invitation |
| Revoked or inactive | None | Owner reviews return eligibility and reissues if appropriate |
| Legacy record without approval evidence | None | Reviewed identity continuity, new invitation, acceptance and approval |
| Sample colleague | None | Assignment/design example only |

Old `active: true` values or administrator roles do not bypass approval. The full invitation roster is owner-only; non-owner directories omit unapproved real accounts and other people's private onboarding metadata.

## Stable identities, returning employees and recycled email

A member's stable ID and historical identity anchor preserve who created work, sent messages and performed audited actions. Revocation clears current access without transferring that history. Reissue preserves the anchor and permits the same verified person to return after fresh acceptance and approval.

For a returning employee with an existing Hostinger credential account, keep that account and immutable identity. Reissuing the workspace invitation does not reset credentials; authenticate normally, accept the new invitation and obtain owner approval again.

A different person who receives a recycled email address must have a fresh member/authentication identity. Never attach them to the former person's record, reuse the former user ID or edit an anchor to make a login work. Historical work and evidence stay with the former identity.

The Hostinger service deliberately refuses new public enrollment against a historical anchor, including an absent/unknown anchor. Existing local credential emails are unique. Therefore same-email replacement, imported non-owner Sites identities without local credentials, and non-owner credential recovery are **blocked pending a separately reviewed offline migration/retirement/recovery procedure**. These procedures are not automated in this release. Do not solve the limitation by handing over or resetting the old person's account.

## Hostinger credentials and required verification

On a configured Hostinger deployment, existing users must pass password and email-code verification before receiving a full authenticated identity session. An offline-provisioned temporary owner password may contain 8–128 characters, expires after 24 hours, and forces replacement after email verification. Its replacement must contain 15–128 characters and differ from the temporary password. No supplied credential is included in source, documentation, logs or the project archive.

New eligible invitees choose their own password after proving access to the invited email. There is no shared employee password. A browser flag cannot clear the mandatory-change gate. Explicit offline owner recovery preserves the owner identity and revokes old sessions and pending challenges; it is not a general employee password-reset feature.

A full auth session proves identity, **not employee authorization**. The separate workspace invitation, acceptance and owner-approval gates still apply to every protected request. Workspace revocation blocks employee data even if an authentication cookie still exists. Hostinger logout and password changes revoke all local account sessions.

SMS is disabled. Email codes are lower assurance and are not NIST AAL2-compliant out-of-band authentication. Passkeys/TOTP, public password reset, factor changes and recovery codes are not implemented. See [AUTHENTICATION_AND_MFA.md](AUTHENTICATION_AND_MFA.md) for qualifications and references.

## Backend and code locations

| Concern | Location |
| --- | --- |
| Member/onboarding types and action names | `lib/workspace-types.ts` |
| Initial owner and fictional sample records | `lib/workspace-seed.ts` and `bootstrapMember()` in `lib/workspace-server.ts` |
| Verified identity, anchors, approval checks, invitation actions and workspace audit | `lib/workspace-server.ts` |
| Workspace and own-onboarding HTTP route | `app/api/workspace/route.ts` |
| Team controls, acceptance and waiting screens | `components/workspace.tsx` |
| Interface colours and layout | `app/workspace/workspace.css` |
| Standalone Hostinger credential/session state machine | `hostinger/auth/index.mjs` |
| Password hashing and MySQL auth persistence | `hostinger/auth/password.mjs`, `mysql-store.mjs` and `schema.sql` |
| Hostinger setup and domain instructions | `docs/HOSTINGER_AND_DOMAIN.md` |
| Workspace authorization/lifecycle regressions | `scripts/test-workspace.mjs` |
| Auth state-machine and opt-in MySQL tests | `hostinger/tests/auth.test.mjs` and `auth.mysql.test.mjs` |

The own-onboarding response contains only the signed-in person's status and necessary acceptance fields. It contains no workspace state, resources, audit records, other members or global revision. Its invitation identifier prevents stale acceptance; it is not a bearer credential or substitute for verified identity.

Invitation creation, acceptance, approval, reissue, revocation and role changes are recorded with server timestamps and actor attribution in the administrator Evidence log. Authentication security events are separately stored in the restricted `nw_auth_events` table; no public auth-audit endpoint is provided. Never place temporary passwords, OTPs, raw session tokens or provider secrets in either record set.
