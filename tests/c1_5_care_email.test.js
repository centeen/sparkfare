// C1.5: the care email. Real SQLite from the migrations; Resend stubbed at the network.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeSqliteD1 } from './helpers/sqliteD1.js';
import worker from '../src/index.js';
import { sendCareEmails, careEmailEnabled, collectCareCandidates, clickTrackingLooksAlive, CARE_RULE } from '../src/careEmail.js';
import { sendCareEmail, _resetSendingGuardForTests } from '../src/email.js';
import { verifyPrefsToken } from '../src/postClickEmail.js';

const MIGRATIONS = fs.readdirSync(new URL('../migrations/', import.meta.url)).filter((f) => f.endsWith('.sql')).sort().map((f) => `migrations/${f}`);
const SECRET = 'care-secret';
const ON = { ENABLE_CARE_EMAIL: 'true', ENABLE_SIGNED_PREFS: 'true', UNSUBSCRIBE_SECRET: SECRET, RESEND_API_KEY: 're_test', APP_URL: 'https://sparkfare.com' };
const ago = (d) => new Date(Date.now() - d * 86400000).toISOString().replace('T', ' ').slice(0, 19);

function db() {
  const d = makeSqliteD1(MIGRATIONS);
  const ins = d.raw.prepare('INSERT INTO users (id, email, verified_email, is_subscribed, created_at, last_clicked_at) VALUES (?, ?, 1, 1, ?, ?)');
  ins.run('proof', 'proof@example.com', ago(200), ago(2));      // a recent click proves tracking works
  ins.run('due', 'due@example.com', ago(100), null);            // no click ever, old enough
  ins.run('old-click', 'oldclick@example.com', ago(200), ago(70)); // last click 70 days ago
  ins.run('new', 'new@example.com', ago(10), null);              // too new
  ins.run('clicker', 'clicker@example.com', ago(100), ago(20)); // clicked 20 days ago
  // Hub ruling on item 23: the gate reads real email_click events, not last_clicked_at. Tracking has been recording for 90 days and a click arrived 2 days ago.
  addClick(d, 90); addClick(d, 2);
  return d;
}
let clickSeq = 0;
function addClick(d, daysAgo, meta = { scanner_suspect: false }) {
  d.raw.prepare('INSERT INTO events (id, event_type, meta, ts) VALUES (?, ?, ?, ?)').run('c' + (++clickSeq), 'email_click', JSON.stringify(meta), ago(daysAgo));
}
async function withResend(fn) {
  const real = globalThis.fetch; const sent = [];
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('resend.com')) { sent.push(JSON.parse(init.body)); return new Response(JSON.stringify({ id: 'e' + sent.length }), { status: 200, headers: { 'content-type': 'application/json' } }); }
    return real(url, init);
  };
  try { return await fn(sent); } finally { globalThis.fetch = real; }
}

test('flag: off unless the exact string, and the signed prefs page must be on too', () => {
  assert.match(fs.readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'), /"ENABLE_CARE_EMAIL":\s*"false"/);
  assert.equal(careEmailEnabled({ ENABLE_CARE_EMAIL: 'true' }), false);
  assert.equal(careEmailEnabled({ ENABLE_CARE_EMAIL: 'true', ENABLE_SIGNED_PREFS: 'true' }), false, 'no secret');
  assert.equal(careEmailEnabled(ON), true);
});

test('candidates: 60 days without a click, account at least 60 days old, never already sent, not paused or stopped', async () => {
  const d = db();
  d.raw.prepare("UPDATE users SET paused_until = datetime('now', '+5 days') WHERE id = 'old-click'").run();
  assert.deepEqual(await collectCareCandidates({ DB: d }), ['due@example.com']);
  d.raw.prepare("UPDATE users SET paused_until = NULL WHERE id = 'old-click'").run();
  assert.deepEqual((await collectCareCandidates({ DB: d })).sort(), ['due@example.com', 'oldclick@example.com']);
  d.raw.prepare("UPDATE users SET unsubscribed_at = datetime('now') WHERE id = 'due'").run();
  d.raw.prepare("UPDATE users SET care_sent_at = datetime('now') WHERE id = 'old-click'").run();
  assert.deepEqual(await collectCareCandidates({ DB: d }), []);
  assert.equal(CARE_RULE.noClickDays, 60);
});

test('sends once to each due address with three signed links, then never again', async () => {
  const d = db(); _resetSendingGuardForTests?.();
  await withResend(async (sent) => {
    const r1 = await sendCareEmails({ ...ON, DB: d }, { sendCareEmail });
    assert.equal(r1.sent, 2);
    const to = sent.map((m) => [m.to].flat()[0]).sort();
    assert.deepEqual(to, ['due@example.com', 'oldclick@example.com']);
    const html = sent[0].html;
    for (const c of ['daily', 'weekly', 'pause']) assert.ok(html.includes(`choose=${c}`), c);
    const token = decodeURIComponent(html.match(/prefs\?token=([^&"]+)/)[1]);
    assert.equal(await verifyPrefsToken(token, SECRET), [sent[0].to].flat()[0]);
    assert.doesNotMatch(fs.readFileSync(new URL('../content/emails/care.json', import.meta.url), 'utf8').replace(/"_note".*\n/, ''), /\b(book|instantly|hurry|last chance)\b/i);
    const r2 = await sendCareEmails({ ...ON, DB: d }, { sendCareEmail });
    assert.equal(r2.sent, 0); assert.equal(sent.length, 2);
  });
});

test('does nothing when no click has been recorded recently (click tracking may be off)', async () => {
  const d = db(); d.raw.prepare("DELETE FROM events WHERE event_type = 'email_click'").run();
  await withResend(async (sent) => {
    const r = await sendCareEmails({ ...ON, DB: d }, { sendCareEmail });
    assert.equal(r.sent, 0); assert.match(r.reason, /click tracking/); assert.equal(sent.length, 0);
  });
});

test('flag off sends nothing', async () => {
  const d = db();
  await withResend(async (sent) => {
    assert.equal((await sendCareEmails({ ...ON, ENABLE_CARE_EMAIL: 'false', DB: d }, { sendCareEmail })).sent, 0);
    assert.equal(sent.length, 0);
  });
});

test('a care link opens a confirm page that changes nothing; the button changes only that choice', async () => {
  const d = db();
  const env = { ...ON, DB: d };
  const { signPrefsToken } = await import('../src/postClickEmail.js');
  const token = await signPrefsToken('due@example.com', SECRET);
  const res = await worker.fetch(new Request(`https://sparkfare.com/prefs?token=${encodeURIComponent(token)}&choose=weekly`), env, { waitUntil() {} });
  const html = await res.text();
  assert.equal(res.status, 200);
  assert.match(html, /Switch to the weekly edition/);
  assert.equal((html.match(/name="action" value="/g) || []).length, 1, 'one button');
  assert.match(html, /value="weekly"/);
  assert.equal(d.raw.prepare("SELECT frequency FROM users WHERE email = 'due@example.com'").get().frequency, 'daily', 'GET changed nothing');
  await worker.fetch(new Request('https://sparkfare.com/prefs', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token, action: 'weekly' }) }), env, { waitUntil() {} });
  assert.equal(d.raw.prepare("SELECT frequency FROM users WHERE email = 'due@example.com'").get().frequency, 'weekly');
  assert.equal(d.raw.prepare("SELECT frequency FROM users WHERE email = 'oldclick@example.com'").get().frequency, 'daily', 'only that address');
});

test('migration 0047 adds care_sent_at', () => {
  assert.match(fs.readFileSync(new URL('../migrations/0047_care_sent_at.sql', import.meta.url), 'utf8'), /care_sent_at/);
});

// Hub ruling on item 23 (23a, 23b): the care email's "we haven't seen a click from you in about two months" must be true of the gate.
function gateDb() { const d = makeSqliteD1(MIGRATIONS); return d; }
test('23a: last_clicked_at alone (a reactivation press) does not open the gate', async () => {
  const d = db(); d.raw.prepare("DELETE FROM events WHERE event_type = 'email_click'").run();
  d.raw.prepare("UPDATE users SET last_clicked_at = datetime('now') WHERE id = 'due'").run();
  assert.equal(await clickTrackingLooksAlive({ DB: d }), false);
});
test('23a: scanner-suspect clicks do not count', async () => {
  const d = gateDb(); addClick(d, 90, { scanner_suspect: true }); addClick(d, 2, { scanner_suspect: true });
  assert.equal(await clickTrackingLooksAlive({ DB: d }), false);
  addClick(d, 90); addClick(d, 2);
  assert.equal(await clickTrackingLooksAlive({ DB: d }), true);
});
test('23b: tracking switched on recently stays closed until the first click is 60 days old', async () => {
  const d = gateDb(); addClick(d, 5); addClick(d, 1);
  assert.equal(await clickTrackingLooksAlive({ DB: d }), false);
  const e = gateDb(); addClick(e, 59); addClick(e, 1);
  assert.equal(await clickTrackingLooksAlive({ DB: e }), false, '59 days is not yet 60');
  const f = gateDb(); addClick(f, 61); addClick(f, 1);
  assert.equal(await clickTrackingLooksAlive({ DB: f }), true);
});
test('23b: a recent click is still needed (the last one within 30 days)', async () => {
  const d = gateDb(); addClick(d, 90); addClick(d, 31);
  assert.equal(await clickTrackingLooksAlive({ DB: d }), false);
  addClick(d, 29);
  assert.equal(await clickTrackingLooksAlive({ DB: d }), true);
});
test('23b: an end-to-end run with only reactivation presses and recent tracking sends nothing', async () => {
  const d = db(); d.raw.prepare("DELETE FROM events WHERE event_type = 'email_click'").run(); addClick(d, 3);
  await withResend(async (sent) => { const r = await sendCareEmails({ ...ON, DB: d }, { sendCareEmail }); assert.equal(r.sent, 0); assert.equal(sent.length, 0); });
});
