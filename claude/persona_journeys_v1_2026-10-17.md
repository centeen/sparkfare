# Persona journey library v1 (Oct 17, 2026)

**What this is.** The end-to-end user stories behind the Oct 17 walkthrough (`claude/site_walkthrough_7_personas_2026-10-17.md`), recorded so every future walkthrough, consult and real-user test uses the same scripts. Each persona has a goal, a user story, a definition of success, and several scenarios with a trigger, an entry point, the path on today's live site, and the result observed on Oct 17.

**Rules for using it.**
- Every scenario is illustrative [I], built from the v3 persona cards. None of it is a real user. Persona cards stay the source; if a card changes, update this file and log it in `state_PERSONA_CHANGELOG.md`.
- "Live path" uses only what was live on Oct 17. Steps that need a feature that is not live are marked **PROPOSED** and are not scored.
- Coverage figures come from the site's own published files `sparkfare_ranked_deals.json` (generated Oct 16 08:08 UTC) and `sparkfare_ranked_deals_other_origins.json` (generated Oct 16 19:23 UTC), read on Oct 17 [E]. "Verdict-capable" means the route has enough history for a deal or not-a-deal verdict (`deals` + `priced_no_deal`).
- **Walk status:** W = walked and scored on Oct 17; P = partly walked; N = not walkable without a form submission, a partner click, an email or an account (listed so the next test with real users covers it).
- Scenario IDs (for example D-S2) are stable; step IDs (D1, D2 …) match the walkthrough report.

## Origin coverage the journeys depend on (Oct 16 data) [E]
| Persona | Origin | Routes in data | Deal | Not a deal (verdict) | Building history | No data | Verdict-capable |
|---|---|---|---|---|---|---|---|
| Dana | ORD | 36 | 5 | 16 | 0 | 15 | **58%** |
| Marcos | ATL | 38 | 0 | 16 | 1 | 21 | **42%** |
| Priya | SEA | 36 | 2 | 13 | 0 | 21 | **42%** |
| Elena | BOS | 36 | 2 | 16 | 1 | 17 | **50%** |
| Tess | MSP | 40 | 0 | 0 | 7 | 33 | **0%** |
| Ray & Linda | PHX | 38 | 0 | 0 | 6 | 32 | **0%** |
| All 22 US origins | | 794 | 35 | 186 | 94 | 479 | **28%** |
TLV (test origin, not a market) adds 34 routes and 7 of the 42 deals. Ten US origins (AUS, BWI, CLT, DEN, DTW, FLL, LAS, MSP, PHL, PHX) have no verdict-capable route today.

---

## 1. Dana · deal-driven flyer, ORD · Fare + Audience
**Goal.** Find an international fare clearly below the route's normal level and confirm it fast.
**User story.** As a price-literate traveler from Chicago, I want to see which international fares are genuinely below normal, with the basis and the dates, so that I can buy with confidence or move on without regret.
**Success looks like.** She can answer "is it a deal, for which dates, on which airline, and where do I buy it" in under a minute, and she can watch one route without making an account.

| ID | Scenario | Trigger | Entry | Live path (Oct 17) | Result | Walk |
|---|---|---|---|---|---|---|
| D-S1 | **Board scan** | Idle browsing, lunch break | Home, origin ORD | Hero with basis → Today's deals → card → View fare | Basis clear; no dates, airline or nights on the card even though the data holds them | W (D1, D5) |
| D-S2 | **Validate a price she found** | Saw $700 ORD→Prague on Google Flights | `/check` | Pick route, enter price → verdict, median, range, count | Best moment on the site; ends without a next step (no watch, no dates) | W (D4) |
| D-S3 | **"Europe in May under $600"** | Planning spring | Home | Only origin and five sorts; no month, region, nights or max-price filter | Cannot answer; falls back to Google Flights Explore | W (D2) |
| D-S4 | **Route deep dive** | Clicked a card's route link | `/data/ord-to-prague-czechia` | Price vs median, chart, boilerplate, signup | No dates, no fare link, "carried forward" note; dead end | W (D3) |
| D-S5 | **Watch one route** | Wants a drop on ORD→Lisbon | Route page or `/watchlists` | Sign-in wall (Google or email and password) | Leaves; "I won't make an account for one route" | W (D7) |
| D-S6 | **Daily alert to click** | Digest email | Email → card | Not walkable (no submission) | — | N |
| D-S7 | **Share a deal with a friend** | Found a good one | Card or route page | No share action on cards; copy-link only on `/check` | Partial | P |

## 2. Marcos · family traveler, ATL → Bogota, party of 3 · Fare + Leave
**Goal.** Get the household to Bogota on fixed family dates at a fair price for three.
**User story.** As a parent whose dates are set by school and family, I want to know whether today's Bogota fare applies to my dates and what it means for three of us, so that I don't overpay for a trip that isn't optional.
**Success looks like.** He sees fares seen for his month, a per-person price he can multiply honestly, a link that opens a search for three, and a watch on his one corridor.

| ID | Scenario | Trigger | Entry | Live path | Result | Walk |
|---|---|---|---|---|---|---|
| M-S1 | **December trip, fixed dates** | Family sets Dec 19–Jan 3 | Home, ATL | Hero is Tbilisi $1,473 with "Move fast…"; Bogota $596 in the list | His route is buried; hero copy breaks the no-urgency rule | W (M1) |
| M-S2 | **Is $596 for my dates?** | Sees Bogota card | Route page | $596 vs median $644; no dates, airline, baggage; card says LIVE-CHECKED while the page says carried forward | Cannot tell; trust drops | W (M2) |
| M-S3 | **Gut-check a quote for three** | Airline quotes $2,700 for 3 | `/check` | Per-person only; he must divide by three himself | Works, with effort | W (M3) |
| M-S4 | **Alerts for his corridor** | Wants to hear first | Signup | Travelers field exists (effect unknown [U]); trip length to "2+ weeks" | Plausible | W (M4, not submitted) |
| M-S5 | **Watch ATL→Bogota** | Wants a drop alert | `/watchlists` | Account wall | Stalls | W (M5) |
| M-S6 | **Delayed return** | Long-haul delay home | Away Mode | AirHelp listed for everyone; no return-day prompt | Generic | W (M6) |
| M-S7 | **Brother in Miami joins** | Sibling coordination | `/hub` | Four reward tiers, all locked (page summary) [I] | Weak | P (M7) |
| M-S8 | **Corridor not covered** | Wants Mexico City | "Don't see your airport?" | The form asks for an airport, not a destination | No path for a missing destination | P |

## 3. Priya · PTO bridge planner, SEA · Fare + Audience
**Goal.** Turn about 11 PTO days into the longest trips, pick destinations that fit each window, and see a fare for those dates.
**User story.** As an employee with a small PTO budget and my employer's holiday list, I want a plan of the best windows with destinations and real fares for those dates, so that I can request time off and buy with confidence.
**Success looks like.** A plan that matches her employer's holidays, ranked destinations with a fare seen for the window, a share link that opens *her* plan, and a watch on a window.

| ID | Scenario | Trigger | Entry | Live path | Result | Walk |
|---|---|---|---|---|---|---|
| P-S1 | **Build next year's plan** | New PTO balance (Nov–Jan) | `/time-off` → SEA | Default 10 PTO, 7 holidays; plan headline; 8 windows | Accurate arithmetic and dates | W (P1) |
| P-S2 | **Match her employer** | Her employer gives 5 holidays | `/time-off/sea` toggles | 12 toggles, PTO control, Update plan | Works (read, not exercised) | W (P2) |
| P-S3 | **Thanksgiving bridge fare** | 9 days for 3 PTO | Window card | Destinations alphabetical; "Fares appear here as we see them" | No fare, no ranking | W (P3, P4) |
| P-S4 | **Plan with a partner** | Evening share | Share + `.ics` | Share copies generic `/time-off/sea`; `.ics` exists | Partner opens a different plan | W (P5) |
| P-S5 | **Watch a window** | Wants an email when a fare appears | Window card | "Watch this weekend" exists (`ENABLE_PTO_WATCH` true, email-only); heading promise vs generic signup form | Mixed | P (P6) |
| P-S6 | **3-day weekend (dissent)** | Labor Day weekend | Window card | "Before you go" checklist on a 3-day trip; only near-international destinations | Noise | W (P7) |

## 4. Elena · long-stay worker, BOS, 4–8 weeks · Leave + Membership
**Goal.** Leave for eight weeks with mail, insurance questions, money, phone and the apartment handled, and fly out at a fair price (often one way).
**User story.** As a remote worker leaving for two months, I want a plan that knows I'm gone longer than 30 days and tells me what to do and when, so that I stop worrying about loose ends.
**Success looks like.** Trip length "a month or more" everywhere; the 30-day mail rule and the "ask your insurer about vacancy" question appear; reminders arrive weeks ahead; one-way or long-stay fares are visible.

| ID | Scenario | Trigger | Entry | Live path | Result | Walk |
|---|---|---|---|---|---|---|
| E-S1 | **Winter in Oaxaca, 8 weeks** | Picks Nov–Jan stay | Home signup | Trip length tops at "2+ weeks" | No box for her | W (E1) |
| E-S2 | **Find the flight out** | Wants BOS→Oaxaca | Route page | "Still building history", no price, round trip only | Nothing to act on | W (E2) |
| E-S3 | **Home checklist, long stay** | 5 weeks before leaving | `/leave` → "A month or more" | Six questions; month-plus mail line + USPS Hold Mail + US Global Mail | Good flow; no 30-day limit, no insurer line | W (E3) |
| E-S4 | **Partner services** | Needs eSIM, mail, money | `/away-mode` | 14 partners, no trip-length question; parking and pickups shown for an 8-week stay | Generic | W (E4) |
| E-S5 | **Reminders 30/14/7 days** | Wants a timeline | `/pricing` | Plus waitlist, nothing charged; reminder timing is the first planned feature | Honest; not live | W (E5) |
| E-S6 | **Mid-stay re-plan** | Next stop Lisbon | Board | Origin is BOS only; cannot set Mexico as origin (international-only from US hubs) | Out of scope today [I] | N |
| E-S7 | **Sabbatical, first long trip** | High anxiety | `/leave` | Same as E-S3 | Reassuring tone; thin depth | P |

## 5. Tess · teacher with a summer break, MSP, party of 2 · Leave + Fare (probation)
**Goal.** Plan the summer around a fixed school calendar, at a fair fare for two, and leave the home in order for several weeks.
**User story.** As a teacher, I want to enter my break dates and see fares and a home plan that fit a long summer for two, so that the break counts and I don't lose a week to admin.
**Success looks like.** Her own break is a window; fares for two; Long Leave branch; reminders in May.

| ID | Scenario | Trigger | Entry | Live path | Result | Walk |
|---|---|---|---|---|---|---|
| T-S1 | **Enter the school calendar** | District calendar published | `/time-off` | PTO and federal holidays only | Doesn't fit | W (T1) |
| T-S2 | **Summer fare for two** | October planning | Home, MSP | "Price history still building, so no deal verdict"; no Today's deals | Honest, empty | W (T2) |
| T-S3 | **Lisbon in July** | Picks a city | Route page | Thin template, no price | Nothing to act on | W (T3) |
| T-S4 | **Seven weeks away** | June admin rush | `/leave` | As E-S3 | Fits | W (T4) |
| T-S5 | **Alerts for summer** | Signup | Signup | Travelers 2; length tops at "2+ weeks" | Partial | W (T5) |
| T-S6 | **Winter break, 9 days** | December | `/time-off` | Federal windows include Christmas; school break may differ | Partial (Tess-Short-Breaks behaves like Priya) | P |

## 6. Ray & Linda · retirement scouts, PHX → Lisbon or Athens, ~10 weeks, party of 2 · Leave (highest) + Fare (probation)
**Goal.** Try a country for a season, fly as two at a fair price, and leave a home, mail, bills and health questions handled, with official sources.
**User story.** As a couple testing retirement abroad, we want fare history for our two candidate cities and a long-stay plan that tells us what to ask our insurer and where the official rules are, so that we feel prepared, not reckless.
**Success looks like.** A price signal for PHX→Lisbon and PHX→Athens (or an honest substitute); trip length past 30 days; guidance first, offers second; official links.

| ID | Scenario | Trigger | Entry | Live path | Result | Walk |
|---|---|---|---|---|---|---|
| R-S1 | **Portugal or Greece?** | Autumn decision | Home, PHX | "Chosen for the place" hero; no deal verdicts | No comparison | W (R1) |
| R-S2 | **Fares for two in March** | Ray wants numbers | Route page + `/check` | No price; `/check` needs 10 fares over 14 days, has 7 over 6 | Honest dead end | W (R2) |
| R-S3 | **Signup for ten weeks** | Linda signs up | Signup | Tops at "2+ weeks" | Mismatch | W (R3) |
| R-S4 | **House and mail, ten weeks** | 8 weeks before | `/leave` | As E-S3 | Fits | W (R4) |
| R-S5 | **Guidance before offers** | Linda: "tell me what to ask" | `/away-mode` | One insurance education line; no official links on Medicare abroad or 90/180 | Thin | W (R5) |
| R-S6 | **Reassure the kids** | Adult children ask | Share | No plan to share except `/time-off` | Gap (G33) | N |
| R-S7 | **Ray needs convincing (Linda-Leads)** | Ray: "show me the numbers" | `/check` | Not enough history | Fails Ray | P |

## 7. Gloria · the one who stays · amplifier, reported separately, never weighted
**Goal.** Know exactly what to do and when, and who to call, without making an account.
**User story.** As the neighbor checking Elena's apartment, I want one private page or card that tells me what to do and when, so that I can help without being blamed for anything missed.
**Success looks like.** A no-account, private page or printable card; no codes, addresses or dates exposed; a quiet "get your own alerts" later.

| ID | Scenario | Trigger | Entry | Live path | Result | Walk |
|---|---|---|---|---|---|---|
| G-S1 | **Opens a link from a text** | Elena shares | Phone | Only `/time-off/sea` exists to share | Not for her | W (G1) |
| G-S2 | **Privacy check** | Looks at what is exposed | Same | No dates, address or codes | Safe | W (G2) |
| G-S3 | **Handoff page or card** | Elena leaves | — | Not built (G33 Home card in Wave 1, PROPOSED) | — | N |
| G-S4 | **Plans her own trip later** | Months later | Home | Free alerts | Possible | N |

## 8. Cross-persona scenarios
| ID | Scenario | Personas | Result today |
|---|---|---|---|
| X-S1 | Priya shares a plan, partner signs up from it | Priya + partner | Share link is generic; attribution `src` on share unknown [U] |
| X-S2 | Marcos and his brother watch the same corridor from two origins | Marcos-Coordinator | Needs second origin (locked reward) |
| X-S3 | Elena hands the apartment to Gloria | Elena + Gloria | No handoff (G33) |
| X-S4 | Ray and Linda disagree: Ray wants fares, Linda wants the checklist | Ray & Linda | The site serves Linda (`/leave`) and fails Ray (no price) |

## 9. Changelog
| Date | Change |
|---|---|
| 2026-10-17 | v1: 45 persona scenarios (Dana 7, Marcos 8, Priya 6, Elena 7, Tess 6, Ray & Linda 7, Gloria 4) plus 4 cross-persona scenarios; coverage table from the site's own data files |
