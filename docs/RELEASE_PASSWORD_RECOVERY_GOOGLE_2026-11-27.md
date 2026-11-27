# NorthWallEg — release notes (27 November 2026)

This release starts from `NorthWallEg-Hostinger-Marketing-Consent.zip` (26 November), not the older GitHub/Sites demo. **All previous website pages, Arabic/English content, three visual designs, floating WhatsApp button, consent management, and employee workspace are retained.** The only feature additions are email password recovery and a configurable Google Reviews link/icon.

## Changes

- Existing employee sign-in: 'Forgot password?' requesting a single-use email link to `/reset-password`.
- Password reset consumes a SHA-256-hashed 32-byte token stored in new `nw_auth_resets` (InnoDB); 15-minute expiry; bounded rate limits; same generic result for existing/nonexisting accounts; protects email-code sign-in and employee approval after reset; revokes existing sessions.
- Google Reviews icon near WhatsApp and link in footer, **disabled until** the actual approved Google Business Profile review URL is supplied. No fabricated ratings.
- Source documentation and repeatable GitHub Actions checks.

## Deployment notes

1. Back up the MariaDB data before updating.
2. Upload this full ZIP via Hostinger's Next.js web-app deployment; build `npm run build`, output `.next`, start `npm start`.
3. **Required one-time migration** on the new deployed application: `node --env-file="$ENVFILE" hostinger/setup.mjs --schema-only` (without updating owner password). Then `node --env-file="$ENVFILE" hostinger/check.mjs --smtp`.
4. Verify link delivery, expiry, one-time use, and next-login email verification.
5. Put the verified Google Business Profile URL in `lib/company-profile.json` → `contact.googleReviews` and rebuild to activate the icon. Until then the icon is not shown (no dead link).

Read `docs/PASSWORD_RECOVERY_AND_GOOGLE_REVIEWS.md` for full details. **No public deployment has been performed automatically by making this ZIP.**
