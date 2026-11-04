# Hub Guard read request (2026-11-04)

For the Hub. Three reads that are still open before the Nov 6 18:00 ET go/no-go. Nothing here is a request to change copy; it is a request to read the live text and say PASS, CONDITIONAL (with the exact change) or FAIL.
Source: `docs/handoff/BUILD_STATE.md` (2026-11-02 and 2026-11-03 entries). Read the **live page**, not the repo file; a rebuild can lag a merge, so if a page looks one merge behind, say so instead of reading it.

## Read 1: vacancy post (PR #467, `baddfaa` and `d1a1f6e`)

- URL: `https://sparkfare.com/blog/vacancy-rules-and-homeowners-insurance`
- Why a re-read: the earlier Guard read and owner approval were bound to head `9497e6d8`. It merged on `baddfaa`, which also removed the insurer day-threshold figures ("30 or 60 days", "60 or 90 days") in `d1a1f6e`.
- Check: no insurer thresholds or coverage claims remain; no recommendation of an insurance product or partner (insurance partners stay blocked until ROADMAP step 19); no "book", "secure", "lock in" or urgency wording; no link to any partner.

## Read 2: destination guides, "On the ground" section removed (PR #466 and #467)

- URLs: `https://sparkfare.com/blog/<slug>` for each of the 40 slugs below.
- **Correction to earlier notes:** they said 19 guides lose the section. In the repo today no file under `blog/` contains an "On the ground" heading, so all 40 guides show none. The generator (`Phase 20 Blog Generator.py`) emits the heading only when a bullet passes `is_clean_line()`, and none currently do. Read them as they are live.
- Check: each guide still reads as complete without the section (no dangling "see below" or empty list); the closing "Before you settle your dates" section is present or cleanly absent; no figures, comparisons or urgency wording remain; the "Similar destinations" block carries no internal cluster name.
- Slugs: algarve-portugal, amalfi-coast-italy, antigua-guatemala, athens-greece, baku-azerbaijan, bali-indonesia, bogota-colombia, bucharest-romania, budapest-hungary, buenos-aires-argentina, cape-town-south-africa, cappadocia-turkey, cebu-philippines, cusco-peru, da-nang-vietnam, dubrovnik-croatia, guatemala-city-guatemala, ho-chi-minh-city-vietnam, krakow-poland, larnaca-cyprus, lisbon-portugal, luxor-egypt, madrid-spain, maldives-male, mallorca-spain, marrakech-morocco, muscat-oman, oaxaca-mexico, petra-jordan, phuket-thailand, prague-czechia, rio-de-janeiro-brazil, san-jose-costa-rica, sofia-borovets-bulgaria, sydney-australia, taipei-taiwan, tbilisi-georgia, thessaloniki-greece, tokyo-japan, tulum-mexico.
- A full read of all 40 is long. If the Hub prefers a sample, read at least one of each type (Bali, Petra, Cebu, Luxor) plus the generator template, and say that the rest follow the same template.

## Read 3: CC BY licence wording (PR #483, merged 2026-11-03; live only when `ENABLE_REPORTS` flips on Nov 11, draft PR #482)

- Not visible today: `ENABLE_REPORTS` is `"false"`, so `/reports/holiday-2026` and both CSVs return 404. The Hub reads the wording from the repo (`src/holidayReport.js` lines 94 and 406, and the Dataset `license` property on line 73).
- Visible line (appears twice on the page): "Reuse under CC BY 4.0. Attribution: Sparkfare (sparkfare.com), as of <date and time> UTC." CC BY 4.0 links to `https://creativecommons.org/licenses/by/4.0/`.
- Structured data: `"license":"https://creativecommons.org/licenses/by/4.0/"` in the `Dataset` JSON-LD.
- Evidence on file: Travelpayouts support's written yes of 2026-11-03 (logged in `state_DECISION_LOG.md` under D-061). It covers the **aggregated CSV files** (derived, aggregated data may be copied, redistributed and reused); they may be named as the source in plain text, no logo. It does **not** say anything about the page text itself.
- Questions for the Hub: (a) does the page text carry the licence, or should the licence apply to the CSVs only; (b) does "Reuse" over-promise given the reply covers the CSVs, not the page; (c) is Travelpayouts named correctly, in plain text with no endorsement wording. Counsel has not read the Affiliate Agreement.
- If the Hub objects, the fix is a copy-edit PR before the Nov 11 flip, and the licence lines can be turned off again with `ENABLE_REPORT_CC_BY="false"` (a flag change, no code).

## Timing

- Reads 1 and 2 are live pages: read now, before the Nov 6 18:00 ET go/no-go.
- Read 3 can wait until Nov 9 to 10 (the flip is Nov 11), but a CONDITIONAL needs a PR merged by Nov 5 18:00 ET or it waits until Nov 9 (freeze Nov 6 18:00 ET to Nov 8).
- Please answer with one line per read: PASS, CONDITIONAL plus the exact change, or FAIL.
