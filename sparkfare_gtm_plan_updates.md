# Sparkfare: Autonomous Ledger & GTM Expansion Plan
**Target:** Claude Code 
**Objective:** Update the Sparkfare project plan, Master Workplan, and `CLAUDE.md` to transition the product into a zero-CAC, autonomous acquisition and revenue engine. Then, prepare to execute the engineering tasks listed below.

## Strategic Context
We are abandoning manual B2B publisher outreach and paid acquisition. Sparkfare's growth will now be engineered through automated Python data pipelines, Programmatic SEO (pSEO), psychological referral loops (Early Bird FOMO), and a strictly automated lifecycle email sequence driving "Away Mode" affiliate revenue. 

Please parse the following 4 Modules. Add them as concrete steps/phases to our project tracking documents, and prepare to build them using our existing framework-free frontend, Cloudflare Workers, D1 (SQLite), and Resend stack.

---

## MODULE 1: Autonomous Acquisition Engine (GTM & Launch)
**Goal:** Weaponize the daily `sparkfare_hourly_ranked_deals.json` data to generate zero-cost traffic.

**Engineering Tasks:**
1. **Programmatic SEO (pSEO) Generator:** Write a script to generate 480 static HTML pages (12 origins × 40 destinations) based on the daily JSON output. 
   - **URL Structure:** `/data/{origin}-to-{destination}`.
   - **Content:** Inject today's live price, the 30-day historical average, the inline SVG sparkline, and an H1 optimized for search (e.g., "Flights from JFK to Tokyo: 22% Below 30-Day Average"). 
   - **Action:** Embed the email capture widget natively on these pages.
2. **Headless Social Broadcaster:** Add a final step to the `daily-fetch.yml` GitHub Action. When the ranking script flags a "Deal," a Python script (using Pillow or similar) overlays the Sparkfare UI (Ledger text, Spark Gold price, sparkline) onto the destination's Unsplash image and pushes it to X (Twitter) and Pinterest via API.
3. **Co-Registration Integration:** Add a checkbox to the post-signup success state (`index.html`, `widget.html`) to integrate with SparkLoop or Beehiiv's recommendation network to trade leads 1-for-1 with other travel newsletters.

---

## MODULE 2: The Outbound Email Engine (Lifecycle & FOMO)
**Goal:** Upgrade `src/email.js` into an automated, highly contextual SaaS retention engine mapped to the psychological phases of travel.

**Engineering Tasks:**
1. **Email 0: Daily Digest (The FOMO Engine):** Update the 08:00 UTC general send logic. If a deal price jumped since the 07:00 UTC Early Bird send, inject a high-contrast banner: *"Notice: 2 deals jumped in price before this email was sent. Early Bird members got them an hour ago. [Click here to refer 1 friend and unlock 7:00 AM access]."*
2. **Email 2: The Stress Valve (Day 2 Post-Click):** Triggered 2 days after a user clicks a flight deal (logging `destination` and `departure_at`). Focus: SafetyWing and US Global Mail. Subject: "Your logistics for [Destination], handled."
3. **Email 4: The Departure Briefing (Day -7):** Ensure `sendDepartingSoonAlerts` triggers exactly 7 days before `departure_at`. Focus: Yesim, Bounce, and AirHelp.
4. **Strict Email CSS/Styling Rules:** - Apply CSS fallback stack: `font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;`. Use IBM Plex Mono for all numerals.
   - Implement `@media (prefers-color-scheme: dark)` to swap Paper (`#EDE6D6`) and Ledger (`#2B2620`) to Dark Paper (`#211F1A`) and Dark Ledger (`#EDE6D6`).
   - Ensure text inside Spark Gold (`#E8B930`) CTA buttons is Dark Ledger (`#2B2620`) for WCAG contrast compliance.

---

## MODULE 3: Core Architecture Upgrades (The 5-Point Plan)
**Goal:** Bulletproof the attribution, retention, and scalability of the platform.

**Engineering Tasks:**
1. **Privacy-First Affiliate Attribution (Server-Side):**
   - **Schema:** Create `away_mode_clicks` table in D1 (`id`, `trip_id`, `partner_id`, `affiliate_slug`, `clicked_at`).
   - **Route:** Create a Worker endpoint `GET /go/:affiliate`.
   - **Logic:** Route outbound affiliate clicks (e.g., `/go/safetywing?trip_id=123`) through this endpoint to `INSERT` a log matching the user's `partner_id` before returning a 302 redirect to the partner link.
2. **The "Route Retrospective" Post-Trip Loop:**
   - **Logic:** Extend the daily Cron in `src/index.js`. Query the `trips` table for rows where `return_at` is exactly 2 days in the past.
   - **Action:** Fetch the *current* 30-day average for that route and trigger `sendRouteRetrospectiveEmail`. Compare their locked-in price to the current average to validate their purchase or generate FOMO if they didn't book. Ensure idempotency via a `route_retrospective_deliveries` D1 table.
3. **Constrained Target-Price Watchlists:**
   - **Schema:** Create `watchlists` table in D1 (`id`, `user_id`, `origin_iata`, `destination`, `target_price`, `created_at`).
   - **Constraint:** `POST /api/watchlist` MUST strictly validate against the 12 active origins and 40 curated destinations to prevent API rate-limit bloat. 
   - **Logic:** During the daily cron, cross-reference watchlists against the existing `sparkfare_hourly_ranked_deals.json`. If `current_price <= target_price`, trigger a "Target Reached" email.
4. **The Sparkfare Index (Automated PR Engine):**
   - **Dashboard:** Create `sparkfare.com/index` fed by a script isolating the top 5 routes where the current price is *highest* above the 30-day trailing average (Price Gouging Watchlist).
   - **Automation:** Create a new GitHub Action (`weekly-pr-broadcast.yml`) set to run every Friday at 14:00 UTC to auto-tweet the most inflated route.
5. **Affiliate Health-Check Automation:**
   - **Logic:** Add a weekly Cron trigger to ping every URL in the `AWAY_MODE_PARTNERS` array (`src/email.js`) via `fetch(url, { method: 'HEAD' })`.
   - **Alerting:** If any URL returns a 404, 500, or redirect loop, trigger `resend.emails.send` to dispatch a critical alert to `hello@sparkfare.com` to prevent passive income loss from link rot.

---

## Next Actions for Claude Code
1. Acknowledge receipt of this plan.
2. Propose the exact file updates for `CLAUDE.md` and the Master Workplan to log these as new Phases/Steps.
3. Await my command to begin executing Module 1.
