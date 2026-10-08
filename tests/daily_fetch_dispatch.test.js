import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import worker, { dispatchDailyFetch } from '../src/index.js';

const cronsInWrangler = () => {
  const txt = fs.readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
  return JSON.parse(txt.match(/"crons":\s*(\[[^\]]*\])/)[1]);
};

test('wrangler registers the dispatch cron alongside the existing ones', () => {
  assert.deepEqual(cronsInWrangler(), ['30 3 * * *', '0 7 * * *', '0 8 * * *', '0 9 * * 1']);
});

test('dispatch posts to the daily-fetch workflow with the token and ref main', async () => {
  let call;
  const r = await dispatchDailyFetch({ GITHUB_DISPATCH_TOKEN: 't0k' }, async (url, init) => {
    call = { url, init };
    return new Response(null, { status: 204 });
  });
  assert.equal(r.ok, true);
  assert.match(call.url, /repos\/centeen\/sparkfare\/actions\/workflows\/daily-fetch\.yml\/dispatches$/);
  assert.equal(call.init.method, 'POST');
  assert.equal(call.init.headers.Authorization, 'Bearer t0k');
  assert.deepEqual(JSON.parse(call.init.body), { ref: 'main' });
});

test('missing token or a non-204 answer is reported, not thrown', async () => {
  assert.equal((await dispatchDailyFetch({}, async () => { throw new Error('no call'); })).skipped, true);
  const r = await dispatchDailyFetch({ GITHUB_DISPATCH_TOKEN: 'x' }, async () => new Response('nope', { status: 401 }));
  assert.deepEqual(r, { ok: false, status: 401 });
});

test('the 03:30 trigger only dispatches: no digest, no database work', async () => {
  const orig = globalThis.fetch;
  let hits = 0;
  globalThis.fetch = async () => { hits++; return new Response(null, { status: 204 }); };
  try {
    const DB = { prepare() { throw new Error('DB must not be touched'); } };
    await worker.scheduled({ cron: '30 3 * * *' }, { DB, GITHUB_DISPATCH_TOKEN: 'x' });
    assert.equal(hits, 1);
  } finally { globalThis.fetch = orig; }
});
