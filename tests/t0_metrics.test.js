import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { computeKPIs, logEvent } from '../src/index.js';

// Minimal mock environment
const createMockEnv = () => {
  const dbRows = [];
  return {
    ADMIN_SECRET: 'test-secret',
    DB: {
      prepare: (sql) => ({
        bind: (...args) => ({
          first: async () => ({ value: 10 }), // Mock scalar results
          all: async () => ({
            results: sql.includes('events') ? [
              { week: '2026-38', signups: 5, emails_sent: 100, email_opens: 50, email_clicks: 10 }
            ] : []
          }),
          run: async () => {
            dbRows.push({ sql, args });
            return { success: true };
          }
        }),
        first: async () => ({ value: 10 }),
        all: async () => ({
          results: sql.includes('events') ? [
            { week: '2026-38', signups: 5, emails_sent: 100, email_opens: 50, email_clicks: 10 }
          ] : []
        })
      }),
      _rows: dbRows
    }
  };
};

test('T0: /admin/metrics rejects unauthenticated requests', async () => {
  const env = createMockEnv();
  const request = new Request('https://sparkfare.com/admin/metrics');
  const response = await worker.fetch(request, env, {});
  assert.equal(response.status, 401);
});

test('T0: /admin/metrics accepts correct secret and returns rollups', async () => {
  const env = createMockEnv();
  const request = new Request('https://sparkfare.com/admin/metrics?secret=test-secret');
  const response = await worker.fetch(request, env, {});
  
  assert.equal(response.status, 200);
  const data = await response.json();
  console.log("Returned data:", data);
  
  assert.equal(data.viral.total_users, 10);
  assert.equal(data.weekly_events[0].signups, 5);
  assert.equal(data.weekly_events[0].email_opens, 50);
});

test('T0: logEvent correctly inserts into events table', async () => {
  const env = createMockEnv();
  await logEvent(env, {
    event_type: 'widget_impression',
    source: 'example.com',
    meta: { partner: 'demo' }
  });
  
  assert.equal(env.DB._rows.length, 1);
  const { sql, args } = env.DB._rows[0];
  assert.match(sql, /INSERT INTO events/);
  assert.equal(args[0], 'widget_impression');
  assert.equal(args[1], null); // user_id
  assert.equal(args[6], null); // sub_id
  assert.equal(args[7], 'example.com'); // source
  assert.equal(args[8], JSON.stringify({ partner: 'demo' })); // meta
});
