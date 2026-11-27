# NorthWallEg marketing-consent release

Date: 26 November 2026

## Complete upload package

`NorthWallEg-Hostinger-Marketing-Consent.zip` is a complete source project for the existing Hostinger Next.js website. Its baseline is `NorthWallEg-Hostinger-WhatsApp-Only.zip` (SHA-256 `ef82df05593272648f10e8bb37b0c8bb56db7c1d6199828af80c4b094a6a3868`).

The original source commit remains recorded in `hostinger-upload.json`; `source_dirty: true` indicates subsequent local updates. This release has not been pushed to GitHub or deployed to Hostinger by this packaging task. The production database, mailbox, employee accounts and hosting variables were not accessed or modified.

## Changes in this release

- English/Arabic cookie banner and preferences dialog with equally presented accept/reject choices, independent Meta/TikTok switches, persistent settings access and a downloadable local choice receipt.
- Optional Meta Pixel (Facebook/Instagram) and TikTok Pixel adapters with consent gating, manual event controls, abort/revocation handling and unique event identifiers.
- Public page/service views, enquiry-dialog openings, brief downloads, WhatsApp/phone/email clicks, visible-time engagement and scroll thresholds. Clicks are not reported as confirmed enquiries or purchases.
- A small allowlist of campaign codes, consented attribution storage and controlled event properties.
- Public-document eligibility from the trusted Next.js proxy. Private/API routes, employee-cookie document requests, unsafe URL/referrer contexts and browser privacy signals exclude advertising.
- Preference expiry, cross-tab withdrawal checks, first-party marketing-storage cleanup and page refresh after a saved change.
- Conditional provider network destinations in the existing nonce-based security policy.
- Storage-restricted browsers can still change the existing visual theme without a preference-storage exception breaking that action.
- Updated privacy wording and an activation/maintenance manual at `docs/MARKETING_AND_COOKIES.md`.

The existing three designs, photographs, company/contact data, floating WhatsApp component, employee workspace, email/MFA authentication and database schema are retained. No new dependency is required. No database migration or owner reprovisioning is needed for this release.

## Verification completed

- Production `npm run build` succeeded using the existing root `.next` standalone profile, with TypeScript checking.
- 47 marketing checks passed: consent/CSP policy, actual controller behavior in an isolated browser harness, and provider adapters with simulated script loading.
- 17 existing HTTP-security checks and 6 native Hostinger policy checks passed.
- The generated standalone application returned HTTP 200 for the homepage, Arabic homepage, insights, Microsoft 365 service page and sign-in. Public pages rendered Cookie settings and the existing WhatsApp link. With advertising unconfigured, the rendered markers remained disabled and CSP contained no advertising destinations.
- The real consent component was visually checked with a nontracking test fixture on desktop, at 390 × 844 in English/Arabic and at 320 × 568. Dialog scrolling, keyboard focus restoration, equal consent actions, three themes, privacy-signal state and spacing from WhatsApp were checked. No provider account or real advertising event was used in these tests.

## Activation still required

The source has no real Pixel IDs and defaults to disabled advertising. Configure your own IDs and reviewed account settings through Hostinger's environment variables, then rebuild. Follow `docs/MARKETING_AND_COOKIES.md` for real-platform Test Events verification before relying on marketing reports. Nothing in the local tests proves live account delivery or future third-party SDK behavior.

This release adds no paid campaigns, central consent audit database, server advertising API or public enquiry-mail endpoint. The existing enquiry form remains its signed-in demo workflow, and is not counted as a lead. The local consent receipt describes one browser's preference and is not a legal-compliance certificate.

## Future maintenance

Start with `START_HERE_HOSTINGER.md` and `docs/MARKETING_AND_COOKIES.md`. Keep the native Next.js preset, root `./`, build `npm run build` and output `.next`. Preserve the working production environment and use a fresh source deployment for this update. Changes to public marketing variables require a rebuild.

When extending the integration, keep advertising off private pages, use fixed event names and allowed properties, bump the consent-policy version when its scope changes, and recheck the browser/platform network behavior. The ZIP deliberately excludes production secrets, dependencies, generated output and runtime records.
