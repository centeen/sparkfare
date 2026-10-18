# Step 97 report: user-visible mentions of Aviasales (D-018, Addendum H Task C, copy-only part)

Status (updated 2026-10-18 evening): **the report below is the original, written before any PR. A stack was then built from it**, so read the table in "Where each row stands now" first. Nothing is merged; all PRs are drafts and none merges before Mon Oct 19.

## Where each row stands now

| Report rows | PR | State | Notes |
|---|---|---|---|
| 1 to 3 (footer line, grid and hero disclosure, aria-labels) | #303 | **Closed, not merged.** | It changed the sentence the report says to keep and the aria-labels the owner wanted to wait for the fare-card work. K-A6 (the fare card) has since merged, so the aria-labels (rows 3) can be redone on the new card in a new PR if you still want them. Rows 1 and 2 are not covered by any open PR. |
| 4 to 6 (email buttons and disclosures) | #304 | Open draft, no conflicts with `main` as of 2026-10-18. Changes the pinned v1 digest fixture on purpose. | Each email's disclosure now names Aviasales once, so removing it from the link text does not leave the email with no seller identification. |
| 10 and 11 (`trips.html`, `about.html` data-source credit) and the blog slug | #305 | Open draft, stacked on #304. | Row 11 is partly changed: the data-source credit drops "(Aviasales)"; the other two `/about` mentions stay. Renames `what-happens-after-you-click-book` to `...click-a-fare` with 301s from the old URL and its `.html` form. |
| Checker extension (question 4) | #306 | Open draft, stacked on #305. | New ratchet rule `aviasales-mention`; no visible change. |
| 7 (interstitial heading), 8, 9, 12, 13 | none | Kept unchanged, as proposed. | |

**Still open for you:** rows 1, 2 and 3 have no live PR (decide if you want a fresh, small one now that K-A6 is merged); row 7 (interstitial heading) has none; merge order if you approve the rest is #304, #305, #306, each retargeted to `main` after the one before merges. I have not recorded your answers to the four questions below in `state_DECISION_LOG.md`, because they are not in the repo; the #304 description says you approved its wording on 2026-10-18.
Scope: copy only. Travelpayouts Affiliate Agreement clauses 2.4.1 to 2.4.3 (R-003). Non-attorney reading.
Method: `git grep -i aviasales` over every tracked `.html`, `.js`, `.py` outside `scratch/`, `claude/`, `docs/`, `tests/`, `data/`, hourly snapshots. Checked 2026-10-18 on `main`.

## Counts

- `data/*.html` (880 route pages): 0 mentions. `blog/*.html`: 1 file, 1 mention. The generators for pSEO, blog, newsletter and social post: 0 visible mentions.
- The sitewide footer is one line in `site-footer.js` (every static page) plus the same line in `src/referralCopy.js` (Worker pages). Two sources, kept equal by `tests/referral_copy.test.js`.
- Everything else is URLs (`booking_link` in the JSON feeds, `/out/aviasales`), code identifiers, comments and the partner registry. None of that is user-visible and none is touched.

## Mentions, with proposal

"Needed for honesty?" = does the page still tell the visitor they are leaving Sparkfare for a third-party site that sells the ticket, and that Sparkfare earns a commission, if the word is removed there.

| # | Where | Current text | Proposed text | Needed for honesty at this spot? |
|---|---|---|---|---|
| 1 | `site-footer.js:6` and `src/referralCopy.js:12` (`FOOTER_LINE_1`), every page | "...When you click a fare, you buy from Aviasales or another site you choose." | "...When you click a fare, you buy from the airline or booking site you choose." | No. The handoff step and `/disclosure` still name the seller. |
| 2 | `index.html:1620` and `:1812` (`GRID_DISCLOSURE`, hero and grid), `src/referralCopy.js:18` (used by `src/ptoPages.js:244`) | "Links go to Aviasales, which handles booking and payment. Sparkfare may earn a commission if you buy through a link, at no extra cost to you." | "Fare links go to a third-party booking site, which handles booking and payment. Sparkfare may earn a commission if you buy through a link, at no extra cost to you." | No, **provided** "third-party booking site" and the commission sentence stay. **Do not use** Task C's "our travel search partners": Fare Search is parked, so it would describe something that does not exist and is less honest than naming the site. |
| 3 | `index.html:1400, 1445, 1811` and `src/ptoPages.js:212` (`FARE_ARIA`) | "View this fare on Aviasales (opens in a new tab). Sparkfare does not sell or book travel." | "View this fare on a booking site (opens in a new tab). Sparkfare does not sell or book travel." | No (the visible button already reads "View fare ↗", and the line under the grid says what the link is). |
| 4 | `src/email.js:1077` (daily digest v1 fare link), `:1130` (watchlist), `:1615` (PTO email) | "View fare on Aviasales" / "View fare on Aviasales ↗" | "View fare ↗" (matches the homepage pattern) | **Unsure, owner's call.** These links go straight to `/out/aviasales` with no interstitial, so the email is the only place the visitor could learn who they are going to. Proposal keeps one factual identification in each email body (see 5), not on the button. |
| 5 | `src/email.js:1129` (watchlist body) | "...Aviasales confirms the final fare." | "The booking site confirms the final fare." | Same question as 4. Alternative: keep this one sentence as the single identification in the email. |
| 6 | `src/referralCopy.js:40` (`EMAIL_PRIMARY_BUTTON`, used by the v2 email `src/postClickEmail.js:339, :369`) | "Continue to Aviasales" | "View fare" | Same question as 4. The v2 email footer already says purchases are made "with the airline or booking site you choose". |
| 7 | `src/referralCopy.js:21` (`INTERSTITIAL_HEADING`), `/departing/:trip_id` | "Check this fare on Aviasales" | "Check this fare" | No, because the button and the note below it still name the site. |
| 8 | `src/referralCopy.js:22, :23` (`INTERSTITIAL_CTA`, `INTERSTITIAL_PARTNER_NOTE`) | "Continue to Aviasales ↗" / "Aviasales, not Sparkfare, confirms the final price and handles booking and payment. Fares change." | **Keep unchanged.** | **Yes. This is the handoff step.** Addendum H requires one clear, factual identification of the seller here. Task C's "Continue to fare search" is not true while Fare Search is parked. |
| 9 | `src/email.js:813, :815` via `bookingReportedSubject/Opening('Aviasales')` | "Looks like you bought {destination} on Aviasales" / "Aviasales reported a purchase from your Sparkfare click." | **Keep unchanged.** | Yes. It states which partner reported the purchase; a factual account of an event, not a promotion. Unsure if you agree; neutral wording would be "our booking partner reported...". |
| 10 | `trips.html:7` (meta description) and `:214` (subtitle) | "Track the fares you've clicked through to Aviasales..." / "Every fare you've clicked through to Aviasales, tracked here." | "...clicked through to a booking site..." / "Every fare you've clicked through to a booking site, tracked here." | No. |
| 11 | `about.html:100, :102, :104` | Names Aviasales as the data source (via Travelpayouts), as the site that "handles booking and payment", and as the destination of fare links. | **Keep unchanged.** | Yes. Factual description of the relationship, on the page that explains it. |
| 12 | `disclosure.html:99` | "Current affiliate relationships include Aviasales/Travelpayouts (flight booking links), ..." | **Keep unchanged** (Addendum H: `disclosure.html` changes only if you approve text). | Yes. Material connection, named. |
| 13 | `blog/what-happens-after-you-click-book.html:72` | "There's always a manual 'Continue to Aviasales' link..." | **Keep unchanged.** | It describes the interstitial button, which row 8 keeps. If row 8 ever changes, this changes with it. |

After these changes the named mentions left on live pages are: the interstitial button and its note (the handoff), `/about` (3), `/disclosure` (1), one blog post, and the factual purchase-reported emails. Removed: the sitewide footer, the grid and hero line, 4 aria-labels, 3 email buttons plus 1 email body line, the interstitial heading, and 2 lines on `/trips`.

## Left out on purpose (not copy, or untrue while Fare Search is parked)

- The arm-specific interstitial line rendered from `trips.fare_path` (needs the column and routing: Task B, parked with steps 77 to 83).
- Extending `scripts/check-referral-copy.js` to flag "Aviasales" outside an allowlist. A guard, not copy. Suggested follow-up if you want it: allowlist = `about.html`, `disclosure.html`, `privacy.html`, blog posts, `src/interstitial.js` strings, `src/referralCopy.js` handoff constants, purchase-reported emails.
- The proposed `disclosure.html` sentence about results on `fares.sparkfare.com` (would describe a thing that does not exist).
- "our travel search partners" and "Continue to fare search" wording (see rows 2 and 8).
- All URLs, `/out/aviasales`, `fare-routing.js`, the partner registry, comments and JSON feeds. No flag, routing or partner change.

## Proposed PR order (one at a time, each needs your approval, none before Mon Oct 19 or in the Nov 6 18:00 ET to Nov 8 freeze)

1. **Footer + grid line + aria-labels** (rows 1 to 3): `site-footer.js`, `src/referralCopy.js`, `index.html`, `src/ptoPages.js`, tests that pin the strings (`tests/referral_copy.test.js` and any test reading the old text). Touches the same lines as the K-A3 copy pack and J2, so it must be rebased on whatever merges first.
2. **Emails** (rows 4 to 6), after you decide the email-identification question: `src/email.js`, `src/referralCopy.js`, `src/postClickEmail.js`, email tests.
3. **Interstitial heading + `/trips`** (rows 7 and 10): `src/referralCopy.js`, `trips.html`.

Each PR: `npm run check:copy` and `npm test` must pass; before and after table of changed strings; no behaviour change.

## Questions for you

1. Rows 4 to 6: neutral email button with one named identification in the body, or keep naming Aviasales on the email button because emails skip the interstitial?
2. Row 9: keep the purchase-reported emails naming Aviasales (my recommendation), or neutralise?
3. Row 2: is "third-party booking site" acceptable as the grid disclosure wording?
4. Do you want the checker extension proposed above as a separate PR?
