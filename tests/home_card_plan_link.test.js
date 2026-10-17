import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { logEvent } from '../src/index.js';
import { handlePlanOptin, handlePlanConfirm, handlePlanStop, signPlanToken } from '../src/planReminders.js';
import { handleCardCreate, homeCardSummary } from '../src/homeCard.js';
import { _resetSendingGuardForTests } from '../src/email.js';

// Addendum G task G9 follow-up: a Home card is tied to a leave-by plan only through the signed link on the reminders confirm page.

const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const SECRET = 'test-secret-for-plan-tokens';
const NOW = new Date('2026-10-16T08:00:00Z');
const CARD = { leaveDate: '2026-12-20', backDate: '2027-01-02', tasks: [{ text: 'Feed the cat', when: 'daily' }], notes: [{ label: 'Vet', text: 'Dr Lee' }] };
const OPT = { email: 'traveler@example.com', destination: 'Phuket, Thailand', departureDate: '2026-12-20', returnDate: '2027-01-02', origin: 'LAX', answers: { pet_home: 'no', keeper: 'no', driving: 'no', airport_parking: 'no' } };

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

const env = (extra = {}) => ({ DB: makeDb(), UNSUBSCRIBE_SECRET: SECRET, RESEND_API_KEY: 'k', ENABLE_LEAVE_BY_PLAN: 'true', ENABLE_PLAN_REMINDERS: 'true', ENABLE_HOME_CARD: 'true', ...extra });
const optin = (body) => new Request('https://sparkfare.com/api/plan-reminders/optin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const cardReq = (body) => new Request('https://sparkfare.com/api/home-card', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

// Opts in and confirms; returns the confirm page's HTML.
async function confirmPage(e) {
  await handlePlanOptin(optin(OPT), e, { now: NOW });
  const html = sent.filter((m) => /Confirm your leave-by/.test(m.subject)).at(-1).html;
  const token = new URL(html.match(/https:\/\/sparkfare\.com\/api\/plan-reminders\/confirm\?token=[^"'\s<]+/)[0]).searchParams.get('token');
  const res = await handlePlanConfirm(new Request('https://sparkfare.com/api/plan-reminders/confirm?token=' + token, { method: 'POST' }), e, { now: NOW, logEvent });
  return res.text();
}
const planToken = (page) => new URL('https://sparkfare.com' + page.match(/href="(\/home-card\?plan=[^"]+)"/)[1].replace(/&amp;/g, '&')).searchParams.get('plan');
const planId = (e) => e.DB.raw.prepare('SELECT id FROM away_plans').get().id;
const cards = (e) => e.DB.raw.prepare('SELECT plan_id FROM home_cards').all();
const makeCard = async (e, extra = {}) => (await handleCardCreate(cardReq({ ...CARD, ...extra }), e, { now: NOW, logEvent })).json();

test('the confirm page links to the card maker with a signed token, and the token holds no date or address', async () => {
  const e = env();
  const page = await confirmPage(e);
  const token = planToken(page);
  assert.ok(token);
  assert.ok(!/20\d\d-\d\d-\d\d/.test(token) && !token.includes('traveler'));
  assert.equal(page.includes('Make a Home card'), true);
});

test('a card made through that link is tied to the plan, and the evening email can mention it', async () => {
  const e = env();
  const token = planToken(await confirmPage(e));
  const j = await makeCard(e, { planToken: token });
  assert.equal(j.ok, true);
  assert.deepEqual(cards(e).map((c) => c.plan_id), [planId(e)]);
  const s = await homeCardSummary(e, { id: planId(e) });
  assert.match(s.lines[0], /1 task and 1 note/);
  assert.ok(!JSON.stringify(s).includes('cat'));
});

test('no token, a forged token, a wrong-kind token or garbage leaves the card unlinked, with the same answer', async () => {
  const e = env();
  await confirmPage(e);
  const id = planId(e);
  const wrongKind = await signPlanToken(SECRET, 'confirm', id);
  const forged = await signPlanToken('some-other-secret', 'card', id);
  const outcomes = [];
  for (const planToken of [undefined, '', 'nonsense', forged, wrongKind, 42]) {
    const j = await makeCard(e, { planToken });
    outcomes.push(Object.keys(j).sort().join());
  }
  assert.equal(new Set(outcomes).size, 1, 'the response shape never reveals whether the link worked');
  assert.deepEqual(cards(e).map((c) => c.plan_id), [null, null, null, null, null, null]);
});

test('a plan that was never confirmed, was stopped, or does not exist cannot be linked', async () => {
  const e = env();
  await handlePlanOptin(optin(OPT), e, { now: NOW }); // pending, not confirmed
  const id = planId(e);
  const t = await signPlanToken(SECRET, 'card', id);
  await makeCard(e, { planToken: t });
  assert.equal(cards(e)[0].plan_id, null, 'pending plan');

  const e2 = env();
  const page = await confirmPage(e2);
  const stopTok = await signPlanToken(SECRET, 'stop', planId(e2));
  await handlePlanStop(new Request('https://sparkfare.com/api/plan-reminders/stop?token=' + stopTok, { method: 'POST' }), e2, { now: NOW });
  await makeCard(e2, { planToken: planToken(page) });
  assert.equal(cards(e2)[0].plan_id, null, 'stopped plan');

  await makeCard(e2, { planToken: await signPlanToken(SECRET, 'card', 'f'.repeat(32)) });
  assert.equal(cards(e2).at(-1).plan_id, null, 'unknown plan');
});

test('with the Home card flag off the confirm page has no card link', async () => {
  const e = env({ ENABLE_HOME_CARD: 'false' });
  assert.equal((await confirmPage(e)).includes('home-card'), false);
});

test('the card page reads the token, keeps it out of the address bar and out of referrers', () => {
  const html = read('home-card.html');
  assert.match(html, /name="referrer" content="no-referrer"/);
  assert.match(html, /get\('plan'\)/);
  assert.match(html, /history\.replaceState\(null, '', location\.pathname\)/);
  assert.match(html, /body\.planToken = planToken/);
});
