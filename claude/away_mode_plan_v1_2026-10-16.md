# Away Mode Plan v1 (formal plan, adopted Oct 16, 2026, D-016; strategic direction for Away Mode, D-017)

Owner: Coby (legal name Jason). Source: Sparkfare Design Council consult 8 and its follow-up. Reports: "Away Mode v2: pressure test and world-class plan" (https://claude.ai/code/artifact/97a2da5f-a367-4af1-b867-930bf5d74d91) and "Away Mode: scorecard, insights and possibility map" (https://claude.ai/code/artifact/86c1b92c-fae6-4ff5-a6e8-2d1eadb911ea). Claude Code instructions: `claude/handoff_CLAUDE_CODE_ADDENDUM_G_2026-10-16.md`.

This plan is the single source of truth for Away Mode and the project's strategic direction for it (recorded in `context_SPARKFARE_BUSINESS_MODEL.md` section 10). Where it differs from Addendum E or the Oct 16 consult 7 report, this plan wins. New Away Mode ideas are checked against it; a conflict needs a consult and an owner decision to amend it.

---

## 1. What Away Mode is

**One plan for leaving home on an international trip, for you and the person who stays, from the first deadline to the welcome home.**

- Free. No app. No account needed to make a plan.
- Every rule links its official source and shows the date it was checked.
- Nothing counts down, nothing claims scarcity, nothing promises to protect your home.

**Proposition (working):** "Away Mode is the leave-by plan for you and the person who stays."
**Headline:** to be chosen in the copy review (candidates: "Leave home like it's handled."; "Everything due before you go, and a card for whoever stays."; "Close every loop before you go.").

## 2. Why (the evidence in five lines)

1. The worry is about home and pets, not flights: 70% say home worry is the hardest part of a vacation; home security and pet care at 49% each (Ring/Censuswide, May 2025, vendor survey).
2. A specific, dated plan removes the intrusive thoughts that unfinished tasks cause (Masicampo and Baumeister 2011).
3. Most travelers rely on another person: 58% ask someone to check in (Ring); 65% have someone visit (Talker for Schlage, vendor survey).
4. The firm deadlines are few and real: passport validity, mail holds past 30 days, the 90/180 rule for long Schengen stays, some arrival forms. ETIAS is not a 2026 deadline (EU removed its Q4 2026 target in July 2026; Navan, Oct 2, 2026).
5. No rival covers both people: TripIt covers the trip; Touch Stay ($49 a year) covers the sitter; device brands sell cameras.

## 3. Who it serves (depth by trip length)

| Trip length (signup bucket) | Depth | What they see first |
|---|---|---|
| weekend, 4-6, 7-10 days | **Short:** passport check plus at most 3 items | Passport check |
| 11-14 days, 2+ weeks | **Standard:** about 10 items | Passport check, mail hold, phone and data, home items |
| 30+ days (`30_plus`) | **Long:** full plan | Mail beyond 30 days (forwarding), home items, 90/180 flag (Wave 2) |
| The person who stays | **Home card only** | Day-by-day tasks, what-if card |

Personas: Elena, Tess, Ray & Linda (long); Marcos (family, three passports); Priya and Dana (short, passport check); Gloria (Home card).

## 4. The parts (component list)

IDs match `state_COUNCIL_BACKLOG.md`.

### Foundation (before any rule is shown)
| ID | Part | What it does |
|---|---|---|
| G38 | **Rule watcher** | A weekly job fetches every official page a rule depends on. If a page changes or can't be fetched, that rule is **held** (it shows only "check the official page" plus the link) and the owner gets one email. The owner reviews and confirms in a protected admin page. This is the only recurring owner work Away Mode adds, and it happens only when a page changes. |

### Wave 1 (build dark, flip from Nov 9 at the earliest, after copy review)
| ID | Part | What it does |
|---|---|---|
| G32 | **Open front door** | "Leaving the country? Make your leave-by plan" from the navigation, the home page (outside deal cards), the end of route pages, and `/away-mode`. Works for a trip bought anywhere. Never inside a deal card. |
| G23 + G47 | **Leave-by plan with trip-type depth** | Inputs: destination (one of 40), leaving date, back date, four yes/no questions (a pet stays home; someone checks in; driving abroad; car parked at the airport), optional passport expiry month and year. Output: dated items, each with an act-by date, a one-line why, the official source and checked date, and at most one disclosed partner where a partner does the job. |
| G34 | **Passport validity check** | In every plan, and as a standalone page. Compares the expiry month with the return date and the destination's rule from the State Department country page. Result: "Fine for this trip", "Renew before you go" (with the act-by date from the official processing time), or "Check the official page". |
| G46 | **Late-plan mode** | If departure is 7 days away or less, show only what can still be done, and for anything past its window, the official fastest route (link only, no claims about availability). |
| G36 | **Reminders on each item's due date (email)** | One opt-in ("Email me each item when it's due"), confirmed by email. Each item is sent on its act-by date; items due within 3 days of each other are combined. One-click unsubscribe. |
| G44 | **"You're set" email** | The evening before departure: what is done, what is left, what the Home card asks of the keeper. Opt-in with G36. |
| G33 + G50 | **Home card with what-if card** | A private page and printable card for the person who stays: day-by-day tasks (pet feeding, plants, mail, trash day) and the traveler's own what-if notes (where the water shutoff is, vet name, who to call). No account for the keeper. No codes, no alarm or Wi-Fi details, no address. Private link, not indexed, expires 7 days after the return date, can be removed by the traveler. |
| G25 | **Long-stay mail rule** | Already part of G1 (Long Leave): Hold Mail runs 3 to 30 days; longer absences need forwarding (US Global Mail, disclosed). Ships with the G1 walkthrough, not with Wave 1. |

### Wave 2 (Dec 12 to Feb 12, after the Dec 11 gate)
| ID | Part |
|---|---|
| G49 | **Keeper check-in tap:** the keeper taps "All fine today" or "Something needs you"; the traveler gets a quiet daily or weekly digest (both opt in). |
| G53 | **Welcome-home list** on the return day (resume mail, fridge, thank the keeper), ending with the delayed-flight check (AirHelp). Replaces G4. |
| G54 | **Same as last time:** one tap reuses the Home card and home items for the next trip. |
| G45 | **Door walk:** a 10-minute leave-day list; an optional photo kept only on the traveler's own phone. |
| G37 | **Pet-at-home branch:** feeding schedule into the Home card; Petcube camera line only after the owner approves the flip (D-013). |
| G35 | **90/180 flag:** a Schengen stay of 60+ days, or a second Schengen trip, shows the rule, the EES note and the EU calculator link. Sparkfare does not count days. |
| G36b | **Private calendar feed** (subscribe once; updates when the plan changes). |
| G52 | **Quiet mode:** no emails during the trip except the digest the traveler chose. |
| G55, G56 | **Keeper's own plan** (offered only after the trip ends) and a **free printable Home card** search page. |
| G39 | **Status pages:** "Is ETIAS required yet? Not yet, as of <date>" and "EES: what to expect". Official links only. |

### After Feb 12 (needs F0 data)
G51 private-by-design Home card link; G48 household plan (up to 4 travelers); G24 entry card per destination; G29 official-change alerts.

### Refused (FAIL; never build)
Countdown timers, streaks, "X people leaving"; public "I'm away" status or door hangers; paid eVisa or passport-expediting referrals (G30, G42); AI answers to entry-rule questions (G41); a sitter or service marketplace (G43); insurance links or comparisons (Step 19); live home monitoring or smart-home control; marketing to keepers without their consent.

## 5. Rules every part follows

1. **Sources:** every rule has an official URL, a source URL and a checked date. No rule is written from memory. Unverified destinations show one line linking the State Department country page.
2. **US passports:** passport rules assume a US passport and say so. TLV-origin users see the general link, not a passport verdict.
3. **ETIAS:** shown only as "Not required yet" until the EU's own site states a start date and the watcher confirms it.
4. **Privacy:** travel dates never appear in URLs, share cards, logs, analytics events or partner sub-IDs. No passport or ID numbers, ever (expiry month and year only). Guest plans store nothing unless the guest opts in to reminders. Plan data is deleted 30 days after the return date.
5. **Partners:** at most one disclosed partner per item, only where it does the job, through `/out` with a source tag and the trip-length bucket. Never on deal cards. Never on the Home card.
6. **Copy:** no "book", "secured", "protect", "safe", "vetted", "guarantee", "hurry", "last chance", "don't miss". Every risk named comes with the step that handles it. Insurance is education only ("ask your insurer").
7. **Tone by moment:** planning "Here's everything, in order."; two weeks out "One thing this week."; leave day "Ten minutes at the door."; away, silence; return "Welcome home; three things, then you're done."; a missed item "Here's the fastest official route now."
8. **Passive operations:** no support desk, no comments, no manual upkeep beyond watcher-triggered reviews.

**Working names** (copy review may change them): Away Mode; leave-by plan; Home card (the keeper page); door walk; "You're set".

## 6. Release plan and gates

| When | What | Gate to pass |
|---|---|---|
| Oct 16 to Nov 6 | Claude Code: owed items (Addenda C, D), E1 report, then the **Addendum G design doc** (replaces E2). G25 goes into the G1 walkthrough. Nothing user-visible. | Owner approves the design doc after the council reviews all drafted copy |
| Nov 6 18:00 ET to Nov 8 | Launch freeze; no merges. Launch posts describe only what is live. | — |
| From Nov 9 | Dark build of G38, then Wave 1, one PR at a time. Flag flips are separate PRs. | G38 running; council copy review; owner approves each flip |
| Dec 11 | D-004 / D-014 gate (below) | Minimum 30 plan completions per bucket, else "no decision, extend" |
| Dec 12 to Feb 12 | Wave 2, one PR at a time | Same as Wave 1; red-team the Home card and keeper tap with Gloria and Ray first |
| Feb 12 | Re-score with F0 data; decide on the post-Feb items | Owner decision |

If Claude Code capacity is tight, cut G46 and G50 from Wave 1 first; never cut G34, G33 or G36.

## 7. How success is measured

| Signal | Metric | Kill or review line |
|---|---|---|
| Money (primary, D-014) | Partner clicks per 100 plan completions vs today's `/away-mode` clicks per 100 views, by bucket | At or below today's rate after the minimum sample, or one wrong rule in production |
| Use | Plan completions per 1,000 visits from the new entry points | Fewer starts than `/leave` gets today from the same pages |
| Need | Reminder opt-in rate; reminders opened on their due date | Unsubscribes above opens |
| Spread | Signups from Home card links (`src=homecard`) | Under 1 per 100 card opens after 200 opens |
| Return ("can't live without it") | A second plan by the same email within 12 months | Reviewed at Feb 12 |
| Safety | Any rule shown after its source changed and before owner confirmation | Zero tolerance: fix and review G38 |

## 8. Decisions this plan records, and what stays open

**Decided (D-016):** this plan, its parts, waves, rules and gates; G38 with event-driven owner review; working names; Addendum G replaces Addendum E's E2 and E3.
**Decided (D-017):** this plan is the project's strategic direction for Away Mode; new Away Mode ideas are checked against it and amendments need a consult and an owner decision.

**Still open:** the headline and final names (copy review); which scoring rubric governs future ranking (Spark Score or the 11-criterion scorecard); every flag flip (owner approval each time).
