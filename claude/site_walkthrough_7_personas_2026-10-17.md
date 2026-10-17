# Sparkfare end-to-end walkthrough: seven persona journeys, scored (R-009 draft, v2)

**v2 (Oct 17, later the same morning):** adds ten measurement parameters (section 3), a data-integrity audit of the site's own published fare files (section 4), page-level technical measures (section 5), a measurement framework for real users (section 6), and new reconciliation items 71 to 80. The v1 scores in section 2 are unchanged except one accuracy correction (M2), shown in place. Scenarios are recorded in `claude/persona_journeys_v1_2026-10-17.md`; the improvement plan is `claude/score_elevation_deep_dive_2026-10-17.md`.

**Run:** Sat Oct 17, 2026, Israel time: v1 about 08:00 to 09:30; v2 measurements about 08:20 to 09:00 local (the clock reset after the session restarted; both passes are the same morning). Live site in the built-in browser, plus the site's public JSON files. **Council mode:** Walkthrough across all seats (short consult). **Steps run:** Frame, Ground, Convene (journeys from the persona cards), Guard (flags only), Score, Audit. **Skipped:** Price (no new idea priced; no revenue assumptions table), Spark Score (the owner's rubric replaces it here).

**What this is, and is not.** An expert walkthrough: the Hub scripts each persona's likely actions from the v3 persona cards and runs them on the live site. Persona actions are illustrative [I]; statements about what the site does are observed [E] unless tagged. Not a usability test with real users; scores are the Hub's judgment. Personas are not real people.

**Not tested (on purpose or blocked):** no `View fare` or partner link clicked (a click logs a commission-bearing visit); no email form submitted; no account created; confirmation emails, `/trips`, `/account`, `/digest`, the blog and the Aviasales landing page not seen. `/hub` and `/pricing` read from page summaries [I]. Field performance data (Chrome UX Report) not available; page timings are one lab load from this browser.

---

## 1. Scoring scale for the owner's seven criteria (1 to 5, higher is better)
| Criterion | What 5 means | What 1 means |
|---|---|---|
| **Need** | The step is exactly what this persona came to do | Irrelevant to their goal |
| **Use** (usability) | Clear, labeled, works first time | Confusing or broken |
| **Fric** (friction, inverted) | No effort, no wall | Account wall, dead end, re-entry |
| **Val** (value) | Gives them something they would act on | Nothing they can use |
| **Flow** (fluidity) | Next step obvious and connected | Dead end |
| **Acc** (accuracy) | Claim matches what the data and rules support | Wrong, stale or unsupported |
| **Goal** | Achieves what Sparkfare set out to do for this persona at this step | Does not |

---

## 2. Journeys and scores (seven criteria)

### 2.1 Dana (ORD) · Fare + Audience
| # | Persona action [I] | What the site did [E] | Need | Use | Fric | Val | Flow | Acc | Goal | Avg |
|---|---|---|---|---|---|---|---|---|---|---|
| D1 | Lands on `/`, picks ORD | Hero "31% below 30-day median, 28 observations"; deal sections; basis visible | 5 | 4 | 4 | 4 | 4 | 4 | 4 | **4.1** |
| D2 | Wants "Europe in May" | Only origin and five sorts; no month, region or stops filter | 2 | 3 | 3 | 3 | 3 | 4 | 2 | **2.9** |
| D3 | Opens ORD→Prague | "$715, median $702, not a deal today"; no dates, no fare link; carried-forward note | 3 | 3 | 3 | 3 | 2 | 3 | 2 | **2.7** |
| D4 | `/check` with $700 | "About the same"; median $702 from 31 daily fares; low $484, high $720; "not your itinerary" | 5 | 5 | 5 | 4 | 4 | 5 | 4 | **4.6** |
| D5 | Clicks "View fare" [I, not clicked] | Disclosure under the hero | 3 | 4 | 3 | 3 | 3 | 3 | 3 | **3.1** |
| D6 | Creates an alert | Email, origin (blank), trip length, travelers; not submitted | 4 | 4 | 4 | 3 | 4 | 3 | 3 | **3.6** |
| D7 | Wants one route watched | `/watchlists` → sign-in | 2 | 2 | 1 | 3 | 1 | 4 | 1 | **2.0** |
| | | **Dana overall** | | | | | | | | **3.3** |

### 2.2 Marcos (ATL → Bogota, party of 3) · Fare + Leave
| # | Persona action [I] | What the site did [E] | Need | Use | Fric | Val | Flow | Acc | Goal | Avg |
|---|---|---|---|---|---|---|---|---|---|---|
| M1 | Picks ATL | No Today's deals. Hero "chosen for the place", Tbilisi $1,473, "Move fast, premium positioning rarely lasts." Bogota $596 tagged LIVE-CHECKED | 2 | 3 | 3 | 2 | 3 | 2 | 2 | **2.4** |
| M2 | Opens ATL→Bogota | $596 vs median $644; no dates, airline, stops; no fare link; carried-forward note beside a LIVE-CHECKED tag on the board. **v2: the tag is shown on stale fallbacks (section 4.1), so accuracy is lowered 3 → 2** | 3 | 3 | 3 | 3 | 3 | **2** | 2 | **2.7** (v1 2.9) |
| M3 | `/check` a fare | $900 test: "40% above median $644, 19 daily fares"; per person only | 3 | 4 | 4 | 3 | 4 | 4 | 3 | **3.6** |
| M4 | Signs up, Travelers = 3 | Field exists; effect unknown [U]; length tops at "2+ weeks" | 4 | 4 | 4 | 3 | 4 | 3 | 3 | **3.6** |
| M5 | Watches the route | Account wall | 3 | 2 | 2 | 4 | 2 | 4 | 2 | **2.7** |
| M6 | Delay compensation | AirHelp in `/away-mode` for everyone | 3 | 4 | 4 | 3 | 3 | 4 | 3 | **3.4** |
| M7 | Invites his brother | `/hub` four locked tiers (summary) [I] | 3 | 3 | 3 | 2 | 3 | 3 | 2 | **2.7** |
| | | **Marcos overall** | | | | | | | | **3.0** (v1 3.04 → v2 3.01) |

### 2.3 Priya (SEA) · Fare + Audience
| # | Persona action [I] | What the site did [E] | Need | Use | Fric | Val | Flow | Acc | Goal | Avg |
|---|---|---|---|---|---|---|---|---|---|---|
| P1 | `/time-off` → SEA | Federal calendar incl. observed days; 10 PTO → 42 days off | 5 | 4 | 4 | 4 | 4 | 5 | 4 | **4.3** |
| P2 | Sets PTO and holidays | 0–30 control, 12 toggles (7 on), Update plan | 5 | 4 | 4 | 4 | 4 | 4 | 4 | **4.1** |
| P3 | Reads window cards | Eight windows; destinations alphabetical, unranked | 3 | 3 | 3 | 2 | 3 | 4 | 2 | **2.9** |
| P4 | Wants a fare | "Fares appear here as we see them" on every window | 2 | 3 | 3 | 1 | 2 | 4 | 1 | **2.3** |
| P5 | Exports and shares | `.ics` exists; Share copies generic `/time-off/sea` | 4 | 4 | 4 | 3 | 3 | 2 | 3 | **3.3** |
| P6 | Email when fares appear | Heading promise vs generic home-airport form | 3 | 3 | 3 | 2 | 2 | 2 | 2 | **2.4** |
| P7 | "Before you go" on 3-day windows | Shown on every window | 1 | 3 | 3 | 1 | 2 | 4 | 1 | **2.1** |
| | | **Priya overall** | | | | | | | | **3.1** |

### 2.4 Elena (BOS, 8 weeks) · Leave + Membership
| # | Persona action [I] | What the site did [E] | Need | Use | Fric | Val | Flow | Acc | Goal | Avg |
|---|---|---|---|---|---|---|---|---|---|---|
| E1 | Signup trip length | Ends at "2+ weeks" | 2 | 3 | 3 | 2 | 3 | 3 | 2 | **2.6** |
| E2 | BOS board and a route | Hero 49% below median; BOS→Oaxaca thin template; round trip only | 3 | 3 | 3 | 3 | 3 | 4 | 3 | **3.1** |
| E3 | `/leave`, "A month or more" | Six questions; month-plus mail line with USPS Hold Mail and a disclosed US Global Mail link; no 30-day limit, no insurer question | 3 | 5 | 4 | 3 | 5 | 3 | 3 | **3.7** |
| E4 | `/away-mode` | 14 partners, no trip-length question; insurance one education line | 3 | 3 | 3 | 3 | 3 | 3 | 3 | **3.0** |
| E5 | Reminders 30/14/7 | `/pricing` Plus waitlist; honest | 4 | 4 | 4 | 3 | 4 | 5 | 2 | **3.7** |
| | | **Elena overall** | | | | | | | | **3.2** |

### 2.5 Tess (MSP, two travelers) · Leave + Fare
| # | Persona action [I] | What the site did [E] | Need | Use | Fric | Val | Flow | Acc | Goal | Avg |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 | Tries `/time-off` | PTO and federal holidays only | 1 | 3 | 3 | 1 | 2 | 4 | 1 | **2.1** |
| T2 | MSP board | "Price history still building, so no deal verdict" | 2 | 4 | 3 | 2 | 3 | 5 | 2 | **3.0** |
| T3 | MSP→Lisbon | Thin template | 2 | 3 | 3 | 1 | 3 | 5 | 1 | **2.6** |
| T4 | `/leave`, month or more | As E3 | 3 | 5 | 4 | 3 | 5 | 3 | 3 | **3.7** |
| T5 | Signup, two, summer | Tops at "2+ weeks" | 3 | 4 | 4 | 2 | 4 | 3 | 2 | **3.1** |
| T6 | May reminders | As E5 | 3 | 4 | 4 | 2 | 4 | 5 | 2 | **3.4** |
| | | **Tess overall** | | | | | | | | **3.0** |

### 2.6 Ray & Linda (PHX → Lisbon, ten weeks, two) · Leave + Fare
| # | Persona action [I] | What the site did [E] | Need | Use | Fric | Val | Flow | Acc | Goal | Avg |
|---|---|---|---|---|---|---|---|---|---|---|
| R1 | PHX board | "Chosen for the place"; no deal verdicts | 2 | 4 | 3 | 2 | 3 | 4 | 2 | **2.9** |
| R2 | PHX→Lisbon page, then `/check` | No price; "7 daily fares over 6 days, need 10 over 14" | 2 | 4 | 3 | 1 | 3 | 5 | 1 | **2.7** |
| R3 | Signup for ten weeks | Tops at "2+ weeks" | 2 | 3 | 3 | 2 | 3 | 3 | 2 | **2.6** |
| R4 | `/leave`, month or more | As E3 | 3 | 5 | 4 | 3 | 5 | 3 | 3 | **3.7** |
| R5 | `/away-mode` for guidance | One insurance line; no official links | 3 | 3 | 3 | 3 | 3 | 4 | 2 | **3.0** |
| | | **Ray & Linda overall** | | | | | | | | **3.0** |

### 2.7 Gloria (reported separately, never weighted)
| # | Persona action [I] | What the site did [E] | Need | Use | Fric | Val | Flow | Acc | Goal | Avg |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | Opens a shared link | Only generic `/time-off/sea`; no handoff page | 1 | 3 | 3 | 1 | 2 | 2 | 1 | **1.9** |
| G2 | Checks what it reveals | No dates, address or codes | 3 | 4 | 4 | 2 | 4 | 5 | 3 | **3.6** |
| | | **Gloria overall** | | | | | | | | **2.7** |

### 2.8 Seven-criterion summary
| Criterion (39 steps) | Mean |
|---|---|
| Accuracy | **3.6** (v1 3.7; M2 corrected) |
| Usability | **3.6** |
| Friction (inverted) | 3.4 |
| Flow | 3.2 |
| Need | 2.9 |
| Value | 2.5 |
| Goal | **2.3** |
| **All criteria** | **3.1** |

Persona means: Dana 3.3, Elena 3.2, Priya 3.1, Marcos 3.0, Tess 3.0, Ray & Linda 3.0, Gloria 2.7 (separate).

---

## 3. v2: ten added parameters

The seven criteria judge each step. These ten judge the whole journey and the conditions around it, so they catch what step scoring misses: whether the persona's data exists at all, how long it takes to reach anything useful, and whether the experience is trustworthy, accessible and within Sparkfare's own rules.

| # | Parameter | Question it answers | How it is scored (1–5) | Source of evidence |
|---|---|---|---|---|
| P8 | **Trust and transparency** | Does every claim show its basis, time and seller? | 5 = basis, as-of time with zone, seller and disclosure everywhere, no hype; 1 = unsupported or misleading claims | Page copy, section 4 |
| P9 | **Time to first value** | How quickly does the persona get one useful, personal answer? | 5 = first screen, one action; 3 = two or three actions or one long scroll; 1 = never | Click count, scroll depth (section 5) |
| P10 | **Confidence gain** | After the journey, is the persona more sure of reaching the goal? | 5 = can act now; 1 = less sure than before | Persona goal vs result |
| P11 | **Personal fit** | Does the site use their dates, party size, trip length and calendar? | 5 = all four; 1 = none | Feature inventory |
| P12 | **Empty-state quality** | When there is no data, does the page offer a next step? | 5 = honest plus a useful action; 3 = honest only; 1 = blank or misleading | Thin pages, windows |
| P13 | **Data coverage** | Share of the persona's routes with a verdict | 5 = ≥80%; 4 = 60–79%; 3 = 50–59%; 2 = 30–49%; 1 = <30% | Section 4.3 |
| P14 | **Meter linkage** | Does the journey reach an honest revenue or audience moment? | 5 = natural, disclosed next action at the right time; 1 = none or forced | Links, CTAs |
| P15 | **Guardrail compliance** | Referral copy, no urgency, insurance education only, dates private | 5 = clean; 1 = a hard breach | Copy scan, section 4.4 |
| P16 | **Accessibility and mobile** | WCAG 2.2 AA indicators and phone fitness | 5 = no issues found; 3 = several moderate; 1 = blocking | Section 5 |
| P17 | **Performance** | Load speed and stability | 5 = good on all Core Web Vitals thresholds; 1 = poor | Section 5 |

### 3.1 Scores on the added parameters (Hub judgment, journey level)
| Persona | Trust | TTFV | Conf | Fit | Empty | Coverage | Meter | Guard | A11y/mobile | Perf | **Mean** |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Dana | 4 | 4 | 3 | 2 | 4 | 3 (58%) | 3 | 3 | 3 | 5 | **3.4** |
| Marcos | 2 | 2 | 2 | 1 | 3 | 2 (42%) | 2 | 2 | 3 | 5 | **2.4** |
| Priya | 4 | 4 | 2 | 3 | 3 | 2 (42%) | 2 | 4 | 3 | 5 | **3.2** |
| Elena | 4 | 3 | 3 | 2 | 3 | 3 (50%) | 3 | 4 | 3 | 5 | **3.3** |
| Tess | 4 | 2 | 2 | 1 | 3 | 1 (0%) | 2 | 4 | 3 | 5 | **2.7** |
| Ray & Linda | 4 | 2 | 2 | 1 | 3 | 1 (0%) | 2 | 4 | 3 | 5 | **2.7** |
| Gloria (separate) | 3 | 1 | 1 | 1 | 2 | n/a | 1 | 5 | 3 | 5 | **2.4** |
| **Mean, six weighted seats** | 3.7 | 2.8 | 2.3 | **1.7** | 3.2 | **2.0** | 2.3 | 3.5 | 3.0 | 5.0 | |

**Why each low score is low**
- **Personal fit 1.7 (the lowest on the site).** No page uses the traveler's dates, party size or a school calendar, and the signup stops at "2+ weeks". The data already carries the dates and airline of every fare (section 4.2); the site does not show them.
- **Data coverage 2.0.** 28% of US routes can give a verdict; MSP and PHX have none (section 4.3). Tess and Ray & Linda score 1 here before any design question arises.
- **Confidence gain 2.3 and Meter linkage 2.3.** Most journeys end on a page with no next action: route pages have no fare link and no watch without an account; windows have no fare; thin pages have no "watch for the first fare".
- **Trust 2 for Marcos.** His origin's hero carries urgency copy, and the LIVE-CHECKED tag on his route marks a stale price (section 4.1).
- **Performance 5.** Every page measured loaded in well under a second in this browser, with no layout shift (section 5). This is a lab reading, not field data.

### 3.2 The split, kept
- Dana and Elena hold up best (3.4 and 3.3): their origins have data and their first tools (`/check`, `/leave`) work.
- Marcos is lowest of the weighted seats (2.4): data exists for his route, but trust and fit fail him.
- Tess and Ray & Linda (2.7) are failed by coverage first: no amount of design helps until MSP and PHX have prices or an honest substitute.
- Gloria (2.4, unweighted) has nothing built for her yet.

---

## 4. v2: data-integrity audit of the published fare files [E]
Read on Oct 17 from `/sparkfare_ranked_deals.json` (JFK, generated Oct 16 08:08 UTC) and `/sparkfare_ranked_deals_other_origins.json` (all other origins, generated Oct 16 19:23 UTC). These files are what the board renders.

### 4.1 The LIVE-CHECKED tag is inverted
On the SFO board, the "LIVE-CHECKED PRICE" tag appears on exactly six cards: San Jose, Da Nang, Prague, Budapest, Petra and Oaxaca. Those are exactly the six SFO rows with `is_stale_fallback: true` (prices carried forward from an earlier day, as-of dates Oct 9 to Oct 14). None of the 20 fresh SFO cards carry the tag. The tag tells the traveler the opposite of the truth. This explains item 67 and the ATL→Bogota conflict.

### 4.2 Fares for flights that have already left
Ten priced rows have a departure date before Oct 17, among them SFO→Petra (featured, departs Oct 12, shown on the SFO board with the LIVE-CHECKED tag), CLT→Cappadocia (featured, Oct 13), SFO→Prague (Oct 14, shown), SFO→Lisbon (Oct 16, shown), BOS→Bogota (Oct 15) and SEA→Sydney (Oct 9). Their "View fare" links would open a search for past dates. 58 priced rows are stale fallbacks in total; 16 of them are deals or featured heroes, including IAD→Thessaloniki shown as a deal from data last fresh Oct 9.

### 4.3 Coverage
| Measure | Value |
|---|---|
| Routes in the data | 828 (794 US + 34 TLV) |
| Routes the site claims | 880 (directory has 880 links) |
| No data | 488 (59%) |
| Building history | 94 |
| Verdict-capable (deal + not a deal) | 221 of 794 US routes (**28%**) |
| Deals | 42, of which 7 are TLV (test origin) |
| US origins with no verdict-capable route | 10 of 22: AUS, BWI, CLT, DEN, DTW, FLL, LAS, MSP, PHL, PHX |
| Lowest "deal" margin | 6% below median (SEA→Maldives); 7 of the 35 US deals are under 10% below median |
| Basis-count mismatches | SEA→Larnaca "10 observations" with 9 history points; IAD→Thessaloniki "15" with 16 |

### 4.4 What the data already holds but the site does not show
Every priced row carries `departure_at`, `return_at`, `airline`, `found_at`, `median_baseline` and a full `price_history` [E]. Examples: JFK→Mallorca $623 is Dec 1 to Dec 8 on TAP; SFO→Sydney $663 is a specific dated itinerary. Trip lengths in the data range from 3 nights or fewer (23 fares) to 30+ nights (23 fares), so long-stay fares exist for Elena. Every booking link is for 1 adult (Aviasales link format ends in the adult count); none is one way.

### 4.5 Generated copy (guardrail scan)
Hero and card blurbs are generated text. Samples seen on Oct 17: "Pure visual storytelling." (AUS hero), "Currency arbitrage meets temple culture." (Bali), "70% less than Mediterranean equivalents" (Marrakech), "70% less than comparable Western European capitals" (Prague), "prices drop 40%" (Lisbon), "worth a look before rates reset" (SFO hero, Sydney), "Move fast, premium positioning rarely lasts" (ATL hero). The comparative figures have no stated source. Legal flag (non-attorney): FTC Guides Against Deceptive Pricing treat an unsupported "comparable value" comparison as deceptive (16 CFR 233.2); verify with counsel. Route pages promise to be "notified instantly when airlines slash the fare" while alerts are daily.

---

## 5. v2: page-level technical measures [E]
One lab load each in the built-in browser on Oct 17 (desktop unless noted). Accessibility checks are indicators from DOM reads, not a full WCAG audit.

| Page | TTFB | Load | Requests | Transfer | H1 | `<main>` | Targets <24 px | Text <14 px | Reading grade* | Height | Other |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/` | 117 ms | 359 ms | 25 | 139 KB (2.2 MB decoded, images) | **0** | no | 13 of 28 | 35 of 64 | 12.4 | 9,536 px desktop; 5,522 px mobile on second read (earlier 11,580 px) | Origin select `#join-origin` has no label; email field has no `autocomplete`; 7 images without width/height; no skip link; CLS 0; SparkLoop embed script and Clerk load on every visit |
| `/check` | 27 ms | 73 ms | 7 | 29 KB | 1 | no | 3 | 14 of 19 | 16.1 | 4,012 px | No canonical, no OG image; price field uses `inputmode=decimal` (good) |
| `/leave` | 36 ms | 65 ms | 7 | 8 KB | **2** | no | 3 | 10 of 15 | 8.4 | 2,723 px | Plain language |
| `/away-mode` | 31 ms | 119 ms | 13 | 15 KB | 1 | no | 3 | 25 of 64 | 9.7 | 8,879 px | No canonical; meta description no longer says "Secure" (was seen earlier) |
| `/time-off/sea` | 55 ms | 103 ms | 5 | 8 KB | 1 | no | 3 | 66 of 267 | (lists distort it) | **27,488 px** | 185 interactive elements |
| `/data/jfk-to-mallorca-spain` | 33 ms | 178 ms | 8 | 7 KB | 1 | no | 13 | — | 12.8 | 8,460 px | JSON-LD present (Organization, BreadcrumbList, WebPage, TravelAction); no outbound fare link; no dates |

*Flesch-Kincaid grade estimated from page text; public-sector plain-language guidance aims for grades 6 to 8.

**Mobile first screen (375 × 812).** The first screen holds the signup form and the origin bar only. The hero image starts at about 805 px, its price at about 1,210 px, and the first deal card at about 1,680 px. NN/g's 2018 eye-tracking found about 57% of page-viewing time is spent above the fold, so the first screen currently spends most attention on a form before any value is shown.

**Contrast.** 2 of 88 sampled text elements on `/` fall below 4.5:1 (3.65:1, 14.4 px).

**Console and network.** The homepage calls `/api/leave-by-plan/status`, which returns 404 while the flag is off; this is a likely source of the 404 seen on `/check` (item 70). `/api/long-leave` and `/api/route-links` both return `{"enabled": false}`.

---

## 6. v2: how to measure this with real users (proposed)
| Layer | Measure | How (passive) | Target to aim for |
|---|---|---|---|
| Task success | Share of visits that reach the persona's success state (verdict seen; plan built; checklist finished; watch created) | Existing event pipeline; one funnel per scenario | Baseline at Day 14 |
| Ease | **Single Ease Question** after `/check`, `/leave` and the planner: one 7-point question, "How easy was that?" | One inline question, optional, no account | MeasuringU's average is about 5.5 of 7 across 400+ tasks |
| HEART | Happiness (SEQ), Engagement (return visits per signup), Adoption (first watch or plan), Retention (opens and clicks at 30 days), Task success (above) | Goals → signals → metrics per meter | Set after F0 data |
| Revenue meters | F0 revenue per departure | `ENABLE_METER_TRACKING` (synced repo shows `"false"`; item 74) | Dec 11 gate |
| Moderated check | Five short sessions per persona type before Dec 11, scripted from the journey library | Owner-run, recorded with consent | Validate or overturn this report's scores |
| Field performance | Core Web Vitals at the 75th percentile: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 | Cloudflare Web Analytics already on | Keep all three "good" |

---

## 7. Findings the owner should see first (v1 items kept, v2 items added)

**Accuracy and trust (fix before the Nov 6 freeze)**
1. **LIVE-CHECKED tag inverted** (section 4.1). Shown only on stale prices.
2. **Past-departure fares on the board** (section 4.2).
3. **Petcube is live** on `/away-mode` and `/disclosure`, against D-013 and Addendum D. Owner to confirm.
4. **Urgency and unsupported claims in generated blurbs** (section 4.5). Legal flag, non-attorney.
5. **"Book airport parking ahead"** on `/away-mode`. The "Secure" meta description was not seen on the second read.
6. **"Notified instantly"** on route pages against a daily alert.

**Product gaps that hold scores down**
7. Route pages are dead ends: no fare link, no dates, no watch without an account.
8. Coverage: 28% of US routes have a verdict; ten US origins none.
9. The fare's dates, airline and nights exist in the data but are not shown.
10. Trip-length mismatch (`/leave` month-plus vs signup "2+ weeks"); synced repo and live API show `ENABLE_LONG_LEAVE` off.
11. Account wall on watchlists, while an email-only watch already exists for PTO windows (`ENABLE_PTO_WATCH` true).
12. Time-off planner: no fares (`ENABLE_PTO_FARES` was turned off Oct 11 at 36% window coverage), generic share link, home checklist on 3-day windows.
13. Mobile first screen shows no value before the form; homepage has no H1 and no `<main>`.
14. Deal threshold lets 6–9% below median count as a deal.

**What works and should not be touched:** `/check`; the MSP "no deal verdict" label; federal holiday dates and PTO arithmetic; `/leave` flow and plain language (grade 8.4); disclosure placement; fast, stable pages.

---

## 8. Audit (AGENT_QUALITY_AUDITOR, applied by the Hub; not a separate agent run)
1. Status grounded: **PASS.** Statuses come from browser reads and the site's own JSON on Oct 17; `/hub` and `/pricing` tagged [I]; flag values quoted from the synced repo file and the live API.
2. No scope breach: **PASS.** Personas did not price or give legal views; legal points are flags, non-attorney.
3. Figures sourced or labeled: **PASS.** Coverage counts computed from the two JSON files; seven-criterion means recomputed after the M2 change (accuracy 3.67 → 3.64, shown as 3.6); added-parameter scores are judgment, labeled; external figures cited (NN/g, MeasuringU, Core Web Vitals, WCAG 2.2, 16 CFR 233.2).
4. Legal-adjacent claims flagged: **PASS.**
5. No fabrication: **PASS.** Untested items listed.
6. Assumptions stated: **PASS.**
7. Conflicts surfaced: **PASS.** Items 63 to 80.
8. Attribution intact: **PASS.** Product Reality (sections 2, 4, 5), Synthesizer (2.8, 3), Legal flags (4.5, 7).
STATUS: PASSED

## 9. Reconciliation items
63 to 70 as raised in v1 (see `state_SESSION_STATE.md`). New in v2:
71. LIVE-CHECKED tag shown on stale fallbacks only (refines 67).
72. Ten priced rows with past departure dates; some shown on the board.
73. Route count: data has 828 routes (794 US); site and directory claim 880.
74. Synced `wrangler.jsonc` shows `ENABLE_METER_TRACKING` and `ENABLE_LONG_LEAVE` `"false"`; live `/api/long-leave` says disabled. D-005 and D-006 directed both on; item 27 recorded both "true" on Oct 14. F0 data (Calibrate step) is blocked while meter tracking is off.
75. SparkLoop embed script (`js.sparkloop.app/embed.js`) loads on the homepage while G8 is recorded as waiting on SparkLoop acceptance.
76. Homepage has no H1 and no `<main>` landmark; one select without a label.
77. Item 65 partly resolved: the "Secure" meta description was not present on the second read.
78. Deal threshold: 7 of 35 US deals are under 10% below median.
79. Generated blurbs carry stray phrases and unsourced figures (section 4.5).
80. `/api/leave-by-plan/status` 404 on page load while the flag is off; probable source of item 70.
