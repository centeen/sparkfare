# Walkthrough verification (Addendum I, Step 0) — 2026-10-17

Read-only. Nothing in the repo or on the live site was changed to produce this. Production was read with `curl` of public pages and `/api/partners`, one browser load of `/check`, and three read-only D1 `SELECT`s (the Petcube partner row and two migration timestamps). `/out/petcube` was **not** requested.

**Two inputs named by the addendum are not in the repo, so this report could not be checked against them:**
- `claude/site_walkthrough_7_personas_2026-10-17.md` (the source). Only `claude/away_mode_plan_v1_2026-10-16.md` and `claude/g19_drafts/` exist. Every item below was therefore verified from the addendum's own description of it. Where the walkthrough's exact wording or page would change a result, that is stated. **Please add the file to the repo (or paste the relevant pages) before the PRs start.**
- `state_CAPABILITY_LEDGER.md`. It does not exist (`state_*.md` here are `AFFILIATE_PROGRAMS`, `DECISION_LOG`, `METRICS`, `METRICS_draft`). Item 9 gives the flag table so a ledger can be written; if the ledger lives somewhere else, its 14-day limit cannot be checked from here.

## Summary of items 63 to 70

| Item | Topic | Result |
|---|---|---|
| 63 | Petcube card and `/disclosure` entry | **Confirmed live.** Turned on 2026-10-16 by migration 0026 (owner approval recorded in the migration; PRs #247 and #249). Needs the owner's answer (see 1). |
| 64 | Blurbs with urgency or unsourced figures | **Confirmed, and wider than listed:** 34 strings in 28 of 40 destinations; the copy checker does not scan them. One of them gives insurance-cost advice. |
| 65 | "Book" and "Secure" in `/away-mode` copy | **Changed.** The meta description no longer says "Secure" (fixed since). "Book" remains in one live blurb (Parking Access). No "Secure" or "Book" in the page's own HTML. |
| 66 | Trip length `30_plus` | **Partly confirmed.** Everything exists behind `ENABLE_LONG_LEAVE`, which is `"false"`, so visitors see no "month or more" option and the long-stay lead. |
| 67 | LIVE-CHECKED PRICE tag | **Confirmed, and it is an inverted label:** the tag is shown for carried-forward (stale fallback) prices. |
| 68 | Route pages | **Confirmed.** Two templates; neither has a fare link; one says "notified instantly". |
| 69 | Time-off "Share this plan" | **Not reproducible as described** from code: the link already carries budget and holidays. The "emails when fares appear" heading does not match its form, and the home-ready link shows on every window. |
| 70 | Failed request on `/check` | **Not reproduced as a 404.** One console error (403, resource unnamed) on load. Likely candidate for a 404: `/favicon.ico` (404 sitewide). |

## 1. Petcube (item 63)

- **Live behavior.** `GET /api/partners` returns 14 partners including `petcube` (category "Pet Care"). `away-mode.html` has no static Petcube card: it renders from that API, so the card is live. `/disclosure` names Petcube in its current-relationships sentence (`disclosure.html` line 105; confirmed on the live page).
- **What shows it.** The `partners` D1 row `slug = 'petcube'`: `status = 'live'`, `status_reason = NULL`, `updated_at = 2026-10-16 06:13:59`. Migration `0025_petcube_hidden_partner.sql` (applied 2026-10-15 16:41:20 UTC) created it as `pending` with an empty link; `0026_petcube_live.sql` (applied 2026-10-16 06:14:05 UTC) set the link and `live`. `src/meters.js` registers it as `pet_care`, and `PLACEMENT_BY_CATEGORY` limits `pet_care` to the Away Mode list (never route pages or generic emails).
- **Who and when.** PRs #238 (hidden, 2026-10-15 16:40Z), #247 (live, merged 2026-10-16 06:13:50Z) and #249 (the code #247 left out, 06:19Z), all merged by `centeen`. Migration 0026's header says "owner approval 2026-10-16, Addendum C task C3". The production migration was applied six seconds after #247 merged. **Not verifiable from the repo:** whether the Design Council reviewed the copy first (the header says "not applied until the owner confirms after the council's review"), and whether D-013 conditions C1, C2 and D6 were met. D-013 is mentioned once in `state_DECISION_LOG.md` (in the 2026-10-16 audit entry) but its conditions are not recorded there, so C1, C2 and D6 cannot be checked from the repo (the only C1 to C7 in the log are the Fare Search G2 conditions).
- **"Addendum D dropped the `/away-mode` card":** nothing in the repo or live page shows that; the card is present. Either that statement refers to a different card, or the live state differs from what Addendum D intended.
- **Destination and sub-ID.** `/out/petcube` looks up the row and, if `status = 'live'`, answers `302` to the stored template unchanged: `https://www.awin1.com/cread.php?awinmid=33889&awinaffid=3086775&ued=https%3A%2F%2Fpetcube.com%2Fstore%2Fcategory%2Fcameras%2F`. **No sub-ID is added to the outbound link** (no `clickref`), so Awin cannot attribute a sale to a Sparkfare click or trip; attribution to Sparkfare is the Awin affiliate id only. Sparkfare's own record of the click is an `events` row (`outbound_click`) with `sub_id = trip_id | partner_id | 'anon'`, `source = away_mode`, and no traveler data.
- **Live state not changed.** Waiting for the owner (G62).

## 2. LIVE-CHECKED PRICE (item 67)

- **Where.** One place: `index.html` line 1292 in `cardHTML()`: `item.status === 'deal' ? DEAL : item.is_stale_fallback ? LIVE-CHECKED PRICE : ''`. Added 2026-09-17 in commit `e201826c` ("High Priority bug fixes and UX wins").
- **Rule.** The tag appears when the record's `is_stale_fallback` is true, i.e. when `apply_fallback()` in the ranking script carried the previous day's record forward because there was no fresh price today. So it labels a carried-forward price as "live-checked", the opposite of what happened.
- **ATL to Bogota.** In `sparkfare_ranked_deals_other_origins.json` (generated 2026-10-17 01:07 UTC) ATL, Bogota, Colombia is `status = priced_no_deal`, `is_stale_fallback = true`, `found_at = 2026-10-15T23:43Z`, `last_fresh_date = 2026-10-16`, price $596. The board shows the tag (rule above); `/data/atl-to-bogota-colombia` shows its stale note ("This price is carried forward from the most recent day we had real data for this route"). The two agree on the facts and disagree on the words.
- **Old as-of dates.** Carry-forward is allowed up to `STALE_FALLBACK_MAX_AGE_DAYS = 7`. Today's data: 1 of 32 JFK records and 55 of 391 other-origin records are stale fallbacks; 11 of those carry a date before Oct 12. The as-of line is `found_at || last_fresh_date` formatted with `toLocaleString([], …)`, which uses the **viewer's** time zone and prints no zone name (`index.html` lines 1279 and 1331).

## 3. Blurbs (item 64)

- **Where.** Card text is the `copywriting` object per destination in `sparkfare_destinations.json` (`the_hook`, `on_ground_reality[]`, `away_mode_transition`), generated once with Claude Haiku (per this file's history); **no generator script for it is in the repo**. `Phase 20 Blog Generator.py` copies the same text into the destination blog posts, so each flagged string also appears in a blog page (for example `blog/cebu-philippines.html`, `blog/lisbon-portugal.html`).
- **Coverage.** `scripts/check-referral-copy.js` explicitly does **not** scan `*.json` or `*.md`, so no blurb is checked.
- **Instances.** A scan of all 40 records for urgency wording and percentage or dollar-saving figures found **34 strings in 28 destinations**. Exact urgency wording: Petra `the_hook` ("reward travelers who move fast") and Tbilisi `the_hook` ("Move fast—premium positioning rarely lasts."). Figures named in the addendum, confirmed: Marrakech and Prague and Phuket ("70% less/below"), San Jose `the_hook` ("typically $200+ cheaper"), Lisbon `the_hook` ("prices drop 40%"), Mallorca `the_hook` ("40% below peak rates"), Bali `the_hook` ("60% less"). The rest are `on_ground_reality` lines claiming 25% to 100% differences ("Rio … 60–70% less", "Ho Chi Minh City … 70–90% less", "Cebu dive operations 60–70% less", and so on).
- **One needs separate handling:** `Cebu, Philippines` `away_mode_transition` says "check medical coverage … your premiums drop 40% with regional carriers". That is an insurance cost claim with no source, while insurance recommendations are blocked until ROADMAP step 19. It is also published in `blog/cebu-philippines.html`.
- Full list of the 34 strings: reproducible by the scan used here (patterns: move fast, hurry, last chance, premium positioning, "N%", "$N+ cheaper/less/more"). The G57 report will list every one with file and line.

## 4. "Book" and "Secure" on `/away-mode` (item 65)

- `away-mode.html` itself contains neither word in Sparkfare's own copy. The meta and og descriptions already read "Prepare for your next trip with Sparkfare's Away Mode checklist. See what to sort out before you depart." (the "Secure essential travel services" text was fixed; a test pins it).
- Live remaining: the Parking Access card text **"Book airport parking ahead and skip the gate-price surprise when you're heading out."** It comes from `partners.commission_note` (D1), seeded by `migrations/0012_populate_partner_blurbs.sql` and returned by `/api/partners`. Not changed by `0024_partner_blurb_wording.sql`. Fix is a new migration (an `UPDATE`), applied before merge since deploys do not apply migrations.
- Partner-owned names that may stay: none contain the two words among the 14 live partners; the category label "VPN/Security" is Sparkfare's own label and contains "Security", not "secure".

## 5. Trip length (item 66)

- **Accepted values** (`TRIP_LENGTH_TOKENS`, `src/index.js` line 559): `weekend, 4-6, 7-10, 11-14, 2+ weeks, 30_plus`.
- **Is `30_plus` accepted?** API: yes, but `normalizeTripLength()` stores it as `2+ weeks` unless `ENABLE_LONG_LEAVE` is `"true"`; it is `"false"` (and `GET /api/long-leave` returns `{"enabled":false}`). Forms: `index.html`, `widget.html` and `account.html` list only up to `2+ weeks`; `long-leave.js` adds the "month or more" option only when the flag is on. Alert logic: `prioritizePartners()` treats `30_plus` like `2+ weeks` (US Global Mail first).
- **`/leave`.** "A month or more" is key `month_plus`; with the flag on a signed-in save sends `30_plus`, otherwise `2+ weeks` (`leave.html` line 328). The long-stay result reads the answer through `buildLeaveReadyPlan(…, { longLeave })`; the mail and insurer lines are built in `src/longLeave.js` `buildLongLeaveLead()`: USPS Hold Mail with a 30-day limit (checked 2026-10-13 on `https://www.usps.com/manage/hold-mail.htm`: "a minimum of 3 days and a maximum of 30 days"), forwarding, a virtual-mailbox link only if the partner is live, an "unoccupied home" question for the insurer with **no link, partner or tracking**, and water. So G58 as described is **already built and dark**; what is missing is the decision to turn on `ENABLE_LONG_LEAVE`, which D-006 ties to the Hub's review of the lead copy (`g1_lead_copy_2026-10-14.md`).

## 6. Route pages (item 68)

- **Two templates.** (a) The Worker's `/flight/:origin/:destination` (`renderRoutePage()`, `src/index.js` line 30; rendered live from the ranked-deals JSON, `noindex` when the route has under 14 days or 10 observations); (b) the 881 static pSEO pages `/data/<origin>-to-<destination>` generated by `Phase 17 pSEO Generator (Step 106).py`, which vary by route status (deal, priced, featured, still-building). The Worker decides (a) vs (b) only by the URL; there is no switch between them.
- **Fare link.** Neither template has a fare link. (a) has a single button "Get Deal Alerts" to the homepage signup (a comment explains it must not go to `/departing/`), a partner list with a commission disclosure, and the price. (b) ends with "Want the full board? See today's deals". No Aviasales or "View fare" link was found in either.
- **"Notified instantly".** It is in template (b): generator line 553 ("Join Sparkfare for free to track this exact route and get notified instantly"). Alerts are a daily email, so the word is inaccurate. It is not in template (a).

## 7. Time-off share and signup (item 69)

- **"Share this plan"** copies (or natively shares) `planUrl(appUrl, origin, { budget, code })`: the bare `/time-off/<origin>` for the defaults, otherwise `?budget=<N>&h=<holiday code>`. So it already carries the PTO budget and the selected holidays and no dates, email or address. `/time-off/<origin>` reads **only** the URL query (`budget`, `h`); it uses no storage. A plan that changed only a different control, or was shared before the page redirected to the compact URL, would lose the choice; I cannot reproduce a failure without the walkthrough's steps.
- **"Before you go: get your home ready"** (`src/ptoPages.js` line 261) is shown under **every** window whenever `ENABLE_LEAVE_READY` is on (it is), including 3-day weekends.
- **"Get an email when fares appear for your long weekends"** (line 318) is a form that posts to `/api/signup` (`source: 'pto'`, the origin and the trip-length bucket of the longest planned block): it creates the **daily deal alert** for that airport, not a per-window fare alert. The actual per-window alert is the separate "Watch this weekend" button (`/api/pto-watch`, `ENABLE_PTO_WATCH` is `"true"`). The heading overstates the form.

## 8. Failed request on `/check` (item 70)

Loading `https://sparkfare.com/check` in the browser pane: all five requests succeed (`/check`, `utm.js`, `nav-auth.js`, `site-footer.js`, `sparkfare_destinations.json`, plus Cloudflare's `cdn-cgi/rum` 204); the console shows one `403` resource error with no URL. No 404 reproduced. Browsers request `/favicon.ico` when a page does not name one they can use, and **`/favicon.ico` returns 404 on the whole site** (`favicon.png`, `apple-touch-icon.png` and `sparkfare_mark.svg` are 200); `/manifest.json` and `/manifest.webmanifest` also 404 but nothing links them. Most likely cause, unconfirmed. Not touched.

## 9. Flags in `wrangler.jsonc` today (for the ledger)

| Flag | Value | Flag | Value |
|---|---|---|---|
| ENABLE_T3_REFERRALS | true | ENABLE_PTO_CALENDAR | true |
| ENABLE_EMAIL_V2 | true | ENABLE_PTO_FARES | false |
| ENABLE_EMAIL_CHECKLIST_V2 | true | ENABLE_PTO_WATCH | true |
| ENABLE_DIGEST_ARCHIVE | true | ENABLE_PTO_DIGEST_BLOCK | false |
| ENABLE_DIGEST_ARCHIVE_WRITE | true | ENABLE_METER_TRACKING | true |
| ENABLE_T7B_PUSH | false | ENABLE_FARE_ROUTING | false |
| ENABLE_T5B_ADS | false | ENABLE_LONG_LEAVE | false |
| ENABLE_X_BROADCASTER | false | ENABLE_PINTEREST | true (`PINTEREST_ENV` = sandbox) |
| ENABLE_PRICE_CHECK | true | ENABLE_LEAVE_BY_PLAN | false |
| ENABLE_PLUS_WAITLIST | true | ENABLE_RULE_WATCHER | false |
| ENABLE_ORIGIN_REQUESTS | true | ENABLE_PASSPORT_CHECK | false |
| ENABLE_LEAVE_READY | true | ENABLE_PLAN_REMINDERS | false |
| ENABLE_DAILY_DIGEST | true | ENABLE_HOME_CARD | false |
| ENABLE_DIGEST_SKIP_UNCHANGED | true | ENABLE_TRIP_SELF_REPORT | false |
| ENABLE_WEEKLY_STANDUP | true | ENABLE_T2B_SEQUENCE | true |

Differences from older notes in `CLAUDE.md` that a ledger should pick up: `ENABLE_DIGEST_ARCHIVE` is now `true` (older entries say `"false"`), `ENABLE_EMAIL_V2` and `ENABLE_DIGEST_SKIP_UNCHANGED` are `true` (switched on 2026-10-09), `ENABLE_PTO_CALENDAR` and `ENABLE_PTO_WATCH` are `true`, `ENABLE_LONG_LEAVE` is `false` again (since Oct 15), Petcube is a **data** switch (D1 row), not a flag. Cron triggers and D1 row state (partners, rule overrides) are outside `wrangler.jsonc` and are not in this table.

## Proposed PR order and size (all after the owner approves each one)

| Order | PR | Why this position | Files (estimate) |
|---|---|---|---|
| 0 | Owner answers: G62 Petcube, whether the walkthrough file can be added, whether `ENABLE_LONG_LEAVE` may be turned on | Blocks G58, G62 | none |
| 1 | **G61** LIVE-CHECKED tag: show a "last seen <date> <zone>" note for carried-forward prices; put a time zone on every as-of time | Smallest, accuracy | `index.html`, 1 test (2 to 3) |
| 2 | **G57** copy clean-up, **in the same report as Addendum H step 97** (the Aviasales-mentions report, Mon Oct 19) | Same files; avoids conflicting PRs | `sparkfare_destinations.json` (28 records), the matching blog pages (about 28, regenerated), `Phase 20 Blog Generator.py` if it carries the rule, a new migration for the Parking Access blurb, `scripts/check-referral-copy.js` (scan the destinations file; add urgency and unsourced-figure rules), allowlist, tests (roughly 35 to 40, mostly generated) |
| 3 | **G59** route pages | Copy plus link | `src/index.js`, `Phase 17 pSEO Generator (Step 106).py`, the 881 regenerated `data/*.html` (the diff is mechanical), tests (about 4 hand-edited, about 880 generated) |
| 4 | **G60** time-off | Independent, small | `src/ptoPages.js`, tests (2 to 3) |
| 5 | **G58** long stays | Already built; needs the flag decision, not code | 0 to 2 files if the owner wants the signup option visible by default |
| 6 | **G62** Petcube | Waits for the owner's answer to item 1 | 1 migration or none |

Open question for the owner on G59: the addendum asks for "the same fare link and disclosure the board uses", but neither route template has a fare link today and Addendum H step 97 is reducing Aviasales mentions. The two should be settled together.

## Correction, 2026-10-17 (later): item 70 after reading walkthrough v2

The walkthrough's section 5 says the homepage calls `/api/leave-by-plan/status`, which returns 404 while the flag is off, as a likely source of the 404 on `/check`. Checked: the route does answer 404 with the flag off, and `plan-entry.js` (loaded on the homepage and `/away-mode`) calls it, so **those two pages** log a 404 on every load. `/check` does not load `plan-entry.js` and makes no such request (the five requests listed in section 8 above stand), so the `/check` 404 the walkthrough saw is not reproduced and may be a different resource; `/favicon.ico` (404 sitewide) remains the other candidate. The walkthrough file itself is now in the repo (`claude/site_walkthrough_7_personas_2026-10-17.md`), so the statement at the top of this report that it could not be checked against that file no longer holds; its counts and findings were compared with the repo and agree (see ROADMAP, "Score-elevation plan v1").
