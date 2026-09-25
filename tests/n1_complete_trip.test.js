import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import worker from '../src/index.js';

// N1: "Complete the trip" module -- Tiqets (activities), GoCity (city pass), QEEQ (car rental),
// and Welcome Pickups (airport transfer), seeded into the `partners` table via
// migrations/0009_complete_trip_partners.sql as status = 'pending', since this session initially
// had no access to the real, Coby-specific affiliate tracking links for any of them. Per this
// project's own established discipline (see the Aviasales/Airalo/NordVPN "YOUR_PID" lessons in
// CLAUDE.md), a guessed placeholder link was never used as a stand-in. Coby supplied the real
// tpo.lu tracking links the same day; migrations/0010_complete_trip_partners_live.sql flips all
// four to status = 'live' with the real url_template. Tests below cover both migrations: 0009's
// own seed behavior (still correctly 'pending' in isolation) and 0010's flip to 'live'.

const N1_SLUGS = ['tiqets', 'gocity', 'qeeq', 'welcome-pickups'];

function parseMigrationRows(sqlContent) {
  const valuesRegex = /INSERT INTO partners.*?VALUES\s*([\s\S]*?);/s;
  const match = sqlContent.match(valuesRegex);
  assert.ok(match, 'Could not find seed data in migration');
  const rows = match[1].split('),').map(r => r.replace(/[()]/g, '').trim());
  return rows.filter(Boolean).map(row => {
    // Values are comma-separated single-quoted strings; split naively since no value here
    // contains a literal comma (true for this migration's own seed rows).
    const cols = row.split(',').map(c => c.trim().replace(/^'|'$/g, ''));
    return { slug: cols[0], name: cols[1], category: cols[2], link: cols[3], blurb: cols[4], status: cols[5], status_reason: cols[6] };
  });
}

test('N1: migration seeds exactly the 4 real partners as pending, with no fabricated link', async () => {
  const sqlPath = path.resolve(process.cwd(), 'migrations/0009_complete_trip_partners.sql');
  const rows = parseMigrationRows(fs.readFileSync(sqlPath, 'utf8'));

  assert.equal(rows.length, 4);
  const slugs = rows.map(r => r.slug).sort();
  assert.deepEqual(slugs, [...N1_SLUGS].sort());

  for (const row of rows) {
    assert.equal(row.status, 'pending', `${row.slug} must stay 'pending' until a real tracking link is supplied`);
    // An empty url_template is fine (satisfies NOT NULL); a fabricated placeholder URL is not.
    assert.equal(row.link, '', `${row.slug} must not have a fabricated placeholder URL`);
  }
});

test('N1: no hotel/Trivago partner is actually seeded in any migration -- that slot waits on A1', async () => {
  // Checks the parsed VALUES rows only, not raw file text -- 0009's own migration comment
  // explains *why* Trivago is excluded, so a plain text-includes check would false-positive on
  // its own documentation. This confirms no INSERT actually creates a trivago/hotel row.
  const migrationsDir = path.resolve(process.cwd(), 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
  for (const file of files) {
    const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    if (!content.includes('INSERT INTO partners')) continue;
    const rows = parseMigrationRows(content);
    for (const row of rows) {
      assert.notEqual(row.slug, 'trivago', `${file} must not seed a Trivago partner row -- hotel waits on A1 approval`);
      assert.notEqual(row.slug, 'hotel', `${file} must not seed a 'hotel' partner slug`);
      assert.notEqual((row.name || '').toLowerCase(), 'trivago', `${file} must not seed a Trivago-named partner row`);
    }
  }
});

test('N1: GET /api/partners excludes the 4 pending Complete-the-Trip partners', async () => {
  const livePartners = [
    { slug: 'safetywing', name: 'SafetyWing', category: 'Insurance', link: 'https://safetywing.com/real', blurb: 'x' },
  ];
  const pendingPartners = N1_SLUGS.map(slug => ({ slug, status: 'pending' }));

  const env = {
    DB: {
      prepare: (query) => ({
        all: async () => {
          if (query.includes("WHERE status = 'live'")) {
            // A real WHERE clause would already exclude the pending rows -- simulate that here
            // rather than trusting the mock to filter, since the mock's whole job is to prove the
            // real SQL text asks for exactly this.
            return { results: livePartners };
          }
          return { results: [...livePartners, ...pendingPartners] };
        },
      }),
    },
  };

  const req = new Request('https://sparkfare.com/api/partners');
  const res = await worker.fetch(req, env, { waitUntil: () => {} });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  const returnedSlugs = data.partners.map(p => p.slug);
  for (const slug of N1_SLUGS) {
    assert.ok(!returnedSlugs.includes(slug), `${slug} must not appear in /api/partners while pending`);
  }
});

test('N1: /out/:slug refuses a pending partner with 403, not a redirect (abstract DB-state guard, independent of current production status)', async () => {
  const env = {
    DB: {
      prepare: (query) => ({
        bind: (...args) => ({
          first: async () => {
            if (query.includes('WHERE slug = ?') && args[0] === 'tiqets') {
              return { slug: 'tiqets', status: 'pending', url_template: '' };
            }
            return null;
          },
          run: async () => ({ success: true }),
        }),
        run: async () => ({ success: true }),
      }),
    },
  };

  const req = new Request('https://sparkfare.com/out/tiqets');
  const res = await worker.fetch(req, env, { waitUntil: () => {} });
  assert.equal(res.status, 403);
});

test('N1: /out/:slug 404s for a slug in neither the DB nor the in-memory fallback', async () => {
  const env = { DB: null };
  const req = new Request('https://sparkfare.com/out/definitely-not-a-real-partner-slug');
  const res = await worker.fetch(req, env, { waitUntil: () => {} });
  assert.equal(res.status, 404);
});

test('N1: migration 0010 flips all 4 Complete-the-Trip partners to live with the real supplied tracking links, no hotel row', async () => {
  const sqlPath = path.resolve(process.cwd(), 'migrations/0010_complete_trip_partners_live.sql');
  const content = fs.readFileSync(sqlPath, 'utf8');

  const expected = {
    tiqets: 'https://tiqets.tpo.lu/p0pwNloI',
    gocity: 'https://gocity.tpo.lu/n8KrVAZY',
    qeeq: 'https://qeeq.tpo.lu/UjZTOlwU',
    'welcome-pickups': 'https://tpo.lu/kuJ7K9NS',
  };

  const updateRegex = /UPDATE partners SET url_template = '([^']+)', status = '([^']+)'[^;]*WHERE slug = '([^']+)'/g;
  const found = {};
  let match;
  while ((match = updateRegex.exec(content)) !== null) {
    const [, url, status, slug] = match;
    found[slug] = { url, status };
  }

  assert.deepEqual(Object.keys(found).sort(), Object.keys(expected).sort());
  for (const [slug, url] of Object.entries(expected)) {
    assert.equal(found[slug].status, 'live', `${slug} must flip to 'live'`);
    assert.equal(found[slug].url, url, `${slug} must use the exact real tracking link supplied`);
  }
  assert.ok(!content.toLowerCase().includes('trivago'), '0010 must not touch a hotel/Trivago row -- still waiting on A1');
});

test('N1: AWAY_MODE_PARTNERS in src/email.js includes all 4 with the real links (offline-fallback stays current)', async () => {
  const emailJsPath = path.resolve(process.cwd(), 'src/email.js');
  const content = fs.readFileSync(emailJsPath, 'utf8');

  const expected = {
    tiqets: 'https://tiqets.tpo.lu/p0pwNloI',
    gocity: 'https://gocity.tpo.lu/n8KrVAZY',
    qeeq: 'https://qeeq.tpo.lu/UjZTOlwU',
    'welcome-pickups': 'https://tpo.lu/kuJ7K9NS',
  };

  for (const [slug, url] of Object.entries(expected)) {
    const blockRegex = new RegExp(`slug: '${slug}'[\\s\\S]{0,300}?link: '${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`);
    assert.ok(blockRegex.test(content), `AWAY_MODE_PARTNERS is missing a live '${slug}' entry with the real link`);
  }
});

test('N1: GET /api/partners includes all 4 once their DB rows are live, with the real links', async () => {
  const liveRows = [
    { slug: 'tiqets', name: 'Tiqets', category: 'Activities & Tickets', link: 'https://tiqets.tpo.lu/p0pwNloI', blurb: 'x' },
    { slug: 'gocity', name: 'GoCity', category: 'City Pass', link: 'https://gocity.tpo.lu/n8KrVAZY', blurb: 'x' },
    { slug: 'qeeq', name: 'QEEQ', category: 'Car Rental', link: 'https://qeeq.tpo.lu/UjZTOlwU', blurb: 'x' },
    { slug: 'welcome-pickups', name: 'Welcome Pickups', category: 'Airport Transfer', link: 'https://tpo.lu/kuJ7K9NS', blurb: 'x' },
  ];

  const env = {
    DB: {
      prepare: (query) => ({
        all: async () => {
          assert.ok(query.includes("WHERE status = 'live'"));
          return { results: liveRows };
        },
      }),
    },
  };

  const req = new Request('https://sparkfare.com/api/partners');
  const res = await worker.fetch(req, env, { waitUntil: () => {} });
  assert.equal(res.status, 200);
  const data = await res.json();
  const returned = Object.fromEntries(data.partners.map(p => [p.slug, p.link]));
  for (const slug of N1_SLUGS) {
    assert.equal(returned[slug], liveRows.find(r => r.slug === slug).link);
  }
});

test('N1: /out/:slug redirects a real, live Complete-the-Trip partner to its real link', async () => {
  const env = {
    DB: {
      prepare: (query) => ({
        bind: (...args) => ({
          first: async () => {
            if (query.includes('WHERE slug = ?') && args[0] === 'qeeq') {
              return { slug: 'qeeq', status: 'live', url_template: 'https://qeeq.tpo.lu/UjZTOlwU' };
            }
            return null;
          },
          run: async () => ({ success: true }),
        }),
        run: async () => ({ success: true }),
      }),
    },
  };

  const req = new Request('https://sparkfare.com/out/qeeq');
  const res = await worker.fetch(req, env, { waitUntil: () => {} });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('Location'), 'https://qeeq.tpo.lu/UjZTOlwU');
});
