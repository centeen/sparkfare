-- N7 (Addendum N, ROADMAP step 154; framework DR-04): bring the migrations up to what production actually holds.
-- Eight tables that production holds were only ever created at runtime (CREATE TABLE IF NOT EXISTS inside src/), so a database built from the
-- migrations alone did not have them. The definitions below are copied from production's sqlite_master on 2026-10-24
-- (docs/handoff/addendum_N_plan_2026-10-25.md, item 1), so applying this file to production changes nothing there:
-- every statement for those is IF NOT EXISTS. It matters for a fresh database (a restore, a rebuild, the CI drift test).
-- After this file, no table in src/ is created without a migration (tests/schema_drift.test.js enforces it).
-- Apply to production (a no-op there) and record it in d1_migrations:
--   wrangler d1 execute sparkfare-db --remote --file=migrations/0034_reconcile_runtime_tables.sql
CREATE TABLE IF NOT EXISTS away_mode_clicks (
            id TEXT PRIMARY KEY,
            trip_id TEXT,
            partner_id TEXT,
            affiliate_slug TEXT NOT NULL,
            clicked_at TEXT DEFAULT (datetime('now'))
          );
CREATE TABLE IF NOT EXISTS away_mode_email_log (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, partner_id TEXT, email_type TEXT NOT NULL, sent_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS daily_alert_deliveries (
      delivery_key TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      delivered_on TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
CREATE TABLE IF NOT EXISTS departing_soon_deliveries (trip_id TEXT PRIMARY KEY, email TEXT NOT NULL, status TEXT NOT NULL, error TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS departure_briefing_deliveries (trip_id TEXT PRIMARY KEY, email TEXT NOT NULL, status TEXT NOT NULL, error TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS early_bird_snapshots (route_key TEXT NOT NULL, snapshot_date TEXT NOT NULL, price INTEGER, PRIMARY KEY (route_key, snapshot_date));
CREATE TABLE IF NOT EXISTS route_retrospective_deliveries (trip_id TEXT PRIMARY KEY, email TEXT NOT NULL, status TEXT NOT NULL, error TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS stress_valve_deliveries (trip_id TEXT PRIMARY KEY, email TEXT NOT NULL, status TEXT NOT NULL, error TEXT, created_at TEXT DEFAULT (datetime('now')));

-- Four more tables, for features that are built but switched off (the Home card: ENABLE_HOME_CARD; plan reminders:
-- ENABLE_PLAN_REMINDERS). They do not exist in production yet because nothing has used them; their definitions are copied from
-- src/homeCard.js and src/planReminders.js, which still create them on first use. Applying this file to production
-- therefore creates these four EMPTY tables and nothing else.
CREATE TABLE IF NOT EXISTS home_cards (
    view_hash TEXT PRIMARY KEY,
    manage_hash TEXT NOT NULL,
    plan_id TEXT,
    leave_date TEXT NOT NULL,
    back_date TEXT NOT NULL,
    tasks_json TEXT NOT NULL,
    notes_json TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    removed_at TEXT,
    created_at TEXT NOT NULL
  );
CREATE TABLE IF NOT EXISTS away_plans (
       id TEXT PRIMARY KEY,
       email TEXT NOT NULL,
       destination TEXT NOT NULL,
       destination_country TEXT NOT NULL,
       leave_date TEXT NOT NULL,
       back_date TEXT NOT NULL,
       bucket TEXT,
       answers_json TEXT NOT NULL,
       created_at TEXT NOT NULL,
       pending_until TEXT NOT NULL,
       confirmed_at TEXT,
       stopped_at TEXT,
       delete_after TEXT NOT NULL,
       origin TEXT,
       set_sent_at TEXT
     );
CREATE TABLE IF NOT EXISTS away_plan_done (
       plan_id TEXT NOT NULL,
       rule_id TEXT NOT NULL,
       done_at TEXT NOT NULL,
       PRIMARY KEY (plan_id, rule_id)
     );
CREATE TABLE IF NOT EXISTS away_plan_reminders (
       plan_id TEXT NOT NULL,
       send_on TEXT NOT NULL,
       item_ids_json TEXT NOT NULL,
       status TEXT NOT NULL DEFAULT 'scheduled',
       attempts INTEGER NOT NULL DEFAULT 0,
       sent_at TEXT,
       PRIMARY KEY (plan_id, send_on)
     );
