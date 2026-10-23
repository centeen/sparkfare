# M6 Answer-engine basics: Guard read request (2026-10-23)

For the Hub. Built on branch `m/m6-answer-engine` (ROADMAP step 146; ADDENDUM_M section 4).
M6 provides answer-engine foundations: a methodology page (`/how-it-works`), question-and-answer blocks with matching JSON-LD schema on `/check`, `/time-off`, and `/how-it-works`, root `llms.txt`, and IndexNow notification integration.

---

## 1. What is being read

Short question-and-answer blocks (two to four sentences each), rendered visibly on three customer-facing surfaces and reflected in `FAQPage` JSON-LD structured data:
1. **Methodology page (`/how-it-works`)**: 4 Q&As explaining the 30-day median, absence of predictions, 48-hour freshness, and consumer booking disclosures.
2. **Price check page (`/check`)**: 3 Q&As explaining comparison baselines, the Deal/Typical/High verdicts, and data privacy.
3. **Time-off planner (`/time-off` and `/time-off/<origin>`)**: 3 Q&As explaining bridge calculation, default federal holidays, and fare volatility.

---

## 2. Draft Copy by Surface

### Surface 1: `/how-it-works`

> **Q: How does Sparkfare determine whether a flight is a deal?**  
> **A:** We compare today's lowest round-trip fare against that exact route's trailing 30-day median price from our observation history. To qualify as a deal, a fare must sit at least 15% below its 30-day median and exceed two median absolute deviations in volatility. We also require at least 10 distinct observation days across a minimum 14-day history span before scoring any route.

> **Q: Does Sparkfare predict future airfare prices?**  
> **A:** No. Sparkfare does not predict future prices, state ideal purchase dates, or claim fares will rise or fall. Every calculation is derived strictly from observed daily search lows for that specific origin and destination pair.

> **Q: How fresh are the prices shown on Sparkfare?**  
> **A:** Fares are evaluated against a strict 48-hour freshness window from when our daily fetch observed the quote. If a price was last seen more than 3 days ago, it is marked as lapsed and cannot carry a deal badge. Outbound flights departing within 48 hours are automatically hidden.

> **Q: Can I buy tickets directly on Sparkfare?**  
> **A:** No. Sparkfare does not sell or book travel. When you click a fare link, we send you directly to our booking partners or airlines, where you can view current inventory and complete your purchase.

---

### Surface 2: `/check`

> **Q: What does the price check compare my price against?**  
> **A:** It compares the number you enter against Sparkfare's trailing 30-day median of the lowest cached round-trip fares for that route. We require at least 10 observation days spanning 14 days before showing a comparison. It does not predict future prices or reflect specific flight numbers.

> **Q: What do the Deal, Typical, and High verdicts mean?**  
> **A:** A Deal means the price is at least 15% below the route's 30-day median and meets our statistical volatility threshold. Typical indicates the fare falls within expected historical fluctuations. High means the price sits 15% or more above the 30-day median.

> **Q: Is my check personalized or tied to my search dates?**  
> **A:** No. Sparkfare baselines come from daily lowest round-trip quotes across all searches for the route, not your specific travel dates or itinerary. Nothing you type is sold, and checks run without cookies or personal tracking.

---

### Surface 3: `/time-off` and `/time-off/<origin>`

> **Q: How are long-weekend bridge days calculated?**  
> **A:** Sparkfare combines official federal holidays with adjacent weekends to identify contiguous days away from work. Any weekday between a weekend and an observed holiday is counted as a paid time off day. The optimizer schedules your chosen PTO budget to produce the longest possible trips.

> **Q: Which holidays are included by default?**  
> **A:** The planner starts with the seven holidays most commonly granted by private employers, following official Office of Personnel Management rules for observed dates. You can customize your schedule by selecting or unchecking any federal holiday on any airport page.

> **Q: Can flight prices change for these holiday windows?**  
> **A:** Yes. Fares shown for long-weekend windows reflect the lowest economy round-trip prices observed in search data and remain subject to airline availability. Sparkfare does not sell or book travel, and prices may change on partner sites.

---

## 3. Rules the copy meets

1. **Sentence length**: Every answer contains between 2 and 4 sentences.
2. **Brand v1 banned-pressure list**: Zero instances of "book now", "instantly", "the moment", countdowns, "only X left", "save $", activity counters, false urgency, or hype.
3. **Guard condition 5 (airfare claims)**: Derived statistics only, zero future predictions, zero claims of "cheapest day to book".
4. **Canonical disclaimer**: `"Sparkfare does not sell or book travel."` is prominently featured across all surfaces.
5. **Structured data fidelity**: Every question and answer in JSON-LD schema (`FAQPage` on `/how-it-works`, `/check`, and `/time-off`; `WebApplication` on `/check`) matches the visible DOM text word-for-word.
6. **Linters and checkers**: `npm run check:copy` passes cleanly across 1,020 repository files; `tests/k_b10_brand_lint.test.js` passes with zero raw hex color literals.

---

## 4. Root `llms.txt`

Created at repo root:
```markdown
# Sparkfare

> Sparkfare tracks round-trip flight deals against trailing 30-day median price baselines across 22 US airports. Sparkfare does not sell or book travel.

## Core Resources

- [How Sparkfare Works](https://sparkfare.com/how-it-works): Deal-scoring methodology, 30-day median baseline calculation, 15% deal floor, and freshness guardrails.
- [Holiday Flight Report 2026](https://sparkfare.com/reports/holiday-2026): Empirical airfare benchmark across 880 US routes, holiday departure windows, and origin coverage statistics.
- [Price Checker](https://sparkfare.com/check): Compare any round-trip airfare against Sparkfare's 30-day historical median for that route.
- [Time-Off and Long Weekend Planner](https://sparkfare.com/time-off): Optimize 2026 and 2027 paid time off around official US federal holidays and weekends.
```

---

## 5. One-Time Step for the Owner: Bing Webmaster Tools & IndexNow

- **IndexNow Key**: `c07b7b13e9a149c5950d24490f058097`
- **Key File URL**: `https://sparkfare.com/c07b7b13e9a149c5950d24490f058097.txt`
- **One-time step for owner**:
  1. Log into Bing Webmaster Tools (`bing.com/webmasters`).
  2. Add `https://sparkfare.com` as a property.
  3. Under verification methods, choose **IndexNow Key File**.
  4. Confirm verification: Bing will fetch `https://sparkfare.com/c07b7b13e9a149c5950d24490f058097.txt` and automatically verify ownership.

---

## 6. Proposed Privacy Policy Update (`privacy.html`)

For owner awareness and approval (can be included in the M6 PR or merged with owner OK):
> *"When we publish or update public pages, we notify search engines via the IndexNow protocol with the changed page URLs; these notifications include only public web addresses and never include personal or user data."*

---

## 7. Questions for the Hub

1. Is the Q&A copy approved as written for `/how-it-works`, `/check`, and `/time-off`?
2. Are the methodology explanations on `/how-it-works` (30-day median, 15% deal floor, 10 observation days, 48h freshness, and 3-day lapse) clear and properly aligned with Hub positioning?
