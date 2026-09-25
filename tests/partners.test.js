import { describe, it } from 'node:test';
import assert from 'assert';
import fs from 'fs';
import path from 'path';

// Simulates replaying every migrations/*.sql file in filename order against an in-memory
// {slug: {status, commission_note}} map -- the same pragmatic regex-based approach the existing
// KEY_MAP test above already uses for parsing migration SQL, not a real SQL engine. Added
// 2026-09-25 after a real bug: 0011_clean_partner_commission_notes.sql zeroed out
// commission_note for every partner that ever had one, and nothing re-populated it until
// 0012_populate_partner_blurbs.sql -- a single-migration regex scan (checking only the seed
// file) would have missed this entirely, since it only shows up when migrations are replayed
// in order. This function is the check that would have caught it.
function computeFinalPartnersState() {
  const migrationsDir = path.resolve(process.cwd(), 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  const state = {}; // slug -> { status, commission_note }

  for (const file of files) {
    const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

    // INSERT INTO partners (col, col, ...) VALUES (...), (...), ...;
    const insertMatch = content.match(/INSERT INTO partners\s*\(([^)]+)\)\s*VALUES\s*([\s\S]*?);/i);
    if (insertMatch) {
      const columns = insertMatch[1].split(',').map(c => c.trim());
      const slugIdx = columns.indexOf('slug');
      const statusIdx = columns.indexOf('status');
      const noteIdx = columns.indexOf('commission_note');

      // Split individual (...) tuples, respecting SQL '' escaped-quote sequences inside strings.
      const tupleRegex = /\(((?:[^()']|'(?:[^']|'')*')*)\)/g;
      let tupleMatch;
      while ((tupleMatch = tupleRegex.exec(insertMatch[2])) !== null) {
        const fields = tupleMatch[1].match(/'(?:[^']|'')*'/g);
        if (!fields || fields.length !== columns.length) continue;
        const unquote = (s) => s.slice(1, -1).replace(/''/g, "'");
        const slug = unquote(fields[slugIdx]);
        state[slug] = {
          status: statusIdx >= 0 ? unquote(fields[statusIdx]) : state[slug]?.status,
          commission_note: noteIdx >= 0 ? unquote(fields[noteIdx]) : '',
        };
      }
    }

    // UPDATE partners SET col = 'val', col2 = 'val2', ... WHERE slug = 'x';
    const updateRegex = /UPDATE partners SET ([^;]+?) WHERE slug = '([^']+)';/gi;
    let updateMatch;
    while ((updateMatch = updateRegex.exec(content)) !== null) {
      const [, setClause, slug] = updateMatch;
      if (!state[slug]) continue; // shouldn't happen -- every UPDATE targets a seeded row
      const statusSet = setClause.match(/\bstatus\s*=\s*'([^']*)'/);
      const noteSet = setClause.match(/\bcommission_note\s*=\s*'((?:[^']|'')*)'/);
      if (statusSet) state[slug].status = statusSet[1];
      if (noteSet) state[slug].commission_note = noteSet[1].replace(/''/g, "'");
    }
  }

  return state;
}

describe('Partner Mappings', async () => {
  it('ensures all KEY_MAP slugs in away-mode.html exist in AWAY_MODE_PARTNERS', async () => {
    // Read away-mode.html
    const htmlPath = path.resolve(process.cwd(), 'away-mode.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    // Extract KEY_MAP
    const keyMapMatch = html.match(/const KEY_MAP = {([^}]+)}/s);
    assert.ok(keyMapMatch, 'Could not find KEY_MAP in away-mode.html');
    
    // Parse slugs from KEY_MAP
    const slugs = [];
    const lines = keyMapMatch[1].split('\n');
    for (const line of lines) {
      if (line.includes(':')) {
        const slugMatch = line.match(/:\s*'([^']+)'/);
        if (slugMatch) {
          slugs.push(slugMatch[1]);
        }
      }
    }
    assert.ok(slugs.length > 0, 'No slugs found in KEY_MAP');

    // Read AWAY_MODE_PARTNERS from src/email.js
    const emailJsPath = path.resolve(process.cwd(), 'src/email.js');
    const emailJs = fs.readFileSync(emailJsPath, 'utf8');

    // We parse the slug fields from AWAY_MODE_PARTNERS
    const emailSlugs = [];
    const slugRegex = /slug:\s*'([^']+)'/g;
    let match;
    while ((match = slugRegex.exec(emailJs)) !== null) {
      emailSlugs.push(match[1]);
    }

    // N1 (2026-09-25): away-mode.html is DB-driven (GET /api/partners reads the live `partners`
    // table -- see the doc comment in away-mode.html itself), so the real source of truth for
    // "does this partner exist" is no longer AWAY_MODE_PARTNERS alone -- that array is only the
    // offline fallback for when env.DB is unavailable, and deliberately mirrors LIVE partners
    // only. A KEY_MAP entry pointing at a partner that's seeded but still 'pending' (e.g. N1's
    // Tiqets/GoCity/QEEQ/Welcome Pickups, awaiting real tracking links -- see
    // migrations/0009_complete_trip_partners.sql) is intentional and correct: matching starts
    // working the moment that row flips to 'live', with no frontend change needed. So this check
    // now accepts a slug that exists in AWAY_MODE_PARTNERS *or* anywhere in the migrations'
    // seeded `partners` rows (pending or live) -- it should still fail on a genuinely typo'd or
    // nonexistent slug, just not on a real, intentionally-pending one.
    const migrationsDir = path.resolve(process.cwd(), 'migrations');
    const migrationSlugs = [];
    for (const file of fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'))) {
      const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      const valuesMatch = content.match(/INSERT INTO partners.*?VALUES\s*([\s\S]*?);/s);
      if (!valuesMatch) continue;
      const rowSlugRegex = /\(\s*'([^']+)'/g;
      let rowMatch;
      while ((rowMatch = rowSlugRegex.exec(valuesMatch[1])) !== null) {
        migrationSlugs.push(rowMatch[1]);
      }
    }

    const knownSlugs = new Set([...emailSlugs, ...migrationSlugs]);

    // Assert that every slug in KEY_MAP is a real partner -- live (AWAY_MODE_PARTNERS) or
    // pending-but-seeded (a migration row), never a slug that exists nowhere at all.
    for (const slug of slugs) {
      assert.ok(knownSlugs.has(slug), `Slug '${slug}' in away-mode.html KEY_MAP does not exist in AWAY_MODE_PARTNERS or any migration's seeded partners`);
    }
  });

  it('ensures every partner in AWAY_MODE_PARTNERS (src/email.js) has a non-empty blurb', async () => {
    const emailJsPath = path.resolve(process.cwd(), 'src/email.js');
    const emailJs = fs.readFileSync(emailJsPath, 'utf8');
    const arrayMatch = emailJs.match(/const AWAY_MODE_PARTNERS = \[([\s\S]*?)\n\];/);
    assert.ok(arrayMatch, 'Could not find AWAY_MODE_PARTNERS array in src/email.js');

    const objectRegex = /\{\s*slug:\s*'([^']+)'[\s\S]*?\}/g;
    let match;
    let checked = 0;
    while ((match = objectRegex.exec(arrayMatch[1])) !== null) {
      const objText = match[0];
      const slug = match[1];
      const blurbMatch = objText.match(/blurb:\s*'((?:[^'\\]|\\.)*)'/);
      assert.ok(blurbMatch, `Partner '${slug}' in AWAY_MODE_PARTNERS has no blurb field`);
      assert.ok(blurbMatch[1].trim().length > 0, `Partner '${slug}' in AWAY_MODE_PARTNERS has an empty blurb`);
      checked++;
    }
    assert.ok(checked >= 10, `Expected to check at least 10 partners, only found ${checked} -- the parser likely broke on a formatting change`);
  });

  it('ensures every live partner in the D1 partners table (after all migrations replay) has a non-empty commission_note/blurb', async () => {
    // Real bug this catches: 0011_clean_partner_commission_notes.sql zeroed out commission_note
    // for the only two rows that ever had one, and nothing re-populated it -- meaning
    // GET /api/partners (which away-mode.html and the /flight/* route pages both actually read
    // in production, per getAwayModePartners()'s env.DB-first precedence) served an empty blurb
    // for every single live partner, while AWAY_MODE_PARTNERS' good copy sat unreachable in the
    // offline-fallback-only code path. This replays every migration in order and checks the
    // FINAL state, which a single-file scan can't catch.
    const finalState = computeFinalPartnersState();
    const liveSlugs = Object.entries(finalState)
      .filter(([, v]) => v.status === 'live')
      .map(([slug]) => slug);

    assert.ok(liveSlugs.length >= 10, `Expected at least 10 live partners, found ${liveSlugs.length} -- migration replay may be broken`);

    for (const slug of liveSlugs) {
      const note = finalState[slug].commission_note;
      assert.ok(note && note.trim().length > 0,
        `Live partner '${slug}' has an empty commission_note/blurb after replaying all migrations -- ` +
        `GET /api/partners will serve this partner with no blurb text in production`);
    }
  });

  it('ensures away-mode-checklist.html (blog) lists every live partner with a non-empty blurb', async () => {
    const finalState = computeFinalPartnersState();
    const liveNames = new Set(
      Object.entries(finalState)
        .filter(([, v]) => v.status === 'live')
        .map(([slug]) => slug)
    );

    const emailJsPath = path.resolve(process.cwd(), 'src/email.js');
    const emailJs = fs.readFileSync(emailJsPath, 'utf8');
    const nameBySlug = {};
    const objectRegex = /\{\s*slug:\s*'([^']+)'[\s\S]*?name:\s*'([^']+)'/g;
    let m;
    while ((m = objectRegex.exec(emailJs)) !== null) {
      nameBySlug[m[1]] = m[2];
    }

    const blogPath = path.resolve(process.cwd(), 'blog/away-mode-checklist.html');
    const blogHtml = fs.readFileSync(blogPath, 'utf8');

    for (const slug of liveNames) {
      const name = nameBySlug[slug];
      if (!name) continue; // not in the offline array (e.g. never had a fallback entry) -- skip
      const nameBlock = new RegExp(
        `<p class="partner-name">${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</p>\\s*` +
        `<p class="partner-blurb">([^<]+)</p>`
      );
      const found = blogHtml.match(nameBlock);
      assert.ok(found, `blog/away-mode-checklist.html is missing a partner card for live partner '${name}' (${slug})`);
      assert.ok(found[1].trim().length > 0, `blog/away-mode-checklist.html's '${name}' card has an empty blurb`);
    }
  });

  it('ensures disclosure.html names every live partner', async () => {
    const finalState = computeFinalPartnersState();
    const emailJsPath = path.resolve(process.cwd(), 'src/email.js');
    const emailJs = fs.readFileSync(emailJsPath, 'utf8');
    const nameBySlug = {};
    const objectRegex = /\{\s*slug:\s*'([^']+)'[\s\S]*?name:\s*'([^']+)'/g;
    let m;
    while ((m = objectRegex.exec(emailJs)) !== null) {
      nameBySlug[m[1]] = m[2];
    }

    const disclosurePath = path.resolve(process.cwd(), 'disclosure.html');
    const disclosureHtml = fs.readFileSync(disclosurePath, 'utf8');

    for (const [slug, v] of Object.entries(finalState)) {
      if (v.status !== 'live') continue;
      const name = nameBySlug[slug];
      if (!name) continue;
      assert.ok(disclosureHtml.includes(name), `disclosure.html's affiliate-relationships list is missing live partner '${name}' (${slug})`);
    }
  });
});
