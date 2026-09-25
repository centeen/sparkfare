import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

// Coby asked to remove specific visible text from the Away Mode list: "10% recurring on
// subscriptions" from SafetyWing, and "Awin" from Timekettle. partners.commission_note is what
// GET /api/partners aliases as `blurb`, and that's exactly what away-mode.html renders under each
// partner's name -- so this is a real content fix, not internal bookkeeping.
test('migration 0011 clears SafetyWing and Timekettle commission_note to empty', async () => {
  const sqlPath = path.resolve(process.cwd(), 'migrations/0011_clean_partner_commission_notes.sql');
  const content = fs.readFileSync(sqlPath, 'utf8');

  assert.match(content, /UPDATE partners SET commission_note = ''[^;]*WHERE slug = 'safetywing'/);
  assert.match(content, /UPDATE partners SET commission_note = ''[^;]*WHERE slug = 'timekettle'/);

  // Guard against a future edit accidentally re-adding the removed text as a value elsewhere in
  // this same migration file.
  assert.ok(!content.includes('10% recurring on subscriptions'));
  assert.ok(!/'Awin'/.test(content));
});
