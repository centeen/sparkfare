# Sparkfare — Project Context

## What this is

Sparkfare is a flight-deal alert site. The core mechanic: scan flight prices daily, flag genuine
deals (price meaningfully below a route's own 30-day trailing history), and use the emotional
"found a cheap flight" moment as the hook into a secondary product — "Away Mode," a curated set
of pre-trip services (travel insurance, pet/house care, connectivity) monetized via affiliate
commissions, positioned as "everything else, handled" so leaving for the trip feels effortless.

Full business rationale, market research, and feasibility scoring live in the project's Drive
docs. The Master Workplan Google Sheet (CSV copy also lives in this repo) has the full phase
breakdown and step-by-step status — this file is architecture/context, not the task tracker.

---

## Current live state — verified, not assumed

Status below is split into three honest tiers: **CONFIRMED** (a human actually saw it work),
**BUILT, UNVERIFIED** (code exists and tests pass, but nobody has confirmed it works live), and
**NOT STARTED**. Earlier versions of this file blurred these together — don't repeat that.

### Core data pipeline — CONFIRMED, running daily
- `Phase 1 Flight Fetch Script (Step 8).py` — calls Travelpayouts `/v1/prices/cheap`, builds
  Aviasales booking links manually (the API returns no link field). Now accepts a
  `SPARKFARE_ORIGINS` env var (comma-separated IATA codes) for multi-origin support; defaults to
  `JFK` alone when unset, preserving old behavior.
- `Phase 1 Deal Ranking Script (Step 9 - with fallback).py` — trailing-average deal detection,
  per-cluster thresholds, 7-day minimum history, stale-fallback carry-forward.
- Runs via GitHub Actions (`.github/workflows/daily-fetch.yml`) on schedule — this is the **data**
  pipeline, separate from the newer **email** pipeline described below.

### Frontend — CONFIRMED live
- `index.html` — vanilla HTML/CSS/JS, warm sand/parchment palette, WCAG AA contrast verified.
  Fetches `sparkfare_ranked_deals.json`, `sparkfare_destinations.json`, `sparkfare_images.json`
  with `cache: 'no-store'` (don't remove — a stale-cache bug cost real time earlier).
- 40/40 destination photo coverage via Unsplash, 3-tier fallback search.
- Content copy generated via Claude Haiku 4.5, jargon leak (internal cluster names in
  customer-facing text) found and fixed.
- **A live-breaking bug was found and fixed 2026-09-05**: `index.html` declared `let
  clerkPromise` twice at the same script scope (once inside `loadClerkForTracking`, once inside
  a near-identical `loadClerkForSignup`) — a fatal `SyntaxError` that killed the *entire* inline
  script, including `loadData()`. Net effect: **the live site was rendering zero deal cards** —
  just the empty signup form — with no visible error to a normal visitor, only in the browser
  console. Fixed by merging both into a single `loadClerk()` used by both the booking-tracking
  and signup-form code paths, then redeployed via `wrangler deploy`. Confirmed fixed live: fresh
  page load has no console errors and deal cards render with working "Book this fare" links.
  **If deal cards ever silently vanish from the live site again, check for a duplicate top-level
  `let`/`const` declaration killing the inline script before assuming it's a data-fetch issue.**

### Backend — now exists (it didn't before this session)
The project gained a real server-side layer this session. `wrangler.jsonc` now has a `main` entry
point (`index.js`) alongside the static assets, with `assets.run_worker_first: ["/api/*"]` so API
routes hit real code and everything else still serves as plain static files. **`npm init -y` was
run** — there's now a real `package.json` and `node_modules`. The frontend HTML/CSS/JS itself
remains framework-free; it's specifically the Worker backend that now has npm dependencies
(`@clerk/backend`, `@clerk/clerk-js`, `resend`, `dotenv`, `wrangler` as a dev dependency).

**D1 database** (`sparkfare-db`, ID `7228b5cb-54fd-4e4d-a7df-7e281f47bc8c`, bound as `DB`):
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,              -- Clerk's user ID, reused directly
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
  trip_id TEXT PRIMARY KEY,         -- also the sub_id on the booking link
  user_id TEXT NOT NULL REFERENCES users(id),
  destination TEXT NOT NULL,
  origin_iata TEXT NOT NULL,
  departure_at TEXT NOT NULL,
  return_at TEXT,
  price_at_click INTEGER NOT NULL,
  clicked_at TEXT DEFAULT (datetime('now')),
  status TEXT DEFAULT 'clicked'
);
```
A delivery-log table was also added to prevent duplicate same-day alert emails per user
(tracks per-user, per-UTC-day send attempts, marks failures as retryable separately from
successes).

**API routes that exist in code and pass tests (12/12 at last check, `tests/phase10.test.js`,
run via `node --test tests/phase10.test.js`):**
- `/api/health` — D1 connectivity check
- `/api/signup` — public alert signup. **Was buggy**: threw a misleading "Invalid JSON body"
  error on any database failure, including duplicate emails. Fixed to update existing records
  instead of failing, and to report the real error type.
- `/api/verify`, `/api/session`, `/api/account`, `/api/preferences` — auth-gated, reject
  unauthenticated requests (tested)
- `/api/trips` — POST, authenticated, creates a trip record and returns a marker-tagged
  Aviasales URL (`marker=314524.{trip_id}`)

### Auth — CONFIRMED working, but read the gotcha below carefully
Clerk sign-in, sign-up, and the authenticated account/preferences flow are **confirmed working
live** — a real user signed up, logged in, and saved preferences successfully.

**Getting here took real debugging — don't redo this work.** The failure was never the API key
(multiple false leads suspected the key format itself was invalid — it wasn't). The actual fix:
Clerk's current standalone CDN setup requires loading **two separate script bundles** — the
Clerk UI bundle and the ClerkJS bundle — then calling:
```js
await clerk.load({ ui: { ClerkUI: window.__internal_ClerkUICtor } });
clerk.mountSignIn(document.getElementById('clerk-root'), { appearance: {...} });
```
A single `<script src="...clerk.browser.js" data-clerk-publishable-key="...">` tag is **not**
sufficient on its own — that was the whole source of the "Missing publishableKey" and "not loaded
with UI components" errors across many failed attempts. Auth0 was seriously considered as a
fallback during this — don't revisit that; the Clerk integration works now, this was purely an
implementation bug.

**⚠️ There are two Clerk applications now.** The original app (`present-insect-7124...`) got
replaced mid-session by a second one called "sparkfare2" (`romantic-gorilla-2088...`) after
dashboard confusion. **The live site currently uses the sparkfare2 app's keys.** If you go looking
in Clerk's dashboard later, make sure you're looking at sparkfare2, not the original — the
original may be an orphaned, unused application at this point.

### Daily alert email — CONFIRMED delivered live (2026-09-05)
A Cloudflare Worker **Cron Trigger** (separate scheduling mechanism from the GitHub Actions data
pipeline — don't conflate the two) sends daily alert emails at 08:00 UTC to verified,
non-unsubscribed users. Per-recipient failures are isolated so one bad send doesn't abort the
batch. One-click unsubscribe links are included (no login required, tested).

**A real bug was found and fixed here**: the public alert-signup form created a separate,
unverified `local_*` D1 record even for a signed-in, Clerk-verified user — so the Cron job's
`verified_email = 1` filter silently excluded real users. Fixed by linking alert signup to the
authenticated Clerk session when one exists.

**A compliance bug was also found and fixed**: the daily email template originally placed
affiliate booking links *before* the FTC disclosure. Fixed — disclosure now appears first.

**A second real bug was found via manual test send**: `sendVerificationEmail` and
`sendDailyDealEmail` (`src/email.js`) called `resend.emails.send()` and returned `{ ok: true,
mocked: false }` unconditionally, never checking `response.error`. The Resend SDK does **not**
throw on API-level rejections (e.g. an unverified sending domain) — it returns that error inside
the response object instead. Net effect: a manual test send reported `{"ok":true,"sent":true,
"mocked":false}` while silently failing to send anything, because **the `sparkfare.com` sending
domain had never been verified in Resend.** Fixed by throwing when `response.error` is present,
and by having `/api/send-daily-alert` and `/api/verify` surface the real error (502 with the
actual Resend message) instead of the old generic "Invalid JSON body" catch-all that masked it.
`/api/verify`'s DB write and email send are now also decoupled — a Resend failure no longer
prevents a successful `verified_email` DB update from being reported.

**Root cause + fix**: the `sparkfare.com` domain was added to Resend but its DNS records (DKIM,
SPF via an MX + TXT pair, DMARC) had never been added in Cloudflare. Added them manually. Gotcha
worth remembering: Resend's dashboard truncates long values for display (`feedback[...]ses.com`,
`p=MIGfMA[...]wIDAQAB`) — typing the truncated placeholder text in verbatim (literal `...`
included) produces an invalid record that silently blocks verification with no clear error.
The MX host and SPF TXT value are **not domain-specific** and can be typed directly:
`feedback-smtp.us-east-1.amazonses.com` (priority 10) and `v=spf1 include:amazonses.com ~all`.
The DKIM TXT value **is** domain-specific and must be copied in full from Resend (copy icon,
selecting the cell's text, or `GET https://api.resend.com/domains` via the Resend API) — never
retyped from the truncated display.

**Confirmed working end-to-end**: after fixing DNS, verifying the domain in Resend, and
redeploying the error-surfacing fix, a manual test send to a real inbox showed up in Resend's own
delivery log as "Delivered" and was found by the recipient — **in Gmail's Promotions tab**, not
Primary or Spam. Worth remembering if a future "user says they never got the email" report comes
in — check Promotions before assuming a delivery failure.

### Phase 10b — Trip Tracking: interstitial CONFIRMED working live; rest not started
Per an explicit audit run mid-session, **none of Phase 10b existed before this build session.**
Current state after this session:

- **Trips table + sub-ID marker**: built (see D1 schema and `/api/trips` above)
- **Interstitial redirect page** (`/departing/{trip_id}`): **CONFIRMED working live** (verified
  2026-09-05). The earlier Cloudflare Error 1101 is resolved — `wrangler.jsonc` now routes
  `/departing/*` through `run_worker_first`, and `src/index.js`'s default `fetch` handler serves
  the interstitial HTML directly (no asset-proxy hop). Verified two ways: a same-origin `fetch()`
  to `/departing/{id}?url=...` returns HTTP 200 with the teaser HTML, and clicking a live "Book
  this fare" link while signed out correctly ran `trackBookingClick` → Clerk session check → no
  token → redirect to `/sign-in` (the designed fallback for unauthenticated visitors). Full
  authenticated click-through (real Clerk session → `/api/trips` → interstitial → Aviasales with
  `marker=314524.{trip_id}`) still hasn't been observed with a real logged-in user — that's the
  one remaining gap before calling the whole loop confirmed end-to-end.
- **Click-triggered Away Mode follow-up email**: **BUILT, delivery UNCONFIRMED** (2026-09-05).
  `sendAwayModeFollowUpEmail` in `src/email.js` fires from `/api/trips` after a successful trip
  insert — looks up the user's real email from D1 (`SELECT email FROM users WHERE id = ?`,
  falling back to the Clerk session email if not found), then sends via `ctx.waitUntil()` so the
  API response returns immediately without waiting on the email (falls back to a direct `await`
  if `ctx` isn't available, e.g. in tests). Currently only SafetyWing is listed as an Away Mode
  partner in the email (see `AWAY_MODE_PARTNERS` in `src/email.js`) — Airalo is deliberately
  left out until its Impact.com application is approved and a real tracking link exists; adding
  a placeholder/guessed link would silently break tracking. FTC disclosure appears before the
  partner list. Unit-tested for the mocked-delivery path (`tests/phase10.test.js`); the
  authenticated end-to-end path (real Clerk session → `/api/trips` → this email actually
  arriving) has NOT been observed live yet — same "code should work, unconfirmed live" gap as
  the daily alert email had before that was checked.
- **Sub-ID reconciliation job** (Travelpayouts statistics API): NOT STARTED
- **Booking-confirmed follow-up email**: NOT STARTED
- **"My Trips" dashboard**: NOT STARTED

### Phase 11 — Multi-Origin: partially built, deliberately gated
- Fetch script accepts `SPARKFARE_ORIGINS`, defaults safely to JFK-only — **built**.
- Price history and stale-fallback keys are now **origin-qualified** (the composite-key
  correctness fix, done correctly) — **built**.
- Separate output paths so hourly multi-origin data doesn't collide with the daily single-origin
  feed — **built**.
- A second GitHub Actions workflow (`hourly-multi-origin-fetch.yml`) exists but is
  **manual-trigger-only** and requires an explicit `CONFIRMED` input before it will run anything —
  a deliberate safety gate. **Do not enable a schedule on this workflow** until the item below
  is resolved.
- A `Phase 11 Compile Free Tier View.py` script selects a snapshot at least 24 hours old from the
  hourly archive for delayed free-tier serving. Uses the **timestamp encoded in the filename**,
  not filesystem mtime — GitHub Actions checkout resets file mtimes, which would otherwise pick
  the wrong snapshot. Preserve this design if touching the file.
- **Travelpayouts rate-limit confirmation: ticket submitted, no response received yet.** Still the
  hard blocker on enabling hourly fetching for real. Don't proceed past manual-trigger testing
  until this comes back.
- **Frontend origin selector UI: NOT built.** An earlier status update assumed this was done —
  it wasn't. There's no dropdown or origin-switching UI on the live site yet.
- **Phase 12 (tiered refresh serving, trailing-average fix for hourly sampling): NOT STARTED.**

### Local dev environment gotchas (cost real time this session, don't rediscover)
- This machine didn't have Node.js — installed via `winget install --id OpenJS.NodeJS.LTS`.
- PowerShell's execution policy and PATH resolution caused repeated failures running
  `npm`/`npx`/`wrangler` directly. Working fallbacks used throughout: explicit full paths
  (`"C:\Program Files\nodejs\npx.cmd"`), `cmd /c "..."` wrapping, or invoking via Python's
  `subprocess.run(...)`. If a plain `npx wrangler deploy` mysteriously fails or produces no
  output, this PATH/policy issue is the first thing to suspect, not the code.
- `wrangler deploy` failed once because the project root (containing `node_modules`) was being
  treated as the static assets directory. Fixed with a `.assetsignore` file. If deploy errors
  mention bundle size or unexpected files, check this first.
- There are **two Cloudflare Workers** in this account: `sparkfare-app` (the real one — has the
  API code, the D1 binding, the correct domain route) and `sparkfare` (stale/unused). Don't
  confuse them when checking the dashboard.
- `wrangler` requires `npx wrangler login` (browser OAuth) before `wrangler secret put` will work.
- The Cloudflare dashboard's "New Deployment" button prompts for a manual file upload — that's
  the wrong path for this project. Deploys should go through `wrangler deploy` from the CLI.
- **`.gitignore` was missing `.env`** (only had `node_modules`) despite this being a **public**
  repo — found and fixed 2026-09-05. Local `.env` currently holds empty secret values (real
  secrets are set via `wrangler secret put` on the Worker, not this file), so nothing has leaked,
  but a future `git add -A` before this fix would have committed real keys straight into public
  GitHub history the moment someone filled the file in for local dev. `.gitignore` now excludes
  `.env`/`.env.local`/`.wrangler` while explicitly keeping `.env.example` (`!.env.example`)
  trackable as the template.

---

## Everything else from the original plan (unchanged since last update)

- **Domain**: sparkfare.com, Cloudflare Registrar, deployed via Cloudflare Workers (not Pages).
- **Repo**: github.com/centeen/sparkfare — public, deliberately (ranking logic isn't the
  competitive moat; Away Mode partnerships and business model are).
- **Affiliate**: SafetyWing applied and approved — real referral link confirmed 2026-09-05:
  `https://safetywing.com/nomad-insurance?referenceID=26593442&utm_source=26593442&utm_medium=Ambassador`.
  **Airalo is NOT approved yet** — this contradicts an earlier version of this file that said
  "applied and approved." Corrected 2026-09-05: Airalo runs through Impact.com, and as of that
  date its status there is "waiting for approval." Do not add an Airalo link to any live surface
  until it's actually approved and a real Impact.com tracking link is generated — don't guess at
  Impact.com's link format, it varies per account/campaign. World Nomads and TrustedHousesitters
  deliberately paused — World Nomads pending Safe Browsing clearance (now cleared, worth
  reapplying), TrustedHousesitters pending a real subscriber count to meet their 5,000-follower
  eligibility bar.
- **Sub-ID reconciliation**, when eventually built, must use the current
  `api.travelpayouts.com/statistics/v1/execute_query` endpoint — the older `v2/statistics/sales`
  endpoints are deprecated.
- **Google Search Console**: user-confirmed 2026-09-05 that sparkfare.com now shows clear, no
  issues detected (the earlier inherited Safe Browsing false-positive is fully resolved).

## Decisions locked (still current)

- **Auth**: Clerk (confirmed working, see gotcha above)
- **Tier split**: FREE = 1 saved origin, daily-delayed refresh, full Away Mode checklist. PAID =
  up to 10 origins, hourly-fresh data, earlier access to new destinations.
- **Origin list (12, capped until Travelpayouts rate limit confirmed)**: JFK, LAX, ORD, ATL, DFW,
  SFO, MIA, IAD, EWR, SEA, IAH, BOS.
- **Refresh architecture**: two pipelines — hourly fetch (real data source) + a separate daily
  job compiling a delayed view from the hourly pipeline's own data (no duplicate API calls).
- **Monetization/billing deliberately deferred** until free-tier signup traction is validated —
  do not build Stripe yet.

## Immediate next steps, in order

1. ~~Fix and confirm `/departing/{trip_id}` actually renders live~~ — **DONE 2026-09-05**,
   confirmed working (see Phase 10b section above). Remaining gap: a full authenticated
   click-through with a real logged-in Clerk user hasn't been observed yet.
2. ~~Actually confirm a daily alert email arrives in a real inbox~~ — **DONE 2026-09-05**,
   confirmed delivered (see Daily alert email section above). Required verifying the
   `sparkfare.com` domain in Resend, which hadn't been done before.
3. Resume Phase 10b: click-triggered Away Mode email, sub-ID reconciliation job,
   booking-confirmed email, My Trips dashboard — in that order.
4. Frontend origin selector UI is still genuinely unbuilt — needed before multi-origin support
   is usable by an actual visitor, independent of the Travelpayouts rate-limit question.
5. Keep checking for a Travelpayouts support response before touching the hourly workflow's
   `CONFIRMED` gate.

## Working style notes

- Test before shipping — this project has a real test suite now (`tests/phase10.test.js`), keep
  it green and keep adding to it rather than treating tests as optional.
- When something "should work" per the code/tests but hasn't been confirmed live, say so plainly
  — this session had multiple points where code was correct but deployment/live behavior lagged
  behind, and conflating "tests pass" with "confirmed working in production" cost real time.
- Keep the frontend framework-free even though the backend now has real dependencies — these are
  two different layers with two different constraints.
