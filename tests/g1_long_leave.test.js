// G1 (Task C): Long Leave mode. Real migrations on in-memory SQLite, as in the F0 tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { makeSqliteD1 } from './helpers/sqliteD1.js';
import worker from '../src/index.js';
import {
  longLeaveEnabled, normalizeTripLength, buildLongLeaveLead, tripLengthFromLeaveLength, leaveLengthFromTripLength,
  USPS_HOLD_MAX_DAYS, LONG_LEAVE_TOKEN,
} from '../src/longLeave.js';
import { buildLeaveReadyPlan, tripLengthForSignup } from '../src/leaveReady.js';
import { prioritizePartners } from '../src/email.js';
import { computeRevenueReport } from '../src/meters.js';

const MIGRATIONS = fs.readdirSync(new URL('../migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort().map((f) => `migrations/${f}`);
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const UA = { 'User-Agent': 'Mozilla/5.0 (iPhone) AppleWebKit Safari' };

async function call(path, env, { method = 'GET', body, headers = {} } = {}) {
  const pending = [];
  const res = await worker.fetch(new Request(`https://sparkfare.com${path}`, {
    method, redirect: 'manual', headers: { ...UA, 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined,
  }), env, { waitUntil: (p) => pending.push(p) });
  await Promise.all(pending);
  return res;
}
const env = (DB, extra = {}) => ({ DB, ENABLE_LEAVE_READY: 'true', ...extra });
const ON = { ENABLE_LONG_LEAVE: 'true' };
const eventTypes = (DB) => DB.raw.prepare("SELECT event_type FROM events WHERE event_type LIKE 'leave_%' ORDER BY event_type").all().map((r) => r.event_type);
const plan = (e, answers, extra = {}) => call('/api/leave/plan', e, { method: 'POST', body: { answers, ...extra } }).then((r) => r.json());
const ANSWERS = (length, extra = {}) => ({ length, pets: 'no', plants: 'no', checkin: 'yes', mail: 'no', water: 'no', ...extra });

// ---------- flag OFF: the site behaves as today ----------

test('flag off: the flag, the token and /api/long-leave are all inert', async () => {
  assert.match(read('wrangler.jsonc'), /"ENABLE_LONG_LEAVE":\s*"false"/);
  assert.equal(longLeaveEnabled({}), false);
  assert.equal(longLeaveEnabled({ ENABLE_LONG_LEAVE: 'TRUE' }), false, 'only the exact string "true"');
  assert.equal(normalizeTripLength('30_plus', {}), '2+ weeks', 'cannot be stored while off');
  for (const v of ['weekend', '4-6', '7-10', '11-14', '2+ weeks', undefined]) assert.equal(normalizeTripLength(v, {}), v);
  const { DB } = { DB: makeSqliteD1(MIGRATIONS) };
  assert.deepEqual(await (await call('/api/long-leave', env(DB))).json(), { enabled: false });
});

test('flag off: /leave returns the plan it always did and logs none of the new events', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  const body = await plan(env(DB), ANSWERS('month_plus'));
  assert.equal(body.ok, true);
  assert.equal('lead' in body.plan, false, 'no lead section');
  const keys = [...body.plan.open, ...body.plan.done].map((i) => i.key);
  assert.ok(keys.includes('mail') && keys.includes('water'), 'the standard mail and water entries are still there');
  const types = eventTypes(DB);
  for (const t of ['leave_trip_length', 'leave_long_branch_shown', 'leave_completed', 'leave_started']) assert.ok(!types.includes(t), `${t} is not logged`);
  assert.ok(types.includes('leave_result_view'), 'the existing events still fire');
});

test('flag off: /api/events ignores the new client events', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  await call('/api/events', env(DB), { method: 'POST', body: { event_type: 'leave_started', meta: { trip_length_bucket: '30_plus', user_known: true } } });
  assert.ok(!eventTypes(DB).includes('leave_started'));
});

test('flag off: the signup pages offer no 30+ option, and long-leave.js adds nothing', async () => {
  for (const page of ['index.html', 'widget.html', 'account.html']) assert.doesNotMatch(read(page), /<option value="30_plus"/, page);
  const added = [];
  const sandbox = {
    document: { querySelectorAll: () => [{ querySelector: () => null, appendChild: (o) => added.push(o) }], createElement: () => ({}) },
    fetch: async () => ({ ok: true, json: async () => ({ enabled: false }) }),
    window: {},
  };
  vm.runInNewContext(read('long-leave.js'), sandbox);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(added.length, 0);
});

// ---------- flag ON ----------

test('flag on: 30_plus is saved by signup and read back; the account page adds the option for a saved 30_plus', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  const e = env(DB, ON);
  const res = await call('/api/signup', e, { method: 'POST', body: { id: 'local_a', email: 'long@example.com', origin_iata: 'JFK', trip_length: '30_plus' } });
  assert.equal(res.status, 200);
  assert.equal(DB.raw.prepare("SELECT trip_length AS t FROM users WHERE email = 'long@example.com'").get().t, '30_plus');
  // the same request with the flag off is stored as 2+ weeks
  await call('/api/signup', env(DB), { method: 'POST', body: { id: 'local_b', email: 'off@example.com', origin_iata: 'JFK', trip_length: '30_plus' } });
  assert.equal(DB.raw.prepare("SELECT trip_length AS t FROM users WHERE email = 'off@example.com'").get().t, '2+ weeks');
  // an existing user keeps their bucket
  await call('/api/signup', e, { method: 'POST', body: { id: 'local_c', email: 'keep@example.com', origin_iata: 'JFK', trip_length: '11-14' } });
  assert.equal(DB.raw.prepare("SELECT trip_length AS t FROM users WHERE email = 'keep@example.com'").get().t, '11-14');
  // account page: setting the select from saved preferences adds the option first
  const select = { options: [], value: '', querySelector: () => null, appendChild(o) { this.options.push(o.value); } };
  const sandbox = {
    document: { querySelectorAll: () => [], createElement: () => ({}) },
    fetch: async () => ({ ok: true, json: async () => ({ enabled: true, lead: [] }) }),
    window: {},
  };
  vm.runInNewContext(read('long-leave.js'), sandbox);
  sandbox.window.sparkfareLongLeave.ensureTripLength(select, '30_plus');
  assert.deepEqual(select.options, ['30_plus']);
  assert.equal(select.value, '30_plus');
});

test('flag on: for fare search and alerts 30_plus behaves exactly like 2+ weeks', () => {
  const partners = [{ slug: 'bounce' }, { slug: 'us-global-mail' }, { slug: 'airhelp' }];
  assert.deepEqual(prioritizePartners(partners, '30_plus'), prioritizePartners(partners, '2+ weeks'));
  assert.equal(prioritizePartners(partners, '30_plus')[0].slug, 'us-global-mail');
  assert.equal(tripLengthForSignup('month_plus'), '2+ weeks');
  assert.equal(tripLengthForSignup('month_plus', { longLeave: true }), '30_plus');
  assert.equal(LONG_LEAVE_TOKEN, '30_plus');
  assert.equal(tripLengthFromLeaveLength('month_plus'), '30_plus');
  assert.equal(tripLengthFromLeaveLength('one_two_weeks'), null, 'ambiguous answers never overwrite a saved value');
  assert.equal(leaveLengthFromTripLength('2+ weeks'), null, 'a saved 2+ weeks does not skip the question');
});

test('flag on: the lead shows mail, then the vacancy question, then water, for 30_plus only; the rest follows', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  const e = env(DB, ON);
  const long = (await plan(e, ANSWERS('month_plus'))).plan;
  assert.deepEqual(long.lead.map((i) => i.key), ['mail', 'vacancy', 'water']);
  const rest = [...long.open, ...long.done].map((i) => i.key);
  assert.ok(!rest.includes('mail') && !rest.includes('water'), 'mail and water are not repeated in the standard checklist');
  assert.ok(rest.includes('checkin'), 'the usual checklist follows');
  for (const length of ['weekend', 'one_two_weeks', 'skip']) {
    const p = (await plan(e, ANSWERS(length))).plan;
    assert.equal('lead' in p, false, `no lead for ${length}`);
  }
  assert.match(long.summary, /^4 things left to sort$|^\d+ things left to sort$/);
});

test('flag on: the insurance item has no link; the only partner link is US Global Mail through /out with src=leave_long', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  const lead = (await plan(env(DB, ON), ANSWERS('month_plus'))).plan.lead;
  const vacancy = lead.find((i) => i.key === 'vacancy');
  assert.deepEqual(vacancy.links, []);
  assert.equal(vacancy.action, 'Many homeowner policies change coverage if a home is unoccupied for a set period. Ask your insurer what their rule is before you go.');
  assert.deepEqual(lead.find((i) => i.key === 'water').links, []);
  const sponsored = lead.flatMap((i) => i.links).filter((l) => l.sponsored);
  assert.equal(sponsored.length, 1);
  assert.equal(sponsored[0].href, '/out/us-global-mail?src=leave_long');
  const all = JSON.stringify(lead);
  assert.doesNotMatch(all, /safetywing|world nomads|worldnomads|policy number|buy insurance/i, 'no insurance product, partner or link');
  // and it really goes through /out and is logged with that src
  const out = await call('/out/us-global-mail?src=leave_long', env(DB, ON));
  assert.equal(out.status, 302);
  assert.equal(out.headers.get('Location'), 'https://www.usglobalmail.com/?via=coby');
  const row = DB.raw.prepare("SELECT source FROM events WHERE event_type = 'outbound_click' AND partner = 'us-global-mail'").get();
  assert.equal(row.source, 'leave_long');
});

test('the mail item states the USPS hold limit that was checked on usps.com', () => {
  assert.equal(USPS_HOLD_MAX_DAYS, 30);
  const mail = buildLongLeaveLead([]).find((i) => i.key === 'mail');
  assert.match(mail.action, /up to 30 days/);
  assert.ok(mail.links.some((l) => l.href === 'https://www.usps.com/manage/hold-mail.htm'));
  assert.equal(mail.links.filter((l) => l.sponsored).length, 0, 'no partner link unless the partner is live');
});

test('flag on: the events fire with the right fields and are bot-classified', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  const e = env(DB, ON);
  await plan(e, ANSWERS('month_plus'), { asked: true });
  const meta = (type) => JSON.parse(DB.raw.prepare('SELECT meta FROM events WHERE event_type = ?').get(type).meta);
  assert.deepEqual(meta('leave_trip_length'), { bucket: 'month_plus', trip_length_bucket: '30_plus', asked: true, ua_class: 'human' });
  assert.deepEqual(meta('leave_long_branch_shown'), { surface: 'leave', ua_class: 'human' });
  assert.deepEqual(meta('leave_completed'), { bucket: 'month_plus', trip_length_bucket: '30_plus', ua_class: 'human' });
  // a plan that did not ask (saved length) says so; a non-long plan shows no branch
  await plan(e, ANSWERS('weekend'), { asked: false });
  const rows = DB.raw.prepare("SELECT meta FROM events WHERE event_type = 'leave_trip_length' ORDER BY rowid").all().map((r) => JSON.parse(r.meta));
  assert.equal(rows[1].asked, false);
  assert.equal(DB.raw.prepare("SELECT count(*) AS n FROM events WHERE event_type = 'leave_long_branch_shown'").get().n, 1);
  // a crawler is labelled
  await call('/api/leave/plan', env(makeSqliteD1(MIGRATIONS), ON), { method: 'POST', body: { answers: ANSWERS('month_plus') }, headers: { 'User-Agent': 'Googlebot/2.1' } });
});

test('flag on: client events keep a fixed meta shape (no free text), with the bot class set by the server', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  const e = env(DB, ON);
  await call('/api/events', e, { method: 'POST', body: { event_type: 'leave_started', meta: { trip_length_bucket: '30_plus', user_known: true, email: 'x@example.com', free: 'text' } } });
  await call('/api/events', e, { method: 'POST', body: { event_type: 'leave_started', meta: { trip_length_bucket: 'banana', user_known: 'yes' } } });
  await call('/api/events', e, { method: 'POST', body: { event_type: 'leave_long_branch_shown', meta: { surface: 'away_mode', other: 1 } } });
  const m = DB.raw.prepare("SELECT event_type, meta FROM events WHERE event_type LIKE 'leave_%' ORDER BY rowid").all().map((r) => [r.event_type, JSON.parse(r.meta)]);
  assert.deepEqual(m[0], ['leave_started', { ua_class: 'human', trip_length_bucket: '30_plus', user_known: true }]);
  assert.deepEqual(m[1], ['leave_started', { ua_class: 'human', trip_length_bucket: null, user_known: false }]);
  assert.deepEqual(m[2], ['leave_long_branch_shown', { ua_class: 'human', surface: 'away_mode' }]);
});

// ---------- anonymous /leave ----------

test('anonymous /leave: the trip-length question is asked first and nothing is stored', async () => {
  const html = read('leave.html');
  const questions = html.match(/const QUESTIONS = \[\s*\{ key: '(\w+)'/);
  assert.equal(questions[1], 'length', 'length is the first question');
  // begin() skips the question only for a flag-on visitor with a saved length
  assert.match(html, /if \(longOn && savedLength\) \{/);
  // saving needs a session; nothing is written for anonymous visitors
  assert.match(html, /if \(!clerk \|\| !clerk\.session\) return;/);
  // the page's answer-to-token map is the server's
  const pageMap = JSON.parse(html.match(/const LEAVE_KEY_FOR = (\{[^}]+\});/)[1].replace(/'/g, '"'));
  for (const [token, key] of Object.entries(pageMap)) assert.equal(leaveLengthFromTripLength(token), key, token);
  const DB = makeSqliteD1(MIGRATIONS);
  const e = env(DB, ON);
  await plan(e, ANSWERS('month_plus'), { asked: true });
  assert.equal(DB.raw.prepare('SELECT count(*) AS n FROM users').get().n, 0, 'no user row');
  const pref = await call('/api/preferences', e, { method: 'POST', body: { trip_length: '30_plus', leave_answers: ANSWERS('month_plus') } });
  assert.equal(pref.status, 401, 'the save endpoint refuses anonymous requests');
});

// ---------- copy and the revenue split ----------

test('the lead copy is plain: no urgency or scare language, no insurance product names', () => {
  const text = JSON.stringify(buildLongLeaveLead([{ slug: 'us-global-mail', name: 'US Global Mail' }])).toLowerCase();
  for (const word of ['urgent', 'hurry', 'immediately', 'don\'t wait', 'danger', 'disaster', 'catastroph', 'devastat', 'last chance', 'before it\'s too late', 'risk of', 'avoid costly']) {
    assert.ok(!text.includes(word), word);
  }
});

test('the revenue report splits clicks and the estimate by src, so leave_long can be seen on its own', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  const ins = (src, n) => { for (let i = 0; i < n; i++) DB.raw.prepare("INSERT INTO events (id, event_type, partner, source, meta, ts) VALUES (?, 'outbound_click', 'us-global-mail', ?, '{\"ua_class\":\"human\"}', '2026-10-10 12:00:00')").run(crypto.randomUUID(), src); };
  ins('leave_long', 3);
  ins('leave', 1);
  DB.raw.prepare("INSERT INTO partner_payouts (month, partner_id, amount_usd, conversions, source) VALUES ('2026-10','us-global-mail',40,2,'manual')").run();
  const r = await computeRevenueReport({ DB }, { month: '2026-10' });
  const long = r.by_src.find((s) => s.src === 'leave_long');
  const std = r.by_src.find((s) => s.src === 'leave');
  assert.equal(long.human_clicks, 3);
  assert.equal(std.human_clicks, 1);
  assert.equal(long.allocated_estimate_usd, 30);
  assert.equal(std.allocated_estimate_usd, 10);
});

test('the pages load the helper', () => {
  for (const page of ['index.html', 'widget.html', 'account.html', 'away-mode.html', 'leave.html']) {
    assert.match(read(page), /<script src="\/long-leave\.js"><\/script>/, page);
  }
});
