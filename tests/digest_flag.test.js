// ENABLE_DAILY_DIGEST is the kill switch for the daily digest. Before it, the only way to stop a bad
// digest was to remove the cron entry and deploy. Only the exact string "false" turns it off, so a
// missing variable keeps today's behavior.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sendDailyAlerts } from '../src/index.js';

function spyDb() {
  const calls = [];
  const q = { first: async () => null, all: async () => ({ results: [] }), run: async () => ({ success: true }) };
  return { calls, prepare: (sql) => { calls.push(sql); return { ...q, bind: () => q }; } };
}

function spyFetch() {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => { calls.push(String(url)); return new Response('{}', { status: 200 }); };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

test('ENABLE_DAILY_DIGEST=false: nothing is sent, nothing is read or written, for both runs', async () => {
  for (const earlyOnly of [true, false]) {
    const db = spyDb();
    const net = spyFetch();
    try {
      const r = await sendDailyAlerts({ DB: db, RESEND_API_KEY: 'k', ENABLE_DAILY_DIGEST: 'false' }, { earlyOnly });
      assert.equal(r.sent, 0);
      assert.equal(r.skipped, 0);
      assert.match(r.reason, /disabled/);
      assert.deepEqual(db.calls, [], 'no table creation, no sunset pruning, no user query');
      assert.deepEqual(net.calls, [], 'no email and no data fetch');
    } finally { net.restore(); }
  }
});

test('anything other than the exact string "false" leaves the digest running', async () => {
  for (const value of [undefined, 'true', 'FALSE', '0', '', 'no']) {
    const db = spyDb();
    const r = await sendDailyAlerts({ DB: db, ...(value === undefined ? {} : { ENABLE_DAILY_DIGEST: value }) }, { earlyOnly: false });
    assert.doesNotMatch(String(r.reason || ''), /disabled/, `value ${JSON.stringify(value)}`);
    assert.ok(db.calls.length > 0, `value ${JSON.stringify(value)} should reach the database`);
  }
});

test('the flag does not touch the other lifecycle emails (they are separate jobs)', async () => {
  const src = fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
  const flagLines = src.split('\n').filter((l) => l.includes('ENABLE_DAILY_DIGEST'));
  assert.equal(flagLines.filter((l) => !l.trim().startsWith('//')).length, 1, 'read in exactly one place: the top of sendDailyAlerts');
});

test('wrangler.jsonc ships the flag on and says how to use it', () => {
  const cfg = fs.readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
  assert.match(cfg, /"ENABLE_DAILY_DIGEST":\s*"true"/);
});
