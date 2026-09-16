# Sparkfare Go-To-Market Product Launch Plan: The "Autonomous Ledger"

## 1. Executive Strategy & Positioning

* **The Core Premise:** Sparkfare is a financial instrument for travel, exposing airline Q4 price gouging by tracking real 30-day trailing averages. It is the antidote to the industry's false scarcity and inflated "deal" marketing.
* **The Launch Mechanic:** We bypass traditional paid ads and B2B publisher outreach. Instead, we weaponize the existing GitHub Actions Python data pipeline to automatically generate organic traffic (via Programmatic SEO and social broadcasting) and force viral sharing (via the Early Bird FOMO loop) across 12 unlocked US hubs.
* **The Revenue Engine:** 100% of flight deal clicks route into the automated "Away Mode" lifecycle sequence to generate passive affiliate revenue from SafetyWing, Bounce, US Global Mail, and AirHelp.

---

## 2. Phased Rollout: Building & Unleashing the Machine

### Phase 1: Pre-Launch Engine Assembly (Weeks 1-2)
*The focus is on building automation layers on top of the existing Cloudflare/D1/GitHub Actions architecture.*

* **The pSEO Matrix:** Write the script to generate 480 static HTML origin-destination pages (12 hubs × 40 destinations) based on `sparkfare_hourly_ranked_deals.json`. Optimize the H1 tags for winter/spring travel intent (e.g., *"JFK to Tokyo Winter Flights: 22% Below 30-Day Average"*).
* **The Social Broadcaster:** Add a final step to the `daily-fetch.yml` GitHub Action to auto-generate and post deal images to X (Twitter) and Pinterest using the brand's Ledger/Paper palette and Spark Gold sparklines.
* **The FOMO Injector:** Update `src/email.js` for the 08:00 UTC send. If a deal price jumped since the 07:00 UTC Early Bird send, inject a dynamic warning: *"2 deals jumped in price before this email was sent. Early Bird members got them an hour ago. Click here to unlock 7:00 AM access."*

### Phase 2: "The Clean Room" TLV Testing (Week 3)
*Leveraging the Tel Aviv (TLV) design partners for rigorous QA before public exposure.*

* **QA the pSEO Pages:** Aggressively test the 480 static pages. Verify the origin selectors route perfectly into `account.html` and that the Space Grotesk typography renders correctly across mobile and desktop.
* **Test the FOMO Loop:** Test the Early Bird referral loop. Confirm delivery of the 07:00 UTC email and verify that the 08:00 UTC email correctly triggers the "missed deal" FOMO warning.

### Phase 3: The "Winter Data Leak" Launch (Week 4) - Re-Engineered
*Activating the autonomous acquisition machine with truly free, buildable channels.*

* **Bluesky + Mastodon Broadcasting:** Replace X (lost free tier in Feb 2026) with Bluesky and Mastodon. Both have genuinely free APIs and no approval queue. Use the same GitHub Action infrastructure already scoped for the broadcaster. (Build this first, highest leverage-per-hour).
* **SparkLoop Hosted Widget:** Swap the custom API integration (which relied on deprecated endpoints) for SparkLoop's free hosted widget. Use their drop-in script and dashboard matching instead. Setup this week.
* **One-Shot Launches:** Launch on Show HN, Product Hunt, and smaller launch boards immediately after the broadcaster goes live. Leverage Sparkfare's real trailing-average math and honest documentation as the core hook.
* **Slow-Burn Compounding:** Run genuine Reddit participation, "building in public," and cross-promotion with the 6 live Away Mode partners in parallel. Re-use the already-built `widget.html` for syndication.
* **Deferred:** Pinterest is deferred (approval process takes weeks/months).

### Phase 4: Autonomous Growth & Away Mode Monetization (Weeks 5+)
*Shifting focus to lifecycle optimization and maximizing ARPU.*

* **Lifecycle Polish:** Ensure the 3-day and 7-day "Away Mode" emails are triggering flawlessly based on `departure_at` dates.
* **CRO & Revenue Monitoring:** Monitor the click-through rates on SafetyWing (insurance), Bounce (luggage), and AirHelp (compensation) links within `away-mode.html` and the transactional emails.

---

## 3. Brand & Creative Enforcement

Even though acquisition is automated, it must look like a high-end financial instrument.

* **No Marketing Fluff:** The pSEO pages and automated social posts must adhere strictly to the style guide: Paper (`#EDE6D6`) backgrounds, Ledger (`#2B2620`) text, and Space Grotesk typography.
* **The "Spark" Rule:** The Spark Gold hex (`#E8B930`) must be reserved *exclusively* for verified deals and the sparkline data point.
* **Numerals:** All prices and percentages must use the IBM Plex Mono typeface.

---

## 4. Key Performance Indicators (The Zero-CAC Dashboard)

Because the model relies on bootstrapping and automation, traditional metrics like CPA and ROAS are irrelevant. Success will be tracked against:

1. **Acquisition Velocity:** Organic Search Impressions (pSEO), Co-Registration Lead Volume, Social Referral Clicks (from the automated social bots).
2. **Viral Coefficient:** Early Bird Referral Rate (The percentage of users successfully inviting friends to bypass the 08:00 UTC FOMO penalty).
3. **Revenue:** Away Mode Affiliate Revenue Per User (ARPU).
