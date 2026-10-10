#!/usr/bin/env node
// Probe: does Travelpayouts return fare data for an origin, and does a different endpoint return more?
//
// Why: DEN, PHX and LAS return an empty result (HTTP 200, success, no data) for about 80% of the 40 routes, and
// the cause is unknown. This script asks the same question three ways, for a small set of origins and
// destinations, and prints how often each way found a fare. It writes nothing to the repo's data files, does not
// touch D1 and does not call anything but Travelpayouts' Data API.
//
//   A  /v1/prices/cheap                    what Sparkfare's fetch script uses today
//   B  /aviasales/v3/prices_for_dates      no date, cheapest round trip in the cache
//   C  /aviasales/v3/prices_for_dates      with a departure month about two months out
//   D  /v2/prices/latest                   optional (--latest); not used anywhere in this repo, behaviour unconfirmed
//
// Read the result like this: if A is empty for an origin and B or C is not, the endpoint is the problem and is
// fixable. If A, B and C are all empty, the data is not in Travelpayouts' cache for that origin and only a second
// source (ROADMAP T13) helps. JFK is the control: it should return data for most routes under every variant.
//
// Usage (run it yourself; the token is read from the environment and never printed or written):
//   PowerShell:  $env:TRAVELPAYOUTS_TOKEN = "<token>"; node scripts/probe-origin-coverage.mjs
//   bash:        TRAVELPAYOUTS_TOKEN=<token> node scripts/probe-origin-coverage.mjs
//
// Options:
//   --origins DEN,PHX,LAS,JFK,...   default: DEN,PHX,LAS,JFK,PHL,DTW,MSP,CLT,AUS,BWI,FLL
//   --dests   DPS,HND,...           default: 8 spread across the four clusters; "all" = all 40
//   --month   YYYY-MM               departure month for variant C (default: two months from today)
//   --delay   ms between calls      default 1000 (about 60 per minute; the limit is 300)
//   --latest                        also run variant D
//   --out     path                  default scratch/probe-origin-coverage-<timestamp>.json
//   --yes                           skip the "N calls" confirmation pause
//
// Cost: origins x destinations x variants calls. The default is 11 x 8 x 3 = 264 calls, about 5 minutes.

import fs from 'node:fs';
import path from 'node:path';

const TOKEN = process.env.TRAVELPAYOUTS_TOKEN;
const API_BASE = process.env.PROBE_API_BASE || 'https://api.travelpayouts.com'; // override is for the self-test only
const CURRENCY = 'usd';

// Same 40 destinations as "Phase 1 Flight Fetch Script (Step 8).py". Kept here so the probe is standalone.
const ALL_DESTS = {
  DPS: 'Bali', HND: 'Tokyo', CPT: 'Cape Town', SYD: 'Sydney', MLE: 'Maldives', EZE: 'Buenos Aires', GIG: 'Rio de Janeiro',
  HKT: 'Phuket', SGN: 'Ho Chi Minh City', TPE: 'Taipei', NAP: 'Amalfi Coast', FAO: 'Algarve', ATH: 'Athens',
  SKG: 'Thessaloniki', LCA: 'Larnaca', LIS: 'Lisbon', MAD: 'Madrid', DBV: 'Dubrovnik', CUN: 'Tulum', PMI: 'Mallorca',
  SJO: 'San Jose CR', DAD: 'Da Nang', CEB: 'Cebu', PRG: 'Prague', BUD: 'Budapest', SOF: 'Sofia', BOG: 'Bogota',
  KRK: 'Krakow', OTP: 'Bucharest', GUA: 'Guatemala', RAK: 'Marrakech', ASR: 'Cappadocia', AMM: 'Petra', OAX: 'Oaxaca',
  CUZ: 'Cusco', LXR: 'Luxor', TBS: 'Tbilisi', GYD: 'Baku', MCT: 'Muscat',
};
const DEFAULT_DESTS = ['DPS', 'HND', 'SYD', 'LIS', 'MAD', 'ATH', 'CUN', 'PRG']; // two per cluster-ish, includes the big routes DEN misses
const DEFAULT_ORIGINS = ['DEN', 'PHX', 'LAS', 'JFK', 'PHL', 'DTW', 'MSP', 'CLT', 'AUS', 'BWI', 'FLL'];

function parseArgs(argv) {
  const out = { latest: false, yes: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--latest') out.latest = true;
    else if (a === '--yes') out.yes = true;
    else if (a.startsWith('--')) { out[a.slice(2)] = argv[++i]; }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const csv = (v, d) => (v ? String(v).split(',').map((s) => s.trim().toUpperCase()).filter(Boolean) : d);
const ORIGINS = csv(args.origins, DEFAULT_ORIGINS);
const DESTS = String(args.dests || '').toLowerCase() === 'all' ? Object.keys(ALL_DESTS) : csv(args.dests, DEFAULT_DESTS);
const DELAY = Number.isFinite(Number(args.delay)) && Number(args.delay) >= 0 ? Number(args.delay) : 1000;

function monthOffset(months) {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 7);
}
const MONTH = /^\d{4}-\d{2}$/.test(args.month || '') ? args.month : monthOffset(2);

const VARIANTS = [
  {
    id: 'A', label: 'v1 cheap (today)',
    request: (o, d) => ({ path: '/v1/prices/cheap', params: { origin: o, destination: d, currency: CURRENCY } }),
    parse: (p, d) => { const t = p?.data?.[d]; return t && typeof t === 'object' ? Object.values(t) : []; },
  },
  {
    id: 'B', label: 'v3 no date',
    request: (o, d) => ({ path: '/aviasales/v3/prices_for_dates', params: { origin: o, destination: d, currency: CURRENCY, sorting: 'price', one_way: 'false', limit: 5 } }),
    parse: (p) => (Array.isArray(p?.data) ? p.data : []),
  },
  {
    id: 'C', label: `v3 dep ${MONTH}`,
    request: (o, d) => ({ path: '/aviasales/v3/prices_for_dates', params: { origin: o, destination: d, currency: CURRENCY, sorting: 'price', one_way: 'false', limit: 5, departure_at: MONTH } }),
    parse: (p) => (Array.isArray(p?.data) ? p.data : []),
  },
];
if (args.latest) {
  VARIANTS.push({
    id: 'D', label: 'v2 latest',
    request: (o, d) => ({ path: '/v2/prices/latest', params: { origin: o, destination: d, currency: CURRENCY, period_type: 'year', one_way: 'false', limit: 5, sorting: 'price' } }),
    parse: (p) => (Array.isArray(p?.data) ? p.data : []),
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const redact = (s) => String(s).split(TOKEN || '\u0000').join('<token>');

// Returns { status: 'data' | 'empty' | 'error', count, min, note }
async function call(variant, origin, dest) {
  const { path: p, params } = variant.request(origin, dest);
  const url = new URL(API_BASE + p);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  url.searchParams.set('token', TOKEN); // the Data API takes the token as a query parameter, as the fetch script does
  for (let attempt = 0; attempt < 2; attempt++) {
    let res;
    try {
      res = await fetch(url, { headers: { 'Accept-Encoding': 'gzip, deflate' }, signal: AbortSignal.timeout(20000) });
    } catch (err) {
      return { status: 'error', count: 0, min: null, note: redact(err?.message || err) };
    }
    if (res.status === 429 && attempt === 0) { await sleep(5000); continue; }
    if (!res.ok) return { status: 'error', count: 0, min: null, note: `HTTP ${res.status}` };
    let body;
    try { body = await res.json(); } catch { return { status: 'error', count: 0, min: null, note: 'not JSON' }; }
    if (body && body.success === false) return { status: 'error', count: 0, min: null, note: redact(body.error || 'success=false') };
    const rows = variant.parse(body, dest) || [];
    const prices = rows.map((r) => Number(r?.price ?? r?.value)).filter((n) => Number.isFinite(n) && n > 0);
    return rows.length
      ? { status: 'data', count: rows.length, min: prices.length ? Math.min(...prices) : null, note: '' }
      : { status: 'empty', count: 0, min: null, note: '' };
  }
  return { status: 'error', count: 0, min: null, note: 'HTTP 429 (rate limited)' };
}

async function main() {
  if (!TOKEN) {
    console.error('TRAVELPAYOUTS_TOKEN is not set. Set it in your own terminal (see the usage note at the top of this file).');
    process.exit(2);
  }
  for (const d of DESTS) if (!ALL_DESTS[d]) { console.error(`Unknown destination code ${d}. Use codes from the Sparkfare destination list.`); process.exit(2); }

  const total = ORIGINS.length * DESTS.length * VARIANTS.length;
  console.log(`Probing ${ORIGINS.length} origins x ${DESTS.length} destinations x ${VARIANTS.length} variants = ${total} calls`);
  console.log(`About ${Math.ceil((total * (DELAY + 300)) / 60000)} minute(s) at ${DELAY} ms between calls (limit is 300 per minute).`);
  console.log(`Variants: ${VARIANTS.map((v) => `${v.id}=${v.label}`).join(', ')}`);
  if (!args.yes) { console.log('Starting in 5 seconds (Ctrl+C to cancel, or pass --yes to skip this pause)...'); await sleep(5000); }

  const results = []; // { origin, dest, variant, status, count, min, note }
  let n = 0;
  let consecutiveErrors = 0;
  for (const origin of ORIGINS) {
    for (const dest of DESTS) {
      for (const variant of VARIANTS) {
        n++;
        const r = await call(variant, origin, dest);
        results.push({ origin, dest, variant: variant.id, ...r });
        consecutiveErrors = r.status === 'error' ? consecutiveErrors + 1 : 0;
        if (n % 20 === 0) console.log(`  ${n}/${total} done`);
        if (consecutiveErrors >= 8) {
          console.error(`Stopping: ${consecutiveErrors} errors in a row (last: ${r.note}). Check the token and the rate limit, then re-run.`);
          return finish(results, true);
        }
        if (n < total) await sleep(DELAY);
      }
    }
  }
  finish(results, false);
}

function finish(results, aborted) {
  const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '-');
  console.log('\nCoverage: routes with data / routes probed, per origin and variant');
  console.log(['origin', ...VARIANTS.map((v) => `${v.id} ${v.label}`.padEnd(22))].join('  ').replace(/^/, ''));
  const summary = {};
  for (const origin of ORIGINS) {
    const cells = VARIANTS.map((v) => {
      const rows = results.filter((r) => r.origin === origin && r.variant === v.id);
      const hit = rows.filter((r) => r.status === 'data').length;
      const err = rows.filter((r) => r.status === 'error').length;
      summary[`${origin}:${v.id}`] = { hit, total: rows.length, errors: err };
      return `${hit}/${rows.length} ${pct(hit, rows.length)}${err ? ` (${err} err)` : ''}`.padEnd(22);
    });
    console.log([origin.padEnd(6), ...cells].join('  '));
  }

  console.log('\nWhat each origin shows:');
  for (const origin of ORIGINS) {
    const a = summary[`${origin}:A`];
    const best = VARIANTS.slice(1).reduce((m, v) => (summary[`${origin}:${v.id}`].hit > m.hit ? { id: v.id, hit: summary[`${origin}:${v.id}`].hit } : m), { id: null, hit: a.hit });
    if (a.total === 0) continue;
    const errored = VARIANTS.reduce((n, v) => n + summary[`${origin}:${v.id}`].errors, 0);
    if (errored) { console.log(`  ${origin}: ${errored} call(s) errored, so this origin cannot be judged cleanly. See the errors below and re-run it with --origins ${origin}.`); continue; }
    if (best.id) console.log(`  ${origin}: variant ${best.id} found data on ${best.hit} routes where today's call (A) found ${a.hit}. A different endpoint helps here.`);
    else if (a.hit === 0) console.log(`  ${origin}: no variant returned any fare. The data is not in the cache for this origin.`);
    else console.log(`  ${origin}: no variant beat today's call (A: ${a.hit}).`);
  }

  const errs = results.filter((r) => r.status === 'error');
  if (errs.length) {
    const kinds = {};
    for (const e of errs) kinds[`${e.variant}: ${e.note}`] = (kinds[`${e.variant}: ${e.note}`] || 0) + 1;
    console.log('\nErrors (an error is not an empty result; it means that variant could not be judged):');
    for (const [k, c] of Object.entries(kinds)) console.log(`  ${c} x ${k}`);
  }

  const outPath = args.out || path.join('scratch', `probe-origin-coverage-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ ranAt: new Date().toISOString(), aborted, month: MONTH, origins: ORIGINS, dests: DESTS, variants: VARIANTS.map((v) => ({ id: v.id, label: v.label })), summary, results }, null, 2));
  console.log(`\nFull results written to ${outPath}${aborted ? ' (run was stopped early)' : ''}`);
  if (aborted) process.exitCode = 1;
}

main().catch((err) => { console.error(redact(err?.stack || err)); process.exit(1); });
