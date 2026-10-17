# Sparkfare Score-Elevation Plan v1 (Oct 17, 2026)

**Status: strategic product document, adopted by the owner Oct 17 (D-024).** It is the standing plan for improving the persona journeys across the whole site; Away Mode Plan v1 (D-016, D-017) still governs Away Mode where the two overlap. **Approved for build:** the pre-freeze set in section 4 (D-020), the deal floor (D-021: ≥15% below median and ≥10 distinct observation days) and meter tracking on (D-022). Claude Code instructions: `claude/handoff_CLAUDE_CODE_ADDENDUM_J_2026-10-17.md` (D-023). Everything else remains PROPOSED. Changes to this plan are logged as decisions and bump the version.


**Inputs.** The walkthrough report v2 (`claude/site_walkthrough_7_personas_2026-10-17.md`), the journey library (`claude/persona_journeys_v1_2026-10-17.md`), the site's own published fare files, the synced repo (`wrangler.jsonc`, `ROADMAP.md`, `long-leave.js`), and outside research (sources at the end).

**Status (as written before D-020).** Everything here was **PROPOSED**. Apart from the approved items above, it still is. No persona has reacted to these ideas, because personas react only to live features or concrete mocks. The next step for any item you like is a mock and a council consult. Projected scores are Hub estimates [I], to be checked with real users.

**Bottom line.** The site is honest and fast, but it shows too little of what it already knows and stops too early in each journey. Of the five root causes below, three can be fixed with data the site already has, without new partners or new spending. A plausible set of changes moves the seven-criterion mean from **3.1 to about 3.9**, with the biggest gains for Gloria, Priya, Ray & Linda and Dana. Coverage (MSP and PHX have no verdict-capable routes) limits Tess and Ray & Linda whatever the design does.

---

## 1. Five root causes behind the low scores

| # | Root cause | Evidence [E] | Criteria and parameters it pulls down | Personas hurt most |
|---|---|---|---|---|
| R1 | **Data integrity gaps.** The LIVE-CHECKED tag marks stale prices; fares for flights that already left are on the board; "deals" as thin as 6% below median; 828 routes against a claim of 880 | Report v2 §4.1–4.3 | Accuracy, Trust, Goal | Dana, Marcos |
| R2 | **The site hides what it knows.** Every priced fare carries dates, airline, nights and full price history, but no page shows dates, airline or nights | Report v2 §4.4 | Need, Value, Personal fit, Confidence | Dana, Marcos, Elena, Tess |
| R3 | **Journeys stop early.** Route pages have no fare link and no watch without an account; thin pages have no "tell me when the first fare appears"; `/check` ends without a next step; windows have no fare | Walkthrough D3, D7, M5, P4, R2 | Flow, Goal, Meter linkage, Empty-state | All |
| R4 | **One-size defaults.** Signup stops at "2+ weeks"; planner knows PTO, not school breaks; `/away-mode` shows parking and pickups to an 8-week traveler and a home checklist to a 3-day one; prices are per person only | Walkthrough E1, T1, P7, M3 | Need, Personal fit | Elena, Tess, Ray & Linda, Marcos, Priya |
| R5 | **Coverage.** 28% of US routes have a verdict; ten US origins none; `ENABLE_PTO_FARES` turned off at 36% window coverage | Report v2 §4.3; `wrangler.jsonc` comment | Value, Goal, Coverage | Tess, Ray & Linda, Priya |

A sixth, smaller cause: **attention layout.** On a phone the first screen is a form; the first fare is about 1,680 px down, and NN/g found about 57% of viewing time stays above the fold.

---

## 2. The levers, by layer

Each lever lists what it is, why (evidence), which steps it lifts, an effort size (S = days, M = about a week, L = more), and the guardrail check. "Exists" means the code or data is already in place.

### A. Data and accuracy (fix first: these protect trust)
| ID | Lever | Why | Lifts | Effort | Guardrail |
|---|---|---|---|---|---|
| A1 | **Fix the tag.** Show "Checked today" only when `found_at` is within the current run; otherwise "Last seen <date>" (no tag) | The tag is on exactly the stale cards | M1, M2, D1, D5; Trust, Acc | S | Accuracy of claims |
| A2 | **Drop past or near departures** at compile time: hide any row whose departure is in the past or within 48 hours | 10 past-departure rows; links open dead searches | D1, M1; Acc | S | — |
| A3 | **Stale rule, site-wide:** a price older than 3 days shows "last seen" with no link, as the PTO spec already requires for window fares | 58 stale fallbacks; 16 are deals or heroes | D1, D5, M2; Acc | S | Matches ROADMAP 73 B2 rule |
| A4 | **Deal floor and distinct days.** Call a fare a deal only at ≥15% below median **and** ≥10 distinct observation days; compute the median from distinct days, not carried-forward copies | 7 of 35 US deals are under 10% below median; Mallorca's 12 points include a 19-day gap and copies | D1, D4; Acc, Trust | S–M | No price predictions; the threshold is owner policy |
| A5 | **One count everywhere.** Basis text uses the same count as the history; the route claim uses the live count (828 today, or fill the gap) | "10 observations" vs 9; 880 vs 828 | Acc | S | — |
| A6 | **Time zones and relative time** on every as-of ("Oct 16, 9:50 PM ET · 10 hours ago") | No zone shown anywhere | Trust | S | — |
| A7 | **Coverage push without new spend.** Probe the Aviasales Data API endpoints the PTO work already tested (`prices_for_dates` with month dates, `grouped_prices` by month, month matrix) for `no_data` routes; per the docs the first two return tickets found in the last 48 hours and data is stored for 7 days | 59% of routes no data | R2, T3, E2, P4; Coverage | M | Uses Travelpayouts quota; owner approves the dry run (as for PTO Track 0) |
| A8 | **Nearby-hub fallback, labeled.** When an origin has no verdict, show "From LAX: $491 (Oct 16), 20% below median" for PHX; "From ORD" for MSP | PHX and MSP have 0 verdict-capable routes; LAX→Lisbon is a deal today | R1, R2, T2, T3; Coverage, Empty | M | International only (still a US-hub international fare); label clearly that it departs another airport; no "you'll save" |

### B. Show what the data already holds (biggest lift per hour of work)
| ID | Lever | Why | Lifts | Effort | Guardrail |
|---|---|---|---|---|---|
| B1 | **Fare card anatomy:** price · "per person, round trip" · **dates seen (Dec 1–8) · nights · airline** · basis chip · as-of · View fare | Dana "for which dates?", Marcos "is this my dates?"; the fields exist | D1, D3, D5, M2, E2; Need, Val, Fit | S | Fare dates are the fare's, not the traveler's; no traveler date is shown |
| B2 | **Same anatomy on route pages,** plus the **fare link** with the board's disclosure (G59) and a "dates we've seen" list from the price history | Route pages are dead ends | D3, M2, T3; Flow, Goal, Meter | S | Disclosure at the link; copy-only rules for Aviasales wording (D-018) |
| B3 | **Party-size link.** A "Travelers" selector (1–9) that changes the adult digit in the Aviasales search link; text: "Prices shown are per person. The total for 3 is on the booking site and may differ." | Aviasales link format encodes adults, children, infants; Going's own guide says adding passengers may change the price | M2, M3, T5; Fit | S | No estimated total unless labeled an estimate (G3 condition); no change to Travelpayouts tools (2.3.5) |
| B4 | **Dollars next to percent:** "$457 below the usual $1,080" | Dana's card: "I'd like the median in dollars next to my number" | D1, D4; Val | S | Not "you saved"; it describes the fare, not the user |
| B5 | **Trip-length chip** ("7 nights", "29 nights") and a filter that matches the traveler's trip length | 23 fares are 30+ nights; Elena and Ray need them | E2, R2; Fit | S | — |
| B6 | **History sparkline on cards** (route pages already draw charts) | Visual basis builds trust faster than text | D1; Trust | S | — |

### C. Flows and sequence (end every journey on a next step)
| ID | Lever | Why | Lifts | Effort | Guardrail |
|---|---|---|---|---|---|
| C1 | **Email-only route watch.** Reuse the PTO window-watch build (email only, no account, signed cancel links, max 10 per address) for routes | `ENABLE_PTO_WATCH` is on and email-only; Baymard: 18% abandon orders because they must create an account; NN/g: login walls are justified only in rare cases | D7, M5, R2, T3; Fric, Flow, Goal | M | Double opt-in; privacy page line; no dates stored beyond what the traveler enters |
| C2 | **Every empty state gets an action:** "We haven't seen a fare for PHX→Lisbon yet. Get the first one by email" + the nearby-hub line (A8) | Thin pages and `/check` "not enough history" end the journey | R2, T3, E2, P4; Empty, Meter | S | No promise of a price or date |
| C3 | **`/check` next steps:** after the verdict, "Watch this route" (C1), "Dates we've seen" (B2), and a party field (B3) | `/check` is the best step (4.6) and stops there | D4, M3; Flow | S | — |
| C4 | **Intent entry on the homepage:** five plain choices under the H1: "A deal from my airport" · "A fare for set dates" · "Plan my time off" · "A long stay (a month or more)" · "Leaving home: checklist" | Personas start in different places (Dana from price, Marcos from dates, Priya from calendar, Elena and Ray from the stay) | M1, T1, E1, R1; TTFV, Need | S–M | — |
| C5 | **Destination search box** ("Where do you want to go?") that lands on the route page for the selected origin | Marcos and Ray come with a destination, not a deal | M1, R1; TTFV | S | — |
| C6 | **Mobile order:** H1 and value line, then the origin bar and three cards, then the signup | First fare at ~1,680 px; 57% of attention above the fold | D1, M1, T2, R1; TTFV, A11y/mobile | S | — |
| C7 | **Carry answers across tools:** `/leave` answers (stored in `sparkfare_away_needs`) and trip length shape `/away-mode` (hide parking and pickups for 30+ days; lead with mail, eSIM, money) | `/away-mode` ignores the trip length | E4, R5, P7; Need, Fit | S | Partner order must not follow commission |
| C8 | **Time-off share link carries the plan** (PTO budget and holiday set as URL parameters; windows recompute), shared with `navigator.share` on phones and copy-link elsewhere | Share copies the generic page; Web Share needs HTTPS and a user tap and is not in every browser | P5, G1; Acc, Flow | S | Never encode travel dates, names or emails (D-016 dates rule) |
| C9 | **Hide "Before you go" on windows under 5 days;** show a one-line "Leaving for longer? Make a checklist" | Priya's dissent | P7 | S | — |
| C10 | **Make the window-watch promise true:** the "email me when fares appear" heading uses the window watch, not the home-airport signup | P6 mismatch | P6 | S | — |

### D. New functions (each needs a mock and a consult)
| ID | Function | Personas | Why | Effort | Guardrail |
|---|---|---|---|---|---|
| D1 | **"My break" custom window** in `/time-off`: enter any date range (school break, sabbatical); it becomes a window with destinations that fit and a watch | Tess, Priya-for-two, Elena-Sabbatical | Avoids a district-calendar dataset (G2) and its upkeep; passive | M | Dates stay private (no public page, not in links) |
| D2 | **Fare for my month** on `/check` or route pages: pick a month, see the lowest fare seen for that month (from `prices_for_dates` / `grouped_prices`), labeled "seen <date>, not a quote" | Marcos, Tess, Ray & Linda | Turns "is this for my dates?" into a yes or no | M | No prediction; "seen", not "will be" |
| D3 | **Long-stay shelf:** fares with 25+ nights and one-way fares (the Data API supports one way), labeled | Elena, Ray & Linda, Tess | 23 long-stay fares exist today; one-way is how long stays fly (G10) | M | No onward-ticket selling (Seller of Travel) |
| D4 | **Long-stay branch in `/leave`** (G58): USPS Hold Mail is limited to 30 days; Premium Forwarding runs two weeks to a year; "ask your insurer how long the home can be empty"; water shutoff; for 60+ days, links to the official Medicare-abroad page and the EU 90/180 calculator | Elena, Tess, Ray & Linda | USPS DMM states both rules; the persona cards' 30-day line | S–M | Education only; official links; insurance referrals stay closed (Step 19) |
| D5 | **Departure-date reminders without Plus:** "Tell us your departure date" on `/leave` → the existing pre-departure emails (`ENABLE_T2B_SEQUENCE` is on: 14, 7 and 1 days before) plus a 30-day email for long stays | Elena, Tess, Ray & Linda | The sequence exists; it is tied to trips, not to `/leave` | M | Dates never public; opt-in; quiet mode |
| D6 | **Printable "note for the person who stays"** built in the browser from `/leave` answers, printed or sent by the traveler; nothing stored | Gloria, Linda | Interim before the G33 Home card; zero server storage | S–M | No address, codes or dates fields |
| D7 | **Compare two routes** (Lisbon vs Athens): side-by-side history, months seen, typical price | Ray & Linda, Dana | "Portugal or Greece?"; Ray wants numbers | M | Fare data only; no residency, tax or health advice |
| D8 | **Board filters:** month, region, max price, nights, nonstop (if the data holds stops) | Dana, Priya | Google Flights Explore offers month, price, stops and region; Dana's "Europe in May" | M | — |
| D9 | **Destination request** next to the airport request ("Don't see your destination?") | Marcos (Mexico City), Dana | The current form takes only airports | S | Store nothing personal beyond an optional email |
| D10 | **Second origin for free** (sibling or nearby hub), without the locked referral tier | Marcos-Coordinator, Ray | Rewards are locked; coordinators need two origins | S | Reward rules stay feature unlocks (G14) |

### E. Look and feel
| ID | Lever | Why | Lifts | Effort |
|---|---|---|---|---|
| E1 | **One H1 per page and a `<main>` landmark;** a skip link | Homepage has no H1; no page has `<main>`; `/leave` has two H1s | A11y | S |
| E2 | **Targets ≥ 24 × 24 px** (WCAG 2.2 SC 2.5.8, AA) | 13 of 28 on `/`, 13 on route pages below 24 px | A11y, Use | S |
| E3 | **Labels and autofill:** label `#join-origin`; `autocomplete="email"` on the homepage email | Seen in DOM | A11y, Fric | S |
| E4 | **Text size:** raise body copy under 14 px to at least 14–16 px; two contrast fails at 3.65:1 to ≥ 4.5:1 | 35 of 64 text nodes on `/` under 14 px; matters for Ray & Linda | A11y | S |
| E5 | **One status chip system** across board, route page and `/check`: "Deal · 42% below usual", "Typical price", "Building history", "Last seen Oct 11" | Mixed labels today ("featured", "LIVE-CHECKED", "Not a deal today, but worth watching") | Use, Trust | S |
| E6 | **Shorter pages:** the time-off page is 27,488 px; collapse windows to one line each with "Show destinations"; homepage images sized with width and height | Long scroll; 7 images without dimensions | Flow, A11y/mobile | S–M |
| E7 | **Reading level:** blurbs and route copy to grade 8; `/check` explanation to grade 8 (now 16) | Plain-language guidance aims for grades 6–8; `/leave` (8.4) shows it works | Use | S |

### F. Copy and content
| ID | Lever | Why | Effort | Guardrail |
|---|---|---|---|---|
| F1 | **Replace generated blurbs with a fixed template** built from data: "<City>. Seen <dates> on <airline>, <n> nights. <basis>." Optional one human line per destination, written once and reviewed | Stray phrases ("Pure visual storytelling"), unsourced "70% less", urgency ("before rates reset", "Move fast") | S–M | FTC 16 CFR 233.2 comparable-value risk (non-attorney flag); no urgency |
| F2 | **"In tomorrow's email"** instead of "notified instantly" | Alerts are daily | S | Accuracy |
| F3 | **"Compare airport parking"** instead of "Book airport parking ahead" | Banned word | S | Referral copy |
| F4 | **Total-price line:** confirm with Travelpayouts whether cached prices include taxes and fees, then say so ("includes taxes and fees as shown by Aviasales") or say "price shown by the booking site may differ" | DOT 14 CFR 399.84 requires the advertised airfare to be the full price including taxes and fees for carriers and ticket agents; a July 1, 2026 DOT proposal would loosen how components are shown but is not final. Whether the rule reaches Sparkfare is a legal question | S | Legal flag, non-attorney; verify with counsel (DOT exposure already on the Guard's list) |

### G. Measurement (so the next walkthrough uses real numbers)
| ID | Lever | Why | Effort |
|---|---|---|---|
| G-a | **Turn meter tracking back on** if D-005 still stands (synced `wrangler.jsonc` shows `ENABLE_METER_TRACKING: "false"`) | Calibrate needs F0 data | S (owner flag) |
| G-b | **One-question SEQ** after `/check`, `/leave` and the planner | Industry average about 5.5 of 7 gives a benchmark | S |
| G-c | **Scenario funnels** (one per journey-library scenario) in the weekly standup | Task success becomes visible | M |
| G-d | **Five scripted sessions per persona type** before Dec 11 using the journey library | Replaces Hub judgment with evidence | Owner time |

---

## 3. To-be journeys and projected scores (Hub estimates [I])
Projected seven-criterion step averages after the **pre-launch set** (A1–A6, B1–B4, C2, C3, C6, C8–C10, E1–E5, F1–F3) and the **Wave 1 set** (A7, A8, B5, C1, C4, C5, C7, D1, D4, D5, D6). Not measured.

### Dana 3.3 → about 4.1
| Step | Today | Change | Projected |
|---|---|---|---|
| D1 board | 4.1 | Dates, airline, nights, dollars below usual, correct status chips | 4.4 |
| D2 "Europe in May" | 2.9 | Month and region filters (D8) | 4.0 |
| D3 route page | 2.7 | Dates seen, fare link, watch | 4.1 |
| D4 `/check` | 4.6 | Next steps (watch, dates) | 4.7 |
| D5 View fare | 3.1 | Itinerary visible before the click | 3.6 |
| D6 alert | 3.6 | Autofill, labels | 3.9 |
| D7 watch | 2.0 | Email-only watch | 4.0 |

### Marcos 3.0 → about 3.7
| Step | Today | Change | Projected |
|---|---|---|---|
| M1 ATL board | 2.4 | No urgency copy; destination search; Bogota reachable in one step | 3.5 |
| M2 route page | 2.7 | Dates seen, honest status, link with 3 travelers | 3.9 |
| M3 `/check` | 3.6 | Party field; "fare for my month" | 4.2 |
| M4 signup | 3.6 | Travelers carried into links | 4.0 |
| M5 watch | 2.7 | Email-only watch | 4.0 |
| M6 AirHelp | 3.4 | Unchanged until G53 | 3.6 |
| M7 brother | 2.7 | Second origin free (D10) helps a little | 2.9 |
**Limit:** his December dates still depend on what Aviasales has cached; D2 shows "seen", never a promise.

### Priya 3.1 → about 4.0
| Step | Today | Change | Projected |
|---|---|---|---|
| P1 planner | 4.3 | Shorter page | 4.4 |
| P2 holidays | 4.1 | — | 4.2 |
| P3 windows | 2.9 | Rank destinations by a fare seen for the window where one exists | 3.8 |
| P4 window fare | 2.3 | Turn window fares on only where coverage passes (A7); "No fare seen yet · watch" elsewhere | 3.4 |
| P5 share | 3.3 | Plan-carrying link, Web Share | 4.3 |
| P6 email promise | 2.4 | Window watch behind the heading | 3.8 |
| P7 checklist on 3-day windows | 2.1 | Hidden under 5 days | 4.0 |

### Elena 3.2 → about 4.0
| Step | Today | Change | Projected |
|---|---|---|---|
| E1 signup | 2.6 | "A month or more" (needs `ENABLE_LONG_LEAVE` and its copy review, D-006) | 4.0 |
| E2 flight out | 3.1 | Long-stay shelf, one-way | 3.6 |
| E3 `/leave` | 3.7 | Long-stay branch (D4) | 4.4 |
| E4 `/away-mode` | 3.0 | Trip-length aware order | 3.8 |
| E5 reminders | 3.7 | Departure-date emails without Plus (D5) | 4.0 |

### Tess 3.0 → about 3.75
| Step | Today | Change | Projected |
|---|---|---|---|
| T1 calendar | 2.1 | "My break" window (D1) | 3.6 |
| T2 MSP board | 3.0 | Nearby-hub line, labeled | 3.4 |
| T3 MSP→Lisbon | 2.6 | Watch for the first fare; ORD fallback | 3.3 |
| T4 `/leave` | 3.7 | Long-stay branch | 4.4 |
| T5 signup | 3.1 | Month-plus option; travelers carried | 4.0 |
| T6 reminders | 3.4 | Departure-date emails | 3.8 |
**Limit:** MSP coverage.

### Ray & Linda 3.0 → about 3.8
| Step | Today | Change | Projected |
|---|---|---|---|
| R1 PHX board | 2.9 | Nearby-hub verdicts; compare two routes later (D7) | 3.4 |
| R2 PHX→Lisbon | 2.7 | First-fare watch; "From LAX: $491, 20% below usual" | 3.4 |
| R3 signup | 2.6 | Month-plus option | 4.0 |
| R4 `/leave` | 3.7 | Long-stay branch with official links | 4.4 |
| R5 guidance | 3.0 | Guidance first, then partners; official links | 3.8 |
**Split kept:** Linda's checklist need is met sooner than Ray's numbers need.

### Gloria 2.7 → about 3.9 (separate, unweighted)
| Step | Today | Change | Projected |
|---|---|---|---|
| G1 the link | 1.9 | Printable note (D6) now; Home card (G33) in Wave 1 | 3.6 |
| G2 privacy | 3.6 | No codes, address or dates fields by design | 4.2 |

**Projected all-step mean: 3.1 → about 3.9.** Projected gains: Gloria +1.2, Priya +0.9, Ray & Linda +0.8, Dana +0.8, Tess +0.8, Elena +0.7, Marcos +0.7.

---

## 4. Sequence
| When | What | Why this order |
|---|---|---|
| **Before the Nov 6 freeze** (small, safe, mostly copy or display). **Approved, D-020; Addendum J** | A1 tag, A2 past fares, A3 stale rule, A5 counts, A6 time zones; B1 card anatomy, B2 route-page link and dates, B4 dollars; C2 empty-state action (watch link can point to the existing signup until C1 ships), C6 mobile order, C8 share link, C9, C10; E1–E5; F1–F3; Petcube decision (G62) | Launch traffic should meet accurate, honest pages; these touch display, not data pipelines |
| **Owner decisions** | Deal floor (A4): **decided, D-021**. `ENABLE_METER_TRACKING` (G-a): **on, D-022**. Still open: `ENABLE_LONG_LEAVE` after its copy review (D-006); total-price wording (F4, counsel); Petcube (G62) | Policy, not code |
| **From Nov 9 (Wave 1, alongside Away Mode v1)** | C1 email-only route watch; B3 party link; B5 trip-length chip; C4 intent entry; C5 destination search; C7 carry answers; D4 long-stay branch; D5 departure reminders; D6 printable note; A7 coverage probe (owner-approved dry run); A8 nearby hub | Each needs a mock and a consult; C1 reuses an existing build |
| **Dec 12 onward** | D1 "My break"; D2 fare for my month; D3 long-stay shelf; D7 compare; D8 filters; D9 destination request; D10 second origin; window fares back on where coverage passes | Bigger builds; measure first with G-b and G-c |

**Passive-operations check.** Everything above runs without recurring manual work except the one-time human review of destination lines (F1), which is written once.

---

## 5. Guard summary (AGENT_LEGAL_COMPLIANCE flags; non-attorney guidance, verify with counsel)
- **Comparative and savings claims** in generated blurbs: FTC 16 CFR 233.2 treats a "comparable value" comparison as deceptive unless representative sellers actually charge that price. F1 removes the exposure.
- **Total price:** DOT 14 CFR 399.84 requires carriers and ticket agents to advertise the full price including taxes and fees. Whether it covers a referral site that advertises fares is the existing DOT question on the Guard's list; F4 makes the copy safe either way. The July 1, 2026 DOT proposal is not final.
- **Party-size link (B3):** changing a digit in a standard Aviasales search link is not modifying Travelpayouts tools (2.3.5) [I]; confirm with the Guard before build.
- **Long-stay branch (D4):** education and official links only; no insurance referral while Step 19 is open.
- **Dates:** fare dates shown on cards are the fare's own dates, not the traveler's. Traveler dates (D1, D5) stay private and never appear in links or public pages.
- Guard status for the whole set: **CONDITIONAL** on the points above. No item is FAIL.

## 6. Audit (AGENT_QUALITY_AUDITOR, applied by the Hub; not a separate agent run)
1. Status grounded: **PASS.** Live, repo and data statements cite the report v2 or the synced files.
2. No scope breach: **PASS.** No persona reactions invented; no revenue forecast made.
3. Figures sourced or labeled: **PASS.** Projections tagged [I]; outside figures cited.
4. Legal-adjacent claims flagged: **PASS** (section 5).
5. No fabrication: **PASS.**
6. Assumptions stated: **PASS.**
7. Conflicts surfaced: **PASS** (report v2 items 71–80).
8. Attribution intact: **PASS.**
STATUS: PASSED

## Sources
- [Baymard Institute: current state of checkout UX (18% abandon because of account creation)](https://baymard.com/blog/current-state-of-checkout-ux)
- [NN/g: login walls](https://www.nngroup.com/videos/login-walls/)
- [NN/g: scrolling and attention (57% of viewing time above the fold, 2018)](https://www.nngroup.com/articles/scrolling-and-attention/)
- [WCAG 2.2 SC 2.5.8 Target Size (Minimum), DAISY knowledge base](https://kb.daisy.org/publishing/docs/wcag/target-size-minimum.html)
- [Core Web Vitals thresholds](https://specification.website/spec/performance/core-web-vitals/)
- [MeasuringU: 10 things to know about the SEQ](https://measuringu.com/seq10/)
- [Google HEART framework summary](https://www.productcompass.pm/p/the-google-heart-framework)
- [Georgia Digital Services: readability (grades 6 to 8)](https://digital.georgia.gov/blog-post/2021-05-13/readability-matters)
- [MDN: Navigator.share()](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share)
- [Travelpayouts: Aviasales Data API](https://support.travelpayouts.com/hc/en-us/articles/203956163)
- [Travelpayouts: links with a completed search form (passenger encoding)](https://support.travelpayouts.com/hc/en-us/articles/115003710648-Links-to-the-White-Label-with-a-completed-search-form)
- [Going: how to book a Going deal](https://help.going.com/hc/en-us/articles/16914306449684)
- [KAYAK: flight price alerts (account required)](https://www.kayak.com/news/flight-price-alerts/)
- [Going: Google Flights Explore guide](https://www.going.com/guides/google-flights-explore)
- [USPS Domestic Mail Manual 100: Hold Mail and Premium Forwarding](https://pe.usps.com/text/dmm100/sending-receiving.htm)
- [Federal Register, July 1, 2026: Enhancing Flexibility of Air Fare Price Advertising (proposed)](https://www.federalregister.gov/documents/2026/07/01/2026-13294/enhancing-flexibility-of-air-fare-price-advertising)
- [16 CFR 233.2, retail and comparable value comparisons](https://www.law.cornell.edu/cfr/text/16/233.2)
