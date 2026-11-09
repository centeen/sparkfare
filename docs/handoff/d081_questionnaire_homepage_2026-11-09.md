# D-081 questionnaire: "Create alert" via Clerk sign-up, homepage only (read-only, 2026-11-09)

Claude Code, read from `main` at the time of writing. **No code, flag or copy changed.** Scope per owner (2026-11-09): homepage first; route pages (880 `/data/` files) in a later PR. Nothing here was checked against production (the sandbox cannot reach sparkfare.com, Cloudflare, Resend or Clerk), so anything marked [U] is unverified.

## 1. Where the buttons are (homepage)
| Surface | File | Label / accessible name |
|---|---|---|
| Hero alert form | `index.html:829-841` | Button "Create alert". Form labelled by `#signup-title` ("Get daily alerts for {origin}"), `aria-describedby="signup-desc"` ("At most one fare email a day, with fares from your home airport.", `sr-only`). Email input labelled "Email" (`sr-only`). |
| End-of-row alert card | `row-alert-card.js:26` | Button "Create alert", input labelled "Email", note "One daily digest.". Only when `ENABLE_ROW_ALERT_CARD` is on (its status route `GET /api/row-alert-card`). Posts through `window.sparkfareHomeSignup` (source `home_row`). |
| Ticket "Watch" buttons | K-A6 tickets in `index.html` | Jump to the hero form; no signup of their own. |
Header "Sign up" (PR #502) already goes to Clerk. Both forms share one function, `submitHomeSignup` (`index.html` ~1912), so one change covers both.

## 2. What a new Clerk user gets today
- **Clerk sign-up alone creates no D1 row.** `ensureUserRow()` (`src/index.js:2869`) is called from one place: `POST /api/trips` (a signed-in "View fare" click). So a person who only signs up on Clerk is **not** in the 08:00 UTC digest.
- The digest query (`src/index.js:1756`) is `verified_email = 1 AND unsubscribed_at IS NULL AND is_subscribed = 1 ...`. A row made by `ensureUserRow` has `verified_email = 1` and **`origin_iata` NULL** (insert at line 2880), so it would be included. [U] what the digest does for a NULL origin (it picks a data file per origin); this must be tested before any sign-up-only user can be subscribed.
- So the new path needs an explicit "subscribe" write (home airport, `verified_email = 1`, default trip length `7-10` as today), not just Clerk sign-up.

## 3. A `local_*` alert row, then Clerk sign-up with the same email
It **merges**, no error, no duplicate, on both existing paths:
- `POST /api/signup` with a Clerk session finds the row by email, `UPDATE`s `id` to the Clerk id and `verified_email = 1`, and calls `rekeyUser()` to move referrals, trips, watchlists.
- `ensureUserRow()` finds it by `lower(email)` and also calls `rekeyUser()`.
Caveats: (a) `users.email` is UNIQUE but `/api/signup` matches `email = ?` exactly while `ensureUserRow` uses `lower(email)`; [U] whether `/api/signup` lowercases first, so a case-different address could in theory duplicate. (b) The signed-in upsert sets `unsubscribed_at = NULL`, so someone who unsubscribed and later signs up on Clerk is resubscribed (an explicit act by them; `email_suppressions` still blocks bounced or complained addresses).

## 4. Keeping airport and intent across the Clerk redirect
Feasible. Nothing on the homepage uses `sessionStorage` today. The return is to `sparkfare.com` (same origin as where it was stored), so `sessionStorage` survives a same-tab round trip; if sign-up opens another tab or the email-code step is completed elsewhere it would be lost, so `localStorage` (as already used for `sparkfare_selected_origin`) is the safer holder, cleared after use. The return URL uses `redirect_url` as in PR #502 (current origin, path and query, nothing else). [U] whether Clerk honours `redirect_url` on `accounts.sparkfare.com` (PR #502's own packet says the bot check blocked testing). The airport can also be re-read from `sparkfare_selected_origin`, so no new URL parameter is needed (D-079).

## 5. `consent_log`
- **Today:** `/api/signup` writes one row (`source` `alert_signup` or `referral_signup`, `wording_version` `v1_double_optin`, `ip_hash`) **only when it creates a verification token**, i.e. unauthenticated and unverified (`src/index.js:3360`). **A signed-in signup writes no consent row.**
- **New path would write:** a new row on subscribe, with a new source (e.g. `alert_via_signup`) and a new `wording_version` that names the beside-button string, for both new Clerk users and signed-in visitors. This is new code. No verification token or Resend verification email is needed (Clerk verified the address).

## 6. Signed-in visitor
Today's behaviour is already what D-081 asks: `submitHomeSignup` reads the Clerk session, replaces the typed email with the account email, posts to `/api/signup` (authenticated, `verified_email = 1`), shows "Alert created ... uses your account email", no redirect. Under D-081 the only change for them is that the email field is not needed.

## 7. Baseline (Nov 7 and 8)
Cannot be read from here. Homepage **visits** are not in D1 (no pageview events; only the Cloudflare Web Analytics beacon). Signups and confirmed are. Owner query (counts only):
```sql
SELECT date(ts) d, source, count(*) signups FROM events
WHERE event_type='signup' AND date(ts) IN ('2026-11-07','2026-11-08') AND source IN ('home','home_row') GROUP BY d, source;
SELECT date(ts) d, count(*) confirmed FROM events
WHERE event_type='email_verified' AND date(ts) IN ('2026-11-07','2026-11-08') GROUP BY d;
```
Visits: Cloudflare dashboard, Web Analytics, `/` page views for the same two days.

## 8. Clerk sign-up mail and Resend's 100-a-day cap
From code: Clerk sends its own sign-up and verification email (the production instance has its own email/DKIM CNAMEs in Cloudflare); this repo never calls Resend for Clerk mail, and `RESEND_API_KEY` is only used in `src/email.js`. So Clerk mail should not count against the cap. [U] confirmed only by Clerk's dashboard / Resend's usage page. The new flow would use **less** Resend: no verification email, though each new subscriber's first digest still counts.

## 9. Kill switch (homepage; static route pages noted for later)
`index.html` is a static asset (`/` is not in `run_worker_first`), so the page cannot read a Worker flag directly. The homepage already has the pattern: `GET /api/row-alert-card` and `plan-entry.js` ask a Worker status route and fail to "off".
- **Recommended (a), runtime picker:** both markups ship, flag-off markup is today's form byte for byte. A small script asks `GET /api/alert-via-signup` (`{enabled}`) and swaps to the Clerk button only when it answers exactly `true`; any failure, timeout or `"false"` leaves today's form. **Do not cache the answer** (the row-alert card caches 10 minutes, which would make this slower than a revert), so a flip or revert takes effect on the next page load; the flag edit itself still needs a merge and Cloudflare deploy (1 to 2 minutes), the same as a revert commit.
- (b) Serve through the Worker: would put `/` in `run_worker_first` for every visitor; more blast radius, rejected for the homepage.
- (c) Generation-time flag: needs 880 regenerated files per flip; rejected (and not needed for the homepage).
- With the flag off the page and `/api/signup` are unchanged, so existing pins (`tests/pseo_signup_form.test.js` for route pages, the homepage signup tests) pass unchanged; a second pin would cover flag on.
- For route pages later: the same (a) script would be added once by regenerating the 880 files dark, then flipped at runtime.

## Open for the owner / Hub
1. Confirm (a) with no caching, and that "dark" means a Worker status route that answers `false`.
2. [U] NULL-origin digest behaviour: needs a test before enabling sign-up-only subscription.
3. [U] Clerk `redirect_url` honoured on the hosted sign-up (PR #502 smoke check).
4. Beside-button string stays pending the Guard read: "Free account. At most one fare email a day, with fares from {home airport}. Unsubscribe any time." Note the verification and digest emails' unsubscribe visibility (O0 item 5) so "Unsubscribe any time" is true in every email.
5. Next step is a build PR dark, merged Mon Nov 9 but not at the 08:00 UTC digest; the flip is a separate approval.
