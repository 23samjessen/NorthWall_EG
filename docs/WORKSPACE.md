# NorthWallEg employee workspace

The employee workspace lives at `/workspace`. Its data is saved through the protected workspace API; business records are not stored in browser localStorage.

The current source supports either an empty real workspace or labelled review data. Sample customers, colleagues, tickets and conversations are examples, not evidence of delivered customer work. The existing private Site and its stored data are retained; the prepared Hostinger Node target has not been deployed. Current and historical verification are separated in [VERIFICATION.md](VERIFICATION.md).

## First visit

1. Open the demo and choose **Employee workspace**.
2. Sign in with the approved owner account.
3. On a new, empty database, choose **Start empty workspace** for real use, or **Load sample workspace** for design review. Empty setup creates the owner and default workflow/channels without sample people, tickets or discussions. Sample setup creates the labelled example board, people, calendar, notes and conversations.
4. Review the **Overview**, then use the sidebar to open the other views.

Setup is allowed once. Neither button resets an existing workspace or removes its records. The public company pages and employee workspace are distinct. The review Site remains private until its audience is explicitly changed.

## Main views

| View | What works |
| --- | --- |
| Overview | Actual totals for all active tickets, open work, completed work and overdue work; status chart; open tickets by assignee; due-date queue; calendar items; recent notifications; knowledge shortcuts. |
| Work board | Board and table views; ticket creation and editing; drag between workflow columns; filters by text, assignee and priority; archive and restore. |
| Calendar | Month and agenda views; meetings, maintenance windows and deadlines; attendees; ticket due dates; event editing and deletion; downloadable calendar `.ics` files. |
| Notes | Search, private or shared visibility, pinning, editing and deletion by the note owner. Other people can read and copy shared notes. |
| Team chat | Channels and direct messages; replies quoting the original message; mentions; emoji reactions; forwarding; copying; editing your own messages; pinning; deletion permissions. |
| Knowledge library | Searchable official references, standards descriptions, useful admin links and original Microsoft 365 troubleshooting runbooks. |
| My profile | Name, job title and professional details; one protected photograph; completion status; searchable active-team directory. |
| Admin settings | Owner-controlled invitations, acceptance review, approvals and roles; administrator profile management, workflow columns, custom fields, automation, workspace name and reference timezone. |
| Evidence log | Administrator-only audit events, filtering, inspection of recorded changes, chain verification status and JSON evidence export. |

The sidebar collapses on desktop. On narrow screens the menu button opens and closes the navigation. Search has a `Ctrl+K` or `Cmd+K` shortcut. Dialogs support Escape and keep keyboard focus within the dialog.

## Tickets

Choose **Create ticket**, enter a title, then set the status, priority, assignee, due date, customer or project, location, tags and any custom fields. Required fields are validated on the server.

Open a card to see the ticket details, created and updated timestamps, checklist and conversation. You can change the status directly in the drawer, edit the complete ticket, copy a link, or archive it. The link format is `/workspace?ticket=<ticket-id>` and opens the corresponding ticket after access is authorised.

Checklist items can be added, completed and removed. The card displays the due date, assignee, priority and comment count. Completed totals come from columns that an administrator has marked **Counts as completed**. Every other workflow column counts as open work.

Use **Show archive** to inspect archived tickets. Open one and choose the archive icon again to restore it. Archiving does not delete the underlying record.

### Conversations

Comments and chat messages support:

- Reply to a specific person/message, with a quoted original.
- Use the `@` control to select a teammate. A mention creates an internal notification.
- Add an emoji to the text or react to an existing message. Selecting your existing reaction removes it.
- Edit your own message. The interface displays that it has been edited.
- Forward a comment to another ticket, or a chat message to a channel or direct recipient. Forwarded items are labelled.
- Copy message text. Copy a ticket link with the share control.
- Delete your own message; administrators also have the permitted moderation actions. The action is still recorded in the evidence log.

Press `Ctrl+Enter` or `Cmd+Enter` to send from a composer. Rich HTML is not accepted or executed. Text is rendered as text.

Messages refresh every 15 seconds. The demo does not claim instant WebSocket delivery, typing indicators, online presence, message read receipts, voice/video calls, end-to-end encryption, or attachment support. It is an internal work conversation tool, with a defined set of the requested familiar messaging interactions.

## Calendar and time

Create an event with a start and end time, location, type, description and attendees. The end must be after the start. Event owners and administrators can change or remove the event; other team members receive a read view.

Event forms and the calendar display use the browser's local timezone, which is labelled in the interface. The API stores timestamps in UTC. An event's **Calendar file** control downloads an `.ics` file for importing into a calendar application; it does not send a meeting invitation.

The top bar shows the configured workspace reference timezone and Copenhagen time. Change the reference timezone under **Admin settings → Settings**. Evidence log timestamps explicitly use UTC.

## Team membership and credentials

There is no open public registration or shared default password. Usernames are email addresses, with **23samjessen@gmail.com** designated as the initial owner. The existing review Site continues to use platform sign-in. The separate Node target now contains email/password sign-in, email-code verification, invitation-only enrollment and mandatory replacement of a temporary password before a workspace session is issued. That code is not a deployed Hostinger service: its SMTP account, real delivery, owner password and destination configuration have not been set up by these source changes. SMS is not implemented.

Open **Admin settings → Team → Create invitation** as owner. Enter the person's actual sign-in email, name and title. This creates an inactive invitation. Copy and share its instructions through your chosen channel; creating a workspace invitation does not send an invitation email or SMS. The Site audience must separately allow that person to reach the private review Site. The Node target's authentication verification emails are a separate flow that needs configured, tested SMTP delivery.

The person signs in and accepts their own invitation. They see an approval-waiting screen with no employee data. The owner then explicitly approves them from the Team view. Both steps must complete within seven days; reissue starts a new invitation and invalidates the earlier acceptance. Only the owner can revoke/reissue or assign roles. See [USER_ACCESS.md](USER_ACCESS.md).

| Role | Main capabilities |
| --- | --- |
| Employee | Read the team workspace; manage tickets and their own notes/events/messages; participate in conversations. |
| Manager | Employee capabilities plus sending internal team alerts and creating chat channels through the authorised API. |
| Admin | Workflow columns, custom fields, automation, settings, safe profile administration, audit access and permitted moderation. |
| Owner | Administrator capabilities plus invitation creation, approval/revocation and granting or removing employee/manager/admin access. |

The initial owner cannot be disabled or demoted through team settings. Other people never receive an admin role automatically. Disabled/revoked accounts and legacy non-owner records without explicit approval fail the server's access checks. Sample colleagues remain assignment examples and cannot sign in.

**Reissue is for the same person and identity.** Revocation clears active access but preserves the member's original identity anchor. Only that original verified identity can accept a renewed invitation to the historical record. Recycled email ownership cannot transfer that person's private notes, direct messages or portrait. If the original identity cannot be verified, leave the record revoked and create a separate employee record. The owner can reuse its email for a new record only after all older matching records are revoked, inactive and unbound. A new replacement record starts without the old private history.

Only the owner receives the full pending/revoked/legacy account roster. Other members see approved colleagues and sample assignment personas; identity anchors and other people's invitation metadata are not included in their directory responses. Administrators retain their permitted evidence-log access. In the Node target, an existing imported identity needs reviewed migration or recovery; entering an email in enrollment cannot claim its historical identity.

For implementation and credential boundaries, see [BACKEND.md](BACKEND.md) and [AUTHENTICATION_AND_MFA.md](AUTHENTICATION_AND_MFA.md).

## My profile and employee photographs

Open **My profile** from the sidebar, or choose **Complete my profile** on the overview reminder.

1. Enter your **Display name** and **Job title**. Both are required when saving details.
2. Add department, work phone, work location and an **About your work** biography if useful. These details are visible inside the team workspace.
3. Choose **Save profile** before changing the photograph.
4. Choose **Choose photograph**, select one JPEG, PNG or WebP image, inspect the preview and choose **Save photograph**. The limit is 2 MiB, labelled 2 MB in the interface.

**Choose replacement** replaces the current photograph. **Remove photograph** asks for confirmation and returns the avatar to initials. Photos use private R2 object storage in Sites and the private MySQL portrait table in the prepared Node target. Both serve them through an authenticated route. They are not public website assets or files committed to Git.

The profile shows `0/2`, `1/2` or `2/2 complete`, based on having a job title and a photograph. Completion is a reminder during this demo; an incomplete profile does not block the employee from the board or other permitted work. Job titles do not change account permissions.

Use **Reload saved details** if a concurrent change creates a revision conflict. It discards unsaved typed edits, loads the current saved details, and lets you review before entering the change again.

The **Team directory** lists active members and can be searched by name, title or department. Employees can edit their own profile. Administrators can use **Manage profile** to change another employee's details or photo. **Admin settings → Team** also shows the avatar, job title and **Complete**, **Photo needed**, **Title needed** or **Photo + title needed** status.

The public **Our team** section is maintained separately in `lib/company-profile.json`. Its Pernille and Sam cards do not create employee membership or copy these private profiles to the company website. No sign-in email has been supplied for Pernille; add membership only when her actual sign-in account is known.

## Workflow customisation

### Columns

Open **Admin settings → Workflow**. Add or rename a workflow column, pick its colour, mark whether it represents completed work, and adjust its order. Move tickets and change rules that refer to a column before deleting it.

### Custom fields

The same view supports text, number, date, dropdown/select and checkbox fields. You can make fields required. Dropdown options are entered one per line. The server rejects unknown fields and invalid option values.

If a field type is already used in tickets, create a new field instead of silently converting its historical data. After adding a required field, fill it in when updating existing tickets.

### Automations

Open **Admin settings → Automations → New rule**. Choose one implemented trigger: a ticket is created or a ticket is updated. Optionally filter by priority, then set an assignee, move to a workflow column and/or notify selected colleagues.

Rules execute on saved ticket changes. They do not run arbitrary code and do not trigger external email, SMS, push notifications or background scheduled jobs. An automation notification appears in the internal notification centre.

## Alerts

Managers and administrators can choose **Send a team alert** from the notification centre. Select recipients and an information, warning or urgent category. Recipients see the notification in their workspace.

Assignment, mention, reply and calendar notifications are created by the corresponding saved actions. Read one or use **Read all**. No email service or mobile push provider is configured in this demo.

## Knowledge library

The library includes official resource links and original operational checklists. Full paid ISO publications are not reproduced. An ISO entry links to the publisher's standard description and licensing route.

Microsoft 365 runbooks include scope checks, troubleshooting steps, evidence to collect, escalation conditions and official references. They are guides for authorised support work, not proof that a customer's tenant has been assessed or configured.

The resource file is imported only on the server and is returned after workspace authorisation. It is not a public JSON web asset, but its current official links and original checklists are included in the public source repository. Future confidential company procedures require protected storage outside that public source.

## English news

The workspace includes a running English news strip from the same server news API used on the company pages. It displays publisher names, publication dates and linked headlines. Use **Pause** to stop the motion or **All news** to read the complete list and fetch time. Hovering or keyboard focus also pauses the strip; reduced-motion settings disable movement.

The API retrieves allowlisted publisher feeds, caches results and distinguishes full, partial and unavailable responses. Publisher dates, successful retrieval times and last-check times are separate. The browser checks the endpoint every two minutes; failed requests do not create a new successful retrieval timestamp. When a live refresh fails, previously retrieved real headlines may be shown with a clear cached label and their original retrieved time. If no verified cached stories exist, the UI displays an unavailable state. It does not invent headlines.

## Evidence log

Only administrators can read or export audit records. Each event includes a server-generated UTC timestamp, actor, action, object, request identifier, recorded change, previous hash and event hash.

The log is tamper-evident application evidence. It is not an independently administered immutable evidence vault and does not establish a forensic certification. Follow the organisation's procedures for exports, retention, access and independent preservation.

An export is limited to 10,000 events and 8 MiB of stored audit-column data. Larger histories need a protected database backup. The server reads one consistent snapshot so a concurrent legitimate write does not falsely appear as tampering. An evidence export is not a complete backup of workspace records, private portraits or Node authentication accounts.

The server restricts private conversations and notes. Audit records for private chat operations retain necessary metadata and hashes rather than exposing the private message body in the admin interface.

## Source map for developers

| File | Purpose |
| --- | --- |
| `components/workspace.tsx` | Employee shell and all views, dialogs, API requests, news strip and interaction handlers. |
| `components/employee-profile.tsx` | Profile form, protected photo controls, completion prompt and team directory. |
| `app/workspace/page.tsx` | Route entry and no-index metadata. |
| `app/workspace/workspace.css` | Scoped employee design, colours, typography, layout, responsive behaviour and news animation. |
| `lib/workspace-types.ts` | Shared TypeScript entity and action definitions. |
| `lib/workspace-seed.ts` | Clearly labelled example data. |
| `lib/workspace-server.ts` | Membership, authorisation, validation, business actions, persistence and audit logic. |
| `app/api/workspace/route.ts` | Protected GET/POST workspace API. |
| `app/api/profile-photo/route.ts` | Protected photo reads, uploads, replacements and removals. |
| `lib/knowledge-resources.json` | Private knowledge references and original runbooks. |
| `lib/news-source.ts` | English publisher allowlist and shared RSS parser. |
| `app/api/news/route.ts` | Fetching, timestamps, runtime cache and saved-headline fallback. |
| `db/schema.ts` and `drizzle/` | Database schema and generated migrations. |
| `hostinger/server.mjs`, `hostinger/auth/` | Separate Node session boundary and authentication implementation. |
| `hostinger/storage.mjs`, `hostinger/schema.sql` | MySQL workspace/audit transactions and private portrait BLOB storage. |
| `hostinger/setup.mjs`, `hostinger/check.mjs` | Explicit destination setup, hidden owner-password provisioning and preflight. |

UI code alone cannot grant permissions. A new administrator-only feature needs its server action and authorisation check as well as its interface.

## Review checklist

1. Use a separate disposable review workspace for sample data and compare the overview totals with the board. For a new real workspace, use empty setup instead. Open **My profile**, save a title and try one authorised test photo; check completion, replacement and removal.
2. Create a ticket assigned to yourself, add a checklist item and move it to another column.
3. Add a comment, reply to it, react, and copy the ticket link. Reopen the link.
4. Create a calendar event, export it, and add a private note.
5. Send an internal message to a sample colleague; check reply, edit, reaction and forwarding. Sample colleagues do not actually receive messages.
6. Search an official reference and open a Microsoft 365 runbook.
7. Add a column and custom field, then create a rule and a matching ticket to observe the saved result.
8. Inspect the corresponding evidence events and export the audit log.

Browser verification and backend security checks are recorded by the overall project delivery notes. This guide describes the implemented controls and the review procedure; it does not claim that a live external messaging provider or production customer environment has been connected.

The current core suites record **92 backend, 33 news and 17 HTTP/security checks passed**. Separate Node validation records **32 authentication, 15 storage-contract, 7 HTTP and one actual built-Next SSR/API-origin test passed**. Real MySQL storage/auth CI, the new Site publication and Hostinger deployment remain pending until their results are recorded in [VERIFICATION.md](VERIFICATION.md).
