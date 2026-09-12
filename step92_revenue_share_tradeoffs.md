# Step 92 — Publisher Revenue-Share Decision: Tradeoffs

**Purpose**: lay out what's actually at stake in picking a publisher revenue-share number, not
recommend a specific figure — that's a business call only Coby can make. The real finding here is
that **the percentage matters less than a measurement problem underneath it**, which the number
alone doesn't solve.

## What "20%" (or any %) actually means

The GTM draft proposes 20% of "downstream affiliate revenue" to a referring publisher. That's 20%
of **Sparkfare's own commission**, not 20% of the customer's purchase — a share of a share, much
smaller than it sounds:

| Partner | Sparkfare's real commission | Publisher's cut at 20% | Publisher's cut at 10% |
|---|---|---|---|
| Bounce | 10% per booking | 2% of the booking | 1% of the booking |
| SafetyWing | ~10% recurring | 2% of the subscription | 1% of the subscription |
| US Global Mail | $50 flat, or 20% for 6mo | $10 flat, or 4% for 6mo | $5 flat, or 2% for 6mo |
| Flight bookings (Aviasales) | Not documented anywhere in this project | Unknown | Unknown |

Worth naming explicitly to publishers if this goes out: "20% of our affiliate revenue" and "20% of
your reader's purchase" are very different numbers, and a publisher doing quick mental math might
assume the bigger one.

## The real blocker: measurement, not the number

This is the part worth weighing most heavily. **For all three of Sparkfare's real, live Away Mode
partners, there is currently no way to know how much revenue a specific publisher's referred users
actually generated.**

SafetyWing, Bounce, and US Global Mail's links are Coby's own **personal referral links** — not
network/sub-ID links. `logAwayModeEmail` (Step 91) records that an Away Mode email was *sent* to a
user attributed to a given `partner_id`; it has no way to know whether that user actually bought
SafetyWing insurance or booked Bounce storage afterward, because none of those three partners
report conversions back to Sparkfare at the individual-referral level — Coby just gets one lump
commission figure per partner, with no way to break it down by which publisher's reader it came
from.

**The flight-booking side is closer, but not there either.** `reconcileBookings()` already calls
Travelpayouts' real statistics API and requests `price_eur` in its query — but that field is
fetched and then **discarded**; only `state` and `sub_id` are actually used today. The data needed
to calculate real flight-revenue-per-publisher is already flowing through the system on every
reconciliation run; persisting it and joining it to `partner_id` is a real but comparatively small
gap — much closer to buildable than the Away Mode side, which has no data path at all.

**Net effect**: a publisher revenue-share promise is, right now, honestly fulfillable only for
flight bookings (and only after a small build), and not fulfillable at all for the three Away Mode
partners that are actually the product's differentiator being pitched. Any Away Mode share would
have to be an estimate or honor-system payment, not a measured one.

## Scale reality check

With 3 live Away Mode partners and pre-scale traffic (the same "early-stage" reality already
flagged honestly in the Babbel/TruGreen/NordVPN application drafts), actual dollar amounts owed to
any single publisher in the near term are almost certainly small regardless of which percentage is
picked. That doesn't make the decision unimportant — it makes the **measurement gap** the more
urgent problem to solve than the number itself, since a generous percentage of an unmeasurable pool
is worse for publisher trust than a modest percentage of something real and verifiable.

## Options

1. **Commit to a real % (e.g. 20%), scoped only to what's measurable today** — flight-booking
   revenue via Travelpayouts, once `price_eur` is actually persisted and joined to `partner_id`
   (small build). Be explicit with publishers that Away Mode conversions aren't trackable yet, so
   nothing is promised that can't be honored.
2. **Flat fee per verified signup instead of a revenue share** — e.g. "$X per verified alert
   signup," paid regardless of downstream conversion. Sidesteps the measurement problem entirely,
   simple to administer, but less appealing framing than "revenue share," and doesn't reward a
   publisher whose readers actually convert well.
3. **Hybrid**: flat fee per signup now (measurable, no build needed), with a stated intent to add
   a revenue-share component once tracking exists for more partners — an honest "not there yet,
   but here's the roadmap" pitch rather than either overpromising or underselling.
4. **Delay Step 88/95 outreach entirely** until either more Away Mode partners are sub-ID-capable
   through real networks (several already are — SimpliSafe, Timekettle, Rocket Languages, Airport
   Parking, Rover, all via Impact/CJ/Awin/Rakuten, unlike the personal-link partners) or the
   flight-booking revenue tracking is actually built — removes the risk of promising something
   unmeasurable, at the cost of delaying the whole publisher-acquisition channel.

## Not a recommendation, just the shape of the choice

Every option above is legitimate depending on how much Coby wants to move fast on publisher
outreach versus how much he wants the revenue-share promise to be fully backed by real, verifiable
data from day one. The one option that seems weakest on inspection is committing to a headline %
across *all* partners including the three unmeasurable ones and treating it as if it were tracked
the same way partner_id tracking already is — that's the gap most likely to cause a real, awkward
conversation with an early publisher partner down the line.
