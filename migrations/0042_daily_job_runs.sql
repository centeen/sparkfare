-- Q7: one row per once-a-day job per UTC day, so the hourly trigger runs them once. The Worker also creates the table on first use.
CREATE TABLE IF NOT EXISTS daily_job_runs (
  job TEXT NOT NULL,
  run_date TEXT NOT NULL,
  ran_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (job, run_date)
);
