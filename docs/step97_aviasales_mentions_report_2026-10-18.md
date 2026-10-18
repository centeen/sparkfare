# Step 97 report: where live copy names Aviasales (read-only, 2026-10-18)

Report only (D-018). No copy changed, no PR. Non-attorney: whether a mention is needed is a judgement for the owner and, for anything binding, an attorney. Source: `git ls-files` HTML, JS and Python on `main` at `73ca24e`, searched for "aviasales" (case-insensitive); tests, data files and code-only uses (hostnames, `/out/aviasales` paths, `AVIASALES_CAMPAIGN_ID`, `isAviasalesLink`) are not copy and are left out. 14 files carry user-visible mentions; the 81 blog posts carry one (`blog/what-happens-after-you-click-book.html`); `/data/*` pages and `check.html` carry none.

Rule applied: where a user leaves Sparkfare, the copy still says it is a third-party site, that Sparkfare earns a commission, and names the seller once (disclosure and handoff step). Fewer mentions elsewhere.

## A. Mentions to reduce (proposed)

| # | Where | Current text | Proposed text | Needed for honesty here? |
|---|---|---|---|---|
| A1 | `index.html` lines 1400, 1445 and 1811 (hero, card and watchlist fare links), and `src/ptoPages.js:212` (`FARE_ARIA`) | aria-label "View this fare on Aviasales (opens in a new tab). Sparkfare does not sell or book travel." | "View this fare on the booking site (opens in a new tab). Sparkfare does not sell or book travel." | No. The inline line under the grid still names the seller (B1). Screen-reader users hear one fewer brand name; they still hear it is a third-party site. |
| A2 | `src/email.js:1077` and `:1130` (daily digest and watchlist email fare link text) | "View fare on Aviasales" | "View fare" (matches the homepage buttons since PR #121) | No, if the email's disclosure line (B2) still names Aviasales. Note `tests/fixtures/daily_email_v1.json` pins the v1 digest byte for byte; that fixture would change. |
| A3 | `src/email.js:1615` (PTO email) | "View fare on Aviasales ↗" | "View fare ↗" | No (same reason). |
| A4 | `src/referralCopy.js:40` `EMAIL_PRIMARY_BUTTON` | "Continue to Aviasales" | "View fare" | No. Used as a button, and the fare buttons elsewhere already read "View fare". |
| A5 | `trips.html:7` (meta description) and `:214` (sub heading) | "Track the fares you've clicked through to Aviasales..." / "Every fare you've clicked through to Aviasales, tracked here." | "Track the fares you've clicked through to our booking partner..." / "Every fare you've clicked through, tracked here." | No. This is an account page after the click; the seller was named at the handoff. |
| A6 | `about.html:100` | "...supplied through Travelpayouts (Aviasales)..." | "...supplied through Travelpayouts..." | Data-source credit. Travelpayouts alone is accurate; the seller is named two paragraphs down (B3). |
| A7 | `blog/what-happens-after-you-click-book.html:72` | "There's always a manual "Continue to Aviasales" link..." | "There's always a manual "Continue" link..." (the interstitial CTA, if B4 is kept, still says Aviasales; the post should match whichever the owner picks) | No. Also see the flagged spot F3 (the post's title and slug contain "book"). |

## B. Mentions kept on purpose (each with its reason)

| # | Where | Text | Reason to keep |
|---|---|---|---|
| B1 | `index.html:1620` `GRID_DISCLOSURE` and `:1812`; `src/referralCopy.js:18` `FARE_DISCLOSURE_LINE` | "Links go to Aviasales, which handles booking and payment. Sparkfare may earn a commission if you buy through a link, at no extra cost to you." | The one inline seller identification at the fare, with the commission disclosure. Required by the rule above. |
| B2 | Email footers using `FARE_DISCLOSURE_LINE` | same sentence | Same reason; the disclosure appears before the links (FTC practice already followed). |
| B3 | `about.html:102` and `:104`, `disclosure.html:99` | "sends you to Aviasales, which handles booking and payment"; "fare links to Aviasales"; "Aviasales/Travelpayouts (flight booking links)" | The factual identification of the seller and of the affiliate relationship. The disclosure page is the right place to name the relationship fully. |
| B4 | `src/referralCopy.js:21-23` interstitial heading, CTA and partner note | "Check this fare on Aviasales"; "Continue to Aviasales ↗"; "Aviasales, not Sparkfare, confirms the final price and handles booking and payment." | The handoff step, where the user leaves Sparkfare. D-018 keeps one clear identification here. If the owner wants one fewer mention, only the CTA could become "Continue ↗" (the heading and note already name the seller). Not proposed: it removes the clearest honest signal at the moment of leaving. |
| B5 | `src/referralCopy.js:12` and `site-footer.js:6` footer line 1 | "When you click a fare, you buy from Aviasales or another site you choose." | Sitewide footer. It names the seller once per page. Proposed by the pre-existing copy; keep unless the owner wants it generic. |
| B6 | `src/email.js:813` and `:815` booking-reported email | subject "Looks like you bought X on Aviasales", "Aviasales reported a purchase from your Sparkfare click" | It states a fact that came from Aviasales' report, to a user who clicked. Not marketing. Keep. |
| B7 | `src/email.js:1129` (watchlist email body, "Aviasales co..." inside the disclosure sentence) | disclosure sentence naming Aviasales | Same as B2. (The line is long; the full sentence was not re-read for this report.) |

## C. Flagged spots (not copy, or unsure; left alone)

- F1. "our travel search partners" and "Continue to fare search": with Fare Search parked (D-007) the only handoff is Aviasales, so that wording would be less honest than naming it. Not proposed.
- F2. The interstitial line that is "arm-specific, rendered from `trips.fare_path`": routing plus a column. Not copy; stays with steps 77 to 83.
- F3. `blog/what-happens-after-you-click-book.html` is titled with "book" and its slug contains it. The referral-copy checker allows it today (allowlist); changing the slug needs a redirect and a sitemap change. Owner decision.
- F4. The proposed extension of `scripts/check-referral-copy.js` to flag "Aviasales" outside an allowlist is a guard, not copy. If the owner wants it, the allowlist would be: `src/referralCopy.js` (B1, B2, B4, B5, B6), `about.html`, `disclosure.html`, `index.html:1620/1812`.
- F5. The disclosure sentence about `fares.sparkfare.com`: not proposed (the thing does not exist).
- F6. `disclosure.html` is unchanged in this report. If the owner wants wording changed there it needs proposed text first.
- F7. `scripts/` and `Phase 20 Blog Generator.py` were searched; no user-visible mention beyond those above. Worker route pages (`/flight/`) use `FARE_DISCLOSURE_LINE` (B1) and no other mention.

## D. PR order if approved (one at a time; none before Mon Oct 19; last merge Wed Nov 4)

1. **Fare-link accessibility labels (A1)**: `index.html`, `src/ptoPages.js`. Overlaps J2/K-A6 (the card anatomy) on `index.html`, so it should ship inside that PR if J2 lands first. Test: `tests/partner_link_rel.test.js`, `tests/j1_display.test.js` aria assertions to update.
2. **Emails (A2, A3, A4)**: `src/email.js`, `src/referralCopy.js`; update the v1 fixture on purpose and say so in the PR.
3. **Account and about pages (A5, A6)** and **the blog post (A7)**: copy only.
Each PR shows before and after text in its description; `npm run check:copy` must pass.

## E. Questions for the owner

1. Approve A1 to A7 as proposed, or strike any?
2. B4: keep the interstitial CTA "Continue to Aviasales ↗" (recommended), or shorten it?
3. F3: rename the post (needs a redirect) or leave?
4. F4: do you want the checker extension?
5. Do A1 and the fare-link wording wait for J2/K-A6 so the anatomy is changed once?
