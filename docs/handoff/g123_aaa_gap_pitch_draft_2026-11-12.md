# DRAFT for Guard read · Second-wave press note, AAA-gap wave (G123)

Status: DRAFT. Not sent. Prepared by Claude Code, Thu Nov 12, 2026, from `claude/decision_staged_D-062_to_D-065_launch_elevation_2026-11-01.md` (D-063), `claude/consult_launch_elevation_v2_wide_2026-10-31.md` (G123 and Guard condition 2) and the embargo pitch draft. Non-attorney guidance. The Guard read and the owner's approval are still owed. Nothing here has been checked against production (the sandbox cannot reach sparkfare.com).

## Timing (D-063)
- Send Mon Nov 16 to Fri Nov 20, to list B (`B_AAA_2025` in `sparkfare_launch_media_lists_2026-11-01.xlsx`, not in this repo), on the day AAA publishes its Thanksgiving forecast. Not before AAA publishes: the note is a companion to that story.
- One note per reporter. No chase. Journalist requests only on matching days (D-064 cut order).
- Tag every link: `?utm_source=press&utm_medium=email&utm_campaign=aaa_wave`. These are the values listed in `docs/metrics/SOURCE_TAGS.md` (source `press`, campaign `aaa_wave`, medium `email`); all fit the length limits (20, 16, 12) and `email` is one of the four stored medium values in `src/attribution.js`. Corrected Nov 12: the first draft used `press_aaa` and `holiday_report`, which are not on the agreed list.

## FILL-INS (none may be guessed)
1. {AAA publication date and its headline figure}: from AAA's own release. Quote only what AAA published, with its date.
2. {First name} and one line from their own recent piece on the AAA forecast (a real, dated piece from the list's evidence column).
3. {Headline finding with its number}: the Hub picks it after a Guard read. Facts available from the live report (as of Oct 24, 2026 01:22 UTC): 880 routes from 22 US hubs, 385 with a cached price, 214 with enough history to judge, 69 observed holiday departures (26 Thanksgiving, 43 Christmas/New Year), 15 hubs with enough history and 7 without.
4. {Is a refresh wanted?}: the report's as-of date will be about four weeks old and the Thanksgiving window (Nov 20 to 30) will be days away. Either say the as-of date plainly, as below, or regenerate first (a Hub pick; do not run `scripts/generate-holiday-report.mjs` casually, it rewrites `src/holidayReport.js`).
5. {Owner confirms the public name on the sign-off}: Coby Enteen (D-067).
6. Links in the body: `https://sparkfare.com/reports/holiday-2026` and `https://sparkfare.com/check`, each with the three tags above (see `docs/handoff/g123_nov16_prereqs_2026-11-12.md`).

## Version 1: the note

Subject options:
- Companion to AAA's Thanksgiving forecast: international fare history from 22 US airports
- For your AAA story: what international holiday fares looked like before the rush

Body:

Hi {First name},

{One line on why this fits them, from their own recent piece.}

AAA's Thanksgiving forecast is about domestic leisure travel. {AAA figure and date, in AAA's own words.} Since this is the part it does not cover, here is a companion on international trips.

Sparkfare's Holiday Fare Report 2026 looks at {n} international round-trip routes from 22 US airports: {priced} with a cached price, {capable} with enough history to judge, and {n departures} observed Thanksgiving and year-end departures, as of {date, zone}. {Headline finding with its number.}

This is history, not a forecast, and not AAA's data. Prices are cached round-trip lows from our flight-data partner, each judged against that route's own trailing 30-day median. They are not live quotes for anyone's dates, and the report makes no prediction.

You are welcome to use it: sparkfare.com/reports/holiday-2026, with two CSVs of aggregate counts and shares. Readers can also test an international fare against its own route history, free and with no signup, at sparkfare.com/check.

Disclosure: I built Sparkfare. It does not sell or book travel. It may earn a referral commission if a reader follows a link to a partner site and buys there. The report page itself has no fare links.

Happy to answer questions or walk through the data.

Coby Enteen
sparkfare.com

## Conditional lines
- CSV licence: the CC BY switch (`ENABLE_REPORT_CC_BY`) is `"false"` (owner, Nov 10). Do not describe the CSVs as licensed. Use "you are welcome to use it" only; if the owner wants a reuse sentence, it needs its own Guard read.
- Do not name the flight-data partner (R-003 clauses 2.4.1 to 2.4.3); "our flight-data partner" stays.

## Hub pre-check against the Guard conditions (not the Guard ruling)
| Condition (v2 Guard 1 and 2) | In the draft |
|---|---|
| Describe AAA accurately: its forecast is domestic leisure travel | Stated in the second paragraph |
| Never imply AAA endorsement or partnership | "not AAA's data"; no AAA logo or claim of affiliation |
| Sparkfare's numbers are history, not a forecast | Stated in the method paragraph |
| Owner built it and may earn commissions, disclosed | Disclosure paragraph |
| International scope stated; no "US airfares" | "international round-trip", "22 US airports" |
| No predictions, savings claims, "book", urgency | None; "does not sell or book travel" is the cleared wording |
| Link only to sparkfare.com | Yes |
| Measured counts, as-of date and zone | Placeholders; as-of required |
| No vote asks, no giveaways, no Going disparagement | None |
| Partner not named; CC BY off | Held |

## Risks to read before sending
1. **Stale data against a fresh story.** The report is as of Oct 24. By Nov 16 to 20 the observed Thanksgiving departures (Nov 20 to 30) are about to happen. Say the as-of date in the first paragraph that uses a number, or refresh first.
2. **Thin hubs.** 7 of 22 hubs have no verdict-capable routes (AUS, BWI, CLT, DTW, FLL, MSP, PHL). Do not make a hub-level claim for them.
3. **Sample size.** 69 observed holiday departures is small; use "observed", not "typical" or "average".
4. **Tag check.** Confirm in `/admin/growth` after the first signup that `press` / `aaa_wave` is stored (needs the admin secret, which this session does not hold).
