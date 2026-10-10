// Post-click email v2 (Phase A): pure builders, template, sender fallbacks, signed unsubscribe, /out logging.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  CHECKLIST_CONFIG, buildChecklist, routeLine, priceLine, formatDateRange, renderV2Html, renderV2Text,
  signUnsubscribeToken, verifyUnsubscribeToken, partnerHref, flightHref, V2_DISCLOSURE_TEXT, FARES_CHANGE_TEXT,
} from '../src/postClickEmail.js';
import { sendAwayModeFollowUpEmail, AWAY_MODE_PARTNERS, _resetSendingGuardForTests } from '../src/email.js';
import worker from '../src/index.js';

const BANNED = [/you're booked/i, /you are booked/i, /locked in/i, /locked/i, /secured/i, /guaranteed/i];
const NOW = new Date('2026-10-04T12:00:00Z');
const APP = 'https://sparkfare.com';
const BOOKING = 'https://www.aviasales.com/search/JFK0612CUN13121?marker=314524.t1';

const live = (...slugs) => AWAY_MODE_PARTNERS.filter((p) => slugs.includes(p.slug)).map((p) => ({ ...p, status: 'live' }));
const ALL = AWAY_MODE_PARTNERS.map((p) => ({ ...p, status: 'live' }));
const trip = (o = {}) => ({ destination: 'Tulum, Mexico', origin_iata: 'JFK', departure_at: '2026-12-06', return_at: '2026-12-13', price_at_click: 412, ...o });

// ---- route / price / date helpers ----
test('routeLine omits missing fields and never leaves stray separators', () => {
  assert.equal(routeLine(trip()), 'JFK to Tulum, Mexico · Dec 6 to 13 · round trip');
  assert.equal(routeLine(trip({ return_at: null })), 'JFK to Tulum, Mexico · Dec 6');
  assert.equal(routeLine(trip({ departure_at: null, return_at: null })), 'JFK to Tulum, Mexico');
  assert.equal(routeLine(trip({ origin_iata: null })), 'Dec 6 to 13 · round trip');
  assert.doesNotMatch(routeLine(trip({ origin_iata: null, departure_at: null, return_at: null })), /undefined|null|·\s*$/);
  assert.equal(formatDateRange('2026-12-28', '2027-01-04'), 'Dec 28 to Jan 4');
});

test('priceLine makes no freshness claim without a real as-of time', () => {
  assert.equal(priceLine(trip()), 'From $412');
  assert.doesNotMatch(priceLine(trip()), /last seen|ago|today|now/i);
  assert.match(priceLine(trip({ price_as_of: '2026-10-03T19:18:00Z' })), /^From \$412 · last seen Oct 3, 7:18 pm UTC$/);
  assert.equal(priceLine(trip({ price_at_click: null })), '');
  assert.equal(priceLine(trip({ price_at_click: 1234 })), 'From $1,234');
});

// ---- buildChecklist ----
test('with no country on the trip only the safe-for-both items are offered', () => {
  const items = buildChecklist(trip(), ALL, NOW);
  assert.deepEqual(items.map((i) => i.item_key), ['parking', 'luggage', 'vpn', 'tours']);
  for (const k of ['esim', 'transfer', 'money', 'language', 'translator']) assert.ok(!items.some((i) => i.item_key === k), `${k} must not appear`);
});

test('only live partners are featured; pending, declined and blocked never appear', () => {
  const mixed = ALL.map((p) => (p.slug === 'bounce' ? { ...p, status: 'pending' } : p.slug === 'nordvpn' ? { ...p, status: 'declined' } : p.slug === 'parking-access' ? { ...p, status: 'blocked_legal' } : p));
  const slugs = buildChecklist(trip(), mixed, NOW).map((i) => i.partner_id);
  for (const bad of ['bounce', 'nordvpn', 'parking-access']) assert.ok(!slugs.includes(bad), `${bad} must be filtered`);
  assert.ok(slugs.includes('tiqets'));
});

test('insurance and flight-delay partners are never featured', () => {
  const slugs = buildChecklist(trip({ country: 'Mexico' }), ALL, NOW).map((i) => i.partner_id);
  assert.ok(!slugs.includes('safetywing'));
  assert.ok(!slugs.includes('airhelp'));
});

test('parking needs 5+ days to departure', () => {
  assert.ok(buildChecklist(trip({ departure_at: '2026-10-09' }), ALL, NOW).some((i) => i.item_key === 'parking'));
  assert.ok(!buildChecklist(trip({ departure_at: '2026-10-08' }), ALL, NOW).some((i) => i.item_key === 'parking'));
  assert.ok(!buildChecklist(trip({ departure_at: null }), ALL, NOW).some((i) => i.item_key === 'parking'));
});

test('mail needs a trip of 14+ days, and only with a known country', () => {
  const long = trip({ country: 'Mexico', departure_at: '2026-12-01', return_at: '2026-12-15' });
  assert.ok(buildChecklist(long, ALL, NOW).some((i) => i.item_key === 'mail'));
  assert.ok(!buildChecklist({ ...long, return_at: '2026-12-14' }, ALL, NOW).some((i) => i.item_key === 'mail'));
  assert.ok(!buildChecklist({ ...long, return_at: null }, ALL, NOW).some((i) => i.item_key === 'mail'));
});

test('international trips (country known) unlock connectivity, ground transport and money first', () => {
  const items = buildChecklist(trip({ country: 'Mexico' }), ALL, NOW);
  assert.deepEqual(items.slice(0, 3).map((i) => i.item_key), ['esim', 'transfer', 'money']);
  const domestic = buildChecklist(trip({ country: 'United States' }), ALL, NOW).map((i) => i.item_key);
  assert.ok(!domestic.includes('esim') && !domestic.includes('money'));
});

test('language items need a known non-English language and enough lead time', () => {
  const t = trip({ country: 'Mexico' });
  assert.ok(!buildChecklist(t, ALL, NOW).some((i) => i.item_key === 'language'));
  assert.ok(buildChecklist({ ...t, language: 'Spanish' }, ALL, NOW).some((i) => i.item_key === 'language'));
  assert.ok(!buildChecklist({ ...t, language: 'English' }, ALL, NOW).some((i) => i.item_key === 'language'));
  assert.ok(!buildChecklist({ ...t, language: 'Spanish', departure_at: '2026-10-10' }, ALL, NOW).some((i) => i.item_key === 'language'));
});

test('one partner per item, and fewer than three qualifying is handled', () => {
  const items = buildChecklist(trip(), ALL, NOW);
  assert.equal(new Set(items.map((i) => i.item_key)).size, items.length);
  assert.equal(items.find((i) => i.item_key === 'tours').partner_id, 'tiqets');
  const few = buildChecklist(trip(), live('bounce'), NOW);
  assert.deepEqual(few.map((i) => i.item_key), ['luggage']);
  assert.deepEqual(buildChecklist(trip(), [], NOW), []);
});

test('flagged blurbs are replaced with neutral factual lines', () => {
  const wise = buildChecklist(trip({ country: 'Mexico' }), ALL, NOW).find((i) => i.partner_id === 'wise');
  assert.doesNotMatch(wise.line, /no foreign transaction fees|fee/i);
  const pickups = buildChecklist(trip({ country: 'Mexico' }), ALL, NOW).find((i) => i.partner_id === 'welcome-pickups');
  assert.doesNotMatch(pickups.line, /fixed price/i);
});

// ---- links ----
test('links go through /out with trip_id, src and slot', () => {
  const h = new URL(partnerHref(APP, 'bounce', 't1', 2));
  assert.equal(h.pathname, '/out/bounce');
  assert.equal(h.searchParams.get('trip_id'), 't1');
  assert.equal(h.searchParams.get('src'), 'email_v2');
  assert.equal(h.searchParams.get('slot'), '2');
  const f = new URL(flightHref(APP, BOOKING, 't1'));
  assert.equal(f.pathname, '/out/aviasales');
  assert.equal(f.searchParams.get('url'), BOOKING);
  assert.equal(f.searchParams.get('slot'), 'flight');
});

// ---- template ----
function render(t = trip(), over = {}) {
  const items = buildChecklist(t, ALL, NOW);
  const view = { trip: t, items, appUrl: APP, tripId: 't1', bookingLink: BOOKING, postalAddress: '123 Example St, Suite 4, City, ST 00000', unsubscribeUrl: `${APP}/api/unsubscribe?token=abc`, clickedDate: 'Oct 4', ...over };
  return { html: renderV2Html(view), text: renderV2Text(view), items };
}

test('v2 renders with a full trip, under 85 KB, with disclosure under the flight button', () => {
  const { html, text } = render();
  assert.ok(Buffer.byteLength(html) < 85 * 1024);
  assert.ok(html.includes('>View fare</a>'));
  assert.ok(html.includes(V2_DISCLOSURE_TEXT));
  assert.ok(html.indexOf('>View fare</a>') < html.indexOf(V2_DISCLOSURE_TEXT));
  assert.ok(html.includes(FARES_CHANGE_TEXT));
  assert.match(html, /1 of 5 done/);
  assert.ok(text.includes(V2_DISCLOSURE_TEXT));
  assert.ok(text.includes('123 Example St'));
  assert.ok(html.includes('Sparkfare &middot; 123 Example St'));
});

test('v2 uses no banned wording, no undefined/null, no JS or flex/grid, and rel=sponsored on partner links', () => {
  for (const t of [trip(), trip({ return_at: null }), trip({ departure_at: null, return_at: null }), trip({ price_at_click: null })]) {
    const { html, text } = render(t);
    for (const re of BANNED) { assert.doesNotMatch(html, re); assert.doesNotMatch(text, re); }
    assert.doesNotMatch(html, /undefined|\bnull\b|NaN/);
    assert.doesNotMatch(html, /<script|display:\s*(flex|grid)|background-image/i);
    assert.match(html, /rel="sponsored noopener noreferrer"/);
  }
});

test('v2 shows at most three partner cards and a teaser of plain-text items', () => {
  const { html } = render();
  assert.equal((html.match(/>Sponsored</g) || []).length, 3);
  assert.match(html, /1 more worth a look/);
  assert.doesNotMatch(html, /Already sorted|Not needed|Did you book/);
});

test('missing price time means no freshness text; missing return date drops "round trip"', () => {
  const { html } = render(trip({ return_at: null }));
  assert.doesNotMatch(html, /last seen/);
  assert.doesNotMatch(html, /round trip/);
});

// ---- signed tokens ----
test('signed unsubscribe token round-trips and rejects tampering', async () => {
  const token = await signUnsubscribeToken('a@example.com', 'secret1');
  assert.equal(await verifyUnsubscribeToken(token, 'secret1'), 'a@example.com');
  assert.equal(await verifyUnsubscribeToken(token, 'other'), null);
  const [e, s] = token.split('.');
  const forged = `${Buffer.from('b@example.com').toString('base64url')}.${s}`;
  assert.equal(await verifyUnsubscribeToken(forged, 'secret1'), null);
  assert.equal(await verifyUnsubscribeToken('garbage', 'secret1'), null);
  assert.equal(await verifyUnsubscribeToken(token, ''), null);
});

// ---- sender ----
function makeD1() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, params) => ({
    run: async () => { db.prepare(sql).run(...params); return { success: true }; },
    first: async () => db.prepare(sql).get(...params) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...params) }),
  });
  return { raw: db, prepare: (sql) => ({ ...stmt(sql, []), bind: (...p) => stmt(sql, p) }) };
}

async function captureSend(env, tripOver = {}) {
  _resetSendingGuardForTests();
  const original = globalThis.fetch;
  const sent = [];
  globalThis.fetch = async (url, options) => {
    const u = typeof url === 'string' ? url : url.url;
    if (u.includes('api.resend.com/emails')) {
      sent.push(JSON.parse(options.body));
      return new Response(JSON.stringify({ id: 'fake' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return original(url, options);
  };
  try {
    const result = await sendAwayModeFollowUpEmail({
      email: 'a@example.com', destination: 'Tulum, Mexico', origin_iata: 'JFK', departure_at: '2099-12-06', return_at: '2099-12-13',
      price_at_click: 412, booking_link: BOOKING, trip_id: 't1', ...tripOver,
    }, { RESEND_API_KEY: 'k', APP_URL: APP, ...env });
    return { result, sent };
  } finally { globalThis.fetch = original; }
}

const V2_ENV = { ENABLE_EMAIL_CHECKLIST_V2: 'true', EMAIL_POSTAL_ADDRESS: '123 Example St, City, ST 00000', UNSUBSCRIBE_SECRET: 's3cret' };

test('flag OFF sends the v1 template with the Step 1 copy', async () => {
  const { sent } = await captureSend({});
  assert.equal(sent.length, 1);
  assert.match(sent[0].html, /If you haven't finished booking yet/);
  assert.ok(!sent[0].html.includes(V2_DISCLOSURE_TEXT), 'v1 must not carry the v2 disclosure');
  assert.equal(sent[0].text, undefined);
});

test('flag ON with everything present sends v2: html + text parts and signed List-Unsubscribe headers', async () => {
  const { sent } = await captureSend(V2_ENV);
  const m = sent[0];
  assert.match(m.html, />View fare<\/a>/);
  assert.ok(m.text.includes(V2_DISCLOSURE_TEXT));
  assert.match(m.headers['List-Unsubscribe'], /^<https:\/\/sparkfare\.com\/api\/unsubscribe\?token=/);
  assert.equal(m.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  assert.doesNotMatch(m.headers['List-Unsubscribe'], /a%40example\.com|a@example\.com/);
  assert.doesNotMatch(m.html, /api\/unsubscribe\?email=/);
});

test('flag ON but no postal address, no secret, or no booking link falls back closed to v1', async () => {
  for (const env of [{ ...V2_ENV, EMAIL_POSTAL_ADDRESS: '' }, { ...V2_ENV, UNSUBSCRIBE_SECRET: '' }]) {
    delete process.env.EMAIL_POSTAL_ADDRESS;
    const { sent } = await captureSend(env);
    assert.ok(!sent[0].html.includes(V2_DISCLOSURE_TEXT), 'fell back to v1');
    assert.match(sent[0].html, /If you haven't finished booking yet/);
  }
  const { sent } = await captureSend(V2_ENV, { booking_link: 'https://evil.example/x' });
  assert.ok(!sent[0].html.includes(V2_DISCLOSURE_TEXT), 'fell back to v1');
});

test('a suppressed address is not sent to and no send event is logged', async () => {
  const DB = makeD1();
  DB.raw.exec("CREATE TABLE email_suppressions (email TEXT PRIMARY KEY, reason TEXT, created_at TEXT DEFAULT (datetime('now')))");
  DB.raw.prepare("INSERT INTO email_suppressions (email, reason) VALUES ('a@example.com', 'unsubscribed')").run();
  const { sent } = await captureSend({ ...V2_ENV, DB });
  assert.equal(sent.length, 0);
  const n = DB.raw.prepare("SELECT COUNT(*) c FROM events WHERE event_type = 'checklist_email_sent'").get().c;
  assert.equal(n, 0);
});

test('one checklist_email_sent event per send with variant, items and days to departure', async () => {
  const DB = makeD1();
  await captureSend({ ...V2_ENV, DB });
  await captureSend({ DB });
  const rows = DB.raw.prepare("SELECT sub_id, meta FROM events WHERE event_type = 'checklist_email_sent' ORDER BY ts, rowid").all();
  assert.equal(rows.length, 2);
  const v2 = JSON.parse(rows[0].meta);
  assert.equal(v2.variant, 'v2');
  assert.ok(Array.isArray(v2.items) && v2.items.length > 0);
  assert.equal(typeof v2.days_to_departure, 'number');
  assert.equal(JSON.parse(rows[1].meta).variant, 'v1_fixed');
});

// ---- routes ----
function req(path, init) { return new Request(`${APP}${path}`, init); }
const ctx = { waitUntil() {} };

test('GET with a valid token only shows a confirm page and does not suppress; POST does', async () => {
  const DB = makeD1();
  DB.raw.exec("CREATE TABLE users (id TEXT, email TEXT, unsubscribed_at TEXT)");
  DB.raw.prepare("INSERT INTO users VALUES ('u1', 'a@example.com', NULL)").run();
  const env = { DB, UNSUBSCRIBE_SECRET: 's3cret' };
  const token = await signUnsubscribeToken('a@example.com', 's3cret');

  const get = await worker.fetch(req(`/api/unsubscribe?token=${encodeURIComponent(token)}`), env, ctx);
  assert.equal(get.status, 200);
  assert.match(await get.text(), /Yes, unsubscribe me/);
  assert.equal(DB.raw.prepare('SELECT unsubscribed_at FROM users').get().unsubscribed_at, null);

  const post = await worker.fetch(req(`/api/unsubscribe?token=${encodeURIComponent(token)}`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'List-Unsubscribe=One-Click' }), env, ctx);
  assert.equal(post.status, 200);
  assert.ok(DB.raw.prepare('SELECT unsubscribed_at FROM users').get().unsubscribed_at);
  assert.equal(DB.raw.prepare("SELECT reason FROM email_suppressions WHERE email = 'a@example.com'").get().reason, 'unsubscribed');
});

test('invalid or forged tokens are rejected on GET and POST', async () => {
  const env = { DB: makeD1(), UNSUBSCRIBE_SECRET: 's3cret' };
  const forged = await signUnsubscribeToken('a@example.com', 'wrong');
  for (const method of ['GET', 'POST']) {
    const res = await worker.fetch(req(`/api/unsubscribe?token=${encodeURIComponent(forged)}`, { method }), env, ctx);
    assert.equal(res.status, 400);
  }
});

test('legacy raw-email unsubscribe links still work for emails already sent, but only through the confirm button (transition)', async () => {
  const DB = makeD1();
  DB.raw.exec("CREATE TABLE users (id TEXT, email TEXT, unsubscribed_at TEXT)");
  DB.raw.prepare("INSERT INTO users VALUES ('u1', 'a@example.com', NULL)").run();
  const res = await worker.fetch(req('/api/unsubscribe?email=a%40example.com'), { DB }, ctx);
  assert.equal(res.status, 200);
  assert.equal(DB.raw.prepare('SELECT unsubscribed_at FROM users').get().unsubscribed_at, null, 'a GET only confirms');
  const post = await worker.fetch(req('/api/unsubscribe?email=a%40example.com', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'List-Unsubscribe=One-Click' }), { DB }, ctx);
  assert.equal(post.status, 200);
  assert.ok(DB.raw.prepare('SELECT unsubscribed_at FROM users').get().unsubscribed_at);
});

test('/out/<partner> still 302s and logs source and slot', async () => {
  const DB = makeD1();
  const res = await worker.fetch(req('/out/bounce?trip_id=t1&src=email_v2&slot=2'), { DB }, ctx);
  assert.equal(res.status, 302);
  assert.match(res.headers.get('location'), /bounce\.com/);
  const row = DB.raw.prepare("SELECT sub_id, partner, source, meta FROM events WHERE event_type = 'outbound_click'").get();
  assert.equal(row.sub_id, 't1');
  assert.equal(row.partner, 'bounce');
  assert.equal(row.source, 'email_v2');
  assert.equal(JSON.parse(row.meta).slot, '2');
});

test('/out/aviasales still 302s to a real Aviasales link and rejects others', async () => {
  const ok = await worker.fetch(req(`/out/aviasales?url=${encodeURIComponent(BOOKING)}&trip_id=t1&src=email_v2&slot=flight`), { DB: makeD1() }, ctx);
  assert.equal(ok.status, 302);
  assert.equal(ok.headers.get('location'), BOOKING);
  const bad = await worker.fetch(req(`/out/aviasales?url=${encodeURIComponent('https://evil.example/')}`), {}, ctx);
  assert.equal(bad.status, 400);
});
