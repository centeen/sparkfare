# Addendum J to Claude Code: pre-freeze accuracy, display and copy fixes (Oct 17, 2026)

> **Amendment 1 (Oct 17, 12:00 Israel), after Claude Code's first read.** These points override the text below where they conflict.
> 1. **Deploy path first (new precondition).** Cloudflare auto-deploy has failed on every PR since #269, so production may be running an older build than `main`. No J PR is "done" until it is live. Fixing the deploy is the first task once the owner supplies the build error text from the Cloudflare dashboard. Report what production is actually running: the last successful deploy, its commit, and which merged PRs are not live.
> 2. **J5 shrinks.** Claude Code reports `ENABLE_METER_TRACKING` has been `"true"` on `main` since Oct 13 (PR #196) with no later change. The project's synced copy of `wrangler.jsonc` read `"false"` on Oct 17, so in J0, quote the line and the commit hash. If it is on, J5 is: confirm migration 0022 in production, confirm it is live in the deployed build (see point 1), add the privacy sentence if missing, and record **Oct 13** as the flag-on date. The Task D readout then opens Oct 27. No flag PR.
> 3. **Tag wording waits for the owner.** PR #281 (merged Oct 17) already reworked the tag with a 48-hour rule and kept "LIVE-CHECKED PRICE". J1.1 and J2.4 (26 hours, "Checked today", retire "LIVE-CHECKED") are **on hold** until the owner chooses (see `state_SESSION_STATE.md`). In J0, report what #281 changed and whether stale fallbacks still get the tag after it.
> 4. **Source files.** The plan and the walkthrough v2 live in the council project, not the repo. The owner will give Claude Code both files, as with R-008. Until then, use this addendum's definitions.
> 5. **Timing.** J0 runs Monday Oct 19, together with the step 97 report, so the two PR orders are planned together. The owner gives the go.

**Why.** The Oct 17 walkthrough v2 and the score-elevation plan found that the site is fast and honest in its engine, but its display contradicts its own data in places and hides fare details it already holds. Launch traffic arrives Nov 7. The owner approved the pre-freeze fix set on Oct 17.

**Read first:**
- `claude/score_elevation_deep_dive_2026-10-17.md` (Strategic product document v1, D-024): sections 2 and 4 define every item below.
- `claude/site_walkthrough_7_personas_2026-10-17.md` v2: sections 4 and 5 give the evidence and the counts to re-check.

**Decisions this addendum carries:**
| Decision | What |
|---|---|
| D-020 | Pre-freeze fix set approved. Scope: deep dive levers A1–A6, B1, B2, B4, C2, C6, C8, C9, C10, E1–E5, F1–F3 |
| D-021 | Deal floor: a fare is a deal only if it is at least 15% below the median **and** the route has at least 10 distinct observation days. The median is computed over distinct observation days only |
| D-022 | Turn F0 meter tracking on (`ENABLE_METER_TRACKING` `"true"`). This reaffirms D-005 |
| D-023 | This addendum is the vehicle for the pre-freeze set |

## Standing rules (unchanged)
- **One PR per section below**, each merged only with the owner's explicit approval. If a section is too large for one PR, split it and say so in the J0 report.
- **Freeze:** no merges from Nov 6 18:00 ET to Nov 8. Target the last pre-freeze merge by **Wed Nov 4**, so there is a day to verify. Anything not merged by **Thu Nov 5 18:00 ET** waits until Nov 9.
- **Copy and disclosure:**
  - Referral-copy checker must pass (`npm run check:copy`).
  - Disclosure stays inline at every fare link, and the seller is named honestly where a user leaves the site (D-018).
  - No urgency, no price predictions, no "you saved".
- **Travelpayouts:** no custom code that alters any Travelpayouts tool (clause 2.3.5). Fare Search stays parked (D-007).
- **Privacy:** no travel dates in URLs, share links, logs or sub-IDs. The fare's own itinerary dates may be shown on cards; the traveler's dates may not.
- **Copy in PRs:** every user-facing copy change shows its before and after text in the PR description.
- **Tests:** follow the repo's existing patterns. Run a mutation check on the rules in J1: break each rule and confirm a test fails.
- **Order with other addenda:**
  - Addendum I Step 0 (read-only verification) comes first, if not already delivered. J0 may be combined with it.
  - Addendum J replaces Addendum I Step 1 items G57 (copy clean-up), G59 (route pages), G60 (time-off share) and G61 (LIVE-CHECKED). Do not build those twice.
  - Addendum H Task C (Aviasales copy) touches some of the same files. Plan the PR order in J0 so the two never conflict.

## J0. Read-only plan report (deliver first, by Tue Oct 20 if possible)
Write `docs/addendum_J_plan_2026-10-17.md` covering:
1. **Inventory.** For every item in J1 to J5: files touched, current behavior observed on production, the planned change and the tests to add.
2. **Deal-floor dry run (D-021).**
   - State how the compile step tells a real fetch apart from a carried-forward day (for example `found_at` present vs absent, or `is_stale_fallback`).
   - Propose the exact definition of a "distinct observation day" from that.
   - Run the new rule over the current `sparkfare_ranked_deals*.json` without publishing anything. Report deals before and after, per origin.
   - Report which origins lose every deal, and what their hero then shows (it must fall back to the existing no-verdict label; D-008 still bars a deal claim on thin data).
   - Hub estimate, for comparison only: about 24 of today's 35 US deals clear the 15% line, before the distinct-day and stale rules.
3. **Tag and freshness.** Where the "LIVE-CHECKED PRICE" tag is set, and why it renders on rows with `is_stale_fallback: true` (on SFO on Oct 17, exactly the 6 stale rows carried it and none of the 20 fresh rows did).
4. **Past departures.** Why rows with a departure date before the compile date survive. On Oct 16 data there were 10, among them SFO→Petra (departs Oct 12), SFO→Prague (Oct 14) and SFO→Lisbon (Oct 16).
5. **Route count.** Where "880 routes" comes from, versus 828 rows in the two data files (794 US + 34 TLV). Do route pages exist for routes with no data row?
6. **Blurbs.** Where card and hero blurbs are generated (script, prompt, stored field). List every distinct blurb live today that contains a comparative figure, an urgency phrase or a generated stray phrase. Seen Oct 17: "70% less than…", "prices drop 40%", "$200+ cheaper", "before rates reset", "Move fast, premium positioning rarely lasts", "Pure visual storytelling", "Currency arbitrage meets temple culture".
7. **Meter tracking.** Which commit set `ENABLE_METER_TRACKING` to `"false"` on main after Oct 14, when, and why. Is migration 0022 applied in production?
8. **PR order** and an estimate of files per PR.

**Stop after J0 and wait for the owner.**

## J1. Data accuracy (A1, A2, A3, A4, A5, A6)
1. **Tag (A1).**
   - Show a freshness tag only when the row is not a stale fallback **and** `found_at` is within 26 hours of the file's `generated_at`. Label it "Checked today", not "LIVE" (ROADMAP rule e: never "real-time" or "live").
   - Otherwise show no tag and show "Last seen <date>".
2. **Past and near departures (A2).**
   - Drop every row whose departure is in the past or within 48 hours, at compile time.
   - Filter again at render time, because the file is generated before the page is viewed.
   - Applies to deals, featured heroes, not-a-deal rows and route pages.
3. **Stale rule (A3).** A price whose last fresh date is more than 3 days before `generated_at` shows "Last seen <date>":
   - no "View fare" link;
   - never as a deal;
   - never as a hero.
   This matches the PTO window-fare rule in ROADMAP 73 B2.
4. **Deal floor (A4, D-021).** Apply the approved rule everywhere a deal is claimed:
   - on the board, hero, route pages and `/check` wording;
   - in the digest and newsletter selection, if they reuse the same function (say so in J0).
   Basis text uses the distinct-day count.
5. **One count (A5).**
   - Basis text and history must agree on the count. Two Oct 16 mismatches: SEA→Larnaca says "10 observations" with 9 history points; IAD→Thessaloniki says "15" with 16.
   - Replace any hard-coded route count with a computed one. Use whatever J0 shows is true: route pages that exist, or routes with data. Say which one in the copy if it is ambiguous.
6. **Time zones (A6).** Every "Prices as of" shows a zone and a relative time, for example "Oct 16, 9:50 PM ET · 10 hours ago". Choose one zone site-wide and say which in J0.

**Done when:** a production read after deploy shows:
- zero tagged stale rows;
- zero rows departing before now plus 48 hours;
- no "View fare" link on any price older than 3 days;
- deal counts per origin matching the J0 dry run;
- every as-of time showing a zone.

## J2. Fare display (B1, B2, B4, E5)
1. **Card anatomy (B1)**, on the board and in heroes:
   - price, then "per person, round trip";
   - the fare's own dates and nights from `departure_at` and `return_at` (for example "Dec 1 – Dec 8 · 7 nights");
   - airline name from the IATA code (add a small code-to-name map; fall back to the code);
   - status chip (E5) and basis;
   - as-of (J1.6);
   - View fare.
   Dates are shown in the destination's local date as given in the data. Do not compute a local time.
2. **Route pages (B2).**
   - The same block, plus a **"View fare" link** using the same outbound path, `rel` and inline disclosure as the board.
   - Keep the existing chart.
   - The price history holds no itinerary dates, so do not show a "dates we've seen" list. Show only the current fare's dates.
   - Remove the second competing call to action, so one signup remains.
3. **Dollars beside percent (B4):** "$457 below the usual $1,080". It describes the fare, never the user ("you save" is banned).
4. **One status chip system (E5)** across board, route pages and `/check`:
   - "Deal · 42% below usual";
   - "Typical price";
   - "Building history";
   - "Last seen <date>".
   Retire "LIVE-CHECKED PRICE" and "Not a deal today, but worth watching".

**Done when:** every priced card and route page shows dates, nights, airline, per-person label and one chip. JFK→Mallorca should read Dec 1–8, 7 nights, TAP Air Portugal on Oct 16 data. Route pages have exactly one fare link with disclosure.

## J3. Flows and copy (C2, C6, C8, C9, C10, F1, F2, F3)
1. **Empty states (C2).** On thin route pages and on `/check` "not enough history":
   - Say: "We haven't seen enough fares for <route> yet."
   - Link: "Get alerts from <origin>", pointing to the existing signup with the origin pre-selected.
   - No promise of a price or a date. The email-only route watch is Wave 1, not this addendum.
2. **Mobile order (C6)**, at widths under 768 px: H1 and one value line, then the origin bar, then the first three cards, then the signup. Keep desktop as is unless the same change helps there; report it.
3. **Time-off share link (C8).**
   - "Share this plan" builds a URL with the PTO budget and the selected holiday set only (for example `?pto=10&h=<codes>`), and the page restores the plan from it.
   - Use `navigator.share` when available, with copy-link as the fallback.
   - No travel dates, names or emails in the URL.
   - Canonical stays the clean origin URL.
4. **Short windows (C9).** Hide "Before you go: get your home ready" on windows under 5 days. Show one line instead: "Leaving for longer? Make a checklist" → `/leave`.
5. **Window-watch promise (C10).** The "email when fares appear" heading must use the existing PTO window watch (`ENABLE_PTO_WATCH` is on, email-only), or the heading changes to match what the form does.
6. **Blurbs (F1).**
   - Replace generated hero and card blurbs with a fixed template built from data: "<City>. Seen <dates> on <airline>, <n> nights. <basis>."
   - Add `content/destination_lines.json` for one optional human line per destination. Ship it empty; each line is added later only after Hub copy review and owner approval.
   - Remove every blurb listed in J0 item 6.
   - The featured hero on no-verdict origins keeps the "chosen for the place, not the price" label and the template line.
7. **Alert timing (F2):** replace "notified instantly when airlines slash the fare" with wording that matches the daily email (for example "in your next daily email").
8. **Parking (F3):** "Book airport parking ahead" becomes "Compare airport parking before you go".

## J4. Accessibility and basics (E1, E2, E3, E4)
1. **Structure (E1).** One H1 per page: add one to `/`, and fix the two on `/leave`. Add a `<main>` landmark on every page and a skip link.
2. **Targets (E2).** Interactive targets at least 24 × 24 CSS px, or spaced per WCAG 2.2 SC 2.5.8. On Oct 17, 13 of 28 targets on `/` and 13 on route pages were smaller.
3. **Labels and autofill (E3).** Label `#join-origin` and add `autocomplete="email"` to the homepage email field.
4. **Text and contrast (E4).** Body text at least 14 px. Fix the two 3.65:1 contrast failures on `/` ("Don't see your airport?" and the featured-hero label) to at least 4.5:1.
5. **Tests.** Extend the existing 375 px mobile test with checks for one H1, `<main>`, minimum target size and labeled fields on `/`, `/check`, `/leave`, `/away-mode`, `/time-off/<origin>` and one route page.

## J5. Meter tracking on (D-022)
1. **Before the PR, confirm and report:**
   - migration 0022 is applied in production (D-005 condition);
   - the privacy page already covers the events F0 records (if not, add one sentence in the same PR);
   - `/admin/meters` works behind the admin secret (never print the secret).
2. **The PR** sets `ENABLE_METER_TRACKING` to `"true"` and does nothing else.
3. **Record the flag-on date** in `ROADMAP.md` and the repo decision log. The Task D readout opens 14 days later (D-005).
4. **After deploy,** confirm one outbound click from a test page records a meter row, using a link that does not log a commission-bearing visit, or report why that cannot be done safely.
5. **Not in scope:** `ENABLE_FARE_ROUTING` (still undecided) and `ENABLE_LONG_LEAVE` (waits for the G1 copy review, D-006).

## Out of scope for this addendum
- Petcube status (G62; owner answer pending).
- Total-price wording (F4; needs counsel).
- `ENABLE_LONG_LEAVE`.
- `ENABLE_PTO_FARES`.
- Every Wave 1 item in the deep dive (email-only route watch, party-size link, intent entry, destination search, long-stay branch, departure reminders, printable keeper note, coverage probe, nearby-hub fallback). Each needs a mock and a council consult first.

## Verification before the Nov 6 go/no-go
After the last merge, write `docs/prefreeze_verification_<date>.md`. Use production reads only, with no clicks on fare or partner links:
- the SFO and ATL boards: tag, chips, dates and links;
- zero past-departure rows;
- deal counts per origin;
- JFK→Mallorca card and route page;
- one thin route page (PHX→Lisbon);
- `/check` "not enough history";
- the time-off share link round-trip;
- `/away-mode` parking line;
- the accessibility checks from J4;
- the meter flag state.
The Hub re-walks the seven persona journeys against it before the go/no-go.

## Reply format
After J0: the plan file path, the deal-floor before-and-after table, the PR order, and anything that blocks. Then stop.
After each PR: the PR link, files, the before-and-after copy, the tests added, and the mutation-check result.
