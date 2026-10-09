# Sparkfare Roadmap — single source of truth

**This file is the only place to look for what Sparkfare builds, in what order, and why.** It
replaces the Master Workplan CSV as a forward-looking plan (the CSV stays as the historical
record of what shipped before 2026-09-26 — see "Historical record" at the bottom) and it
supersedes every separate antigravity/Claude Code build-instructions doc that existed before this
consolidation (full list under "Source documents folded into this plan" at the bottom — don't
build from those separately anymore; they're kept in the project only for the fuller prompt text
on the largest items).

**Passive-ops rule (applies to every phase below):** don't build anything whose ongoing operation
requires Coby to manually reconcile payouts, negotiate per-partner terms, or perform outreach. If
a step seems to need that, stop and flag it instead of building a manual workaround.

**North Star metric (proposed, not yet adopted):** weekly engaged subscribers — opened or clicked
in the last 7 days. `state_METRICS.md` does not exist in this repo (confirmed 2026-10-01) — until
a real metrics doc or dashboard exists, record actuals in `CLAUDE.md`'s running log instead.

**How to keep this file current:** when a PR that completes a roadmap step merges, update that
step's status row and subsection **in that same PR**, citing the PR number (or commit hash,
migration file, or specific live check) as the evidence. That edit is the durable record — there is
no separate decision-log file to also update (see the longer note on this under "Keeping this file
honest" below). A step whose status here hasn't been touched in a while is a signal to re-verify it
before trusting it, not a sign nothing happened.

---

## How to use this document

**If you're Claude Code (or any agent) working this repo:** read this file before doing anything
else, in full. Steps are numbered in build order across the whole project, grouped into phases by
rough timing. Within a phase, a step's "Depends on" column says what must be done first; steps
with no dependency on each other in the same phase can run in parallel. Do not skip ahead to a
later phase's step while an earlier phase's blocking step is still open, unless this file says
they're parallel-safe.

**Ground rules — paste these at the top of every session, every phase, every step:**

```
You're working on Sparkfare, a flight-deal-alert product. Stack: Cloudflare Workers + D1, Clerk
(auth), Resend (email), GitHub Actions (hourly + daily pipelines), Travelpayouts/Aviasales Data
API. 12 origin airports, ~40 destinations per origin. Read CLAUDE.md first, then this file
(ROADMAP.md) in full — it is the single source of truth for priorities and sequencing. Also read
sparkfare_style_guide.md and sparkfare_ranking_methodology.md before touching UI or any
"% below average" logic.

RULES — every step, no exceptions:
1. Discover first. Before editing, inspect the actual current repo/production state for the step
   you're on. Status notes in this file (including "Broken"/"Built"/"Not started") are last-known
   checks, not guaranteed current — at least one earlier fix in this repo was reported done when
   only the data had been patched, not the underlying code bug. Confirm before assuming a status
   or root cause is still accurate; grep for real names, check git log/blame, don't trust a status
   note (including this file) without checking the committed code or the live site.
2. Every user-facing feature ships behind a feature flag, default OFF, and is reversible. With the
   flag off, current behavior must be unchanged.
3. Never hardcode secrets — use `wrangler secret put` / env bindings.
4. Any schema change is a new, numbered D1 migration, backward-compatible, with a rollback note.
   Check for migration-number collisions before adding one (this repo has hit that before).
5. Follow `sparkfare_style_guide.md` for UI and `sparkfare_ranking_methodology.md` for any
   "% below average" or deal-quality logic. If you change the methodology, update that doc in the
   same change.
6. Honesty rule: never show a price claim not backed by data that passed the `dealQuality` (T1)
   guardrails; every claim states its basis and "as of" time.
7. Add tests for every pure function touched or added; add an end-to-end check for each new or
   touched route.
8. Never expose an affiliate link whose status isn't `live` in the partner registry (T2). Never
   invent or guess a tracking URL — only mark something live with a confirmed, real tracking link;
   if unclear, check `state_AFFILIATE_PROGRAMS.md` / the affiliate log and ask, don't invent.
9. Work on a feature branch per step. Commit in small logical steps. Do not push to main and do
   not manually trigger a scheduled pipeline or send a real email/deploy to production without
   asking first.
10. Report using this repo's three honest tiers: **done-confirmed-live** / **built-not-verified-
    live** / **not-started**. Don't call anything done that hasn't actually been checked where the
    step's "Done when" calls for a live check.
11. If a step's status in this file turns out to be wrong (already done, already broken again,
    already superseded), stop and report the discrepancy rather than silently proceeding — and
    note it for a follow-up docs-only commit to this file (see "Keeping this file honest" below).

Work steps in the numbered order given, respecting each step's "Depends on." Don't build anything
outside the current phase without flagging it first.
```

**Legend:**

| Status | Meaning |
|---|---|
| 🔴 Broken | Known to be broken; needs a real fix, not just verification |
| 🟡 Built, verify | Code exists; needs to be confirmed working live, not just locally |
| 🟠 Partly built | Some of the spec shipped; the rest needs building |
| ⚪ Not started | No code yet |
| ✅ Done, confirmed live | Verified against production, not just local/repo |
| ⏸️ Deferred/gated | Not started, and intentionally blocked on a dependency or decision |

**Keeping this file honest:** every status change in this file is its own small, docs-only commit
(or folds into the PR that completes the step) citing the real evidence — a PR/commit hash, a
migration file, or a specific live check — not a vague "confirmed." Don't edit statuses here
silently.

**A note on `state_DECISION_LOG.md` and the `claude/*.md` instruction docs this file cites below:**
`state_DECISION_LOG.md` now exists in the repo (created 2026-10-03 as an append-only, dated decision log; `CLAUDE.md`'s running log remains the record for earlier history). The `claude/*.md` docs still do not exist in this git repository — confirmed 2026-10-01 while syncing this file's Phase 0
statuses (no such file or directory anywhere in the repo, any branch, or any worktree). They were
written into this file as if they were repo files, but they're actually prior session content kept
in the Sparkfare Management Claude project on claude.ai — not retrievable via git, `grep`, or any
tool with repo access. Where this file cites one of them as evidence for a status or a decision,
treat `CLAUDE.md` (this project's real, append-only running log) and git/PR history as the actual
source of truth instead. Where this file cites one of them as the full spec for a not-yet-built
step, the spec lives only in that Claude project now — ask there, or re-derive the spec from this
file's own summary of it plus current repo state, rather than assuming the file can be opened.

### Maintenance process — how this file gets updated going forward

This file is never rewritten wholesale again after the initial consolidation. Every later change
is a **small, targeted docs-only edit**, done one of two ways:

**A. Status change on an existing step** (a step ships, gets verified live, regresses, or turns
out to have a different root cause than assumed). This is the routine case and should happen as
part of finishing the step, not as a separate chore:
1. Claude Code (or whoever did the work) confirms the new status per the three-honest-tiers rule
   (rule 10 above) — don't flip a status to done/verified without the live check the step's "Done
   when" calls for.
2. Edit only that step's status cell (and, if relevant, add a line to its detail paragraph — e.g.
   "confirmed live 2026-10-03") — not the whole file.
3. Cite the real evidence in that same edit: a commit hash, a PR number, a migration filename, or
   the specific live check performed. When a PR that completes the step merges, make this edit in
   that same PR and cite its own number — that's the durable record; there is no separate log file
   to also update beyond `state_DECISION_LOG.md`, which records only dated decisions, not status changes).
4. One small commit. Don't bundle a status update with unrelated app-code changes.

**B. Adding a new step** (a new bug is found, a new idea is approved, scope changes). Use this
template rather than opening a new standalone instructions doc:
1. Decide which phase it belongs to (Phase 0 if it's launch-blocking or launch-adjacent; otherwise
   the phase whose goal it serves).
2. Give it the next free number **overall**, not per-phase — numbers are stable IDs referenced
   elsewhere (this file's own dependency columns, decision-log entries), so don't renumber existing
   steps to make room. Append it as a new row in that phase's table (table row order, not the
   number, controls read order within a phase) and a new `###` subsection with its spec — inline
   the spec if it's short, or a one-line pointer to a new scoped doc (following the existing
   pattern: a doc like `claude_code_<short-name>_instructions_<date>.md`) if the full build prompt
   is long. Either way, this file's row is what carries the status and sequencing — a scoped doc,
   if one exists, is reference material for that one step, never a competing plan.
3. If the new step changes another step's dependencies (e.g. it now blocks something downstream),
   update that step's "Depends on" cell too, in the same edit.
4. Say in the new subsection's own text what was added and why — this file is the record now, not
   a separate log.
5. One small commit, docs-only.

**Who does this:** Claude Code, at the end of any task that changes a step's status (this is
already in its ground rules, rule 11). For a new step that comes out of a planning/strategy
conversation rather than a coding session, draft the addition first (phase, number, table row,
spec or pointer) and hand Claude Code a short docs-only task that applies just that diff — never a
full-file replacement for a small addition; that risks clobbering whatever else has changed here
since and makes the change unreviewable as a diff. Full-file rewrites are reserved for another
project-wide consolidation, if this file ever fragments again.

**If a whole new phase is needed** (a major pivot, not an addition within existing phases): same
process, but add a new `## Phase N` section in the right position, renumber only the phases after
the pivot point if it's inserted in the middle (phase letters/numbers are fewer and less
cross-referenced than step numbers, so this is the one case where light renumbering is fine — but
still never touch existing step numbers), and record it as a deliberate pivot (not a routine status
change) in `CLAUDE.md`'s running log, dated, same as every other decision in this project.

---

## Phase 0 — Launch sprint (fixed: Saturday, October 17, 2026, 12:01 a.m. PT, Product Hunt)

**Launch moved from Oct 2 to Oct 17, 2026 (per Coby, 2026-10-03).** The 12:01 a.m. PT Product Hunt
timing is carried over from the original plan and not re-confirmed for the new date. Oct 17 is a
Saturday; the original date was a Friday.

**The date does not move — a missed gate cuts scope, not the date.** Go/no-go review is
**October 16, 18:00 ET** (same offset as before, the evening before launch), evaluated against steps 6, 7, 10, and 1/2 below, plus a full phone QA
pass. A failing non-P0 step never blocks launch. A failing P0 (step 1 or 2): launch the JFK-only
board with an honest "more airports this week" note rather than slip the date.

Out of scope for this phase — do not touch, even opportunistically: anything from Phase 2 onward, except steps 49 and 52, which were moved into this phase on 2026-10-07 (49 is already live; 52 is the owner's launch-day action).

Live task tracking (not committed to the repo — changes too often): the Launch Control dashboard
at https://claude.ai/artifact/46pAzFwQZHoEb3jV74tPs8, linked from `state_SESSION_STATE.md`.

| # | Step | Status | Depends on |
|---|---|---|---|
| 1 | Deals for all 12 origins (history-key fix) | ✅ Done for the original 12, confirmed live (2026-10-01 sync); 3 more origins added 2026-10-07, still building history (see the note at the end of step 1) | — |
| 2 | Away Mode partner list loads in production + mobile layout | ✅ Done, confirmed live (2026-10-03 verification) | — |
| 3 | Nav shows "Sign In" while the user is authenticated | ✅ Done, confirmed live (2026-10-01 sync) | — |
| 4 | Away Mode partner blurbs missing/out of sync across surfaces | ✅ Done, confirmed live (2026-10-01 sync) | — |
| 5 | Trend-badge logic contradicts its own section + honest price badges (`dealQuality`/T1) | ✅ Done, confirmed live (2026-10-04 verification) | — |
| 6 | Analytics events (T0) | ✅ Done, confirmed live (2026-10-01 sync) | — |
| 7 | Email deliverability: opt-in, unsubscribe headers, bounce handling (T7) | 🟡 Built, mostly confirmed live; bounce and complaint suppression through the Resend webhook both confirmed live 2026-10-08; 1 item open (DMARC `p=none`) | — |
| 8 | Share images and deal permalinks (T4) | ✅ Done, confirmed live (2026-10-01 sync) | — |
| 9 | Referrals (T3) — live at launch (corrected 2026-10-09: this row said flag off) | ✅ Built, flag ON since 2026-09-24 (`7ece3864`); `/hub` and `/r/<code>` confirmed live 2026-10-09; owner confirmed it stays on for launch | — |
| 10 | Route pages: real data or noindex (T5) | ✅ Done, confirmed live (2026-10-03 verification) | 1 |
| 11 | "Complete the trip" module (new revenue surface) | ✅ Done, confirmed live (2026-10-01 sync) | 2 |
| 12 | Revenue health monitor (new) | 🟡 Built, running live; alert path and weekly cadence unverified (re-checked 2026-10-07) | 1, 7 |
| 13 | Away Mode partner-list bugs: coming-soon position, dead Rover/pet-gear links, Timekettle + Parking Access wiring | ✅ Done, confirmed live (2026-10-01 sync) | 2 |
| 14 | UI grab-bag: sticky banner dismiss, homepage ordering, CTA button styling, tap targets, mobile sort/filter stacking, shared nav component, Skimlinks/SparkLoop-embed cleanup, `migrate.sql` asset leak, "12 airports" copy fix | ✅ Done, confirmed live (2026-10-03; re-verified 2026-10-07) | — |
| 15 | Custom 404 page | ✅ Done, confirmed live (2026-10-01 sync) | — |
| 16 | Affiliate disclosure: proximate placement (FTC finding) + `disclosure.html` staleness (missing Bounce, US Global Mail) | ✅ Done, confirmed live (2026-10-03); wording not legally reviewed | — |
| 49 | "Is this a good price?" checker (/check) — moved here from Phase 2 on 2026-10-07 | ✅ Done, confirmed live (2026-10-07); `check_share` and `check_signup` events not yet observed | 1, 5, 16 |
| 52 | Launch-window distribution burst (owner action, one time) — moved here from Phase 2 on 2026-10-07 | ⚪ Ungated; owner action on and around launch day, timing is Coby's call | 16 done; 17 risk accepted; 49 live |

### 1. Deals for all 12 origins — P0, blocks launch

Known root cause on record: `update_history()` in `Phase 1 Deal Ranking Script (Step 9 - with
fallback).py` writes the origin-prefixed feed-dict key (e.g. `LAX:LAX:Bali, Indonesia`) while
`classify_destination()` reads the clean key (`LAX:Bali, Indonesia`). A 2026-09-23 check found 313
and 347 orphaned double-prefixed keys across the two history JSON files; a 2026-09-25 check found
the symptom still present, meaning an earlier fix attempt either never merged or patched data
without fixing the code. **Confirm current state before touching anything** — full diagnose-then-
fix task with Task A/Task B: `claude_code_price_history_fix_instructions_2026-09-25.md` (project
doc). Fix `update_history()` to write the same clean key `classify_destination()` reads (one
shared helper, ideally); one-time migration merging orphaned history without discarding data;
confirm JFK's pipeline is unaffected; test that key-write/key-read paths agree and a simulated
second pipeline run doesn't reintroduce the bug. Separately, ~45% of non-JFK routes return
`no_data` (Travelpayouts cache gaps) — a real coverage limit, report but don't try to fix it.

Done when: all 12 origins show real deals wherever the data supports it, verified live.

**Status sync 2026-10-01: done, confirmed live.** The fix landed 2026-09-23 as three commits
(`91038f2` shared `make_route_key()` helper so both functions derive the same key; `886bbd8`
one-time merge of 313/347 orphaned double-prefixed keys; `88e33ca` backfill of other-origins
history from the deeper hourly file). A 2026-09-25 from-scratch re-diagnosis (prompted by a
separate handoff assuming this had regressed) found zero double-prefixed keys in any of the three
history files, re-ran the ranking script a second time locally to confirm the fix is
self-sustaining (not just lucky), and confirmed the hourly/daily pipelines have run cleanly on
schedule since 09-23 — **confirmed live by the user directly**, switching the origin selector to
LAX and seeing real deal cards with real % badges (CLAUDE.md, "Non-JFK 'Building history' /
missing-% bug — re-diagnosed 2026-09-25, confirmed already fixed and live"). This status was stale
in this file, not the underlying code — see the earlier entry's own warning about a check finding
"the symptom still present" on 09-25, which was superseded by the same-day re-diagnosis.

**Note 2026-10-07: three origins added (DEN, PHX, LAS), now 15 marketed origins (PR #66).** The hourly
fetch picked them up at 11:20 UTC the same day, but coverage is thin: of 40 destinations each, only 6
(DEN), 10 (PHX) and 7 (LAS) have a priced route, against 33 for JFK. Each priced route has one day of
history, so none can show a deal before about 2026-10-21 (10 points over 14 days). The free-tier board
reads the daily other-origins file, which serves a snapshot at least 24 hours old. DEN, PHX and LAS first
appear in the hourly snapshots at 10:55 UTC on 2026-10-07, so that file cannot include them before about
11:00 UTC on 2026-10-08. (The "07:10 UTC compile" first written here was wrong: the 04:53 UTC compile on
2026-10-08 confirmed they were still absent.) The first compile after that is the next chained run, or the
fallback run if it starts after 16:53 UTC.
The homepage says "600 routes from 15 major hubs" and `tests/homepage_hub_count.test.js` enforces it.
A read-only coverage re-check is scheduled for 2026-10-08 about 08:30 UTC (it should read the hourly file,
`sparkfare_hourly_ranked_deals.json`, which does include them, not the free-tier file); if coverage stays far below
roughly 20 priced routes each, soften that line or drop an origin. Nothing decided yet.

**Update 2026-10-08: the daily compile now chains off the daily fetch (PR #102), confirmed on a real run.**
GitHub starts this repo's scheduled workflows hours late and independently of each other: the daily compile's
07:10 UTC cron started between 13:09 and 15:55 UTC on each of the last four days, the daily fetch's new 03:17
UTC slot had not started by 04:50 UTC, and the 14:17 UTC social post started at 20:00. GitHub reported Actions
fully operational, so a fixed compile time could land before the fetch it needs and regenerate the `/data/`
pages from the previous day's JFK file. `daily-compile-other-origins.yml` now also triggers on `workflow_run`
of the daily fetch (a `gate` job lets it through only if the fetch succeeded); its cron (`41 11 * * *`) is
only a fallback that skips itself when a compile succeeded in the last 12 hours; a concurrency group stops
two compiles overlapping. Live test, with Coby's go-ahead: one manual `daily-fetch` run at 04:51 UTC (run
37729464836, success in about 105 seconds, commit `232bc16`) started the compile 8 seconds after it finished
(run 37729602220, `event: workflow_run`, success, commit `208ed96`, 280 files including all 601 `/data/`
pages). `tests/workflow_schedules.test.js` runs the gate's real shell script against a stubbed `gh`.
**Still open:** whether the scheduled 03:17 UTC fetch ever starts on time; one run on the new slot is too
little to judge. Nothing downstream now depends on it starting on time, but if it keeps starting hours late
the data will be that much older when the 08:00 UTC digest reads it.

### 2. Away Mode partner list loads in production, works on mobile — P0, blocks launch

Detailed data/registry fix already exists: `antigravity_partner_registry_fix_2026-09-23.md`
(project doc) — reuse its BUILD steps and acceptance criteria, re-verifying against current repo
state first. A separate mobile-layout defect (no `@media` rules at all in `away-mode.html`) was
also on record as of 09-23 — full spec: `antigravity_ui_fix_instructions_2026-09-23.md`, Task 1.
Discover first whether the current production failure is the data/registry issue, the mobile-
layout issue, or both.

Done when: the partner list renders correctly in production on desktop and a real mobile
viewport, verified live.

**Verification 2026-10-03: done, confirmed live.** Checked on production, read-only. `GET
/api/partners` returns 14 live partners, none with an empty blurb (the registry/data half, fixed by
migration `0012` and PR #8, see step 4). `/away-mode` returns 200. Rendered in a real browser at
375x812: no horizontal overflow (`scrollWidth` 375), all 14 partner cards render and stack
vertically, the "More partners are being added" note is the last element, and the console is clean.
`/out/safetywing` and `/out/tiqets` 302 to the real tracking links; `/out/rover` and
`/out/pet-gear` return 403 (pending, as intended — no dead 404 links). **A correction to the spec
above:** the page still has *no* `@media` rules (confirmed in the served HTML and on `main`), but it
doesn't need them — it lays out with flex-wrap and `max-width`, which is enough at phone width.
The earlier "no `@media`" finding described a missing mechanism, not a visible defect. One minor
gap left: the "View" buttons measure about 63x39px, under a 44px tap target; the fix is in PR #41
(`a54fa63`), not yet merged or deployed.

### 3. Nav shows "Sign In" while the user is authenticated — trust bug, live now

Full spec: `claude_code_nav_auth_and_partner_blurbs_instructions_2026-09-25.md`, Task A. Likely
traces to the same root cause as step 14's shared-nav-component item: every page hand-copies its
own nav markup, and at least one page (`preferences.html`) may have no Clerk integration at all.
Discover first which page(s) are actually live/reachable (there may be a dead `preferences.html`
vs. a real `/account` route) before fixing. Fix every reachable page's nav to reflect real Clerk
auth state; if a shared nav component is the right fix, do it here rather than deferring again —
this bug is a direct consequence of not having done that follow-up already.

Done when: no reachable page shows "Sign In" to an authenticated user, verified with a real sign-in
on every page that has a nav.

**Status sync 2026-10-01: done, confirmed live.** Fixed in two passes: `f974edc`/`0bc262c`
("Fix nav auth-state bug and populate missing Away Mode partner blurbs", merged via PR #8) added a
shared `nav-auth.js` and fixed `index.html`/`account.html`/`trips.html`/`watchlists.html`/
`away-mode.html`/`disclosure.html`/`privacy.html`; `55dd7a6` ("Show Sign out to signed-in visitors
on blog and pSEO pages", merged via PR #17) extended the same fix to all 81 blog posts and all 481
`/data/` pages via a lazy, cookie-hinted Clerk load (so anonymous visitors to those high-traffic
pages don't pay for a Clerk request). Confirmed live twice: the 2026-09-25 production deploy
verified `/account` shows "Sign out" for a signed-in session, and per CLAUDE.md's 2026-09-26
operator-items entry, Coby directly confirmed a blog post shows "Sign out" while signed in too —
closing the one path that deploy couldn't observe itself. `preferences.html` (mentioned above as a
possible gap) is a confirmed dead, unlinked page — the real nav routes `/account`, so it was never
in scope.

### 4. Away Mode partner blurbs missing/out of sync

Full spec: `claude_code_nav_auth_and_partner_blurbs_instructions_2026-09-25.md`, Task B. Every
live, approved partner needs a short, need-led blurb (like the existing Bounce blurb) on every
surface that lists it (`src/email.js`'s `AWAY_MODE_PARTNERS`, `away-mode.html`, `disclosure.html`,
`widget.html` if applicable) — these are hand-duplicated today and drift. Cross-check
`state_AFFILIATE_PROGRAMS.md` before writing copy for any partner; flag new blurbs for review, not
silently shipped. Extend the existing href-parity test to also assert blurb presence and cross-
surface consistency.

Done when: every live partner has a real blurb on every surface, and the parity test passes.

**Status sync 2026-10-01: done, confirmed live.** Same commits as step 3 (`f974edc`/`0bc262c`, PR
#8) added `migrations/0012_populate_partner_blurbs.sql`, copying the already-written blurb copy
from `src/email.js`'s `AWAY_MODE_PARTNERS` into the D1 `partners.commission_note` column that
`GET /api/partners` actually serves (it had been empty for every live partner since the table was
seeded — a real wiring bug, not missing copy). `tests/partners.test.js` was extended with a
`computeFinalPartnersState()` check that replays every migration to verify every live partner has
a non-empty blurb, and was confirmed to catch the regression by temporarily reverting the
migration. Live-confirmed in the 2026-09-25 production deploy: `/api/partners` returns 14 live
partners, none with an empty blurb.

### 5. Trend-badge logic + honest price badges (`dealQuality` / T1)

Two related things:
- **Badge logic bug (🔴):** `sparklineSVG()` in `index.html` computes a "↓X% Dropping" / "↑X%
  Rising" badge on any route with enough history, including in "On the board — priced normally,"
  in "Worth a look" (Cluster 4, which must never carry a price claim per
  `sparkfare_ranking_methodology.md`), and on 1–2 day histories below the documented minimum. Full
  spec: `antigravity_ui_fix_instructions_2026-09-23.md`, Task 2. Fix: only render a percentage
  badge where `item.status === 'deal'` — never independently recompute a percentage in the
  frontend for `priced_no_deal`, `featured`, or `insufficient_history` items.
- **`dealQuality` / T1 verification (🟡):** separately, confirm on the live site that badges read
  "X% below 30-day avg" with the stated basis, and that no badge ever shows a percentage for a
  deal that didn't actually pass the `dealQuality` guardrail. Report the verification method used.

Done when: no card outside "Today's deals" shows a percentage badge, no Cluster 4 card ever shows
one, no card under 7 days of history shows one, and live badges are confirmed to only reflect
`dealQuality`-eligible deals.

**Status sync 2026-10-01: built and deployed, not independently verified live — downgraded from
this file's prior mixed 🔴/🟡 to a single 🟡.** Badge logic bug: `e802a4e` ("B4: remove sparkline's
ungated 'Dropping' badge, confirm real badges route through dealQuality") removed
`sparklineSVG()`'s independent percentage computation entirely — it now only draws the price-history
polyline, with the real "X% below 30-day avg" badge coming solely from `item.status === 'deal'`
data that already passed `dealQuality`. Merged to main via PR #5 (`4b23c18`, part of the 2026-09-25
batch). `dealQuality`/T1 verification: separately confirmed via the `expires_at` hard-gate fix
(`158ea4a`, PR #3) — a live debug endpoint showed 11 of 12 real JFK records correctly passing the
eligibility filter post-fix, and a real non-mocked email sent. **What's still missing for a full
✅**: the 2026-09-25 production-deploy verification's spot-check list (CLAUDE.md) doesn't include
loading the live deal board and visually confirming no percentage badge appears outside "Today's
deals" / on a Cluster 4 card / under 7 days of history — that specific UI check hasn't been
recorded as done against the live site.

**Verification 2026-10-04: done, confirmed live.** Checked the production homepage in a real browser
(read-only). No "Dropping", "Rising" or "Stable" text is visible anywhere (the words survive only in a
source comment and the `isDropping` variable that picks the sparkline's colour); all 32 sparklines are
plain polylines with no separate percentage claim; every percentage on the page (the hero and the four
deal cards) belongs to a record with `status === 'deal'` and states its basis; no non-deal card showed
a percentage. **One real inconsistency was found and fixed in the same pass** (PR #49,
`1c4dc4e`): the hero said "23% below the 30-day average" (a mean-based `pct_below_avg` recomputed in
the browser) for a deal whose own `basis_text` said "26% below 30-day median, 31 observations", and
some cards said a bare "20% below avg". The hero and cards now render each record's `basis_text`
verbatim, so every percentage names its method and observation count; `pct_below_avg` is only used
for the best-deal sort. Guarded by `tests/badge_basis_text.test.js`. Re-checked live after deploy: hero
"26% below 30-day median, 31 observations", cards 10%, 27% and 22% with the same wording, no console
errors. Note: the "Done when" text above still says "X% below 30-day avg"; the live wording is now
the median-based `basis_text`, which is what the T1 methodology actually computes.


**Update 2026-10-08: median everywhere, confirmed live where noted (PRs #99 and #100).** Coby decided every
customer-facing percentage and comparison price uses the 30-day median. Before this, the `/data/` pages, the
social card and X post, the Sparkfare Index page and the route-retrospective email still said "average" and used
the mean-based `pct_below_avg`, so the same route showed two numbers (32 of 36 live deals differed, for example
Madrid: 25% below its median on the homepage, 21% below its average on its `/data/` page); the homepage's
best-deal sort (and so the hero pick) also ranked by the mean-based figure, which the note above says was
"only used for the best-deal sort". #99 moved all of these, plus the ranking script's stored order and the
newsletter generator, to the median; #100 rewrote the public blog, which still described the retired per-cluster
15/20/25% thresholds, an arithmetic-mean baseline and a 7-day minimum (the real rule is median - 2 x MAD with 10
days of history spanning 14). `tests/median_wording.test.js` fails if "average" wording or the retired rule
returns in any customer-facing source or blog post. Live-checked: the rewritten blog posts and generated guides
are on production. **Update, same day: the `/data/` pages are confirmed live too.** The chained compile
described under step 1 regenerated all 601 of them (none say "average" in the repo, 214 priced pages say
"Median"), and three live pages were checked on production after the deploy: Prague and Lisbon read "Current
Price vs. 30-Day Median", and JFK to Madrid reads "25% below 30-Day Median", matching the homepage.

### 6. Analytics events (T0) — go/no-go criterion

Confirm the events pipeline is firing in production for the full T0 event set (signup,
alert_subscribed, alert_email_sent, email_open, email_click, outbound_click with sub_id,
share_click, referral_signup, widget_impression) and that `/admin/metrics` reflects real events,
not just that the instrumentation code exists. As of the 09-23 launch-readiness note, there was no
analytics script of any kind on the live site — confirm this has actually changed.

**Status sync 2026-10-01: done, confirmed live with real data.** Root cause (`92595cf`, "F1: fix
real root cause of T0 analytics being silently no-op in production") was that the `events` table
had no `CREATE TABLE IF NOT EXISTS` guard anywhere — a missing table in production would have made
every write silently no-op. Migration `0013_events.sql` and the inline guard shipped via PR #5. A
**direct, read-only production D1 query** on 2026-09-26 (`wrangler d1 execute --remote`, logged in
CLAUDE.md's "Operator items closed and a live events check," PR #21) confirmed real rows
accumulating since 2026-09-24: 368 total, including `route_promoted` (239, latest same-day),
`deal_suppressed` (97), `outbound_click` (29, latest same-day), and `alert_email_sent` (2). This is
a stronger check than the original "Done when" asks for (a live DB query, not just an
`/admin/metrics` read) — the full T0 event set from the original spec
(`alert_subscribed`/`email_click`/`referral_signup`/`widget_impression`) wasn't individually
itemized in that query, so if any of those specific types matter for a go/no-go sign-off,
re-confirm them by name.

### 7. Email deliverability (T7) — go/no-go criterion

Discover first what's missing. On record: `List-Unsubscribe` + `List-Unsubscribe-Post` headers may
still be missing (only an in-body link may exist) — RFC 8058 requires both headers plus the
visible link. Confirm whether a suppression list, a preference center, and a Resend bounce/
complaint webhook exist. Fix whatever's missing; add a sending-volume guard that auto-pauses on
rising bounce/complaint rates.

Done when: a real test send includes both required headers (verified by inspecting raw headers),
and suppressed/unsubscribed addresses are never sent to.

**Verification 2026-10-03: built, mostly confirmed; two items still unverified, so 🟡 not ✅.**
- *Confirmed live — headers.* The raw MIME of the real scheduled 08:00 UTC digest sent
  2026-10-03 (Gmail, landed in the Inbox, not Promotions) carries `List-Unsubscribe:
  <https://sparkfare.com/api/unsubscribe?email=…>` and `List-Unsubscribe-Post:
  List-Unsubscribe=One-Click`, both covered by the DKIM signature, plus a visible unsubscribe link in
  the body. DKIM, SPF and DMARC all `pass`.
- *Confirmed live — webhook.* `POST /api/webhooks/resend` returns 401 unsigned, and the Svix-header
  fix (PR #24) has been confirmed with real `email.opened` deliveries (see `CLAUDE.md`, 2026-09-26).
- *Confirmed by tests, not live.* Suppression (a suppressed address never reaches Resend; GET and
  one-click POST unsubscribe suppress; bounce and complaint webhooks suppress; the sending guard;
  the newsletter path) is covered by `tests/t7_deliverability.test.js` against real SQLite. A real
  unsubscribe-then-send round trip on production has not been observed.
- *Not verifiable from the repo — needs Resend dashboard access.* Whether the webhook is subscribed
  to `email.bounced` and `email.complained`, not just `email.opened`. Until it is, real bounces and
  complaints never suppress anyone.
- *Noted, not changed.* DMARC is `p=none` (monitor only), so receivers are told not to act on
  failures; reasonable while ramping, worth tightening to `quarantine` once the volume is stable.
  The unsubscribe URL is a bare `?email=` with no token, so anyone who knows an address can
  unsubscribe it (low severity, but a griefing vector).

**Verification 2026-10-04: suppression now confirmed live; one new DNS defect found; stays 🟡.**
- *Confirmed live — suppression round trip.* On production, a disposable alias
  (`centeen+suppresstest@gmail.com`) was unsubscribed through the real `GET /api/unsubscribe` link, then
  a real `POST /api/signup` for the same address triggered a verification send. `wrangler tail`
  showed `Skipping email to … (suppressed)` and nothing was sent. All test rows were deleted
  afterwards (user, suppression, consent, referral code, signup event); `users` is back to 3 and
  `email_suppressions` to 0. This closes the "unsubscribe-then-send never observed" gap above.
- *Confirmed live — open tracking and sends.* 21 `email_open` events (latest 2026-10-04 13:42:16 UTC),
  `users.last_opened_at` current for all 3 users, 10 `alert_email_sent` events (latest the 08:00 UTC
  digest today). A real post-click follow-up went out 13:42:07 UTC as the `v1_fixed` template and
  logged `checklist_email_sent`; it was opened 9 seconds later.
- *New defect — root SPF record is invalid.* `sparkfare.com` TXT reads `v=spf1
  include:_spf.mx.cloudflare.net include:sendgrid.net include:resend.com~all`. There is no space before
  `~all`, so `include:resend.com~all` is not a valid mechanism and the whole record is an SPF
  permanent error for any mail using the root domain as envelope sender. Current mail is unaffected
  (Resend's Return-Path is `send.sparkfare.com`, whose own SPF record is valid, and DKIM satisfies
  DMARC), but it should be fixed in Cloudflare DNS: replace with `v=spf1 include:_spf.mx.cloudflare.net
  ~all`, adding `include:sendgrid.net` only if SendGrid is still used. Not changed from the repo.
  Other DNS checked and fine: DKIM key at `resend._domainkey`, `send.` SPF and MX, `links.` CNAME to
  `links2.resend-dns.com`.
- *Still open.* (1) Whether the Resend webhook is subscribed to `email.bounced` and
  `email.complained` (needs Resend dashboard; bounce and complaint counts are 0 because nothing has
  bounced, not evidence either way). (2) DMARC is still `p=none`. (3) Live unsubscribe links still
  carry the raw email address; the v2 email's signed-token links (PR #51, flag off) fix this once
  enabled.

**Update 2026-10-07: root SPF defect fixed and confirmed.** Coby replaced the record in Cloudflare DNS;
`sparkfare.com` TXT now reads `v=spf1 include:_spf.mx.cloudflare.net ~all` (SendGrid and the malformed
Resend include dropped, since nothing in the code sends through SendGrid and Resend uses the `send.`
Return-Path). Checked by DNS lookup against both 1.1.1.1 and 8.8.8.8, and exactly one `v=spf1` record
exists. `send.sparkfare.com` is unchanged (`v=spf1 include:amazonses.com ~all`). Not yet checked: the
headers of a real send after the change (SPF/DKIM/DMARC `pass`); the next scheduled digest will show it.
The three "Still open" items above are unchanged.

**Update 2026-10-07: post-click checklist email v2 is live; the signed-token unsubscribe item is only
partly closed.** `ENABLE_EMAIL_CHECKLIST_V2` was set to `"true"` in PR #59 (`9cdc391`), and
`UNSUBSCRIBE_SECRET` and `EMAIL_POSTAL_ADDRESS` were set as Worker secrets (Secret Change deployments at
10:02 and 10:07 UTC); without them the flag silently falls back to v1. Confirmed by a real signed-in
"Book this fare" click at 10:08:57 UTC: production D1 logged `checklist_email_sent` with
`variant: "v2"`, items parking/luggage/vpn/tours, `days_to_departure: 23`. **Inbox check 2026-10-07:** Coby opened the
delivered email and reported that it looks right. That was a general visual confirmation; the footer postal
address and the `?token=` form of the unsubscribe link were not separately itemized, so the exact link
format is reported, not independently inspected. **Scope limit:** only this one email carries the signed link.
The daily digest (`ENABLE_EMAIL_V2`, still `"false"`) and the other lifecycle emails still build
`/api/unsubscribe?email=<address>`, so the "bare `?email=`" griefing vector remains for them. Ordering
note: `wrangler secret put` refuses to run while the newest uploaded version (a PR preview build) is not
the deployed one; merge first, then set secrets.

**Update 2026-10-07: every email's unsubscribe link and header is now signed; the "bare `?email=`" item is closed.**
Found while checking the digest: the daily digest (v1 and v2) and 12 other places (the lifecycle emails, the
Sunday newsletter batch, and the default `List-Unsubscribe` header in `sendEmailWithGuard()`) built
`/api/unsubscribe?email=<address>`. That let anyone unsubscribe any address, and a plain GET on it changed
state immediately, so a mail scanner that follows links could unsubscribe a subscriber (no real user had
been unsubscribed or suppressed at the time: 3 users, 0 and 0). PR #64 (`4f39c62`) adds `buildUnsubscribeUrl(env, email)`,
used at all of those sites: it issues the signed `?token=` link when `UNSUBSCRIBE_SECRET` is set (it is, in
production) and the legacy link otherwise, so a missing secret cannot break a send. The token GET shows a
confirm page and the one-click POST handles `List-Unsubscribe-Post`; the legacy `?email=` route is kept so
emails already sent still work. Tests: `tests/signed_unsubscribe.test.js` (5; 4 fail if signing is disabled);
full suite 365/365 (`t7b_push` excluded). **Confirmed live:** a real, non-mocked digest sent to
centeen@gmail.com at 2026-10-07 after the deploy (v1 layout, sample deal), and Coby reported its unsubscribe link
is a token link. Not separately checked: that clicking it shows the confirm page without unsubscribing (covered
by the tests, not by a live click), and the other lifecycle emails have not each been sent live.
**Step 7 now has two open items:** the Resend webhook subscription to `email.bounced` and
`email.complained` (Resend dashboard, Coby), and DMARC still `p=none`.

**Re-verification 2026-10-07 (suppression round trip, on current production code): confirmed.** With
`wrangler tail` attached to production: a real `GET /api/unsubscribe?email=` for a test alias of the owner's
address (`centeen+suppresstest@gmail.com`) returned 200 and wrote an `email_suppressions` row
(`reason: unsubscribed`); a following send to that address through the guarded path
(`POST /api/send-daily-alert`) logged `Skipping email to centeen+suppresstest@gmail.com (suppressed)` in the
Worker and made no Resend call. The route's JSON response is `{"ok":true,"sent":true,"mocked":false}` either
way, so **that response cannot tell a suppressed send from a delivered one; only the log (or the inbox) can**.
The test row was deleted afterwards. Not covered: the bounce/complaint webhook path, which still needs the
Resend subscription above.

**Finding 2026-10-07 (FIXED the same day, PR #73): the manual trigger routes were unauthenticated.** `POST /api/send-daily-alert` (mails
any address with the daily template), `/api/reconcile-bookings`, `/api/check-revenue-health`,
`/api/check-affiliate-link-health`, `/api/send-departing-soon-alerts`, `/api/send-stress-valve-alerts`,
`/api/send-departure-briefing-alerts` and `/api/send-route-retrospectives` have no auth check (the first returned
400 on an empty body, the stress-valve and reconcile routes returned 200 and ran). Risk: anyone can make
Sparkfare send mail to an arbitrary address, which spends sender reputation and can trip the bounce/complaint
circuit breaker that blocks all guarded email; the batch routes are idempotent, so they mostly waste work. The
admin routes already use `ADMIN_SECRET` (`/admin/metrics`, `/admin/pinterest/*`); gating these the same way would
close it. **Fixed in PR #73, confirmed live:** all nine routes now return 401 without `Authorization: Bearer
<ADMIN_SECRET>` (checked on production with no credentials, a wrong secret and a secret in the URL, for each
route); the secret in a URL is refused on purpose; `/api/health`, `/api/check` and the `/api/events` beacon stay
public. Nothing depended on the open routes (the daily cron calls the functions directly; no workflow uses them).
To call one by hand: `curl -s -X POST -H "Authorization: Bearer $ADMIN_SECRET" https://sparkfare.com/api/<route>`. Side note: while checking this, the probe
itself POSTed to a few of these routes, which ran the reconcile and stress-valve batches once; nothing was sent
(0 matches; the stress-valve delivery log shows no new row after the 08:00 UTC cron).

**Update 2026-10-08: bounce suppression through the Resend webhook confirmed live.** Resend dashboard
screenshot (Coby): the endpoint `https://sparkfare.com/api/webhooks/resend` is Enabled and listens for
`email.opened`, `email.bounced` and one more event that the dashboard collapsed to "+1"; its recent
`email.opened` deliveries all show `200 - OK`, 1 attempt, response `{"ok":true}`. Live test on production:
a disposable `POST /api/signup` for Resend's sink address `bounced@resend.dev` (id
`local_bouncetest_<timestamp>`, `source: bounce_test`) sent a real verification email; about 4 seconds later
`email_suppressions` held a row for it with `reason: bounce`. That proves the chain Resend `email.bounced`
event, signed webhook, D1 write for bounces. All test rows were deleted afterwards (suppression, consent log,
the `signup` event, then the user; **`events.user_id` is a foreign key to `users`, so delete the event row
before the user or the delete fails with `FOREIGN KEY constraint failed`**, and `wrangler d1 execute
--command` takes one statement per call). **Still open:** (1) whether the collapsed "+1" is
`email.complained` (click it in Resend to check; `complained@resend.dev` can test it once confirmed);
(2) DMARC is still `p=none`. The send-skip half of the round trip was already confirmed live on 2026-10-04
and 2026-10-07 above, so no new live check is owed there.

**Update 2026-10-08 (later): complaint suppression confirmed live; step 7's webhook item is closed.** Coby
checked the Resend dashboard and confirmed the webhook's collapsed "+1" event is `email.complained`, so it is
subscribed to `email.opened`, `email.bounced` and `email.complained`. Live test on production, same method as the
bounce test: a disposable `POST /api/signup` for Resend's sink address `complained@resend.dev` (`source:
complaint_test`); within seconds `email_suppressions` held a row with `reason: complaint` and `events` held an
`email_complaint` event (email id recorded in `meta`). All test rows were deleted afterwards, including the
`email_bounce` and `email_complaint` events, because **those two event types feed the sending circuit breaker's
7-day counts, so a test that leaves them behind would count against real sending**; `users` is back to 3,
`email_suppressions` to 0. The two `interstitial_view` rows my own `curl` checks created were removed too.
**Step 7 now has one open item:** DMARC is still `p=none`. Whether to move it to `quarantine` is the owner's call
and is reasonable once volume is stable.

### 8. Share images and deal permalinks (T4)

Confirm `/deal/:origin/:dest/:date` permalinks resolve live with real Open Graph/Twitter tags and
a real generated share image (not the old hardcoded generic stock photo), and that no image or
price claim is generated for an ineligible deal.

**Status sync 2026-10-01: done, confirmed live.** `/og/*` had actually been returning HTTP 500 in
production the whole time (satori 0.33+ added a `harfbuzzjs` dependency that cannot run in
Workers — WASM code-gen is disallowed there). Fixed by `f57176a` ("Fix /og/ share-image 500: pin
satori to 0.32.0, fix the card"), merged via PR #29 (`3ed26a1`). Also fixed while there: an emoji
rendering as "NO GLYPH" boxes, a long destination name wrapping and pushing the basis/timestamp off
the canvas, and a card that stated a mean-based percentage under a "median" label — it now prints
the ranking pipeline's own `basis_text` verbatim, or falls back to a generic card if a record has
none. Confirmed live: the exact `og:image` URL a real deal permalink advertises returned a valid
200 `image/png`, 1200x630, 43,113 bytes, visually inspected post-deploy. `index.html`'s own SEO
tags (canonical, OG, Twitter card, JSON-LD) were separately completed and confirmed live the same
day via PR #19 (`961032c`, `624fa02`).

### 9. Referrals (T3) — live at launch

**Corrected 2026-10-09.** This section and its table row said to leave `ENABLE_T3_REFERRALS` off, but the flag has been `"true"` since 2026-09-24 (`7ece3864`, "T3: enable referral loop"), and `CLAUDE.md` recorded it as already on and working in its F5 entry. A 2026-10-09 flag check against `wrangler.jsonc` found the mismatch. Production checks the same day: `/hub` returns 200 (not the old 404), and an unknown `/r/<code>` returns 302 to the homepage. The owner confirmed referrals stay on for launch. The nav now links the Referral Hub on every page, so the old "Hub 404 while the flag is off" concern (UI-bug-report round 2, Bug 4) no longer applies.

Still true: the referral rewards are feature rewards only (no cash or goods), per the decisions list; referral confirmation depends on the Resend `email.opened` webhook, which is confirmed working.

### 10. Route pages: real data or noindex (T5) — go/no-go criterion

Was independently confirmed working via an earlier live spot-check; re-verify it hasn't regressed
(step 1's history-key fix changes which routes clear the eligibility threshold — a plausible
regression path). Confirm pages below the eligibility minimum are `noindex` and `sitemap.xml`
lists only indexable pages, checked live.

**Verification 2026-10-03: done, confirmed live — with one wording correction.** The `/flight/` route
pages were non-functional until the F3 field-name fix (`display_name`, not `destination`; see
`CLAUDE.md`), so the "earlier live spot-check" above predates the real fix. Checked on production
read-only: `/flight/JFK/Bali, Indonesia` returns 200. The routes sitemap is **`/sitemap-routes.xml`**,
not `/sitemap.xml` (a static file shadows the Worker's dynamic one; PR #11), and `robots.txt` lists
it. It now lists 258 route URLs across exactly the 12 marketed origins, with no TLV and no
`undefined`. A random sample of 40 of those URLs all returned 200 with a canonical tag and no
`noindex`. **Correction to the spec:** routes below the eligibility minimum are not served as
`noindex` pages on live data — they return **404** and are absent from the sitemap, which is
stricter and also satisfies "never indexed" (checked: JFK `no_data` routes such as Tokyo and Buenos
Aires, and `insufficient_history` routes from LAX, DFW, SFO and MIA, all 404). The `noindex` render
path exists for a record that was eligible at ranking time but fails `dealQuality` at request time;
it's covered by `tests/t5_route_pages.test.js` and hasn't been observed on production. Step 1's
history-key fix did not regress this: the sitemap grew from 227 URLs (2026-09-25) to 258.

### 11. "Complete the trip" module (new)

A module on the deal/route surface offering trip-adjacent upsells (hotel, tours, eSIM) for the
deal's actual travel dates. Pull candidates only from the partner registry filtered to
`status='live'`; parameterize by the deal's actual dates/destination where the partner link
supports it; same FTC disclosure treatment as every other affiliate surface (match the pattern in
`disclosure.html`); feature-flagged, default OFF; fully automatic partner/date selection, no
manual daily curation.

Done when: the module renders behind its flag, shows only live-status partners relevant to that
deal, carries proper disclosure, with tests covering partner-filtering and date-parameterization.

**Status sync 2026-10-01: done, confirmed live — this file's prior "Not started" was stale.** Built
as "N1: scaffold 'Complete the trip' module, seed 4 partners as pending" (`615ed3f`), seeding
Tiqets/GoCity/QEEQ/Welcome Pickups into the `partners` registry as `status='pending'` (no
fabricated tracking links — this project's standing rule against guessing affiliate URLs). Once
Coby supplied real Travelpayouts tracking links the same day, `aba42cf` ("N1: flip ... live with
real tracking links") flipped all 4 to `status='live'` via `migrations/0010`. Both merged to main
via PR #5 (`4b23c18`). Confirmed live in the 2026-09-25 production deploy: `GET /api/partners`
returns 14 live partners (the original 10 plus these 4), none with an empty blurb. No Trivago/hotel
row exists in any migration — correctly still waiting on that partner's own affiliate approval (A1),
not built speculatively.

### 12. Revenue health monitor (new)

A weekly automated check across affiliate link health (live-status links actually resolve), the
data pipeline (step 1's pipeline producing fresh, non-corrupted output), and email bounce rate
(step 7's webhook rate within normal range) — silent unless something's broken, emails Coby only
on failure. Built to specifically catch a check reporting success while actually failing (a send
reporting 200 that never arrived, a link that 200s but redirects dead), not a generic uptime ping.

Done when: it runs on a real weekly schedule, sends nothing on a clean run, and — tested by
deliberately breaking one check — sends a real alert when something fails.

**Status sync 2026-10-01: built and deployed, not independently verified live — this file's prior
"Not started" was stale, but don't mark this ✅ yet.** Built as `9c3d36d` ("N2: build revenue health
monitor; fix critical email ReferenceError bug"), merged via PR #5. `checkRevenueHealth()` runs
inline inside the already-live daily general cron (`0 8 * * *`) right after `reconcileBookings()` —
not on its own weekly schedule as originally specced, so "it runs on a real weekly schedule" isn't
literally true; it rides the daily cron instead, which is a reasonable substitution but a different
cadence than this step's own "Done when" states. It checks for a missing `TRAVELPAYOUTS_TOKEN`, a
`reconcileBookings()` error, and a `partner_conversions` table that's stayed empty for more than 7
days into the current month, alerting `hello@sparkfare.com` on any hit. **What's confirmed live**:
a real, non-mocked test send proved the *embedded* bugfix this commit also shipped (a
`ReferenceError` that silently turned every real send of `sendVerificationEmail`,
`sendRouteRetrospectiveEmail`, `sendSunsetEmail`, and `sendSupportAutoResponder` into a reported
failure despite Resend actually delivering the email). **What's not confirmed**: the monitor itself
has not been observed running in production, and nobody has deliberately broken a check to confirm
it actually alerts, as this step's own "Done when" requires.

**Verification 2026-10-04: running live and healthy; stays 🟡.** `POST /api/check-revenue-health`
against production returned `{"healthy": true, "problems": [], "alert": null}`. The reconciliation it
runs first made a real, non-mocked Travelpayouts call (8 trips checked, 0 matched), so the token is
valid and the monitor is genuinely executing, not just built. It is wired into the daily cron at
`src/index.js` (right after `reconcileBookings`). Production data at the time: all 8 trips are still
`clicked` (no confirmed booking, so no `price_eur`), and `partner_conversions` has no rows for any
month. **Why it is not ✅**: (1) the "Done when" asks for a weekly schedule and it rides the daily
cron; (2) nobody has deliberately broken a check to see a real alert arrive (the alert path is only
covered by tests); (3) as built it checks revenue plumbing only (Travelpayouts token and
reconciliation, and the manual `partner_conversions` table), not the affiliate-link, pipeline-freshness
or bounce-rate checks this step's description lists. Affiliate link health does run separately as the
weekly Step 117 cron. **Expect an alert on 2026-10-08**: once the UTC date passes the 7th with no
`partner_conversions` row for the month, the monitor emails hello@sparkfare.com every day until a row
exists. That is the intended nudge, not a fault; rows are entered by hand from each partner's
dashboard.

**Re-check 2026-10-07: still running live and healthy; stays 🟡.** `POST /api/check-revenue-health`
returned `{"healthy": true, "problems": [], "alert": null}`, with a real, non-mocked Travelpayouts
reconciliation (9 trips checked, 0 matched). `POST /api/check-affiliate-link-health` checked 14 links,
0 broken, no alert. Production's latest deployment (2026-10-07 09:09 UTC) matches `origin/main`. Unchanged
from 10-04: nobody has deliberately broken a check, so the alert path is still covered only by tests,
and the cadence and scope gaps above remain. The 10-08 `partner_conversions` nudge email, if it arrives,
would be the first real alert send and would close the alert-path gap.

**Re-check 2026-10-07 (12:01 UTC): still healthy; alert path verification scheduled.** `POST
/api/check-revenue-health` returned `healthy: true`, no problems, `alert: null`, with a real Travelpayouts
reconciliation (10 trips checked, 0 matched); `POST /api/check-affiliate-link-health` checked 14 links, 0 broken.
The alert path cannot be exercised safely today: the only rule that fires without breaking a real credential
(deleting `TRAVELPAYOUTS_TOKEN` would destroy a value that cannot be read back) is the `partner_conversions`
nudge, active from 2026-10-08 00:00 UTC. A one-time check (`verify-revenue-alert-path`) is scheduled for
2026-10-08 08:50 UTC. Because the route now needs the admin secret (PR #73), that task cannot authenticate by itself: it
will give Coby the one-line command to run with the secret after 08:00 UTC, and Coby pastes back `healthy`, `problems`
and `alert`. A real alert should also already be in the hello@sparkfare.com inbox from the 08:00 UTC cron; if none
arrived, the cron alert path failed. The manual call sends one extra internal email. Step 12 stays 🟡 either
way: the cadence and scope gaps listed above remain.

**Scope extended 2026-10-07: the daily health check now also watches data freshness and the email guard.** Prompted by
finding that the daily JFK fetch had landed 5 to 7.5 hours late for 12 days with nothing reporting it. Inside the same
daily 08:00 UTC `checkRevenueHealth()` it now reports, in the same single alert email to hello@sparkfare.com, (1) each ranked-deals
file that is unreadable, has no `generated_at`, or is older than its limit (JFK daily and other-origins daily: 36 hours, meaning a
whole day was missed, since yesterday's file is about 20 hours old at 08:00 UTC; hourly multi-origin: 12 hours, since its gaps run up
to about 7.5 hours), has no priced routes at all, or has doubled-origin-prefix route keys (the corruption that once broke non-JFK
deals); and (2) the email sending guard being tripped, which silently skips every guarded email and was reported nowhere else.
The subject is now "Sparkfare health check". It stays silent when healthy and, like the `partner_conversions` nudge, repeats daily while a
problem persists. `POST /api/check-revenue-health` (admin secret) returns the per-file ages in `freshness` and the guard numbers in
`emailGuard` even when healthy, so a manual run shows the live picture. Run against the real files on 2026-10-07 it reports no problems
now and would have flagged the other-origins and hourly feeds had nothing run for another day. `tests/data_freshness.test.js` (13). **Not yet
observed in production:** the first real run with these checks is the 2026-10-08 08:00 UTC cron. Remaining gaps against this step's own text:
it still runs daily rather than weekly (arguably better), and affiliate link health stays a separate weekly check (step 117). Status stays 🟡 until the
alert path is seen to send (scheduled for 2026-10-08).

### 13. Away Mode partner-list bugs

Full spec: `antigravity_ui_fix_instructions_2026-09-23.md`, Task 3. Three bugs: (a) the
"More partners are being added" note sits inside `.partner-list` and gets pushed around by
`reorderPartners()` — move it outside/after the list so it always renders last; (b) Rover and
Travel Gear cards link to `/go/rover` / `/go/pet-gear` with no matching `AWAY_MODE_PARTNERS`
entry, 404ing — Rover isn't approved, so hide that card entirely rather than leave a dead link;
confirm Travel Gear's status before deciding; (c) Timekettle (approved via Awin per the 09-23
decision log) and Parking Access need to actually be wired into `AWAY_MODE_PARTNERS`,
`away-mode.html`, `disclosure.html`, and the T2 partner registry once it exists (step 20) — the
09-23 decision log confirms Timekettle was added to the Away Mode list by the user directly, but a
test click registering in the Awin dashboard, and full wiring across every surface, are still
unconfirmed. Add the href↔`AWAY_MODE_PARTNERS` parity test if it doesn't already exist (step 4
extends this same test for blurbs).

**Status sync 2026-10-01: done, confirmed live, all three sub-bugs.** (a) Coming-soon position:
`0778622`/`f4509c2` ("B5: fix real root cause of coming-soon appearing before partner cards") —
`reorderPartners()` in `away-mode.html` now explicitly re-appends the `.coming-soon` footer after
every reorder, confirmed by reading the current function (it previously got stranded wherever
`appendChild` left it). (b) Dead Rover/pet-gear links: structurally impossible now — both are
seeded `status='pending'` in `migrations/0002_partners.sql` (confirmed directly), and
`GET /api/partners` only ever returns `status='live'` rows, so a pending partner's card simply
never renders; `e64a899`/`97f42bd` separately cleaned the same stale references out of the
`away-mode-checklist` blog post. (c) Timekettle + Parking Access wiring: both are seeded
`status='live'` in that same migration (confirmed directly — `timekettle`/`'Travel Gear'`/Awin
link/`'live'`; `parking-access`/`'Parking'`/`'live'`), and both are counted among the 14 live
partners the 2026-09-25 production deploy confirmed via a real `GET /api/partners` call. The
Awin-dashboard test-click registration mentioned above is still genuinely unconfirmed — that
requires checking Awin's own dashboard, which isn't observable from this repo.

### 14. UI grab-bag

Full spec: `antigravity_ui_fix_instructions_2026-09-23.md`, Task 4, plus
`claude/antigravity_ui_bug_report_2026-09-23_round2.md` Bugs 1 and 2. Items:
- Redundant "Customize your trip" nudge card repeats per partner-category section instead of once
  near the top (round-2 Bug 1).
  **Audit 2026-09-26: fixed** — `/away-mode` has a single "Customize your trip" panel, not one per section.
- Sign-in modal renders stacked against page content instead of centered with a dimmed backdrop
  (round-2 Bug 2) — test at mobile widths, where this was found.
  **Audit 2026-09-26: fixed** — at 375x812 `/sign-in` shows a fixed full-screen dimmed backdrop and a card
  centered horizontally and inside the viewport.
- Sticky `#lead-magnet-banner` has no dismiss control and permanently covers page content on
  mobile — add a close control (sessionStorage, wrapped in try/catch) and bottom padding.
  **Audit 2026-09-26: the premise is wrong — the banner never appears.** It is `position: fixed` with
  `transform: translateY(100%)`, and nothing in `away-mode.html` ever adds the `.visible` class that would
  show it, so it is permanently off-screen (dead code), not covering content. It also has no close control
  and styles its CTA with the gold `#FFC107`. Decision needed: wire a trigger + dismiss (with the sage action
  colour), or delete it.
- Homepage buries the first deal card ~1000px down on mobile behind a Watchlist promo and a
  "Not seeing your destination on today's board? The board **above**…" block that actually
  renders above the board — move both below the deals, or fix the copy.
  **Audit 2026-09-26: still broken.** At 375x812 the two promos take ~415px (Watchlist top 139, directory
  top 282) and the origin bar sits at 715, so the hero starts at y=877, below the 812px fold, and its Book
  CTA is at y=1546. The directory promo still says "The board above only shows..." while sitting above it.
  **Fixed and confirmed live 2026-09-26 (PR #35):** both promos now sit below the board; at 375x812 the
  hero starts at y=585 (was 877) and its Book CTA is at y=1255 (was 1546), and the directory promo copy
  was corrected. Limit: the Book CTA is still below the 812px fold on a phone, because the hero itself is
  733px tall (its 4:3 photo).
- "Create Watchlist" and "Browse All 480 Routes" render as plain bold links, not buttons; the
  "More" toggle on deal cards is 29×15px, well under a usable tap target (raise to ≥40×40px).
  **Audit 2026-09-26: still broken; root cause found.** Both CTAs are styled with `--spark` / `--ledger`
  (style-guide names) which `index.html` never defines (it uses `--text`, `--sage`, `--amber`), so the whole
  `background` / `border` declaration is invalid and they render as plain text. The "More" toggle measures
  31x17px. (`--spark` is gold, which the site reserves for deal signals; use the sage action colour.)
  **Fixed and confirmed live 2026-09-26 (PR #35):** both are now real `.promo-cta` buttons on the page's
  own tokens (cream + dark text; sage outline), 44px tall; the "More" toggle keeps its 31x17px look with a
  ~47x45px invisible tap area. A test now fails if any page uses an undefined CSS variable.
- Only the homepage has a working mobile hamburger menu; every other page hand-copies its own nav
  with no mobile collapse. **This is the same root cause as step 3's nav-auth bug** — do this once,
  as one shared nav component/partial used by every page, rather than patching N copies again. If
  genuinely too large to do safely in one pass alongside step 3, do the minimal correct fix on
  every page for both bugs now and write up a concrete, scoped follow-up — don't repeat an open-
  ended punt a third time.
  **Audit 2026-09-26: partly true.** The homepage hamburger works (9 links, toggles, `aria-expanded`, 38x40).
  Content pages (`/away-mode`, `/disclosure`, blog, pSEO) have no hamburger but wrap 10 links into a ~101px
  block with no horizontal overflow: usable, not collapsed. **The Worker-rendered pages `/hub`, `/index` and
  `/reward-terms` have no navigation at all.**
- Mobile sort/filter bar: "SORT BY" floats right of the origin dropdown while its own select wraps
  to the next line — stack each label+control pair together under the mobile breakpoint.
  **Audit 2026-09-26: still broken.** At 375px the "Sort by" label sits at left 237 beside the origin select
  while its own select is on the next row (top 794).
  **Fixed and confirmed live 2026-09-26 (PR #35):** each label sits directly above its own full-width,
  44px select (labels y=399/477, selects y=421/499, both 335px wide).
- Remove the Skimlinks script (`s.skimresources.com/js/...`) from every page — the Skimlinks
  application was declined (`CLAUDE.md`, 2026-09-21); it has no live account behind
  it. Confirm whether SparkLoop's embed script is intentional before removing it the same way.
  **Skimlinks half done, confirmed live 2026-09-26** (static pages 2026-09-25; the four Worker
  templates in `src/index.js` and `Phase 20 Blog Generator.py` in PR #30 — 0 occurrences across 14
  live pages, including `/index`). The SparkLoop-embed question above is still open.
  **SparkLoop audit 2026-09-26:** the embed (`js.sparkloop.app/embed.js`, publication `pub_7999f6c312f6`)
  loads on 483 pages — the homepage, all 481 pSEO pages (it is in the pSEO generator template), and
  `widget.html` (confirmed directly 2026-10-01 while auditing `privacy.html` for the same
  script — the original "homepage plus 481" count here was one page short; `widget.html` loads it
  too) — and `privacy.html` did not mention it. **Disclosed in `privacy.html` 2026-10-01** (commit
  `9b48ae5`, branch `docs/privacy-third-parties`) as a real, confirmed-live data flow, independent
  of whether SparkLoop ever approves the pending application. Still needs Coby's decision on
  whether loading it sitewide while unapproved is intentional (SparkLoop has not approved the
  application, per step 24).
- Add `migrate.sql` to `.assetsignore` — it's currently publicly downloadable.
  **Audit 2026-09-26: done** — `/migrate.sql` and `/migrations/*.sql` return 404 live.
- Homepage copy says "13 major hubs" — should say 12 (TLV stays unmarketed per CLAUDE.md's design-
  partner policy).
  **Done, confirmed live 2026-09-26** (PR #32): the whole line was wrong, not just the number — it now
  reads "Tracking prices for 480 routes from 12 major hubs." (12 x 40 is exactly 480, and only ~52% of
  routes are priced on a given day, so "live" and "active" were dropped).

**Status sync 2026-10-03: done, confirmed live — every bullet above is closed.** The items that were
still open after the 2026-09-26 audit landed in three PRs, all measured on production at 375x812:
- *Homepage ordering, CTA buttons, "More" tap target, sort/filter stacking* — PR #35. The hero now
  starts at y=591 (was 877) with the two promos below the board, "Create Watchlist" and "Browse All
  480 Routes" are 44px real buttons (cream fill / sage outline, on the page's own tokens), the sort
  and origin labels sit directly above their own full-width 44px selects, and the "More" toggle gets an
  invisible `::after` hit area (about 47x45 when measured locally; not re-measured on production, since
  the visible label is still 31x17). The hero's Book CTA is at y=1237, still below the 812px fold on a phone (the 4:3
  photo drives the hero height); that is a known limit, not a regression.
- *`#lead-magnet-banner`* — wired up rather than deleted, PR #42 (decision: the sync it advertises
  is real). Shows once a signed-out visitor answers a checklist question, has a 44px dismiss
  (remembered per session, storage guarded), pads the page by its own height, is out of the tab
  order while hidden, and uses the sage action colour instead of gold. Verified live: hidden on
  load, 119px tall after a click, dismiss clears the padding, 14 partner cards, no overflow, clean
  console.
- *Nav on `/hub`, `/reward-terms`, `/index`* — PR #42; same nav as every other page plus the lazy
  signed-in hook. Live on all three.
- *SparkLoop embed* — **decision made 2026-10-03 (Coby): keep it everywhere**, including while the
  application is unapproved. It stays disclosed in `privacy.html` (PR #37). Revisit when step 24
  resolves.

**Re-verification 2026-10-07: every item still holds on production, read-only, at 375x812.** Clean
console, no horizontal overflow (page width 375), 32 deal cards render. "Create Watchlist" and "Browse All
480 Routes" are 44px buttons; both promos sit below the board (board top y=1386, promos about y=18,400).
Each sort/filter label is directly above its own full-width 44px select (labels y=405/483, selects
y=427/505). The "More" toggle's visible label is 31x17, but clicks land on it from 20px away in all four
directions, which is the first production check of the invisible hit area (earlier measured only locally).
The hamburger is 38x40. `/hub`, `/reward-terms` and `/index` return 200 with the site nav, `/migrate.sql`
is 404, a bad URL gives the custom 404, Skimlinks occurrences are 0, and the trust line reads "480 routes
from 12 major hubs." The hero's Book CTA is at y=1241, still below the 812px fold (known limit).

**Phone QA pass 2026-10-07 (the go/no-go gate's "full phone QA pass"), production, read-only, emulated
375x812.** Covered `/`, `/away-mode`, `/data/`, a pSEO route page, `/flight/JFK/Bali, Indonesia`, the blog
index and a post, `/hub`, `/disclosure`, `/privacy`, `/sign-in`, `/widget`, `/reward-terms`, `/index`, and
the custom 404; `/watchlists`, `/trips` and `/account` redirect signed-out visitors to `/sign-in` with the
right `redirect_to`. No broken images and no sideways overflow on any of them except the two below.
- *Fixed, PR #62 (`bf0b2de`), confirmed on the preview build and in the served production HTML:*
  **`/data/`** had a non-wrapping nav (no `flex-wrap` in the pSEO generator's listing template), making the
  page 561px wide on a 375px screen; it is now 375px with the nav wrapping onto two rows. **`/flight/:origin/:dest`**
  had no navigation at all (tagline only); it now carries the shared nav and signed-in hook, and an anonymous
  visit makes no Clerk requests. Only `data/index.html` changed on regeneration; the 480 route pages and
  the sitemap were byte-identical.
- *Open, Coby's call:* the route page shows a gold "Get Deal Alerts" button even when the fare is not a
  deal (JFK to Bali read "0% below 30-day median"), which cuts against gold being reserved for deal signals.
  The hamburger menu links are 21px tall and the homepage signup selects are 39px, both under the 44px target.
- *Not covered:* signed-in pages; submitting any form (it would create real signups); a physical phone or
  Safari (this was an emulated Chromium viewport); per-page console errors (the pane's error buffer did not
  reset between pages, so it could not be isolated).


No custom 404 exists; unknown URLs fall back to a bare error page with no nav. Build one using
the shared nav component from step 14 once it exists.

**Status sync 2026-10-01: done, confirmed live — prior "Not started" was stale.** Built as part of
`dc470ba` ("B8: unify nav across secondary/blog/pSEO pages, add a real custom 404"), merged via PR
#5. `404.html` exists on `main` with the same nav used everywhere else, rendered from
`handleRequest()`'s own existing last-resort fallback (previously a bare `Response('Not found')`)
rather than via `wrangler.jsonc`'s `not_found_handling`, which would have silently 404'd several
paths (`/flight/*`, `/sitemap.xml`, `/admin/metrics`, etc.) that depend on falling through to the
Worker. Confirmed live in the 2026-09-25 production deploy: a custom 404 with the site nav was
directly observed.

### 16. Affiliate disclosure: proximate placement + staleness

Two related findings from a 2026-09-26 non-attorney legal review:
- **Placement (🔴):** the sole disclosure mechanism sitewide is the nav link to the standalone
  `/disclosure.html` page — FTC Endorsement Guides guidance specifically calls this out as
  insufficient on its own. `index.html`'s deal-card "Book" links (`item.booking_link`) carry no
  inline/proximate affiliate indicator. Fix: add a proximate, inline disclosure indicator directly
  on or immediately next to every affiliate link, not only a separate page.
- **Staleness:** `disclosure.html`'s partner list omits Bounce and US Global Mail, both reported
  live elsewhere in the project. Bring it into sync with the actual live partner list (ties into
  step 4's cross-surface parity test).

Workplan Step 22's "Applied sitewide" status is optimistic against this finding — correct it to
distinguish "linked disclosure page exists sitewide" from "proximate inline disclosure on
affiliate links" (not yet true) once this ships.

**Status sync 2026-10-03: done, confirmed live; not legally reviewed.** *Placement:* PR #40 adds an
adjacent disclosure ("Sparkfare may earn a commission if you book through this link, at no extra
cost to you. Disclosure", linking to `/disclosure`) to the homepage hero Book link, every card's Book
link and the watchlist "Book Flight" link; a disclosure above the partner list on `/flight/…` route
pages; one above the booking button on `/departing/…`; and one before the partner grid in all 40
blog posts that carry partner links (also in `Phase 20 Blog Generator.py`, so regenerating cannot
drop it). `/away-mode` and the emails already disclosed before their links. Live check: 32
`.affiliate-note` elements for 31 Book links on the homepage, the hero note directly after the CTA,
disclosures present on a route page and a blog post. `tests/ftc_inline_disclosure.test.js` fails if
an affiliate link is added without one (4 tests; all fail without the change). *Staleness:*
`/disclosure` names all 14 live partners (checked name-for-name against `GET /api/partners`
2026-10-03; `tests/partners.test.js` also asserts it). Caveats: this is a non-attorney reading of FTC
guidance; the wording should still get a legal review. The pSEO `/data/` and `/deal/` pages have no
affiliate links, so carry none. Workplan Step 22's "applied sitewide" can now say so for links on
the pages above.

---

## Phase 1 — Legal/compliance track (parallel, ongoing)

Runs alongside every other phase. Doesn't block Phase 0's launch date, but gates specific later
steps as noted.

| # | Step | Status | Gates |
|---|---|---|---|
| 17 | Seller of Travel: reframed as a copy and positioning position (was: attorney review) | Risk accepted 2026-10-07; revisit on triggers (see state_DECISION_LOG.md and `CLAUDE.md`) | No active marketing push until step 16 and the referral-positioning copy pass are merged and live |
| 18 | Business entity formation (e.g. LLC) | ⏸️ Owner action, not yet done | Reduces personal liability regardless of #17's outcome; recommended same-week, not gated on anything |
| 19 | Insurance referral licensing | ⏸️ Open | Any insurance-category Away Mode partner going live |

**Gate note 2026-10-07:** no active marketing push (including the launch-window burst, step 52) until step 16 and the referral-positioning copy pass (branch `feat/referral-positioning`) are merged and live. **Both are now live** (step 16 on 2026-10-03, PR #40; the copy pass on 2026-10-07, PR #69, checked on production), so this gate is cleared; step 52 now waits only on step 49 being live. The position is factual: Sparkfare publishes fare information and sends people to the booking site; it does not sell, book, ticket, arrange or take payment for travel. Copy is guarded by `scripts/check-referral-copy.js` (run by `npm test`). The statute analysis below is kept as background, not as an open action.

Details: CA Bus. & Prof. Code §17550.1's broad "advertises that he or she can or may arrange"
language is broad enough to arguably reach a deal-aggregator model even without payment
processing — not resolved without a travel-industry attorney. Operator context on record: no
business entity formed yet (sole proprietor), user base nationwide with no state concentration.
Full analysis: `CLAUDE.md`, 2026-09-26 entries ("Compliance — Seller of Travel / insurance-referral
licensing").

---

## Phase 2 — Revenue on (proposed Oct 18–31, 2026; was Oct 3–16 before the launch moved to Oct 17. Gated on Phase 0's go/no-go passing)

**Dates re-baselined 2026-10-07 as a proposal, pending Coby's confirmation.** The launch moved from Oct 2 to Oct 17 (15 days), so every later phase shifts by the same 15 days: Phase 2 Oct 18–31, Phase 3 Nov 1 – Dec 15, Phase 4 mid-Dec 2026 – mid-Apr 2027, Phase 5 unchanged. Only the dates moved. The exit gates are the same (Phase 2: 500 confirmed subscribers, one verified affiliate commission, 10+ founding members; Phase 3: 2,500 subscribers or 10,000 monthly sessions; Phase 4: 10,000 subscribers), and they decide when a phase really ends, not the calendar. Dependencies outside the code can still move steps within a phase: the SparkLoop resubmission needs 5 live digest editions, the paid tier is gated on a stable engaged cohort, and the launch-window posts (step 52) are the owner's call.

**Goal:** first commissions and first paid dollar, without slipping into per-partner outreach.
**Exit gate:** 500 confirmed subscribers, at least one verified affiliate commission, 10+ founding
members.

| # | Step | Status | Depends on |
|---|---|---|---|
| 20 | T2 — Away Mode partner registry, disclosure, attribution | 🟡 Largely built (not re-audited against the T2 spec): `partners` table with live/pending status, `/out/<slug>` redirects with click logging and a bot class, disclosure placement, 14 live partners | Phase 0 step 6 (T0 events) |
| 21 | E0–E3 — Daily email upgrade + public archive | 🟡 E1 (v2 email) and E2 (archive) built and tested, both switched off; E3 weekly edition built privately 2026-10-07 (first one Sun Oct 11); E3 skip-if-unchanged built 2026-10-09 behind `ENABLE_DIGEST_SKIP_UNCHANGED` (off; not observed). Archive chips fixed 2026-10-09 (editions now show real NEW / PRICE DROP / STILL AVAILABLE). Change-led subject lines and a browse list that hides empty origins added 2026-10-09 (v2 template only; the v1 email still has a constant subject). Audited 2026-10-07 | Phase 0 steps 5, 7 |
| 22 | T8-spec — paid-tier design doc | 🟡 Draft written 2026-10-07, revised 2026-10-09 after review (`plus_tier_design_2026-10-07.md`, section 11: v1 limits do not exist yet, `'paid'` would grant hourly data, Stripe-on-Workers handling, a waitlist first), awaiting the owner's approval and the decisions in its section 10 | Stable engaged-cohort signal in T0 data; Phase 0 passing |
| 22a | `/plus` landing page: pricing, features, sign-up CTA (from the 2026-10-07 Phase 1 guide) | ⏸️ Proposed, not approved | 22 approved |
| 22b | Plus email templates: welcome, re-run confirmation, seasonal alert, weekly summary header (same guide) | ⏸️ Proposed, not approved | 22 approved |
| 22c | Plus marketing collateral: banners, affiliate assets (same guide) | ⏸️ Proposed, not approved | 22 approved |
| 22d | Decouple `subscription_tier = 'paid'` from the hourly data file, so Plus cannot sell speed (from `plus_tier_design_2026-10-07.md` section 9; relabelled from 22b on 2026-10-09) | ⏸️ Proposed, not approved | 22 approved; belongs with step 58 |
| 22e | Plus waitlist on `/pricing` (double opt-in) and a recorded interest number, the gate to start 23a (same doc; relabelled from 22c) | ⏸️ Proposed, not approved | 22 approved |
| 24 | SparkLoop resubmission | ⏸️ Gated | 21 (≥5 editions live at sparkfare.com/digest, including a weekly) |
| 25 | CheapOair secondary booking button ("Also check CheapOair") | ⏸️ Gated | Awin approval (applied 2026-09-23 to merchant 11564, awaiting response) |
| 26 | Display-ads exploration | ⏸️ Gated | Site clears 1,000 sessions/30 days (tracked here; folds into step 30 once route pages exist) |
| 50 | City Unlock: waitlist + demand-driven origin enablement | ⚪ Not started | 1, 6, 7 |
| 51 | Feeds + shared post renderer (RSS per origin; Bluesky/Mastodon via same renderer as 35) | ⚪ Not started | 8 |
| 58 | Free tier becomes same-speed: remove 24h delay for non-JFK origins | ⚪ Not started | 1 |
| 72 | PTO calendar, Track A: `/time-off/<origin>` long-weekend planner with a PTO optimizer, `.ics` download and share card (flag `ENABLE_PTO_CALENDAR`). Pulled forward from Phase 3 because the 2027 planning season peaks Nov to Jan | 🟡 Built and merged 2026-10-09, flag off, not yet seen live (owner approved the spec and the early merge 2026-10-09) | Track 0 discovery (done) |
| 73 | PTO window fares, Track B: per-window fare fetch (`Phase 22 PTO Window Fetch (Step 73).py`, `pto-window-fetch.yml`) and display (flag `ENABLE_PTO_FARES`) | 🟡 Built and merged 2026-10-09; flag off; the workflow's first dry run decides the endpoint | 72; Track 0 dry run |
| 74 | Long-weekend watches, Track C: "Watch this weekend" email alerts (migration `0019`, flag `ENABLE_PTO_WATCH`) | 🟡 Built 2026-10-09 on branch `pto-track-c`, flag off; needs migration `0019` applied before merge | 73; `0019` applied in production first |
| 75 | PTO distribution, Track D: digest promo block, social posts, Pinterest pins, press note, blog post, nav link | ⚪ Not started | 72; feeds 54 |

*Steps 49 and 52 moved to Phase 0 on 2026-10-07 (49 is done; 52 is the launch-day owner action). Their detailed write-ups stay below, where they were.*

*Step 23 moved to the Phase 3 window on 2026-10-07 (proposal): the Plus design recommends starting billing after launch plus about two weeks of real data, which is about Nov 1. 22a to 22c are written here but gated on step 22's approval.*

### 20. T2 — Away Mode partner registry, disclosure, attribution

Full spec: `antigravity_build_instructions_prioritized_2026-09-22.md`, task "T2." A `partners`
config/table (id, name, category, url_template, commission_note, status, status_reason,
updated_at); render Away Mode links only for `status=live`; seed from current state (SafetyWing,
Bounce, US Global Mail, Rocket Languages, Timekettle, Parking Access as live; Holafly pending;
insurance-category partners `blocked_legal` unless explicitly live per step 19); reusable
disclosure component; all outbound links through `/out/:partner` logging `outbound_click`.

### 21. E0–E3 — Daily email upgrade + public archive

Full spec: `claude_code_email_upgrade_instructions_2026-09-24.md`. Why: SparkLoop held Sparkfare's
application over content quality; the current daily email is a bare list, and recent editions were
near-identical. Sequence: **E0** discovery (report only — confirm personalization actually filters
by subscriber origin, confirm T7/T1 status, no code changes); **E1** a content-rich, on-brand
template behind `ENABLE_EMAIL_V2` (flag OFF by default); **E2** a public `/digest` archive (new
`digest_editions` table) so SparkLoop has a reviewable history and every email gets a "View in
browser" link; **E3** send logic that stops repeating identical emails (NEW/PRICE DROP/STILL
AVAILABLE classification, skip-if-unchanged) and adds a weekly flagship edition. As of the
2026-09-26 `CLAUDE.md` entry, `sparkfare.com/digest` still 404s — this has not shipped. *Not
independently re-verified during the 2026-10-01 status sync (out of this pass's scope), but worth
a fresh check before trusting this line: a `/digest` route and `migrations/0014_digest_editions.sql`
already exist in `src/index.js`, gated behind `ENABLE_DIGEST_ARCHIVE` (`"false"` in
`wrangler.jsonc`) — more may be built here than this paragraph currently credits.*

**Audit 2026-10-07 (full write-up: `digest_archive_audit_2026-10-07.md`).** E2 is built and tested (15 tests pass), the `digest_editions` table exists in production (0 rows),
and `ENABLE_DIGEST_ARCHIVE` is `"false"`; E1 is built behind `ENABLE_EMAIL_V2` (`"false"`); nothing writes a weekly edition, so E3 is not built. Findings: (1) today's public edition has 7
affiliate booking links with no `rel="sponsored nofollow"`; (2) the archive always renders the v2 template while subscribers get the plain v1 email, with no "View in browser" link, until E1 is switched on, so
showing SparkLoop the archive would not match what is sent; (3) one flag controls both archiving and serving, so there is no way to build edition history privately first; (4) the weekly edition
the resubmission gate asks for cannot exist until E3 is built. Not enabled or changed. Options in the audit: do nothing before launch, fix (1) and add a write-on/serve-off flag then start archiving privately around
Oct 12, or the full pull-forward (not recommended inside a launch-week freeze).

**Update 2026-10-07 (PR #84): option B done.** Findings 1 and 3 are fixed: the digest template marks every Aviasales, `/out/` and `/go/` link `rel="sponsored nofollow noopener"`, and a new flag `ENABLE_DIGEST_ARCHIVE_WRITE` (on) stores each day's editions while `ENABLE_DIGEST_ARCHIVE` (off) keeps `/digest` and its sitemap dark and keeps the email from linking to it. Writing started with the first cron after the deploy (07:00 or 08:00 UTC on Oct 8), not Oct 12, because it is private and earlier gives more editions. Still open: finding 2 (the archive renders v2 while subscribers get v1 until `ENABLE_EMAIL_V2` is on) and finding 4 (no weekly edition, E3). Publishing is one line: set `ENABLE_DIGEST_ARCHIVE` to `"true"`; do it only after deciding finding 2. **Not yet observed:** the first stored edition (`SELECT count(*) FROM digest_editions`).

**Amendment 2026-10-03:** add to E1 acceptance a "forward to a friend flying from another airport" block (prefilled origin + `ref` param) and a group-share link. No reward; the referral flag stays OFF. Note: E3's skip-if-unchanged rule stays as is; step 61 adds a separate, rate-limited "No sparks today" note.

### 22–23. T8-spec / T8-MVP — paid-tier design, then minimal founding-member tier

`T8-spec` full doc-only spec: `antigravity_build_instructions_v2_gtm_aligned_2026-09-22.md`. Not
gated on a fixed 8-week wait — introduce once T0 shows a stable core of engaged users (real
return-visit and click behavior, not just opens). `T8-MVP` (same doc): Stripe subscription,
webhook-driven entitlement, cancel flow — this is the same initiative as the "founding-member
$29/yr" line from the earlier roadmap summary; don't build two separate tiers.

**Amendment 2026-10-03:** the paid tier cannot sell speed or earlier access (see step 58); paid value must come from other features (for example more airports, filters, watchlists).

**Phase 1 guide reconciled 2026-10-07:** `phase1_guide_reconciliation_2026-10-07.md` goes track by track through the "Final, ready to execute" guide (which arrived cut off at its last track). Two of its tracks are already built (email T7, the partner registry), three rest on objects or protocols that do not exist (`alerts`, a real MCP server, DAU from events), and its new step numbers 46 to 50 collide with existing steps, so they became 64 to 68. Nothing in it is approved.

**Design draft 2026-10-07:** `plus_tier_design_2026-10-07.md` is the step 22 spec, written from the 2026-10-07 implementation guide after reconciling it with the repo (its section 2 lists where the guide's premises were wrong). It proposes a narrow v1 (more watchlists and origins, configurable reminder timing), one capped founding price (about $29 a year), Stripe Checkout plus the hosted Customer Portal, `subscriptions` and `stripe_events` tables, the webhook as the only writer of the tier, and a `ENABLE_PLUS` flag; household sharing, re-run, the sitter page, white-label and metered MCP are kept out of v1. **Not approved, no billing code written.** Two findings shipped with it: (1) `POST /api/signup` accepted a client-supplied `subscription_tier`, so any visitor could mark any email "paid" (new row or resubmit); fixed the same day, `tests/signup_tier.test.js` (4); (2) the existing tier routing gives paid users the hourly data file, which is a paid tier selling speed and must be removed together with step 58.

### 24. SparkLoop resubmission

Owner action. Gate: ≥5 new editions (ideally including a weekly, from step 21) live at
sparkfare.com/digest. Then reply to SparkLoop with that link, correct the "Jason" name error on
the application, click Resubmit, and record the outcome in `CLAUDE.md`'s running log.

### 25. CheapOair secondary booking button

Awin merchant 11564; already applied 2026-09-23, awaiting approval. Once approved: model in the
T2 (step 20) partner registry; honesty rule — only as an automatic fallback when the Aviasales
link is broken/unavailable, or a clearly labeled secondary "Also check CheapOair" button, never
silently swapped in under an Aviasales-sourced price.

### 26. Display-ads exploration

Tracked here per the original phase summary; in practice this is the same build as step 30
(T5b) once route pages exist — don't build a separate ad-slot mechanism twice.

### 49. "Is this a good price?" checker (/check) — now a Phase 0 item

Added 2026-10-03. `/check` takes origin, destination, month/date range, and the price the user saw. It returns "X% below/above the 30-day average of the lowest fares Sparkfare cached for this route (N days, as of <time>)". It must state this is not their exact itinerary, give no predictions, and say "not enough history" under 7 days. Add a shareable result card and a route-alert CTA. Unsupported routes/origins capture email and airport into step 50's waitlist. Add `source` (UTM) to the signup event if missing. Events: `check_run`, `check_share`, `check_signup`. Flag `ENABLE_PRICE_CHECK` (default OFF). Honesty rule applies; no real posts or sends without asking. Done when: works live on a real route, the edge paths behave, and events appear in /admin/metrics. Step 59 extends this with a signed stamp and chart.

**Status 2026-10-07: v1 built behind `ENABLE_PRICE_CHECK`.** `GET /api/check`,
`POST /api/check/share`, the `/check` page (`check.html`), pure scoring in `src/priceCheck.js`,
`tests/price_check.test.js` (16 tests). Decisions taken, differing from the spec text above:
percentage only, no good/bad verdict; the baseline is the **median** (matching `dealQuality` and
every badge), not the "average"; the date-range input is dropped (the history is one cheapest
cached fare per day per route, not tied to travel dates, so a date range could not change the
answer); the minimum is the live rule of 10 points over 14 days, not "7 days"; unsupported origins
and destinations get a plain "not supported" message and the normal alert signup, and the
waitlist waits for step 50. TLV is not offered. The shared link (`/check?o=&d=&p=`) recomputes
live on load and is noindex. `/api/signup` now records an optional `source` on the signup event,
and `source: "check"` also logs `check_signup`; weekly metrics roll up `check_run`, `check_share`
and `check_signup`. Verified locally against the real data files in a browser; not yet on
production.

**Launch 2026-10-07:** the flag is set to `"true"` in `wrangler.jsonc`; a "Check a price" link is in the
site nav on every page that has the nav (573 files, both pSEO generator templates emit it too, and a
test fails if a page drops it); `/check` is in `sitemap.xml`. Merging deploys it. 
**Confirmed live 2026-10-07 (PR #70 merged 11:54 UTC, checked about a minute later):** `/check` returns 200;
`/api/check` returns a correct result for a real route (JFK to Bali, Indonesia at $700 is 14% below the 30-day
median of $810, from 31 fares), `no_data` for a route with no history, and 400 for a bad price; the
"Check a price" nav link is on `/`, `/away-mode`, `/blog/`, `/data/` and `/terms`; `/check` is in
`sitemap.xml`; and two `check_run` events landed in production D1 with the right route, status and percentage
(read directly from the `events` table, not through `/admin/metrics`, whose secret this session does not
have). Those two test events were deleted afterwards, so the counts start at zero. **Not yet observed:**
`check_share` and `check_signup` (they need a real share click and a real signup), and the page itself was
not driven in a browser after the deploy (it was before, locally, against the real data files). Known
limits: DEN, PHX and LAS show "no prices yet" until they reach the other-origins file (2026-10-08 07:10 UTC
compile), and the JFK "as of" can be about a day old because the daily fetch has been landing between
11:45 and 13:32 UTC rather than at its 06:00 UTC schedule.

### 50. City Unlock: waitlist + demand-driven origin enablement

Added 2026-10-03. Origin picker gets "Don't see your airport?" Only list airports Travelpayouts actually returns data for. Waitlist uses T7 double opt-in, shows progress to a configurable threshold, and offers a share link. At threshold a job enables the origin automatically (origins table with an `enabled` flag plus a cap on total enabled origins), shows "collecting history" until the 7-day minimum, then emails the waitlist. Check that total requests per run fit the 300/min Travelpayouts limit and the Actions schedule (e.g. 30 origins x 40 destinations = 1,200 requests, ~4 min) before raising the cap. TLV stays unmarketed. Flags default OFF. Done when: a test airport can be waitlisted and auto-enabled via a lowered staging threshold.

### 51. Feeds + shared post renderer

Added 2026-10-03. `/feed/:origin.xml` lists only `dealQuality`-eligible deals with basis and as-of time. One renderer builds the post payload shared with step 35 and optional Bluesky/Mastodon. No X, no Telegram. Flags default OFF; no real posts without asking.

### 52. Launch-window distribution burst (owner action, one time) — now a Phase 0 item

Added 2026-10-03. One-time owner action, gated on step 16 shipped and the Seller of Travel decision (17). Post the checker (49) and later the report (54) in communities where people ask whether a fare is good (read each community's self-promotion rules; lead with the tool). List in alternatives/product directories and Show HN. Relaunch on Product Hunt only for major features. Every post gets a UTM; log URLs and outcomes in `state_DECISION_LOG.md` and weekly numbers in `state_METRICS.md`.

### 58. Free tier becomes same-speed: remove the 24h delay for non-JFK origins

Added 2026-10-03. Decision 2026-10-03: free = same-speed for all 12 origins; the future paid tier must NOT sell speed. Today non-JFK origins are served a 24h-delayed view (`daily-compile-other-origins.yml`, `SPARKFARE_FREE_TIER_DELAY_HOURS=24`, `Phase 11 Compile Free Tier View.py`, once daily at 07:10 UTC). When this step is built:
- (a) Discover first and report: confirm how non-JFK data is served, which history file the live ranking uses (relates to step 1), every place that reads delayed data or mentions the delay (route pages, daily email for non-JFK subscribers, share images, JSON feed, homepage/FAQ/disclosure copy, `CLAUDE.md` "locked tier split"), and the real fetch cadence (notes say 3-5h, not hourly).
- (b) Make the delay a config value, default 24 so behavior is unchanged until it is set to 0; confirm snapshot selection works at 0.
- (c) Run compile + rank after each hourly fetch when delay is 0, with retry-with-rebase on push; ranking must keep the day's minimum price and not duplicate history points across multiple runs per day.
- (d) No extra Travelpayouts calls (reuses existing snapshots).
- (e) Every price keeps its "as of" time from the observation's `found_at`, never labeled "real-time" or "live".
- (f) Remove or reword copy that mentions a delayed free tier; update `CLAUDE.md`'s tier-split text.
- (g) Tests for snapshot selection at 0 and 24, multi-run-per-day history, and that setting the delay back to 24 restores old behavior exactly.

Do not flip the setting in production, trigger workflows, or make any "no delay" marketing claim until the change is verified live; marketing wording must be "same deals, same time as paid members", not "real-time". Done when: non-JFK origins show current-cycle data live, with the delay setting reversible.

### 72-75. PTO-Maxxed Fare Calendar (four tracks)

Added 2026-10-09 from the traffic-strategy session. Full spec, rules and per-track acceptance criteria: `claude_code_pto_fare_calendar_2026-10-09.md`. This section is the summary and the sequencing; the spec is the reference. **Nothing is built, and nothing merges before the Oct 16 go/no-go and Coby's say-so.** Why: a "PTO-maxxing" calendar story recurs yearly in national press and on social but nobody attaches real fares to it, and the 2027 planning window peaks November to January, so it has to be live by late October.

- **72, Track A (flag `ENABLE_PTO_CALENDAR`):** `src/ptoCalendar.js` (pure: federal holidays with OPM observed dates, bridge opportunities, a deterministic optimizer, trip-length buckets), `content/pto_destination_fit.json` (minimum days off per destination; Coby reviews), server-rendered `/time-off` and `/time-off/<origin>` for the 15 US origins (TLV gets none), `.ics` download, share card via the existing `/og/` renderer, capture through `/api/signup` with `source: 'pto'`. Works with no fare data. Off: every `/time-off*` path is 404.
- **73, Track B (flag `ENABLE_PTO_FARES`):** a daily GitHub Actions fetch (proposed `47 4 * * *`, off-peak) of the lowest fare for each window and fitting destination into `sparkfare_pto_window_prices.json`; fares shown "as of" with an honest empty state ("No fare seen yet"), no badges or percentages until a window has the history `dealQuality` needs. Travelpayouts' data is a cache of real searches, so far-off windows will often have no price; the spec's Track 0 dry run sets the hit rate and the fallback wording.
- **74, Track C (flag `ENABLE_PTO_WATCH`):** migration `0019_pto_window_watches.sql`, `POST /api/pto-watch` (email only, no account, max 10 watches per user), signed HMAC cancel links (`GET` confirms without changing state, `POST` deletes), a checker `checkPtoWindowWatches(env)` that rides the existing 08:00 UTC Worker cron (failure-isolated, no new Cron Trigger), at most one PTO email per user per day. A watch is deleted 30 days after its window ends; sentence added to `privacy.html`. **Built 2026-10-09 on branch `pto-track-c`**; tests pass; owner applies migration `0019` in production before merge.
- **75, Track D:** digest promo block (`ENABLE_PTO_DIGEST_BLOCK`), weekly social post, a manual Pinterest pin route, a press note from the Track A data, a blog post, a nav link. Each item flagged or owner-run.

**Timing:** build and open PRs now (preview URLs only); go/no-go Oct 16; launch day Oct 17 merges nothing from this spec; **merge A Mon Oct 19, B Tue Oct 20, apply migration `0019` then merge C Wed Oct 21; flip the fare and watch flags by Mon Oct 26** once 3+ days of window data look right. Thanksgiving 2026 (Thu Nov 26) watches are only useful if live by about Oct 26. Plus Week 1 (Mon Nov 16) and Away Move 3 (`/leave`, step 55) keep priority; if Track C slips, it slips.

**Stop rules (read from the weekly standup):** under 100 `/time-off` views in week 2 with Track D items 1 and 2 live, check indexing before building more; `pto` signups per view under half the homepage's after 500 views, change the capture placement; over 80% of windows within 60 days with no fare after 7 days of Track B data, switch to the 2-day-flexibility wording; PTO watch complaints above 0.1%, switch `ENABLE_PTO_WATCH` off.

**Checked against the repo on 2026-10-09 (spec rule 11):** steps 72 to 75 are free (highest was 71); migration `0019` is the next number (`0018` exists); the Worker has 4 Cron Triggers, so a fifth would use the last free slot, which the spec avoids; `/time-off` is unused; every source and test file the spec names exists. **Differences to settle before building:** (1) the spec cites `claude/travelpayouts_data_api_terms_confirmation_2026-09-23.md`; that file is not in the repo (the `claude/*.md` docs live in the Claude project, see the note under Phase 0), so Track B's use of a different Data API endpoint should be re-confirmed with Travelpayouts support, not assumed from that ticket; (2) the spec names the script `Phase 21 PTO Window Fetch.py`, but "Phase 21" is already the workplan's Pressure Test Remediation phase, so pick the script prefix deliberately; (3) the Plus design doc's own labels "step 22b" and "step 22c" (decouple the paid tier from the hourly file; waitlist) clashed with the roadmap rows 22b and 22c (Plus email templates; collateral); **fixed 2026-10-09: renamed 22d and 22e and added as rows**; (4) Track D's digest block must not interact with skip-if-unchanged: that logic compares deals only, so a promo block neither triggers nor prevents a send, which also means a subscriber skipped on an unchanged day does not see the block that day.

**Update 2026-10-09 (owner): the spec is approved and the pre-launch merge hold is lifted.** Work that ships behind a flag that defaults to off now merges as soon as it passes tests; the owner still decides when each flag is turned on, when a migration is applied to production, and approves anything that sends email or posts publicly. **Track 0 done:** the federal holiday table for 2026 to 2028 matches OPM's published observed dates exactly (the tests pin them); `/time-off` was unused; the reuse table checks out. **Open from Track 0:** the Travelpayouts per-date endpoint could not be confirmed from the docs reachable here (the support article returns 403; the public reference lists only `/v1/prices/cheap` with `depart_date` and `return_date`, plus `/v2/prices/*`), so Track B's dry run tests `GET /aviasales/v3/prices_for_dates` against the documented `/v1/prices/cheap` fallback and reports which works. **Track A built and merged 2026-10-09 (flag off, not yet seen live):** `src/ptoCalendar.js`, `src/ptoPages.js`, `content/pto_destination_fit.json`, the `/time-off*` routes and `/og/time-off/<origin>.png`, `.ics`, events, sitemap entries and a standup line. Deliberate differences from the spec: the optimizer is exact (dynamic programming over non-overlapping blocks, maximizing days off, then fewest PTO days used) instead of greedy best-ratio-first, which can leave PTO unused or pick a block that rules out a better pair; a free block counts from 3 days and a block that needs PTO from 4; the holiday form is a plain GET that redirects to a compact `?budget=&h=` URL, so no JavaScript is needed to recompute the plan (the page only uses JavaScript for the share button and the email form); destinations link to the `/data/` route pages, which exist for every origin and destination, not the `/flight/` pages, which return 404 for thin routes. Not done yet in Track A: the nav link and homepage line (Track D item 6, flag-conditional), the blog post, and the live check of the page on production once the flag is on.

**Track B built (2026-10-09):** `scripts/pto-windows.mjs` picks the windows to price from the same `src/ptoCalendar.js` the page uses (the best block per holiday for 0 to 3 PTO days plus every block the optimizer picks for budgets 3 to 30, starting 3 to 120 days out, nearest first; 13 windows on Oct 12); `Phase 22 PTO Window Fetch (Step 73).py` prices them per US origin and fitting destination (8 per window, cheapest known median first, hard cap 800 calls, 2 seconds apart, never overwrites a stored fare on an API error, keeps an earlier fare as "last seen", keeps 60 days of observations, drops windows 30 days after they end); `.github/workflows/pto-window-fetch.yml` runs it at `47 4 * * *` and commits only `sparkfare_pto_window_prices.json`; a manual run **defaults to a dry run** that samples 3 origins x 6 windows x 8 destinations on each endpoint and writes a hit-rate report to the run summary. The page shows fares only with `ENABLE_PTO_FARES` on: "from $X, seen <date> for these dates" with a sponsored link through `/out/aviasales?...&src=pto`, "last seen" without a link after 3 days, "No fare seen yet for these dates" otherwise, the standard commission disclosure, and no badges or percentages. Repository variables `PTO_ENDPOINT` (`v3` or `v1`) and `PTO_FLEX_DAYS` (`0` or `2`) switch endpoint or fall back to 2-day flexibility without a code change. **The script is named Phase 22, not Phase 21** (21 is the workplan's Pressure Test Remediation). The concurrency group is the workflow's own (`pto-window-fetch`), not shared with the other fetch workflows, because a shared group lets GitHub drop their queued runs; the rebase-and-retry push covers a collision. **Still to do:** run the dry run (Actions, manual, mode `dry_run`), read the hit rate, set `PTO_ENDPOINT` / `PTO_FLEX_DAYS` if needed, then let the schedule collect; flip `ENABLE_PTO_FARES` once 3 or more days of window data look right.

Owner actions: approve the spec and review `content/pto_destination_fit.json`; approve the Track 0 dry run (it uses Travelpayouts quota) and read its hit rate; after the go, approve merges and flip flags; apply `0019` before the Track C merge; approve the first social post, connect Pinterest, send the press note.

---

## Phase 3 — Acquisition engines (proposed Nov 1 – Dec 15, 2026; was Oct 17 – Nov 30. Dates re-baselined 2026-10-07, pending Coby's confirmation; see Phase 2)

**Goal:** traffic that runs without Coby doing outreach. **Exit gate:** 2,500 subscribers or
10,000 monthly sessions.

| # | Step | Status | Depends on |
|---|---|---|---|
| 23 | T8-MVP — minimal founding-member paid tier (Stripe), ~$29/yr. **Moved here from Phase 2 on 2026-10-07 (proposal).** | ⏸️ Gated | 22 approved; step 17 handled; about two weeks of real post-launch data (about Oct 30); the design doc's section 10 decisions |
| 23a | Household sharing (from the 2026-10-07 Phase 1 guide). Access level undecided: the guide says read-only in one place, read-write in another | ⏸️ Proposed, not approved | 23 live; needs a defined shared object (there is no `alerts` table) |
| 27 | T13 — secondary flight-data source (de-risking) | ⚪ Not started | T1 (Phase 0 step 5)'s `dealQuality` interface — parallel-safe, can start anytime after |
| 28 | T2b — automated pre-departure Away Mode sequence | 🟢 Built (2026-10-09) | 20 |
| 29 | T5 — programmatic route pages, dual-pillar (flight deal + Away Mode module equal-weight) | 🟠 Partly built (pages exist; content-quality pass and dual-pillar module still needed) | Phase 0 steps 1, 10; Travelpayouts ToS — **already cleared**, 2026-09-23 confirmation on record |
| 30 | T5b — self-serve display ads on route pages | ⚪ Not started | 29 |
| 31 | T5c — auto-expanding route-page content (auto-promote newly-eligible pages) | ⚪ Not started | 29 |
| 32 | T3 — referral loop v1 (feature-flagged) | ⚪ Not started (spec only; flag off) | T0 (Phase 0 step 6), T7 (Phase 0 step 7), reward tiers approved |
| 33 | T6 — embeddable widget, self-serve/backlink-only, no revenue-share | ⚪ Not started | 29; Travelpayouts ToS — cleared |
| 34 | T7b — web push notification channel | ⚪ Not started | Phase 0 step 7 |
| 35 | Pinterest auto-posting of share images | ⚪ Not started | Phase 0 step 8 |
| 36 | 12 city hub pages ("Cheap flights from X") | ⚪ Not started | 29 |
| 37 | T9 — Awin/ShareASale advertiser listing (Sparkfare as the promoted product) | ⏸️ Gated (owner/business action) | 23 live |
| 38 | T12 — MCP / agentic-AI data surface | ⚪ Not started | 33's public JSON endpoint |
| 39 | Monthly "Sparkfare Index" report with embeddable charts (moved here from Phase 4 on 2026-10-03; see 54) | ⚪ Not started | — |
| 53 | Group Watch ("Meet me there") | ⚪ Not started | 49, 50, 7 |
| 54 | Honest Deal Report: first edition, embeddable charts, press/lead-magnet package (amends 39). The PTO press note (step 75) is its first data-led release candidate | ⚪ Not started | 1 (about 30 clean days), 5 |
| 55 | Pre-trip checklist generator (Away Mode front door, Pinterest-pinnable). **Build re-scoped 2026-10-08 as Away Move 3: the `/leave` page behind `ENABLE_LEAVE_READY`; must be mergeable before Plus Week 1 (Mon Nov 16)** | ⚪ Not started | 20, 16; feeds 28 |
| 56 | "vs" comparison pages. Separate spec; the Going free-tier comparison (Going's Limited plan has no international deals) is its first page | ⚪ Not started | none (light legal read first) |
| 57 | AI-assistant listings: ChatGPT app + Claude connector (amends 38) | ⚪ Not started | public JSON/MCP surface; privacy.html updated |
| 59 | Spark Check stamp + hotlinkable price-history chart (extends 49) | ⚪ Not started | 49, 5 |
| 60 | Open scoring code + "report a wrong deal" | ⚪ Not started | 5 |
| 61 | Sparks rating + "No sparks today" note | ⚪ Not started | 5, 21, 7 |
| 62 | Public track record page | ⚪ Not started | 1 (4+ weeks of clean data), 5 |
| 69 | Away Move 1: reframe the lifecycle emails and the Away page lead around a named cue (copy only, no schema). Slice A, ships live after Oct 17 | ⚪ Not started | Oct 16 go |
| 70 | Away Move 2: one-tap trip self-report (migration `0016`, flag `ENABLE_TRIP_SELF_REPORT`). Slice B, from Nov 1 | ⚪ Not started | `0016` applied in production |
| 71 | Away Move 4: four trust posts (water, card benefits, pets, trip-protection clock). Slice A, from Oct 17 | ⚪ Not started | Oct 16 go |

Full specs for 27–34: `antigravity_build_instructions_v2_gtm_aligned_2026-09-22.md` (T13, T2b,
T5b, T5c, T7b) and `antigravity_build_instructions_prioritized_2026-09-22.md` (T3, T6 — unchanged
from that doc). Full spec for 38 (T12): `antigravity_build_instructions_v2_gtm_aligned_2026-09-22.md`.
37 (T9): same doc, non-code business setup — commission rate on the T8-MVP paid-signup event
(step 23), coordinate creative assets with Creative Marketing, confirm the tracking postback fires
off the Stripe webhook before going live broadly.

Note on 27 (T13): explicitly insurance against single-vendor dependency, not urgent — can run in
parallel with 29–33 rather than blocking them.

**Amendments 2026-10-03 to existing Phase 3 steps** (notes only; statuses unchanged):
- **32:** "faster alerts" is no longer a valid referral reward tier (see step 58); reward tiers must be re-approved without it.
- **35:** build against the shared renderer from step 51.
- **36:** start in parallel with 29 (not after); add origin x budget ("under $400") indexable sections; fold event/holiday content into 31/36.
- **38:** depends on the public JSON endpoint only, not the full widget; see 57.
- **39:** moved to Phase 3, see 54.

**Wording rule for every brand step (59-62):** claims are "a real drop against this route's own history", never "bookable now", "verified fare", or "real-time", because prices are cached and scans run every few hours. All new flags default OFF, the honesty rule applies, and no real posts or sends happen without asking.

### 53. Group Watch ("Meet me there")

Added 2026-10-03. Shareable page where 2-4 people enter home airports and see destinations cheap from all of them, each person's fare/dates/basis shown separately (no false exact-date matching), with alerts when the group's pick drops. Unsupported airports go to the step 50 waitlist. Done when: a 2-person group works live and the invite signs up the second person with a `source`.

### 54. Honest Deal Report (amends 39)

Added 2026-10-03. Moves the Sparkfare Index (39) to Phase 3. Public page, embeddable chart, monthly auto-generated edition. Content: share of routes that actually dropped meaningfully below the 30-day average, how long drops lasted, cheapest days. First edition early November after verifying about 30 clean days. Derived stats only, never raw cached prices (Travelpayouts approval does not cover licensing/resale). One-time owner pitch to a few travel/data journalists plus a data-story post; reuse as the lead magnet. Note: sparks (61) and the track record (62) can feed the report once live.

### 55. Pre-trip checklist generator

Added 2026-10-03. Inputs: trip length and type. Output: a personalized "before you leave" checklist using only live-status partners with standard disclosure. Email capture starts the pre-departure sequence (28). Pinnable graphics. Insurance partners stay blocked (19).

**Build spec set 2026-10-08 (Away Move 3).** Built as a new `/leave` page, not inside `/away-mode`, which already carries the 16-question "Customize your trip" panel and is a P0 launch surface. Gated by `ENABLE_LEAVE_READY` (default off, 404 when off, mirroring `/check`'s `ENABLE_PRICE_CHECK`). Six yes/no/skip questions; a pure `buildLeaveReadyPlan(answers, partners)` returns "done" and "still open" items, free official route first, partner links only for `live` registry entries, no percentage score and no safety claim ("3 things left to sort" wording). Reuses `/api/signup` for email capture; `privacy.html` updated before the flag goes on. Full detail: `claude_code_away_mode_four_moves_2026-10-08.md`.

### 56. "vs" comparison pages

Added 2026-10-03. 3-4 factual pages vs named competitors. Every competitor fact has a source and a "checked on" date. Light legal read first.

### 57. AI-assistant listings: ChatGPT app + Claude connector (amends 38)

Added 2026-10-03. Decouple the MCP/agent surface from the widget (33), submit to the ChatGPT app directory and Claude's connector directory. Requires a privacy policy (`privacy.html` updated first); link-outs only, so results point to the permalink with disclosure.

### 59. Spark Check stamp + hotlinkable price-history chart (extends 49)

Added 2026-10-03. Each /check result gets a stable result page whose parameters are signed, so the page recomputes the verdict live and the shared image cannot be altered. Stamp image (also the Open Graph card) shows route, "X% below/above the 30-day average of the lowest fares we cached (N days, as of <time>)", and the basis; under the T1 minimum it shows "not enough history" with no percentage. Add a hotlinkable branded price-history chart image per route (`/chart/:origin/:dest`) with a copy-link/embed button on deal cards and result pages. Reddit does not render hotlinked images in comments, so rely on link-preview cards there and on direct embeds in forums. Individual result pages are noindex; rate-limit creation. Events: `stamp_created`, `stamp_view`, `chart_view` (with referrer host). Flag `ENABLE_SPARK_STAMP`. Done when: a stamp and a chart render correctly live and in a link-preview test, a tampered URL is rejected, and events show in /admin/metrics.

### 60. Open scoring code + "report a wrong deal"

Added 2026-10-03. (a) Extract the pure scoring/eligibility functions (`classify_destination`, `dealQuality`) with their tests, constants and the methodology doc into a standalone, secret-free, data-free module prepared in a separate directory or branch. Prepare it only: do NOT publish or make any repo public, and ask the owner to approve the license and the release. (b) "Report a wrong deal" button on deal cards: POST endpoint, per-IP/anon rate limit, one report per user per deal, optional reason. When N distinct reports (configurable) arrive within a window, the card is labeled "disputed - being re-checked" and excluded from share images, feeds and stamps until the next data run re-evaluates it; it clears automatically if the deal still passes `dealQuality`. No manual review needed. Events: `deal_reported`, `deal_disputed`. Flag `ENABLE_DEAL_REPORTS`. Done when: a test deal can be reported, auto-disputed and auto-cleared in staging, and the extraction builds and passes its tests on its own.

### 61. Sparks rating + "No sparks today" note

Added 2026-10-03. (a) Sparks: show 1-5 sparks only on cards with status `deal` that pass `dealQuality`. The rating is defined by how rare the drop is against the route's own history (not raw percent, since cluster thresholds differ: 25% vs 15%), documented in `sparkfare_ranking_methodology.md` with a changelog line; no rating on `priced_no_deal`, `featured` or `insufficient_history` cards. (b) "No sparks today" note: a short, on-brand message saying no deal cleared the bar for the subscriber's origin and the largest drop seen, plus a "No sparks today" banner on the site. Rate-limited to at most one per subscriber per week, counts toward the subscriber's frequency preference, respects T7 suppression, and is a separate message type: step 21's skip-if-unchanged rule stays as is. Flags `ENABLE_SPARKS` and `ENABLE_NO_SPARKS_NOTE`. Done when: ratings appear only on eligible deals live, and a test send produces the note with correct headers and respects suppression.

### 62. Public track record page

Added 2026-10-03. `/track-record`, auto-generated from stored data: number of deals flagged (status `deal` and `dealQuality`-eligible), how long each stayed below its threshold in our data (state the measurement resolution; actual scan cadence has been 3-5 hours), share later disputed or no longer eligible, and the misses. Wording is "stayed low in our data", never "was bookable". Publish only after at least 4 weeks of clean data (step 1 verified) and owner approval of the first publish; honest numbers even if unflattering. Link the methodology. Flag `ENABLE_TRACK_RECORD`. Done when: the page's counts equal a direct query of stored data (tested) and carry a data window and as-of time.

### 69. Away Move 1: reframe lifecycle emails and the Away page lead

Added 2026-10-08. Copy only, no schema. Replace generic nudges in `sendStressValveEmail`, `sendDepartureBriefingEmail` and `sendDepartingSoonEmail` (check `sendPreDepartureSequenceEmail` too) with one home-first line that names a cue ("when X, then Y"), above the partner list and with no affiliate link. Disclosure order, partner lists and unsubscribe footer unchanged. `away-mode.html` leads with the home and pet worries before the vendor list; check at 375px. No implied results ("protected", "secured"), no insurance advice. Ships live, no flag, but only after Oct 17. Done when `npm run check:copy` and `npm test` pass and a `scripts/preview-email.mjs` render of each email is attached to the PR. Spec: `claude_code_away_mode_four_moves_2026-10-08.md`. Dated Slice A (from Oct 17), earlier than Phase 3's Nov 1 start.

### 70. Away Move 2: one-tap trip self-report

Added 2026-10-08. Adds a signal when Travelpayouts' booked status is slow or missing, and lets later emails skip people who are not going. **Do not write it into `trips.status`**: reconciliation only updates rows still `clicked`, and the booked-confirmation email hangs off that update. Two PRs: (1) migration `0016_trip_self_report.sql` (`booking_self_report`, `self_reported_at`, with a rollback note), applied by the owner first; (2) code: HMAC trip-tap tokens with their own domain prefix (an unsubscribe token can never validate as one), `GET /api/trip-status` as a noindex confirm page that never changes state, `POST` that writes the two columns and logs `trip_self_report` (bots ignored), a "Did this trip happen?" line in the stress-valve email, suppression of `not_going` trips in the departure-briefing, departing-soon and pre-departure alert queries, and `/admin/metrics` counts. Flag `ENABLE_TRIP_SELF_REPORT`, default off. Slice B, from Nov 1. Spec: `claude_code_away_mode_four_moves_2026-10-08.md`.

### 71. Away Move 4: four trust posts

Added 2026-10-08. Four hand-written posts on the shared blog template (copy `away-mode-checklist.html`'s pattern), each added to `blog/index.html` and `sitemap.xml`, each with a "Last reviewed" date and a Sources list: water damage versus burglary (PEMCO poll via Insurance Business; say the poll was run by a Pacific Northwest insurer), what a credit card may already cover (read your own benefits guide; no specific card terms), cannot go because of the dog (options compared, hand-off checklist, no alarm codes, no Rover link), and the clock on trip protection (education only, no insurer links, no plan advice; ROADMAP step 19 stays open). No affiliate links by default; the Amazon Associates hold is unchanged. Slice A, from Oct 17. Spec: `claude_code_away_mode_four_moves_2026-10-08.md`.

---

## Phase 4 — Scale (proposed mid-Dec 2026 – mid-Apr 2027; was Dec 2026 – Mar 2027. Re-baselined 2026-10-07, pending Coby's confirmation)

**Exit gate:** 10,000 subscribers.

| # | Step | Status | Depends on |
|---|---|---|---|
| 39 | Moved to Phase 3 on 2026-10-03 (see step 54) | — | — |
| 40 | Post-booking price-drop watch ("Booked it? We'll watch it.") | ⚪ Not started | — |
| 41 | Reapply to Impact.com and CJ Affiliate once traffic clears their bar | ⏸️ Gated (owner action) | Traffic threshold, TBD by owner |
| 42 | Full paid tier, beyond the founding-member MVP | ⏸️ Gated | 23 |
| 43 | T10 — white-label config layer ("Sparkfare Engine") | ⚪ Not started | 33 (widget), 20 (registry), 23 (billing) all live |
| 44 | T11 — short-form video generator | ⚪ Not started | T1 (Phase 0 step 5), T4 (Phase 0 step 8) |
| 45 | T14 — historical data-licensing feasibility (doc only, speculative) | ⏸️ Gated | Travelpayouts ToS resolved (**cleared**), 27 (T13) live, enough accumulated history |
| 63 | Plus v2 candidates from the 2026-10-07 implementation guide: household sharing, re-run and seasonal re-run of a saved trip, the "while I'm gone" sitter page, metered MCP calls | ⏸️ Proposed, not approved; each needs its own design (the sitter page stores third parties' personal data) | 23 live and measured; the design doc's section 10 decisions |
| 64 | Churn tracking and re-engagement email (alert on a count or rate, "we miss you" with a Stripe coupon). The guide's thresholds conflict (5% vs 50% a month) and are noise at small numbers | ⏸️ Proposed, not approved | 23 live plus 60 days of data |
| 65 | Weekly standup brief: a weekly owner email (signups, `/check` use, email opens, clicks, flagged problems). **Built 2026-10-07**, rides the Monday 09:00 UTC cron, flag `ENABLE_WEEKLY_STANDUP`; first scheduled send Mon Oct 12 | 🟡 Built, delivery unverified | — |
| 66 | Provider directory (hotel, car, eSIM) with self-serve booking partners | ⏸️ Proposed, not approved | 20 registry (largely built); Travelpayouts terms; partner agreement |
| 67 | Sponsorships and a self-serve display-ad network (overlaps steps 26 and 30; keep one mechanism) | ⏸️ Proposed, not approved | 29 route pages live plus traffic that clears the network's bar |
| 68 | B2B2C partnerships (Wise, Deel, SafetyWing, corporate travel platforms) | ⏸️ Proposed, not approved; owner-led | 43 white-label foundation plus a pilot partner |

Full specs: `antigravity_build_instructions_v2_gtm_aligned_2026-09-22.md` (T10, T11, T12, T14).

---

## Phase 5 — Bets (Q2 2027+; follows Phase 4's exit gate rather than a date)

Chosen from Phase 4 data. Candidates, not commitments — each needs its own gate before it's
scheduled:

| # | Step |
|---|---|
| 46 | Browser extension overlay on Google Flights |
| 47 | Self-serve white-label SaaS, full version (beyond step 43's config layer) |
| 48 | Historical data-licensing, execution (if step 45 greenlights) |

---

## Explicitly deferred / non-goals — and why

- **White-label SaaS (43/47), short-form video (44), data licensing (45/48)** — real ideas, but
  each risks pulling in per-customer support or sales work that breaks the passive-ops rule, or
  (data licensing) is genuinely speculative for a business this size. Revisit only after Phase 4's
  gate, as no-touch products.
- **Rover as an Away Mode partner** — declined via Rakuten Advertising 2026-10-09 (no traffic yet; soft decline); do not add a link under any circumstance until
  a real, approved tracking link exists.
- **Cash or physical-goods referral rewards** — never. Feature rewards only (extra origin airport,
  early access, founding-member badge). "Faster alerts" was removed from this list on 2026-10-03 (see step 58); reward tiers must be re-approved without it.
- **Direct-sold ad sponsorships** — avoid; this reintroduces manual sales labor the whole plan is
  built to exclude. Self-serve ad networks only (step 30).
- **Bespoke per-tenant feature requests under the white-label layer (43)** — one configurable
  product, not custom development per customer.
- **Telegram channels/bot, Discord/Slack bot, X auto-posting (per-link API cost), WhatsApp/SMS alerts
  (recurring cost), a daily fare game, and "booked it" as an acquisition lever** — deferred
  2026-10-03; "booked it" stays at step 40.
- **Old Q4 2026–Q3 2027 roadmap** (`docs/archive/Sparkfare Roadmap Q4 2026-Q3 2027.md`) —
  superseded 2026-09-23; its items are folded into the phases above on the dates above, not its
  original quarterly framing.

---

## Plus and monetization build schedule (from the 2026-10-07 Phase 1 guide, re-baselined 2026-10-08)

**Status: proposed, nothing started.** Source: the complete "Phase 1 Implementation Guide" (2026-10-07), reconciled with the repo in `phase1_guide_reconciliation_2026-10-07.md`. This section records the guide's schedule, gates, rework rules and failure modes against the real roadmap. It does not approve any build. **Nothing here starts until** Phase 0 passes the Oct 16 go/no-go, the owner approves `plus_tier_design_2026-10-07.md` and its section 10 decisions (step 22), and step 17 is handled. If the design narrows the scope (it proposes a narrower v1 than the guide), the schedule below shrinks with it.

**Re-baseline (Coby, 2026-10-08).** The guide assumed launch on Oct 2 and a Week 1 start of Nov 4, 33 days after launch. Launch is now Oct 17, so Week 1 is **Mon Nov 16** (30 days after launch, which also gives the roughly two weeks of post-launch data that step 23 needs, about Oct 30). Every guide date moved by +12 days. The calendar dates below are derived, not individually confirmed. Dec 24 to Jan 1 is holiday slack and has no scheduled work.

| Window | Guide track | Roadmap step | Notes from the reconciliation |
|---|---|---|---|
| Weeks 1–2 (Nov 16–29) | Stripe, entitlements | 23 | Webhook is the only writer of the tier. Table and flag names are settled by the design doc, not the guide (`ENABLE_PLUS` vs `ENABLE_STRIPE_BILLING`). |
| Weeks 1–2 | Email T7 completion | 7 | Mostly built already (`sendEmailWithGuard`, suppression, signed unsubscribe, webhook, breaker). The guide's `bounce_log` and mailto-only header would duplicate or weaken it; only the open items under step 7 remain. |
| Weeks 1–2 | Affiliate registry | 20 | Built (14 live partners, `partners` table, `/out/<slug>`). Remaining work is the parity test and re-audit. |
| Weeks 1–2 | Household schema, `/plus` page, Plus emails, collateral | 23a, 22a, 22b, 22c | Household sharing has no defined shared object (there is no `alerts` table) and its access level is undecided. Plus marketing waits for step 22 approval. |
| Weeks 2–4 (Nov 23–Dec 13) | Plus features, Awin advertiser setup | 23, 37 | Awin pixel in the guide uses CheapOair's merchant id (11564); do not reuse it. Step 37 needs step 23 live. |
| Weeks 3–6 (Nov 30–Dec 27) | Sitter link, email scheduling, dual-pillar route pages, MCP foundation | 63, 21, 29, 38 | The sitter page stores third parties' personal data and needs its own design. MCP rate limiting needs a KV binding that does not exist. |
| Weeks 7–8 (Dec 28–Jan 10) | White-label foundation | 43 (Phase 4, gated) | Clerk's production instance is bound to `sparkfare.com`; partner domains need satellite or allowed-origin setup the guide's hours do not cover. Needs a legal read first. |
| Weeks 9–12 (Jan 11–Feb 7) | Analytics dashboard, churn monitoring, weekly standup | 64, 65 | Step 65 is already built (counts only). Daily active users and MRR cannot be computed from the `events` table as it stands, and the guide's SQL is Postgres. |

**Month 1 gate: Fri Dec 11** (guide: Nov 30, end of Week 4). Owner go/no-go. Five checks: (1) Stripe webhook live with no failed events; (2) at least 1 to 2 Plus signups if the list is over 1,000; (3) Awin advertiser account created and pixel firing; (4) code and `partners` table in 100% parity; (5) no bounce spike and suppression working. All 5 green: continue. 4 green: continue and watch the failing one. 3 or fewer: pause and debug; if no-go, reschedule the next block four weeks later. Checks 4 and 5 can be measured today; 1 to 3 cannot until step 23 exists.

**Month 3 gate: Fri Feb 12** (guide: Jan 30). Owner scale-or-iterate decision. Five checks: (1) Plus adoption at least 0.5% of the email list; (2) at least 5 travel-blogger affiliate signups; (3) white-label pilot partner with at least 50 users; (4) at least 5% of Plus users create a sitter link; (5) churn under 5% a month. All 5 green: scale (3 to 5 white-label partners, 20+ bloggers, MCP public beta). 4 green: scale and fix the failing one in parallel. 3 or fewer: iterate with one-week tests before scaling. Checks 3 and 4 only apply if steps 43 and 63 are actually built; drop them from the gate if the owner leaves those out of v1. Both thresholds are the guide's and are unvalidated at zero baseline traffic; revisit once real numbers exist.

**Rework-avoidance rules (adopted as build rules for every step above):**
1. One entitlements source. Plus is decided in one place (the design doc proposes `subscriptions` and `stripe_events`, with the webhook as the only writer of the tier). Every feature reads it; nothing duplicates the check.
2. Email guardrails before any new send. Every new email path (re-run, scheduled digest, re-engagement) goes through `sendEmailWithGuard()` (suppression, headers, breaker). Nothing sends around it.
3. One partner source. Away Mode, the disclosure page, emails and any recruiter or white-label surface read the `partners` table; keep the parity test.
4. Flag dependencies, default off: billing needs email guardrails complete; Plus features need billing on; sitter link needs Plus features on; white-label needs billing and a configured pilot. Flip in staging first and **never more than one flag per deploy**. A merge to `main` auto-deploys, so apply any needed migration to production before merging code that uses it.
5. Migrations: next file is `0016`, not the guide's #101 to #140. Check for collisions, keep each backward-compatible with a rollback note.
6. No manual per-partner reconciliation (passive-ops rule): the Awin and white-label commission tracks must be automated or flagged, not built as a monthly manual job.

**Failure modes and planned responses (from the guide):**
- **Plus conversion under 0.2% by the Month 1 gate.** Likely cause: price or no traffic. Response: do not A/B test; the guide's pivot is a one-week $9/month offer, and if it lifts conversion by more than 50% drop the $29 price, otherwise treat it as a product issue and put effort into free-tier growth. The design doc proposes one capped founding price, so a monthly plan is an owner decision to make there first.
- **No Awin or blogger signups by Month 1.** Likely cause: weak outreach or the model does not fit. Response: ask existing partners (SafetyWing, Bounce) about co-promotion; keep the affiliate model only if that brings 10 or more signups, otherwise lean on organic and the data surfaces. This is outreach work and conflicts with the passive-ops rule, so any version of it needs an explicit owner decision.
- **Stripe webhook fails or churn is high.** Check the Stripe event log, re-test the webhook in staging, redeploy with corrected config, and replay failed events to backfill entitlements. Needs a `stripe_events` table so replay is possible.

---

## Decision gates carried over

| Gate | Rule |
|---|---|
| Un-defer Phase 14 / scale the paid tier (step 42) | Only after T0 data shows a stable engaged cohort (click and return-visit rates, not opens alone), and Seller of Travel (step 17) is resolved before any broad paid-tier marketing push. |
| Double down on Away Mode | If partner revenue per active subscriber (from step 20's data) exceeds flight-affiliate revenue per active subscriber for a full quarter. |
| Keep referral loop (32) | Review at 90 days: if referral share of new signups is under 15%, redesign rewards; if fraud rejections exceed a set share, tighten rules before scaling. |
| Keep Rare Find / share images | If any publicly shared claim is found wrong or unbookable, suspend the feature flag and review T1 (step 5) thresholds. |
| Programmatic pages (29) | If indexable pages receive no impressions after a reasonable indexing period, audit thin-content risk before adding more routes. |
| Plus build, Month 1 (Dec 11) | Five checks and thresholds in "Plus and monetization build schedule" above. All green: continue; 4: continue and watch; 3 or fewer: pause and debug. Owner go/no-go. |
| Plus build, Month 3 (Feb 12) | Five checks in the same section. All green: scale; 4: scale and fix one; 3 or fewer: iterate with one-week tests first. |

---

## Change log

Every change to the phases, steps, or gates above is its own small, docs-only commit (or part of
the PR that completes the step), citing real evidence in the diff itself — see "Keeping this file
honest" near the top. Don't edit this file silently. Dated decisions are also appended to
`state_DECISION_LOG.md` (created 2026-10-03); `CLAUDE.md`'s running log covers everything earlier.)

---

## Source documents folded into this plan

These are superseded as standalone build plans — don't paste them into Claude Code as separate
work anymore. **None of the `claude/...md` paths below exist in this git repository** (confirmed
2026-10-01 — no `claude/` directory anywhere in the repo, any branch, or any worktree). They're
prior Claude Code/Antigravity session content kept in the Sparkfare Management Claude project on
claude.ai, referenced here by the name they had there — not files a future session can open with
`Read` or `grep`. This file's numbered steps say which doc and which task/section the full prompt
came from, for traceability, but treat the summary already folded into that step's own subsection
as the actual spec to build from; if more detail than that summary is genuinely needed, it has to
come from that Claude project directly, not this repo.

- `claude/antigravity_build_instructions_prioritized_2026-09-22.md` — T0/T1/T2/T3/T4/T5/T6/T7 full
  specs (steps 6, 5, 20, 32, 8, 29, 33, 7 above).
- `claude/antigravity_build_instructions_v2_gtm_aligned_2026-09-22.md` — T2b, T5b, T5c, T7b,
  T8-spec, T8-MVP, T9–T14 full specs (steps 27–45 above).
- `claude/antigravity_launch_readiness_instructions_2026-09-23.md` — sequencing this file's Phase 0
  now supersedes.
- `claude/antigravity_partner_registry_fix_2026-09-23.md` — step 2's full data/registry fix.
- `claude/antigravity_ui_fix_instructions_2026-09-23.md` — steps 2 (mobile), 5 (badge logic), 13,
  14's full task prompts.
- `claude/ui_audit_2026-09-23.md` — the source audit steps 5, 13, 14, 15, 16 are drawn from.
- `claude/antigravity_ui_bug_report_2026-09-23_round2.md` — step 14's Bug 1/2, step 9's Bug 4.
- `claude/claude_code_price_history_fix_instructions_2026-09-25.md` — step 1's full diagnose/fix.
- `claude/claude_code_nav_auth_and_partner_blurbs_instructions_2026-09-25.md` — steps 3, 4's full
  task prompts.
- `claude/claude_code_email_upgrade_instructions_2026-09-24.md` /
  `claude/antigravity_email_upgrade_instructions_2026-09-24.md` — step 21's full E0–E3 spec (the
  two docs are the same scope; use the Claude Code version, it's written for how this repo works).
- `claude/claude_code_launch_sprint_instructions_2026-09-26.md` and
  `claude/claude_code_roadmap_merge_launch_sprint_2026-09-26.md` — an earlier, narrower attempt at
  this same consolidation (Phase 0 only); fully subsumed by this file.
- `claude/gtm_deep_strategy_bold_pivots_2026-09-22.md`,
  `claude/research_pressure_test_and_antigravity_build_plan.md`,
  `claude/strategic_review_roadmap_2026-09-23.md` — strategic reasoning behind this plan's
  priorities; kept for background, not needed to execute any step above.

## Historical record

Everything that shipped before this consolidation (the original 09-05 through 09-24 foundational
build — Cloudflare Workers setup, Clerk auth, Resend email, the first affiliate approvals, the
original ranking pipeline, etc.) is recorded in the Master Workplan CSV
(`Sparkfare - MASTER WORKPLAN v3 (Fully Reconciled) - Untitled.csv`) and `CLAUDE.md`'s running log
(`state_DECISION_LOG.md` only starts on 2026-10-03; earlier history is in those two documents).
This file does not reproduce that history — it starts from current state forward.