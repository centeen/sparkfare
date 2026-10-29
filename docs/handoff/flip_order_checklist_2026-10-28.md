# Flip-order checklist: PR #418 (Addendum Q, N12–N14, C1)

Written 2026-10-28. Everything in PR #418 merges dark: every flag below is `"false"` today. Rules that apply to all of it: no flips before **Mon Nov 9**; no merges **Nov 6 18:00 ET to Nov 8**; last feature merge **Wed Nov 4**; **one flag per PR**, with a soak between flips; each flip PR is the owner's to approve. Only the exact string `"true"` turns a flag on, and a merge deploys in about a minute.

## Phase 0: before merging #418 (owner, by Nov 4)

| # | Do | Why / how to check |
|---|----|--------------------|
| 0.1 | Back up D1 (the N3 backup runs daily; confirm last night's exists) | Rollback point before 8 migrations |
| 0.2 | Check which of `0038`–`0047` are already applied: `wrangler d1 execute sparkfare-db --remote --command "SELECT name FROM d1_migrations ORDER BY name DESC LIMIT 12"` | `0038` (Q3) was still pending when last recorded; `0039` (send ledger) unknown |
| 0.3 | Apply **`0044` first** (events typed columns), then the rest in order, by `d1 execute --remote --file=` | The new `logEvent` writes `ua_class` and `schema_version`; it self-heals, but apply first so the first deploy is clean |
| 0.4 | Apply `0038`, `0039`, `0040`, `0041`, `0042`, `0043`, `0045`, `0046`, `0047`, then insert each name into `d1_migrations` | The 403 on `migrations apply --remote` is intermittent; see CLAUDE.md |
| 0.5 | Confirm Worker secrets exist: `UNSUBSCRIBE_SECRET`, `EMAIL_POSTAL_ADDRESS`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET` | Q4 refuses to send non-transactional mail without the postal address; prefs and care links need the secret |
| 0.6 | Confirm the cron list will be five entries and the account allows it (Workers Paid) | Q7 adds `30 * * * *`; the free plan caps at 5 per account |
| 0.7 | Delete the stray remote branch `q/q5-welcome` | Housekeeping |
| 0.8 | Run `docs/q6_production_reads.sql` and keep the output | Baseline of who the pause rule would touch |

## Phase 1: merge #418 (no flag changes)

Merging changes three things even with every flag off. Check each within an hour of the deploy:

1. **N12 event registry.** Only registered event names are written; anything else is dropped and logged once as `unregistered_event`. Watch `wrangler tail` or the `events` table for `unregistered_event`; add any missing name to `src/events/registry.js`.
2. **Q6 pause rule.** Pausing now needs no click in 90 days AND no open in 45 days AND an account older than 90 days (was: no open in 45 days). It is more lenient, so it can pause fewer people, never more. Clicks are not recorded yet, so opens decide.
3. **Q8 stream tags.** Every send now carries `stream` and `kind` tags and a paused stream is refused. No visible change.

Also confirm: `/api/health` 200; the 07:00 and 08:00 runs still send once; `data` workflows push their "Publish serving files (R2)" step without error (it does nothing while R2 is empty or the flag is off).

## Phase 2: Resend settings (owner, before Nov 9, no code)

1. Turn on **Resend open tracking** (already on) and **click tracking** for `links.sparkfare.com`, or an equivalent subdomain.
2. Subscribe the webhook `https://sparkfare.com/api/webhooks/resend` to `email.delivered` and `email.clicked` as well as opened, bounced and complained. A 401 in its delivery log means the signing secret changed.
3. Send yourself one digest; confirm a click shows in `events` (`email_click`) and moves `users.last_clicked_at`. **Click tracking rewrites links through Resend**, so also confirm the Aviasales `marker=` and the `/out/` links still land correctly.

## Phase 3: flips, from Nov 9, in this order

Each row is one PR changing one value in `wrangler.jsonc`. Soak is the minimum before the next row. Roll back by setting the value back to `"false"` and merging.

| Order | Flag | Needs | Hub Guard read | Check after | Soak |
|---|------|-------|----------------|-------------|------|
| 1 | `ENABLE_SIGNED_PREFS` | `UNSUBSCRIBE_SECRET` | C1.1 | Footer link "Change how often, or pause" in a digest; open `/prefs`, GET changes nothing, POST changes one setting | 1 day |
| 2 | `ENABLE_SIGNUP_FREQUENCY` | none | C1.1 | Signup form shows the two options; a new signup stores `frequency`; a resubmit never changes an existing address | 1 day |
| 3 | `ENABLE_WELCOME_EMAIL` | `0041` | Q5 | A test signup gets the confirm email then the welcome; time shown in the home zone | 2 days |
| 4 | `ENABLE_R2_SERVING` | R2 has `ranked-deals/` objects from the publish step; `publish-serving.mjs rollback` tried once | N14 (no copy) | The three ranked-deals URLs return 200 with the same body as the asset; `/api/deals` unchanged | 2 days |
| 5 | `ENABLE_RETENTION_JOBS` (with `RETENTION_DRY_RUN` still `"true"`) | `0045` | N13 | `POST /api/run-retention` (admin) reports what it WOULD delete; read it | 3 days |
| 6 | `RETENTION_DRY_RUN` to `"false"` | Row 5 report approved by the owner | N13 | First real run deletes only what the report listed | owner's call |
| 7 | `ENABLE_LOCAL_MORNING_SEND` | `0042`; cron `30 * * * *` registered | Q7 (no copy) | Digests arrive about 06:30 local per origin; the legacy 08:00 run does nothing; one email per person per day | 3 days |
| 8 | `ENABLE_TRIP_SELF_REPORT` | `UNSUBSCRIBE_SECRET` | C1.2 | Stress-valve email shows the tap links; GET shows a page, POST records | 2 days |
| 9 | `ENABLE_TRIP_STREAM_V2` | Row 8; `0046` | C1.2 | Checklist email asks "Got your ticket?"; a Yes starts the stream; the four old trip emails stop | 1 week |
| 10 | `ENABLE_LIFECYCLE_V2` | none | C1.4 | The six trip emails show one button and at most one partner, disclosure above it | 1 week |
| 11 | `ENABLE_CARE_EMAIL` | Phase 2 done; `ENABLE_SIGNED_PREFS`; `0047` | C1.5 | See the warning below | last |

### Warning for row 11 (care email)

The care email goes to anyone with **no click in 60 days**. Click tracking starts in Phase 2, so for roughly the first 60 days after it is on, every subscriber looks like a non-clicker. The "a click was recorded recently" guard only proves tracking is alive; it does not make the 60-day window honest. **Recommended: do not flip row 11 until click tracking has been on for 60 days (about mid-January 2027).** If it is flipped sooner, the per-run cap of 100 limits the damage to 100 emails a day, but the email would say "we haven't seen a click in about two months" to people who have simply not been measured.

## Do not flip, other open items

`ENABLE_LONG_LEAVE`, `ENABLE_LEAVE_BY_PLAN`, `ENABLE_PASSPORT_CHECK`, `ENABLE_PLAN_REMINDERS`, `ENABLE_HOME_CARD`, `ENABLE_RULE_WATCHER`, `ENABLE_FARE_ROUTING`, `ENABLE_CURATED_SERVING`, `ENABLE_T7B_PUSH` and the rest are not part of this PR and have their own gates (Hub reads, Dec 11 gate, owner decisions). Do not bundle them into these flips.

## After the last flip

Update `docs/handoff/BUILD_STATE.md` rows for each flag with the date it went live and what was checked.
