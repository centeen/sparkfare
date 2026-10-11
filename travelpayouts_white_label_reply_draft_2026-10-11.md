# Draft reply to Travelpayouts support (Erik): Fare Search disclosure and follow-ups

Status: **DRAFT, not sent.** Drafted 2026-10-11 for the owner to review and send.

Context: reply to Travelpayouts support's answers of 2026-10-11 to the Fare Search (White Label Web) inquiry, condition C1 of
`legal_review_fare_search_g2_2026-10-10.md`. Recorded in `ROADMAP.md` steps 77 to 83 under "Travelpayouts reply to the C1
inquiry" and "Screenshot review". Erik asked what disclosure text and where (question 4); the rest are the open scorecard items.

Priority if only some get answered: 3 (attribution, the project's stop condition) and 5 (seller and payment).

| Question | Scorecard item |
|---|---|
| 1, 2 | C3, M14 (disclosure on the results page) |
| 3 | M1 (trip-level attribution) |
| 4 | M13 (full fare including taxes and fees) |
| 5 | M17 (screen after "Select ticket") |
| 6 | M13 (operating carrier per segment) |
| 7 | M16 (scarcity text) |
| 8 | branding settings |
| 9 | M15 (Terms version in force) |

---

**Subject:** Re: White Label Web for fares.sparkfare.com — disclosure text and a few follow-ups

Hi Erik,

Thank you for the detailed answers, and for the screenshot.

**Your question: what disclosure and where**

We would like to show one short line on the search results page, near the top and above the first fare:

> "Sparkfare earns a commission when you choose a fare here. Sparkfare does not sell or book travel; the purchase is completed with the airline or agency you choose."

We would also like the same line in the page footer if there is a footer field.

So we can plan the setup, could you tell us:
1. Is there a free-text or HTML field in the White Label settings for this?
2. Does it appear on the results page itself and on a shared results URL, or only on the landing page?

**Follow-up questions**

3. **Attribution:** do conversions from our White Label appear under campaign 569853 or a different campaign? Does a `marker` value with a sub-ID (for example `314524.{our trip id}`) pass through to the statistics API so we can match a booking to a click?
4. **Full fare:** is the price shown on the results page the full fare with taxes and fees included, before the user leaves the page?
5. **Seller and payment:** after "Select ticket", is the agency or merchant of record named before payment, and who handles payment and customer service?
6. **Operating carrier:** does each flight segment name the operating airline, not only the marketing carrier?
7. **Urgency text:** can the "seats remaining" message (for example "Only 2 seats remaining for this price") be turned off in settings? We would prefer not to show urgency messages.
8. **Branding settings:** can the page title ("Flight tickets") and the "Powered by Travelpayouts" link be turned off or renamed?
9. **Terms version:** the English Terms are dated November 28, 2025. If other language versions are dated differently, which version applies to us?

None of this blocks us from setting up a test page. We plan to start with a small internal test on a subdomain, and your answers will tell us whether we can continue past that.

Kind regards,
Coby
Sparkfare

---

## Notes (not part of the message)

- The disclosure line states facts about what Sparkfare does and does not do. It makes no claim about legal status, per the
  copy rule in `CLAUDE.md` (no "licensed", "exempt", "registered").
- Deliberately not mentioned: current traffic levels, the seller-of-travel analysis, the DOT ticket-agent regime. None help the
  vendor answer and they would invite a conversation they cannot resolve.
- Question 7 is a request, not an ultimatum. If it cannot be turned off, log it against G2 as already planned.
- Replies to this message go in `ROADMAP.md` (same section) and `state_DECISION_LOG.md`, with the date and who answered.
