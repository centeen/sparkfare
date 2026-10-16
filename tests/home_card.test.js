import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker, { logEvent } from '../src/index.js';
import {
  validateCard, looksLikeSecret, hashSecret, newSecret, handleCardCreate, handleCardRemove, handleCardView, purgeHomeCards, homeCardSummary,
  renderCardHtml, tasksBucket, HOME_CARD, CODE_REFUSAL, INACTIVE_MESSAGE,
} from '../src/homeCard.js';
import { planEventMeta } from '../src/planEvents.js';

// Addendum G task G9 (ROADMAP step 95): the Home card, behind ENABLE_HOME_CARD ("false").

const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const NOW = new Date('2026-12-01T10:00:00Z');
const BODY = { leaveDate: '2026-12-20', backDate: '2027-01-02', tasks: [{ text: 'Feed the cat', when: 'daily' }, { text: 'Trash day', when: '2026-12-24' }], notes: [{ label: 'Vet', text: 'Dr Lee 555-0101' }] };

function makeDb() {
  const raw = new DatabaseSync(':memory:');
  const stmt = (sql, p) => ({
    run: async () => { const r = raw.prepare(sql).run(...p); return { success: true, meta: { changes: Number(r.changes) } }; },
    first: async () => raw.prepare(sql).get(...p) ?? null,
    all: async () => ({ results: raw.prepare(sql).all(...p) }),
  });
  return { raw, prepare: (sql) => ({ ...stmt(sql, []), bind: (...p) => stmt(sql, p) }) };
}
const env = (extra = {}) => ({ DB: makeDb(), ENABLE_LEAVE_BY_PLAN: 'true', ENABLE_HOME_CARD: 'true', ...extra });
const post = (body) => new Request('https://sparkfare.com/api/home-card', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const get = (path) => new Request('https://sparkfare.com' + path);
const events = (e) => { try { return e.DB.raw.prepare('SELECT event_type, source, meta FROM events').all(); } catch { return []; } };
async function make(e, body = BODY, now = NOW) {
  const r = await handleCardCreate(post(body), e, { now, logEvent });
  return { status: r.status, j: await r.json() };
}
const tokenOf = (url) => new URL(url).pathname.split('/').pop();

// ---- the code and password rule ----

test('text that looks like a code or a password is refused', () => {
  for (const t of ['alarm code is 1234', 'Alarm PIN 9', 'door-code 55', 'the gate pin', 'garage code', 'lock code', 'Key box code 12', 'keybox pin', 'wifi password hunter2', 'Wi-Fi password', 'wi fi pw', 'WIFI PW', 'alarm: code 1']) {
    assert.equal(looksLikeSecret(t), true, t);
  }
  for (const t of ['Feed the cat', 'The gate is blue', 'Water the plants', 'Vet: Dr Lee', 'Key is under the mat', 'Wi-Fi router is in the hall']) {
    assert.equal(looksLikeSecret(t), false, t);
  }
});

test('a task or a note that holds a code is refused with the exact sentence, and nothing is stored', async () => {
  const e = env();
  for (const bad of [
    { ...BODY, tasks: [{ text: 'Alarm code 4411', when: 'daily' }] },
    { ...BODY, notes: [{ label: 'Wifi password', text: 'abc' }] },
    { ...BODY, notes: [{ label: 'Note', text: 'the garage pin is 1' }] },
  ]) {
    const r = await make(e, bad);
    assert.equal(r.status, 400);
    assert.equal(r.j.error, CODE_REFUSAL);
  }
  assert.equal(CODE_REFUSAL, "Please don't put codes or passwords here. Share those in person.");
  assert.equal(e.DB.raw.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name = 'home_cards'").get().n, 0);
});

// ---- validation ----

test('validation: dates, counts and lengths', () => {
  const v = (b, today = '2026-12-01') => validateCard(b, today);
  assert.equal(v(BODY).ok, true);
  assert.equal(v({ ...BODY, backDate: '2026-12-19' }).ok, false, 'back before leave');
  assert.equal(v(BODY, '2027-01-03').ok, false, 'back date passed');
  assert.equal(v({ ...BODY, tasks: [] }).ok, false);
  assert.equal(v({ ...BODY, tasks: Array.from({ length: 31 }, () => ({ text: 'x', when: 'daily' })) }).ok, false);
  assert.equal(v({ ...BODY, tasks: [{ text: 'x', when: '2026-12-19' }] }).ok, false, 'task day before the trip');
  assert.equal(v({ ...BODY, tasks: [{ text: 'x', when: '2027-01-03' }] }).ok, false, 'task day after the trip');
  assert.equal(v({ ...BODY, tasks: [{ text: 'x', when: 'tomorrow' }] }).ok, false);
  assert.equal(v({ ...BODY, tasks: [{ text: '   ', when: 'daily' }] }).ok, false);
  assert.equal(v({ ...BODY, leaveDate: '2026-12-01', backDate: '2027-06-01' }).ok, false, 'trip too long');
  assert.equal(v({ ...BODY, leaveDate: '2027-03-01', backDate: '2027-03-05' }, '2026-01-01').ok, false, 'too far ahead');
  const long = v({ ...BODY, tasks: [{ text: 'a'.repeat(500), when: 'daily' }] });
  assert.equal(long.card.tasks[0].text.length, HOME_CARD.MAX_TASK_CHARS);
  assert.equal(v({ ...BODY, tasks: [{ text: '<script>alert(1)</script>Feed', when: 'daily' }] }).card.tasks[0].text.includes('<'), false);
  assert.equal(tasksBucket(1), '1-3'); assert.equal(tasksBucket(4), '4-9'); assert.equal(tasksBucket(10), '10+');
});

// ---- the link ----

test('the link is a random 192-bit token; only hashes are stored', async () => {
  const e = env();
  const a = await make(e); const b = await make(e);
  const va = tokenOf(a.j.viewUrl);
  assert.match(va, /^[A-Za-z0-9_-]{32}$/); // 24 random bytes
  assert.notEqual(va, tokenOf(b.j.viewUrl));
  assert.notEqual(va, new URL(a.j.removeUrl).searchParams.get('token'), 'view and remove secrets differ');
  const stored = JSON.stringify(e.DB.raw.prepare('SELECT * FROM home_cards').all());
  assert.ok(!stored.includes(va), 'the view token is not stored');
  assert.ok(!stored.includes(new URL(a.j.removeUrl).searchParams.get('token')));
  assert.ok(!/\/card\/.*\d{4}-\d{2}-\d{2}/.test(a.j.viewUrl), 'no date in the link');
  assert.equal(a.j.viewUrl.startsWith('https://sparkfare.com/card/'), true);
  assert.equal(new Set(Array.from({ length: 50 }, () => newSecret())).size, 50);
  assert.equal(await hashSecret('x'), await hashSecret('x'));
});

test('the card page: tasks with dates, notes, print layout, noindex everywhere, no links', async () => {
  const e = env(); const { j } = await make(e);
  const res = await handleCardView(get('/card/x'), e, tokenOf(j.viewUrl), { now: NOW, logEvent });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('X-Robots-Tag'), /noindex/);
  assert.match(res.headers.get('Cache-Control'), /no-store/);
  const html = await res.text();
  assert.match(html, /<meta name="robots" content="noindex/);
  assert.match(html, /Feed the cat/); assert.match(html, /Trash day/); assert.match(html, /Dr Lee 555-0101/);
  assert.match(html, /Every day/); assert.match(html, /Thu, Dec 24/);
  assert.match(html, /@media print/);
  assert.doesNotMatch(html, /<a\b|href=|\/out\/|\/go\/|aviasales|sparkfare\.com|sign ?up|subscribe/i, 'no links, no partner links, no signup prompt');
});

test('the card text is escaped', () => {
  const html = renderCardHtml({ leaveDate: '2026-12-20', backDate: '2027-01-02', tasks: [{ text: '"><img src=x onerror=1>', when: 'daily' }], notes: [{ label: '<b>', text: '&' }] });
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;b&gt;/);
});

test('an unknown, malformed, expired and removed card all say the same thing', async () => {
  const e = env(); const { j } = await make(e);
  const tok = tokenOf(j.viewUrl);
  const msg = async (t, now = NOW) => { const r = await handleCardView(get('/card/' + t), e, t, { now, logEvent }); return [r.status, (await r.text()).includes(INACTIVE_MESSAGE)]; };
  assert.deepEqual(await msg(tok), [200, false]);
  assert.deepEqual(await msg('A'.repeat(32)), [404, true], 'unknown');
  assert.deepEqual(await msg('short'), [404, true], 'malformed');
  assert.deepEqual(await msg(tok, new Date('2027-01-09T10:00:00Z')), [200, false], 'on the last day it still works');
  assert.deepEqual(await msg(tok, new Date('2027-01-10T10:00:00Z')), [404, true], 'expired 7 days after the back date');
  assert.equal(INACTIVE_MESSAGE, 'This card is no longer active.');
  await handleCardRemove(new Request(j.removeUrl, { method: 'POST' }), e, { now: NOW });
  assert.deepEqual(await msg(tok), [404, true], 'removed');
});

test('removing: GET only shows a button, POST removes and clears the content', async () => {
  const e = env(); const { j } = await make(e);
  const g = await handleCardRemove(new Request(j.removeUrl), e, { now: NOW });
  assert.equal(g.status, 200);
  assert.match(await g.text(), /<form method="post"/);
  assert.equal(e.DB.raw.prepare('SELECT removed_at FROM home_cards').get().removed_at, null, 'a GET changes nothing');
  const p = await handleCardRemove(new Request(j.removeUrl, { method: 'POST' }), e, { now: NOW });
  assert.equal(p.status, 200);
  const row = e.DB.raw.prepare('SELECT * FROM home_cards').get();
  assert.ok(row.removed_at); assert.equal(row.tasks_json, '[]'); assert.equal(row.notes_json, '[]');
  assert.equal((await handleCardRemove(new Request('https://sparkfare.com/api/home-card/remove?token=' + tokenOf(j.viewUrl), { method: 'POST' }), e)).status, 404, 'the view token cannot remove');
  assert.equal((await handleCardRemove(new Request('https://sparkfare.com/api/home-card/remove?token=bad', { method: 'POST' }), e)).status, 400);
});

// ---- events ----

test('events: a bucket at creation, a bare count on open, nothing about the card or the link', async () => {
  const e = env(); const { j } = await make(e);
  await handleCardView(get('/card/x'), e, tokenOf(j.viewUrl), { now: NOW, logEvent });
  await handleCardView(get('/card/x'), e, tokenOf(j.viewUrl), { now: NOW, logEvent });
  await handleCardView(get('/card/x'), e, 'A'.repeat(32), { now: NOW, logEvent }); // unknown: not counted
  const ev = events(e);
  assert.deepEqual(ev.map((x) => x.event_type), ['homecard_created', 'homecard_open', 'homecard_open']);
  assert.deepEqual(JSON.parse(ev[0].meta), { tasks_bucket: '1-3' });
  assert.deepEqual(JSON.parse(ev[1].meta), {});
  const all = JSON.stringify(ev);
  assert.ok(!all.includes(tokenOf(j.viewUrl)) && !all.includes('cat') && !/\d{4}-\d{2}-\d{2}/.test(all.replace(/"ts":"[^"]*"/g, '')));
  assert.deepEqual(planEventMeta('homecard_open', { token: 'abc' }), {});
});

test('a browser cannot send the Home card events', async () => {
  const e = env();
  for (const t of ['homecard_created', 'homecard_open']) {
    await worker.fetch(new Request('https://sparkfare.com/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event_type: t, meta: { tasks_bucket: '4-9' } }) }), e, { waitUntil() {} });
  }
  assert.equal(events(e).filter((x) => x.event_type.startsWith('homecard')).length, 0);
});

// ---- flag off ----

test('flag off: every Home card route is a 404 and nothing is created or stored', async () => {
  for (const extra of [{ ENABLE_HOME_CARD: 'false' }, { ENABLE_HOME_CARD: undefined }, { ENABLE_LEAVE_BY_PLAN: 'false' }]) {
    const e = env(extra);
    const ctx = { waitUntil() {} };
    assert.equal((await worker.fetch(post(BODY), e, ctx)).status, 404);
    assert.equal((await worker.fetch(get('/card/' + 'A'.repeat(32)), e, ctx)).status, 404);
    assert.equal((await worker.fetch(get('/home-card'), e, ctx)).status, 404);
    assert.equal((await worker.fetch(get('/api/home-card/remove?token=' + 'A'.repeat(32)), e, ctx)).status, 404);
    assert.equal(e.DB.raw.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name = 'home_cards'").get().n, 0);
  }
  assert.match(read('wrangler.jsonc'), /"ENABLE_HOME_CARD": "false"/);
});

test('flag on: the routes work through the Worker', async () => {
  const e = env({ ASSETS: { fetch: async () => new Response('<html>form</html>') } });
  const ctx = { waitUntil() {} };
  assert.equal((await worker.fetch(get('/home-card'), e, ctx)).status, 200);
  const c = await worker.fetch(post({ ...BODY, leaveDate: '2099-01-01', backDate: '2099-01-03', tasks: [{ text: 'x', when: 'daily' }] }), e, ctx);
  assert.equal(c.status, 400, 'too far ahead');
  assert.equal((await worker.fetch(get('/card/' + 'A'.repeat(32)), e, ctx)).status, 404);
});

// ---- housekeeping ----

test('purge: an expired card is deleted the day after, a live one is kept, a removed one goes at once', async () => {
  const e = env();
  const a = await make(e); const b = await make(e, { ...BODY, leaveDate: '2027-02-01', backDate: '2027-02-05', tasks: [{ text: 'Feed', when: 'daily' }] });
  assert.equal(b.status, 200);
  const c = await make(e);
  await handleCardRemove(new Request(c.j.removeUrl, { method: 'POST' }), e, { now: NOW });
  await purgeHomeCards(e, { now: new Date('2027-01-09T10:00:00Z') });
  assert.equal(e.DB.raw.prepare('SELECT count(*) AS n FROM home_cards').get().n, 2, 'removed one is gone; expired one (expires 01-09) stays one more day');
  await purgeHomeCards(e, { now: new Date('2027-01-10T10:00:00Z') });
  assert.equal(e.DB.raw.prepare('SELECT count(*) AS n FROM home_cards').get().n, 2, 'expired cards are deleted a day after they expire');
  await purgeHomeCards(e, { now: new Date('2027-01-11T10:00:00Z') });
  assert.equal(e.DB.raw.prepare('SELECT count(*) AS n FROM home_cards').get().n, 1);
  assert.ok(a && b);
});

test('the summary for the evening email: counts only, null when there is no card', async () => {
  const e = env(); await make(e);
  assert.equal(await homeCardSummary(e, { id: 'p1' }), null);
  e.DB.raw.prepare("UPDATE home_cards SET plan_id = 'p1'").run();
  const s = await homeCardSummary(e, { id: 'p1' });
  assert.match(s.lines[0], /2 tasks and 1 note/);
  assert.ok(!JSON.stringify(s).includes('cat'));
  assert.equal(await homeCardSummary(env({ ENABLE_HOME_CARD: 'false' }), { id: 'p1' }), null);
});

// ---- copy, privacy, robots ----

test('privacy page, robots and the creation page', () => {
  assert.match(read('privacy.html'), /Home card/);
  assert.match(read('robots.txt'), /Disallow: \/card\//);
  const page = read('home-card.html');
  assert.match(page, /Please don't put codes or passwords here\. Share those in person\./);
  assert.match(page, /<meta name="robots" content="noindex">/);
  assert.doesNotMatch(page, /\b(book|booking|secured?|protect|safe|vetted|guarantee|hurry|countdown)\b/i);
  for (const m of page.matchAll(/<script>([\s\S]*?)<\/script>/g)) assert.doesNotThrow(() => new Function(m[1]));
  assert.match(read('wrangler.jsonc'), /"\/card\/\*"/);
});
