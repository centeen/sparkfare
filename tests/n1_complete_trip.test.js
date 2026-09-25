import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import worker from '../src/index.js';

// N1: "Complete the trip" module -- Tiqets (activities), GoCity (city pass), QEEQ (car rental),
// and Welcome Pickups (airport transfer), seeded into the `partners` table via
// migrations/0009_complete_trip_partners.sql as status = 'pending', since this session has no
// access to the real, Coby-specific affiliate tracking links for any of them. Per this project's
// own established discipline (see the Aviasales/Airalo/NordVPN "YOUR_PID" lessons in CLAUDE.md),
// a guessed placeholder link is never used as a stand-in -- these four stay unreachable/invisible
// until real links are supplied and each row is flipped to status = 'live'.

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

test('N1: /out/:slug refuses a pending Complete-the-Trip partner with 403, not a redirect', async () => {
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

test('N1: /out/:slug 404s for a Complete-the-Trip slug not yet in the DB at all (no in-memory fallback either)', async () => {
  const env = { DB: null };
  const req = new Request('https://sparkfare.com/out/gocity');
  const res = await worker.fetch(req, env, { waitUntil: () => {} });
  // No DB, and 'gocity' isn't in AWAY_MODE_PARTNERS' in-memory fallback either -- confirms this
  // pending partner can't leak through any code path while unapproved.
  assert.equal(res.status, 404);
});
