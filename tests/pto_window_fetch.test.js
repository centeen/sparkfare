// PTO window fares, Track B (ROADMAP step 73): the real Python script run against a fake Travelpayouts server, the
// window picker, the workflow file and the Worker display. Python runs as a child process; the fake server answers on
// the Node event loop, so the child is spawned asynchronously.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import worker from '../src/index.js';
import { renderTimeOffOrigin, faresForWindow, FARE_FRESH_DAYS } from '../src/ptoPages.js';
import { pickWindows } from '../scripts/pto-windows.mjs';
import { scanText, loadAllowlist } from '../scripts/check-referral-copy.js';
import { sanitizeBookingTarget } from '../src/interstitial.js';

const ROOT = new URL('../', import.meta.url);
const SCRIPT = path.join(ROOT.pathname.replace(/^\/([A-Za-z]:)/, '$1'), 'Phase 22 PTO Window Fetch (Step 73).py');
const HAVE_PYTHON = spawnSync('python', ['--version']).status === 0;
const py = { skip: HAVE_PYTHON ? false : 'python is not available' };

// ---- the window picker --------------------------------------------------------------------------------------

test('pickWindows: windows start 3 to 120 days out, nearest first, with fitting destinations, from the same calendar code', () => {
  const today = '2026-10-12';
  const windows = pickWindows(today);
  assert.ok(windows.length >= 8);
  const starts = windows.map((w) => w.start);
  assert.deepEqual([...starts].sort(), starts, 'nearest first');
  for (const w of windows) {
    assert.ok(w.start >= '2026-10-15' && w.start <= '2027-02-09', w.start);
    assert.ok(w.days_off >= 3 && w.pto_used <= 5);
    assert.ok(w.destinations.length > 0);
  }
  assert.ok(windows.some((w) => w.start === '2026-11-26' && w.end === '2026-11-29'), 'the Thanksgiving weekend is there');
  assert.ok(windows.some((w) => w.start === '2026-11-21' && w.end === '2026-11-29' && w.pto_used === 3), 'and the 3-PTO nine-day window');
  assert.equal(new Set(windows.map((w) => `${w.start}:${w.end}`)).size, windows.length, 'no duplicates');
});

test('the picker CLI prints valid JSON and rejects a malformed date', () => {
  const ok = spawnSync('node', ['scripts/pto-windows.mjs'], { cwd: ROOT.pathname.replace(/^\/([A-Za-z]:)/, '$1'), env: { ...process.env, PTO_TODAY: '2026-10-12' }, encoding: 'utf8' });
  assert.equal(ok.status, 0);
  assert.equal(JSON.parse(ok.stdout).generated_for, '2026-10-12');
  const bad = spawnSync('node', ['scripts/pto-windows.mjs'], { cwd: ROOT.pathname.replace(/^\/([A-Za-z]:)/, '$1'), env: { ...process.env, PTO_TODAY: 'nope' }, encoding: 'utf8' });
  assert.notEqual(bad.status, 0);
});

// ---- the Python script against a fake API ------------------------------------------------------------------

function fakeApi(handler) {
  const requests = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    requests.push({ path: url.pathname, q: Object.fromEntries(url.searchParams) });
    const out = handler(url, requests.length);
    res.writeHead(out.status || 200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(out.body ?? {}));
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, requests, base: `http://127.0.0.1:${server.address().port}` })));
}

function runScript({ base, windows, store, args = [], env = {} }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pto-'));
  const windowsPath = path.join(dir, 'pto_windows.json');
  const outPath = path.join(dir, 'prices.json');
  fs.writeFileSync(windowsPath, JSON.stringify({ windows }));
  if (store) fs.writeFileSync(outPath, JSON.stringify(store));
  return new Promise((resolve) => {
    const child = spawn('python', [SCRIPT, ...args], {
      env: { ...process.env, TRAVELPAYOUTS_TOKEN: 'test-token', PTO_API_BASE: base, PTO_WINDOWS_PATH: windowsPath, PTO_OUTPUT_PATH: outPath, PTO_SLEEP: '0', PTO_TODAY: '2026-10-12', PYTHONIOENCODING: 'utf-8', ...env },
    });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('close', (code) => resolve({ code, out, read: () => (fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : null), outPath, dir }));
  });
}

const WINDOW = { start: '2026-11-26', end: '2026-11-29', days_off: 4, destinations: ['Tulum, Mexico', 'Oaxaca, Mexico', 'Bogota, Colombia'] };
const v3Row = (price, start = '2026-11-26', end = '2026-11-29') => ({ origin: 'DEN', destination: 'X', price, airline: 'UA', departure_at: `${start}T08:00:00-07:00`, return_at: `${end}T20:00:00-07:00`, transfers: 0 });

test('live run: parses v3 responses into the documented shape, never mixes up windows or destinations', py, async () => {
  const api = await fakeApi((url) => {
    const dest = url.searchParams.get('destination');
    if (dest === 'CUN') return { body: { success: true, data: [v3Row(412)] } };
    if (dest === 'OAX') return { body: { success: true, data: [] } };
    return { body: { success: true, data: [v3Row(500, '2026-11-27', '2026-11-29')] } }; // other dates: must not count as this window
  });
  try {
    const r = await runScript({ base: api.base, windows: [WINDOW], env: { PTO_MAX_CALLS: '3' } });
    assert.equal(r.code, 0, r.out);
    const store = r.read();
    const win = store.windows['DEN:2026-11-26:2026-11-29'] || store.windows['JFK:2026-11-26:2026-11-29'];
    const key = Object.keys(store.windows)[0];
    assert.match(key, /^[A-Z]{3}:2026-11-26:2026-11-29$/);
    assert.ok(win || store.windows[key]);
    const fares = store.windows[key].fares;
    assert.equal(fares.length, 1);
    assert.equal(fares[0].destination, 'Tulum, Mexico');
    assert.equal(fares[0].price, 412);
    assert.match(fares[0].booking_link, /^https:\/\/www\.aviasales\.com\/search\/[A-Z]{3}2611CUN2911\d\?marker=314524$/);
    assert.deepEqual(store.windows[key].observations, [{ date: '2026-10-12', price: 412 }]);
    assert.equal(store.endpoint, 'v3');
    assert.equal(store.windows[key].days_off, 4);
    assert.equal(api.requests.filter((q) => q.path === '/aviasales/v3/prices_for_dates').length, 3);
    for (const q of api.requests) { assert.equal(q.q.departure_at, '2026-11-26'); assert.equal(q.q.return_at, '2026-11-29'); assert.equal(q.q.currency, 'usd'); assert.equal(q.q.token, 'test-token'); }
  } finally { api.server.close(); }
});

test('the call cap is a hard stop', py, async () => {
  const api = await fakeApi(() => ({ body: { success: true, data: [] } }));
  try {
    const r = await runScript({ base: api.base, windows: [WINDOW, { ...WINDOW, start: '2026-12-19', end: '2026-12-27', days_off: 9 }], env: { PTO_MAX_CALLS: '5' } });
    assert.equal(r.code, 0, r.out);
    assert.equal(api.requests.length, 5);
  } finally { api.server.close(); }
});

test('an API error never wipes a stored fare, and an empty answer keeps it as "last seen"', py, async () => {
  const stored = { generated_at: '2026-10-10T04:47:00+00:00', windows: { 'JFK:2026-11-26:2026-11-29': {
    origin: 'JFK', start: '2026-11-26', end: '2026-11-29', days_off: 4,
    fares: [{ destination: 'Tulum, Mexico', iata: 'CUN', price: 390, found_at: '2026-10-10T04:47:00+00:00', booking_link: 'https://www.aviasales.com/search/JFK2611CUN29111?marker=314524' },
            { destination: 'Oaxaca, Mexico', iata: 'OAX', price: 301, found_at: '2026-10-10T04:47:00+00:00', booking_link: 'https://www.aviasales.com/search/JFK2611OAX29111?marker=314524' }],
    observations: [{ date: '2026-10-10', price: 301 }] } } };
  const api = await fakeApi((url) => (url.searchParams.get('destination') === 'CUN' ? { status: 500, body: {} } : { body: { success: true, data: [] } }));
  try {
    const r = await runScript({ base: api.base, windows: [WINDOW], store: stored, env: { PTO_MAX_CALLS: '3' } });
    const after = r.read().windows['JFK:2026-11-26:2026-11-29'];
    assert.equal(after.fares.length, 2, 'both stored fares are still there');
    assert.deepEqual(after.fares.map((f) => f.price).sort(), [301, 390]);
    assert.equal(after.fares.find((f) => f.destination === 'Tulum, Mexico').found_at, '2026-10-10T04:47:00+00:00', 'untouched after an error');
    assert.equal(after.observations.length, 1, 'no new observation without a new fare');
  } finally { api.server.close(); }
});

test('a run where every call fails exits non-zero so the workflow shows red', py, async () => {
  const api = await fakeApi(() => ({ status: 500, body: {} }));
  try {
    const r = await runScript({ base: api.base, windows: [WINDOW], env: { PTO_MAX_CALLS: '3' } });
    assert.notEqual(r.code, 0);
  } finally { api.server.close(); }
});

test('three rate-limit responses in a row stop the run', py, async () => {
  const api = await fakeApi(() => ({ status: 429, body: {} }));
  try {
    const r = await runScript({ base: api.base, windows: [WINDOW, { ...WINDOW, start: '2026-12-19', end: '2026-12-27', days_off: 9 }], env: { PTO_MAX_CALLS: '50' } });
    assert.equal(api.requests.length, 3);
    assert.match(r.out, /three rate-limit responses/);
  } finally { api.server.close(); }
});

test('windows that ended more than 30 days ago are dropped; observations keep 60 days', py, async () => {
  const old = { origin: 'JFK', start: '2026-08-01', end: '2026-08-04', days_off: 4, fares: [], observations: [] };
  const live = { origin: 'JFK', start: '2026-11-26', end: '2026-11-29', days_off: 4, fares: [], observations: [{ date: '2026-07-01', price: 999 }, { date: '2026-10-11', price: 410 }] };
  const untouched = { origin: 'DEN', start: '2026-11-26', end: '2026-11-29', days_off: 4, fares: [], observations: [{ date: '2026-07-01', price: 999 }, { date: '2026-10-10', price: 380 }] };
  const api = await fakeApi((url) => ({ body: { success: true, data: [v3Row(400)] } }));
  try {
    const r = await runScript({ base: api.base, windows: [WINDOW], store: { windows: { 'JFK:2026-08-01:2026-08-04': old, 'JFK:2026-11-26:2026-11-29': live, 'DEN:2026-11-26:2026-11-29': untouched } }, env: { PTO_MAX_CALLS: '1' } });
    const store = r.read();
    assert.ok(!store.windows['JFK:2026-08-01:2026-08-04'], 'ended more than 30 days ago');
    const jfk = store.windows['JFK:2026-11-26:2026-11-29'].observations;
    assert.ok(jfk.some((o) => o.date === '2026-10-11') && jfk.some((o) => o.date === '2026-10-12'));
    assert.ok(!jfk.some((o) => o.date === '2026-07-01'), 'the 103-day-old observation is gone');
    const den = store.windows['DEN:2026-11-26:2026-11-29'].observations;
    assert.deepEqual(den.map((o) => o.date), ['2026-10-10'], 'old observations are pruned even for a window not priced today');
  } finally { api.server.close(); }
});

test('flexible dates: the cheapest fare within N days of each end wins, anything further is ignored', py, async () => {
  const api = await fakeApi(() => ({ body: { success: true, data: [
    v3Row(250, '2026-11-20', '2026-11-29'), // departs 6 days early: out
    v3Row(330, '2026-11-24', '2026-11-30'), // 2 days early, 1 day late: in
    v3Row(360, '2026-11-26', '2026-11-29'), // exact: in
    v3Row(280, '2026-11-26', '2026-12-05'), // returns 6 days late: out
  ] } }));
  try {
    const r = await runScript({ base: api.base, windows: [WINDOW], env: { PTO_MAX_CALLS: '1', PTO_FLEX_DAYS: '2' } });
    const fares = Object.values(r.read().windows)[0].fares;
    assert.equal(fares[0].price, 330);
    assert.equal(r.read().flex_days, 2);
    assert.match(api.requests[0].q.departure_at, /^2026-11$/, 'a month-wide search, filtered locally');
  } finally { api.server.close(); }
});

test('the v1 endpoint is parsed too (/v1/prices/cheap with depart_date and return_date)', py, async () => {
  const api = await fakeApi((url) => ({ body: { success: true, data: { CUN: { 0: { price: 455, airline: 'F9', departure_at: '2026-11-26T09:00:00Z', return_at: '2026-11-29T21:00:00Z' }, 1: { price: 600, departure_at: '2026-11-27T09:00:00Z', return_at: '2026-11-29T21:00:00Z' } } } } }));
  try {
    const r = await runScript({ base: api.base, windows: [WINDOW], env: { PTO_MAX_CALLS: '3', PTO_ENDPOINT: 'v1' } });
    assert.equal(r.code, 0, r.out);
    assert.equal(api.requests[0].path, '/v1/prices/cheap');
    assert.equal(api.requests[0].q.depart_date, '2026-11-26');
    assert.equal(api.requests[0].q.return_date, '2026-11-29');
    const fares = Object.values(r.read().windows).flatMap((w) => w.fares);
    assert.ok(fares.some((f) => f.price === 455));
    assert.ok(!fares.some((f) => f.price === 600), 'a different departure date is not this window');
  } finally { api.server.close(); }
});

test('dry run: reports hit rates on both endpoints and writes no data file', py, async () => {
  const api = await fakeApi((url) => (url.pathname === '/aviasales/v3/prices_for_dates'
    ? { body: { success: true, data: url.searchParams.get('destination') === 'CUN' ? [v3Row(400)] : [] } }
    : { status: 500, body: {} }));
  try {
    const windows = JSON.parse(spawnSync('node', ['scripts/pto-windows.mjs'], { cwd: ROOT.pathname.replace(/^\/([A-Za-z]:)/, '$1'), env: { ...process.env, PTO_TODAY: '2026-10-12' }, encoding: 'utf8' }).stdout).windows;
    const r = await runScript({ base: api.base, windows, args: ['--dry-run'], env: { PTO_TODAY: '2026-10-12' } });
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /## Endpoint v3/);
    assert.match(r.out, /## Endpoint v1/);
    assert.match(r.out, /hit rate within 120 days: \d+%/);
    assert.match(r.out, /departing in 31-60 days/);
    assert.equal(r.read(), null, 'a dry run writes no data');
  } finally { api.server.close(); }
});

// ---- the workflow ------------------------------------------------------------------------------------------

test('workflow: one off-peak slot between the daily fetch and the digest, dry run by default, commits only its data file', () => {
  const wf = fs.readFileSync(new URL('../.github/workflows/pto-window-fetch.yml', import.meta.url), 'utf8');
  const crons = [...wf.matchAll(/- cron:\s*'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(crons, ['47 4 * * *']);
  const [min, hour] = crons[0].split(' ').map(Number);
  assert.notEqual(min, 0);
  assert.ok(hour >= 4 && hour <= 6, 'after the 03:17 daily fetch, before the 07:00 digest');
  assert.match(wf, /workflow_dispatch:\s+inputs:\s+mode:[\s\S]*?default: dry_run/);
  assert.match(wf, /concurrency:\s+group: pto-window-fetch\s+cancel-in-progress: false/);
  assert.match(wf, /secrets\.TRAVELPAYOUTS_TOKEN/);
  const adds = [...wf.matchAll(/git add ([^\n]+)/g)].map((m) => m[1].trim());
  assert.deepEqual(adds, ['sparkfare_pto_window_prices.json']);
  assert.match(wf, /git pull --rebase origin main/);
  // The commit and the live price step run only for the schedule or an explicit live dispatch.
  assert.equal((wf.match(/if: \$\{\{ github\.event_name == 'schedule' \|\| inputs\.mode == 'live' \}\}/g) || []).length, 2);
  assert.match(wf, /--dry-run --report-path/);
});

// ---- the Worker display ------------------------------------------------------------------------------------

const NOW = new Date('2026-10-12T08:00:00Z');
const FRESH = '2026-10-11T04:47:00+00:00';
const STALE = '2026-10-05T04:47:00+00:00';
const store = (fares, extra = {}) => ({ generated_at: '2026-10-12T04:52:00+00:00', windows: { 'DEN:2026-11-21:2026-11-29': { fares } }, ...extra });
const fare = (destination, price, found_at = FRESH) => ({ destination, iata: 'CUN', price, found_at, departure_at: '2026-11-23T01:55:00-05:00', return_at: '2026-11-30T19:45:00-06:00', booking_link: 'https://www.aviasales.com/search/DEN2111CUN29111?marker=314524' });
const render = (faresStore, extra = {}) => renderTimeOffOrigin({ origin: 'DEN', budget: 10, keys: undefined, now: NOW, appUrl: 'https://sparkfare.com', faresStore, ...extra });
const visible = (html) => html.replace(/<script[\s\S]*?<\/script>/gi, '');

test('fares off: no prices, no disclosure block, the placeholder stays', () => {
  const html = render(null);
  assert.doesNotMatch(visible(html), /\$\d/);
  assert.ok(html.includes('Fares appear here as we see them.'));
  assert.ok(!html.includes('id="grid-disclosure"'));
});

test('a fresh fare shows its price, the date seen, a sponsored tracked link and the disclosure', () => {
  const html = render(store([fare('Tulum, Mexico', 412)]));
  assert.match(html, /Tulum, Mexico<\/a>: from \$412, Nov 23 – Nov 30, seen Oct 11/);
  const link = /<a class="btn secondary fare-link" href="([^"]+)"[^>]*rel="([^"]+)"[^>]*aria-label="([^"]+)"/.exec(html);
  assert.ok(link);
  const [, href, rel, aria] = link;
  assert.match(href, /^\/out\/aviasales\?url=https%3A%2F%2Fwww\.aviasales\.com%2Fsearch%2F[^&]+&src=pto$/);
  assert.ok(sanitizeBookingTarget(decodeURIComponent(new URL(href, 'https://sparkfare.com').searchParams.get('url'))), 'the outbound route accepts it');
  assert.equal(rel, 'sponsored nofollow noopener noreferrer');
  assert.match(aria, /Sparkfare does not sell or book travel/);
  assert.match(html, /id="grid-disclosure"[^>]*>Links go to Aviasales, which handles booking and payment\. Sparkfare may earn a commission/);
  assert.match(html, /Lowest fares seen in search data/);
  assert.match(html, /Prices checked daily; last check Oct 12/);
});

test('a fare older than 3 days shows as "last seen" with no link; a window with no fare says so', () => {
  const html = render(store([fare('Tulum, Mexico', 390, STALE)]));
  assert.match(html, /Tulum, Mexico<\/a>: last seen \$390 for Nov 23 – Nov 30, on Oct 5/);
  assert.doesNotMatch(html, /fare-link"/);
  assert.equal(FARE_FRESH_DAYS, 3);
  const none = render({ generated_at: '2026-10-12T04:52:00+00:00', windows: {} });
  assert.ok(none.includes('No fare seen yet for these dates.'));
});

test('no badges, percentages, deal labels or predictions on window fares', () => {
  const html = render(store([fare('Tulum, Mexico', 412), fare('Oaxaca, Mexico', 301)]));
  // The fare list and the fare notes only (the page itself says "deal alerts" on the signup button).
  const fareText = [...html.matchAll(/<ul class="fares">[\s\S]*?<\/ul>|<p class="affiliate-note[\s\S]*?<\/p>\s*<p class="muted small"[^>]*>[\s\S]*?<\/p>/g)].map((m) => m[0]).join(' ');
  assert.ok(fareText.includes('Tulum, Mexico') && fareText.includes('Prices checked daily'));
  assert.doesNotMatch(fareText.replace(/<[^>]+>/g, ' '), /%|below|rare find|great deal|\bdeals?\b|price drop|will (rise|fall|drop)|predict|cheapest ever|best price|lowest ever/i);
  assert.doesNotMatch(fareText, /class="(badge|pill|chip)/);
});

test('bad data is ignored: negative, zero, non-numeric prices and a missing file', () => {
  assert.deepEqual(faresForWindow(store([fare('A', -5), fare('B', 0), fare('C', 'x'), fare('D', 99)]), 'DEN', { start: '2026-11-21', end: '2026-11-29' }).map((f) => f.destination), ['D']);
  assert.deepEqual(faresForWindow({}, 'DEN', { start: 'a', end: 'b' }), []);
  assert.deepEqual(faresForWindow(null, 'DEN', { start: 'a', end: 'b' }), []);
  assert.ok(render({}).includes('No fare seen yet for these dates.'));
});

test('flexible-date fares say exactly what they are', () => {
  const html = render(store([fare('Tulum, Mexico', 412)], { flex_days: 2 }));
  assert.match(html, /cheapest seen departing within 2 days of the window start and returning within 2 days of its end/);
  assert.doesNotMatch(render(store([fare('Tulum, Mexico', 412)], { flex_days: 0 })), /departing within/);
});

test('each fare shows its own trip dates, even when they differ from the window, and degrades without them', () => {
  const html = render(store([fare('Tulum, Mexico', 412)]));
  assert.match(html, /Nov 23 – Nov 30/); // the window is Nov 21 – Nov 29
  assert.doesNotMatch(visible(html), /for these dates <a/);
  const bare = { destination: 'Oaxaca, Mexico', price: 301, found_at: FRESH, booking_link: 'https://www.aviasales.com/search/DEN2111OAX29111?marker=314524' };
  assert.match(render(store([bare])), /Oaxaca, Mexico<\/a>: from \$301, seen Oct 11 </);
});

test('the rendered page with fares passes the referral-copy rules', () => {
  const html = render(store([fare('Tulum, Mexico', 412), fare('Oaxaca, Mexico', 301, STALE)]));
  assert.deepEqual(scanText(html, 'rendered.html', loadAllowlist(), '.html'), []);
});

test('the route: ENABLE_PTO_FARES gates it, a missing data file shows the empty state, and the .ics never carries a fare', async () => {
  const assets = { fetch: async (req) => (new URL(req.url).pathname === '/sparkfare_pto_window_prices.json'
    ? new Response(JSON.stringify(store([fare('Tulum, Mexico', 412)])), { status: 200 }) : new Response('nf', { status: 404 })) };
  const ctx = { waitUntil: () => {} };
  const get = (p, env) => worker.fetch(new Request(`https://sparkfare.com${p}`), env, ctx);
  const base = { ENABLE_PTO_CALENDAR: 'true', APP_URL: 'https://sparkfare.com' };
  // the page only matches a stored window when its dates match; the stored key is for DEN 2026-11-21 to 2026-11-29
  const on = await (await get('/time-off/den', { ...base, ENABLE_PTO_FARES: 'true', ASSETS: assets })).text();
  assert.ok(on.includes('id="grid-disclosure"') && on.includes('Prices checked daily'));
  const off = await (await get('/time-off/den', { ...base, ASSETS: assets })).text();
  assert.ok(!off.includes('id="grid-disclosure"') && off.includes('Fares appear here as we see them.'));
  const missing = await (await get('/time-off/den', { ...base, ENABLE_PTO_FARES: 'true', ASSETS: { fetch: async () => new Response('nf', { status: 404 }) } })).text();
  assert.ok(missing.includes('No fare seen yet for these dates.'));
  const ics = await (await get('/time-off/den.ics', { ...base, ENABLE_PTO_FARES: 'true', ASSETS: assets })).text();
  assert.doesNotMatch(ics, /\$\d|412/);
});

test('wrangler.jsonc ships ENABLE_PTO_FARES off', () => {
  assert.match(fs.readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'), /"ENABLE_PTO_FARES":\s*"false"/);
});
