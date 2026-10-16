# Sparkfare metrics draft (state_METRICS_draft_2026-10-16.md)

Prepared 2026-10-16 under Task F1.4 (Addendum F).
Every value below comes from named, verified sources (`state_METRICS.md` baseline, `events` table, `users` table, and production walkthroughs).
Where data is not retrievable without dashboard/analytics secrets, the cell states "not available". Nothing is estimated.

## Council Metric Table

| metric | definition | source | value | as-of | sample size | caveat |
|---|---|---|---|---|---|---|
| Visits | Total monthly unique visitors / requests | Cloudflare Dashboard (Zone Analytics) | not available | 2026-10-16 | n/a | Requires owner Cloudflare dashboard access or Zone Analytics token |
| Signups by source (total) | All signups in tracked era | `events` (`event_type = 'signup'`) | 0 | 2026-10-16 11:35 UTC | n = 0 events | 3 existing user rows were created 2026-09-04 prior to tracked era |
| Signups by source (homepage) | Signups from `/` form | `events` (`event_type = 'signup'` and `source IS NULL`) | 0 | 2026-10-16 11:35 UTC | n = 0 | No organic conversion yet observed |
| Signups by source (/leave) | Signups from `/leave` checklist form | `events` (`event_type = 'leave_signup'`) | 0 | 2026-10-16 11:35 UTC | n = 0 | Tested with mock address, purged afterwards |
| Signups by source (/check) | Signups from `/check` tool | `events` (`event_type = 'check_signup'`) | 0 | 2026-10-16 11:35 UTC | n = 0 | Zero public user signups recorded |
| Confirmed subscribers | Verified active subscribers | `users` (`verified_email = 1 AND is_subscribed = 1`) | 1 | 2026-10-16 11:35 UTC | n = 3 users | Only 1 user account is verified |
| Human outbound clicks per 100 signups (weekend) | Clicks with `ua_class = 'human'` and bucket 'weekend' / signups | `events` | not available | 2026-10-16 | n = 0 signups | Denominator is 0 |
| Human outbound clicks per 100 signups (4-6 days) | Clicks with `ua_class = 'human'` and bucket '4-6' / signups | `events` | not available | 2026-10-16 | n = 0 signups | Denominator is 0 |
| Human outbound clicks per 100 signups (7-10 days) | Clicks with `ua_class = 'human'` and bucket '7-10' / signups | `events` | not available | 2026-10-16 | n = 0 signups | Denominator is 0 |
| Human outbound clicks per 100 signups (11-14 days) | Clicks with `ua_class = 'human'` and bucket '11-14' / signups | `events` | not available | 2026-10-16 | n = 0 signups | Denominator is 0 |
| Human outbound clicks per 100 signups (2+ weeks) | Clicks with `ua_class = 'human'` and bucket '2+ weeks' / signups | `events` | not available | 2026-10-16 | n = 0 signups | Denominator is 0 |
| Human outbound clicks per 100 signups (30+ days) | Clicks with `ua_class = 'human'` and bucket '30_plus' / signups | `events` | not available | 2026-10-16 | n = 0 signups | Denominator is 0 |
| `/leave` starts | Visitors initiating the leave checklist | `events` (`event_type = 'leave_started'`) | 3 | 2026-10-14 16:45 UTC | n = 3 | Test traffic and owner testing |
| `/leave` completions | Visitors reaching final plan | `events` (`event_type = 'leave_completed'`) | 4 | 2026-10-14 16:45 UTC | n = 4 | Verification passes |
| Email sends (digests, 7 days) | Successful digest deliveries | `events` (`event_type = 'alert_email_sent'`) | 5 | 2026-10-14 16:45 UTC | 7-day window | Sent to the 1 verified subscriber |
| Email opens (7 days) | Tracked open pixels | `events` (`event_type = 'email_open'`) | 36 | 2026-10-14 16:45 UTC | 7-day window | Inflated by mail scanner / Apple Mail Privacy fetches |
| Human clicks by partner: NordVPN | `partner = 'nordvpn'`, `ua_class = 'human'` | `events` | 12 | 2026-10-13 11:35 UTC | n = 88 human clicks | Tracked era since 2026-10-07 |
| Human clicks by partner: Bounce | `partner = 'bounce'`, `ua_class = 'human'` | `events` | 12 | 2026-10-13 11:35 UTC | n = 88 human clicks | Tracked era |
| Human clicks by partner: AirHelp | `partner = 'airhelp'`, `ua_class = 'human'` | `events` | 12 | 2026-10-13 11:35 UTC | n = 88 human clicks | Tracked era |
| Human clicks by partner: Wise | `partner = 'wise'`, `ua_class = 'human'` | `events` | 11 | 2026-10-13 11:35 UTC | n = 88 human clicks | Tracked era |
| Human clicks by partner: Yesim | `partner = 'yesim'`, `ua_class = 'human'` | `events` | 9 | 2026-10-13 11:35 UTC | n = 88 human clicks | Tracked era |
| Human clicks by partner: Tiqets | `partner = 'tiqets'`, `ua_class = 'human'` | `events` | 6 | 2026-10-13 11:35 UTC | n = 88 human clicks | Tracked era |
| Human clicks by partner: Welcome Pickups | `partner = 'welcome-pickups'`, `ua_class = 'human'` | `events` | 5 | 2026-10-13 11:35 UTC | n = 88 human clicks | Tracked era |
| Human clicks by partner: Aviasales | `partner = 'aviasales'`, `ua_class = 'human'` | `events` | 4 | 2026-10-13 11:35 UTC | n = 88 human clicks | Direct flight outbounds |
| Human clicks with F0 meter enrichment | Clicks carrying `meta.meter` | `events` (`ts >= 2026-10-13 10:47:10 UTC`) | 0 | 2026-10-16 11:35 UTC | n = 0 | 14-day readout window completes 2026-10-27 10:47 UTC |
