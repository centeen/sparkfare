# Addendum P, P0 report (read-only), 2026-10-26

Written by Claude Code against `main` (`src/ptoCalendar.js` last changed in `143435db`, 2026-10-09; `src/ptoPages.js` in `bab8f081`, 2026-10-24) and production (fetched 2026-10-26). No code was changed. Reproductions were run two ways: against the code (`node`, `now` = 2026-10-26) and against the live pages (`/time-off`, `/time-off/embed`, `/time-off/sea`, `/time-off/ord`, `/time-off/mia`).

## Summary

1. **All four defects reproduce on production, and all four are in shared code**, so one fix in `src/ptoCalendar.js` plus one shared row renderer in `src/ptoPages.js` changes `/time-off`, every airport page and `/time-off/embed` together.
2. **The observed holiday dates are correct** (OPM rule: Saturday to the Friday before, Sunday to the Monday after; Jan 1, 2028 is correctly observed on Fri Dec 31, 2027). The defects are **range clipping** (items 135 and 136) and **de-duplication** (item 134), plus one wrong sentence (item 137). So P1's observed-date tests should pass on the current dates and fail only on the block logic.
3. **There is no event called "plan start" today.** `pto_view` is the nearest, and `/time-off` already logs it with `source: 'index'`. P2 needs a decision on what "plan start" means (section 6).
4. **No date ever appears in a shareable URL.** Share links carry only `?budget=N&h=<holiday-set code>`. The `.ics` file contains the plan's calendar dates (public holiday windows derived from the budget and holiday set, not anything the visitor typed).
5. **The homepage stores the airport in `localStorage` under `sparkfare_selected_origin`**, so the P2 prefill needs no cookie or server lookup.

## 1. Where the pages are generated

| Page | Route (src/index.js) | Renderer (src/ptoPages.js) |
|---|---|---|
| `/time-off` | `handleTimeOff`, line 5424: logs `pto_view` with `source: 'index'` | `renderTimeOffIndex`, line 254 |
| `/time-off/{iata}` | same handler, from line 5437 (regex `^/time-off/([a-z]{3})(\.ics)?$`, 22 hubs via `isPtoOrigin`) | `renderTimeOffOrigin`, line 527 |
| `/time-off/{iata}.ics` | same handler, line 5461 | `buildIcs`, `src/ptoCalendar.js` |
| `/time-off/embed` | same handler, line 5428 (`Cache-Control: public, max-age=3600`) | `renderTimeOffEmbed`, line 347 |
| share card | `handleTimeOffOg`, line 5356 (`/og/time-off/{iata}.png`, per airport only) | `ptoOgHtml` |

**Do the tables share one bridge function? Yes for the maths, no for the rows.** Every page calls the same three pure functions in `src/ptoCalendar.js`: `holidaysInRange` (line 114), `bridgeOpportunities` (line 136) and `summarizeByHoliday` (line 258), and the planner also calls `optimize`/`buildPlan`. What is copied is the **row renderer**: the same ~8 lines (options joined, fallback text, holiday label) appear **four times** (`renderTimeOffIndex` twice, lines 258-263 and 268-275; `renderTimeOffEmbed` line 354; `renderTimeOffOrigin` line 549), each ending in the same `|| '<span class="muted">No long weekend with 3 or fewer PTO days.</span>'`. What differs between "the two tables" on `/time-off` is only the date range passed in:

- **"All holiday bridges through 2027"** (line 304): `from` = today (2026-10-26), `to` = `PTO_LAST_DAY` = `2027-12-31`.
- **"2027 long weekends"** (line 287): `from` = `2027-01-01`, `to` = `2027-12-31`.
- `/time-off/embed` uses the second range; airport pages use the first.

## 2. The four issues: reproduced, with the causing line

| Item | Live (Oct 26) | Cause |
|---|---|---|
| **134** Day after Thanksgiving has its own "No long weekend…" row | Yes, in both `/time-off` tables and the embed (2026 and 2027 rows) | `summarizeByHoliday` (line 258) gives every holiday its own row and keeps a `used` set (line 259, check at line 269) so a block is never repeated. The day after Thanksgiving sits inside the Thanksgiving block (Thu to Sun), so every block it could show was already given to Thanksgiving, its option list is empty, and the renderer prints the fallback (lines 262, 274, 354, 549) |
| **135** New Year's Day, Fri Dec 31, 2027 says no long weekend | Yes, in both tables, the embed and the airport pages | The date is right (observed Fri Dec 31, 2027). `bridgeOpportunities` line 146, `if (start < from || end > to) continue;`, drops every block that ends after `to` = `2027-12-31`; the free block runs Dec 31 to Jan 2, 2028, so it is dropped and nothing is left |
| **136** Jan 1, 2027 differs between the two tables | Yes: "All holiday bridges" offers "Take Thu Dec 31 off, get 4 days (Dec 31 to Jan 3)"; "2027 long weekends" offers "Take Mon Jan 4 off, get 4 days (Jan 1 to Jan 4)" | Same line 146, on the other side: the 2027 table's `from` = `2027-01-01`, so a block may not start on Dec 31, 2026. In the first table both blocks exist and tie at 4 days, and `summarizeByHoliday` keeps one per PTO count by earliest start (`a.start < b.start ? -1 : 1`, line 266), so it shows only the Thursday option |
| **137** "standard federal holiday schedule" | Yes, in the 2027 table's subtitle (line 287) | Wording only. The table is built from `COMMON_HOLIDAY_SET` (seven holidays, one of which, the day after Thanksgiving, is not federal) |

Also confirmed: **the year-end defect reaches the airport planner.** The optimizer cannot choose the Dec 31, 2027 to Jan 2, 2028 block, and the plan strip ends at `PTO_LAST_DAY`.

Observed dates for the default set, 2026 to 2028, all match OPM: Independence Day 2026 Fri Jul 3; Thanksgiving 2026 Nov 26; Christmas 2026 Fri Dec 25; Jan 1, 2027 Fri; Independence Day 2027 observed Mon Jul 5; Thanksgiving 2027 Nov 25; Christmas 2027 observed Fri Dec 24; New Year's Day 2028 observed Fri Dec 31, 2027.

### Proposed fixes (for P1; the Addendum's required results are unchanged)

- **134:** make `summarizeByHoliday` fold a holiday whose observed day is inside another listed holiday's block into that holiday's row (the day after Thanksgiving into Thanksgiving) and omit its own row, with one note on the Thanksgiving row ("Includes the day after Thanksgiving when your employer gives it"). The airport-page toggle still decides whether the day is a holiday; with it off, nothing changes for the block logic.
- **135 and 136:** separate **which holidays are listed** (observed day in `[from, to]`) from **where a block may reach** (a block that contains a listed holiday may extend up to `REACH` = 7 days either side of the range). The planner keeps its "nothing before today" rule through a separate earliest-start argument; the year tables do not apply it. That gives the Dec 31, 2027 holiday its Dec 31 to Jan 2 block and gives Jan 1, 2027 both its Thursday and its Monday options in both tables. Where two options tie, show both.
- **137:** the Addendum's wording, in the one table (and the same wording check on the embed's copy: its sentence already says "Holiday dates follow official US federal calendar (OPM) rules", which is true).
- **One row renderer** for the four places, so a fourth copy cannot drift again.
- **Tests:** observed dates for the default set Nov 2026 to Dec 2027 (they pass today), the year-boundary blocks, and "the two tables and the airport planner return identical options for the same holiday set", which fails today on Jan 1, 2027.

Existing tests to extend, not replace: `tests/pto_calendar.test.js`, `tests/pto_routes.test.js`, `tests/m4_pto_2027.test.js`, `tests/k_b5_time_off.test.js`.

## 3. Window-fare flag

`ENABLE_PTO_FARES` is `"false"` in `wrangler.jsonc` on `main`. Production agrees: the airport pages (SEA, ORD, MIA) show the "fares appear here as we see them" state, and the Worker only reads the fares file when the variable is exactly `"true"`. `ENABLE_PTO_CALENDAR` and `ENABLE_PTO_WATCH` are `"true"`; `ENABLE_PTO_DIGEST_BLOCK` is `"false"`.

## 4. How the homepage stores the selected origin

`localStorage`, key **`sparkfare_selected_origin`** (`ORIGIN_STORAGE_KEY`, `index.html` line 961), written by `setSelectedOrigin` and read by `getSelectedOrigin` (line 1017), both inside try/catch. The airport code is also accepted from a URL parameter `?origin=XXX` on the homepage (`presetSignupOrigin`), which then writes the same key. No cookie, nothing server-side. The value is a three-letter code from the origin selector (22 hubs plus TLV). **TLV is not a `/time-off` airport**, so the prefill must ignore any code that is not in `PTO_ORIGINS`.

## 5. What the share card, share link and `.ics` carry

- **Share link** (`planUrl`, `src/ptoPages.js` line 44): `/time-off/{iata}` with `?budget=N&h=<base-36 holiday-set code>` only when it differs from the defaults. **No dates**, no email, no user id.
- **Share card image** (`/og/time-off/{iata}.png`): the airport's city, PTO days used and days off for the default budget; never a fare. Per airport only: **a national card does not exist**, so the no-airport `/time-off` needs one if it is to be shareable.
- **`.ics`** (`/time-off/{iata}.ics?budget=&h=`): one all-day event per window in the plan (`DTSTART`/`DTEND` dates, a summary such as "Long weekend (request off: Fri Nov 27)", the page URL), and the calendar name "Sparkfare long weekends from {city}". The dates are the public holiday windows the budget and holiday set produce. They are **in the downloaded file, not in any URL**, so Priya's own dates are never public. **The route is per airport** (`/time-off/{iata}.ics`), so `/time-off` needs a new national route for its export.

## 6. Events and tags on the airport pages

| What | Where it fires | Fields |
|---|---|---|
| `pto_view` | server, every GET of `/time-off` and `/time-off/{iata}` (bots skipped by `ptoLog`) | `/time-off`: `source: 'index'`. Airport: `origin`, `source` = the `?src=` value or null |
| `pto_plan_change` | server, airport pages only, when `?budget=` or `?h=` is present | `origin`, `meta { budget_bucket (0-5, 6-10, 11-15, 16+), h }` |
| `pto_ics_download` | server, on the `.ics` route | `origin` |
| `pto_share` | browser beacon to `/api/events` (allowlisted) | `origin`, `source: 'pto'`, `meta.channel` (native or copy) |
| `pto_signup` and the signup tag | server, when `/api/signup` receives `source: 'pto'` (the airport page's alert form posts it with the trip-length bucket of the plan's longest block) | `signup_source = 'pto'` |

**There is no event named "plan start".** The Addendum asks to "fire the existing plan-start event on `/time-off` as well, with a surface value that distinguishes it". Two readings:

- **(a) `pto_view` is the plan start.** It already fires on `/time-off` with `source: 'index'`, which already distinguishes it from airport pages. Nothing to add. It counts views, not people who set a budget.
- **(b) A plan started = the first budget or holiday change.** That is `pto_plan_change`, which today fires only on airport pages via the URL. On a no-airport `/time-off` it would fire when the visitor first changes the budget or a toggle, with `meta.surface: 'index'`. This measures what the kill signal in D-048 talks about ("plan starts per 100 views"), so I recommend (b), keeping (a) as it is. The surface value would be `index`, matching what `pto_view` already uses, and no new `signup_source` value is needed (`pto` stays).

## 7. Design notes and risks for P2 (not decisions)

- **The planner is server-rendered.** Airport pages use a plain GET form (`budget`, holiday boxes) that redirects to a canonical `?budget=&h=` URL; there is almost no client script. The simplest way to satisfy "choosing an airport keeps the plan" is to carry the airport as one more query parameter (`/time-off?budget=8&h=...&from=SEA`): an airport code is not a date, and the page stays working without JavaScript. A fragment fetch that swaps the destinations in place is possible later as an enhancement. The Addendum's "loads destinations without resetting" is met by either, so I propose the URL approach for the first PR.
- **`/time-off` needs three things it does not have:** the planner and window cards without an origin (destinations are built per origin in `blockHtml`, line 506, and need an "airport not chosen yet" state); a national `.ics` route; and a national share card. Share and `.ics` for the no-airport page could ship after the plan itself if time is short; the Addendum lists them, so tell me if you want them cut to a later PR.
- **Query variants must stay out of the index.** `/time-off?budget=` or `?from=` variants should return `noindex, follow` with the canonical `/time-off`, as airport pages already do for `hasVariant`. The airport pages' own URLs, titles, canonicals and robots must not change.
- **Embed:** `/time-off/embed` is cached for an hour and may already be embedded elsewhere; P1 changes its rows (Day after Thanksgiving folded in, Dec 31, 2027 filled) and P2 should not touch it.
- **Schedule:** P1 is due Fri Oct 30 and P2 Wed Nov 4, on top of Addendum N, M1 and Addendum O. P1 is small (one function, one renderer, tests). P2 is the larger one; the cut rule applies.

## What I need from you before P1 and P2

1. **Plan-start event:** (a), (b) as recommended, or something else.
2. **P2 mechanism:** the URL approach (`&from=SEA`) first, with the in-place fragment as a later enhancement?
3. **P2 scope:** include the national `.ics` and the national share card in the first PR, or ship the plan and the airport chooser first and add those next?
4. **P1 note wording:** "Includes the day after Thanksgiving when your employer gives it" is my wording of the Addendum's "one short note: it is included when the employer gives it". Say if the Hub wants exact text.
