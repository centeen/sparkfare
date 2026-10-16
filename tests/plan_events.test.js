import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { DatabaseSync } from 'node:sqlite';
import worker from '../src/index.js';
import { planEventMeta, planClickMeta, CLIENT_PLAN_EVENTS, SERVER_PLAN_EVENTS, PLAN_SOURCE } from '../src/planEvents.js';
import { bucketForDays, buildLeaveByPlan, LEAVE_BY_RULES, COUNTRY_NAMES } from '../src/data/leaveByRules.js';

// Addendum G task G6 (ROADMAP step 92): the plan's events, the partner-click tags, the privacy wording and the metrics query.

const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const ctx = { waitUntil: () => {} };
const req = (path, init) => new Request('https://sparkfare.com' + path, init);
const HUMAN = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36' };
const BANNED = /\b(book|booking|booked|secured?|protect(ing|ion|s)?|safe(ly|ty)?|vetted|guarantee[ds]?|hurry|last chance|countdown)\b|don't miss/i;

function makeDb() {
  const raw = new DatabaseSync(':memory:');
  const stmt = (sql, p) => ({
    run: async () => { raw.prepare(sql).run(...p); return { success: true }; },
    first: async () => raw.prepare(sql).get(...p) ?? null,
    all: async () => ({ results: raw.prepare(sql).all(...p) }),
  });
  return { raw, prepare: (sql) => ({ ...stmt(sql, []), bind: (...p) => stmt(sql, p) }) };
}
const events = (db, type) => db.raw.prepare('SELECT * FROM events WHERE event_type = ? ORDER BY ts, rowid').all(type).map((r) => ({ ...r, meta: JSON.parse(r.meta || '{}') }));
const send = (env, body, headers = HUMAN) =>
  worker.fetch(req('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }), env, ctx);

test('the six plan events have fixed shapes: unknown fields are dropped and nothing typed is ever copied', () => {
  assert.deepEqual(planEventMeta('plan_start', { src: 'home', date: '2026-12-20', note: 'x' }), { src: 'home' });
  assert.deepEqual(planEventMeta('plan_start', { src: '<script>' }), { src: 'other' });
  assert.deepEqual(planEventMeta('plan_start', null), { src: 'other' });
  assert.deepEqual(planEventMeta('plan_complete', { country: 'TH', trip_length_bucket: '7-10', items_shown: 9, departureDate: '2026-12-20', expiry: '2027-04', answers: { pet_home: 'yes' } }),
    { country: 'TH', trip_length_bucket: '7-10', items_shown: 9 });
  assert.deepEqual(planEventMeta('item_done', { rule_id: 'usps-hold-mail', country: 'JP', trip_length_bucket: '11-14', text: 'free text' }),
    { rule_id: 'usps-hold-mail', country: 'JP', trip_length_bucket: '11-14' });
  assert.deepEqual(planEventMeta('away_mode_view', { anything: 1 }), {});
  assert.deepEqual(planEventMeta('reminder_optin', { trip_length_bucket: '2+ weeks', email: 'a@b.co' }), { trip_length_bucket: '2+ weeks' });
  assert.deepEqual(planEventMeta('homecard_created', { tasks_bucket: '4-9', token: 'abc' }), { tasks_bucket: '4-9' });
  assert.deepEqual(planEventMeta('homecard_open', { token: 'abc', ip: '1.2.3.4' }), {}, 'a count only: no token, no address');
});

test('events that do not fit are refused; numbers are clamped; values off their lists become null', () => {
  assert.equal(planEventMeta('plan_complete', { country: 'ZZ', items_shown: 3 }), null, 'unknown country');
  assert.equal(planEventMeta('plan_complete', { country: '2026-12-20' }), null, 'a date is not a country');
  assert.equal(planEventMeta('item_done', { rule_id: 'not-a-rule', country: 'JP' }), null);
  assert.equal(planEventMeta('item_done', { rule_id: 'usps-hold-mail', country: 'XX' }), null);
  assert.equal(planEventMeta('nonsense', {}), null);
  assert.equal(planEventMeta('plan_complete', { country: 'JP', items_shown: 9999 }).items_shown, 60);
  assert.equal(planEventMeta('plan_complete', { country: 'JP', items_shown: -4 }).items_shown, 0);
  assert.equal(planEventMeta('plan_complete', { country: 'JP', items_shown: 'abc' }).items_shown, null);
  assert.equal(planEventMeta('plan_complete', { country: 'JP', items_shown: 3, trip_length_bucket: '2026-12-20' }).trip_length_bucket, null);
  assert.equal(planEventMeta('homecard_created', { tasks_bucket: '17' }).tasks_bucket, null);
  for (const c of Object.keys(COUNTRY_NAMES)) assert.ok(planEventMeta('plan_complete', { country: c }), c);
  assert.equal(planEventMeta('plan_complete', { country: '__proto__' }), null);
  assert.equal(planEventMeta('plan_complete', { country: 'constructor' }), null);
});

test('trip length maps to the same buckets used everywhere else', () => {
  const at = (d) => bucketForDays(d);
  assert.deepEqual([2, 3, 4, 6, 7, 10, 11, 14, 15, 29, 30, 90].map(at), ['weekend', 'weekend', '4-6', '4-6', '7-10', '7-10', '11-14', '11-14', '2+ weeks', '2+ weeks', '30_plus', '30_plus']);
  const p = buildLeaveByPlan({ destination: 'Tokyo, Japan', today: '2026-10-16', departureDate: '2026-12-01', returnDate: '2026-12-09' });
  assert.equal(p.bucket, '7-10');
});

test('POST /api/events: flag off logs none of the plan events', async () => {
  const db = makeDb();
  const env = { DB: db, ENABLE_LEAVE_BY_PLAN: 'false' };
  for (const t of CLIENT_PLAN_EVENTS) await send(env, { event_type: t, meta: { country: 'JP', src: 'nav', rule_id: 'usps-hold-mail' } });
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'events'").get().n === 0 || db.raw.prepare('SELECT COUNT(*) AS n FROM events').get().n === 0, true);
});

test('POST /api/events: flag on logs the client events with their fixed meta, source "away-plan" and the visitor class', async () => {
  const db = makeDb();
  const env = { DB: db, ENABLE_LEAVE_BY_PLAN: 'true' };
  const dirty = { country: 'TH', trip_length_bucket: '7-10', items_shown: 9, departureDate: '2026-12-20', passportExpiry: '2027-04', answers: { pet_home: 'yes' }, note: 'my own words' };
  const r = await send(env, { event_type: 'plan_complete', user_id: 'u1', origin: 'JFK', route: '/plan?x', sub_id: 'zzz', meta: dirty });
  assert.equal(r.status, 200);
  await send(env, { event_type: 'plan_start', meta: { src: 'nav' } });
  await send(env, { event_type: 'item_done', meta: { rule_id: 'step', country: 'TH', trip_length_bucket: '7-10' } });
  await send(env, { event_type: 'away_mode_view', meta: {} });
  const done = events(db, 'plan_complete');
  assert.equal(done.length, 1);
  assert.equal(done[0].source, PLAN_SOURCE);
  assert.deepEqual(done[0].meta, { country: 'TH', trip_length_bucket: '7-10', items_shown: 9, ua_class: 'human' });
  for (const col of ['user_id', 'anon_id', 'origin', 'route', 'partner', 'sub_id']) assert.equal(done[0][col], null, `${col} is never taken from the request`);
  assert.doesNotMatch(JSON.stringify(done[0]), /2026-12-20|2027-04|my own words|pet_home/);
  assert.deepEqual(events(db, 'plan_start')[0].meta, { src: 'nav', ua_class: 'human' });
  assert.deepEqual(events(db, 'item_done')[0].meta, { rule_id: 'step', country: 'TH', trip_length_bucket: '7-10', ua_class: 'human' });
  assert.deepEqual(events(db, 'away_mode_view')[0].meta, { ua_class: 'human' });
  const bot = await send(env, { event_type: 'plan_start', meta: { src: 'home' } }, { 'User-Agent': 'Googlebot/2.1' });
  assert.equal(bot.status, 200);
  assert.equal(events(db, 'plan_start').at(-1).meta.ua_class, 'bot');
});

test('POST /api/events: events that do not fit are not logged, and a browser can never send the server-only events', async () => {
  const db = makeDb();
  const env = { DB: db, ENABLE_LEAVE_BY_PLAN: 'true' };
  await send(env, { event_type: 'plan_complete', meta: { country: '2026-12-20' } });
  await send(env, { event_type: 'item_done', meta: { rule_id: 'made-up', country: 'JP' } });
  for (const t of SERVER_PLAN_EVENTS) {
    const r = await send(env, { event_type: t, meta: { trip_length_bucket: '7-10', tasks_bucket: '1-3' } });
    assert.equal(r.status, 200);
  }
  const hasTable = db.raw.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'events'").get().n === 1;
  const n = hasTable ? db.raw.prepare("SELECT COUNT(*) AS n FROM events WHERE event_type IN ('plan_complete','item_done','reminder_optin','homecard_created','homecard_open')").get().n : 0;
  assert.equal(n, 0);
  assert.deepEqual(CLIENT_PLAN_EVENTS.filter((t) => SERVER_PLAN_EVENTS.includes(t)), []);
});

test('partner clicks from the plan record the rule and the bucket, and only tokens from the lists', () => {
  assert.deepEqual(planClickMeta(new URLSearchParams('src=away-plan&rule=destination-phone-data&bucket=11-14')), { rule_id: 'destination-phone-data', trip_length_bucket: '11-14' });
  assert.deepEqual(planClickMeta(new URLSearchParams('src=away-plan&rule=nope&bucket=2026-12-20')), { rule_id: null, trip_length_bucket: null });
  assert.deepEqual(planClickMeta(new URLSearchParams('src=away_mode&rule=destination-phone-data&bucket=11-14')), {});
  assert.deepEqual(planClickMeta(new URLSearchParams('')), {});
});

test('GET /out/<partner>?src=away-plan: logs the click with the rule and bucket, and still redirects', async () => {
  const db = makeDb();
  const env = { DB: db, ENABLE_LEAVE_BY_PLAN: 'true', ENABLE_METER_TRACKING: 'true' };
  const res = await worker.fetch(req('/out/yesim?src=away-plan&rule=destination-phone-data&bucket=11-14&departure=2026-12-20', { headers: HUMAN }), env, ctx);
  assert.equal(res.status, 302);
  const click = events(db, 'outbound_click')[0];
  assert.equal(click.partner, 'yesim');
  assert.equal(click.source, 'away-plan');
  assert.equal(click.meta.rule_id, 'destination-phone-data');
  assert.equal(click.meta.trip_length_bucket, '11-14');
  assert.equal(click.meta.ua_class, 'human');
  assert.doesNotMatch(JSON.stringify(click), /2026-12-20/, 'an extra parameter with a date is ignored');
  // an unknown rule or bucket is dropped to null, and the redirect is unaffected
  const odd = await worker.fetch(req('/out/yesim?src=away-plan&rule=%3Cscript%3E&bucket=soon', { headers: HUMAN }), env, ctx);
  assert.equal(odd.status, 302);
  const last = events(db, 'outbound_click').at(-1);
  assert.equal(last.meta.rule_id, null);
  assert.equal(last.meta.trip_length_bucket, null);
});

test('GET /out with the plan flag off records no plan fields', async () => {
  const db = makeDb();
  const env = { DB: db, ENABLE_LEAVE_BY_PLAN: 'false' };
  await worker.fetch(req('/out/yesim?src=away-plan&rule=destination-phone-data&bucket=11-14', { headers: HUMAN }), env, ctx);
  const click = events(db, 'outbound_click')[0];
  assert.equal(click.meta.rule_id, undefined);
  assert.equal(click.meta.trip_length_bucket, undefined);
});

test('the plan page sends exactly the fixed fields, and its partner links carry the source, rule and bucket', () => {
  const page = read('plan.html');
  const calls = [...page.matchAll(/track\('(\w+)', (\{[^}]*\})\)/g)].map((m) => [m[1], m[2].replace(/\s+/g, ' ')]);
  assert.deepEqual(calls, [
    ['plan_start', "{ src: ['nav', 'home', 'away-mode', 'route'].includes(fromParam) ? fromParam : 'other' }"],
    ['item_done', '{ rule_id: it.id, country: lastCountry, trip_length_bucket: lastBucket }'],
    ['plan_complete', '{ country: plan.country, trip_length_bucket: plan.bucket, items_shown: items.length }'],
  ]);
  for (const [, body] of calls) assert.doesNotMatch(body, /leave|back|expiry|exp-|date|answer|passport|dest/i, body);
  assert.match(page, /body: JSON\.stringify\(\{ event_type: type, meta: meta \}\)/);
  assert.match(page, /'&bucket=' \+ encodeURIComponent\(lastBucket \|\| ''\)/);
  assert.match(page, /<label class="item-done"|el\('label', 'item-done'\)/);
  assert.doesNotMatch(page, /localStorage|sessionStorage|document\.cookie/);
});

test('the entry script counts a visit to /away-mode only while the plan is on, with nothing in it', async () => {
  const run = (pathname, status) => {
    const calls = [];
    const nav = { querySelector: () => null, appendChild() {}, insertBefore() {} };
    const sandbox = {
      document: { querySelector: () => nav, querySelectorAll: () => [], createElement: () => ({}) },
      location: { pathname },
      sessionStorage: { getItem: () => null, setItem() {} },
      fetch: async (url, opts) => { calls.push([url, opts && opts.body]); return { ok: status !== 404, json: async () => ({ enabled: status === 200 }) }; },
      Date, JSON, Promise, Boolean,
    };
    vm.createContext(sandbox);
    vm.runInContext(read('plan-entry.js'), sandbox);
    return new Promise((r) => setTimeout(() => r(calls), 20));
  };
  const on = await run('/away-mode', 200);
  assert.deepEqual(on.map((c) => c[0]), ['/api/leave-by-plan/status', '/api/events']);
  assert.equal(on[1][1], JSON.stringify({ event_type: 'away_mode_view', meta: {} }));
  assert.deepEqual((await run('/', 200)).map((c) => c[0]), ['/api/leave-by-plan/status'], 'other pages count nothing');
  assert.deepEqual((await run('/away-mode', 404)).map((c) => c[0]), ['/api/leave-by-plan/status'], 'flag off counts nothing');
});

test('the metrics query gives clicks per 100 completions by bucket and clicks per 100 views, leaving bots out', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE events (id INTEGER PRIMARY KEY, event_type TEXT, source TEXT, meta TEXT, ts TEXT)');
  const add = (type, source, meta, ts = '2026-11-10 12:00:00') => db.prepare('INSERT INTO events (event_type, source, meta, ts) VALUES (?, ?, ?, ?)').run(type, source, JSON.stringify(meta), ts);
  for (let i = 0; i < 20; i++) add('plan_complete', 'away-plan', { country: 'JP', trip_length_bucket: '7-10', ua_class: 'human' });
  for (let i = 0; i < 10; i++) add('plan_complete', 'away-plan', { country: 'JP', trip_length_bucket: '2+ weeks', ua_class: 'human' });
  add('plan_complete', 'away-plan', { country: 'JP', trip_length_bucket: '7-10', ua_class: 'bot' });
  add('plan_complete', 'away-plan', { country: 'JP', trip_length_bucket: '7-10', ua_class: 'human' }, '2026-10-01 00:00:00');
  for (let i = 0; i < 5; i++) add('outbound_click', 'away-plan', { trip_length_bucket: '7-10', rule_id: 'step', ua_class: 'human' });
  for (let i = 0; i < 6; i++) add('outbound_click', 'away-plan', { trip_length_bucket: '2+ weeks', rule_id: 'idp', ua_class: 'human' });
  add('outbound_click', 'away-plan', { trip_length_bucket: '7-10', ua_class: 'bot' });
  for (let i = 0; i < 200; i++) add('away_mode_view', 'away-plan', { ua_class: 'human' });
  add('away_mode_view', 'away-plan', { ua_class: 'bot' });
  for (let i = 0; i < 14; i++) add('outbound_click', 'away_mode', { ua_class: 'human' });
  const sql = read('docs/away_plan_metrics.sql');
  const rows = db.prepare(sql).all({ from: '2026-11-09' });
  const by = Object.fromEntries(rows.map((r) => [r.bucket, r]));
  assert.equal(by['7-10'].completions, 20);
  assert.equal(by['7-10'].plan_clicks, 5);
  assert.equal(by['7-10'].plan_clicks_per_100_completions, 25);
  assert.equal(by['2+ weeks'].completions, 10);
  assert.equal(by['2+ weeks'].plan_clicks_per_100_completions, 60);
  assert.equal(by['7-10'].away_mode_views, 200);
  assert.equal(by['7-10'].away_mode_clicks, 14);
  assert.equal(by['7-10'].away_clicks_per_100_views, 7);
  assert.equal(rows.length, 2);
  assert.match(sql, /Read-only|read-only/);
  assert.doesNotMatch(sql, /\b(INSERT|UPDATE|DELETE|DROP|ALTER)\b/i);
});

test('the privacy page says what the plan logs and what it never sends, and its date is current', () => {
  const html = read('privacy.html');
  assert.match(html, /<strong>The leave-by plan and the passport check\.<\/strong>/);
  assert.match(html, /your plan is worked out in your own browser/);
  assert.match(html, /dates you enter, your answers to its questions and your passport's expiry month and year are not sent to us, saved, or put in a link/);
  assert.match(html, /We never ask for a passport number\./);
  assert.match(html, /We also count visits to Away Mode/);
  assert.match(html, /Last updated: October 16, 2026\./);
  const para = html.match(/<strong>The leave-by plan and the passport check\.<\/strong>[\s\S]*?<\/p>/)[0].replace(/<[^>]+>/g, ' ');
  assert.doesNotMatch(para, BANNED);
  assert.doesNotMatch(para, /Home card/i, 'only what exists is described; the Home card gets its own sentences when it ships (G9)');
  assert.match(para, /If you ask for reminders, we then store your email, the dates of your trip and your answers/);
  assert.match(para, /a plan you do not confirm is deleted after a week/);
  assert.match(para, /30 days after your trip ends/);
});
