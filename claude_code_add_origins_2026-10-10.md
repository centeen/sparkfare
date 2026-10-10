# Claude Code instructions — add 7 origin airports (2026-10-10)

Adds Philadelphia (PHL), Detroit (DTW), Fort Lauderdale (FLL), Baltimore (BWI), Minneapolis (MSP), Charlotte (CLT) and Austin (AUS) as origins, taking Sparkfare from 13 origins (12 US + TLV test origin) to 20. The origin architecture is already generic (the "other origins" bucket treats every origin the same way, per CLAUDE.md Phase 11/12 and the TLV note), so this is an additive change: no new architecture.

**How to use:** open Claude Code in the `centeen/sparkfare` repo root. Paste **Prompt 0** first. Run **Task A (discover and gate)** and read its report before approving **Task B (add the origins)**. Run **Task C (evaluate)** about 3 days after the new origins go live.

**When:** Task A can run now (read-only). Task B is built on a branch with a PR and preview. **Check the launch rule in `claude/claude_code_pto_fare_calendar_2026-10-09.md` (nothing merges on launch day, Oct 17; merges resume Mon Oct 19) and do not merge or enable the workflow change until I confirm.** Task C is a follow-up.

---

## Prompt 0 — session ground rules (paste first, and again after any /clear)

```
You're working on Sparkfare, a flight-deal-alert product. Read CLAUDE.md before doing anything;
it holds the real stack (Cloudflare Workers + D1, GitHub Actions pipelines, Travelpayouts/
Aviasales), the "Decisions locked" section (origin list, TLV note, tier split) and many past
gotchas, including the multi-origin key bugs. Also read REPO_MAP.md and state_DECISION_LOG.md.

Ground rules for this session:
1. Explore before editing. Use real file, function, constant and key names from the repo; never
   invent them. Grep for every place an origin is listed (IATA codes, city names, dropdown
   options, validation sets, copy mentioning a number of airports) before changing any.
2. Work on a new git branch (feat/add-origins-phl-dtw-fll-bwi-msp-clt-aus). Small logical
   commits. Do not push to main. Do NOT manually trigger hourly-multi-origin-fetch.yml
   (it hits the real Travelpayouts API under a confirmed rate limit) without asking me first.
3. New origins go in the same "other origins" bucket as the existing non-JFK origins
   (hourly-fetched, 24h-delayed, served from sparkfare_ranked_deals_other_origins.json).
   No new pipeline, no new data file, no new tier logic.
4. Never hardcode secrets. Never modify sparkfare_price_history.json (JFK's).
5. Price honesty: new origins start with zero history. They must show the existing honest
   states ("Building history" / no_data) and never a deal badge or "% below average" until
   dealQuality's history requirement is met. Do not loosen any threshold to make new origins
   look better.
6. No marketing or nav copy may mention the new airports until they show real deals (see Task C).
7. Run `npm run check:copy` and `npm test` (and the Python key tests) before every PR.
8. Report with three tiers: done-confirmed-live / built-not-verified-live / not-started.
   If anything here contradicts the repo, stop and report the discrepancy.
```

---

## Background (Claude Code: read this, it explains the why)

```
Current origins (CLAUDE.md "Decisions locked"): JFK, LAX, ORD, ATL, DFW, SFO, MIA, IAD, EWR,
SEA, IAH, BOS (12 US) plus TLV, a deliberate 13th origin for design-partner testing only.
JFK has its own daily pipeline; the other 12 are fetched hourly and served 24h-delayed from the
combined file sparkfare_ranked_deals_other_origins.json.

Adding PHL, DTW, FLL, BWI, MSP, CLT, AUS makes 20 origins x 40 destinations = 800 requests per
hour. Travelpayouts confirmed (2026-09-06) 300 requests/min per token; the fetch script's own
2s per-request delay means ~27 minutes of fetching per run, so there is no rate-limit risk, but
runs must not overlap the next hourly run (cron is '23 * * * *').

Known risks to handle, not ignore:
- ~45% of non-JFK routes already return no_data (Travelpayouts cache gaps). Smaller or more
  domestic airports (BWI, AUS, FLL for long-haul) will likely be worse. That is a coverage
  limit, not a bug.
- A new origin needs about 7 days of history before it can show a deal. Until then it shows
  "Building history" by design.
- The 2026-09-23 history-key bug (update_history vs classify_destination key mismatch for
  non-JFK origins) may or may not be fixed in the repo. New origins inherit whatever state that
  code is in, so Task A must verify it before Task B proceeds.
```

---

## Task A — Discover, gate and plan (read-only)

```
Task A: find out the real current state and every place that must change. Read-only except for
throwaway local scripts. Do not modify any committed file.

REPORT BACK:
1. KEY-BUG GATE: does update_history() build the same route key as classify_destination() for
   non-JFK origins (quote both)? Any "<IATA>:<IATA>:" keys in
   sparkfare_price_history_other_origins.json or sparkfare_hourly_price_history.json (counts)?
   If the bug is still present, STOP and tell me: the fix in
   claude/claude_code_price_history_fix_instructions_2026-09-25.md must land first, otherwise
   the new origins will be stuck on "Building history" forever.
2. ORIGIN TOUCHPOINTS: list every file and line where the origin list or an origin's
   display name appears, including at minimum: .github/workflows/hourly-multi-origin-fetch.yml
   (env origins, the workflow_dispatch default, the comment block with request math),
   the fetch script's SPARKFARE_ORIGINS handling, the compile/ranking scripts, the three
   VALID_ORIGINS sets (src/index.js, and the frontend pre-submit checks in index.html and
   account.html), the origin dropdowns (index.html origin-switch and signup selectors,
   account.html saved-origin selector), any origin-to-city-name map, route pages and sitemap,
   email templates, analytics event allowlists, tests, and any copy that says "12 airports" or
   otherwise hardcodes the count (step 14 of the consolidated roadmap already lists a
   "12 airports" copy fix).
3. SINGLE SOURCE OF TRUTH: is the origin list duplicated across files? Recommend whether a
   shared constant is worth introducing now (only if small and low-risk) or whether to just
   update each location. Do not refactor yet.
4. WORKFLOW SAFETY: current duration of the hourly fetch run (from recent Actions history),
   whether the workflow has a concurrency group and a timeout-minutes, and the projected
   duration at 20 origins x 40 destinations with the current per-request delay.
5. DATA SIZE: current size of sparkfare_ranked_deals_other_origins.json and the two history
   files, and the projected size with 7 more origins. Flag if the lazily-fetched combined file
   becomes a page-weight problem on mobile.
6. DROPDOWN ORDER: how are options ordered today (TLV is deliberately last)? Propose where the
   7 new ones go. Default: US origins in a sensible order, TLV stays last.
7. LAUNCH RULE: quote the merge/launch constraints from the PTO spec and the roadmap that
   apply to this change.

End with a short recommended plan for Task B. Do not start Task B.
```

---

## Task B — Add the origins (branch + PR, nothing merged or enabled)

```
Task B: add PHL, DTW, FLL, BWI, MSP, CLT and AUS everywhere an origin is listed, per Task A's
touchpoint list. Start in plan mode and show me the plan first.

BUILD:
- Display names: Philadelphia (PHL), Detroit (DTW), Fort Lauderdale (FLL), Baltimore (BWI),
  Minneapolis (MSP), Charlotte (CLT), Austin (AUS). Match the exact label format the existing
  origins use.
- Fetch workflow: add the seven IATA codes to the scheduled run's origins. TLV remains the
  last entry. Update the request-math comment (20 origins x 40 destinations = 800 req/hour at
  ~30 req/min, still well under 300/min; note the date and that the 2026-09-06 confirmation was
  for the original load). Add a `concurrency` group so two runs never overlap, and make sure
  timeout-minutes is comfortably above the projected run time. Keep the cron off the top of the
  hour. Update the workflow_dispatch description if it lists origins.
- Validation: add the codes to all three VALID_ORIGINS sets (src/index.js server-side plus the
  frontend pre-submit checks in index.html and account.html). Keep them in sync; add or extend
  a test that fails if the sets ever diverge from the fetch workflow's list.
- UI: add the options to the origin-switch dropdown, the signup selector and the account
  saved-origin selector in the agreed order, TLV last.
- Compile/serving: confirm sparkfare_ranked_deals_other_origins.json generation and the
  frontend's client-side filter by record.origin handle the new origins with no further change.
  Verify the empty state for an origin with zero data and zero history is the honest
  "Building history" / no-data state, not a broken page or a mislabeled JFK board.
- Seed data: do NOT fabricate history. Do not hand-edit price history files. New origins
  accumulate from the first real fetch.
- Copy: fix any hardcoded "12 airports" or similar count to be correct (or, better, derived from
  the list). Do not add marketing mentions of the new airports.
- Docs: update CLAUDE.md "Decisions locked" (new origin list, with the reason these seven were
  chosen and the note that TLV remains a test-only origin), add a state_DECISION_LOG.md entry
  dated 2026-10-10, and add rows to the consolidated roadmap and MASTER WORKPLAN under
  Phase 11 (Multi-Origin Support): "Add PHL/DTW/FLL/BWI/MSP/CLT/AUS" with status
  "built, not verified live", and a follow-up row "Evaluate new origins after 72h of data".

VERIFY:
- Run the ranking and compile scripts locally against current committed data and show that
  existing origins' output is byte-identical (or explain every diff) and the new origins appear
  with no_data/insufficient_history, not errors.
- Run the Python key-construction tests and the JS tests. Report counts.
- Preview the PR: switch to each new origin in the dropdown, complete a signup with one,
  save one on the account page, reload and confirm persistence. Report what you could not verify.

ACCEPTANCE CRITERIA:
- [ ] All 7 codes appear in the workflow, all three VALID_ORIGINS sets and all three dropdowns.
- [ ] A test fails if the workflow origin list and the VALID_ORIGINS sets diverge.
- [ ] Workflow has a concurrency group and a safe timeout; projected run time is stated.
- [ ] Existing origins' outputs unchanged; new origins show honest empty states.
- [ ] No hardcoded origin count left in copy; no marketing mention of new airports.
- [ ] CLAUDE.md, DECISION_LOG and workplan/roadmap updated.
- [ ] PR opened with preview URL; nothing merged, nothing run against production without my approval.
```

---

## Task C — Evaluate the new origins (run about 72 hours after the first real fetch)

```
Task C: report whether each new origin is worth keeping, using real data.

Read-only. For each of PHL, DTW, FLL, BWI, MSP, CLT, AUS, and for comparison JFK, ATL and ORD, report
from the latest hourly snapshots and sparkfare_ranked_deals_other_origins.json:
- routes with data / no_data / insufficient_history / priced_no_deal / deal, out of 40
- no_data rate as a percentage, and average history points per route
- which destination clusters are mostly empty for that origin

Apply my thresholds and recommend, per origin: keep (no_data under about 40%), watch (40-70%),
or remove from the dropdown (70% or more, sustained). Removal is a recommendation only; do not
change anything. Also report actual hourly run duration now that 20 origins are fetched, and
whether any run was skipped, delayed or overlapped.

Then propose (do not build) whether to add Denver, Las Vegas, Orlando and Phoenix next.
```

---

## After Claude Code finishes (your steps)

1. Confirm the Task A gate: if the key bug is still open, fix that first.
2. Review the Task B plan and PR preview; approve the merge only after the launch-day rule allows it.
3. After merge, wait for one scheduled run (or approve one manual run) and check the live site for each new origin.
4. Run Task C at about 72 hours, then decide keep / watch / remove per origin.
5. Only after a new origin shows real deals, consider mentioning it in marketing or the "more airports" note.
