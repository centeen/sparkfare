-- Migration 0020: Pre-departure Away Mode sequence (ROADMAP step 28, T2b of antigravity_build_plan.md).
-- Tracks email deliveries for the multi-touch pre-departure sequence at day-14, day-7, and day-1 before departure.

CREATE TABLE IF NOT EXISTS pre_departure_sequence_deliveries (
  trip_id TEXT NOT NULL,
  stage INTEGER NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL, -- 'pending', 'sent', 'failed'
  error TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (trip_id, stage)
);

CREATE INDEX IF NOT EXISTS idx_pre_dep_seq_email ON pre_departure_sequence_deliveries(email);

-- Rollback: DROP TABLE IF EXISTS pre_departure_sequence_deliveries;
