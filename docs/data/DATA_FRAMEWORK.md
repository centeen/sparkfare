<!-- Sparkfare Data Framework v1. APPROVED by the owner Oct 24, 2026 (D-038). Governing data strategy; business model section 13.
Source doc: https://claude.ai/artifact/YT49yV4Z7pEikz6Eca1TPG (rev 12). Approved scope choices: decision 2 = option B, implemented per D-039 (build all before Nov 4; serving switches behind flags, flipped after the freeze). Retention values in 5.4 approved as proposed (D-042). -->

# Sparkfare Data Framework v1 (approved Oct 24, 2026, D-038)

Oct 24, 2026 · @Coby

**Recommendation: adopt Data Framework v1 and run a small, invisible "protect the launch" data set before Nov 4, with the structural moves after the Nov 6–8 freeze.** Today's data practice meets 40% of the priority-weighted standard (43% on the critical items). The largest gap: the long fare history, the asset the business model calls hardest to copy, is not kept by design. Step 6 (the Claude Code build plan) waits for your approval and one scope choice in the last section.

## Frame and grounding (Hub)

**Question as asked:** "world class, forward-thinking, unbreakable data services" and a "golden standard foolproof strategy".

**Question (neutral):** Which data practices, structures and owner-free operations should Sparkfare adopt so that its fare, audience, behaviour and revenue data are accurate, durable, measurable and decision-ready, measured by user-visible data incidents, freshness-SLO attainment and the share of gate metrics computable from production without manual work? Meters: all five, mainly Fare (trust), Leave (measurement for the Dec 11 gate) and Data/B2B (the history asset). Personas: all, indirectly, through trust in every number.

"Unbreakable" and "foolproof" are not attainable properties of any system. The framework replaces them with stated service levels, automatic fallbacks and tested recovery.

**Who speaks.** There is no data seat on the council. At your request, the analysis in Steps 1 to 5 comes from a **guest seat, Chief Data Officer (CDO)**, attributed under its own headings. Seating it permanently is decision 5 below. Product Reality, Legal and the Quality Auditor run as usual.

**Steps run and skipped.** Frame, Ground, Guard and Audit ran. **Convene skipped:** this is back-end infrastructure with no user-facing mock, so personas could only answer "I can't tell what that does". **Price skipped:** no new revenue claim; the framework only makes revenue measurable. **Spark Score replaced** by the owner's own rubric (Step 2), as in consults 9 and 10.

### &#91;Switching to AGENT\_PRODUCT\_REALITY\]

- **Ledger:** last verified Oct 13 (11 days). Not stale under the 14-day rule today; **stale from Tue Oct 27**.
- **Repo read:** `centeen/sparkfare` main at commit `679ff58` (Oct 24 17:33 Israel, "ROADMAP step 107, route count merged (PR 365)"), including `src/`, `migrations/`, workflows and data files. The live site was **not** reachable from this session (network allowlist), so nothing here is observed live.
- **Repo vs ledger:** `ENABLE_METER_TRACKING` is `true` in the repo; ledger L19 says flag off (known item 74). `ENABLE_REPORTS=false` (M5) and `ENABLE_PINTEREST=true` with `PINTEREST_ENV=sandbox` have no ledger rows (item 98). `state_METRICS.md` exists in the repo (Oct 13 snapshot) while the project lists it as missing (new item 125).
- No persona-facing feature is proposed here, so no feature status is load-bearing for a persona.

## Step 1 — Best-practice recommendations \[CDO guest seat\]

A referral-only fare-alert business runs on four kinds of data: a third-party fare feed it turns into its own history, a small audience database with consent, behaviour events, and partner revenue that arrives late and partly by hand. For that shape, 27 practices separate durable data operations from fragile ones. They assume one owner, no data team, $0 to $5 a month, and nothing that needs recurring manual work.

| ID | Recommendation | What good looks like at Sparkfare's size |
| --- | --- | --- |
| **A. Storage and architecture** |  |  |
| DR-01 | Permanent raw archive | Every fetch kept as received, append-only, partitioned by date, never rewritten. History windows are computed from it, never stored instead of it |
| DR-02 | Data out of the code repo | Git holds code and small reference files; fare data lives in object storage; deploys never carry data |
| DR-03 | Layered data, one curated history | Raw → curated → serving. One history per route, one deal verdict per route per day, read by board, emails and reports alike |
| DR-04 | One schema source of truth | Every table and column created by a numbered migration; production checked against migrations in CI; no ad-hoc ALTERs or runtime CREATEs |
| DR-05 | Backups and restore drill | Platform point-in-time recovery plus a scheduled export to separate storage; a restore tested automatically on a schedule |
| **B. Access and security** |  |  |
| DR-06 | Classification and exposure tiers | Public, public-derived, internal, restricted (PII). Public files come from an allowlist, not a blocklist |
| DR-07 | Least-privilege secrets | Scoped keys, a rotation list, no secret or personal data in URLs |
| DR-08 | Counts-only admin surfaces | Authenticated, read-only, aggregated, no emails or ids on screen |
| **C. Quality and cleanliness** |  |  |
| DR-09 | Validation gate before publish | Each pipeline output checked against a contract (schema, ranges, valid codes, future dates, counts). On failure, keep serving the last good file and alert |
| DR-10 | Quality checks with SLOs | Freshness, completeness, validity, consistency (site claims equal computed counts), uniqueness, each with a threshold |
| DR-11 | Quarantine with reason codes | Bad records set aside with a reason, never silently dropped or carried forward |
| DR-12 | Deterministic pipelines, regression tests | Same input gives the same output; golden-file tests on the ranking logic |
| **D. Extraction** |  |  |
| DR-13 | Run manifest per run | Counts ok, empty and failed, duration, API errors and input hash stored for every run, not only printed to a log |
| DR-14 | Ingestion resilience and watchdog | Retry with backoff inside the rate budget; a second scheduler notices a missed run and re-triggers it |
| DR-15 | Vendor dependency register | Each external source and its terms, change risk and exit option written down |
| **E. Analysis and business intelligence** |  |  |
| DR-16 | Tracking plan (event registry) | Every event name and its required fields defined once in code; unknown names rejected; hot fields in columns, not free text |
| DR-17 | Metrics layer | Each KPI defined once (formula, filters, bot exclusion) and reused by every report, with as-of and sample size |
| DR-18 | Channel attribution with denominators | Channel (where a visitor came from) kept separate from surface (which form they used); visits and signups by channel joinable |
| DR-19 | Automated insight delivery | Scheduled summaries pushed to the owner; no dashboard that must be remembered |
| DR-20 | Experiment and gate discipline | Metric, minimum sample and decision rule set before the data arrives |
| **F. Governance and privacy** |  |  |
| DR-21 | Inventory and data dictionary | Generated from the schema and registry; owner and class per table |
| DR-22 | Retention and deletion schedule | Automatic expiry per table; deletion on request covers backups by roll-off |
| DR-23 | Licensing and consent register | Data-source permissions, licences, partner terms and consent basis in one place |
| DR-24 | Observability and alerting | SLO breaches reach the owner the same day with a one-page runbook; safe fallbacks run automatically |
| **G. Commercial and scale** |  |  |
| DR-25 | Revenue data model | Click → conversion → payout per meter, in tiers; the monthly payout entry validated on input |
| DR-26 | Capacity and cost guardrails | Usage tracked against each free-tier limit, alert at 70%, indexes and batched sends before scale |
| DR-27 | Fare data as a product | Derived datasets published with method, licence and as-of; history depth used for reports and season pages |

**Deliberately not recommended** for a business this size: a cloud warehouse with a transformation tool, streaming infrastructure, a commercial data catalog, a self-hosted BI server, a customer-data platform, and any price-forecasting model (also barred by the no-predictions guardrail). Each adds cost or recurring work without changing a decision Sparkfare makes.

## Step 2 — Pressure test and scorecard \[CDO guest seat\]

**11 of the 27 practices hold up as critical for Sparkfare, 15 as core, and one (data as a product) can wait; none failed outright.** Each was scored 1 to 5 (5 is best for Sparkfare) on eight criteria; the total is out of 40. Critical is 36 or more, core 32 to 35, later below 32. Launch urgency (U, 5 = needed before Nov 7) sets order, not rank. Scores are the CDO's judgment against the repo evidence in Step 3, not measurements.

Criteria: **P** practicality, **Rel** relevance, **Val** business value and impact, **E** effort to implement (5 = least), **M** maintenance burden (5 = none), **C** cost (5 = $0), **Pa** passive-operations fit, **Rk** risk reduced.

| ID | Practice | P | Rel | Val | E | M | C | Pa | Rk | Total /40 | U | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DR-01 | Permanent raw archive | 5 | 5 | 5 | 4 | 5 | 5 | 5 | 5 | **39** | 4 | Critical |
| DR-09 | Validation gate before publish | 5 | 5 | 5 | 4 | 4 | 5 | 5 | 5 | **38** | 5 | Critical |
| DR-10 | Quality checks with SLOs | 5 | 5 | 5 | 4 | 4 | 5 | 5 | 5 | **38** | 5 | Critical |
| DR-05 | Backups and restore drill | 5 | 5 | 4 | 4 | 4 | 5 | 5 | 5 | **37** | 4 | Critical |
| DR-13 | Run manifest per run | 5 | 5 | 4 | 4 | 5 | 5 | 5 | 4 | **37** | 4 | Critical |
| DR-23 | Licensing and consent register | 5 | 5 | 4 | 5 | 4 | 5 | 4 | 5 | **37** | 3 | Critical |
| DR-26 | Capacity and cost guardrails | 5 | 5 | 4 | 4 | 5 | 4 | 5 | 5 | **37** | 5 | Critical |
| DR-06 | Classification and exposure tiers | 4 | 5 | 4 | 4 | 4 | 5 | 5 | 5 | **36** | 4 | Critical |
| DR-08 | Counts-only admin surfaces | 5 | 4 | 3 | 5 | 5 | 5 | 5 | 4 | **36** | 3 | Critical |
| DR-19 | Automated insight delivery | 5 | 5 | 4 | 4 | 5 | 5 | 5 | 3 | **36** | 2 | Critical |
| DR-24 | Observability and alerting | 4 | 5 | 4 | 4 | 4 | 5 | 5 | 5 | **36** | 4 | Critical |
| DR-12 | Deterministic pipelines, regression tests | 4 | 5 | 4 | 3 | 4 | 5 | 5 | 5 | 35 | 3 | Core |
| DR-16 | Tracking plan (event registry) | 4 | 5 | 4 | 4 | 4 | 5 | 5 | 4 | 35 | 4 | Core |
| DR-17 | Metrics layer | 4 | 5 | 5 | 3 | 4 | 5 | 5 | 4 | 35 | 3 | Core |
| DR-22 | Retention and deletion schedule | 4 | 5 | 3 | 3 | 5 | 5 | 5 | 5 | 35 | 2 | Core |
| DR-03 | Layered data, one curated history | 4 | 5 | 4 | 3 | 4 | 5 | 5 | 4 | 34 | 2 | Core |
| DR-04 | One schema source of truth | 4 | 5 | 3 | 3 | 4 | 5 | 5 | 5 | 34 | 4 | Core |
| DR-14 | Ingestion resilience and watchdog | 4 | 5 | 4 | 3 | 4 | 5 | 5 | 4 | 34 | 3 | Core |
| DR-15 | Vendor dependency register | 4 | 5 | 3 | 5 | 4 | 5 | 4 | 4 | 34 | 1 | Core |
| DR-18 | Channel attribution with denominators | 4 | 5 | 5 | 3 | 4 | 5 | 5 | 3 | 34 | 5 | Core |
| DR-25 | Revenue data model | 4 | 5 | 5 | 4 | 4 | 5 | 4 | 3 | 34 | 2 | Core |
| DR-02 | Data out of the code repo | 4 | 5 | 4 | 3 | 4 | 4 | 5 | 4 | 33 | 2 | Core |
| DR-07 | Least-privilege secrets | 5 | 4 | 3 | 4 | 4 | 5 | 4 | 4 | 33 | 3 | Core |
| DR-11 | Quarantine with reason codes | 4 | 4 | 3 | 4 | 4 | 5 | 5 | 4 | 33 | 2 | Core |
| DR-20 | Experiment and gate discipline | 4 | 4 | 4 | 4 | 4 | 5 | 4 | 3 | 32 | 1 | Core |
| DR-21 | Inventory and data dictionary | 4 | 4 | 3 | 4 | 4 | 5 | 5 | 3 | 32 | 2 | Core |
| DR-27 | Fare data as a product | 3 | 4 | 4 | 3 | 4 | 5 | 5 | 2 | 30 | 2 | Later |

### What the real-world test changed

- **DR-01 holds, and is cheap.** The Travelpayouts written OK of Sep 23 covers storing fare data indefinitely and publishing derived statistics (business model, section 5). The latest full snapshot is 328 KB; at the observed 3 to 7 snapshots a day that is under 1 GB a year uncompressed (Hub arithmetic), inside R2's 10 GB free storage.
- **DR-02 is adapted, not adopted as written.** Making the repo private would end free compute: GitHub Actions is free on public repos and capped at 2,000 minutes a month on private ones. One multi-origin run makes 920 calls with a 2-second pause, so at least 31 minutes; at about 5 runs a day that is roughly 4,600 minutes a month (Hub arithmetic). **Keep the code public; move only the data out.** Whether R2 needs a payment method on file was not confirmed and is an owner check.
- **DR-26 is the one paid item.** Workers Free gives 100,000 requests a day, 10 ms CPU per invocation, D1 at 5 million rows read and 100,000 written a day, 500 MB per database and 7 days of point-in-time recovery. Workers Paid ($5 a month minimum) raises recovery to 30 days and database size to 10 GB. This matches open session items 7 and 32 (Workers plan before Nov 6).
- **DR-18 rises in urgency, not score.** Launch traffic arrives once. A channel not captured on Nov 7 to 20 cannot be rebuilt, and G1 (Nov 20, 150 confirmed) is judged on it.
- **DR-04 is a launch risk, not only hygiene.** `npm run deploy` applies migrations before deploying, and `migrations_README.md` warns production's schema was never reconciled with migration bookkeeping. A launch-week hotfix could be blocked by a duplicate-column error.
- **DR-27 waits.** Data/B2B resale is not covered by the Travelpayouts permission (business model, sections 3 and 8). Derived, free reports (M5) are the only data product in scope.
- **Adapted for passive operations:** every "review" step in the standard practice becomes an automated check that emails the owner only on a breach. The monthly payout entry stays the single recurring manual act.

## Step 3 — Sparkfare's data estate today \[CDO guest seat\]

**The data is honest but fragile: strong habits (basis, as-of, bot classing, keep-last-good) sit on storage and pipelines that were grown by incident, not designed.** Evidence is the repo at commit `679ff58` (Oct 24), the council's state files and `state_METRICS.md` (Oct 13). Production D1 and the live site were not queried this session, so row counts after Oct 13 are unknown.

### Inventory

| Domain | Source | Where it lives | State (as of) | Used by |
| --- | --- | --- | --- | --- |
| Fare prices | Travelpayouts Data API `/v1/prices/cheap` (cached round-trip lows) | JSON files committed to git by 4 GitHub Actions workflows; served as static files and read by the Worker | 23 origins × 40 destinations; 564 route histories, median 19 days, max 31, 420 with 10+ days (repo, Oct 24) | Board, route pages, `/check`, digest, newsletter, M5 report, social posts |
| Raw snapshots | Same feed, whole store per run | `sparkfare_hourly_snapshots/` in git | 248 files, 60 MB, Sep 6 to Oct 24, 3 to 7 a day | Free-tier compile only |
| Coverage | Derived | M5 report generation | 880 routes, 385 priced, 214 with enough history, 25 at or past the deal floor (Oct 24 01:22 UTC) | Report, route count |
| Audience | Signup forms, Clerk | D1 `users`, `consent_log`, `email_suppressions`, `watchlists`, `pto_window_watches`, plan tables | 3 users (Oct 13) | Digest, watchlists, Away Mode |
| Behaviour | Worker `logEvent` | D1 `events` (id, ts, type, ids, origin, route, partner, sub\_id, source, JSON meta) | About 47 event names in `src/` (Hub search); 455 outbound clicks, 88 human in the tracked era (Oct 13) | Admin pages, weekly standup, F0 |
| Page visits | Cloudflare Web Analytics | Cloudflare, cookieless | Not joinable to signups | Owner looks it up |
| Email operations | Resend + webhook | 8 delivery-log tables, opens, bounces | Opens inflated by pixel prefetch (Oct 13 note) | Sunset policy, standup |
| Revenue | Clicks, Travelpayouts statistics API, owner entry | `trips`, `partners`, `partner_payouts`, `partner_conversions` | 0 payouts entered, 0 booked trips (Oct 13) | `/admin/revenue`, Dec 11 gate |
| Rules and reference | Official pages, curated files | `leave-by-rules.js`, rule-watcher tables, destination and image JSON | Rule watcher flag off | Away Mode, passport check |

### What works

- **Honesty is built into the numbers.** Every metric in `state_METRICS.md` carries a definition, query, as-of and sample size; clicks are never called revenue; pre-classification clicks are kept apart from the tracked era.
- **The fetch fails safe per route.** A failed call keeps the last good data; empty results are told apart from errors; writes are atomic; push races retry with rebase.
- **Freshness is checked.** `checkDataFreshness` flags stale files, zero priced routes and double-prefixed keys, and the Monday standup email reports pipeline ages.
- **Privacy by default.** Counts-only admin pages, no raw User-Agent stored, first-touch attribution never overwritten, no traveller dates in URLs.
- **Accuracy was verified.** J1 met A1 to A5 on Oct 24 (R-012); the deal floor (D-021) is in code; 176 test files and the copy checker run in CI.

### Findings

| # | Severity | Finding | Evidence | Business effect |
| --- | --- | --- | --- | --- |
| F1 | Critical | **Long fare history is not kept by design.** Every history file is trimmed to 30 days on each run | `HISTORY_WINDOW_DAYS = 30`; cutoff filter, ranking script lines 148 and 174 | The "permissioned fare history" asset (meters 1, 4, 5) survives only because snapshots happen to sit in git |
| F2 | High | **Data lives in the code repo.** About 6 MB of data files are rewritten each run and 60 MB of snapshots grow without pruning | Commit-and-push steps in all data workflows; history of push collisions in `CLAUDE.md` | Repo growth toward GitHub's 1 GB guidance, slower checkouts, data and code changes tangled |
| F3 | High | **Raw fares may be public.** The snapshot folder and full history files are not in `.assetsignore`, and the whole repo root is the asset directory | `.assetsignore` read Oct 24; not observed live | Bulk raw cached fares exposed beyond "derived statistics"; the moat is downloadable |
| F4 | High | **Three fare histories for the same routes.** Daily JFK, hourly multi-origin and other-origins each keep and rank their own; JFK is priced by two pipelines | Three `*_price_history*.json` files and workflows | Board, digest and report can disagree on a verdict (item 121 still open) |
| F5 | High | **Schema defined in three places.** 32 migrations, about 15 runtime `CREATE TABLE IF NOT EXISTS` in `src/`, and earlier manual production ALTERs | `migrations_README.md` warning; grep of `src/` | A deploy can fail on a duplicate column; no one can say what production holds |
| F6 | High | **No validation gate before publish.** Outputs are committed without a schema, range or code check; run counts go only to the Actions log | Fetch and ranking scripts | A bad feed day reaches the board before anyone sees it; J1 fixes can regress silently |
| F7 | Medium | **The "hourly" feed lands 3 to 7 times a day.** One run takes at least 31 minutes; GitHub drops or delays scheduled runs; no watchdog | Snapshot timestamps; 920 calls × 2 s | Freshness holds today (48-hour tag) but has no margin if the scheduler stalls |
| F8 | High | **No backup beyond the platform.** D1 point-in-time recovery is 7 days on Workers Free; no export, no restore test | No export workflow; D1 limits page | Users, consent and suppression lists are irreplaceable |
| F9 | Medium | **Events are free-text with no indexes.** Names are strings, bot class is found by `LIKE` on JSON, only 5 indexes exist across all migrations, no retention | Migrations; `weeklyStandup.js` | Every report scans the whole table; rows-read limits approach as events grow |
| F10 | High (launch) | **Channel attribution is incomplete.** `signup_source` records the surface (home, check, pto); the UTM channel sits only in event JSON; visits by channel are in Cloudflare, not joinable | `growth.js`, `utm.js` | Visit-to-signup by source, a D-037 metric, cannot be computed in-system; M1 acceptance not yet shown |
| F11 | Medium | **Metrics are defined in several places.** Standup, growth report, revenue report and `state_METRICS.md` each carry their own filters; `state_METRICS.md` is a hand-run snapshot | Source files | Two reports can disagree; calibration depends on someone re-running queries |
| F12 | Medium | **Revenue pipeline is unproven.** No real conversion yet; Travelpayouts partner clicks (682) looked automated and were excluded | R-007; `state_METRICS.md` | Dec 11 gate may rest on clicks only, which is already allowed by D-004 |
| F13 | Medium | **Capacity is undecided.** Workers Free limits; digest sends loop one by one in a cron | `src/index.js` send loops; items 7 and 32 | Launch-surge risk to email and CPU |
| F14 | Medium | **One vendor carries fares and most revenue.** Travelpayouts may change terms or stats format without notice | R-003 (clauses 3.4, 6.2) | No exit plan or second source |
| F15 | Low | **Governance lives in prose.** `CLAUDE.md` is over 1,800 lines; no dictionary, retention schedule or licence register | Repo | Handover between Claude Code and Antigravity relies on reading history |
| F16 | Low | **No retention or deletion schedule.** Subscriber sunset exists; event and log data keep forever | Code search | Privacy promises rely on manual work |

### How the data serves the business today

| Business function | Data it needs | Today |
| --- | --- | --- |
| Acquisition (goal ladder 100 to 2,500 confirmed) | Confirmed signups by channel, visit-to-signup | Partial (F10) |
| Trust and the deal board | Accurate, fresh, consistent verdicts | Good after J1, brittle (F4, F6, F7) |
| Monetisation (five meters) | Clicks, conversions, payouts by meter | Instrumented, unproven (F12) |
| Retention | Engagement, sunset | Works; open signal noisy |
| Data asset, PR and reports | Long, durable history | At risk (F1, F3) |
| Decision gates (Dec 11, Feb 12) | Bucket metrics with minimum sample | Defined (D-004); depends on F9 and F11 |

## Step 4 — Adherence scorecard \[CDO guest seat\]

**Sparkfare meets 40% of the priority-weighted standard (43% on the 11 critical practices).** No practice is fully met; 4 are mostly met, 9 partly, 13 ad hoc and 1 absent. The strongest areas are honest reporting and decision discipline; the weakest are storage design, validation and recovery.

Adherence is 0 to 4: 0 none, 1 ad hoc, 2 partial, 3 mostly, 4 meets. **Gap points** = Step 2 total × (4 − adherence) ÷ 4, so the list is ordered by how much value is missing. Weighted adherence = Σ(total × adherence ÷ 4) ÷ Σ total (Hub arithmetic).

| ID | Practice | Tier | Adherence | What exists | What is missing | Gap points |
| --- | --- | --- | --- | --- | --- | --- |
| DR-02 | Data out of the code repo | Core | 0 | — | All fare data in git (F2) | 33.0 |
| DR-01 | Permanent raw archive | Critical | 1 | Snapshots in git since Sep 6 | Kept by accident; history trimmed to 30 days (F1) | 29.3 |
| DR-09 | Validation gate before publish | Critical | 1 | Per-route keep-last-good, atomic writes | Contract, range and count checks; fail-closed publish (F6) | 28.5 |
| DR-05 | Backups and restore drill | Critical | 1 | D1 7-day recovery (Free) | Export, off-platform copy, tested restore (F8) | 27.8 |
| DR-13 | Run manifest per run | Critical | 1 | Counts printed in Actions logs | Stored manifest, trend, alert (F6) | 27.8 |
| DR-26 | Capacity and cost guardrails | Critical | 1 | Rate-limit pacing; widget rate limits | Plan decision, event indexes, batched sends, usage alerts (F9, F13) | 27.8 |
| DR-16 | Tracking plan | Core | 1 | About 47 named events, bot class in meta | Registry, required fields, typed columns (F9) | 26.3 |
| DR-17 | Metrics layer | Core | 1 | Well-defined queries in each report | One shared definition per KPI; auto-written metrics file (F11) | 26.3 |
| DR-22 | Retention and deletion | Core | 1 | 45-day subscriber sunset | Per-table expiry, deletion routine (F16) | 26.3 |
| DR-03 | Layered data, one curated history | Core | 1 | Raw snapshots exist | One history and verdict per route (F4) | 25.5 |
| DR-04 | One schema source of truth | Core | 1 | 32 migrations, auto-applied on `npm run deploy` | Reconcile production; remove runtime CREATEs; CI drift check (F5) | 25.5 |
| DR-15 | Vendor dependency register | Core | 1 | R-003 agreement read | Register, second-source and exit notes (F14) | 25.5 |
| DR-11 | Quarantine with reason codes | Core | 1 | Empty vs failed told apart | Quarantine file with reasons | 24.8 |
| DR-21 | Inventory and dictionary | Core | 1 | `CLAUDE.md` narrative, Step 3 inventory | Generated dictionary with class and owner (F15) | 24.0 |
| DR-10 | Quality checks with SLOs | Critical | 2 | Freshness, zero-priced and prefix checks; J1 verified | Coverage, validity and claim-vs-data checks with thresholds | 19.0 |
| DR-23 | Licensing and consent register | Critical | 2 | Evidence files R-002 to R-012, `consent_log` | One register; CC BY answer pending | 18.5 |
| DR-06 | Classification and exposure | Critical | 2 | Hardened `.assetsignore` | Allowlist; raw files private (F3) | 18.0 |
| DR-24 | Observability and alerting | Critical | 2 | Monday standup, link health, freshness | Same-day breach alert, runbooks | 18.0 |
| DR-12 | Deterministic pipelines | Core | 2 | Determinism verified once (Sep 12) | Python regression tests in CI | 17.5 |
| DR-14 | Ingestion resilience | Core | 2 | Push retry; keep-last-good | API retry with backoff; missed-run watchdog (F7) | 17.0 |
| DR-18 | Channel attribution | Core | 2 | First-touch surface; UTM in event meta; `/admin/growth` | Channel columns; visits by channel joinable (F10) | 17.0 |
| DR-25 | Revenue data model | Core | 2 | F0 meters, payouts table, reconciliation job | Proven conversion path; validated entry (F12) | 17.0 |
| DR-27 | Fare data as a product | Later | 2 | M5 report built, dark; derived CSVs | Long history; licence answer | 15.0 |
| DR-08 | Counts-only admin | Critical | 3 | Admin pages aggregated, authenticated | Read-only role check documented | 9.0 |
| DR-19 | Automated insight delivery | Critical | 3 | Monday standup email | Monthly calibration pack | 9.0 |
| DR-07 | Least-privilege secrets | Core | 3 | Scoped Resend key; secrets on the Worker | Rotation list | 8.3 |
| DR-20 | Experiment and gate discipline | Core | 3 | D-004 minimum sample and decision rule | Gate registry in one file | 8.0 |

**What to protect:** DR-07, DR-08, DR-19 and DR-20 are already near standard; the framework keeps them as they are. **Where the value is:** the top six gaps (DR-02, 01, 09, 05, 13, 26) hold 31% of all missing value (174 of 569 gap points) and are invisible to users, which makes them safer to change than screen work.

## Step 5 — Sparkfare Data Framework and Strategy v1 \[CDO guest seat, for approval\]

**Every number Sparkfare shows or decides on has one definition, a basis and an as-of time, and survives any single failure without the owner touching it.** That sentence is the standard. The framework below is how it is met for $5 a month or less, with the monthly payout entry as the only recurring manual act.

### 5.1 Goals

- **Data north star:** trusted decision coverage, the share of the KPIs in the metric tree (5.7) that production computes automatically with as-of and sample size. Target 100% by Jan 31.
- **Business outcomes it serves:** confirmed, engaged subscribers (goal ladder 100 / 300–500 / 1,000 / 2,500 by Nov 7 / Dec 6 / Jan 31 / Mar 31, owner goals) and revenue per 100 confirmed signups by meter, in tiers.
- **Framework health:** adherence (Step 4) from 40% today to 65% or more by Dec 10 and 85% or more by Mar 31.

### 5.2 Eight principles

1. **Basis and as-of on every number.** Already law in Brand v1 and the Score-Elevation Plan; the framework extends it to internal metrics.
2. **Raw is permanent and immutable.** Every fetch kept as received, within the Travelpayouts permission. Windows are computed, never stored instead.
3. **One definition, one history, one verdict.** A route has one curated history and one verdict a day; a KPI has one formula.
4. **Fail closed, serve last good, tell the owner.** A failed check never publishes; the board keeps yesterday's good file and an email says why.
5. **Private by default, public by derivation.** Raw and personal data are never served; public files come from an allowlist.
6. **Automate or don't do it.** Checks, backups, retention and reports run on schedules. No step depends on someone remembering.
7. **Measure money honestly.** A click is never revenue; three tiers (network-confirmed, allocated estimate, clicks only).
8. **Design for ten times today at $0 to $5 a month.** Limits are tracked and alerted before they bind.

### 5.3 Target architecture

| Layer | Store | Holds | Written by | Read by | Kept | Class |
| --- | --- | --- | --- | --- | --- | --- |
| Ingest | GitHub Actions in the public repo (code only) | Fetch scripts, run manifests | Schedules plus a watchdog | — | Code history | Public |
| Raw | R2 private bucket | Every run's full response, gzip, by date and run time | Fetch job | Curate job, backfills, replays | Permanent | Internal |
| Curated | D1 table `fare_daily` (route, date, cheapest fare, airline, travel dates, observations, run id) and `route_verdict` (route, date, median, distinct days, verdict) | One history and one verdict per route per day | Curate job (one, for all origins including JFK) | Serving job, reports, `/check`, emails | Permanent | Internal |
| Serving | Small versioned JSON per origin plus a manifest (schema version, as-of, counts) | Only what pages need | Serving job, after the validation gate | Board, route pages, digest, social | Last 30 versions | Public-derived |
| Operational | D1 | Users, consent, suppressions, events, deliveries, trips, payouts | Worker | Worker, metrics jobs | Per schedule (5.4) | Restricted or internal |
| Metrics | Definitions in `src/metrics/`; table `metrics_daily` (date, metric, dimension, value, n) | Every KPI, computed once a day | Metrics cron | Admin pages, standup, monthly pack, auto-written `state_METRICS.md` | Permanent | Internal |
| Backups | R2 private bucket | Daily D1 export | Backup job | Restore drill | 14 daily plus 12 monthly | Restricted |

At about 920 routes, `fare_daily` grows by about 920 rows a day, about 336,000 a year, well inside D1's limits (Hub arithmetic). The current file names stay as the serving contract during the move, so no page has to change at once.

### 5.4 Domains, systems of record and retention

Retention values are CDO proposals; the owner sets them (decision 6).

| Domain | System of record | Class | Retention |
| --- | --- | --- | --- |
| Fare raw | R2 raw bucket | Internal | Permanent |
| Fare curated and verdicts | D1 | Internal; published only as derived statistics | Permanent |
| Audience (users, preferences, watchlists) | D1 | Restricted (personal) | While subscribed; deleted 30 days after unsubscribe, sunset or a deletion request |
| Consent and suppressions | D1 | Restricted | Consent record and suppressed address kept as long as needed to honour and prove them |
| Events | D1 | Internal (pseudonymous ids) | Row level 13 months, then daily aggregates only |
| Delivery logs | D1 | Internal | 90 days after the last send for that user or trip |
| Trips and revenue | D1 | Internal | Payouts permanent; trip rows keep counts, user link removed on deletion |
| Rules and reference | Git | Public | Version history |
| Backups | R2 | Restricted | 14 daily, 12 monthly; deletions fall out of backups by roll-off |

### 5.5 Quality framework

A **data incident** is a user-visible number that is wrong or has no basis. Target: zero a month; each one gets a five-line note in `docs/data/incidents/`.

| Dimension | Check | Threshold | On breach |
| --- | --- | --- | --- |
| Freshness | Age of each served origin file; age of last good raw run | Served file ≤ 30 h on 99% of days; raw run ≤ 12 h | Keep last good; alert; watchdog re-runs |
| Completeness | Priced routes and failed calls per run | Priced ≥ 80% of the 7-day median; failed calls ≤ 5% | Publish blocked; alert |
| Validity | Contract on every served record | 100% pass: known origin and destination, price above 0 and under a ceiling, departure after the buffer, return after departure, currency USD | Record quarantined with a reason; publish blocked above 1% |
| Consistency | Every count in site copy versus the serving manifest | 0 mismatches (generalises the item 119 fix) | Build fails |
| Uniqueness | One curated row per route and day; no double-prefixed keys | 0 duplicates | Curate job fails |
| Reproducibility | Weekly replay of one past day from raw | Identical verdicts | Alert |

### 5.6 Access and classification

| Tier | Examples | Rule |
| --- | --- | --- |
| Public | Pages, serving files, reports | Served only if on the asset allowlist |
| Public-derived | Report CSVs, route statistics | Aggregates only; method, licence line and as-of attached |
| Internal | Raw, curated, events, manifests | R2 private or D1; never in git or assets |
| Restricted | Emails, consent, backups | D1 and private R2 only; admin pages show counts; keys scoped; a names-only rotation list in the repo |

### 5.7 Measurement architecture

- **Metric tree.** Confirmed engaged subscribers = visits by channel × visit-to-signup × confirmation rate × 45-day retention. Revenue per 100 confirmed signups by meter = click rate by surface × conversion × payout, each in its tier.
- **Attribution.** Each new user stores first-touch **channel** (utm source, medium, campaign; referrer class) and **surface** (the form used) in separate columns. The Worker keeps a cookieless daily count of landing visits by channel, so visit-to-signup by channel is a query, not a guess.
- **Tracking plan.** One registry of event names with required fields and a version; unknown names are rejected in tests; `ua_class` and channel become columns; indexes on time and event type.
- **Gates registry.** G1 (Nov 20), G2 (Dec 6), Dec 11 and Feb 12 in one file: metric, minimum sample, rule, owner of the decision.
- **Delivery.** Monday standup (exists); a monthly calibration pack generated after the payout entry; `state_METRICS.md` written by the metrics job, never by hand.

### 5.8 Reliability

- **Recovery targets:** lose at most 24 hours of audience data (daily export plus point-in-time recovery); restore within 4 hours by a one-page runbook.
- **Restore drill:** monthly, automatic, into a scratch D1 database; the result goes in the standup.
- **Watchdog:** a Worker cron checks the last good raw run; if older than 6 hours it starts the fetch workflow with a token limited to that action.
- **Alerts:** one same-day email for any SLO breach, with the runbook link; everything else waits for Monday.

### 5.9 Cost and capacity

| Item | Limit (Workers Free) | Plan |
| --- | --- | --- |
| Worker requests | 100,000 a day | Alert at 70% |
| CPU per invocation | 10 ms | Move to Workers Paid ($5 a month) before Nov 6 (open items 7, 32) |
| D1 reads / writes | 5 million / 100,000 a day | Event indexes; daily rollups; alert at 70% |
| D1 size and recovery | 500 MB, 7 days | Paid: 10 GB, 30 days |
| R2 | 10 GB-month, 1 million Class A and 10 million Class B operations free | Raw plus backups stay under 2 GB in year one (Hub arithmetic) |
| GitHub Actions | Free on public repos | Keep the repo public; data leaves it |

Total recurring cost: $5 a month.

### 5.10 How elevated data serves the business

- **Fare meter:** one verdict everywhere means the board, emails and reports never disagree, which protects the trust that drives "View fare" clicks.
- **Leave meter:** clean departure-intent data (trip length, window) joined to partner clicks lets the Dec 11 gate (30-plus vs 7–10 days) compute itself.
- **Membership:** watchlist and freshness usage is measured before any Plus price is set.
- **Audience:** an engaged, bounce-free list and true channel data support SparkLoop and the readiness bar (5,000 visits, 500 subscribers, D-011d).
- **Data asset:** history depth compounds. At Nov 7 the oldest snapshot is about 9 weeks old; by Mar 31 about 7 months; by November 2027 a full year spanning two holiday seasons, enabling a year-over-year Holiday Report and season pages (G5). Licensing or resale stays out until Travelpayouts allows it in writing.
- **Passive income:** fewer incidents means no firefighting; the monthly pack replaces ad hoc queries.

### 5.11 Phases

Dates are targets inside the existing calendar (D-034, D-036). Step 6 turns these into Claude Code packages.

| Phase | Window | Scope | Rule |
| --- | --- | --- | --- |
| D0 Protect the launch | Now to Wed Nov 4 | D0.1 raw copy to R2 plus backfill of the 248 snapshots; D0.2 validation gate and run manifest (fail closed); D0.3 daily D1 export and a first restore test; D0.4 Workers plan, event indexes, batched sends; D0.5 channel columns and visit counter; D0.6 stop serving raw and history files; D0.7 read-only schema reconciliation report and CI drift check; D0.8 same-day SLO alert | Additive and invisible; nothing changes what users see |
| D1 Launch watch | Nov 5 to 20 | Alerts only; capture launch data; no structural change | Freeze Nov 6 18:00 ET to Nov 8 stands |
| D2 Consolidate | Nov 21 to Dec 10 | One curated history and verdict; serving files built from it; data out of git; metrics layer and auto metrics file; tracking registry; retention jobs | Lands before the Dec 11 gate |
| D3 Compound | Dec 12 to Mar 31 | Dictionary, licence and vendor registers, Python regression tests, watchdog, quarantine, monthly pack, year-over-year report groundwork | Re-score adherence Feb 12 |

**The split, kept:** you asked for the core and bulk before launch. The CDO and the Hub lean to D0 only before Nov 4. D2 rewires how the board is served, and doing it in the last ten days, beside K-B and K-C, risks the D-036 hard gates. D0 starts 7 of the 11 critical practices (DR-01, 05, 06, 09, 13, 24, 26). Decision 2 asks you to choose.

### 5.12 Where the framework lives

`docs/data/DATA_FRAMEWORK.md` in the repo, so Claude Code and Antigravity read the same text, with a copy in this project. Versioned; changes are owner decisions logged like D-024. Each data-affecting PR states which principle and check it touches.

## Guard and quality audit

### &#91;Switching to AGENT\_LEGAL\_COMPLIANCE\]

**CONDITIONAL** (non-attorney risk guidance; have a licensed attorney review before anything binding is published or signed).

| Area | Result | Condition |
| --- | --- | --- |
| Permanent raw archive (DR-01) | PASS | Within the Sep 23 written OK to store indefinitely and publish derived statistics. Keep a copy of that email in the licence register |
| Raw and history files possibly served publicly (F3) | CONDITIONAL | Make them private (D0.6). Publish only derived statistics; the CC BY 4.0 licence line still waits on Travelpayouts or counsel (open item 0b) |
| Data products and B2B (DR-27) | CONDITIONAL | No licensing, sale or API access to fare data until Travelpayouts allows it in writing (business model, section 8) |
| Channel attribution and visit counter (D0.5) | CONDITIONAL | Cookieless aggregate counts only; no IP address, fingerprint or traveller data stored; if any new stored identifier is added, update `/privacy` first. Candidate regimes to verify: state privacy laws such as the CCPA |
| Retention and deletion (5.4) | CONDITIONAL | `/privacy` must state the schedule that is actually enforced; deletion requests covered for backups by roll-off, and the page should say so |
| Backups (D0.3) | PASS with care | Private bucket, scoped key; backups contain personal data and are listed in the privacy page's processors |
| Run manifests, metrics, admin | PASS | Counts only; no personal data |
| Referral copy, Step 19, Seller of Travel triggers | PASS | Nothing in the framework adds copy, insurance, bundles or itineraries |

No FAIL.

### &#91;Switching to AGENT\_QUALITY\_AUDITOR\]

AUDIT CHECKLIST

1. Status grounded: PASS — repo facts cite commit `679ff58` and file paths (`wrangler.jsonc`, ranking script lines 148 and 174, `migrations_README.md`, `.assetsignore`, `growth.js`); owner-reported items labelled as such; nothing described as live that was not observed.
2. No scope breach: PASS — the CDO guest seat makes no legal call and no revenue forecast; Legal drafted no product scope; the Hub's lead and sequencing add no new claim.
3. Statistics sourced or labeled: PASS — platform limits from Cloudflare and GitHub pages opened today; coverage figures from the Oct 24 M5 generation; Oct 13 figures from `state_METRICS.md`; derived sizes and run times labelled Hub arithmetic; scores labelled judgment. No recommendation depends on an unverified figure; the R2 payment-method question is labelled unconfirmed.
4. Legal-adjacent claims flagged: PASS — privacy, licensing and retention sit under Legal, labelled non-attorney.
5. No fabrication: PASS — user counts are the Oct 13 snapshot, stated as such; no current D1 counts claimed.
6. Assumptions stated: PASS — growth arithmetic shows inputs (920 routes, 328 KB per snapshot, 3 to 7 runs a day, 2-second pause).
7. Conflicts surfaced: PASS — ledger vs repo flags, `state_METRICS.md` present vs missing, history window vs "store indefinitely", "hourly" vs observed cadence, owner's "bulk before launch" vs the D0 lean (items 123 to 128).
8. Attribution intact: PASS — CDO, Product Reality, Legal and Auditor each under their own heading.
9. Ledger respected: PASS — no persona reacted.
10. Persona honesty: N/A — Convene skipped, reason stated.
11. Splits preserved: PASS — the owner-vs-CDO scope split is kept for decision 2.

STATUS: PASSED

## Decisions for you (Step 6 waits on 1 and 2)

1. **Approve Data Framework v1** (Step 5) as Sparkfare's standing data strategy, logged as D-038 and recorded in the business model as section 13, like D-024?
2. **Pre-launch scope.** (A) D0 only before Nov 4, D2 from Nov 21 (CDO and Hub lean). (B) D0 plus D2 before Nov 4, as you first asked, accepting serving-path changes in the last ten days. (C) A minimum D0 of D0.1, D0.3 and D0.6 only, if the week is already full with K-B and M1.
3. **Move to Workers Paid ($5 a month) before Nov 6?** It doubles as open items 7 and 32.
4. **Make raw data private and use R2.** Please check whether enabling R2 asks for a payment method on your Cloudflare account.
5. **Seat the CDO permanently** as `claude/agents_AGENT_CHIEF_DATA_OFFICER.md` (data quality, storage, measurement; never prices, never legal), joining the business bench?
6. **Retention values** in 5.4: accept as proposed, or set your own.

On approval the Hub logs the decisions, writes the framework into the project and the repo handoff, and produces Step 6: the Claude Code and Antigravity build plan against the D-034 calendar and the D-037 goal ladder.

### New reconciliation items

| # | Item | Source |
| --- | --- | --- |
| 123 | Fare history files are trimmed to 30 days while the business model treats indefinite history as a core asset | Ranking script; business model section 5 |
| 124 | Snapshot folder and history files are not in `.assetsignore`; may be publicly served. Verify live | `.assetsignore`, Oct 24 |
| 125 | `state_METRICS.md` exists in the repo (Oct 13 snapshot) while the project lists it as missing | Repo; session state |
| 126 | Three separate fare histories; JFK priced by two pipelines; verdicts may differ | Workflows; extends item 121 |
| 127 | The "hourly" multi-origin feed lands 3 to 7 times a day | Snapshot timestamps |
| 128 | Ledger L19 says meter tracking is off; repo has it on; no ledger row for `ENABLE_REPORTS` | `wrangler.jsonc`; extends item 74 |

## Sources

- Repo `centeen/sparkfare`, main at commit `679ff58` (Oct 24, 2026): `wrangler.jsonc`, `.github/workflows/`, `Phase 1 Flight Fetch Script (Step 8).py`, `Phase 1 Deal Ranking Script (Step 9 - with fallback).py`, `migrations/`, `migrations_README.md`, `src/growth.js`, `src/weeklyStandup.js`, `src/botClass.js`, `.assetsignore`, `state_METRICS.md`, `CLAUDE.md`.
- Council files: `state_SESSION_STATE.md`, `state_DECISION_LOG.md` (D-001 to D-037, R-001 to R-011), `state_CAPABILITY_LEDGER.md`, `context_SPARKFARE_BUSINESS_MODEL.md`, `DESIGN_COUNCIL_ORCHESTRATOR.md`.
- [Cloudflare D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) and [D1 limits](https://developers.cloudflare.com/d1/platform/limits) (Free: 5M rows read, 100k written a day, 500 MB per database, 7-day Time Travel; Paid: 10 GB, 30 days).
- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) (Free: 100,000 requests a day, 10 ms CPU; Paid minimum $5 a month; R2 free tier).
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/) (10 GB-month, 1M Class A, 10M Class B free).
- [Workers Analytics Engine pricing](https://developers.cloudflare.com/analytics/analytics-engine/pricing) (Free: 100,000 data points written, 10,000 queries a day).
- [GitHub: about large files](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github) (repositories ideally under 1 GB).
- [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions) (free on public repos; 2,000 minutes a month for private on Free).
