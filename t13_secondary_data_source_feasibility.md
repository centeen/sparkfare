# T13 — Secondary flight-data source feasibility (de-risking)

Status: **feasibility research complete, no code written, no vendor selected — awaiting a
go/no-go + budget decision before anything is built.** Per the task's own gate: "a feasibility
writeup exists before any fetch code is written."

## Why this exists

Every monetization surface Antigravity has built so far (T1 honesty guardrails, T4 share
images, T5 route pages, T6 widget) reads price data from one upstream vendor —
Travelpayouts/Aviasales — whose cache is 2-7 days stale and whose redistribution terms have
never been fully resolved in writing (this mirrors the still-open Seller-of-Travel question in
`CLAUDE.md`). This task evaluates whether a second, independent source exists that Sparkfare
could plug into the same `dealQuality()` interface ([src/dealQuality.js](src/dealQuality.js)) as
additive redundancy — not a replacement.

## Discovery: current architecture (read before any of the below)

- [Phase 1 Flight Fetch Script (Step 8).py](Phase%201%20Flight%20Fetch%20Script%20(Step%208).py)
  calls `GET https://api.travelpayouts.com/v1/prices/cheap` once per origin/destination pair, no
  data-source abstraction — a plain `requests.get()`, results flattened into one JSON store keyed
  by `origin:destination`.
- [src/dealQuality.js](src/dealQuality.js) is a pure function:
  `dealQuality(observations, current_ticket, now)` → `{eligible, baseline, baselineN, spanDays,
  staleness_hours, reasons, is_rare_find, basis_text}`. It takes `observations: [{price, date}]`
  and does **not** currently have a `source` field on each observation — every observation is
  implicitly Travelpayouts. Adding a second source only requires tagging observations with
  `source` when they're assembled (in `src/index.js`, e.g. lines 33, 324-325, 2815-2816,
  3228-3229, 3280-3281, 3377-3379) and letting `dealQuality` keep treating `price`/`date`
  uniformly — the function itself needs no change for this.
- The 12 real US origins + TLV, 40 destinations, are defined as a flat Python list in the fetch
  script (see `DESTINATIONS`/`ORIGINS` in that file) — any second source has to be checked against
  this same set, not assumed to match generically.

## Candidates researched (real web research, not assumed)

### 1. Amadeus for Developers (Self-Service Flight Offers Search) — DEAD, not viable
Confirmed via multiple independent sources (PhocusWire, LinkedIn, a GitHub issue thread, trade
press): Amadeus announced the shutdown in February 2026, paused new self-service registration in
spring 2026, and **fully decommissioned the self-service portal on July 17, 2026** — existing API
keys were disabled. Only the separate Enterprise portal (sales-negotiated, not self-serve)
survives. **Ruled out entirely** — this would have been the obvious first guess and is worth
remembering not to suggest again without re-checking, since it's still widely recommended in
older "best flight APIs" articles that haven't caught up to the shutdown.

### 2. Kiwi.com Tequila API — not accessible to a new small applicant
Since May 2024, Kiwi.com restricted new Tequila partnerships to an invitation-only process;
existing partners kept access, but there is no public self-service signup for a new applicant.
No confirmed path to even see the redistribution terms without an existing login. **Not a
realistic near-term option** unless Sparkfare gets a direct invitation.

### 3. Skyscanner Partner API — application-gated, approval not guaranteed
Requires applying through Skyscanner's Partner Portal; their own FAQ states a ~2-week review and
that approval is not guaranteed for a business without an existing audience. This is the same
shape of gate that already declined Sparkfare once this session cycle (Impact.com's general
Marketplace, 2026-09-15, cited "current domain traffic... don't quite meet the minimum
requirements") — worth applying once there's real traffic to point to, not now. **Deferred, not
ruled out.**

### 4. Duffel — disqualified by its own Services Agreement
Duffel has genuine self-serve signup and published rate limits (120 req/60s on search in the
live environment), which looked promising at first. But its Services Agreement (fetched and
quoted directly, not assumed) explicitly restricts the API from being used **"for metasearch
purposes (including to build a metasearch on top of the Duffel Platform and/or to redistribute to
a metasearch platform)"** (Section 2.5(d)), and separately prohibits republishing/redistributing
"all or any portion of the Services" (Section 2.5(a)). Sparkfare — a deal-alert site that links
out to book elsewhere rather than completing bookings through the data provider — is structurally
a metasearch product. **Ruled out by explicit contract term, not by inference.**

### 5. FlightAPI.io — the one real, actionable candidate found
Its own Terms & Privacy page (fetched and quoted directly) grants, under an active paid
subscription: *"a non-exclusive, worldwide license to access, store, display, analyze, and
redistribute—commercially or otherwise—the publicly available data returned by FlightAPI's API."*
No attribution requirement found in the terms. Standard disclaimers apply (no warranty on
accuracy/completeness/timeliness; standard liability shield) — same posture Sparkfare already
takes toward Travelpayouts data, nothing new to accept. Pricing is real and published: a 20-call
free trial, then paid tiers starting at $49/month for 30,000 credits, scaling up from there.

**What's still unconfirmed and would need checking before writing any fetch code**: exact
requests-per-second/minute rate limit per tier (not published on the marketing pages I could
reach — likely only visible in the API docs after signup), and explicit confirmation that their
underlying data actually covers all 12 real US origin airports + the destination list at a useful
refresh cadence, not just broad "700+ airlines" marketing copy. Also worth flagging as a secondary
(not blocking) risk: FlightAPI's own terms describe their data as "collected solely from sources
that are publicly accessible on the open internet" — i.e., this looks like an aggregator/scraper
business model, not an authorized-partner feed like Travelpayouts or Duffel. That's a business
continuity risk for FlightAPI itself, not a legal exposure for Sparkfare as their paying customer
under an explicit redistribution license, but it's a real reason this source is less durable than
an authorized GDS-adjacent partnership would be.

## Recommendation

**FlightAPI.io is the only candidate that clears both the "self-serve, no approval gate" bar and
the "redistribution terms confirmed in writing" bar** that this task's acceptance criteria
require. It is also the only one of the five that costs real, recurring money ($49+/month) rather
than being free or application-gated.

**This is exactly the kind of recurring-cost decision I won't make unilaterally** — signing up
for a paid subscription is a real spending commitment, and the task's own rule 9 ("passive-ops
rule") plus this project's standing discipline (never spend or commit to a vendor without the
owner's go-ahead) both point the same way. Before any fetch code gets written:

1. **Your call**: is a ~$49/mo recurring cost worth it right now for data-source redundancy on a
   pre-revenue product, or should this wait until Away Mode/flight-affiliate revenue justifies it?
2. If yes: sign up for FlightAPI's free 20-call trial first (no cost) so the exact rate limit and
   origin/destination coverage can be confirmed against the real 12-origin/40-destination list
   before committing to a paid tier.
3. Skyscanner's Partner API is worth re-applying to once Sparkfare has real traffic to cite —
   revisit alongside the other "reapply once scaled" items already tracked in
   `state_AFFILIATE_PROGRAMS.md` (FlexOffers, Impact.com Marketplace, Airalo).

**Not done, deliberately**: no fetch code, no schema changes, no new dependency added. Per T13's
own out-of-scope note, this was insurance research, not urgent — it doesn't block anything else
in the build sequence.
