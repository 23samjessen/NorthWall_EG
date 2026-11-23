# NorthWallEg — future delivery roadmap

Revision: **23 November 2026**.

This is a prioritised proposal for later work. **The capabilities below are future work unless the current-baseline column explicitly says otherwise.** A service mentioned on the marketing website is a service discussion topic; it does not mean this website already contains that integration.

The site remains private for review. Registration, a purchased domain and a separate public-launch instruction come before opening the marketing site. Deployment and verification records belong in [VERIFICATION.md](VERIFICATION.md); this roadmap makes no test, launch or delivery-date claim.

## Current baseline

The source contains the company presentation, detailed service pages, a project brief builder, English publisher headlines and a protected employee workspace. Signed-in members can save a demo enquiry as an internal ticket. The form does not currently deliver public customer enquiries by email or confirm appointments.

The workspace has persistent team records, role checks, in-app alerts, private profile photos and administrator evidence export. It serves one company. Customer isolation, contracted support hours and external delivery services require additional implementation. See [BACKEND.md](BACKEND.md) for the current authentication, storage and audit boundaries.

## Priorities and completion criteria

| Priority | Future capability and current baseline | Dependencies | A useful completion check |
|---|---|---|---|
| P0 — before relying on real operational data | **Independent backup, restoration and retention.** D1 stores workspace records; R2 stores employee photos. Git and a source ZIP contain neither. Application evidence export already exists. | Approved recovery targets, storage access, backup destination, retention schedule and an accountable operator. | Restore D1 records and matching R2 photos into an isolated environment; verify access, record completeness and audit-chain consistency. Record the time, gaps and recovery instructions. |
| P1 — first customer-facing workflow | **Public lead intake backend.** The existing form creates a signed-in demo ticket; public submission and external delivery are unimplemented. | Chosen CRM/mail destination, business mailbox, fields, privacy wording, access policy and abuse controls. | A visitor submits once and receives an honest receipt; the correct team receives one lead, sees delivery failures and can follow up. No false success when storage or delivery fails. |
| P1 — customer scheduling | **Booking.** The project brief can record preferences; it does not reserve a time. | Approved calendar/booking provider, staff availability, services, meeting length, buffers and Cairo/Copenhagen time-zone rules. | Availability, double-booking prevention, confirmation, rescheduling and cancellation work end to end, including daylight-saving changes. |
| P1 — authentic public presence | **Approved social links and focused campaign pages.** Social configuration slots exist; blank preview placeholders are not active accounts. Advertising pages and campaigns are unimplemented. | Exact company-controlled URLs, approved messages, working lead route, real service scope and campaign owner. | Every enabled icon reaches the correct profile. Each campaign landing page answers one real need and carries working contact details; no copied city pages or invented testimonials. |
| P1 — measurement after launch | **Consent-aware analytics.** This plan adds no tracking service or consent platform. | Chosen minimal measurement goals, provider, configuration, privacy wording and decisions about storage/consent. | Verify the actual pre-choice and post-choice network behaviour. Measure agreed public events without sending employee records, message text or enquiry contents as analytics parameters. |
| P2 — delivery beyond an open browser | **External notifications.** Assignment, mention and announcement alerts currently stay in the app. Email, SMS and push delivery are unimplemented. | Provider account, sender domain, recipients/preferences, templates, secrets, queue/retry design and unsubscribe or opt-out behaviour where applicable. | Test queued, delivered, bounced, retried and permanently failed states. Duplicate events do not send repeated alerts. Internal-only text reaches only authorised recipients. |
| P2 — customer support operations | **Customer portal and SLAs.** Employee tickets exist; a separate customer identity boundary, customer portal and SLA engine do not. | Customer identity, tenant isolation, customer-visible fields, attachment handling, support hours, escalation rules and agreed response definitions. | Two test customers cannot see each other’s records. Public and internal comments remain distinct. Business-hour clocks and escalations match the agreed service definition. |
| P2 — stronger evidence handling | **External evidence retention.** The admin audit trail has server timestamps and a hash chain; it is not independently immutable storage. | Data classification, retention/deletion rules, export destination, integrity verification, access reviews and recovery process. | Save exports outside the primary database, verify them against a separately retained trusted head, test access and document what reads or failed actions are outside the log. |

P0/P1/P2 express order, not calendar commitments. The owner can choose the next deliverable after reviewing scope, provider requirements and the current implementation.

## Recommended sequence

### 1. Make the operating foundation recoverable

Choose recovery targets and prove a restore before depending on the app for irreplaceable business records. Treat D1, R2, configuration and hosting identity as separate recovery dependencies. Protect secrets outside Git. A migration needs a reviewed change, a verified backup and a recovery approach; replaying the initial migration is not a rollback strategy.

Define retention for enquiries, tickets, notes, conversations, photos and evidence separately. Archiving a record is not the same as deletion or a backup. Record who is allowed to restore or export private data. Keep the current evidence limitations visible while any stronger retention service is still being designed.

### 2. Finish one customer journey

Implement public lead intake before driving advertising traffic to it. Pick a single destination and one receipt workflow. Include server-side validation, bounded request sizes, rate limiting, duplicate prevention and clear failures. Define who monitors the inbox or queue and how an unanswered enquiry is escalated.

Connect booking only after the responsible calendars and service hours are confirmed. A preferred contact is a request, not an assignment or an availability promise. Sam’s primary public title is **Country Manager — Egypt**; keep technical qualifications and actual responsibilities accurate in the contact details.

### 3. Add reach and measurement deliberately

Activate only approved social URLs. Link useful original guides to their relevant service pages and maintain the source/date policy in [SEO_AND_CONTENT_PLAN.md](SEO_AND_CONTENT_PLAN.md). Start campaign pages from an actual offer, audience and contact route.

Define a small measurement set such as service views, guide-to-service visits and successfully accepted enquiries. Decide what needs client-side analytics and what can be measured without it. Campaign spend, tracking and publication need their own concrete configuration; this file starts none of them.

### 4. Expand the workspace when the audience changes

External notifications require delivery state, retries, preferences and secrets, not just a new button. A customer portal requires a separately tested identity and data boundary. It should not reuse the assumption that every active employee can view the company’s shared tickets.

Define support hours and response commitments before displaying SLA timers. Record the difference between first response, resolution target and staffed availability. A portal, automation rule or dashboard does not by itself establish 24/7 monitoring.

## How to turn a roadmap item into work

Create one scoped task with a business owner, intended user, required inputs, affected records, access rules and the completion checks above. Confirm the provider account and test environment before implementation. Keep secrets in the hosting secret store, then document configuration, failure handling and rollback alongside the feature.

Use a small test dataset. Review the complete customer or employee journey, including failure states, before enabling it for real users. Update the relevant user guide and verification record only after observing the result. Mark an item complete in this roadmap when the agreed behaviour exists and has been checked; leave provider-dependent or unimplemented steps explicit.
