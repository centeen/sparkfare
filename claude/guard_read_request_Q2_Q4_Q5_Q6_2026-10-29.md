# Guard read request: Addendum Q email copy (Q2, Q4, Q5, Q6)

For the Hub, 2026-10-29. Drafted by Claude Code for the owner to send. **Deadline: answers by Mon Nov 2 so the owner can merge PR #418 by Wed Nov 4 (last feature merge).** No flag flips before Mon Nov 9.

## What is being asked

A Guard read of four sets of email copy. Two are already on `main` (Q2, Q4) and one set is on PR #418 (Q5, Q6). The Hub's read was a stated condition of Q2 and Q4 and was not recorded anywhere I could find, so please say if you already did it.

| Package | State | Takes effect | Detail |
|---|---|---|---|
| Q2 weekly edition | Merged (#414) | Sunday, for readers who chose "weekly" | Section 1 |
| Q4 subjects | Merged (#413) | Already live | Section 2 |
| Q6 sunset email and pause rule | PR #418, no flag | On merge | `claude/guard_read_package_Q6_sunset_2026-10-28.md` (on #418's branch) |
| Q5 welcome and verification | PR #418, dark (`ENABLE_WELCOME_EMAIL` `"false"`) | Not before Nov 9 | `claude/guard_read_package_Q5_welcome_2026-10-28.md` (on #418's branch) |

The Q5 and Q6 packages are complete and already contain their own questions; sections 3 and 4 summarise them. Nothing here has been seen in a real inbox.

## 1. Q2: the weekly edition email

Samples (real send path, Resend stubbed, sample fares): `docs/handoff/q2_weekly_email_samples_2026-10-27.md` and `docs/handoff/q2_samples/weekly_JFK.html`, `weekly_LAX.html`.

- Subject: "This week from New York: Lisbon $380 + 2 more".
- Commission line first, then "The 3 lowest fares we tracked from New York this week, each shown with the time we retrieved the data. Fares move, so check the current price before you plan."
- Each fare: price, basis ("37% below its 30-day median (N=20)" only for a verified deal), dates, airline, "Fare data retrieved {time and zone}. The fare itself may be older, and fares change fast.", links to the route page (no Aviasales link) and "Watch this route".
- One "Complete the trip" partner block, one "Fare tip" block, footer with preferences, unsubscribe, postal address and the deal-information statement.
- Weekly readers get one email on Sunday, none on Monday. A Sunday with fewer than 3 stored dailies sends nothing and logs `weekly_edition_missing`.

**Please check:**
1. The disclosure sentence sits above the fares. Is the wording enough for a weekly that links only to our own route pages?
2. "Each shown with the time we retrieved the data" and "Usually ~$600" on a deal row: is "Usually" supported by the basis line that follows it?
3. Both blocks (partner and fare tip) in one weekly: acceptable under the one-partner rule?
4. **A sample artifact to rule out:** in the JFK sample the Prague and Tokyo rows show "(JFK → LIS)" and link to `/flight/JFK/LIS`. I believe this is the sample fixture reusing one deal's route code, not the sender, but I have not proven it. The Hub should not treat the samples as a pass on link correctness. A real-data render for JFK and LAX is the better check, and I can produce one.

## 2. Q4: subjects that changed (live now)

All three removed travel dates or relative timing from the subject. The date stays in the body.

| Email | Before | Now |
|---|---|---|
| Pre-departure, 7 days | "One week out — {Destination}" | "{Destination}: three cues to set now" |
| Departing soon | "Departing {timing} — {Destination}" | "Your {Destination} checklist" |
| Long-weekend watch | "Fare for your {dates} long weekend from {City}: ${price}" | "A long-weekend fare from {City}: ${price}" |
| Pre-departure follow-up (`followUpSubject`) | contained the departure date | no date |

**Please check:** "three cues to set now" and "Your {Destination} checklist" for urgency or lock-screen implication, and whether "{Destination}" alone in a subject discloses travel plans on a lock screen (the Q4 aim was to avoid that).

## 3. Q5: welcome email W1 and the new verification email (dark)

Full package: `claude/guard_read_package_Q5_welcome_2026-10-28.md`; copy file `content/emails/welcome.json`; samples `docs/handoff/q5_samples/`. Five questions are in section 5 of the package: the no-fare preheader (recommendation: use the variant), "each morning" before the local-morning send ships (the digest goes out at 08:00 UTC, 04:00 on the east coast), the transactional classification, whether the card may show a typical fare, and "start" in the verification subject.

## 4. Q6: sunset email and pause rule (live on merge)

Full package: `claude/guard_read_package_Q6_sunset_2026-10-28.md`. Three questions in its section 4. The point that matters most: the new sunset line says "We haven't seen a click from you in 90 days", but **click tracking is off in Resend, so no click can be recorded today**; until the owner turns it on, the sentence is true of everyone and only the open test decides. Options: keep the hedge, say only "no opened emails in 45 days" until tracking is on, or turn tracking on first (owner decision, rewrites links through the tracking domain).

## What the owner does with the answers

- A change to copy lands as an edit to `content/emails/welcome.json` (Q5), the sunset string in `src/email.js` (Q6), or a small PR (Q2, Q4).
- Q5 and Q6 changes go onto #418 before it is merged; the Q2 and Q4 changes need their own PR.
- Reply format that helps: a pass, a conditional pass with the wording to change, or a fail, per numbered question.
