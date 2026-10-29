# Guard read package: C1.4 lifecycle email v2 (G116)

Flag: `ENABLE_LIFECYCLE_V2` (default `"false"`; flip from Nov 9). Off: every email is exactly as today. Copy in `content/emails/lifecycle_v2.json` (preheaders, button labels) plus the existing body text of each email, unchanged.

## The anatomy (six emails: departing soon, 7-day briefing, stress valve, purchase reported, prep sequence, trip stream)
1. A hidden **preheader** line.
2. A heading and the existing short body text.
3. **One button** (sage): "Open your checklist", or "See your trip" for the purchase-reported email.
4. **At most one partner**, below a rule, with the commission sentence **directly above** it, then "One thing that may help:" and the partner line.
5. The usual footer (unsubscribe, postal address).
The route retrospective has no partner and no button to standardise, so it is unchanged.

## Which partner (extends `prioritizePartners`, pure, in `src/lifecycleV2.js`)
- 2 days or fewer to departure: luggage (Bounce).
- 3 to 9 days: phone and data (Yesim); a weekend trip: luggage.
- Earlier, party of 3 or more: delay compensation (AirHelp).
- Earlier, weekend: luggage. 11-14 days, `2+ weeks`, `30_plus`: mail (US Global Mail).
- Otherwise the first available partner. Only partners live in the partner list are ever chosen.

## Questions for the Hub
1. Is "One thing that may help:" an acceptable lead-in, and is the disclosure sentence close enough to the partner line?
2. Is the party-of-3-or-more rule (delay cover) reasonable, or should party size not pick a partner?
3. Preheaders: any urgency or promise in them?
4. One partner instead of the old lists (some emails showed three): acceptable for revenue visibility until Task D?
5. The stress-valve email keeps its "Did this trip happen?" taps as a paragraph when ENABLE_TRIP_SELF_REPORT is on. Fine?

## Operations
No migration, no new table. Mutations checked in tests: returning all partners, ignoring days-to-departure, and moving the disclosure below the partner each fail tests.
