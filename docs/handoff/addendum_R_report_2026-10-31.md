# Addendum R, R0: read-only report (2026-10-30)

Roadmap step 181. Read-only: no Aviasales call, no `/out` request, no email, no post, no flag or data change. Written on branch `docs/build-state-2026-10-30` against `origin/main` at `0707e070`. **Stopping here for the owner**, as the addendum asks.

## Short version

1. **The data cannot tell us whether a fare reproduces on Aviasales.** We store one ticket per route (the cheapest the Travelpayouts cache returned), never the other airlines' cached fares and never the return carrier. So rule (b) (compare with other cached fares for the same dates) cannot be computed from anything we keep.
2. **`found_at` is when Sparkfare asked the cache, not when the fare was seen.** The cache itself is described in our own fetch script as the "48hr cache". "Checked N h ago" therefore overstates freshness. This supports R1.
3. **The history is thinner than its point count.** Daily "observations" often repeat the same price for 4 to 13 days in a row (EWR to Budapest: 691 for 7 days, then 667 for 8). That looks like the same cached ticket being re-served, not independent daily checks. The 30-day median and the "10 distinct observation days" floor (D-021) count each repeat as a day.
4. **No simple data-only rule would have caught EWR to Budapest.** Rules (a) catch 0 of 22 deals. A blunt version of (a) catches 14 of 22, which is most of the board, so it is not a usable tolerance.
5. **No live price source is documented in this repo.** Item 6 is answered from what the repo says and is marked unverified; it needs a read of Travelpayouts' own pages, which I did not do.

## 1. Raw records

Source files and commits: `sparkfare_ranked_deals.json` (JFK daily, `generated_at` 2026-10-29T09:55Z), `sparkfare_ranked_deals_other_origins.json` (`generated_at` 2026-10-30T03:16Z), and `sparkfare_hourly_ranked_deals.json` (same time, used only to find EWR to Budapest). All three are at `origin/main` `0707e070` (last data commit touching them: `086ef481`). Scope: every record in `deals` of the two served files, TLV excluded, 22 rows (5 JFK, 17 other origins). The full CSV is `docs/handoff/addendum_R_r0_deals_2026-10-30.csv` (columns: file, route_key, price, airline, departure_at, return_at, found_at, expires_at, history_points, last5_price_history, median_baseline, basis_text, status, booking_link). The last row of each block is EWR to Budapest as it appears in the served and hourly files.

EWR to Budapest, from the hourly and other-origins files: **$478, airline `LX`, outbound flight number 19, departs 2026-12-14T22:00-05:00, returns 2027-01-26T09:40+01:00, one stop (`sequence` "1"), `found_at` 2026-10-30T02:42Z, `expires_at` 03:54Z.** Link: `https://www.aviasales.com/search/EWR1412BUD26011?marker=314524` (Dec 14 out, Jan 26 back, passenger suffix `1`). Last 31 daily lows: 566, 691 x7, 713, 667 x8, 698 x2, 684 x4, 659 x2, 461 x2, 514, 478 x3. So the low level has held for three observations at $478 and the big drop (659 to 461) happened five observations ago.

## 2. What the fields mean

- **`found_at`**: `Phase 1 Flight Fetch Script (Step 8).py` sets `fetched_at = started_at.isoformat()` once per run (line 180) and writes it onto every route it stores (lines 205, 215). The ranking script copies it to `found_at`. It is **the time of our request**, one value per run for the daily JFK file (2 distinct values in the 2026-10-29 file) and one per route for the hourly pipeline (25 to 26 distinct values). It is never the time the fare was observed by an airline or agency.
- **How old can a fare be?** The same script says a route "may be thin in the 48hr cache" (in `fetch_cheapest_tickets`). The endpoint is `/v1/prices/cheap`, a cache. That is consistent with the repeated prices in section 4 below. I did not measure the cache age; the repo has no field for it.
- **`expires_at`**: passed straight through from Travelpayouts' ticket (`ticket.get("expires_at")`, fetch script line 125). In the deals file it sits 60 to 61 minutes after `found_at`. Nothing uses it any more: `src/dealQuality.js` (2026-09-25 fix, lines ~48 to 61) deliberately ignores it. I do not recommend reviving it.

## 3. Every surface that prints a fare, a Deal, "% below", "$ under" or a freshness line

"Wording" is what each surface says today about age. B = built at build/regeneration time, R = at request time, S = at send/post time. None of the code below is known to be undeployed (main only; this session cannot read production). Item 81 history (main-but-not-deployed) needs the owner's deploy check.

| Surface | File and line | Wording today | When |
|---|---|---|---|
| Homepage ticket and hero freshness line | `index.html` 1266 to 1273 | "Checked N h ago · time zone", "Last seen ...", "Prices as of ..." | R (browser) |
| Homepage chip, "% below", "$ under" | `index.html` 1323 to 1345 | chip label, basis line from `basis_text` | R (browser) |
| `/flight/` route page price note | `src/priceFreshness.js` 82 to 90; `src/index.js` ~5773 | same three wordings; page footer "Fare data retrieved {date}. Prices may change." | R |
| pSEO `/data/` pages (880) | `Phase 17 pSEO Generator (Step 106).py` 197 to 211 | "Checked {time}." / "Prices as of ..." / "Last seen ..." | B (daily regeneration) |
| Interstitial `/departing` | `src/referralCopy.js` 21 to 22, `src/interstitial.js` | "Check this fare" / "Continue to Aviasales ↗"; no price shown | R |
| `/check` verdict | `src/priceCheck.js`, `check.html` 50, 270 | median, % and Deal definition; note from `found_at` | R |
| Daily digest (v1 and v2) and archive | `src/emailTemplates/dailyDigest.js` 255, 292, 447; `src/email.js` | "Fare data retrieved {as-of}." plus "The fare itself may be older, and fares change fast." (plain text only) | S, and B for archive pages |
| Watch-hit, long-weekend and PTO watch emails | `src/email.js` 1451 to 1494, 1463, 2054 | "Fare data retrieved ..." / "lowest fare in search data retrieved {date}" | S |
| Welcome card, lifecycle and trip emails | `src/email.js` ~2163 to 2165, `src/welcome.js`, `src/lifecycleV2.js` | "Fare data retrieved {as-of}." | S |
| X/Bluesky post text | `src/index.js` `buildXPostText` (883 to 888) | "{origin} to {dest}: $N round trip -- N% below its 30-day median." | S |
| Daily social post and image | `Phase 3 Social Broadcaster.py` 91, 176 to 230 | text with `basis_text`; card image | S (GitHub Actions) |
| Share/OG image `/og/...` | `src/index.js` `ogCardHtml` (5747, 6160) | `basis_text` and an as-of time | R |
| Pinterest pin | `src/pinterest.js` 129 | "Fare data retrieved {date}." (flag off, sandbox) | S |
| `/how-it-works`, `/disclosure` | `how-it-works.html` 275, 367 to 406 | deal rule and 3-day lapse rule; no mention that prices can differ | static |
| Holiday Fare Report (flag off) | `src/holidayReport.js`, `holiday-2026.html`, two CSVs | counts and the 15% floor; no per-route fare | static |
| Blog posts | `blog/*.html` | no fare figures (no blog file contains a `$NNN` price) | static |
| Time-off fares (flag off) | `src/ptoPages.js` | "lowest fare in search data retrieved ..." | R |

Three different age wordings are in use today: "Checked" (homepage, route pages, pSEO), "Fare data retrieved" (emails, route-page footer, OG, Pinterest) and "search data retrieved" (watch emails, time-off). R1 unifies them.

## 4. Candidate data-only rules, backtested on the 22 deals

Method: each deal's `observations` (one low per day). Counts are deals the rule would remove from the Deal list.

| Rule | Deals suppressed (of 22) | Catches EWR to Budapest? |
|---|---|---|
| (a) latest low is at least 25% under the previous observation and not equal to the one before that | **0** | No. The drop was five observations ago and the price has held three days. |
| (a2) latest low is at least 25% under the previous observation | **0** | No. |
| (a3) latest low is at least 25% under the highest low of the prior 7 observations | **14** | Yes, but also 13 other deals, most of the board. Not usable alone. |
| (c) `found_at` older than 6, 12, 24 or 36 hours when the file was generated | **0 at every threshold** | No. Every deal was fetched within 0.6 hours of generation. |
| (b) airline fare not near other cached fares for the same dates | **cannot be computed** | We keep one ticket per route. |

Other findings from the same data:
- **Repeated prices.** The longest run of an identical daily low in the last 14 observations, per deal, is 3 to 13 days (median about 7). The daily "observation" is therefore often the same cached ticket. This does not prove a fare is wrong, but it means the 30-day median and the 10-distinct-day floor are less independent than they look.
- **Raw coverage.** Of 880 other-origin routes, 544 returned no ticket in the latest hourly fetch (62%); of 40 JFK routes, 9.
- **What a rule would need.** A rule that catches a fare because it is unreproducible needs a second price (a live check or a second cached source). A price-only rule will either miss it (a, a2) or remove most real deals (a3).

## 5. Per-airline or per-agency detail

No. A stored ticket has seven fields: `sequence`, `price`, `airline`, `flight_number`, `departure_at`, `return_at`, `expires_at` (plus our `booking_link`). `sequence` is the Travelpayouts result key, which appears to be the number of stops (values 0 to 4; EWR to Budapest is "1"); I did not confirm that against their documentation. The airline is a single code for the whole ticket, and `flight_number` is one number, evidently the outbound. There is no return carrier, no operating carrier, no agency, and no layover airport. A fare that Aviasales shows as an Austrian-style outbound with a Swiss return would be stored as "LX 19". The fetch script keeps only the cheapest result per route (`results` has at most one entry in every file; none of the 1,840 routes in the three raw files holds more than one), so the other tickets the API may have returned are dropped before they are saved.

## 6. What a live price source would need (not verified)

I made no calls and did not read Travelpayouts' documentation for this report, so this answer is only what the repo says:
- The repo already names a second Data API endpoint, `GET /aviasales/v3/prices_for_dates`, used by the time-off fare fetch (`Phase 22 PTO Window Fetch (Step 73).py`, `claude_code_pto_fare_calendar_2026-10-09.md`). It is also a cached Data API; whether it returns fresher data is unknown.
- Travelpayouts' search (flight-search / "real-time") API and the Fare Search White Label are the products that return live results. The repo records Fare Search as parked (D-007) and says live results would be "live prices" next to our cached ones (`claude_code_white_label_fare_search_2026-10-10.md` line 138).
- Clause 2.3.5 (no changes to Travelpayouts tools) is cited in the addenda but its text is not in the repo; clause 2.2.4 is not cited anywhere I could find. I cannot say whether showing live prices is allowed, what the quota is, or whether a search API call per page view is permitted. **This needs the Travelpayouts terms and the API documentation, or a written answer from their support.**

## What this suggests for R1 and R2 (for the owner and the Hub, not decided)

- R1's honest wording is supported by section 2: our timestamp is the request time and the cache can be about two days old.
- Section 4 means R2 cannot be a pure price rule. Without a live comparison, the only honest tolerance is one the owner sets after reading a live-comparison sample, and it will be a proxy.
- The repeated-price finding (section 4) is worth a separate decision by the owner: whether the "distinct observation days" count should de-duplicate identical consecutive prices. That would be a change to D-021 and the J1 rules, which R explicitly says not to touch, so I have not proposed it as part of R.
- The Guard question carried from the plan still applies: whether "Price can differ on Aviasales" may be reworded on cards.

## What I need from the owner

1. Read this and the live-comparison sample (Hub or owner, no marker, no `/out`), then set the tolerance for R2, or say R2 waits until Nov 9.
2. Tell me whether R1 may start once the Hub's Guard has read the strings.
3. Decide whether the repeated-price finding becomes its own item.
