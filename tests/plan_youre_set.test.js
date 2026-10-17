import { test, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker, { logEvent } from '../src/index.js';
import {
  ORIGIN_TIME_ZONES, DEFAULT_TIME_ZONE, EVENING_START_HOUR, localParts, youreSetDue, signItemToken, verifyItemToken, signPlanToken, validateOptin,
  handlePlanOptin, handlePlanConfirm, handlePlanStop, handlePlanDone, runPlanReminders, runYoureSetEmails,
} from '../src/planReminders.js';
import { youreSetSubject, _resetSendingGuardForTests } from '../src/email.js';
import { LEAVE_BY_RULES } from '../src/data/leaveByRules.js';

// Addendum G task G8 (ROADMAP step 94): the evening-before "You're set" email, behind ENABLE_PLAN_REMINDERS ("false").

const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const BANNED = /\b(book|booking|booked|secured?|protect(ing|ion|s)?|safe(ly|ty)?|vetted|guarantee[ds]?|hurry|last chance|countdown)\b|don't miss/i;
const DATE_IN_TEXT = /\b20\d{2}-\d{2}-\d{2}\b/;
const SECRET = 'test-secret-for-plan-tokens';
const NOW = new Date('2026-10-16T08:00:00Z');
const at = (iso) => new Date(iso);

function makeDb() {
  const raw = new DatabaseSync(':memory:');
  const stmt = (sql, p) => ({
    run: async () => { raw.prepare(sql).run(...p); return { success: true }; },
    first: async () => raw.prepare(sql).get(...p) ?? null,
    all: async () => ({ results: raw.prepare(sql).all(...p) }),
  });
  return { raw, prepare: (sql) => ({ ...stmt(sql, []), bind: (...p) => stmt(sql, p) }) };
}

let sent;
beforeEach(() => {
  _resetSendingGuardForTests();
  sent = [];
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes('resend.com')) { sent.push(JSON.parse(options.body)); return new Response(JSON.stringify({ id: 'e' + sent.length }), { status: 200 }); }
    return new Response('{}', { status: 200 });
  };
});

const env = (extra = {}) => ({ DB: makeDb(), UNSUBSCRIBE_SECRET: SECRET, RESEND_API_KEY: 'k', ENABLE_LEAVE_BY_PLAN: 'true', ENABLE_PLAN_REMINDERS: 'true', ...extra });
const OPT = { email: 'traveler@example.com', destination: 'Phuket, Thailand', departureDate: '2026-12-20', returnDate: '2027-01-02', origin: 'LAX', answers: { pet_home: 'no', keeper: 'no', driving: 'no', airport_parking: 'no' } };
const post = (body) => new Request('https://sparkfare.com/api/plan-reminders/optin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const tokenIn = (html, kind) => new URL(html.match(new RegExp(`https://sparkfare\\.com/api/plan-reminders/${kind}\\?token=[^"'\\s<]+`))[0]).searchParams.get('token');
const rows = (e, t) => e.DB.raw.prepare(`SELECT * FROM ${t}`).all();

async function confirmed(e, body = OPT, now = NOW) {
  await handlePlanOptin(post(body), e, { now });
  const token = tokenIn(sent.filter((m) => /Confirm your leave-by/.test(m.subject)).at(-1).html, 'confirm');
  await handlePlanConfirm(new Request('https://sparkfare.com/api/plan-reminders/confirm?token=' + token, { method: 'POST' }), e, { now, logEvent });
  return rows(e, 'away_plans').at(-1);
}
const youreSet = () => sent.filter((m) => m.subject.startsWith('Your plan for'));

// ---- time ----

test('the local date and hour are right in every US zone, winter and summer', () => {
  const z = (iso, tz) => { const p = localParts(at(iso), tz); return p.date + ' ' + p.hour; };
  assert.equal(z('2026-12-20T03:30:00Z', 'America/New_York'), '2026-12-19 22');
  assert.equal(z('2026-12-20T03:30:00Z', 'America/Chicago'), '2026-12-19 21');
  assert.equal(z('2026-12-20T03:30:00Z', 'America/Denver'), '2026-12-19 20');
  assert.equal(z('2026-12-20T03:30:00Z', 'America/Phoenix'), '2026-12-19 20');
  assert.equal(z('2026-12-20T03:30:00Z', 'America/Los_Angeles'), '2026-12-19 19');
  assert.equal(z('2026-07-02T03:30:00Z', 'America/New_York'), '2026-07-01 23', 'daylight time: 03:30 UTC is 23:30 EDT');
  assert.equal(z('2026-07-02T03:30:00Z', 'America/Los_Angeles'), '2026-07-01 20');
  assert.equal(z('2026-07-02T03:30:00Z', 'America/Phoenix'), '2026-07-01 20', 'Arizona keeps no daylight time');
  assert.equal(z('2026-12-20T03:30:00Z', 'Asia/Jerusalem'), '2026-12-20 5');
  assert.equal(z('2026-12-20T00:00:00Z', 'America/New_York'), '2026-12-19 19', 'midnight UTC is hour 19, never hour 24');
  assert.equal(localParts(at('2026-12-20T03:30:00Z'), 'Not/AZone').date, '2026-12-19', 'a bad zone falls back to New York');
});

test('"the evening before" starts at 18:00 local on the day before leaving and ends at local midnight', () => {
  const due = (iso, tz) => youreSetDue('2026-12-20', at(iso), tz);
  const NY = 'America/New_York', LA = 'America/Los_Angeles';
  assert.equal(EVENING_START_HOUR, 18);
  assert.equal(due('2026-12-19T22:59:00Z', NY), false, '17:59 in New York');
  assert.equal(due('2026-12-19T23:00:00Z', NY), true, '18:00 in New York');
  assert.equal(due('2026-12-20T03:30:00Z', NY), true, 'the 03:30 UTC run is 22:30 in New York');
  assert.equal(due('2026-12-20T04:59:00Z', NY), true, '23:59');
  assert.equal(due('2026-12-20T05:00:00Z', NY), false, 'midnight: it is the leaving day now');
  assert.equal(due('2026-12-20T07:00:00Z', NY), false, 'the 07:00 UTC run is 02:00 on the leaving day');
  assert.equal(due('2026-12-19T01:59:00Z', LA), false, 'two days before');
  assert.equal(due('2026-12-20T01:59:00Z', LA), false, '17:59 in Los Angeles');
  assert.equal(due('2026-12-20T02:00:00Z', LA), true, '18:00 in Los Angeles');
  assert.equal(due('2026-12-20T03:30:00Z', LA), true, 'the 03:30 UTC run is 19:30 in Los Angeles');
  assert.equal(due('2026-12-20T03:30:00Z', 'Asia/Jerusalem'), false, 'a Tel Aviv evening is over before the first run, so it is never mailed');
  assert.equal(youreSetDue('2026-07-02', at('2026-07-02T03:30:00Z'), NY), true, 'summer: 23:30 EDT');
  assert.equal(youreSetDue('2026-12-20', at('2026-12-21T03:30:00Z'), NY), false, 'the next night is too late');
});

test('every marketed origin has a time zone, and the 03:30 UTC run falls in the evening for all of them but TLV', () => {
  const wf = read('.github/workflows/hourly-multi-origin-fetch.yml');
  const origins = wf.match(/SPARKFARE_ORIGINS:[^\n]*?'((?:[A-Z]{3},)+[A-Z]{3})'/)[1].split(',');
  assert.ok(origins.length >= 22, origins.join());
  for (const o of origins) assert.ok(ORIGIN_TIME_ZONES[o], `${o} has a time zone`);
  for (const [o, tz] of Object.entries(ORIGIN_TIME_ZONES)) {
    for (const [iso, leave] of [['2026-12-20T03:30:00Z', '2026-12-20'], ['2026-07-02T03:30:00Z', '2026-07-02']]) {
      assert.equal(youreSetDue(leave, at(iso), tz), o !== 'TLV', `${o} on ${leave}`);
    }
  }
  assert.equal(DEFAULT_TIME_ZONE, 'America/New_York');
  assert.match(read('wrangler.jsonc'), /"crons":\s*\["30 3 \* \* \*"/);
});

// ---- the opt-in carries the origin and the done items ----

test('opt-in keeps a known origin (any case) and only real item ids, once each, at most 40', () => {
  const v = (patch) => validateOptin({ ...OPT, ...patch }, '2026-10-16');
  assert.equal(v({ origin: 'lax' }).plan.origin, 'LAX');
  assert.equal(v({ origin: 'XXX' }).plan.origin, null);
  assert.equal(v({ origin: '<script>' }).plan.origin, null);
  assert.equal(v({ origin: undefined }).plan.origin, null);
  assert.deepEqual(v({ done: ['idp', 'idp', 'made-up', 3, 'step'] }).plan.done, ['idp', 'step']);
  assert.deepEqual(v({ done: 'idp' }).plan.done, []);
  assert.equal(v({ done: Array(100).fill('idp').map((x, i) => (i < 60 ? LEAVE_BY_RULES[i % LEAVE_BY_RULES.length].id : x)) }).plan.done.length <= 40, true);
});

test('the origin and the done items are stored with the pending plan', async () => {
  const e = env();
  await handlePlanOptin(post({ ...OPT, done: ['step', 'idp', 'nope'] }), e, { now: NOW });
  const plan = rows(e, 'away_plans')[0];
  assert.equal(plan.origin, 'LAX');
  assert.deepEqual(rows(e, 'away_plan_done').map((r) => r.rule_id).sort(), ['idp', 'step']);
});

// ---- marking an item done ----

test('a "mark done" token is for one item of one plan: it cannot be pointed at another item, another plan, or used as another kind of link', async () => {
  const plan = 'a'.repeat(32);
  const t = await signItemToken(SECRET, plan, 'idp');
  assert.deepEqual(await verifyItemToken(SECRET, t), { planId: plan, ruleId: 'idp' });
  const [payload, sig] = t.split('.');
  const swapped = Buffer.from(plan + ':step').toString('base64url') + '.' + sig;
  assert.equal(await verifyItemToken(SECRET, swapped), null, 'changing the item invalidates it');
  assert.equal(await verifyItemToken(SECRET, Buffer.from('b'.repeat(32) + ':idp').toString('base64url') + '.' + sig), null, 'changing the plan invalidates it');
  assert.equal(await verifyItemToken('other-secret', t), null);
  assert.equal(await verifyItemToken(SECRET, await signPlanToken(SECRET, 'confirm', plan)), null, 'a confirm link is not a done link');
  assert.equal(await verifyItemToken(SECRET, await signItemToken(SECRET, plan, 'not-a-rule')), null, 'only known items');
  assert.equal(await verifyItemToken(SECRET, 'junk'), null);
  assert.equal(await verifyItemToken(SECRET, null), null);
  assert.ok(payload);
});

test('opening a done link changes nothing; its button marks the item; a stopped plan or a bad link marks nothing', async () => {
  const e = env();
  const plan = await confirmed(e);
  const url = 'https://sparkfare.com/api/plan-reminders/done?token=' + await signItemToken(SECRET, plan.id, 'usps-hold-mail');
  const opened = await handlePlanDone(new Request(url), e, { now: NOW });
  assert.match(await opened.text(), /<button type="submit">Mark done<\/button>/);
  assert.equal(rows(e, 'away_plan_done').length, 0, 'a link scanner cannot mark anything');
  const done = await handlePlanDone(new Request(url, { method: 'POST' }), e, { now: NOW });
  assert.match(await done.text(), /marked done/);
  assert.deepEqual(rows(e, 'away_plan_done').map((r) => r.rule_id), ['usps-hold-mail']);
  await handlePlanDone(new Request(url, { method: 'POST' }), e, { now: NOW });
  assert.equal(rows(e, 'away_plan_done').length, 1, 'pressing twice is one row');
  assert.match(await (await handlePlanDone(new Request('https://sparkfare.com/api/plan-reminders/done?token=junk', { method: 'POST' }), e, { now: NOW })).text(), /not valid/);
  const stop = await signPlanToken(SECRET, 'stop', plan.id);
  await handlePlanStop(new Request('https://sparkfare.com/api/plan-reminders/stop?token=' + stop, { method: 'POST' }), e, { now: NOW });
  await handlePlanDone(new Request('https://sparkfare.com/api/plan-reminders/done?token=' + await signItemToken(SECRET, plan.id, 'step'), { method: 'POST' }), e, { now: NOW });
  assert.equal(rows(e, 'away_plan_done').length, 1, 'a stopped plan records nothing more');
  assert.equal((await worker.fetch(new Request(url), env({ ENABLE_PLAN_REMINDERS: 'false' }), { waitUntil() {} })).status, 404, 'flag off');
});

test('reminders carry a "Mark done" link per item, and an item marked done is not reminded about again', async () => {
  const e = env();
  const plan = await confirmed(e, { ...OPT, answers: { pet_home: 'yes', keeper: 'no', driving: 'yes', airport_parking: 'no' } });
  // the first reminder is for the driving permit (21 days before): mark it done before it is due
  await handlePlanDone(new Request('https://sparkfare.com/api/plan-reminders/done?token=' + await signItemToken(SECRET, plan.id, 'idp'), { method: 'POST' }), e, { now: NOW });
  sent.length = 0;
  for (let d = 0; d <= 70; d++) await runPlanReminders(e, { now: new Date(NOW.getTime() + d * 86400000) });
  const all = sent.map((m) => m.html).join('\n');
  assert.doesNotMatch(all, /International Driving Permit/, 'a done item is never reminded');
  assert.ok(sent.length >= 2);
  for (const m of sent) {
    const links = [...m.html.matchAll(/href="([^"]*plan-reminders\/done\?token=[^"]+)"/g)].map((x) => x[1]);
    assert.ok(links.length >= 1, 'each item has a Mark done link');
    for (const l of links) assert.doesNotMatch(l, DATE_IN_TEXT);
  }
});

// ---- the evening-before email ----

test('the email goes out once, in the evening before leaving, and not before, after, or twice', async () => {
  const e = env();
  const plan = await confirmed(e); // origin LAX, leaving 2026-12-20: due from 2026-12-20T02:00Z
  const run = (iso) => runYoureSetEmails(e, { now: at(iso) });
  sent.length = 0;
  assert.equal((await run('2026-12-19T20:00:00Z')).sent, 0, '12:00 in Los Angeles the day before');
  assert.equal((await run('2026-12-20T01:59:00Z')).sent, 0, '17:59');
  assert.equal(youreSet().length, 0);
  assert.equal((await run('2026-12-20T03:30:00Z')).sent, 1, 'the 03:30 UTC run, 19:30 in Los Angeles');
  assert.equal(youreSet().length, 1);
  assert.equal((await run('2026-12-20T03:45:00Z')).sent, 0, 'never twice');
  assert.equal((await run('2026-12-20T08:00:00Z')).sent, 0);
  assert.ok(rows(e, 'away_plans').find((p) => p.id === plan.id).set_sent_at);
  assert.equal(youreSet().length, 1);
});

test('the email says what is done and what is open, names no date, and has a stop link', async () => {
  const e = env();
  const plan = await confirmed(e, { ...OPT, answers: { pet_home: 'yes', keeper: 'no', driving: 'yes', airport_parking: 'no' }, done: ['idp', 'step', 'home-pets'] });
  sent.length = 0;
  await runYoureSetEmails(e, { now: at('2026-12-20T03:30:00Z') });
  const [m] = youreSet();
  assert.equal(m.to, 'traveler@example.com');
  assert.equal(m.subject, "Your plan for Phuket, Thailand: what's done and what's open");
  assert.equal(youreSetSubject('Tokyo, Japan'), "Your plan for Tokyo, Japan: what's done and what's open");
  assert.doesNotMatch(m.subject, DATE_IN_TEXT);
  assert.match(m.html, />Done<\/p><ul/);
  for (const done of ['Get an International Driving Permit', 'Enroll your trip in STEP', 'Line up care for your pet']) {
    assert.ok(m.html.indexOf(done) > m.html.indexOf('>Done<') && m.html.indexOf(done) < m.html.indexOf('Still open'), `${done} is listed as done`);
  }
  const open = m.html.slice(m.html.indexOf('Still open'));
  for (const title of ['Ask USPS to hold your mail', 'Fill in the Thailand Digital Arrival Card', 'Find your water shutoff']) assert.ok(open.includes(title), `${title} is open`);
  for (const title of ['International Driving Permit', 'Enroll your trip in STEP']) assert.ok(!open.includes(title), `${title} is not open`);
  assert.match(open, /Official page/);
  assert.match(open, /Mark done/);
  for (const l of [...m.html.matchAll(/href="([^"]+)"/g)].map((x) => x[1])) assert.doesNotMatch(l, DATE_IN_TEXT, l);
  assert.match(m.headers['List-Unsubscribe'], /plan-reminders\/stop\?token=/);
  assert.equal(m.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  assert.match(m.html, /Stop all plan emails/);
  { const vis = m.html.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/https?:\/\/\S+/g, '').replace(/Sparkfare is a deal-information service[\s\S]*?you choose\./, ''); assert.doesNotMatch(vis, BANNED, 'banned word near: ' + vis.slice(Math.max(0, vis.search(BANNED) - 60), vis.search(BANNED) + 40)); }
  assert.doesNotMatch(m.html, /Your Home card/, 'no Home card line when there is none');
  assert.ok(plan);
});

test('only an open item\'s own partner appears, with the commission line first; a done item\'s partner does not', async () => {
  const run = async (done) => {
    const e = env();
    await confirmed(e, { ...OPT, destination: 'Tokyo, Japan', returnDate: '2027-01-02', done });
    sent.length = 0;
    await runYoureSetEmails(e, { now: at('2026-12-20T03:30:00Z') });
    return youreSet()[0].html;
  };
  const open = await run([]);
  assert.ok(open.indexOf('Sparkfare may earn a commission') > 0 && open.indexOf('Sparkfare may earn a commission') < open.indexOf('/out/yesim'));
  assert.match(open, /href="https:\/\/sparkfare\.com\/out\/yesim\?src=away-plan&amp;rule=destination-phone-data&amp;bucket=11-14" rel="sponsored nofollow noopener"/);
  assert.equal([...open.matchAll(/\/out\//g)].length, 1, 'one partner, for the one item that has one');
  const done = await run(['destination-phone-data']);
  assert.doesNotMatch(done, /\/out\/|Sparkfare may earn a commission/);
});

test('everything done, or a Home card to mention', async () => {
  const e = env();
  await confirmed(e, { ...OPT, done: LEAVE_BY_RULES.map((r) => r.id) });
  sent.length = 0;
  await runYoureSetEmails(e, { now: at('2026-12-20T03:30:00Z'), homeCardSummary: async () => ({ lines: ['Your keeper has 4 tasks on the card.'] }) });
  const [m] = youreSet();
  assert.match(m.html, /Everything in your plan is done\./);
  assert.doesNotMatch(m.html, /Still open/);
  assert.match(m.html, /Your Home card/);
  assert.match(m.html, /Your keeper has 4 tasks on the card\./);
});

test('nothing is sent for an unconfirmed plan, a stopped plan, another day, Tel Aviv, or with the flag off; a rule on hold is left out', async () => {
  const when = at('2026-12-20T03:30:00Z');
  const e1 = env();
  await handlePlanOptin(post(OPT), e1, { now: NOW });
  assert.equal((await runYoureSetEmails(e1, { now: when })).sent, 0, 'unconfirmed');

  const e2 = env();
  const p2 = await confirmed(e2);
  await handlePlanStop(new Request('https://sparkfare.com/api/plan-reminders/stop?token=' + await signPlanToken(SECRET, 'stop', p2.id), { method: 'POST' }), e2, { now: NOW });
  assert.equal((await runYoureSetEmails(e2, { now: when })).sent, 0, 'stopped');

  const e3 = env();
  await confirmed(e3, { ...OPT, departureDate: '2026-12-25', returnDate: '2027-01-05' });
  assert.equal((await runYoureSetEmails(e3, { now: when })).sent, 0, 'leaving on another day');

  const e4 = env();
  await confirmed(e4, { ...OPT, origin: 'TLV' });
  assert.equal((await runYoureSetEmails(e4, { now: when })).sent, 0, 'Tel Aviv');
  assert.equal((await runYoureSetEmails(e4, { now: at('2026-12-20T07:00:00Z') })).sent, 0, 'not on a later run either');

  const e5 = env({ ENABLE_PLAN_REMINDERS: 'false', DB: e3.DB });
  assert.deepEqual(await runYoureSetEmails(e5, { now: when }), { ok: true, skipped: true });
  assert.equal(youreSet().length, 0);

  const e6 = env({ ENABLE_RULE_WATCHER: 'true' });
  await confirmed(e6);
  const { keepRuleHeld } = await import('../src/ruleWatcher.js');
  await keepRuleHeld(e6, 'usps-hold-mail', null, NOW.toISOString());
  sent.length = 0;
  await runYoureSetEmails(e6, { now: when });
  assert.doesNotMatch(youreSet()[0].html, /Ask USPS to hold your mail/, 'a held rule is not listed');
});

test('with no origin on the plan, the address\'s saved origin sets the time zone, else New York', async () => {
  const e = env();
  e.DB.raw.exec('CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, origin_iata TEXT)');
  e.DB.raw.prepare("INSERT INTO users (id, email, origin_iata) VALUES ('u1', 'traveler@example.com', 'SEA')").run();
  await confirmed(e, { ...OPT, origin: undefined });
  // 17:30 in Seattle (01:30 UTC) is too early for a Pacific address, though it is 20:30 in New York
  assert.equal((await runYoureSetEmails(e, { now: at('2026-12-20T01:30:00Z') })).sent, 0);
  assert.equal((await runYoureSetEmails(e, { now: at('2026-12-20T03:30:00Z') })).sent, 1);
  const e2 = env();
  await confirmed(e2, { ...OPT, origin: undefined });
  assert.equal((await runYoureSetEmails(e2, { now: at('2026-12-19T22:00:00Z') })).sent, 0, '17:00 in New York');
  assert.equal((await runYoureSetEmails(e2, { now: at('2026-12-19T23:30:00Z') })).sent, 1, '18:30 in New York');
});

test('a plan is deleted with its done items', async () => {
  const e = env();
  await confirmed(e, { ...OPT, done: ['idp'] });
  assert.equal(rows(e, 'away_plan_done').length, 1);
  await runPlanReminders(e, { now: at('2027-02-05T08:00:00Z') });
  assert.equal(rows(e, 'away_plans').length, 0);
  assert.equal(rows(e, 'away_plan_done').length, 0);
});

// ---- wiring ----

test('the 03:30 UTC run sends it, isolated from the fetch dispatch, and the general run tries again', async () => {
  const src = read('src/index.js');
  const branch = src.slice(src.indexOf('if (event.cron === DAILY_FETCH_TRIGGER_CRON) {'), src.indexOf('// Workplan Step 117: the weekly link-health check runs'));
  assert.match(branch, /await dispatchDailyFetch\(env\);[\s\S]*catch[\s\S]*await runYoureSetEmails\(env, \{ homeCardSummary \}\);[\s\S]*catch[\s\S]*return;/);
  assert.equal([...src.matchAll(/await runYoureSetEmails\(env, \{ homeCardSummary \}\)/g)].length, 2);
  // run it for real at 03:30 UTC with the clock set
  const e2 = env();
  await confirmed(e2);
  sent.length = 0;
  mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-12-20T03:30:00Z') });
  try {
    await worker.scheduled({ cron: '30 3 * * *' }, e2);
  } finally { mock.timers.reset(); }
  assert.equal(youreSet().length, 1, 'the scheduled 03:30 UTC run sent it');
});

test('no word on the Away Mode banned list is in the new strings', () => {
  const email = read('src/email.js');
  const block = email.slice(email.indexOf('export function youreSetSubject'), email.indexOf('// ROADMAP step 65: the weekly standup brief'));
  for (const m of block.matchAll(/(?:"([^"\n]{12,})"|'([^'\n]{12,})')/g)) assert.doesNotMatch(m[1] || m[2], BANNED, m[1] || m[2]);
  const privacy = read('privacy.html');
  assert.match(privacy, /we also keep the home airport you chose on the site, and which items you marked done, so the email the evening before you leave can say what is done and what is still open/);
});

test('the plan page sends the origin and the done items with the reminders request, and nowhere else', () => {
  const page = read('plan.html');
  const fn = page.slice(page.indexOf('async function askForReminders()'), page.indexOf("$('rem-go').addEventListener"));
  assert.match(fn, /origin: readOrigin\(\), done: \[\.\.\.doneNow\]/);
  assert.match(page, /On the evening before you leave we'll also send one email saying what's done and what's still open\./);
  assert.doesNotMatch(page.replace(fn, ''), /origin: readOrigin\(\), done/, 'the done items go only with the opt-in');
});
