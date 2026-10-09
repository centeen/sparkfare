// ROADMAP step 28 (T2b: Automated pre-departure Away Mode sequence).
// Tests:
// - Flag-gating (skips if disabled or DB missing)
// - Accurate stage offsets (14, 7, 1) and skipping non-matching offsets
// - Idempotency (does not double-fire when already marked sent)
// - Respects unsubscriptions, pauses, email_suppressions, and self-reported 'not_going' trips
// - Sourced from live partner registry, rotating partners across stages (excluding previously sent partners)
// - Admin routes (/api/send-pre-departure-sequence-alerts) & KPI reporting
// - Migration 0020 verification and rollback
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker, { sendPreDepartureSequenceAlerts, computeKPIs } from '../src/index.js';
import { sendPreDepartureSequenceEmail } from '../src/email.js';

function createD1Mock(db) {
  return {
    raw: db,
    prepare(query) {
      return {
        bind(...args) {
          return {
            async first() {
              const stmt = db.prepare(query);
              return stmt.get(...args) || null;
            },
            async all() {
              const stmt = db.prepare(query);
              return { results: stmt.all(...args) || [] };
            },
            async run() {
              const stmt = db.prepare(query);
              const info = stmt.run(...args);
              return { success: true, meta: { changes: info.changes } };
            }
          };
        },
        async first() {
          const stmt = db.prepare(query);
          return stmt.get() || null;
        },
        async all() {
          const stmt = db.prepare(query);
          return { results: stmt.all() || [] };
        },
        async run() {
          const stmt = db.prepare(query);
          const info = stmt.run();
          return { success: true, meta: { changes: info.changes } };
        }
      };
    }
  };
}

function setupTestDatabase() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      is_subscribed INTEGER DEFAULT 1,
      unsubscribed_at TEXT,
      paused_until TEXT,
      trip_length TEXT,
      passenger_count INTEGER DEFAULT 1,
      partner_id TEXT,
      verified_email INTEGER DEFAULT 1,
      early_access INTEGER DEFAULT 0,
      referred_by TEXT
    );

    CREATE TABLE trips (
      trip_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      destination TEXT NOT NULL,
      departure_at TEXT NOT NULL,
      return_at TEXT,
      status TEXT DEFAULT 'clicked',
      booking_self_report TEXT,
      self_reported_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE partners (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'live',
      priority INTEGER DEFAULT 10,
      trip_length_match TEXT,
      category TEXT,
      description TEXT,
      url_template TEXT,
      commission_note TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE away_mode_email_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      partner_id TEXT,
      email_type TEXT NOT NULL,
      sent_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE email_suppressions (
      email TEXT PRIMARY KEY,
      reason TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE pre_departure_sequence_deliveries (
      trip_id TEXT NOT NULL,
      stage INTEGER NOT NULL,
      email TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (trip_id, stage)
    );

    CREATE TABLE events (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      user_id TEXT,
      anon_id TEXT,
      origin TEXT,
      route TEXT,
      partner TEXT,
      sub_id TEXT,
      source TEXT,
      meta TEXT,
      ts TEXT DEFAULT (datetime('now'))
    );
  `);

  // Insert live partners
  db.exec(`
    INSERT INTO partners (id, slug, name, status, priority, category, url_template, commission_note) VALUES
      ('p1', 'the-parking-spot', 'The Parking Spot', 'live', 1, 'parking', 'https://example.com/parking', 'Save on airport parking'),
      ('p2', 'airalo', 'Airalo eSIM', 'live', 2, 'esim', 'https://example.com/airalo', 'Stay connected anywhere'),
      ('p3', 'safetywing', 'SafetyWing Travel Insurance', 'live', 3, 'insurance', 'https://example.com/safetywing', 'Global travel medical insurance'),
      ('p4', 'inactive-partner', 'Inactive Partner', 'inactive', 4, 'other', 'https://example.com/inactive', 'Inactive blurb');
  `);

  return db;
}

test('T2b: skips if ENABLE_T2B_SEQUENCE is disabled or DB not configured', async () => {
  const res1 = await sendPreDepartureSequenceAlerts({ ENABLE_T2B_SEQUENCE: 'false' });
  assert.equal(res1.reason, 'T2b sequence flag disabled');
  assert.equal(res1.sent, 0);

  const res2 = await sendPreDepartureSequenceAlerts({ ENABLE_T2B_SEQUENCE: 'true' });
  assert.equal(res2.reason, 'DB not configured');
  assert.equal(res2.sent, 0);
});

test('T2b: fires at stage 14, 7, and 1, skipping other day offsets', async () => {
  const db = setupTestDatabase();
  const d1 = createD1Mock(db);

  db.exec(`
    INSERT INTO users (id, email) VALUES
      ('u14', 'u14@example.com'),
      ('u7', 'u7@example.com'),
      ('u1', 'u1@example.com'),
      ('u2', 'u2@example.com'),
      ('u15', 'u15@example.com');

    INSERT INTO trips (trip_id, user_id, destination, departure_at) VALUES
      ('t14', 'u14', 'Cancun', '2026-10-15T10:00:00Z'), -- 14 days out
      ('t7',  'u7',  'London', '2026-10-08T10:00:00Z'), -- 7 days out
      ('t1',  'u1',  'Tokyo',  '2026-10-02T10:00:00Z'), -- 1 day out
      ('t2',  'u2',  'Paris',  '2026-10-03T10:00:00Z'), -- 2 days out (skipped)
      ('t15', 'u15', 'Rome',   '2026-10-16T10:00:00Z'); -- 15 days out (skipped)
  `);

  const originalNow = Date.now;
  Date.now = () => new Date('2026-10-01T10:00:00Z').getTime();

  try {
    const env = { DB: d1, ENABLE_T2B_SEQUENCE: 'true' };
    const res = await sendPreDepartureSequenceAlerts(env);

    assert.equal(res.sent, 3, 'Sent for 14, 7, and 1 days');
    assert.equal(res.skipped, 2, 'Skipped 2 days and 15 days');

    const deliveries = JSON.parse(JSON.stringify(db.prepare('SELECT trip_id, stage, status FROM pre_departure_sequence_deliveries ORDER BY stage DESC').all()));
    assert.deepEqual(deliveries, [
      { trip_id: 't14', stage: 14, status: 'sent' },
      { trip_id: 't7',  stage: 7,  status: 'sent' },
      { trip_id: 't1',  stage: 1,  status: 'sent' }
    ]);

    const events = db.prepare("SELECT event_type, route, meta FROM events WHERE event_type = 'away_mode_sequence_sent'").all();
    assert.equal(events.length, 3);
  } finally {
    Date.now = originalNow;
  }
});

test('T2b: idempotency prevents double-firing for the same trip and stage', async () => {
  const db = setupTestDatabase();
  const d1 = createD1Mock(db);

  db.exec(`
    INSERT INTO users (id, email) VALUES ('u1', 'u1@example.com');
    INSERT INTO trips (trip_id, user_id, destination, departure_at) VALUES
      ('t1', 'u1', 'Cancun', '2026-10-15T12:00:00Z');
    -- Pre-mark stage 14 as sent
    INSERT INTO pre_departure_sequence_deliveries (trip_id, stage, email, status) VALUES
      ('t1', 14, 'u1@example.com', 'sent');
  `);

  const originalNow = Date.now;
  Date.now = () => new Date('2026-10-01T12:00:00Z').getTime();

  try {
    const env = { DB: d1, ENABLE_T2B_SEQUENCE: 'true' };
    const res = await sendPreDepartureSequenceAlerts(env);

    assert.equal(res.sent, 0, 'Did not re-send stage 14');
    assert.equal(res.skipped, 1, 'Skipped already-sent stage');
  } finally {
    Date.now = originalNow;
  }
});

test('T2b: respects unsubscriptions, pauses, suppressions, and self-reported not_going trips', async () => {
  const db = setupTestDatabase();
  const d1 = createD1Mock(db);

  db.exec(`
    INSERT INTO users (id, email, unsubscribed_at, paused_until) VALUES
      ('u_unsub', 'unsub@example.com', '2026-09-01T00:00:00Z', NULL),
      ('u_paused', 'paused@example.com', NULL, '2026-11-01T00:00:00Z'),
      ('u_suppressed', 'suppressed@example.com', NULL, NULL),
      ('u_not_going', 'notgoing@example.com', NULL, NULL),
      ('u_active', 'active@example.com', NULL, NULL);

    INSERT INTO email_suppressions (email, reason) VALUES
      ('suppressed@example.com', 'bounced');

    INSERT INTO trips (trip_id, user_id, destination, departure_at, booking_self_report) VALUES
      ('t_unsub',      'u_unsub',      'Cancun', '2026-10-15T10:00:00Z', NULL),
      ('t_paused',     'u_paused',     'Cancun', '2026-10-15T10:00:00Z', NULL),
      ('t_suppressed', 'u_suppressed', 'Cancun', '2026-10-15T10:00:00Z', NULL),
      ('t_not_going',  'u_not_going',  'Cancun', '2026-10-15T10:00:00Z', 'not_going'),
      ('t_active',     'u_active',     'Cancun', '2026-10-15T10:00:00Z', NULL);
  `);

  const originalNow = Date.now;
  Date.now = () => new Date('2026-10-01T10:00:00Z').getTime();

  try {
    const env = { DB: d1, ENABLE_T2B_SEQUENCE: 'true' };
    const res = await sendPreDepartureSequenceAlerts(env);

    assert.equal(res.sent, 1, 'Only active user received alert');
    const sent = JSON.parse(JSON.stringify(db.prepare("SELECT trip_id, email FROM pre_departure_sequence_deliveries WHERE status = 'sent'").all()));
    assert.deepEqual(sent, [{ trip_id: 't_active', email: 'active@example.com' }]);
  } finally {
    Date.now = originalNow;
  }
});

test('T2b: partner rotation surfaces different live partners across stages', async () => {
  const db = setupTestDatabase();
  const d1 = createD1Mock(db);

  db.exec(`
    INSERT INTO users (id, email) VALUES ('u1', 'traveller@example.com');
    INSERT INTO trips (trip_id, user_id, destination, departure_at) VALUES
      ('trip_seq', 'u1', 'Madrid', '2026-10-15T00:00:00Z');
  `);

  const originalNow = Date.now;
  const env = { DB: d1, ENABLE_T2B_SEQUENCE: 'true' };

  try {
    // Stage 14 (14 days before Oct 15: Oct 1)
    Date.now = () => new Date('2026-10-01T00:00:00Z').getTime();
    const res14 = await sendPreDepartureSequenceAlerts(env);
    assert.equal(res14.sent, 1);
    const log14 = db.prepare("SELECT partner_id FROM away_mode_email_log WHERE email = 'traveller@example.com'").all();
    assert.equal(log14.length, 1);
    const partner1 = log14[0].partner_id;
    assert.equal(partner1, 'the-parking-spot'); // highest priority live partner

    // Stage 7 (7 days before Oct 15: Oct 8)
    Date.now = () => new Date('2026-10-08T00:00:00Z').getTime();
    const res7 = await sendPreDepartureSequenceAlerts(env);
    assert.equal(res7.sent, 1);
    const log7 = db.prepare("SELECT partner_id FROM away_mode_email_log WHERE email = 'traveller@example.com'").all();
    assert.equal(log7.length, 2);
    const partner2 = log7[1].partner_id;
    assert.notEqual(partner2, partner1, 'Stage 7 surfaces different partner');
    assert.equal(partner2, 'airalo');

    // Stage 1 (1 day before Oct 15: Oct 14)
    Date.now = () => new Date('2026-10-14T00:00:00Z').getTime();
    const res1 = await sendPreDepartureSequenceAlerts(env);
    assert.equal(res1.sent, 1);
    const log1 = db.prepare("SELECT partner_id FROM away_mode_email_log WHERE email = 'traveller@example.com'").all();
    assert.equal(log1.length, 3);
    const partner3 = log1[2].partner_id;
    assert.notEqual(partner3, partner1);
    assert.notEqual(partner3, partner2);
    assert.equal(partner3, 'safetywing');
  } finally {
    Date.now = originalNow;
  }
});

test('T2b: admin trigger endpoints and KPI reporting', async () => {
  const db = setupTestDatabase();
  const d1 = createD1Mock(db);

  db.exec(`
    INSERT INTO users (id, email) VALUES ('u1', 'adm@example.com');
    INSERT INTO trips (trip_id, user_id, destination, departure_at) VALUES
      ('t1', 'u1', 'Denver', '2026-10-15T00:00:00Z');
  `);

  const env = { DB: d1, ENABLE_T2B_SEQUENCE: 'true', ADMIN_SECRET: 'supersecret' };

  // Trigger POST without auth fails 401
  const unauth = await worker.fetch(new Request('https://sparkfare.com/api/send-pre-departure-sequence-alerts', { method: 'POST' }), env);
  assert.equal(unauth.status, 401);

  // Trigger POST with auth succeeds 200
  const authReq = new Request('https://sparkfare.com/api/send-pre-departure-sequence-alerts', {
    method: 'POST',
    headers: { Authorization: 'Bearer supersecret' }
  });
  const originalNow = Date.now;
  Date.now = () => new Date('2026-10-01T00:00:00Z').getTime();

  try {
    const authRes = await worker.fetch(authReq, env);
    assert.equal(authRes.status, 200);
    const json = await authRes.json();
    assert.equal(json.sent, 1);

    // Compute KPIs includes away_mode_sequence
    const kpis = await computeKPIs(env);
    assert.ok(kpis.away_mode_sequence);
    assert.equal(kpis.away_mode_sequence.total_sent, 1);
    assert.equal(kpis.away_mode_sequence.stages.length, 1);
    assert.equal(kpis.away_mode_sequence.stages[0].stage, 14);
    assert.equal(kpis.away_mode_sequence.stages[0].sent, 1);
  } finally {
    Date.now = originalNow;
  }
});

test('Migration 0020: creates table cleanly with rollback note', () => {
  const nums = readdirSync(new URL('../migrations/', import.meta.url)).map((f) => f.slice(0, 4));
  assert.equal(nums.filter((n) => n === '0020').length, 1);

  const sql = readFileSync(new URL('../migrations/0020_pre_departure_sequence.sql', import.meta.url), 'utf8');
  assert.match(sql, /Rollback:/);

  const base = readFileSync(new URL('../migrations/0000_base_schema.sql', import.meta.url), 'utf8');
  const db = new DatabaseSync(':memory:');
  db.exec(base);
  db.exec(sql);

  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((r) => r.name);
  assert.ok(tables.includes('pre_departure_sequence_deliveries'));

  // Test rollback
  db.exec('DROP TABLE IF EXISTS pre_departure_sequence_deliveries');
  const afterTables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((r) => r.name);
  assert.ok(!afterTables.includes('pre_departure_sequence_deliveries'));
});
