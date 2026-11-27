# NorthWallEg — employee password recovery and Google Reviews

## What's new

The existing NorthWallEg employee login now has **Forgot password?**. This is for an existing, enabled owner/admin/employee account; it does not create a membership and does not re-enable deactivated staff. The user enters the email address, receives a generic confirmation (whether or not an account exists), and—if eligible—receives an email containing a link to `/reset-password` at the configured HTTPS origin.

- The reset token uses 32 cryptographically random bytes, with only its SHA-256 digest stored in the new `nw_auth_resets` MariaDB/InnoDB table.
- The link expires in **15 minutes**, is one-use, and a new request invalidates older links for that account.
- The new password must be at least **15 characters** and differ from the current password.
- Successful reset revokes all previous sessions and pending sign-in flows and increments the account's password version. **No login session is issued by the reset endpoint.** Email-code verification during next login still applies.
- Recovery is rate-limited per account, shared-client network bucket, and globally, with generic responses and a minimum response time. Email-provider failures do not disclose account existence. This is not a claim of perfectly uniform timing under all network conditions.
- Reset URLs are formed from `APP_ORIGIN`, not request headers. The reset page has no third-party scripts; its security policy uses `Referrer-Policy: no-referrer` and private `Cache-Control: no-store`. The client clears the token from browser address bar on first view.

The code does not send reset tokens to public logs, analytics events, or GitHub. The SMTP transport is the **existing** configured email provider, not a new service.

## One required database migration after uploading the new ZIP

The new code introduces one additional authentication table. **Do not reset or replace the existing database or owner account.** Hostinger already has the production MariaDB database `u905226083_northwall`.

1. Back up the existing MariaDB database, including the workspace, audit events, employee profiles and authentication tables.
2. Deploy this complete Next.js ZIP through the current Hostinger **Deployments → Redeploy → Upload new files** flow. Keep all existing private environment variables, `APP_ORIGIN`, `PUBLIC_LAUNCH`, database credentials, auth secret, SMTP and DNS as they are.
3. Connect to Hostinger SSH. Activate Node 24 and enter the active app folder:

```bash
export PATH="/opt/alt/alt-nodejs24/root/usr/bin:$PATH"
cd "$HOME/domains/northwallegy.com/hbuilds/current/nodejs"
ENVFILE="$HOME/domains/northwallegy.com/hbuilds/config/.env"
```

4. Initialize **schema only** (idempotent `CREATE TABLE IF NOT EXISTS`; does not change the existing owner password):

```bash
node --env-file="$ENVFILE" hostinger/setup.mjs --schema-only
```

5. Verify privately:

```bash
node --env-file="$ENVFILE" hostinger/check.mjs --smtp
```

Then test a controlled reset for an existing authorized test employee or the owner. Confirm emailed link delivery, expiration, replay denial, previous-session revocation, and the normal login email code. If a setup or SMTP preflight fails, inspect private connection settings without printing secrets. The new service may return unavailable until schema initialization is complete; do not disable the security gate to make it start.

**Never run** `node hostinger/setup.mjs` without `--schema-only` as a routine redeployment step. The no-flag command is for **initial owner provisioning** and will refuse an already existing owner. `--recover-owner` is a separate explicitly authorized offline recovery process; it is not needed for this change.

## Google Reviews icon

The new icon is integrated with the original homepage near the floating WhatsApp contact button and repeated in the public footer. It uses no embedded Google widget, third-party scripts, cookies or invented rating data.

**Google Reviews is hidden until the owner provides the real Google Business Profile review URL.** This deliberate guard prevents a dead link or a review request for the wrong business. To configure:

1. Open your verified Business Profile on desktop and select **Read reviews → Get more reviews → Copy** (Google's official workflow).
2. Edit `lib/company-profile.json` → `contact.googleReviews`:

```json
"googleReviews": {
  "enabled": true,
  "url": "<paste your official Google Business Profile review link here>",
  "label": {
    "en": "Review us on Google",
    "ar": "قيّمنا على Google"
  }
}
```

3. Rebuild and redeploy the ZIP. The URL validator accepts approved Google-owned review-link formats, not arbitrary third-party redirectors. Contact the developer if your official link has an unsupported format; never bypass the validation by allowing any host.

Google reviews must reflect genuine customer experiences. **Do not offer incentives, create fabricated reviews, or claim a star rating the business has not earned.**

## Source and security references

[1] OWASP, *Forgot Password Cheat Sheet*, https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html

[2] Google Business Profile Help, *Create a Google link or QR code to request reviews*, https://support.google.com/business/answer/16816815

## Preserved features

Existing marketing consent controls, Meta/TikTok integration (only after opt-in and configuration), English/Arabic content, all three original colour designs, sticky navigation, floating WhatsApp button, tickets, chat, calendar, profiles, admin permissions, MySQL and SMTP are preserved. No production data or secrets are included in this ZIP. The external marketing pixels never execute on employee sign-in, password reset or workspace pages.
