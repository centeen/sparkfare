# Claude Code build spec: PTO-Maxxed Fare Calendar (2026-10-09)

Proposed 2026-10-09 from the traffic-strategy session (see "Why" below). **Coby approves this spec before anything merges.** Building, testing and opening PRs can start today. Background: the 2026-10-09 traffic research found (1) a "PTO-maxxing" calendar story recurs every year in national press and on social (Fortune, May 27 2026; Time Out / Travel + Leisure earlier), and nobody attaches real fares to it; (2) the 2027 planning window peaks November to January, so this has to be live by late October to catch it.

## Paste this block at the top of the session

```
You're working on Sparkfare (Cloudflare Worker + D1 + Clerk + Resend + GitHub Actions). Read CLAUDE.md, then ROADMAP.md in full,
then sparkfare_style_guide.md and sparkfare_ranking_methodology.md. This spec adds a long-weekend planner ("PTO calendar") with
real fares, in four tracks (0, A, B, C) plus distribution wiring (D). RULES, no exceptions:
1. Discover first. Before editing, inspect the actual current code. Line numbers, file names and statuses here are last-known (2026-10-09).
2. Launch freeze: nothing in this spec merges to main before the Oct 16 18:00 ET go/no-go is passed and Coby says so. Until then:
   build on branches, open PRs, use the Cloudflare preview URL each PR gets. Merging to main auto-deploys (Workers Builds).
3. Every user-facing feature ships behind a flag in wrangler.jsonc, default "false", reversible. Only the exact string "true" turns it on.
4. Feature branch per track, small commits, PRs. Do NOT push to main, deploy, run migrations on production, trigger a scheduled job,
   send a real email, post to any social account, or call a paid API without asking Coby.
5. No new Cloudflare Cron Trigger (free plan: 5 per account; the Worker uses 4). New schedules ride an existing Worker cron or run as
   a GitHub Actions workflow (off-peak minute, never :00).
6. Schema changes are new numbered D1 migrations, backward-compatible, with a rollback note. Next number is 0019; check for collisions.
   Migrations are not applied by auto-deploy: Coby applies a migration to production BEFORE merging code that needs it.
7. Referral-copy rules apply to every string (src/referralCopy.js; never "Book now", "we book", "secured", "locked in", "guaranteed").
   Run `npm run check:copy` and `npm test` before every PR.
8. Price honesty: every fare shows "as of <date>" and its source ("lowest fare seen in search data"). No "% below average", deal badge
   or prediction on a window fare until that window has the history dealQuality requires. Never imply a fare is bookable at that price.
9. No new personal data beyond what each track lists. A user's chosen travel window is never shown on any public page, never put in a
   URL that is shared, and is deleted 30 days after the window ends.
10. Tests for every pure function and every new route. Report with the three honest tiers: done-confirmed-live /
    built-not-verified-live / not-started.
11. If anything here contradicts the repo, stop and report the discrepancy; do not silently proceed.
```

## What it is (one paragraph)

`/time-off/<origin>` (for example `/time-off/den`): a server-rendered page listing every long-weekend opportunity from today through Dec 31, 2027 ("Take Fri Nov 12 off, get 4 days"), an optimizer ("I have 10 PTO days, which days give me the most time off?"), and, for each window, destinations that fit its length with the lowest fare Sparkfare has seen for those exact dates. Each window has three actions: add to calendar (.ics), share, and "watch this weekend" (an email when the fare for those dates drops). It feeds signups (`source: 'pto'`), route pages, Watchlists, `/leave` and Away Mode.

## The honest data constraint (read before building)

Sparkfare's existing pipeline stores **one cheapest fare per route, for whatever dates that fare happens to be** (`/v1/prices/cheap`; see `departure_at` / `return_at` on records in `sparkfare_ranked_deals*.json`). It has no per-date prices. So:
- **Track A works with no fare data at all** (holiday math, optimizer, .ics, share). It can be built and tested today.
- **Track B adds per-window fares** with a small new fetch. Travelpayouts' Data API is a cache of real users' searches (2 to 7 days), so far-off windows will often have no price. The page must read well when most 2027 windows show "No fare seen yet. Watch this weekend." That is the default state, not an error.
- **Travelpayouts terms:** support confirmed in writing on 2026-09-23 (ticket XL9V56-3VLMR, `claude/travelpayouts_data_api_terms_confirmation_2026-09-23.md`) that storing Data API prices, public pages, alerts and widgets are allowed. Track B uses a different Data API endpoint for the same purpose; Track 0 confirms the endpoint and its rate limit before Track B's workflow is scheduled.

## Timing (fixed dates; nothing waits that doesn't have to)

| When | What | Gate |
|---|---|---|
| **Now to Oct 16** | Track 0 (read-only), Track A built + PR with preview URL, Track B script + dry run, Track C code + migration file, Track D assets drafted | None: no merge, no deploy |
| Oct 16 18:00 ET | Go/no-go | Coby |
| Oct 17 | Launch day: **do not merge anything from this spec** | Launch rule |
| **Mon Oct 19** | Merge Track A (flag off). Coby checks production with the flag on for himself via the preview, then flips `ENABLE_PTO_CALENDAR` | Coby |
| **Tue Oct 20** | Merge Track B (flag off); its workflow starts collecting window prices daily | Track 0 dry-run result |
| **Wed Oct 21** | Coby applies migration 0019 to production; then merge Track C (flag off) | Migration applied first |
| **By Mon Oct 26** | Flip `ENABLE_PTO_FARES` and `ENABLE_PTO_WATCH` once 3+ days of window data look right | Coby |
| From Oct 20 | Track D distribution, each item behind its own flag or owner action | See Track D |

Thanksgiving 2026 is Thu Nov 26, so watches on that window are only useful if they are live by about Oct 26. Plus Week 1 (Mon Nov 16) and Away Move 3 (`/leave`) keep priority: if Track C slips, it slips, not Move 3.

## How this merges with what already exists (reuse, don't rebuild)

| Existing piece | Use in this spec | Where (verify) |
|---|---|---|
| `/api/signup` (accepts `source`, `partner_id`, requires `origin_iata`, `trip_length`) | All email capture; `source: 'pto'`. No new list, no second consent path | `src/index.js` ~2650 |
| `/og/` share-image renderer + `src/assets/Inter-Medium.ttf` | PTO share card | `src/index.js` ~4276 |
| `/share/deal`, T4 share links | Pattern for the window share link | `src/index.js` ~2417 |
| `logEvent` (T0 events) and weekly standup | New events; add PTO counts to the Monday brief | `src/weeklyStandup.js` |
| Trip-length buckets (Weekend / 4-6 / 7-10 / 11-14 / 2+ weeks) | Map each window to a bucket for signup and destination fit | `index.html`, `/api/signup` validation |
| Route pages `/flight/<origin>/<dest>` and `/data/` pSEO pages | Every destination on a window links to its route page | pSEO generator, `src/index.js` |
| Watchlists (Step 115, route + target price, needs Clerk) | Unchanged. Window watches (Track C) are separate and need only an email | `src/index.js` ~1428, ~3632 |
| `/leave` (Away Move 3, `ENABLE_LEAVE_READY`) | "Before you go" link on each window, only when that flag is on | `src/leaveReady.js` |
| Daily digest / weekly edition | One promo block "Next long weekend from <city>" (Track D) | `src/email.js`, `src/digestArchive.js` |
| `src/pinterest.js` (`ENABLE_PINTEREST`) and X broadcaster (`ENABLE_X_BROADCASTER`) | Track D posts | `src/pinterest.js`, `Phase 3 Social Broadcaster.py` |
| Embeddable widget (`src/embed.html`, `widget_rate_limits`) | Later: a City Desk embed of the calendar (Track D, not v1) | step 33 / 43 |
| Signed tokens (`signUnsubscribeToken` pattern, domain prefix) | Watch-cancel links | `src/postClickEmail.js` |
| `VALID_ORIGINS` (15 US hubs + TLV) | **US origins only.** TLV is a testing origin and gets no PTO page (US federal holidays) | `src/index.js` |

## Track 0: discovery and dry run (read-only, start immediately)

No code merges from Track 0. Write findings into the PR description of Track A.

1. Confirm each row of the reuse table above exists and works as described; list any that do not.
2. Confirm the `/api/signup` contract: required fields, allowed `trip_length` values, how `source` is stored and whether the KPI dashboard groups by it.
3. Confirm how `/og/` images are produced (library, size, caching) and what a new image route needs (`tests/static_fetch_paths.test.js`, route smoke tests).
4. Confirm how the JSON data files reach the Worker (committed to the repo and read with `loadJsonAsset`?) and how `daily-compile-other-origins.yml` commits its output. Track B copies that pattern exactly.
5. **Holiday table check.** Compute the federal holidays and observed dates (rules in Track A) for 2026 to 2028 and compare them against OPM's published lists (opm.gov federal holidays). Expected results, to be confirmed against OPM, not trusted:
   - 2026 remainder: Veterans Day Wed Nov 11; Thanksgiving Thu Nov 26; Christmas Fri Dec 25.
   - 2027: New Year's Fri Jan 1; MLK Mon Jan 18; Presidents' Day Mon Feb 15; Memorial Day Mon May 31; Juneteenth Sat Jun 19 (observed Fri Jun 18); Independence Day Sun Jul 4 (observed Mon Jul 5); Labor Day Mon Sep 6; Columbus/Indigenous Peoples' Day Mon Oct 11; Veterans Day Thu Nov 11; Thanksgiving Thu Nov 25; Christmas Sat Dec 25 (observed Fri Dec 24); New Year's 2028 Sat Jan 1 (observed Fri Dec 31, 2027).
   Any mismatch with OPM: stop and report.
6. **Travelpayouts per-date dry run** (local, read-only, uses the existing token; ask Coby before running, it uses API quota). Write `scripts/pto_dryrun.py` (not wired into any workflow). For 3 origins (JFK, DEN, LAX) x the next 6 windows x 8 destinations that fit each window:
   - call the per-date Data API endpoint (expected: `GET https://api.travelpayouts.com/aviasales/v3/prices_for_dates` with `origin`, `destination`, `departure_at=YYYY-MM-DD`, `return_at=YYYY-MM-DD`, `currency=usd`, `sorting=price`, `limit=1`, `token`; confirm the endpoint, parameters and response in the current docs first; fall back to `/v1/prices/cheap` with `depart_date`/`return_date` if that is what the docs support),
   - 2-second spacing, as the existing fetch script does,
   - report: hit rate (price returned / calls), hit rate by days-until-departure, median `found_at` age, and any error or rate-limit response.
   **Decision rule:** if the hit rate for windows within 120 days is under 20%, Track B ships with exact dates replaced by "the cheapest fare departing within 2 days of the window start, returning within 2 days of its end" (state that wording on the page), and the report says so. Record the result in the PR and in `state_DECISION_LOG.md` (Coby pastes).
7. Check the URL `/time-off/` is unused, and that no sitemap or robots rule blocks it.

## Track A: the calendar page, optimizer, .ics and share (build now; merge Oct 19)

Flag: `ENABLE_PTO_CALENDAR` (default `"false"`). When off: every `/time-off*` path returns 404 (mirror how `/check` is gated by `ENABLE_PRICE_CHECK`), no nav link, no sitemap entries. Nothing else on the site changes.

### A1. `src/ptoCalendar.js` (pure, no I/O, fully tested)
- `federalHolidays(year)`: the 11 federal holidays with OPM's observed-date rule (Saturday holiday observed the Friday before, Sunday holiday the Monday after; New Year's on a Saturday is observed Dec 31 of the prior year). Return `{ key, name, date, observed }`.
- `COMMON_HOLIDAY_SET`: the default set most private employers give (New Year's, Memorial Day, Independence Day, Labor Day, Thanksgiving and the day after, Christmas). Users can toggle any of the 11 on or off, plus "day after Thanksgiving". **Say plainly on the page that many employers don't give all federal holidays; pick yours.** (This answers the most common complaint about PTO-hack posts.)
- `bridgeOpportunities({ from, to, holidays })`: for each holiday, the PTO days that join it to a weekend or another holiday, as candidate blocks `{ start, end, ptoDates[], daysOff, ptoUsed, efficiency }` for 1 to 5 PTO days. Weekends are Sat/Sun.
- `optimize({ budget, blocks, minDaysOff = 4 })`: deterministic selection under a PTO budget (0 to 30): highest `daysOff/ptoUsed` first, ties broken by more days off, then earlier start; no overlapping blocks; never exceeds the budget. Returns the plan and totals ("10 PTO days, 31 days off"). Totals count weekends and holidays inside chosen blocks only; never claim more.
- `tripLengthBucket(daysOff)`: map to the existing signup buckets.
- `destinationsForWindow(daysOff, origin)`: uses A2's table; returns destinations whose minimum sensible trip fits.
- All dates are date-only strings in UTC arithmetic. No `Date` local-time bugs: test across a DST change.

### A2. `content/pto_destination_fit.json` (data, Coby reviews)
Minimum sensible days off per destination, so a 4-day weekend never suggests Bali. Proposed starting values (Coby edits before merge):
- 3+ days: Tulum, Oaxaca, San Jose (Costa Rica), Antigua Guatemala, Guatemala City, Bogota.
- 5+ days: Lisbon, Madrid, Algarve, Mallorca, Amalfi Coast, Marrakech, Athens, Thessaloniki, Dubrovnik, Prague, Budapest, Krakow, Bucharest, Sofia/Borovets, Larnaca, Cusco, Rio de Janeiro.
- 7+ days: Buenos Aires, Cappadocia, Tbilisi, Baku, Petra, Luxor, Tokyo.
- 8+ days: Muscat, Taipei, Maldives.
- 9+ days: Cape Town, Phuket, Cebu, Da Nang, Ho Chi Minh City, Bali, Sydney.
Keys must match `sparkfare_destinations.json` exactly (test it). A test fails if a destination is missing from the table.

### A3. Routes (server-rendered; crawlers and AI assistants must see the content without JavaScript)
- `GET /time-off` : origin picker, the national table of 2026-2027 holidays and bridges, short method note. Indexable when the flag is on.
- `GET /time-off/<origin>` (15 US origins, lowercase IATA; others 404): title "Long weekends from <City>: 2026-2027", the bridge list, the default 10-day optimizer result rendered server-side, and per window the fitting destinations (fares come in Track B; until then each shows "Fares appear here as we see them" and "Watch this weekend" is hidden while `ENABLE_PTO_WATCH` is off).
- Query params `?budget=` (0-30) and `?h=` (holiday set, compact code) change the optimizer server-side and set `<link rel="canonical">` to the bare origin URL so variants are never indexed separately.
- Small inline script only for instant re-calculation when the budget or holiday toggles change (the same pure module, bundled or duplicated; test both give identical output). Framework-free, per CLAUDE.md.
- `GET /time-off/<origin>.ics` : the current plan (respects `budget` and `h`) as all-day VEVENTs. RFC 5545: CRLF line endings, line folding at 75 octets, stable `UID` (`<start>-<end>-<origin>@sparkfare.com`), `DTSTART;VALUE=DATE` / exclusive `DTEND;VALUE=DATE`, `SUMMARY` "Long weekend (request off: Fri Nov 12)", `DESCRIPTION` with the page URL and no fares (fares go stale; the link doesn't). `Content-Type: text/calendar; charset=utf-8`, `Content-Disposition: attachment`. Validate with a parser in tests.
- `GET /og/time-off/<origin>.png` : share card "10 PTO days, 31 days off from Denver (2027)" via the existing `/og/` renderer, brand colours from the style guide, no fares on the image.
- Page `<head>`: unique title and description per origin, `og:image` pointing at the card, canonical, no FAQ schema unless the page shows that FAQ text visibly.
- Mobile first: 375px, tap targets 44px or more, no horizontal overflow, shared nav and footer components.

### A4. Capture, links and events
- Email capture under the plan: reuse `/api/signup` with `source: 'pto'`, the page's origin preselected, `trip_length` defaulted from the longest planned block. Same consent text as the homepage; inspect it, don't copy-edit it.
- Each destination links to its route page (`/flight/<origin>/<dest>` or the `/data/` page, whichever is canonical today; check `tests/route_page_cta.test.js`). No Aviasales deep link on this page in Track A.
- "Before you go" link to `/leave` on each window, rendered only when `ENABLE_LEAVE_READY` is `"true"`.
- Events via `logEvent`: `pto_view` (origin), `pto_plan_change` (budget bucket 0-5/6-10/11-15/16+, holiday-set code; no free text), `pto_ics_download`, `pto_share` (channel), signup arrives with `source = 'pto'`. Bots classified by `src/botClass.js` are not counted.
- Weekly standup: add a "Time-off planner" line (views, .ics downloads, shares, `pto` signups) to `src/weeklyStandup.js`; missing table or zero shows as 0, never breaks the brief.
- `sitemap.xml`: add `/time-off` and the 15 origin pages only when the flag is on (follow how the digest archive gates its sitemap entries).
- `privacy.html`: no new personal data in Track A; confirm the events list on that page already covers anonymous page events. If not, add one sentence.

### A5. Tests (`tests/pto_calendar.test.js`, `tests/pto_routes.test.js`)
Holiday dates for 2026-2028 against the Track 0 table; observed-date rules (Sat to Fri, Sun to Mon, New Year's on Saturday); bridges for a Thursday holiday (Fri off gives 4 days), Tuesday holiday (Mon off gives 4), Wednesday holiday (2 PTO for 5); optimizer never exceeds budget, never overlaps, deterministic, budget 0 returns only free long weekends; destination fit (4 days never returns a 9+ destination; every destination is in the table); flag off returns 404 for every path; flag on returns 200 for each US origin and 404 for TLV and junk; canonical ignores query params; .ics parses and has stable UIDs; share image route returns `image/png`; `npm run check:copy` scan of the rendered page; no horizontal overflow at 375px (follow `tests/homepage_mobile_ui.test.js`). Mutation check as usual: break the observed-date rule, the budget cap, the overlap check; each must fail a test.

**Done when:** flag-on preview works end to end for all 15 US origins; flag-off production is unchanged; tests and copy check pass; Track 0 findings are in the PR. Size: 3 to 4 days.

## Track B: real fares for each window (build now; merge Oct 20)

Flag: `ENABLE_PTO_FARES` (default `"false"`). Off: Track A renders exactly as before.

### B1. Fetch script and workflow
- `Phase 21 PTO Window Fetch.py` (name it to match the repo's phase-script convention; confirm the next phase number). Reuses the existing fetch script's helpers where possible (`build_aviasales_link`, error handling that never overwrites good data on `None`).
- Scope per run: 15 US origins x windows starting in the next 120 days (about 4 to 6 at any time) x up to 8 fitting destinations per window, chosen by A2's table and, where history exists, the route's recent median price ascending. Hard cap: 800 calls per run. 2-second spacing. Uses the endpoint and fallback chosen in Track 0.
- Output `sparkfare_pto_window_prices.json`: `{ generated_at, windows: { "<origin>:<start>:<end>": [ { destination, price, departure_at, return_at, found_at, booking_link } ] } }`, plus a per-window `observations` list (date, lowest price) so dealQuality can judge a window once it has enough history. Keep 60 days of observations per window; drop windows 30 days after they end.
- Workflow `.github/workflows/pto-window-fetch.yml`: daily at an off-peak minute (proposed `47 4 * * *`, after the 03:17 daily fetch, before the 07:00 digest), same token, same commit-and-push pattern as `daily-compile-other-origins.yml`, concurrency group shared with the other fetch workflows so they never overlap. `workflow_dispatch` enabled. Add it to `tests/workflow_schedules.test.js`.
- Rate check: the hourly fetch already uses about 600 calls an hour at 2-second spacing, far under the confirmed 300 per minute. Confirm the combined peak in the PR.

### B2. Display (only when `ENABLE_PTO_FARES` is `"true"`)
- Per destination on a window: "From $412, seen <date> for these dates" with a fare link through the existing outbound route (`/out/...` or whatever the homepage uses today, with `src=pto` so `outbound_click` attributes it). `rel="sponsored nofollow noopener noreferrer"` and the standard inline disclosure, as on the homepage.
- A fare older than 3 days shows as "last seen <date>" without a link. No fare: "No fare seen yet for these dates" and the watch button (Track C).
- No badges, percentages, "deal" labels or predictions on window fares in v1 (rule 8). If later the window history meets the existing dealQuality threshold, a follow-up PR may reuse `src/dealQuality.js`; not in this spec.
- Show the pipeline's freshness on the page ("Prices checked daily; last check <time>").

### B3. Tests
Script: parses the endpoint response, handles empty and error responses without wiping stored data, respects the cap, drops expired windows (pytest or the repo's existing Python test pattern; check what exists). Worker: flag off shows no prices; stale fare has no link; link carries `src=pto` and the right `rel`; disclosure present; banned phrases absent.

**Done when:** the workflow has run via `workflow_dispatch` on the branch (Coby approves the run), the JSON has the expected shape, the preview page shows real fares where they exist and honest empty states elsewhere. Size: 2 to 3 days.

## Track C: "Watch this weekend" (code now; migration Oct 21; merge after migration)

Flag: `ENABLE_PTO_WATCH` (default `"false"`). Off: no watch buttons, routes 404.

### C1. Migration `migrations/0019_pto_window_watches.sql`
```sql
CREATE TABLE IF NOT EXISTS pto_window_watches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  origin_iata TEXT NOT NULL,
  window_start TEXT NOT NULL,   -- YYYY-MM-DD
  window_end TEXT NOT NULL,     -- YYYY-MM-DD
  destination TEXT,             -- NULL = any fitting destination
  last_alert_price INTEGER,
  last_alerted_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pto_watch_unique ON pto_window_watches(user_id, origin_iata, window_start, window_end, destination);
CREATE INDEX IF NOT EXISTS idx_pto_watch_window_end ON pto_window_watches(window_end);
-- Rollback: DROP TABLE pto_window_watches; (no other table references it)
```
Coby applies it with `npm run migrate` (Wrangler 7403 errors are intermittent; retry) and records it in `d1_migrations`. Add `tests/pto_watch_migration.test.js` like the 0016/0017 migration tests. Also add the table to the user-deletion loop that already covers `trips`, `watchlists`, `push_subscriptions`, `events` (`src/index.js` ~2407).

### C2. Create and cancel
- `POST /api/pto-watch` : body `{ email, origin_iata, window_start, window_end, destination? }`. Creates or reuses the user through the same code path `/api/signup` uses (with `source: 'pto'`, same consent); validates the window against `bridgeOpportunities` (a watch can only be for a real window), the origin against US `VALID_ORIGINS`, the destination against A2's table. Limit 10 active watches per user. Idempotent on the unique index. Logs `pto_watch_create`. Bot requests ignored.
- Signed cancel link per watch: `signPtoWatchToken(watchId, secret)` with a domain prefix (same HMAC pattern as `signUnsubscribeToken`, so no other token type validates). `GET /api/pto-watch/cancel?token=` shows a confirm page; `POST` deletes the row. A GET never changes state.
- No account needed. Signed-in users see their watches on `/watchlists` in a separate "Long-weekend watches" list (read-only list plus cancel), only when the flag is on.

### C3. Checker (no new cron)
- `checkPtoWindowWatches(env)` runs in the existing 08:00 UTC Worker cron, after the daily digest, failure-isolated (a throw is caught and logged; the digest and other jobs never depend on it).
- For each watch with `window_end` in the future: lowest current fare for that window (and destination, if set) from `sparkfare_pto_window_prices.json`. Email only if there is a fare no older than 3 days and it is lower than `last_alert_price` by at least max($15, 5%), or it is the first fare seen. At most one PTO email per user per day (combine watches into one email). Respect `email_suppressions`, sunset status and unsubscribe. Update `last_alert_price` / `last_alerted_at`.
- Email (`sendPtoWindowEmail` in `src/email.js`, built from the existing templates and helpers): subject "Fare for your Nov 12-15 long weekend from Denver: $412". Body: window, destination, price, "seen <date>", fare link with `src=pto_email`, standard disclosure first, the cancel link, the signed unsubscribe link and `List-Unsubscribe` headers exactly as the digest does. Preview with `scripts/preview-email.mjs` and attach to the PR.
- Housekeeping in the same run: delete watches whose `window_end` is more than 30 days past (rule 9).
- Events: `pto_watch_alert_sent`, `pto_watch_cancelled`.
- `privacy.html`: add one sentence: Sparkfare stores the travel window you ask it to watch, uses it only to email you about fares for it, and deletes it 30 days after the window ends. Update before the flag goes on.

### C4. Tests
Window validation; duplicate watch is idempotent; 11th watch refused; token round trip, tamper, wrong domain; GET cancel changes nothing; threshold logic (first fare, small drop ignored, real drop sends, stale fare ignored); one email per user per day; suppressed and sunset users skipped; checker throwing does not stop the digest; expired watches deleted; flag off returns 404 and hides buttons; user deletion removes watches.

**Done when:** with the flag on in a test environment, creating a watch, a simulated price drop and the 08:00 run produce exactly one correct email and a working cancel. Size: 3 to 4 days.

## Track D: distribution wiring (merges with the existing plan)

Each item is small and separately flagged or owner-run. Draft everything now; publish from Oct 20.

1. **Digest promo block** (`ENABLE_PTO_DIGEST_BLOCK`, default off): one line under the deals in the daily and weekly email for that subscriber's origin: "Next long weekend from Denver: Nov 26-29. See your time-off plan." Link `/time-off/<origin>?src=digest`. Only when `ENABLE_PTO_CALENDAR` is on. Check it does not change digest skip-if-unchanged logic.
2. **Social posts:** extend the existing broadcaster (`Phase 3 Social Broadcaster.py`, `daily-social-post.yml`) with a weekly "Next long weekend from <city>" post using the share card. Behind its existing flag; Coby approves the first live post.
3. **Pinterest:** if `ENABLE_PINTEREST` is on and a token is connected (check `pinterest_tokens`), a manual admin route `POST /admin/pinterest/pto-pins` (admin Bearer secret, `?dry=1`) that creates one pin per US origin from the share card, linking to `/time-off/<origin>?src=pinterest`, on a "Long weekends 2027" board. Run by hand, at most 15 pins at a time, refreshed monthly. No bulk or automated posting in v1 (Pinterest penalises low-effort volume).
4. **Press note (feeds roadmap step 54, Honest Deal Report):** generate `content/pto_press_2027.md` from the Track A data: the best 2027 bridges nationally, plus the share of 2027 windows from each hub where Sparkfare has seen a fare (only once Track B has a week of data). Coby sends it; nothing is emailed automatically.
5. **Blog post:** "How we built the 2027 long-weekend calendar" on the shared blog template (pattern: `blog/how-we-rank-deals.html`): the holiday rules, why the default holiday set, why fares show "as of", link to `/time-off`. In `blog/index.html` and `sitemap.xml` only when the calendar flag is on.
6. **Homepage and nav:** one nav item "Time off" and one line on the homepage under the board, only when `ENABLE_PTO_CALENDAR` is on. Check `tests/mobile_nav_fixes.test.js` and the 44px tap-target tests.
7. **Later, not in this spec:** a City Desk embed of the calendar for local publishers (extends step 33's widget and `widget_rate_limits`; design after the calendar has a month of data), and an HR-platform co-branded version (B2B, owner-led, step 68).

## Measurement and stop rules (agreed before launch, read from the weekly standup)

- Week 2 after flag on: if `/time-off` views are under 100 a week with Track D items 1 and 2 live, stop adding features and check indexing (Search Console coverage, the sitemap) before anything else.
- Signup rate from `source = 'pto'` per page view is compared with the homepage's. If it is under half the homepage's after 500 views, change the capture placement before building more.
- If over 80% of windows within 60 days still show no fare after 7 days of Track B data, switch to the Track 0 fallback wording (2-day flexibility) by default.
- Any spam-complaint signal on PTO watch emails above 0.1%: switch `ENABLE_PTO_WATCH` off and review.

## Explicitly out of scope

Non-US holiday calendars (TLV is a test origin only); school calendars; storing anyone's PTO budget or holiday choices server-side; percentages or deal badges on window fares; price predictions; a native app; SMS; automated Pinterest volume posting; the City Desk embed and HR co-brand (later); changing the existing Watchlists feature.

## PR plan and rough size (estimates, plus or minus 50%)

1. Track A PR (A1 to A5): 3 to 4 days. Open by Oct 15 with the preview URL.
2. Track B PR (script, workflow, display): 2 to 3 days. Dry run (Track 0 step 6) first.
3. Migration 0019 PR alone: under an hour. Merge first, after Coby applies it.
4. Track C code PR: 3 to 4 days.
5. Track D: one small PR per item, half a day each.
6. Docs-only roadmap PR (below).

## Owner actions (Coby)

- Approve this spec; review A2's destination table (10 minutes).
- Approve the Track 0 dry run (uses Travelpayouts quota) and read its hit-rate result.
- After the Oct 16 go: approve merges per the timing table; flip flags after checking production.
- Apply migration 0019 to production before the Track C merge.
- Approve the first social post; connect Pinterest if not yet done; send the press note.

## Docs-only roadmap diff (separate small PR, per the maintenance process)

Verify the next free step numbers first (highest seen on 2026-10-09 was 71). Phase 2 window (Oct 18-31), pulled forward from Phase 3 because the 2027 planning season peaks Nov-Jan:
- 72: PTO calendar, Track A (`/time-off`, optimizer, .ics, share card; `ENABLE_PTO_CALENDAR`). Not started. Depends: Oct 16 go.
- 73: PTO window fares, Track B (`Phase 21` script, `pto-window-fetch.yml`, `ENABLE_PTO_FARES`). Not started. Depends: 72, Track 0 dry run.
- 74: Long-weekend watches, Track C (migration `0019`, `ENABLE_PTO_WATCH`). Not started. Depends: 73, `0019` applied in production.
- 75: PTO distribution, Track D (digest block, social, Pinterest pins, press note, blog post, nav). Not started. Depends: 72. Feeds 54.
- Note on 54 (Honest Deal Report): the PTO press note is its first data-led release candidate.
- Note on 56 ("vs" comparison pages): separate spec; the Going-free-tier comparison (Going's Limited plan has no international deals) is its first page.

Decision-log lines to append (DECISION 2026-10-09): build the PTO-Maxxed Fare Calendar as the lead seasonal acquisition play; US origins only (TLV is a testing origin, not part of the commercial play); fares shown "as of" with no badges until window history meets dealQuality; window watches need only an email and are deleted 30 days after the window; nothing merges before the Oct 16 go/no-go; stop rules as listed in this spec.
