# Addendum J0 and K0 plan report: PARTIAL (evidence gathered 2026-10-17; the report is not finished)

**Status.** Started early at the owner's choice (step 97, the Aviasales report, still waits for Mon Oct 19). The usage limit was reached mid-way, so this file records only what was measured. **Nothing here is a plan the owner can approve yet.** Not done: J0 items 1, 3 (written up), 4, 5, 6 (full list), 7 (live meter check), 8 (PR order and file estimates); K0 items 3, 4, 6 and the findings table. Item 2 of J0 is complete in `docs/addendum_J_deal_floor_dry_run_2026-10-17.md` (decision: the 15% floor sits on top of rare-find, 18 US deals).

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

## Not yet done (continue from here)
J0 items 1, 3, 4, 5, 6, 7, 8 written up from the code traces in `docs/walkthrough_verification_2026-10-17.md` and `docs/addendum_J_deal_floor_dry_run_2026-10-17.md`; K0 items 3, 4 (can the timeline hold), 6 (Clerk appearance options for the installed version), the PR order, and a first-hand read of the remaining findings. The measuring script is a DOM audit (contrast, targets, fonts, landmarks) run through the browser pane; it should be added to `scripts/` before K-B10.
