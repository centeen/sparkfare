// N10: the record-level shadow diff (scripts/data/shadow_diff.py --records-out / --records-json). Run through a real interpreter (skipped if none is installed).
// Builds a served file and a shadow file by hand so every number in the report is known, then checks the report names the right routes and the deal-rule check.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PY = ['python3', 'python'].find((p) => spawnSync(p, ['--version']).status === 0);
const skip = PY ? false : 'no python interpreter';

const days = (n, price = 200) => Array.from({ length: n }, (_, i) => ({ date: new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10), price }));
const rec = (route, status, price, extra = {}) => ({ route_key: `JFK:${route}`, display_name: route, origin: 'JFK', status, price, median_baseline: 400, observations: days(20), history_points: 20, ...extra });
const file = (o) => ({ deals: [], featured: [], priced_no_deal: [], insufficient_history: [], no_data: [], ...o });

function run(served, shadow, extra = []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sd-'));
  const w = (n, d) => { fs.writeFileSync(path.join(dir, n), JSON.stringify(d)); return path.join(dir, n); };
  const r = spawnSync(PY, ['scripts/data/shadow_diff.py', '--pair', 'p', w('shadow.json', shadow), w('served.json', served), '--date', '2026-10-29', '--out', path.join(dir, 'c.md'),
    '--records-out', path.join(dir, 'r.md'), '--records-json', path.join(dir, 'r.json'), ...extra], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return { md: fs.readFileSync(path.join(dir, 'r.md'), 'utf8'), json: JSON.parse(fs.readFileSync(path.join(dir, 'r.json'), 'utf8')).files.p, counts: fs.readFileSync(path.join(dir, 'c.md'), 'utf8') };
}

test('a route that becomes a deal in the shadow is listed with both sides and passes the rule check when it clears 15% and 10 days', { skip }, () => {
  const served = file({ priced_no_deal: [rec('Lisbon', 'priced_no_deal', 380)] });
  const shadow = file({ deals: [rec('Lisbon', 'deal', 300)] }); // 25% below 400
  const { json, md } = run(served, shadow);
  assert.equal(json.changes.length, 1);
  assert.equal(json.changes[0].transition, 'priced_no_deal -> deal');
  assert.equal(json.changes[0].served.price, 380);
  assert.equal(json.changes[0].shadow.pct_below_median, 25);
  assert.deepEqual(json.changes[0].shadow_rule_failures, []);
  assert.equal(json.summary.new_deals_in_shadow, 1);
  assert.equal(json.summary.new_deals_breaking_rules, 0);
  assert.match(md, /JFK:Lisbon/);
  assert.match(md, /holds/);
});

test('a shadow deal under 15% below, with too few days, or carried forward is flagged as breaking the rules', { skip }, () => {
  const served = file({
    priced_no_deal: [rec('Thin', 'priced_no_deal', 390), rec('Short', 'priced_no_deal', 300), rec('Stale', 'priced_no_deal', 300)],
  });
  const shadow = file({
    deals: [
      rec('Thin', 'deal', 380),                                            // 5% below
      rec('Short', 'deal', 300, { observations: days(6) }),                // 6 days
      rec('Stale', 'deal', 300, { is_stale_fallback: true }),              // carried forward
    ],
  });
  const { json, md } = run(served, shadow);
  const by = Object.fromEntries(json.changes.map((c) => [c.route, c.shadow_rule_failures]));
  assert.match(by['JFK:Thin'].join(), /only 5\.0% below/);
  assert.match(by['JFK:Short'].join(), /6 distinct days/);
  assert.match(by['JFK:Short'].join(), /span 5 days/);
  assert.match(by['JFK:Stale'].join(), /carried-forward/);
  assert.equal(json.summary.new_deals_breaking_rules, 3);
  assert.match(md, /BREAKS RULES/);
});

test('a repeated date counts once, as the ranking script counts it', { skip }, () => {
  const dup = [...days(9), ...days(9)]; // 18 entries, 9 distinct days
  const shadow = file({ deals: [rec('Dup', 'deal', 300, { observations: dup })] });
  const { json } = run(file({ priced_no_deal: [rec('Dup', 'priced_no_deal', 390)] }), shadow);
  assert.equal(json.changes[0].shadow.distinct_days, 9);
  assert.match(json.changes[0].shadow_rule_failures.join(), /9 distinct days/);
});

test('same verdict with a different price is a price difference, not a verdict change; identical files are empty', { skip }, () => {
  const a = file({ priced_no_deal: [rec('Rome', 'priced_no_deal', 380)] });
  const b = file({ priced_no_deal: [rec('Rome', 'priced_no_deal', 390)] });
  const diff = run(a, b).json;
  assert.equal(diff.changes.length, 0);
  assert.equal(diff.price_diffs.length, 1);
  assert.equal(diff.price_diffs[0].shadow.price, 390);
  const same = run(a, a).json;
  assert.deepEqual(same.summary, { verdict_changes: 0, price_diffs: 0, new_deals_in_shadow: 0, new_deals_breaking_rules: 0, shadow_deals_breaking_rules: 0 });
});

test('a shadow deal that was already a deal and breaks the rules is still reported (not only changes)', { skip }, () => {
  const served = file({ deals: [rec('Old', 'deal', 380)] });
  const shadow = file({ deals: [rec('Old', 'deal', 380)] });
  const { json, md } = run(served, shadow);
  assert.equal(json.changes.length, 0);
  assert.equal(json.rule_failures.length, 1);
  assert.match(md, /not verdict changes/);
});

test('the counts-only summary is unchanged by the new flags', { skip }, () => {
  const { counts } = run(file({ priced_no_deal: [rec('A', 'priced_no_deal', 380)] }), file({ deals: [rec('A', 'deal', 300)] }));
  assert.match(counts, /Counts only/);
  assert.doesNotMatch(counts, /JFK:A|\$300/); // no routes or prices in the committed summary
});
