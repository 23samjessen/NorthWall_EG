# WhatsApp button only — 26 November 2026

This package starts from `NorthWallEg-Hostinger-Sticky-Nav-Ready.zip` and adds one floating WhatsApp contact icon to the existing public website. It keeps the original three designs, images, text, service options, sticky navigation, employee workspace and authentication.

## What visitors see

A green WhatsApp icon stays at the bottom-right of the screen while visitors scroll. It appears on the English/Arabic company pages, service pages and Security Insights pages. It opens the company's WhatsApp chat in a new tab or the visitor's WhatsApp app. It does not send a message automatically.

The button is not included in sign-in or employee workspace pages. Existing modal dialogs remain above the button. There is no external widget, advertising tracker or new dependency.

## Phone number

The button uses the existing enabled primary company phone in `lib/company-profile.json`, under `contact.phones`. The supplied package contains **+45 53 88 23 02**, producing `https://wa.me/4553882302`.

The number must have an active WhatsApp account. Preparing this link does not verify WhatsApp registration or message delivery. Keep the number in international format, beginning with `+` and its country code. If the primary phone is missing or is not in international format, the button is hidden instead of creating a broken link.

To change the destination later, edit the existing primary phone's `number` and rebuild/redeploy. That field also controls the public company phone displayed elsewhere on the website.

## Files

- `components/whatsapp-button.tsx`: link, inline icon and English/Arabic accessible labels.
- `components/whatsapp-button.module.css`: fixed position, safe-area spacing, colour and keyboard focus.
- `components/marketing.tsx`: imports and renders the button once.
- `components/insights-shell.tsx`: imports and renders the button once.

No existing style rules or images were changed. No Danish design was added.

## Upload to the existing Hostinger application

Use hPanel → Websites → northwallegy.com → Deployments → Redeploy → Upload new files, and choose the new complete ZIP. Retain the existing Next.js settings: project root `./`, build `npm run build`, output `.next`, and the working Node version.

Keep the existing environment variables and database. This change does not require database initialization, migrations, new passwords or account provisioning. Do not run the owner setup script for this update.

After deployment, open the homepage on a phone and desktop, scroll down, and click the icon to check the destination in WhatsApp. Send a test message manually only if desired.

## Package provenance

- Baseline ZIP SHA-256: `2f1f0e5a9d752cb480df31b744a53262e08acc1b308cb0ec5118b79c447f018b`.
- `hostinger-upload.json` retains the original baseline source commit and marks `source_dirty: true` because the source includes local updates on top of that commit. The later marketing-consent release is documented in `docs/MARKETING_AND_COOKIES.md` and `docs/RELEASE_MARKETING_CONSENT_2026-11-26.md`.
- This prepared ZIP does not itself update GitHub or deploy the live website.

WhatsApp's documented click-to-chat format: https://faq.whatsapp.com/5913398998672934
