import { describe, it } from 'node:test';
import assert from 'assert';
import fs from 'fs';
import path from 'path';

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
});
