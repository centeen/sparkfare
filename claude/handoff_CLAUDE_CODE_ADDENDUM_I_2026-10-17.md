# Addendum I to Claude Code: walkthrough findings (Oct 17, 2026)

Source: `claude/site_walkthrough_7_personas_2026-10-17.md` (read it first). The owner asked on Oct 17 for these findings to go to Claude Code. This addendum does not approve any change on its own: it asks for **verification and a report first**, then one PR at a time with owner approval per PR. No merges Nov 6 18:00 ET to Nov 8. Copy-only where the item says copy-only. The Travelpayouts rule stands: no custom code on their tools (clause 2.3.5), and D-007 still parks Fare Search; only D-018's copy-only scope applies to Aviasales wording.

## Step 0: verify before touching anything (read-only, one report)
Write `docs/walkthrough_verification_2026-10-17.md`. For each line, give the file or flag, the live behavior, and whether the repo and live site agree.

1. **Petcube (item 63).** Is the Petcube card on `/away-mode` and the `/disclosure` entry live? Which flag or data row shows it? Who or what turned it on (commit, PR, date)? D-013 says staged dark until the owner approves a flip; Addendum D dropped the `/away-mode` card. **Do not click `/out/petcube` on production.** Read the `/out` handler and the `partners` row instead, and report the destination URL it would send to and the sub-ID format. **Do not change the live state yet**; report and wait for the owner (see G62 below).
2. **LIVE-CHECKED PRICE (item 67).** Where is the tag set? What rule decides it? Why does ATL to Bogota show the tag on the board while its route page says the price is "carried forward"? Why do some cards carry as-of dates from Oct 8 to Oct 11 with the tag?
3. **Blurb generator (item 64).** Where are card blurbs created or stored? Which blurbs contain urgency wording or unsourced figures ("70% less", "drop 40%", "$200+ cheaper", "Move fast, premium positioning rarely lasts")? List every instance with file and text. Does the copy checker cover blurbs?
4. **Wording (item 65).** Every occurrence of "Book" and "Secure" in Sparkfare's own copy on `/away-mode` (the Parking Access card and the meta description are known). Partner-owned names may stay; flag them separately.
5. **Trip length (item 66).** Which values does the signup accept? Is `30_plus` accepted by the form, the API and the alert logic? What does `/leave` store for "A month or more"? Does the long-stay result read the answer, and where is the mail line built?
6. **Route pages (item 68).** Which two templates exist, what decides which one renders, and why do the full-template pages omit a fare link?
7. **Time-off share link (item 69).** What does "Share this plan" copy, and what state does `/time-off/sea` read from the URL or storage? Where does the "email when fares appear" signup post?
8. **Failed request (item 70).** Which resource returns 404 on `/check`?
9. **Flags vs ledger.** Report the current values of every flag in `wrangler.jsonc` next to `state_CAPABILITY_LEDGER.md` so the ledger can be refreshed (its 14-day limit hits Oct 27).

**Stop after Step 0 and wait for the owner.**

## Step 1: proposed changes (one PR each, only after the owner approves that PR)
Each is PROPOSED, not decided. Persona and meter in brackets.

- **G57 Copy clean-up (copy only).** Remove urgency wording and unsourced numeric claims from blurbs; add a blurb-generator rule and a copy-checker rule for both; replace "Book" and "Secure" in Sparkfare's own `/away-mode` copy. Same files as Addendum H Task C may be touched: do these in the same report so there are no conflicting PRs. [All; trust]
- **G58 Long stays.** Add "A month or more" to the signup and alerts (default stays as is); in the long-stay `/leave` result add the USPS Hold Mail 30-day limit (verify on usps.com first and give the URL and as-of date) and one line "Ask your insurer about an empty home" with no insurance link. Education only; insurance referrals stay closed while Roadmap Step 19 is open. [Elena, Tess, Ray & Linda; Leave]
- **G59 Route pages.** On full-template pages add the same fare link and disclosure the board uses; one signup call to action; remove "notified instantly" (alerts are daily). Copy and link only: no custom code on Travelpayouts tools. [Dana, Marcos; Fare]
- **G60 Time-off.** Make "Share this plan" carry the plan choices (PTO days and selected holidays only, **no travel dates, no email, no address**); remove "Before you go: get your home ready" from 3-day windows; make the "email when fares appear" heading match what the form does, or change the heading. [Priya, Gloria; Audience]
- **G61 LIVE-CHECKED.** Show the tag only when the price is from the current check; put a time zone on every as-of time. [Dana, Marcos; accuracy]
- **G62 Petcube.** Depends on the owner's answer to Step 0 item 1. If no flip was approved, the proposal is to hide the `/away-mode` card and the `/disclosure` entry until the D-013 conditions are met; if a flip was approved, log it and check D-013 conditions C1, C2 and D6.

## Rules for every PR
Copy checker must pass; no new trackers; no travel dates in URLs or sub-IDs; international only; referral wording only ("go to", "view"); seller identified honestly; one PR per item; PR description lists files and the persona step it fixes; end commits with the attribution lines Claude Code uses.

## Reply format
After Step 0, reply with: the verification file path; a table of items 63 to 70 (confirmed, changed, or not reproducible); and the proposed PR order with an estimate of files touched. Then stop.
