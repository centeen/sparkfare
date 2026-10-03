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
neither exists in this git repository — confirmed 2026-10-01 while syncing this file's Phase 0
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
   to also update (see the note above `state_DECISION_LOG.md` doesn't exist).
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

Out of scope for this phase — do not touch, even opportunistically: anything from Phase 2 onward.

Live task tracking (not committed to the repo — changes too often): the Launch Control dashboard
at https://claude.ai/artifact/46pAzFwQZHoEb3jV74tPs8, linked from `state_SESSION_STATE.md`.

| # | Step | Status | Depends on |
|---|---|---|---|
| 1 | Deals for all 12 origins (history-key fix) | ✅ Done, confirmed live (2026-10-01 sync) | — |
| 2 | Away Mode partner list loads in production + mobile layout | ✅ Done, confirmed live (2026-10-03 verification) | — |
| 3 | Nav shows "Sign In" while the user is authenticated | ✅ Done, confirmed live (2026-10-01 sync) | — |
| 4 | Away Mode partner blurbs missing/out of sync across surfaces | ✅ Done, confirmed live (2026-10-01 sync) | — |
| 5 | Trend-badge logic contradicts its own section + honest price badges (`dealQuality`/T1) | 🟡 Built, verify (2026-10-01 sync) | — |
| 6 | Analytics events (T0) | ✅ Done, confirmed live (2026-10-01 sync) | — |
| 7 | Email deliverability: opt-in, unsubscribe headers, bounce handling (T7) | 🟡 Built, verify (2026-10-03 verification) | — |
| 8 | Share images and deal permalinks (T4) | ✅ Done, confirmed live (2026-10-01 sync) | — |
| 9 | Referrals (T3) — confirm flag stays OFF | ✅ Built, flag off | — |
| 10 | Route pages: real data or noindex (T5) | ✅ Done, confirmed live (2026-10-03 verification) | 1 |
| 11 | "Complete the trip" module (new revenue surface) | ✅ Done, confirmed live (2026-10-01 sync) | 2 |
| 12 | Revenue health monitor (new) | 🟡 Built, verify (2026-10-01 sync) | 1, 7 |
| 13 | Away Mode partner-list bugs: coming-soon position, dead Rover/pet-gear links, Timekettle + Parking Access wiring | ✅ Done, confirmed live (2026-10-01 sync) | 2 |
| 14 | UI grab-bag: sticky banner dismiss, homepage ordering, CTA button styling, tap targets, mobile sort/filter stacking, shared nav component, Skimlinks/SparkLoop-embed cleanup, `migrate.sql` asset leak, "12 airports" copy fix | ✅ Done, confirmed live (2026-10-03) | — |
| 15 | Custom 404 page | ✅ Done, confirmed live (2026-10-01 sync) | — |
| 16 | Affiliate disclosure: proximate placement (FTC finding) + `disclosure.html` staleness (missing Bounce, US Global Mail) | ✅ Done, confirmed live (2026-10-03); wording not legally reviewed | — |

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

### 9. Referrals (T3) — leave flag OFF

No action needed for launch — do not enable this flag. Confirm only that "flag off" truly means
zero visible change on the live site (this also closes UI-bug-report round 2's Bug 4: the
Referral Hub 404 is expected while the flag is off — confirm no live, reachable link points at it
while off; if one does, fix the link/gating, don't build the Hub early).

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
- "Create Watchlist" and "Browse All 480 Routes" render as plain bold links, not buttons; the
  "More" toggle on deal cards is 29×15px, well under a usable tap target (raise to ≥40×40px).
  **Audit 2026-09-26: still broken; root cause found.** Both CTAs are styled with `--spark` / `--ledger`
  (style-guide names) which `index.html` never defines (it uses `--text`, `--sage`, `--amber`), so the whole
  `background` / `border` declaration is invalid and they render as plain text. The "More" toggle measures
  31x17px. (`--spark` is gold, which the site reserves for deal signals; use the sage action colour.)
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
| 17 | Seller of Travel: attorney review of Sparkfare's actual model against CA/FL/HI/WA statutes | ⏸️ Open, unresolved | Step 23 (paid tier) and any active seed-audience/marketing push |
| 18 | Business entity formation (e.g. LLC) | ⏸️ Owner action, not yet done | Reduces personal liability regardless of #17's outcome; recommended same-week, not gated on anything |
| 19 | Insurance referral licensing | ⏸️ Open | Any insurance-category Away Mode partner going live |

Details: CA Bus. & Prof. Code §17550.1's broad "advertises that he or she can or may arrange"
language is broad enough to arguably reach a deal-aggregator model even without payment
processing — not resolved without a travel-industry attorney. Operator context on record: no
business entity formed yet (sole proprietor), user base nationwide with no state concentration.
Full analysis: `CLAUDE.md`, 2026-09-26 entries ("Compliance — Seller of Travel / insurance-referral
licensing").

---

## Phase 2 — Revenue on (originally Oct 3–16, 2026; not yet re-baselined after the launch moved to Oct 17 — gated on Phase 0's go/no-go passing)

**Goal:** first commissions and first paid dollar, without slipping into per-partner outreach.
**Exit gate:** 500 confirmed subscribers, at least one verified affiliate commission, 10+ founding
members.

| # | Step | Status | Depends on |
|---|---|---|---|
| 20 | T2 — Away Mode partner registry, disclosure, attribution | ⚪ Not started | Phase 0 step 6 (T0 events) |
| 21 | E0–E3 — Daily email upgrade + public archive | ⚪ Not started (E0 discovery) | Phase 0 steps 5, 7 |
| 22 | T8-spec — paid-tier design doc | ⏸️ Gated | Stable engaged-cohort signal in T0 data |
| 23 | T8-MVP — minimal founding-member paid tier (Stripe), ~$29/yr | ⏸️ Gated | 22 approved; step 17 (Seller of Travel) resolved before scaling this beyond a soft launch |
| 24 | SparkLoop resubmission | ⏸️ Gated | 21 (≥5 editions live at sparkfare.com/digest, including a weekly) |
| 25 | CheapOair secondary booking button ("Also check CheapOair") | ⏸️ Gated | Awin approval (applied 2026-09-23 to merchant 11564, awaiting response) |
| 26 | Display-ads exploration | ⏸️ Gated | Site clears 1,000 sessions/30 days (tracked here; folds into step 30 once route pages exist) |

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

### 22–23. T8-spec / T8-MVP — paid-tier design, then minimal founding-member tier

`T8-spec` full doc-only spec: `antigravity_build_instructions_v2_gtm_aligned_2026-09-22.md`. Not
gated on a fixed 8-week wait — introduce once T0 shows a stable core of engaged users (real
return-visit and click behavior, not just opens). `T8-MVP` (same doc): Stripe subscription,
webhook-driven entitlement, cancel flow — this is the same initiative as the "founding-member
$29/yr" line from the earlier roadmap summary; don't build two separate tiers.

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

---

## Phase 3 — Acquisition engines (originally Oct 17 – Nov 30, 2026; not yet re-baselined after the launch moved to Oct 17)

**Goal:** traffic that runs without Coby doing outreach. **Exit gate:** 2,500 subscribers or
10,000 monthly sessions.

| # | Step | Status | Depends on |
|---|---|---|---|
| 27 | T13 — secondary flight-data source (de-risking) | ⚪ Not started | T1 (Phase 0 step 5)'s `dealQuality` interface — parallel-safe, can start anytime after |
| 28 | T2b — automated pre-departure Away Mode sequence | ⚪ Not started | 20 |
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

Full specs for 27–34: `antigravity_build_instructions_v2_gtm_aligned_2026-09-22.md` (T13, T2b,
T5b, T5c, T7b) and `antigravity_build_instructions_prioritized_2026-09-22.md` (T3, T6 — unchanged
from that doc). Full spec for 38 (T12): `antigravity_build_instructions_v2_gtm_aligned_2026-09-22.md`.
37 (T9): same doc, non-code business setup — commission rate on the T8-MVP paid-signup event
(step 23), coordinate creative assets with Creative Marketing, confirm the tracking postback fires
off the Stripe webhook before going live broadly.

Note on 27 (T13): explicitly insurance against single-vendor dependency, not urgent — can run in
parallel with 29–33 rather than blocking them.

---

## Phase 4 — Scale (target Dec 2026 – Mar 2027)

**Exit gate:** 10,000 subscribers.

| # | Step | Status | Depends on |
|---|---|---|---|
| 39 | Monthly "Sparkfare Index" report with embeddable charts | ⚪ Not started | — |
| 40 | Post-booking price-drop watch ("Booked it? We'll watch it.") | ⚪ Not started | — |
| 41 | Reapply to Impact.com and CJ Affiliate once traffic clears their bar | ⏸️ Gated (owner action) | Traffic threshold, TBD by owner |
| 42 | Full paid tier, beyond the founding-member MVP | ⏸️ Gated | 23 |
| 43 | T10 — white-label config layer ("Sparkfare Engine") | ⚪ Not started | 33 (widget), 20 (registry), 23 (billing) all live |
| 44 | T11 — short-form video generator | ⚪ Not started | T1 (Phase 0 step 5), T4 (Phase 0 step 8) |
| 45 | T14 — historical data-licensing feasibility (doc only, speculative) | ⏸️ Gated | Travelpayouts ToS resolved (**cleared**), 27 (T13) live, enough accumulated history |

Full specs: `antigravity_build_instructions_v2_gtm_aligned_2026-09-22.md` (T10, T11, T12, T14).

---

## Phase 5 — Bets (Q2 2027+)

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
- **Rover as an Away Mode partner** — not approved; do not add a link under any circumstance until
  a real, approved tracking link exists.
- **Cash or physical-goods referral rewards** — never. Feature rewards only (extra origin airport,
  faster alerts, early access, founding-member badge).
- **Direct-sold ad sponsorships** — avoid; this reintroduces manual sales labor the whole plan is
  built to exclude. Self-serve ad networks only (step 30).
- **Bespoke per-tenant feature requests under the white-label layer (43)** — one configurable
  product, not custom development per customer.
- **Old Q4 2026–Q3 2027 roadmap** (`docs/archive/Sparkfare Roadmap Q4 2026-Q3 2027.md`) —
  superseded 2026-09-23; its items are folded into the phases above on the dates above, not its
  original quarterly framing.

---

## Decision gates carried over

| Gate | Rule |
|---|---|
| Un-defer Phase 14 / scale the paid tier (step 42) | Only after T0 data shows a stable engaged cohort (click and return-visit rates, not opens alone), and Seller of Travel (step 17) is resolved before any broad paid-tier marketing push. |
| Double down on Away Mode | If partner revenue per active subscriber (from step 20's data) exceeds flight-affiliate revenue per active subscriber for a full quarter. |
| Keep referral loop (32) | Review at 90 days: if referral share of new signups is under 15%, redesign rewards; if fraud rejections exceed a set share, tighten rules before scaling. |
| Keep Rare Find / share images | If any publicly shared claim is found wrong or unbookable, suspend the feature flag and review T1 (step 5) thresholds. |
| Programmatic pages (29) | If indexable pages receive no impressions after a reasonable indexing period, audit thin-content risk before adding more routes. |

---

## Change log

Every change to the phases, steps, or gates above is its own small, docs-only commit (or part of
the PR that completes the step), citing real evidence in the diff itself — see "Keeping this file
honest" near the top. Don't edit this file silently. (`state_DECISION_LOG.md` does not exist in
this repo; `CLAUDE.md`'s running log is the closest thing to it.)

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
(`state_DECISION_LOG.md` does not exist in this repo — see the note near the top of this file).
This file does not reproduce that history — it starts from current state forward.