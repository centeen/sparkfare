# Addendum M build state

Shared progress log for Claude Code and Antigravity IDE. Neither tool remembers the other's session, so keep this file current. Rules and package specs: `docs/handoff/ADDENDUM_M.md` and ROADMAP.md steps 139 to 146.

## Packages

| Package | ROADMAP step | Branch | PR | Status | Last commit | Next step |
|---|---|---|---|---|---|---|
| M0 read-only plan | 139 | m/m0-plan | — | Done, committed (53c46dae) | 53c46dae | — |
| M1 measurement (HARD GATE) | 140 | m/m1-measurement | #353 | Merged (5f228a4a); deploy status not checked by this tool | 5f228a4a | Owner: test a signup on production with a `+alias` address and check `/admin/growth`; run `scripts/growth-baseline.mjs` around Oct 27 |
| M2 referral prompt | 141 | m/m2-referral-prompt | — | Not started | — | Needs the Hub's Guard read of the copy first |
| M7 conversion additions | 142 | rides K-B2's PR | — | Not started | — | — |
| M4 2027 PTO page | 143 | m/m4-pto-2027 | — | Not started | — | — |
| M5 Holiday Fare Report | 144 | m/m5-holiday-report | — | Not started | — | Needs the Hub's choice of findings and Guard read |
| M3 `/check` share image | 145 | m/m3-share-image | — | Not started | — | — |
| M6 answer-engine basics | 146 | m/m6-answer-engine | — | Not started | — | Needs the Hub's Guard read of the Q&A copy |

## Decisions (owner, 2026-10-21)

1. Swap approved in principle (K-B6, K-B9, K-B7 move after Nov 9), but build M0 and M1 only until M0's capacity answer (item 7) is reviewed.
2. M2 names the 3-referral tier: "When three friends confirm, you can watch up to 10 routes instead of 3." The M2 PR also corrects the hub and `/reward-terms` tier text (remove the unbuilt second home airport and the empty Early Access tier). Needs the Hub's Guard read.
3. Flag flips: `ENABLE_REFERRAL_PROMPT` merges by Nov 4; `ENABLE_SHARE_IMAGE` Nov 4 or after Nov 9; `ENABLE_REPORTS` Nov 11 (fallback Nov 18); none Nov 6 to 8.

## Open questions for the owner

1. Log a one-line Seller of Travel confirmation (plan decision 5): do the Oct 7 and Oct 9 decisions cover the launch push? Recommended yes.
2. Plan decisions 2 (passive-rule exception) and 4 to 9 are the owner's; none blocks M0 or M1.

## Session notes (newest first)

- 2026-10-21 (Antigravity IDE, sync only): logged in `gh` as centeen; found no open PRs and M1 already merged as #353 (5f228a4a). Updated this table to match. No code, flags or copy changed. M1's production `+alias` signup test and the deploy status are still unconfirmed. Next: M2 needs the owner's go-ahead and the Hub's Guard read of the copy.

- 2026-10-21 (Claude Code, M1): owner answered the four M0 decisions (verification-based referral confirmation, apply migration 0031, analytics token later, no `/data/` regeneration). Migration 0031 applied to production and recorded. M1 built on `m/m1-measurement`: `src/growth.js`, signup stores `users.signup_source`, `/api/verify` logs `email_verified` and confirms a pending referral, `/admin/growth`, `scripts/growth-baseline.mjs`, `utm.js` on `/leave` and `/time-off`, `source` on the homepage and widget. 14 new tests; 7 deliberate breaks each fail one; full suite 1464 pass, 5 known Windows `gate:` failures. Not merged.

- 2026-10-21 (Claude Code, M0): plan written. Key findings: K-B1 to K-B10 are already merged so the swap is moot; "confirmed" is not recorded anywhere and a referral confirms on first email open, not verification; only 12 of 22 hubs can show a verdict; history is about 45 days with no travel dates. Four owner decisions listed at the end of the plan. No code or live copy changed.
- 2026-10-21 (Claude Code, later still): recorded the owner's three decisions (reward line, flag-flip dates, two-step release of M) in ROADMAP, the decision log, CLAUDE.md and this file. No code or live copy changed. Next: M0 when the owner says go.
- 2026-10-21 (Claude Code, later): Growth & GTM Plan v1 added to `claude/`; mismatches checked against the code and resolved in ROADMAP (reward not built, route count agrees at 880, step numbers, admin auth). No code or live copy changed.
- 2026-10-21 (Claude Code): Addendum M folded into ROADMAP.md (steps 139 to 146), state_DECISION_LOG.md (D-036, D-037) and CLAUDE.md. Handoff copied unchanged to `claude/` and `docs/handoff/ADDENDUM_M.md`; this file created. No code, flags or copy changed. Next: M0 when the owner says go.
