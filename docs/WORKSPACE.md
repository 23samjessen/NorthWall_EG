# NorthWallEg employee workspace

The employee workspace lives at `/workspace`. Its data is saved through the protected workspace API; business records are not stored in browser localStorage.

This is a review demo. Sample customers, colleagues, tickets and conversations are labelled as examples. They are not evidence of work delivered to real customers.

## First visit

1. Open the demo and choose **Employee workspace**.
2. Sign in with the approved owner account.
3. Choose **Load sample workspace** once. This creates the example board, people, calendar, notes and conversations in the demo database.
4. Review the **Overview**, then use the sidebar to open the other views.

The public company pages and employee workspace are distinct. The review Site itself remains private until its audience is explicitly changed.

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
| Admin settings | Team membership and roles; profile completion and profile management; workflow columns and order; custom fields; ticket automation rules; workspace name and reference timezone. |
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

There is no shared default username/password embedded in this application. Hosted sign-in is supplied by the platform, and the backend checks the employee's membership and role after sign-in.

To add a person, open **Admin settings → Team → Add member**, enter their actual sign-in email, name, job title and role, and choose **Approve member**. This creates approved membership; it does not send an email. The Site's audience must separately allow that person to reach the private Site. Keep the review Site private until sharing is explicitly requested.

| Role | Main capabilities |
| --- | --- |
| Employee | Read the team workspace; manage tickets and their own notes/events/messages; participate in conversations. |
| Manager | Employee capabilities plus sending internal team alerts and creating chat channels through the authorised API. |
| Admin | Team membership and role management; workflow columns and custom fields; automation rules; settings; administrator audit access and permitted moderation. |

The backend prevents self-lockout changes and retains an active non-sample administrator. An approved member is shown as **Pending account link** until the backend binds their stable identity on their first successful write. Disabled users cannot access the workspace. Sample colleagues use `.invalid` email addresses and cannot sign in.

For server-side identity, bootstrap administrator configuration, route protection and credential locations, see [BACKEND.md](BACKEND.md). Passwords for individual sign-in accounts are changed at their identity provider, not in a website source file.

## My profile and employee photographs

Open **My profile** from the sidebar, or choose **Complete my profile** on the overview reminder.

1. Enter your **Display name** and **Job title**. Both are required when saving details.
2. Add department, work phone, work location and an **About your work** biography if useful. These details are visible inside the team workspace.
3. Choose **Save profile** before changing the photograph.
4. Choose **Choose photograph**, select one JPEG, PNG or WebP image, inspect the preview and choose **Save photograph**. The limit is 2 MiB, labelled 2 MB in the interface.

**Choose replacement** replaces the current photograph. **Remove photograph** asks for confirmation and returns the avatar to initials. Photos are stored in protected object storage and served through an authenticated route. They are not public website assets or files committed to Git.

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

UI code alone cannot grant permissions. A new administrator-only feature needs its server action and authorisation check as well as its interface.

## Review checklist

1. Initialise sample data and compare the overview totals with the work board. Open **My profile**, save a title and try one authorised test photo; check the completion status, replacement and removal controls.
2. Create a ticket assigned to yourself, add a checklist item and move it to another column.
3. Add a comment, reply to it, react, and copy the ticket link. Reopen the link.
4. Create a calendar event, export it, and add a private note.
5. Send an internal message to a sample colleague; check reply, edit, reaction and forwarding. Sample colleagues do not actually receive messages.
6. Search an official reference and open a Microsoft 365 runbook.
7. Add a column and custom field, then create a rule and a matching ticket to observe the saved result.
8. Inspect the corresponding evidence events and export the audit log.

Browser verification and backend security checks are recorded by the overall project delivery notes. This guide describes the implemented controls and the review procedure; it does not claim that a live external messaging provider or production customer environment has been connected.
