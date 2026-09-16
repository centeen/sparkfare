# Sparkfare — Site/Business Summary for Awin

**Status**: reference draft, for pasting into Awin publisher-profile or program-specific
application forms (same account already used for SimpliSafe, Airport Reservations, Timekettle,
and the NordVPN application). Not submitted anywhere on its own — pull from this as needed per
program.

---

## Short version (for a program-specific "describe your promotional method" field)

Sparkfare (sparkfare.com) is a flight-deal alert site: it scans flight prices daily and flags a
deal only when today's price is meaningfully below that specific route's own 30-day trailing
average — not a guessed "typical price," a predicted future price, or a marketing team's opinion
of a bargain. That "found a real deal" moment is the entry point into **Away Mode**, a curated
checklist of pre-trip services (travel insurance, eSIM, luggage storage, mail forwarding, flight
delay/cancellation compensation) shown once a user has a trip tracked, framed as "everything else
for the trip, handled." Affiliate partner links appear in the Away Mode page, the post-signup
follow-up email, and pre-departure reminder emails — always preceded by an FTC disclosure.

## Longer version

**What it is.** Sparkfare tracks daily flight prices across 12 major US airports (JFK, LAX, ORD,
ATL, DFW, SFO, MIA, IAD, EWR, SEA, IAH, BOS) against ~40 curated leisure destinations, computing a
genuine trailing-average baseline per route before ever calling something a "deal." The ranking
logic is deliberately simple and public (the repository itself is open-source) specifically so the
deal claim is falsifiable, not a black box — the algorithm has no commission or partner input at
all, by design.

**How it monetizes.** Sparkfare doesn't sell flights or handle payment; it links out to booking
partners and, more centrally, to **Away Mode** — a short, curated list of real (not
placeholder/guessed) affiliate partners for the logistics around a trip rather than the flight
itself: travel insurance, an eSIM, luggage storage, a virtual mailbox for mail while away, and
flight-delay/cancellation compensation. This is the natural fit for a network like Awin — the
audience is already leisure travelers in the specific moment of having just booked or committed to
a trip.

**Audience.** Price-conscious US leisure travelers who signed up specifically because a data-backed
deal alert (not a generic newsletter) got their attention — an audience with above-average intent
to actually book and travel soon, not passive browsers.

**Promotional methods.**
- Daily and early-access ("Early Bird") deal-alert emails to opted-in subscribers.
- A growing content/SEO program: ~48 blog posts (destination guides, ranking-methodology
  transparency pieces, Away Mode explainers) plus 480 programmatic landing pages (one per
  origin/destination route pair), all organic-search-oriented, no paid acquisition.
- A referral loop (share a link, both parties get earlier access to the daily digest).
- Transactional, trip-lifecycle emails timed to a user's actual booking (post-click follow-up,
  pre-departure reminders) — these are the emails that carry Away Mode partner links, always with
  the FTC disclosure placed before any affiliate link.

**Stage.** Early-stage and pre-scale — the product and its email/content infrastructure are fully
built and live, but the real subscriber base is still small and there is no paid tier yet. Flagging
this plainly rather than overstating traffic: Sparkfare is applying to build a real, durable
partner relationship ahead of scaling distribution, not claiming volume it doesn't have yet.

**Compliance posture.** FTC affiliate disclosure appears before every partner link on every surface
(the Away Mode page, all transactional emails). Seller-of-travel and insurance-referral licensing
exposure has been researched (not resolved) given the site never touches payment — noted here for
transparency, not because it's expected to affect a service-referral program like this one.

---

*Sourced from the project's own CLAUDE.md and live codebase as of 2026-09-16. Figures describing
what's live (partner list, origin list, content counts) reflect actual current state, not
aspirational/planned features.*
