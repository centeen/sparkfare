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

    // Assert that every slug in KEY_MAP exists in AWAY_MODE_PARTNERS
    for (const slug of slugs) {
      assert.ok(emailSlugs.includes(slug), `Slug '${slug}' in away-mode.html KEY_MAP is missing from AWAY_MODE_PARTNERS`);
    }
  });
});
