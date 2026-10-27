// Addendum P, P2 follow-up: the national calendar file and share card for /time-off (no airport chosen).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import satori from 'satori';
import worker, { ptoOgHtml } from '../src/index.js';
import { ptoCardText, nationalPlanUrl, DEFAULT_BUDGET } from '../src/ptoPages.js';
import { makeSqliteD1 } from './helpers/sqliteD1.js';

const ON = { ENABLE_PTO_CALENDAR: 'true', APP_URL: 'https://sparkfare.com' };
const CHROME = { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' };
const ctx = { waitUntil: () => {} };
const get = (path, env = ON, init = {}) => worker.fetch(new Request(`https://sparkfare.com${path}`, { redirect: 'manual', ...init }), env, ctx);

test('the national .ics is a calendar with one all-day event per window and no airport', async () => {
  const res = await get('/time-off.ics?budget=8');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('Content-Type'), /^text\/calendar/);
  assert.match(res.headers.get('Content-Disposition'), /attachment; filename="sparkfare-long-weekends\.ics"/);
  const body = await res.text();
  assert.match(body, /^BEGIN:VCALENDAR\r\n/);
  assert.match(body, /X-WR-CALNAME:Sparkfare long weekends\r\n/);
  const events = body.match(/BEGIN:VEVENT/g) || [];
  assert.ok(events.length >= 3);
  assert.equal((body.match(/END:VEVENT/g) || []).length, events.length);
  assert.match(body, /DTSTART;VALUE=DATE:\d{8}/);
  assert.match(body, /URL:https:\/\/sparkfare\.com\/time-off\r\n/);
  assert.doesNotMatch(body, /undefined|null|from (SEA|JFK|DEN)/);
  assert.match(body, /UID:\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}-us@sparkfare\.com/);
});

test('the national .ics follows the budget and the holiday set, like the airport one', async () => {
  const count = async (q) => ((await (await get(`/time-off.ics${q}`)).text()).match(/BEGIN:VEVENT/g) || []).length;
  assert.ok((await count('?budget=0')) < (await count('?budget=20')) || (await count('?budget=0')) <= (await count('?budget=20')));
  assert.notEqual(await count('?budget=0&h=1'), await count('?budget=20'));
  const sea = (await (await get('/time-off/sea.ics?budget=8')).text()).match(/DTSTART;VALUE=DATE:\d{8}/g);
  const us = (await (await get('/time-off.ics?budget=8')).text()).match(/DTSTART;VALUE=DATE:\d{8}/g);
  assert.deepEqual(us, sea, 'same windows as an airport page for the same plan');
});

test('the .ics route obeys the flag and the method', async () => {
  for (const env of [{}, { ENABLE_PTO_CALENDAR: 'false' }, { ENABLE_PTO_CALENDAR: 'TRUE' }]) assert.equal((await get('/time-off.ics', env)).status, 404);
  assert.equal((await get('/time-off.ics', ON, { method: 'POST' })).status, 405);
  assert.equal((await get('/time-off.ics', ON, { method: 'HEAD' })).status, 200);
});

test('no airport: the page offers the calendar file and the share button, with budget and holidays only in the URLs', async () => {
  const html = await (await get('/time-off?budget=7&h=2uh')).text();
  assert.match(html, /id="ics-link" href="\/time-off\.ics\?budget=7&h=2uh" rel="nofollow"/);
  assert.match(html, /id="share-btn" data-url="https:\/\/sparkfare\.com\/time-off\?budget=7&amp;h=2uh" data-text="\d+ PTO days, \d+ days off"/);
  assert.ok(!/data-text="[^"]* from /.test(html));
  const bare = await (await get('/time-off')).text();
  assert.match(bare, /id="ics-link" href="\/time-off\.ics"/);
  assert.match(bare, /data-url="https:\/\/sparkfare\.com\/time-off"/);
  assert.match(bare, /<meta property="og:image" content="https:\/\/sparkfare\.com\/og\/time-off\.png" \/>/);
  assert.doesNotMatch(bare + html, /time-off[^"]*\d{4}-\d{2}-\d{2}/);
});

test('with an airport chosen, the airport calendar and share link are used, not the national ones', async () => {
  const html = await (await get('/time-off?from=sea&budget=7')).text();
  assert.match(html, /id="ics-link" href="\/time-off\/sea\.ics/);
  assert.match(html, /data-url="https:\/\/sparkfare\.com\/time-off\/sea/);
});

test('nationalPlanUrl keeps defaults bare', () => {
  assert.equal(nationalPlanUrl('https://x'), 'https://x/time-off');
  assert.equal(nationalPlanUrl('https://x', { suffix: '.ics' }), 'https://x/time-off.ics');
  assert.equal(nationalPlanUrl('https://x', { budget: 5, code: 'abc' }), 'https://x/time-off?budget=5&h=abc');
});

test('the national share card has the totals for the default budget, no city and no fare', async () => {
  const card = ptoCardText({ origin: null, budget: DEFAULT_BUDGET, keys: undefined, now: new Date('2026-10-27T12:00:00Z') });
  assert.equal(card.city, null);
  assert.ok(card.ptoUsed > 0 && card.daysOff > card.ptoUsed);
  const font = fs.readFileSync(new URL('../src/assets/Inter-Medium.ttf', import.meta.url));
  const svg = await satori(ptoOgHtml(card), { width: 1200, height: 630, embedFont: false, fonts: [{ name: 'Inter', data: font, weight: 500, style: 'normal' }] });
  const text = svg.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  for (const part of ['Long', 'weekends', 'PTO', 'planner', String(card.ptoUsed), String(card.daysOff), 'off']) assert.ok(text.includes(part), part);
  assert.doesNotMatch(text, /\$|undefined|null/);
  assert.doesNotMatch(text, /Long weekends from/);
});

test('the airport card still says "from <city>"', async () => {
  const svg = await satori(ptoOgHtml({ city: 'Denver', ptoUsed: 10, daysOff: 42 }), { width: 1200, height: 630, embedFont: false, fonts: [{ name: 'Inter', data: fs.readFileSync(new URL('../src/assets/Inter-Medium.ttf', import.meta.url)), weight: 500, style: 'normal' }] });
  assert.match(svg.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '), /from Denver/);
});

test('/og/time-off.png: 404 with the flag off and for lookalike paths; the airport card routes still 404 for TLV', async () => {
  assert.equal((await get('/og/time-off.png', {})).status, 404);
  for (const p of ['/og/time-off.jpg', '/og/time-off/.png', '/og/time-off/tlv.png', '/og/time-off']) assert.equal((await get(p)).status, 404, p);
});

test('the routes are listed for the Worker', () => {
  const cfg = fs.readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
  assert.match(cfg, /"\/time-off\.ics",/);
});

function eventsEnv() {
  const db = makeSqliteD1(['migrations/0000_base_schema.sql', 'migrations/0013_events.sql']);
  const tasks = [];
  return { env: { ...ON, DB: db }, db, ctx: { waitUntil: (p) => tasks.push(p) }, flush: () => Promise.all(tasks) };
}
const ev = (db) => db.raw.prepare("SELECT event_type, origin, source, meta FROM events WHERE event_type LIKE 'pto%' ORDER BY id").all();

test('a national .ics download logs pto_ics_download tagged index; a crawler logs nothing', async () => {
  const t = eventsEnv();
  await worker.fetch(new Request('https://sparkfare.com/time-off.ics', { headers: CHROME }), t.env, t.ctx);
  await worker.fetch(new Request('https://sparkfare.com/time-off.ics', { headers: { 'User-Agent': 'curl/8.0' } }), t.env, t.ctx);
  await t.flush();
  const rows = ev(t.db);
  assert.deepEqual(rows.map((r) => [r.event_type, r.origin, r.source]), [['pto_ics_download', null, 'index']]);
});

test('the share beacon from the national page carries the index surface and no airport', async () => {
  const html = await (await get('/time-off')).text();
  assert.match(html, /meta: ORIGIN \? \(meta \|\| null\) : Object\.assign\(\{ surface: 'index' \}, meta \|\| \{\}\)/);
  const t = eventsEnv();
  const res = await worker.fetch(new Request('https://sparkfare.com/api/events', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_type: 'pto_share', origin: null, source: 'pto', meta: { surface: 'index', channel: 'copy' } }),
  }), t.env, t.ctx);
  assert.equal(res.status, 200);
  await t.flush();
  const row = ev(t.db).find((r) => r.event_type === 'pto_share');
  assert.equal(row.origin, null);
  assert.deepEqual(JSON.parse(row.meta), { surface: 'index', channel: 'copy' });
});
