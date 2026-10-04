// Badges must state the basis the ranking pipeline recorded (basis_text, median-based),
// never a percentage recomputed in the browser from pct_below_avg (mean-based).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('no rendered percentage is computed from pct_below_avg', () => {
  // Only the best-deal sort comparator and comments may reference it.
  const offenders = html.split('\n').filter(l => l.includes('pct_below_avg')
    && !l.includes('-Infinity') && !/^\s*\/\//.test(l));
  assert.deepEqual(offenders, [], 'render basis_text instead of pct_below_avg');
});

test('no unqualified "below avg" or "below the 30-day average" copy', () => {
  assert.doesNotMatch(html, /% below avg/);
  assert.doesNotMatch(html, /below the 30-day average/);
});

test('hero label and cards render basis_text', () => {
  assert.match(html, /Today's sharpest deal — \$\{topPick\.basis_text\}/);
  assert.match(html, /item\.status === 'deal' && item\.basis_text/);
});

test('every deal in the real ranked data has basis_text', () => {
  for (const f of ['sparkfare_ranked_deals.json', 'sparkfare_ranked_deals_other_origins.json']) {
    const d = JSON.parse(readFileSync(new URL('../' + f, import.meta.url), 'utf8'));
    const rows = Array.isArray(d) ? d : Object.values(d).flat().filter(x => x && typeof x === 'object');
    for (const r of rows) if (r.status === 'deal') assert.ok(r.basis_text, `${f}: ${r.display_name} lacks basis_text`);
  }
});
