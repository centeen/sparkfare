# Hub Read 3: CC BY wording on the Holiday Fare Report (for the Hub, 2026-11-09)

Non-attorney. Decision needed by Tue Nov 10. `ENABLE_REPORTS` is `"false"`, so none of this is live; #482 (flip on Nov 11) would put it live.

## What Travelpayouts said (2026-11-03, written yes, recorded under D-061)
Derived, aggregated CSVs may be copied, redistributed and reused. Travelpayouts may be named as the source in plain text, no logo.

## What `main` does now (`ENABLE_REPORT_CC_BY="true"`)
Three places in `src/holidayReport.js` (same text in `scripts/generate-holiday-report.mjs`, pinned by `tests/s_copy_c_cc_by_switch.test.js`):

1. Line 73, JSON-LD `Dataset`: `"license":"https://creativecommons.org/licenses/by/4.0/"` (describes the whole Dataset, i.e. both CSVs).
2. Line 94 (page, under the CSV buttons) and line 406 (second place on the page):
   > Reuse under CC BY 4.0. Attribution: Sparkfare (sparkfare.com), as of October 24, 2026 01:22 UTC.

With the flag `"false"`, the licence property is removed and both lines become: `Source: Sparkfare (sparkfare.com), as of October 24, 2026 01:22 UTC.`

## The issue the Hub raised
The licence should apply to the CSV files, not to the page's text. The current wording ("Reuse under CC BY 4.0") sits as a page-level line, so it can read as licensing the report text and charts. The yes covers only the aggregated CSVs.

## Options
- **A. Scope the line to the CSVs (suggested).** Replace both lines with e.g. `The two CSV files are licensed under CC BY 4.0. Attribution: Sparkfare (sparkfare.com), as of <date>. The report text is not licensed for reuse.` Keep the Dataset `license` (it already describes the CSV distributions). Needs a copy edit in `src/holidayReport.js`, the generator and the pinned test, then the Hub's Guard read.
- **B. Fallback.** Set `ENABLE_REPORT_CC_BY="false"`: one-line change, existing tested path, plain "Source:" line, no licence anywhere.

Neither option names Travelpayouts on the page. Naming them as source is permitted (plain text) but is a separate choice.

## Open
Whether "The report text is not licensed for reuse" is wanted, or only silence about the text. The Hub's call.
