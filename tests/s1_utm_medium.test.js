// Addendum S, S1 (D-065): utm_medium is carried from the landing URL to the signup event's meta. Before this nothing read it.
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import vm from 'node:vm';
import { makeSqliteD1 } from './helpers/sqliteD1.js';
import worker from '../src/index.js';
import { normalizeUtmMedium, UTM_MEDIA } from '../src/attribution.js';

const MIGRATIONS = fs.readdirSync(new URL('../migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort().map((f) => `migrations/${f}`);
const ctx = { waitUntil: (p) => { if (p && p.catch) p.catch(() => {}); return p; } };
const SRC = fs.readFileSync(new URL('../attribution.js', import.meta.url), 'utf8');

// Runs attribution.js as a browser would and returns what a signup POST would carry.
async function signupBodyFor(search) {
  const store = {};
  const sent = [];
  const win = { fetch: async (url, init) => { sent.push({ url, init }); return {}; } };
  vm.runInNewContext(SRC, {
    window: win, URLSearchParams, URL,
    location: { search, hostname: 'sparkfare.com', pathname: '/check' },
    document: { referrer: '' },
    sessionStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
  });
  await win.fetch('/api/signup', { method: 'POST', body: JSON.stringify({ email: 'x@example.com' }) });
  return JSON.parse(sent.find((s) => /\/api\/signup/.test(s.url)).init.body);
}

test('the browser adds utm_medium to a signup and keeps the existing channel and campaign', async () => {
  const body = await signupBodyFor('?utm_source=linkedin&utm_medium=Post&utm_campaign=launch_nov7');
  assert.equal(body.medium, 'post');
  assert.equal(body.channel, 'linkedin');
  assert.equal(body.campaign, 'launch_nov7');
});

test('no utm_medium means no medium field, and it is not sent to the landing counter', async () => {
  const body = await signupBodyFor('?utm_source=bluesky');
  assert.equal('medium' in body, false);
  const store = {};
  const sent = [];
  const win = { fetch: async (url, init) => { sent.push({ url, init }); return {}; } };
  vm.runInNewContext(SRC, {
    window: win, URLSearchParams, URL, fetch: win.fetch,
    location: { search: '?utm_source=reddit&utm_medium=comment', hostname: 'sparkfare.com', pathname: '/' },
    document: { referrer: '' },
    sessionStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
  });
  const landing = sent.find((s) => /\/api\/landing/.test(s.url));
  assert.ok(landing, 'the landing count is still sent');
  assert.equal('medium' in JSON.parse(landing.init.body), false);
});

test('normalizeUtmMedium keeps the convention values and maps everything else to other', () => {
  for (const m of UTM_MEDIA) assert.equal(normalizeUtmMedium(m), m);
  assert.equal(normalizeUtmMedium('POST'), 'post');
  assert.equal(normalizeUtmMedium('cpc'), 'other');
  assert.equal(normalizeUtmMedium('<script>'), 'other');
  assert.equal(normalizeUtmMedium(''), null);
  assert.equal(normalizeUtmMedium(undefined), null);
  assert.equal(normalizeUtmMedium({ a: 1 }), 'other');
});

const post = (DB, body) => worker.fetch(new Request('https://sparkfare.com/api/signup', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}), { DB }, ctx);
const base = (email, extra = {}) => ({ id: `local_${email}`, email, origin_iata: 'JFK', trip_length: '7-10', ...extra });
const events = (DB) => DB.raw.prepare("SELECT meta FROM events WHERE event_type = 'signup' ORDER BY rowid").all();
const settle = () => new Promise((r) => setTimeout(r, 25));

test('the Worker stores the medium in the signup event meta next to the utm tag', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  await post(DB, base('a@example.com', { utm: 'linkedin_launch_nov7', medium: 'post' }));
  await post(DB, base('b@example.com', { medium: 'email' }));
  await post(DB, base('c@example.com', { medium: 'cpc' }));
  await post(DB, base('d@example.com'));
  await settle();
  const rows = events(DB).map((r) => (r.meta ? JSON.parse(r.meta) : null));
  assert.deepEqual(rows[0], { utm: 'linkedin_launch_nov7', utm_medium: 'post' });
  assert.deepEqual(rows[1], { utm_medium: 'email' });
  assert.deepEqual(rows[2], { utm_medium: 'other' });
  assert.equal(rows[3], null, 'no tag and no medium leaves meta empty, as before');
});

test('the tag conventions document exists and lists the values the code keeps', () => {
  const doc = fs.readFileSync(new URL('../docs/metrics/SOURCE_TAGS.md', import.meta.url), 'utf8');
  for (const v of ['producthunt', 'hackernews', 'reddit', 'linkedin', 'bluesky', 'press', 'newsletter', 'community', 'podcast', 'directory', 'founding',
    'launch_nov7', 'report_nov11', 'aaa_wave', 'vfr_', 'sale_check', ...UTM_MEDIA]) {
    assert.ok(doc.includes(v), `SOURCE_TAGS.md mentions ${v}`);
  }
});
