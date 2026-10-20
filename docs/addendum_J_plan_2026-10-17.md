# Addendum J0 and K0 plan report (read-only, 2026-10-17)

**Status.** Complete for J0 and K0 as of 2026-10-17. Nothing in the repo or production was changed to produce it. It was run early at the owner's request; the Addendum H step 97 report (Aviasales mentions) is still due Mon Oct 19, and the "PR order" section below is written so the two can be merged into one plan. **Stop here and wait for the owner** to approve the order and answer the questions at the end.

# Part J0

## J0 summary
| Item | Finding |
|---|---|
| 1 inventory | See "Per-item inventory" below. |
| 2 deal floor | `docs/addendum_J_deal_floor_dry_run_2026-10-17.md`: 18 US deals today with the 15% floor on top of rare-find; 13 of 22 US origins would show no deal. |
| 3 tag | One place, `index.html` (`cardHTML()`, `asOfLineHTML()`). PR #281 stopped tagging stale fallbacks and is live (version `e5154c7e`, 2026-10-17 09:23 UTC). Wording is settled by D-030. |
| 4 past departures | 12 US rows depart before now + 48 h (8 already departed). Nothing in the pipeline or the page filters on `departure_at`. |
| 5 "880 routes" | 880 is correct (22 x 40); hard-coded in `index.html` and pinned by tests; route pages exist for every route. |
| 6 blurbs | 34 strings in 29 destinations; no generator in the repo; the copy checker skips JSON. |
| 7 meter flag | `true` since `b67de390` (PR #196, 2026-10-13 10:46 UTC); the privacy sentence is missing. |
| 8 PR order | Below. |

## Per-item inventory (J1 to J5)
| Item | Where it lives today | Change |
|---|---|---|
| A1 tag | `index.html` (`priceFreshness`, `asOfLineHTML`) | Display only; wording per D-030 |
| A2 drop past departures | Nothing filters today. The ranking script writes `departure_at` / `return_at` (lines 257-258); no consumer compares them with now | Compile/rank step **and** render time (`index.html`, Worker route pages, pSEO generator) |
| A3 3-day "Last seen" | Carry-forward cap is 7 days (`STALE_FALLBACK_MAX_AGE_DAYS`) | Lower the *display* rule to 3 days; keep the 7-day carry-forward |
| A4 deal floor | `deal_quality()` (ranking script) and `dealQuality()` (`src/dealQuality.js`), two copies kept in step | Change both: 15% floor plus distinct-day count |
| A5 count agreement | `history_points` differs from the length of `observations` on 43 routes | Basis text and history read one list |
| A6 zones | `toLocaleString([])` uses the viewer's zone and prints none | One format with the zone name |
| B1/B2/B4/E5 | `cardHTML`, hero, `renderRoutePage()`, `Phase 17 pSEO Generator` | Display |
| C2/C6/C8/C9/C10 | `src/index.js`, `index.html` CSS, `src/ptoPages.js`, `leave.html` | Copy and layout |
| F1 blurbs | `sparkfare_destinations.json`, `Phase 20 Blog Generator.py` | Data and generator |
| F2 "instantly" | `Phase 17 pSEO Generator` line 553 | Copy; regenerates 881 pages |
| F3 parking | D1 `partners.commission_note` (migration 0012) | **New migration, applied to production before merge** |
| J4 E1-E4 | Every page (no `<main>`; `index.html` has 0 H1) | Same PR as K-A5 |
| J5 | `wrangler.jsonc`, `privacy.html` | One privacy sentence; no flag PR |

## J0 item 3: the tag
- Where: `index.html`, `cardHTML()` builds the badge from `priceFreshness(item)`; the as-of text comes from `asOfLineHTML()`. Before #281 the test was `item.is_stale_fallback` (commit `e201826c`, 2026-09-17), which labelled a carried-forward price "live-checked", the opposite of what happened.
- After #281 the tag needs `!is_stale_fallback` and `found_at` within 48 h (`PRICE_FRESH_HOURS`). A test runs every real carried-forward record and confirms none is tagged.
- Side effect: origins whose data is 24 hours delayed by design show "live" on a day-old fare. D-030's "Checked {n} h ago · {time} {zone}" removes that.

## J0 item 4: past-departure rows (US only, against 2026-10-17 15:00 UTC)
12 rows depart before now + 48 h and 8 have already departed (4 featured, 7 priced_no_deal, 1 insufficient_history among the 12). Examples: SFO to Petra (Oct 12), CLT to Cappadocia (Oct 13), ATL to Larnaca, SFO to Prague, SEA to Amalfi, IAH to Bali (Oct 14), BOS to Bogota (Oct 15).
**Why they survive:** the fetch keeps the cheapest cached fare per route whatever its date; the ranking script carries a record forward up to 7 days when no new fare appears; neither the compile step nor any page compares `departure_at` with now. The fix is two-layer, as J1 A2 says: compile drops them, and the page re-checks because the data files are rebuilt only daily and hourly.

## J0 item 5: "880 routes" against the data
The checked-in files hold 920 records: 880 US (22 origins x 40 destinations) plus 40 TLV. By bucket: deals 41, featured 88, priced_no_deal 203, insufficient_history 90, no_data 498. So "880" is correct for US routes (the 828 in the scan was an earlier file). It is a literal in `index.html` (lines 767 and 959), pinned by `tests/homepage_hub_count.test.js` and `tests/oct19_copy.test.js` against the origin and destination lists, not computed at runtime; A5 asks for a computed value. Route pages: 881 static `/data/` pages (880 plus the listing) exist for every route, including the 498 no_data and 90 insufficient_history rows. The Worker's `/flight/` route returns 404 for a route with no row, so only `/data/` covers the empty ones.

## J0 item 6: blurbs (F1)
Source: `sparkfare_destinations.json` (`the_hook`, `on_ground_reality[]`, `away_mode_transition`), also copied into about 28 blog posts by `Phase 20 Blog Generator.py`. No generator for the JSON is in the repo, and `scripts/check-referral-copy.js` does not scan JSON. A rescan found **34 strings in 29 destinations** (the earlier note said 28):
- urgency: Petra and Tbilisi `the_hook` ("move fast"); Madrid `the_hook` ("vanish");
- a dollar claim: San Jose `the_hook` ("$200+ cheaper");
- percent claims (30% to 100%) in `the_hook`: Bali, Phuket, Prague, Marrakech, Lisbon, Mallorca; and in `on_ground_reality`: Cape Town, Sydney, Buenos Aires, Rio (two), Ho Chi Minh City (two), Amalfi, Algarve, Athens, Thessaloniki, Dubrovnik, Tulum, San Jose, Cebu, Budapest, Krakow, Guatemala City, Cappadocia, Petra, Oaxaca, Baku, Muscat;
- the unsourced insurance claim in Cebu `away_mode_transition` ("premiums drop 40%"); insurance recommendations are blocked until ROADMAP step 19.
Live D1 blurbs: only the Parking Access "Book airport parking ahead..." line breaks a rule today.

## J0 item 7: meter flag and what production runs
- `ENABLE_METER_TRACKING`: added `false` in `171bd989` (2026-10-13 11:12 +0300), set `true` in `b67de390` (2026-10-13 10:46 UTC, PR #196); nothing later touched it. Migration 0022 applied 2026-10-13 11:09:36 UTC. Task D opens **Oct 27**. The privacy page does not yet mention the extra click fields.
- Production: the first automatic deploy since #268 was version `e5154c7e`, 2026-10-17 09:23:50 UTC (PR #283, the lockfile fix). Everything through #283 is live.

## Consumers of the ranked-deals files
`index.html` (board); `src/index.js` (digest, `/check`, route pages, watchlists, retrospectives, OG card, pins, route sitemap; about 20 `loadJsonAsset` sites); `Phase 17 pSEO Generator`; `Phase 19 Newsletter Generator`; `Phase 3 Social Broadcaster` (selects `status == 'deal'`); `Phase 22 PTO Window Fetch`; `scripts/preview-email.mjs`; three workflows. **A4 changes who counts as a deal in the digest, the newsletter and the social post as well**, because they select on `status` or `dealQuality`. A2 and A3 change which fares those can show. A3 is the same rule as the PTO fare rule (step 73 B2).

## PR order (J and K combined; each needs the owner's approval; last pre-freeze merge Wed Nov 4)
1. **J1-data** (Python): deal floor with distinct days, drop past and near departures, basis-text count. Files: ranking script, `src/dealQuality.js`, tests with a mutation check per rule.
2. **K-A1** fonts and tokens (split, see below), **K-A2** action colour and contrast (styles only). The shared header is **K-B1**, not K-A2 (an earlier version of this line said otherwise).
3. **K-A3** = J1-display plus the F1/F2/F3 copy: tag wording per D-030, "Last seen" rule, zones, render-time A2 guard. F3 needs a migration applied first.
4. **K-A4** Away Mode (Petcube hide, needs a migration applied first).
5. **K-A5** = J4 accessibility with the landmarks.
6. **K-A6** = J2 fare display (needs step 97's wording for the fare link).
7. **J3b** flows (`/time-off` share and watch, `/leave` link, mobile order) and **J5** privacy sentence (one file; can go any time).
Step 97 touches the same files as items 3 and 6, so plan them as one sequence after Monday's report.

## Questions for the owner
1. Approve this PR order? (J1 as two PRs, data then display, is my recommendation.)
2. A3: lower the display cut-off to 3 days while keeping the 7-day carry-forward?
3. "Prices as of" time zone: the viewer's own with the zone name shown, or one fixed zone (ET)? I recommend the viewer's own with the name.
4. F3 and the Petcube hide need D1 migrations applied to production before merge; OK to run them when the time comes?
5. J5: add the privacy sentence now (live copy)?

# Part K0

## K0 item 1: files that set their own palette or font (repo, main at 2026-10-17)
34 hand-written files plus two generators set their own `:root` or `font-family`:
- **Sand / Amber / old Sage + Segoe UI (the old system):** 404, about, account, away-mode, check, disclosure, hub, leave, passport, plan, preferences, privacy, reward-terms, sign-in, terms, trips, watchlists, `src/embed.html`, `src/ptoPages.js`, `Phase 17 pSEO Generator (Step 106).py` (so 881 `data/` pages), `Phase 20 Blog Generator.py` (so 73 `blog/` pages).
- **Space Grotesk / IBM Plex (home):** `index.html`, `src/interstitial.js`, parts of `src/index.js` (also Arial, Roboto Mono, Inter).
- **Style-guide Paper/Ledger/Spark:** `widget.html`, `src/widget.html` (Arial, Roboto Mono, Inter).
- **Email and archive builders with their own font constants:** `src/email.js`, `src/emailTemplates/dailyDigest.js`, `src/digestArchive.js`, `src/postClickEmail.js`, `src/weeklyStandup.js`; `src/homeCard.js` and `home-card.html` use `system-ui`; `src/planReminders.js` uses Segoe UI.
- **Google Fonts is loaded by** `index.html`, `away-mode.html`, `widget.html`, `src/index.js`, `src/interstitial.js` (the privacy page discloses it; K-A1 must update that page).

## K0 item 2: how header and footer are built
- The header is copied into every page (no shared partial). **Six distinct link sets**: 16 files share one, `disclosure`/`privacy` add About, `index.html` omits the wordmark and adds Time off, the pSEO generator omits All Routes, `src/ptoPages.js` and `src/index.js` (adds Leave-by plan) differ. `blog/` has 71 + 2 variants, `data/` 880 + 1.
- The footer is already shared: `site-footer.js` injects it on every static page (precedent for sharing). Header pages have no `<main>`; `index.html` has 0 H1; `leave.html` has 2; `sign-in.html`, `widget.html` and `home-card.html` have no nav.
- **Recommendation to confirm:** keep server-rendered markup (crawlers need the links): one source fragment, a small script that rewrites the nav block in every static page and both generators, and one exported string for the Worker templates with a test asserting they match (the pattern of `src/referralCopy.js`).

## K0 item 5: "Matches your trip" and Petcube
- `away-mode.html` (`reorderPartners()`) adds the badge only when `currentNeeds[key] === true`, i.e. after the visitor answers **Yes**, using the `KEY_MAP` slug map; answers persist in `localStorage` (`sparkfare_away_needs`). **With a clean browser, production shows 0 badges** (scan finding A-1 not reproduced on a clean session; it may have been a browser with stored answers or the pre-#269 build). The "after an answer, a neutral reason chip" change in K-A4 is still needed (the badge today says "Matches your trip" in amber).
- Petcube: a D1 `partners` row (`status = live`, migration 0026, applied 2026-10-16 06:14 UTC); the card renders from `/api/partners`; the `/disclosure` entry is static text at `disclosure.html` line 105. Details in `docs/walkthrough_verification_2026-10-17.md` item 1.

## K0 item 7: production re-check (browser pane, 1440 px unless noted; production at 2026-10-17 ~15:00 Israel)
| Finding | Production now |
|---|---|
| SYS-1 fonts | **Still open.** Brand fonts load only on `/` (Space Grotesk), `/digest` (Inter, Space Grotesk) and `/widget` (Inter). Computed `font-family` is "Segoe UI" on /away-mode, route page, /check, /time-off, /leave, /data/, blog, /pricing, /hub, /about, /disclosure, 404, sign-in. |
| SYS-3 gold on actions | **Still open.** On `/`: 34 elements use `#E8B930` (`hero-cta`, `book-link`, buttons) and 48 use amber `#B8720F`. |
| SYS-4 contrast | **Open and wider than the scan.** `/`: 9 failing text nodes ("Don't see your airport?" 3.65, hero label 3.65, `$594` 2.84 at 35 px, DEAL 3.57 at 10.4 px). Amber links fail 3.57:1 on blog posts and `/about`; `/hub` "Copy" 3.85; widget "Get deal alerts" 3.99. |
| SYS-5 header | **Open.** 11 to 12 links; 2 rows at 1440 px on secondary pages, 3 rows at 375 px; only the homepage has a menu button. |
| SYS-6 H1 and `<main>` | **Open.** No page has `<main>`; `/` has 0 H1; `/leave` has 2 (one empty); `/sign-in` has 2; `/widget` has 0. |
| SYS-7/8, SYS-10 | Not individually measured; `/` has 140 of 317 visible text nodes under 13 px. |
| H-1 mobile first price | **Open.** At 375 px the hero price is at y=1,210 and the signup has 4 fields plus the airport request box (5 inputs). |
| H-5 LIVE-CHECKED | **Partly fixed by PR #281**: stale fallbacks are no longer tagged; 25 `.badge.stale` tags render on fresh cards; the words remain until K-A3. |
| H-3, H-4, H-6, H-10 copy | **Open.** `/` still contains "the moment", "% less", "% below comparable", "vanish", "premium", "arbitrage" and "880". (880: see below.) |
| R-1 to R-4 route page | **Open.** Route page: Segoe UI, `<main>` absent, 1 H1 (SEO string), 3 nav rows and a 4-line H1 at 375 px, copy contains "instantly". |
| A-1 badge | Not reproduced on a clean session (see above). |
| A-3 Away Mode wording | **Open.** `/away-mode` still contains "the moment" and "Book "; the meta description was fixed earlier. |
| A-4 Petcube | **Open (live).** Card and `/disclosure` entry present. |
| L-1 `/leave` | **Open.** 2 H1s, one empty. |
| T-1/T-2 `/time-off/sea` | **Open.** Height 5,456 px (scan 5,437). |
| D-1 `/data/` | **Open.** 13,864 px; all 893 links under 24 px. |
| B-1 blog | **Open.** Cebu is still titled "a weekend sprint within reach". |
| G-1 `/digest` | **Changed:** the archive is public (`ENABLE_DIGEST_ARCHIVE` true); it already uses Inter and Space Grotesk, 0 contrast fails, but all 90 targets are under 24 px and it has no site header. |
| HUB-1, S-1, E-1, W-1 | Not measured. |
| H-10 "880 routes" | **May already agree.** The checked-in files hold 920 records, 880 US (22 x 40) plus 40 TLV. |


## K0 item 3: K packages that overlap J
K-A3 ships J1 A1/A6 and the F1/F2/F3 copy; K-A5 ships J4; K-A6 ships J2. So J1-display, J4 and J2 are the same PRs as K-A3, K-A5 and K-A6, not separate ones. J1-data, J3b and J5 stay J-only. The merged order is in the J0 "PR order" section; Phase B and C stay as Addendum K sets them.

## K0 item 4: does the timeline hold?
About 14 PRs in 12 working days to Nov 4, each needing the owner's approval, alongside Addendum G's flag work (dark, waits for Nov 9 anyway) and Monday's step 97 report. It holds only if approvals are same-day, K-A1 and K-A2 stay mechanical, and nothing new from F, G or H lands in Phase A. If approvals slip, drop K-B items 7 to 10 first and keep Phase A whole.

## K0 item 6: Clerk appearance
The installed `@clerk/clerk-js` is 6.31.0 (pages load `@clerk/clerk-js@6` and `@clerk/ui@1` from `clerk.sparkfare.com`), which supports `appearance` with `variables` (colours, font, radius) and `elements` class names; `sign-in.html` already passes `appearance.elements`. Brand v1 tokens can therefore be applied through `variables`. Whether every sub-element (one-time-code field, error text) can be restyled was not tested and should be checked in Phase B before it is promised.


# Refresh 2026-10-18 (read-only; changes nothing above)

The J0/K0 report above was written on 2026-10-17 and is still the record of what was found. This section says what has happened since.

## PR order: done and not done
| Item | PR | State |
|---|---|---|
| Deploy path (lockfile) | #283 | Merged; production live from version `e5154c7e` |
| J1 data (floor, distinct days, past departures, counts) | #292 | Merged |
| J1 display (tag wording per D-030, "Last seen", zones, render-time guard) | #293 | Merged |
| K-A1a/b tokens, fonts, privacy fonts sentence | #296 | Merged |
| K-A2 action colour and contrast | #297 | Merged |
| K-A3 truth in copy (carries J3 F1, F2, F3) | #298 | Merged; migration `0029` applied |
| K-A4 Away Mode governance (Petcube hidden) | #299 | Merged 2026-10-18; migration `0030` applied to production first (`/out/petcube` now 403, not in `/api/partners`) |
| K-A5 structure and access (carries J4) | #300 | Merged |
| K-A6 fare ticket and chips (carries J2) | #301 | Merged |
| J5 privacy sentence on partner clicks | #307 | Merged |
| J3b empty states, short windows, alert heading (C2, C9, C10; C8 already held) | #308 | Merged |
| J3b C6 mobile order | #309 | Merged |
| Step 97 copy stack | #304 to #306 | Open drafts, see `docs/step97_aviasales_mentions_report_2026-10-18.md` |

## Open owner questions from J0, as they stand
1. PR order: followed (J1 as two PRs, then K-A1 to K-A6, then J3b, J5).
2. A3 (3-day "Last seen"): shipped in #293.
3. Time zone: shipped as the viewer's own zone with its name, in #293.
4. Migrations before merge: 0029 and 0030 applied to production and recorded in `d1_migrations`.
5. J5 privacy sentence: shipped in #307. Not done: a test click through `/out` (it logs a real partner visit; `/admin/revenue` needs the admin secret, which this session does not hold). There is no `/admin/meters` route (404); `/admin/revenue` and `/admin/payouts` answer 401 without the secret.

## Still open from J0
- **F1 blurbs:** K-A3 stopped the page showing unsafe lines, but the 34 strings in 29 destinations still sit in `sparkfare_destinations.json`; `content/destination_lines.json` ships empty. The copy checker still does not scan JSON.
- **C6 trade-off** (see #309): on phones the signup is about 2,650 px down because each card is about 700 px tall.
- **Item 7:** the flag has been `"true"` since 2026-10-13; the Task D readout opens 2026-10-27 once payouts are entered.
- **Not re-measured here:** the K0 production table (SYS-1 to HUB-1). Phase A has merged since, so most rows have changed; re-running it is the K-B0 check, not part of this refresh.


# Refresh 2026-10-20 (read-only; changes nothing above)

Closes the remaining J0 and K0 items. Production checked by `curl` on 2026-10-20 (latest deployment `160517eb`, 12:23 UTC), `origin/main` read for everything else.

## Merged since the 2026-10-18 refresh
| Package | PR | |
|---|---|---|
| Step 97 copy stack | #304, #306, #311, #312, #313, #325 | All merged; see `docs/step97_aviasales_mentions_report_2026-10-18.md` (#340 updates its status) |
| K-B10 CI brand checks | #316 | Merged. K-B6 and K-B7 may now use the green lane (`docs/k0_merge_train_green_lane_2026-10-18.md`) |
| K-B6 night mode, K-B7 images | #317, #318 | Merged |
| K-B1 shared header and footer | #315, #319, #321 | Merged, plus two follow-up fixes |
| K-B2 homepage | #320 | Merged |
| K-B3 route pages, K-B4 `/check`, K-B5 `/time-off` | #328, #329, #330 | Merged |
| K-B8 hub, digest, account, emails | #331, #332, #333, #335 | Merged |
| K-B9 `/data/` finder, blog titles | #336 | Merged |
| K-B8 sign-in | #334 | **Open, not a draft, needs approval** |
| K-C1, K-C2 | #338, #339 | Open drafts, built dark |

## K0 item 7, re-measured after Phase B
The K-B0 table (`docs/k_b0_production_recheck_2026-10-19.md`, Oct 19) listed 8 Open and 7 Partly rows. Re-checked now:
| Row | Oct 19 | Now |
|---|---|---|
| R-1 `/data/` route page has a View fare link | Open | **Fixed**: `/data/ord-to-lisbon-portugal` has one. The Worker page `/flight/ORD/Lisbon, Portugal` has none (that route has no current fare); `/flight/JFK/Bali, Indonesia` has one. |
| R-2 H1 is an SEO string | Open | **Fixed**: "Chicago to Lisbon" (data page), "Flight deals to Lisbon, Portugal" (Worker page). |
| G-1 `/digest` | Open | **Fixed in structure**: tokens, 1 H1, 1 `<main>`. Target sizes not re-measured. |
| D-1 `/data/` | Partly | **Improved**: titled "All Flight Routes", 1 H1, tokens, 891 links. Page height and the route finder not re-measured. |
| B-1 Cebu title | Open | **Fixed**: the text is no longer on the page. |
| S-1 sign-in, SYS-6 | Partly | **Open**: `/sign-in` now has 1 H1, but its Clerk appearance is #334, still unmerged. |
| HUB-1 signed-out copy | Open | **Unverified**: the string "confirmed referrals" is still in `/hub`'s HTML; it may be in a signed-in-only block. #331 changed the copy; look at the page signed out. |
| T-1, T-2, T-3 `/time-off` | Open | Page now has 1 H1 and `<main>`; the peak line, the six "Watch this weekend" buttons (now 0 matching text) and unranked destinations need a visual check. |
| A-2 offers before guidance | Open | Waits for K-C1 (#338). |
| SYS-2 one visual system | Partly | Tokens on `/digest` now; emails done in #333; Clerk waits for #334. |
Rows marked Not measured on Oct 19 (focus ring, night mode, image sizes, footer, empty states, `/check` verdict, emails) still need a browser pass; `curl` cannot see them.

## Still open from J0
- **F1 blurbs:** unchanged. The 34 strings in 29 destinations are still in `sparkfare_destinations.json`, `content/destination_lines.json` ships empty and the checker still skips JSON.
- **C6 trade-off** (phone signup about 2,650 px down) was judged in #309; not revisited.
- **Task D** opens 2026-10-27, once payouts are entered.
- **J5 test click** through `/out` is not done (needs the admin secret to read `/admin/revenue`).

## Timeline (K0 item 4)
Phase B is merged except the sign-in card (#334) and Phase C is built dark (#338, #339), a week ahead of the Oct 24 and Oct 31 checkpoints. The remaining pre-freeze work is approvals, then the browser pass for the Not measured rows. Nothing that changes live copy waits on the Nov 6 to Nov 8 freeze except what is unmerged by Thu Nov 5 18:00 ET.
