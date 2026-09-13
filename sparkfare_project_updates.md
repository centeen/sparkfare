# Sparkfare: Business Plan V2.0 & Pressure Test Remediation
**Target:** Claude Code 
**Objective:** Update the Sparkfare project documentation to reflect the finalized V2.0 Business Plan. Then, execute the engineering tasks required to fix the deliverability and conversion gaps identified during the executive pressure test.

---

## PART 1: Documentation Updates
**Task:** Please read the following updated Business Plan summary. Update `CLAUDE.md` and our Master Workplan to reflect these new operational realities and KPIs.

### The Upgraded Business Plan V2.0 (Summary)
* **Core Model:** Zero-CAC autonomous travel utility. Monetization via "Away Mode" lifecycle emails (SafetyWing, AirHelp, Bounce, US Global Mail, etc.).
* **Acquisition Engine:** 480 automated Programmatic SEO (pSEO) pages + GitHub Actions social broadcaster + Early Bird (07:00 UTC) viral referral loop.
* **Operational Cash Flow Reality:** We now recognize a 60-day lag on all affiliate cash flow due to Net-60 payout terms from networks like Travelpayouts and Impact.
* **Upgraded KPIs:**
    * *Active (Engaged) Subscribers:* Total list minus users unengaged for >45 days.
    * *Blended CTR:* General Digest CTR (Target: 5%) vs. Watchlist Alert CTR (Target: >35%).
    * *Away Mode ARPU:* $0.75 per *engaged* subscriber per month.

---

## PART 2: Engineering Execution (Pressure Test Remediation)

Please begin executing the following architectural upgrades using our existing Cloudflare Workers, D1 (SQLite), and Resend stack.

### MODULE A: The 45-Day "Sunset Policy" (Deliverability Protection)
**Goal:** Protect Sparkfare's domain sender score by automatically pruning inactive users so Gmail/Apple Mail do not flag our daily automated emails as spam.

**Engineering Tasks:**
1.  **D1 Schema Update:** Ensure the `users` table has a `last_opened_at` timestamp column and an `is_subscribed` boolean (default `true`).
2.  **Resend Webhook Integration:** * Create a new Worker route in `src/index.js` (e.g., `POST /api/webhooks/resend`) to listen for Resend's `email.opened` events.
    * When an open event fires, extract the user's email/ID and update their `last_opened_at` timestamp in the `users` table to `datetime('now')`.
3.  **The Pruning Cron:** * Update the existing `EARLY_DIGEST_CRON` logic in `src/index.js`. 
    * Before sending the daily digest, run a query to flag any user where `last_opened_at` is older than 45 days.
    * Update their `is_subscribed` flag to `false`.
4.  **The "Goodbye" Email:** * Create a `sendSunsetEmail` function in `src/email.js`.
    * When a user is pruned, trigger this one-time email: *"We noticed you haven't checked the ledger recently. We've paused your daily alerts to keep your inbox clean. Click here to turn them back on."* (Include a reactivation link that sets `is_subscribed = true` and resets `last_opened_at`).

### MODULE B: Accelerate Target-Price Watchlists (Revenue/CTR Driver)
**Goal:** Move the Watchlist feature to Phase 1/Launch Blocker. General daily emails average a 5% CTR; personalized Watchlist alerts drive the 35%+ CTRs needed for aggressive Away Mode affiliate conversion.

**Engineering Tasks:**
1.  **D1 Schema Setup:**
    ```sql
    CREATE TABLE watchlists (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      origin_iata TEXT NOT NULL,
      destination TEXT NOT NULL,
      target_price INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    ```
2.  **Strict Validation Endpoint:** * Create `POST /api/watchlist`. 
    * **Crucial:** This endpoint MUST validate `origin_iata` against our 12 active hubs and `destination` against our 40 curated destinations. Reject any custom inputs to prevent Travelpayouts API bloat.
3.  **Cron Alert Logic:** * Extend the daily alert cron. Cross-reference the active `watchlists` against today's `sparkfare_hourly_ranked_deals.json`. 
    * If `current_price <= target_price`, trigger a high-priority "Target Reached" email alerting the user to book immediately.

### MODULE C: Operations & Support Configurations
**Goal:** Prevent solo-founder burnout from inbound customer support on an automated tool.

**Tasks (Update documentation/env variables):**
1.  Verify that `EMAIL_FROM` in `.env` is set to `hello@sparkfare.com`.
2.  Add a note in the project documentation for the human operator to configure a strict Auto-Responder in the `hello@sparkfare.com` inbox with the following template:
    > *"Thanks for writing to Sparkfare. We are an automated financial instrument tracking flight data, not a travel agency. We cannot book flights, offer custom route advice, or manage cancellations. If you are experiencing a technical bug, we will review this message shortly."*

---

## Next Actions for Claude Code
1.  Acknowledge receipt of the Business Plan V2.0 upgrades.
2.  Confirm that `CLAUDE.md` and the Master Workplan have been updated.
3.  Await my command to begin writing the code for **Module A (The 45-Day Sunset Policy)**.
