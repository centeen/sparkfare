import os

file_path = r'C:\Users\cente\.gemini\antigravity-ide\brain\8f656439-dd2d-4029-9505-b95b2f526181\walkthrough.md'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# I notice there's already a "Task T7: Email deliverability and consent" section!
# I will just replace it with the updated one or append a "Phase 2" to it.
# Let's replace the existing T7 section entirely to be cleaner.
target_t7 = """## Task T7: Email deliverability and consent

### Changes Made
- **Database Layer (`0003_email_consent.sql`)**: 
  - Created `consent_log` to track double opt-in history, including source and `ip_hash`.
  - Created `email_suppressions` to track hard bounces and complaints.
- **Backend APIs (`src/index.js`)**: 
  - Expanded `POST /api/webhooks/resend` to handle `email.bounced` and `email.complained` events. These update the `email_suppressions` table and log to `events`.
  - Updated `GET/POST /api/unsubscribe` to support RFC 8058 `List-Unsubscribe-Post` One-Click unsubscribes.
  - Added `POST /api/preferences` to save user preferences directly to the database.
- **Core Email Logic (`src/email.js`)**: 
  - Implemented `sendEmailWithGuard()` wrapper for Resend calls.
  - Added `List-Unsubscribe` and `List-Unsubscribe-Post` headers to all outbound emails.
  - The wrapper automatically skips sending to any addresses in the `email_suppressions` list.
  - **Sending Guard**: The wrapper verifies the trailing 7-day bounce and complaint rates against total sent emails. If bounce rate > 5% or complaint rate > 0.1%, it auto-pauses outgoing emails to protect the sender's reputation.
- **Frontend (`preferences.html`)**: 
  - Verified and finalized the existing preference center UI to allow users to update their home airport (`origin_iata`), `trip_length`, and perform a one-click unsubscribe.
- **DNS Audit & Checklist**:
  - Validated that `resend._domainkey.sparkfare.com` exists (DKIM).
  - Validated that SPF and DMARC exist on the root domain, but identified missing Resend bounce/return-path configurations.

### What was tested
- Verified that syntax and unit tests still pass successfully.
- Webhook events process correctly and safely grant Early Bird status or record suppressions.
- Verified one-click unsubscribe backward and forward compatibility.

### Verification Results
- All tests pass locally.

> [!IMPORTANT]  
> **Action Required: DNS Updates for Resend**
> Please perform the following steps in your Cloudflare DNS dashboard to complete deliverability setup:
> 1. **SPF**: Add `include:sendgrid.net` or `include:resend.com` (refer to Resend's exact SPF string) to your existing SPF record `v=spf1 include:_spf.mx.cloudflare.net ~all`.
> 2. **Bounces**: Create a CNAME record for `bounces.sparkfare.com` pointing to Resend's return path.
> 3. **DMARC**: Your current DMARC is `v=DMARC1; p=none;`. This is great for now. Check your reports in a month and upgrade to `p=quarantine`.
"""

new_t7 = """## Task T7: Email deliverability and consent (Completed)

### Changes Made
- **Database Layer**: 
  - Validated `0003_email_consent.sql` containing `consent_log` and `email_suppressions`.
  - Created and applied `0005_users_preferences.sql` adding `frequency`, `paused_until`, and `verification_token` columns to the `users` table.
- **Backend APIs (`src/index.js`)**: 
  - **Double Opt-In Flow**: Rewrote `POST /api/signup` so that unauthenticated signups generate a secure `verification_token`, log their IP hash + wording version to `consent_log`, set `verified_email = 0`, and automatically dispatch a verification email. Only authentic Clerk sessions bypass this.
  - **Verification Endpoint**: Modified `GET /api/verify` to securely validate the `verification_token` from the URL, upgrade the user to `verified_email = 1`, and securely erase the token.
  - **Preferences**: Updated `POST /api/preferences` and `GET /api/account` to persist and load `frequency` (Daily digest, Weekly digest, Instant) and `paused_until` values.
  - **Send Gates**: Updated `sendDailyAlerts()`, `sendStressValveAlerts()`, and all other backend CRON triggers to respect the new `paused_until` date natively at the SQL query layer. The daily digest now also respects the new `frequency` flag.
  - **Resend Webhooks**: Maintained existing bounce/complaint handler in `POST /api/webhooks/resend`.
  - **Unsubscribe**: Maintained existing `List-Unsubscribe` one-click support.
- **Core Email Logic (`src/email.js`)**: 
  - Maintained `sendEmailWithGuard()` which checks 7-day trailing bounce/complaint rates and suppresses bad actors.
- **Frontend UI (`preferences.html` & `account.html`)**: 
  - Added new "Email Frequency" drop-down.
  - Added new "Pause Alerts" drop-down with native date calculations (1 week, 1 month, Indefinite, None).
- **Documentation**:
  - Exported [checklist_T7_DNS.md](file:///c:/Users/cente/sparkfare/checklist_T7_DNS.md) with exact configurations to give to your DNS host.

### What was tested
- Manually audited the `POST /api/signup` patch execution.
- Validated new query structures using `COALESCE` in `/api/preferences`.
- Confirmed `sendDailyAlerts` successfully parses UTC Monday offsets for weekly frequency triggers.

### Verification Results
- All T7 requirements are now fully complete.

> [!CAUTION]  
> **Action Required: DNS Updates for Resend**
> Please see the [checklist_T7_DNS.md](file:///c:/Users/cente/sparkfare/checklist_T7_DNS.md) artifact and execute the DNS updates via your DNS host's dashboard (e.g. Cloudflare) to ensure all emails are DKIM/SPF aligned and bounces route correctly.
"""

if target_t7 in content:
    content = content.replace(target_t7, new_t7)
else:
    content = content + "\n\n" + new_t7
    
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
