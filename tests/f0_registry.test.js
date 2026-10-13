// F0 (Task B): the partner registry, migration 0022, link routing (B3) and the privacy sentence (B8).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { makeSqliteD1 } from './helpers/sqliteD1.js';
import worker from '../src/index.js';
import { AWAY_MODE_PARTNERS, routeFareLink, buildAwayModeLink } from '../src/email.js';
import { PARTNER_REGISTRY, METERS, ATTRIBUTIONS, isFlightOutbound, withRegistryFields } from '../src/meters.js';

const MIGRATIONS = fs.readdirSync(new URL('../migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort().map((f) => `migrations/${f}`);
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('registry: every partner has a valid meter, a category slug and an attribution', () => {
  for (const [slug, r] of Object.entries(PARTNER_REGISTRY)) {
    assert.ok(METERS.includes(r.meter), `${slug} meter`);
    assert.match(r.category_slug, /^[a-z][a-z_]*$/, `${slug} category_slug`);
    assert.ok(ATTRIBUTIONS.includes(r.attribution), `${slug} attribution`);
  }
  assert.equal(PARTNER_REGISTRY.aviasales.meter, 'fare');
  assert.equal(PARTNER_REGISTRY.aviasales.attribution, 'sub_id');
});

test('registry: every in-code Away Mode partner carries the registry fields explicitly', () => {
  assert.ok(AWAY_MODE_PARTNERS.length >= 13); // 14 until SafetyWing was retired (D-002); its registry entry stays for history
  for (const p of AWAY_MODE_PARTNERS) {
    const r = PARTNER_REGISTRY[p.slug];
    assert.ok(r, `${p.slug} is in the registry`);
    assert.deepEqual([p.meter, p.category_slug, p.attribution], [r.meter, r.category_slug, r.attribution], p.slug);
  }
});

test('registry: every partner the migrations seed is in the registry, and migration 0022 fills the same values', async () => {
  const DB = makeSqliteD1(MIGRATIONS);
  const rows = DB.raw.prepare('SELECT slug, meter, category_slug, attribution FROM partners').all();
  assert.ok(rows.length >= 14);
  for (const row of rows) {
    const r = PARTNER_REGISTRY[row.slug];
    assert.ok(r, `${row.slug} is missing from PARTNER_REGISTRY`);
    assert.deepEqual([row.meter, row.category_slug, row.attribution], [r.meter, r.category_slug, r.attribution], row.slug);
  }
});

test('registry: insurance is meter leave, category insurance, and withRegistryFields decorates a database row', () => {
  assert.deepEqual(PARTNER_REGISTRY.safetywing, { meter: 'leave', category_slug: 'insurance', attribution: 'none' });
  const row = withRegistryFields({ slug: 'bounce', name: 'Bounce', category: 'Luggage Storage' });
  assert.equal(row.category, 'Luggage Storage', 'the display label is untouched');
  assert.equal(row.category_slug, 'luggage_storage');
  assert.deepEqual(withRegistryFields({ slug: 'unlisted' }), { slug: 'unlisted' });
});

test('isFlightOutbound is exactly meter === "fare"', () => {
  assert.equal(isFlightOutbound('aviasales'), true);
  for (const slug of Object.keys(PARTNER_REGISTRY).filter((s) => s !== 'aviasales')) assert.equal(isFlightOutbound(slug), false, slug);
  assert.equal(isFlightOutbound('nope'), false);
});

// ---------- B3: links ----------

test('B3: the links that had no src now carry a distinct one', () => {
  assert.match(read('away-mode.html'), /\/out\/\$\{p\.slug\}\?src=away_mode/);
  assert.match(read('src/index.js'), /\/out\/\$\{p\.slug\}\?src=route_page/);
  const inter = read('src/interstitial.js');
  assert.match(inter, /&src=interstitial`/);
  assert.match(inter, /src=interstitial`;/);
  const email = read('src/email.js');
  for (const src of ['email_followup', 'email_stress', 'email_briefing', 'email_booked', 'email_departing', 'email_sequence', 'digest_block']) {
    assert.ok(email.includes(`'${src}'`), `${src} is used`);
  }
  assert.equal(buildAwayModeLink('https://sparkfare.com', 'bounce', { tripId: 't1', src: 'email_followup' }), 'https://sparkfare.com/out/bounce?trip_id=t1&src=email_followup');
  assert.equal(buildAwayModeLink('https://sparkfare.com', 'bounce'), 'https://sparkfare.com/out/bounce');
});

test('B3: no link builder can put travel dates in an /out URL', () => {
  const email = read('src/email.js');
  assert.doesNotMatch(email, /params\.set\('(arrival|exit)'/);
  const url = buildAwayModeLink('https://sparkfare.com', 'parking-access', { tripId: 't', arrival: '2026-11-15', exit: '2026-11-22' });
  assert.doesNotMatch(url, /2026-11|arrival|exit/);
});

test('B3: routeFareLink sends only Aviasales links through /out, and only with the flag on', () => {
  const link = 'https://www.aviasales.com/search/JFK1511LIS2211?marker=314524';
  assert.equal(routeFareLink({}, 'https://sparkfare.com', link, 'digest'), link);
  assert.equal(routeFareLink({ ENABLE_FARE_ROUTING: 'false' }, 'https://sparkfare.com', link, 'digest'), link);
  const on = routeFareLink({ ENABLE_FARE_ROUTING: 'true' }, 'https://sparkfare.com', link, 'digest');
  assert.equal(on, `https://sparkfare.com/out/aviasales?url=${encodeURIComponent(link)}&src=digest`);
  assert.equal(routeFareLink({ ENABLE_FARE_ROUTING: 'true' }, 'https://sparkfare.com', 'https://evil.example/x', 'digest'), 'https://evil.example/x');
  assert.equal(routeFareLink({ ENABLE_FARE_ROUTING: 'true' }, 'https://sparkfare.com', 'not a url', 'digest'), 'not a url');
});

test('B3: GET /api/route-links reports the flag', async () => {
  const get = async (env) => (await worker.fetch(new Request('https://sparkfare.com/api/route-links'), env, { waitUntil() {} })).json();
  assert.deepEqual(await get({}), { enabled: false });
  assert.deepEqual(await get({ ENABLE_FARE_ROUTING: 'true' }), { enabled: true });
});

function runFareRouting(flagOn) {
  const links = [
    { href: 'https://www.aviasales.com/search/A?marker=1', classes: ['hero-cta'] },
    { href: 'https://www.aviasales.com/search/B?marker=1', classes: ['book-link'] },
    { href: 'https://www.aviasales.com/search/C?marker=1', classes: [] },
    { href: 'https://example.com/other', classes: [] },
  ].map((l) => {
    const attrs = { href: l.href };
    return { attrs, classList: { contains: (c) => l.classes.includes(c) }, getAttribute: (k) => attrs[k] ?? null, setAttribute: (k, v) => { attrs[k] = v; } };
  });
  let observer = null;
  const sandbox = {
    document: { body: {}, querySelectorAll: () => links },
    fetch: async () => ({ ok: true, json: async () => ({ enabled: flagOn }) }),
    MutationObserver: class { constructor(cb) { observer = cb; } observe() {} },
    encodeURIComponent,
  };
  vm.runInNewContext(read('fare-routing.js'), sandbox);
  return new Promise((resolve) => setTimeout(() => resolve({ links, observer }), 20));
}

test('B3: fare-routing.js rewrites Aviasales links only when enabled, keeps the raw link, and names the surface', async () => {
  const off = await runFareRouting(false);
  assert.equal(off.links[0].attrs.href, 'https://www.aviasales.com/search/A?marker=1');
  assert.equal(off.observer, null);
  const on = await runFareRouting(true);
  assert.match(on.links[0].attrs.href, /^\/out\/aviasales\?url=.*&src=home_hero$/);
  assert.match(on.links[1].attrs.href, /&src=home_card$/);
  assert.match(on.links[2].attrs.href, /&src=home_search$/);
  assert.equal(on.links[0].attrs['data-booking-link'], 'https://www.aviasales.com/search/A?marker=1', 'the raw link is kept for POST /api/trips');
  assert.equal(on.links[3].attrs.href, 'https://example.com/other', 'only Aviasales links are touched');
  assert.doesNotMatch(on.links[0].attrs.href, /trip|11-14|user/);
});

test('B3: the homepage tracking call uses the raw link and loads the router', () => {
  const html = read('index.html');
  assert.match(html, /booking_link: link\.dataset\.bookingLink \|\| link\.href/);
  assert.match(html, /<script src="\/fare-routing\.js"><\/script>/);
});

// ---------- B8 ----------

test('B8: privacy.html says what is logged and that Away Mode links carry no dates', () => {
  const p = read('privacy.html').replace(/\s+/g, ' ');
  assert.match(p, /Outbound clicks are logged with the type of partner and a coarse trip-length range/);
  assert.match(p, /Away Mode partner links carry no travel dates; a flight link to the booking site carries the route and dates/);
  assert.doesNotMatch(p, /no travel dates are shared with partners/, 'the unqualified sentence would be false for flights');
});

test('B8: the schema is documented', () => {
  const doc = read('migrations_README.md');
  for (const word of ['partners.meter', 'category_slug', 'attribution', 'partner_payouts']) assert.ok(doc.includes(word), word);
});
