// /departing/:trip_id is the page every signed-in "Book this fare" click lands on before the
// redirect to Aviasales. Its template referenced `${adHtml}`, a variable that only exists inside
// renderRoutePage(), so every request threw a ReferenceError (Cloudflare error 1101) from
// 2026-09-23 until this fix. No test ever requested the route, which is how it went unnoticed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

const ctx = { waitUntil: () => {} };
const TARGET = 'https://www.aviasales.com/search/JFK1011LCA1?marker=314524.abc';

test('/departing/:id renders (no ReferenceError) with the disclosure and the redirect script', async () => {
  const res = await worker.fetch(
    new Request(`https://sparkfare.com/departing/abc123?url=${encodeURIComponent(TARGET)}`),
    {},
    ctx
  );
  assert.equal(res.status, 200);
  assert.match(res.headers.get('Content-Type'), /text\/html/);
  const html = await res.text();
  assert.match(html, /Taking you to your fare/);
  assert.match(html, /Next stop:/);
  assert.match(html, /class="affiliate-disclosure"/);
  assert.match(html, /new URLSearchParams\(location\.search\)\.get\('url'\)/);
  assert.ok(!html.includes('undefined'), 'no stray "undefined" interpolated into the page');
});

test('/departing/:id still renders when the trip lookup fails', async () => {
  const env = { DB: { prepare: () => { throw new Error('d1 down'); } } };
  const res = await worker.fetch(new Request('https://sparkfare.com/departing/abc123'), env, ctx);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Next stop: your destination/);
});
