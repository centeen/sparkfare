// A target-reached email says the price "is $X" with an as-of time. It must only go out for a fare actually seen
// recently (not a carried-forward fallback, not an old fare), and a skipped watchlist stays un-notified so a
// fresher fare can trigger it later.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { targetFareFreshness } from '../src/dealQuality.js';
import { sendTargetReachedEmail } from '../src/email.js';
import { checkWatchlists } from '../src/index.js';

const NOW = Date.parse('2026-10-12T08:00:00Z');
const hoursAgo = (h) => new Date(NOW - h * 3600000).toISOString();

test('targetFareFreshness: recent fare is fresh, fallback / old / missing time is not', () => {
  assert.equal(targetFareFreshness({ found_at: hoursAgo(5) }, NOW).fresh, true);
  assert.equal(targetFareFreshness({ found_at: hoursAgo(71) }, NOW).fresh, true);
  assert.equal(targetFareFreshness({ found_at: hoursAgo(73) }, NOW).fresh, false);
  assert.equal(targetFareFreshness({ found_at: hoursAgo(5), is_stale_fallback: true }, NOW).fresh, false);
  assert.equal(targetFareFreshness({}, NOW).fresh, false);
  assert.equal(targetFareFreshness({ found_at: 'garbage' }, NOW).fresh, false);
  assert.equal(targetFareFreshness(null, NOW).fresh, false);
  assert.equal(targetFareFreshness({ found_at: hoursAgo(5) }, NOW).foundAt, hoursAgo(5));
});

async function captureEmail(args) {
  const original = globalThis.fetch;
  let sent = null;
  globalThis.fetch = async (url, options) => {
    const u = typeof url === 'string' ? url : url.url;
    if (u.includes('api.resend.com/emails')) {
      sent = JSON.parse(options.body);
      return new Response(JSON.stringify({ id: 'fake' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return original(url, options);
  };
  try {
    const r = await sendTargetReachedEmail({ email: 'a@example.com', origin: 'SEA', destination: 'Oaxaca, Mexico', price: 763, targetPrice: 800, bookingLink: 'https://www.aviasales.com/search/SEA2310OAX02111?marker=314524', ...args },
      { RESEND_API_KEY: 're_test', APP_URL: 'https://sparkfare.com' });
    assert.equal(r.mocked, false);
    return sent;
  } finally { globalThis.fetch = original; }
}

test('the email states the price with the time the data was retrieved and no longer says "just hit"', async () => {
  const sent = await captureEmail({ foundAt: '2026-10-08T09:08:23Z' });
  assert.match(sent.html, /Oaxaca, Mexico from SEA is /);
  assert.match(sent.html, /Fare data retrieved Oct 8, 9:08 am UTC\./);
  assert.doesNotMatch(sent.html, /Price as of/);
  assert.match(sent.html, /fares change fast/);
  assert.doesNotMatch(sent.html, /just hit/);
});

test('without a found time the email omits the as-of sentence rather than inventing one', async () => {
  const sent = await captureEmail({});
  assert.doesNotMatch(sent.html, /Fare data retrieved|Price as of/);
  assert.doesNotMatch(sent.html, /just hit/);
});

// Minimal D1 for checkWatchlists: one un-notified watchlist; records whether notified_at was set.
function makeEnv(record, { origin = 'JFK', destination = 'Lisbon, Portugal' } = {}) {
  const state = { notified: false, sends: 0 };
  const row = { id: 'w1', origin_iata: origin, destination, target_price: 450, email: 'w@example.com', subscription_tier: 'free' };
  const feed = { generated_at: '2026-10-12T00:00:00Z', deals: [], featured: [], priced_no_deal: [record], insufficient_history: [], no_data: [] };
  const DB = {
    prepare(sql) {
      const q = sql.replace(/\s+/g, ' ').trim();
      const stmt = {
        bind: () => stmt,
        run: async () => {
          if (q.startsWith('UPDATE watchlists SET notified_at')) { state.notified = true; return { success: true, meta: { changes: 1 } }; }
          return { success: true, meta: { changes: 0 } };
        },
        all: async () => (q.includes('FROM watchlists w') ? { results: [row] } : { results: [] }),
        first: async () => null,
      };
      return stmt;
    },
  };
  const ASSETS = { fetch: async (req) => new Response(JSON.stringify(feed), { status: 200, headers: { 'Content-Type': 'application/json' } }) };
  return { env: { DB, ASSETS }, state };
}

const NOW_ISO = () => new Date().toISOString();
const rec = (extra) => ({ display_name: 'Lisbon, Portugal', route_key: 'JFK:Lisbon, Portugal', origin: 'JFK', price: 400, status: 'priced_no_deal', booking_link: 'https://www.aviasales.com/search/JFK1011LIS1811?marker=314524', ...extra });

test('checkWatchlists: a fresh fare at or below target notifies', async () => {
  const { env, state } = makeEnv(rec({ found_at: NOW_ISO() }));
  const r = await checkWatchlists(env);
  assert.equal(r.notified, 1);
  assert.equal(state.notified, true);
});

test('checkWatchlists: a carried-forward fallback never notifies and stays un-notified', async () => {
  const { env, state } = makeEnv(rec({ found_at: NOW_ISO(), is_stale_fallback: true }));
  const r = await checkWatchlists(env);
  assert.equal(r.notified, 0);
  assert.equal(state.notified, false);
});

test('checkWatchlists: a fare older than 72 hours never notifies and stays un-notified', async () => {
  const { env, state } = makeEnv(rec({ found_at: new Date(Date.now() - 100 * 3600000).toISOString() }));
  const r = await checkWatchlists(env);
  assert.equal(r.notified, 0);
  assert.equal(state.notified, false);
});

test('checkWatchlists: a fare with no found time never notifies', async () => {
  const { env, state } = makeEnv(rec({}));
  const r = await checkWatchlists(env);
  assert.equal(r.notified, 0);
  assert.equal(state.notified, false);
});
