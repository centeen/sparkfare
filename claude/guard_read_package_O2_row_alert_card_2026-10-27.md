# Guard read package: O2 end-of-row alert card and its privacy sentence (PRs #405 and #406)

For the Hub, 2026-10-27. **Status:** the card is built and merged dark (#395, flag `ENABLE_ROW_ALERT_CARD="false"`). The measurement event is merged and inert (#406). The flip PR is #405 (draft, CI green). Copy below is quoted from `row-alert-card.js` and `privacy.html`. The card copy is Design Council D-046 v2 and has not been changed.

**What the Hub is asked for:** (1) a Guard read of the rendered card, (2) a read of the new privacy sentence (it is live copy and has not had a read), (3) an answer to the two questions in section 5.

## 1. The card (exact copy)

Shown only in the "Today's deals" grid, only when the grid's last row has an empty track at the current width. Never in "Worth a look", "On the board" or "Building history", never when "Today's deals" is empty, never at one column.

> **That's every real deal from {City} today.**   (the words "real deal" link to `/how-it-works#deal-rule`)
> Get the next one by email.
> [ Email field, placeholder `name@email.com`, visible label for screen readers: "Email" ]  [ **Create alert** ]
> One daily digest.
> Or watch one route (sign-in needed)   (links to `/watchlists`)

Screenshot (desktop, flag forced on locally): `docs/handoff/o2_row_alert_card_desktop_2026-10-26.png`. More sizes were rendered locally (MIA at 1366 and 1440 px, JFK, MSP, 375 px); they are not committed (images under `docs/` would deploy as public files, so `docs/` is now in `.assetsignore`).

**Where it appears (measured in a real browser, local data):** MIA at 1366 px has 2 deals in 4 columns, so the card spans 2 tracks; JFK has 7 deals, so it spans 1 track. MSP has no "Today's deals" section, so no card. At 375, 720 and 800 px (one or two full columns) there is no card. Resizing re-places it; it is never duplicated.

## 2. Rules check

| Rule | Where it stands |
|---|---|
| No "only", pressure counts, countdowns, "book", "secured", savings claim, traveler date | A test scans the card copy for them; `npm run check:copy` passes. |
| "Unsubscribe anytime." | **Not used.** The verification email has no visible unsubscribe link (O0 report, item 5), so the note reads "One daily digest." |
| The claim "every real deal" | "Real deal" is the product's own rule: at least 15% below the route's 30-day median, at least 10 distinct observation days, passes the rare-find test (`/how-it-works#deal-rule`). The card appears only when the grid has fewer deals than fill the row, and says "every real deal from {City} today", which is what the grid shows. The rule is stated on the page the words link to. |
| Same signup as the hero form | The form calls the homepage's own signup function: same endpoint, validation, messages, consent and double opt-in; only `source` differs (`home_row`). Both payloads were captured in a browser: identical keys, `origin_iata` the selected airport, nothing added. |
| Look | Card surface, Ink text, sage action, 44 px targets, visible focus, labelled field, `aria-describedby` on the note. No photo, price, Deal chip or gold. |

## 3. What it records (new in #406, live only while the flag is on)

One event per page view when the card is shown: the airport, `source: home_row`, and how many empty tracks it filled (1 to 4). The Worker adds whether the visitor looks automated. **It never stores an email, an account ID or free text** (a test sends all three and checks none is kept). A `docs/row_card_metrics.sql` query turns it into "card signups per 100 card views".

## 4. The privacy sentence (added to #405; live copy; needs a read)

Added to the "Analytics and activity logging" paragraph of `privacy.html`, right before the sentence about outbound clicks:

> If the homepage shows the email sign-up card at the end of today's deals, we also log that it was shown, as a count with the airport you chose and how many columns it filled; it carries no email address, account ID or other identifier.

The page's "Last updated" date moves to October 27, 2026. The page's own caveat ("not yet had a legal review") is unchanged. A test fails if the flag is on without this sentence, and checks that the Worker stores only what it says.

## 5. Questions for the Hub

1. **"Every real deal from {City} today."** Is "every" right when the grid shows only the deals that pass the rule for that airport (and a thin airport may show zero, in which case no card appears)? Alternative: "These are today's real deals from {City}."
2. **Watch link.** "Or watch one route (sign-in needed)" sends a signed-out visitor to a sign-in page. Acceptable as the secondary action, or should it say what a watchlist is ("Or get an email when one route drops (sign-in needed)")?
3. **Privacy sentence.** Is the wording and level of detail right?

## 6. What is not verified

- The card has not been seen on production (flag off; my session cannot reach the site). Local checks only: a fake-DOM unit suite for every render rule (18 tests), real-browser screenshots, and the signup path against real SQLite.
- **Measurement limit:** the event gives the card's own rate. It cannot give "per 100 desktop visits without the card", because `landings_daily` has no device split. The comparison available is card signups per 100 card views against the hero form's rate.
- The acceptance test signup from the card (`+alias`) needs the flag on and the owner's go-ahead.

## 7. If approved, the next steps

1. Owner marks #405 ready and merges (by Wed Nov 4, never Nov 6 to 8).
2. A `+alias` signup from the card on production: it should arrive with `signup_source = home_row`, the right airport, and the same confirmation email. A card view should appear as `row_card_view` in `events`.
3. To roll back: set the flag to `"false"` and merge.
