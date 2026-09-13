# Sparkfare Product Roadmap V2 (Autonomous Revenue Engine)

**Core Philosophy:** Every feature on this roadmap is designed to either lower Customer Acquisition Cost (CAC) to zero or multiply Away Mode Average Revenue Per User (ARPU). We reject vanity metrics, manual curation, and API bloat. We build high-leverage, asynchronous, and scalable systems.

---

## Q4 2026: The Data Capture & Intent Phase
**Objective:** Build the core revenue traps and ensure we only market to verified buyers to protect domain reputation and brand trust.

### 1. Constrained Target-Price Watchlists & Web Push
* **The Feature:** Users set price thresholds strictly bounded within our 12 origins and 40 destinations. The daily cron triggers alerts when thresholds are met.
* **The Upgrade:** Integrate HTML5 Web Push API. Email has latency; flight deals expire in minutes. Web Push delivers the "Target Hit" alert directly to mobile lock screens for instant conversion.
* **Engineering Task:** D1 `watchlists` schema, `POST /api/watchlist` strict validation endpoint, and Service Worker registration for Web Push.

### 2. "Forward to Trips@" Intent Verification
* **The Feature:** Transition from "click-based" triggers (which capture non-buyers) to 100% verified intent triggers using Resend Inbound Webhooks.
* **The Flow:** The Day 0 Deal Email instructs: *"Booked it? Forward your airline confirmation to `trips@sparkfare.com`. We will automatically sequence your travel logistics."*
* **Engineering Task:** Configure Resend Inbound Webhook route in Cloudflare Workers to parse forwarded receipts, extract `departure_at`, and initiate the Away Mode sequence.

---

## Q1 2027: The ARPU Multiplier Phase
**Objective:** Maximize the affiliate yield of every verified trip without increasing top-of-funnel acquisition costs.

### 1. The "Group Travel" Multiplier
* **The Feature:** Capture party size to multiply affiliate commissions. 
* **The Flow:** Add a "Passenger Count" integer field to `account.html` onboarding and Watchlist setups. Dynamically inject this number into the Away Mode email copy (e.g., *"Insure all 4 passengers via SafetyWing"*).
* **Engineering Task:** Add `passenger_count` column to D1 `users` table. Update `src/email.js` templates to output pluralized math.

### 2. Dynamic Contextual Upsell Injection
* **The Feature:** Increase affiliate conversion rates by only pitching relevant services.
* **The Flow:** Pitching mail forwarding for a 3-day weekend damages trust. If `trip_length` < 4 days, pitch Bounce (luggage). If the destination is international, pitch iVisa and NordVPN. 
* **Engineering Task:** Update `src/email.js` Away Mode triggers with conditional logic blocks reading the `destination` and `trip_length` variables.

---

## Q2 2027: The Organic Dominance Phase
**Objective:** Scale the top-of-funnel autonomously, secure high-authority backlinks, and protect the programmatic SEO (pSEO) engine.

### 1. The "Sparkfare Index" Live Dashboard
* **The Feature:** Our automated PR engine. A public dashboard (`sparkfare.com/index`) tracking the routes with the highest airline price gouging (highest percentage above the 30-day trailing mean).
* **The Flow:** A GitHub Action automatically tweets this anomaly data to major travel journalists weekly.
* **Engineering Task:** Write a query to isolate the top 5 inflated routes from `sparkfare_hourly_ranked_deals.json`. Build the GitHub Action (`weekly-pr-broadcast.yml`) with the X API.

### 2. The pSEO "Silo" Linking Engine
* **The Feature:** Prevent Google from ignoring the 480 automated destination pages by eliminating "orphan pages."
* **The Flow:** The pSEO Python script automatically injects related internal links at the bottom of every generated page (e.g., The "JFK to Tokyo" page automatically links to "JFK to Osaka" and "EWR to Tokyo"). 
* **Engineering Task:** Update the Python generation script to output a relational footer block before compiling the static HTML.

---

## Q3 2027: The Retention & Fraud Phase
**Objective:** Eliminate churn, drive brand loyalty, and protect the integrity of the Early Bird growth loop.

### 1. The Post-Trip "Route Retrospective"
* **The Feature:** 2 days after their trip ends, automatically trigger a validation email: *"You locked in $412 for Tokyo. The average traveler booking that week paid $650. You beat the algorithm by $238. Where to next?"*
* **Engineering Task:** Extend the daily cron to query the `trips` table for `return_at` dates matching `datetime('now', '-2 days')`. Fetch current 30-day average and dispatch via Resend.

### 2. "Verified-Only" Early Bird Fraud Protection
* **The Feature:** Prevent users from referring fake emails (e.g., `test1@gmail.com`) just to unlock the 07:00 UTC VIP digest.
* **The Flow:** The D1 `early_access` flag is no longer granted instantly upon a referral signup. It is only granted when the *referred user actually opens an email*.
* **Engineering Task:** Tie the `early_access` upgrade logic in D1 directly to the Resend `email.opened` webhook established in our Sunset Policy.