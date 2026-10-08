# Claude Code build spec: Away Mode, four moves (2026-10-08)

Approved by Coby 2026-10-08: flights stay the main product, Away Mode is the second pillar; build only the four moves below; defer everything else; build Move 3 before Plus Week 1 (Mon Nov 16). Background and reasoning: `claude/away_mode_integration_and_product_focus_2026-10-08.md` and `claude/away_mode_thinktank_plan_2026-10-08.md` (project docs).

## Paste this block at the top of the session

```
You're working on Sparkfare (Cloudflare Worker + D1 + Clerk + Resend + GitHub Actions). Read CLAUDE.md, then ROADMAP.md in full,
then sparkfare_style_guide.md. This spec adds four small Away Mode moves. RULES, no exceptions:
1. Discover first. Before editing, inspect the actual current code. Line numbers and statuses in this spec are last-known (2026-10-08).
2. Every user-facing feature ships behind a flag, default OFF, reversible. Email copy changes (Move 1) are the one exception: they ship live, but only after Oct 17 (see Timing).
3. Feature branch per move, small commits, PRs. Do NOT push to main, deploy, run migrations on production, trigger a scheduled job, or send a real email without asking Coby.
4. Schema changes are new numbered D1 migrations, backward-compatible, with a rollback note. Next number is 0016; check for collisions. Migrations are not run automatically.
5. Referral-copy rules apply to every string: never "Book now", "Book this fare", "we book", "secured", "locked in", "guaranteed". Run `npm run check:copy` and `npm test` before every PR. Wording constants live in src/referralCopy.js.
6. Only live partners from the registry may be linked. Never invent a tracking URL. Do not add insurance prompts or links (ROADMAP step 19 is open). Do not touch the existing SafetyWing entry.
7. No new personal data beyond what each move lists. Never store a home address, never store "home is empty on these dates", never put dates on a public page.
8. Tests for every pure function and every new route. Report with the three honest tiers: done-confirmed-live / built-not-verified-live / not-started.
9. If anything here contradicts the repo, stop and report the discrepancy; do not silently proceed.
```

## Timing (fixed dates, the launch sprint rule applies)
- Now to the Oct 16 go/no-go: observation only. Nothing in this spec merges or deploys before the review. Branches and PRs may be prepared; do not merge.
- Slice A, from Oct 17: Move 1 and Move 4.
- Slice B, from Nov 1: Move 2 and Move 3, flagged off. Move 3 must be mergeable before Plus Week 1 (Nov 16).

## Move 0: baseline (read-only, do first)
Goal: know what exists to measure.
1. Find out whether any `/away-mode` page view or questionnaire event exists. A grep of `src/*.js` and `away-mode.html` on 2026-10-08 found none (events seen: `outbound_click`, `away_mode_sequence_sent`, `interstitial_view`, `check_run`, `check_signup`, `check_share`, etc.). Check Cloudflare Web Analytics too. Report; do not add anything pre-launch.
2. Read-only D1 queries for a baseline (one statement per call), e.g. `outbound_click` counts by `partner`; counts of `trips` by `status`; `alert_email_sent` and `away_mode_sequence_sent` counts. Write the results into a short note for `state_METRICS.md` (Coby pastes them; the file's rule is that only real, named-source numbers go in).

## Move 1: reframe the existing emails and the Away page lead (copy only, no schema)
Files: `src/email.js` (`sendStressValveEmail` ~line 622, `sendDepartureBriefingEmail` ~670, `sendDepartingSoonEmail` ~796; check `sendPreDepartureSequenceEmail` ~1291 too), `away-mode.html` (the intro above the partner list), `tests/` (followup_email_honesty.test.js and any test asserting these strings).

Principle: people follow through when a plan names a cue ("when X, then Y"). Replace generic nudges with one home-first line that names a cue, placed above the partner list and containing no affiliate link. Keep every existing partner list, disclosure order (disclosure stays first) and unsubscribe footer unchanged.

Target copy (adjust for fit; keep these ideas and keep them plain):
- Day +2 stress valve: "If you've booked, pick the moment each job gets done. When you set your out-of-office, tell whoever has a key. When you pack your bag, sort the mail." Then the existing paragraph and list.
- Day -7 briefing: "One week out. Three cues worth setting now: when you pack, water the plants and set the mail hold. When you charge your phone the night before, check the water shutoff and the thermostat. When you lock the door, text the person checking in."
- Day -3 departing soon: "Last pass. Home (water, mail, who has a key), pets or plants, phone and data. Anything still open, do it at your next cue, then you're done."
- Write nothing that implies a result ("your home is protected", "secured"). Do not give insurance advice.
- `away-mode.html` lead: open with the home-and-pets worries (water, mail, pets, who has a key) before the vendor list. Do not change partner rendering. Verify at 375px.

Done when: all strings above are live behind no flag; `npm run check:copy` and `npm test` pass; a preview render (`scripts/preview-email.mjs`) of each email is attached to the PR; no affiliate link appears above the first disclosure.

## Move 2: close the booked loop with a one-tap self-report
Why: booked status only arrives when Travelpayouts reports a paid action (`src/index.js` ~2068, which runs `UPDATE trips SET status='booked' ... WHERE status='clicked'`). A self-report adds a signal when that is slow or missing and lets later emails stop nagging people who are not going.

CRITICAL: do NOT write the self-report into `trips.status`. The reconciliation only updates rows still `clicked`, and the booked-confirmation email hangs off that update. Use separate columns.

Two PRs:
1. **Migration PR only:** `migrations/0016_trip_self_report.sql`: `ALTER TABLE trips ADD COLUMN booking_self_report TEXT;` (values `booked`, `not_yet`, `not_going`) and `ALTER TABLE trips ADD COLUMN self_reported_at TEXT;`. Add a rollback note. Coby runs it (`npm run migrate`; Wrangler 7403 errors are intermittent, retry). Merge this first.
2. **Code PR** (after the migration is applied in production):
   - `src/postClickEmail.js`: `signTripTapToken(tripId, answer, secret)` and `verifyTripTapToken(token, secret)`, same HMAC pattern as `signUnsubscribeToken`, with a domain prefix in the signed payload so an unsubscribe token can never validate as a trip token. Payload: trip_id, answer, expiry (120 days). No email in the token.
   - `src/index.js`: `GET /api/trip-status?token=` shows a small noindex confirm page with the three choices; the choice POSTs back. A GET must never change state (link scanners and prefetchers follow GET links; the unsubscribe route at ~line 3016 documents the same rule). `POST /api/trip-status` verifies the token, writes the two columns (last answer wins, idempotent), logs `logEvent(env, { event_type: 'trip_self_report', sub_id: trip_id, meta: { answer } })`, and ignores requests classed as bots (`src/botClass.js`).
   - `src/email.js`, `sendStressValveEmail`: under the first paragraph add "Did this trip happen? Booked / Not yet / Not going. One tap, so we only send what's useful." Build links only when `UNSUBSCRIBE_SECRET` is set. Flag: `ENABLE_TRIP_SELF_REPORT` (default off; with it off the email is unchanged).
   - Suppression: in `sendDepartureBriefingAlerts` (~1778), `sendDepartingSoonAlerts` (~1597) and `sendPreDepartureSequenceAlerts` (~3887) skip trips where `booking_self_report = 'not_going'`. Guard the column reference so the code still runs if the migration were missing.
   - `/admin/metrics`: add counts of self-reported booked, not yet, not going, and self-reported booked versus Travelpayouts `booked`.
   - Tests: token round trip, tampering, wrong domain, expiry; GET does not change state; POST idempotent; bot ignored; suppression queries; email unchanged with flag off.

Done when: with the flag on in a test environment a tap updates only the two new columns; `status` and `price_eur` reconciliation is unaffected (test that a later paid action still flips `clicked` to `booked` after a self-report of `booked`).

## Move 3: "Leave-ready" page (roadmap step 55) behind a flag
Why a new page: `/away-mode` is a P0 launch surface and already carries a 16-question "Customize your trip" panel (keys such as `pet`, `mail`, `bags`) saved to localStorage (`sparkfare_away_needs`) and `/api/preferences`. Leave that alone. Add `/leave`, mirroring how `/check` is gated (`ENABLE_PRICE_CHECK` returns 404 when off). Link to it from `/away-mode` and from route pages only when the flag is on.

Files: new `leave.html`, new `src/leaveReady.js` (pure), routes in `src/index.js`, `tests/leave_ready.test.js`. Check `tests/static_fetch_paths.test.js` for what a new static asset needs.

Build:
- Flag `ENABLE_LEAVE_READY` (default off): `/leave` returns 404 when off; nothing else changes.
- Six yes/no/skip questions, one screen each on a phone: trip length (weekend / 1 to 2 weeks / a month or more), pets staying home, plants, someone checking in, mail, water shutoff known. Answers stay booleans or a length bucket; store nothing else.
- `buildLeaveReadyPlan(answers, partners)`: pure function returning "done" and "still open" items with a short plain action each. Free-first: link the free official route before any partner (for mail, the USPS Hold Mail page first, then US Global Mail only if its registry status is `live`). Home and pet items link to no partner today (Rover is not approved); show free steps only. Partner links render only for `live` registry entries, with the standard inline disclosure.
- Result card: "3 things still open" style list. Do NOT show a percentage score or any claim about safety ("protected", "ready" as a guarantee). Wording like "3 things left to sort" only.
- Email capture at the result: reuse the existing signup/alert flow (`/api/signup`, inspect its contract and consent text); do not create a new list or a second consent path. Signed-in users: save the booleans via `/api/preferences`; inspect its schema first. If it cannot hold the new keys, stop and propose a migration (next number 0017) rather than overloading a field.
- Events (T0 `logEvent`): `leave_view`, `leave_answer` (key and answer, no free text), `leave_result_view`, `leave_signup`, `leave_partner_click` (via `/out/:slug`).
- Update `privacy.html` for the answers collected before this goes live. Add to `sitemap.xml` only when the flag is turned on.
- Mobile first: 375px, tap targets at least 44px, no horizontal overflow, nav from the shared component.
- Tests: plan builder cases (each answer combination, skipped answers, no live partner), 404 when flag off, 200 when on, banned-phrase scan of the page, partner link `rel="sponsored nofollow noopener noreferrer"`, disclosure present near any affiliate link.

Done when: flag-on page works end to end in a test environment, flag-off site is unchanged, copy check and tests pass. Coby decides when to switch the flag on in production.

## Move 4: four trust posts (content, Slice A)
Discover how `blog/away-mode-checklist.html` and `blog/avoiding-the-rate-limit.html` are made (hand-written HTML on the shared blog template; the Phase 20 generator only makes destination pages). Copy that pattern, add each post to `blog/index.html` and `sitemap.xml`. Each post: a "Last reviewed" date, a Sources list, plain language, no affiliate links unless stated, referral-copy check passing.

1. **Water, not burglars.** Facts to use (source: Insurance Business report of a PEMCO poll, https://www.insurancebusinessmag.com/us/news/property/homeowners-fear-fire-but-water-damage-drives-the-real-claims-risk--pemco-poll-580713.aspx): water causes 45% of interior property damage in US homes; under 10% of households have leak detection versus 99% with smoke detectors; FBI burglary incidents 779,542 in 2024, down 8.1%. Say the poll was run by an insurer in the Pacific Northwest. Content: find your shutoff, ask your insurer about vacancy rules, who checks the home. No product links. (Amazon Associates is on a deliberate hold until a first gadget article is published; Coby decides separately whether to start that clock. Default: no affiliate links.)
2. **What your credit card may already cover.** Teach people to read their own benefits guide before buying anything. May cite WalletHub (via TravelPulse, June 2023, sample size not stated): 41% want trip delay or cancellation cover from their card, nearly half say they do not use card benefits fully. Do not state any specific card's terms; link to issuer pages.
3. **Can't go because of the dog?** Options compared in plain terms (friend, sitter, boarding, home check), a hand-off checklist, a "what to leave for the sitter" list that excludes alarm codes. APPA: 95 million US households own a pet. No Rover link (not approved). Use the 2015 Rover survey only if labelled as old and sponsor-run, otherwise omit.
4. **Trip protection has a clock.** Education only: some protections, such as pre-existing-condition waivers and cancel-for-any-reason, usually must be bought within about 10 to 21 days of the first trip payment, varying by plan (source: Squaremouth, https://www.squaremouth.com/help-center/general-questions/when-do-i-purchase-travel-insurance). Say "check your own plan's exact deadline". No insurer or insurance-partner links, no plan recommendations, no advice.

Done when: four posts live, in the index and sitemap, copy check and tests pass, sources dated.

## Explicitly out of scope (do not build)
Forwarding inbox; sitter sheet (step 63); household profile; a new "did you book" email; a separate receipt email; concierge program; State of Leaving report; any score, percentage or safety claim; any new insurance prompt; any partner outreach.

## PR plan and rough size (my estimates, plus or minus 50%)
1. Move 1 copy PR: about half a day. 2. Move 4 posts, one PR per post: 2 to 3 days including Coby's review. 3. Migration 0016 PR: under an hour. 4. Move 2 code PR: 2 to 3 days. 5. Move 3 PR: 4 to 6 days.

## Docs-only roadmap diff (separate small PR, per the maintenance process)
Add rows (verify the next free numbers first; the highest step number seen on 2026-10-08 was 68):
- Away Move 1: reframe lifecycle emails and Away page lead. Phase 3. Not started. Depends: Oct 16 go.
- Away Move 2: trip self-report (migration 0016, `ENABLE_TRIP_SELF_REPORT`). Phase 3. Not started. Depends: 0016 applied.
- Away Move 3: `/leave` page (this is step 55's build; update step 55's row, do not duplicate). Depends: 20, 16. Must precede Plus Week 1.
- Away Move 4: four trust posts. Phase 3. Not started.
Decision-log lines to append (DECISION 2026-10-08): flights stay the main product, Away Mode is the second pillar; four moves approved; everything else deferred; step 55 built before Plus Week 1; pivot test set: by Feb 12, consider making Away the lead story only if (a) leave-page completions plus email capture beat flight-alert signup rate per visitor, (b) Away partner clicks per 100 active subscribers exceed flight outbound clicks per 100, and (c) at least two home or pet partners are live; first directional read at the Dec 11 gate; counts only, not dollars, because partner payout reconciliation is manual.
