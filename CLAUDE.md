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
- **Signup panel shrunk from a boxed landing-page-style panel to a compact inline bar: BUILT and
  locally verified 2026-09-12** (`index.html`, the "Get deal alerts" panel). It was pushing the
  featured deal below the fold on common laptop screens. Replaced the heading + description
  paragraph + stacked-field layout (~237px tall) with a single-row bar (~90px tall at desktop
  widths) matching the embedded-newsletter-form pattern (Mailchimp/ConvertKit etc.): field
  `<label>`s stay in the DOM via a `.sr-only` utility class for screen readers, placeholder text
  carries the meaning visually, and the long-form description became a visually-hidden
  `aria-describedby` paragraph instead of being deleted outright. Verified at 1366×768 (a common
  laptop resolution): the signup bar, origin/sort bar, and most of the hero (photo, destination,
  price) are all visible with zero scrolling; the hero's own "Book this fare" CTA sits ~30-40px
  below the fold at that exact height because the hero photo's 4:3 aspect ratio (not the signup
  box) is what actually drives the hero's height. Getting the CTA itself above the fold too would
  mean trimming the header/nav or capping the photo height — out of scope for this change, which
  was specifically about the signup box; flagged to the user as a possible follow-up, not done
  speculatively. Confirmed no regressions: form field `name`/`id` attributes unchanged (JS
  submission logic untouched), mobile width (375px) wraps cleanly to a stacked layout.
  **Follow-up shipped same day**: the user asked to go further and get the hero's own "Book this
  fare" CTA above the fold too. Diagnosed that the hero photo's `aspect-ratio: 4/3` (uncapped) was
  the dominant space cost — ~454px tall on its own at desktop widths, not the signup box. Fixed
  by adding `max-height: 280px` to `.hero-photo`/`.hero-photo-fallback` (still cropped via the
  existing `object-fit: cover`), plus trimming header padding (40px/24px → 18px/14px), the
  wordmark/disclosure spacing, the hero section's own padding (32px → 16px), and the origin/sort
  bar's top margin (24px → 10px). At 1366×768 the CTA now sits at 633px with ~135px of buffer
  before the fold. Verified the 280px cap is effectively a no-op on mobile (375px width already
  produces a ~281px natural 4:3 height there, so nothing visibly changes) and doesn't touch
  `.card-photo` (only the hero rule was scoped) — no regressions found on either width.
- **Deal-board sort control: BUILT and locally verified 2026-09-12** (`index.html`, next to the
  origin selector). Five options, deliberately matching the sort verbs Google Flights/Skyscanner/
  Kayak already use — Best deal (default, ranks by `pct_below_avg` descending), Price: low to
  high, Price: high to low, Departure: soonest, Destination: A–Z. No "duration" option was added
  — the feed only has round-trip departure/return timestamps, not real flight duration, and
  guessing one would repeat the exact guessed-data mistake this project has burned time on
  before (see the Aviasales/Airalo link lessons elsewhere in this file). Sorting is per-section
  (Today's deals / Worth a look / On the board / Building history stay separate); the hero slot
  always shows the single best deal regardless of the board's sort choice, so picking "Price: low
  to high" can't bury today's actual best deal. Choice persists via `localStorage`
  (`sparkfare_selected_sort`) — same per-viewer-preference pattern as the origin selector, not
  account state. **A real bug was found and fixed while building this**: the pre-existing
  `render()` used `Array.splice()` to pull the hero pick out of the *same* cached/filtered arrays
  every time it ran — harmless when it only ever ran once per origin change, but adding a sort
  control means `render()` now runs repeatedly on the same underlying data, and each run would
  have permanently deleted one more card from the board. Fixed by having `render()` store the raw
  data once and having the actual rendering path (`renderWithSort()`) work on filtered/sorted
  *copies* instead of mutating the source. Verified locally (static file server, not the deployed
  Worker): switching between all five sort options repeatedly held the card count constant at 32,
  the hero never changed, and the choice survived a page reload — **not yet verified against the
  live deployed site**, only a local static serve of `index.html`.

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
  partner in the email (see `AWAY_MODE_PARTNERS` in `src/email.js`) — Airalo is left out; its
  Impact.com application was declined 2026-09-11 (soft decline, worth reapplying once there's
  real traffic — see the Affiliate section below). Adding a placeholder/guessed link would
  silently break tracking regardless. FTC disclosure appears before the
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
  correctness fix) — **built**, but see the real bug this caused, found and fixed 2026-09-11,
  right below.
- **A live deal-detection bug was found and fixed 2026-09-11**: when the composite-key
  (origin-qualified) history format shipped on 2026-09-05, `sparkfare_price_history.json`'s
  existing entries were never migrated — the code just started writing to new `JFK:`-prefixed
  keys while the old bare-name keys (with real history back to 2026-09-03) sat abandoned. Net
  effect: **32 of JFK's 40 destinations were silently stuck at "insufficient_history" for the
  full week since**, since `MIN_HISTORY_POINTS = 7` and the new keys only had 6 points by
  2026-09-10 — meaning roughly 80% of JFK's board couldn't be flagged as a deal no matter how
  good the price was, with no error or visible symptom (found only while investigating an
  unrelated multi-origin task and noticing the frontend origin selector's data structure).
  **Fixed** by merging each bare key's history into its `JFK:`-prefixed counterpart (31 of 32
  routes immediately crossed back over the 7-point threshold; one, Cebu, still has 6 and will
  clear it on the next run). This was a one-time migration gap, not an ongoing bug — the
  ranking script has consistently used origin-qualified keys since 2026-09-05, and the hourly
  multi-origin history file was checked and has no similar fragmentation (it was built
  origin-qualified from day one, nothing to migrate). **If deal counts ever look suspiciously
  low again, check `sparkfare_price_history.json` for bare (non-origin-prefixed) keys sitting
  alongside prefixed ones before assuming the ranking logic itself is wrong.**
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
- **Travelpayouts rate-limit: CONFIRMED 2026-09-06.** Support responded: `/v1/prices/cheap` is
  limited to **300 requests/minute, per token**. Planned usage (12 origins × 40 destinations =
  480 requests/hour) is well within that — works out to ~8 requests/minute if spread evenly
  across the hour, which is what Travelpayouts explicitly recommends (spread requests out rather
  than bursting all 480 at once, to avoid rate-limit spikes). **This was the last hard blocker on
  enabling the hourly multi-origin workflow for real** — the manual-trigger `CONFIRMED` gate in
  `.github/workflows/hourly-multi-origin-fetch.yml` can now legitimately be used. The fetch
  script itself should also be checked/adjusted to actually spread its requests across the hour
  rather than firing all 480 back-to-back, per Travelpayouts' own recommendation, before
  flipping this on for real.
- **Hourly multi-origin fetch: ENABLED 2026-09-06, CONFIRMED running 2026-09-11.** A `schedule`
  trigger was added to `hourly-multi-origin-fetch.yml` once the rate limit was confirmed (see
  below); it commits to `sparkfare_hourly_flight_prices.json` /
  `sparkfare_hourly_ranked_deals.json` / `sparkfare_hourly_snapshots/`, kept separate from the
  daily single-origin feed. Checked via the GitHub API 2026-09-11: 28 total runs, every recent
  one `completed`/`success`. **But the actual cadence is NOT hourly** — runs were landing roughly
  every 3–5 hours instead of every 1 hour, despite the `0 * * * *` cron config. This matches a
  documented GitHub Actions limitation: schedules at the exact top of the hour (`:00`) hit
  platform-wide congestion and get silently delayed or dropped, even though every run that does
  fire succeeds cleanly. **Fixed** by moving the cron to `23 * * * *` (an off-peak minute) —
  this hasn't been independently re-verified yet, check actual run cadence again after this
  change has had a few hours to take effect before assuming it's fixed.
- **Two real run failures found and fixed 2026-09-12** (runs #28 and #29, 2026-09-11, both
  flagged by GitHub's own failure-notification email). Diagnosed via the GitHub Actions REST API
  (job/step statuses; raw log download 403'd for this account despite the repo being public, so
  root cause came from step-level evidence, not the literal error text): in both runs, **every
  step through "Rank multi-origin prices" succeeded** — only the final "Commit hourly data" step
  failed. Correlating against `git log` showed manual commits landing on `main` *during* each
  run's ~15–20 minute execution window (e.g. run #29 checked out at 13:38:30 UTC; a manual commit
  landed at 13:39:36 UTC, one minute later) — 2026-09-11 was a heavy manual-editing day with many
  commits pushed in quick succession while the scheduled job was also mid-run. **Root cause**:
  `git push` with no preceding `pull`/`rebase` — if `main` moves forward while the job is
  fetching/ranking, the final push is rejected as non-fast-forward and the whole job fails, even
  though the fetch/rank steps did real work (the data just never gets committed, silently, until
  the next scheduled run happens to not collide). **Fixed** in all three data-pipeline workflows
  (`hourly-multi-origin-fetch.yml`, `daily-fetch.yml`, `daily-compile-other-origins.yml` — same
  commit-then-push pattern in all three, same exposure) by retrying the push up to 5 times with
  `git pull --rebase origin main` between attempts instead of failing outright on the first
  rejection. **Not yet independently confirmed against a real collision** — runs #30–34 (after
  the failures) all succeeded on their own without needing the retry logic, since no manual
  commit happened to land mid-run; the fix's actual retry path hasn't been exercised live yet.
- **Frontend origin selector UI: BUILT and CONFIRMED live 2026-09-05** (`index.html`, the
  `.origin-bar` control above the hero section). **A real architectural gap was found while
  building this**: there is currently no per-origin data being produced anywhere in the
  *serving* pipeline — `Phase 1 Deal Ranking Script`'s `RANKED_OUTPUT_PATH` and `Phase 11
  Compile Free Tier View.py`'s output both only ever write ONE origin's data at a time (JFK by
  default) for the live site. The hourly workflow above now genuinely fetches all 12 origins,
  but nothing yet serves that per-origin data to the frontend — that's still Phase 12 work. So
  the selector deliberately does **not** pretend other origins have real data: choosing anything
  but JFK shows an honest "aren't live yet" message with a one-click reset back to JFK, instead
  of silently displaying JFK deals mislabeled as another city. The selection persists via
  `localStorage`
  (`sparkfare_selected_origin`) — a per-viewer display preference, not account state, so it
  doesn't touch D1. Verified live: switching the dropdown shows the correct empty state, the
  reset link restores the real board, and the choice survives a page reload.
- **Phase 12 — per-origin serving layer: BUILT 2026-09-11**, deployed, not yet independently
  observed with real deal data (first scheduled run hasn't landed as of this writing). Frontend
  origin selector now actually fetches and renders real data for the other 11 origins instead of
  showing "not live yet." Design, deliberately matching the locked tier split (FREE = 1 origin,
  daily-delayed; billing not built yet, so this governs everyone right now): a single combined,
  24h-delayed file — `sparkfare_ranked_deals_other_origins.json` — covering all 11 non-JFK
  origins, compiled daily from the hourly pipeline's own snapshots via a new
  `daily-compile-other-origins.yml` workflow (07:10 UTC, offset from the other two schedules).
  JFK is untouched — still its own dedicated always-fresh daily pipeline. The frontend fetches
  the combined file lazily (only if a visitor picks a non-JFK origin) and filters it
  client-side by `record.origin`, so switching between any of the 11 origins after the first
  load needs no further network requests. **Note**: this does NOT include the other listed
  Phase 12 items — the trailing-average calculation itself and the stale-fallback display
  threshold are unchanged, reused as-is from the existing ranking script; only the per-origin
  *serving* layer was built here.

  **A third, more serious bug was found 2026-09-11 after the first real run**: the user reported
  missing destination photos/copy for a non-JFK origin. Root cause was in the *ranking script
  itself* (`Phase 1 Deal Ranking Script (Step 9 - with fallback).py`), not the compile script —
  `rank_deals()` passed the flight-prices feed's dict *key* as the `display_name` argument to
  `classify_destination()`. For a multi-origin feed that key is already origin-prefixed
  (`"JFK:Bali, Indonesia"`), and `classify_destination()` separately prepends `entry['origin']`
  again when building the history route key — so every multi-origin output record's
  `display_name` and every multi-origin history key got double-prefixed
  (`"JFK:JFK:Bali, Indonesia"`). **This has silently corrupted the hourly pipeline's own history
  since it first started running (~2026-09-06)** — not something this session introduced, just
  never noticed until a real consumer (the images/copy lookup by clean display name) exposed it.
  JFK's own daily pipeline was never affected — its feed keys were never origin-prefixed to
  begin with. **Fixed** by using `entry.get("display_name", name)` instead of the raw dict key.
  Migrated both corrupted history files (`sparkfare_hourly_price_history.json`,
  `sparkfare_price_history_other_origins.json`) by stripping the duplicated prefix rather than
  losing the accumulated data (286 and 225 keys respectively, zero collisions either way) —
  same approach as the JFK bare-key merge above. Regenerated both ranked-deals outputs locally
  with the fixed script before committing, rather than waiting for the next scheduled run.

  **One more wrinkle found while verifying the fix live**: regenerating wasn't enough on its own.
  `apply_fallback()` carries forward the *entire previous record* (`dict(previous)`) verbatim for
  any route with `insufficient_history`/`no_data` status today — including yesterday's corrupted
  `display_name`/`route_key`, since it trusts the previous day's record shape completely rather
  than reconstructing identity fields from today's (now-correct) classification. Worse, this
  self-perpetuates: a route with no fresh data EVERY day just keeps re-copying whatever it last
  inherited, corrupted or not, forever, since each day's fallback source is the previous day's
  (possibly still-corrupted) output. Re-running the ranking script a second time didn't clear it
  for exactly this reason. Fixed by directly patching the affected records in both live JSON
  output files (stripped the origin-prefix pattern from `display_name` and collapsed
  double-prefixed `route_key`s) rather than relying on the pipeline to self-heal — 183 and 237
  records respectively. Worth remembering: **a fallback-driven pipeline bug doesn't necessarily
  clear itself just because you fixed the code that caused it** — check whether corrupted data
  is being kept alive by a carry-forward/fallback mechanism reading its own prior (bad) output.

  **Two more bugs were found and fixed while building this**, both in code that had never
  actually been exercised before (the "Compile Free Tier View" script was written in an earlier
  session but never wired into any workflow until now):
  1. `Phase 11 Compile Free Tier View.py`'s `compile_free_tier_view()` keyed its output by bare
     `display_name` — harmless for a single origin, but compiling multiple origins into one file
     would have silently collided two origins sharing a destination (e.g. `LAX:Bali, Indonesia`
     and `ORD:Bali, Indonesia` would both overwrite the same `"Bali, Indonesia"` key). Fixed to
     key by the origin-qualified route when more than one origin is requested.
  2. **The hourly snapshot filenames have never actually matched what the compile script's
     parser expects**, since the snapshot feature was first built. The fetch script generates
     the filename as `fetched_at.replace(':', '').replace('+00:00', 'Z')` — but stripping colons
     runs first, which destroys the `+00:00` substring the second `.replace()` is looking for,
     so it's always been a no-op. Every one of the 27 existing snapshot files is named with a
     literal `+0000` suffix, not the intended `Z`. The compile script's `snapshot_time()` only
     ever tried to parse a `Z` suffix, so it would have thrown `ValueError` on the very first
     real file it touched. Fixed both sides: the parser now uses `%z` (matches `+0000`, `Z`, or
     any offset, so it tolerates both the old buggy filenames and correctly-named future ones),
     and the fetch script's replace-order bug is fixed so new snapshots get the intended `Z`
     suffix going forward. Verified locally against the real `sparkfare_hourly_snapshots/`
     directory before deploying: compiled 440 routes (11 origins × 40 destinations) from a real
     24h+-old snapshot, then successfully ranked them end-to-end.

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
  **Bounce (luggage storage) approved and live, 2026-09-11**: real referral link
  `https://go.bounce.com/SPARKFARE96253961631`, added to `AWAY_MODE_PARTNERS` in
  `src/email.js` — meaning it now appears everywhere that list is used: `away-mode.html`, the
  click-triggered Away Mode follow-up email, and the booking-confirmed email, not just one
  surface. FTC disclosure precedes it on every one of those, same as SafetyWing. This is the
  second real, live, earning Away Mode partner (after SafetyWing) — everything else is still
  applied/pending/paused, see below.
  **US Global Mail (virtual mailbox) approved and live, 2026-09-12**: real referral link
  `https://www.usglobalmail.com/?via=coby`, added to `AWAY_MODE_PARTNERS` in `src/email.js` and
  to `away-mode.html` — same treatment as SafetyWing/Bounce, FTC disclosure precedes it. Third
  real, live, earning Away Mode partner. **Also fixed while touching this**: Workplan Step 25
  (SafetyWing) had been stuck showing `APPLIED` in the Master Workplan CSV since it was first
  written, despite SafetyWing being live and earning since 2026-09-05 — corrected to
  `APPROVED - LIVE` with the real referral link in the CSV's own Link/Resource column (it had
  only ever pointed at the generic `/ambassador` signup page). `state_AFFILIATE_PROGRAMS.md` was
  reconciled against both changes the same day.
  **Airalo declined the application, 2026-09-11.** A soft decline, not a hard rejection — their
  email gave no specific reason ("we don't think now is the right moment"), explicitly called it
  "not a closed door," and invited reapplying once "audience, content, or promotional plans
  evolve." Treat this the same as TrustedHousesitters below: paused, worth revisiting once
  Sparkfare has real traffic/signups to point to, not a permanent dead end. Do not add an Airalo
  link to any live surface unless a future application is actually approved and a real
  Impact.com tracking link is generated — don't guess at Impact.com's link format, it varies per
  account/campaign. World Nomads and TrustedHousesitters similarly paused — World Nomads pending
  Safe Browsing clearance (now cleared, worth reapplying), TrustedHousesitters pending a real
  subscriber count to meet their 5,000-follower eligibility bar.
  **Holafly is the chosen eSIM replacement, confirmed by the user 2026-09-11** — not just a
  parallel candidate. Application submitted directly via Holafly's own affiliate portal
  (https://affiliates.holafly.com/en/affiliate-program), status `PENDING` as of this date. Same
  discipline as everywhere else applies: **do not add a Holafly link to `AWAY_MODE_PARTNERS`
  (`src/email.js`) or `away-mode.html` until the application is actually approved and a real
  tracking link exists** — a guessed/placeholder link silently breaks commission tracking.
  **Known discrepancy**: `state_AFFILIATE_PROGRAMS.md` (added 2026-09-11) still lists Airalo as
  `APPLIED`, not reflecting this decline — that file is stale on this one point. The CSV and this
  file are correct; if reconciling the two files, trust the decline.
- **Sub-ID reconciliation**, when eventually built, must use the current
  `api.travelpayouts.com/statistics/v1/execute_query` endpoint — the older `v2/statistics/sales`
  endpoints are deprecated.
- **Affiliate program research got a major update 2026-09-11** via a new companion file the user
  added, `state_AFFILIATE_PROGRAMS.md` — a scored (Necessity/Availability/Revenue/Ease-of-Sale,
  1–5 each) log of every program considered, more granular than the Master Workplan CSV's Phase 3
  rows. **It's a companion, not a replacement** — the CSV's Phase 3 rows remain the source of
  truth for anything already `APPLIED`/`PAUSED`/`DECIDED`; the new file tracks earlier-stage
  research and every commission figure is explicitly flagged "unconfirmed, verify live before
  using in any revenue claim." Both the CSV (Steps 75–85, new) and this file were updated
  together to stay in sync — **update both whenever a program's status changes**, not just one.
  Key status changes and new findings from that pass:
  - **Priority Pass status corrected**: no longer "not yet applied" — Travelpayouts reports the
    program itself is currently **inactive** (platform-side, not a Sparkfare issue). Revisit once
    reactivated.
  - **TaskRabbit status corrected**: not findable in Impact's marketplace despite direct search
    (including alternate spelling) — paused, unconfirmed availability. Its garden-care half is
    being replaced by **TruGreen** (fragmented across CPA/pay-per-call networks, no single
    signup page); its vehicle-care half still has **no substitute found** — an open gap.
  - **Babbel**: a real, direct Impact campaign signup link was found (not yet submitted) — see
    the CSV row for the exact URL. A separate US-specific Babbel program via Perform[cb] also
    exists; unclear which fits better. Duolingo confirmed to still have no public program.
  - **New candidates, several already applied/in-progress**: Airport Parking via
    AirportParkingReservations.com/CJ (**top-ranked new candidate, composite 4.75, already
    applied** — SpotHero and Ace Airport Parking considered and not pursued in its favor) · Rover
    pet-sitting (FlexOffers declined the general account, **pivoted to Rakuten Advertising**) ·
    Holafly eSIM as a second option alongside Airalo (pending) · Traveling Mailbox virtual
    mailbox (pending approval) · SimpliSafe home security (Awin account applied, but its
    SimpliSafe listing is UK-only — trying Impact's "Regions: ALL" listing next) · Smart-home
    Away Mode gadgets via Amazon Associates (**deliberately holding** until a real gadget
    article/checklist is published, to avoid starting the 180-day/3-sale clock early) · Lounge
    Pass as a Priority Pass alternative (paused — no confirmed accessible network) · Vacant-home/
    travel-insurance add-ons (**blocked** — same open Legal item as Workplan Step 24, don't
    pursue independently) · VPN/travel-data-security and luggage storage flagged as candidates
    but not yet researched at all.
  - **VPN and luggage storage researched 2026-09-11** (web research, not from
    `state_AFFILIATE_PROGRAMS.md`): for **VPN**, **NordVPN** is the recommended pick — runs via
    its own custom affiliate network (a new account, separate from anything already open) or via
    Awin (merchant 15132, US & CA — reuses the general Awin account already open from SimpliSafe
    research); reported up to 100% commission on 1-month plans, 40% on 1yr/2yr, 30% recurring on
    renewals, 30-day cookie, per NordVPN's own program page (not independently verified).
    Surfshark considered as an alternative — flat 40% revenue share, $100 minimum payout,
    available via Awin/CJ/Impact/TUNE (more network flexibility than NordVPN). For **luggage
    storage**, **Bounce** is the recommended pick — a direct program needing no third-party
    network account, 10% commission per booking (or affiliates can pass that 10% to customers as
    a discount instead), paid monthly via Stripe, no minimum payout; cookie duration isn't
    published, confirm at signup. Vertoe (the other named example) has its own affiliate page
    but it 403'd during automated research — terms genuinely unconfirmed, needs a manual visit.
    LuggageHero surfaced as a third direct competitor, not researched in depth. **Bounce was
    then approved 2026-09-11 — see the Affiliate section above for its live link and where it's
    wired in; that supersedes "recommended" here.** Both additions are in the Workplan CSV as
    Steps 84 and 86.
  - **FlexOffers' general account was declined** (generic "doesn't meet current needs" reason,
    no specifics). This killed the only confirmed route for both Rover and Lounge Pass. Since
    Sparkfare's pre-scale traffic is the likely real reason, other pending applications (CJ,
    Traveling Mailbox, Awin) could plausibly face the same outcome — not a sign anything is
    specifically wrong with those if/when it happens.
- **Confirmed dead ends — do not revisit**: TSA PreCheck/Global Entry (government-only process,
  no viable affiliate route) and Airbnb as a home-sitting-while-away angle (their affiliate
  program shut down in 2021; remaining referral programs pay capped travel credit, not cash).
- **Phase 9 — Away Mode bypass entry point: BUILT and CONFIRMED live 2026-09-05.** A dedicated
  `away-mode.html` page (`/away-mode`) lets a visitor reach the Away Mode partner checklist
  directly — no flight deal click, sign-in, or trip required. Linked from the nav on every page.
  FTC disclosure appears before the SafetyWing link, same discipline as everywhere else. The
  partner content is intentionally duplicated from `AWAY_MODE_PARTNERS` in `src/email.js` rather
  than fetched from a shared source (there's currently only one real partner, so a small API
  just for this would be overkill) — **update both places when a new partner is added**, a
  comment in `away-mode.html` flags this. "Content and distribution cadence" (the other Phase 9
  item) was deliberately left unscoped — the user wasn't sure yet what it should mean and chose
  to skip it rather than have it built to a guessed spec.
- **Google Search Console**: user-confirmed 2026-09-05 that sparkfare.com now shows clear, no
  issues detected (the earlier inherited Safe Browsing false-positive is fully resolved).
- **Brand mark and style guide added 2026-09-12** — `sparkfare_mark.svg` (production file) and
  `sparkfare_style_guide.md` (converted from a source `.docx`, left untracked, into plain
  Markdown to match this repo's other docs). The guide is explicitly labeled "directional brand
  concept, not final production art" and flags its own outstanding item: **no attorney-run
  trademark clearance search has been done on the ticket-stub mark** — don't treat it as legally
  cleared for commercial use. **Rolled out as the site's logo and favicon same day** — added to
  every page's `<head>` (`<link rel="icon">` for the SVG, a rasterized `favicon.png` fallback for
  browsers without SVG-favicon support, and `apple-touch-icon.png` for iOS home screens, both
  generated by replicating the mark's exact path/circle geometry via GDI+ since no SVG
  rasterizer was available on this machine — not by design, just what was on hand) and inlined
  next to the wordmark on `index.html` and next to the "Sparkfare" nav link on
  `account.html`/`trips.html`/`privacy.html`/`disclosure.html`/`away-mode.html`. `sign-in.html`
  got the favicon only — it has no nav bar to attach a logo to. **Deliberately scoped to just the
  mark** — did NOT touch the site's existing color variables (`--amber` etc.) even though the
  style guide's palette differs from the live site's (e.g. its "Spark" gold `#E8B930` vs. the
  site's current amber `#B8720F`); adopting the full palette would be a much bigger, separate
  decision than "add a logo and favicon," and the guide itself isn't marked final. Verified
  locally: all 7 pages load without console errors, the mark renders correctly at both sizes
  (26px next to the wordmark, 16px in nav), and the favicon/apple-touch-icon assets are
  fetchable — not yet verified on the deployed Worker.
- **Phase 15 — GTM: Publisher Syndication, added 2026-09-12 (workplan Steps 88–95),
  PROPOSED — NOT DECIDED.** A hyper-local publisher-syndication acquisition strategy (embeddable
  widget for regional newsletters, revenue-share tracked via a new `partner_id`) drafted in
  `sparkfare-content/Sparkfare Go to Market Strategy.md`. **The source document does not match
  the live product** — it specifies Brevo, Make.com, and an unnamed "Amadeus/Skyscanner" flight
  API (the real stack is Resend, the existing D1-backed Worker API, and Travelpayouts), and a
  design direction (Navy `#0A192F` / Orange `#FF6B35`, Montserrat/Open Sans) that contradicts
  `sparkfare_style_guide.md`'s actual palette and type despite claiming to follow it. The workplan
  rows were written against the **real** infrastructure, not transcribed from the draft — see
  Step 88's Notes for the full list of corrections. **Nothing in this phase is built or decided
  yet**, including the 20% publisher revenue-share figure itself (Step 92) and whether
  SafetyWing/Bounce's current links can even support per-partner sub-ID tracking (Step 91's open
  dependency) — don't treat any of it as committed strategy.
- **The publisher widget itself (Step 90) was actually BUILT 2026-09-12** — `widget.html`, a real
  page served at `sparkfare.com/widget`. Two source drafts existed
  (`sparkfare-content/1. Sparkfare Syndication Widget (HTMLCSS).html` and
  `2. Distributing to B2B Publishers.html`) with the same problems as the strategy doc, plus more:
  the widget posted a plain HTML form to a literal `YOUR_MAKE_WEBHOOK_URL` placeholder, used a
  5-option generic "US region" dropdown instead of specific airports, and was missing the
  required `trip_length` field entirely — none of which would have worked against the real
  `/api/signup` endpoint (confirmed by reading its actual handler in `src/index.js`: it requires
  a JSON `fetch()` POST, not a form-encoded submission, plus `id`/`origin_iata`/`trip_length`,
  and validates `origin_iata` against the specific `VALID_ORIGINS` set, not a region string).
  Rewritten from scratch rather than patched — real style guide colors/type (no gold/Spark on the
  button; there's no deal signal on a signup form, so the site's own sage-for-actions convention
  was reused instead), the real 12-origin public list, and a `partner_id` hidden field read from
  the iframe's own URL (`?partner=slug`) and sent with every signup. **TLV deliberately excluded**
  from this list — it's a public-facing widget meant for wide publisher distribution, the exact
  opposite of TLV's "de-prioritized, not marketed" placement (see the TLV entry above). Because
  the widget document is served from `sparkfare.com`, its `fetch('/api/signup')` call is
  same-origin no matter what domain a publisher embeds the iframe on — no CORS work needed;
  confirmed no `X-Frame-Options`/CSP framing restriction exists anywhere in the Worker that would
  block third-party embedding. Publisher-facing embed instructions written to
  `gtm_publisher_embed_guide.md` (replaces the second source draft, which was a single-line
  example using a placeholder `yourdomain.com`). Verified locally first: renders correctly, no
  console errors, client-side validation and the `?partner=` extraction both work, and the error
  path degrades gracefully (tested against a plain static server with no live API, confirmed it
  shows a real error message rather than crashing). **CONFIRMED live end-to-end 2026-09-12**:
  deployed, then a real test signup (`sparkfare-widget-verify@example.com`, an RFC 2606 reserved
  test address) submitted through `https://sparkfare.com/widget?partner=denver_guide` returned a
  real `200` from `POST https://sparkfare.com/api/signup` with a success message — the widget
  genuinely creates real alert signups against the live Worker/D1, not just in local testing.
  `partner_id` is sent on every signup already, but the backend doesn't store it
  yet (Step 89 is still `NOT STARTED`) — signups work today, attribution doesn't get recorded
  anywhere until that ships.
- **Workplan CSV desync found and fixed 2026-09-12.** A "what's the next step" check surfaced
  that 7 workplan steps (6/58 — rate limit; 36 — Away Mode bypass entry; 53/54 — sub-ID
  reconciliation and booking-confirmed email; 55 — My Trips dashboard; 62 — origin selector; 63 —
  multi-origin end-to-end test) still showed `STILL OPEN`/`NOT STARTED` despite all of them
  already being built and documented as such elsewhere in this file, some since 2026-09-05.
  Reading only the CSV would have led to real wasted work (e.g. re-building the already-live My
  Trips dashboard). Fixed all 8 rows (6 and 58 both tracked the same rate-limit fact) to match
  this file's own record — no new information, just closing a sync gap between the two documents
  the project already treats as sources of truth.
- **Workplan Step 98 — DONE, 2026-09-12.** `sparkfare_ranking_methodology.md` formalizes, in
  writing, the exact "genuinely a deal" rule already implemented in the ranking script: today's
  cheapest price at least `CLUSTER_THRESHOLDS[cluster]` below that route's own trailing
  `HISTORY_WINDOW_DAYS = 30`-day mean, gated on `MIN_HISTORY_POINTS = 7` days of history, with
  today's own price excluded from the average it's compared against. Every number in the doc
  traces to an exact line in `Phase 1 Deal Ranking Script (Step 9 - with fallback).py` — not
  paraphrased from memory. This was pure documentation of existing logic, not a code change, and
  it unblocks Step 97 (adding a stated comparison basis next to the "X% below avg" badge that's
  already live) — Step 97 itself is still `NOT STARTED`.

## Decisions locked (still current)

- **Auth**: Clerk (confirmed working, see gotcha above)
- **Tier split**: FREE = 1 saved origin, daily-delayed refresh, full Away Mode checklist. PAID =
  up to 10 origins, hourly-fresh data, earlier access to new destinations.
- **Origin list (12, rate limit confirmed 2026-09-06 — see Phase 11 section above)**: JFK, LAX,
  ORD, ATL, DFW, SFO, MIA, IAD, EWR, SEA, IAH, BOS. This is still the real US-market decision —
  see the TLV note immediately below, which does not change it.
- **TLV (Tel Aviv) added 2026-09-12 as a 13th origin — deliberately NOT part of the above
  decision.** The user wants a small group of family/friends in Tel Aviv to use the live site as
  informal design partners, giving real product feedback. Wired into the exact same "other
  origins" bucket as the 11 non-JFK US cities (hourly-fetched, 24h-delayed, served from the
  shared `sparkfare_ranked_deals_other_origins.json`) — no new architecture, since that bucket
  already treats every origin generically. 13 origins × 40 destinations = 520 req/hour, still far
  under the confirmed 300 req/min Travelpayouts limit. Deliberately placed **last** in every
  dropdown (`index.html`'s origin-switch and signup selectors, `account.html`'s saved-origin
  selector) and added to the three enforcing/validating `VALID_ORIGINS` sets (`src/index.js`
  server-side, plus the frontend pre-submit checks in `index.html` and `account.html`) — there is
  no real secrecy possible here (public repo, public site), so "unobvious" means de-prioritized
  placement and zero mention in nav/marketing copy, not a hard technical gate. **Do not read this
  as a signal to expand internationally** — it's a testing convenience for one relationship, not
  a market decision; if it's ever removed, revert all the touch points listed above, plus the two
  workflow env vars (`hourly-multi-origin-fetch.yml`'s `SPARKFARE_ORIGINS`,
  `daily-compile-other-origins.yml`'s `SPARKFARE_FREE_ORIGINS`). **Known dead end deliberately not
  touched**: `preferences.html` has its own stale, unlinked origin dropdown (nav routes
  `/account`, not `/preferences`) — same category as the `departing.html` ghost file elsewhere in
  this doc; editing it would change nothing live. **One honest caveat, not fixed**: prices for
  TLV are still fetched and displayed in USD (`CURRENCY = "usd"` in the fetch script, applied
  uniformly to every origin) — fine for informal testing, but a real Israeli-market launch would
  want ILS pricing.
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
   JFK. Building real multi-origin serving is Phase 12 work.
6. ~~Travelpayouts rate-limit confirmation~~ — **CONFIRMED 2026-09-06** (300 req/min per token;
   see Phase 11 section above). This was the last hard blocker on the hourly multi-origin
   workflow. Next actual step: adjust the fetch script to spread its ~480 requests across the
   hour (Travelpayouts' own recommendation) before flipping the workflow's `CONFIRMED` gate for
   real — then Phase 12 (tiered serving) and Phase 13's "departing soon" alerts become
   unblocked too.

## Working style notes

- Test before shipping — this project has a real test suite now (`tests/phase10.test.js`), keep
  it green and keep adding to it rather than treating tests as optional.
- When something "should work" per the code/tests but hasn't been confirmed live, say so plainly
  — this session had multiple points where code was correct but deployment/live behavior lagged
  behind, and conflating "tests pass" with "confirmed working in production" cost real time.
- Keep the frontend framework-free even though the backend now has real dependencies — these are
  two different layers with two different constraints.
