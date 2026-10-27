# Guard read package: M2 referral prompt (PR #403, flag `ENABLE_REFERRAL_PROMPT`)

For the Hub, 2026-10-27. **Status:** built and merged dark on Oct 22 (#357); the flip PR is #403 (draft). Everything quoted below is copied from the code on `main` as of Oct 27 (strings, not paraphrase). The earlier request (`claude/m2_guard_read_request_2026-10-21.md`) was written before the build; this replaces it.

**What the Hub is asked for:** approve the copy, or say what to change. Nothing ships until the owner flips the flag, and the flip PR is not marked ready until this read is recorded.

## 1. The block, in the three places it appears (flag on)

The same sentence pair in all three. Source strings: `welcome.html`, `src/email.js` (`sendVerificationEmail`), `src/emailTemplates/dailyDigest.js`.

**A. Confirmation page (`/welcome`, after the person opens the confirmation link).** A card, shown only when the Worker returns a link:
- Heading: **Share your link**
- Body: "Know someone who'd use this? Share your link. When three friends confirm, you can watch up to 10 routes instead of 3."
- The person's own link in a read-only box (`sparkfare.com/r/<code>`) with a **Copy** button; the status line says "Copied to clipboard!" for three seconds.

**B. The confirmation-request email** (subject "Verify your Sparkfare account"). This is the only "welcome"-type email the code has: it is sent right after signup and asks the person to verify. Below the verify link, a muted 14 px paragraph with a rule above it:
- "Know someone who'd use this? Share your link: <person's link, plain text>"
- (line break) "When three friends confirm, you can watch up to 10 routes instead of 3."

**C. The daily digest.** HTML: a boxed section, heading **Know someone who'd use this?**, body "Share your link: <link, plain text>", and a muted line "When three friends confirm, you can watch up to 10 routes instead of 3." Plain-text version: "Know someone who'd use this? Share your link: <link>" then "When three friends confirm, you can watch up to 10 routes instead of 3."
- With the flag **off** the digest keeps its present block ("Know someone who'd like these? Friends who sign up through your link get the same daily fares. Share your link"). The new block **replaces** it; the two never appear together.

## 2. Does it follow the rules in Addendum M?

| Rule | Where it stands |
|---|---|
| One ask per email, never repeated | Digest: one block. Confirmation page: one card. **Verification email: it is a second ask in an email whose job is to get the person to verify (see Question 1).** |
| No progress bars, streaks or counts of other people | None. The only number is the reward ("three friends", "10 routes instead of 3"). |
| Brand v1 banned-pressure words | `npm run check:copy` passes on the whole repo, flag off or on (it scans the strings). No "book", "secured", "instantly", "the moment", countdown or scarcity. |
| A referral counts only after the friend confirms | Existing T3 rule, unchanged: `/r/<code>` sets a 30-day `ref` cookie; the credit lands when the friend's email is confirmed. |
| Works without an account | Yes. A code is created at signup (`/api/signup`); the link works signed out. |

## 3. Is the reward line true? (checked against the code, Oct 27)

"When three friends confirm, you can watch up to 10 routes instead of 3."
- `POST /api/watchlist` enforces it: 3 routes, or 10 with three confirmed referrals, otherwise a 403 `watchlist_limit`. A watchlist that already reached its target does not count.
- It needs a signed-in session to *use* the extra routes (watchlists live on an account). The line does not say that. See Question 2.
- The old second-home-airport and Early Access tiers are **removed** from the hub and `/reward-terms` in the same PR (already live; these changes were not behind the flag): "1 Referral: Extra Origin" and "5 Referrals: Early Access" are gone. What remains in `hub.html`: "3 Referrals: More Watchlist Routes. Watch up to 10 routes at once instead of 3." and in `reward-terms.html`: "3 Referrals (More Watchlist Routes): You can watch up to 10 routes at once instead of 3. A watchlist stops counting once it has reached its target price and emailed you."

## 4. Questions for the Hub

1. **The verification email.** It is the one place where the block sits beside another ask (verify). Options: (a) keep it (it is the first email a new subscriber opens), (b) remove it from this email and keep the confirmation page and digest, (c) move it to the first email *after* confirmation (none exists today; the first digest is the next email). My recommendation is (b): an unconfirmed address cannot yet receive a reward, and the page right after confirmation already carries the same ask.
2. **"Watch" needs an account.** Should the line say "…you can watch up to 10 routes instead of 3 (needs a free account)", or is the current line fine because the watchlist page itself asks for sign-in?
3. **"Friends confirm" versus "confirm their email".** The earlier request asked this; the code says "confirm". Keep?
4. **Tone check:** "Know someone who'd use this?" asks a question and then instructs ("Share your link"). Acceptable?

## 5. What is not verified

- Nothing has been seen live (the flag is off in production; the preview environment is not reachable from my session).
- Local checks only: tests assert the strings above in the confirmation page's markup (the card is hidden until the page's script gets a link from `/api/welcome`), in the verification email's HTML, and in the digest's HTML and plain text, with the flag on and off (`tests/m2_referral_prompt.test.js`; 94 related tests pass). The card has not been rendered in a real browser with a real link.
- The acceptance check (a `+alias` signup that shows the block in all three places, and a referred test signup credited only after it confirms) still needs the owner's go-ahead and the flag on.

## 6. If approved, the next steps

1. Owner marks #403 ready and merges (by Wed Nov 4, never Nov 6 to 8).
2. A `+alias` signup to check the three places and a referred signup (credited only after confirming).
3. To roll back: set the flag to `"false"` and merge.
