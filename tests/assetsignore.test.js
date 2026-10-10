// `assets.directory` in wrangler.jsonc is the whole repo root, so anything tracked and not matched by .assetsignore is
// served at sparkfare.com/<path>. Two history backups (*.json.bak) were public until 2026-10-10. This pins the
// categories that must never be public so a new backup, SQL file or secret template cannot slip through unnoticed.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const rules = fs.readFileSync(new URL('../.assetsignore', import.meta.url), 'utf8')
  .split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));

// A small matcher for the patterns this file actually uses: "dir/", "*.ext", "name".
function ignored(path) {
  return rules.some((r) => {
    if (r.endsWith('/')) return path === r.slice(0, -1) || path.startsWith(r);
    if (r.startsWith('*.')) return path.endsWith(r.slice(1));
    return path === r || path.endsWith('/' + r);
  });
}

test('backup files are ignored', () => {
  assert.ok(rules.includes('*.bak'), '*.bak must be listed in .assetsignore');
  assert.ok(ignored('sparkfare_hourly_price_history.json.bak'));
});

test('no tracked backup, SQL, markdown, CSV or Python file would be served', () => {
  const tracked = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean);
  const exposed = tracked.filter((p) => /\.(bak|sql|md|csv|py|log)$/.test(p) && !ignored(p));
  assert.deepEqual(exposed.slice(0, 10), [], `${exposed.length} sensitive-type files would be public`);
});
