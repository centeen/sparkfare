import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as email from '../src/email.js';
import { verifyUnsubscribeToken } from '../src/postClickEmail.js';
import worker from '../src/index.js';

const SECRET = 'test-unsub-secret';
const BASE = { RESEND_API_KEY: 'k', APP_URL: 'https://sparkfare.com', EMAIL_FROM: 'Sparkfare <hello@sparkfare.com>', EMAIL_POSTAL_ADDRESS: '1 Test Way' };

function stubResend() {
  const sent = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes('resend.com')) {
      const body = JSON.parse(options.body);
      (Array.isArray(body) ? body : [body]).forEach((b) => sent.push(b));
      return new Response(JSON.stringify({ data: { id: 'id' }, error: null }), { status: 200 });
    }
    return original(url, options);
  };
  return { sent, restore: () => { globalThis.fetch = original; } };
}

const tokenIn = (s) => new URL(s.match(/https:\/\/sparkfare\.com\/api\/unsubscribe\?[^"'<>\s)]+/)[0].replace(/&amp;/g, '&')).searchParams.get('token');

test('buildUnsubscribeUrl signs when the secret is set and falls back to the legacy link without it', async () => {
  const signed = await email.buildUnsubscribeUrl({ APP_URL: 'https://sparkfare.com', UNSUBSCRIBE_SECRET: SECRET }, 'a+b@example.com');
  assert.ok(!signed.includes('email='), signed);
  assert.equal(await verifyUnsubscribeToken(new URL(signed).searchParams.get('token'), SECRET), 'a+b@example.com');
  const legacy = await email.buildUnsubscribeUrl({ APP_URL: 'https://sparkfare.com' }, 'a@example.com');
  assert.equal(legacy, 'https://sparkfare.com/api/unsubscribe?email=a%40example.com');
});

test('the daily digest (v1 and v2) puts a signed link in the body and the one-click header', async () => {
  for (const flag of ['false', 'true']) {
    const { sent, restore } = stubResend();
    try {
      await email.sendDailyDealEmail({ email: 'sub@example.com', origin: 'JFK', deals: [{ display_name: 'Lisbon, Portugal', price: 475, booking_link: 'https://www.aviasales.com/search/JFK1103LIS1110?marker=314524' }], userId: 'u1' },
        { ...BASE, UNSUBSCRIBE_SECRET: SECRET, ENABLE_EMAIL_V2: flag });
    } finally { restore(); }
    const m = sent[0];
    assert.doesNotMatch(m.html, /api\/unsubscribe\?email=/, `body, v2=${flag}`);
    assert.equal(await verifyUnsubscribeToken(tokenIn(m.html), SECRET), 'sub@example.com');
    assert.doesNotMatch(m.headers['List-Unsubscribe'], /email=/);
    assert.equal(await verifyUnsubscribeToken(tokenIn(m.headers['List-Unsubscribe']), SECRET), 'sub@example.com');
    assert.equal(m.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  }
});

test('lifecycle emails carry a signed link, never the raw address', async () => {
  const { sent, restore } = stubResend();
  const env = { ...BASE, UNSUBSCRIBE_SECRET: SECRET };
  try {
    await email.sendSunsetEmail({ email: 'sub@example.com' }, env);
    await email.sendTargetReachedEmail({ email: 'sub@example.com', origin: 'JFK', destination: 'Lisbon, Portugal', price: 400, targetPrice: 450, bookingLink: 'https://www.aviasales.com/x?marker=1' }, env);
    await email.sendRouteRetrospectiveEmail({ email: 'sub@example.com', origin: 'JFK', destination: 'Lisbon, Portugal', tripPrice: 500, todayAvg: 600 }, env).catch(() => {});
  } finally { restore(); }
  assert.ok(sent.length >= 2, `sent ${sent.length}`);
  for (const m of sent) {
    assert.doesNotMatch(m.html, /api\/unsubscribe\?email=/, m.subject);
    assert.doesNotMatch(m.headers['List-Unsubscribe'], /email=/, m.subject);
  }
});

test('without the secret, sends still carry a working legacy link (no email breaks)', async () => {
  const { sent, restore } = stubResend();
  try { await email.sendSunsetEmail({ email: 'sub@example.com' }, BASE); } finally { restore(); }
  assert.match(sent[0].html, /api\/unsubscribe\?email=sub%40example\.com/);
});

test('a signed link GET only shows a confirm page; the legacy route still works for emails already sent', async () => {
  const token = await email.buildUnsubscribeUrl({ APP_URL: 'https://sparkfare.com', UNSUBSCRIBE_SECRET: SECRET }, 'sub@example.com').then((u) => new URL(u).searchParams.get('token'));
  let writes = 0;
  const DB = { prepare: () => ({ bind: () => ({ run: async () => { writes++; return { success: true }; }, first: async () => null }), run: async () => { writes++; return { success: true }; } }) };
  const res = await worker.fetch(new Request('https://sparkfare.com/api/unsubscribe?token=' + encodeURIComponent(token)), { DB, UNSUBSCRIBE_SECRET: SECRET }, { waitUntil() {} });
  assert.equal(res.status, 200);
  assert.equal(writes, 0, 'a GET with a token must not change state');
  const legacy = await worker.fetch(new Request('https://sparkfare.com/api/unsubscribe?email=old%40example.com'), { DB }, { waitUntil() {} });
  assert.equal(legacy.status, 200);
  assert.ok(writes > 0, 'legacy GET still unsubscribes');
});
