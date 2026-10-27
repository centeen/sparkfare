# Sparkfare metrics draft (state_METRICS_draft_2026-10-27.md): Task D first readout

Prepared 2026-10-27 17:49 UTC under Task D (ROADMAP step 86, `task_d_first_readout_2026-10-13.md`). Does not edit `state_METRICS.md`.

## Status: skeleton, not a readout yet

**The gate is open.** `ENABLE_METER_TRACKING` went on at 2026-10-13 10:47:10 UTC (PR #196), so the 14 days ended 2026-10-27 10:47 UTC.
**No figure below has been pulled.** `GET /admin/revenue` needs the `ADMIN_SECRET` Bearer token, which only the owner holds, and this
session has no production D1 access. Every value cell reads `PENDING`. Nothing is estimated, and nothing here draws a conclusion.

## Inputs needed from the owner (D2, D6 of the plan)

1. Enter October partner payouts first, or every revenue-per-click cell stays null: `POST /admin/payouts` (admin Bearer).
2. Run both calls in your own terminal and paste the JSON back (or save it as a file in the repo's scratch folder):

```
curl -s -H "Authorization: Bearer $ADMIN_SECRET" "https://sparkfare.com/admin/revenue?month=2026-10"
curl -s -H "Authorization: Bearer $ADMIN_SECRET" "https://sparkfare.com/admin/revenue?month=2026-09"
```

September will mostly be pre-flag (no meter tags), so expect it to be nearly empty. October covers 14 tracked days.

## Readout tables (fill from the JSON)

Window: 2026-10-13 10:47 UTC to 2026-10-27 10:47 UTC. Bots excluded (`bots_excluded: true`). A click is never revenue.

### Human outbound clicks by meter (`by_meter`)

| meter | human clicks | source | as-of | sample size | caveat |
|---|---|---|---|---|---|
| fare | PENDING | `/admin/revenue` `by_meter` | PENDING | PENDING | Aviasales only |
| leave (all non-fare meters) | PENDING | `by_meter` | PENDING | PENDING | meter comes from the registry, so complete even for untagged events |

### Human outbound clicks by partner (`by_partner`)

| partner | meter | human clicks | payout (USD) | payout source / tier | revenue per click |
|---|---|---|---|---|---|
| PENDING (one row per partner in the report) | | | | | |

Show the tier next to every money figure: `network_confirmed` (as entered), `allocated_estimate` (labelled ESTIMATE), `clicks_only` (no payout).

### Clicks per 100 signups by trip-length bucket (`gate_view`)

| bucket | signups | leave clicks per 100 | flight clicks per 100 | too small? |
|---|---|---|---|---|
| weekend | PENDING | PENDING | PENDING | PENDING |
| 4-6 | PENDING | PENDING | PENDING | PENDING |
| 7-10 | PENDING | PENDING | PENDING | PENDING |
| 11-14 | PENDING | PENDING | PENDING | PENDING |
| 2+ weeks | PENDING | PENDING | PENDING | PENDING |
| 30_plus | PENDING | PENDING | PENDING | PENDING |

Any bucket under 30 signups (`too_small: true`) is named as such and no conclusion is drawn from it. Expect almost all of them to be too small:
the audience was 3 users on 2026-10-13, and signup tracking only began with M1 (Oct 21). The M1 baseline (`scripts/growth-baseline.mjs`, also due today)
gives the signup denominator.

### Long leave (G1)

`ENABLE_LONG_LEAVE` was `"false"` on 2026-10-15 (#236) and the Hub's D-006 review of the lead copy is not recorded as done. **This section is not applicable
unless the flag is on; confirm in `wrangler.jsonc` before filling it.** If it is on, use the definitions in plan items D3 to D5: compare
`month_plus` with `one_two_weeks` from the event's `bucket` field, rate = `leave_completed / leave_started` (counts only where `leave_started`
carried no bucket), and call the click figure "partner link clicks", never total engagement.

## Data-quality flags (fill in; each with its reason)

| flag | what to check | status |
|---|---|---|
| Clicks with no `meta.meter` | Expected for pre-flag clicks and insurance. The report has no `untagged_clicks` field yet (plan item D7), so count `outbound_click` events in the window with no `meta.meter` by a read-only query. | PENDING |
| Unclassified clicks (no `ua_class`) | Report field `unclassified_clicks`. 346 of 441 pre-Oct-13 clicks were unclassified; none should be in this window. Restrict to events with a class. | PENDING |
| Bots in human counts | `ua_class` is a User-Agent heuristic. The owner's and testers' own clicks count as human. 84 of 88 earlier human clicks were `anon` with 5 distinct `sub_id`s. | PENDING |
| Test traffic | Claude's verification clicks and `+alias` signups from M1, N5, M2 and M3 checks are in this window. | PENDING |
| Trips reconciled | `reconcileBookings()` uses campaign 100, still unverified against a real conversion; a zero here is not evidence the filter is right. | PENDING |
| Partner payouts present | No `partner_payouts` rows means every revenue figure is null. | PENDING |

## Proposed rows for `state_METRICS.md` (format is a proposal; the file's own format is `metric / definition / source / value / as-of / sample size / caveat`)

| metric | definition | source | value | as-of | sample size | caveat |
|---|---|---|---|---|---|---|
| Human clicks, F0-tagged window | `ua_class = 'human'` and `ts` between 2026-10-13 10:47 and 2026-10-27 10:47 UTC | `/admin/revenue` | PENDING | PENDING | PENDING | UA heuristic; mostly owner and testers |
| Human clicks by meter | as above, grouped by registry meter | `/admin/revenue` `by_meter` | PENDING | PENDING | PENDING | |
| Leave clicks per 100 signups, by bucket | leave-meter human clicks over signups with that bucket | `/admin/revenue` `gate_view` | PENDING | PENDING | PENDING | any bucket under 30 signups is "too small" |
| Flight clicks per 100 signups, by bucket | fare-meter human clicks over signups with that bucket | `/admin/revenue` `gate_view` | PENDING | PENDING | PENDING | |
| Partner payouts entered (October) | rows in `partner_payouts` | `/admin/payouts` | PENDING | PENDING | PENDING | owner-entered; network-confirmed tier |
| Allocated revenue by segment | payout split by click share | `allocated_estimate` | PENDING | PENDING | PENDING | ESTIMATE, adds back to the payout |
