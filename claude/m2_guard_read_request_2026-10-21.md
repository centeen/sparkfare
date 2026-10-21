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

## Code findings requested by the Hub (checked 2026-10-21, read-only)

1. **`getEntitlements()` (`src/rewards.js`)**, by confirmed referrals: 0 gives 1 origin and 3 watchlists; 1 or more gives `maxOrigins` 2; 3 or more gives 10 watchlists; 5 or more gives `earlyAccessFeatures`; 10 or more gives `foundingMemberBadge`.
2. **Second home airport: not built.** `maxOrigins` is computed and returned by `/api/referral` (`src/index.js` around line 3749) and read nowhere else, so it is not enforced. No second-airport storage was found; `users` has one `origin_iata`. (Migrations were not read to rule it out.) The Addendum M draft line "you can add a second home airport" is therefore not true and must not ship.
3. **`POST /api/watchlist` limit: yes.** 3 routes, or 10 with three confirmed referrals; a 403 with code `watchlist_limit` past that. It needs a signed-in session. A watchlist that already reached its target does not count.
4. **Email-only subscribers and `/r/<code>`: yes, the link works.** `/api/signup` creates a code without a login (test signup returned one). A signed-out `GET /r/<code>` returns a 302 to `/` and sets a 30-day `ref` cookie. The homepage shows the code only right after signup, on that browser; the digest carries each user's link.
5. **07:00 UTC early digest: does not exist.** The `0 7 * * *` cron was removed on 2026-10-20 (owner decision; see `wrangler.jsonc`), so there is no send to observe. The `early_access` fields remain in the code.
6. **Existing asks:**
   - Digest: already has a block, "Know someone who'd like these? Friends who sign up through your link get the same daily fares. Share your link" (`src/emailTemplates/dailyDigest.js`), plus a plain-text line "Share Sparkfare with a friend: <link>". The M2 digest block must replace it, not sit beside it (one ask per email).
   - Confirmation page (`/welcome`) and welcome email: no existing referral ask found in `welcome.js`, `referralCopy.js` or `email.js`. The `/welcome` page template itself was not read; check it before building.

## What this changes

- The 3-referral line is true and enforced by the watchlist limit.
- The second-home-airport line is not shippable. The Early Access tier is not a working benefit and stays out of the copy.
- Question 3 above is answered: the tier line matches what the code grants, for watchlists only.
