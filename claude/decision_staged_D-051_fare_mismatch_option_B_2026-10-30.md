# D-051 (staged) · Option B for deals the site cannot reproduce on Aviasales

**Source:** owner message Oct 30 08:49 (Asia/Jerusalem): "B and draft it", answering the Hub's four options (A measure only; B measure plus honest wording plus a tolerance rule; C verify every deal live; D remove the Deal badge). Evidence: R-013, R-013a. Staged here; fold into `state_DECISION_LOG.md` at its next full rewrite. Numbering: D-050 stays proposed (Oct 20 owner decisions); D-051 is the next free number.
**Question (neutral):** What should Sparkfare do before the Nov 7 launch about a "Deal" badge on a cached fare that does not appear at that price on Aviasales for the same dates, to keep the fare meter honest and the hero promise ("It only sparks when the fare's real") true?
**Consult steps:** short consult. Frame; Ground (R-012, decision log Oct 10 OPEN item, D-018, D-021, D-030, ledger L11, stale since Oct 13); Creative bench review of the copy (Brand and Creative Director, Behavioral Design); Guard (CONDITIONAL); Audit (below). Skipped: persona convene (a data-accuracy fix, no new idea; no mock exists to react to), Price (no revenue baseline; effect unpriced), Spark Score (not a gem).

## Decision (owner chose B)
1. **Measure.** Claude Code exports the raw records for every current US deal (R0). The live Aviasales comparison is done by reading each search page like a visitor, without the marker and without any `/out` click (Hub in the built-in browser if the desktop app is linked, or the owner). No scripted scraping.
2. **Interim honest wording** (Addendum R, R1), replacing "Checked N h ago" and adding a short "can differ" line on every surface that prints a fare. Text in the addendum. Guard reads the final strings before merge.
3. **Tolerance rule.** A deal that fails the live check loses its badge, its "% below" line and its "$ under" line. The numeric tolerance is NOT set yet: the owner sets it after reading the R0 and sample report. Candidate data-only rules are backtested and reported, never switched on by Claude Code (R2).

## What this amends
- **D-030 / K-A3 tag wording** ("Checked {n} h ago · {time} {zone}") is replaced on cards by "From search data · updated {n} h ago · {time} {zone}". Zone and 48-hour window stay. The J1.3 "Last seen {date}" rule for rows older than 3 days stays.
- D-018 stands: the seller is still named once where a visitor leaves for Aviasales.
- D-021 (deal floor) stands; the new rule is additional.

## Not decided
A fourth Nov 6 hard gate (live-match tolerance); option C (live verification; Travelpayouts terms for a live price source are unknown); option D (retire the Deal badge). Revisit when the report is in.

## Guard (AGENT_LEGAL_COMPLIANCE): CONDITIONAL
Non-attorney guidance; have a licensed attorney review before anything binding is published or signed.
1. Every changed string passes `npm run check:copy` and the banned-urgency list. "live" is not used as a price claim. No "book", "secured", "locked in", "save $".
2. Seller identification stays (D-018): "Aviasales" is named in the interstitial and the disclosure sentence.
3. "From search data" must be literally true for every fare it labels. No surface may keep "Checked" or any wording that implies verification.
4. "Deal", "% below" and "$ under" appear only with the basis text (30-day median, observation count) and never on a fare that fails the live check. No "you saved".
5. Every surface that prints a fare gets the qualifier: cards, hero, route pages, interstitial, daily and weekly emails, social posts, OG images, blog grids. Claude Code lists them (R0).
6. A tolerance rule and any new eligibility rule get a Guard read of their effect before they are switched on.
7. The live sample uses no marker and no `/out` click, so no affiliate click is created.
8. Counsel items carried: substantiation of price comparisons (16 CFR 233.2 flagged Oct 17; verify with counsel); the DOT ticket-agent exposure accepted in D-003 is relevant to fare accuracy and should be revisited before scaling.

## Audit (AGENT_QUALITY_AUDITOR, Hub-run per protocol)
1. Status grounded: PASS. R-012 read (J1 PRs #292 and #293 merged Oct 17, owner-verified); decision log Oct 10 OPEN item read; no workplan CSV or status-verification skill in the project (missing file, noted).
2. No scope breach: PASS. Copy proposals are under the creative bench; Guard gave no product decision; Hub only sequenced.
3. Figures sourced or labeled: PASS. $478, $722, $731, $189 and 28% come from the owner's screenshots; 27 deals is the Oct 24 owner-verified count and may have changed; cache lifetime "48 hours to 7 days" is from the Oct 10 log. The recommendation does not depend on any of them being exact.
4. Legal-adjacent claims flagged: PASS. Guard above, non-attorney label.
5. No fabrication: PASS. The unknown live-source terms and cache behavior are labeled [U].
6. Assumptions stated: N/A. No projection made.
7. Conflicts surfaced: PASS. D-030 wording amended; ledger stale since Oct 13; "Checked" wording survived J1 (item 169, 170).
8. Attribution intact: PASS.
STATUS: PASSED

## Reconciliation items raised
169. Cached "Deal" fares do not reproduce on Aviasales (EWR to Budapest $478 vs $722 cheapest and $731 Swiss itinerary, same dates; owner reports most routes). R-013, R-013a.
170. D-030's "Checked {n} h ago" wording is replaced by this decision; confirm every surface (cards, hero, route pages, emails, social).
171. The deal floor tests history, not reproducibility. A new data-only rule is a candidate (Addendum R, R2), unproven.
172. Ledger L11 says live price may differ; ledger is 17 days old. Refresh still overdue.
