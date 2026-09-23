# Antigravity build instructions v2 — aligned to the full GTM/monetization strategy (2026-09-22)

Supersedes the build **order** in `claude/antigravity_build_instructions_prioritized_2026-09-22.md` (that doc's T0/T1/T2/T3/T4/T5/T6/T7 task specs are unchanged and are not repeated in full here — paste them from that doc when you reach that step). This doc adds the tasks that came out of `claude/gtm_deep_strategy_bold_pivots_2026-09-22.md` (competitive benchmarking, the Away Mode reframe, the affiliate-advertiser flip, white-label SaaS, video/MCP distribution, data-source de-risking) and gives the single, final build sequence across both documents.

Same global instructions block applies to every task below — paste it at the top of every Antigravity prompt, unchanged from the prior doc:

```
CONTEXT
Sparkfare is a flight-deal-alert product. Stack: Cloudflare Workers, D1, Clerk (auth),
Resend (email), GitHub Actions (hourly + daily pipelines), Travelpayouts/Aviasales Data API.
12 origin airports, ~40 destinations per origin. Existing docs in repo:
sparkfare_ranking_methodology.md, sparkfare_style_guide.md, wrangler.jsonc, daily-fetch.yml.

RULES
1. DISCOVER FIRST. Before editing, inspect the repo and list the actual files/tables you will
   touch. Do not invent file paths, table names, or function names; use what exists.
2. Every new user-facing feature ships behind a feature flag (default OFF) and is reversible.
3. Never hardcode secrets. Use wrangler secrets/env bindings.
4. Schema changes = new numbered D1 migration, backward compatible, with a rollback note.
5. Follow sparkfare_style_guide.md for UI. Follow sparkfare_ranking_methodology.md for any
   "% below average" logic; if you change the methodology, update that doc in the same change.
6. Honesty rule: never display a price claim (badge, share image, counter) that is not backed
   by data passing the guardrails in TASK T1. Every claim must state its basis and "as of" time.
7. Add tests for every pure function; add an end-to-end check for each new route.
8. Do not add or expose any affiliate link whose status is not `live` in the partner registry.
9. Passive-ops rule: do not build any feature whose ongoing operation requires Coby to manually
   reconcile payouts, negotiate per-partner terms, or perform outreach. If a task seems to need
   that, stop and flag it instead of building a manual workaround.
10. Report at the end: files changed, migrations added, flags added, how to verify locally,
    and what could NOT be verified (label "built, not verified live").
```

---

## The final sequence (this doc supersedes the v1 table)

| # | Task | Source doc | Type | Gate to start |
|---|---|---|---|---|
| 1 | T0 — Instrumentation and metrics baseline | v1 (unchanged) | Code | None. Start now. |
| 2 | T1 — Price-data honesty guardrails | v1 (unchanged) | Code | None. Start now, parallel with T0. |
| 3 | T7 — Email deliverability and consent | v1 (unchanged) | Code | None. Start in parallel. |
| 4 | **T2 — Away Mode partner registry, disclosure, attribution** | v1, **priority raised** | Code | T0 events exist |
| 5 | **T13 — Secondary flight-data source (de-risking)** | new (Section 4 of strategy doc) | Code, parallel track | T1's `dealQuality` interface exists |
| 6 | **T2b — Automated pre-departure Away Mode sequence** | new (opportunity area 1) | Code | T2 done |
| 7 | T4 — Share-image generator | v1 (unchanged) | Code | T1 done |
| 8 | T5 — Programmatic route pages (**now dual-pillar**: flight deal + Away Mode module both first-class) | v1, modified | Code | T1 done; Travelpayouts ToS check done |
| 9 | **T5b — Self-serve display ads on route pages** | new (opportunity area 2) | Code | T5 done |
| 10 | **T5c — Auto-expanding route-page content** | new (opportunity area 3) | Code | T5 done |
| 11 | T3 — Referral loop v1 | v1 (unchanged) | Code | T0, T7 done; reward tiers decided |
| 12 | T6 — Embeddable widget (self-serve, backlink-only) | v1 (unchanged) | Code | T5 done; ToS check done |
| 13 | **T7b — Web push notification channel** | new (opportunity area 4) | Code | T7 done |
| 14 | **T8-spec — Paid-tier design spec (doc only)** | new, replaces old T8 | Doc | Stable engaged cohort signal in T0 data (not necessarily a full 8 weeks — see note below) |
| 15 | **T8-MVP — Minimal freemium paid tier** | new | Code | T8-spec approved |
| 16 | **T9 — Awin/ShareASale advertiser listing** | new (Section 2 of strategy doc) | Non-code, business setup | T8-MVP live |
| 17 | **T10 — White-label config layer ("Sparkfare Engine")** | new (Section 5) | Code | T6, T2, T8-MVP billing all live |
| 18 | **T11 — Short-form video generator** | new (Section 5) | Code | T1, T4 done |
| 19 | **T12 — MCP / agentic-AI data surface** | new (Section 5) | Code | T6's public JSON endpoint live |
| 20 | **T14 — Historical data-licensing feasibility (doc only)** | new, speculative | Doc | Travelpayouts ToS resolved; T13 live; enough accumulated history |

Note on T8-spec's gate: the strategy doc's revised guidance is not to wait for the original "8+ weeks of data" threshold in isolation — introduce a cheap tier once T0 shows a **stable core of engaged users** (real return-visit and click behavior, not just opens), because the freemium model (a free tier funded by affiliate clicks, alongside a small paid tier) is how the category's biggest players actually operate, per the competitive benchmarking. Use judgment on "stable," but don't gold-plate this gate.

---

## New and modified task prompts

### T0 — Instrumentation and metrics baseline

```
[paste global instructions block]

TASK: T0 Instrumentation and metrics baseline

WHY: state_METRICS.md is empty. No later task or business decision (Away Mode vs. flight
affiliate, referral loop viability, paid-tier timing) can be evaluated without real numbers.

BUILD:
- D1 table `events` (id, ts, event_type, user_id nullable, anon_id, origin, route, partner,
  sub_id, source, meta JSON).
- Log these events server-side: signup, alert_subscribed, alert_email_sent, email_open (via
  Resend webhooks), email_click, outbound_click (flight and each Away Mode partner, with
  sub_id), share_click, referral_signup, widget_impression.
- Endpoint GET /admin/metrics (Clerk-admin only, or shared-secret) returning weekly rollups:
  visitors (if available), signups, active subscribers, emails sent, open rate, click rate,
  outbound clicks by partner, and a cohort table (first-14-day open+click rate per signup week).
- Treat opens as a weak signal (Apple Mail Privacy Protection inflates them); report click and
  return-visit rates alongside opens.
- A script/workflow that emits a markdown snapshot matching state_METRICS.md's table layout,
  so it can be pasted straight into the project.

ACCEPTANCE CRITERIA:
- [ ] Migration applies cleanly on a fresh and an existing D1.
- [ ] Each event type is emitted from a real code path and covered by a test.
- [ ] /admin/metrics rejects unauthenticated requests.
- [ ] Snapshot output has one row per baseline metric in state_METRICS.md, "not available" where missing.
- [ ] No PII beyond user_id/anon_id in events.

OUT OF SCOPE: third-party analytics, A/B framework.
```

### T0 — Instrumentation and metrics baseline

```
[paste global instructions block]

TASK: T0 Instrumentation and metrics baseline

WHY: state_METRICS.md is empty. No later task or business decision (Away Mode vs. flight
affiliate, referral loop viability, paid-tier timing) can be evaluated without real numbers.

BUILD:
- D1 table `events` (id, ts, event_type, user_id nullable, anon_id, origin, route, partner,
  sub_id, source, meta JSON).
- Log these events server-side: signup, alert_subscribed, alert_email_sent, email_open (via
  Resend webhooks), email_click, outbound_click (flight and each Away Mode partner, with
  sub_id), share_click, referral_signup, widget_impression.
- Endpoint GET /admin/metrics (Clerk-admin only, or shared-secret) returning weekly rollups:
  visitors (if available), signups, active subscribers, emails sent, open rate, click rate,
  outbound clicks by partner, and a cohort table (first-14-day open+click rate per signup week).
- Treat opens as a weak signal (Apple Mail Privacy Protection inflates them); report click and
  return-visit rates alongside opens.
- A script/workflow that emits a markdown snapshot matching state_METRICS.md's table layout,
  so it can be pasted straight into the project.

ACCEPTANCE CRITERIA:
- [ ] Migration applies cleanly on a fresh and an existing D1.
- [ ] Each event type is emitted from a real code path and covered by a test.
- [ ] /admin/metrics rejects unauthenticated requests.
- [ ] Snapshot output has one row per baseline metric in state_METRICS.md, "not available" where missing.
- [ ] No PII beyond user_id/anon_id in events.

OUT OF SCOPE: third-party analytics, A/B framework.
```

### 2. T1 — Price-data honesty guardrails ("trust layer")

```
[paste global instructions block]

TASK: T1 Price-data honesty guardrails

WHY: Travelpayouts data is cached (2–7 days) from user search history. Every downstream growth
feature (share images, route pages, widget) inherits this data's honesty problem if unguarded.

BUILD:
- Persist found_at and expires_at (if the API returns them) for each price observation;
  discover the current schema first.
- A single pure module dealQuality(observations, now) returning
  {eligible, baseline, baselineN, spanDays, staleness, reasons[]}.
- Rules (thresholds as constants in one config; flag them in your report for tuning):
  - Baseline = median of trailing 30-day observations; keep the current documented mean as a
    secondary field until the owner approves switching, and document both.
  - Minimum N >= 10 observations AND >= 14 days of history for any public "% below average"
    claim (current documented minimum is 7 days — raise it only for public-facing claims).
  - Suppress a price older than its expires_at, or older than 48h if expires_at is absent.
  - "Rare Find" = below baseline by a robust threshold (e.g. >= 2 MAD below median) AND eligible.
- UI: every price shows "as of <time>"; every badge shows its basis ("X% below 30-day median,
  N observations"); a standing note: "Prices are sampled and may change; check the airline or
  agency."
- Log suppressed deals with reasons (feeds T0).

ACCEPTANCE CRITERIA:
- [ ] Unit tests: too few observations, short history, stale price, missing expires_at, outlier, normal.
- [ ] No badge renders without basis text and timestamp.
- [ ] Methodology doc updated with the median rule, minimums, staleness cutoff, changelog line.
- [ ] Backtest script over existing stored data reports how many current badges would be
      suppressed or changed, and by how much — include in your report.

OUT OF SCOPE: switching data providers; live re-verification at click time (note as a follow-up).
```

### T0 — Instrumentation and metrics baseline

```
[paste global instructions block]

TASK: T0 Instrumentation and metrics baseline

WHY: state_METRICS.md is empty. No later task or business decision (Away Mode vs. flight
affiliate, referral loop viability, paid-tier timing) can be evaluated without real numbers.

BUILD:
- D1 table `events` (id, ts, event_type, user_id nullable, anon_id, origin, route, partner,
  sub_id, source, meta JSON).
- Log these events server-side: signup, alert_subscribed, alert_email_sent, email_open (via
  Resend webhooks), email_click, outbound_click (flight and each Away Mode partner, with
  sub_id), share_click, referral_signup, widget_impression.
- Endpoint GET /admin/metrics (Clerk-admin only, or shared-secret) returning weekly rollups:
  visitors (if available), signups, active subscribers, emails sent, open rate, click rate,
  outbound clicks by partner, and a cohort table (first-14-day open+click rate per signup week).
- Treat opens as a weak signal (Apple Mail Privacy Protection inflates them); report click and
  return-visit rates alongside opens.
- A script/workflow that emits a markdown snapshot matching state_METRICS.md's table layout,
  so it can be pasted straight into the project.

ACCEPTANCE CRITERIA:
- [ ] Migration applies cleanly on a fresh and an existing D1.
- [ ] Each event type is emitted from a real code path and covered by a test.
- [ ] /admin/metrics rejects unauthenticated requests.
- [ ] Snapshot output has one row per baseline metric in state_METRICS.md, "not available" where missing.
- [ ] No PII beyond user_id/anon_id in events.

OUT OF SCOPE: third-party analytics, A/B framework.
```

### 2. T1 — Price-data honesty guardrails ("trust layer")

```
[paste global instructions block]

TASK: T1 Price-data honesty guardrails

WHY: Travelpayouts data is cached (2–7 days) from user search history. Every downstream growth
feature (share images, route pages, widget) inherits this data's honesty problem if unguarded.

BUILD:
- Persist found_at and expires_at (if the API returns them) for each price observation;
  discover the current schema first.
- A single pure module dealQuality(observations, now) returning
  {eligible, baseline, baselineN, spanDays, staleness, reasons[]}.
- Rules (thresholds as constants in one config; flag them in your report for tuning):
  - Baseline = median of trailing 30-day observations; keep the current documented mean as a
    secondary field until the owner approves switching, and document both.
  - Minimum N >= 10 observations AND >= 14 days of history for any public "% below average"
    claim (current documented minimum is 7 days — raise it only for public-facing claims).
  - Suppress a price older than its expires_at, or older than 48h if expires_at is absent.
  - "Rare Find" = below baseline by a robust threshold (e.g. >= 2 MAD below median) AND eligible.
- UI: every price shows "as of <time>"; every badge shows its basis ("X% below 30-day median,
  N observations"); a standing note: "Prices are sampled and may change; check the airline or
  agency."
- Log suppressed deals with reasons (feeds T0).

ACCEPTANCE CRITERIA:
- [ ] Unit tests: too few observations, short history, stale price, missing expires_at, outlier, normal.
- [ ] No badge renders without basis text and timestamp.
- [ ] Methodology doc updated with the median rule, minimums, staleness cutoff, changelog line.
- [ ] Backtest script over existing stored data reports how many current badges would be
      suppressed or changed, and by how much — include in your report.

OUT OF SCOPE: switching data providers; live re-verification at click time (note as a follow-up).
```

### 3. T7 — Email deliverability and consent

```
[paste global instructions block]

TASK: T7 Email deliverability and consent

WHY: Any referral growth (T3) multiplies email volume. Deliverability damage is slow to reverse,
so this must be solid before T3 ships.

BUILD:
- Audit and document DNS status for the sending domain (SPF, DKIM, DMARC policy); output a
  checklist of what must be fixed at the DNS host. Do not attempt DNS changes yourself.
- One-click unsubscribe: List-Unsubscribe and List-Unsubscribe-Post headers on every
  marketing/alert email, plus a working endpoint.
- Preference center: choose origins, frequency, pause, unsubscribe all.
- Resend webhook handler storing bounces, complaints, suppressions; never send to a suppressed address.
- consent_log table: user, timestamp, source, wording version, IP hash. Double opt-in required
  for any signup arriving via referral (needed by T3).
- Sending guard: throttle new-list volume growth; auto-pause sending if bounce/complaint rate
  crosses configurable thresholds; alert the owner.

ACCEPTANCE CRITERIA:
- [ ] Unsubscribe link and header work end to end in a test send.
- [ ] Suppressed address never receives an email (test).
- [ ] Consent record exists for every new signup after deploy.
- [ ] Report lists remaining DNS/manual steps.
```

### T0 — Instrumentation and metrics baseline

```
[paste global instructions block]

TASK: T0 Instrumentation and metrics baseline

WHY: state_METRICS.md is empty. No later task or business decision (Away Mode vs. flight
affiliate, referral loop viability, paid-tier timing) can be evaluated without real numbers.

BUILD:
- D1 table `events` (id, ts, event_type, user_id nullable, anon_id, origin, route, partner,
  sub_id, source, meta JSON).
- Log these events server-side: signup, alert_subscribed, alert_email_sent, email_open (via
  Resend webhooks), email_click, outbound_click (flight and each Away Mode partner, with
  sub_id), share_click, referral_signup, widget_impression.
- Endpoint GET /admin/metrics (Clerk-admin only, or shared-secret) returning weekly rollups:
  visitors (if available), signups, active subscribers, emails sent, open rate, click rate,
  outbound clicks by partner, and a cohort table (first-14-day open+click rate per signup week).
- Treat opens as a weak signal (Apple Mail Privacy Protection inflates them); report click and
  return-visit rates alongside opens.
- A script/workflow that emits a markdown snapshot matching state_METRICS.md's table layout,
  so it can be pasted straight into the project.

ACCEPTANCE CRITERIA:
- [ ] Migration applies cleanly on a fresh and an existing D1.
- [ ] Each event type is emitted from a real code path and covered by a test.
- [ ] /admin/metrics rejects unauthenticated requests.
- [ ] Snapshot output has one row per baseline metric in state_METRICS.md, "not available" where missing.
- [ ] No PII beyond user_id/anon_id in events.

OUT OF SCOPE: third-party analytics, A/B framework.
```

### 2. T1 — Price-data honesty guardrails ("trust layer")

```
[paste global instructions block]

TASK: T1 Price-data honesty guardrails

WHY: Travelpayouts data is cached (2–7 days) from user search history. Every downstream growth
feature (share images, route pages, widget) inherits this data's honesty problem if unguarded.

BUILD:
- Persist found_at and expires_at (if the API returns them) for each price observation;
  discover the current schema first.
- A single pure module dealQuality(observations, now) returning
  {eligible, baseline, baselineN, spanDays, staleness, reasons[]}.
- Rules (thresholds as constants in one config; flag them in your report for tuning):
  - Baseline = median of trailing 30-day observations; keep the current documented mean as a
    secondary field until the owner approves switching, and document both.
  - Minimum N >= 10 observations AND >= 14 days of history for any public "% below average"
    claim (current documented minimum is 7 days — raise it only for public-facing claims).
  - Suppress a price older than its expires_at, or older than 48h if expires_at is absent.
  - "Rare Find" = below baseline by a robust threshold (e.g. >= 2 MAD below median) AND eligible.
- UI: every price shows "as of <time>"; every badge shows its basis ("X% below 30-day median,
  N observations"); a standing note: "Prices are sampled and may change; check the airline or
  agency."
- Log suppressed deals with reasons (feeds T0).

ACCEPTANCE CRITERIA:
- [ ] Unit tests: too few observations, short history, stale price, missing expires_at, outlier, normal.
- [ ] No badge renders without basis text and timestamp.
- [ ] Methodology doc updated with the median rule, minimums, staleness cutoff, changelog line.
- [ ] Backtest script over existing stored data reports how many current badges would be
      suppressed or changed, and by how much — include in your report.

OUT OF SCOPE: switching data providers; live re-verification at click time (note as a follow-up).
```

### 3. T7 — Email deliverability and consent

```
[paste global instructions block]

TASK: T7 Email deliverability and consent

WHY: Any referral growth (T3) multiplies email volume. Deliverability damage is slow to reverse,
so this must be solid before T3 ships.

BUILD:
- Audit and document DNS status for the sending domain (SPF, DKIM, DMARC policy); output a
  checklist of what must be fixed at the DNS host. Do not attempt DNS changes yourself.
- One-click unsubscribe: List-Unsubscribe and List-Unsubscribe-Post headers on every
  marketing/alert email, plus a working endpoint.
- Preference center: choose origins, frequency, pause, unsubscribe all.
- Resend webhook handler storing bounces, complaints, suppressions; never send to a suppressed address.
- consent_log table: user, timestamp, source, wording version, IP hash. Double opt-in required
  for any signup arriving via referral (needed by T3).
- Sending guard: throttle new-list volume growth; auto-pause sending if bounce/complaint rate
  crosses configurable thresholds; alert the owner.

ACCEPTANCE CRITERIA:
- [ ] Unsubscribe link and header work end to end in a test send.
- [ ] Suppressed address never receives an email (test).
- [ ] Consent record exists for every new signup after deploy.
- [ ] Report lists remaining DNS/manual steps.
```

### 4. T4 — Share-image generator

```
[paste global instructions block]

TASK: T4 Share-image generator

WHY: Every eligible deal should generate a shareable, honest card — a zero-labor acquisition
loop with no ongoing work per share.

BUILD:
- Deal permalink /deal/:origin/:dest/:date with Open Graph and Twitter tags.
- Worker route generating a branded share image (per style guide) for a deal: route, price,
  "X% below its 30-day median (N observations)", "as of <time>".
- Only generate for deals where dealQuality.eligible is true (T1). Otherwise return 404 or a
  neutral card with no price claim.
- Public counter, worded factually: "Deals spotted below their 30-day median: <count>" computed
  from stored data. Do NOT build a "$ saved" counter.
- Emit share_click events (T0).

ACCEPTANCE CRITERIA:
- [ ] Image renders within a sensible latency and is cached.
- [ ] Ineligible/expired deal produces no price claim.
- [ ] Share page includes disclosure, basis, and timestamp.
- [ ] Test verifying the counter equals a direct DB query.
```

### 5. T5 — Programmatic route pages (MODIFIED: add a referral CTA, not just a signup CTA)

```
[paste global instructions block]

TASK: T5 Programmatic route pages

WHY: The single most durable, zero-marginal-labor acquisition asset available — built on price
history you already generate. This is the top acquisition priority.

BUILD:
- Pages per origin-destination pair: current best price (if not stale), trailing price chart,
  30-day median with basis, best-months summary only if data supports it, Away Mode module
  (registry-gated), signup CTA for that route.
- MODIFIED: once T3 (referral loop) exists, the signup CTA on these pages should route through
  the same referral-attribution flow, so a shared route-page link and a referral-share link are
  the same mechanism, not two separate funnels. If T3 isn't built yet, ship the plain signup CTA
  now and wire in the referral variant when T3 lands — do not block T5 on T3.
- Thin-page policy: do not publish a route page unless it has >= N observations and >= 14 days
  of history; return noindex for the rest.
- sitemap.xml, canonical URLs, JSON-LD (only types matching real content), internal links
  between related routes.
- Freshness: revalidate on the same cadence as the data pipeline.

ACCEPTANCE CRITERIA:
- [ ] Only eligible routes are indexable.
- [ ] Sitemap lists exactly the indexable pages.
- [ ] Lighthouse/CWV report attached for one route.
- [ ] Test that page copy is generated from data, not templates promising unsupported claims.
```

### 6. T3 — Referral loop v1

```
[paste global instructions block]

TASK: T3 Referral loop v1 (feature-flagged)

WHY: Category growth is referral/word-of-mouth driven, and feature-based rewards (not cash or
physical goods) are the only reward shape that costs nothing to fulfill at scale — no shipping,
no address collection, no per-redemption labor.

REWARD DESIGN (confirm before building): feature rewards only. Example tiers: 1 referral = 1
extra origin airport; 3 = faster alert timing; 5 = early access to new features; 10 = public
"Founding Member" badge.

BUILD:
- Tables referral_codes and referrals (referrer, referred, status: pending/confirmed/rejected, reason).
- Referral link per user (/r/:code), stored in a cookie for attribution across signup.
- A referral counts only after the referred user completes double opt-in (T7) and isn't flagged.
- Anti-abuse: block self-referral (same user/email-normalized/device-or-IP-hash within a window),
  disposable-domain list, per-user daily cap, manual review queue.
- Referral Hub page: progress bar, tiers, one-click share (SMS/WhatsApp/X/copy link/email), FAQ,
  plain-language reward terms.
- Reward entitlements enforced server-side.
- Emit referral_signup and share_click events (T0).
- Land shared links on the matching T5 route page where possible, not a generic homepage.

ACCEPTANCE CRITERIA:
- [ ] Flag off = zero visible change.
- [ ] Tests for attribution, self-referral rejection, double opt-in requirement, tier unlock.
- [ ] Reward terms page exists and is linked from the Hub.
- [ ] Admin metric: share of new signups attributed to referral (weekly).

OUT OF SCOPE: paid rewards, cash, giveaways/sweepstakes (legal review needed first).
```

### 7. T6 — Embeddable widget — MODIFIED: self-serve, no revenue-share, no outreach

```
[paste global instructions block]

TASK: T6 Embeddable widget (MODIFIED from the 2026-09-19 spec)

WHY THIS CHANGED: the original spec assumed Sparkfare pays publishers a cut of downstream
affiliate revenue, tracked via partner_id. That model requires (a) negotiating a rate with each
publisher, (b) manually reconciling payouts every month because the live affiliate links can't
carry a sub-ID through their networks (see workplan Step 91), and (c) manually pitching publishers
one at a time (Step 95). All three are recurring human labor with no automation path — the
opposite of what's wanted here. This version removes the payout entirely: the only incentive
for a publisher to embed the widget is that it's free, useful content for their site, in
exchange for a visible backlink. Nobody has to be paid, pitched, or reconciled with.

BUILD:
- A public, self-serve "Get your embed code" page (no login, no application, no approval queue):
  publisher enters their site name/URL, gets a generated iframe/script snippet immediately.
- Widget shows a route sparkline and current status for one origin/destination, with a visible,
  non-removable "Powered by Sparkfare" link back to the matching T5 route page.
- Public read-only JSON endpoint behind the widget, cached, with per-IP/per-origin rate limits,
  serving only eligible (T1) data.
- Log widget_impression by referring host (T0) — for your own visibility only, not for billing
  or payout purposes; no partner_id, no revenue-share accounting, no partners table dependency.
- Embed generator page includes copy-paste snippet and live preview.
- Do NOT build: any partner_id-based attribution tied to a payout, any admin approval workflow,
  any revenue-share ledger. If a future version needs paid partnerships, that is a separate,
  explicitly-scoped decision — not a default of this build.

ACCEPTANCE CRITERIA:
- [ ] Widget works on a static test page from a different origin, with zero manual setup on
      Sparkfare's side beyond the self-serve generator.
- [ ] Rate limiting verified.
- [ ] Widget shows nothing (not stale data) when a route is ineligible.
- [ ] Do not enable publicly until the Step 0 ToS check is confirmed clear.
```

### 8. T2 — Away Mode partner registry, disclosure, attribution

```
[paste global instructions block]

TASK: T2 Away Mode partner registry, disclosure, attribution

WHY: Makes "activate a partner" a config change instead of a code change, enforces the
legal/approval gate in code, and produces the per-partner click data T0/the Revenue Strategist
need to compare Away Mode revenue against flight-affiliate revenue per subscriber.

BUILD:
- Config or D1 table `partners`: id, name, category, url_template, commission_note (free text,
  unverified label), status in (pending, live, blocked_legal, declined), status_reason, updated_at.
- Render Away Mode links only for status = live. Seed from current state: SafetyWing, Bounce,
  US Global Mail, Rocket Languages, Parking Access as live; Holafly as pending. Do not add rates
  you can't source from the affiliate log.
- Mark every insurance-category partner blocked_legal unless explicitly set live (Step 24 open).
  Test asserting a blocked_legal or pending partner never renders a link.
- Reusable disclosure component ("Sparkfare may earn a commission if you buy through this
  link"), wording editable in one place.
- All outbound links go through /out/:partner (302) logging outbound_click with sub_id before redirecting.
- Admin view: clicks by partner and by week; a column for reported conversions/revenue the
  owner can enter manually per partner per month (no invented numbers).

ACCEPTANCE CRITERIA:
- [ ] Tests for the status gate and redirect logging.
- [ ] Disclosure appears on every page showing an affiliate link (list them in your report).
- [ ] Changing a partner's status updates the UI without a code deploy where feasible.

OUT OF SCOPE: applying to programs, negotiating rates, adding insurance partners.
```

### T13 — Secondary flight-data source (de-risking)

```
[paste global instructions block]

TASK: T13 Secondary flight-data source integration

WHY: Every monetization idea in this plan — the honesty guardrails (T1), route pages (T5),
the widget (T6), the MCP surface (T12), and any future data licensing (T14) — depends on one
upstream vendor (Travelpayouts/Aviasales) whose redistribution terms are still being confirmed
and whose pricing is cache-based (2-7 day staleness). This task is insurance, not urgency: it
does not block anything else in this sequence and can run in parallel with T4/T5/T3.

BUILD:
- DISCOVER FIRST: read the current price-fetch module and the dealQuality interface from T1
  before writing anything; the goal is a second data source plugged into the SAME interface,
  not a parallel pipeline.
- Evaluate one candidate secondary source (a metasearch-affiliate feed such as Skyscanner's or
  Kayak's partner API, or another GDS-adjacent aggregator) purely for feasibility: does it cover
  a meaningful subset of the 12 origins, what's the rate limit, what does ITS redistribution
  policy say (read it directly, do not assume).
- If feasible: fetch and store its observations alongside the existing Travelpayouts ones in the
  same schema (tag the source), and feed both into dealQuality so eligibility/staleness rules
  apply uniformly regardless of source.
- Do NOT replace the existing pipeline. This is additive redundancy, not a migration.
- If a second live affiliate program exists behind this source, register it in T2's partner
  registry pattern rather than hardcoding a new link path.

ACCEPTANCE CRITERIA:
- [ ] A feasibility writeup (coverage, rate limits, redistribution terms) exists before any
      fetch code is written.
- [ ] If built: observations are tagged by source; dealQuality treats both sources uniformly.
- [ ] No existing behavior changes if the second source is unavailable (graceful degrade).
- [ ] Report explicitly states whether this source's own terms were confirmed compatible with
      public display/redistribution — the same class of question flagged for Travelpayouts.

OUT OF SCOPE: switching primary providers; a full multi-source ranking algorithm.
```

### T2b — Automated pre-departure Away Mode sequence

```
[paste global instructions block]

TASK: T2b Automated pre-departure Away Mode sequence

WHY: This monetizes the subscriber base that already exists instead of requiring a single new
visitor. Every subscriber with a stored departure_at is a recurring, repeatable cost center
(parking, eSIM, mail, insurance) that today gets exactly one touch. A short automatic sequence
against data already stored costs nothing extra to run once built.

BUILD:
- DISCOVER FIRST: read the existing Away Mode trigger logic (src/email.js, the away_mode_email_log
  table from workplan Step 91) before adding anything.
- Extend the existing scheduled/triggered send logic to fire at day-14, day-7, and day-1 before a
  stored departure_at, each surfacing a DIFFERENT live partner from T2's registry (not repeating
  the same one), so the sequence reads as useful staging rather than repeated ads.
- Reuse T2's disclosure component and status-gate (status = live only) on every send.
- Respect T7's suppression list and consent log — this sequence must never bypass those.
- Log each send as its own event type in T0 (e.g. `away_mode_sequence_sent` with a stage field)
  so its click-through rate can be measured against the original single-touch baseline.
- Feature-flagged, default OFF, reversible.

ACCEPTANCE CRITERIA:
- [ ] Tests for each stage firing at the correct offset from departure_at, and not double-firing.
- [ ] A user with no departure_at, or an unsubscribed/suppressed user, receives nothing.
- [ ] Different partner surfaced at each stage, sourced from the live registry, not hardcoded.
- [ ] Admin metric: click-through rate per stage, comparable to the pre-existing single email.

OUT OF SCOPE: new partner applications; changing commission terms.
```

### T0 — Instrumentation and metrics baseline

```
[paste global instructions block]

TASK: T0 Instrumentation and metrics baseline

WHY: state_METRICS.md is empty. No later task or business decision (Away Mode vs. flight
affiliate, referral loop viability, paid-tier timing) can be evaluated without real numbers.

BUILD:
- D1 table `events` (id, ts, event_type, user_id nullable, anon_id, origin, route, partner,
  sub_id, source, meta JSON).
- Log these events server-side: signup, alert_subscribed, alert_email_sent, email_open (via
  Resend webhooks), email_click, outbound_click (flight and each Away Mode partner, with
  sub_id), share_click, referral_signup, widget_impression.
- Endpoint GET /admin/metrics (Clerk-admin only, or shared-secret) returning weekly rollups:
  visitors (if available), signups, active subscribers, emails sent, open rate, click rate,
  outbound clicks by partner, and a cohort table (first-14-day open+click rate per signup week).
- Treat opens as a weak signal (Apple Mail Privacy Protection inflates them); report click and
  return-visit rates alongside opens.
- A script/workflow that emits a markdown snapshot matching state_METRICS.md's table layout,
  so it can be pasted straight into the project.

ACCEPTANCE CRITERIA:
- [ ] Migration applies cleanly on a fresh and an existing D1.
- [ ] Each event type is emitted from a real code path and covered by a test.
- [ ] /admin/metrics rejects unauthenticated requests.
- [ ] Snapshot output has one row per baseline metric in state_METRICS.md, "not available" where missing.
- [ ] No PII beyond user_id/anon_id in events.

OUT OF SCOPE: third-party analytics, A/B framework.
```

### 2. T1 — Price-data honesty guardrails ("trust layer")

```
[paste global instructions block]

TASK: T1 Price-data honesty guardrails

WHY: Travelpayouts data is cached (2–7 days) from user search history. Every downstream growth
feature (share images, route pages, widget) inherits this data's honesty problem if unguarded.

BUILD:
- Persist found_at and expires_at (if the API returns them) for each price observation;
  discover the current schema first.
- A single pure module dealQuality(observations, now) returning
  {eligible, baseline, baselineN, spanDays, staleness, reasons[]}.
- Rules (thresholds as constants in one config; flag them in your report for tuning):
  - Baseline = median of trailing 30-day observations; keep the current documented mean as a
    secondary field until the owner approves switching, and document both.
  - Minimum N >= 10 observations AND >= 14 days of history for any public "% below average"
    claim (current documented minimum is 7 days — raise it only for public-facing claims).
  - Suppress a price older than its expires_at, or older than 48h if expires_at is absent.
  - "Rare Find" = below baseline by a robust threshold (e.g. >= 2 MAD below median) AND eligible.
- UI: every price shows "as of <time>"; every badge shows its basis ("X% below 30-day median,
  N observations"); a standing note: "Prices are sampled and may change; check the airline or
  agency."
- Log suppressed deals with reasons (feeds T0).

ACCEPTANCE CRITERIA:
- [ ] Unit tests: too few observations, short history, stale price, missing expires_at, outlier, normal.
- [ ] No badge renders without basis text and timestamp.
- [ ] Methodology doc updated with the median rule, minimums, staleness cutoff, changelog line.
- [ ] Backtest script over existing stored data reports how many current badges would be
      suppressed or changed, and by how much — include in your report.

OUT OF SCOPE: switching data providers; live re-verification at click time (note as a follow-up).
```

### 3. T7 — Email deliverability and consent

```
[paste global instructions block]

TASK: T7 Email deliverability and consent

WHY: Any referral growth (T3) multiplies email volume. Deliverability damage is slow to reverse,
so this must be solid before T3 ships.

BUILD:
- Audit and document DNS status for the sending domain (SPF, DKIM, DMARC policy); output a
  checklist of what must be fixed at the DNS host. Do not attempt DNS changes yourself.
- One-click unsubscribe: List-Unsubscribe and List-Unsubscribe-Post headers on every
  marketing/alert email, plus a working endpoint.
- Preference center: choose origins, frequency, pause, unsubscribe all.
- Resend webhook handler storing bounces, complaints, suppressions; never send to a suppressed address.
- consent_log table: user, timestamp, source, wording version, IP hash. Double opt-in required
  for any signup arriving via referral (needed by T3).
- Sending guard: throttle new-list volume growth; auto-pause sending if bounce/complaint rate
  crosses configurable thresholds; alert the owner.

ACCEPTANCE CRITERIA:
- [ ] Unsubscribe link and header work end to end in a test send.
- [ ] Suppressed address never receives an email (test).
- [ ] Consent record exists for every new signup after deploy.
- [ ] Report lists remaining DNS/manual steps.
```

### 4. T4 — Share-image generator

```
[paste global instructions block]

TASK: T4 Share-image generator

WHY: Every eligible deal should generate a shareable, honest card — a zero-labor acquisition
loop with no ongoing work per share.

BUILD:
- Deal permalink /deal/:origin/:dest/:date with Open Graph and Twitter tags.
- Worker route generating a branded share image (per style guide) for a deal: route, price,
  "X% below its 30-day median (N observations)", "as of <time>".
- Only generate for deals where dealQuality.eligible is true (T1). Otherwise return 404 or a
  neutral card with no price claim.
- Public counter, worded factually: "Deals spotted below their 30-day median: <count>" computed
  from stored data. Do NOT build a "$ saved" counter.
- Emit share_click events (T0).

ACCEPTANCE CRITERIA:
- [ ] Image renders within a sensible latency and is cached.
- [ ] Ineligible/expired deal produces no price claim.
- [ ] Share page includes disclosure, basis, and timestamp.
- [ ] Test verifying the counter equals a direct DB query.
```

### T5 — Programmatic route pages (dual-pillar version)

```
[paste global instructions block]

TASK: T5 Programmatic route pages (dual-pillar version)

WHY THIS CHANGED: the GTM strategy reframes Away Mode from a bolt-on to a co-equal pillar
alongside flight deals. Route pages are the main acquisition asset, so they are where that
reframe has to show up in the product, not just in messaging.

BUILD (as v1, plus):
- Pages per origin-destination pair: current best price (if not stale), trailing price chart,
  30-day median with basis, best-months summary only if data supports it, signup CTA for that
  route (routed through T3's referral attribution once T3 exists; plain signup CTA before that).
- MODIFIED: give the Away Mode module (registry-gated, T2) equal visual weight to the flight
  price content on the page, not a footer afterthought — this page is selling "we handle the
  whole trip," not only "we found a cheap flight." Follow sparkfare_style_guide.md for how to
  make a second module feel first-class, not competing.
- Thin-page policy, sitemap, canonical URLs, JSON-LD, internal linking: unchanged from v1.

ACCEPTANCE CRITERIA: unchanged from v1, plus:
- [ ] Away Mode module renders with real registry data (not empty) on any route page where at
      least one partner is live, and is visually equal-weight to the price content, not buried.
```

### T5b — Self-serve display ads on route pages

```
[paste global instructions block]

TASK: T5b Self-serve display ad slots on route pages

WHY: Route pages (T5) will draw search visitors who never click a booking link or an Away Mode
partner. A self-serve ad network monetizes that traffic independent of affiliate conversion —
a second revenue rail that needs no ongoing sales relationship once integrated.

BUILD:
- DISCOVER FIRST: confirm route pages (T5) are live and indexable before adding this.
- Reserve one or two ad slot positions in the route-page layout that do not compete visually
  with the price content or the Away Mode module (both are the actual product; ads are a
  secondary rail).
- Integrate a self-serve ad network's standard tag (the specific network is a business choice,
  not an engineering one — implement against whichever one the owner selects; the code should
  be network-agnostic where feasible).
- Respect page-load performance: ad script loads must not block the price content or Lighthouse
  score established in T5.
- Feature-flagged, default OFF, reversible.

ACCEPTANCE CRITERIA:
- [ ] Ad slots render only on indexable, eligible route pages, not on thin/noindex pages.
- [ ] No regression in the Lighthouse/CWV baseline from T5's acceptance criteria.
- [ ] Flag off = zero visible change.

OUT OF SCOPE: negotiating direct-sold sponsorships (that reintroduces manual sales labor —
explicitly avoid).
```

### T5c — Auto-expanding route-page content

```
[paste global instructions block]

TASK: T5c Auto-expanding route-page content

WHY: T5's thin-page policy (>= N observations, >= 14 days history) currently gates which pages
are indexable at build time. As more origins/destinations cross that threshold over time, the
set of eligible pages should grow without a second manual content build.

BUILD:
- A scheduled job (same cadence family as the existing data pipeline) that re-checks every
  origin-destination pair against T5's eligibility rule and promotes newly-eligible pairs from
  noindex to indexable automatically.
- Regenerate the sitemap.xml on the same cadence to include newly-promoted pages.
- Log promotions (which routes, when) so growth in indexable page count is itself a T0 metric.
- No content-writing step required — this reuses T5's existing page template and data-driven
  copy; it only changes which pairs are allowed to render as indexable.

ACCEPTANCE CRITERIA:
- [ ] A route that crosses the eligibility threshold appears in the sitemap on the next
      scheduled run without any manual step.
- [ ] A route that later falls back below threshold (sparse data) reverts to noindex.
- [ ] Test verifying sitemap contents match exactly the currently-eligible set.
```

### T0 — Instrumentation and metrics baseline

```
[paste global instructions block]

TASK: T0 Instrumentation and metrics baseline

WHY: state_METRICS.md is empty. No later task or business decision (Away Mode vs. flight
affiliate, referral loop viability, paid-tier timing) can be evaluated without real numbers.

BUILD:
- D1 table `events` (id, ts, event_type, user_id nullable, anon_id, origin, route, partner,
  sub_id, source, meta JSON).
- Log these events server-side: signup, alert_subscribed, alert_email_sent, email_open (via
  Resend webhooks), email_click, outbound_click (flight and each Away Mode partner, with
  sub_id), share_click, referral_signup, widget_impression.
- Endpoint GET /admin/metrics (Clerk-admin only, or shared-secret) returning weekly rollups:
  visitors (if available), signups, active subscribers, emails sent, open rate, click rate,
  outbound clicks by partner, and a cohort table (first-14-day open+click rate per signup week).
- Treat opens as a weak signal (Apple Mail Privacy Protection inflates them); report click and
  return-visit rates alongside opens.
- A script/workflow that emits a markdown snapshot matching state_METRICS.md's table layout,
  so it can be pasted straight into the project.

ACCEPTANCE CRITERIA:
- [ ] Migration applies cleanly on a fresh and an existing D1.
- [ ] Each event type is emitted from a real code path and covered by a test.
- [ ] /admin/metrics rejects unauthenticated requests.
- [ ] Snapshot output has one row per baseline metric in state_METRICS.md, "not available" where missing.
- [ ] No PII beyond user_id/anon_id in events.

OUT OF SCOPE: third-party analytics, A/B framework.
```

### 2. T1 — Price-data honesty guardrails ("trust layer")

```
[paste global instructions block]

TASK: T1 Price-data honesty guardrails

WHY: Travelpayouts data is cached (2–7 days) from user search history. Every downstream growth
feature (share images, route pages, widget) inherits this data's honesty problem if unguarded.

BUILD:
- Persist found_at and expires_at (if the API returns them) for each price observation;
  discover the current schema first.
- A single pure module dealQuality(observations, now) returning
  {eligible, baseline, baselineN, spanDays, staleness, reasons[]}.
- Rules (thresholds as constants in one config; flag them in your report for tuning):
  - Baseline = median of trailing 30-day observations; keep the current documented mean as a
    secondary field until the owner approves switching, and document both.
  - Minimum N >= 10 observations AND >= 14 days of history for any public "% below average"
    claim (current documented minimum is 7 days — raise it only for public-facing claims).
  - Suppress a price older than its expires_at, or older than 48h if expires_at is absent.
  - "Rare Find" = below baseline by a robust threshold (e.g. >= 2 MAD below median) AND eligible.
- UI: every price shows "as of <time>"; every badge shows its basis ("X% below 30-day median,
  N observations"); a standing note: "Prices are sampled and may change; check the airline or
  agency."
- Log suppressed deals with reasons (feeds T0).

ACCEPTANCE CRITERIA:
- [ ] Unit tests: too few observations, short history, stale price, missing expires_at, outlier, normal.
- [ ] No badge renders without basis text and timestamp.
- [ ] Methodology doc updated with the median rule, minimums, staleness cutoff, changelog line.
- [ ] Backtest script over existing stored data reports how many current badges would be
      suppressed or changed, and by how much — include in your report.

OUT OF SCOPE: switching data providers; live re-verification at click time (note as a follow-up).
```

### 3. T7 — Email deliverability and consent

```
[paste global instructions block]

TASK: T7 Email deliverability and consent

WHY: Any referral growth (T3) multiplies email volume. Deliverability damage is slow to reverse,
so this must be solid before T3 ships.

BUILD:
- Audit and document DNS status for the sending domain (SPF, DKIM, DMARC policy); output a
  checklist of what must be fixed at the DNS host. Do not attempt DNS changes yourself.
- One-click unsubscribe: List-Unsubscribe and List-Unsubscribe-Post headers on every
  marketing/alert email, plus a working endpoint.
- Preference center: choose origins, frequency, pause, unsubscribe all.
- Resend webhook handler storing bounces, complaints, suppressions; never send to a suppressed address.
- consent_log table: user, timestamp, source, wording version, IP hash. Double opt-in required
  for any signup arriving via referral (needed by T3).
- Sending guard: throttle new-list volume growth; auto-pause sending if bounce/complaint rate
  crosses configurable thresholds; alert the owner.

ACCEPTANCE CRITERIA:
- [ ] Unsubscribe link and header work end to end in a test send.
- [ ] Suppressed address never receives an email (test).
- [ ] Consent record exists for every new signup after deploy.
- [ ] Report lists remaining DNS/manual steps.
```

### 4. T4 — Share-image generator

```
[paste global instructions block]

TASK: T4 Share-image generator

WHY: Every eligible deal should generate a shareable, honest card — a zero-labor acquisition
loop with no ongoing work per share.

BUILD:
- Deal permalink /deal/:origin/:dest/:date with Open Graph and Twitter tags.
- Worker route generating a branded share image (per style guide) for a deal: route, price,
  "X% below its 30-day median (N observations)", "as of <time>".
- Only generate for deals where dealQuality.eligible is true (T1). Otherwise return 404 or a
  neutral card with no price claim.
- Public counter, worded factually: "Deals spotted below their 30-day median: <count>" computed
  from stored data. Do NOT build a "$ saved" counter.
- Emit share_click events (T0).

ACCEPTANCE CRITERIA:
- [ ] Image renders within a sensible latency and is cached.
- [ ] Ineligible/expired deal produces no price claim.
- [ ] Share page includes disclosure, basis, and timestamp.
- [ ] Test verifying the counter equals a direct DB query.
```

### 5. T5 — Programmatic route pages (MODIFIED: add a referral CTA, not just a signup CTA)

```
[paste global instructions block]

TASK: T5 Programmatic route pages

WHY: The single most durable, zero-marginal-labor acquisition asset available — built on price
history you already generate. This is the top acquisition priority.

BUILD:
- Pages per origin-destination pair: current best price (if not stale), trailing price chart,
  30-day median with basis, best-months summary only if data supports it, Away Mode module
  (registry-gated), signup CTA for that route.
- MODIFIED: once T3 (referral loop) exists, the signup CTA on these pages should route through
  the same referral-attribution flow, so a shared route-page link and a referral-share link are
  the same mechanism, not two separate funnels. If T3 isn't built yet, ship the plain signup CTA
  now and wire in the referral variant when T3 lands — do not block T5 on T3.
- Thin-page policy: do not publish a route page unless it has >= N observations and >= 14 days
  of history; return noindex for the rest.
- sitemap.xml, canonical URLs, JSON-LD (only types matching real content), internal links
  between related routes.
- Freshness: revalidate on the same cadence as the data pipeline.

ACCEPTANCE CRITERIA:
- [ ] Only eligible routes are indexable.
- [ ] Sitemap lists exactly the indexable pages.
- [ ] Lighthouse/CWV report attached for one route.
- [ ] Test that page copy is generated from data, not templates promising unsupported claims.
```

### 6. T3 — Referral loop v1

```
[paste global instructions block]

TASK: T3 Referral loop v1 (feature-flagged)

WHY: Category growth is referral/word-of-mouth driven, and feature-based rewards (not cash or
physical goods) are the only reward shape that costs nothing to fulfill at scale — no shipping,
no address collection, no per-redemption labor.

REWARD DESIGN (confirm before building): feature rewards only. Example tiers: 1 referral = 1
extra origin airport; 3 = faster alert timing; 5 = early access to new features; 10 = public
"Founding Member" badge.

BUILD:
- Tables referral_codes and referrals (referrer, referred, status: pending/confirmed/rejected, reason).
- Referral link per user (/r/:code), stored in a cookie for attribution across signup.
- A referral counts only after the referred user completes double opt-in (T7) and isn't flagged.
- Anti-abuse: block self-referral (same user/email-normalized/device-or-IP-hash within a window),
  disposable-domain list, per-user daily cap, manual review queue.
- Referral Hub page: progress bar, tiers, one-click share (SMS/WhatsApp/X/copy link/email), FAQ,
  plain-language reward terms.
- Reward entitlements enforced server-side.
- Emit referral_signup and share_click events (T0).
- Land shared links on the matching T5 route page where possible, not a generic homepage.

ACCEPTANCE CRITERIA:
- [ ] Flag off = zero visible change.
- [ ] Tests for attribution, self-referral rejection, double opt-in requirement, tier unlock.
- [ ] Reward terms page exists and is linked from the Hub.
- [ ] Admin metric: share of new signups attributed to referral (weekly).

OUT OF SCOPE: paid rewards, cash, giveaways/sweepstakes (legal review needed first).
```

### T0 — Instrumentation and metrics baseline

```
[paste global instructions block]

TASK: T0 Instrumentation and metrics baseline

WHY: state_METRICS.md is empty. No later task or business decision (Away Mode vs. flight
affiliate, referral loop viability, paid-tier timing) can be evaluated without real numbers.

BUILD:
- D1 table `events` (id, ts, event_type, user_id nullable, anon_id, origin, route, partner,
  sub_id, source, meta JSON).
- Log these events server-side: signup, alert_subscribed, alert_email_sent, email_open (via
  Resend webhooks), email_click, outbound_click (flight and each Away Mode partner, with
  sub_id), share_click, referral_signup, widget_impression.
- Endpoint GET /admin/metrics (Clerk-admin only, or shared-secret) returning weekly rollups:
  visitors (if available), signups, active subscribers, emails sent, open rate, click rate,
  outbound clicks by partner, and a cohort table (first-14-day open+click rate per signup week).
- Treat opens as a weak signal (Apple Mail Privacy Protection inflates them); report click and
  return-visit rates alongside opens.
- A script/workflow that emits a markdown snapshot matching state_METRICS.md's table layout,
  so it can be pasted straight into the project.

ACCEPTANCE CRITERIA:
- [ ] Migration applies cleanly on a fresh and an existing D1.
- [ ] Each event type is emitted from a real code path and covered by a test.
- [ ] /admin/metrics rejects unauthenticated requests.
- [ ] Snapshot output has one row per baseline metric in state_METRICS.md, "not available" where missing.
- [ ] No PII beyond user_id/anon_id in events.

OUT OF SCOPE: third-party analytics, A/B framework.
```

### 2. T1 — Price-data honesty guardrails ("trust layer")

```
[paste global instructions block]

TASK: T1 Price-data honesty guardrails

WHY: Travelpayouts data is cached (2–7 days) from user search history. Every downstream growth
feature (share images, route pages, widget) inherits this data's honesty problem if unguarded.

BUILD:
- Persist found_at and expires_at (if the API returns them) for each price observation;
  discover the current schema first.
- A single pure module dealQuality(observations, now) returning
  {eligible, baseline, baselineN, spanDays, staleness, reasons[]}.
- Rules (thresholds as constants in one config; flag them in your report for tuning):
  - Baseline = median of trailing 30-day observations; keep the current documented mean as a
    secondary field until the owner approves switching, and document both.
  - Minimum N >= 10 observations AND >= 14 days of history for any public "% below average"
    claim (current documented minimum is 7 days — raise it only for public-facing claims).
  - Suppress a price older than its expires_at, or older than 48h if expires_at is absent.
  - "Rare Find" = below baseline by a robust threshold (e.g. >= 2 MAD below median) AND eligible.
- UI: every price shows "as of <time>"; every badge shows its basis ("X% below 30-day median,
  N observations"); a standing note: "Prices are sampled and may change; check the airline or
  agency."
- Log suppressed deals with reasons (feeds T0).

ACCEPTANCE CRITERIA:
- [ ] Unit tests: too few observations, short history, stale price, missing expires_at, outlier, normal.
- [ ] No badge renders without basis text and timestamp.
- [ ] Methodology doc updated with the median rule, minimums, staleness cutoff, changelog line.
- [ ] Backtest script over existing stored data reports how many current badges would be
      suppressed or changed, and by how much — include in your report.

OUT OF SCOPE: switching data providers; live re-verification at click time (note as a follow-up).
```

### 3. T7 — Email deliverability and consent

```
[paste global instructions block]

TASK: T7 Email deliverability and consent

WHY: Any referral growth (T3) multiplies email volume. Deliverability damage is slow to reverse,
so this must be solid before T3 ships.

BUILD:
- Audit and document DNS status for the sending domain (SPF, DKIM, DMARC policy); output a
  checklist of what must be fixed at the DNS host. Do not attempt DNS changes yourself.
- One-click unsubscribe: List-Unsubscribe and List-Unsubscribe-Post headers on every
  marketing/alert email, plus a working endpoint.
- Preference center: choose origins, frequency, pause, unsubscribe all.
- Resend webhook handler storing bounces, complaints, suppressions; never send to a suppressed address.
- consent_log table: user, timestamp, source, wording version, IP hash. Double opt-in required
  for any signup arriving via referral (needed by T3).
- Sending guard: throttle new-list volume growth; auto-pause sending if bounce/complaint rate
  crosses configurable thresholds; alert the owner.

ACCEPTANCE CRITERIA:
- [ ] Unsubscribe link and header work end to end in a test send.
- [ ] Suppressed address never receives an email (test).
- [ ] Consent record exists for every new signup after deploy.
- [ ] Report lists remaining DNS/manual steps.
```

### 4. T4 — Share-image generator

```
[paste global instructions block]

TASK: T4 Share-image generator

WHY: Every eligible deal should generate a shareable, honest card — a zero-labor acquisition
loop with no ongoing work per share.

BUILD:
- Deal permalink /deal/:origin/:dest/:date with Open Graph and Twitter tags.
- Worker route generating a branded share image (per style guide) for a deal: route, price,
  "X% below its 30-day median (N observations)", "as of <time>".
- Only generate for deals where dealQuality.eligible is true (T1). Otherwise return 404 or a
  neutral card with no price claim.
- Public counter, worded factually: "Deals spotted below their 30-day median: <count>" computed
  from stored data. Do NOT build a "$ saved" counter.
- Emit share_click events (T0).

ACCEPTANCE CRITERIA:
- [ ] Image renders within a sensible latency and is cached.
- [ ] Ineligible/expired deal produces no price claim.
- [ ] Share page includes disclosure, basis, and timestamp.
- [ ] Test verifying the counter equals a direct DB query.
```

### 5. T5 — Programmatic route pages (MODIFIED: add a referral CTA, not just a signup CTA)

```
[paste global instructions block]

TASK: T5 Programmatic route pages

WHY: The single most durable, zero-marginal-labor acquisition asset available — built on price
history you already generate. This is the top acquisition priority.

BUILD:
- Pages per origin-destination pair: current best price (if not stale), trailing price chart,
  30-day median with basis, best-months summary only if data supports it, Away Mode module
  (registry-gated), signup CTA for that route.
- MODIFIED: once T3 (referral loop) exists, the signup CTA on these pages should route through
  the same referral-attribution flow, so a shared route-page link and a referral-share link are
  the same mechanism, not two separate funnels. If T3 isn't built yet, ship the plain signup CTA
  now and wire in the referral variant when T3 lands — do not block T5 on T3.
- Thin-page policy: do not publish a route page unless it has >= N observations and >= 14 days
  of history; return noindex for the rest.
- sitemap.xml, canonical URLs, JSON-LD (only types matching real content), internal links
  between related routes.
- Freshness: revalidate on the same cadence as the data pipeline.

ACCEPTANCE CRITERIA:
- [ ] Only eligible routes are indexable.
- [ ] Sitemap lists exactly the indexable pages.
- [ ] Lighthouse/CWV report attached for one route.
- [ ] Test that page copy is generated from data, not templates promising unsupported claims.
```

### 6. T3 — Referral loop v1

```
[paste global instructions block]

TASK: T3 Referral loop v1 (feature-flagged)

WHY: Category growth is referral/word-of-mouth driven, and feature-based rewards (not cash or
physical goods) are the only reward shape that costs nothing to fulfill at scale — no shipping,
no address collection, no per-redemption labor.

REWARD DESIGN (confirm before building): feature rewards only. Example tiers: 1 referral = 1
extra origin airport; 3 = faster alert timing; 5 = early access to new features; 10 = public
"Founding Member" badge.

BUILD:
- Tables referral_codes and referrals (referrer, referred, status: pending/confirmed/rejected, reason).
- Referral link per user (/r/:code), stored in a cookie for attribution across signup.
- A referral counts only after the referred user completes double opt-in (T7) and isn't flagged.
- Anti-abuse: block self-referral (same user/email-normalized/device-or-IP-hash within a window),
  disposable-domain list, per-user daily cap, manual review queue.
- Referral Hub page: progress bar, tiers, one-click share (SMS/WhatsApp/X/copy link/email), FAQ,
  plain-language reward terms.
- Reward entitlements enforced server-side.
- Emit referral_signup and share_click events (T0).
- Land shared links on the matching T5 route page where possible, not a generic homepage.

ACCEPTANCE CRITERIA:
- [ ] Flag off = zero visible change.
- [ ] Tests for attribution, self-referral rejection, double opt-in requirement, tier unlock.
- [ ] Reward terms page exists and is linked from the Hub.
- [ ] Admin metric: share of new signups attributed to referral (weekly).

OUT OF SCOPE: paid rewards, cash, giveaways/sweepstakes (legal review needed first).
```

### 7. T6 — Embeddable widget — MODIFIED: self-serve, no revenue-share, no outreach

```
[paste global instructions block]

TASK: T6 Embeddable widget (MODIFIED from the 2026-09-19 spec)

WHY THIS CHANGED: the original spec assumed Sparkfare pays publishers a cut of downstream
affiliate revenue, tracked via partner_id. That model requires (a) negotiating a rate with each
publisher, (b) manually reconciling payouts every month because the live affiliate links can't
carry a sub-ID through their networks (see workplan Step 91), and (c) manually pitching publishers
one at a time (Step 95). All three are recurring human labor with no automation path — the
opposite of what's wanted here. This version removes the payout entirely: the only incentive
for a publisher to embed the widget is that it's free, useful content for their site, in
exchange for a visible backlink. Nobody has to be paid, pitched, or reconciled with.

BUILD:
- A public, self-serve "Get your embed code" page (no login, no application, no approval queue):
  publisher enters their site name/URL, gets a generated iframe/script snippet immediately.
- Widget shows a route sparkline and current status for one origin/destination, with a visible,
  non-removable "Powered by Sparkfare" link back to the matching T5 route page.
- Public read-only JSON endpoint behind the widget, cached, with per-IP/per-origin rate limits,
  serving only eligible (T1) data.
- Log widget_impression by referring host (T0) — for your own visibility only, not for billing
  or payout purposes; no partner_id, no revenue-share accounting, no partners table dependency.
- Embed generator page includes copy-paste snippet and live preview.
- Do NOT build: any partner_id-based attribution tied to a payout, any admin approval workflow,
  any revenue-share ledger. If a future version needs paid partnerships, that is a separate,
  explicitly-scoped decision — not a default of this build.

ACCEPTANCE CRITERIA:
- [ ] Widget works on a static test page from a different origin, with zero manual setup on
      Sparkfare's side beyond the self-serve generator.
- [ ] Rate limiting verified.
- [ ] Widget shows nothing (not stale data) when a route is ineligible.
- [ ] Do not enable publicly until the Step 0 ToS check is confirmed clear.
```

### T7b — Web push notification channel

```
[paste global instructions block]

TASK: T7b Web push notification channel

WHY: A lower-friction, DNS-independent alternative and complement to email — no SPF/DKIM/DMARC
dependency, a single browser permission prompt instead of ongoing deliverability management,
and a channel that can specifically reach subscribers whose email engagement (per T0) has
already gone quiet.

BUILD:
- DISCOVER FIRST: confirm T7's suppression/consent infrastructure exists; web push subscribers
  still need an explicit opt-in and an easy opt-out, mirroring email's consent discipline.
- Browser push subscription flow (permission prompt, service worker, subscription storage keyed
  to user/anon id).
- Route the SAME alert and Away Mode events already defined (T0's event types) to push as an
  alternate delivery channel per user preference, not a duplicate of email — a user should be
  able to choose push, email, both, or neither per alert type.
- Respect the honesty guardrails from T1 for any price content shown in a push notification.
- Feature-flagged, default OFF, reversible.

ACCEPTANCE CRITERIA:
- [ ] Opt-in and opt-out both work end to end.
- [ ] A user who chooses "push only" receives no email for that alert type, and vice versa.
- [ ] Push payload for a price claim includes the same basis/timestamp discipline as email.
- [ ] Emits its own T0 event types (push_sent, push_click) for comparison against email.
```

### T8-spec — Paid-tier design spec (doc only, replaces the old T8)

```
[paste global instructions block]

TASK: T8-spec Paid-tier design spec (DOC ONLY, do not build yet)

WHY THIS CHANGED: the original T8 gated on "8+ weeks of data, doc only, only if owner un-defers."
The GTM strategy's competitive benchmarking (Going, Thrifty Traveler both run subscription-first
models at scale; Jack's Flight Club runs free-plus-paid side by side) argues for treating a small
paid tier as a near-term freemium addition once engagement is genuinely stable, not as a distant,
maybe-never decision blocked on a long fixed waiting period.

DELIVERABLE: a design doc, not code:
- A minimal freemium tier definition: what stays free (the core alert product, unchanged), what
  a small paid tier adds (candidates: more origins tracked per user, faster alert delivery,
  Away Mode priority placement/discount) — keep this genuinely minimal for a first version.
  Do not include business/first-class or elite-style tiers yet; that's a later expansion once a
  base tier is proven, mirroring how the incumbents themselves layered tiers over time.
- Price-lock guarantee mechanics, one-click cancel flow, refund policy wording, billing provider
  comparison (Stripe is the default assumption given the rest of the stack).
- A compliance checklist: Seller of Travel (workplan Step 23, still OPEN), auto-renewal
  disclosure rules, tax handling. Mark all legal items as needing attorney review, not resolved
  by this spec.
- State explicitly what T0 data justified starting this now (cite the actual engagement numbers,
  not a calendar date).

OUT OF SCOPE: any code. This is a green-light decision document only.
```

### T8-MVP — Minimal freemium paid tier

```
[paste global instructions block]

TASK: T8-MVP Minimal freemium paid tier

WHY: This is what everything from T9 onward (the affiliate-advertiser flip, white-label SaaS)
depends on existing — even in minimal form. Ship the smallest version that is real, not a
placeholder: a real paid signup a network can credit, real billing, real entitlement.

BUILD:
- DISCOVER FIRST: read T8-spec's approved scope before writing code; do not expand it.
- Stripe subscription integration: checkout, webhook-driven entitlement, cancel flow.
- Entitlement check gating whatever T8-spec defined as the paid feature(s) — implemented as a
  simple flag/tier field on the user record, checked wherever the paid feature renders.
- Billing/consent records kept separate from T7's marketing-consent log (different legal basis).
- Feature-flagged rollout: internal test first, then a small percentage, before fully public.

ACCEPTANCE CRITERIA:
- [ ] A real test subscription can be created, entitles the correct feature, and can be canceled,
      verified end to end against Stripe's test mode.
- [ ] Webhook failure or delay does not silently grant or revoke entitlement incorrectly (test
      the retry/reconciliation path).
- [ ] No existing free-tier behavior changes for non-subscribers.
- [ ] Report states clearly: this creates the "paid signup" event that T9 depends on.
```

### T9 — Awin/ShareASale advertiser listing (non-code)

```
NON-CODE TASK — business setup, not an Antigravity build prompt.

WHY: The category's proven distribution playbook (Jack's Flight Club, 4M+ members) runs
through self-serve affiliate networks: Sparkfare becomes an ADVERTISER other publishers can
choose to promote, with the network handling tracking/payout — the same zero-outreach,
zero-reconciliation principle as the T6 widget, at much larger reach.

STEPS (owner/business, not engineering):
1. Create an Awin and/or ShareASale advertiser (merchant) account for Sparkfare.
2. Set a commission rate on the T8-MVP paid signup event (a CPA on paid conversion, not on a
   free alert signup — free signups typically aren't creditable events on these networks).
3. Supply creative assets (banners, copy) — coordinate with Creative Marketing; every asset
   carrying a price or savings claim must clear the same claims-flagging discipline already in
   place for owned copy.
4. Confirm the tracking pixel/postback fires correctly off T8-MVP's Stripe webhook before going
   live broadly.

GATE: do not start until T8-MVP is live and its webhook-driven entitlement is confirmed working.
```

### T10 — White-label config layer ("Sparkfare Engine")

```
[paste global instructions block]

TASK: T10 White-label config layer

WHY: The biggest unclaimed revenue-per-partner number in the whole plan, and genuinely unclaimed
territory — none of the named competitors (Going, Thrifty Traveler, Dollar Flight Club, Jack's
Flight Club) offer a white-label version of their engine to other publishers. This reuses nearly
the entire existing stack; the new work is multi-tenant branding, config, and billing.

BUILD:
- DISCOVER FIRST: read T6's self-serve widget code and T2's partner-registry pattern; this
  extends both rather than building a parallel system.
- A `tenants` table: id, name, domain/subdomain, branding config (logo url, color tokens
  extending the pattern already defined in sparkfare_style_guide.md, not a from-scratch theme
  system), status (trial/active/suspended), Stripe subscription id.
- A scoped admin panel per tenant: their own branding config, their own origin/destination scope
  if narrower than the full 12, their own Away Mode partner subset if they want fewer.
- Self-serve signup and Stripe billing for a tenant plan (reuse T8-MVP's Stripe integration
  pattern, not a separate billing system).
- Public-facing rendering: the SAME underlying pipeline and pages, branded per tenant, served at
  the tenant's own domain or subdomain.
- Rate limits and resource isolation so one tenant's traffic can't degrade another's or the core
  Sparkfare site's performance.

ACCEPTANCE CRITERIA:
- [ ] A new tenant can sign up, configure branding, and go live without any manual engineering step.
- [ ] Tenant A's branding/config changes are invisible to Tenant B and to the core Sparkfare site.
- [ ] Billing failure suspends a tenant's public site gracefully (not a broken page).
- [ ] Report explicitly confirms no core Sparkfare data (e.g. other tenants' or the main site's
      subscriber emails) is exposed through any tenant-scoped endpoint.

OUT OF SCOPE: custom feature requests per tenant; this is one configurable product, not bespoke
development per customer.
```

### T11 — Short-form video generator

```
[paste global instructions block]

TASK: T11 Short-form video generator

WHY: A zero-manual-labor content-distribution channel most competitors aren't running at all.
Reuses T1's eligibility guardrails and T4's share-image data — this is a new rendering target
for data that already exists, not a new data pipeline.

BUILD:
- DISCOVER FIRST: confirm T1 and T4 are live; this task only renders their existing eligible-deal
  output in a new format, it does not compute new price claims.
- A scripted video generator (server-side rendering, e.g. a headless render pipeline) producing
  a short clip per eligible deal: route, price, its basis and "as of" time (identical honesty
  rule as every other surface), using the same style-guide palette/type as a video-safe treatment.
- Text-to-speech narration of the same on-screen claim — no claim in the voiceover that isn't
  also on screen with its basis.
- A scheduled job posting to short-form platforms via their official APIs on a fixed cadence,
  logging each post as a T0 event (video_posted, and click/view metrics where the platform API
  provides them).
- Feature-flagged; start with the lowest-friction platform's API before adding more.

ACCEPTANCE CRITERIA:
- [ ] No video is generated or posted for an ineligible/stale deal (same suppression as T1/T4).
- [ ] On-screen and spoken claims match exactly; both carry the basis and timestamp.
- [ ] Posting failures are logged and retried, not silently dropped.
- [ ] Report states which platform(s) were integrated and what could not be automated (e.g. a
      platform requiring manual review per post).
```

### T12 — MCP / agentic-AI data surface

```
[paste global instructions block]

TASK: T12 MCP / agentic-AI data surface

WHY: A 2026-native distribution channel: AI travel-planning agents and assistants increasingly
mediate "what's a good flight deal right now" queries directly. A public, attributed data surface
for them is a zero-labor acquisition channel that doesn't compete with SEO or ad spend at all.

BUILD:
- DISCOVER FIRST: confirm T6's public read-only JSON endpoint exists; this wraps it, it does not
  duplicate it.
- An MCP server (or equivalent plugin/tool-schema) exposing the same eligible-deal data as T6's
  endpoint, with the same rate limits and eligibility filtering (T1) — no data surfaced here that
  wouldn't also be shown on a route page.
- Every response includes attribution (a route-page permalink from T5) so an agent citing this
  data links back to Sparkfare, mirroring the honesty/basis discipline used everywhere else.
- Document the server per whatever the MCP ecosystem's standard listing/registration process is
  at build time, so it's discoverable rather than only usable if someone already knows the URL.

ACCEPTANCE CRITERIA:
- [ ] A test MCP client can query it and receives only eligible, correctly-attributed data.
- [ ] Rate limiting matches or is stricter than T6's public endpoint.
- [ ] No PII or subscriber data is ever exposed through this surface — deal data only.
```

### T14 — Historical data-licensing feasibility (doc only, speculative)

```
[paste global instructions block]

TASK: T14 Historical data-licensing feasibility (DOC ONLY, speculative — do not build)

WHY: The accumulated historical time-series (not the live feed) is a real candidate for the
alternative-data market (hedge funds, travel-demand researchers). This is explicitly the most
speculative item in the whole plan — a long shot for a business this size — included because it
was asked for directly, not because it's a near-term recommendation.

GATE: do not start until (a) the Travelpayouts ToS redistribution question is fully resolved in
Sparkfare's favor, (b) T13's secondary source is live (reduces single-vendor legal and practical
risk of licensing derived data), and (c) there is enough accumulated history that it's plausible
anyone would pay for it (this is a judgment call, not a fixed date).

DELIVERABLE: a short feasibility memo, not code or a pitch:
- What exactly would be licensed (the historical time-series, at what grain, going back how far).
- Who plausibly buys this (name the actual category of buyer — alternative-data marketplaces,
  academic/journalism data desks — not a vague "researchers").
- What it would take to package and deliver it (a one-time export? an ongoing feed? a
  self-serve API tier reusing T10's tenant/billing pattern?).
- An honest read on how likely this is to be worth the engineering effort at Sparkfare's current
  scale, stated plainly, not talked up.

OUT OF SCOPE: any code, any outreach to a buyer, any pricing commitment.
```
