# Addendum M, M0 plan (read-only), 2026-10-21

Written by Claude Code. Nothing was built, merged, flipped or sent. Everything below was read from the repo (`origin/main` at `a41e5ad6` plus the working tree), the checked-in data files (generated 2026-10-20 to 2026-10-21) and the docs. Nothing was read from production, so a few answers say "unverified on production". Handoff: `docs/handoff/ADDENDUM_M.md`. ROADMAP steps 139 to 146.

## Headline

1. **The capacity swap is moot: K-B1 to K-B10 are already merged**, including the three packages M was to displace (K-B6 night mode, K-B7 image pipeline, K-B9 `/data/` finder). No slot needs freeing, so all of M can run from Oct 22 with no displacement. Only the Oct 31 target for M1 and the Nov 4 last-merge date remain as constraints.
2. **K-B2 is also merged**, so M7 cannot "ride K-B2's PR". It becomes a small follow-up PR to the homepage and welcome page.
3. **"Confirmed" is not recorded anywhere today, and the referral rule does not match its description.** `/api/verify` sets `users.verified_email = 1` and nothing else: no timestamp, no event. M1's confirmation rate needs a one-line `email_verified` event (forward only; past confirmations cannot be dated). And a referral is marked `confirmed` when the referred person **opens any email** (the Resend `email.opened` webhook), not when they verify their address. That is weaker than the plan's Guard condition 7 ("referred signups use double opt-in; a referral counts only after the friend confirms") and it silently fails for anyone whose mail client blocks the tracking pixel. Decision needed (section M0-2).
4. **Only 12 of 22 US origins can show any verdict today.** DEN, PHX, LAS, PHL, MSP, CLT, DTW, FLL, BWI and AUS have none (0 of 40 routes each). Posts and press aimed at those hubs must route to `/check` and `/time-off`, as the plan's coverage rule says. The report (M5) can only speak for the other 12.
5. **The stored history is about 45 days long (2026-09-06 to 2026-10-21) and holds no travel dates**, so the Holiday Fare Report cannot honestly say how fares "around Thanksgiving or Christmas" behaved over time. It can describe what is on the board now for departures in those windows (section M0-3).

## M0-1. Signup paths and first-touch source

Where the source goes: `POST /api/signup` reads `body.source` (sanitized, 40 chars) and `body.utm` (sanitized) and stores them **only in the `signup` event** (`events.source`, and `events.meta.utm`). There is no source column on `users`. `utm.js` (first touch per browser session, `sessionStorage`) is loaded only on `index.html` and `check.html`.

| Path | Sends `source` | Sends `utm` | Sends `partner_id` | Gap |
| --- | --- | --- | --- | --- |
| Homepage (`index.html`) | no (`undefined`, event stores null) | yes | no | needs `source: 'home'` |
| `/check` | `check` | yes | no | none |
| `/leave` | `leave` | no (no `utm.js`) | no | add `utm.js` |
| `/time-off` pages (`src/ptoPages.js`) | `pto` | no | no | add `utm.js` |
| `/widget` (embed) | no | no | `partner` param | needs `source: 'widget'`; embed host differs so `utm.js` does not apply |
| 880 `/data/` route pages (generator) | no | no | `pseo` | needs `source: 'route'` or similar plus `utm.js`; generator edit + regeneration |
| Digest archive page (`src/digestArchive.js`) | no | no | `digest_archive` | needs a source; flag-off today |
| Worker route pages (`/flight/...`) | no signup form (links to the watchlist/homepage) | n/a | n/a | the "Watch this route" link should carry a source |
| `/hub` | no signup form | n/a | n/a | not a signup path (needs sign-in) |
| Referral landing (`/r/<code>`) | sets a `ref` cookie, redirects to `/` | n/a | n/a | the homepage reads the cookie, but the signup event does not record `source: 'referral'` |

**Plan for M1.** (a) Every form sends a `source` from the set `home, check, leave, pto, widget, route, digest, share, referral, report` (`direct` when none) and loads `utm.js`; (b) the Worker stores the final first-touch value on the `users` row (new nullable column `signup_source`, `ALTER TABLE` migration 0031, additive) as well as in the event, so reports do not depend on joining events; (c) log `email_verified` in `/api/verify` with the same `source`; (d) `/admin/growth` reads `users` (signups by `signup_source` and day) and `events` (confirmations). Forward only: signups made before this ships keep a null source.

**Referrals and source.** A referred signup should store `source = 'referral'` when `body.ref` resolved to a real referrer; today it records `referral_signup` as a separate event only.

## M0-2. Referral links

- **Code.** A user gets `referral_codes(user_id, code = 'ref_' + 6 random chars)`. `POST /api/signup` creates one for **any signup, no account needed**, and returns it as `ref_code`. The homepage builds `https://sparkfare.com/r/<code>` and shows a share panel after signup. `/r/<code>` sets a 30-day `ref` cookie and redirects home; the homepage sends that value as `ref` on signup.
- **Email-only subscribers.** They get the code only in the signup response on the page where they signed up. After that they cannot see it again: `/api/referrals/status` and `/hub` require a Clerk sign-in, and neither the verification email, the welcome page (`welcome.html`) nor the digest carries a link. So the plan's "link in the confirmation page, welcome email, every digest footer" has to be built, not just exposed.
- **Signed-out `/hub`.** Shows the intro and the four locked tiers, with "Sign in to see your referral link and rewards." (`hub.html`).
- **Double opt-in for referred signups.** Referred signups do get a normal verification email, but the **referral itself** goes `pending` then `confirmed` when the referred user's first `email.opened` event arrives (`src/index.js`, the Resend webhook), not on `verified_email`. Opens depend on the tracking pixel; blocked images mean the referral never confirms. **Recommendation:** make confirmation follow `verified_email = 1` (set in `/api/verify`) and keep the open event as a fallback, so the rule matches Guard condition 7 and the prompt's promise "when a friend confirms". Small change, but it alters reward behavior, so it needs the owner's OK.
- **Tiers the code grants** (`src/rewards.js`): 1 confirmed referral returns `maxOrigins: 2` (nothing uses it), 3 raises the watchlist limit from 3 to 10 (enforced), 5 returns `earlyAccessFeatures` (nothing uses it, early send retired), 10 returns `foundingMemberBadge` (flag only). Decision already made: the M2 prompt names the 3-referral tier and the M2 PR corrects the hub and `/reward-terms` text.
- **Self-referral and abuse.** A per-IP-hash cap on referral signups exists in `/api/signup` (not reviewed further here).

## M0-3. What the stored data can support for the report

Data: `sparkfare_price_history_other_origins.json` (514 routes, 9,606 points), `sparkfare_price_history.json` (JFK, 34 routes, 969 points), `sparkfare_hourly_price_history.json` (550 routes, 10,709 points). **Span: 2026-09-06 to 2026-10-21.** Each point is the cheapest cached round-trip fare seen on an observation date; it carries no departure date, so history cannot be cut by travel window. The ranked-deals files (880 US routes + 40 TLV) hold today's cheapest fare per route with its departure and return dates plus up to 31 observation days.

Today's board (US, generated 2026-10-20/21): 880 routes = 21 deal, 88 featured (not judged), 187 priced with no deal, 90 insufficient history, 494 no data. **208 of 880 (23.6%) can carry a verdict.** By hub: JFK 24 of 40, EWR 23, ORD 20, LAX 19, MIA 18, BOS 17, SFO 16, IAD, ATL, DFW 15 each, IAH 14, SEA 12; the other ten hubs 0. Deals by hub: JFK 4, EWR 3, IAH 3, LAX 3, BOS 2, SFO 2, ORD 2, IAD 1, DFW 1. Observation days per verdict-capable route: min 10, median 31, max 31.

| Candidate finding | Supported? | Sample / note |
| --- | --- | --- |
| Share of routes that can carry a verdict, by hub and overall (23.6% of 880) | **Yes** | exact counts above; a statement about Sparkfare's coverage, not about fares |
| How many routes sat at or past the deal floor (15% under the median with 10+ distinct observation days) now: 21 of 208 verdict-capable (10%) | **Yes**, as a snapshot | one day; do not call it a trend |
| Share at or past the floor over the last 30 and 60 days | **Partly**: 30 days yes for the 12 hubs with data; **60 days no** (history starts Sep 6, about 45 days) | needs a script that recomputes the floor day by day from history; 12 hubs only |
| Median observed fare movement by region (first half vs second half of the window) | **Weak**: 45 days of autumn data, one season, no travel-date control; a "fare change" between observation dates mixes different departure dates | would need heavy caveats; I would not lead with it |
| Fares for departures inside the Thanksgiving (Nov 20-30) and Christmas (Dec 18 - Jan 3) windows, as cached cheapest fares on the board today | **Yes as a snapshot**: 26 and 44 of 386 priced US routes depart in those windows | a "what's on the board for these windows now, versus each route's own median" table; no claim about how fares moved |
| Routes with the most observation days | **Yes** | 31 days is the cap; this is a sample-size statement |
| "Fares rise before holidays", "cheapest day to book", "book by X" | **No** | no travel-date series, one season, Guard condition 5 |

So an honest Holiday Fare Report is a **"what the board shows for the holiday windows, and how much of the map we can judge"** report, with method and sample sizes, not a fare-movement study. The Hub picks the headline; I would suggest the coverage statistic plus the holiday-window snapshot per hub, with a clear statement of what it does not show.

## M0-4. `/time-off` for 2027

- All 12 holiday toggles compute dates by rule (`src/ptoCalendar.js`: OPM observed-date rule), `PTO_LAST_DAY = '2027-12-31'`, so every toggle has 2027 dates, and the default set is 7 holidays (New Year's, Memorial Day, Independence Day, Labor Day, Thanksgiving, the day after, Christmas). The owner's "which holidays are on by default" question from Priya's seat is answered by that list; the page already states it.
- The page title and copy already say "2026-2027" and "every long weekend through the end of 2027"; `.ics` (`/time-off/<origin>.ics`) and the share link (budget + holiday code) cover the full range. A blog post, `how-we-built-the-2027-long-weekend-calendar`, exists.
- Rendering: server-rendered by the Worker (`src/ptoPages.js`), no static files. **No print stylesheet exists** (no `@media print` in `ptoPages.js`), no per-airport 1200x630 social image beyond the existing share card, and no embed snippet. M4 adds those three plus a national "2027 long weekends" section.

## M0-5. Analytics access

The repo has no Cloudflare API token or analytics integration: the Web Analytics beacon is injected at the edge (A3 audit), `.env.example` holds no Cloudflare variables, and no code calls the analytics GraphQL API. Visits by source therefore cannot be read automatically today. **Plan:** M1 shows signups and confirmations by source only. If the owner wants visits in the view, create a Cloudflare API token with Account Analytics: Read, store it as a Worker secret (owner runs `wrangler secret put` in their own terminal), and a later PR adds the GraphQL call. The Day-14 baseline asks the owner to paste visits from the Cloudflare dashboard.

## M0-6. Overlaps and proposed order

| File | Also touched by | Note |
| --- | --- | --- |
| `index.html` (homepage signup, payload) | K-B2 (merged), J3 | M1 adds `source: 'home'`; M7 adds the sample-digest link |
| `welcome.html`, `src/welcome.js` | K-B2 (merged) | M2 block lives here |
| `src/emailTemplates/*`, `src/email.js` | K-B8 (merged) | M2 adds the block to the welcome email (does the welcome email exist? only a verification email and the on-site welcome page do; see below) and the digest footer |
| `src/ptoPages.js`, `src/ptoCalendar.js` | K-B5 (merged), J3 C8 | M4 print, social image, embed; M1 adds `utm.js` |
| `check.html`, `/check` handler | K-B4 (merged) | M3 share button and image |
| `Phase 17 pSEO Generator`, 880 `/data/` pages | K-B9 (merged) | M1 adds a source to the form; requires regenerating all 880 pages (large diff, same approach as earlier regenerations) |
| `hub.html`, `reward-terms.html` | none open | M2 corrects tier text |
| `src/index.js` | many | M1 (`/api/signup`, `/api/verify`, `/admin/growth`) and M2 (webhook referral rule) |

**Welcome email.** There is a verification email, a confirmation (welcome) page, and the digest; there is **no separate welcome email**. M2 should put the block on the confirmation page and in the digest footer and, if the owner wants a third place, add the block to the verification email (not a new email).

**Proposed PR order** (each its own PR through the train; dates are latest, not earliest): M1 data and source tagging (Oct 24); M1 `/admin/growth` and baseline script (Oct 27 to 31); M2 (Nov 1, Guard read first); M7 follow-up (Nov 2); M4 (Nov 2); M5 page, unlinked (Nov 3); M3 (Nov 4); M6 (Nov 4 or after Nov 9). Flag flips: `ENABLE_REFERRAL_PROMPT` by Nov 4, `ENABLE_SHARE_IMAGE` Nov 4 or after Nov 9, `ENABLE_REPORTS` Nov 11.

## M0-7. Load

With K fully merged, M fits the windows to Nov 4 without displacing anything. What could still slow it: the Hub's Guard reads (M2, M5, M6 copy), the owner's approval cadence (one PR at a time, wait for deploy and smoke check between merges), and the 880-page regeneration for M1. Cut order is unchanged (M6, M3, M5's homepage link; never M1). If the owner does not want the weak "fare movement by region" content, nothing is lost: M5 as scoped above is cheaper than the plan assumed.

## M0-8. Route count

- Data: 880 distinct US routes on 2026-10-21 (22 x 40), plus 40 TLV. The plan's 828 came from the Oct 16 files.
- Hand-typed "880" remains in `index.html` (trust line, "Browse All 880 Routes"), `about.html` and `Phase 17 pSEO Generator (Step 106).py`; one `/data/` page also contains it. "600" appears only in unrelated CSS font weights.
- Status of J1.5: no computed route count exists in the code (no `ROUTE_COUNT` or similar). The number matches today, but it is still typed by hand in three source files. M should either compute it at build time (Guard condition 6) or add a test that fails when the typed number differs from the data. I recommend the test (small, no behavior change) as part of M1.

## Decisions I need from the owner before M1

1. **Confirmation rule for referrals** (M0-2): change `referrals.status` to follow `verified_email = 1` (recommended), keep it on first email open, or both.
2. **Migration for `users.signup_source`** (additive, `0031`): approve applying it to production before the M1 code merges (auto-deploy does not run migrations).
3. **Cloudflare analytics token** (M0-5): yes now, later, or never (the baseline then uses dashboard numbers pasted by the owner).
4. **Regenerating the 880 `/data/` pages** for the source tag: approve a large generated diff, or limit M1 to the other paths and tag `/data/` signups with their existing `partner_id: 'pseo'`. (Recommended: the second; `pseo` is already a clean source and avoids an 880-file diff.)

Nothing else blocks M1. On the owner's go, M1 starts on `m/m1-measurement`.
