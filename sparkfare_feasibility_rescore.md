# Sparkfare — Feasibility Re-Score (Workplan Step 37)

*The original feasibility scoring lives in the project's Drive docs, which this session doesn't
have access to — this is a fresh scoring framework, reconstructed from scratch against everything
actually verified in this repo (`CLAUDE.md`, the Master Workplan CSV, and a live query against
production D1), not a comparison against the original score. Every rating below cites the specific
evidence behind it — no dimension is scored from impression.*

## Real numbers, queried live from production D1 (2026-09-13)

| Metric | Value |
|---|---|
| Total users | 3 |
| Verified users | 1 |
| Unsubscribed | 0 |
| Trips ever tracked | 1 |
| Away Mode emails ever logged | 1 |
| Confirmed paid bookings | 0 |

This is genuinely pre-traction scale. Every score below should be read with this as the backdrop:
the product exists and largely works, but almost nothing about it has been exercised by real,
independent users yet.

## Scoring framework

Eight dimensions, 1–5 each, same convention this project already uses elsewhere
(`state_AFFILIATE_PROGRAMS.md`'s Necessity/Availability/Revenue/Ease-of-Sale scoring). 5 = strong,
1 = weak/unproven.

### 1. Product completeness — **4/5**
The core mechanic (daily deal detection + Away Mode) is genuinely built: pipeline running daily
(confirmed), frontend live (confirmed), accounts/auth working end-to-end (confirmed 2026-09-05),
trip tracking mostly confirmed (the interstitial and My Trips dashboard are; reconciliation
delivery isn't, for the inherent reason that no real booking has happened yet). This is a mature
MVP, not a prototype.

### 2. Technical reliability — **2/5**
Not a knock on effort — a real, recurring pattern worth naming plainly: this codebase has
repeatedly had a feature carry a "CONFIRMED working" label that turned out to be false on closer
inspection, sometimes for the feature's *entire life*:
- Server-side auth token verification was completely broken (100% failure rate) from when it was
  first built until 2026-09-05, despite an earlier "CONFIRMED working" label.
- The hourly multi-origin pipeline's `display_name`/history keys were silently double-prefixed
  and corrupted since the pipeline first started running (~2026-09-06), undetected until
  2026-09-11.
- `env.ASSETS` was never actually bound in production — found 2026-09-13 — meaning the real
  scheduled daily-alert email has likely been sending with zero deals since it was built.
- A duplicate `let` declaration once silently killed the entire homepage's deal-card rendering.

The pattern isn't that bugs exist (normal) — it's that "confirmed live" has repeatedly meant
"deliverability/deployment confirmed," not "the actual output was inspected and correct." Worth a
deliberate pass re-verifying older "CONFIRMED" claims rather than trusting them by default going
forward.

### 3. Market validation / traction — **1/5**
3 total users, 1 verified, 1 tracked trip, 0 confirmed bookings, no analytics anywhere in the
codebase. This is the single biggest open risk to the business case — every other investment
(affiliate applications, publisher revenue-share design, tiered pricing) is being built ahead of
any evidence that real, independent people want this product.

### 4. Revenue readiness — **2/5**
Real, live, earning mechanisms exist: 3 real Away Mode partners (SafetyWing, Bounce, US Global
Mail) with real referral links, plus flight-booking revenue tracking newly built (Step 101). But
zero actual earnings are recorded anywhere in this project's own documentation — the mechanisms
are real and correctly wired, they just haven't produced a single confirmed dollar yet as far as
this repo's own record shows.

### 5. Legal/compliance risk — **2/5**
Genuinely unresolved, not just undocumented: Seller-of-Travel exposure across CA/FL/HI/WA is
explicitly flagged as "real exposure, not fully quantified... worth an actual consultation before
scaling traffic meaningfully" (Steps 23/24, researched but not resolved 2026-09-12). Insurance
referral licensing is similarly thin and mixed. The privacy policy and disclosure pages both
explicitly disclaim having had real legal review. None of this blocks continued building, but it
does mean **scaling traffic before an actual attorney consult carries acknowledged, real risk**,
by this project's own documented findings.

### 6. Differentiation — **3/5**
The ranking-methodology claim is real and defensible — verified against the actual code, not
paraphrased (Step 98). The second claimed differentiator (trip-length matching) is explicitly
flagged as UI-only and functionally unverified in `sparkfare_product_background.md` — a real
differentiator exists, but the messaging pillar built on the second one ("Built around your actual
trip") is itself marked ON HOLD for exactly this reason.

### 7. Distribution capacity — **1/5**
No blog/SEO content, no confirmed social presence, no analytics to know what would even work, and
the one channel actually designed for real reach (Phase 15 publisher syndication) is gated on a
still-undecided revenue-share model (Step 92). This is the weakest dimension in the whole
assessment: everything built so far helps someone who has already arrived — nothing yet brings
anyone there. (Step 35, scoped alongside this document, is the first real attempt at closing this
gap.)

### 8. Founder/execution bandwidth — **3/5**
A single-operator project with real technical depth for a solo effort, and legal/compliance gaps
are being tracked honestly rather than ignored. Not a flaw, but a real constraint worth naming:
every affiliate application, every revenue-share decision, and now every content piece all funnel
through one person's bandwidth — this caps how many open items can genuinely move in parallel,
regardless of how much gets built.

## Composite

**(4+2+1+2+2+3+1+3) / 8 = 2.25 / 5**

## Honest bottom line

**The product is real and reasonably mature. The business is not yet proven.** Product
completeness is the strongest dimension by a wide margin; traction and distribution are the
weakest by an equally wide margin. The technical-reliability pattern (repeated false "confirmed"
labels) is worth treating as a real signal, not noise — it suggests the next high-value work might
be a deliberate re-verification pass on older claims, not just new features. Legal risk is
acknowledged and real, not hypothetical, and scaling traffic meaningfully before an actual
attorney consult would be scaling ahead of a known, documented gap.

**This isn't a recommendation to stop building** — it's a snapshot of where the real risk
currently sits, so the next round of decisions (Step 92's revenue-share terms, whether to invest
further in Phase 15 publisher syndication, how aggressively to pursue Step 35's content plan) can
be made against the actual state rather than the more polished picture individual "CONFIRMED"
entries might suggest in isolation.
