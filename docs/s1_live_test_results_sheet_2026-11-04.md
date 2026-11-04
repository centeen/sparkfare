# S1 live test results sheet (Addendum S, S1: `utm_medium` stored with a signup)

Drafted 2026-11-04, docs only. **Every Result cell is blank.** This sandbox cannot reach production, so the owner (or a session with Cloudflare access) runs the commands and fills it in. Part of Part A of `docs/launch_nov6_go_no_go_checklist_2026-11-03.md` (row "S1 live test"), due Wed Nov 4.

Use your own `+alias` addresses only, never a real subscriber's. On Windows use `node node_modules/wrangler/bin/wrangler.js`, not `npx wrangler`, and Git Bash or `curl.exe` (PowerShell's `curl` is `Invoke-WebRequest`).

| Field | Value |
|---|---|
| Run by / date and time (ET) | |
| `main` commit deployed at the time | |

## Step 1: send three signups

```bash
for m in post email junk; do
  curl -s -X POST https://sparkfare.com/api/signup \
    -H 'Content-Type: application/json' \
    -d "{\"id\":\"local_s1test_$m\",\"email\":\"centeen+s1test$m@gmail.com\",\"origin_iata\":\"JFK\",\"trip_length\":\"7-10\",\"source\":\"home\",\"utm\":\"x_s1test\",\"medium\":\"$m\"}"
  echo
done
```

| Medium sent | HTTP / response (expect `ok: true`) | Result |
|---|---|---|
| `post` | | |
| `email` | | |
| `junk` | | |

A 400 means a required field is missing or the origin is invalid; paste the error text.

## Step 2: read what was stored (wait a few seconds first; the event is written in the background)

```bash
node node_modules/wrangler/bin/wrangler.js d1 execute sparkfare-db --remote --command \
 "SELECT e.user_id, e.source, json_extract(e.meta,'\$.utm') AS utm, json_extract(e.meta,'\$.utm_medium') AS medium FROM events e WHERE e.event_type='signup' AND e.user_id LIKE 'local_s1test_%' ORDER BY e.ts"
```

| user_id | Expected utm | Expected medium | Seen utm | Seen medium | PASS / FAIL |
|---|---|---|---|---|---|
| `local_s1test_post` | `x_s1test` | `post` | | | |
| `local_s1test_email` | `x_s1test` | `email` | | | |
| `local_s1test_junk` | `x_s1test` | **`other`** | | | |

The `junk` row is the real test: anything but `other` means the medium is not being sanitised, and that is the failure to report.

Also note: `source` column value seen (expect `home`): ______ ; any row missing after 60 seconds: ______

## Step 3 (optional): admin report

`/admin/growth` (needs the admin secret; counts only). Tag `x_s1test` shows ___ signups (expect 3). Confirmed count ___ (depends on whether the verification links were opened).

## Step 4: clean up, then prove it

Delete child rows first. The `consent_log` statement is a guess (its key column and whether these signups wrote rows are unconfirmed); if it errors, drop that statement and say so.

```bash
node node_modules/wrangler/bin/wrangler.js d1 execute sparkfare-db --remote --command \
 "DELETE FROM events WHERE user_id LIKE 'local_s1test_%'; DELETE FROM consent_log WHERE user_id LIKE 'local_s1test_%'; DELETE FROM users WHERE id LIKE 'local_s1test_%'"
```

Re-run the Step 2 query and also check the users table:

```bash
node node_modules/wrangler/bin/wrangler.js d1 execute sparkfare-db --remote --command \
 "SELECT COUNT(*) AS left_over FROM users WHERE id LIKE 'local_s1test_%'"
```

| Check | Expected | Seen |
|---|---|---|
| Step 2 query after cleanup | no rows | |
| `left_over` users | 0 | |
| `consent_log` statement | ran, or errored (paste the error) | |

## Notes to record

- Each signup sends a verification email to its alias. Gmail's link scanner may auto-verify the links within seconds, so `verified_email = 1` on a test row does not mean anything went wrong.
- Use `centeen+...` aliases: `coby+m1test@gmail.com` is already in `email_suppressions` (bounce), so its verification email is silently skipped.
- Anything unexpected (extra rows, an error, a different `source`):

## Result

| Overall | PASS / FAIL |
|---|---|
| If FAIL: what, and the fix PR | |
| Test rows confirmed deleted | |
| Reported back to (and when) | |
