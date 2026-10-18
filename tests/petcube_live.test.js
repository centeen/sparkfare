// D-013 / Addendum C task C3 (owner approval 2026-10-16) made Petcube live on Away Mode and only there; K-A4 (D-032, 2026-10-17) hid it again
// (migration 0030: status 'pending', row and link kept, G62 open). The tests below cover both: what migration 0026 set, what 0030 undid, and that
// no page names it while it is hidden. The link is the one
// the owner supplied, stored verbatim and reached through /out/petcube with no traveler data; the card carries its own
// disclosure; it never appears on route pages, in the generic emails, in the in-code partner list, or on other pages.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import worker from '../src/index.js';
import { makeSqliteD1 } from './helpers/sqliteD1.js';
import { AWAY_MODE_PARTNERS } from '../src/email.js';
import { PARTNER_REGISTRY, PLACEMENT_BY_CATEGORY } from '../src/meters.js';

const ROOT = path.resolve(process.cwd());
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const MIGRATIONS = fs.readdirSync(path.join(ROOT, 'migrations')).filter((f) => f.endsWith('.sql')).sort().map((f) => `migrations/${f}`);
const LINK = 'https://www.awin1.com/cread.php?awinmid=33889&awinaffid=3086775&ued=https%3A%2F%2Fpetcube.com%2Fstore%2Fcategory%2Fcameras%2F';
const BLURB = 'Check in on a pet you leave at home. See them, talk to them and play through the app while you are away.';

test('after migration 0026 (before K-A4 hid it) the petcube row is live with the owner\'s link, the approved blurb and a pet_care leave-meter registry entry', () => {
  const DB = makeSqliteD1(MIGRATIONS.filter((m) => m < 'migrations/0027'));
  const row = DB.raw.prepare("SELECT * FROM partners WHERE slug = 'petcube'").get();
  assert.equal(row.status, 'live');
  assert.equal(row.url_template, LINK, 'stored exactly as supplied');
  assert.equal(row.commission_note, BLURB);
  assert.equal(row.status_reason, null);
  assert.deepEqual([row.meter, row.category_slug, row.attribution], ['leave', 'pet_care', 'none']);
  assert.deepEqual(PARTNER_REGISTRY.petcube, { meter: 'leave', category_slug: 'pet_care', attribution: 'none' });
});

test('after migration 0030 the petcube row is pending (hidden), its link is kept, and the live partner list no longer includes it', () => {
  const DB = makeSqliteD1(MIGRATIONS);
  const row = DB.raw.prepare("SELECT * FROM partners WHERE slug = 'petcube'").get();
  assert.equal(row.status, 'pending');
  assert.match(row.status_reason, /D-032/);
  assert.equal(row.url_template, LINK, 'the link is kept for G62');
  const live = DB.raw.prepare("SELECT slug FROM partners WHERE status = 'live'").all().map((r) => r.slug);
  assert.ok(!live.includes('petcube'));
  assert.equal(live.length, 13);
});

test('the blurb has no banned or risky words, and nothing mentions the Emergency Fund or a vet service', () => {
  assert.doesNotMatch(BLURB, /\b(book|booked|booking|secure|secured|urgent|hurry|save|saving|savings|deal|discount|safe|safety|health|emergency|vet|insurance|cover)\b/i);
  for (const f of ['away-mode.html', 'disclosure.html', 'about.html', 'migrations/0025_petcube_hidden_partner.sql', 'migrations/0026_petcube_live.sql']) {
    assert.doesNotMatch(read(f), /emergency fund|vet service/i, f);
  }
});

test('the link has no traveler data and no extra parameters beyond Awin\'s own', () => {
  const u = new URL(LINK);
  assert.equal(u.hostname, 'www.awin1.com');
  assert.deepEqual([...u.searchParams.keys()].sort(), ['awinaffid', 'awinmid', 'ued']);
  assert.equal(u.searchParams.get('ued'), 'https://petcube.com/store/category/cameras/');
});

function env(status) {
  const calls = [];
  return {
    calls,
    DB: {
      prepare: (q) => {
        calls.push(q);
        return {
          all: async () => ({ results: [] }),
          bind: () => ({ first: async () => ({ slug: 'petcube', status, url_template: LINK }), run: async () => ({ success: true }) }),
          run: async () => ({ success: true }),
        };
      },
    },
  };
}

for (const prefix of ['/out/', '/go/']) {
  test(`${prefix}petcube redirects to the owner's link verbatim and drops every traveler parameter`, async () => {
    const e = env('live');
    const res = await worker.fetch(new Request(`https://sparkfare.com${prefix}petcube?src=away_mode&trip_id=abc&email=a%40b.com&departure=2026-12-01&origin=JFK`), e, { waitUntil: () => {} });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), LINK);
  });
}

test('/out/petcube still refuses while the DB row is not live', async () => {
  const res = await worker.fetch(new Request('https://sparkfare.com/out/petcube?src=away_mode'), env('pending'), { waitUntil: () => {} });
  assert.equal(res.status, 403);
});

test('placement: petcube is Away Mode only, and is not in the in-code (email/fallback) partner list', () => {
  assert.deepEqual(PLACEMENT_BY_CATEGORY.pet_care, ['away_mode']);
  assert.equal(AWAY_MODE_PARTNERS.some((p) => p.slug === 'petcube'), false);
});

test('while Petcube is hidden no page, post or template names it', () => {
  const visible = [];
  for (const f of fs.readdirSync(ROOT)) if (f.endsWith('.html')) visible.push(f);
  for (const dir of ['blog', 'data']) for (const f of fs.readdirSync(path.join(ROOT, dir))) if (f.endsWith('.html')) visible.push(`${dir}/${f}`);
  visible.push('src/email.js', 'src/leaveReady.js', 'src/longLeave.js', 'Phase 20 Blog Generator.py', 'site-footer.js');
  const mentions = visible.filter((p) => fs.existsSync(path.join(ROOT, p)) && /petcube/i.test(read(p))).sort();
  assert.deepEqual(mentions, []);
});

test('about.html and disclosure.html no longer mention a pet-camera partner', () => {
  assert.doesNotMatch(read('disclosure.html'), /pet cameras/i);
  assert.doesNotMatch(read('about.html'), /pet-camera/i);
  assert.match(read('about.html'), /The home items are plain instructions with no link, and so are the pet items\./);
});

test('away-mode.html has no inline-disclosure partner while Petcube is hidden, and the "Traveling with a pet?" toggle maps to no partner', () => {
  const html = read('away-mode.html');
  assert.match(html, /INLINE_DISCLOSURE_SLUGS = \[\];/);
  const keyMap = html.match(/const KEY_MAP = \{([\s\S]*?)\};/)[1];
  assert.doesNotMatch(keyMap, /'pet'/, 'the pet toggle must not reorder or show a partner');
});

test('route pages and the generic emails never list Petcube even when it is live', async () => {
  const live = [{ slug: 'bounce', name: 'Bounce', category: 'Luggage', link: 'https://x', blurb: 'b' }, { slug: 'petcube', name: 'Petcube', category: 'Pet Care', link: LINK, blurb: BLURB }];
  const { getAwayModePartners } = await import('../src/email.js');
  const e = { DB: { prepare: () => ({ all: async () => ({ results: live }) }) } };
  assert.deepEqual((await getAwayModePartners(e, { surface: 'route_page' })).map((p) => p.slug), ['bounce']);
  assert.deepEqual((await getAwayModePartners(e, { surface: 'email' })).map((p) => p.slug), ['bounce']);
  assert.deepEqual((await getAwayModePartners(e, { surface: 'away_mode' })).map((p) => p.slug), ['bounce', 'petcube']);
});
