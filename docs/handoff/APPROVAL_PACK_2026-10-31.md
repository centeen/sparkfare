# Approval pack for Wed Nov 4 and the Nov 9 flips (drafted 2026-10-31, Claude Code)

Nothing here is approved yet. Answer in one reply, for example "1 yes, 2 yes, 3 hold, 4 yes, 5 yes".
No merge, migration or flag change happens until you answer. `main` is at `f36df1bc`; there are no open PRs.

## Where things stand
- Migrations `0040` to `0047`: applied and recorded (you checked 2026-10-31). `0038` and `0039` were NOT in that check.
- M1 hard gate: met on current code (fresh `/?src=home` signup tagged `home`, test data deleted).
- #418 and all of Addendum R's R1 are merged and live. R2 is deferred past Nov 9 (D-060).
- Flags already on: `ENABLE_REFERRAL_PROMPT`, `ENABLE_SHARE_IMAGE`, `ENABLE_ROW_ALERT_CARD`. Every flag #418 added is `"false"`.
- Tests: 2009 of 2029 pass; the 5 failures are the known Windows `gate:` tests. `npm run check:copy` passes.

## Decisions for you
1. **Confirm the three flags already on were your decision** (`ENABLE_REFERRAL_PROMPT` since #403, `ENABLE_SHARE_IMAGE` since #404, `ENABLE_ROW_ALERT_CARD` since #405). The Hub holds M2 and O2 as awaiting approval, which doesn't match `main`. Recommended: yes, and I record it in BUILD_STATE. If any was not your decision, say which and I prepare a one-line revert PR for you to approve.
2. **Migrations `0038` and `0039`.** Check they are applied in the console: `SELECT name FROM d1_migrations WHERE name LIKE '0038%' OR name LIKE '0039%';`. Recommended: yes, check. `0038` is Q3 (frequency options) and `0039` is the send ledger.
3. **Resend settings before Nov 9** (checklist Phase 2): click tracking on `links.sparkfare.com`, and the webhook subscribed to `email.delivered` and `email.clicked`. Then send yourself a digest and confirm a click lands in `events` and the Aviasales `marker=` still arrives. Recommended: do it Nov 2 to 4 so there is time to react. I cannot do this one: it needs your Resend dashboard.
4. **Nov 9 flip order.** Eleven flags, one PR each, one flag per PR, from the checklist (`docs/handoff/flip_order_checklist_2026-10-28.md`): signed prefs, signup frequency, welcome email, R2 serving, retention (dry run), then the later rows. Recommended: approve the order now, and approve each flip PR when it is opened.
5. **Care email (last row).** The checklist recommends not flipping it until click tracking has been on about 60 days (mid-January), because until then every subscriber looks like a non-clicker. Recommended: hold it.

## Missing Guard reads (needed before the flips, not before Nov 4)
- C1.1 signed prefs and signup frequency (flips 1 and 2)
- Q5 welcome email (flip 3; the repo has the package and the 2026-10-29 conditions are applied in code)
- N13 retention and the replacement `/privacy` paragraph (flips 5 and 6)
- C1.2/1.3 trip stream and C1.4 lifecycle (later rows)
The read texts themselves are not in the repo; send them or the Hub's verdicts and I will apply any conditions.

## Time-critical, not yours to approve
- Sun Nov 1 08:00 UTC: first weekly edition under the new wording. Check the Resend log afterwards for errors.
- Last feature merge Wed Nov 4; Thu Nov 5 fix-only; go/no-go Fri Nov 6; freeze Nov 6 18:00 ET to Nov 8; launch Sat Nov 7; M5 report ready, unlinked, by Nov 10.
