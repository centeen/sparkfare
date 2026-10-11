# Draft reply to Travelpayouts support (Misha): Fare Search open questions

Status: **SENT by the owner** (reported 2026-10-11; exact send time and any edits to the wording not recorded here).
Waiting for Travelpayouts to reply. Rewritten 2026-10-11 from the first draft. Replaces the first draft, which
addressed Erik and asked nine questions; Misha's reply of the same day answered most of them.

Context: second reply to Travelpayouts support on the Fare Search (White Label Web) inquiry, condition C1 of
`legal_review_fare_search_g2_2026-10-10.md`. Their answers and the open scorecard items are recorded in `ROADMAP.md`
steps 77 to 83 under "Travelpayouts second reply", and in `state_DECISION_LOG.md`.

Already answered, so deliberately **not** asked again: where a disclosure can go (footer HTML editor, all pages including
results), full fare with taxes and fees, seller named before leaving, operating carrier on the ticket card, "seats
remaining" cannot be turned off, branding and the "Powered by Travelpayouts" link, and that we supply our own Terms,
Privacy and Cookie policies.

Priority if only some get answered: 1 (attribution, the project's stop condition) and 2 (merchant of record and payment).

| Question | Scorecard item |
|---|---|
| 1 | M1 (trip-level attribution) |
| 2 | M17 (merchant of record, payment, support) |
| 3 | M14 (disclosure above the first fare) |
| 4 | G2 (button wording and highlight we cannot otherwise edit) |
| 5 | M15 (Terms version in force) |

---

**Subject:** Re: White Label Web for fares.sparkfare.com — a few remaining questions

Hi Misha,

Thank you, this was very helpful. The footer disclosure and the full-fare display answer most of what we needed. A few
questions remain, the first two being the most important for us.

1. **Attribution.** You mentioned that conversions are recorded under the project selected at setup and that a SubID in
   the White Label URL reaches the Statistics API.
   - Do White Label conversions appear under campaign 569853 (the Aviasales campaign), or under a different campaign ID?
     We query the statistics API by campaign.
   - What is the exact URL parameter name for the SubID, and is it returned unchanged as `sub_id` in
     `statistics/v1/execute_query`, so we can match a booking to our own click record?

2. **Seller and payment.** On the screen where users choose a seller and press the "Buy" button, who is the merchant of
   record, and who handles payment, changes and customer service: the seller, or Travelpayouts?

3. **Disclosure position.** The footer works for us. Can the custom HTML area also place the same short line above the
   first fare on the results page, or is the footer the only supported place?

4. **Button wording and highlight.** In the seller list, the buttons read "Buy" and the cheapest seller is highlighted
   green. Can either the label or the highlight be changed in the settings or the custom HTML area? We would prefer
   "View offer" and no highlight, because Sparkfare does not sell tickets.

5. **Terms version.** The English Terms are dated 2025-11-28. If other language versions carry a later date, which one
   applies to us?

We plan a small internal test on a subdomain first, and your answers decide whether we continue past that.

Kind regards,
Coby
Sparkfare

---

## Notes (not part of the message)

- Question 1 is the project's stop condition: if a SubID cannot be matched to a booking, the experiment cannot be
  measured. Question 2 matters most for the G2 positioning.
- The disclosure line from the earlier draft, if you want to quote it back to them: "Sparkfare earns a commission when
  you choose a fare here. Sparkfare does not sell or book travel; the purchase is completed with the airline or agency
  you choose." It states facts about what Sparkfare does, with no claim about legal status, per the copy rule in
  `CLAUDE.md`.
- Deliberately not mentioned: current traffic levels, the seller-of-travel analysis, the DOT ticket-agent regime. None
  help the vendor answer and they would invite a conversation they cannot resolve.
- Questions 3 and 4 are requests, not ultimatums. If they cannot be changed, log them against G2 as already planned.
- Replies go in `ROADMAP.md` (same section) and `state_DECISION_LOG.md`, with the date and who answered.
