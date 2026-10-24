// N6 (Addendum N): `assets.directory` is the whole repo root, so any tracked file not matched by .assetsignore is served
// at sparkfare.com/<path>. Raw fares, full price histories and snapshots were public until this change. This test makes a
// new deployable data file an explicit decision: it must be added to scripts/public-assets.json with a reason.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const rules = fs.readFileSync(new URL('../.assetsignore', import.meta.url), 'utf8')
  .split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));

// gitignore-style, enough for this file: "dir/", "*" globs, and bare names that match at any depth.
function toRegex(glob) {
  const esc = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*');
  return new RegExp(`(^|/)${esc}(/|$)`);
}
const matchers = rules.map((r) => toRegex(r.replace(/\/$/, '')));
const ignored = (p) => matchers.some((m) => m.test(p));

const tracked = execSync('git ls-files -z', { encoding: 'utf8', maxBuffer: 1 << 26 }).split('\0').filter(Boolean);
// tests/ and src/ are ignored by .assetsignore already; the check covers whatever is deployable.
const deployableJson = tracked.filter((p) => /\.jsonc?$/.test(p) && !ignored(p)).sort();
const allow = JSON.parse(fs.readFileSync(new URL('../scripts/public-assets.json', import.meta.url), 'utf8')).files;

test('every deployable JSON file is on the public allowlist', () => {
  const unlisted = deployableJson.filter((p) => !(p in allow));
  assert.deepEqual(unlisted, [], `deployable but not in scripts/public-assets.json: ${unlisted.join(', ')}`);
});

test('every allowlist entry exists, is deployable and has a reason', () => {
  for (const [p, reason] of Object.entries(allow)) {
    assert.ok(tracked.includes(p), `${p} is on the allowlist but is not a tracked file`);
    assert.ok(!ignored(p), `${p} is on the allowlist but .assetsignore blocks it`);
    assert.ok(typeof reason === 'string' && reason.length > 10, `${p} needs a reason`);
  }
});

test('raw fares, histories and snapshots are not deployable', () => {
  const must = tracked.filter((p) =>
    /^sparkfare_hourly_snapshots\//.test(p)
    || /^sparkfare_(hourly_)?price_history/.test(p)
    || /^sparkfare_(hourly_)?flight_prices/.test(p)
    || /^dummy_.*\.json$/.test(p)
    || p === 'sparkfare_seo_cache.json' || p === 'sparkfare_broadcast_history.json');
  assert.ok(must.length > 100, 'expected the snapshot folder and history files to be tracked');
  const exposed = must.filter((p) => !ignored(p));
  assert.deepEqual(exposed.slice(0, 5), [], `${exposed.length} raw files would be public`);
});

test('the matcher itself: blocks the snapshot path with a plus sign, keeps public files', () => {
  assert.ok(ignored('sparkfare_hourly_snapshots/flight_prices_2026-09-06T180853.396844+0000.json'));
  assert.ok(ignored('dummy_ranked_other.json'));
  assert.ok(!ignored('sparkfare_ranked_deals.json'));
  assert.ok(!ignored('content/destination_lines.json'));
});

test('files the site actually reads are still public (a pattern must not swallow them)', () => {
  for (const p of ['sparkfare_ranked_deals.json', 'sparkfare_ranked_deals_other_origins.json', 'sparkfare_hourly_ranked_deals.json',
    'sparkfare_pto_window_prices.json', 'sparkfare_destinations.json', 'sparkfare_images.json', 'content/destination_lines.json']) {
    assert.ok(!ignored(p), `${p} must stay deployable`);
  }
});
