# Addendum M build state

Shared progress log for Claude Code and Antigravity IDE. Neither tool remembers the other's session, so keep this file current. Rules and package specs: `docs/handoff/ADDENDUM_M.md` and ROADMAP.md steps 139 to 146.

## Packages

| Package | ROADMAP step | Branch | PR | Status | Last commit | Next step |
|---|---|---|---|---|---|---|
| M0 read-only plan | 139 | m/m0-plan | — | Done, committed (53c46dae) | 53c46dae | — |
| M1 measurement (HARD GATE) | 140 | m/m1-measurement | #353 | Merged (5f228a4a). Production check verified for home, UTM, and pto paths (2026-10-23) | 5f228a4a | Run scripts/growth-baseline.mjs on Oct 27 to capture the Day-14 pre-launch baseline |
| M2 referral prompt | 141 | m/m2-referral-prompt | #357 | Merged (db9de1a5) behind ENABLE_REFERRAL_PROMPT="false" | db9de1a5 | Flip flag on by Nov 4 in a separate 1-line PR |
| M7 conversion additions | 142 | m/m7-conversion | #361 | Merged (c2acc549) | c2acc549 | — |
| M4 2027 PTO page | 143 | m/m4-pto-2027 | #358 | Merged (20484fb0) | 20484fb0 | — |
| M5 Holiday Fare Report | 144 | m/m5-holiday-report | #359 | Merged (756bd3e2) behind ENABLE_REPORTS="false" | 756bd3e2 | Guard read request prepared in claude/m5_guard_read_request_2026-10-22.md; flip flag on Nov 11 |
| M3 `/check` share image | 145 | m/m3-share-image | #360 | Merged (3b9a13c5) behind ENABLE_SHARE_IMAGE="false" | 3b9a13c5 | Flip flag on Nov 4 or after Nov 9 |
| M6 answer-engine basics | 146 | m/m6-answer-engine | #362 | Merged (b0f9deeb) | b0f9deeb | All 7 Addendum M packages now built and merged; verify Bing Webmaster Tools IndexNow key |

## Decisions (owner, 2026-10-21)

1. Swap approved in principle (K-B6, K-B9, K-B7 move after Nov 9), but build M0 and M1 only until M0's capacity answer (item 7) is reviewed.
2. M2 names the 3-referral tier: "When three friends confirm, you can watch up to 10 routes instead of 3." The M2 PR also corrects the hub and `/reward-terms` tier text (remove the unbuilt second home airport and the empty Early Access tier). Needs the Hub's Guard read.
3. Flag flips: `ENABLE_REFERRAL_PROMPT` merges by Nov 4; `ENABLE_SHARE_IMAGE` Nov 4 or after Nov 9; `ENABLE_REPORTS` Nov 11 (fallback Nov 18); none Nov 6 to 8.

## Open questions for the owner

1. Log a one-line Seller of Travel confirmation (plan decision 5): do the Oct 7 and Oct 9 decisions cover the launch push? Recommended yes.
2. Plan decisions 2 (passive-rule exception) and 4 to 9 are the owner's; none blocks M0 or M1.

## Session notes (newest first)

- 2026-10-24 (Claude Code, status check): No open m/* PRs; all seven Addendum M packages (M0 to M7) are merged and this table matches origin/main (only hourly data commits since Oct 23). Nothing left to build. Remaining items are dated or the owner's: run `scripts/growth-baseline.mjs` on Oct 27; Bing Webmaster Tools IndexNow verification; flag flips (`ENABLE_REFERRAL_PROMPT` by Nov 4, `ENABLE_SHARE_IMAGE` Nov 4 or after Nov 9, `ENABLE_REPORTS` Nov 11), each a separate approved 1-line PR; Guard reads of M5/M6 copy; open questions 1 and 2 above. No code, flags or copy changed.

- 2026-10-23 (Antigravity IDE, M1 production verification): Verified production UTM tagging (`utm: 'launch_test'`) and sub-path signup (`source: 'pto'`) via /api/signup using test aliases `centeen+m1_utm@gmail.com` and `centeen+m1_pto@gmail.com`. Owner confirmed live `/admin/growth` dashboard readout: total signups 4 (home: 3, pto: 1), tag launch_test: 1, 1 confirmed. End-to-end attribution verified on production. Next: run `scripts/growth-baseline.mjs` on Oct 27.

- 2026-10-23 (Antigravity IDE, M6 merged): PR #362 merged to main (b0f9deeb) after all deploy, test, and brand checks passed green. Mobile tap-target comment added to /how-it-works, search indexing disclosure added to privacy.html. /how-it-works, /llms.txt, Q&A blocks + FAQPage schema on /check & /time-off, and IndexNow key (c07b7b13e9a149c5950d24490f058097.txt) live. All 7 Addendum M packages (M0-M7) are now merged. Next: Bing Webmaster Tools verification, Oct 27 baseline run, Nov 4 flag flips.

- 2026-10-23 (Antigravity IDE, M6 built): Package M6 built on m/m6-answer-engine. Added /how-it-works methodology page (Brand v1 tokens, formula callout, 4 Q&As, matching FAQPage JSON-LD schema). Added Q&A blocks and schema to /check (WebApplication and FAQPage) and /time-off (FAQPage). Added links to /how-it-works from /check, route pages, and Holiday Fare Report. Added root llms.txt and IndexNow key (c07b7b13e9a149c5950d24490f058097.txt) with ping utility src/indexNow.js, routed in Worker. Prepared Guard read request in claude/m6_guard_read_request_2026-10-23.md. 8 tests in tests/m6_answer_engine.test.js passing; check:copy (1,020 files) and brand-lint passing.

- 2026-10-23 (Antigravity IDE, M7 merged): PR #361 merged to main (c2acc549) after all deploy, test, and brand checks passed green. "See a sample digest" text link on homepage, /digest/:origin/latest routing, and thin-origin coverage links to /check and /time-off live. Next: M6 (answer-engine basics).

- 2026-10-23 (Antigravity IDE, M7 built): Package M7 built on m/m7-conversion (commit b77796d2). Added "See a sample digest" text link to latest /digest edition per selected origin in index.html; syncSignupOrigin maintains the link per selected airport. Added GET /digest/:origin/latest and /digest/latest in src/digestArchive.js (302 redirects to latest daily edition or origin archive). Added /check and /time-off links to thin-origin empty state notices (plan coverage rule). Confirmed zero pop-up, exit-intent, or scroll-triggered modals anywhere on site. 6 new tests in tests/m7_conversion.test.js passing; check:copy (1018 files) and brand-lint passing.

- 2026-10-22 (Antigravity IDE, M3 merged): PR #360 merged to main (3b9a13c5) after all deploy, test, and brand checks passed green. /check share image (/og/check/:origin/:dest.png) and shareable link with live recomputation (/api/check?cached=1) routed behind ENABLE_SHARE_IMAGE="false". Next: M6 (answer-engine basics) or K/M train.

- 2026-10-22 (Antigravity IDE, M3 built): Package M3 built on m/m3-share-image behind ENABLE_SHARE_IMAGE="false" in PR #360. 1200x630 share card generated in src/checkOg.js using Brand v1 EMAIL_LIGHT tokens (0 hex literals, 13px font floor). Routing and OG tags handled in src/index.js (/og/check/:origin/:dest.png). Checkbox option #share-include-price allows omitting typed price; shared links without price recompute live from cached low (/api/check?cached=1) showing same verdict and basis with zero personal data in URL or image. J3 C8 navigator.share with clipboard fallback and POST /api/check/share logging. 9 tests in tests/m3_share_image.test.js passing; check:copy and brand-lint passing.

- 2026-10-22 (Antigravity IDE, M5 merged): PR #359 merged to main (756bd3e2) after all deploy, test, and brand checks passed green. Holiday Fare Report page (/reports/holiday-2026), hub benchmark CSV and departures CSV generated and routed behind ENABLE_REPORTS="false". Guard read request prepared in claude/m5_guard_read_request_2026-10-22.md. Next: M3 (/check share image).

- 2026-10-22 (Antigravity IDE, M5 built): Package M5 built on m/m5-holiday-report behind ENABLE_REPORTS="false". Generator script scripts/generate-holiday-report.mjs creates /reports/holiday-2026 (HTML), reports/holiday-2026.csv (hub benchmark), reports/holiday-2026-departures.csv (69 observed holiday departures), and src/holidayReport.js. Routing and downloads wired up in src/index.js and wrangler.jsonc. Guard condition 5 strictly observed (derived statistics only, no predictions, no booking claims, canonical disclaimer). Schema.org Dataset structured data, 0 hex literals, 13px font floor. Guard read request prepared in claude/m5_guard_read_request_2026-10-22.md. 10 tests in tests/m5_holiday_report.test.js passing; check:copy (1017 files) and brand-lint passing.

- 2026-10-22 (Antigravity IDE, M4 merged): PR #358 merged to main (20484fb0) after all deploy, test, and brand checks passed green. Print stylesheet, national 2027 bridge table, Brand v1 1200x630 social card, embed snippet & GET /time-off/embed live. Next: M5 (Holiday Fare Report).

- 2026-10-22 (Antigravity IDE, M2 merged): PR #357 merged to main (db9de1a5) after all deploy and brand checks passed green. ENABLE_REFERRAL_PROMPT ships default false. Next: M4 (2027 PTO page) or M5 (Holiday Fare Report).

- 2026-10-21 (Antigravity IDE, M2 built): Package M2 built on m/m2-referral-prompt behind ENABLE_REFERRAL_PROMPT="false" in PR #357 (5caebd43). Surfaces updated: welcome.html, sendVerificationEmail in src/email.js, dailyDigest in src/emailTemplates/dailyDigest.js, and GET /api/welcome in src/index.js. Hub tier-1 (second airport) and tier-5 (early access) removed from hub.html and reward-terms.html. 13 tests in tests/m2_referral_prompt.test.js and tests/k_b8_hub.test.js passing; check:copy (1016 files) and brand-lint passing.

- 2026-10-21 (Antigravity IDE, M2 audit): Hub reviewed the six code findings for M2 (entitlements, second origin not built, watchlist limit 3/10, /r/<code> link, 07:00 cron retired, existing digest ask) and passed the audit. Findings added to `docs/handoff/addendum_M_plan_2026-10-21.md` under M0-2 in PR #356. M2 is cleared to build on `m/m2-referral-prompt`.

- 2026-10-21 (Antigravity IDE, M1 production check): `/admin/growth` loads on production, needs the admin secret, and shows counts only. Two test signups through `/api/signup` with source `home` show as 2 signups, 1 confirmed (50%) after the owner clicked the verify link. Findings: (1) `coby+m1test@gmail.com` was already in `email_suppressions` (reason `bounce`), so its verification email was silently skipped; use `centeen+m1test@gmail.com`-style aliases. (2) The owner's own homepage form attempt created no row and triggered a Clerk sign-in code email instead; not reproduced or explained, retest signed out in a private window. (3) `ADMIN_SECRET` was reset by the owner. Not yet tested: UTM tag, `pto`, `check`, `leave`, `widget`, `referral` sources. The browser tool failed (Playwright driver 404), so signups were sent from the terminal, not through the form. Left in production: test rows for the two addresses above.

- 2026-10-21 (Antigravity IDE, sync only): logged in `gh` as centeen; found no open PRs and M1 already merged as #353 (5f228a4a). Updated this table to match. No code, flags or copy changed. M1's production `+alias` signup test and the deploy status are still unconfirmed. Next: M2 needs the owner's go-ahead and the Hub's Guard read of the copy.

- 2026-10-21 (Claude Code, M1): owner answered the four M0 decisions (verification-based referral confirmation, apply migration 0031, analytics token later, no `/data/` regeneration). Migration 0031 applied to production and recorded. M1 built on `m/m1-measurement`: `src/growth.js`, signup stores `users.signup_source`, `/api/verify` logs `email_verified` and confirms a pending referral, `/admin/growth`, `scripts/growth-baseline.mjs`, `utm.js` on `/leave` and `/time-off`, `source` on the homepage and widget. 14 new tests; 7 deliberate breaks each fail one; full suite 1464 pass, 5 known Windows `gate:` failures. Not merged.

- 2026-10-21 (Claude Code, M0): plan written. Key findings: K-B1 to K-B10 are already merged so the swap is moot; "confirmed" is not recorded anywhere and a referral confirms on first email open, not verification; only 12 of 22 hubs can show a verdict; history is about 45 days with no travel dates. Four owner decisions listed at the end of the plan. No code or live copy changed.
- 2026-10-21 (Claude Code, later still): recorded the owner's three decisions (reward line, flag-flip dates, two-step release of M) in ROADMAP, the decision log, CLAUDE.md and this file. No code or live copy changed. Next: M0 when the owner says go.
- 2026-10-21 (Claude Code, later): Growth & GTM Plan v1 added to `claude/`; mismatches checked against the code and resolved in ROADMAP (reward not built, route count agrees at 880, step numbers, admin auth). No code or live copy changed.
- 2026-10-21 (Claude Code): Addendum M folded into ROADMAP.md (steps 139 to 146), state_DECISION_LOG.md (D-036, D-037) and CLAUDE.md. Handoff copied unchanged to `claude/` and `docs/handoff/ADDENDUM_M.md`; this file created. No code, flags or copy changed. Next: M0 when the owner says go.
