# NorthWallEg — search visibility and launch settings

## Implemented in the demo

The public site contains specific service content instead of a block of repeated keywords. Relevant terms appear naturally in titles, copy and service URLs: IT services in Egypt, Microsoft 365 setup and support, cybersecurity, managed IT support, network design, Wi-Fi, VPN, cloud infrastructure, employee portals, business automation, custom software and IoT integration.

Nine service pages have distinct titles and descriptions in both English and Arabic. They include service scope, practical outcomes and related business context. The pages use semantic headings, descriptive links and image alternatives. The English and Arabic home/service pages have canonical and language-alternative metadata; `/en` points to the main English home URL. Social metadata and the NW favicon are configured.

The English `/insights` hub adds server-rendered publisher headlines, search/topic filters and three original planning guides at stable URLs. Guide content has official references and a deliberate review date. The public sitemap includes the hub and guides, excludes the duplicate `/en` home route and never includes employee records. Organization, Service, CollectionPage, Article and breadcrumb structured data describe the relevant public content. Blank social/registration details do not become fabricated schema values. External RSS headlines are not presented as NorthWallEg-authored news articles.

No fictional customer logos, reviews, certifications, local office addresses or performance statistics are used. Cairo city coordinates in the branding panel identify the city as a visual motif, not a company office location. The existing Danish phone number was retained from the previous source package.

## Why the demo is not indexed

A private design-review deployment should not compete with the approved company website. There are three explicit controls:

1. `lib/seo.ts` derives public robots metadata from `website.isReviewDemo` in `lib/company-profile.json`. That flag is currently `true`, so public pages have index/follow disabled.
2. `app/robots.txt/route.ts` disallows the entire review site while the same flag is true.
3. `worker/index.ts` returns `X-Robots-Tag: noindex, nofollow` for the review site and always for the employee/API/auth routes.

These search directives supplement the existing private hosting audience; they are not access controls. Keep review mode and owner-private access in place until registration and the owner's launch instruction.

The employee workspace remains private and noindex even if the public site is later launched. Never include its records, users, chat, handbook or audit pages in the public sitemap.

## After approval of the public launch

Set the final `website.origin` in `lib/company-profile.json`, verify the registered company/contact details and check the rendered canonical/social URLs. Set `website.isReviewDemo` to `false` only as part of the approved launch. This coordinates public robots metadata, the robots file and response headers; employee pages retain noindex and server authorization. Hosting access and DNS still need their separate approved changes. Register the final domain with Google Search Console and submit `/sitemap.xml` using the owner's account. Add only verified business profiles and approved customer evidence.

The detailed keyword-intent map, editorial workflow and measurement plan are in [SEO_AND_CONTENT_PLAN.md](SEO_AND_CONTENT_PLAN.md). Treat proposed search phrases as planning hypotheses; no search-volume or ranking numbers have been invented. Source coverage and freshness are documented in [NEWS.md](NEWS.md).

Maintain useful pages for the actual customer questions: deliverables, supported locations, migration process, service coverage, response arrangements and sector needs. Measure qualified enquiries rather than chasing broad traffic alone. The current demo does not add analytics or advertising trackers.

## Limits

Keywords help a search engine understand a page; they do not guarantee ranking. Google describes helpful content, descriptive titles and links as useful foundations and explicitly does not promise first-place placement. Site history, relevant references, competition and the quality of the published content also matter.

Official guidance:

- Google SEO Starter Guide: https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- Google Search Essentials: https://developers.google.com/search/docs/essentials
- SEO guide for developers: https://developers.google.com/search/docs/fundamentals/get-started-developers
