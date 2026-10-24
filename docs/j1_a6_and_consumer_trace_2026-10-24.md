# J1 A6 (time zones) and the shared deal function's consumers: re-trace (2026-10-24)

Read-only. Code at `main` after PR 364; data files generated 2026-10-24 (JFK 08:05 UTC, other origins 11:47 UTC).

## A6: does every "Prices as of" have a zone?

| Surface | Source | Zone | Relative age |
|---|---|---|---|
| Homepage board and hero | `index.html` `asOfText` | The **visitor's own zone**, name printed (`timeZoneName: 'short'`). Checked for six zones: EDT, PDT, CDT, GMT+1, GMT+3, GMT+11. | Yes ("3 days ago") |
| Route pages `/flight/...` | `src/priceFreshness.js` `fareNote(..., 'UTC')` | UTC, printed | Yes |
| pSEO `/data/*` pages | `Phase 17 pSEO Generator` `asof_text` | UTC, printed | No (static page; shows the fetch time) |
| Daily digest and archive | `src/emailTemplates/helpers.js` `formatAsOf` | UTC, printed ("Oct 24, 11:47 UTC") | No (an email cannot age) |
| Watchlist alert email | same `formatAsOf` | UTC, printed | No |
| Sunday newsletter | `src/email.js` (newsletter body) | **No as-of line at all**; only "Prices update daily and may change." | No |
| Holiday report, PTO pages | own templates | UTC / date only | n/a |

Result on today's data: the homepage shows 342 "Checked ..." lines, 23 "Last seen <date and time zone>. No newer price today..." lines and 19 "Last seen <date>." lines. All timed lines carry a zone. No row is in the "Prices as of" state today.

**There is no single site-wide zone.** The rule as shipped (PR #293, J0 recommendation) is: the visitor's own zone in the browser, UTC wherever the server or an email prints the time. Both always print the zone name. The original A6 text asked for one zone site-wide; that was never chosen. This is a decision for the owner, not a defect.

### Gaps found
1. **Edge-case bug, homepage and route pages:** a price that has no `found_at` but has a `last_fresh_date`, and is not a carried-forward fallback, renders "Prices as of Oct 23 · 20750 days ago": no zone, and a nonsense age (it is measured from 1970). **No real row hits it today** (0 priced rows lack `found_at`), so it is latent. Fix: treat a missing `found_at` as "Last seen <date>." in both `index.html` and `src/priceFreshness.js`.
2. **Newsletter** prints a price with no time of any kind.
3. **Digest fallback:** when a deal has no `found_at` the as-of text falls back to the raw `last_fresh_date` string ("2026-10-17"), with no zone.

## Which consumers does the shared deal function change?

Two copies of the rule exist and are kept in step by hand: `deal_quality()` in `Phase 1 Deal Ranking Script (Step 9 - with fallback).py` (decides what lands in the `deals` bucket and `status`) and `dealQuality()` in `src/dealQuality.js` (re-run at read time). J1-data (#292) changed both: 15% floor, distinct observation days, carried-forward prices never deals, fares departing within 48 h dropped at selection.

| Consumer | How it picks deals | Gets the J1 rules? | Render-time departure/lapse guard? |
|---|---|---|---|
| Homepage board, hero | `deals` bucket from the Python | Yes | **Yes** (`prepareBoard`) |
| Route pages `/flight/...` | `findRouteRecord` + `freshnessState` | Yes | **Yes** (Worker `priceFreshness.js`) |
| pSEO `/data/*` | file at build | Yes | Yes at build (regenerated daily; a page can age between runs) |
| Daily digest and public archive | `deals` + `featured`, then `applyDealQualityFilter` (72 h staleness, history rule) | Yes via the Python file; the filter itself checks eligibility, not the 15% floor | **No** |
| Sunday newsletter | `deals` bucket only, top 3 by percent below median | Yes via the Python file | **No**, and no freshness check on the file |
| Social post (`Phase 3 Social Broadcaster`) | `status == 'deal'` | Yes via the Python file | **No** |
| Pinterest pin | `status` and `dealQuality()` in JS | Yes | No |
| `/deal/...` permalink and OG card | `status === 'deal'` and the departure date matches | Yes via the Python file | **No** |
| `/check` | `dealQuality()` on the visitor's price (history only) | Yes (floor, MAD, distinct days) | n/a |
| Watchlists, retrospectives, target-price emails | price only, `targetFareFreshness` (72 h) | Not deal-based | Freshness only |
| Sparkfare Index (above-median list) | `median_baseline` | Not deal-based | No |

### What this means in practice
- Today nothing slips through: every deal and featured row departs at least 153 hours from now, and `deals` rows are at most 4 hours old.
- The unguarded consumers (digest, newsletter, social, Pinterest, permalinks) rely on the compile step having dropped near and past departures. That holds as long as the data refreshes daily. If a pipeline run is missed for 1 to 2 days, a fare can pass the 48-hour departure line before anything notices, because only the homepage and route pages re-check. The digest's own 72-hour staleness limit bounds it, but the newsletter and social post have no such limit.
- Of the 99 featured rows in the other-origins file, 9 are older than 72 hours and 18 are flagged carried-forward. The digest filter drops them; the homepage shows them as "Last seen". They are not deals.

### Suggested follow-up (small, optional)
Add `departsTooSoon` and the lapse test to `applyDealQualityFilter` (digest and archive), the newsletter and social selection, and the permalink check, reusing `src/priceFreshness.js`. Fix gap 1 above. Add an as-of line, with its zone, to the newsletter.
