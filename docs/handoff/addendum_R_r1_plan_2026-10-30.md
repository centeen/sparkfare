# Addendum R, R1: surface list and wording diffs (draft, 2026-10-30)

Roadmap step 182. **Nothing here is built.** This is the plan to send the Hub's Guard. Code starts per group once the Guard has read that group's final strings and the owner approves the PR (merge train, D-035). Branch for the work: `r/r1-<group>`, one per group below. Latest allowed merge Wed Nov 4; Nov 5 is fix-only; no merges Nov 6 18:00 ET to Nov 8.

## What changes everywhere

| Today | After R1 |
|---|---|
| Freshness line for a current fare: "Checked {n} h ago · {time} {zone}" | "From search data · updated {n} h ago · {time} {zone}" |
| (nothing) | A small note under the dates row: "Price can differ on Aviasales. Bags may cost extra." |

Unchanged on purpose: "View fare ↗", the commission disclosure, the Deal chip, the basis line ("{p}% below 30-day median, {n} observations"), the visitor-zone display, the 48-hour window, and "Last seen {date}" past 3 days. The "carried" wording ("Last seen {time}. No newer price today, so this one is carried forward.") and the "aging" wording ("Prices as of {time} · {n} days ago") do not contain "Checked" and are not in the handoff's table, so they stay (question Q2 below).

## Surface groups (one PR each)

### R1a Homepage tickets and hero (`index.html`)
- `asOfText()` (line ~1272): `'Checked ' + relativeAge + ' · ' + when` becomes `'From search data · updated ' + relativeAge + ' · ' + when`. `relativeAge` gives "3 h ago" / "under 1 h ago", so the line reads "From search data · updated 3 h ago · Oct 30, 9:00 AM UTC". Visitor-zone swapping (`as-of-local.js`) is untouched.
- `ticketBodyHTML()` (line ~1401): add `<p class="ticket-note">Price can differ on Aviasales. Bags may cost extra.</p>` directly under `.ticket-detail` and above the freshness line, for every fare that has a View fare link (not for a "Last seen" row, which has no link). Style: `0.8125rem`, `--muted-dim`, the same as `.ticket-asof`. The hero uses the same function, so it gets the same note.
- Tests to change: `tests/j1_display.test.js` (lines 55 to 57), `tests/k_a6_fare_ticket.test.js` (line 64, the order test: detail, note, then the freshness line), `tests/a6_visitor_zone.test.js` (lines 40, 41, 83), `tests/fare_data_age_copy.test.js` (comment at line 5, which records the owner's Oct 19 decision to keep "Checked"; the new decision D-053 supersedes it).

### R1b Route pages (Worker) and the 880 pSEO pages
- `src/priceFreshness.js` `fareNote()` (line ~89): same replacement as R1a. This feeds the Worker route page and, with `markup = true`, the `data-asof` span.
- Add the same note line in the route-page hero (`src/index.js`, around the price block that calls `fareNote`, line ~6316).
- `Phase 17 pSEO Generator (Step 106).py` `asof_text()` (line ~205): `f"Checked {marked}."` becomes `f"From search data · updated {marked}."`, and the same note is added to the ticket markup (line ~314). **This regenerates all 880 `/data/` pages.** Python is not installed on this machine (only `py` is mentioned in my notes and was not checked), so the PR will carry the generator change and the pages regenerate on the next compile run, or I regenerate in CI. The Guard condition "no 'Checked' wording survives on any surface" holds on `data/` only once the pages are regenerated; the PR will say which of the two was done.
- The route-page footer "Fare data retrieved {date}. Prices may change." (`src/index.js` line ~5773) stays (question Q3).
- Tests to change: `tests/j1_route_page_freshness.test.js` (line 29), `tests/k_b3_route_page.test.js` (line 124), `tests/a6_visitor_zone.test.js`, and the pSEO generator tests that assert "Checked".

### R1c Interstitial (`src/referralCopy.js`, `src/interstitial.js`)
- Keep `INTERSTITIAL_HEADING` "Check this fare" and the button "Continue to Aviasales ↗".
- Add after the existing `INTERSTITIAL_PARTNER_NOTE` ("Aviasales, not Sparkfare, confirms the final price and handles booking and payment. Fares change."): a new line "Sparkfare shows prices from recent search data, not a quote for your dates. The price on Aviasales may be different." Two adjacent sentences say nearly the same thing; I propose **replacing** the old note with the new pair if the Guard agrees, so the page does not repeat itself (question Q4).
- `tests/referral_copy.test.js` already pins the strings; `site-footer.js` is not involved.

### R1d Emails (digest v1 and v2, weekly, lifecycle, watch, welcome)
- Add one shared constant (proposed `FARE_SOURCE_LINE` in `src/referralCopy.js`): "Prices come from recent search data for one adult, round trip, and can differ on Aviasales."
- Place it next to the deal-information footer line on every email that carries a fare. Digest and weekly: the footer of `src/emailTemplates/dailyDigest.js` (near `DISCLOSURE_TEXT`, line 10, and the plain-text footer, line ~447). Watch, long-weekend and PTO-watch emails: `src/email.js` lines ~1451 to 1494 and ~2054. Welcome and lifecycle: the shared shell/footer path (`emailShell`, `src/emailCompliance.js` footer injection).
- Existing "Fare data retrieved {as-of}." lines stay; they state when we asked, which is still true.
- Must be rebased on the Q work already merged (Q4 footer helper, Q1/Q2/Q5, C1.4). `npm run check:copy` will check the string. Email snapshot fixtures (`tests/fixtures/daily_email_v1.json` and similar) change by exactly one line each.

### R1e Static explainer pages (`how-it-works.html`, `disclosure.html`)
- Add, as one short paragraph in each: "Fares are the lowest round-trip price for one adult that appeared in recent search data. They are not quotes. The price on Aviasales can be higher or lower, and the deal comparison uses our own 30-day history, not the Aviasales price."
- `how-it-works.html` also carries FAQ JSON-LD (lines ~275 and ~406); I propose adding the same sentence to the matching answer so the structured data does not contradict the page (question Q5). `check.html` (lines 50 and 270) explains the Deal rule and is not in the handoff's table; I propose the same one-line addition or leave it (question Q5).

### R1f Social and share (text and images)
- `buildXPostText()` (`src/index.js` line ~883): today "JFK to Cape Town, South Africa: $721 round trip -- 28% below its 30-day median." followed by the link. Append "Seen in search data; price can differ on Aviasales." before the link. Length is about 130 characters plus the link, inside X's limit.
- `Phase 3 Social Broadcaster.py` (lines ~411, ~366, ~240): the daily post text is "Current flight price observation: {origin} to {dest} is ${price}." Append the same sentence. Bluesky allows 300 characters; the longest destination names keep the post under about 190 plus the link. The Telegram caption already adds "*Includes affiliate links*".
- OG/share card (`ogCardHtml`, `src/index.js` line ~5747): already shows `basis_text` and an as-of time. Add the same sentence in small type, and make sure it fits the 1200x630 canvas (the existing test measures text boxes with `satori`; it will need a new case).
- Pinterest (`src/pinterest.js` line 129; flag off, sandbox only): update the caption now so it is correct when the flag is turned on.

## What I will send for the Guard read

The final strings in one list: the two card lines; the interstitial pair; the email footer line; the explainer paragraph; the social sentence. Plus these questions.

## Questions for the Guard (not decided)

- **Q1 Aviasales naming vs Addendum H step 97.** The card note, email footer and social sentence name Aviasales in many more places than D-018's "one honest naming where a visitor leaves". May the card note and social sentence say "the booking site" instead ("Price can differ on the booking site.")? The handoff's strings say Aviasales.
- **Q2 Other freshness states.** Keep "Last seen ..." (carried) and "Prices as of ..." (aging) as they are?
- **Q3 Other "retrieved" wordings.** Keep "Fare data retrieved {date}" in emails, route-page footer, OG card and Pinterest, and "search data retrieved" in watch/PTO emails, or unify all of them to one wording?
- **Q4 Interstitial.** Replace the existing partner note with the new pair, or keep both?
- **Q5 Explainer pages.** Add the paragraph to `/check` and to the FAQ JSON-LD as well?
- **Q6 "Bags may cost extra."** True for many fares and not for others (some include a bag). Is "may" enough substantiation, or should it say "Baggage fees vary by airline."?
- **Q7 "From search data".** Guard condition 3: it must be literally true for every fare it labels. The fare comes from the Travelpayouts cache, which is search data. R0 section 2 says the cache can be about two days old; the line states when we asked ("updated {n} h ago"). Does that satisfy "no wording that implies verification", or should it say "retrieved" instead of "updated"?

## Order and timing

R1c (interstitial, smallest), R1e (static), R1a (homepage), R1b (route pages and generator), R1d (emails), R1f (social/OG/Pinterest). Each group: PR link, head commit, test output, the copy-checker output, screenshots at 375 and 1,440 px for R1a, R1b and R1c, one rendered email (R1d) and one rendered social post (R1f), and the surface list from R0 with "done" against each. Merge one PR, wait for its deploy to finish (about two minutes, see the 2026-10-19 note in `CLAUDE.md`), check it live, then merge the next. Six groups in four working days (Oct 31 to Nov 4) is tight; if time runs short, R1d (emails) and R1f (social) go last and R2 is cut first.
