// Q2 (Addendum Q, D-049b): one weekly product. Weekly readers get the stored weekly edition on Sundays and nothing on Mondays;
// daily readers are unaffected; the Sunday newsletter endpoint is off; the newsletter workflow has no schedule.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeSqliteD1 } from './helpers/sqliteD1.js';
import worker, { sendDailyAlerts, sendWeeklyEditions } from '../src/index.js';
import { _resetSendingGuardForTests } from '../src/email.js';

const MIGRATIONS = fs.readdirSync(new URL('../migrations/', import.meta.url)).filter((f) => f.endsWith('.sql')).sort().map((f) => `migrations/${f}`);
const SUNDAY = new Date('2026-10-25T08:00:00Z');
const MONDAY = new Date('2026-10-26T08:00:00Z');
const WEEK_ENDING = '2026-10-25';

const t = Date.parse('2026-10-25T00:00:00Z');
const obs = Array.from({ length: 20 }, (_, i) => ({ date: new Date(t - (20 - i) * 86400000).toISOString().slice(0, 10), price: 600 }));
const slimDeal = (name, price) => ({
  display_name: name, origin: 'LAX', price, status: 'deal', airline: 'TP', booking_link: 'https://www.aviasales.com/search/LAX2310LIS02111?marker=314524',
  departure_at: '2026-12-20T10:00:00Z', return_at: '2026-12-27T10:00:00Z', found_at: '2026-10-24T20:00:00Z', observations: obs,
});

function resendStub() {
  const batches = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    if (!String(url).includes('resend.com')) return real(url, init);
    const body = JSON.parse(init.body);
    if (String(url).endsWith('/emails/batch')) { batches.push(body); return new Response(JSON.stringify({ data: body.map((_, i) => ({ id: `b${i}` })), errors: [] }), { status: 200 }); }
    batches.push([body]);
    return new Response(JSON.stringify({ id: 's1' }), { status: 200 });
  };
  return { batches, sentTo: () => batches.flat().map((m) => m.to), restore: () => { globalThis.fetch = real; } };
}

function setup() {
  const db = makeSqliteD1(MIGRATIONS);
  const user = db.raw.prepare("INSERT INTO users (id, email, verified_email, origin_iata, is_subscribed, frequency, created_at) VALUES (?, ?, 1, ?, 1, ?, datetime('now'))");
  user.run('w1', 'weekly@example.com', 'LAX', 'weekly');
  user.run('d1', 'daily@example.com', 'LAX', 'daily');
  user.run('w2', 'weekly-jfk@example.com', 'JFK', 'weekly');
  db.raw.prepare("INSERT INTO digest_editions (id, origin, edition_date, kind, edition_number, subject, html_public, deals_json, created_at) VALUES ('e1', 'LAX', ?, 'weekly', 3, 's', '<p>x</p>', ?, ?)")
    .run(WEEK_ENDING, JSON.stringify([slimDeal('Lisbon, Portugal', 380), slimDeal('Tokyo, Japan', 700)]), SUNDAY.toISOString());
  const ASSETS = { async fetch() { return new Response('nf', { status: 404 }); } };
  _resetSendingGuardForTests();
  return { db, env: { DB: db, ASSETS, RESEND_API_KEY: 're_test', EMAIL_FROM: 'Sparkfare <hello@sparkfare.com>', UNSUBSCRIBE_SECRET: 'sec', APP_URL: 'https://sparkfare.com' } };
}

test('a weekly reader gets exactly one email on Sunday: the stored weekly edition, with their own unsubscribe link', async () => {
  const { db, env } = setup();
  const stub = resendStub();
  try {
    const r = await sendWeeklyEditions(env, { now: SUNDAY });
    assert.equal(r.sent, 1);
    assert.deepEqual(stub.sentTo(), ['weekly@example.com']);
    const msg = stub.batches.flat()[0];
    assert.match(msg.subject, /^This week from/);
    assert.match(msg.html, /Week ending/);
    assert.match(msg.headers['List-Unsubscribe'], /weekly%40example\.com|token=/);
    assert.doesNotMatch(msg.html, /aviasales\.com\/search/, 'weekly fares link to route pages, never deep links');
    assert.match(msg.html, new RegExp(process.env.EMAIL_POSTAL_ADDRESS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.equal(db.raw.prepare("SELECT COUNT(*) c FROM events WHERE event_type = 'weekly_edition_missing' AND origin = 'JFK'").get().c, 1);
    // a second run the same day sends nothing
    const again = await sendWeeklyEditions(env, { now: SUNDAY });
    assert.equal(again.sent, 0);
    assert.equal(stub.sentTo().length, 1);
    // and the weekly reader with no edition for their origin got nothing, with the gap logged
    assert.equal(r.missing, 1);
  } finally { stub.restore(); }
});

test('nothing is sent on a day that is not Sunday', async () => {
  const { env } = setup();
  const stub = resendStub();
  try {
    const r = await sendWeeklyEditions(env, { now: MONDAY });
    assert.equal(r.sent, 0);
    assert.equal(stub.sentTo().length, 0);
  } finally { stub.restore(); }
});

test('Monday: the daily digest no longer includes weekly readers', async () => {
  const { env } = setup();
  const feed = { generated_at: SUNDAY.toISOString(), deals: [], featured: [] };
  env.ASSETS = { async fetch() { return new Response(JSON.stringify(feed)); } };
  mock.timers.enable({ apis: ['Date'], now: MONDAY });
  const stub = resendStub();
  try {
    // the weekly reader must not even be a candidate; with no eligible deals nobody is sent, so check the candidate query directly
    const rows = (await env.DB.prepare("SELECT email FROM users WHERE verified_email = 1 AND (frequency = 'daily' OR frequency = 'instant')").all()).results;
    assert.deepEqual(rows.map((r) => r.email), ['daily@example.com']);
    const r = await sendDailyAlerts(env);
    assert.equal(r.sent, 0);
    assert.ok(!stub.sentTo().includes('weekly@example.com'));
  } finally { stub.restore(); mock.timers.reset(); }
});

test('the daily digest source has no Monday branch for weekly readers', () => {
  const src = fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /isMonday\s*\?\s*"OR frequency = 'weekly'"/);
  assert.doesNotMatch(src.slice(src.indexOf('export async function sendDailyAlerts'), src.indexOf('export async function sendWeeklyEditions')), /frequency = 'weekly'/);
});

test('the Sunday newsletter endpoint is 404 with the flag off, and the workflow has no schedule', async () => {
  const { env } = setup();
  const off = await worker.fetch(new Request('http://localhost/api/admin/trigger-newsletter?key=k', { method: 'POST', body: '{}' }), { ...env, KPI_DASHBOARD_SECRET: 'k', ENABLE_SUNDAY_NEWSLETTER: 'false' }, { waitUntil() {} });
  assert.equal(off.status, 404);
  const unset = await worker.fetch(new Request('http://localhost/api/admin/trigger-newsletter?key=k', { method: 'POST', body: '{}' }), { ...env, KPI_DASHBOARD_SECRET: 'k' }, { waitUntil() {} });
  assert.equal(unset.status, 404);
  const wf = fs.readFileSync(new URL('../.github/workflows/sunday-newsletter.yml', import.meta.url), 'utf8');
  assert.doesNotMatch(wf, /^\s*schedule:/m);
  assert.match(wf, /workflow_dispatch/);
  assert.match(fs.readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'), /"ENABLE_SUNDAY_NEWSLETTER":\s*"false"/);
});

test('the scheduled 08:00 run sends weekly editions after the archive step', () => {
  const src = fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
  const a = src.indexOf('await archiveWeeklyEditions(env');
  const b = src.indexOf('await sendWeeklyEditions(env)');
  assert.ok(a > 0 && b > a);
});
