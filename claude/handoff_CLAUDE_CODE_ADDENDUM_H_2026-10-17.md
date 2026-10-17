# Claude Code Addendum H · 2026-10-17

Two small items from owner decisions D-018 and D-019 (`state_DECISION_LOG.md`, Oct 17). Both are low risk. Neither changes any flag, route or partner row. Non-attorney guidance throughout; have a licensed attorney review before anything binding.

Order: finish the owed items in Addenda C to G first. Start section 1 from Oct 19, not before. Section 2 may run any time.

---

## 1. Task C, copy-only part (D-018)

**Goal.** Reduce how often live copy names Aviasales, because the Travelpayouts Affiliate Agreement (clauses 2.4.1 to 2.4.3, logged as R-003) treats use of Aviasales marks without permission as a violation and has no carve-out for factual references. Fare Search stays parked (D-007).

**Scope.** Only the copy-only part of Task C in `claude_code_white_label_fare_search_2026-10-10.md`. If Task C as written also contains anything that is not copy (flags, tables, routes, White Label setup, routing changes, admin pages), leave that out and say so in the report.

**Steps.**
1. **Report first, no PR.** List every user-visible mention of Aviasales (HTML, JS strings, email templates, blog generator templates, footer and grid lines, disclosure and privacy pages). For each: file and line, current text, proposed text, and whether the mention is needed for honesty at that spot. Stop and wait for the owner.
2. **Then one PR at a time**, each approved by the owner before it merges.

**Rules.**
- Copy only. No custom code that alters any Travelpayouts tool (clause 2.3.5). No flag changes. No routing changes.
- Fewer mentions must not make the page less honest. Where a user leaves Sparkfare for a third-party booking site, the copy must still say that it is a third-party site and that Sparkfare earns a commission. Keep one clear, factual identification of the seller in the disclosure and the handoff step; do not hide it. Flag any spot where you are unsure.
- Referral-copy rules apply: no "book", "secured" or the other banned phrases. Run the copy checker; it must pass.
- No price predictions, no "you saved $X", no urgency the data cannot support.
- Homepage fare buttons already read "View fare"; keep that pattern.
- No merges Nov 6 18:00 ET to Nov 8.
- Update `disclosure.html` only if the owner approves the proposed text in the report.

**Done when.** Report delivered; each PR approved and merged outside the freeze; a short list of remaining mentions that were kept on purpose, with the reason.

---

## 2. Read-only statistics call for `campaign_id=100` (D-019)

**Goal.** Confirm against a real Travelpayouts statistics response that the repo's `AVIASALES_CAMPAIGN_ID = 100` and the `sub_id` handling (marker `314524`, leading-period normalization) match what the API returns. This closes the open "unconfirmed against a real response" note in R-002.

**What to do.**
1. Make one read-only call to the Travelpayouts statistics API for `campaign_id=100`, date range Oct 1 to the call date. A second call only if the response is paginated.
2. Use the credential the Worker already uses. Never print, log, echo or commit the token or any header carrying it. Do not paste it into a report.
3. Do not generate clicks, searches or purchases, and do not call any endpoint that logs a click.
4. No traveler data in the request.

**Report back (in chat, then as `docs/evidence_travelpayouts_stats_campaign100_2026-10-17.md`):**
- HTTP status and the endpoint path used (no token);
- the raw field names returned;
- whether `sub_id` comes back with a leading period, and whether marker `314524` appears;
- row counts, totals and the date range used;
- anything that differs from what the repo code expects.

If the call fails or returns an auth error, report the error text without the token and stop. Do not retry in a loop.

**Not a gate input.** The result is evidence only. It does not change D-007 and does not count toward the Dec 11 gate.
