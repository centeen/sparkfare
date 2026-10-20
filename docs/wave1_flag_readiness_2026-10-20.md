# Away Mode Wave 1: flag readiness (2026-10-20, read-only)

Everything in Wave 1 is built and merged dark. Nothing here has been seen on production: every flag is `"false"`, so the routes
return 404 and the pages are unreachable. All evidence below is tests and local checks, not production. Release rule from the plan
(`claude/away_mode_plan_v1_2026-10-16.md`): **flips from Mon Nov 9 at the earliest, after copy review, each flip its own PR.** No
merge that changes live behaviour between Thu Nov 5 18:00 ET and Nov 8.

A flip is a one-line change in `wrangler.jsonc` (`"false"` to `"true"`); a rollback is the reverse. Only the exact string `"true"` turns
a flag on. Cloudflare deploys a merge to `main` in 1 to 2 minutes.

## The flags

| Flag | Default | What it turns on | Needs |
|---|---|---|---|
| `ENABLE_LEAVE_BY_PLAN` | false | `/plan`, `POST /api/leave-by-plan`, the `.ics` route, `GET /api/leave-by-plan/status`, the nav link, the home and `/away-mode` blocks, the plan events | nothing; **the parent of the three below** |
| `ENABLE_PASSPORT_CHECK` | false | `/passport` and the expiry fields on `/plan` | `ENABLE_LEAVE_BY_PLAN` for the plan fields |
| `ENABLE_PLAN_REMINDERS` | false | opt-in, confirmation email, due-date emails, "You're set" email, stop link, retention delete | `ENABLE_LEAVE_BY_PLAN`; Worker secret `UNSUBSCRIBE_SECRET` (set in production) |
| `ENABLE_HOME_CARD` | false | `/home-card`, `/card/<token>`, the link from the reminder confirmation page | `ENABLE_LEAVE_BY_PLAN` |
| `ENABLE_RULE_WATCHER` | false | weekly page-change check, held rules, `/admin/rules` | rides the Monday `0 9 * * 2` cron; admin secret to use the page |
| `ENABLE_LONG_LEAVE` | false | `30_plus` trip length and the three-item lead (not Wave 1; waits for the G1 copy review, D-006) | Hub review of `g1_lead_copy_2026-10-14.md` |

## Per item

| Item | Built in | Tests (pass) | Seen on production | Open before a flip |
|---|---|---|---|---|
| G2 rule watcher (ROADMAP 88) | `010a4d9c`, blocked-page fix `5b07ddba` | `rule_watcher` 23 | no | Watcher cannot read travel.state.gov or the Brazil portal (bot check), so those rules are "cannot check automatically", not watched. Their "checked on" date is the only protection until someone reads them by hand. Needs the admin secret to confirm and keep held rules. |
| G3 plan page and entry points (89) | `6c253254` | `leave_by_plan` 13, `leave_by_plan_page` 21 | no | Copy review of every user-facing string (`docs/away_mode_v1_design.md` section 6). The nav link and entry block appear only on the pages that load `plan-entry.js` (the homepage and `/away-mode`) and on Worker-rendered pages; the other ~970 static pages do not get the link (deliberate: it would add a status request to every page view). |
| G4 late-plan mode (90) | `f036413c` | `leave_by_plan_late` 12 | no | Open question 11: late mode uses 7 days; the State Department's urgent window is 14. |
| G5 passport check (91) | `fac39ee4` | `passport_check` 24 | no | 34 country rules read 2026-10-16 from the official pages; Egypt is held (the page does not say what the 6 months count from). Re-read on any watcher hold. |
| G6 events and privacy (92) | `351c4d60` | `plan_events` 13 | no | Query in `docs/away_plan_metrics.sql` is untested on production data. |
| G7 reminders (93) | `a28ede67` | `plan_reminders` 20 | no | Double opt-in, retention delete and the 6-email cap tested on SQLite with Resend stubbed; **no real email has been sent**. A real send to a `+alias` is the check before the flip. |
| G8 "You're set" (94) | `86585c26` | `plan_youre_set` 18 | no | Rides the existing `30 3 * * *` run (19:30 to 23:30 local for US origins); same real-send check. |
| G9 Home card (95) | `e9cb0fb0`, plan link `2c16236c` | `home_card` 15, `home_card_plan_link` 6 | no | `/card/` is Disallowed in `robots.txt` and noindex; first real card should be created and opened by hand. |
| K-C2 "You're set" panel and keeper register (136) | `b6d89680` | `k_c2_peak2_dark` 5 | no | Rides the same three flags; the panel on `/plan` and the quiet email headline have not been seen working. |

## Suggested flip order (each its own PR, after copy review)

1. `ENABLE_LEAVE_BY_PLAN` with the page and the entry points. Smallest surface, no email, no storage; the plan is computed in the visitor's own browser.
2. `ENABLE_PASSPORT_CHECK`. Adds `/passport` and the expiry fields; still no storage.
3. `ENABLE_PLAN_REMINDERS`. First feature that stores an address and sends mail: do a real opt-in, confirmation and one reminder to a `+alias` first, and check the sending guard is not tripped.
4. `ENABLE_HOME_CARD`. Stores tasks and notes behind a private link; create and open one card by hand first.
5. `ENABLE_RULE_WATCHER` any time before step 3; it only sends the owner a summary. Leaving it until a rule is actually wrong would be the risky choice.

`ENABLE_LONG_LEAVE` is separate and waits for the Hub's review of the lead copy.

## Things that are true today and worth deciding

- **The privacy page already describes the plan, the passport check, reminders and the Home card** (it was merged with the features) while all four are unreachable. It reads as a description of data handling for things visitors cannot use yet. Decide whether to leave it (accurate for when they are on) or hold it back until the first flip.
- **Migration `0028_rule_watcher.sql` is recorded but not applied** to production; the Worker creates its tables on first use, so applying it is bookkeeping only. `0027_trip_length_chosen.sql` is also unapplied and no code reads it; `npm run deploy` would apply both.
- **Stale rows in `ROADMAP.md`:** steps 88 to 95 still say "Built, flag off, PR open". All are merged.

## Owner questions still open (from `docs/away_mode_v1_design.md` section 8)

3. Bali levy amount: there is no official page showing it today, so the rule has no amount (PR #259's "IDR 150,000" should not return).
4. Australia ETA and Brazil eVisa for US passports: confirm in a browser. Australia reads "if your passport is eligible"; Brazil is active with the official link and no date or fee.
8. Cron: the watcher and retention delete are on the Monday trigger (assumed). Workers Paid raised the account cron limit; the new number has not been checked. One slot was freed on 2026-10-20 when the 07:00 early digest was removed.
10. Migration `0027`: apply, delete or leave.
13. "Car parked at the airport": a disclosed Parking Access item, or a plain line with no partner (the plan makes it one of four questions; no rule is written).
14. "Phone and data": which partner leads, Yesim (eSIM) or NordVPN.
15. Home card metric (`src=homecard` signups) versus "no signup prompt until the card expires": which governs.
16. ETIAS wording: the rule text avoids any claim about 2026, since the EU's own page gives no date.

Questions 1, 2, 5, 6, 7, 9, 11 and 12 were answered or defaulted and are recorded in the design doc.
