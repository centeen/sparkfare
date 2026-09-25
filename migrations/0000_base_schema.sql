-- B3 (2026-09-25): the `users` table predates any migration tooling in this project -- it was
-- created directly against production back when this project started, and every migration from
-- 0001 onward assumes it already exists (they ALTER it, never CREATE it). Without this file,
-- `wrangler d1 migrations apply` fails immediately on a genuinely fresh database with
-- "no such table: users", confirmed via `wrangler d1 migrations apply --local` against an empty
-- local D1. CREATE TABLE IF NOT EXISTS makes this a safe no-op against production, where the
-- table already exists -- deliberately only the ORIGINAL columns (matching CLAUDE.md's very
-- first documented schema), not the full accumulated set, so 0001-0006's own ALTER TABLE
-- statements can still run afterward to build up the rest in their original order, exactly as
-- they were designed to.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  verified_email INTEGER DEFAULT 0,
  origin_iata TEXT,
  pet_owner INTEGER,
  trip_length TEXT,
  subscription_tier TEXT DEFAULT 'free',
  created_at TEXT DEFAULT (datetime('now')),
  unsubscribed_at TEXT
);
