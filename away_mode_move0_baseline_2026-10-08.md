# Away Mode Move 0 baseline (2026-10-08)

For pasting into `state_METRICS.md`. Source for every number: production D1 (`sparkfare-db`), read-only queries run 2026-10-08 (evening, UTC), plus a grep of `src/` and `away-mode.html`. Nothing was changed. Spec: `claude_code_away_mode_four_moves_2026-10-08.md`.

**Read these as pre-launch test data.** The 3 users and 12 trips come from test accounts (one account holds all 12 trips). Not evidence of real user behavior.

## Is there anything to measure for Away Mode page use?
- No `/away-mode` page view event and no questionnaire event exists. `away-mode.html` has no event calls; `src/` has none for `/away-mode` or `/leave`.
- The only browser-side event calls found: `interstitial_close` (`src/interstitial.js`) and one in `src/widget.html`.
- Cloudflare Web Analytics was not checked (no dashboard access from the session). Someone with dashboard access should look.
- The spec expects an `away_mode_sequence_sent` event; it is not in `events`. The nearest is `checklist_email_sent`.

## `events` by type (first event 2026-09-24)
| event_type | count | latest |
|---|---|---|
| outbound_click | 371 | 2026-10-08 16:03 |
| route_promoted | 287 | 2026-10-08 08:00 |
| deal_suppressed | 139 | 2026-10-08 12:32 |
| interstitial_view | 104 | 2026-10-08 13:55 |
| email_open | 41 | 2026-10-08 16:31 |
| alert_email_sent | 14 | 2026-10-08 08:00 |
| share_click | 7 | 2026-10-04 |
| checklist_email_sent | 4 | 2026-10-08 12:32 |
| check_run | 2 | 2026-10-07 |

## `outbound_click` by partner (371 total)
wise 49, yesim 40, safetywing 39, airhelp 38, rocket-languages 37, bounce 27, nordvpn 26, welcome-pickups 24, qeeq 24, us-global-mail 20, tiqets 12, gocity 11, timekettle 9, parking-access 8, aviasales 7.

Bot class (`meta.ua_class`): 347 recorded before the bot class existed, 17 `human`, 7 `bot`. The per-partner counts include bots and the unclassified older rows.

## Other tables
- `trips`: 12 rows, all `status = 'clicked'`, 1 distinct user. No `booked`. No self-reports (the columns do not exist yet; Move 2 adds them).
- `users`: 3 total, 1 verified, 3 subscribed.
- `away_mode_email_log`: follow_up 12, stress_valve 9, departing_soon 1.

## Re-run
One statement per call, e.g. `node node_modules/wrangler/bin/wrangler.js d1 execute sparkfare-db --remote --json --command "SELECT event_type, COUNT(*) n FROM events GROUP BY event_type"`.
