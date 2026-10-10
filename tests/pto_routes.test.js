// PTO calendar routes (ROADMAP step 72): the flag, the US origins, canonical and variant handling, the .ics download,
// events (bots excluded), the sitemap, the share card and the rendered copy.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import satori from 'satori';
import worker, { ptoOgHtml } from '../src/index.js';
import { PTO_ORIGINS, renderTimeOffOrigin, renderTimeOffIndex, routePagePath, destinationSlug, parseBudget } from '../src/ptoPages.js';
import { scanText, loadAllowlist } from '../scripts/check-referral-copy.js';
import { makeSqliteD1 } from './helpers/sqliteD1.js';

const ctx = { waitUntil: () => {} };
const ON = { ENABLE_PTO_CALENDAR: 'true', APP_URL: 'https://sparkfare.com' };
const get = (path, env = ON, init = {}) => worker.fetch(new Request(`https://sparkfare.com${path}`, { redirect: 'manual', ...init }), env, ctx);
const CHROME = { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' };

test('flag off: every /time-off path, the .ics and the share card are 404', async () => {
  for (const path of ['/time-off', '/time-off/', '/time-off/den', '/time-off/den.ics', '/time-off/den?budget=5', '/og/time-off/den.png']) {
    for (const env of [{}, { ENABLE_PTO_CALENDAR: 'false' }, { ENABLE_PTO_CALENDAR: 'TRUE' }, { ENABLE_PTO_CALENDAR: '1' }]) {
      assert.equal((await get(path, env)).status, 404, `${path} ${JSON.stringify(env)}`);
    }
  }
});

test('flag on: the index and each of the US origins return 200 with real content', async () => {
  const index = await get('/time-off');
  assert.equal(index.status, 200);
  assert.match(await index.text(), /<h1>Long weekends and PTO planner/);
  assert.ok(PTO_ORIGINS.length >= 15 && !PTO_ORIGINS.includes('TLV'));
  for (const origin of PTO_ORIGINS) {
    const res = await get(`/time-off/${origin.toLowerCase()}`);
    assert.equal(res.status, 200, origin);
    const html = await res.text();
    assert.match(html, /<h1>Long weekends from [^<]+: 2026-2027<\/h1>/, origin);
    assert.ok((html.match(/class="block"/g) || []).length >= 3, `${origin} has a plan`);
    assert.match(html, /\d+ PTO days?, \d+ days off/);
    assert.ok(html.includes('Fares appear here as we see them.'));
  }
});

test('TLV, unknown and malformed paths are 404; an uppercase code redirects to the lowercase page', async () => {
  for (const path of ['/time-off/tlv', '/time-off/zzz', '/time-off/den/extra', '/time-off/de', '/time-off/denver', '/time-off/den.png', '/time-off/..', '/og/time-off/tlv.png']) {
    assert.equal((await get(path)).status, 404, path);
  }
  const up = await get('/time-off/DEN?budget=5');
  assert.equal(up.status, 301);
  assert.equal(up.headers.get('Location'), '/time-off/den?budget=5');
  assert.equal((await get('/time-off/den', ON, { method: 'POST' })).status, 405);
});

test('the canonical is always the bare origin URL; variants are noindex and the bare page is indexable', async () => {
  const bare = await (await get('/time-off/den')).text();
  const variant = await (await get('/time-off/den?budget=5&h=2uh')).text();
  for (const html of [bare, variant]) assert.match(html, /<link rel="canonical" href="https:\/\/sparkfare\.com\/time-off\/den" \/>/);
  assert.match(bare, /<meta name="robots" content="index, follow" \/>/);
  assert.match(variant, /<meta name="robots" content="noindex, follow" \/>/);
  assert.match(bare, /<meta property="og:image" content="https:\/\/sparkfare\.com\/og\/time-off\/den\.png" \/>/);
});

test('the budget and holiday set change the plan server-side; bad values fall back', async () => {
  const text = async (p) => (await get(p)).text();
  assert.match(await text('/time-off/den?budget=0&h=2uh'), /0 PTO days, \d+ days off/);
  assert.match(await text('/time-off/den?budget=30&h=2uh'), /(2[0-9]|30) PTO days?, \d+ days off/);
  assert.equal(parseBudget('abc'), 10); assert.equal(parseBudget('31'), 10); assert.equal(parseBudget('-1'), 10); assert.equal(parseBudget('4.5'), 10); assert.equal(parseBudget('7'), 7);
  assert.equal((await get('/time-off/den?budget=abc&h=%3Cscript%3E')).status, 200);
  assert.match(await text('/time-off/den?budget=10&h=0'), /No long weekend fits 10 PTO days with this holiday set/);
});

test('the holiday form redirects to the compact canonical URL', async () => {
  const picked = await get('/time-off/den?hs=1&budget=7&hk=new_year&hk=labor');
  assert.equal(picked.status, 303);
  const loc = picked.headers.get('Location');
  assert.match(loc, /^\/time-off\/den\?budget=7&h=[0-9a-z]+$/);
  assert.equal((await get(loc)).status, 200);
  const defaults = await get('/time-off/den?hs=1&budget=10&hk=new_year&hk=memorial&hk=independence&hk=labor&hk=thanksgiving&hk=day_after_thanksgiving&hk=christmas');
  assert.equal(defaults.headers.get('Location'), '/time-off/den', 'the default plan has the bare URL');
});

test('.ics download: calendar content type, attachment, parseable, respects the plan, no fares', async () => {
  const res = await get('/time-off/den.ics?budget=10&h=2uh');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('Content-Type'), /^text\/calendar; charset=utf-8/);
  assert.match(res.headers.get('Content-Disposition'), /^attachment; filename="sparkfare-long-weekends-den\.ics"$/);
  const text = await res.text();
  assert.ok(text.startsWith('BEGIN:VCALENDAR\r\n') && text.endsWith('END:VCALENDAR\r\n'));
  assert.ok((text.match(/BEGIN:VEVENT/g) || []).length >= 3);
  assert.doesNotMatch(text, /\$\d/);
  const zero = await (await get('/time-off/den.ics?budget=0')).text();
  assert.ok((zero.match(/BEGIN:VEVENT/g) || []).length > 0 && !/request off/.test(zero), 'budget 0 gives only free weekends');
});

test('the shared-link controls never put the plan in a URL beyond budget and holiday code', async () => {
  const html = await (await get('/time-off/den?budget=12&h=2uh')).text();
  const share = /data-url="([^"]+)"/.exec(html)[1];
  assert.match(share, /^https:\/\/sparkfare\.com\/time-off\/den\?budget=12&amp;h=2uh$/);
});

// ---- events -------------------------------------------------------------------------------------------------

function eventsEnv() {
  const db = makeSqliteD1(['migrations/0000_base_schema.sql', 'migrations/0013_events.sql']);
  const tasks = [];
  return { env: { ...ON, DB: db }, db, ctx: { waitUntil: (p) => tasks.push(p) }, flush: () => Promise.all(tasks) };
}
const rows = (db) => db.raw.prepare("SELECT event_type, origin, source, meta FROM events WHERE event_type LIKE 'pto%' ORDER BY id").all();

test('a human page view logs pto_view; a crawler logs nothing', async () => {
  const t = eventsEnv();
  await worker.fetch(new Request('https://sparkfare.com/time-off/den?src=digest', { headers: CHROME }), t.env, t.ctx);
  await worker.fetch(new Request('https://sparkfare.com/time-off/den', { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' } }), t.env, t.ctx);
  await worker.fetch(new Request('https://sparkfare.com/time-off/den', { headers: { 'User-Agent': 'curl/8.0' } }), t.env, t.ctx);
  await t.flush();
  const found = rows(t.db).filter((r) => r.event_type === 'pto_view');
  assert.equal(found.length, 1);
  assert.equal(found[0].origin, 'DEN');
  assert.equal(found[0].source, 'digest');
});

test('changing the plan logs pto_plan_change with a budget bucket and the code, never free text', async () => {
  const t = eventsEnv();
  await worker.fetch(new Request('https://sparkfare.com/time-off/den?budget=12&h=2uh', { headers: CHROME }), t.env, t.ctx);
  await t.flush();
  const change = rows(t.db).find((r) => r.event_type === 'pto_plan_change');
  assert.ok(change);
  assert.deepEqual(JSON.parse(change.meta), { budget_bucket: '11-15', h: '2uh' });
});

test('.ics downloads and shares are logged; the share beacon is accepted', async () => {
  const t = eventsEnv();
  await worker.fetch(new Request('https://sparkfare.com/time-off/den.ics', { headers: CHROME }), t.env, t.ctx);
  const beacon = await worker.fetch(new Request('https://sparkfare.com/api/events', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_type: 'pto_share', origin: 'DEN', source: 'pto', meta: { channel: 'copy' } }),
  }), t.env, t.ctx);
  assert.equal(beacon.status, 200);
  await t.flush();
  const types = rows(t.db).map((r) => r.event_type);
  assert.ok(types.includes('pto_ics_download') && types.includes('pto_share'));
});

// ---- sitemap, card, copy ------------------------------------------------------------------------------------

test('the routes sitemap lists the planner pages only while the flag is on', async () => {
  const on = await (await get('/sitemap-routes.xml')).text();
  assert.ok(on.includes('https://sparkfare.com/time-off</loc>'));
  assert.equal((on.match(/\/time-off\/[a-z]{3}</g) || []).length, PTO_ORIGINS.length);
  assert.ok(!on.includes('/time-off/tlv'));
  const off = await (await get('/sitemap-routes.xml', {})).text();
  assert.ok(!off.includes('time-off'));
});

test('the share card renders with totals and no fare', async () => {
  const vdom = ptoOgHtml({ city: 'Denver', ptoUsed: 10, daysOff: 42 });
  const font = fs.readFileSync(new URL('../src/assets/Inter-Medium.ttf', import.meta.url));
  const svg = await satori(vdom, { width: 1200, height: 630, embedFont: false, fonts: [{ name: 'Inter', data: font, weight: 500, style: 'normal' }] });
  const text = svg.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  for (const part of ['Long', 'weekends', 'Denver', '10', 'PTO', '42', 'days', 'off']) assert.ok(text.includes(part), part);
  assert.doesNotMatch(text, /\$/);
});

test('destination links point at pages that exist (the /data/ route pages)', () => {
  assert.equal(destinationSlug('Sofia / Borovets, Bulgaria'), 'sofia-borovets-bulgaria');
  assert.equal(destinationSlug('Maldives (Male)'), 'maldives-male');
  for (const origin of ['den', 'jfk']) {
    for (const name of Object.keys(JSON.parse(fs.readFileSync(new URL('../sparkfare_destinations.json', import.meta.url), 'utf8')))) {
      const rel = routePagePath(origin.toUpperCase(), name).replace(/^\//, '') + '.html';
      assert.ok(fs.existsSync(new URL(`../${rel}`, import.meta.url)), rel);
    }
  }
});

test('the rendered pages pass the referral-copy rules and leak nothing', () => {
  const allowlist = loadAllowlist();
  const now = new Date('2026-10-12T08:00:00Z');
  const pages = [renderTimeOffIndex({ appUrl: 'https://sparkfare.com', now }), ...PTO_ORIGINS.map((o) => renderTimeOffOrigin({ origin: o, budget: 10, keys: undefined, now, appUrl: 'https://sparkfare.com', leaveReady: true }))];
  for (const html of pages) {
    assert.deepEqual(scanText(html, 'rendered.html', allowlist, '.html'), []);
    const visible = html.replace(/<script[\s\S]*?<\/script>/gi, '');
    assert.ok(!/\bundefined\b|\bNaN\b|\[object Object\]/.test(visible));
    assert.doesNotMatch(visible, /\$\d/, 'no fares on the page in Track A');
  }
});

test('"Before you go" links to /leave only when that flag is on', () => {
  const now = new Date('2026-10-12T08:00:00Z');
  const render = (leaveReady) => renderTimeOffOrigin({ origin: 'DEN', budget: 10, keys: undefined, now, appUrl: 'https://sparkfare.com', leaveReady });
  assert.match(render(true), /href="\/leave\?src=pto"/);
  assert.doesNotMatch(render(false), /\/leave/);
});

test('wrangler.jsonc ships the flag on and routes the planner paths to the Worker', () => {
  const cfg = fs.readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
  assert.match(cfg, /"ENABLE_PTO_CALENDAR":\s*"true"/);
  assert.ok(cfg.includes('"/time-off"') && cfg.includes('"/time-off/*"'));
});
