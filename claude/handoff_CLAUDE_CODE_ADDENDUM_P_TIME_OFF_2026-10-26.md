# Addendum P: `/time-off` accuracy fixes and plan-first flow (G108, G109)

**For:** Claude Code (or Antigravity IDE; same rules). **From:** the Sparkfare Design Council Hub, Oct 26, 2026.
**Authority:** D-047 (accuracy fixes) and D-048 (plan-first flow), owner, Oct 26 09:30 Israel. Staged decisions: `claude/decision_staged_D-047_D-048_time_off_2026-10-26.md`.
**Deadlines:** P1 merged by **Fri Oct 30**. P2 merged by **Wed Nov 4** (last feature merge). **Cut rule:** if P2 is not merged and smoke-checked by Nov 4, it waits until Nov 9 or later; it never slips into Nov 5 (fix-only) or the freeze (Nov 6 18:00 ET to Nov 8).
**Lane:** merge train (approval pack, approval bound to head commit, deploy and smoke check, revert on failure; D-035). Not green-lane: both change visible text.
**Order:** P0 report → P1 → P2. One PR per package. Coordinate with M4 (2027 PTO hub, G76): do not break its per-airport printable, `.ics` or embed outputs.

---

## P0 · Read-only report (then stop for the owner)

1. Where `/time-off`, `/time-off/{iata}` and `/time-off/embed` are generated or rendered (files, functions, commit hash), and whether the two tables on `/time-off` and the airport-page planner share one bridge function.
2. Reproduce the four issues below on production and in code; name the line that causes each.
3. Current value of the window-fare flag (`ENABLE_PTO_FARES` or its successor) on main and in production.
4. How the homepage stores the selected origin today (URL parameter, localStorage key, cookie, or nothing).
5. What the share card and `.ics` export put in a URL or file today (any dates in a shareable URL must be reported; Priya's dates are never public).
6. Which analytics events and signup tags fire on `/time-off/{iata}` (plan start, `.ics`, share, `src=pto`).

---

## P1 · G108 · Accuracy fixes (by Fri Oct 30)

Fix each in the **shared bridge logic**, so `/time-off`, every `/time-off/{iata}` page and `/time-off/embed` (which other sites may already embed) all change together.

| Item | Problem on the live page (Oct 26) | Required result |
|---|---|---|
| 134 | "Day after Thanksgiving" has its own row saying "No long weekend with 3 or fewer PTO days" although it sits inside the Thanksgiving block | No standalone row for a holiday that falls inside another holiday's block. Show it as part of the Thanksgiving row (one short note: it is included when the employer gives it). The toggle still works on airport pages |
| 135 | "New Year's Day, Fri Dec 31, 2027" says no long weekend; the observed Friday plus the weekend is 3 days with no PTO | Correct the observed-date handling across the year boundary. Every holiday whose observed day touches a weekend shows at least the zero-PTO option |
| 136 | Jan 1, 2027 gets different options in the two tables (take Mon Jan 4 vs take Thu Dec 31) | Both tables come from one function and show the same options; where bridging works in both directions, show both |
| 137 | The "2027 long weekends" table says it uses "the standard federal holiday schedule" but lists only the seven default holidays | Reword to: "Using the seven holidays most private employers give. Choose your own set in the planner." Do not add the other federal holidays in this package |

**Tests:** unit tests for observed-date rules (Saturday → Friday, Sunday → Monday, year boundary) and for every default holiday from Nov 2026 through Dec 2027; a test that the two tables and the airport-page planner return identical options for the same holiday set.
**Acceptance:** the four items fixed on `/time-off`, three airport pages (SEA, ORD, MIA) and `/time-off/embed`; dates match the OPM calendar; copy checker passes; screenshots at 375 and 1366 px.

---

## P2 · G109 · Plan first, airport second (by Wed Nov 4)

**Goal:** a visitor sees their PTO plan without choosing an airport. The airport is asked only where it changes the answer: destinations that fit each window.

### `/time-off` (no airport)
- Render the full interactive planner here: PTO budget, holiday toggles (seven on by default, as today), plan headline, window cards, `.ics` export and share, exactly as on airport pages.
- Below the window cards and directly above "Destinations that fit", add **"Where do you fly from?"** with the 22 hubs. Choosing one loads destinations for that origin **without resetting** the budget or toggles.
- Prefill the airport only from the homepage's stored origin (P0 item 4), if one exists. Store only the airport code, in the browser, with reads and writes wrapped in try/catch. No cookie, no server storage, no IP or geolocation lookup.
- Intro copy: replace "Pick your home airport to see the plan and destinations that fit each window." with **"See the best plan for your PTO budget, then pick your airport for destinations that fit each window."**
- Without JavaScript, the existing static tables still show.

### `/time-off/{iata}` (unchanged in purpose)
- Keep every airport URL, its title, canonical and indexability. It opens with that airport preset and behaves as today. G76 printable and `.ics` outputs unchanged.
- Choosing a different airport on an airport page switches destinations in place (no reset), same as above.

### Must not change
Window fares stay off; the watch, route-page links, `src=pto` signup tag, disclosures and the FAQ text (except where P1 changed table copy). Never put a traveler's dates in a shareable URL (report from P0 item 5; if today's share already does, flag it to the Hub rather than changing it here).

### Measurement
Fire the existing plan-start event on `/time-off` as well, with a surface value that distinguishes it from airport pages (use the M1 / N5 tag table naming). Report the value used.

### Acceptance
- From `/time-off`, the plan is visible after setting a PTO budget, with no airport chosen (one interaction or none).
- Choosing an airport afterwards keeps the plan and shows destinations for that origin.
- Airport pages behave as before; Lighthouse/SEO checks unchanged on three airport pages.
- 44 px targets, visible focus, labeled controls, AA contrast; screenshots at 375, 1366 and 1440 px.
- Tests pass; copy checker passes.

---

## What to send back
P0 report; then for P1 and P2 the PR link, head commit, test output and screenshots in the next approval pack. Record progress in `docs/handoff/BUILD_STATE.md`.
