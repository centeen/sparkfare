// Away Move 3 (ROADMAP step 55): the /leave "Leave-ready" page behind ENABLE_LEAVE_READY.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../src/index.js';
import { AWAY_MODE_PARTNERS } from '../src/email.js';
import {
  buildLeaveReadyPlan, normalizeAnswers, tripLengthForSignup, QUESTIONS, QUESTION_KEYS, USPS_HOLD_MAIL, MAIL_PARTNER_SLUG,
} from '../src/leaveReady.js';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const LIVE = [{ slug: 'us-global-mail', name: 'US Global Mail' }, { slug: 'yesim', name: 'Yesim' }];
const ALL_NO = { length: 'month_plus', pets: 'yes', plants: 'yes', checkin: 'no', mail: 'no', water: 'no' };
const ALL_YES = { length: 'weekend', pets: 'no', plants: 'no', checkin: 'yes', mail: 'yes', water: 'yes' };

// ---- the pure plan builder ---------------------------------------------------------------------

test('every answer combination of the five yes/no/skip questions builds a consistent plan', () => {
  const v = ['yes', 'no', 'skip'];
  let n = 0;
  for (const pets of v) for (const plants of v) for (const checkin of v) for (const mail of v) for (const water of v) {
    for (const length of ['weekend', 'one_two_weeks', 'month_plus', 'skip']) {
      const plan = buildLeaveReadyPlan({ length, pets, plants, checkin, mail, water }, LIVE);
      n += 1;
      const open = plan.open.length;
      assert.equal(plan.summary, open === 0 ? 'Nothing left to sort from your answers.' : open === 1 ? '1 thing left to sort' : `${open} things left to sort`);
      const keys = [...plan.open, ...plan.done].map((i) => i.key);
      assert.equal(new Set(keys).size, keys.length, 'an item is either open or done, never both or twice');
      assert.ok(plan.skipped.every((k) => plan.answers[k] === 'skip'));
    }
  }
  assert.equal(n, 3 ** 5 * 4, '3^5 x 4 combinations');
});

test('what is done and what is open follows the answers', () => {
  const none = buildLeaveReadyPlan(ALL_NO, LIVE);
  assert.deepEqual(none.open.map((i) => i.key).sort(), ['checkin', 'mail', 'pets', 'plants', 'water']);
  assert.equal(none.done.length, 0);
  assert.equal(none.summary, '5 things left to sort');
  const all = buildLeaveReadyPlan(ALL_YES, LIVE);
  assert.deepEqual(all.done.map((i) => i.key).sort(), ['checkin', 'mail', 'water']);
  assert.equal(all.open.length, 0);
  assert.equal(all.summary, 'Nothing left to sort from your answers.');
});

test('skipped or missing answers are never turned into open items', () => {
  const plan = buildLeaveReadyPlan({}, LIVE);
  assert.equal(plan.open.length, 0);
  assert.equal(plan.done.length, 0);
  assert.deepEqual(plan.skipped.sort(), [...QUESTION_KEYS].sort());
});

test('mail: the free USPS route comes first, and the partner only for a long trip and only when live', () => {
  const long = buildLeaveReadyPlan({ mail: 'no', length: 'month_plus' }, LIVE).open[0];
  assert.deepEqual(long.links.map((l) => l.href), [USPS_HOLD_MAIL.href, `/out/${MAIL_PARTNER_SLUG}?src=leave`]);
  assert.equal(long.links[0].sponsored, false);
  assert.equal(long.links[1].sponsored, true);
  const short = buildLeaveReadyPlan({ mail: 'no', length: 'weekend' }, LIVE).open[0];
  assert.deepEqual(short.links.map((l) => l.href), [USPS_HOLD_MAIL.href], 'no partner for a short trip');
  const notLive = buildLeaveReadyPlan({ mail: 'no', length: 'month_plus' }, [{ slug: 'yesim', name: 'Yesim' }]).open[0];
  assert.deepEqual(notLive.links.map((l) => l.href), [USPS_HOLD_MAIL.href], 'no partner link when it is not in the live registry');
  const none = buildLeaveReadyPlan({ mail: 'no', length: 'month_plus' }).open[0];
  assert.deepEqual(none.links.map((l) => l.href), [USPS_HOLD_MAIL.href]);
  assert.match(USPS_HOLD_MAIL.href, /^https:\/\/www\.usps\.com\//);
});

test('pets, plants, check-in and water link to no partner at all', () => {
  const plan = buildLeaveReadyPlan({ ...ALL_NO, mail: 'yes' }, LIVE);
  for (const item of plan.open) assert.deepEqual(item.links, [], item.key);
  const everyLink = buildLeaveReadyPlan(ALL_NO, LIVE).open.flatMap((i) => i.links);
  assert.ok(everyLink.every((l) => l.sponsored === false || /^\/out\/[a-z-]+\?src=leave$/.test(l.href)));
  assert.ok(everyLink.filter((l) => l.sponsored).every((l) => LIVE.some((p) => p.slug === l.slug)));
});

test('no percentage, score or safety claim anywhere in the plan or the page', () => {
  const text = JSON.stringify(buildLeaveReadyPlan(ALL_NO, LIVE)) + JSON.stringify(buildLeaveReadyPlan(ALL_YES, LIVE)) + read('leave.html').replace(/<style>[\s\S]*?<\/style>/, '') + JSON.stringify(QUESTIONS);  // CSS has widths like 100%
  assert.doesNotMatch(text, /\d\s?%|\bscore\b|protected|\bsafe\b|\bsecure[ds]?\b|guarantee|locked in|you'?re ready|home is ready/i);
});

test('answers are normalized: unknown keys, free text and odd values are dropped to skip', () => {
  assert.deepEqual(normalizeAnswers({ pets: 'maybe', mail: '<script>', extra: 'x', length: 'weekend', water: 'yes' }), { length: 'weekend', pets: 'skip', plants: 'skip', checkin: 'skip', mail: 'skip', water: 'yes' });
  assert.deepEqual(Object.keys(normalizeAnswers(null)), QUESTION_KEYS);
  assert.deepEqual(Object.keys(normalizeAnswers('x')), QUESTION_KEYS);
});

test('trip length maps to the buckets /api/signup already stores', () => {
  assert.deepEqual(['weekend', 'one_two_weeks', 'month_plus', 'skip'].map(tripLengthForSignup), ['weekend', '7-10', '2+ weeks', '7-10']);
});

test('the page asks exactly the questions the plan builder knows, in the same order', () => {
  const html = read('leave.html');
  const m = html.match(/const QUESTIONS = \[([\s\S]*?)\n    \];/)[1];
  const pageKeys = [...m.matchAll(/key: '(\w+)'/g)].map((x) => x[1]);
  const pageTexts = [...m.matchAll(/text: '([^']+)'/g)].map((x) => x[1]);
  assert.deepEqual(pageKeys, QUESTION_KEYS);
  assert.deepEqual(pageTexts, QUESTIONS.map((q) => q.text));
});

// ---- the routes --------------------------------------------------------------------------------

function makeEnv(extra = {}) {
  const db = new DatabaseSync(':memory:');
  db.exec("CREATE TABLE events (id TEXT PRIMARY KEY, event_type TEXT NOT NULL, user_id TEXT, anon_id TEXT, origin TEXT, route TEXT, partner TEXT, sub_id TEXT, source TEXT, meta TEXT, ts TEXT DEFAULT (datetime('now')))");
  const stmt = (sql, p) => ({ run: async () => { db.prepare(sql).run(...p); return { success: true, meta: { changes: 1 } }; }, first: async () => db.prepare(sql).get(...p) ?? null, all: async () => ({ results: db.prepare(sql).all(...p) }) });
  const DB = { _db: db, prepare: (sql) => ({ ...stmt(sql, []), bind: (...p) => stmt(sql, p) }) };
  return {
    DB, APP_URL: 'https://sparkfare.com',
    ASSETS: { fetch: async (req) => { const u = new URL(req.url).pathname; if (u === '/leave.html') return { ok: true, text: async () => read('leave.html') }; return { ok: false, text: async () => '', json: async () => ({}) }; } },
    ...extra,
  };
}

async function call(path, env, init) {
  const pending = [];
  const res = await worker.fetch(new Request(`https://sparkfare.com${path}`, init), env, { waitUntil: (p) => pending.push(p) });
  await Promise.all(pending);
  return res;
}
const events = (env, type) => env.DB._db.prepare('SELECT * FROM events WHERE event_type = ? ORDER BY rowid').all(type);
const post = (answers) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ answers }) });

test('flag off (the default): /leave, the plan API and the link from a route page all stay out of sight', async () => {
  const env = makeEnv();
  assert.equal((await call('/leave', env)).status, 404);
  assert.equal((await call('/leave', env, { method: 'HEAD' })).status, 404);
  assert.equal((await call('/api/leave/plan', env, post(ALL_NO))).status, 404);
  assert.equal(events(env, 'leave_view').length + events(env, 'leave_answer').length, 0);
  assert.match(read('wrangler.jsonc'), /"ENABLE_LEAVE_READY": "false"/);
  assert.match(read('wrangler.jsonc'), /"\/leave",/, '/leave is routed to the Worker');
});

test('flag on: the page is served, the plan API answers, and the events are logged without free text', async () => {
  const env = makeEnv({ ENABLE_LEAVE_READY: 'true' });
  const page = await call('/leave?src=away-mode', env);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Before you leave/);
  assert.equal((await call('/leave', env, { method: 'HEAD' })).status, 200);
  assert.equal(events(env, 'leave_view')[0].source, 'away-mode');

  const res = await call('/api/leave/plan', env, post({ ...ALL_NO, pets: '<b>x</b>' }));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.deepEqual(data.plan.open.map((i) => i.key).sort(), ['checkin', 'mail', 'plants', 'water'], 'bad pets value was treated as skip');
  const answered = events(env, 'leave_answer').map((e) => JSON.parse(e.meta));
  assert.deepEqual(answered.sort((a, b) => a.key.localeCompare(b.key)), [
    { key: 'checkin', answer: 'no' }, { key: 'length', answer: 'month_plus' }, { key: 'mail', answer: 'no' }, { key: 'plants', answer: 'yes' }, { key: 'water', answer: 'no' },
  ]);
  assert.equal(events(env, 'leave_result_view').length, 1);
  assert.ok(events(env, 'leave_answer').every((e) => !e.user_id && !e.anon_id), 'no identifier attached');
  assert.equal((await call('/api/leave/plan', env, { method: 'POST', body: 'not json' })).status, 400);
});

test('the plan API never offers a partner link that is not live: with no database the in-memory registry is used', async () => {
  const env = makeEnv({ ENABLE_LEAVE_READY: 'true', DB: undefined });
  const data = await (await call('/api/leave/plan', env, post({ mail: 'no', length: 'month_plus' }))).json();
  const links = data.plan.open[0].links;
  assert.equal(links[0].href, USPS_HOLD_MAIL.href);
  const slugs = AWAY_MODE_PARTNERS.map((p) => p.slug);
  for (const l of links.filter((x) => x.sponsored)) assert.ok(slugs.includes(l.slug));
});

test('a signup from the page is logged as leave_signup', async () => {
  const src = read('src/index.js');
  assert.match(src, /signupSource === 'leave'[\s\S]{0,200}event_type: 'leave_signup'/);
  assert.match(read('leave.html'), /source: 'leave'/);
});

// ---- the page ----------------------------------------------------------------------------------

test('the page: noindex-free, mobile tap targets, shared nav and footer hooks, disclosure beside partner links, no local storage', () => {
  const html = read('leave.html');
  assert.match(html, /<link rel="canonical" href="https:\/\/sparkfare\.com\/leave"/);
  assert.match(html, /min-height: 44px/);
  assert.match(html, /id="sign-in-nav-link"/);
  assert.match(html, /syncNavAuthState\)/);
  assert.match(html, /\/site-footer\.js/);
  assert.match(html, /Sparkfare may earn a commission if you buy through a partner link/);
  assert.match(html, /sponsored nofollow noopener noreferrer/);
  assert.doesNotMatch(html, /localStorage|sessionStorage|document\.cookie/);
  assert.doesNotMatch(html, /skimresources|aviasales/i);
  const wrap = html.indexOf('id="partner-note"');
  assert.ok(wrap > html.indexOf('id="open-list"'), 'the disclosure sits with the results');
});

test('privacy.html says what the checklist collects and where it goes', () => {
  const html = read('privacy.html');
  assert.match(html, /Leave-ready checklist/);
  assert.match(html, /never free text/);
  assert.match(html, /If you are signed in, we also save your answers to your account/);
  assert.match(html, /if you are not signed in, we do not save them anywhere/i);
});

test('/away-mode links to /leave only after probing it, and route pages only with the flag on', () => {
  assert.match(read('away-mode.html'), /fetch\('\/leave', \{ method: 'HEAD' \}\)/);
  assert.match(read('away-mode.html'), /id="leave-link" style="display:none/);
  assert.match(read('src/index.js'), /env\.ENABLE_LEAVE_READY === 'true' \? '<p[^']*href="\/leave\?src=route"/);
});
