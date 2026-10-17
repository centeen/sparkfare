import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  analyze, buildRequest, renderEvidence, run, scrub, repoNormalizeSubId, STATS_URL, CAMPAIGN_ID, PAGE_LIMIT, FIELDS, MARKER,
} from '../scripts/travelpayouts-stats-evidence.mjs';

// Addendum H section 2 (D-019, ROADMAP step 98): the one read-only statistics call for campaign 100. Nothing here touches the real API.

const TOKEN = 'tok_SECRET_value_1234567890';
const ID = 'a'.repeat(32);
const NOW = new Date('2026-10-17T12:00:00Z');
const jsonRes = (obj, status = 200) => new Response(JSON.stringify(obj), { status });

test('the request is read-only and matches what reconcileBookings sends: campaign 100, actions, no traveler data', () => {
  const r = buildRequest({ from: '2026-10-01' });
  assert.equal(CAMPAIGN_ID, 100);
  assert.deepEqual(r.fields, FIELDS);
  assert.deepEqual(r.filters, [
    { field: 'date', op: 'ge', value: '2026-10-01' },
    { field: 'campaign_id', op: 'eq', value: 100 },
    { field: 'type', op: 'eq', value: 'action' },
  ]);
  assert.equal(r.limit, PAGE_LIMIT);
  assert.ok(!JSON.stringify(r).match(/@|email|user/i));
  const src = fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
  assert.match(src, /const AVIASALES_CAMPAIGN_ID = 100;/, 'the script and the repo agree on the campaign id');
  assert.match(src, new RegExp(`fields: \\['sub_id', 'state', 'date', 'price_eur'\\]`), 'the script asks for the same fields as the repo');
});

test('exactly one call is made, with the token only in the X-Access-Token header', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => { calls.push({ url, options }); return jsonRes({ results: [{ sub_id: ID, state: 'paid', date: '2026-10-05', price_eur: 12.5 }] }); };
  const r = await run({ token: TOKEN, from: '2026-10-01', to: '2026-10-17', fetchImpl, now: NOW });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, STATS_URL);
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers['X-Access-Token'], TOKEN);
  assert.ok(!calls[0].options.body.includes(TOKEN) && !calls[0].url.includes(TOKEN), 'the token is not in the body or the address');
  assert.ok(!r.text.includes(TOKEN));
  assert.match(r.text, /Calls made: 1\. HTTP status: 200/);
});

test('a full page is reported, and a second call happens only when asked for', async () => {
  const rows = Array.from({ length: PAGE_LIMIT }, () => ({ sub_id: ID, state: 'paid', date: '2026-10-05', price_eur: 1 }));
  let n = 0;
  const fetchImpl = async () => { n += 1; return jsonRes({ results: rows }); };
  const one = await run({ token: TOKEN, from: '2026-10-01', to: '2026-10-17', fetchImpl, now: NOW });
  assert.equal(n, 1);
  assert.match(one.text, /page limit of 1000 was reached/);
  n = 0;
  const two = await run({ token: TOKEN, from: '2026-10-01', to: '2026-10-17', fetchImpl, now: NOW, page2: true });
  assert.equal(n, 2);
  assert.match(two.text, /Calls made: 2/);
  assert.match(two.text, /Rows returned: \*\*2000\*\*/);
});

test('a failed call reports the status and the error text with the token removed, and does not retry', async () => {
  let n = 0;
  const fetchImpl = async () => { n += 1; return new Response(`bad token ${TOKEN} rejected`, { status: 401 }); };
  const r = await run({ token: TOKEN, from: '2026-10-01', to: '2026-10-17', fetchImpl, now: NOW });
  assert.equal(n, 1, 'no retry loop');
  assert.equal(r.ok, false);
  assert.match(r.text, /HTTP status: 401/);
  assert.match(r.text, /did not succeed/);
  assert.ok(!r.text.includes(TOKEN));
  assert.match(r.text, /\[token removed\]/);
  assert.equal(scrub(`x ${TOKEN} y`, TOKEN), 'x [token removed] y');
});

test('a missing token stops before any request', async () => {
  let n = 0;
  await assert.rejects(() => run({ token: '', from: '2026-10-01', to: '2026-10-17', fetchImpl: async () => { n += 1; return jsonRes({}); } }), /TRAVELPAYOUTS_TOKEN/);
  assert.equal(n, 0);
});

test('the sub_id facts: leading period, marker, and whether the repo normalisation recovers a trip id', () => {
  const a = analyze({
    results: [
      { sub_id: ID, state: 'paid', date: '2026-10-05', price_eur: 10 },
      { sub_id: '.' + ID, state: 'paid', date: '2026-10-06', price_eur: 20.25 },
      { sub_id: `${MARKER}.${ID}`, state: 'processing', date: '2026-10-07' },
      { sub_id: 'something-else', state: 'cancelled', date: '2026-10-08' },
      { sub_id: null, state: 'paid', date: '2026-10-09', price_eur: 1 },
    ],
  });
  assert.equal(a.rowCount, 5);
  assert.equal(a.subId.present, 4);
  assert.equal(a.subId.empty, 1);
  assert.equal(a.subId.leadingPeriod, 1);
  assert.equal(a.subId.containsMarker, 1);
  assert.equal(a.subId.markerPrefix, 1);
  assert.equal(a.subId.tripIdAsIs, 1);
  assert.equal(a.subId.tripIdAfterRepoNormalize, 3, 'plain, leading-period and marker-prefixed all recover the trip id');
  assert.equal(a.priceEurSum, 31.25);
  assert.deepEqual(a.dateRange, { first: '2026-10-05', last: '2026-10-09' });
  assert.deepEqual(a.states, { paid: 3, processing: 1, cancelled: 1 });
  assert.equal(repoNormalizeSubId('.' + ID), ID);
  assert.equal(repoNormalizeSubId(`${MARKER}.${ID}`), ID);
});

test('the restated normalisation gives the same answer as the repo function for every shape that could come back', async () => {
  const { normalizeSubId } = await import('../src/index.js');
  for (const v of [ID, '.' + ID, '..' + ID, `${MARKER}.${ID}`, `.${MARKER}.${ID}`, ` ${ID} `, '', '   ', null, undefined, 42, 'x']) {
    assert.equal(repoNormalizeSubId(v) || null, normalizeSubId(v), JSON.stringify(v));
  }
});

test('the evidence names no real sub_id value (this note is committed to a public repo)', async () => {
  const fetchImpl = async () => jsonRes({ results: [{ sub_id: ID, state: 'paid', date: '2026-10-05', price_eur: 5 }, { sub_id: '.' + 'b'.repeat(32), state: 'paid', date: '2026-10-06', price_eur: 6 }] });
  const r = await run({ token: TOKEN, from: '2026-10-01', to: '2026-10-17', fetchImpl, now: NOW });
  assert.ok(!r.text.includes(ID) && !r.text.includes('b'.repeat(32)));
  assert.match(r.text, /Starts with a leading period: 1/);
});

test('an empty answer is reported honestly: accepted call, nothing to confirm, no claim the filter is right', async () => {
  const r = await run({ token: TOKEN, from: '2026-10-01', to: '2026-10-17', fetchImpl: async () => jsonRes({ results: [] }), now: NOW });
  assert.equal(r.ok, true);
  assert.match(r.text, /Rows returned: \*\*0\*\*/);
  assert.match(r.text, /cannot be confirmed from this call/);
  assert.match(r.text, /does not show the filter is wrong/);
});

test('differences from the repo are called out: missing field, an extra field, an unrecognised sub_id', () => {
  const text = renderEvidence({
    status: 200, ok: true, endpointPath: '/statistics/v1/execute_query', from: '2026-10-01', to: '2026-10-17', calls: 1, generatedAt: '2026-10-17',
    analysis: analyze({ results: [{ sub_id: 'zzz', state: 'paid', date: '2026-10-05', commission: 3 }] }),
  });
  assert.match(text, /requested fields are missing[^\n]*price_eur/);
  assert.match(text, /Extra fields[^\n]*commission/);
  assert.match(text, /do not look like a trip id/);
});

test('run from a terminal: reads the token only from the environment, writes the note, prints no token', async () => {
  const server = http.createServer((req, res) => {
    let b = '';
    req.on('data', (c) => { b += c; });
    req.on('end', () => {
      const ok = req.headers['x-access-token'] === TOKEN && req.method === 'POST';
      res.writeHead(ok ? 200 : 401, { 'Content-Type': 'application/json' });
      res.end(ok ? JSON.stringify({ results: [{ sub_id: '.' + ID, state: 'paid', date: '2026-10-05', price_eur: 7 }] }) : `no good, saw ${req.headers['x-access-token']}`);
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-ev-'));
  const out = path.join(dir, 'e.md');
  try {
    // The script talks to the real host by design; this test drives its exported run() through the fake server instead, then checks the CLI refuses without a token.
    const r = await run({ token: TOKEN, from: '2026-10-01', to: '2026-10-17', url: `http://127.0.0.1:${port}/statistics/v1/execute_query`, now: NOW });
    assert.equal(r.ok, true);
    assert.match(r.text, /Starts with a leading period: 1/);
    const noToken = spawnSync(process.execPath, ['scripts/travelpayouts-stats-evidence.mjs', '--out', out], { env: { ...process.env, TRAVELPAYOUTS_TOKEN: '' }, cwd: new URL('..', import.meta.url), encoding: 'utf8' });
    assert.notEqual(noToken.status, 0);
    assert.match(noToken.stderr, /TRAVELPAYOUTS_TOKEN/);
    assert.equal(fs.existsSync(out), false, 'nothing is written without a token');
  } finally { server.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the script reads no .env file, no secret store, and prints no header', () => {
  const src = fs.readFileSync(new URL('../scripts/travelpayouts-stats-evidence.mjs', import.meta.url), 'utf8');
  assert.ok(!/readFileSync\([^)]*\.env/.test(src));
  assert.ok(!/console\.(log|error)\([^)]*(token|headers)/i.test(src.replace(/process\.env\.TRAVELPAYOUTS_TOKEN/g, '')), 'no log line prints the token or the headers');
  assert.match(src, /process\.env\.TRAVELPAYOUTS_TOKEN/);
});
