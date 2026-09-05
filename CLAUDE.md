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

**A round of UI/design fixes shipped 2026-09-05**, from an explicit design review:
- **Leaked engineering copy removed.** The signup panel used to read "This is the Phase 10
  validation step for the account layer," and the post-signup success message referenced "the
  next Phase 10 steps" — both internal dev notes that had no business being customer-facing.
  Replaced with plain copy describing what the alert actually does.
- **The disclosure link now goes somewhere.** `<a href="#">Read our disclosure</a>` was a dead
  placeholder despite the disclosure itself being marked done. Built a real `disclosure.html`
  with FTC-oriented affiliate disclosure content (current partners, and an honest statement that
  commissions don't influence ranking, since the ranking algorithm is purely price-history-based
  — verified against the actual ranking code, not assumed). **This page's content has not had a
  legal/compliance review — flag it for that before treating the compliance gap as fully closed.**
- **Cross-page navigation added.** There was no way to reach Trips, Preferences, or Privacy
  without knowing the URL. Added a lightweight nav to `index.html`'s header and to the top of
  `account.html`, `trips.html`, `privacy.html`, and the new `disclosure.html`.
- **ARIA state added to the card "More" toggle.** It only ever flipped a CSS class before —
  screen reader users got no signal that pressing it changed page state. Now sets
  `aria-expanded`/`aria-controls` and flips the visible label between "More"/"Less".
- **Visual hierarchy for card sections.** "Building history" cards (nothing to act on yet) now
  render in a dimmed/desaturated `.grid-dimmed` treatment instead of looking identical to actual
  deals, so scanning the board is faster.
- **Amber color reserved for deal signals only.** Amber was simultaneously the CTA button color,
  the price color, the general link color, and (per the design review) assumed to be the deal
  badge color — spreading one color across four different jobs meant it couldn't function as a
  "there's a discount here" signal on its own. Note: the actual pre-fix code had the DEAL badge
  in **sage**, not amber, which was itself backwards. Fixed by moving CTAs/links/decorative
  accents (buttons, the "More" toggle, the sign-in link, bullet markers) to **sage**, and making
  price text amber *only* when `item.status === 'deal'` (`.hero-price.is-deal` /
  `.card-price.is-deal`) — otherwise it's the plain text color. The DEAL badge itself is now
  amber. Verified live: today's board has no routes currently flagged as deals, so no amber
  appears anywhere right now — that's correct behavior, not a bug.
- **Loading skeleton added.** The board fetched three JSON files before rendering anything below
  the signup panel; on a slow connection the page just looked empty. Added a static pulsing
  skeleton grid in the initial HTML (not JS-rendered, so it shows even before the script runs),
  cleared automatically once real content replaces it via the existing `innerHTML` writes.
  Respects `prefers-reduced-motion`.
- **Interstitial auto-continue delay increased from 700ms to 2500ms**, giving the Away Mode
  teaser text enough time to actually register before redirecting — the manual "Continue to
  booking" link was already shown immediately as the impatient-user escape hatch, so this covers
  both suggested fixes (longer delay, and a manual dismiss option) without needing a redesign.
  **Also found and removed `departing.html`** — a static file duplicating this exact interstitial
  that had been dead code since `wrangler.jsonc` started routing `/departing/*` through
  `run_worker_first`; only the inline HTML string in `src/index.js`'s `fetch` handler is ever
  actually served. Editing the dead file instead of the live one would have looked like a fix
  while changing nothing — worth remembering if this interstitial needs touching again.

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

### Auth — CONFIRMED working end-to-end as of 2026-09-05 (frontend AND backend)
Clerk sign-in, sign-up, and the authenticated account/preferences flow are **confirmed working
live** — a real user signed up, logged in, and saved preferences successfully. This was true of
the frontend/browser side from an earlier session. **What was NOT actually true until this
session**: server-side token verification. Despite the "CONFIRMED working" label this file
carried before, `getClerkSession`'s call to `verifyToken` had two real, previously-undiscovered
bugs that meant **every single authenticated backend API call had always failed with 401**,
silently, for the entire life of this codebase — the test suite never caught it because it only
ever exercises the unauthenticated (401) path, never a real verified token.

**Bug 1 — wrong call signature.** `@clerk/backend@3.17.1`'s `verifyToken` signature is
`verifyToken(token: string, options: VerifyTokenOptions)` — two positional arguments. The code
called it as `verifyToken({ token, secretKey })`, a single object. Clerk received the whole
options-shaped object where it expected the raw token string and threw "Invalid JWT form. A JWT
consists of three parts separated by dots." regardless of how well-formed the actual token was
(confirmed identical token shape — 832 chars, 3 parts — on both client and server before and
after the fix). **Fixed**: `verifyToken(token, { jwtKey, secretKey })`.

**Bug 2 — secretKey-only verification doesn't work reliably for this app.** Even after fixing the
call signature, `secretKey`-only verification (which does a live network call to Clerk's Backend
API to fetch JWKS) failed with "Unable to find a signing key in JWKS that matches the kid=...".
Clerk's own docs recommend **networkless verification via `jwtKey`** (the PEM public key from the
dashboard's API Keys page) specifically for edge/serverless runtimes like Cloudflare Workers —
**fixed** by adding the `CLERK_JWT_KEY` Worker secret (the PEM public key — this is NOT sensitive,
it's explicitly a public key, safe to read/paste unlike the secret key) and passing `jwtKey:
env.CLERK_JWT_KEY` alongside `secretKey` in the `verifyToken` call.

**Bug 3 — signup never migrated a placeholder `local_*` id to the real Clerk id.** Even with auth
fixed, `/api/signup`'s existing-row `UPDATE` branch never touched `id` or `verified_email` — so a
real signed-in user whose email already had a stale `local_*` row (from the earlier
public-signup-before-Clerk-fix era) would keep that placeholder id forever, and any later
`/api/trips` insert would fail on the `trips.user_id → users.id` foreign key, since no row existed
with the real Clerk id. **Fixed**: the `UPDATE` now sets `id`/`verified_email` to the
Clerk-verified values **only when `session.authenticated` is true** — an unauthenticated resubmit
of the public form can never downgrade an already-linked, verified row.

**All three fixes verified together, live, in one real click-through** (2026-09-05): signed-in
user → `/api/signup` correctly migrated `local_1788535400136` → `user_3IsD19oWXxyui2nwkOd4QfiAlou`
with `verified_email = 1` → `/api/trips` created a trip row with the correct FK →
`/departing/{trip_id}` rendered and redirected with the tagged marker → the Away Mode follow-up
email (see Phase 10b below) was received in the real inbox. This is the first time the full
authenticated booking-tracking loop has ever worked.

**Diagnostic tools worth remembering for next time**: `wrangler tail --format pretty` streams
live Worker console output — essential since none of these failures were visible from the API
response alone (the routes deliberately return generic "Not authenticated"/"Unable to..."
messages, not the real exception). On this machine, `npx wrangler d1 execute ... --command "..."`
reliably fails with `'C:\Program' is not recognized...` (a Windows quoting bug in wrangler's own
argument handling) — the fix is to bypass the `.cmd` shim entirely: `node
node_modules/wrangler/bin/wrangler.js d1 execute ... --command "..."` works fine. `--file=path.sql`
also avoids the bug but only prints summary stats, not row contents, for SELECT queries — use it
for schema/migration changes, not for inspecting data.

**⚠️ There are two Clerk applications now.** The original app (`present-insect-7124...`) got
replaced mid-session by a second one called "sparkfare2" (`romantic-gorilla-2088...`) after
dashboard confusion. **The live site currently uses the sparkfare2 app's keys.** If you go looking
in Clerk's dashboard later, make sure you're looking at sparkfare2, not the original — the
original may be an orphaned, unused application at this point.

**Password auth enabled 2026-09-05.** The app was originally email-verification-code-only,
which by design emails a fresh one-time code on *every* sign-in with no "remember me" — the
user found this too much friction on repeat sign-ins. Fixed by enabling **Password** as a sign-in
method in Clerk's dashboard (Configure → User & authentication → Email, phone, username), so
returning users can sign in with email + password instead. Email-code verification is presumably
still available/used for initial signup — this wasn't independently re-tested after the change.

**Getting the frontend mounting working (from an earlier session) took real debugging too — don't
redo this work.** The failure was never the API key (multiple false leads suspected the key format
itself was invalid — it wasn't). The actual fix: Clerk's current standalone CDN setup requires
loading **two separate script bundles** — the Clerk UI bundle and the ClerkJS bundle — then
calling:
```js
await clerk.load({ ui: { ClerkUI: window.__internal_ClerkUICtor } });
clerk.mountSignIn(document.getElementById('clerk-root'), { appearance: {...} });
```
A single `<script src="...clerk.browser.js" data-clerk-publishable-key="...">` tag is **not**
sufficient on its own — that was the whole source of the "Missing publishableKey" and "not loaded
with UI components" errors across many failed attempts. Auth0 was seriously considered as a
fallback during this — don't revisit that; the Clerk integration works now, this was purely an
implementation bug.

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
  authenticated end-to-end path is now **CONFIRMED** (2026-09-05) — see the Auth section above
  for the full chain that made this possible (backend token verification was broken until this
  session; the email genuinely could not have sent before these fixes).
- **Sub-ID reconciliation job** (Travelpayouts statistics API): **BUILT 2026-09-05, delivery
  UNVERIFIED** (can't be confirmed until a real paid booking actually occurs — this is an
  inherent limitation, not a shortcut taken). `reconcileBookings()` in `src/index.js` runs daily
  alongside the alert-email Cron and is also exposed as `POST /api/reconcile-bookings` for manual
  testing. **The exact request contract was verified against Travelpayouts' own Help Center
  article** (not guessed, after the Aviasales-link and Airalo-link lessons) — key facts that
  differ from the Data API used elsewhere in this project: auth goes in an `X-Access-Token`
  header (not a `token` query param), the endpoint is synchronous (single request/response, no
  polling), and a `campaign_id` filter is required — this is a *different* numeric ID than the
  `314524` Aviasales affiliate marker used in booking links, found via the program page URL in
  the Travelpayouts dashboard (`app.travelpayouts.com/programs/<id>/about`); confirmed as
  `569853` directly from the user's dashboard, not assumed. The job pulls `trips` rows with
  `status = 'clicked'` from the last 30 days, queries Travelpayouts for paid actions on that
  campaign in the same window, and matches the API's `sub_id` field against `trips.trip_id`
  (this assumes Travelpayouts splits the `marker=314524.{trip_id}` format on the first dot and
  returns only the `{trip_id}` portion as `sub_id` — consistent with the docs' example, but only
  a real conversion will fully confirm it). Requires the `TRAVELPAYOUTS_TOKEN` Worker secret
  (same value already used in GitHub Actions, just also set via `wrangler secret put` for the
  Worker) — until that's set, both the Cron and the manual endpoint report `mocked: true` rather
  than silently doing nothing.

  **`TRAVELPAYOUTS_TOKEN` set 2026-09-05** — hit the same PowerShell execution-policy issue as
  before running `npx` directly (`npx.ps1 cannot be loaded because running scripts is
  disabled`); fixed the same way, with `npx.cmd` instead. A manual `POST /api/reconcile-bookings`
  call now returns a real (non-mocked) result — `{"checked":1,"matched":0,"updated":0}` — meaning
  the token is valid, the campaign_id is correct, and Travelpayouts genuinely returned data (0
  matches is expected: the only tracked trip so far was a test click, not a real purchase). This
  is as much confirmation as possible without an actual booking.
- **Booking-confirmed follow-up email**: **BUILT 2026-09-05, delivery UNVERIFIED** — same
  inherent limitation as the reconciliation job itself: it only fires when `reconcileBookings()`
  finds a real paid conversion, which hasn't happened yet. `sendBookingConfirmedEmail` in
  `src/email.js` reuses the `AWAY_MODE_PARTNERS` list so partner content isn't duplicated across
  emails. Unit-tested for the mocked-delivery path.
- **"My Trips" dashboard**: **BUILT and CONFIRMED live 2026-09-05** (`trips.html`, linked from
  `account.html`). Same Clerk mount pattern as the account page; fetches `GET /api/trips`
  (new, authenticated) and renders each trip with a clicked/booked status badge. **Fully
  confirmed live 2026-09-05** — both the unauthenticated redirect to `/sign-in` and the real,
  signed-in trip list rendering have been observed directly by the user.
- **Homepage had no visible sign-in/sign-up entry point**: found and fixed 2026-09-05 — the
  only path to `/sign-in` was the indirect redirect from clicking "Book this fare" while signed
  out. Added a plain "Sign in" link to the header.

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
- **Frontend origin selector UI: BUILT and CONFIRMED live 2026-09-05** (`index.html`, the
  `.origin-bar` control above the hero section). **A real architectural gap was found while
  building this**: there is currently no per-origin data being produced anywhere in the
  pipeline — `Phase 1 Deal Ranking Script`'s `RANKED_OUTPUT_PATH` and `Phase 11 Compile Free
  Tier View.py`'s output both only ever write ONE origin's data at a time (JFK by default), and
  the hourly multi-origin workflow has never actually been run. So the selector deliberately does
  **not** pretend other origins have real data: choosing anything but JFK shows an honest
  "aren't live yet" message with a one-click reset back to JFK, instead of silently displaying
  JFK deals mislabeled as another city. The selection persists via `localStorage`
  (`sparkfare_selected_origin`) — a per-viewer display preference, not account state, so it
  doesn't touch D1. Verified live: switching the dropdown shows the correct empty state, the
  reset link restores the real board, and the choice survives a page reload.
- **Phase 12 (tiered refresh serving, trailing-average fix for hourly sampling): NOT STARTED.**
  This is the actual blocker before the origin selector can show real non-JFK data — the
  selector UI itself is no longer the missing piece, the per-origin serving layer is.

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
- **A stray `Users.lnk` Windows shortcut** (pointing at `C:\Users`, clearly an accidental
  drag/drop artifact, not project content) ended up in the repo root and got deployed as a
  public static asset at `sparkfare.com/Users.lnk` before anyone noticed — found and removed
  2026-09-05, with `*.lnk` added to `.assetsignore` so it can't happen again silently. Worth a
  quick glance at `wrangler deploy`'s "new or modified static assets" list occasionally, since
  it will happily upload anything sitting in the project root that isn't explicitly ignored.

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
- **New Away Mode affiliate candidates researched (not yet applied)**, per the reconciled Master
  Workplan v3 CSV: **Priority Pass** (airport lounge access, 10% commission, 30-day cookie,
  ~€259 average sale) is the best fit — it runs through **Travelpayouts**, the same platform
  already used for Aviasales, so no new account setup is needed. **TaskRabbit** (via Impact,
  ~$10–20 per booked job) covers both plant/garden care and vehicle care as one application,
  since neither has its own dedicated affiliate program. **Babbel** (via Impact,
  destination-tied language learning) has publicly inconsistent commission terms across sources
  ($32 flat / $10 flat / 15% / 50% recurring) — confirm the real terms only once actually
  approved and visible in the dashboard, don't trust any single public source. **Duolingo has no
  public affiliate program** — confirmed, don't pursue it as a Babbel alternative.
- **Confirmed dead ends — do not revisit**: TSA PreCheck/Global Entry (government-only process,
  no viable affiliate route) and Airbnb as a home-sitting-while-away angle (their affiliate
  program shut down in 2021; remaining referral programs pay capped travel credit, not cash).
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

1. ~~Fix and confirm `/departing/{trip_id}` actually renders live~~ — **DONE 2026-09-05**.
2. ~~Actually confirm a daily alert email arrives in a real inbox~~ — **DONE 2026-09-05**.
   Required verifying the `sparkfare.com` domain in Resend, which hadn't been done before.
3. ~~Click-triggered Away Mode follow-up email, confirmed authenticated end-to-end~~ —
   **DONE 2026-09-05**. This required discovering and fixing that backend Clerk token
   verification had never actually worked at all (wrong `verifyToken` call signature, plus
   needing `jwtKey` for networkless verification), and a signup bug that never migrated a
   placeholder `local_*` user id to the real Clerk id. See the Auth section above for the full
   story. Remaining Phase 10b work: sub-ID reconciliation job, booking-confirmed email, My Trips
   dashboard — in that order.
   Note: two other pre-existing `local_*` rows in D1 (`centeen@yahoo.com`, `mrcobye@aol.com`)
   are still unmigrated — they'll self-heal the next time those accounts sign in and resubmit
   the alert form, same as just happened for `centeen@gmail.com`.
4. ~~Sub-ID reconciliation job~~ — **BUILT 2026-09-05**, `TRAVELPAYOUTS_TOKEN` is set and a
   manual test confirmed it makes a real (non-mocked) call to Travelpayouts and returns real
   data. Delivery of an actual match is still unverified pending a real paid booking — see
   Phase 10b section above.
   ~~Booking-confirmed email~~ and ~~My Trips dashboard~~ — both **BUILT 2026-09-05**. This
   closes out Phase 10b's build work; only end-to-end verification against a real booking
   remains, which can only be observed, not forced.
5. ~~Frontend origin selector UI~~ — **BUILT and CONFIRMED live 2026-09-05** (see Phase 11
   section above). This uncovered the real blocker: the data pipeline itself only ever produces
   one origin's output at a time, so the selector honestly shows "not live yet" for anything but
   JFK. Building real multi-origin serving is Phase 12 work, gated behind the Travelpayouts
   rate-limit confirmation below.
6. Keep checking for a Travelpayouts support response before touching the hourly workflow's
   `CONFIRMED` gate — this is the actual remaining blocker for both the hourly fetch and making
   the origin selector show real data for non-JFK cities.

## Working style notes

- Test before shipping — this project has a real test suite now (`tests/phase10.test.js`), keep
  it green and keep adding to it rather than treating tests as optional.
- When something "should work" per the code/tests but hasn't been confirmed live, say so plainly
  — this session had multiple points where code was correct but deployment/live behavior lagged
  behind, and conflating "tests pass" with "confirmed working in production" cost real time.
- Keep the frontend framework-free even though the backend now has real dependencies — these are
  two different layers with two different constraints.
