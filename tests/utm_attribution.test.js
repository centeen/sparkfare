// Launch-source attribution (ROADMAP step 52): utm.js captures the tag, the pages send it, the Worker sanitizes it and
// stores it in the signup event's meta. Before this, the launch posts were UTM-tagged but nothing recorded the tags.
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import vm from 'node:vm';
import { makeSqliteD1 } from './helpers/sqliteD1.js';
import worker from '../src/index.js';

const MIGRATIONS = fs.readdirSync(new URL('../migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort().map((f) => `migrations/${f}`);
const ctx = { waitUntil: (p) => { if (p && p.catch) p.catch(() => {}); return p; } };
const SRC = fs.readFileSync(new URL('../utm.js', import.meta.url), 'utf8');

// Runs utm.js as a browser would, with a given URL search string and an existing sessionStorage.
function run(search, store = {}, { blocked = false } = {}) {
  const win = {};
  const storage = blocked
    ? { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } }
    : { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  vm.runInNewContext(SRC, { window: win, location: { search }, sessionStorage: storage, URLSearchParams });
  return { get: win.sparkfareUtm, store };
}

test('utm.js builds source_campaign_content, lowercased and sanitized', () => {
  assert.equal(run('?utm_source=HackerNews&utm_medium=social&utm_campaign=launch').get(), 'hackernews_launch');
  assert.equal(run('?utm_source=reddit&utm_campaign=launch&utm_content=Travel%20Deals!').get(), 'reddit_launch_traveldeals');
  assert.equal(run('?utm_source=producthunt').get(), 'producthunt');
});

test('no utm_source means no tag, and junk or a script tag never survives', () => {
  assert.equal(run('').get(), null);
  assert.equal(run('?utm_campaign=launch').get(), null);
  assert.equal(run('?utm_source=%3Cscript%3Ealert(1)%3C%2Fscript%3E').get(), 'scriptalert1script');
});

test('the tag is capped at 40 characters', () => {
  const long = 'a'.repeat(100);
  assert.ok(run(`?utm_source=${long}&utm_campaign=${long}&utm_content=${long}`).get().length <= 40);
});

test('first touch wins within a session, and a later untagged page keeps it', () => {
  const store = {};
  run('?utm_source=hackernews&utm_campaign=launch', store);
  assert.equal(run('', store).get(), 'hackernews_launch');
  assert.equal(run('?utm_source=reddit', store).get(), 'hackernews_launch', 'a second tag must not overwrite the first');
});

test('blocked sessionStorage does not break the page and the current tag still works', () => {
  assert.equal(run('?utm_source=x', {}, { blocked: true }).get(), 'x');
  assert.equal(run('', {}, { blocked: true }).get(), null);
});

test('utm.js is a first-party helper: no cookie, no network, no third party', () => {
  assert.doesNotMatch(SRC, /document\.cookie|fetch\(|XMLHttpRequest|sendBeacon|https?:\/\//);
});

test('the homepage and /check load utm.js and send the tag with the signup', () => {
  const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const check = fs.readFileSync(new URL('../check.html', import.meta.url), 'utf8');
  for (const [name, html] of [['index.html', index], ['check.html', check]]) {
    assert.ok(html.includes('<script src="/utm.js"></script>'), `${name} loads utm.js`);
    assert.match(html, /sparkfareUtm/, `${name} reads the tag`);
  }
  assert.match(index, /payload\.utm = utmTag/);
  assert.match(check, /utm: window\.sparkfareUtm\(\)/);
});

// ---- Worker ---------------------------------------------------------------------------------------------------

const post = (DB, body) => worker.fetch(new Request('https://sparkfare.com/api/signup', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}), { DB }, ctx);
const base = (email, extra = {}) => ({ id: `local_${email}`, email, origin_iata: 'JFK', trip_length: '7-10', ...extra });
const signupEvents = (DB) => DB.raw.prepare("SELECT source, meta FROM events WHERE event_type = 'signup' ORDER BY rowid").all();
const settle = () => new Promise((r) => setTimeout(r, 25));

test('a signup with a utm stores it in the signup event meta and leaves source alone', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  assert.equal((await post(DB, base('a@example.com', { utm: 'hackernews_launch', source: 'check' }))).status, 200);
  await settle();
  const rows = signupEvents(DB);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].source, 'check');
  assert.deepEqual(JSON.parse(rows[0].meta), { utm: 'hackernews_launch' });
});

test('the Worker sanitizes the utm itself and ignores a missing or non-string one', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  await post(DB, base('b@example.com', { utm: 'Reddit_Launch<script>' }));
  await post(DB, base('c@example.com'));
  await post(DB, base('d@example.com', { utm: { evil: true } }));
  await post(DB, base('e@example.com', { utm: 'x'.repeat(200) }));
  await settle();
  const rows = signupEvents(DB);
  assert.equal(rows.length, 4);
  assert.deepEqual(JSON.parse(rows[0].meta), { utm: 'reddit_launchscript' });
  assert.equal(rows[1].meta, null);
  assert.equal(rows[2].meta, JSON.stringify({ utm: 'objectobject' }));
  assert.equal(JSON.parse(rows[3].meta).utm.length, 40);
});

test('a resubmit by an existing email logs its own signup event, so attribution is the earliest event per user', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  await post(DB, base('f@example.com', { utm: 'producthunt_launch' }));
  await post(DB, base('f@example.com', { utm: 'reddit_launch' }));
  await settle();
  const rows = signupEvents(DB);
  assert.equal(rows.length, 2);
  assert.deepEqual(JSON.parse(rows[0].meta), { utm: 'producthunt_launch' }, 'the first event carries the first touch');
  assert.deepEqual(JSON.parse(rows[1].meta), { utm: 'reddit_launch' });
});

test('privacy.html says a source tag is kept for the session and recorded with the signup', () => {
  const html = fs.readFileSync(new URL('../privacy.html', import.meta.url), 'utf8');
  assert.match(html, /source tag/);
  assert.match(html, /browser session/);
});
