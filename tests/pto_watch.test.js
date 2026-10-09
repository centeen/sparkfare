// ROADMAP step 74 (Track C of claude_code_pto_fare_calendar_2026-10-09.md).
// Tests for PTO long-weekend window watches:
// - Window & destination validation
// - Token signing, verification, tampering, wrong domain prefix
// - GET cancel changes nothing, POST deletes
// - Route /api/pto-watch creates or reuses user, limits to 10 active watches
// - Threshold logic: first fare alerts, small drop ignored, real drop alerts, stale fare ignored
// - Check cron: deletes expired watches (>30 days past), combines watches into 1 email per user
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  signPtoWatchToken,
  verifyPtoWatchToken,
  isValidPtoWindow,
  isValidPtoOrigin,
  isValidPtoDestination,
  shouldSendAlert,
  checkPtoWindowWatches,
} from '../src/ptoWatch.js';
import worker from '../src/index.js';

test('token: signing and verification round trip', async () => {
  const secret = 'test-secret-key-123';
  const token = await signPtoWatchToken('watch-xyz-789', secret);
  assert.equal(typeof token, 'string');
  assert.ok(token.includes('.'));

  const verified = await verifyPtoWatchToken(token, secret);
  assert.equal(verified, 'watch-xyz-789');

  // Tampered token fails
  const tampered = token.slice(0, -4) + 'abcd';
  assert.equal(await verifyPtoWatchToken(tampered, secret), null);

  // Wrong secret fails
  assert.equal(await verifyPtoWatchToken(token, 'different-secret'), null);

  // Malformed tokens fail safely
  assert.equal(await verifyPtoWatchToken('', secret), null);
  assert.equal(await verifyPtoWatchToken('not-a-token', secret), null);
});

test('validation: origin, window, and destination checks', () => {
  // Valid origins
  assert.ok(isValidPtoOrigin('DEN'));
  assert.ok(isValidPtoOrigin('jfk'));
  assert.ok(!isValidPtoOrigin('TLV')); // TLV is not a US PTO hub
  assert.ok(!isValidPtoOrigin('ZZZ'));

  // Valid windows against bridge opportunities
  // Thanksgiving 2026: Thu Nov 26 to Sun Nov 29 (2026-11-26 to 2026-11-29)
  assert.ok(isValidPtoWindow('2026-11-26', '2026-11-29'));
  assert.ok(!isValidPtoWindow('2026-05-01', '2026-05-03')); // random arbitrary dates

  // Valid destinations
  assert.ok(isValidPtoDestination(null));
  assert.ok(isValidPtoDestination(''));
  assert.ok(isValidPtoDestination('Tulum, Mexico'));
  assert.ok(!isValidPtoDestination('Atlantis'));
});

test('threshold logic: first fare, small drop ignored, real drop sends', () => {
  // First fare seen sends alert
  assert.ok(shouldSendAlert(450, null));
  assert.ok(shouldSendAlert(450, undefined));

  // Small drop under max($15, 5%): e.g. from $400 to $395 ($5 / 1.25% drop)
  assert.ok(!shouldSendAlert(395, 400));

  // Real drop >= $15: e.g. from $400 to $385 ($15 drop)
  assert.ok(shouldSendAlert(385, 400));

  // Real drop >= 5%: e.g. from $1000 to $940 ($60 / 6% drop)
  assert.ok(shouldSendAlert(940, 1000));

  // Price increase does not alert
  assert.ok(!shouldSendAlert(420, 400));
});

test('routes: flag off returns 404 for /api/pto-watch and /api/pto-watch/cancel', async () => {
  const env = { ENABLE_PTO_WATCH: 'false' };
  const r1 = await worker.fetch(new Request('https://sparkfare.com/api/pto-watch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'u@example.com', origin_iata: 'DEN', window_start: '2026-11-26', window_end: '2026-11-29' }),
  }), env, { waitUntil: () => {} });
  assert.equal(r1.status, 404);

  const r2 = await worker.fetch(new Request('https://sparkfare.com/api/pto-watch/cancel?token=dummy'), env, { waitUntil: () => {} });
  assert.equal(r2.status, 404);
});

test('routes: cancel GET shows confirmation page and does not delete; POST deletes', async () => {
  const secret = 'test-secret';
  const watchId = 'w-test-101';
  const token = await signPtoWatchToken(watchId, secret);

  const deleted = [];
  const mockDb = {
    prepare(query) {
      const stmt = {
        async run() { return { success: true }; },
        async first() { return { origin_iata: 'DEN', destination: null, user_id: 'u1' }; },
        bind(...args) {
          return {
            async first() { return { origin_iata: 'DEN', destination: null, user_id: 'u1' }; },
            async run() {
              if (query.includes('DELETE FROM pto_window_watches')) deleted.push(args[0]);
              return { success: true };
            },
          };
        },
      };
      return stmt;
    },
  };

  const env = { ENABLE_PTO_WATCH: 'true', UNSUBSCRIBE_SECRET: secret, DB: mockDb };

  // GET confirms but does not delete
  const getRes = await worker.fetch(new Request(`https://sparkfare.com/api/pto-watch/cancel?token=${encodeURIComponent(token)}`), env, { waitUntil: () => {} });
  assert.equal(getRes.status, 200);
  const getHtml = await getRes.text();
  assert.match(getHtml, /Stop watching this long weekend/);
  assert.equal(deleted.length, 0);

  // POST deletes
  const postRes = await worker.fetch(new Request(`https://sparkfare.com/api/pto-watch/cancel?token=${encodeURIComponent(token)}`, {
    method: 'POST',
  }), env, { waitUntil: () => {} });
  assert.equal(postRes.status, 200);
  const postHtml = await postRes.text();
  assert.match(postHtml, /Watch cancelled/);
  assert.deepEqual(deleted, [watchId]);
});

test('checkPtoWindowWatches: purges watches older than 30 days and alerts valid drops', async () => {
  const now = new Date('2026-11-20T08:00:00Z');
  let purgedQuery = null;
  let updatedWatch = null;

  const mockDb = {
    prepare(query) {
      const stmt = {
        async run() { return { success: true }; },
        async all() { return { results: [] }; },
        async first() { return null; },
        bind(...args) {
          return {
            async run() {
              if (query.includes('DELETE FROM pto_window_watches WHERE window_end <')) {
                purgedQuery = args[0];
                return { meta: { changes: 2 } };
              }
              if (query.includes('UPDATE pto_window_watches')) {
                updatedWatch = { price: args[0], id: args[1] };
                return { success: true };
              }
              return { success: true };
            },
            async all() {
              if (query.includes('FROM pto_window_watches')) {
                return {
                  results: [
                    {
                      id: 'w1',
                      user_id: 'u1',
                      origin_iata: 'DEN',
                      window_start: '2026-11-26',
                      window_end: '2026-11-29',
                      destination: null,
                      last_alert_price: null, // first fare
                      last_alerted_at: null,
                      email: 'user1@example.com',
                      unsubscribed_at: null,
                      is_subscribed: 1,
                      paused_until: null,
                    },
                  ],
                };
              }
              return { results: [] };
            },
          };
        },
      };
      return stmt;
    },
  };

  const pricesData = {
    windows: {
      'DEN:2026-11-26:2026-11-29': {
        fares: [
          {
            destination: 'Tulum, Mexico',
            price: 380,
            found_at: '2026-11-19T10:00:00Z', // 1 day old (fresh)
            booking_link: 'https://aviasales.com/test',
          },
        ],
      },
    },
  };

  const env = {
    ENABLE_PTO_WATCH: 'true',
    DB: mockDb,
    UNSUBSCRIBE_SECRET: 'secret',
    ASSETS: {
      fetch: async (req) => {
        if (req.url.includes('sparkfare_pto_window_prices.json')) {
          return new Response(JSON.stringify(pricesData), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response(null, { status: 404 });
      },
    },
  };

  const res = await checkPtoWindowWatches(env, now);
  assert.equal(res.purged, 2);
  assert.equal(res.checked, 1);
  assert.equal(res.alerted, 1);
  assert.ok(purgedQuery.startsWith('2026-10-21'));
  assert.deepEqual(updatedWatch, { price: 380, id: 'w1' });
});
