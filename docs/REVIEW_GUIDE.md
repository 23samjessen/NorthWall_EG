# NorthWallEg — eight-step demo review

This is a separate NorthWallEg design and workflow demo. It is for reviewing the new public website and employee workspace before deciding which version should replace the existing NorthWall Egypt site.

Allow approximately **15–20 minutes**. Use fictional customer and ticket information during the review. The sample records are clearly marked and do not describe completed customer work.

## 1. Compare the public design

Open the homepage and assess the new NW identity, typography, colour palette, Egyptian imagery and page composition. Scroll through the services, industry examples and contact journey. Compare **Limestone**, **Midnight** and **Nile** using **Explore the look**. Switch between English and Arabic and try the navigation at a narrow/mobile width.

Check whether a first-time customer can answer three questions: What does NorthWallEg do? Which service fits my problem? How do I take the next step?

Try **Let’s talk** and **Download brief**. Saving a demo enquiry requires the workspace setup in step 3 and creates a ticket; no email is sent. Record the parts you want to keep or change: hero image, headline, colour, service order, section spacing and mobile navigation. The code map is in [CUSTOMISATION.md](CUSTOMISATION.md).

## 2. Check the English news bar

Read a headline and open its publisher link. Confirm that the source and publication date are visible where shown. The news API fetches English RSS content from Microsoft Security, the Official Microsoft Blog and Cloudflare.

The publication date belongs to the article. A successful refresh time does not mean that every headline was published at that moment. If a source is unavailable, check that the page reports the remaining feed state honestly.

For a technical check, open `/api/news` on the same demo site. It returns the usable items, publisher dates, fetch time and source status. Refreshes are cached; this is not a second-by-second news wire.

## 3. Enter the employee workspace and inspect the dashboard

Choose **Workspace** in the public navigation or **Employee sign in**, then sign in with the authorised owner account. There is no shared NorthWallEg password. The old prototype's sample credentials do not apply.

On the first visit, choose **Load sample workspace**. It contains **12 sample tickets**, four default workflow columns, three fictional team members plus the signed-in administrator, sample notes, calendar entries and discussions. In the initial dataset, **nine tickets are open and three are resolved**; these figures change when you edit the records.

In **Overview**, review the ticket totals, workload and status visualisations. Collapse and reopen the sidebar. Check the date/time display and notifications. Refresh the page after a saved change to confirm that the hosted workspace retains it.

## 4. Work through one ticket

Open **Work board**, then create a ticket named **Demo review — branch Wi-Fi**. Give it a customer label beginning with **Demo**, a location, priority, assignee and due date. Add a short description and checklist.

Move it between workflow columns using the available status controls. Open its detail view and change one field. Check that the saved assignment and status are reflected in the board and dashboard. The administrator audit check in step 8 confirms when the change was recorded.

Switch between **Board** and **List**, then try the search and filters. Keep the ticket for the later audit check. All active members share this team's ticket board; the demo does not have separate customer tenants or confidential ticket queues.

## 5. Try comments and internal chat

On a ticket, add a comment, reply to a specific comment, mention a selected colleague and add an emoji reaction. Check that the reply makes its target clear.

Open **Team chat**, select a channel or direct recipient and send a short **Demo review** message. Try the available reply, reaction, edit, pin and forwarding controls. Forwarded content should be identifiable as forwarded. Editing is restricted to your own content; moderation controls depend on your role.

The fictional sample colleagues do not log in and reply automatically. Their sample discussions show the design. Direct conversations are visible through the workspace API only to their sender and recipient. Open views refresh every 15 seconds. This is in-app messaging, without WhatsApp connectivity, end-to-end encryption, voice/video calling or external delivery.

## 6. Check calendar, notes, alerts and the handbook

Open **Calendar** and create a short event with a start and end, location and attendees. Save it and reopen it. In **Notes**, add a private note, then a separate team note, and confirm their visibility labels.

As an administrator or manager, send yourself a clearly labelled test alert. Open the notification panel and mark it as read. Alerts, mentions, assignments and event notices are in-app; the demo does not send email or SMS.

Open **Knowledge library**. Search for **ISO 27001**, open the official resource link, then read one Microsoft 365 troubleshooting runbook, such as Outlook, MFA or OneDrive. Check the steps, evidence checklist and escalation point. The library contains **32 resources and 12 runbooks**. Full licensed ISO standards are not copied into it.

## 7. Customise the workflow as administrator

Open **Admin settings → Workflow**. Add a column called **Review** and choose its colour. Decide whether it should count as completed. Add an optional select field called **Site** with the options Cairo, Giza, Alexandria and Remote. Use that field on the ticket created in step 4.

In **Admin settings → Automations**, create a rule for a critical ticket being created: assign an owner and notify yourself. Create a clearly labelled critical test ticket and check the resulting assignment and notification. Disable the test rule when finished.

As owner, review **Admin settings → Team**. Create an invitation only for a real colleague whom you intend to admit. They must accept it and you must separately approve them before employee access; granting an admin role is another explicit owner decision. Creating the invitation does not send email or change the private Site audience. Existing fictional sample colleagues are sufficient for checking the assignment design. See [USER_ACCESS.md](USER_ACCESS.md).

These controls support columns, field types, rule conditions and actions already implemented. A new integration or an entirely new feature still requires code.

## 8. Review the administrator audit trail

Open **Evidence log** as an administrator. Find the ticket and other changes you made. Check the recorded actor, action, target, UTC time and request/sequence information.

Use **Export evidence** to download the JSON export and keep it alongside your review notes. It includes the events, export timestamp, chain-check result and head hash. The chain checks consistency; independent preservation is needed if these records are later used as formal investigation evidence.

Employees and managers cannot read the audit API. The trail records accepted workspace changes, not every hosting-login, failed request or external Microsoft event.

Finish by recording the decisions below.

## Your review decisions

| Area | Keep / change | Your note |
| --- | --- | --- |
| NW logo and NorthWallEg name |  |  |
| Colour direction: Limestone / Midnight / Nile |  |  |
| Public homepage layout |  |  |
| Egyptian imagery and colours |  |  |
| English and Arabic wording |  |  |
| Services and customer contact flow |  |  |
| Dashboard and ticket workflow |  |  |
| Calendar, notes, discussions and alerts |  |  |
| Admin settings and member permissions |  |  |
| Resource library and handbook |  |  |
| News presentation |  |  |
| Mobile layout and navigation |  |  |

## What this review version does and does not connect

| Area | Review version |
| --- | --- |
| Demo enquiries | Saved as workspace tickets after member sign-in; brief downloads are local |
| Tickets, comments, messages, notes, events and settings | Persisted in the hosted demo database |
| Authentication | Hosting-platform identity plus server-side employee membership |
| Customisation | Supported columns, five field types, event-based rules and member controls |
| News | Server fetches of three external English RSS feeds |
| Resource library | Source-linked guidance and original operational runbooks |
| Alerts | In-app notifications |
| Audit | Administrator-only server records with export and hash-chain verification |
| Microsoft 365 | Handbook and official portal links; no live customer-tenant administration |
| Email, SMS and WhatsApp delivery | Not connected |
| Jira, Teams and calendar synchronisation | Not connected |
| Attachments, calls, voice notes and end-to-end encrypted messaging | Not implemented |
| Background SLA timers and 24/7 SOC staffing | Not provided by this application |

The public review demo is marked for no indexing. A later approved public launch needs the intended domain, confirmed business details and the chosen hosting audience. The employee workspace remains restricted.


## News resilience update

The news API includes a verified publisher-headline snapshot. If every live feed fails, it returns `status: cached`, preserves the original successful `fetchedAt`/`snapshotFetchedAt`, and records the latest attempt separately as `checkedAt`. The interface labels this state. The failure cache expires after 60 seconds; a new attempt occurs on the next eligible request. The website and workspace request news every two minutes while open. Refresh the stored snapshot with `npm run news:refresh`; the script keeps the existing snapshot unless all configured feeds succeed. Feed parsing/allowlists live in `lib/news-source.ts`; snapshot data is in `lib/news-snapshot.json`. The workspace settings time zone controls the additional header clock; calendar inputs use browser local time and audit records use UTC.
