import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { renderDailyDigest, DISCLOSURE_TEXT } from '../src/emailTemplates/dailyDigest.js';
import {
  formatWindow, parseBookingLink, addUtm, dropFromWeekAgo, pickTip, airlineName, escapeHtml,
} from '../src/emailTemplates/helpers.js';
import { sendDailyDealEmail } from '../src/email.js';

const NOW = new Date('2026-09-24T12:00:00Z');
const FOUND_AT = '2026-09-24T09:00:00Z';

function obs(price, days = 20) {
  return Array.from({ length: days }, (_, i) => ({
    date: new Date(Date.UTC(2026, 8, 24) - (days - i) * 86400000).toISOString().slice(0, 10),
    price,
  }));
}

function deal(overrides = {}) {
  return {
    display_name: 'Tbilisi, Georgia', origin: 'SEA', price: 534, status: 'deal', airline: 'TK',
    booking_link: 'https://www.aviasales.com/search/SEA2310TBS02111?marker=314524',
    departure_at: '2026-10-23T22:35:00-07:00', return_at: '2026-11-02T16:15:00+04:00',
    found_at: FOUND_AT, observations: obs(740), ...overrides,
  };
}

const CONFIG = {
  appUrl: 'https://sparkfare.com',
  destinations: { 'Tbilisi, Georgia': 'A hillside old town with sulfur baths and wine culture.' },
  tips: [{ id: 'a', title: 'Tip A', body: 'Body A.' }, { id: 'b', title: 'Tip B', body: 'Body B.', link: '/blog/how-we-rank-deals', linkText: 'Read more' }],
  unsubscribeUrl: 'https://sparkfare.com/api/unsubscribe?email=secret%40example.com',
  postalAddress: '123 Example St, City, ST 00000',
  referralUrl: 'https://sparkfare.com/r/ref_abc123',
  awayMode: { name: 'SafetyWing', blurb: 'Travel medical insurance.', href: 'https://sparkfare.com/out/safetywing' },
};

const render = (deals, extra = {}) => renderDailyDigest({ origin: 'SEA', deals, user: { id: 'u1' }, now: NOW, config: CONFIG, ...extra });

test('renders 0, 1 and 6 deals', () => {
  const zero = render([]);
  assert.match(zero.html, /No new fares from Seattle/);
  assert.equal(zero.subject, 'Sparkfare deals from Seattle');

  const one = render([deal()]);
  assert.match(one.html, /Tbilisi/);
  assert.doesNotMatch(one.subject, /\+ \d+ more/);

  const many = Array.from({ length: 8 }, (_, i) => deal({ display_name: `Place${i}, Land`, price: 500 + i }));
  const six = render(many);
  assert.equal((six.html.match(/<h[23] /g) || []).length, 6);
  assert.match(six.subject, /\+ 5 more/);
});

test('shows the comparison only when dealQuality is eligible', () => {
  const eligible = render([deal()]);
  assert.match(eligible.html, /28% BELOW USUAL/);
  assert.match(eligible.html, /Usually ~/);
  assert.match(eligible.html, /N=20/);
  assert.match(eligible.subject, /28% below usual/);

  const cases = {
    'too little history': deal({ observations: obs(740, 5) }),
    'featured route': deal({ status: 'featured' }),
    'stale price': deal({ found_at: '2026-09-15T09:00:00Z' }),
    'not below the baseline': deal({ price: 800 }),
  };
  for (const [name, d] of Object.entries(cases)) {
    const out = render([d]);
    assert.doesNotMatch(out.html, /% BELOW USUAL|Usually ~|30-day median/i, name);
    assert.doesNotMatch(out.text, /% below|usually|median/i, name);
    assert.doesNotMatch(out.subject, /below usual/, name);
    assert.doesNotMatch(out.preheader, /below usual/, name);
  }
});

test('every price shows an as-of time', () => {
  const out = render([deal(), deal({ display_name: 'Lisbon, Portugal', price: 475 })]);
  assert.equal((out.html.match(/Price as of Sep 24, 09:00 UTC/g) || []).length, 2);
});

test('missing airline, dates and other fields are omitted, never printed as N/A or undefined', () => {
  const bare = { display_name: 'Tbilisi, Georgia', price: 534, found_at: FOUND_AT, booking_link: 'https://example.com/book' };
  const out = render([bare]);
  for (const bad of ['undefined', 'N/A', 'null', 'NaN']) {
    assert.ok(!out.html.includes(bad), `html contains ${bad}`);
    assert.ok(!out.text.includes(bad), `text contains ${bad}`);
  }
  assert.doesNotMatch(out.html, /days/);
  assert.match(out.html, /\$534/);
});

test('an unknown airline code is omitted rather than printed raw', () => {
  const out = render([deal({ airline: 'ZZ' })]);
  assert.doesNotMatch(out.html, /ZZ/);
  assert.equal(airlineName('TK'), 'Turkish Airlines');
});

test('archive mode contains no email address, token or unsubscribe link', () => {
  const out = renderDailyDigest({
    origin: 'SEA', deals: [deal()], user: null, now: NOW,
    config: { ...CONFIG, unsubscribeUrl: 'https://sparkfare.com/api/unsubscribe?email=secret%40example.com&token=tok_123', referralUrl: CONFIG.referralUrl },
  });
  for (const part of [out.html, out.text]) {
    assert.doesNotMatch(part, /secret/);
    assert.doesNotMatch(part, /tok_123/);
    assert.doesNotMatch(part, /unsubscribe/i);
    assert.doesNotMatch(part, /ref_abc123/);
  }
  assert.match(out.html, /Get this in your inbox every morning/);
});

test('the affiliate disclosure comes before the first affiliate link', () => {
  const out = render([deal(), deal({ display_name: 'Lisbon, Portugal', price: 475 })]);
  const disclosureAt = out.html.indexOf(DISCLOSURE_TEXT);
  const firstAffiliate = out.html.indexOf('aviasales.com');
  assert.ok(disclosureAt > -1 && firstAffiliate > -1);
  assert.ok(disclosureAt < firstAffiliate);
  assert.ok(out.text.indexOf(DISCLOSURE_TEXT) < out.text.indexOf('aviasales.com'));
});

test('html stays well under the Gmail clipping limit, and a plain-text part exists', () => {
  const many = Array.from({ length: 6 }, (_, i) => deal({ display_name: `Tbilisi, Georgia`, price: 500 + i }));
  const out = render(many);
  assert.ok(Buffer.byteLength(out.html) < 90 * 1024, `html is ${Buffer.byteLength(out.html)} bytes`);
  assert.ok(out.text.length > 100);
  assert.match(out.text, /Tbilisi/);
});

test('email structure: lang, color-scheme meta, preheader, table layout, dark-mode block, alt text', () => {
  const out = render([deal()]);
  assert.match(out.html, /<html lang="en"/);
  assert.match(out.html, /<meta name="color-scheme" content="light dark">/);
  assert.match(out.html, /<meta name="supported-color-schemes" content="light dark">/);
  assert.match(out.html, /prefers-color-scheme: dark/);
  assert.match(out.html, /display:none;max-height:0;overflow:hidden/);
  assert.match(out.html, /role="presentation"/);
  assert.match(out.html, /width="600"/);
  for (const img of out.html.match(/<img [^>]*>/g) || []) assert.match(img, /alt=/);
  assert.doesNotMatch(out.html, /#000000|#FFFFFF|#000\b|#FFF\b/i);
});

test('subject lead with the best deal, stay short, and avoid shouting', () => {
  const eligible = render([deal(), deal({ display_name: 'Lisbon, Portugal', price: 475, observations: obs(600) })]);
  const long = render([deal({ display_name: 'Ho Chi Minh City, Vietnam', price: 806 }), deal({ display_name: 'X, Y', price: 900 })], { origin: 'SFO' });
  for (const s of [eligible.subject, long.subject]) {
    assert.ok(s.length <= 58, `${s} is ${s.length} chars`);
    assert.doesNotMatch(s, /!!|\b[A-Z]{5,}\b/);
  }
  assert.match(eligible.subject, /^(Tbilisi|Lisbon) \$\d+ from Seattle \(\d+% below usual\) \+ 1 more$/);
  assert.match(long.subject, /^Ho Chi Minh City \$806 from /);
});

test('the best deal by percentage below usual leads', () => {
  const out = render([
    deal({ display_name: 'Lisbon, Portugal', price: 700, observations: obs(740) }),
    deal({ display_name: 'Tbilisi, Georgia', price: 400, observations: obs(740) }),
  ]);
  assert.match(out.subject, /^Tbilisi/);
});

test('sparkfare.com links get UTM parameters; affiliate links are untouched', () => {
  const out = render([deal()]);
  const hrefs = [...out.html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
  const own = hrefs.filter((h) => h.startsWith('https://sparkfare.com'));
  assert.ok(own.length >= 4);
  for (const h of own) {
    if (h.includes('/api/unsubscribe')) continue;
    const u = new URL(h);
    assert.equal(u.searchParams.get('utm_source'), 'email', h);
    assert.equal(u.searchParams.get('utm_medium'), 'daily', h);
    assert.equal(u.searchParams.get('utm_campaign'), '2026-09-24', h);
  }
  assert.ok(hrefs.includes('https://www.aviasales.com/search/SEA2310TBS02111?marker=314524'));
});

test('postal address renders from config and is absent otherwise', () => {
  assert.match(render([deal()]).html, /123 Example St/);
  const without = renderDailyDigest({ origin: 'SEA', deals: [deal()], user: { id: 'u1' }, now: NOW, config: { ...CONFIG, postalAddress: null } });
  assert.doesNotMatch(without.html, /Example St/);
});

test('referral and away mode blocks appear only when provided', () => {
  const on = render([deal()]);
  assert.match(on.html, /Share your link/);
  assert.match(on.html, /Complete the trip/);
  const off = renderDailyDigest({ origin: 'SEA', deals: [deal()], user: { id: 'u1' }, now: NOW, config: { ...CONFIG, referralUrl: null, awayMode: null } });
  assert.doesNotMatch(off.html, /Share your link|Complete the trip/);
});

test('fare tip rotates deterministically by edition', () => {
  const a = render([deal()], { edition: 4 });
  const b = render([deal()], { edition: 4 });
  const c = render([deal()], { edition: 5 });
  assert.equal(a.html, b.html);
  assert.match(a.html, /Tip A/);
  assert.match(c.html, /Tip B/);
  assert.match(a.html, /Edition 4/);
  assert.doesNotMatch(render([deal()]).html, /Edition/);
});

test('the intro reports a real week-over-week drop when there is one', () => {
  const dropped = deal({ observations: [...obs(800, 20).slice(0, 12), ...obs(534, 8).map((o, i) => ({ ...o, date: `2026-09-${18 + i}` }))] });
  const out = render([dropped]);
  assert.match(out.html, /down \$\d+ from a week ago/);
  assert.match(render([deal({ observations: obs(540) })]).html, /The lowest is Tbilisi at \$534/);
});

test('HTML in deal data is escaped', () => {
  const out = render([deal({ display_name: '<script>alert(1)</script>, Evil' })]);
  assert.doesNotMatch(out.html, /<script>alert/);
});

test('helpers: formatWindow, parseBookingLink, addUtm, dropFromWeekAgo, pickTip, escapeHtml', () => {
  assert.deepEqual(formatWindow('2026-11-27T22:35:00-05:00', '2026-12-11T16:15:00+02:00'), { text: 'Nov 27 – Dec 11, 2026', days: 14 });
  assert.equal(formatWindow(null, null), null);
  assert.deepEqual(parseBookingLink('https://www.aviasales.com/search/JFK2711LCA11121?marker=1'), { origin: 'JFK', destination: 'LCA' });
  assert.equal(parseBookingLink('https://example.com'), null);
  assert.equal(addUtm('https://example.com/x?a=1', { campaign: 'c' }), 'https://example.com/x?a=1');
  assert.match(addUtm('https://sparkfare.com/x?a=1', { campaign: 'c' }), /a=1.*utm_source=email/);
  assert.equal(dropFromWeekAgo(obs(800, 20), 700, '2026-09-24T09:00:00Z'), 100);
  assert.equal(dropFromWeekAgo(obs(800, 20), 790, '2026-09-24T09:00:00Z'), null);
  assert.equal(dropFromWeekAgo([], 700, FOUND_AT), null);
  assert.equal(pickTip([], 3), null);
  assert.equal(pickTip(['a', 'b'], 3), 'b');
  assert.equal(escapeHtml('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
});

// ---- Sending path: flag off is byte-identical to the original template ----

function stubResend() {
  const sent = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes('resend.com')) {
      sent.push(JSON.parse(options.body));
      return new Response(JSON.stringify({ data: { id: 'test-id' }, error: null }), { status: 200 });
    }
    return original(url, options);
  };
  return { sent, restore: () => { globalThis.fetch = original; } };
}

const SEND_ENV = { RESEND_API_KEY: 'test-key', APP_URL: 'https://sparkfare.com', EMAIL_FROM: 'Sparkfare <hello@sparkfare.com>' };
const SNAPSHOT_DEALS = [
  { display_name: 'Lisbon, Portugal', price: 475, booking_link: 'https://www.aviasales.com/search/JFK1103LIS1110?marker=314524' },
  { display_name: 'Tulum, Mexico', price: 220, booking_link: 'https://www.aviasales.com/search/JFK0512CUN1212?marker=314524' },
];

test('flag off: the daily email is byte-identical to the original template', async () => {
  const { sent, restore } = stubResend();
  try {
    await sendDailyDealEmail({ email: 'snap@example.com', origin: 'JFK', deals: SNAPSHOT_DEALS, userId: 'u1' }, SEND_ENV);
  } finally { restore(); }
  const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/daily_email_v1.json', import.meta.url), 'utf8'));
  assert.equal(sent[0].subject, fixture.subject);
  assert.equal(sent[0].html, fixture.html);
  assert.equal(sent[0].text, undefined);
});

test('flag on: sends the v2 template with a text part and one-click unsubscribe headers', async () => {
  const { sent, restore } = stubResend();
  try {
    await sendDailyDealEmail({ email: 'v2@example.com', origin: 'SEA', deals: [deal()], userId: 'u1' }, { ...SEND_ENV, ENABLE_EMAIL_V2: 'true', EMAIL_POSTAL_ADDRESS: '1 Test Way' });
  } finally { restore(); }
  assert.equal(sent.length, 1);
  assert.match(sent[0].subject, /Tbilisi/);
  assert.ok(sent[0].text.length > 100);
  assert.match(sent[0].html, /1 Test Way/);
  assert.match(sent[0].headers['List-Unsubscribe'], /\/api\/unsubscribe\?email=v2%40example\.com/);
  assert.equal(sent[0].headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
});

test('flag on: the Away Mode block uses the in-code blurb, never the internal commission note', async () => {
  const db = {
    prepare(sql) {
      const rows = /FROM partners/.test(sql)
        ? [{ slug: 'safetywing', name: 'SafetyWing', category: 'Insurance', link: 'https://x', blurb: 'COMMISSION 10% recurring' }]
        : [];
      const result = { first: async () => null, all: async () => ({ results: rows }), run: async () => ({ success: true }) };
      return { ...result, bind: () => result };
    },
  };
  const { sent, restore } = stubResend();
  try {
    await sendDailyDealEmail({ email: 'v2@example.com', origin: 'SEA', deals: [deal()], userId: 'u1' }, { ...SEND_ENV, DB: db, ENABLE_EMAIL_V2: 'true' });
  } finally { restore(); }
  assert.doesNotMatch(sent[0].html, /COMMISSION/);
  assert.match(sent[0].html, /SafetyWing/);
  assert.match(sent[0].html, /Complete the trip/);
});

test('flag on: with no live partners the Away Mode block is omitted', async () => {
  const db = {
    prepare() {
      const result = { first: async () => null, all: async () => ({ results: [] }), run: async () => ({ success: true }) };
      return { ...result, bind: () => result };
    },
  };
  const { sent, restore } = stubResend();
  try {
    await sendDailyDealEmail({ email: 'v2@example.com', origin: 'SEA', deals: [deal()], userId: 'u1' }, { ...SEND_ENV, DB: db, ENABLE_EMAIL_V2: 'true' });
  } finally { restore(); }
  assert.doesNotMatch(sent[0].html, /Complete the trip/);
});

test('a failing sending-guard stats query (e.g. missing events table) does not block the send', async () => {
  const { _resetSendingGuardForTests } = await import('../src/email.js');
  _resetSendingGuardForTests();
  const db = {
    prepare(sql) {
      if (/FROM events/.test(sql)) return { first: async () => { throw new Error('D1_ERROR: no such table: events'); } };
      const result = { first: async () => null, all: async () => ({ results: [] }), run: async () => ({ success: true }) };
      return { ...result, bind: () => result };
    },
  };
  const { sent, restore } = stubResend();
  const originalError = console.error;
  console.error = () => {};
  try {
    await sendDailyDealEmail({ email: 'guard@example.com', origin: 'SEA', deals: [deal()], userId: 'u1' }, { ...SEND_ENV, DB: db });
  } finally {
    restore();
    console.error = originalError;
    _resetSendingGuardForTests();
  }
  assert.equal(sent.length, 1);
});
