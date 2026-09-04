# Sparkfare — Project Context

## What this is

Sparkfare is a flight-deal alert site. The core mechanic: scan flight prices daily, flag genuine
deals (price meaningfully below a route's own 30-day trailing history), and use the emotional
"found a cheap flight" moment as the hook into a secondary product — "Away Mode," a curated set
of pre-trip services (travel insurance, pet/house care, connectivity) monetized via affiliate
commissions, positioned as "everything else, handled" so leaving for the trip feels effortless.

Full business rationale, market research, and feasibility scoring live in the project's Drive
docs (feasibility pipeline outputs, Away Mode market scan). This file covers technical state and
architecture — read the "Sparkfare - MASTER WORKPLAN (Consolidated)" Google Sheet for the full
step-by-step plan and status of every phase.

## Current live state (as of this session)

- **Domain**: sparkfare.com, registered via Cloudflare Registrar, deployed via Cloudflare Workers
  (NOT classic Pages — this project uses the newer unified Workers deployment flow).
- **Repo**: github.com/centeen/sparkfare — public (deliberate choice: the ranking logic isn't
  considered the real competitive moat; the Away Mode partnerships and business model are).
- **Frontend**: single self-contained `index.html` at repo root — vanilla HTML/CSS/JS, no
  framework, no build step. Warm sand/parchment palette (`--sand: #E8DCC5`, `--amber: #B8720F`),
  Space Grotesk + IBM Plex Mono. Fetches `sparkfare_ranked_deals.json`, `sparkfare_destinations.json`,
  and `sparkfare_images.json` client-side with `cache: 'no-store'` (a stale-cache bug cost real
  time earlier — don't remove this).
- **Data pipeline**: two Python scripts run daily via GitHub Actions
  (`.github/workflows/daily-fetch.yml`):
  1. `Phase 1 Flight Fetch Script (Step 8).py` — calls Travelpayouts `/v1/prices/cheap`,
     constructs Aviasales booking links manually (the API does NOT return a link field — confirmed
     by reading the actual docs, don't assume otherwise), writes `sparkfare_flight_prices.json`.
  2. `Phase 1 Deal Ranking Script (Step 9 - with fallback).py` — computes trailing averages
     (per-cluster thresholds: Cluster 1 25%, Clusters 2/3 15%, Cluster 4 no threshold — imagery-
     driven not deal-driven), requires 7 days of history before flagging a deal, carries forward
     stale fallback data across gap days without ever fabricating gaps. Writes
     `sparkfare_ranked_deals.json`.
- **Content**: `sparkfare_destinations.json` generated via Claude Haiku 4.5 (structured outputs,
  `client.messages.parse()`), one entry per destination — hook, 3 bullets, Away Mode transition
  line. Prompt explicitly forbids naming internal jargon (an earlier batch leaked "LCC" into
  customer-facing copy — don't reintroduce cluster-name language into user-facing text).
- **Images**: `sparkfare_images.json` via Unsplash API, 3-tier fallback (full query → shortened →
  bare destination name), 40/40 coverage achieved. Unsplash Demo tier = 50 requests/hour — the
  script detects 403 rate-limit responses and stops immediately rather than burning further
  attempts; safe to just rerun after the quota resets, it skips anything already fetched.
- **Affiliate**: Aviasales links built manually as `https://www.aviasales.com/search/{ORIGIN}{DDMM}
  {DEST}{DDMM}{ADULTS}?marker=314524` (confirmed working via manual test click + dashboard
  attribution). Applied and approved: SafetyWing, Airalo. Deliberately paused pending real
  traffic: World Nomads (CJ Affiliate, "coupon/discount site" exclusion risk), TrustedHousesitters
  (Impact.com, 5,000-follower eligibility bar not yet met).

## Architecture gotchas worth knowing before touching infra

- **Cloudflare Workers ≠ Cloudflare Pages.** This project deploys via the newer unified Workers
  flow (`wrangler.jsonc` + `npx wrangler deploy`), not classic Pages. Custom domains attach via
  the Worker's **Triggers** tab, not a Pages-style domain settings page.
- **An assets-only Worker (no `main` field) has NO server-side code at all.** D1 can only be
  accessed from within a Worker's `fetch` handler (`env.DB`) — never from client-side JS. If
  `wrangler.jsonc` has no `main` field, D1 bindings will show as unused/inactive because there's
  nothing to attach them to. Current config uses `main: "src/index.js"` with
  `assets.run_worker_first: ["/api/*"]` so API routes hit the Worker script and everything else
  still serves as plain static files.
- **GitHub Actions is free and unlimited on this public repo** regardless of run frequency —
  confirmed. The real constraint on scaling the fetch matrix (more origins, more frequent runs)
  is Travelpayouts' rate limit for the cached `/v1/prices/cheap` endpoint, which has never been
  confirmed with their support (flagged as an open blocker before Phase 11 scales origins).
- **Price history must be keyed by (origin, destination), not destination alone**, once multi-
  origin support is built — otherwise unrelated routes get silently blended into the same
  trailing average.
- **Sub-ID tracking for booking reconciliation**: append `.{trip_id}` to the marker
  (`marker=314524.{trip_id}`) and reconcile later via the CURRENT (non-deprecated)
  `api.travelpayouts.com/statistics/v1/execute_query` endpoint — the older `v2/statistics/sales`
  endpoints are deprecated, don't build against those.

## D1 schema (created, tables exist)

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,              -- Clerk's user ID, reused directly, no separate mapping
  email TEXT NOT NULL UNIQUE,
  verified_email INTEGER DEFAULT 0,
  origin_iata TEXT,
  pet_owner INTEGER,
  trip_length TEXT,
  subscription_tier TEXT DEFAULT 'free',
  created_at TEXT DEFAULT (datetime('now')),
  unsubscribed_at TEXT
);

CREATE TABLE trips (
  trip_id TEXT PRIMARY KEY,         -- also doubles as the sub_id on the booking link
  user_id TEXT NOT NULL REFERENCES users(id),
  destination TEXT NOT NULL,
  origin_iata TEXT NOT NULL,
  departure_at TEXT NOT NULL,
  return_at TEXT,
  price_at_click INTEGER NOT NULL,
  clicked_at TEXT DEFAULT (datetime('now')),
  status TEXT DEFAULT 'clicked'     -- 'clicked' or 'booked'
);
```

Database ID: `7228b5cb-54fd-4e4d-a7df-7e281f47bc8c` (bound in `wrangler.jsonc` as `DB`).

## Decisions locked for the next build phase (Phase 10 onward — not yet built)

- **Auth**: Clerk (native Cloudflare Workers support, no separate database bundled — avoids
  running D1 alongside a second auth-provider database).
- **Tier split**: FREE = 1 saved origin, daily-delayed refresh, full Away Mode checklist. PAID =
  up to 10 origins, hourly-fresh data, earlier access to new destinations.
- **Origin list (12, deliberately not more until the Travelpayouts rate limit is confirmed)**:
  JFK, LAX, ORD, ATL, DFW, SFO, MIA, IAD, EWR, SEA, IAH, BOS.
- **Refresh architecture**: two separate pipelines — an hourly fetch (the real data source, serves
  paid tier) and a separate daily job that compiles a delayed view from the hourly pipeline's
  already-fetched data for free tier (no duplicate Travelpayouts calls).
- **Monetization/billing is deliberately deferred** until free-tier signup traction is validated —
  do not build Stripe integration yet.

Full step-by-step task breakdown for all of this lives in the Master Workplan Google Sheet, not
here — this file is architecture/context, that sheet is the task tracker.

## Working style notes

- Test before shipping — every script in this repo has been validated against mocked or real data
  before being handed off, not just written and assumed correct (a real bug was caught this way:
  today's own price was leaking into its own trailing-average comparison).
- Keep the frontend framework-free. No React/build step has been introduced deliberately — match
  this unless there's a concrete reason to change it.
- FTC affiliate disclosure must appear before the first affiliate link on every page/email, not as
  a single blanket disclosure — this is a compliance requirement, not a style choice.
