# 375 px read: `/reports/holiday-2026` (draft, 2026-11-11)

Purpose: close the "375 px rendered read" item from #482 (`ENABLE_REPORTS` on, merged as `21da49c`).
Not yet run by anyone. Tick each box and write what you saw; a blank result means not checked.

**Setup:** a real phone, or Chrome DevTools at 375 x 812 (device toolbar, no zoom). Open
`https://sparkfare.com/reports/holiday-2026`. If the page looks one deploy old, add `?fresh=1` to the address
(the Cloudflare edge can lag a minute or two after a merge; compare with `curl` before calling it broken).

## A. Page loads (should be live after the #482 deploy)
- [ ] The page returns content, not a 404 (a 404 means the flag or the deploy is not live yet).
- [ ] Header and nav fit on one row with the Menu button; no sideways scroll of the whole page.
- [ ] H1 reads "Holiday Fare Report 2026: international fares from 22 US airports" and wraps without clipping.

## B. Top block
- [ ] The "cached round-trip lows from Travelpayouts ... not live quotes" line is readable (13 px or larger).
- [ ] Both buttons are visible and 44 px tall: "Download Hub Data (CSV)" and "Download Window Counts (CSV)".
- [ ] The buttons wrap onto two rows rather than overflowing.
- [ ] Credit line reads exactly: "Source: Sparkfare (sparkfare.com), as of October 24, 2026 01:22 UTC."
- [ ] **No** "CC BY 4.0" text and no creativecommons link anywhere on the page (`ENABLE_REPORT_CC_BY` is `"false"`).

## C. Tables (the likeliest place for a 375 px problem)
- [ ] "Coverage and deal share by US airport": the table scrolls sideways inside its own box (`.table-scroll`); the page itself does not scroll sideways.
- [ ] The airport column (code plus city) stays readable while you scroll the table.
- [ ] All 22 airports are listed (ATL to SFO); airports with no qualifying route say "Building history", not a blank or a 0 that looks like a result.
- [ ] "Observed holiday-window departures": same behaviour; numbers are not clipped.
- [ ] Text under each table is readable and says the rule for "at the deal floor" (15% below the 30-day median, with the history rule).

## D. Methodology and footer area
- [ ] "Methodology, Data Sources & Sample Limits" list wraps cleanly; the Data Source bullet says the prices are cached lows, not live quotes, and that taxes and fees are not claimed.
- [ ] Links in the paragraphs ("how it works", "price checker") are tappable and lead to `/how-it-works` and `/check`.
- [ ] Bottom download buttons: sage "Download Hub Statistics (CSV)" and the outlined "Download Window Counts (CSV)", both 44 px.
- [ ] The credit line appears a second time at the bottom, same wording as in B, again with no CC BY.

## E. Behaviour
- [ ] Tapping each CSV button downloads or opens a CSV (not a 404). Opening the first file shows one row per airport with counts and shares only: no fare links, no per-person data.
- [ ] No fare, route, "View fare" or partner link on the page (the report carries none).
- [ ] The Tab key shows a visible focus ring on buttons and links (desktop check).

## F. Related pages (one glance each)
- [ ] `/how-it-works`: "Holiday Fare Report" button sits in the tools row, wraps without overflow, links to the report.
- [ ] `https://sparkfare.com/llms.txt` has the line "Holiday Fare Report 2026 ... two CSV downloads of derived statistics."

## Result
Passed / needs a fix: ________  Seen on (device or DevTools size): ________  Date and time: ________
If anything fails, write the section letter and what you saw. A copy or layout problem can be fixed in a small PR;
for a wording or licence problem, `ENABLE_REPORTS` can go back to `"false"` in `wrangler.jsonc` while it is sorted.
