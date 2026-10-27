# Addendum Q, Q0 report (read-only), 2026-10-27

Written by Claude Code against `main` (`3260f43`, after #409; the addendum's line numbers are from `8657dea` and were re-checked: `isMonday` and the frequency check at `src/index.js` 1598 to 1599, the `email.clicked` handler at 4029, `pruneInactiveSubscribers` at about 1474 still hold). **No code, flag, migration or copy was changed.** This session cannot reach production (no Cloudflare credentials; `sparkfare.com` and `api.cloudflare.com` are blocked), so items 2, 3, 6 and 9 are answered from the code plus a query file for the owner to run (`docs/q0_production_reads.sql`, tested on the real schema), and items 3 and 4 need the owner at the Resend and Cloudflare dashboards. Where I could answer something from GitHub (workflow run history) I did.

## Summary

1. **The "at most one email a day" promise is false every Sunday by the code.** The digest goes to every active reader at 08:00 UTC; the Sunday newsletter then goes (from a GitHub workflow that has run and succeeded on all six Sundays since Sep 20) to every active reader again, with no frequency filter. Whether the newsletter email actually reaches inboxes could not be checked (no per-recipient record exists); see item 2.
2. **There is no complete per-recipient send record.** Seven kinds of email leave no row anywhere that names the recipient: verification, sunset, plan confirmation, Plus waitlist confirmation, the support auto-reply, the Sunday newsletter and the immediate checklist email after a click. Q1's ledger will be the first complete record, so "how many recipients got two emails in a day" can only be answered as a lower bound today.
3. **Q6 cannot be built as written.** The webhook handles `email.clicked`, `email.bounced`, `email.complained` and `email.opened`, but **not `email.delivered`**, and the stored `email_click` event keeps only the Resend `email_id` and the link, **no recipient**. The 60-second "scanner" rule needs a delivered handler (and the webhook subscribed to `delivered`), a recipient on click events, and somewhere to keep delivery times. Small, but it is new scope inside Q6.
4. **Email-only subscribers cannot change their frequency at all.** `/account` redirects to sign-in without a Clerk session; `/api/preferences` returns 401 without one; `preferences.html` is linked from nowhere and posts to the same gated route. The only self-service actions without an account are unsubscribe and reactivate. Q3's labels will be honest, but only signed-in users can use them until C1.1.
5. **Q7 is bigger than "change one cron".** Seventeen job calls run in the `0 8 * * *` branch; moving to an hourly trigger changes every one from "once a day" to "once per origin per local morning" or "once a day on the first run after 08:00 UTC" (item 7).
6. **Four subject lines carry a date or relative timing today, and they are the four the addendum's Q4.2 already lists** (checklist, departing-soon, briefing, long-weekend watch). Nothing else does (item 8).
7. **Today the circuit breaker can block transactional mail** (verification, plan confirmation), because every guarded send goes through the same check; Q4.4 changes that.

## 1. Every function that calls Resend

Stream per Q8's list: T transactional, A alert, P plan and trip, D digest, C care. "Guard" = goes through `sendEmailWithGuard()` (suppression, circuit breaker, `List-Unsubscribe`). File is `src/email.js` unless stated; line is the Resend call.

| Function | Line | Stream | Trigger | Guard |
|---|---|---|---|---|
| `sendVerificationEmail` | 325 | T | `/api/signup`, new unverified address (`src/index.js` 3046) | yes |
| `sendPlusWaitlistVerifyEmail` | 1824 | T | `/api/plus-waitlist` (index 4316) | yes |
| `sendPlanConfirmEmail` | 1411 | T | plan reminder opt-in (`src/planReminders.js` 280) | yes |
| `sendSupportAutoResponder` | 1265 | T | inbound mail to hello@ (`email()` handler, index 6288) | yes |
| `sendTargetReachedEmail` | 1242 | A | `checkWatchlists`, `0 8` branch (index 1558) | yes |
| `sendPtoWindowEmail` | 1794 | A | `checkPtoWindowWatches`, `0 8` branch (`src/ptoWatch.js` 174) | yes |
| `sendAwayModeFollowUpEmail` | 619 (v2 checklist), 639 (legacy) | P | an authenticated "View fare" click, `/api/trips` (index 2810), immediate | yes |
| `sendStressValveEmail` | 690 | P | `sendStressValveAlerts`, `0 8` branch (index 1933) | yes |
| `sendDepartureBriefingEmail` | 740 | P | `sendDepartureBriefingAlerts`, `0 8` branch (index 2025) | yes |
| `sendRouteRetrospectiveEmail` | 785 | P | `sendRouteRetrospectives`, `0 8` branch (index 2142) | yes |
| `sendBookingConfirmedEmail` ("purchase reported") | 820 | P | `reconcileBookings`, `0 8` branch (index 2287) | yes |
| `sendDepartingSoonEmail` | 863 | P | `sendDepartingSoonAlerts`, `0 8` branch (index 1840) | yes |
| `sendPreDepartureSequenceEmail` (14/7/1) | 1722 | P | `sendPreDepartureSequenceAlerts`, `0 8` branch (index 5207) | yes |
| `sendPlanReminderEmail` | 1434 | P | `runPlanReminders`, `0 8` branch (`planReminders.js` 400) | yes |
| `sendYoureSetEmail` | 1486 | P | `runYoureSetEmails`, the `30 3` and `0 8` runs (`planReminders.js` 499) | yes |
| `sendDailyDealEmail` | 1102 | D | single send: the admin route `/api/send-daily-alert` only (index 3388) | yes |
| `sendDailyDealEmailBatch` | 1203 (`batch.send`), 1211 (one-by-one fallback) | D | `sendDailyAlerts`, `0 8` branch (index 1730) | no: its own suppression lookup and breaker check, `List-Unsubscribe` added per message |
| `sendSundayNewsletter` | 1658 (`batch.send`) | D | `POST /api/admin/trigger-newsletter`, called by `sunday-newsletter.yml` Sundays 14:00 UTC (index 5750) | no: own suppression filter, headers and breaker check |
| `sendSunsetEmail` | 908 | C | `pruneInactiveSubscribers`, start of `sendDailyAlerts` (index 1492) | yes |
| `sendRevenueHealthAlertEmail`, `sendDataAlertEmail`, `sendRuleWatcherSummaryEmail`, `sendWeeklyStandupEmail`, `sendLinkHealthAlertEmail` | 1298, 1329, 1361, 1511, 1538 | owner mail, outside the streams | ops crons | no, by design (to the ops address, not a subscriber) |

Total: 27 Resend calls in 24 functions, all in `src/email.js`; nothing in `src/index.js` calls Resend directly.

## 2. The last 30 days in production

**Not answerable from this session.** The queries are in `docs/q0_production_reads.sql` (blocks 2a, 2b, 2c): recipient-days with 1, 2 and 3 or more emails, which kinds sit together on multi-email days, the digests sent on each Sunday and today's newsletter audience. Two facts that change how to read the result:
- **Lower bound.** The query unions every table that keeps one row per send (digest, five lifecycle tables, plan reminders, You're set, plus the latest watchlist and long-weekend alerts). It cannot see the verification, sunset, plan and waitlist confirmation emails, the support reply, the Sunday newsletter or the checklist email sent right after a click (`away_mode_email_log` records partner emails only when a partner is shown, so it is not a complete log and is not used).
- **The Sundays, from the code and GitHub.** `sunday-newsletter.yml` ran on schedule and finished `success` on all six Sundays (Sep 20 and 27, Oct 4, 11, 18, 25), each in 10 to 14 seconds, and each starting 3 to 4.5 hours after its 14:00 UTC schedule. That proves the generator ran, not that the Worker sent anything. The newsletter's audience query has no frequency filter, so if it sent, **every active reader who got the 08:00 digest that Sunday got two emails**. Q0's Sunday query counts the digests and the audience so the overlap can be stated as a number.

## 3. The Resend webhook

- **Subscribed events:** cannot be read without a Resend key; the owner must check the dashboard (Webhooks, the `https://sparkfare.com/api/webhooks/resend` endpoint). My notes from Sep 26 record it being edited to `email.opened`, `email.bounced` and `email.complained`; nothing in the repo says `email.clicked` or `email.delivered` were ever added.
- **What the handler does today** (`src/index.js` 4029 to 4062): `email.clicked` logs an `email_click` event with only `email_id` and the link (no recipient); `email.bounced` and `email.complained` suppress the address and log; `email.opened` logs `email_open`, sets `users.last_opened_at` and, as a fallback, confirms a pending referral. **There is no branch for `email.delivered`.**
- **Have `email.clicked` events arrived at all?** Production query, block 3 of the query file.

## 4. `EMAIL_POSTAL_ADDRESS`

- **Set in production?** The owner runs `npx wrangler secret list` (it shows names, never values). The code reads it from `env.EMAIL_POSTAL_ADDRESS` (`src/email.js` 609 and 984); the digest only logs a warning when it is missing, and the footer simply has no address.
- **Templates that render it today:** the v2 digest footer (`src/emailTemplates/dailyDigest.js` 323 and 453, when `config.postalAddress` is set) and the v2 post-click checklist (`src/postClickEmail.js` 354; it is skipped entirely, falling back to the legacy email, when the address or the secret is missing).
- **Templates that do not render it at all:** every email built with `emailShell()` (verification, stress valve, briefing, retrospective, booking-confirmed, departing-soon, sunset, target reached, plan confirmation and reminders, You're set, pre-departure, long-weekend watch, Plus waitlist confirmation, support auto-reply) and the Sunday newsletter.

## 5. Who can change frequency today

- `account.html` (Email Frequency, lines 231 to 236: Daily digest, Weekly digest, Instant (Rare Finds only)) redirects to `/sign-in?redirect_to=...` without a Clerk session (line 473); `POST /api/preferences` returns 401 "Not authenticated" without one (`src/index.js` 3131). **An email-only subscriber has no way to change frequency.**
- `preferences.html` is linked from nowhere (no `href` to it in any page or script; `scripts/check-referral-copy.js` itself calls it the "ghost preferences.html"). Its form posts to `/api/preferences` (line 204, same 401) and `/api/unsubscribe` (line 238). It has its own copy of the frequency select.
- What an email-only subscriber can do: the signed unsubscribe link, the signed reactivate link (sunset email) and, by signing in, `/account`.
- `weekly` today means "also gets the digest on Monday" (`isMonday` branch) and **only on Monday**, not on Sunday; `instant` is treated exactly like `daily` (`frequency = 'instant'` in the same check).

## 6. Users by `frequency`

Not answerable from here; block 6 of the query file (counts by value, with how many are active and verified). For scale: production had 7 users as of Oct 13.

## 7. Cron triggers and the `0 8 * * *` branch

**Four cron triggers** in `wrangler.jsonc` (the account moved to Workers Paid on Oct 13 per the owner; the free-plan cap was 5 per account and the paid limit is higher, but I did not read the current limit from the dashboard; this Worker uses four): `30 3 * * *` (daily-fetch dispatch, then the You're set emails), `0 8 * * *` (everything below), `30 9 * * *` (data alert, then `metrics_daily`), `0 9 * * 2` (link health, weekly standup, rule watcher). Jobs in the `0 8 * * *` branch of `scheduled()` (`src/index.js` 6133 to 6290), in order, each failure-isolated:
1. `archiveEditions` then `archiveWeeklyEditions` (flag-gated)
2. `sendDailyAlerts` (sunset pruning and goodbye emails first, then the digest, skip-unchanged, early/general logic)
3. `reconcileBookings` (sends "purchase reported")
4. `checkRevenueHealth` (owner mail)
5. `runPlanReminders`
6. `purgeHomeCards`, `runYoureSetEmails`
7. `sendDepartingSoonAlerts`, `sendPreDepartureSequenceAlerts`
8. `checkWatchlists`
9. `checkPtoWindowWatches`
10. `sendStressValveAlerts`
11. `sendDepartureBriefingAlerts`
12. `sendRouteRetrospectives`
13. `sendDailyXPost`
14. `checkAndLogRoutePromotions`

## 8. Subjects and preheaders that carry a departure or window date, or relative timing of the reader's own departure

| Email | Function | Subject today | Carries |
|---|---|---|---|
| Checklist after a click | `followUpSubject` (565) | "{Destination}, {Mon D}: your pre-flight checklist" | the departure date (in the addendum's list) |
| Departing soon | `sendDepartingSoonEmail` (866) | "Departing {today / tomorrow / in N days} — {Destination}" | relative timing (in the list) |
| Briefing | `sendDepartureBriefingEmail` (743) | "One week out — {Destination}" | relative timing (in the list) |
| Long-weekend watch | `sendPtoWindowEmail` (1767) | "Fare for your {Mon D–D} long weekend from {City}: ${price}" | the watched window's dates (in the list) |
| Plan reminders | `planReminderSubject` | "Due: {item title}" | none |
| You're set | `youreSetSubject` | "Your plan for {Destination}: what's done and what's open" | none |
| Pre-departure | `sendPreDepartureSequenceEmail` (1725) | "Prep for {Destination}: {Partner}" | none (kept in the plan) |
| Stress valve, retrospective, purchase reported, target reached, sunset | various | no dates | none |
| Digest and weekly edition | `buildSubject`, `buildWeeklySubject` | route, price, city; no dates (the weekly's body says "Week ending") | none |

**Preheaders:** the digest's preheader is the lead fare and its basis (no dates); the checklist's (`postClickEmail.js` 299) is "Fares can change. Pick up where you left off, then sort ..." (no dates); the other emails set no preheader. **Nothing beyond the addendum's list:** the four rows marked "in the list" are exactly Q4.2's four rewrites; no other subject or preheader carries a date or the reader's own timing.

## 9. Link-scanner clicks in `email_click` events

Not answerable from here (production). Block 9 of the query file counts emails with clicks, those with three or more distinct links clicked and those with three or more clicks within ten seconds. Delivery-to-click time cannot be computed because delivery events are not stored (see item 3).

## What this means for the plan

- **Q1** also has to be the first complete send log (see the summary); its ledger should include the senders that leave no trace today, or Q0's "recipient-days" stays a lower bound.
- **Q2** is confirmed necessary: the Sunday double send is by design of the current code.
- **Q4.1** (fail closed without the address) changes live behaviour for about fifteen `emailShell()` templates and the newsletter, none of which render the address today; the shared footer helper has to reach `emailShell()`, which is used by most lifecycle mail, not only the digest and the checklist.
- **Q6** needs the webhook subscribed to `delivered` and `clicked`, a `delivered` handler, a recipient on click events, and a small table of delivery times. I would add these as Q6's first commit.
- **Q7** cost: see item 7; N8's data alert (`30 9 * * *`) must also learn per-origin completion.
- **Q3:** `preferences.html` is dead code with its own copy of the frequency select; delete it or make it the C1.1 page, rather than editing it twice.

## What I need from the owner

1. **Run `docs/q0_production_reads.sql`** (`npx wrangler d1 execute sparkfare-db --remote --file=docs/q0_production_reads.sql`) and paste the results; they answer items 2, 3 (the click-event half), 6 and 9.
2. **Check in the Resend dashboard** which events the webhook subscribes to (item 3), and in Cloudflare whether `EMAIL_POSTAL_ADDRESS` is set (`npx wrangler secret list`, names only; item 4).
3. **Decide** whether Q6 should include the delivered-event work, or whether to cut the 60-second scanner rule and keep Q6 to the 90-day click and 45-day open rule.
4. Say which package starts next. The addendum's order is Q3, then Q4, Q2, Q1, Q6, Q5 (dark), Q7, Q8; C0 is due Wed Nov 4 and nothing slips into Nov 5.

**Stopped here, as the addendum asks.**
