# Claude Code build plan: Sparkfare Fare Search (Travelpayouts White Label) — 2026-10-10

Non-attorney guidance on every legal point. Owner: Coby. **Status: PROPOSED. Nothing here is approved, built or merged.** Estimates are mine, plus or minus 50%.

**What this is.** A plan to let "View fare" lead to a Sparkfare-branded fare search (a Travelpayouts White Label Web) instead of sending people straight to aviasales.com. It ships as a controlled, reversible experiment that becomes the default only if it earns its place.

**Naming.** Internal name is **Fare Search**, not "white label". Roadmap steps 43 and 47 already use "white-label" to mean Sparkfare-as-a-product ("Sparkfare Engine"). Do not mix the two.

---

## 1. The approach in ten lines

1. **One choke point.** The path choice (`direct` = Aviasales as today, `wl` = Fare Search) is made server-side in `/api/trips`, where `withTripMarker(booking_link, tripId)` already builds the tracked link. No pipeline change. `item.booking_link` stays an Aviasales link in every JSON file and email template.
2. **Parallel run, not a switch.** Control arm = today's behaviour. The old path is not removed until the Feb 12 decision.
3. **Assignment at click time, so copy must be neutral.** The page does not know which arm a user will get. Every page-level and email string must be true for both arms. This is Task C, and it ships first because it also delivers your "fewer Aviasales mentions" goal on its own.
4. **Deterministic bucketing by user id.** A user always sees the same arm. The ramp percent and surface list live in D1, so ramping needs no deploy.
5. **Trip-level attribution is a must-have.** `sub_id = trip_id` stays exactly as today. If the spike cannot prove it carries through Fare Search, the project stops.
6. **Counts first.** `state_METRICS.md` had no baselines and no paid conversion was confirmed as of the last project docs (re-check). Decisions use counts and pre-set stop rules, read at the Dec 11 and Feb 12 gates.
7. **Kill switches at three levels.** Master flag, D1 percent set to 0, and an automatic circuit that falls back to `direct` when the Fare Search host fails health checks.
8. **No new tracker, no new cron, no manual reconciliation.** Health checks run in GitHub Actions. Measurement reads the Travelpayouts statistics API that `reconcileBookings` already uses.
9. **Honest wording.** Live Fare Search prices will differ from Sparkfare's cached "lowest fare seen". Existing "From $X, as of" wording stays, with one added line.
10. **Elevation comes after proof.** Section 15 lists the extras (live-fare links for PTO windows that have no cached fare, route-page search, and more). None are built until the experiment reads green.

### Effort summary

| Task | What | Who | Estimate |
|---|---|---|---|
| 0 | Discovery (read-only) | Claude Code | 0.5 day |
| S | Spike and scorecard | Coby (dashboard, DNS) plus Claude Code probe script | 1 owner day plus 0.5 day |
| C | Neutral copy pass (copy only) | Claude Code | 1 day |
| B | Plumbing behind flags (migration PR, then code PR) | Claude Code | 3 to 4 days |
| D | Fare Search page assets and branding | Claude Code files, Coby pastes | 1 day |
| E | Measurement, health circuit, standup | Claude Code | 1 to 2 days |
| F | Rollout runbook | Coby | 15 minutes per step |
| G | Evaluation at Dec 11 and Feb 12 | Claude Code (read-only) | 0.5 day each |

About 7 to 9 build days of agent time in total, plus about 2 owner days. This is more than my earlier "3 to 5 days" because it adds copy, measurement and the health circuit.

---

## 2. What the research found

| # | Fact | Source | What it means for the plan |
|---|---|---|---|
| R1 | White Label Web has two types: **Page** (standalone site on your domain or subdomain) and **Widget** (search form embedded in an existing page, results on that page). | TP Help: What is White Label Web | Spike tests both (Task S). |
| R2 | Reward is a **30% affiliate share** of what Travelpayouts receives from the brand. TP's marketing page for travel agencies says "50%". | TP Help (30%) vs special.travelpayouts.com/wltravelagency (50%) | Use 30% until the dashboard shows otherwise (gate G3). |
| R3 | Domain or subdomain **cannot contain travel brand names** (Aviasales, Booking.com and so on) or the account may be blocked. | TP Help | Use `fares.sparkfare.com`. Never put "avia" or brand names in the host. |
| R4 | Setup for Page type: CNAME to `whitelabel.travelpayouts.com`. Records update within 24 hours (up to 72 hours quoted on the hosting page). SSL loads within 48 hours of creating and customising. | TP Help: hosting, Cloudflare CNAME, Setup Guide | Build in 3 days of lead time. A Worker route must not shadow the subdomain. |
| R5 | Page type: **Design tab** controls colours, border radius and a font from a fixed list. **Custom HTML** controls header, footer, head styles, meta and menus, **on the main page only**. Results-page look is Design-tab only. | TP Help: Page type, menus | The disclosure and footer may not be placeable on the results page. Spike checks this. |
| R6 | Header and footer menus are **Page type only**. Widget type needs TP scripts in `<head>` plus a results `<div id="tpwl-tickets">`. | TP Help: menus, Widget type | Widget keeps all chrome on our own page (nav, disclosure, analytics) but needs script and CSP checks. |
| R7 | SubID on a White Label: append `?marker=YOUR_ID.subID` to the White Label URL. Stats appear by SubID in Reports, and the statistics API returns `sub_id`. Stats refresh once a day. | TP Help: ID and SubID, Aviasales statistics, statistics API | Our `marker=314524.{trip_id}` pattern should work on the Page type. Widget behaviour is unknown. |
| R8 | A White Label **Project** is created automatically for the domain; Aviasales stats have Project, ECPC, ECPS and ECPU columns. | TP Help | Arm comparison is possible by Project even if SubID aggregation is awkward. |
| R9 | Deep links: for a White Label, use its subdomain as the domain. `origin_iata` **and** `destination_iata` are both required or the link lands on the main page. Documented paths: `/flights/` (pre-set form) and `/searches/new` (results). Another TP doc shows `/flights` for White Label. | TP Help: Aviasales affiliate links; landing-page article | Exact path and parameter names must be proven in the spike. Do not guess. |
| R10 | Results page is **closed to search crawlers except the main page**. | TP Help | No SEO value from results. Make the main page `noindex` via custom meta (spike confirms it is allowed). |
| R11 | New White Label version has **bot-click protection**; clicks may drop versus before. Old version was retired 2025-02-15. | TP Help: versions | Compare earnings per click and bookings, never raw click counts across tools. |
| R12 | Booking.com fares are **not available** in White Label. Agencies are preselected by TP and cannot be chosen. | TP Help | Different fare set than aviasales.com. Expect price differences. |
| R13 | Aviasales support says White Label "can increase the chance of booking, as some users get annoyed by having to continue their journey on a new tab". TP blog: conversion can be high for a motivated audience, otherwise lower. | TP Help; TP blog | Plausible upside, not a promise. The experiment decides. |
| R14 | Sparkfare's own 2026-09-23 strategic review put Aviasales at about $0.12 per click (about $4 on a $353 booking). Unverified. TP's blog quotes an average eCPC of $0.40 that "varies based on your traffic quality". | Strategic review doc; TP blog | Baseline for comparison must come from Sparkfare's own TP stats (gate G3). |
| R15 | Cost of White Label Web is **not stated** on pages I read. The app version is free. An optional paid appearance-setup service exists ("valid for one setting"). TP marketing says clients "recoup their purchase cost in 2-3 months". | TP Help; promo pages | Gate G1: confirm no recurring fee in the dashboard before building. |

**Industry practice used here (general experimentation practice, not from a Sparkfare or Travelpayouts source):** randomise by user, not by click; ramp in stages; define guardrails and a kill switch before launch; keep the control arm running; change one variable at a time (hence copy neutrality ships separately from routing); keep attribution identifiers unchanged; read results at pre-set dates, not continuously.

---

## 3. Decision gates (owner)

| Gate | Question | Needed before |
|---|---|---|
| **G0** | Spike scorecard passes its must-haves (Task S). | Any merge of Task B |
| **G1** | No recurring fee or minimum spend. Any setup-service purchase is your call (project rule: $0 paid spend, no recurring cost). | Task S proceeds past DNS |
| **G2** | **Positioning.** Your 2026-10-07 decision rests on "Sparkfare publishes fare information and sends people to the booking site". A branded search with multi-agency results on `fares.sparkfare.com` looks more like arranging travel. You declined counsel; the minimum is a logged DECISION that you accept this knowingly (section 16 has draft text), the mitigations in Task D, and a new reopen trigger. Run the Legal spoke first. Non-attorney. | Any traffic to `wl` beyond the owner allowlist |
| **G3** | Rate check. Compare your actual Aviasales effective earnings per click (TP: Aviasales program, Performance tab, ECPC) with what the White Label reports at the same stage. | Ramp above 10% |
| **G4** | Each ramp step approved by you. | Each ramp step |

---

## 4. How it fits what already exists

| Existing piece (verify each in Task 0) | Fare Search use |
|---|---|
| `index.html` `trackBookingClick` then `POST /api/trips` then `/departing/{trip_id}?url=...` | Unchanged. The server picks the URL inside `/api/trips`. |
| `withTripMarker(booking_link, tripId)` | Reused for the `direct` path. The `wl` path builds a different URL with the same marker value `314524.{trip_id}`. |
| `build_aviasales_link()` output `https://www.aviasales.com/search/{ORIGIN}{DDMM}{DEST}{DDMM}{adults}?marker=...` | Parsed (destination IATA only) to feed the `wl` URL. Dates come from `trips.departure_at` and `return_at` (the link has no year). |
| `trips` table (created inline in the handler, plus migrations) | Add `fare_path` and `fare_path_reason`. |
| `/out/:partner` plus T2 partner registry, `outbound_click` event with `src`, `slot`, `sub_id` | New registry entry for Fare Search. Status `pending` until the spike's test click passes, then `live` (project rule: never expose a non-live link). |
| `reconcileBookings()` (hard-filters `campaign_id` 569853) | Updated after the spike shows where White Label bookings are reported. Match by `sub_id` (a UUID), which is safe across campaigns. |
| `src/referralCopy.js`, `npm run check:copy`, banned phrases | Neutral strings added here. The check gains a rule about naming a single partner outside allowed pages. |
| Interstitial PR #48 and refinements (Continue button, disclosure under it, "Round out your trip" list) | Kept. Continue goes to Fare Search in the `wl` arm. The Away Mode list is why we keep the interstitial. |
| Weekly standup, `/admin/metrics`, T0 `logEvent`, `src/botClass.js` | New events and a Fare Search block. |
| Revenue health monitor (roadmap step 12) | Reuse its alert path if built. |
| Cron limit (free plan: 5 per account, Worker uses 4) | Health check runs as a GitHub Actions workflow. |
| Admin Bearer-secret routes (as used for Pinterest admin) | Circuit and config routes use the same pattern. |
| `.assetsignore` and `wrangler.jsonc` `assets.directory: "."` (everything is public unless ignored) | Fare Search page assets live in `docs/fare_search/` and are added to `.assetsignore`. |
| Pivot test at Dec 11 and Feb 12 (flight outbound clicks per 100 vs Away partner clicks per 100) | `outbound_click` keeps its meaning. A helper `isFlightOutbound(partner)` counts `aviasales` and the new Fare Search partner together. |
| `VALID_ORIGINS` includes TLV (test origin) | TLV always resolves to `direct`. |

---

## 5. Timeline against the fixed dates

The latest docs (PTO spec, Away Mode spec) put **launch day on Oct 17** with go/no-go **Oct 16, 18:00 ET** and merges resuming **Mon Oct 19**. `claude/ROADMAP_consolidated_2026-09-26.md` still says Oct 2. Task 0 reports the discrepancy; treat Oct 17 as current until you say otherwise.

| When | What | Gate |
|---|---|---|
| **Now to Oct 16** | Task 0 (read-only). Task S spike. Branches and PRs prepared. **Nothing merges.** The DNS record for `fares` and the dashboard setup do not touch the production site, but record them in the decision log. | Launch freeze |
| Oct 17 | Launch day. No merges. | Launch rule |
| **Mon Oct 19 onward** | Task C (neutral copy) merges first once you confirm. One PR at a time; rebase against the PTO tracks (they touch `src/index.js` and copy files too). | Coby |
| Oct 21 to 28 | PTO migration 0019 lands Oct 21. Fare Search migration PR **after** it (next free number; verify). Task B code PR, Task D, Task E, all flags off. | Migration applied before code merges |
| Oct 29 to Nov 1 | Dogfood: master flag on, percent 0, allowlist = Coby only. Check attribution after 24 hours (stats refresh daily). | Spike must-haves, G2 |
| **Nov 2 to 15** | 10% on `home` surface only. Away Slice B (Moves 2 and 3) merges in this window; Move 3 must be mergeable before Nov 16. | G4 |
| Nov 16 | Plus Week 1. Hold Fare Search changes that week except the kill switch. | |
| Nov 16 to Dec 10 | 25% if guardrails are green; add route-page surface. | G3, G4 |
| **Dec 11** | Month-1 gate: first directional read (Task G, part 1). | |
| Dec 12 to Jan 31 | 50% only if green **and** at least one verified Fare Search conversion; add `email_v2` and `pto` surfaces. | G4 |
| **Feb 12** | Month-3 gate: decide the default (Task G, part 2). | |

---

## 6. Paste this block at the top of every Claude Code session

```
You're working on Sparkfare (Cloudflare Worker + D1 + Clerk + Resend + GitHub Actions + Travelpayouts). Read CLAUDE.md, then
ROADMAP.md in full, then sparkfare_style_guide.md. This plan adds "Fare Search": an optional path from "View fare" to a
Sparkfare-branded Travelpayouts White Label, run as a controlled experiment next to today's Aviasales path. RULES, no exceptions:
1. Discover first. Line numbers, file names and statuses here are last-known (2026-10-10). Inspect the real code. If anything
   contradicts the repo, stop and report; do not silently proceed.
2. Launch freeze: nothing merges to main before the Oct 16 18:00 ET go/no-go, and nothing merges on Oct 17. Merging to main
   auto-deploys. Build on branches, open PRs, use preview URLs.
3. Every user-facing change ships behind a flag in wrangler.jsonc, default "false" (only the exact string "true" turns it on).
   Task C (neutral copy) is the one exception: copy only, shipped live, but only after Coby confirms.
4. Feature branch per task, small commits, PRs. Do NOT push to main, deploy, run migrations on production, trigger a scheduled
   job, send a real email, place a real order or make a real booking, or call a paid API without asking Coby.
5. Schema changes are new numbered D1 migrations, backward-compatible, with a rollback note. Check for number collisions
   (0016 to 0019 are referenced by other open specs, so confirm what is actually applied). Coby applies migrations to production BEFORE merging code that needs them.
6. No new Cloudflare Cron Trigger. Schedules run as GitHub Actions workflows at off-peak minutes (never :00).
7. Referral-copy rules apply to every string (src/referralCopy.js; never "Book now", "we book", "secured", "locked in",
   "guaranteed", and the other banned phrases). Run `npm run check:copy` and `npm test` before every PR.
8. Price honesty: Sparkfare prices are cached "lowest fare seen" values. Fare Search shows live prices. Never imply a Sparkfare
   price is bookable at that price.
9. Never invent a URL format, a parameter name, a campaign id or a rate. Only use what Task S recorded as verified. Never mark
   the Fare Search partner `live` before the spike's test click passes.
10. Never hardcode secrets. The Travelpayouts token and the admin secret are Worker secrets.
11. No new third-party tracker on any Sparkfare page or on Fare Search pages.
12. Tests for every pure function and every new route. Report with the three honest tiers: done-confirmed-live /
    built-not-verified-live / not-started. Do not call anything done that was not checked where its "Done when" says.
```

---

## 7. Task 0: discovery (read-only, start now)

```
Task 0: report only. Do not edit any committed file. Output a short report with quoted code or paths for each item.

1. THE CLICK FLOW TODAY: trace "View fare" end to end: index.html handler, POST /api/trips (where withTripMarker is defined and
   what it does to a link), the redirect to /departing/{trip_id}?url=..., how the interstitial's Continue button resolves its
   destination (the ?url= parameter, or /out/aviasales with a trip id, or both), and whether the ?url= value is validated against
   a host allowlist. Say which host(s) a new Fare Search host would need to be added to.
2. EVERY CONSUMER of booking_link or an Aviasales URL: homepage hero and cards, route pages (/flight/<o>/<d>), /data/ pages,
   the widget (src/embed.html), /deal/ permalinks and /share/deal, watchlists, PTO pages if present, and every email template
   (digest, alert, post-click v1 and v2, booking-confirmed). For each: does it go through /out/:partner and carry src and slot? List every `src` value actually in use
   (the plan assumes home, route, email_v2 and pto; correct the surface names to match the repo).
3. PARTNER REGISTRY: table or config shape, how "aviasales" is represented, what the /out handler logs on outbound_click, and
   whether a flight partner is already modeled (the CheapOair plan assumed one).
4. TRIPS SCHEMA: columns in production per migrations versus the inline CREATE TABLE IF NOT EXISTS in the /api/trips handler.
   Is src stored on trips? Next free migration number after 0019 (list the existing ones and any reserved by open specs).
5. RECONCILIATION: quote the campaign filter in reconcileBookings. With Coby's approval, make ONE read-only call to the
   documented get_fields_list endpoint (https://api.travelpayouts.com/statistics/v1/get_fields_list; confirm the HTTP method and
   auth header in the current docs first) and report the available fields, especially anything giving earnings or reward per action, campaign or program id, and click versus action type.
6. ROUTING AND HEADERS: wrangler.jsonc routes and custom domains. Confirm no wildcard route or catch-all custom domain would
   capture fares.sparkfare.com. Report any Content-Security-Policy or other security headers the Worker sets.
7. COPY STATE: has the 2026-10-07 referral-positioning pass shipped? List every user-facing string that names "Aviasales" or
   describes where a fare link goes (table: file, line, string, surface). Quote the current src/referralCopy.js constants.
8. EVENTS AND METRICS: the outbound_click schema (fields and meta), how /admin/metrics and src/weeklyStandup.js group flight
   outbound versus Away partner outbound, and where "flight outbound click" is computed for the Dec 11 / Feb 12 pivot test.
9. FLAGS AND ADMIN: how flags are read from wrangler.jsonc vars, how admin Bearer routes authenticate, and whether any runtime
   config store (D1 table or KV) already exists.
10. WORKFLOWS: list .github/workflows with their cron schedules so the health check picks a free off-peak minute.
11. PRIVACY AND DISCLOSURE: current third-party lists in privacy.html and disclosure.html; whether any cookie notice exists.
12. DATES: quote the launch and freeze text in ROADMAP.md and CLAUDE.md and report the Oct 2 versus Oct 17 discrepancy.

End with the open questions Task B must settle. Do not start Task B.
```

---

## 8. Task S: spike and scorecard (owner plus a probe script)

Goal: prove the must-haves on a throwaway setup before any code merges. **Do not make a real booking.**

**Coby, in the Travelpayouts dashboard and Cloudflare:**
1. Create a White Label Web, **Page** type, domain `fares.sparkfare.com`. Language `en`, currency `USD`. Leave "Show your Travelpayouts referral link" **off**. Note the Project it creates.
2. In Cloudflare DNS add CNAME `fares` pointing to `whitelabel.travelpayouts.com`. Record the proxy setting you used (DNS only vs proxied). TP's Cloudflare article does not state it; if the page does not load or SSL fails, try DNS only first and ask TP support. Allow 24 to 72 hours for DNS and up to 48 hours for SSL.
3. Create a second White Label, **Widget** type (the project's earlier question was whether staying on sparkfare.com itself is better). Put it on a throwaway static page in a preview branch only.
4. Optional paid "appearance setup" service: **do not buy** without deciding under G1.

**Claude Code: `scripts/fare_search_probe.mjs`** (not wired into CI; asks before running; reads the token from env):
- resolves DNS for the host (DNS-over-HTTPS), fetches the main page, reports status and TLS result;
- prints candidate deep-link URLs for three sample trips (one round trip, one one-way, one with a long destination name) using each documented pattern: `/flights/?origin_iata=..&destination_iata=..&depart_date=..&return_date=..&marker=..`, `/flights?...`, `/searches/new?...`;
- after 24 hours, queries the statistics API for the test `sub_id` values: which `campaign_id`, which type (click or action), which state.

**Scorecard** (Coby fills in; copy the table into the PR):

| # | Check | Must-have? | Result |
|---|---|---|---|
| M1 | `?marker=314524.<test-id>` on the Fare Search URL appears in TP Reports by SubID **and** as `sub_id` in the statistics API within 48 hours | **Yes** | |
| M2 | A deep link pre-fills **and runs** the search for origin, destination and dates (round trip and one way). Record the exact working path and parameter names | **Yes** | |
| M3 | Branded at 390px and 1280px: logo, colours, readable, no console errors, loads under about 3 seconds | Yes | |
| M4 | Disclosure and footer text can be shown on the main page **and** the results page. If not on results, the interstitial carries the disclosure and Task D says so | Yes (or documented fallback) | |
| M5 | Clicking a result sends the visitor out with our partner id (inspect the redirect URL; no purchase) | **Yes** | |
| M6 | No recurring fee, no minimum spend (G1) | **Yes** | |
| M7 | Rate shown in the dashboard or terms (30% or 50%); Aviasales program ECPC for the same period | Informational (G3) | |
| M8 | DNS record, proxy setting that worked, SSL issued, no Worker route shadowing | Yes | |
| M9 | Main-page custom HTML accepts `<script>` (informational; v1 adds no tracker) | No | |
| M10 | Font list contains Inter or Space Grotesk | No | |
| M11 | Widget type: renders results on a Sparkfare-hosted page, accepts URL prefill, and can take a **per-trip** sub-id | Decides Page vs Widget | |
| M12 | `noindex` meta accepted on the main page | Yes | |

**Verdict rules:** choose **Page** unless Widget passes M1, M2 and M4 on its own origin. **No-go** if M1 or M2 fails for both types, or M6 fails. Save the filled scorecard as `claude/fare_search_spike_scorecard_<date>.md` in the project and log the result in the decision log.

---

## 9. Task C: neutral copy pass (copy and tests only; ships first)

Branch `feat/fare-search-neutral-copy`. Depends on the 2026-10-07 referral-positioning pass. If that pass is not yet merged, this task layers on top of its PR.

**Why:** the arm is decided at click time, so any string that says "Aviasales" on a page or in an email is wrong for half the users once Fare Search is on. These strings are also better for the "fewer Aviasales mentions" goal today.

| Surface | Current wording (per the 10-07 spec) | Neutral wording |
|---|---|---|
| Deal card and hero button | `View fare on {partner} ↗` or `View fare ↗` | `View fare ↗` (always the short form) |
| Button aria-label | `View this fare on {partner} (opens in a new tab). Sparkfare does not sell or book travel.` | `View this fare (opens in a new tab). Sparkfare does not sell or book travel.` |
| Line under the deal grid | `Links go to Aviasales, which handles booking and payment...` | `Fare links lead to our travel search partners or the booking site you choose, which handle booking and payment. Sparkfare may earn a commission if you buy through a link, at no extra cost to you. Details` |
| Sitewide footer line 1 | `...When you click a fare, you buy from Aviasales or another site you choose.` | `...When you click a fare, you buy from the airline or booking site you choose.` |
| Email primary button | `Continue to Aviasales` | `View fare` |
| Email partner buttons | `View on {partner}` | unchanged |
| Interstitial heading | `Check this fare on Aviasales` | `Check this fare` |
| Interstitial button | `Continue to Aviasales ↗` | `Continue to fare search ↗` |
| Interstitial line under button | `Aviasales, not Sparkfare, confirms the final price...` | **Arm-specific, rendered from `trips.fare_path`** (see below) |

Interstitial line, arm-specific (the interstitial is server-rendered per trip, so it can know the arm):
- `direct`: `Aviasales shows live fares and handles booking and payment. Prices can differ from the fare shown here.`
- `wl`: `Next you'll see live fares from our travel search partners. You finish on the airline or booking site you choose, which handles booking and payment. Prices can differ from the fare shown here.`

**Keep named, for transparency:** `disclosure.html` keeps naming Aviasales and Travelpayouts as partners and gains one sentence: fare search results on `fares.sparkfare.com` are provided by Travelpayouts. Do not hide a material connection. Terms, privacy and blog posts may name partners factually.

**Guard:** extend `scripts/check-referral-copy.js`: flag `Aviasales` in user-facing strings outside an allowlist (`disclosure.html`, `privacy.html`, terms, blog posts, the registry display name, arm-specific interstitial strings). Add a test that renders each changed surface and asserts no banned phrase.

**Done when:** `npm run check:copy` and `npm test` pass; before and after table of every changed string; screenshots at 390px and 1280px; no behaviour or routing change. Size: 1 day.

---

## 10. Task B: plumbing behind flags (flag off, nothing merges before Oct 19)

**Blocked on:** Task S verdict (URL pattern, page vs widget, sub-id format), and G0 and G2.

### B1. Migration PR (alone; Coby applies it before the code PR merges)

File: `migrations/<next free number after 0019>_fare_search.sql` (verify the number in Task 0).

```sql
ALTER TABLE trips ADD COLUMN fare_path TEXT;          -- 'direct' | 'wl' | NULL for rows before this feature
ALTER TABLE trips ADD COLUMN fare_path_reason TEXT;   -- 'assigned' | 'allowlist' | 'control' | 'fallback_*'
CREATE TABLE IF NOT EXISTS fare_search_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  percent INTEGER NOT NULL DEFAULT 0,          -- 0 to 100
  surfaces TEXT NOT NULL DEFAULT 'home',       -- comma list: home,route,email_v2,pto
  allowlist TEXT NOT NULL DEFAULT '',          -- comma list of user ids that always get 'wl' when the master flag is on
  circuit_open INTEGER NOT NULL DEFAULT 0,     -- 1 = force 'direct'
  circuit_reason TEXT,
  salt TEXT NOT NULL DEFAULT 'fs1',
  updated_at TEXT DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO fare_search_state (id) VALUES (1);
-- Rollback: DROP TABLE fare_search_state; (columns on trips can stay; they are nullable)
```

Also update the inline `CREATE TABLE IF NOT EXISTS trips` in the `/api/trips` handler (or remove it if migrations now own the table) so a fresh database matches. Add a migration test like the 0016 and 0019 migration tests. If the spike shows `src` is not stored on trips, add `src TEXT` here.

### B2. Pure modules (`src/fareSearch.js`) with tests

- `bucketFor(userId, salt)` returns an integer 0 to 99 from a SHA-256 hash (WebCrypto). Same user gives the same bucket. Test the distribution on 10,000 synthetic ids (each decile within a few points).
- `resolveFarePath({ masterFlag, state, userId, src, originIata })` returns `{ path: 'direct' | 'wl', reason }`. Rules, in order: master flag not `"true"` gives `direct`; origin `TLV` or not in the US list gives `direct`; `circuit_open` gives `direct` (`fallback_circuit`); surface not in `state.surfaces` gives `direct`; user in allowlist gives `wl`; bucket below `percent` gives `wl`, otherwise `direct` (`control`).
- `parseAviasalesDestination(bookingLink)` returns the destination IATA from the `/search/{ORIGIN}{DDMM}{DEST}{DDMM?}{adults}` segment, or `null`. Fixtures must include links with and without a return date. Do not key by IATA anywhere else (GUA is shared by two destinations).
- `buildFareSearchUrl({ host, origin, destination, departAt, returnAt, adults, marker })` returns a URL or `null`. **Only the path and parameter names verified in Task S.** Dates formatted as the spike proved. Marker value is exactly `314524.{trip_id}`.
- Tests: every resolver rule; same user stable across calls; unparseable link falls back; one-way and round trip; URL never contains a brand name in the host; marker round trip; surface gating; TLV forced to direct.

### B3. Routing

In `/api/trips` after the trip is created: call `resolveFarePath`. If `wl`, build the Fare Search URL; if the builder returns `null` or the resolver throws, use the existing `direct` link and set `fare_path_reason = 'fallback_build'`. Store `fare_path` and `fare_path_reason` on the trip. Return `redirect_url` as today (`/departing/{trip_id}?url=...`).

In the `/departing` handler and `/out` handler: allowlist the Fare Search host wherever hosts are validated (Task 0 item 1). Add a registry entry for Fare Search (`status = pending` in the migration or seed; set `live` only after the spike test click). The interstitial Continue button for a `wl` trip goes through the same logged `/out/<fare-search-slug>?trip=...&src=...` path as every other partner. Keep `rel="sponsored noopener noreferrer"` and the new-tab behaviour that exists today.

### B4. Reconciliation

Update `reconcileBookings` after the spike records which campaign id(s) carry Fare Search bookings: match on `sub_id` across campaigns for `type = action` (a trip UUID is unique, so this is safe), keep the `paid` state rule, keep the booking-confirmed email trigger unchanged. If the spike cannot see Fare Search bookings (none occur before launch), the WL arm is capped at 10% until the first conversion confirms attribution (stop rule S5).

### B5. Admin routes (admin Bearer secret, same pattern as the Pinterest admin routes)

- `GET /admin/fare-search` returns state plus counts.
- `POST /admin/fare-search/config` sets `percent`, `surfaces`, `allowlist` (validates ranges and known surface names; logs an event).
- `POST /admin/fare-search/circuit` opens or closes the circuit with a reason.

### B6. Events (reuse T0 `logEvent`; no new tracker)

`fare_search_assigned` (path, reason, surface, percent), `fare_search_fallback` (reason). Add `fare_path` and `surface` to the existing `outbound_click` meta. Ignore bot requests via `src/botClass.js`. Add `isFlightOutbound(partner)` so `/admin/metrics` and the weekly standup count Aviasales and Fare Search outbound together (the pivot test must not change meaning).

**Done when:** with the master flag off, production behaviour is byte-identical (test it); with the flag on in a preview, percent 100 and a test user, a click lands on the Fare Search URL with the right marker; with percent 0, it never does; the circuit forces `direct`; a bad URL falls back; TLV is `direct`. Size: 3 to 4 days.

---

## 11. Task D: Fare Search page assets (files for Coby to paste into the dashboard)

Put the files in `docs/fare_search/` and add that folder to `.assetsignore`. Page-type only (menus and custom HTML are not available for Widget type).

**Design tab** (colours from `sparkfare_style_guide.md`):

| Dashboard field | Value | Note |
|---|---|---|
| Page background | `#EDE6D6` | Paper |
| Ticket cards background | `#E3D9C4` | Paper deep |
| Search form background | `#E3D9C4` | |
| Button background | `#2B2620` | Ledger. Spark gold stays reserved for the one deal signal, per the style guide |
| Button text | `#EDE6D6` | |
| Main text and headline text | `#2B2620` | |
| Links and icons | `#6B6255` | Ledger muted; about 4.6:1 on Paper (verify) |
| Border radius | smallest available | style guide prefers ledger rows over rounded cards |
| Font | Inter if listed, else the closest neutral | fonts are limited to TP's list |

**Custom HTML files** (written as files, pasted by Coby):
- `header.html`: Sparkfare mark (`sparkfare_mark.svg`, already public) and a menu to `https://sparkfare.com/`, `/away-mode`, `/trips`. Follow TP's header-menu markup.
- `footer.html`: the project's two footer lines, neutral: `Sparkfare is a deal-information service. We don't sell, book or arrange travel, and we never take payment. When you click a fare, you buy from the airline or booking site you choose.` and `Prices come from our travel search partners and can change at checkout. Sponsored links may earn Sparkfare a commission. Disclosure · Terms · Privacy` (links back to sparkfare.com).
- `meta.html`: `noindex`, title, description, favicon (`favicon.png`). The meta description must not use "book" phrasing.
- `popular.html`: the "popular destinations" block (the `Weedle` class per TP) reflecting Sparkfare's featured routes, only if the block can link to Sparkfare-valid searches; otherwise remove the block.

**Mitigations for gate G2** (if the spike shows the footer cannot appear on the results page, the interstitial disclosure carries it, and the Continue button text stays "fare search", never "book").

**Done when:** pasted into the dashboard, checked at 390px and 1280px on the main page and a results page; screenshots attached; no brand name in the host. Size: 1 day.

---

## 12. Task E: measurement, health circuit, standup

### E1. Health check workflow

`.github/workflows/fare-search-health.yml`, every 30 minutes at off-peak minutes (for example `11,41 * * * *`; confirm against the schedule list from Task 0), shared `concurrency` group, `workflow_dispatch` on. Each run: DNS resolves to the Travelpayouts target; HTTPS GET of the main page returns 200 within 5 seconds; one sample deep link returns 200 and not an error page. After 2 consecutive failures, `POST /admin/fare-search/circuit` opens the circuit and an alert goes through the revenue health monitor path if it exists (else the workflow's failure email). After 6 consecutive successes the circuit closes by itself (passive-ops rule: no manual step). Add the workflow to `tests/workflow_schedules.test.js`.

### E2. Arm comparison (read-only job or admin view; counts only, no new storage beyond `fare_path`)

Per arm and per surface: assigned, interstitial views, Continue clicks, fallbacks, and (from the TP statistics API, daily) clicks, paid and processing bookings and any earnings field Task 0 found. Join to D1 `trips` on `sub_id`. Show earnings per 100 Continue clicks when an earnings field exists. Show the White Label Project's own Performance numbers as a cross-check.

### E3. Weekly standup

Add a "Fare Search" block to `src/weeklyStandup.js`: percent, arm sizes, interstitial to Continue rate per arm, fallbacks, circuit state and any open-circuit time. Missing data shows as 0, never breaks the brief.

### E4. Privacy

Update `privacy.html` **before** the flag goes on: fare search on `fares.sparkfare.com` is operated by Travelpayouts and may set cookies for attribution. Coordinate with the other pending privacy edits (Away Move 3, PTO watches) so they do not conflict.

**Done when:** a deliberately failed health check opens the circuit in a test environment and resolver falls back to `direct`; standup renders with and without data. Size: 1 to 2 days.

---

## 13. Task F: rollout ladder and stop rules (owner-run)

**Ladder (each step needs your approval, G4):** allowlist only, then 10% on `home`, then 25% adding `route`, then 50% adding `email_v2` and `pto`. Ramp by `POST /admin/fare-search/config`; no deploy.

**Stop immediately** (set percent 0; do not wait for a review):
- S1. Fare Search host fails health checks for more than 1 hour while the circuit is not already open.
- S2. Fallback rate (`fare_search_fallback` over `wl` assignments) above 2% in any day with 50 or more assignments.
- S3. Interstitial to Continue rate in the `wl` arm is more than 25% (relative) below `direct` after at least 100 interstitial views per arm.
- S4. Any user report of a broken search, a wrong destination or dates, or "I booked with Sparkfare".
- S5. No trip-level conversion attribution visible in TP stats for the `wl` arm after 4 weeks at 10%: hold at 10%, do not ramp.
- S6. Email complaint breaker trips (existing circuit breaker).

**Decision rules to approve now** (starting values; thresholds beyond these are set after two weeks of real baselines, per the project convention): at Feb 12, if earnings per 100 Continue clicks in the `wl` arm are at least 90% of `direct`, adopt Fare Search as the default (the brand, funnel and Away Mode benefits cover the gap). Below 60%, revert and keep the neutral copy. In between, run to the next gate or use a hybrid (Fare Search for some surfaces only).

---

## 14. Task G: evaluation (read-only; Dec 11 and Feb 12)

Report from D1 and the TP statistics API: arm sizes and balance, assigned to interstitial to Continue by arm and surface, fallbacks, circuit open time, TP clicks and bookings per arm, earnings per 100 Continue clicks, plus the Away Mode attach rate (Away partner clicks per 100 active subscribers) and 7-day return-visit rate per arm if events exist. State plainly which numbers are too small to read. Recommend per stop rules and decision rules. Do not change anything.

---

## 15. Elevation (not built until Task G reads green; each a separate spec)

| # | Idea | Why it matters | Gate |
|---|---|---|---|
| H1 | **PTO windows with no cached fare** get a "Search live fares for these dates" link into Fare Search | The PTO spec's default state is "No fare seen yet" for most 2027 windows. This turns a dead end into a live path. | Task G green; PTO flags on |
| H2 | **Route pages**: "Search other dates" into Fare Search | Gives SEO visitors a reason to use the product without a cached deal | Task G green |
| H3 | `/check` price checker: "Compare with live fares" | Honest context for the checker | Task G green |
| H4 | Post-click email link "Search live fares" | Re-engages after the click | Task G green |
| H5 | Away Mode **hotel row** ("coming soon") could use a TP hotel widget in the same account | Fills the gap with no new application | Needs a DECISION: roadmap reopen trigger T3 (hotel, car or package partners scale up) applies |
| H6 | Weekly funnel in the standup from TP search and click-out stats | Adds the funnel T0 cannot see after the click | Task E done |
| H7 | Retire remaining "Aviasales" mentions in marketing copy | Final state if Fare Search is the default | Feb 12 decision |

---

## 16. Docs diff (separate small docs-only PR, per the roadmap's maintenance process)

Verify the next free step numbers first; the highest seen in project docs on 2026-10-10 was 75 (PTO). Proposed rows, Phase 3 (acquisition engines), "Depends on" in brackets:

- 76: Fare Search spike and scorecard (Task S). Not started. [Oct 16 go for any merge; G1]
- 77: Neutral referral copy v2 (Task C). Not started. [10-07 copy pass merged]
- 78: Fare Search plumbing, flags off (Task B). Not started. [76 verdict, G0, G2, PTO migration 0019 applied]
- 79: Fare Search page assets (Task D). Not started. [76]
- 80: Fare Search measurement, health circuit, standup (Task E). Not started. [78]
- 81: Fare Search rollout and evaluation (Tasks F, G). Gated. [78, 79, 80, G3, G4]
- 82: Fare Search elevation (H1 to H7). Gated. [81 green]
- Note on steps 43 and 47: "white-label" there means Sparkfare Engine; Fare Search is a different thing.
- Note on step 12 (revenue health monitor): add the Fare Search health check as a source.
- Note on step 17 (Seller of Travel): add trigger T6 below.
- Note on the Oct 2 launch date in Phase 0: reconcile with the Oct 17 dates in later specs.

Decision log lines to append (draft; you decide):
- `DECISION 2026-10-10`: evaluate a Travelpayouts White Label ("Fare Search") as a controlled experiment next to the Aviasales path; no routing change until the spike scorecard passes; ramp by D1 percent; decision at the Feb 12 gate; pre-agreed stop rules S1 to S6.
- `OPEN 2026-10-10`: G2 positioning. A branded multi-agency search on a Sparkfare subdomain is closer to "arranging travel" than a link-out. Owner to either accept the added risk knowingly (mitigations in Task D) or defer. Non-attorney guidance; no attorney consulted, consistent with the 2026-10-07 decision.
- `TRIGGER T6 (proposed)`: reopen the Seller of Travel decision if Fare Search generates user confusion about who sells the ticket (support messages or reviews saying "I booked with Sparkfare") or any regulator inquiry mentions it.
- `FACT 2026-10-10`: Travelpayouts White Label Web pays a 30% affiliate share per its help center (a marketing page says 50%); cost not found; White Label requires CNAME to `whitelabel.travelpayouts.com`; SSL within 48 hours; domain cannot contain brand names; results pages are not indexable. Sources in section 19.

Also update `CLAUDE.md` with the Fare Search flags, tables, admin routes and the reopen trigger T6, and `disclosure.html` and `privacy.html` as above.

---

## 17. Owner actions (Coby)

1. Decide G1 (cost) and G2 (positioning); run the Legal spoke first if you want the written non-attorney view.
2. Create the White Label (Page type, `fares.sparkfare.com`) and the throwaway Widget test; add the CNAME in Cloudflare; start the 24 to 72 hour clocks early.
3. Fill the scorecard. Pull the Aviasales ECPC for the last 30 days from TP (G3).
4. After Oct 19: confirm Task C may merge; apply the Fare Search migration after PTO's 0019; paste Task D files into the dashboard; set `percent` and `allowlist` by admin route; approve each ramp step.
5. At Dec 11 and Feb 12: read the Task G report and decide.

---

## 18. Risks and what I could not verify

**Could not verify (do not treat as true):**
- Whether Fare Search conversions appear in the statistics API under campaign 569853 or under agency campaigns (Task S and B4 settle it; nothing can be confirmed until a real purchase occurs).
- The exact Fare Search deep-link path and parameters, and whether Widget type accepts a per-trip sub-id.
- Whether the footer or disclosure can appear on the results page; whether custom scripts run; whether Cloudflare proxying works for the subdomain.
- The cost of White Label Web, and whether the reward share is 30% or 50% for your account.
- Whether the 2026-10-07 copy pass has merged. The repo is the source of truth, not the synced snapshot.

| Risk | Mitigation | Tripwire |
|---|---|---|
| Third-party outage on your own subdomain | Health circuit and `direct` fallback | S1 |
| Lower earnings per click | Randomised arms; pre-set decision rule; control stays | Feb 12 rule |
| Booked-status tracking breaks | Spike M1; B4; cap at 10% until first conversion | S5 |
| Positioning drift (seller-of-travel exposure) | G2, neutral copy, "we don't sell or book" footer on every surface, trigger T6 | S4, T6 |
| Price mismatch (cached vs live) | "From $X, as of" plus the interstitial line | S4 |
| Copy wrong for one arm | Neutral strings, check script rule | `npm run check:copy` |
| Pivot-test metrics change meaning | `isFlightOutbound` helper; same event name | Task G |
| Merge conflicts with PTO, Away and origins work | One PR at a time; rebase; ramp after Nov 1 | |
| Launch-week distraction | Nothing merges before Oct 19 | Launch rule |
| Plus Week 1 (Nov 16) overload | Hold changes that week except the kill switch | |

**Out of scope:** the Flight Search API build (a separate multi-week project if the White Label proves too limiting), CheapOair (stays off), a Sparkfare Engine or any partner-facing white label, new trackers, price predictions or deal badges on Fare Search results, and changing any pipeline output.

---

## 19. Sources

- Travelpayouts Help Center: What is White Label Web by Travelpayouts (support.travelpayouts.com/hc/en-us/articles/203955753)
- White Label Web Setup Guide (…/articles/16436383582226)
- Setting up a White Label with Page type (…/articles/115003591487) and Widget type (…/articles/26857907357458)
- How to set up White Label on the hosting (…/articles/115003590727) and CNAME settings in Cloudflare (…/articles/360011739360)
- How to add a menu to the White Label header and footer (…/articles/360029198051)
- What is the difference between the White Label Web versions (…/articles/26826111885074)
- ID and SubID (…/articles/203955653); Aviasales statistics (…/articles/203638548); API of affiliate programs booking statistics (…/articles/360019864079)
- Aviasales affiliate links (…/articles/5711895629714); Aviasales program tools (…/articles/203955643); landing pages with White Label (…/articles/360028037871)
- Travelpayouts White Label promo (travelpayouts.com/promo/whitelabel/en) and travel agency page (special.travelpayouts.com/wltravelagency)
- Travelpayouts blog: best travel affiliate programs and networks (travelpayouts.com/blog/best-travel-affiliate-programs-and-networks/)
- Sparkfare project files: ROADMAP_consolidated_2026-09-26, state_DECISION_LOG, state_SESSION_STATE, state_METRICS, claude_code_pto_fare_calendar_2026-10-09, claude_code_away_mode_four_moves_2026-10-08, claude_code_add_origins_2026-10-10, claude_code_referral_positioning_2026-10-07, claude_code_interstitial_page_refinements_2026-10-03, strategic_review_roadmap_2026-09-23, CLAUDE.md, src/index.js, Phase 1 Flight Fetch Script, wrangler.jsonc, sparkfare_style_guide.md.
