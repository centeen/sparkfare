# Addendum O, O0 report (read-only), 2026-10-26

Written by Claude Code against `main` (index.html last changed in `f1c933cd`, 2026-10-24) and production. No code was changed for this report. Measurements were taken in a real browser against a local static server serving `main`'s files and the checked-in data of 2026-10-26; production's `index.html` was compared by hash and is byte-identical to `main`'s (sha256 `4fe21b24baa02396…` on both).

## Summary

1. **The Hub's inferred cause is not the live structure.** The synced `index.html` the Hub read had the old `.hero { grid-template-columns: 1.2fr 1fr }`. The live page (Brand v1, K-B2) puts the hero in the **right column of a two-column `.home-top` grid** (from 900 px up): the **left column is the intro, the airport selector and the signup box (394 px tall)** and the **right column is the hero, which stacks a 380 px photo above its details (699 px tall)**. The empty block the owner marked is under the signup box, **305 px** on MIA and JFK, **413 px** on MSP.
2. **A CSS-only fix exists and is measured** (below, with the proposal for O1): at 900 px and up, lay the hero out as photo-beside-details and let the photo fill the column's height. The hero then ends exactly where the left column ends (0 px difference on MIA), the first board card moves up by the whole gap, and the hero "View fare" button moves from y=732 to y=373.
3. **Open items for the owner before O2 ships** are in section "What O2 needs from you".

## 1. Which file and CSS render the hero and the deal grid

`index.html` (commit `f1c933cd`; same file on production). The rules that matter:

```css
/* line 272: the original hero rule. Still in the file, but overridden inside .home-top (below) */
.hero { display: grid; grid-template-columns: 1.2fr 1fr; gap: 28px; padding: 16px 0; border-bottom: 1px solid var(--border); align-items: center; }

/* lines 359-363: the deal grid */
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }

/* lines 534-545: K-B2, what actually lays out the top of the page */
.home-top { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; grid-template-areas: "intro" "origin" "hero" "signup"; margin-bottom: 8px; }
.home-top .hero { grid-template-columns: 1fr; gap: 16px; padding: 0; border-bottom: 0; }
.home-top .hero-photo { max-height: 240px; }
@media (min-width: 900px) {
  .home-top { grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); column-gap: 40px; grid-template-rows: auto auto 1fr; align-items: start;
    grid-template-areas: "intro hero" "origin hero" "signup hero"; }
  .home-top .hero-photo { max-height: 380px; }
}
```

The hero markup is `section.hero.ticket > div (img.hero-photo + p.attribution) + div (label, route, price, basis, dates, perforation, actions, disclosure)`. Below 900 px the page is one column (intro, airport, hero, signup), so there is no side-by-side imbalance there.

## 2. Measurements (before), 1366×768 and 1440×900

The page content is capped at 1,140 px wide, so 1366 and 1440 lay out identically; only the viewport height differs. All numbers are CSS pixels from the top of the document.

| Origin | Left column bottom (intro, airport, signup) | Hero bottom | Hero height | Gap (hero bottom − left bottom) | First board card top | Hero "View fare" top–bottom |
|---|---|---|---|---|---|---|
| MIA | 498 | 803 | 699 | **305** | 1052 | 732–776 |
| JFK | 498 | 803 | 699 | **305** | 1052 | 732–776 |
| MSP | 498 | 911 | 806 | **413** | 1160 | 839–883 |

- Left column: intro 105–279, airport bar 295–335, signup box 351–498 (500 px wide). Right column: photo 380 px tall (`max-height: 380px`), then the details.
- At 1366×768 the MIA and JFK "View fare" button straddles the fold (bottom 776 > 768); at 1440×900 it is above the fold. On MSP it is well below the fold at both sizes.
- Screenshots (before): `scratch/o_screens/before_1366x768_MIA.jpg`, `before_1440x900_MIA.jpg` (local files, not committed: images under `docs/` would be deployed as public assets).

## 3. Cards and empty tracks in "Today's deals"

| Origin | "Today's deals" cards | Columns | Empty tracks in the last row |
|---|---|---|---|
| MIA | 2 (the hero takes the best deal, so it is not repeated) | 4 | **2** |
| JFK | 7 | 4 | **1** |
| MSP | **no "Today's deals" section** (no deals today; first section is "On the board", 3 cards) | 4 | n/a, the card must not render |

Other sections today (for reference): MIA "Worth a look" 5 cards (3 empty), "On the board" 13 (3 empty); JFK "Worth a look" 7 (1 empty), "On the board" 16 (0 empty); MSP "Building history" 1 (3 empty). The card only goes in "Today's deals".

## 4. Does `/watchlists` need sign-in for a guest?

Yes. `watchlists.html` (lines 538-539) redirects a guest to `/sign-in?redirect_to=/watchlists` once Clerk reports no session. So the link text must read "Or watch one route (sign-in needed)".

## 5. Does every email a homepage signup triggers carry a working unsubscribe link?

No, not as a visible link in every email.

| Email | Visible unsubscribe link in the body | `List-Unsubscribe` header (one-click) |
|---|---|---|
| Verification (`sendVerificationEmail`): sent right after the signup | **No** (body: welcome line, verify link, optional referral block) | Yes (added by `sendEmailWithGuard`, signed token) |
| Daily digest (v2): sent after the address is verified | Yes | Yes |
| Welcome or referral email | None exists: `/welcome` is a page, and the referral prompt is a block inside the verification email | n/a |

So the optional line "Unsubscribe anytime." is **not** confirmed by the Addendum's condition. O2 will ship "One daily digest." The line is a single constant, so it can change in a one-line edit if the Hub accepts the header as a working unsubscribe link, or if the owner wants a visible unsubscribe link added to the verification email (an email change; not part of Addendum O).

## 6. The method page and anchor for the deal rule

`/how-it-works` (`how-it-works.html`). The rule is in the card headed **"2. Deal Floor & Statistical Volatility"**, which has **no `id`** today (only the FAQ card has one). Quoted text:

- "A route only earns a Deal badge when today's fare satisfies two strict criteria:" … "**15% Deal Floor (D-021).** A price must be at least 15% below its trailing 30-day median to be considered a deal. Anything less is classified as Typical."
- "**10-Day Minimum History.** We require at least 10 distinct observation days across a minimum 14-day span. Routes below this threshold show "Building history" and are never scored blind."

Proposal: add `id="deal-rule"` to that card (an anchor, no text change) in the O2 PR and link "real deal" to `/how-it-works#deal-rule`.

## 7. Signup source and surface tags

- Allowed `signup_source` values (`SIGNUP_SOURCES`, `src/growth.js`): `home, check, leave, pto, widget, route, digest, share, referral, report, direct`. The hero form posts `source: 'home'` (`index.html:1886`). Channel and campaign come separately from `attribution.js` (N5) and are stored as `signup_channel` / `signup_campaign`.
- **Proposed value for the card: `source: 'home_row'`.** It needs one addition to `SIGNUP_SOURCES`; the existing `users.signup_source` column, the `signup` event and the By source table on `/admin/growth` then show it with no schema change and no change to the hero form's `home`. It carries no date, route or trip detail.
- **The G107 denominator is not measurable today.** `landings_daily` counts home-page sessions per channel and day but has no desktop/mobile split and no "card rendered" flag, so "signups per 100 desktop homepage visits with the card rendered versus without" cannot be read from it. The tag alone gives the numerator. Options (owner's call, not built): (a) a counts-only `row_card_view` event sent once per page view when the card renders (needs the `/api/events` allowlist, the N12 registry and a line in the privacy page's event sentence); (b) read the card's signups per 100 home landings overall and accept that the denominator is not split by device. I recommend (a) before the flag flip.

## O1 proposal (measured on MIA, with CSS injected into the live page)

At 900 px and up, inside `.home-top`: let the hero stretch to the left column, lay the hero out as two columns (photo beside details), and let the photo fill its column's height with `object-fit: cover` (no distortion; the credit line stays under it).

| | Before | With the change |
|---|---|---|
| Hero bottom vs left column bottom | 305 px lower | **0 px** (394 px each) |
| First board card top | 1052 | **747** (up 305) |
| Hero "View fare" top–bottom | 732–776 | **373–417** (above the fold) |
| Photo | 600×380 | 290×368, cropped by `cover`, not stretched |

Edge cases to check in O1: MSP (a hero that is not a deal and has a taller details column), a hero with no photo (the fallback block), the 900–1,100 px range, and 1,920 px.

## What O2 needs from you

1. **Unsubscribe line:** confirm "One daily digest." (my default), or tell me the header counts, or add a visible unsubscribe link to the verification email.
2. **Tag:** confirm `source: 'home_row'`.
3. **Denominator:** choose (a) `row_card_view` event or (b) no device split.
4. **Anchor:** confirm adding `id="deal-rule"` on the how-it-works card.

Nothing for O1 or O2 depends on these except the card's last line and its tag, so both PRs can open now.
