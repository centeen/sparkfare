# DRAFT for Guard read · Embargo pitch for the Holiday Fare Report (G125 tool and money media, plus founder story G83)

Status: DRAFT. Not sent. Nothing goes out before Mon Nov 9 (D-063). Prepared by the Hub, Sun Nov 1, 2026. Non-attorney guidance; the Guard read and the owner's approval are still owed.

## Timing (D-063, D-057)
- Send: Mon Nov 9, US morning (09:00 ET = 16:00 Israel). Do not send Nov 3 to 6.
- Embargo lifts: Wed Nov 11, 09:00 ET = 16:00 Israel (Veterans Day). Fallback under D-036: lift Wed Nov 18.
- Check on Nov 9: US clocks went back on Nov 1 and Israel's on Oct 25, so the gap is 7 hours.
- Recipients: only rows marked Keep in `sparkfare_launch_media_lists_2026-11-01.xlsx` (A_Media). B_AAA_2025 reporters get the AAA-gap wave Nov 16 to 20 (G123), not this note.

## FILL-INS (the Hub cannot supply these; none may be guessed)
1. {First name} and the one-line reason it fits them, taken from the row's evidence column (a real, dated piece).
2. {n routes}, {priced}, {capable}, {n departures}, {date, zone}: from the publish-time run. Do not reuse the Oct 22 figures. The live route count (880 vs 828) must be reconciled first, and TLV (a test origin) must be excluded from every count.
3. {Headline finding with its number}: chosen by the Hub from the run, after a Guard read.
4. {Private preview link or PDF}: the report page is dark while `ENABLE_REPORTS` is off.
5. {Founder name and surname exactly as on `/disclosure` and the affiliate accounts} (D-056).
6. {Founder story, 2 sentences, owner's words}: why Sparkfare exists and what it does. Nothing on home, family, travel dates or employer.
7. {Fare links on the report page?}: yes or no. If yes, the inline commission disclosure must sit beside each.

## Version 1: report first (to A_Media rows kept)
Subject options:
- Embargoed to Nov 11, 9 a.m. ET: Holiday Fare Report, international fares from 22 US airports
- Original data under embargo: international holiday fares from 22 US airports

Body:
Hi {First name},

{One line on why this fits them, from their own recent piece.}

I'm sending you an embargoed look at a report that publishes Wednesday, Nov 11, at 9 a.m. ET. Please hold it until then.

It is Sparkfare's Holiday Fare Report 2026: a snapshot of {n routes} international round-trip routes from 22 US airports, {priced} with a cached price, {capable} with enough history to judge, and {n departures} observed Thanksgiving and year-end departures, as of {date, zone}. Headline finding: {headline finding with its number}.

Method, in one line: prices are cached round-trip lows from our flight-data partner, collected by Sparkfare's scheduled fetches, and each is judged against that route's own trailing 30-day median. They are not live quotes for anyone's dates, and the report makes no forecast.

What you can use: the report ({private preview link}); two CSVs of aggregate counts and shares (by hub, and by hub and holiday window); and /check at sparkfare.com/check, a free tool where anyone can test an international fare against its route's own history, with no signup.

Disclosure: I built Sparkfare. It does not sell or book travel. It may earn a referral commission if a reader follows a link to a partner site and buys there. The report page itself has no fare links.

I'm glad to answer questions or walk through the data before Wednesday.

Coby Enteen
sparkfare.com

## Version 2: founder story swap (replace the first paragraph and add the story block)
Add after the "I'm sending you an embargoed look" paragraph:
"Why I built it: I grew up dreaming of far-off places and checking fares I couldn't afford, always looking for the ones priced far below normal to pass along to friends. These days I travel a lot, and the stress isn't only the fare but everything around leaving, so I built Sparkfare: a free way to judge an international fare against its own history, plus a checklist for the trip ahead."
Keep every other paragraph, including the disclosure.

## Conditional lines (use only if the condition holds)
- CSV licence: "The aggregate CSV is licensed CC BY 4.0, so you can reuse it with attribution." Only if Travelpayouts has written a yes by Tue Nov 10. Otherwise drop the licence sentence and keep the counts-only CSV.
- Partner name in the method line: do not name Travelpayouts unless it gives written permission (R-003 clauses 2.4.1 to 2.4.3). Until then, "our flight-data partner".

## Follow-up note at the lift (Wed Nov 11, 16:00 Israel)
Subject: Live now: Sparkfare Holiday Fare Report 2026
Body: "The report is live: sparkfare.com/reports/holiday-2026. Everything in the embargoed note is unchanged. Coby Enteen." Send only to those who replied or opened. No second chase after that.

## Hub pre-check against standing conditions (not the Guard ruling)
| Condition | In the draft |
|---|---|
| Disclosure that the owner built it and earns referral commissions | Present in the disclosure paragraph |
| Link only to sparkfare.com | Yes; no other domain |
| No predictions, savings claims, "book" wording, or urgency | None. "Does not sell or book travel" is the cleared disclaimer wording (M5). The embargo date is a rule for the reader, not a sales deadline |
| International scope stated | "international round-trip", "22 US airports" (the Oct 24 read rejected "US airfares") |
| No unverified claims | "taxes and fees", "economy", "per adult" and "every day" are left out (unverified) |
| Freshness | "as of {date, zone}"; cached lows, "not live quotes" |
| Partner naming and CC BY | Held back until written permission |
| Founder rules (D-056) | Story limited; no home, family, travel dates or employer |
| No vote asks, no giveaways | None |
| AAA | Not mentioned; the AAA wave (G123) is a separate note |
| Going | Not mentioned (G125 condition: no disparagement) |

## Open items before this can go to the Guard read as final
1. Publish-time numbers and the route-count reconciliation (880 vs 828).
2. The headline finding.
3. Whether the report page has fare links.
4. Whether to promise an exclusive to any outlet. The draft promises none; the Hub does not assume one.
5. The owner's employer outside-activity check (D-056) before the founder version goes out.

## Update Nov 1 (12:24): owner answers
1. **Founder name.** The owner says his name does not appear on `/disclosure`. D-056's carried condition (same name as on `/disclosure` and the affiliate accounts) cannot be met as the site stands. Reconciliation item. Options: (a) add one founder-name line to `/disclosure` via a small copy PR before the Nov 4 last merge (needs a Guard read and the owner's per-PR approval, D-035); (b) sign press notes with the name already used on the affiliate accounts and keep `/disclosure` as is, accepting that a reporter cannot match the name to the site. Hub lean: (a). The exact name to use is the owner's to state; the Reddit display name is "Jason · Sparkfare", the Travelpayouts email was signed "Coby Enteen".
2. **Founder story (owner's brief, Hub options).** Three two-sentence options were sent in chat. Changes the Hub made to the brief: "friends and family" became "friends" (D-056 leaves family out); "back home" stays generic (no home details); the story does not say Sparkfare finds error fares (it does not; it judges a fare against its own 30-day median). Guard to confirm: (i) the Away Mode wording ("pre-trip checklist") against the live feature, ledger last verified Oct 13; (ii) the owner is comfortable with the "no money growing up" line being searchable under his name.
3. **Fare links on the report page.** Hub recommendation, accepted by the owner ("I will go with your recommendation"): **no fare links.** Link only to `/check` and `/how-it-works`. Then the pitch's disclosure sentence reads "The report page itself has no fare links." Reasons: reporters read a data report with commission links as an ad; the Oct 24 Guard read already required the inline commission disclosure beside any fare link; it keeps the CSV to counts only; it keeps the claim true by construction. **Ask for Claude Code (read-only before the Nov 4 merge):** does the built M5 page render any fare or route-page link, and does `/reports/holiday-2026` link anywhere that shows a fare? Acceptance: none, or the inline disclosure beside each.

## Update Nov 1 (12:40): owner decisions (see `claude/decision_staged_D-067_founder_name_disclosure_2026-11-01.md`)
- Public name: **Coby Enteen** (signature filled in above). Legal name stays on the accounts.
- Founder story: the "plain and short" version, filled into Version 2 above.
- Fare links: none. The sentence "The report page itself has no fare links." is used only after Claude Code answers R-Q1 (`claude/handoff_CLAUDE_CODE_READ_ONLY_Q_report_links_2026-11-01.md`).
- `/disclosure` founder line: proposed "Sparkfare is built and run by Coby Enteen."; waits for the owner's approval of the exact wording and the PR.
- Fill-ins still owed: publish-time numbers (route count 880 vs 828; TLV excluded), headline finding, private preview link.

## Update Nov 1 (12:45): Claude Code's answer to R-Q1 (owner relayed 12:38)
- No fare, route, Book, View fare or partner link in the report body (zero occurrences of `/flight`, `/departing`, `/out/`, `/go/`, aviasales, view fare, safetywing, tpo.lu). "book" appears once, in the cleared line "Sparkfare does not sell or book travel." (line 396). So the pitch sentence "The report page itself has no fare links." is supported, and the fare-link fill-in is resolved.
- Nuances: the shared site nav has "Routes" (to the `/data/` directory index, `siteHeader.js:23`) and "Check a price" (`/check`, `siteHeader.js:20`). The body links `/how-it-works` (lines 390, 399) and has no `/check` link of its own. D-067 item 4 said "links only to `/check` and `/how-it-works`"; the build matches the intent (no fare links) with `/check` only through the nav.
- CSVs: two files, both aggregate. `holiday-2026.csv`: 23 rows (22 hubs plus `US_TOTAL`), 14 columns of counts, shares and an as-of time. `holiday-2026-departures.csv`: 44 rows (hub, holiday window, departures observed, at-or-past-deal-floor). No route, destination, URL, fare or user column; no "http". This is not the 69-per-route-fare file the Oct 24 Guard read failed; the pitch now says "two CSVs".
- Gap: the footer links were confirmed from the script's source, not in a browser.
- Before sending Mon Nov 9: open the private preview link in Chrome and re-check for any fare link, including the footer, since the page is dark until the flag flips.

## Update Nov 1 (13:00): PR #452 and the CC BY switch
- PR #452 (`/disclosure` founder line) read and tested: Guard PASS, see `claude/guard_read_S_copy_disclosure_PR452_2026-11-01.md`. Awaiting the owner's per-PR approval.
- The CC BY licence is hard-wired into the report page in four places (JSON-LD `license` plus two visible lines, in two source files). Until it is switchable (S-copy C), do not describe the CSVs as CC BY in the pitch. The conditional CC BY sentence above stays conditional on Travelpayouts' written yes.
- The fare-link sentence now reads "The report page itself has no fare links." (the shared header and footer link other site pages).
