import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { buildWelcomeEmail, sendWelcomeEmail, sendVerificationEmail, welcomeEmailEnabled } from '../src/email.js';
import { scanText } from '../scripts/check-referral-copy.js';

// Q5: W1 welcome email (dark behind ENABLE_WELCOME_EMAIL) and the new verification copy.

function makeD1() {
  const db = new DatabaseSync(':memory:');
  db.exec("CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, origin_iata TEXT); INSERT INTO users VALUES ('u1','r@example.com','JFK');");
  const stmt = (sql, params) => ({
    run: async () => { const r = db.prepare(sql).run(...params); return { success: true, meta: { changes: Number(r.changes) } }; },
    first: async () => db.prepare(sql).get(...params) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...params) }),
  });
  return { _db: db, prepare: (sql) => ({ ...stmt(sql, []), bind: (...p) => stmt(sql, p) }) };
}
function captureResend() {
  const original = globalThis.fetch; const sent = [];
  globalThis.fetch = async (url, options) => {
    if (String(url.url || url).includes('api.resend.com/emails')) { sent.push(JSON.parse(options.body)); return new Response(JSON.stringify({ id: 'x' }), { status: 200, headers: { 'Content-Type': 'application/json' } }); }
    return original(url, options);
  };
  return { sent, restore: () => { globalThis.fetch = original; } };
}
const fresh = () => new Date().toISOString();
const deal = (over = {}) => ({ display_name: 'Lisbon, Portugal', price: 420, status: 'deal', basis_text: '27% below its 30-day median (N=23)', found_at: fresh(), departure_at: new Date(Date.now() + 30 * 86400000).toISOString(), ...over });
const env = (d1, over = {}) => ({ RESEND_API_KEY: 'k', ENABLE_WELCOME_EMAIL: 'true', APP_URL: 'https://sparkfare.com', DB: d1, ...over });

test('flag off: nothing is sent and nothing is recorded', async () => {
  const d1 = makeD1(); const r = captureResend();
  try {
    const out = await sendWelcomeEmail({ userId: 'u1', email: 'r@example.com', origin: 'JFK', deals: [deal()] }, env(d1, { ENABLE_WELCOME_EMAIL: 'false' }));
    assert.equal(out.reason, 'flag_off'); assert.equal(r.sent.length, 0);
  } finally { r.restore(); }
  assert.equal(welcomeEmailEnabled({}), false);
});

test('sends once per address, never twice', async () => {
  const d1 = makeD1(); const r = captureResend();
  try {
    const a = await sendWelcomeEmail({ userId: 'u1', email: 'r@example.com', origin: 'JFK', deals: [deal()] }, env(d1));
    const b = await sendWelcomeEmail({ userId: 'u1', email: 'r@example.com', origin: 'JFK', deals: [deal()] }, env(d1));
    assert.equal(a.sent, true); assert.equal(b.reason, 'already_sent'); assert.equal(r.sent.length, 1);
    assert.notEqual(d1._db.prepare("SELECT welcome_sent_at FROM users WHERE id='u1'").get().welcome_sent_at, null);
  } finally { r.restore(); }
});

test('a failed send releases the claim so a later confirmation can retry', async () => {
  const d1 = makeD1(); const original = globalThis.fetch;
  globalThis.fetch = async (url) => String(url.url || url).includes('resend') ? new Response(JSON.stringify({ message: 'no', name: 'x' }), { status: 422, headers: { 'Content-Type': 'application/json' } }) : original(url);
  try {
    const out = await sendWelcomeEmail({ userId: 'u1', email: 'r@example.com', origin: 'JFK', deals: [deal()] }, env(d1));
    assert.equal(out.sent, false);
    assert.equal(d1._db.prepare("SELECT welcome_sent_at FROM users WHERE id='u1'").get().welcome_sent_at, null);
  } finally { globalThis.fetch = original; }
});

test('no affiliate or referral link, text part present, lang=en, no Aviasales', async () => {
  const d1 = makeD1(); const r = captureResend();
  try {
    await sendWelcomeEmail({ userId: 'u1', email: 'r@example.com', origin: 'JFK', deals: [deal()] }, env(d1, { EMAIL_POSTAL_ADDRESS: '1 Main St, Town' }));
  } finally { r.restore(); }
  const m = r.sent[0];
  assert.match(m.html, /<html lang="en">/);
  assert.doesNotMatch(m.html, /aviasales|\/out\/|\/go\/|\/r\/|marker=|utm_/i);
  assert.ok(m.text && m.text.length > 20);
  assert.match(m.html, /\/flight\/JFK\/Lisbon%2C%20Portugal/);
  assert.match(m.text, /1 Main St/);
});

test('card shows the lowest showable fare, basis only for a verified deal, and "Fare data retrieved"', () => {
  const b = buildWelcomeEmail({ origin: 'JFK', deals: [deal({ price: 500 }), deal({ display_name: 'Rome, Italy', price: 350, status: 'typical', basis_text: 'x' })], env: {} });
  assert.match(b.bodyHtml, /Rome, Italy/); assert.doesNotMatch(b.bodyHtml, /N=23|Lisbon/);
  assert.match(b.bodyHtml, /Fare data retrieved/);
  const d = buildWelcomeEmail({ origin: 'JFK', deals: [deal()], env: {} });
  assert.match(d.bodyHtml, /27% below its 30-day median \(N=23\)/);
});

test('the fare time is printed in the reader\'s home-airport zone, not UTC', () => {
  const b = buildWelcomeEmail({ origin: 'LAX', deals: [deal({ found_at: new Date(Date.now() - 3600000).toISOString() })], env: {} });
  assert.match(b.bodyHtml, /Fare data retrieved [A-Z][a-z]{2} \d+, \d+:\d{2} [AP]M P[SD]T\./);
});

test('no showable fare: "first digest arrives tomorrow" and no card', () => {
  const old = deal({ departure_at: new Date(Date.now() + 3600000).toISOString() }); // leaves within 48 h: gone
  const b = buildWelcomeEmail({ origin: 'JFK', deals: [old], env: {} });
  assert.equal(b.hasCard, false);
  assert.match(b.bodyHtml, /Your first digest arrives tomorrow\./);
  assert.doesNotMatch(b.bodyHtml, /See this route/);
});

test('copy: subject, line, links, and pace line match the proposal; the copy checker passes the content file', async () => {
  const b = buildWelcomeEmail({ origin: 'LAX', deals: [deal()], env: {} });
  assert.equal(b.subject, "You're in: daily fares from Los Angeles");
  assert.doesNotMatch(b.subject + b.bodyHtml, /each morning|tomorrow morning/, 'condition 15: no morning promise until the local-morning send ships');
  assert.match(b.preheader, /^The lowest fare on today's board from Los Angeles/, 'condition 16');
  assert.match(b.bodyHtml, /at most one email a day/);
  assert.doesNotMatch(b.bodyHtml, /6:30/);
  assert.match(b.bodyHtml, /Watch a route you care about/); assert.match(b.bodyHtml, /\/watchlists\?origin=LAX/);
  assert.match(b.bodyHtml, /Prefer a different pace\?/); assert.match(b.bodyHtml, /Change how often/);
  const fs = await import('node:fs');
  const text = fs.readFileSync(new URL('../content/emails/welcome.json', import.meta.url), 'utf8');
  // Scan the visible strings as markup text (the checker does not read .json files on its own).
  const strings = Object.entries(JSON.parse(text).welcome).filter(([k]) => k !== 'line1_with_time').map(([, v]) => v).join('\n');
  assert.deepEqual(scanText(strings, 'content/emails/welcome.json', undefined, '.html'), []);
});

test('verification email: old copy with the flag off, Q5 copy with it on', async () => {
  for (const [flag, subject, button] of [['false', 'Verify your Sparkfare account', 'Verify my email'], ['true', 'Confirm your email to start your fare alerts', 'Confirm my email']]) {
    const r = captureResend();
    try { await sendVerificationEmail({ email: 'r@example.com', verificationUrl: 'https://sparkfare.com/api/verify?token=t', origin: 'JFK' }, { RESEND_API_KEY: 'k', ENABLE_WELCOME_EMAIL: flag }); } finally { r.restore(); }
    assert.equal(r.sent[0].subject, subject); assert.match(r.sent[0].html, new RegExp(button));
    if (flag === 'true') assert.match(r.sent[0].html, /fare alerts from New York/);
  }
});

// Guard read 2026-10-29, conditions 16 to 18.
test('condition 16: with no fare the preheader does not promise "today\'s board"', () => {
  const old = deal({ departure_at: new Date(Date.now() + 3600000).toISOString() });
  const b = buildWelcomeEmail({ origin: 'JFK', deals: [old], env: {} });
  assert.doesNotMatch(b.preheader, /today.s board/);
});

test('condition 17: a weekly reader is promised the weekly edition, never "at most one email a day"', () => {
  const b = buildWelcomeEmail({ origin: 'LAX', deals: [deal()], env: {}, frequency: 'weekly' });
  assert.equal(b.subject, "You're in: a weekly edition of fares from Los Angeles");
  assert.match(b.bodyHtml, /weekly edition of fares from Los Angeles \(LAX\), on Sundays/);
  assert.doesNotMatch(b.subject + b.bodyHtml + b.text, /at most one email a day|each morning|daily/i);
  const none = buildWelcomeEmail({ origin: 'LAX', deals: [], env: {}, frequency: 'weekly' });
  assert.match(none.bodyHtml, /Your first weekly edition arrives on Sunday\./);
  assert.match(buildWelcomeEmail({ origin: 'LAX', deals: [deal()], env: {} }).bodyHtml, /at most one email a day/, 'a daily reader keeps the daily promise');
});

test('condition 18: no postal address, no welcome email, and the claim is not used up', async () => {
  const d1 = makeD1(); const r = captureResend();
  const saved = process.env.EMAIL_POSTAL_ADDRESS; delete process.env.EMAIL_POSTAL_ADDRESS;
  try {
    const out = await sendWelcomeEmail({ userId: 'u1', email: 'r@example.com', origin: 'JFK', deals: [deal()] }, env(d1));
    assert.deepEqual([out.sent, out.reason], [false, 'no_postal_address']);
    assert.equal(r.sent.length, 0);
    const row = d1._db.prepare("SELECT * FROM users WHERE id = 'u1'").get();
    assert.ok(!row.welcome_sent_at, 'the once-per-address claim is not used up, so the reader still gets it after the address is set');
    assert.equal(d1._db.prepare("SELECT COUNT(*) c FROM events WHERE event_type = 'email_blocked_no_postal_address'").get().c, 1);
  } finally { process.env.EMAIL_POSTAL_ADDRESS = saved; r.restore(); }
});
