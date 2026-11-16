# Sparkfare metrics (auto-written)

As of 2026-11-15 (UTC). Window: 2026-11-09 to 2026-11-15 (7 days) unless a row says otherwise. Counts only: no email address, no user id.
Rates are computed from the summed counts of their parts, never averaged across days. A rate whose denominator is below the KPI's minimum sample is shown as "too small".
Generated from `metrics_daily` by `scripts/data/metrics-auto.mjs`; definitions are in `src/metrics/definitions.js`.

## Landings

KPI `landings`, unit count, serves: D-036 hard gate 3; N5. Bots: excluded. Minimum sample 30.

| Dimension | Value | n |
| --- | --- | --- |
| direct | 81 | 81 |
| facebook | 35 | 35 |
| producthunt | 4 | 4 |
| reddit | 1 | 1 |
| social | 4 | 4 |

## Signups

KPI `signups`, unit count, serves: D-036 M1 acceptance. Bots: n/a. Minimum sample 30.

| Dimension | Value | n |
| --- | --- | --- |
| direct | 2 | 2 |
| facebook | 1 | 1 |
| unknown | 1 | 1 |

## Confirmed signups

KPI `confirmed`, unit count, serves: D-036 M1 acceptance. Bots: n/a. Minimum sample 30.

Note: Of the users created that day, how many have confirmed as of the last run; the job rewrites the last 7 days each day so recent days catch up

| Dimension | Value | n |
| --- | --- | --- |
| direct | 1 | 2 |
| facebook | 0 | 1 |
| unknown | 1 | 1 |

## Confirm rate

KPI `confirm_rate`, unit percent, serves: D-036 M1 acceptance. Bots: n/a. Minimum sample 30.

| Dimension | Value | Numerator | Denominator (n) | Read |
| --- | --- | --- | --- | --- |
| direct | too small | 1 | 2 | n below 30 |
| facebook | too small | 0 | 1 | n below 30 |
| unknown | too small | 1 | 1 | n below 30 |

## Landing to signup, by channel

KPI `landing_to_signup`, unit percent, serves: Growth plan: channel measurement. Bots: excluded. Minimum sample 30.

Note: An upper bound: people who block sessionStorage or scripts are not counted as landings

| Dimension | Value | Numerator | Denominator (n) | Read |
| --- | --- | --- | --- | --- |
| direct | 2.5 | 2 | 81 | ok |
| facebook | 2.9 | 1 | 35 | ok |
| producthunt | too small | 0 | 4 | n below 30 |
| reddit | too small | 0 | 1 | n below 30 |
| social | too small | 0 | 4 | n below 30 |
| unknown | too small | 1 | 0 | n below 30 |

## Engaged subscribers (opened in the last 45 days)

KPI `engaged_subscribers`, unit count, serves: Business Plan V2.0. Bots: n/a. Minimum sample 100.

Note: Stock, stored once a day as of the run; n is the subscribed list it is a share of

| Dimension | Value | n | As of |
| --- | --- | --- | --- |
| all | 3 | 4 | 2026-11-16 |

## Outbound clicks by meter and surface (human, tracked era)

KPI `outbound_clicks_by_meter_surface`, unit count, serves: F0 meter tracking. Bots: excluded. Minimum sample 30.

Note: Starts 2026-10-13, when the meter flag went live

| Dimension | Value | n |
| --- | --- | --- |
| fare/route | 460 | 460 |
| leave/(none) | 99 | 99 |
| leave/digest_block | 11 | 11 |
| leave/interstitial | 19 | 19 |
| leave/route_page | 81 | 81 |

## Leave clicks per 100 signups, by trip-length bucket

KPI `leave_clicks_per_100_signups`, unit per_100, serves: D-004 leave-signal gate (Dec 11). Bots: excluded. Minimum sample 30.

Note: A bucket with fewer than 30 signups is too small to read

| Dimension | Value | Numerator | Denominator (n) | Read |
| --- | --- | --- | --- | --- |
| 7-10 | too small | 0 | 3 | n below 30 |
| unknown | too small | 210 | 1 | n below 30 |

## Flight clicks per 100 signups, by trip-length bucket

KPI `flight_clicks_per_100_signups`, unit per_100, serves: Fare Search arm comparison (Dec 11, Feb 12). Bots: excluded. Minimum sample 30.

| Dimension | Value | Numerator | Denominator (n) | Read |
| --- | --- | --- | --- | --- |
| 7-10 | too small | 0 | 3 | n below 30 |
| unknown | too small | 460 | 1 | n below 30 |

## Payouts by meter and tier (network_confirmed rows as entered)

KPI `payouts_by_meter_tier`, unit usd, serves: F0 revenue report. Bots: n/a. Minimum sample 1.

Note: Snapshot of the current and previous month; tier is the payout source; the allocated estimate stays on /admin/revenue

No data in this window.

## Data-quality SLO attainment (share of days with no data alert)

KPI `data_slo_attainment`, unit percent, serves: DR-24 same-day data SLO. Bots: n/a. Minimum sample 7.

Note: Counted from 2026-10-25, the first day the same-day alert ran; earlier days have no measurement

| Dimension | Value | Numerator | Denominator (n) | Read |
| --- | --- | --- | --- | --- |
| all | 100 | 7 | 7 | ok |

## Data incidents (breaches listed by the 09:30 UTC alert)

KPI `data_incidents`, unit count, serves: DR-24 same-day data SLO. Bots: n/a. Minimum sample 1.

| Dimension | Value | n |
| --- | --- | --- |
| all | 0 | 0 |
