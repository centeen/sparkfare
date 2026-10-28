# Guard read package: Q6 clicks, not opens (the sunset email and the pause rule)

For the Hub, 2026-10-28. **Status:** built on PR #418 (draft); Q6 has no flag, so it takes effect when the PR merges and migration `0040` is applied. Strings below are copied from the code. The addendum asks for a Guard read of the changed sunset copy.

## 1. What changes for a subscriber

**The pause rule** (`pruneInactiveSubscribers`, runs at the top of every digest run). A subscriber is paused only when **all** hold: the account is older than **90 days**, there is **no click in 90 days**, and there is **no open in 45 days**. An open can delay a pause; it can never cause one. Before: account older than 45 days and no open in 45 days.

**The sunset email** (sent once, when the person is paused; subject unchanged):
- Subject: **We've paused your Sparkfare alerts**
- Body: "We haven't seen a click from you in 90 days, and no opened Sparkfare emails in the last 45, so we've paused your alerts to keep your inbox clean. Clicks and opens aren't always visible to us, so if we got this wrong, one tap turns them back on."
- Link: **Turn my alerts back on** (signed, one tap, confirm page); and **No thanks, unsubscribe me completely**.
- Pressing the reactivation button counts as a click, so the person is not paused again at once.

**Other changes in the same package:** an open no longer confirms a referral (only verifying the email does); a click within 60 seconds of delivery is treated as a link scanner and never counts.

## 2. Is the wording true?

| Claim | Check |
|---|---|
| "We haven't seen a click from you in 90 days" | True by the rule, but **no click can be recorded today**: Resend click tracking is off (decision of 2026-09-26) and the webhook may not be subscribed to `email.clicked`. Until that changes, every subscriber reads as "no click", so the sentence is true of everyone and the real test is the open. |
| "no opened Sparkfare emails in the last 45" | True by the rule (`last_opened_at`). Opens were recorded only from 2026-09-26. |
| "Clicks and opens aren't always visible to us" | True (image blocking, privacy proxies). |
| "paused", "one tap turns them back on" | True; the reactivate link is a signed confirm page. |

## 3. Facts the owner can read before deciding

`docs/q6_production_reads.sql` (read-only, counts only, tested). It shows how many subscribers each rule would pause today, how many have ever had an open recorded (by account age), whether delivered / open / click events are arriving, and (after `0040`) the full rule. Nothing in it selects an address.

Known from the repo: the three test accounts created 2026-09-04 reach 90 days on 2026-12-03 (they were due on 2026-10-19 under the old rule).

## 4. Questions for the Hub

1. **Sentence order.** The addendum's text is "We haven't seen a click from you in 90 days, so we've paused your alerts…". The build adds the open window so the email states both halves of the rule. Keep the longer sentence, or use the addendum's shorter one?
2. **While click tracking is off.** Is it acceptable to tell people "we haven't seen a click" when we cannot see clicks at all? Options: (a) keep, since the pause still needs no open in 45 days; (b) say only "no opened emails in 45 days" until click tracking is on (this is the previous wording); (c) turn click tracking on first (owner decision, rewrites links through the tracking domain, including `/out/` links).
3. **Subject** "We've paused your Sparkfare alerts": unchanged. Keep?

## 5. Owner steps before this ships

1. Apply migration `0040` (`users.last_clicked_at`, `email_delivery_times`) and record it in `d1_migrations` (the Worker also adds them on first use).
2. In Resend: subscribe the webhook to `email.delivered` and `email.clicked`; decide whether to turn click tracking on (it stays off by default).
3. Run `docs/q6_production_reads.sql` and send the results back.

## 6. Not verified

No real `email.clicked` or `email.delivered` event has been received, so the scanner rule is tested only with signed test events. The sunset email has not been seen in an inbox with the new text.
