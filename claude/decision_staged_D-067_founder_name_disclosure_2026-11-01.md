# D-067 (staged) · Founder public name, `/disclosure` founder line, founder story, no fare links on the report

Status: STAGED. The Hub appends this to `state_DECISION_LOG.md` at its next full rewrite. Numbering: D-066 is the last staged number (`claude/decision_staged_D-066_S2_embed_subline_2026-11-01.md`); D-067 is next.

**Source:** owner messages Sun Nov 1, 2026 12:24 and 12:30 (Asia/Jerusalem), answering the Hub's notes in `claude/draft_embargo_pitch_for_guard_read_2026-11-01.md`.
**Consult steps:** short; Frame, Ground (live read of `/disclosure`, Nov 1 ~12:35), Guard (Hub-run, non-attorney), self-check. Skipped: Convene, Price, Score (copy and positioning under D-056; no new idea; no revenue claim). Auditor pass not run by a separate seat.

## Decisions (owner)
1. **Public founder name: Coby Enteen.** The owner uses "Jason" (his official name) only in an official and legal capacity, such as accounts. This amends D-056's carried condition "same name as on the affiliate accounts and `/disclosure`": the public name is Coby Enteen; affiliate and payment accounts stay under the legal name.
2. **Add a founder-name line to `/disclosure`.** One sentence. PROPOSED wording below; not live until the Guard read clears it and the owner approves the PR (D-035).
3. **Founder story (press pitch, Product Hunt maker comment, Show HN comment if used): the "plain and short" version**, owner's words:
   "I grew up dreaming of far-off places and checking fares I couldn't afford, always looking for the ones priced far below normal to pass along to friends. These days I travel a lot, and the stress isn't only the fare but everything around leaving, so I built Sparkfare: a free way to judge an international fare against its own history, plus a checklist for the trip ahead."
4. **The Holiday Fare Report page carries no fare links.** It links only to `/check` and `/how-it-works`. The pitch sentence "The report page has no fare links." is true only after Claude Code confirms it (read-only question in `claude/handoff_CLAUDE_CODE_READ_ONLY_Q_report_links_2026-11-01.md`). **Answered Nov 1 12:38 (Claude Code, from source; footer not run in a browser):** no fare, route, Book or partner link in the body; `/how-it-works` linked in the body; `/check` and a "Routes" link to the `/data/` index appear only in the shared nav; both CSVs are aggregates only (23 and 44 rows, no route, URL or fare column). The sentence "The report page has no fare links." is supported. Re-check the private preview in a browser before the Nov 9 send.

5. **Add a `/check` link inside the report's own text** (owner: yes, Sun Nov 1 12:40). One sentence and one plain internal link next to the `/how-it-works` method link; wording PROPOSED in the handoff (S-copy B), Guard decides; optional if it does not fit before the Nov 4 last merge. This makes the build match item 4 literally (the body links only `/how-it-works` and `/check`; the shared nav links remain).

## Ground (live, Nov 1 ~12:35)
`/disclosure` names no person. It lists 14 partners, says new partners join the Away Mode checklist only after approval, says deal ranking uses only each route's own 30-day history, and gives hello@sparkfare.com. No founder line today. [E, live read]

## `/disclosure` line (wording APPROVED by the owner, Sun Nov 1 12:36 Israel; the Guard read of the PR copy and the owner's per-PR approval still apply)
"Sparkfare is built and run by Coby Enteen."
Placement: first paragraph under the heading, before the commission statement. Nothing else changes on the page.

## Guard (Hub-run; non-attorney guidance; have a licensed attorney review anything binding): CONDITIONAL
| # | Item | Verdict | What it needs |
|---|---|---|---|
| 1 | Founder line | PASS with a note | A statement of fact. It names no employer, home, family or travel dates (D-056). It adds no claim about licences or registration |
| 2 | Name mismatch with the accounts | CONDITIONAL | The public name differs from the legal name on the affiliate accounts. Not a legal conclusion. [U] whether Travelpayouts or any partner requires the public brand name to match the account holder; the owner may ask Travelpayouts support in the next email. Do not state or imply that Coby Enteen is the account holder |
| 3 | Reddit display name | Reconciliation | D-060 set the display name "Jason · Sparkfare". Change it to "Coby · Sparkfare" (owner action) so the Nov 12 post matches the pitch, Product Hunt and `/disclosure` |
| 4 | Founder story | CONDITIONAL | (a) "a free way to judge an international fare against its own history" matches the 30-day median method; it must not be shortened to "find the lowest fare". (b) "a checklist for the trip ahead" matches Away Mode on the live `/disclosure`; the ledger was last verified Oct 13, so confirm the feature is live on the day. (c) "fares I couldn't afford" is a personal detail the owner chose to share; D-056 allows it, and it will be searchable under his name. (d) The story must not claim Sparkfare finds error or mistake fares |
| 5 | No fare links on the report | PASS | Removes the need for the inline commission disclosure on that page. The pitch's own disclosure paragraph still stands |
| 6 | `/check` sentence in the report | PASS with conditions (Hub-run) | "free" must match the live `/check` (no signup, no charge); no prediction, savings, urgency or "book" wording (none in the proposed line); internal link only, no tracking parameters; the page must still have no fare link after the change |

| 7 | CC BY licence built into the report | CONDITIONAL | Live only with Travelpayouts' written yes (Guard M5; R-003). The page is dark while `ENABLE_REPORTS` is off, but flipping it on Nov 11 would publish the licence unless it is switchable. S-copy C adds the switch, default off |

## Reconciliation items raised
- D-056 condition amended (item 1).
- Reddit display name (item 3).
- Name on Product Hunt, Hacker News, LinkedIn: use Coby Enteen.
- `/disclosure` has no founder line until the PR merges (target before the Nov 4 last merge).

## Owner actions carried
1. Done: exact line approved Nov 1 12:36.
2. Relay the two Claude Code items (read-only question; `/disclosure` PR).
3. Change the Reddit display name to "Coby · Sparkfare".
4. Employer outside-activity policy check before the founder version is sent (D-056).
