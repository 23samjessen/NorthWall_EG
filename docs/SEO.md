# NorthWallEg — search visibility and launch settings

## Implemented in the demo

The public site contains specific service content instead of a block of repeated keywords. Relevant terms appear naturally in titles, copy and service URLs: IT services in Egypt, Microsoft 365 setup and support, cybersecurity, managed IT support, network design, Wi-Fi, VPN, cloud infrastructure, employee portals, business automation, custom software and IoT integration.

Nine service pages have distinct titles and descriptions in both English and Arabic. They include service scope, practical outcomes and related business context. The pages use semantic headings, descriptive links and image alternatives. The sitemap includes public pages only. The English and Arabic service pages have canonical and language-alternative metadata. Social metadata and the NW favicon are configured.

No fictional customer logos, reviews, certifications, local office addresses or performance statistics are used. Cairo city coordinates in the branding panel identify the city as a visual motif, not a company office location. The existing Danish phone number was retained from the previous source package.

## Why the demo is not indexed

A private design-review deployment should not compete with the approved company website. There are three explicit controls:

1. `app/layout.tsx`: robots index/follow are false.
2. `app/robots.txt/route.ts`: disallows the review site.
3. `worker/index.ts`: returns `X-Robots-Tag: noindex, nofollow`.

The employee workspace remains private and noindex even if the public site is later launched. Never include its records, users, chat, handbook or audit pages in the public sitemap.

## After approval of the public launch

Set the final origin/domain in `lib/site-config.ts`, update canonical and social metadata, and verify the final registered company/contact details. Enable indexing only on the approved public pages; preserve noindex and server authorization for the employee area. Update `robots.txt` and publish the correct sitemap. Register the domain with Google Search Console and submit the sitemap using the owner's account. Add only verified business profiles and approved customer evidence.

Maintain useful pages for the actual customer questions: deliverables, supported locations, migration process, service coverage, response arrangements and sector needs. Measure qualified enquiries rather than chasing broad traffic alone. The current demo does not add analytics or advertising trackers.

## Limits

Keywords help a search engine understand a page; they do not guarantee ranking. Google describes helpful content, descriptive titles and links as useful foundations and explicitly does not promise first-place placement. Site history, relevant references, competition and the quality of the published content also matter.

Official guidance:

- Google SEO Starter Guide: https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- Google Search Essentials: https://developers.google.com/search/docs/essentials
- SEO guide for developers: https://developers.google.com/search/docs/fundamentals/get-started-developers
