# Plus tier design (ROADMAP step 22, "T8-spec"): DRAFT for approval, 2026-10-07

**Status: draft. Not approved. No billing code has been written.** This is the design document that steps 22 and 23 call for before any
Stripe or Plus work starts. It comes from the 2026-10-07 implementation guide and its alignment guide (the second paste was cut off at the
Weeks 2 to 3 table row, so only what is above that line was used), reconciled against the actual repo. Where the guides and the repo disagree,
the repo wins and the difference is listed in section 2.

## 1. What is being decided
Whether, when and how to sell a paid tier ("Plus", the roadmap's "founding-member" tier, about $29 a year), and what it contains. The guides assume
this starts in November, after the Oct 17 launch. Nothing here changes the free product.

## 2. Corrections to the guides' premises (current facts, 2026-10-07)
| Guide says | Repo and roadmap say |
|---|---|
| Launch Oct 2, go/no-go Oct 1, Phase 0 steps broken or unverified | Launch is **Oct 17**, go/no-go **Oct 16**; Phase 0 is nearly all done and confirmed live (`go_no_go_scorecard.md`) |
| Step 17 (Seller of Travel) blocks monetization | Risk accepted 2026-10-07; copy pass live; four reopen triggers recorded in `CLAUDE.md`. Step 23 still carries "resolve 17 before scaling beyond a soft launch" |
| Stripe "does not exist yet" | True: no Stripe code. `CLAUDE.md` still says "Monetization/billing deliberately deferred until free-tier signup traction is validated: do not build Stripe yet". Approving this document is the explicit reversal |
| Step 20 (partner registry) must be built | Mostly built: `partners` table with live/pending status, `/out/<slug>` redirects, click logging, disclosure placement. Its roadmap row is stale |
| `state_METRICS.md` is blank | The file does not exist. Real numbers come from the `events` table: **3 users, 11 trips**; analytics before launch is mostly test and crawler traffic (`launch_week_runbook.md` section 6) |
| Guide's step mapping (19 access control, 6 partner infra, 12 metrics dashboard, 53/55/57 as trip hub and content) | Step 19 is insurance referral licensing; 6 is analytics events; 12 is the revenue health monitor; 53 is Group Watch; 55 the checklist generator; 57 AI-assistant listings. The mapping in section 9 below replaces it |
| Create 10 route pages at `/deals/...` | 601 `/data/` pages and `/flight/` route pages already exist; a second URL set would duplicate them |
| Pre-order target of 50+ signups, 1% conversion | There are 3 users; a conversion test is meaningless until real traffic exists (section 7) |

## 3. What exists to build on
- `users.subscription_tier` (`'free'` or `'paid'`). **Nothing legitimately sets `'paid'`.** `POST /api/signup` used to accept a client-supplied tier (any visitor could mark any
  email paid); fixed in this same PR (`tests/signup_tier.test.js`). This had to be closed before anything is sold.
- `rankedDealsFilename(tier, origin)`: paid users get the hourly file, free users the daily or 24h-delayed one. That is a paid tier **selling speed**, which the 2026-10-03
  amendment (step 22/23 and step 58) forbids. When step 58 removes the delay it must also remove this tier difference.
- `getEntitlements()` in `src/rewards.js` is **referral rewards** (confirmed referrals unlock 2 origins, early bird, early-access features, a badge), not a subscription. Plus entitlements must
  merge with it, not replace it.
- Clerk auth (production instance), D1, Resend, the `events` analytics table, `/admin/metrics`, `watchlists`, `trips`, the Away Mode checklist and pre-departure emails, the partner registry.

## 4. What Plus would sell (proposal; the owner picks)
Constraint: **not speed, not earlier access**. The guide's feature ideas assume a "plan" object ("re-run last plan", household sharing, a sitter page). Sparkfare has no plan
object; its nearest equivalents are a click-tracked `trips` row plus the generated Away Mode checklist, and `watchlists`. Proposed definition: **a plan = a saved trip and its checklist.**

| Guide feature | Maps to | Needs | Recommendation |
|---|---|---|---|
| More watchlists, more origins | `watchlists`, saved origins (free is 1 origin) | a cap check in two endpoints | **v1** (matches the roadmap's own examples) |
| Configurable reminder timing | the existing fixed-day emails (stress valve, briefing, departing soon) | a per-user timing setting and sender changes | **v1** |
| Household sharing (read-only for non-Plus) | share trips and watchlists with invited emails | `household` table, invite emails, consent and unsubscribe rules for invitees | v2: real privacy work |
| "Re-run last plan", seasonal re-run | copy a past trip's checklist, or recurring watchlist | a plan model first | v2 |
| "While I'm gone" sitter page | a shareable page with pet, trash, mail and emergency-contact details | **personal data of third parties**, expiry, noindex, a privacy-policy and terms update that has not had legal review | later, separate decision |
| MCP server with metered calls, white-label multi-tenant, partner dashboard | not Plus features | separate products, new billing, a multi-tenant rewrite | out of scope here; separate decisions (roadmap steps 38/57 already cover the data surface, link-outs only) |

## 5. Pricing (decision needed)
Options in the guide: **$9 a month "early backer" capped at 100**, or **$29 a year**. The roadmap says about $29 a year as a founding-member offer. Recommendation: a single founding price, **$29 a
year, capped (for example 100 members)**, no A/B test: with a handful of users there is no traffic to test on, and two price points make refunds, support and the later entitlement
logic harder. Add refund wording and auto-renewal disclosure before taking money (section 8).

## 6. Technical design
- **Tables (new migration):** `subscriptions(id, user_id, plan, status, stripe_customer_id, stripe_subscription_id, current_period_end, cancel_at_period_end, created_at, updated_at)`;
  `stripe_events(id PRIMARY KEY, type, received_at)` so a webhook delivered twice is applied once.
- **Single writer for the tier:** the Stripe webhook is the only code that sets `subscriptions` and `users.subscription_tier`. Entitlement = status `active` or `trialing` and `current_period_end` in
  the future. On cancel, access continues to period end, then reverts.
- **Stripe:** Checkout Session in subscription mode (card data never touches Sparkfare), webhook with signature verification (same pattern as the Resend webhook; read the header names from real
  traffic, not the docs, the last webhook shipped with the wrong ones), events `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.
  **Cancel and payment-method changes use Stripe's hosted Customer Portal**: self-service in under two minutes with no custom cancel page to build. Secrets: `STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET`, price id; test mode first.
- **Entitlements:** extend `getEntitlements()` to return the larger of the referral-based and subscription-based values. A flag `ENABLE_PLUS` (default off) gates the pricing page, checkout and
  every Plus check, like the other features.
- **Tests that must exist before any live key:** webhook signature (valid, invalid, replay), idempotency, entitlement on active, past due, canceled-at-period-end and expired, the signup tier
  never client-settable (done), and a free user cannot reach a Plus endpoint.

## 7. Measuring it (replacing the guide's pre-order test)
Count `/pricing` views, checkout starts and completed checkouts as events (using the bot class on clicks, so crawlers are excluded). Decide thresholds against real traffic after launch rather than
a 50-signup target: record the baseline in the first two weeks after Oct 17, then set the gate. A waitlist capture on `/pricing` (email, double opt-in) is a cheap interest signal before charging anyone.

## 8. Compliance and risk (non-attorney reading; none of this has had a legal review)
- **Seller of Travel position:** Plus must be described as a subscription for alerts and planning tools. Reopen trigger 2 includes "a fee that looks like a booking fee"; a flat annual
  subscription is not one, but the pricing copy must keep saying Sparkfare does not sell or book travel. The referral-copy guard (`npm test`) already enforces the banned phrases.
- **Auto-renewing subscriptions:** many states regulate disclosure, consent and online cancellation. Needs terms, a clear renewal notice, a refund statement, and the cancel path linked from the account page.
- **Sales tax and Stripe account setup:** the owner's accountant or entity decision; this is the second reason to form the LLC before taking money (roadmap step 18).
- **Privacy policy and `/terms`:** add Stripe as a processor, what is stored (ids and status, not card data), retention. `/terms` is currently a one-section page.
- **Affiliate commissions to others (the guide's 20%):** payouts, tax forms and endorsement disclosures for people who promote Plus. Do this after the first paid conversions, via the existing step 37.

## 9. Sequencing, mapped to the real roadmap
Gate G0: Phase 0 passes the Oct 16 review. Gate G1: the owner approves this document and answers section 10. Nothing below starts before both.
1. **Pre-requisite, done in this PR:** signup no longer accepts a client tier.
2. **Step 23a:** `subscriptions` and `stripe_events` migration, webhook handler, Stripe test mode, behind `ENABLE_PLUS`.
3. **Step 23b:** entitlements merge and the two v1 gates (watchlist and origin caps, configurable reminder timing).
4. **Step 23c:** `/pricing` page, Checkout, Customer Portal link on `/account`, terms, privacy and refund wording.
5. **Soft launch** of the capped founding cohort, then measure for two to four weeks.
6. **Step 37 (Awin or ShareASale advertiser listing)** and the affiliate assets page, only after the first paid conversion.
7. **Remove the paid-gets-hourly-data tier difference** together with step 58.
8. Later and separately, each needing its own decision: household sharing, re-run and seasonal re-run, the sitter page, white-label, metered MCP.
Rough size for steps 2 to 4: the guide's estimates (about 30 to 40 hours for Stripe, entitlements, schema and cancel) look plausible for the narrow v1 above and not for the full list; the
multi-tenant and household estimates are not credible without a design. No dates are committed here.

## 10. Decisions needed from the owner
1. Approve reversing "do not build Stripe yet", and when (after the Oct 17 launch and the first two weeks of real data is my recommendation).
2. Accept "a plan = a saved trip and its checklist", and pick the v1 features (recommended: more watchlists and origins, configurable reminder timing).
3. Price: one capped founding price (recommended $29 a year, cap 100) or the $9 a month variant.
4. Form the LLC before taking money (roadmap step 18), and arrange a short legal read of terms, privacy and the renewal and refund wording.
5. Confirm that household sharing, the sitter page, white-label and metered MCP are out of v1.
