# Hostinger, your domain, and the future NorthWallEg launch

Verified against official documentation on 23 November 2026. Hosting products and limits can change; check the linked pages when choosing a plan.

## Recommended route

**Buy your domain at Hostinger and connect it to the current NorthWallEg application hosting.** The domain registrar manages the address you own. The application host runs the website, employee workspace, authentication integration, and database. These can be different providers.

The current application already uses a Cloudflare Worker, D1 storage, and the hosting platform's trusted sign-in gateway. Keeping that application hosting avoids a runtime and authentication migration. Hostinger can manage the DNS records for a domain whose authoritative nameservers point to Hostinger. [1]

Keep the website private for review until the company is registered and you are ready to launch. Attaching a domain does not change the site's audience or grant employee access. Making the source repository public also does not make the hosted application public.

No domain has been supplied for this project yet. This guide therefore contains no DNS destination addresses or verification tokens. Obtain those values from the application host for the exact domain you purchase.

## Your hosting choices

| Choice | How it works | What it means for NorthWallEg |
| --- | --- | --- |
| **Hostinger domain + current application hosting** | Register the domain at Hostinger and point the required DNS records to the existing application host. | Recommended. Preserve the Worker, database, trusted authentication gateway, and private review access. |
| **Hostinger managed Node application** | Hostinger currently offers managed Node on Business/Unlimited web hosting and Cloud plans, with Git repository or archive deployment. [2] | Requires a planned code and data migration. The current ZIP is not a ready-to-run Hostinger Node deployment. |
| **Hostinger VPS** | Run and manage the application's server environment yourself; Hostinger offers Node setup options with root access. [3] | More control over services and ports, with server maintenance and backups to operate. The Worker, data, and authentication dependencies still need adaptation. |

A Hostinger account alone does not identify which hosting products you have. Before choosing Hostinger to run the application, check your exact plan name and whether hPanel offers **Web App / Node.js** or **VPS**. CPU, memory, storage, and site quotas depend on that plan. There is no need to buy an application-hosting upgrade merely to use a Hostinger-registered domain with the current host.

## Why this app needs work before moving to Hostinger compute

Hostinger supports Next.js and standard Node frameworks. That support does not establish compatibility with every deployment that uses a Next.js-style application structure. [2]

NorthWallEg currently uses **Vinext on Cloudflare Workers**. Cloudflare documents Vinext's Worker deployment and access to platform bindings through `cloudflare:workers`; D1 is Cloudflare's SQL database accessed through a Worker binding. [4], [5]

The following migration requirements are engineering conclusions from this application's dependencies and those documented runtime differences:

- **Server runtime:** provide a supported Node server entry point and build/start configuration, replacing the Worker deployment assumptions.
- **Database:** retain D1 through a deliberately designed server-side integration or migrate its data to an appropriate database. Preserve workspace revisions, transactions, membership records, and the audit chain. Copying the repository does not copy the hosted D1 data.
- **Authentication:** implement a real identity provider and verified server sessions on the destination. The current host supplies trusted identity headers; an ordinary Hostinger server will not supply that gateway automatically. Do not accept identity headers sent directly by a browser as proof of identity.
- **Storage and secrets:** map any required object-storage bindings, server-only configuration, and credentials to the destination. Local demonstration identity settings are not production authentication.
- **Verification:** test sign-in, role restrictions, personal notes, direct-message access, ticket writes, news fetching, and audit persistence in a separate destination environment before changing the live address.

Uploading only static files would omit the workspace API and its persistent operations. A source ZIP is a handover of code; it is not an export of employee data or a completed migration.

### Current managed Node limits

Hostinger's published managed Node limits are: [6]

| Plan | NPROC | Entry processes |
| --- | ---: | ---: |
| Business/Unlimited | 120 | 60 |
| Cloud Startup | 200 | 100 |
| Cloud Professional | 400 | 200 |
| Cloud Enterprise | 600 | 300 |
| Cloud Enterprise Plus | 800 | 400 |

NPROC counts processes and threads across the plan; it is not a supported-user count. Websites share the plan's process and memory resources. Node site count follows the plan's website quota. Requests stop after **120 seconds**. Managed hosting does not accept inbound WebSockets, guarantee continuous background workers, or provide custom-port services such as Docker or Redis. [6]

The present workspace uses periodic chat polling. A future design with WebSocket chat or continuous queue workers would need a suitable service architecture. Do not estimate employee capacity from the process table: load-test the chosen application and plan.

## Connecting the domain without moving the app

When you have purchased the domain and are ready to configure it:

1. Choose the canonical address: the root domain or a `www` hostname. Decide whether both should reach the site and which should redirect to the other.
2. Keep the existing hosted site private while preparing the connection. Use the current application's supported **Add custom domain** operation for the chosen hostname and existing project. It returns the actual DNS targets, verification records, and domain/SSL status.
3. Save the returned instructions. A subdomain normally receives a **CNAME destination**; the root-domain flow can return **A-record targets**. Use the exact record types and values returned for this project. Do not infer them from the preview URL.
4. At the authoritative DNS provider, update the required records. If Hostinger manages the nameservers, open **hPanel → Domains → DNS**, select the domain, and use its DNS records page. If another provider manages the nameservers, edit the records there. [1]
5. Add any ownership/SSL verification records exactly as supplied. Preserve existing mail records, including MX and the relevant SPF, DKIM, and DMARC records. Export the current DNS zone before changes if it already serves other services. [1]
6. Refresh the application's custom-domain status until ownership validation and HTTPS certificate status succeed. Check the intended root/`www` behavior and sign-in flow over HTTPS.

Hostinger's CNAME editor expects the record's host label and destination hostname. Use the application's returned root-domain instructions for the apex rather than copying a subdomain CNAME rule there. DNS propagation can take time; Hostinger advises allowing up to 24 hours for its CNAME changes. [7]

Do not change nameservers solely because the app runs elsewhere when the required records can be managed in the existing authoritative zone. A domain connection is separate from publishing the marketing website.

## Future launch checklist

These are preparation and verification steps. Company registration and your decision to go live remain the launch gate; this document does not schedule an automatic publication.

- [ ] Confirm registration is complete and approve the public company details. Enter real contact channels, locations, team names/roles, and approved photographs in `lib/company-profile.json`, following [COMPANY_CONTENT.md](COMPANY_CONTENT.md).
- [ ] Supply the registration and tax identifiers you want displayed. Keep unprovided fields empty and omit empty labels from public pages. Do not publish example numbers as company identifiers.
- [ ] Choose and purchase the domain, then confirm the exact canonical hostname.
- [ ] Connect that hostname using the generated DNS instructions and verify the HTTPS certificate while review access remains private.
- [ ] Update the site's canonical origin, metadata, sitemap, social previews, and any identity-provider return URLs for the final hostname. Check both supported language routes and links.
- [ ] Confirm that the published contact information is correct. Test the actual contact behavior; displaying an email address or generating a brief does not itself install an email delivery service.
- [ ] Preserve the current database and storage bindings. Record the deployed source revision and prepare the database backup/restore procedure before changing runtime or storage configuration.
- [ ] Test with an anonymous visitor, a normal employee, and an administrator. Public marketing should be accessible after launch; employee resources and private APIs must still enforce verified sign-in and active membership.
- [ ] Test ticket creation and assignment, replies/mentions, notes, chat, calendar, admin changes, news timestamps, and evidence records on the final hostname. Check phone and desktop layouts.
- [ ] Once the registration condition is met and you instruct the launch, change the intended public audience and search-indexing settings. Keep workspace and account routes out of public indexing. Review the live pages and redirects after that change.

Search metadata helps describe the business accurately; it cannot guarantee a top Google position. Public launch, domain attachment, repository visibility, and employee membership are four separate settings.

### Where to configure the public details

`lib/company-profile.json` is the central public configuration: company registration fields, website origin/review settings/hero image, contact arrays, and public team information. `lib/site-config.ts` derives the values used by the site. Follow [COMPANY_CONTENT.md](COMPANY_CONTENT.md) for the exact fields and image instructions, and [CUSTOMISATION.md](CUSTOMISATION.md) for design and feature changes.

Employee **My profile** settings are separate from the public team directory. Private profile photographs use the application's object storage; do not copy employee data or photo uploads into the public source repository.

## Source and data ownership

The approved application's source belongs in `23samjessen/NorthWall_EG`. Keep runtime credentials, user records, tickets, notes, messages, and evidence data out of the public Git repository. Store production records in the configured application database and protected storage.

Pushing source to GitHub does not automatically update the current Sites deployment, and editing the hosted project does not automatically update GitHub. See [GITHUB_AND_DEPLOYMENT.md](GITHUB_AND_DEPLOYMENT.md) for the source/deployment workflow and [BACKEND.md](BACKEND.md) for database and identity details. If a future Hostinger Git deployment is deliberately configured, that is a separate deployment pipeline. [2]

## Official references

[1] Hostinger, “How to manage DNS records at Hostinger.” Accessed 23 November 2026. <https://www.hostinger.com/support/1583249-how-to-manage-dns-records-at-hostinger/>

[2] Hostinger, “How to add a Node.js web app in Hostinger.” Accessed 23 November 2026. <https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/>

[3] Hostinger, “Node.js hosting options at Hostinger.” Accessed 23 November 2026. <https://www.hostinger.com/support/node-js-hosting-options-at-hostinger/>

[4] Cloudflare, “Next.js — Workers documentation.” Accessed 23 November 2026. <https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/>

[5] Cloudflare, “Getting started — D1 documentation.” Accessed 23 November 2026. <https://developers.cloudflare.com/d1/get-started/>

[6] Hostinger, “Hostinger Node.js limits for web and cloud plans.” Accessed 23 November 2026. <https://www.hostinger.com/support/hostinger-node-js-limits-for-web-and-cloud-plans/>

[7] Hostinger, “How to manage CNAME records at Hostinger.” Accessed 23 November 2026. <https://www.hostinger.com/support/4738777-how-to-manage-cname-records-at-hostinger/>
