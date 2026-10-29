// Addendum Q, C1.1 (G114), dark: the signed preference page and the daily-or-weekly choice at signup. Real SQLite from the migrations.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { makeSqliteD1 } from './helpers/sqliteD1.js';
import worker from '../src/index.js';
import { signUnsubscribeToken, signReactivateToken, verifyPrefsToken, signPrefsToken } from '../src/postClickEmail.js';
import { prefsUrl, withPrefsLink, signedPrefsEnabled, signupFrequencyEnabled } from '../src/prefs.js';
import { sendSunsetEmail, sendVerificationEmail, _resetSendingGuardForTests } from '../src/email.js';

const MIGRATIONS = fs.readdirSync(new URL('../migrations/', import.meta.url)).filter((f) => f.endsWith('.sql')).sort().map((f) => `migrations/${f}`);
const SECRET = 'prefs-secret';
const COPY = JSON.parse(fs.readFileSync(new URL('../content/prefs.json', import.meta.url), 'utf8'));
const ON = { ENABLE_SIGNED_PREFS: 'true', UNSUBSCRIBE_SECRET: SECRET };
const ctx = { waitUntil() {} };

function db() {
  const d = makeSqliteD1(MIGRATIONS);
  d.raw.prepare("INSERT INTO users (id, email, verified_email, frequency) VALUES ('u1', 'a@example.com', 1, 'daily'), ('u2', 'b@example.com', 1, 'daily')").run();
  return d;
}
const get = (env, token) => worker.fetch(new Request(`https://sparkfare.com/prefs?token=${encodeURIComponent(token)}`), env, ctx);
const post = (env, token, action) => worker.fetch(new Request('https://sparkfare.com/prefs', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token, action }).toString() }), env, ctx);
const row = (d, email) => ({ ...d.raw.prepare('SELECT frequency, paused_until, unsubscribed_at FROM users WHERE email = ?').get(email) });

test('flags: both off by default; the page needs the secret as well', () => {
  const cfg = fs.readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
  assert.match(cfg, /"ENABLE_SIGNED_PREFS":\s*"false"/); assert.match(cfg, /"ENABLE_SIGNUP_FREQUENCY":\s*"false"/); assert.ok(cfg.includes('"/prefs"'));
  assert.equal(signedPrefsEnabled({}), false); assert.equal(signedPrefsEnabled({ ENABLE_SIGNED_PREFS: 'true' }), false, 'no secret: off'); assert.equal(signedPrefsEnabled(ON), true);
  assert.equal(signupFrequencyEnabled({}), false);
});

test('a prefs token verifies only as a prefs token, and an unsubscribe or reactivate token never works here', async () => {
  const t = await signPrefsToken('a@example.com', SECRET);
  assert.equal(await verifyPrefsToken(t, SECRET), 'a@example.com');
  assert.equal(await verifyPrefsToken(await signUnsubscribeToken('a@example.com', SECRET), SECRET), null);
  assert.equal(await verifyPrefsToken(await signReactivateToken('a@example.com', SECRET), SECRET), null);
  assert.equal(await verifyPrefsToken(t, 'other'), null); assert.equal(await verifyPrefsToken('x.y', SECRET), null);
});

test('flag off: /prefs is a 404 and the signup options say frequency is off', async () => {
  const d = db(); const token = await signPrefsToken('a@example.com', SECRET);
  assert.equal((await get({ DB: d, UNSUBSCRIBE_SECRET: SECRET }, token)).status, 404);
  assert.equal((await post({ DB: d, UNSUBSCRIBE_SECRET: SECRET }, token, 'stop')).status, 404);
  assert.equal(row(d, 'a@example.com').unsubscribed_at, null);
  const o = await worker.fetch(new Request('https://sparkfare.com/api/signup-options'), { DB: d }, ctx);
  assert.deepEqual(await o.json(), { ok: true, frequency: false });
  const on = await worker.fetch(new Request('https://sparkfare.com/api/signup-options'), { DB: d, ENABLE_SIGNUP_FREQUENCY: 'true' }, ctx);
  assert.equal((await on.json()).frequency, true);
});

test('GET shows the four choices and the current setting, changes nothing, and is private', async () => {
  const d = db(); const env = { DB: d, ...ON }; const token = await signPrefsToken('a@example.com', SECRET);
  const res = await get(env, token); const html = await res.text();
  assert.equal(res.status, 200); assert.match(res.headers.get('x-robots-tag'), /noindex/); assert.equal(res.headers.get('cache-control'), 'no-store');
  for (const k of ['daily', 'weekly', 'pause', 'stop']) assert.ok(html.includes(COPY.page[k]), k);
  assert.ok(html.includes(COPY.page.now_daily)); assert.match(html, /<h1>/); assert.match(html, /<main id="main">/); assert.ok(!html.includes('a@example.com'), 'the address is not printed');
  assert.deepEqual(row(d, 'a@example.com'), { frequency: 'daily', paused_until: null, unsubscribed_at: null });
  const bad = await get(env, 'nonsense'); assert.equal(bad.status, 400); assert.ok((await bad.text()).includes(COPY.page.bad_link));
});

test('POST: weekly, daily, pause and stop change only the address the token names', async () => {
  const d = db(); const env = { DB: d, ...ON }; const token = await signPrefsToken('a@example.com', SECRET);
  assert.equal((await post(env, token, 'weekly')).status, 200); assert.equal(row(d, 'a@example.com').frequency, 'weekly');
  await post(env, token, 'pause'); assert.ok(row(d, 'a@example.com').paused_until);
  const res = await post(env, token, 'daily'); assert.ok((await res.text()).includes(COPY.page.saved_daily));
  assert.deepEqual(row(d, 'a@example.com'), { frequency: 'daily', paused_until: null, unsubscribed_at: null }, 'choosing daily lifts a pause');
  assert.deepEqual(row(d, 'b@example.com'), { frequency: 'daily', paused_until: null, unsubscribed_at: null }, 'the other address is untouched');
  await post(env, token, 'stop');
  assert.ok(row(d, 'a@example.com').unsubscribed_at);
  assert.equal(d.raw.prepare("SELECT reason FROM email_suppressions WHERE email = 'a@example.com'").get().reason, 'unsubscribed');
  await post(env, token, 'weekly');
  assert.equal(row(d, 'a@example.com').frequency, 'daily', 'a stop is final: choosing weekly from this page does not change a stopped address');
  assert.ok(row(d, 'a@example.com').unsubscribed_at);
  assert.equal((await post(env, token, 'explode')).status, 400);
  assert.equal(d.raw.prepare("SELECT COUNT(*) AS n FROM events WHERE event_type = 'prefs_change'").get().n >= 4, true, 'changes are counted (action only)');
});

test('/api/signup stores the choice for a NEW address only, and only while the flag is on', async () => {
  const signup = (env, body) => worker.fetch(new Request('https://sparkfare.com/api/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), env, ctx);
  const d = makeSqliteD1(MIGRATIONS);
  const base = { origin_iata: 'JFK', trip_length: '7-10', source: 'home' };
  assert.equal((await signup({ DB: d, ENABLE_SIGNUP_FREQUENCY: 'true' }, { ...base, id: 'local_1', email: 'new@example.com', frequency: 'weekly' })).status, 200);
  assert.equal(row(d, 'new@example.com').frequency, 'weekly');
  await signup({ DB: d, ENABLE_SIGNUP_FREQUENCY: 'true' }, { ...base, id: 'local_2', email: 'new@example.com', frequency: 'daily' });
  assert.equal(row(d, 'new@example.com').frequency, 'weekly', 'a resubmit through the public form cannot change a saved setting');
  await signup({ DB: d, ENABLE_SIGNUP_FREQUENCY: 'false' }, { ...base, id: 'local_3', email: 'off@example.com', frequency: 'weekly' });
  assert.notEqual(row(d, 'off@example.com').frequency, 'weekly', 'flag off: the choice is ignored');
  await signup({ DB: d, ENABLE_SIGNUP_FREQUENCY: 'true' }, { ...base, id: 'local_4', email: 'odd@example.com', frequency: 'instant' });
  assert.notEqual(row(d, 'odd@example.com').frequency, 'instant', 'only daily or weekly');
});

test('every commercial email links to the settings page when it is on, none when off, and a transactional email never does', async () => {
  const sent = []; const real = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => { if (String(url).includes('resend.com')) { sent.push(JSON.parse(init.body)); return new Response('{"id":"x"}', { status: 200 }); } return real(url, init); };
  try {
    _resetSendingGuardForTests();
    const env = { RESEND_API_KEY: 'k', EMAIL_POSTAL_ADDRESS: '1 Main St', DB: db(), ...ON };
    await sendSunsetEmail({ email: 'a@example.com' }, env);
    await sendVerificationEmail({ email: 'a@example.com', verificationUrl: 'https://sparkfare.com/x' }, env);
    await sendSunsetEmail({ email: 'a@example.com' }, { ...env, ENABLE_SIGNED_PREFS: 'false', DB: db() });
  } finally { globalThis.fetch = real; }
  const [on, transactional, off] = sent;
  assert.match(on.html, /\/prefs\?token=/); assert.match(on.text, /\/prefs\?token=/); assert.ok(on.html.includes(COPY.footer.link));
  assert.ok(on.html.indexOf('/prefs?token=') < on.html.indexOf('1 Main St'), 'the link sits above the postal address');
  assert.doesNotMatch(transactional.html, /\/prefs\?token=/);
  assert.doesNotMatch(off.html, /\/prefs\?token=/);
  const token = on.html.match(/\/prefs\?token=([^"]+)"/)[1];
  assert.equal(await verifyPrefsToken(decodeURIComponent(token), SECRET), 'a@example.com');
  assert.equal(withPrefsLink({ html: on.html, text: on.text }, await prefsUrl(ON, 'a@example.com')).html.split('/prefs?token=').length, on.html.split('/prefs?token=').length, 'idempotent');
});

function runScript({ optionsOn }) {
  const calls = []; const slot = { hidden: true, innerHTML: '' };
  const radios = { checked: null };
  const window = {};
  const document = { readyState: 'complete', addEventListener() {}, querySelectorAll: () => [slot], querySelector: (sel) => (slot.hidden ? null : { value: radios.checked || 'daily' }) };
  window.fetch = async (url, init) => { calls.push({ url: String(url), init }); return { ok: true, json: async () => ({ ok: true, frequency: optionsOn }) }; };
  vm.runInNewContext(fs.readFileSync(new URL('../signup-frequency.js', import.meta.url), 'utf8'), { window, document, Object, JSON, String, Array, console });
  return { window, slot, calls, radios };
}

test('signup-frequency.js: off changes nothing; on fills the slot with the two labels and adds the choice to the signup request only', async () => {
  const off = runScript({ optionsOn: false });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(off.slot.hidden, true); assert.equal(off.slot.innerHTML, '');
  await off.window.fetch('/api/signup', { method: 'POST', body: JSON.stringify({ email: 'x' }) });
  assert.equal(JSON.parse(off.calls.at(-1).init.body).frequency, undefined);

  const on = runScript({ optionsOn: true });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(on.slot.hidden, false);
  assert.ok(on.slot.innerHTML.includes(COPY.signup.daily) && on.slot.innerHTML.includes(COPY.signup.weekly) && on.slot.innerHTML.includes(COPY.signup.legend));
  assert.match(on.slot.innerHTML, /value="daily" checked/); assert.doesNotMatch(on.slot.innerHTML, /value="weekly" checked/);
  on.radios.checked = 'weekly';
  await on.window.fetch('/api/signup', { method: 'POST', body: JSON.stringify({ email: 'x' }) });
  assert.equal(JSON.parse(on.calls.at(-1).init.body).frequency, 'weekly');
  await on.window.fetch('/api/other', { method: 'POST', body: JSON.stringify({ a: 1 }) });
  assert.equal(JSON.parse(on.calls.at(-1).init.body).frequency, undefined, 'other requests are left alone');
});

test('every signup form that has the placeholder also loads the script, and the placeholder never ships visible', () => {
  const files = ['index.html', 'widget.html', 'check.html', 'leave.html', 'src/ptoPages.js', 'src/digestArchive.js', 'Phase 17 pSEO Generator (Step 106).py'];
  for (const f of files) {
    const s = fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
    assert.ok(s.includes('data-sf-frequency hidden'), `${f}: placeholder`);
    assert.ok(s.includes('/signup-frequency.js'), `${f}: script`);
  }
  const copy = fs.readFileSync(new URL('../signup-frequency.js', import.meta.url), 'utf8');
  for (const t of [COPY.signup.legend, COPY.signup.daily, COPY.signup.weekly]) assert.ok(copy.includes(t), `script and content/prefs.json agree: ${t}`);
});
