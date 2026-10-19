# K-B0: production re-check of the 49 scan findings (read-only, 2026-10-19)

Source of the 49: `claude/site_scan_vs_brand_v1_2026-10-17.extracted.md`. Production at sparkfare.com read 2026-10-19 after Phase A (K-A1 to K-A6), J1, J3b and K-B1, K-B2, K-B6, K-B7, K-B10 merged. Nothing was clicked, submitted or changed.

**Count: Fixed 22, Partly fixed 7, Open 8, Not measured 12 (total 49).**

**Method.** (1) `curl` of 18 pages, static checks (tokens and fonts links, `<main>`, H1 count, header links, banned phrases). (2) The built-in browser: each page loaded in a same-origin iframe at 1440 px (16 pages) and 375 px (8 pages); computed font, WCAG contrast of every visible text node against its nearest opaque background, targets under 24 px, text under 13 px, gold and amber used outside the Deal chip, page height. **Limits:** contrast ignores background images; inline links inside sentences are counted separately because WCAG 2.5.8 exempts them; the pane reports its own window width as 0, so horizontal overflow is from `scrollWidth` against the iframe width only; the browser's time zone is GMT+3; Tab-key focus rings, night mode, image sizes, emails, the Clerk widget and the `/check` verdict were not exercised. Raw outputs are not committed.

## System layer (12)
| ID | Status | Evidence now |
|---|---|---|
| SYS-1 fonts | **Fixed** | `brand/tokens.css` and `brand/fonts.css` linked on 15 of 16 pages; computed font is Inter or Space Grotesk everywhere. `/digest` has Inter from its own CSS but no tokens link. |
| SYS-2 one visual system | **Partly** | Tokens on every page except `/digest`; Clerk sign-in and emails not measured (K-B8, unbuilt). |
| SYS-3 gold on actions | **Fixed** | 0 elements use gold outside the Deal chip and 0 use amber, on all 16 pages. |
| SYS-4 contrast | **Fixed** | 0 failing text nodes on all 16 pages at 1440 and all 8 at 375. |
| SYS-5 header | **Fixed** (K-B1) | One header, 10 links in `header, nav`, a Menu button on home at 375. At 375 the home header is 113 px tall; not compared against the five-link spec. |
| SYS-6 H1 and `<main>` | **Partly** | 1 H1 and 1 `<main>` on 14 pages. `/sign-in` has 2 H1s ("Welcome back to Sparkfare" and "Sign in to Sparkfare"); `/digest` has no `<main>`. |
| SYS-7 focus ring | Not measured | Shipped in K-A5; needs real Tab presses. |
| SYS-8 "Request it" button | Not measured | Not looked for. |
| SYS-9 night mode | Not measured | K-B6 merged; not exercised. |
| SYS-10 small text | **Fixed** | 0 text nodes under 13 px on all 16 pages (home was 140 of 317). |
| SYS-11 image sizes | Not measured | K-B7 merged. |
| SYS-12 footer | Not measured | |

## Home (13)
| ID | Status | Evidence now |
|---|---|---|
| H-1 mobile first price | **Fixed** | At 375 px the hero price is at y=740 (scan 1,204) and View fare at y=890; 1 input before the price. |
| H-2 H1 | **Fixed** | H1 "Look forward to it. Honestly." |
| H-3 featured blurb | **Fixed** | No unsourced figure in the rendered home text; tickets show dates, airline, basis. |
| H-4 card blurbs | **Partly** | None of "70% below", "vanish", "premium", "arbitrage", "four-star" on home. `/blog/` still lists "museum-grade culture before the summer premium" (Madrid): the destination file is not cleaned (F1 residue). |
| H-5 LIVE-CHECKED | **Fixed** | Chips are Deal 4, Typical 20, No verdict 7; no LIVE-CHECKED; as-of reads "Checked 7 h ago · Oct 19, 11:47 AM GMT+3". |
| H-6 "the moment" | **Fixed** | Not present on home. |
| H-7 greyed Building-history button | Not measured | No Building-history chip on JFK today. |
| H-8 four-field signup | **Fixed** | One visible field (email). |
| H-9 AUS empty state | Not measured | My session defaulted to JFK. |
| H-10 "880 routes" | **Fixed** | Home says 880 routes and 22 hubs; the checked-in files hold 880 US records. |
| H-11 travelers label | **Fixed** (moot) | The field is gone with the shorter signup. |
| H-12 watchlist banner | **Fixed** | No `.watchlist-promo` on the page. |
| H-13 ticket anatomy | **Fixed** | First ticket: route, price, Deal chip, dates and nights, airline, "round trip", checked time, View fare and Watch. |

## Route page (6)
| ID | Status | Evidence now |
|---|---|---|
| R-1 no fare link, dates | **Open** (K-B3) | `/data/ord-to-lisbon-portugal` has no View fare link. |
| R-2 H1 is an SEO string | **Open** (K-B3) | `/data/` H1 is still "ORD to Lisbon, Portugal Fall Flights: Current Price vs. 30-Day Median"; the Worker page `/flight/ORD/Lisbon...` reads "Flight deals to Lisbon, Portugal". |
| R-3 "instantly" | **Fixed** | Not on either route template. |
| R-4 two CTAs | **Fixed** | One call to action ("Create free alert"). |
| R-5 sparkline in text | Not measured | |
| R-6 mobile nav and H1 | **Partly** | 375 px: no overflow, no contrast failures; header rows and H1 wrap not measured. |

## Tools (5)
| ID | Status | Evidence now |
|---|---|---|
| T-1 peak line | **Open** (K-B5 unbuilt) | The line "10 PTO days, 42 days off" is a plain `p.totals`; the font reading was unreliable, so treat the detail as unverified. |
| T-2 page length | **Open** | `/time-off/sea` is 5,787 px at 1440 (scan 5,437); six "Watch this weekend" buttons. |
| T-3 unranked destinations | Not measured | K-B5 unbuilt. |
| C-1 /check verdict | Not measured | Needs a submitted form (not done). |
| C-2 no-history routes in list | Not measured | |

## Away Mode and /leave (6)
| ID | Status | Evidence now |
|---|---|---|
| A-1 "Matches your trip" | **Fixed** | No badge on any card before an answer. |
| A-2 offers before guidance | **Open** (K-C1) | |
| A-3 wording | **Fixed** | "Book airport parking ahead" gone; "Data from the moment you land, on a supported network" is the approved phrasing (also on the Cebu post and route page). |
| A-4 Petcube | **Fixed** | No Petcube link; 13 partner cards. |
| A-5 unlabeled checkboxes | **Partly** | 13 checkboxes remain, now labelled "Done"; 13 targets under 24 px on `/away-mode` (not confirmed to be the checkboxes). |
| L-1 /leave H1 | **Fixed** | 1 H1 ("Before you leave"). |

## Content, account, email (7)
| ID | Status | Evidence now |
|---|---|---|
| D-1 /data index | **Partly** | Targets under 24 px fell from 893 to 6; still a 17,458 px list of 881 links with no route finder (K-B9 unbuilt). |
| G-1 /digest | **Open** (K-B8) | No tokens file, no `<main>`, no site header; 101 of 102 targets under 24 px. |
| S-1 sign-in | **Partly** | Skip link and tokens present; two H1s; Clerk appearance not examined. |
| B-1 Cebu title | **Open** (K-B9) | Still "a weekend sprint within reach". |
| HUB-1 signed-out copy | **Open** (K-B8) | "confirmed referrals" text still shows when signed out. |
| W-1 widget tokens | **Fixed** | Tokens linked, Inter, 0 contrast failures, 0 small targets. |
| E-1 emails | Not measured | Needs a repo read or a test send. |

## New or sharper than the scan
1. `/sign-in` has two H1s.
2. The blog index still shows destination blurbs with a comparative or seasonal claim ("summer premium"); the destination JSON is not scanned by the copy checker (F1 residue, already known).
3. `/away-mode` has 13 interactive targets under 24 px that are not inline links.
4. `/time-off/sea` got longer (5,787 px).

## Not done
No Tab-key pass, no night-mode pass, no emails, no Clerk widget, no `/check` verdict, no AUS default origin, no signed-in pages. These need a form submission, a signed-in session or the repo.
