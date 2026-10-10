#!/usr/bin/env node
// Fare Search spike probe (ROADMAP step 77, Task S). Owner-run helper for the throwaway White Label on
// fares.sparkfare.com. It proves the facts the plan says must not be guessed, and prints them so the scorecard can
// be filled in. It never books anything, never touches D1 or the Worker, and is not wired into CI.
//
//   node scripts/fare_search_probe.mjs check  [--host fares.sparkfare.com]
//   node scripts/fare_search_probe.mjs links  [--host ...] [--marker 314524] [--fetch]
//   node scripts/fare_search_probe.mjs fields                       (needs TRAVELPAYOUTS_TOKEN)
//   node scripts/fare_search_probe.mjs stats  [--days 3] [--fields a,b,c]   (needs TRAVELPAYOUTS_TOKEN)
//
// What each step answers (scorecard numbers from claude_code_white_label_fare_search_2026-10-10.md):
//   check   M8   DNS points at Travelpayouts, TLS works, the main page loads, and whether it says noindex (M12).
//   links   M2   Candidate deep links for three sample trips, one per documented pattern. The path and parameter
//                names are CANDIDATES. Open each in a browser: only the one that pre-fills and runs the search
//                counts, and its exact shape is what Task B may use. `--fetch` also requests each URL once.
//   fields  M1   Lists the statistics fields the account can read (needed to see campaign, type and earnings).
//   stats   M1   Looks up the test sub_ids from `links` in the statistics API: which campaign, type and state. Run it
//                24 hours or more after clicking a test link (the statistics refresh once a day).
//
// The token is read from the environment, never printed and never written. Output files go to scratch/, which is
// not deployed. Use PowerShell:  $env:TRAVELPAYOUTS_TOKEN = "<token>"; node scripts/fare_search_probe.mjs stats

import fs from 'node:fs';
import path from 'node:path';
import dns from 'node:dns/promises';
import tls from 'node:tls';
import { fileURLToPath } from 'node:url';

const DEFAULT_HOST = 'fares.sparkfare.com';
const DEFAULT_MARKER = '314524';
const API_BASE = process.env.PROBE_API_BASE || 'https://api.travelpayouts.com'; // override is for the self-test only
const TOKEN = process.env.TRAVELPAYOUTS_TOKEN;
const OUT_DIR = 'scratch';
const STATE_FILE = path.join(OUT_DIR, 'fare_search_probe_state.json');

// ---- pure helpers (exported for tests) -------------------------------------------------------------------------

const pad = (n) => String(n).padStart(2, '0');
export const isoDate = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
export const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

// Three sample trips, always in the future: a round trip, a one-way, and one whose destination has a long display
// name ("Sofia / Borovets, Bulgaria") so URL encoding is exercised. Only IATA codes go into the URL.
export function sampleTrips(now = new Date()) {
  return [
    { id: 'roundtrip', origin: 'JFK', destination: 'LIS', departDate: isoDate(addDays(now, 75)), returnDate: isoDate(addDays(now, 82)), label: 'round trip, JFK to Lisbon' },
    { id: 'oneway', origin: 'LAX', destination: 'NRT', departDate: isoDate(addDays(now, 90)), returnDate: null, label: 'one way, LAX to Tokyo' },
    { id: 'longname', origin: 'ORD', destination: 'SOF', departDate: isoDate(addDays(now, 60)), returnDate: isoDate(addDays(now, 70)), label: 'long destination name, Chicago to "Sofia / Borovets, Bulgaria"' },
  ];
}

// The three documented path patterns. The date parameter names are not documented consistently, so they are options.
export const PATTERNS = [
  { id: 'flights-slash', path: '/flights/' },
  { id: 'flights', path: '/flights' },
  { id: 'searches-new', path: '/searches/new' },
];

export function buildCandidateUrl({ host, pattern, trip, marker, testId, dateParams = ['depart_date', 'return_date'] }) {
  const u = new URL(`https://${host}${pattern.path}`);
  u.searchParams.set('origin_iata', trip.origin);
  u.searchParams.set('destination_iata', trip.destination);
  u.searchParams.set(dateParams[0], trip.departDate);
  if (trip.returnDate) u.searchParams.set(dateParams[1], trip.returnDate);
  u.searchParams.set('marker', `${marker}.${testId}`);
  return u.toString();
}

// A test id that is obviously not a real trip uuid, unique per run and per trip.
export function makeTestIds(trips, now = new Date()) {
  const stamp = `${isoDate(now).replace(/-/g, '')}${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}`;
  return Object.fromEntries(trips.map((t) => [t.id, `fstest-${stamp}-${t.id}`]));
}

// Rows from execute_query come back as { results: [...] } or as { data: [...] } depending on the account version.
export function rowsOf(payload) {
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
}

export function summarizeStats(rows, testIds) {
  const wanted = new Set(Object.values(testIds));
  const hits = rows.filter((r) => wanted.has(String(r.sub_id)));
  const by = {};
  for (const id of wanted) by[id] = [];
  for (const r of hits) by[String(r.sub_id)].push(r);
  return { checked: rows.length, matched: hits.length, by };
}

export function dnsVerdict(cnames) {
  const flat = (cnames || []).map((c) => String(c).toLowerCase().replace(/\.$/, ''));
  if (flat.length === 0) return { ok: false, text: 'No CNAME found. The record is missing, not yet propagated, or flattened by a proxy.' };
  if (flat.some((c) => c.endsWith('whitelabel.travelpayouts.com'))) return { ok: true, text: `CNAME -> ${flat.join(', ')} (expected target)` };
  return { ok: false, text: `CNAME -> ${flat.join(', ')} (not whitelabel.travelpayouts.com)` };
}

// ---- IO ---------------------------------------------------------------------------------------------------------

const args = (() => {
  const out = { _: [] };
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith('--')) {
      const k = a[i].slice(2);
      if (['fetch', 'yes', 'help'].includes(k)) out[k] = true;
      else out[k] = a[++i];
    } else out._.push(a[i]);
  }
  return out;
})();

const redact = (s) => (TOKEN ? String(s).split(TOKEN).join('<token>') : String(s));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function dohCname(host) {
  const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=CNAME`;
  const res = await fetch(url, { headers: { accept: 'application/dns-json' }, signal: AbortSignal.timeout(8000) });
  const j = await res.json();
  return (j.Answer || []).filter((a) => a.type === 5).map((a) => a.data);
}

function tlsInfo(host) {
  return new Promise((resolve) => {
    const s = tls.connect({ host, port: 443, servername: host, timeout: 8000 }, () => {
      const c = s.getPeerCertificate();
      resolve({ ok: s.authorized, authorizationError: s.authorizationError || null, subject: c?.subject?.CN || null, issuer: c?.issuer?.O || c?.issuer?.CN || null, validTo: c?.valid_to || null });
      s.end();
    });
    s.on('error', (e) => resolve({ ok: false, error: e.code || e.message }));
    s.on('timeout', () => { resolve({ ok: false, error: 'timeout' }); s.destroy(); });
  });
}

async function cmdCheck() {
  const host = args.host || DEFAULT_HOST;
  console.log(`Host: ${host}\n`);
  let cn = [];
  try { cn = await dohCname(host); } catch (e) { console.log(`DNS-over-HTTPS lookup failed (${e.message}); trying the system resolver`);
    try { cn = await dns.resolveCname(host); } catch (e2) { console.log(`System resolver: ${e2.code || e2.message}`); } }
  const v = dnsVerdict(cn);
  console.log(`DNS      ${v.ok ? 'OK ' : 'FAIL'}  ${v.text}`);
  try {
    const a = await dns.resolve4(host);
    console.log(`         A records: ${a.join(', ')}  (the proxy setting that worked goes in the scorecard, M8)`);
  } catch { /* an unresolved host is reported above */ }

  const t = await tlsInfo(host);
  console.log(`TLS      ${t.ok ? 'OK ' : 'FAIL'}  ${t.ok ? `${t.subject}, issued by ${t.issuer}, valid to ${t.validTo}` : (t.authorizationError || t.error || 'no certificate')}`);

  try {
    const t0 = Date.now();
    const res = await fetch(`https://${host}/`, { redirect: 'manual', signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'Mozilla/5.0 (compatible; SparkfareProbe/1)' } });
    const ms = Date.now() - t0;
    const html = (await res.text()).slice(0, 400000);
    const robots = (html.match(/<meta[^>]+name=["']robots["'][^>]*>/i) || [''])[0];
    const title = (html.match(/<title>([^<]*)<\/title>/i) || [])[1];
    console.log(`HTTP     ${res.status}  ${ms} ms  title: ${JSON.stringify(title || null)}`);
    console.log(`         location: ${res.headers.get('location') || '-'}   server: ${res.headers.get('server') || '-'}`);
    console.log(`         robots meta: ${robots || '(none found)'}   noindex: ${/noindex/i.test(robots) ? 'YES (M12 ok)' : 'NO (M12 not yet)'}`);
    console.log(`         X-Robots-Tag: ${res.headers.get('x-robots-tag') || '-'}`);
    console.log(`         brand names in the host: ${/(aviasales|jetradar|booking|kayak|skyscanner|expedia)/i.test(host) ? 'YES (account may be blocked, R3)' : 'none'}`);
  } catch (e) {
    console.log(`HTTP     FAIL  ${redact(e.cause?.code || e.message)}`);
  }
}

async function cmdLinks() {
  const host = args.host || DEFAULT_HOST;
  const marker = args.marker || DEFAULT_MARKER;
  const dateParams = (args['date-params'] || 'depart_date,return_date').split(',');
  const trips = sampleTrips();
  const ids = makeTestIds(trips);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify({ createdAt: new Date().toISOString(), host, marker, testIds: ids, trips }, null, 2));

  console.log(`Candidate deep links for ${host}. These path and parameter names are NOT verified.`);
  console.log('Open each one in a browser. Only a link that pre-fills the form AND runs the search counts (scorecard M2).');
  console.log('Click a result once from the winning link, then run `stats` 24+ hours later to prove the marker (M1).\n');
  const results = [];
  for (const trip of trips) {
    console.log(`${trip.label}   test sub-id: ${ids[trip.id]}`);
    for (const pattern of PATTERNS) {
      const url = buildCandidateUrl({ host, pattern, trip, marker, testId: ids[trip.id], dateParams });
      let note = '';
      if (args.fetch) {
        try {
          const r = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'Mozilla/5.0 (compatible; SparkfareProbe/1)' } });
          note = `  -> HTTP ${r.status}${r.headers.get('location') ? ` Location: ${r.headers.get('location')}` : ''}`;
        } catch (e) { note = `  -> ${redact(e.cause?.code || e.message)}`; }
        await sleep(500);
      }
      console.log(`  [${pattern.id.padEnd(13)}] ${url}${note}`);
      results.push({ trip: trip.id, pattern: pattern.id, url });
    }
    console.log('');
  }
  console.log(`Test ids saved to ${STATE_FILE} for the stats step. Nothing was purchased and nothing was sent anywhere.`);
  return results;
}

async function api(pathname, { method = 'GET', body } = {}) {
  const res = await fetch(API_BASE + pathname, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Access-Token': TOKEN },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* leave null */ }
  return { status: res.status, json, text: redact(text).slice(0, 400) };
}

function needToken() {
  if (!TOKEN) {
    console.error('TRAVELPAYOUTS_TOKEN is not set. Set it in your own terminal (see the header of this file); it is never printed.');
    process.exit(2);
  }
}

async function cmdFields() {
  needToken();
  const p = '/statistics/v1/get_fields_list';
  // The plan says to confirm the method in the current docs first; this tries the one most likely and reports which worked.
  let r = await api(p, { method: 'GET' });
  let used = 'GET';
  if (r.status === 404 || r.status === 405) { r = await api(p, { method: 'POST', body: {} }); used = 'POST'; }
  console.log(`get_fields_list via ${used}: HTTP ${r.status}`);
  if (r.status !== 200 || !r.json) { console.log(r.text); return; }
  const list = rowsOf(r.json).length ? rowsOf(r.json) : (r.json.fields || r.json);
  console.log(JSON.stringify(list, null, 2).slice(0, 6000));
  console.log('\nLook for: campaign or program id, type (click or action), state, and any earnings or reward field.');
}

async function cmdStats() {
  needToken();
  if (!fs.existsSync(STATE_FILE)) { console.error(`No ${STATE_FILE}. Run the \`links\` step first.`); process.exit(2); }
  const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  const days = Math.max(1, Number(args.days) || 3);
  const since = isoDate(addDays(new Date(), -days));
  const wantFields = args.fields ? args.fields.split(',').map((s) => s.trim()).filter(Boolean)
    : ['sub_id', 'state', 'date', 'type', 'campaign_id', 'price_eur'];

  let fields = wantFields;
  let r;
  for (let attempt = 0; attempt < 3; attempt++) {
    r = await api('/statistics/v1/execute_query', {
      method: 'POST',
      body: { fields, filters: [{ field: 'date', op: 'ge', value: since }], sort: [{ field: 'date', order: 'desc' }], offset: 0, limit: 1000 },
    });
    if (r.status === 200) break;
    // A field the account does not have is rejected whole; drop the optional ones one at a time and say so.
    const drop = ['campaign_id', 'type', 'price_eur'].find((f) => fields.includes(f) && new RegExp(f, 'i').test(r.text));
    if (!drop) break;
    console.log(`Field ${drop} was rejected; retrying without it.`);
    fields = fields.filter((f) => f !== drop);
  }
  console.log(`execute_query: HTTP ${r.status}, fields used: ${fields.join(', ')}, since ${since}`);
  if (r.status !== 200) { console.log(r.text); process.exit(1); }

  const s = summarizeStats(rowsOf(r.json), state.testIds);
  console.log(`rows returned: ${s.checked}, rows for our test ids: ${s.matched}\n`);
  for (const [id, rows] of Object.entries(s.by)) {
    console.log(`${id}: ${rows.length ? '' : 'no rows yet'}`);
    for (const row of rows) console.log('   ', redact(JSON.stringify(row)));
  }
  if (s.matched === 0) {
    console.log('\nNo test sub_id appears yet. Statistics refresh once a day; also check the Travelpayouts dashboard Reports by SubID.');
    console.log('If a click was made more than 48 hours ago and it still does not appear, scorecard M1 FAILS for this page type.');
  } else {
    console.log('\nRecord in the scorecard: which campaign_id, which type (click or action), which state. A click is expected;');
    console.log('an action only appears after a real purchase, which this probe never makes.');
  }
}

async function main() {
  const cmd = args._[0] || 'check';
  if (args.help || cmd === 'help') { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 24).join('\n').replace(/^\/\/ ?/gm, '')); return; }
  if (cmd === 'check') return cmdCheck();
  if (cmd === 'links') return cmdLinks();
  if (cmd === 'fields') return cmdFields();
  if (cmd === 'stats') return cmdStats();
  console.error(`Unknown command ${cmd}. Use check, links, fields or stats.`);
  process.exit(2);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(redact(e?.stack || e)); process.exit(1); });
}
