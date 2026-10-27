# Addendum Q: Communications core C0 (and C1 dark builds)

**For:** Claude Code (or Antigravity IDE; same rules). **From:** the Sparkfare Design Council Hub, Oct 27, 2026.
**Authority:** D-049 (Communications Framework v1, "One honest envelope"), owner, Oct 27 14:29 Israel, with sub-decisions D-049a to D-049d. Staged decision: `claude/decision_staged_D-049_comms_framework_2026-10-27.md`. Report: https://claude.ai/artifact/BgioYGgsJtz976iQHxu9S9. Backlog: G110 to G117.
**Read at:** repo `main` 8657dea (Oct 27 14:00). Line numbers below are from that commit; re-check before editing.
**Deadlines:** C0 merged by **Wed Nov 4** (last feature merge). **Cut rule:** Q1, Q2, Q3 and Q4 are never cut (they make a public promise and a legal duty true). If time runs short, Q7 and Q8 move to Nov 9 to 12, then Q6, then Q5's flag flip (Q5 code still merges dark). Nothing slips into Nov 5 (fix-only) or the freeze (Nov 6 18:00 ET to Nov 8).
**Lane:** merge train (D-035): approval pack, approval bound to head commit, deploy and smoke check after each merge, revert on failure. Not green-lane: every package changes sends, copy or data logic.
**Order:** Q0 report → Q3 → Q4 → Q2 → Q1 → Q6 → Q5 (dark) → Q7 → Q8. One PR per package. C1 dark builds only after C0 and after Addenda P, O and N's Nov 4 items; they are the first thing cut.
**Coordinate with:** M2 Guard condition 1 (remove the referral block from the verification email: do it in Q5's verification change); N4 (chunked digest batch), N8 (data alert after the digest), N11 (`metrics_daily`), D-042 retention; migration numbering (0032 is claimed by both N5 and N7: take the next free number after checking `migrations/`, and report it).
**No real emails to real subscribers in testing.** Use the owner's test aliases or mocked Resend.

---

## Q0 · Read-only report (then stop for the owner)

1. Every function that calls Resend (`resend.emails.send`, `resend.batch.send`, `sendEmailWithGuard`): name, file, line, stream (use the stream list in Q8), trigger, and whether it goes through `sendEmailWithGuard()`.
2. For the last 30 days in production (`events`, delivery tables): per recipient per UTC day, the count of emails and every day with 2 or more; how many Sundays had a digest and a newsletter to the same address.
3. Resend webhook: which event types the registered webhook subscribes to (read via API if a read-only key allows; otherwise say the owner must check the dashboard). Whether `email.clicked` events have arrived in `events` at all.
4. Whether `EMAIL_POSTAL_ADDRESS` is set in production (`wrangler secret list`; never print the value), and which templates render it today.
5. Who can reach `/account` frequency settings today: does an email-only subscriber (no Clerk session) have any way to change frequency? Is `preferences.html` linked from anywhere, and what does its form post to?
6. How many users have `frequency` = `instant`, `weekly`, `daily`, NULL.
7. Current cron triggers (count and plan limit on Workers Paid) and which jobs run in the `0 8 * * *` branch of `scheduled()` (`src/index.js` ~6134 to 6290), in order.
8. Every subject line and preheader that contains a traveller's departure or window date, or relative timing of their own departure (`followUpSubject` ~568, `sendPtoWindowEmail` ~1770, `sendDepartingSoonEmail` ~869, `sendDepartureBriefingEmail` ~746, others).
9. Signs of link-scanner clicks in `email_click` events (clicks within seconds of delivery, every link in an email clicked at once). Report counts only.

---

## Q1 · G110 · One-envelope send budget (never cut)

**Rule set (Framework rule 1).**
- **Streams and priority:** 1 transactional (verify, welcome, unsubscribe confirmations, waitlist confirm); 2 alerts the reader set (watch hit, long-weekend watch); 3 plan and trip (plan reminders, "You're set", checklist, stress-valve, prep 14/7/1, briefing, departing-soon, retrospective, purchase reported); 4 digest (daily or weekly edition); 5 care (sunset notice; C1 care email).
- **Fare emails:** at most **one email carrying fares** per recipient per local day (streams 2 and 4). When a watch hit or long-weekend watch is due on a day the reader also gets a digest, it is **rendered as the top block of that digest** ("Your watched route reached your price", with the fare's basis and as-of), not sent separately. If no digest goes that day (weekly reader, skip-unchanged, digest off), the alert goes alone.
- **Lifecycle:** at most **one** stream-3 email per recipient per local day. When several are due, send the highest: plan reminder > departing-soon > prep 1-day > briefing > prep 7-day > prep 14-day > stress-valve > retrospective > purchase reported. A deferred email retries the next day and is dropped once it is no longer timely (departure passed, or a later email in the same trip has gone).
- **Ceiling:** stream 1 always sends. Everything else: at most **2 emails per recipient per local day** in total.
- **Local day:** the recipient's origin zone (`ORIGIN_TIME_ZONES`, `src/originZones.js`); UTC if unknown.

**Build.**
- A per-recipient daily ledger (new table, e.g. `email_send_ledger`: email, local_date, stream, kind, status, created_at; primary key on email + local_date + kind). One helper used by every non-transactional sender: `claimSendSlot(env, { email, stream, kind, localDate })` returns allow or defer with the reason. Batch paths (digest) claim in bulk per chunk; do not reintroduce per-recipient query fan-out (N4).
- Reorder the daily run so watch and long-weekend checks compute their hits **before** the digest renders, and pass each recipient's hit into `renderDailyDigest` as an optional `alert` block (`src/emailTemplates/dailyDigest.js`): same card anatomy as the hero, its own heading, its fare link and "Watch" state, placed above the intro. Archive editions never contain it (they are rendered without a user).
- Log every allow and defer as an event with `meta.stream`, `meta.kind`, `meta.reason`.
- Retention: ledger rows follow D-042 (delivery logs 90 days after last send).

**Must not change:** the digest's content rules, skip-unchanged, the deal floor, suppression, the circuit breaker's existence, signed unsubscribe.
**Tests:** digest + watch hit same day = one email with the alert block; weekly reader + watch hit = alert alone; two lifecycle emails due = one sent, one deferred one day; deferred email past departure = dropped; transactional never blocked; a third non-transactional email on one day = deferred; local-date boundary for LAX vs JFK.
**Acceptance:** the Q0 item 2 query, re-run on staging fixtures, shows no recipient above the ceiling; copy checker passes.

---

## Q2 · G113 · One weekly product; retire the Sunday newsletter (never cut; D-049b)

- **Stop the Sunday newsletter:** remove the `schedule` from `.github/workflows/sunday-newsletter.yml` (keep `workflow_dispatch` only, with a comment pointing to D-049b) and put `/api/admin/trigger-newsletter` (`src/index.js` ~5733) behind a new flag `ENABLE_SUNDAY_NEWSLETTER` = `"false"`. Leave the code in place for one release.
- **Email the weekly edition:** on Sundays, readers with `frequency = 'weekly'` get the weekly edition already built by `archiveWeeklyEditions()` (`src/digestArchive.js`) and rendered by `renderDailyDigest({ weekly })`, personalised at send time (unsubscribe, preferences, footer; no referral link in the archive copy). Remove the Monday branch for weekly readers (`isMonday` in `sendDailyAlerts`, `src/index.js` ~1598 to 1599). Daily readers get no Sunday extra.
- If a week has no stored weekly edition for an origin (fewer than 3 dailies), send nothing that Sunday for that origin and log it.
- Weekly edition links go to route pages, never Aviasales deep links (existing archive rule). Fare-tip and partner blocks follow Q1 and the C1 one-partner rule.
- **Hub Guard read before merge:** send the rendered weekly email (HTML and text) for JFK and LAX in the approval pack.
**Tests:** a weekly reader gets exactly one email on Sunday and none on Monday; a daily reader gets one email on Sunday; the newsletter endpoint returns 404 with the flag off.

---

## Q3 · Honest frequency choices (never cut)

- `account.html` (~231) and `preferences.html`: two options only, labelled **"Daily digest, at most one email a day"** and **"Weekly edition, Sundays"**. Remove "Instant (Rare Finds only)".
- Data: migrate `frequency = 'instant'` and NULL to `'daily'`; the preferences API accepts only `daily` and `weekly` and rejects anything else with 400.
- `sendDailyAlerts` frequency check (~1599): `daily` only (weekly handled by Q2).
- If Q0 item 5 shows `preferences.html` is unlinked or posts to a dead route, report it; do not redesign it here (the signed preference page is C1.1).
**Tests:** stored `instant` users receive the daily digest; API rejects `instant`; both pages render two options; copy checker passes.

---

## Q4 · Compliance (never cut)

Non-attorney guidance from the Guard; the owner may ask counsel at any time.
1. **Postal address in every non-transactional email.** One shared footer helper used by `emailShell()` (`src/email.js` ~78), the v2 digest footer and `postClickEmail.js`. If `EMAIL_POSTAL_ADDRESS` is unset, non-transactional sends **fail closed**: skip the send, log `email_blocked_no_postal_address`, and send the owner one data alert per day (N8 path). Transactional mail (stream 1) still sends.
2. **No traveller dates or relative departure timing in subject lines or preheaders.** Proposed subjects (Hub Guard read in the pack):
   - checklist: "{Destination}: your pre-flight checklist"
   - departing-soon: "{Destination}: a last pass before you go" → rejected (implies imminent absence on a lock screen); use **"Your {Destination} checklist"**
   - briefing: **"{Destination}: three cues to set now"**
   - long-weekend watch: **"A long-weekend fare from {City}: ${price}"**
   - prep emails: keep "Prep for {Destination}: {Partner}"
   Dates stay in the email body.
3. **Disclosure at the top** of every email that has a fare or partner link (lifecycle already does; check the watch hit and the weekly email) and beside each partner block.
4. **Circuit breaker floor:** bounce and complaint rates trip the breaker only when at least 200 guarded sends are in the 7-day window. Below that, a complaint suppresses that address and sends the owner a data alert, but does not block other mail. Transactional mail is never blocked by the breaker.
5. **Owner check (not code):** the owner confirms in the Resend dashboard that the webhook subscribes to `email.bounced`, `email.complained`, `email.clicked` and `email.delivered`. Do not change webhook settings yourself.
**Tests:** a CI test renders every template and fails if the postal address line is missing; a test that no subject or preheader contains a month name, a date pattern, "today", "tomorrow" or "in N days" with the trip's values; breaker floor tests at 199 and 200 sends.

---

## Q5 · G111 · Welcome email W1 and the verification email (code merges dark; copy gated)

- **Verification email** (`sendVerificationEmail`, `src/email.js` ~317): subject **"Confirm your email to start your fare alerts"**; body: "One tap confirms your email and starts your fare alerts from {City}." Button-style link **"Confirm my email"**. Remove the referral block (M2 condition 1). Stream 1.
- **W1**, sent once per address right after a successful confirmation (`/api/verify` path), stream 1, behind **`ENABLE_WELCOME_EMAIL` = `"false"`**. Record `welcome_sent_at`; never send twice.
- Build on the v2 digest anatomy (600 px, Brand v1 tokens, light and dark, plain-text part, `lang="en"`, 16 px body, 44 px button). Copy lives in a content file (e.g. `content/emails/welcome.json`) so the Hub can review text without reading code.
- **Draft copy, PROPOSED (not live):** the council reacts to this mock and the Hub runs a Guard read before the flag flips. Do not flip the flag in this addendum.
  - Subject: **"You're in: fares from {City}, each morning"**
  - Preheader: **"Today's lowest fare from {City}, and how to change the pace."**
  - Line 1: **"You'll get fares from {City} ({IATA}) at about 6:30 a.m. your time, at most one email a day."** (If Q7 has not shipped, the line reads "at most one email a day" with no time.)
  - Card: today's lowest showable fare from the reader's origin (`fareStillShowable`), with the same basis line as the digest ("{pct}% below its 30-day median (N={n})" only when it meets the deal floor), "Fare data retrieved {as-of}". If no showable fare: "Your first digest arrives tomorrow morning." and no card.
  - Primary link: **"See this route"** → the route page (`/flight/{origin}/{dest}`), not an Aviasales link, so the welcome carries no affiliate link.
  - Secondary: **"Watch a route you care about"** → `/watchlists?origin={IATA}`.
  - Pace line: **"Prefer one email a week? Change how often"** → `/account` (the signed preference page replaces it in C1.1).
  - Footer: the standard footer (why you get this, unsubscribe, postal address, `EMAIL_FOOTER_LINE`). No partner block, no referral block, no savings claim, no urgency.
**Tests:** welcome sends once; never with the flag off; no affiliate link in the HTML; copy checker passes; text part present.

---

## Q6 · G115 · Clicks, not opens

- Add `last_clicked_at` to `users`. The Resend webhook's `email.clicked` handler (`src/index.js` ~4030) sets it for the recipient (`event.data.to`). Ignore a click if it arrives within 60 seconds of the `email.delivered` event for the same `email_id` (likely a link scanner); count those separately (`meta.scanner_suspect`).
- **Pause rule** (`pruneInactiveSubscribers`, ~1474): pause only when there is **no click in 90 days and no open in 45 days**, and the account is older than 90 days. An open can delay a pause; it can never cause one. Update the sunset email copy: "We haven't seen a click from you in 90 days, so we've paused your alerts..." (Hub Guard read in the pack).
- Referral confirmation on `email.opened` (~4060): remove; verification is the only confirmation path.
**Tests:** an opener with no clicks for 100 days is not paused if opened within 45 days; a non-opener with a click 30 days ago is not paused; a scanner-speed click does not update `last_clicked_at`.

---

## Q7 · G117 · Local-morning send (D-049c; may move to Nov 9 to 12)

- Replace the `0 8 * * *` digest trigger with an hourly trigger (`30 * * * *`, keep `wrangler.jsonc` and the cron constants in `src/index.js` in sync, and update the cron comment block).
- Each hourly run sends, per origin whose **local time is 06:00 to 06:59** (`ORIGIN_TIME_ZONES`; TLV included), that origin's watch checks, digests and lifecycle emails, under Q1. Delivery idempotency keys move to the **local date**. DST is handled by the zone table, not by code changes on Nov 1.
- Once-a-day jobs (archive write, `reconcileBookings`, `checkRevenueHealth`, route promotions, X post if enabled) run on the first hourly run at or after 08:00 UTC each day, guarded by a daily idempotency row.
- **Quiet hours:** no scheduled send between 21:00 and 06:00 recipient-local. Transactional mail is exempt.
- N8 (09:30 UTC data alert) must still see a completed run: report how it changes and adjust its check to per-origin completion.
**Tests:** JFK sends at 11:30 UTC and LAX at 14:30 UTC after Nov 1; one digest per reader per local date across the DST change; quiet-hours test; once-a-day jobs run once.
**Acceptance (post-merge):** the owner's test aliases on JFK and LAX receive the digest at about 06:30 local on the first morning.

---

## Q8 · Stream tags and the owner view (may move to Nov 9 to 12)

- Every send carries a Resend tag `stream` (`transactional`, `alert`, `trip`, `digest`, `care`) and `kind` (function name), and the same values in `events.meta`.
- Add KPI definitions to the N11 layer (`src/metrics/definitions.js`), one definition each, per stream per day: delivered, unique clickers per 100 delivered, unsubscribes per send, complaints, hard bounces, partner clicks (from `/go/` with `src` per stream). Counts only below 1,000 delivered; rates above.
- **Guardrails (Framework):** a stream pauses itself and emails the owner when, over 7 days with at least 1,000 delivered, complaints exceed 0.1%; or a single send's unsubscribes exceed 0.5%; or hard bounces exceed 2%. Below 1,000 delivered: report only.
- Show the per-stream table on the existing owner view and in the Monday standup email.

---

## C1 dark builds (flags off; only after C0 and the other Nov 4 items; first to be cut)

| Package | Flag (default `"false"`) | What to build | Flip |
|---|---|---|---|
| C1.1 (G114) | `ENABLE_SIGNUP_FREQUENCY`, `ENABLE_SIGNED_PREFS` | Daily or weekly choice on every signup form (daily preselected is allowed only if the label reads "Daily digest (you can switch anytime)"; no pre-checked marketing boxes); a signed, no-account preference page (pause, weekly, daily, stop) linked from every footer | From Nov 9, owner approval |
| C1.2 and C1.3 (G112) | `ENABLE_TRIP_STREAM_V2` (needs `ENABLE_TRIP_SELF_REPORT`) | A fare click sends only the checklist email, which asks **"Got your ticket?"** (Yes / Still deciding / Not going; labels pass the copy checker). Only Yes starts the trip stream: 21, 7 and 1 days before departure (30, 14 and 7 for `2+ weeks` and `30_plus`), then a return-day note. Replaces stress-valve, briefing, departing-soon and the 14/7/1 prep set when on. On digest days, the trip block renders at the top of the digest instead of a separate email | From Nov 9, owner approval |
| C1.4 (G116) | `ENABLE_LIFECYCLE_V2` | Every lifecycle email on the v2 anatomy: preheader, one button, at most one partner chosen by trip length, party size and days to departure (extend `prioritizePartners`), disclosure beside it | From Nov 9 |
| C1.5 | `ENABLE_CARE_EMAIL` | One email at 60 days without a click: daily, weekly or pause (signed links). Stream 5 | From Nov 9 |

Copy for every C1 package comes to the Hub as a content file for a Guard read before its flip.

---

## Rules every package keeps
- Referral-copy checker (`npm run check:copy`) passes; Brand v1 banned list: no countdowns, scarcity, "prices rising", "book now", streaks, social proof.
- Insurance stays education-only, no link (Step 19). Fare tips unchanged.
- Travel dates never in URLs, subjects, preheaders, partner sub-IDs or logs readable by others.
- No cookies, fingerprinting or third-party analytics (Data Framework v1). No new vendor.
- Passive operations: nothing in Q needs recurring owner work; every alert is automatic.

## What to send back
Q0 report first, then stop. For each package: PR link, head commit, test output, rendered HTML and text of every changed email (JFK and LAX, light and dark), screenshots of `/account` at 375 and 1366 px, and the migration number used, in the next approval pack. Record progress in `docs/handoff/BUILD_STATE.md` and add this addendum to `docs/handoff/` for the Antigravity handover.
