import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../src/index.js';
import {
  PLAN_REMINDERS, planRemindersEnabled, validateOptin, groupReminderDates, signPlanToken, verifyPlanToken, handlePlanOptin, handlePlanConfirm,
  handlePlanStop, runPlanReminders, planCoversTrip, buildSchedule,
} from '../src/planReminders.js';
import { planReminderSubject, sendPlanReminderEmail } from '../src/email.js';
import { logEvent } from '../src/index.js';
import { _resetSendingGuardForTests } from '../src/email.js';

// Addendum G task G7 (ROADMAP step 93): leave-by plan reminders, behind ENABLE_PLAN_REMINDERS ("false") and ENABLE_LEAVE_BY_PLAN.

const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const ctx = { waitUntil: () => {} };
const BANNED = /\b(book|booking|booked|secured?|protect(ing|ion|s)?|safe(ly|ty)?|vetted|guarantee[ds]?|hurry|last chance|countdown)\b|don't miss/i;
const DATE_IN_TEXT = /\b20\d{2}-\d{2}-\d{2}\b/;
const SECRET = 'test-secret-for-plan-tokens';
const NOW = new Date('2026-10-16T08:00:00Z');
const day = (n) => new Date(NOW.getTime() + n * 86400000);

function makeDb() {
  const raw = new DatabaseSync(':memory:');
  const stmt = (sql, p) => ({
    run: async () => { raw.prepare(sql).run(...p); return { success: true }; },
    first: async () => raw.prepare(sql).get(...p) ?? null,
    all: async () => ({ results: raw.prepare(sql).all(...p) }),
  });
  return { raw, prepare: (sql) => ({ ...stmt(sql, []), bind: (...p) => stmt(sql, p) }) };
}

let sent; // every email the (stubbed) Resend API was asked to send
let realFetch;
beforeEach(() => {
  _resetSendingGuardForTests();
  sent = [];
  if (!realFetch) realFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes('resend.com')) { sent.push(JSON.parse(options.body)); return new Response(JSON.stringify({ id: 'e' + sent.length }), { status: 200 }); }
    return new Response('{}', { status: 200 });
  };
});

const env = (extra = {}) => ({ DB: makeDb(), UNSUBSCRIBE_SECRET: SECRET, RESEND_API_KEY: 'k', ENABLE_LEAVE_BY_PLAN: 'true', ENABLE_PLAN_REMINDERS: 'true', ...extra });
const OPT = { email: 'Traveler@Example.com', destination: 'Phuket, Thailand', departureDate: '2026-12-20', returnDate: '2027-01-02', answers: { pet_home: 'yes', keeper: 'no', driving: 'yes', airport_parking: 'yes' } };
const post = (path, body, headers = {}) => new Request('https://sparkfare.com' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
const tokenIn = (html, kind) => new URL(html.match(new RegExp(`https://sparkfare\\.com/api/plan-reminders/${kind}\\?token=[^"'\\s<]+`))[0]).searchParams.get('token');
const rows = (e, table) => e.DB.raw.prepare(`SELECT * FROM ${table}`).all();

async function optIn(e, body = OPT, now = NOW) {
  const res = await handlePlanOptin(post('/api/plan-reminders/optin', body), e, { now });
  return res;
}
async function confirmed(e, body = OPT, now = NOW) {
  await optIn(e, body, now);
  const confirmUrl = tokenIn(sent[sent.length - 1].html, 'confirm');
  const res = await handlePlanConfirm(new Request('https://sparkfare.com/api/plan-reminders/confirm?token=' + confirmUrl, { method: 'POST' }), e, { now, logEvent });
  return { confirmUrl, res };
}

// ---- pure pieces ----

test('opt-in input is checked: email, destination from the 40, sane dates, answers reduced to yes or no', () => {
  const ok = validateOptin(OPT, '2026-10-16');
  assert.equal(ok.ok, true);
  assert.equal(ok.plan.email, 'traveler@example.com');
  assert.equal(ok.plan.destination_country, 'TH');
  assert.equal(ok.plan.bucket, '11-14');
  assert.deepEqual(ok.plan.answers, { pet_home: 'yes', keeper: 'no', driving: 'yes', airport_parking: 'yes' });
  const bad = (patch) => validateOptin({ ...OPT, ...patch }, '2026-10-16');
  assert.equal(bad({ email: 'nope' }).error, 'email');
  assert.equal(bad({ email: 'a@b' }).error, 'email');
  assert.equal(bad({ email: 'x'.repeat(300) + '@example.com' }).error, 'email');
  assert.equal(bad({ destination: 'Atlantis' }).error, 'destination');
  assert.equal(bad({ departureDate: '2026-13-40' }).error, 'dates');
  assert.equal(bad({ departureDate: 'tomorrow' }).error, 'dates');
  assert.equal(bad({ returnDate: '2026-12-01' }).error, 'dates', 'back before leaving');
  assert.equal(bad({ departureDate: '2026-10-10', returnDate: '2026-10-20' }).error, 'dates', 'already left');
  assert.equal(bad({ returnDate: '2028-06-01' }).error, 'dates', 'a trip over 400 days');
  assert.deepEqual(bad({ answers: { pet_home: '<script>', keeper: 'yes', extra: 'text' } }).plan.answers, { pet_home: 'no', keeper: 'yes', driving: 'no', airport_parking: 'no' });
  assert.equal(validateOptin(null, '2026-10-16').ok, false);
});

test('items due within 3 days of each other share an email, there are never more than 6, and the window grows to fit', () => {
  const e = (id, date) => ({ id, date });
  const g = groupReminderDates([e('a', '2026-12-06'), e('b', '2026-12-08'), e('c', '2026-12-09'), e('d', '2026-12-20')]);
  assert.deepEqual(g, [{ send_on: '2026-12-06', itemIds: ['a', 'b', 'c'] }, { send_on: '2026-12-20', itemIds: ['d'] }]);
  assert.equal(groupReminderDates([e('a', '2026-12-06'), e('b', '2026-12-10')]).length, 2, '4 days apart is two emails');
  const many = Array.from({ length: 20 }, (_, i) => e('i' + i, new Date(Date.UTC(2026, 11, 1 + i * 2)).toISOString().slice(0, 10)));
  const six = groupReminderDates(many);
  assert.equal(PLAN_REMINDERS.MAX_EMAILS, 6);
  assert.ok(six.length <= 6, `${six.length} emails`);
  assert.equal(six.flatMap((x) => x.itemIds).length, 20, 'no item is dropped when the window widens');
  assert.deepEqual(groupReminderDates([]), []);
  assert.deepEqual(groupReminderDates([e('x', 'not a date')]), []);
});

test('signed links: a confirm token cannot stop, a stop token cannot confirm, and a changed or foreign token is refused', async () => {
  const id = 'a'.repeat(32);
  const confirm = await signPlanToken(SECRET, 'confirm', id);
  const stop = await signPlanToken(SECRET, 'stop', id);
  assert.equal(await verifyPlanToken(SECRET, 'confirm', confirm), id);
  assert.equal(await verifyPlanToken(SECRET, 'stop', stop), id);
  assert.equal(await verifyPlanToken(SECRET, 'stop', confirm), null);
  assert.equal(await verifyPlanToken(SECRET, 'confirm', stop), null);
  assert.equal(await verifyPlanToken('another-secret', 'confirm', confirm), null);
  assert.equal(await verifyPlanToken(SECRET, 'confirm', confirm.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A'))), null);
  assert.equal(await verifyPlanToken(SECRET, 'confirm', 'garbage'), null);
  assert.equal(await verifyPlanToken(SECRET, 'confirm', null), null);
  assert.equal(await verifyPlanToken(undefined, 'confirm', confirm), null, 'no secret means no token verifies');
  const other = await signPlanToken(SECRET, 'confirm', 'not-a-plan-id');
  assert.equal(await verifyPlanToken(SECRET, 'confirm', other), null, 'only a 32-character plan id is accepted');
});

test('flags: off means every route is 404 and nothing is stored; the plan flag is needed too; a missing secret fails closed', async () => {
  for (const flags of [{ ENABLE_PLAN_REMINDERS: 'false' }, { ENABLE_PLAN_REMINDERS: undefined }, { ENABLE_LEAVE_BY_PLAN: 'false' }, { ENABLE_PLAN_REMINDERS: 'yes' }]) {
    const e = env(flags);
    assert.equal(planRemindersEnabled(e), false);
    for (const [method, path] of [['POST', '/api/plan-reminders/optin'], ['GET', '/api/plan-reminders/confirm?token=x'], ['POST', '/api/plan-reminders/stop?token=x']]) {
      const res = await worker.fetch(new Request('https://sparkfare.com' + path, { method, headers: { 'Content-Type': 'application/json' }, body: method === 'POST' ? JSON.stringify(OPT) : undefined }), e, ctx);
      assert.equal(res.status, 404, `${method} ${path}`);
    }
    assert.equal(e.DB.raw.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name LIKE 'away_plan%'").get().n, 0);
    assert.equal(sent.length, 0);
    assert.deepEqual(await runPlanReminders(e, { now: NOW }), { ok: true, skipped: true });
  }
  assert.equal((await optIn(env({ UNSUBSCRIBE_SECRET: undefined }))).status, 503);
  assert.match(read('wrangler.jsonc'), /"ENABLE_PLAN_REMINDERS":\s*"false"/);
});

// ---- opt-in and the confirmation email ----

test('opting in stores a pending plan, sends exactly one confirmation email, and schedules nothing', async () => {
  const e = env();
  const res = await optIn(e);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.match(body.message, /Nothing starts until you confirm/);
  assert.equal(sent.length, 1);
  const mail = sent[0];
  assert.equal(mail.to, 'traveler@example.com');
  assert.equal(mail.subject, 'Confirm your leave-by reminders');
  assert.doesNotMatch(mail.subject, DATE_IN_TEXT);
  const links = [...mail.html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  for (const l of links) assert.doesNotMatch(l, DATE_IN_TEXT, 'no date in a link: ' + l);
  assert.match(mail.headers['List-Unsubscribe'], /^<https:\/\/sparkfare\.com\/api\/plan-reminders\/stop\?token=/);
  assert.equal(mail.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  assert.match(mail.html, /at most six emails in all/);
  const plans = rows(e, 'away_plans');
  assert.equal(plans.length, 1);
  assert.equal(plans[0].confirmed_at, null);
  assert.equal(plans[0].delete_after, '2027-02-01', 'back date plus 30 days');
  assert.equal(plans[0].pending_until, '2026-10-23', 'a week to confirm');
  assert.equal(rows(e, 'away_plan_reminders').length, 0);
  assert.equal(JSON.stringify(plans[0]).includes('user_id'), false);
});

test('the answer is the same whether or not the address can be mailed, a second try inside the cooldown does nothing, and the number of plans is capped', async () => {
  const e = env();
  const first = await (await optIn(e)).json();
  const again = await (await optIn(e)).json();
  assert.deepEqual(again, first);
  assert.equal(sent.length, 1, 'no second email inside the cooldown');
  assert.equal(rows(e, 'away_plans').length, 1);
  // a suppressed address gets the same answer and no email
  const e2 = env();
  await optIn(e2, { ...OPT, email: 'other@example.com' }, new Date(NOW.getTime() - 3600000)); // creates the tables
  e2.DB.raw.prepare("INSERT INTO email_suppressions (email, reason) VALUES ('sup@example.com', 'bounce')").run();
  sent.length = 0;
  const sup = await (await optIn(e2, { ...OPT, email: 'sup@example.com' })).json();
  assert.deepEqual(sup, first);
  assert.equal(sent.length, 0, 'a suppressed address is never mailed');
  // the cap
  const e3 = env();
  for (let i = 0; i < PLAN_REMINDERS.MAX_PLANS_PER_EMAIL + 2; i++) await optIn(e3, OPT, new Date(NOW.getTime() + i * 3600000));
  assert.equal(rows(e3, 'away_plans').length, PLAN_REMINDERS.MAX_PLANS_PER_EMAIL);
});

test('bad opt-ins are refused with a reason that does not echo the input, and store nothing', async () => {
  const e = env();
  for (const [patch, error] of [[{ email: 'x' }, 'email'], [{ destination: '<b>' }, 'destination'], [{ departureDate: '2020-01-01' }, 'dates']]) {
    const res = await optIn(e, { ...OPT, ...patch });
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { ok: false, error });
  }
  const notJson = await handlePlanOptin(new Request('https://sparkfare.com/api/plan-reminders/optin', { method: 'POST', body: 'nope' }), e, { now: NOW });
  assert.equal(notJson.status, 400);
  assert.equal(e.DB.raw.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'away_plans'").get().n === 0 || rows(e, 'away_plans').length === 0, true);
  assert.equal(sent.length, 0);
});

// ---- confirming ----

test('opening the confirm link changes nothing; pressing the button (a POST) confirms, schedules the emails and counts one opt-in', async () => {
  const e = env();
  await optIn(e);
  const token = tokenIn(sent[0].html, 'confirm');
  const url = 'https://sparkfare.com/api/plan-reminders/confirm?token=' + token;
  const opened = await handlePlanConfirm(new Request(url), e, { now: NOW, logEvent });
  assert.equal(opened.status, 200);
  assert.match(await opened.text(), /<button type="submit">Yes, email me<\/button>/);
  assert.equal(rows(e, 'away_plans')[0].confirmed_at, null, 'a link scanner cannot confirm');
  assert.equal(rows(e, 'away_plan_reminders').length, 0);

  const done = await handlePlanConfirm(new Request(url, { method: 'POST', headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36' } }), e, { now: NOW, logEvent });
  assert.match(await done.text(), /You're set/);
  assert.ok(rows(e, 'away_plans')[0].confirmed_at);
  const reminders = rows(e, 'away_plan_reminders');
  assert.ok(reminders.length >= 3 && reminders.length <= 6, `${reminders.length} reminders`);
  assert.ok(reminders.every((r) => r.status === 'scheduled' && r.send_on >= '2026-10-16'));
  const ev = e.DB.raw.prepare("SELECT * FROM events WHERE event_type = 'reminder_optin'").all();
  assert.equal(ev.length, 1);
  assert.equal(ev[0].source, 'away-plan');
  assert.deepEqual(JSON.parse(ev[0].meta), { trip_length_bucket: '11-14', ua_class: 'human' });
  assert.equal(ev[0].user_id, null);
  assert.doesNotMatch(JSON.stringify(ev[0]), /traveler@|2026-12-20|Thailand|TH\b/);
  // pressing again does not schedule twice or log twice
  await handlePlanConfirm(new Request(url, { method: 'POST' }), e, { now: NOW, logEvent });
  assert.equal(rows(e, 'away_plan_reminders').length, reminders.length);
  assert.equal(e.DB.raw.prepare("SELECT COUNT(*) AS n FROM events WHERE event_type = 'reminder_optin'").get().n, 1);
});

test('a confirm link that is wrong, expired, or for a stopped plan does nothing', async () => {
  const e = env();
  await optIn(e);
  const good = tokenIn(sent[0].html, 'confirm');
  const stopTok = tokenIn(sent[0].html.replace(/stop\?token/g, 'stop?token'), 'stop');
  const attempt = (token, now = NOW) => handlePlanConfirm(new Request('https://sparkfare.com/api/plan-reminders/confirm?token=' + token, { method: 'POST' }), e, { now, logEvent });
  assert.match(await (await attempt('garbage')).text(), /not valid/);
  assert.match(await (await attempt(stopTok)).text(), /not valid/, 'a stop link cannot confirm');
  assert.match(await (await attempt(good, day(8))).text(), /expired/);
  assert.equal(rows(e, 'away_plans')[0].confirmed_at, null);
  await handlePlanStop(new Request('https://sparkfare.com/api/plan-reminders/stop?token=' + stopTok, { method: 'POST' }), e, { now: NOW });
  assert.match(await (await attempt(good)).text(), /were stopped/);
  assert.equal(rows(e, 'away_plan_reminders').length, 0);
});

// ---- the daily job ----

test('over the whole run-up: every due item is emailed exactly once, on its date, in at most six emails, with no date in a subject or link', async () => {
  const e = env();
  await confirmed(e);
  sent.length = 0;
  const seen = [];
  for (let d = 0; d <= 70; d++) {
    const before = sent.length;
    await runPlanReminders(e, { now: day(d) });
    if (sent.length > before) seen.push({ d, mail: sent[sent.length - 1] });
  }
  assert.ok(seen.length >= 3 && seen.length <= 6, `${seen.length} emails`);
  const titles = seen.flatMap((s) => [...s.mail.html.matchAll(/font-weight:600;margin:0 0 4px;">([^<]+)<\/p>/g)].map((m) => m[1]));
  assert.equal(new Set(titles).size, titles.length, 'no item is mailed twice');
  assert.ok(titles.includes('Get an International Driving Permit') && titles.includes('Ask USPS to hold your mail') && titles.includes('Line up care for your pet'));
  for (const { mail } of seen) {
    assert.equal(mail.to, 'traveler@example.com');
    assert.match(mail.subject, /^Due: /);
    assert.doesNotMatch(mail.subject, DATE_IN_TEXT);
    for (const l of [...mail.html.matchAll(/href="([^"]+)"/g)].map((m) => m[1])) assert.doesNotMatch(l, DATE_IN_TEXT, l);
    assert.match(mail.headers['List-Unsubscribe'], /plan-reminders\/stop\?token=/);
    assert.match(mail.html, /Here's what's due\./);
  }
  // an item is emailed on the first day of its group, which is its own date or up to 3 days before it
  const first = seen[0];
  assert.equal(first.mail.subject.startsWith('Due: Get an International Driving Permit'), true, 'the earliest item leads the first email');
  const sentRows = rows(e, 'away_plan_reminders');
  assert.ok(sentRows.every((r) => r.status === 'sent' && r.sent_at));
  // a rerun the same day sends nothing more
  const n = sent.length;
  await runPlanReminders(e, { now: day(70) });
  assert.equal(sent.length, n);
});

test('a reminder mentions its partner only after the commission line, with a sponsored link carrying the source, rule and bucket', async () => {
  const items = [{ id: 'destination-phone-data', title: 'Sort your phone and data', why: 'An eSIM can be set up before you leave.', officialUrl: null, partner: { slug: 'yesim', name: 'Yesim', disclosure: 'Sparkfare may earn a commission if you buy through this link, at no extra cost to you.' } }];
  const r = await sendPlanReminderEmail({ email: 'a@example.com', items, stopUrl: 'https://sparkfare.com/api/plan-reminders/stop?token=t', bucket: '11-14' }, env());
  assert.equal(r.ok, true);
  const html = sent.at(-1).html;
  assert.ok(html.indexOf('Sparkfare may earn a commission') < html.indexOf('/out/yesim'));
  assert.match(html, /href="https:\/\/sparkfare\.com\/out\/yesim\?src=away-plan&amp;rule=destination-phone-data&amp;bucket=11-14" rel="sponsored nofollow noopener"/);
  assert.equal(planReminderSubject(items), 'Due: Sort your phone and data');
  assert.equal(planReminderSubject([{ title: 'A' }, { title: 'B' }, { title: 'C' }]), 'Due: A and 2 more');
});

test('a rule the watcher has put on hold since opt-in is left out, and an email with nothing left is skipped', async () => {
  const e = env({ ENABLE_RULE_WATCHER: 'true' });
  await confirmed(e);
  const { keepRuleHeld } = await import('../src/ruleWatcher.js');
  for (const id of ['idp', 'step', 'home-pets', 'home-checkin', 'home-airport-parking', 'usps-hold-mail', 'thailand-arrival-card', 'destination-phone-data', 'home-water-shutoff', 'home-thermostat']) await keepRuleHeld(e, id, null, NOW.toISOString());
  sent.length = 0;
  for (let d = 0; d <= 70; d++) await runPlanReminders(e, { now: day(d) });
  assert.equal(sent.length, 0, 'every item is on hold, so nothing is mailed');
  assert.ok(rows(e, 'away_plan_reminders').every((r) => r.status === 'skipped'));
});

test('nothing goes to an unconfirmed plan, a stopped plan, or after the leaving day; a long-missed reminder is dropped, not sent late', async () => {
  const e = env();
  await optIn(e); // pending
  for (let d = 0; d <= 20; d++) await runPlanReminders(e, { now: day(d) });
  assert.equal(sent.length, 1, 'only the confirmation email');

  const e2 = env();
  await confirmed(e2);
  sent.length = 0;
  await runPlanReminders(e2, { now: day(75) }); // after the leaving day (Dec 20 is day 65)
  assert.equal(sent.length, 0);

  const e3 = env();
  await confirmed(e3);
  sent.length = 0;
  await runPlanReminders(e3, { now: day(48) }); // the first reminder (Nov 29, the driving permit) was due 4 days ago: too late to send
  const lateRows = rows(e3, 'away_plan_reminders');
  assert.ok(lateRows.some((r) => r.status === 'missed'), 'a reminder more than 2 days late is marked missed');
  assert.ok(sent.every((m) => !/International Driving Permit/.test(m.subject)));
});

// ---- stopping ----

test('stopping: the link page changes nothing, the button (or a mail client\'s one-click POST) stops ALL plan emails to the address and no one else\'s', async () => {
  const e = env();
  await confirmed(e);
  await confirmed(e, { ...OPT, destination: 'Tokyo, Japan', departureDate: '2027-02-10', returnDate: '2027-02-20' }, new Date(NOW.getTime() + 3600000 * 2));
  await confirmed(e, { ...OPT, email: 'someone.else@example.com' }, new Date(NOW.getTime() + 3600000 * 4));
  const stopToken = tokenIn(sent[0].html, 'stop');
  const url = 'https://sparkfare.com/api/plan-reminders/stop?token=' + stopToken;
  const opened = await handlePlanStop(new Request(url), e, { now: NOW });
  assert.match(await opened.text(), /Stop plan emails/);
  assert.equal(rows(e, 'away_plans').filter((p) => p.stopped_at).length, 0, 'opening the link stops nothing');

  const oneClick = await handlePlanStop(new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'List-Unsubscribe=One-Click' }), e, { now: NOW });
  assert.equal(oneClick.status, 200);
  const stopped = rows(e, 'away_plans').filter((p) => p.stopped_at);
  assert.deepEqual(stopped.map((p) => p.email), ['traveler@example.com', 'traveler@example.com'], 'both of this address\'s plans, not the other address');
  assert.ok(rows(e, 'away_plan_reminders').filter((r) => stopped.some((p) => p.id === r.plan_id)).every((r) => r.status === 'stopped'));
  sent.length = 0;
  for (let d = 0; d <= 70; d++) await runPlanReminders(e, { now: day(d) });
  assert.ok(sent.length > 0, 'the other address still gets its reminders');
  assert.ok(sent.every((m) => m.to === 'someone.else@example.com'));
  // a bad token stops nothing
  const bad = await handlePlanStop(new Request('https://sparkfare.com/api/plan-reminders/stop?token=junk', { method: 'POST' }), e, { now: NOW });
  assert.match(await bad.text(), /not valid/);
});

// ---- retention ----

test('data is deleted 30 days after the back date, and an unconfirmed plan after a week', async () => {
  const e = env();
  await confirmed(e);                                              // back Jan 2, 2027: delete after Feb 1
  await confirmed(e, { ...OPT, email: 'late@example.com', departureDate: '2026-12-01', returnDate: '2026-12-08' }, new Date(NOW.getTime() + 3600000 * 2));
  await optIn(e, { ...OPT, email: 'pending@example.com' }, new Date(NOW.getTime() + 3600000 * 4));
  assert.equal(rows(e, 'away_plans').length, 3);
  const r1 = await runPlanReminders(e, { now: day(10) });          // Oct 26: the pending plan is still inside its week? created Oct 16, due Oct 23
  assert.equal(r1.purged, 1, 'the unconfirmed plan is past its week');
  assert.deepEqual(rows(e, 'away_plans').map((p) => p.email).sort(), ['late@example.com', 'traveler@example.com']);
  const r2 = await runPlanReminders(e, { now: day(85) });          // Jan 9 2027: the Dec 8 trip is past its 30 days (Jan 7)
  assert.equal(r2.purged, 1);
  assert.deepEqual(rows(e, 'away_plans').map((p) => p.email), ['traveler@example.com']);
  assert.equal(rows(e, 'away_plan_reminders').every((r) => r.plan_id === rows(e, 'away_plans')[0].id), true, 'reminders go with their plan');
  await runPlanReminders(e, { now: day(110) });                    // Feb 3 2027: past Feb 1
  assert.equal(rows(e, 'away_plans').length, 0);
  assert.equal(rows(e, 'away_plan_reminders').length, 0);
});

// ---- the existing 14/7/1 sequence ----

test('a trip with confirmed plan reminders for the same address, country and leaving day is skipped by the 14/7/1 sequence; nothing else is', async () => {
  const e = env();
  await confirmed(e);
  assert.equal(await planCoversTrip(e, 'Traveler@Example.com', 'Phuket, Thailand', '2026-12-20'), true);
  assert.equal(await planCoversTrip(e, 'traveler@example.com', 'Phuket, Thailand', '2026-12-21'), false, 'a different leaving day');
  assert.equal(await planCoversTrip(e, 'traveler@example.com', 'Tokyo, Japan', '2026-12-20'), false, 'a different country');
  assert.equal(await planCoversTrip(e, 'other@example.com', 'Phuket, Thailand', '2026-12-20'), false, 'a different address');
  assert.equal(await planCoversTrip(env({ ENABLE_PLAN_REMINDERS: 'false', DB: e.DB }), 'traveler@example.com', 'Phuket, Thailand', '2026-12-20'), false, 'flag off');
  // pending and stopped plans do not count
  const e2 = env();
  await optIn(e2);
  assert.equal(await planCoversTrip(e2, 'traveler@example.com', 'Phuket, Thailand', '2026-12-20'), false);
  const { res } = await confirmed(e);
  const stop = tokenIn(sent.find((m) => /Confirm your leave-by/.test(m.subject)).html, 'stop');
  await handlePlanStop(new Request('https://sparkfare.com/api/plan-reminders/stop?token=' + stop, { method: 'POST' }), e, { now: NOW });
  assert.equal(await planCoversTrip(e, 'traveler@example.com', 'Phuket, Thailand', '2026-12-20'), false);
  assert.ok(res);
  const src = read('src/index.js');
  const call = src.indexOf('await planCoversTrip(env, trip.email, trip.destination, depDateStr)');
  assert.ok(call > src.indexOf('export async function sendPreDepartureSequenceAlerts'), 'the sequence asks before it sends');
  assert.ok(call < src.indexOf("'SELECT status FROM pre_departure_sequence_deliveries WHERE trip_id = ? AND stage = ? AND status = ?'", call - 3000), 'and before it records a delivery');
});

// ---- the page and the daily run ----

test('the plan page offers reminders only when the status route says so, and sends the dates only when the button is pressed', async () => {
  const page = read('plan.html');
  assert.match(page, /<div id="reminder-box" hidden>/);
  assert.match(page, /if \(j && j\.planReminders\) planRemindersOn = true;/);
  assert.match(page, /\$\('reminder-box'\)\.hidden = !planRemindersOn;/);
  const fn = page.slice(page.indexOf('async function askForReminders()'), page.indexOf("$('rem-go').addEventListener"));
  assert.match(fn, /fetch\('\/api\/plan-reminders\/optin'/);
  assert.match(fn, /JSON\.stringify\(\{ email, \.\.\.lastInputs \}\)/);
  assert.match(page, /\$\('rem-go'\)\.addEventListener\('click', askForReminders\);/);
  // the dates appear in no other request
  const outside = page.replace(fn, '');
  assert.deepEqual([...outside.matchAll(/fetch\(\s*'([^']+)'/g)].map((m) => m[1]), ['/api/events', '/api/leave-by-plan/status']);
  assert.equal([...outside.matchAll(/lastInputs/g)].length, 2, 'lastInputs is declared and built once; only the opt-in reads it');
  assert.match(page, /We don't save this plan unless you ask for reminders below\./);
  assert.match(page, /until 30 days after you're back, then delete them\. At most six emails/);
  assert.doesNotMatch(page, /localStorage|sessionStorage|document\.cookie/);
  const text = page.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ');
  assert.doesNotMatch(text, BANNED);
});

test('the daily run is part of the general scheduled job, and is isolated from the others', () => {
  const src = read('src/index.js');
  const at = src.indexOf('await runPlanReminders(env);');
  assert.ok(at > src.indexOf('async scheduled('));
  assert.match(src.slice(at - 200, at + 200), /try \{[\s\S]*Scheduled plan reminders failed/);
  assert.equal(src.slice(src.indexOf('async scheduled('), at).includes('isEarlyRun) {\n      return'), false);
});

test('no word on the Away Mode banned list is in the new email strings', () => {
  const email = read('src/email.js');
  const block = email.slice(email.indexOf('// Addendum G task G7: the leave-by plan reminder emails'), email.indexOf('// ROADMAP step 65: the weekly standup brief'));
  for (const m of block.matchAll(/(?:"([^"\n]{12,})"|'([^'\n]{12,})')/g)) assert.doesNotMatch(m[1] || m[2], BANNED, m[1] || m[2]);
  const mod = read('src/planReminders.js');
  for (const m of mod.matchAll(/(?:page|paragraphHtml)\('([^']+)'/g)) assert.doesNotMatch(m[1], BANNED, m[1]);
  assert.ok(typeof buildSchedule === 'function');
});

// Every inline script the plan and passport pages ship must at least parse. (A stray apostrophe in one string once stopped the whole
// page's script while every text-matching test still passed.)
test('the inline scripts of the plan and passport pages, and the shared browser files, are valid JavaScript', async () => {
  const vm = await import('node:vm');
  const parse = (name, code) => {
    const body = code.replace(/^\s*import\s[^;]+;\s*$/gm, '').replace(/^\s*export\s+(async\s+)?(function|const|let|class)/gm, '$1$2');
    assert.doesNotThrow(() => new vm.Script('(async () => {\n' + body + '\n})', { filename: name }), name);
  };
  for (const f of ['plan.html', 'passport.html']) {
    const scripts = [...read(f).matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map((m) => m[1]).filter((c) => c.trim());
    assert.ok(scripts.length >= 1, f);
    scripts.forEach((c, i) => parse(`${f}#${i}`, c));
  }
  for (const f of ['plan-entry.js', 'passport-ui.js', 'leave-by-rules.js']) parse(f, read(f));
});
