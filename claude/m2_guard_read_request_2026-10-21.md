# M2 referral prompt: Guard read request (2026-10-21)

For the Hub. Nothing below is built or live. M2 ships behind `ENABLE_REFERRAL_PROMPT`, default off, and will not merge until the Hub approves this copy (Addendum M section 2; BUILD_STATE.md).

## What is being read

One short referral block, shown in three places:
1. The double opt-in confirmation page.
2. The welcome email.
3. The footer of every digest.

## Draft copy (owner decision, 2026-10-21)

> Know someone who'd use this? Share your link. When three friends confirm, you can watch up to 10 routes instead of 3.

Link line: the person's own referral link, with a copy button on the web page. In the two emails the link is plain text, no button.

## Rules the copy must meet

- One ask per email. Never repeated in the same email.
- No progress bars, streaks or counts of other people.
- Brand v1 banned-pressure list applies: no "book", "secured", "instantly", "the moment", countdowns, "only X left", activity or subscriber counts.
- A referral counts only after the friend confirms (verification-based, per the owner's M0 decision).
- Works for email-only subscribers without an account.
- `npm run check:copy` must pass.

## Questions for the Hub

1. Is the copy approved as written, or what should change?
2. Should the two emails say "friends confirm" or spell out "confirm their email"?
3. Is the tier line accurate to what the code grants today? Confirm against the live watchlist limit (3 routes, 10 with three confirmed referrals) before approving.

## Still to come in the M2 PR

- Before-and-after text for the hub and `/reward-terms` tier lines (the unbuilt second home airport and the empty Early Access tier are removed).
- Screenshots at 375 and 1,440 px.
- Test results and the acceptance check with the flag on in staging.
