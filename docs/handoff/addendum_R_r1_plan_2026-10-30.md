# Addendum R, R1: surface list and final wording (v2, after the Hub's Guard read, 2026-10-30)

Roadmap step 182. **Nothing here is built.** v1 of this plan went to the Hub; the Guard answered (`claude/guard_read_R1_fare_wording_2026-10-30.md`, integrity CONDITIONAL, audit PASSED, non-attorney). This version applies that read. Code starts per group once the owner approves the scope amendment below (merge train, D-035). Branch per group: `r/r1-<group>`. Latest merge Wed Nov 4; Nov 5 fix-only; no merges Nov 6 18:00 ET to Nov 8.

**Decision number.** The Guard's project still thinks the next free number is D-051 (its log stops there). The repo log already uses D-051 (Q6 scanner rule) and D-052 (click tracking off), so this decision stays **D-053**. Tell the Hub, so its log is renumbered, not ours.

## Scope amendment the owner must approve

Addendum R says "do not edit live copy outside R1's table". The Guard's answers to Q3 and Q5 widen R1 to:
1. **Unify every date-bearing age wording** to "Search data retrieved ..." (emails, route-page footer, share image, Pinterest, watch and time-off emails). Not needed for the Guard's PASS.
2. **Replace, not add, the explainer text** on `/how-it-works` (section 3 and its FAQ plus the FAQ structured data), `/blog/how-we-rank-deals`, `/check` and `/disclosure`.
3. **Change the daily Bluesky/Mastodon line** "Current flight price observation: ..." (the word "current" implies now).

## Final strings (Brand's text with the Guard's conditions applied)

| # | Surface | Final string |
|---|---|---|
| 1 | Card, hero, route page freshness line | "Search data retrieved {n} h ago · {time} {zone}" (first mention of "search data" links to `/how-it-works`) |
| 2 | Card, hero, route page note under the dates row | "Price can differ on Aviasales. Bags may cost extra." **Aviasales stays named here** (see "Where View fare goes straight out" below). |
| 3 | Interstitial | "Sparkfare shows prices from search data, not a quote for these dates. The price on Aviasales may be different. Aviasales, not Sparkfare, handles booking and payment." Replaces the old note; "confirms the final price" and "Fares change." go. |
| 4 | Email footer, next to the deal-information line | "Prices come from search data for round-trip fares and can differ on Aviasales." The Brand draft said "for one adult"; see "Unsourced claims". |
| 5 | Explainer pages (replacement text) | "Fares are the lowest round-trip price found in search data we retrieved. They are not quotes, and the fare itself can be older than the retrieval time. The price on Aviasales can be higher or lower. The deal comparison uses our own 30-day history, not the Aviasales price." |
| 6a | X post | append "Seen in search data; price can differ on the booking site." (a social link goes to a Sparkfare page first, so the booking site need not be named) |
| 6b | Daily Bluesky/Mastodon | "Flight price in search data: {origin} to {dest} is ${price}." plus the 6a sentence |
| 6c | Share/OG image | the 6a sentence inside the image itself, since the image travels without the page |

"Recent" is dropped everywhere (the age bound is not settled: about two days by R0, up to 7 days by the Oct 10 docs). No change to "View fare ↗", the commission disclosure, the Deal chip, the basis line, the zone display, the 48-hour window, "Last seen {date}", or "Prices as of ... · N days ago" (the Guard: neither implies verification; move "as of" to "retrieved" when next touched, so I will, in R1a and R1b where those lines are already edited).

## Where "View fare" goes straight out (the Guard's Q1 condition)

Checked in the code on 2026-10-30:
- **Homepage cards and hero** (`index.html` `trackBookingClick`, line 1795): a signed-out visitor, the common case, goes **straight to Aviasales**; only a signed-in visitor passes through `/api/trips` and the `/departing/` interstitial. A failed tracking call also goes straight out.
- **pSEO `/data/` pages**: the link is `/out/aviasales?url=...` (`src/index.js` line 5237), a logged 302 straight to Aviasales, no interstitial.
- **Emails**: fare links are `/out/aviasales?url=...` when `ENABLE_FARE_ROUTING` is on (`src/email.js` line ~1127), otherwise the raw Aviasales link. Straight out either way.
- **Route page (Worker)**: to be confirmed in R1b; I expect the same `/out/aviasales` path.
- **Social posts and share image**: the link goes to a Sparkfare page (`/deal/...`, `/share/deal`), not to Aviasales.
Therefore the Guard's rule keeps "Aviasales" named on cards, hero, route pages, pSEO pages and the email footer. Only the social sentence (6a to 6c) uses "the booking site". The Brand preference for fewer mentions is met only on social. This is the honest reading of Legal's condition, and the owner can overrule it.

## Unsourced claims: what I verified, and what I can't

- **"One adult" / "economy":** not supported by the fetch. The request to `/v1/prices/cheap` carries only origin, destination, currency and token, no passenger count or cabin. The booking *link* opens a search for 1 adult (`adults=1`), which is a fact about the link, not about the cached price. I dropped "one adult" and "economy" from every string until Travelpayouts' own documentation says what the cached price covers. Taxes and fees are also unverified.
- **"Lowest":** the endpoint is named `/cheap` and returns at most one ticket per route in practice (checked in the last 30 hourly snapshots: 27,600 route entries, none with more than one). The ranking script then takes the minimum (`cheapest_result`). "Lowest round-trip price found in search data we retrieved" is accurate; "lowest on Aviasales" would not be.
- **R0 correction.** My R0 report said the fetch script drops the API's other tickets before saving. That is wrong: the script stores every ticket the API returns, and the API returns at most one per route. The conclusion (we can't compare against other airlines' cached fares) stands. Corrected on PR #426.
- **Live page text differs from the repo.** The Guard read the live `/how-it-works` and quotes its FAQ as "from when our daily fetch observed the quote". The repo's `how-it-works.html` (line 291) already says "counted from when Sparkfare's scheduled fetch retrieved the price", so production is probably behind `main`, or the Guard read cached text. R1e replaces whichever is current.

## Surface groups (one PR each, in this order)

**R1c Interstitial** (`src/referralCopy.js` `INTERSTITIAL_PARTNER_NOTE`, `src/interstitial.js`): replace the note with string 3. Test: `tests/referral_copy.test.js`.

**R1e Explainers** (replacement text, string 5): `how-it-works.html` section 3 lines 378 to 380 ("you never see outdated claims disguised as current deals" and "48-hour freshness cutoff: A price older than 48 hours...") and the FAQ answers at lines ~275, ~291 and their JSON-LD copies at ~406 and ~422; `blog/how-we-rank-deals.html` (lines 176 and 190, "today's cheapest fare" and the 48-hour sentence); `check.html` (lines 50 and 270); `disclosure.html`. I list every other sentence that measures freshness from fare age (also `blog/why-commissions-dont-influence-ranking.html` line 81, "today's cheapest fare") in the PR. Visible text and FAQ structured data must match.

**R1a Homepage** (`index.html`): `asOfText()` line ~1272 to string 1; note (string 2) in `ticketBodyHTML()` line ~1401 under `.ticket-detail`; the "aging" wording "Prices as of" becomes "Search data retrieved". Tests: `tests/j1_display.test.js`, `k_a6_fare_ticket.test.js`, `a6_visitor_zone.test.js`, `fare_data_age_copy.test.js`.

**R1b Route pages and the 880 `/data/` pages**: `src/priceFreshness.js` `fareNote()`, route-page hero in `src/index.js`, `Phase 17 pSEO Generator (Step 106).py` `asof_text()` and ticket markup; the route-page footer "Fare data retrieved ... Prices may change." becomes "Search data retrieved ...". Regenerate the pages in the PR with `py` (Python 3.14 is available) so no "Checked" survives on merge (an 880-file diff). Tests: `j1_route_page_freshness`, `k_b3_route_page`, `a6_visitor_zone`, the pSEO tests.

**R1d Emails** (string 4 plus "Search data retrieved" unification): `src/emailTemplates/dailyDigest.js`, `src/email.js` watch, PTO, welcome and lifecycle paths, the shared footer. Rebase on the merged Q work. Fixtures change by one line each.

**R1f Social and share** (strings 6a to 6c): `buildXPostText` (`src/index.js` line ~883), `Phase 3 Social Broadcaster.py` lines ~411, ~366, ~240, `ogCardHtml` (image text, new fit test), `src/pinterest.js` line 129.

## Acceptance (the handoff's, plus the Guard's)

- The words **"Checked", "observed" (as a fare-age claim), "never see outdated", "today's cheapest", "Current flight price observation" and "updated {n} h ago"** appear on no surface in the R0 list. Each PR greps for them.
- The R0 surface list with, per row, "done" and **whether View fare goes via the interstitial** (table above is the first draft).
- `npm run check:copy`, `npm test`, text-node checks; screenshots at 375 and 1,440 px for card, hero, route page and interstitial; one sample email; one social post; the share image rendered.
- The Guard's closing notes carried into R2: a qualifier does not make "Deal", "% below" and "$ under" safe beside a price that doesn't reproduce; the hero line "It only sparks when the fare's real" (D-026) sits badly beside "not a quote" until R2 is on; social is where an unreproducible "% below" does most harm. Metric after R1: fare clicks per 100 card views before and after, reported, not a kill signal.

## Needs the owner

1. Approve R1 with these strings.
2. Approve the scope amendment above (unify age wordings; replace the explainers; change the daily social line).
3. Confirm the cards keep "Aviasales" (Legal's condition, because most clicks go straight out) while only social says "the booking site".
4. Say whether to ask Travelpayouts what the cached price covers (adults, cabin, taxes). Until then no string says "one adult".
