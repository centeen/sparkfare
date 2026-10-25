-- N9 (Addendum N, ROADMAP step 156): the curated store. One row per route and day (the cheapest fare seen that day, any pipeline),
-- built from the raw archive by scripts/data/curate.py. Nothing reads these tables yet (N10 builds the shadow ranking on them).
-- Route key format for every origin, JFK included: <ORIGIN>:<destination display name>.
-- Apply to production (additive) and record it in d1_migrations:
--   wrangler d1 execute sparkfare-db --remote --file=migrations/0036_curated_store.sql
CREATE TABLE IF NOT EXISTS fare_daily (
  route_key TEXT NOT NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  obs_date TEXT NOT NULL,          -- UTC calendar date, YYYY-MM-DD
  min_price REAL NOT NULL,         -- cheapest fare seen that day (Step 65: cheapest of the day wins)
  airline TEXT,                    -- of the cheapest fare; NULL when only a history-file price is known for the day
  departure_at TEXT,
  return_at TEXT,
  n_obs INTEGER NOT NULL DEFAULT 1, -- fetch runs that day with a usable fare (1 for a day known only from a history file)
  first_seen_at TEXT,              -- earliest fetch time that day, UTC, YYYY-MM-DDTHH:MM:SSZ
  last_run_id TEXT,                -- latest contributing run, YYYYMMDDTHHMMSSZ
  PRIMARY KEY (route_key, obs_date)
);
CREATE INDEX IF NOT EXISTS idx_fare_daily_obs_date ON fare_daily (obs_date);

CREATE TABLE IF NOT EXISTS route_verdict (
  route_key TEXT NOT NULL,
  verdict_date TEXT NOT NULL,
  median_price REAL,
  distinct_days INTEGER,
  pct_vs_median REAL,
  verdict TEXT,
  rule_version TEXT,
  PRIMARY KEY (route_key, verdict_date)
);
