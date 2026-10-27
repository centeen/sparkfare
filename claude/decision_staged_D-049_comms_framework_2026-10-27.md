# Staged decision log entry: D-049 (append to `state_DECISION_LOG.md` at the next log rewrite)

---

## 2026-10-27 · D-049 · Approve Communications Framework v1 ("One honest envelope")

**Source:** owner message Oct 27 14:29 (Asia/Jerusalem): "approve the framework", sent while viewing the Claude Doc "Sparkfare Communications Framework v1 (for approval)", https://claude.ai/artifact/BgioYGgsJtz976iQHxu9S9.
**Question (neutral):** Which changes to Sparkfare's email and channel system would raise sustained engagement (clicks per 100 delivered, 90-day active share) and affiliate clicks per 100 subscribers, inside the referral-only, no-urgency and passive-operations rules? Personas: all seven.
**Consult steps:** consult 18 ran the full loop: Frame (owner's wording shown beside it); Ground (repo `main` 8657dea read directly; live digest JFK Oct 27; ledger 14 days old, repo used); Convene (7 personas on the Live digest and Live (repo) lifecycle emails only); Price (incremental $0 / ~$4 / ~$49 per 100 confirmed signups over 90 days, arithmetic on consult 13's range, not a forecast); Guard (CONDITIONAL, 9 conditions; FAIL for SMS without a consent program, emails from anonymous browsing, any urgency device; non-attorney guidance); Score (program 4x3x3 = 36; G110 60, G111 48, G112 48, G113 32, G114 32, G115 30, G116 27, G117 24; weights equal, no F0 data yet); Audit (STATUS: PASSED after one fix loop).
**Decision:** ADOPTED. Communications Framework v1 is the standing framework for every Sparkfare email and channel.
- **Seven rules:** one envelope a day (max 1 scheduled, 2 in total per local day); the reader sets the pace; the reader's acts trigger mail; local morning, quiet nights; the point first; one partner, the right one; measured by clicks and money.
- **Five streams, in priority order:** transactional; alerts the reader set; plan and trip; digest; care.
- **Plan:** C0 (Addendum Q: Q0 report, Q1 send budget, Q2 one weekly product, Q3 honest frequency choices, Q4 compliance, Q5 welcome email W1, Q6 clicks not opens, Q7 local-morning send, Q8 stream tags) merged by Wed Nov 4, with Q1 to Q4 never cut and Q7, Q8 movable to Nov 9 to 12; C1 flips from Nov 9; C2 Dec 12 to Feb 12; C3 after Feb 12.

### Sub-decisions (the four open questions, taken as recommended in the report; the owner may override any)
| ID | Decision | Status |
|---|---|---|
| D-049a | Approve C0 for Addendum Q | Adopted. Hub writes Addendum Q |
| D-049b | Retire the Sunday newsletter workflow; email the weekly edition on Sundays to `weekly` readers (who stop getting the Monday digest) | Adopted (recommended default) |
| D-049c | Default local send hour 06:30 per origin; a 06:30 vs 19:30 test in C1 decides on clicks per 100 delivered, minimum 1,000 delivered per arm | Adopted (recommended default) |
| D-049d | Trip emails start only after the "Got your ticket?" tap (`ENABLE_TRIP_SELF_REPORT` flipped from Nov 9); unconfirmed clicks get the checklist email only | Adopted (recommended default), C1 |

**Guard conditions carried (non-attorney guidance; verify with counsel):** postal address in every commercial email; the one-a-day promise true at launch or the homepage line changed; "Instant (Rare Finds only)" removed or repaired; no departure dates in subjects or preheaders; disclosure at the top of every email with a fare or partner link and beside each partner block; W1 with no partner links or savings claims; trip-stream copy never implies Sparkfare sold the trip; push and WhatsApp opt-in only; insurance tips education-only, curiosity subjects only under D-009.
**Still gated:** W1 copy needs a `PROPOSED` mock, a council reaction and a Guard read before merge; every copy PR gets the Hub's Guard read; every C1 flag flip is a separate owner approval.
**Owner checks:** Resend webhook events (bounced, complained, clicked, delivered); `EMAIL_POSTAL_ADDRESS` set in production.
**Backlog:** G110 to G117 move from staged to approved (`claude/backlog_staged_G110-G117_comms_framework_2026-10-27.md`).
**Numbering note:** the Oct 20 owner decisions (early digest retired; free watchlist cap) proposed as D-049 in the session state now take D-050 when logged.
