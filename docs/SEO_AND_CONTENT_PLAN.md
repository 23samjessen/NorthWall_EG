# NorthWallEg — SEO and content plan

Revision: **23 November 2026**.

## Goal and launch boundary

Help prospective customers understand the services, decide which problem to address and make a useful enquiry. The news feed supports that experience with selected English publisher headlines; original guides explain practical decisions in the company’s areas of work.

The hosted site remains **private for review and excluded from indexing** until company registration, the final domain and an explicit public-launch instruction are in place. Creating content or making the source repository public does not approve a public launch. Keep employee records, profiles, messages, handbook content and evidence logs protected after the marketing site opens.

Google does not promise that an eligible page will be indexed or achieve any particular position. This plan makes no forecast of traffic, search volume, enquiries or rankings. Measure results after launch and use them to improve the pages. [1], [2]

## Search intent map

These are editorial hypotheses based on the services offered, **not measured keyword volumes**. Use the wording that fits the question naturally. Check actual Search Console queries after launch before expanding the plan.

| Customer intent | Natural phrase examples | Best destination | What the page should resolve |
|---|---|---|---|
| Find Microsoft 365 help | Microsoft 365 support in Egypt; Microsoft 365 setup for small businesses | `microsoft-365` service page | Scope, migration approach, licensing dependencies and a clear enquiry route |
| Improve tenant security | Microsoft 365 security checklist; MFA setup for an SME | Microsoft 365 guide, linked to the service | Accounts, email, sharing, devices and a manageable review record |
| Find practical cyber defence | cybersecurity services in Egypt; endpoint and identity security | `cyber-defense` service page | Assessment, priorities, supported capabilities and separately agreed response arrangements |
| Prepare for ransomware | ransomware readiness for small businesses; backup restore testing | Ransomware guide, `cyber-defense` and `cloud-continuity` | Critical services, evidence of restoration and incident decisions |
| Reduce repetitive security work | SIEM and SOAR workflow; Splunk security monitoring support | SIEM/SOAR guide and relevant service scope | Inputs, investigation steps, approvals and measurable pilot outcomes |
| Improve office connectivity | network support in Egypt; Cisco network configuration; office Wi-Fi and VPN | `networks-vpn` service page | Survey, segmentation, remote access and acceptance checks |
| Protect cloud workloads | cloud security services; cloud backup and disaster recovery | `cyber-defense` and `cloud-continuity` | Actual workloads, responsibility boundaries and recovery targets |
| Understand a security update | malware research; exploited vulnerability alerts; Microsoft security updates | `/insights`, then the original publisher | Publisher, actual publication date, topic and source availability |

Use Egypt, Cairo or another service area when it describes real availability. Do not create near-identical city pages, invent offices or list locations merely to repeat a phrase. Product names describe supported discussion topics and service scope; they do not imply a Microsoft, Cisco or Splunk partnership or certification.

## Original public guides

Content lives in [lib/insights-content.ts](../lib/insights-content.ts). The English news and guide hub is `/insights`; individual guides use `/insights/[slug]`. The initial collection contains:

| Guide URL | Purpose | Related service IDs |
|---|---|---|
| `/insights/microsoft-365-security-checklist-egypt` | A practical account, email, file and device review | `microsoft-365` |
| `/insights/ransomware-readiness-growing-teams` | Recovery evidence and a short decision exercise | `cyber-defense`, `cloud-continuity` |
| `/insights/siem-soar-first-workflow` | A controlled first security-automation pilot | `cyber-defense`, `business-automation` |

Each guide has a title, summary, category, substantive update date, approximate reading time, introduction, sections, related services and official references. A section’s `sourceIds` must match entries in that guide’s `sources`. The guides are original public planning material; the employee troubleshooting library remains behind sign-in.

The page components and routes consume this module separately. Adding a data entry does not by itself prove that a route, navigation link, metadata entry or sitemap URL has been added. Verify all four before considering a new guide published. Keep slugs stable; if a published URL must change, add and verify a permanent redirect.

## News should lead to understanding

Google’s helpful-content guidance emphasises useful original work and added value. Its spam policy identifies mass pages built from scraped feeds with little user benefit as a risk. An attributed headline feed can help readers; making thousands of lightly rewritten article pages is not this project’s content strategy. [3], [4]

Keep the publisher’s headline, original link and publication date visible. Label cached data and partial source failures accurately. A retrieval time is not the time an attack happened. Selected international publishers do not establish complete worldwide coverage, and a critical vulnerability is not automatically evidence of exploitation.

For a topic worth explaining, prepare a separate original brief that answers:

1. Which products, versions or business processes are affected, according to the official source?
2. What would make the issue relevant to a prospective customer’s environment?
3. Which safe check or vendor-recommended action can an authorised administrator take?
4. What is uncertain, and where can the reader follow the original advisory?

Read the source article before adding that interpretation. Do not generate customer instructions solely from a headline or turn a publisher’s allegation into an independently verified fact. Avoid copying full articles, publisher images or the private employee handbook into public pages.

Feed endpoints, host/language checks, parsing and topic matching are maintained in `lib/news-source.ts`. `app/api/news/route.ts` handles delivery and cache status. Refresh behaviour and source diagnostics belong in the news/backend documentation. Topic badges and service icons indicate subject matter, not a live integration with those vendors.

## Editorial source and date policy

- Prefer original vendor advisories, Microsoft Learn, NIST, CISA, NCSC and other relevant primary publications for technical claims. Record the exact source URL beside the section it supports.
- Check product versions, licence requirements and publication dates when reviewing a guide. Keep recommendations distinct from a source’s factual statements.
- Change `updatedAt` only after a substantive content review or correction. Do not make old advice appear new by changing a date automatically. [3]
- Keep the publisher’s publication timestamp separate from news retrieval and checking timestamps. Never replace a missing publication date with the current time.
- Add a byline or reviewer only for an actual contribution or completed review. No person is described as the author, auditor or certified reviewer simply because they appear on the team page.
- Sam’s chosen primary public title is **Country Manager — Egypt**. His technical title belongs in contact details. Do not add Owner or Founder, and do not infer credentials from either title.
- Record material corrections in the source change history. Remove or update broken advice when a product changes; retain useful sources rather than silently replacing them with unrelated links.

Suggested working cadence: inspect feed errors during routine maintenance, review one useful content question each month and recheck an affected guide when a relevant vendor change appears. This is an editorial proposal; no scheduler or automatic review service is configured by this document.

## Page and technical essentials

Use a distinct, accurate title and description for each service and guide. Put the reader’s main question in a clear heading, link relevant services and guides with descriptive text, and write image alternatives for what the image conveys. Google recommends useful language in prominent page elements and crawlable links; it does not use the meta-keywords tag for ranking. [1], [2]

Keep canonical URLs on the approved final origin. A canonical identifies the preferred URL among duplicate or very similar pages; it does not replace access control or turn a private page into public content. Keep the sitemap consistent with the canonical public URLs. [5]

Use reciprocal `hreflang` references for real English/Arabic equivalents. The initial guides are English. Do not label an English guide as a completed Arabic translation. Add an Arabic alternate only when the corresponding experience is deliberately implemented and checked. [6]

If Article structured data is used on the guides, its headline, dates and any author information must match the visible page. Do not invent an author, rating or publication date. Article markup helps Google interpret article pages; it does not guarantee a search feature. [7]

The public origin and review flag are in [lib/company-profile.json](../lib/company-profile.json). Metadata, robots responses, sitemap generation and worker response headers are separate controls. See [SEO.md](SEO.md) and the source before launch; changing the JSON flag alone must not be treated as an indexing release.

## Launch checklist — only after approval

1. Confirm registration details, the approved public company name, real contact routes and service coverage. Leave unprovided IDs and addresses empty.
2. Attach the purchased domain through the supported hosting flow, use the exact returned DNS values, and verify the hostname and TLS. Follow [HOSTINGER_AND_DOMAIN.md](HOSTINGER_AND_DOMAIN.md).
3. Set the final origin, verify public canonical URLs and inspect each service, guide and news link on mobile and desktop.
4. Preserve employee authentication and its noindex boundary. Allow indexing only for approved public routes; review the HTML robots metadata, `robots.txt` response and `X-Robots-Tag` together.
5. Add the domain to the company’s Google Search Console account using Google’s current verification procedure. Use only the verification record supplied for that property; no domain or DNS value is assumed here.
6. Submit the final sitemap and inspect representative URLs. Check actual rendered content, indexability and structured data where used.
7. Review Search Console indexing, queries, clicks and landing pages after data accumulates. Connect enquiries to the pages that helped users, using only the measurement approach actually approved and implemented.

## References

All references are official Google documentation, checked on 23 November 2026.

[1] Google Search Central, “SEO Starter Guide.” https://developers.google.com/search/docs/fundamentals/seo-starter-guide

[2] Google Search Central, “Google Search Essentials.” https://developers.google.com/search/docs/essentials

[3] Google Search Central, “Creating helpful, reliable, people-first content.” https://developers.google.com/search/docs/fundamentals/creating-helpful-content

[4] Google Search Central, “Spam policies for Google web search.” https://developers.google.com/search/docs/essentials/spam-policies

[5] Google Search Central, “How to specify a canonical URL.” https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls

[6] Google Search Central, “Tell Google about localized versions of your page.” https://developers.google.com/search/docs/specialty/international/localized-versions

[7] Google Search Central, “Article structured data.” https://developers.google.com/search/docs/appearance/structured-data/article
