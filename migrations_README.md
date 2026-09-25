# D1 Migrations

**B3 (2026-09-25): migrations now auto-apply on deploy.** `npm run deploy` runs
`npm run migrate` (`wrangler d1 migrations apply sparkfare-db --remote`) before `wrangler deploy`,
via `&&` — if migrations fail, the deploy does not proceed. Deploy with `npm run deploy`, not a
bare `wrangler deploy`, so this actually happens.

There is still no GitHub Actions step that does this on merge to `main` — every deploy in this
project's history has been a manual `wrangler deploy` from someone's terminal (there is no deploy
workflow in `.github/workflows/`), so "on deploy" means "whenever `npm run deploy` is actually
run," not an automatic CI trigger. Wiring that up is separate, larger scope (a `CLOUDFLARE_API_TOKEN`
GitHub secret, and a real decision about auto-deploying on every push given this project's own
documented history of multi-session deploy collisions) — not done here.

Migration files live in `migrations/`, wrangler's own default location — no `migrations_dir`
override needed in `wrangler.jsonc` (confirmed against `wrangler d1 migrations apply --local`,
which found them there with no extra config). **Verified end-to-end against a genuinely fresh
local D1**: all 9 files (`0000`-`0008`) now apply cleanly in order with no errors, confirmed via
`PRAGMA table_info(users)` showing all 22 expected columns and every expected table present
afterward. This wasn't true before this pass — `0000` (creating `users` itself, which predates
any migration tooling and which every later file assumes already exists) and `0004`'s own
undeclared dependency on `early_access`/`referred_by` (referenced in its backfill query, never
created by any earlier file) both had to be added; `0008` fills in `partner_id`/`passenger_count`,
present in code but never covered by any migration at all. See the git history on this file's own
migrations for exactly what each one adds and why.

## ⚠️ Before the first real `--remote` run, read this

`wrangler d1 migrations apply` tracks what it's applied in its own `d1_migrations` bookkeeping
table on the D1 database itself — separate from, and blind to, every ad-hoc `ALTER TABLE`/manual
`wrangler d1 execute` this project has used for schema changes until now (see CLAUDE.md's own
extensive history of exactly that pattern). **This means production's actual schema and this
migration set's own bookkeeping have never been reconciled** — the local verification above proves
the migrations are internally consistent and correct, not that they're safe to blindly run against
production's real, already-drifted state. Several of these files' effects likely already exist in
production from earlier manual changes (`0001`'s `has_pet`/`last_opened_at`/`is_subscribed`,
`0004`'s `early_access`/`referred_by`, `0008`'s `partner_id`/`passenger_count` — see CLAUDE.md's
Module A and Steps 89/93 entries). SQLite has no `ADD COLUMN IF NOT EXISTS`, so if
`wrangler d1 migrations apply --remote` tries to re-run an `ALTER TABLE ADD COLUMN` whose column
is already there, it fails outright with `duplicate column name` — and per `&&`, blocks the deploy.

**The `CREATE TABLE` migrations (`0000`, `0002`, `0003`, part of `0004`, `0007`) are safe
regardless** — they all use `IF NOT EXISTS`, matching this project's own established convention,
so they no-op cleanly whether or not the table already exists.

**If a bare `ALTER TABLE` migration (`0001`, part of `0004`, `0005`, `0006`, `0008`) fails on
`duplicate column name`**: that means its effect is already live — don't edit the migration file
to work around it. Instead, mark it applied directly, matching D1's own bookkeeping format:
```bash
wrangler d1 execute sparkfare-db --remote --command "INSERT INTO d1_migrations (name, applied_at) VALUES ('0001_initial_schema.sql', datetime('now'))"
```
then re-run `npm run migrate` to continue with whatever's next. This is a one-time reconciliation;
once done, `d1_migrations` correctly reflects reality and every future migration applies cleanly.

**Also worth knowing**: `src/index.js` has its own defensive `CREATE TABLE IF NOT EXISTS` guards
inline, right before first use, for `events`/`email_suppressions`/`consent_log`/`watchlists` and
several delivery-log tables (see CLAUDE.md's F1/F2 entries) — a second, independent safety net
matching this project's established pattern, in case a migration is ever skipped or these
particular tables' real production state is ever in doubt again. Both mechanisms are safe to have
active at once; whichever runs first wins, and the other just no-ops.
