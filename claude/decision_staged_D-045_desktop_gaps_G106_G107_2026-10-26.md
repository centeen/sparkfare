# D-045 and D-046, backlog rows G106, G107: desktop homepage gaps (consult 16, Oct 26, 2026)

Staged here until the Hub's next full rewrite of `state_DECISION_LOG.md` and `state_COUNCIL_BACKLOG.md`; read both together. Numbering: D-044 stays reserved for the pending N5 approval.

---

## 2026-10-26 · D-045 · Close the desktop hero gap; mock the alert card for persona reaction first

**Source:** owner message Oct 26 08:05 (Asia/Jerusalem): "1. approve 2. do the mockup for persona reaction first", answering consult 16 (owner screenshot of sparkfare.com on a laptop, MIA origin, two empty areas marked in red).
**Question (owner):** "There are empty spaces on desktop; this is prime real estate. Is that OK?"
**Question (neutral):** Should the two empty desktop areas on the homepage be closed with layout changes, filled with existing live content, or left, measured by desktop signups and fare clicks per 100 homepage visits (Dana, Priya, Marcos)?
**Consult steps:** Frame; Ground (synced `index.html`: hero `grid-template-columns: 1.2fr 1fr`; deal grid `repeat(auto-fill, minmax(240px, 1fr))`; causes inferred, not measured live; synced file may predate the Brand v1 layout); creative bench (UX, Brand, Behavioral); short Guard; Audit PASSED. Turn 2: PROPOSED mock shown; Convene (Dana, Marcos, Priya, Elena); provisional score. Price skipped (no desktop signup baseline; M1 acceptance not shown).

| Part | Decision | Status |
|---|---|---|
| Gap 1 (under the hero alert box, every origin) | Balance the hero on desktop so the photo follows the left column's height and the board starts higher. Layout only; mobile unchanged. Fits inside G79 / M7 | Approved (G106) |
| Gap 2 (short deal rows; varies by origin and day) | Mock the end-of-row alert card for persona reaction before any build | Done Oct 26; see D-046 |

**Not adopted / not assessed:** display ads in either space (not assessed; would need a full consult).

---

## 2026-10-26 · D-046 · Build the row alert card with both v2 changes, before Nov 4

**Source:** owner message Oct 26 08:11 (Asia/Jerusalem): "approve the card with both v2 changes for build before Nov 4".
**Consult steps:** consult 16 turn 2 (PROPOSED mock; Convene: Dana M, Marcos L-M, Priya M layout / L card, Elena L; Synthesizer D3 × V2 provisional × F4 = 24, test band; Guard CONDITIONAL; Audit PASSED).
**Decision:** ADOPTED for build, behind `ENABLE_ROW_ALERT_CARD` (default off), merged and flipped by Wed Nov 4.
- **v2 change 1:** "real deal" in the heading links to the method page's deal rule (Dana's objection).
- **v2 change 2:** secondary link "Or watch one route" → `/watchlists` (Marcos's objection), with "(sign-in needed)" if a guest must sign in.
- Copy: "That's every real deal from {City} today." / "Get the next one by email." / "One daily digest. Unsubscribe anytime." only if every triggered email has a working unsubscribe link.
- Not adopted: a trip-length field on the card (Elena's objection stays open; adds friction).
**Note on the decision rule:** a score of 24 sits in the test band. The build is the test: the card ships behind a flag with its own signup tag, and the G107 metric is read at the Day-14 point after the flip.
**Guard (non-attorney guidance; verify with counsel):** CONDITIONAL. "Today's deals" row only (the claim "every real deal" is true only there, against the D-021 floor); no "only", pressure counts, countdowns or savings claims; same endpoint, consent and double opt-in as the hero form; Hub Guard read of the rendered card before the flag flip.
**Handoff:** `claude/handoff_CLAUDE_CODE_ADDENDUM_O_DESKTOP_GAPS_2026-10-26.md` (O0 report, O1 hero balance, O2 card). Owner to relay.
**Kill signal:** signups per 100 desktop homepage visits with the card rendered do not beat visits without it after 30 card-rendered signups-eligible days, or any complaint that the card reads as a deal or an ad.

## Backlog rows

| ID | Gem | Spark | Integrity | Smallest test | Status |
|---|---|---|---|---|---|
| G106 | Desktop hero balance: photo follows the left column's height | n/a (layout fix) | PASS | Board top position before/after; fare clicks per 100 desktop homepage visits vs Day-14 baseline | Approved (D-045); Addendum O1 |
| G107 | End-of-row alert card on short "Today's deals" rows, v2 (basis link, watch-one-route link) | D3 × V2 (provisional, no Revenue table) × F4 = 24 | CONDITIONAL | Signups per 100 desktop homepage visits, card rendered vs not (card's own tag) | Approved for build (D-046); Addendum O2; flag flip after Hub Guard read |

Splits kept (G107): Dana wants the basis linked (addressed); Marcos wants a route, not a per-origin digest (partly addressed by the link); Elena wants trip length (not addressed); Priya neutral. Weights equal: no F0 data yet.
