# Task D: first revenue readout (recorded 2026-10-13, NOT STARTED, gated)

> ## GATE: do not implement Task D until Task B has been live for 14 days
>
> **Task D is implemented only once Task B (F0, ROADMAP step 84) has been live for 14 days.** Until then this file is a plan,
> nothing is built, and no readout file is written.
>
> **What "live" means here, because it changes the date.** Task B's code was deployed on **2026-10-13 08:55 UTC** (PR #192), but
> both of its flags ship **off**: `ENABLE_METER_TRACKING` (event enrichment, `/admin/payouts`, `/admin/revenue`) and
> `ENABLE_FARE_ROUTING`. With the flag off no click carries a meter or a trip-length bucket, `/admin/revenue` returns 404, and
> there is nothing to read. So:
>
> - **The 14 days start the day `ENABLE_METER_TRACKING` is switched to `"true"` in production,** not the deploy date.
>   Earliest start of the readout = flag-on date + 14 days. The flag was not on as of 2026-10-13.
> - If the owner would rather count from the deploy date, the earliest date is **2026-10-27**, but a readout then would be empty
>   for the reason above. Record the owner's choice in `state_DECISION_LOG.md` when the flag goes on.
> - Also needed before running it: partner payouts entered for the month (`POST /admin/payouts`, the owner's one monthly task),
>   otherwise every revenue-per-click figure is null.
> - The long-leave section applies only once `ENABLE_LONG_LEAVE` is on (it is off), and then only after its own 14 days.

## The task as given (verbatim)

```
TASK D — First readout. Read-only except for one new file.

1. Pull GET /admin/revenue for the current and previous month.
2. Summarize, in plain language:
   - human outbound clicks by meter and by partner
   - leave vs flight clicks per 100 signups, by trip_length_bucket
   - any bucket with < 30 signups (call it out, don't draw conclusions)
   - if ENABLE_LONG_LEAVE is on: branch impressions, branch clicks, and
     leave_completed rate for 30_plus vs 7_10
3. Draft rows for state_METRICS.md as a separate file
   (state_METRICS_draft_YYYY-MM-DD.md). Do not edit state_METRICS.md.
4. Flag any number that looks wrong (e.g. clicks with null meter, bots
   leaking into human counts).
```

## Analysis: what Task D needs, and what exists

| Task D item | What produces it today | Status |
|---|---|---|
| 1. `GET /admin/revenue?month=` | `computeRevenueReport()` in `src/meters.js`, route in `src/index.js` (admin Bearer, flag-gated) | Built and deployed, flag off |
| 2a. Human clicks by meter and partner | `by_meter`, `by_partner` in the report (bots excluded with `ua_class != bot`; meter from the registry) | Built |
| 2b. Leave vs flight clicks per 100 signups by bucket | `gate_view[]`: `leave_clicks_per_100_signups`, `flight_clicks_per_100_signups`, `signups`, `too_small` | Built |
| 2c. Buckets under 30 signups | `gate_view[].too_small` and `note` | Built |
| 2d. Branch impressions | `leave_long_branch_shown` events (surface `leave` or `away_mode`) | Built (G1, flag off) |
| 2d. Branch clicks | `outbound_click` events with `source = 'leave_long'` (`by_src` in the report) | Built, but see conflict D5 |
| 2d. `leave_completed` rate, 30_plus vs 7_10 | `leave_started`, `leave_trip_length`, `leave_completed` events | Built, but see D3 and D4 |
| 3. `state_METRICS_draft_YYYY-MM-DD.md` | Nothing yet. `state_METRICS.md` does not exist in the repo | To write at readout time |
| 4. "Looks wrong" flags | Partly: `unclassified_clicks` and `notes` in the report | Needs a small additive field, see D7 |

## Conflicts and open questions found while recording this (decide before implementing)

| # | Task D says | What is true | Proposed fix |
|---|---|---|---|
| D1 | "once Task B has been live for 14 days" | Deployed 2026-10-13 but both flags are off, so it collects nothing. | Start the 14 days on the day `ENABLE_METER_TRACKING` goes on (see the gate above). Owner confirms. |
| D2 | "Pull GET /admin/revenue" | The route needs the `ADMIN_SECRET` Bearer token, which only the owner holds and no session can read back, and it returns 404 while the flag is off. | The owner runs two `curl` calls (current and previous month) and gives the JSON, or sets the secret in their own terminal for a one-off script. Read-only D1 queries are the fallback but would duplicate the report's logic. |
| D3 | "30_plus vs 7_10" | The stored token is `7-10` (hyphen), and /leave's own answer for 1 to 2 weeks is `one_two_weeks`, which covers 4-6, 7-10 and 11-14. The `leave_completed` event's `trip_length_bucket` is null for it, because it is ambiguous. | Compare `month_plus` with `one_two_weeks` using the event's `bucket` field, and say so. Use `7-10` for signups from the report's `gate_view`. |
| D4 | "`leave_completed` rate" | Nothing defines the denominator. `leave_completed` and `leave_trip_length` fire together at plan time, so completed over trip-length is always about 100%. `leave_started` is sent by the browser (ad blockers drop it) and carries a bucket only for signed-in visitors. | Define the rate as `leave_completed / leave_started`, overall; by bucket only where `leave_started` had one; otherwise report counts, not rates. |
| D5 | "branch clicks" | The only tracked click in the lead is the US Global Mail link. The USPS links, the insurance item and water are not tracked (Step 19, and by design), so clicks per impression understates engagement. | Report it as "partner link clicks", never as total engagement. |
| D6 | "Draft rows for state_METRICS.md" | `state_METRICS.md` does not exist, so there is no row format. | Draft a table: `metric / definition / source / value / as-of / sample size / caveat`, and note that the format is a proposal. |
| D7 | "clicks with null meter" | By design some clicks have no `meta.meter`: every click before the flag was on, and insurance clicks. The report derives the meter from the registry, so `by_meter` is complete, but it does not say how many events had no tagged meter. | When implementing, add one additive field (`untagged_clicks`, events with no `meta.meter`) and call out the pre-flag and insurance share. |
| D8 | "bots leaking into human counts" | The filter is a heuristic on the User-Agent. 346 of 441 clicks recorded before 2026-10-13 have no `ua_class` and count as human. | Restrict the readout to events with a `ua_class` (the tracked era) and show the unclassified count next to it. |
| D9 | Readout of "current and previous month" | After 14 days the previous month may have no tracked data, and there are 3 users, so almost every bucket will be `too_small`. | Expect "not enough data" and say it plainly; Task D itself says not to draw conclusions. |

## Procedure when the gate opens

1. Confirm in `state_DECISION_LOG.md` the date `ENABLE_METER_TRACKING` went on, and that 14 days have passed.
2. Owner enters the month's partner payouts (`POST /admin/payouts`), then runs `GET /admin/revenue?month=YYYY-MM` for the current
   and previous month with the admin secret and hands over the JSON (D2).
3. Write `state_METRICS_draft_YYYY-MM-DD.md` (one new file; never edit `state_METRICS.md`) with:
   - **Clicks:** human outbound clicks by meter and by partner, with `unclassified_clicks` shown next to them (D8).
   - **Per 100 signups:** leave and flight clicks by `trip_length_bucket`, with every bucket under 30 signups named as "too small"
     and no conclusion drawn.
   - **Long leave (only if its flag is on):** impressions, partner link clicks (D5) and the completion rate as defined in D4.
   - **Data-quality flags (D7, D8):** every number that looks wrong, each with the reason.
4. Label every figure with its tier (network_confirmed, allocated_estimate, clicks_only). A click is never revenue.
5. Open a docs PR with the single new file; do not merge without the owner.

## Where this is recorded
`ROADMAP.md` (step 86), `state_DECISION_LOG.md`, and the F0 and G1 entries in `CLAUDE.md`.
