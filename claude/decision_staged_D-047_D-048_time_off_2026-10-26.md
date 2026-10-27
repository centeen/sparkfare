# D-047, D-048 and backlog rows G108, G109: `/time-off` (consult 17, Oct 26, 2026)

Staged until the Hub's next full rewrite of `state_DECISION_LOG.md` and `state_COUNCIL_BACKLOG.md`; read together with the other staged files. D-044 stays reserved for N5.

**Source:** owner message Oct 26 09:30 (Asia/Jerusalem): "1. yes 2. build it before nov 4", answering consult 17.
**Question (owner):** "Why is it necessary to know which airport? PTO is pretty much the same for all US citizens/residents."
**Question (neutral):** Should `/time-off` show the PTO plan before asking for a home airport, measured by `/time-off` plan starts and `src=pto` signups per 100 `/time-off` views (Priya, Dana-Flex)?
**Consult steps:** Frame; Ground (live `/time-off` fetched Oct 26; national tables show without an airport; the interactive plan and destinations live only on `/time-off/{iata}`; window fares off per Priya v3, ledger not re-checked); Convene (Priya H for plan-first; Dana M, wants the homepage origin remembered); UX; Guard PASS (non-attorney); Audit PASSED. Price and Score skipped (flow change, no revenue claim).

---

## 2026-10-26 · D-047 · Fix the four `/time-off` accuracy issues now

**Decision:** ADOPTED. Fix items 134 to 137 in the shared bridge logic so `/time-off`, airport pages and `/time-off/embed` change together; add observed-date tests. Merge by Fri Oct 30.
**Why:** G76 (PTO hub) and G77 (holiday fare report, press note Nov 11) send press and partners to this page; visible date errors break Priya's trust ("wrong holiday defaults").
**Guard (non-attorney):** PASS. Reworded table heading must match what the table contains.
**Handoff:** `claude/handoff_CLAUDE_CODE_ADDENDUM_P_TIME_OFF_2026-10-26.md`, P0 and P1.

## 2026-10-26 · D-048 · Plan first, airport second on `/time-off`, before Nov 4

**Decision:** ADOPTED for build. `/time-off` renders the full planner without an airport; "Where do you fly from?" sits above "Destinations that fit"; prefill from the homepage's stored origin (airport code only, in the browser); airport pages keep their URLs, preset and SEO role. Merge by Wed Nov 4.
**Cut rule:** if not merged and smoke-checked by Nov 4, it waits until Nov 9 or later; never into Nov 5 or the freeze.
**Splits kept:** Priya (plan first) vs Dana (airport matters; don't ask twice). Addressed by prefill.
**Guard (non-attorney):** PASS. No cookie, server storage, IP or geolocation; no traveler dates in shareable URLs.
**Hub caution recorded:** Nov 4 already carries M1, Addendum N and Addendum O; the cut rule protects the launch.
**Handoff:** Addendum P, P2.
**Kill signal:** plan starts per 100 `/time-off` views do not rise against the Day-14 baseline after 30 days, or `src=pto` signups per 100 views fall.

## Backlog rows

| ID | Gem | Spark | Integrity | Smallest test | Status |
|---|---|---|---|---|---|
| G108 | `/time-off` accuracy fixes (items 134 to 137), shared logic incl. embed | n/a (correctness) | PASS | Unit tests; zero date errors on the re-scan | Approved (D-047); Addendum P1, by Oct 30 |
| G109 | Plan-first `/time-off`; airport asked at destinations; homepage origin prefill | not scored (Convene only) | PASS | Plan starts and `src=pto` signups per 100 `/time-off` views vs Day-14 baseline | Approved (D-048); Addendum P2, by Nov 4 with cut rule |
