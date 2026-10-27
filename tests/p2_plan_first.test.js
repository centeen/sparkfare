// Addendum P, P2 (D-048): /time-off shows the plan with no airport; the airport is asked only for destinations.
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { makeSqliteD1 } from './helpers/sqliteD1.js';

const ON = { ENABLE_PTO_CALENDAR: 'true', APP_URL: 'https://sparkfare.com' };
const CHROME = { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' };
const ctx = { waitUntil: () => {} };
const get = (path, env = ON, init = {}) => worker.fetch(new Request(`https://sparkfare.com${path}`, { redirect: 'manual', ...init }), env, ctx);
const text = async (path) => (await get(path)).text();
const pos = (html, needle) => html.indexOf(needle);

test('no airport: the plan is on the page with its windows, before any airport question', async () => {
  const html = await text('/time-off');
  assert.match(html, /<h1>Long weekends and PTO planner, 2026-2027<\/h1>/);
  assert.ok(html.includes('See the best plan for your PTO budget, then pick your airport for destinations that fit each window.'));
  assert.doesNotMatch(html, /Pick your home airport to see the plan/);
  assert.match(html, /<p class="hero-num">\d+ days off<\/p>/);
  assert.ok((html.match(/class="window block"/g) || []).length >= 3);
  assert.ok(pos(html, 'Your plan') < pos(html, 'Where do you fly from?'));
  assert.ok(pos(html, 'class="window block"') < pos(html, 'Where do you fly from?'));
  assert.ok(html.includes('Pick your airport below to see destinations that fit this window.'));
});

test('no airport: no destinations, fares, watch button or alert signup yet', async () => {
  const html = await text('/time-off');
  assert.doesNotMatch(html, /<ul class="postcards"|<ul class="fares"|class="secondary pto-watch-btn"|id="alert-form"/);
});

test('the chooser lists every airport, keeps the plan in hidden fields and works without JavaScript', async () => {
  const html = await text('/time-off?budget=7&h=2uh');
  assert.match(html, /<form method="get" action="\/time-off" id="airport-form">/);
  assert.match(html, /<input type="hidden" name="budget" value="7" \/><input type="hidden" name="h" value="2uh" \/>/);
  const opts = html.match(/<option value="[A-Z]{3}"/g) || [];
  assert.ok(opts.length >= 22 && !html.includes('value="TLV"'));
  assert.ok(html.includes('<option value="">Choose your airport</option>'));
});

test('an airport adds destinations for that airport and keeps the plan', async () => {
  const none = await text('/time-off?budget=7');
  const sea = await text('/time-off?budget=7&from=sea');
  assert.equal(sea.match(/<p class="hero-num">[^<]+<\/p>/)[0], none.match(/<p class="hero-num">[^<]+<\/p>/)[0], 'same plan');
  assert.match(sea, /<option value="SEA" selected>/);
  assert.ok(sea.includes('Fly from somewhere else?'));
  assert.match(sea, /href="\/data\/sea-to-/);
  assert.match(sea, /id="ics-link" href="\/time-off\/sea\.ics\?budget=7&h=/);
  assert.match(sea, /id="alert-form"[^>]*data-origin="SEA"/);
  assert.doesNotMatch(sea, /Pick your airport below/);
});

test('a bad or unsupported airport is ignored: TLV and junk behave like no airport', async () => {
  for (const from of ['tlv', 'zzz', 'sea;drop', '']) {
    const html = await text(`/time-off?from=${encodeURIComponent(from)}`);
    assert.ok(html.includes('Where do you fly from?'), from);
    assert.doesNotMatch(html, /<ul class="postcards"/, from);
  }
});

test('every variant is noindex with the canonical on /time-off; the bare page is indexable', async () => {
  const bare = await text('/time-off');
  assert.match(bare, /<meta name="robots" content="index, follow" \/>/);
  for (const q of ['?budget=5', '?h=2uh', '?from=sea', '?budget=5&from=sea']) {
    const html = await text(`/time-off${q}`);
    assert.match(html, /<meta name="robots" content="noindex, follow" \/>/, q);
    assert.match(html, /<link rel="canonical" href="https:\/\/sparkfare\.com\/time-off" \/>/, q);
  }
});

test('the planner form redirects to the compact URL and keeps the airport', async () => {
  const a = await get('/time-off?hs=1&budget=8&hk=thanksgiving&hk=christmas&from=SEA');
  assert.equal(a.status, 303);
  const loc = new URL(a.headers.get('Location'), 'https://sparkfare.com');
  assert.equal(loc.pathname, '/time-off');
  assert.equal(loc.searchParams.get('budget'), '8');
  assert.equal(loc.searchParams.get('from'), 'SEA');
  assert.ok(loc.searchParams.get('h'));
  const b = await get('/time-off?hs=1&budget=10');
  assert.ok(!b.headers.get('Location').includes('from='));
});

test('no URL, hidden field or link carries a traveler date', async () => {
  for (const html of [await text('/time-off'), await text('/time-off?budget=4&from=den')]) {
    const forms = html.match(/<form[\s\S]*?<\/form>/g).join('');
    assert.doesNotMatch(forms, /\d{4}-\d{2}-\d{2}/);
    assert.doesNotMatch(forms, /name="(date|start|end|depart|return)/i);
  }
});

test('airport pages keep their URL, canonical, robots and title, and gain the chooser', async () => {
  const html = await text('/time-off/sea');
  assert.match(html, /<link rel="canonical" href="https:\/\/sparkfare\.com\/time-off\/sea" \/>/);
  assert.match(html, /<meta name="robots" content="index, follow" \/>/);
  assert.match(html, /<title>Long weekends from [^<]+: 2026-2027 \| Sparkfare<\/title>/);
  assert.match(html, /<h1>Long weekends from [^<]+: 2026-2027<\/h1>/);
  assert.ok(html.includes('Fly from somewhere else?'));
  assert.match(html, /<option value="SEA" selected>/);
  assert.match(html, /<form method="get" action="\/time-off\/sea">/);
});

test('the inline scripts of both pages parse, and the email checks are real expressions', async () => {
  for (const path of ['/time-off', '/time-off?from=den', '/time-off/den']) {
    const html = await text(path);
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    assert.ok(scripts.length >= 1, path);
    for (const code of scripts) assert.doesNotThrow(() => new Function(code), path);
    assert.ok(html.includes('/^\\S+@\\S+\\.\\S+$/'), `${path} email pattern`);
  }
});

test('the airport is remembered in this browser only: guarded storage, three-letter code, nothing else', async () => {
  const html = await text('/time-off');
  assert.match(html, /localStorage\.getItem\(STORE\)/);
  assert.match(html, /localStorage\.setItem\(STORE, select\.value\)/);
  assert.match(html, /try \{\s*var stored/);
  assert.match(html, /\/\^\[A-Z\]\{3\}\$\/\.test\(stored\)/);
  assert.doesNotMatch(html, /document\.cookie/);
  assert.ok(html.includes("'sparkfare_selected_origin'"));
});

// ---- events ---------------------------------------------------------------------------------------------------------
function eventsEnv() {
  const db = makeSqliteD1(['migrations/0000_base_schema.sql', 'migrations/0013_events.sql']);
  const tasks = [];
  return { env: { ...ON, DB: db }, db, ctx: { waitUntil: (p) => tasks.push(p) }, flush: () => Promise.all(tasks) };
}
const ev = (db) => db.raw.prepare("SELECT event_type, origin, source, meta FROM events WHERE event_type LIKE 'pto%' ORDER BY id").all();
const visit = (t, path, headers = CHROME) => worker.fetch(new Request(`https://sparkfare.com${path}`, { headers }), t.env, t.ctx);

test('a plain /time-off view logs pto_view tagged index and no plan change', async () => {
  const t = eventsEnv();
  await visit(t, '/time-off');
  await t.flush();
  const rows = ev(t.db);
  assert.deepEqual(rows.map((r) => r.event_type), ['pto_view']);
  assert.equal(rows[0].source, 'index');
});

test('the first plan change on /time-off logs pto_plan_change with surface index', async () => {
  const t = eventsEnv();
  await visit(t, '/time-off?budget=12&h=2uh&from=sea');
  await t.flush();
  const rows = ev(t.db);
  const change = rows.find((r) => r.event_type === 'pto_plan_change');
  assert.ok(change);
  assert.deepEqual(JSON.parse(change.meta), { budget_bucket: '11-15', h: '2uh', surface: 'index' });
  assert.equal(change.origin, 'SEA');
  assert.equal(rows.find((r) => r.event_type === 'pto_view').origin, 'SEA');
});

test('crawlers log nothing on /time-off', async () => {
  const t = eventsEnv();
  await visit(t, '/time-off?budget=3', { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' });
  await t.flush();
  assert.equal(ev(t.db).length, 0);
});

test('window fares stay off: an airport on /time-off shows the fares-appear note and no fare lines', async () => {
  const html = await text('/time-off?from=den');
  assert.ok(html.includes('Fares appear here as we see them.'));
  assert.doesNotMatch(html, /<ul class="fares"|View fare/);
});
