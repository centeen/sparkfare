// The manual trigger routes run real batch jobs and send real email, so they require ADMIN_SECRET
// as a Bearer header. They used to be open to anyone: POST /api/send-daily-alert would mail the
// daily template to any address a stranger supplied.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import worker from '../src/index.js';

const SECRET = 'correct-horse-battery-staple';
const ROUTES = [
  'send-daily-alert',
  'reconcile-bookings',
  'check-revenue-health',
  'check-affiliate-link-health',
  'send-departing-soon-alerts',
  'send-stress-valve-alerts',
  'send-departure-briefing-alerts',
  'send-route-retrospectives',
  'send-daily-x-post',
];

// A fetch that records every outbound call, so "401" can be shown to mean "nothing happened".
function withFetchSpy() {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push(String(url));
    return new Response(JSON.stringify({ data: { id: 'x' }, error: null, results: [] }), { status: 200 });
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

function post(route, { headers = {}, query = '', body } = {}, env = {}) {
  const req = new Request(`https://sparkfare.com/api/${route}${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ?? JSON.stringify({ email: 'victim@example.com', origin: 'JFK', deals: [] }),
  });
  return worker.fetch(req, env, { waitUntil: () => {} });
}

for (const route of ROUTES) {
  test(`/api/${route}: no credentials is 401 and does no work`, async () => {
    const spy = withFetchSpy();
    try {
      const res = await post(route, {}, { ADMIN_SECRET: SECRET, RESEND_API_KEY: 'k', TRAVELPAYOUTS_TOKEN: 't' });
      assert.equal(res.status, 401);
      assert.deepEqual(await res.json(), { ok: false, error: 'Unauthorized' });
      assert.deepEqual(spy.calls, [], 'an unauthorized call must not reach Resend, Travelpayouts or any partner');
    } finally { spy.restore(); }
  });

  test(`/api/${route}: wrong secret, ?secret= in the URL and a bare Bearer are all 401`, async () => {
    const env = { ADMIN_SECRET: SECRET };
    assert.equal((await post(route, { headers: { Authorization: 'Bearer nope' } }, env)).status, 401);
    assert.equal((await post(route, { headers: { Authorization: `Bearer ${SECRET}x` } }, env)).status, 401);
    assert.equal((await post(route, { headers: { Authorization: SECRET } }, env)).status, 401);
    assert.equal((await post(route, { query: `?secret=${SECRET}` }, env)).status, 401, 'a secret in the URL is not accepted');
  });

  test(`/api/${route}: fails closed when ADMIN_SECRET is not configured`, async () => {
    for (const authorization of [undefined, 'Bearer ', 'Bearer undefined', 'Bearer null', 'Bearer ']) {
      const headers = authorization === undefined ? {} : { Authorization: authorization };
      assert.equal((await post(route, { headers }, {})).status, 401, `Authorization: ${authorization}`);
    }
  });

  test(`/api/${route}: the right Bearer secret reaches the handler`, async () => {
    const res = await post(route, { headers: { Authorization: `Bearer ${SECRET}` } }, { ADMIN_SECRET: SECRET });
    assert.notEqual(res.status, 401);
    assert.notEqual(res.status, 404);
  });
}

test('an unauthorized send-daily-alert never mails the supplied address', async () => {
  const spy = withFetchSpy();
  try {
    await post('send-daily-alert', {}, { ADMIN_SECRET: SECRET, RESEND_API_KEY: 'real-looking-key' });
    assert.ok(!spy.calls.some((u) => u.includes('resend.com')));
    // and the authorized call does go out, so the check above is not vacuous
    await post('send-daily-alert', { headers: { Authorization: `Bearer ${SECRET}` } }, { ADMIN_SECRET: SECRET, RESEND_API_KEY: 'real-looking-key' });
    assert.ok(spy.calls.some((u) => u.includes('resend.com')));
  } finally { spy.restore(); }
});

test('routes that must stay public still work without the admin secret', async () => {
  const env = { ADMIN_SECRET: SECRET };
  const beacon = await worker.fetch(new Request('https://sparkfare.com/api/events', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event_type: 'x' }),
  }), env, { waitUntil: () => {} });
  assert.notEqual(beacon.status, 401);
  const health = await worker.fetch(new Request('https://sparkfare.com/api/health'), env, { waitUntil: () => {} });
  assert.notEqual(health.status, 401);
});

test('every unauthenticated trigger route is listed here, so a new one cannot be added open', () => {
  const src = fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
  const gated = [...src.matchAll(/pathname === '\/api\/([a-z-]+)' && request\.method === 'POST'\) \{\r?\n\s+const denied = requireAdmin/g)].map((m) => m[1]).sort();
  assert.deepEqual(gated, [...ROUTES].sort());
  // Any other /api/send-*, /api/check-* or reconcile route that is not gated would be a new open trigger.
  const all = [...src.matchAll(/pathname === '\/api\/((?:send|reconcile|check)-?[a-z-]*)' && request\.method === 'POST'/g)].map((m) => m[1]);
  const open = all.filter((r) => !ROUTES.includes(r) && r !== 'check/share');
  assert.deepEqual(open, [], `ungated trigger routes: ${open.join(', ')}`);
});
