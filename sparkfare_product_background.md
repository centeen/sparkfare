# Sparkfare — Product Background

*Background reference document for a marketing agent. Reflects verified/live product status as of this document's creation — items marked "not live" should not be referenced as current features.*

**What it is:** A flight-deal-alert product at sparkfare.com. Users get emailed when a fare from their home airport is genuinely worth booking, based on real historical price data rather than a manually curated "deal."

**Tagline (live on site):** "It only sparks when the fare's real." (updated 2026-09-13, replacing the earlier "Flight deals ranked against real price history, not a marketing team's idea of a bargain.")

**Core claim:** Deals are ranked against each route's own real price history, not a marketing team's idea of a bargain.

**How ranking actually works:** Deals are surfaced using per-destination-cluster percentage-below-history thresholds (e.g., certain clusters need a 25% drop, others 15%, one cluster has no minimum and is always featured) — this is the substantiation behind the "honesty" claim, not just a slogan.

---

## Confirmed live features

- **Home airport selection** — 12 origins: JFK, LAX, ORD, ATL, DFW, SFO, MIA, IAD, EWR, SEA, IAH, BOS
- **Daily email deal alerts** — signup requires only email + home airport
- **Trip-length filter** on the homepage (Weekend / 4–6 days / 7–10 days / 11–14 days / 2+ weeks) — UI is live; whether selecting a length actually changes results shown is **unverified** (do not claim functional filtering until confirmed)
- **Away Mode** — a post-click page offering two live affiliate partners: SafetyWing (travel insurance) and Bounce (luggage storage). FTC-style disclosure appears before any affiliate link.
- **Trip tracking** — signed-in users clicking a deal go through a tagged redirect page, which also triggers an Away Mode follow-up email
- **Account system** — sign-in, preferences/unsubscribe page, and a Privacy Policy page (exists, but has not had a full legal content review)
- **40 destinations** across 4 curated clusters, each with destination copy and photography

## Explicitly NOT live — do not market these

- No functioning paid tier (a free/paid split was decided but the serving-layer build isn't done — all users currently get the same experience)
- No hourly refresh / multi-origin real-time pipeline (built but gated behind an unresolved API rate-limit confirmation)
- No "My Trips" dashboard
- No points/miles or frequent-flyer features
- No other Away Mode partners beyond SafetyWing and Bounce (Airalo, Priority Pass, TaskRabbit, Babbel are pending or not yet applied)
- No monetization/billing system (deliberately deferred, not an oversight)

---

## Target audience

1. **Practical Planner** — plans 1–3 trips/year around a fixed window (limited PTO, school breaks); wants one clear, simple alert rather than a flood of options.
2. **Spontaneous Opportunist** — flexible schedule, open to any destination if the price is genuinely good; skeptical of inflated "deal" marketing from prior experience elsewhere.
3. Explicitly **not yet targeted**: points/miles power users — no product feature currently serves this segment; don't build messaging toward it.

## Competitive position

Closest competitors are Going (formerly Scott's Cheap Flights), Thrifty Traveler, and Dollar Flight Club. All three treat trip length as a single binary "weekend getaway or not" category, usually paywalled. None offer a granular length spectrum. Sparkfare's differentiation, once the filter is verified functional, is genuine trip-length matching plus a transparent, stated ranking methodology (vs. competitors' opaque "our experts found this" framing).

---

## Brand direction (in progress, not finalized)

- **Name logic:** "Spark" = the moment a deal clicks; "fare" = the price itself
- **Positioning concept:** reads like "an honest instrument displaying a real number," not a travel brochure — data leads, not destination photography
- **Color:** warm neutral background (`#EDE6D6`), near-black text (`#2B2620`), single gold accent (`#E8B930`) reserved only for signaling a genuinely good deal
- **Type:** Space Grotesk (headlines), Inter (body), IBM Plex Mono reserved specifically for numbers/prices
- **Logo mark:** "Ticket stub" — a torn boarding-pass shape where the tear is drawn as a spark. Still a concept, pending professional design refinement and a full attorney-run trademark clearance search (a compass-needle alternative was already rejected after a preliminary search found it conflicts with Compass, Inc.'s registered real-estate trademark)
- **Layout principle:** ledger-style rows, not rounded card grids

## Messaging pillars

1. **Priced honestly** — cleared for use
2. **Built around your actual trip** — **ON HOLD**, blocked on trip-length filter verification above
3. **Everything else, handled** (Away Mode) — cleared for use

---

## Compliance constraints for any new marketing material

- Any affiliate link needs disclosure before it, matching the existing site pattern
- Any specific savings-percentage claim needs a documented, consistent methodology before publishing — none exists yet beyond the internal ranking logic
- "Sparkfare" the name passed a preliminary trademark knockout search with no conflicts found, but formal clearance hasn't been done
