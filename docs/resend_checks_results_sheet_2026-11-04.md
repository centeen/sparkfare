# Resend checks results sheet (pre-launch, Part A of the Nov 6 go/no-go checklist)

Drafted 2026-11-04, docs only. **Every Result cell is blank.** This sandbox cannot reach Resend or Cloudflare, so the owner fills it in. Sections A to E match the checks drafted for `docs/launch_nov6_go_no_go_checklist_2026-11-03.md` (rows "Resend", "First digest footer"). A fail in A or D blocks the Nov 6 go/no-go; B and C mainly avoid a surprise on launch day.

On Windows use `node node_modules/wrangler/bin/wrangler.js`, not `npx wrangler`.

| Field | Value |
|---|---|
| Run by / date and time (ET) | |
| Resend plan | |

## A. Webhook (Resend, Webhooks, `https://sparkfare.com/api/webhooks/resend`)

| Event | Subscribed? (Y/N) |
|---|---|
| `email.bounced` (required) | |
| `email.complained` (required) | |
| `email.delivered` | |
| `email.opened` (needed for the 45-day sunset policy) | |
| `email.clicked` (optional) | |

Delivery log: last 10 deliveries all 200? ______ Any 401 (signing secret mismatch with `RESEND_WEBHOOK_SECRET`)? ______ Subscription edited today? ______ (if so, re-read the log after saving)

| Result | PASS / FAIL |
|---|---|

## B. Sending limits (Resend, Settings, Usage)

| Item | Value |
|---|---|
| Per-second limit (docs say 10/s) | |
| Daily cap | |
| Expected launch-weekend sends (digest plus verification and follow-ups) | |
| Headroom ok, or upgrade before Nov 6? | |

## C. Domain (Resend, Domains, sparkfare.com)

| Item | Seen |
|---|---|
| Domain status Verified | |
| DKIM, SPF, DMARC all green | |
| DMARC policy (expect `p=quarantine`) | |
| Open tracking ON, click tracking OFF | |
| `links.sparkfare.com` verified | |

## D. Postal address and blocking

| Check | Expected | Seen |
|---|---|---|
| `wrangler secret list` includes `EMAIL_POSTAL_ADDRESS` (value cannot be read back) | listed | |
| Digest footer (next real send, or a send to your own `+alias`) shows the street address with a ZIP | address visible | |
| Blocked count (query below) | 0 | |

```bash
node node_modules/wrangler/bin/wrangler.js d1 execute sparkfare-db --remote --command \
 "SELECT COUNT(*) AS blocked FROM events WHERE event_type='email_blocked_no_postal_address' AND ts > datetime('now','-2 day')"
```

A non-zero count means digests or newsletters were silently skipped; the 08:00 health check also emails a critical alert about it.

## E. Sending guard (read-only)

Thresholds (`SENDING_GUARD`, `src/email.js`): 7-day window; below 200 sends the guard never trips; from 200, a bounce rate above 5% or a complaint rate above 0.3% pauses all guarded email.

Event names are `email_bounce` and `email_complaint` (not `email_bounced` / `email_complained`). A missing row in the output means zero.

```bash
node node_modules/wrangler/bin/wrangler.js d1 execute sparkfare-db --remote --command \
 "SELECT event_type, COUNT(*) n FROM events WHERE event_type IN ('alert_email_sent','email_bounce','email_complaint') AND ts > datetime('now','-7 day') GROUP BY event_type"
```

```bash
node node_modules/wrangler/bin/wrangler.js d1 execute sparkfare-db --remote --command \
 "SELECT reason, COUNT(*) n FROM email_suppressions GROUP BY reason"
```

| Item | Seen |
|---|---|
| `alert_email_sent` (7 days) | |
| `email_bounce` (7 days) | |
| `email_complaint` (7 days) | |
| Suppressions by reason (`bounce`, `complaint`, `unsubscribe`) | |
| Guard tripped? (should be no) | |

If Resend shows bounces but there are no `email_bounce` rows, the webhook is not reaching the Worker: check A.

## Result

| Section | PASS / FAIL | Notes |
|---|---|---|
| A webhook | | |
| B limits | | |
| C domain | | |
| D postal address | | |
| E guard | | |

| Field | Value |
|---|---|
| Blocks the Nov 6 go/no-go? (A or D failing) | |
| Fixes needed, and by whom | |
| Reported back to (and when) | |
