# Flip order for the dark packages (draft, 2026-11-05)

Everything in #418 (Q5 to Q8, N12 to N14, C1.1 to C1.5) is already on `main` with its flags off, so nothing is left to merge: this is a **flip** order. It follows `flip_order_checklist_2026-10-28.md`, corrected against `wrangler.jsonc` and the 2026-10-30 and 2026-11-01 notes in `BUILD_STATE.md`. Draft, for the owner's approval. Nothing here was run against production.

## Rules for every flip

- One flag per PR, changing one value in `wrangler.jsonc`. The owner approves each PR.
- No flips before Mon Nov 9. No merges Nov 6 18:00 ET to Nov 8.
- Wait the soak period and run the check before the next flip.
- A merge deploys in about a minute. Roll back by setting the value to `"false"` and merging.
- Only the exact string `"true"` turns a flag on.

## Before any flip (owner, no code)

- Confirm nothing is pending: `wrangler d1 migrations list --remote`.
- Subscribe the Resend webhook to `email.delivered` and `email.clicked` as well as opened, bounced and complained. A 401 in its delivery log means the signing secret changed.
- Resend click tracking is still off. Turning it on rewrites links through Resend, so check that Aviasales `marker=` and `/out/` links still land correctly.

## Order

| # | Flag | Needs first | Hub Guard read | Check after | Soak |
|---|---|---|---|---|---|
| 1 | `ENABLE_SIGNED_PREFS` | `UNSUBSCRIBE_SECRET` (set) | C1.1, no trace of a read | Digest footer has "Change how often, or pause". `/prefs` GET changes nothing; POST changes one setting. | 1 day |
| 2 | `ENABLE_SIGNUP_FREQUENCY` | none | C1.1 | Form shows both options. A new signup stores `frequency`; a resubmit never changes an existing address. | 1 day |
| 3 | `ENABLE_WELCOME_EMAIL` | migration 0041 (applied) | Q5 (read applied in code) | A `+alias` signup gets the confirm email, then the welcome email, with the right local time. | 2 days |
| 4 | `ENABLE_R2_SERVING` | R2 holds `serving/` objects from 5 clean publish days; `publish-serving.mjs rollback` tried once | none | The three ranked-deals URLs return 200 with the same body as the static file. Board unchanged in the preview. | 2 days |
| 5 | `ENABLE_RETENTION_JOBS` (keep `RETENTION_DRY_RUN` `"true"`) | 0045 (applied) | N13, no trace of a read; the `/privacy` paragraph goes live with this flip | `POST /api/run-retention` (admin) lists what it would delete. Read the list. | 3 days |
| 6 | `RETENTION_DRY_RUN` to `"false"` | Owner approves row 5's list | N13 | The first real run deletes only what row 5 listed. | owner's call |
| 7 | `ENABLE_LOCAL_MORNING_SEND` | 0042 (applied); cron `30 * * * *` registered | Q7 (no copy) | Digests arrive about 06:30 local; the legacy 08:00 run does nothing; one email per person per day. Remove the `0 8 * * *` cron in the same PR. | 3 days |
| 8 | `ENABLE_TRIP_SELF_REPORT` | none | C1.2 | Stress-valve email shows the tap links; GET shows a page, POST records the answer. | 2 days |
| 9 | `ENABLE_TRIP_STREAM_V2` | row 8; 0046 (applied) | C1.2/C1.3, no trace of a read | Checklist email asks "Got your ticket?"; a Yes starts the stream; the four old trip emails stop. | 1 week |
| 10 | `ENABLE_LIFECYCLE_V2` | none | C1.4, no trace of a read | Each of the six trip emails has one button and at most one partner, disclosure above it. | 1 week |
| 11 | `ENABLE_EMAIL_CLICK_RECORDING` | `/privacy` names click tracking and is live (condition P1); Resend click tracking on | P5 | An `email_click` event appears and `users.last_clicked_at` moves. | measure |
| 12 | `ENABLE_CARE_EMAIL` | rows 1 and 11; 0047 (applied) | C1.5 | See the warning below. | last |

## Warning for row 12 (care email)

The care email goes to anyone with no click in 60 days. Click tracking only starts at row 11, so for about 60 days everyone looks like a non-clicker, and the "a click was recorded recently" guard does not fix that. Recommended: do not flip row 12 until click tracking has been on for 60 days (about mid-January 2027). If flipped sooner, the cap of 100 emails a run limits the damage.

## Changes from the 2026-10-28 checklist

- Row 11 (click recording) is new: the flag was added 2026-11-01 and `ENABLE_CARE_EMAIL` now requires it.
- The Q3, Q1 and later migrations are applied (2026-10-30), so those "needs" are met.
- Row 7 removes the legacy 08:00 cron in the same PR (Q7 keeps it only as a fallback).

## Separate from this list

- `ENABLE_REPORTS` flips on Nov 11 through #482 (already drafted).
- `ENABLE_CURATED_SERVING` (N10) is the sibling of row 4. It waits on five clean shadow diffs; the count has not been checked.
- These have their own gates and must not be bundled: `ENABLE_LONG_LEAVE`, `ENABLE_LEAVE_BY_PLAN`, `ENABLE_PASSPORT_CHECK`, `ENABLE_PLAN_REMINDERS`, `ENABLE_HOME_CARD`, `ENABLE_RULE_WATCHER`, `ENABLE_FARE_ROUTING`, `ENABLE_T7B_PUSH`.

## After the last flip

Update the matching rows in `docs/handoff/BUILD_STATE.md` with the date each flag went live and what was checked.
