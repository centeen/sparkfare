// Away Move 3: saving a signed-in user's Leave-ready answers through /api/preferences (column from migration 0017).
// These are authenticated route tests: a real RS256 JWT, signed here, is verified by the real @clerk/backend inside
// getClerkSession, against a real in-memory SQLite D1 wrapper. (Earlier suites could only reach the 401 path.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { handleRequest, saveLeaveAnswers, readLeaveAnswers } from '../src/index.js';

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = publicKey.export({ type: 'spki', format: 'pem' });
function jwtFor(sub) {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const head = b({ alg: 'RS256', typ: 'JWT', kid: 'test' });
  const pay = b({ sub, sid: 'sess_1', iat: now, nbf: now - 5, exp: now + 600, iss: 'https://clerk.test' });
  const sig = crypto.sign('RSA-SHA256', Buffer.from(`${head}.${pay}`), privateKey).toString('base64url');
  return `${head}.${pay}.${sig}`;
}

function makeD1({ withColumn = true } = {}) {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT UNIQUE, origin_iata TEXT, passenger_count INTEGER DEFAULT 1,
    trip_length TEXT, has_pet BOOLEAN DEFAULT 0, away_needs TEXT, frequency TEXT DEFAULT 'daily', paused_until TEXT,
    notify_email INTEGER DEFAULT 1, notify_push INTEGER DEFAULT 0${withColumn ? ", leave_answers TEXT CHECK (leave_answers IS NULL OR json_valid(leave_answers))" : ''})`);
  db.prepare("INSERT INTO users (id, email, origin_iata, trip_length) VALUES ('user_a', 'a@example.com', 'JFK', '7-10'), ('user_b', 'b@example.com', 'LAX', 'weekend')").run();
  const stmt = (sql, p) => ({
    run: async () => { const r = db.prepare(sql).run(...p); return { success: true, meta: { changes: Number(r.changes) } }; },
    first: async () => db.prepare(sql).get(...p) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...p) }),
  });
  return { _db: db, prepare: (sql) => ({ ...stmt(sql, []), bind: (...p) => stmt(sql, p) }) };
}

const envFor = (d1, extra = {}) => ({ DB: d1, CLERK_SECRET_KEY: 'sk_test_x', CLERK_JWT_KEY: PEM, ENABLE_LEAVE_READY: 'true', ...extra });
const ANSWERS = { length: 'month_plus', pets: 'yes', plants: 'no', checkin: 'yes', mail: 'no', water: 'yes' };

async function post(env, body, sub = 'user_a') {
  const headers = { 'content-type': 'application/json' };
  if (sub) headers.authorization = `Bearer ${jwtFor(sub)}`;
  return handleRequest(new Request('https://sparkfare.com/api/preferences', { method: 'POST', headers, body: JSON.stringify(body) }), env, { waitUntil() {} });
}
async function account(env, sub = 'user_a') {
  const res = await handleRequest(new Request('https://sparkfare.com/api/account', { headers: { authorization: `Bearer ${jwtFor(sub)}` } }), env, { waitUntil() {} });
  return res.json();
}
const row = (d1, id = 'user_a') => ({ ...d1._db.prepare('SELECT * FROM users WHERE id = ?').get(id) });

test('flag on: a signed-in user saves answers; they come back from /api/account; other preferences are untouched', async () => {
  const d1 = makeD1(); const env = envFor(d1);
  const res = await post(env, { leave_answers: ANSWERS });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.leave_answers_saved, true);
  assert.deepEqual(JSON.parse(row(d1).leave_answers), ANSWERS);
  assert.equal(row(d1).origin_iata, 'JFK', 'a partial save never blanks other preferences');
  assert.equal(row(d1).trip_length, '7-10');
  assert.equal(row(d1).has_pet, 0, 'has_pet is not overloaded');
  assert.equal(row(d1).away_needs, null, 'away_needs is not overloaded');
  const acct = await account(env);
  assert.deepEqual(acct.preferences.leave_answers, ANSWERS);
  assert.equal(acct.preferences.origin_iata, 'JFK');
  assert.equal(row(d1, 'user_b').leave_answers, null, 'another user is untouched');
});

test('only the fixed answer words are stored: free text and unknown keys are dropped to skip', async () => {
  const d1 = makeD1(); const env = envFor(d1);
  await post(env, { leave_answers: { ...ANSWERS, pets: '<script>alert(1)</script>', extra: 'my address is 1 Main St', mail: 'maybe' } });
  assert.deepEqual(JSON.parse(row(d1).leave_answers), { ...ANSWERS, pets: 'skip', mail: 'skip' });
  assert.doesNotMatch(row(d1).leave_answers, /Main St|script/);
});

test('a JSON string is accepted; arrays, numbers and bad JSON are not saved', async () => {
  const d1 = makeD1(); const env = envFor(d1);
  assert.equal((await (await post(env, { leave_answers: JSON.stringify(ANSWERS) })).json()).leave_answers_saved, true);
  for (const bad of [['yes'], 5, 'not json {', null]) {
    const d2 = makeD1();
    const r = await (await post(envFor(d2), { leave_answers: bad })).json();
    assert.equal(r.leave_answers_saved, false, JSON.stringify(bad));
    assert.equal(row(d2).leave_answers, null);
  }
});

test('flag off: the field is ignored and /api/account does not return it', async () => {
  const d1 = makeD1(); const env = envFor(d1, { ENABLE_LEAVE_READY: 'false' });
  const data = await (await post(env, { leave_answers: ANSWERS })).json();
  assert.equal(data.leave_answers_saved, false);
  assert.equal(row(d1).leave_answers, null);
  assert.equal('leave_answers' in (await account(env)).preferences, false);
  assert.match(fs.readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'), /"ENABLE_LEAVE_READY": "false"/);
});

test('not signed in: 401 and nothing is saved', async () => {
  const d1 = makeD1();
  const res = await post(envFor(d1), { leave_answers: ANSWERS }, null);
  assert.equal(res.status, 401);
  assert.equal(row(d1).leave_answers, null);
});

test('a signed-in visitor with no users row saves nothing and does not create one', async () => {
  const d1 = makeD1(); const env = envFor(d1);
  const data = await (await post(env, { leave_answers: ANSWERS }, 'user_new')).json();
  assert.equal(data.ok, true);
  assert.equal(data.leave_answers_saved, false);
  assert.equal(d1._db.prepare("SELECT COUNT(*) n FROM users WHERE id = 'user_new'").get().n, 0);
});

test('users can only write their own row', async () => {
  const d1 = makeD1(); const env = envFor(d1);
  await post(env, { leave_answers: ANSWERS }, 'user_b');
  assert.equal(row(d1, 'user_a').leave_answers, null);
  assert.deepEqual(JSON.parse(row(d1, 'user_b').leave_answers), ANSWERS);
});

test('without migration 0017 the other saves and /api/account still work', async () => {
  const d1 = makeD1({ withColumn: false }); const env = envFor(d1);
  const res = await post(env, { leave_answers: ANSWERS, origin_iata: 'SFO', trip_length: '2+ weeks' });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.leave_answers_saved, false);
  assert.equal(row(d1).origin_iata, 'SFO', 'the rest of the save went through');
  const acct = await account(env);
  assert.equal(acct.ok, true);
  assert.equal(acct.preferences.origin_iata, 'SFO');
  assert.equal(acct.preferences.leave_answers, null);
});

test('the helpers: off by default, never throw', async () => {
  const d1 = makeD1();
  assert.deepEqual(await saveLeaveAnswers({ DB: d1 }, 'user_a', ANSWERS), { saved: false, reason: 'off' });
  assert.equal(await readLeaveAnswers({ DB: makeD1({ withColumn: false }) }, 'user_a'), null);
  assert.equal(await readLeaveAnswers({}, 'user_a'), null);
});

test('the page saves only for a signed-in session and says so only on success', () => {
  const html = fs.readFileSync(new URL('../leave.html', import.meta.url), 'utf8');
  assert.match(html, /if \(!clerk \|\| !clerk\.session\) return;/);
  assert.match(html, /body: JSON\.stringify\(\{ leave_answers: answers \}\)/);
  assert.match(html, /if \(data\.ok && data\.leave_answers_saved\) \$\('saved-note'\)\.hidden = false;/);
  assert.equal((html.match(/loadClerkLight\(\)/g) || []).length, 1, 'Clerk is loaded once and shared with the nav');
  assert.doesNotMatch(html, /localStorage|sessionStorage/);
});
