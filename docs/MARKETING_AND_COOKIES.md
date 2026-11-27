# NorthWallEg marketing and cookie guide

Updated: 26 November 2026.

This update adds separate visitor choices for Meta (Facebook and Instagram) and TikTok advertising measurement. It preserves the existing website content, designs, employee workspace and floating WhatsApp button. Marketing is **off by default**. The supplied project contains no configured advertising Pixel IDs, so it does not start either advertising integration.

No advertisements, audiences or campaigns have been created, and no advertising spend has been started. Installing this code does not automatically launch a retargeting campaign or improve Google rankings. Reports and audiences, once configured and receiving consented events, are managed in the respective advertising platforms; this update does not add a marketing dashboard to the employee workspace.

## 1. What visitors can do

Visitors can open **Cookie settings** on public pages. When a reviewed provider is enabled, the first-visit banner offers **Reject optional**, **Accept all** and **Settings**. Settings allow separate Meta and TikTok choices. Optional choices start off; closing the dialog, scrolling, or continuing to use the website does not give permission.

Visitors can return to Cookie settings, save different choices, or reject optional marketing. Saving refreshes the page so that its server-generated security policy matches the choice. Rejecting marketing does not disable public information, contact links or WhatsApp.

If no providers are configured, Cookie settings explains that only necessary storage is active. It does not advertise inactive partners as though they were collecting visitor data. Browser Global Privacy Control and Do Not Track signals keep optional marketing off, including when an older saved choice allowed it.

**Download my choice** produces a JSON file containing this browser's saved choice, policy version and timestamps. This is a local preference receipt, not an authenticated identity record, signed proof of consent or server-side consent audit log. There is no new consent database or central register of visitor decisions.

## 2. Settings for the owner

These five optional settings are read in `lib/marketing/config.ts`. Values beginning `NEXT_PUBLIC_` are public configuration embedded into the browser build. **Never put account passwords, API access tokens, database credentials or authentication secrets in these variables.**

| Variable | Default | When to change it |
| --- | --- | --- |
| `NEXT_PUBLIC_MARKETING_ENABLED` | `false` | Set to the exact string `true` when you are ready to offer reviewed advertising integrations. |
| `NEXT_PUBLIC_META_PIXEL_ID` | Empty | Enter your own Meta Pixel/Dataset's browser Pixel ID, as supplied by Meta Events Manager. The integration expects 5–25 digits. |
| `NEXT_PUBLIC_TIKTOK_PIXEL_ID` | Empty | Enter your own TikTok Pixel ID. The integration expects 15–35 uppercase letters or digits. |
| `NEXT_PUBLIC_META_MANUAL_MODE_CONFIRMED` | `false` | Set to `true` only after completing the Meta account-settings review below. |
| `NEXT_PUBLIC_TIKTOK_MANUAL_MODE_CONFIRMED` | `false` | Set to `true` only after completing the TikTok account-settings review below. |

A provider requires all three conditions: the master switch is `true`, its ID is valid, and its manual-mode confirmation is `true`. The two providers can be enabled independently. These owner settings make a provider available; they do not replace each visitor's separate permission.

You need your public Pixel IDs to connect the integrations. You do not need to share an advertising-account password, Gmail password, Hostinger password, API access token or employee login password. This update does not introduce an advertising login or a new website administrator password.

The consent context includes the policy version and enabled provider IDs. Changing a provider ID, adding a provider, or changing `CONSENT_VERSION` invalidates the previous saved context and requires a fresh choice. Set the master switch to `false` and rebuild to disable all integrations in newly loaded pages. A previously open document may remain loaded until refreshed, so an urgent shutdown should also use the provider's account controls where appropriate.

### Meta account review

In **Meta Events Manager**, select the correct data source and review its Settings and Event Setup rules:

1. Turn **Automatic Advanced Matching** off.
2. Turn off automatic event detection and remove Event Setup Tool rules that would collect or duplicate events from these pages.
3. Check that there is no second Pixel, tag-manager container, plugin or server integration independently collecting these visits.
4. Confirm the data source belongs to NorthWallEg and its public site, then set `NEXT_PUBLIC_META_MANUAL_MODE_CONFIRMED=true`.

The code calls `fbq('set', 'autoConfig', false, pixelId)` before initialization, disables automatic history PageViews, and does not provide an advanced-matching identity object. These code controls do not substitute for reviewing account-side settings. There is no Meta Conversions API, automatic CAPI opt-in, customer-list upload or enhanced matching in this update. See the official [Meta advanced guide](https://developers.facebook.com/documentation/meta-pixel/advanced) and [Meta-maintained browser template](https://github.com/meta/GoogleTagManager-WebTemplate-For-FacebookPixel/blob/main/template.tpl).

### TikTok account review

In **TikTok Ads Manager → Tools → Events Manager → Data Sources → your Pixel → Settings**:

1. Turn **Automatic Advanced Matching** off.
2. Disable Assisted Events, automatic capture and Event Builder rules that could inspect forms, read customer information or duplicate these events. Review any expanded data-sharing options before activation.
3. Check for duplicate installations in tag managers, plugins and partner integrations.
4. Confirm the correct Pixel, then set `NEXT_PUBLIC_TIKTOK_MANUAL_MODE_CONFIRMED=true`.

TikTok documents that AAM can collect matching information from input fields, static page text and data-layer globals. This implementation does not call `ttq.identify()` and supplies a history-observer disable option, but there is no claim that a local switch overrides every account setting. Review the [official TikTok AAM instructions](https://ads.tiktok.com/resources/help/article/how-to-set-up-automatic-advanced-matching?lang=en). No TikTok Events API or customer-list upload is implemented here.

## 3. Deploying the update on the existing Hostinger website

Use the existing **native Next.js ZIP deployment**. The marketing feature does not require a different hosting preset, a new database, a new admin account or a rerun of `hostinger/setup.mjs`.

1. Keep a copy of the last working ZIP.
2. In Hostinger, open **Websites → northwallegy.com → Environment variables**. Preserve all existing private configuration. Add the optional marketing settings only when ready; keeping them absent or `false` leaves advertising off.
3. Open **Deployments → Redeploy**, choose the updated source ZIP, and keep the existing Next.js settings below.
4. Rebuild and redeploy. A process restart alone does not update `NEXT_PUBLIC_` values already embedded by Next.js.
5. Test the public website in a separate signed-out browser profile. New document requests carrying your employee session deliberately exclude marketing, including requests for public pages.

| Deployment field | Keep this setting |
| --- | --- |
| Framework | Next.js |
| Root directory | `./` |
| Package manager | npm |
| Build command | `npm run build` |
| Output directory | `.next` |
| Entry file | Next.js preset default / empty |
| Start command, if shown | `npm start` |
| Node.js | Keep the working supported version; this project supports 22.13.0 or later and the existing guide recommends 24.x. |

Do not use the legacy `.hostinger-app` output settings for this package. Keep the working `APP_ORIGIN`, `PUBLIC_LAUNCH`, database, SMTP, HTTPS and authentication values. Optional advertising also requires the existing public-launch setting to be `true`; this update does not decide when the company is ready to launch.

## 4. Events that are actually implemented

Events are emitted only in an eligible public document after consent, and only to the provider the visitor allowed. Fixed event names and a small property allowlist are used. Event IDs support identifying individual actions; no browser/server deduplication service is claimed because no server advertising integration is present.

| Internal event | Meta / TikTok event | Trigger and meaning |
| --- | --- | --- |
| `page_view` | `PageView` / `ttq.page()` | One view of an eligible public document. |
| `service_view` | `ViewContent` / `ViewContent` | A known service details page or service-options dialog is opened; one event per service per document. |
| `enquiry_open` | `EnquiryFormOpened` / `EnquiryFormOpened` | The enquiry dialog opens. This is interest, not a submitted lead. |
| `brief_download` | `BriefDownloaded` / `BriefDownloaded` | The website creates the downloadable project brief. Its text is not included in the advertising event. |
| `whatsapp_click` | `WhatsAppClick` / `WhatsAppClick` | A real visitor click on a `wa.me` contact link. It does not prove that WhatsApp opened or a message was sent. |
| `phone_click` | `PhoneClick` / `PhoneClick` | A real visitor click on a telephone link; no number is sent in the manual event. |
| `email_click` | `EmailClick` / `EmailClick` | A real visitor click on an email link; no address or message content is sent in the manual event. |
| `engaged_visit` | `EngagedVisit` / `EngagedVisit` | Approximately 30 seconds with the document visible after tracking starts; once per document. |
| `scroll_depth` | `ScrollDepth` / `ScrollDepth` | Reaches 50% or 90% of the scrollable document; each threshold at most once per document. Very short pages are excluded. |

Names other than PageView and ViewContent are custom events. TikTok's [custom-events documentation](https://ads.tiktok.com/resources/help/article/custom-events?lang=en) supports reporting and audience creation but says custom events are not campaign-optimization goals. Do not select a custom click as proof of a successful enquiry or purchase.

**There is no completed-lead conversion in this release.** The existing enquiry form is an internal review/demo workflow connected to the signed-in workspace. It is not a new public contact-mail delivery service. A genuine public enquiry endpoint with a server-confirmed result would be needed before adding a successful Lead/SubmitForm event. No form values, employee messages, tickets or uploaded portraits are forwarded by the new manual event code.

## 5. Campaign links and attribution

Edit `lib/marketing/campaigns.json` to add approved, nonpersonal campaign codes. The initial list is:

```json
{
  "campaignCodes": ["m365-eg", "cyber-eg", "northwall-eg"]
}
```

A campaign code must begin with a lowercase letter and contain 2–64 lowercase letters, digits or hyphens. Use names for campaigns, never a visitor's name, email, telephone number or customer ID. Rebuild after changing this file.

Example links:

```text
https://northwallegy.com/?utm_source=facebook&utm_medium=paid_social&utm_campaign=m365-eg
https://northwallegy.com/?utm_source=instagram&utm_medium=paid_social&utm_campaign=cyber-eg
https://northwallegy.com/?utm_source=tiktok&utm_medium=paid_social&utm_campaign=northwall-eg
```

Supported sources are `facebook`, `instagram`, `tiktok`, `linkedin`, `google`, `bing` and `newsletter`. Supported mediums are `paid_social`, `cpc`, `social` and `email`. This source list is for attribution labels; it does not install LinkedIn, Google Analytics, Google Ads, Bing or newsletter trackers.

After marketing consent, the code can retain one approved source/medium/campaign combination for up to 30 days. Known `fbclid` and `ttclid` values are accepted only in the expected restricted format and stored only after consent for their respective provider. The code removes accepted campaign/click parameters from the address before starting the SDKs. It does not generate fake click IDs.

Unknown or duplicate query parameters, unapproved campaign codes, or unexpected fragments keep marketing off for that document. They are not silently deleted. Referrers also fail closed: a same-site referrer must be a known public path; an external referrer must be a bare origin without query or fragment. Consequently, a link from an external page that exposes its full path may legitimately produce no advertising events. This is a deliberate privacy tradeoff, not a broken contact button.

## 6. Storage and retention

| Storage | Purpose and duration |
| --- | --- |
| `__Host-nw_marketing` cookie | Necessary preference record containing policy/context, choices and timestamps; up to 180 days from the saved decision. Secure, host-only, path `/`, SameSite=Lax. |
| `__Host-nw_campaign` cookie | Optional allowlisted campaign attribution; up to 30 days after a consented capture. |
| `nw.marketing.consent-change` local storage | A timestamp/random change marker used to notify other tabs; not an advertising visitor profile. Persists until overwritten or site storage is cleared. |
| Meta `_fbp` | Provider browser identifier; typically 90 days. Provider/browser behavior may refresh or shorten it. |
| Meta `_fbc` | Meta click identifier. This code's consented capture uses 90 days; Meta may manage its own subsequent cookie behavior. |
| TikTok `ttclid` | This code initially stores a consented click identifier for 30 days. TikTok's SDK may subsequently manage/refresh its own identifiers; its published cookie table gives a provider default of 13 months. |
| TikTok `_ttp`, `ttcsid` / `ttcsid_<pixel>` | Provider advertising/session identifiers. TikTok publishes defaults of 13 months from being set or last used. |
| TikTok `_tt_enable_cookie` | Provider cookie-state marker where used. The SDK inspected on 26 November 2026 uses a configurable default of 390 days; this is implementation-observed, not a guaranteed future duration. |

Provider entries describe possible storage when those providers are configured and accepted. They are not a live inventory of cookies on NorthWallEg or a promise that every cookie will appear. TikTok and Meta may also access cookies on their own domains. Browser restrictions and account settings can affect behavior. Their retention of received information is separate from a browser cookie's expiry.

The employee security/session cookies and the existing selected-design preference are separate from advertising. Rejecting marketing does not remove an employee session or change the selected design.

If the browser cannot save a changed preference, the interface reports the failure and stops tracking in the current document. A failed write is not proof that the choice was saved for future visits; check browser storage settings and try again.

On withdrawal, the code calls the provider's revoke method, stops pending event delivery, removes the known accessible first-party marketing cookies/storage and refreshes the document. It also responds to changed choices in other tabs and preference expiry. While advertising is active, a two-second consent check complements storage/focus/visibility notifications, including where cross-tab local-storage notification is unavailable. The site cannot delete every third-party cookie, erase all data already held by advertising companies, or remove arbitrary vendor storage it does not know about. Visitors can also manage site data in their browser and use the providers' privacy controls.

## 7. Boundaries and security controls

Marketing requires HTTPS, public launch, a reviewed configured provider, a current matching consent record, an eligible route and acceptable URL/referrer context. Unknown routes and private/API pages fail closed. A new document request containing the employee session or pending-verification cookie is excluded, even if it requests the public homepage. Global Privacy Control and Do Not Track are checked on the server and in the browser.

An already-open public tab does not learn that an employee has signed in through a different tab until the public document is refreshed. It may continue its previously consented public-page measurement in the meantime. It never receives the other tab's private workspace content. Do not describe this as immediate automatic suppression of every existing public tab after a cross-tab login. Refresh those public tabs when signing in, or use separate employee and visitor browser profiles.

The server adds provider network destinations only to consented public documents. The existing nonce/strict-dynamic script policy remains in place. This update does not introduce `unsafe-inline`, wildcard advertising domains or a noscript tracking image that bypasses the choice. Public-to-private navigation must remain a full document navigation; do not add a persistent root-level Pixel or a client-side private-route transition that keeps a marketing SDK alive.

The manual event properties contain only controlled page type, language, known service identifiers, approved campaign labels and permitted scroll thresholds. They do not include free-text inputs, contact addresses, phone numbers, raw search strings or employee identifiers. Advertising SDKs can still receive network/browser metadata, IP addresses and their own advertising identifiers. Do not describe this as anonymous tracking or promise that turning off advanced matching prevents all personal-data processing.

Current TikTok reporting origins were checked against provider-hosted SDK source: `https://analytics.tiktok.com` and `https://analytics-ipv6.tiktokw.us`. The latter is the spelling in the inspected code; the current help article contains a different spelling. SDK history-observer suppression and the PageView event-ID option are also implementation-observed. Future SDK revisions or account configurations may require review. Do not solve a blocked request by adding broad wildcards or allowing arbitrary scripts.

## 8. Activation checks before using reports

The included local tests exercise consent rules, route policy and the browser runtime with test adapters. They do not prove that real advertising accounts received events. Use **Meta Events Manager Test Events** and **TikTok Events Manager Test Events**, together with browser developer tools, once your own IDs and reviewed settings are configured.

| Check | Expected result |
| --- | --- |
| No ID, missing confirmation flag, or master switch off | No provider SDK request; Cookie settings reports necessary-only storage. |
| Fresh visitor before choosing | No Meta/TikTok SDK, beacon or marketing cookie. |
| Reject optional and reload | Public site and WhatsApp still work; advertising remains off. |
| Accept Meta only | Only Meta receives the allowed public events. |
| Accept TikTok only | Only TikTok receives the allowed public events. |
| Withdraw a previously allowed choice | Provider revoke is called, known local advertising storage is cleared, page refreshes, and no new advertising events are sent. |
| Enable GPC or DNT | Optional advertising stays off despite an earlier opt-in. |
| Open sign-in/workspace, or request a fresh public document while signed in/pending MFA | No advertising SDK or advertising events in those documents. An older public tab requires refresh to pick up a login from another tab. |
| Add an unknown parameter such as `?private_note=test`, or visit with a private/full-path referrer | Marketing fails closed; page use remains available. Use fictional values only. |
| Open each known service, click WhatsApp, scroll and remain visible for 30 seconds | Correct event names, controlled properties and sensible duplicate handling appear in the provider test tools. |
| Open the enquiry dialog or save a demo enquiry | No successful-lead/purchase conversion is claimed; entered fields are absent from manually sent event properties. |
| Use an approved campaign link | Attribution is captured only after consent; accepted query values are removed before SDK initialization. |
| Change a choice in another tab, expire it, or return through browser Back | Old consent does not resume tracking without policy re-evaluation. |

Inspect both Network requests and Application/Storage cookies. Check the console for CSP blocks and the platforms for duplicate events, automatic events, unexpected form values or unexpected matching fields. Ad blockers and browser tracking protection can prevent delivery; do not bypass the visitor's controls to improve counts. Test phone/email/WhatsApp intent without actually sending messages unless that is intended.

## 9. Where to maintain the feature

| File | What to change there |
| --- | --- |
| `lib/marketing/config.ts` | Public environment-variable wiring and current configuration. |
| `lib/marketing/policy.mjs` | Consent version/lifetimes, provider-ID checks, route allowlist, query/referrer rules and permitted event fields. |
| `lib/marketing/campaigns.json` | Approved campaign codes. |
| `lib/marketing/runtime.ts` | Consent storage, withdrawal, campaign handling, event dispatch and engagement/click measurement. |
| `lib/marketing/providers.ts` | Meta/TikTok loaders, consent APIs and event adapters. |
| `lib/marketing/csp.mjs` | Consent-dependent public-document network allowlist. |
| `proxy.ts` and `hostinger/native/proxy.ts` | Next.js/Hostinger request-policy integration; keep the native export template consistent. |
| `app/layout.tsx` | Server-generated public-document eligibility markers. |
| `components/marketing-consent.tsx` | English/Arabic banner, settings dialog, disclosures and receipt download. |
| `components/marketing-consent.module.css` | Cookie controls' spacing, colors and responsive appearance. |
| `components/marketing.tsx` | Existing public service/enquiry/brief interactions and consent UI placement. |
| `components/insights-shell.tsx` | Public insights shell and its shared controls. |
| `components/whatsapp-button.tsx`, `components/whatsapp-button.module.css` | Existing floating WhatsApp presentation. |
| `lib/company-profile.json` | Existing company contact details and configured WhatsApp number. |
| `scripts/test-marketing.mjs`, `scripts/test-marketing-runtime.mjs`, `scripts/test-marketing-providers.mjs` | Focused policy, runtime and provider-adapter verification. |

For a new event, first decide what business action it represents. Add its fixed name and allowlisted properties in `policy.mjs`, update the runtime type and trigger, then test privacy boundaries and duplicates. Never forward an entire form, URL, HTML element, data layer or workspace record as event properties.

## 10. Possible later work — not included in this update

A real public enquiry service could support confirmed-lead conversions. A separately designed first-party reporting dashboard could compare campaign quality. Server-side advertising APIs would require their own consent enforcement, data-minimization design, credentials and deduplication tests. A central consent audit service would need a defined retention policy and access controls. Session recording, heatmaps, customer uploads, automatic advanced matching and other advertising platforms have not been added.

## Official references and implementation evidence

- [Meta Pixel advanced configuration and individual-pixel events](https://developers.facebook.com/documentation/meta-pixel/advanced)
- [Meta Pixel consent implementation and data categories](https://developers.facebook.com/documentation/meta-pixel/implementation/gdpr)
- [Meta-maintained browser Google Tag Manager template](https://github.com/meta/GoogleTagManager-WebTemplate-For-FacebookPixel/blob/main/template.tpl)
- [Meta `_fbp` / `_fbc` documentation and `_fbc` expiry recommendation](https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/fbp-and-fbc)
- [Meta-maintained Conversions API template: cookie-duration implementation evidence](https://github.com/facebookincubator/ConversionsAPI-Tag-for-GoogleTagManager/blob/main/template.tpl) — cited as evidence only; this server integration is not installed.
- [TikTok Pixel consent mode](https://business-api.tiktok.com/portal/docs/pixel-cookie-consent-mode/v1.3)
- [TikTok automatic advanced matching](https://ads.tiktok.com/resources/help/article/how-to-set-up-automatic-advanced-matching?lang=en)
- [TikTok custom-event rules and limitations](https://ads.tiktok.com/resources/help/article/custom-events?lang=en)
- [TikTok reserved-event names](https://ads.tiktok.com/resources/help/article/reserved-events?lang=en)
- [TikTok cookie names and published defaults](https://ads.tiktok.com/resources/help/article/using-cookies-with-tiktok-pixel)
- [TikTok event-ID implementation example](https://ads.tiktok.com/resources/help/article/tiktok-adobe-eapi-implementation-guide?lang=en)
- [TikTok IPv6 support](https://ads.tiktok.com/resources/help/article/about-ipv6-support-for-tiktok-pixel?lang=en)
- [TikTok provider-hosted loader](https://analytics.tiktok.com/i18n/pixel/events.js) and [SDK source inspected on 26 November 2026](https://analytics.tiktok.com/i18n/pixel/static/main.MTUyMzg1YjAxMA.js) — inspected as text, not executed. Current implementation evidence does not guarantee future SDK behavior.
- [Meta privacy policy](https://www.facebook.com/privacy/policy/) and [TikTok privacy policy](https://www.tiktok.com/legal/page/global/privacy-policy/en)

This guide describes the implemented controls and remaining activation checks. It is not a certification of legal compliance or a guarantee of advertising results. Keep the published privacy information aligned with the company's real legal identity, operations and enabled services.
