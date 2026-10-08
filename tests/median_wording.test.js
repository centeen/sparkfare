// Every deal claim Sparkfare makes is measured against the route's 30-day MEDIAN, and says so. Before
// 2026-10-08 the /data/ pages, the social post and card, the Sparkfare Index page and the
// route-retrospective email still said "average" and used a different, mean-based percentage, so the
// same route showed two different numbers (32 of 36 live deals differed). See
// sparkfare_ranking_methodology.md, "Which number is shown, everywhere".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');

// Customer-facing sources: Worker, emails, the homepage, and every script that writes public text.
const SOURCES = [
  'src/index.js', 'src/email.js', 'src/emailTemplates/dailyDigest.js', 'src/emailTemplates/helpers.js',
  'index.html',
  'Phase 17 pSEO Generator (Step 106).py', 'Phase 3 Social Broadcaster.py',
  'Phase 19 Newsletter Generator.py',
  // 'Phase 20 Blog Generator.py' and blog/*.html join this list in the blog-wording change.
];
const BANNED = /30-day (average|avg)|below (its|the|their) (own )?30-day average|below avg\b|% below average|BELOW AVERAGE|trailing average|Above avg|vs\. 30-Day Average|Below 30-Day Average/i;

function isComment(line) {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('#') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('<!--');
}

test('no customer-facing source states a deal or comparison against an "average"', () => {
  const offenders = [];
  for (const f of SOURCES) {
    read(f).split('\n').forEach((line, i) => {
      if (!isComment(line) && BANNED.test(line)) offenders.push(`${f}:${i + 1}: ${line.trim().slice(0, 110)}`);
    });
  }
  assert.deepEqual(offenders, []);
});

test('the Sparkfare Index page compares with the median and labels it so', () => {
  const src = read('src/index.js');
  assert.match(src, /<th>30-day median<\/th><th>Above median<\/th>/);
  assert.match(src, /median_baseline/);
});

test('the route-retrospective email says "median"', () => {
  const src = read('src/email.js');
  assert.match(src, /below today's 30-day median of/);
  assert.match(src, /Today's 30-day median for that route is/);
});

test('the homepage "best deal" order and hero use the median, not the mean-based pct_below_avg', () => {
  const home = read('index.html');
  const best = home.match(/best: \(a, b\) => \{[\s\S]*?\n  \},/);
  assert.ok(best, 'best comparator found');
  assert.ok(best[0].includes('pctBelowMedian'));
  assert.ok(!best[0].includes('pct_below_avg'));
  assert.ok(home.includes('(r.median_baseline - r.price) / r.median_baseline'));
});

// Behaviour of the pSEO page text, run against the real Python function (skipped if python is missing).
const py = (() => {
  for (const c of ['python', 'python3']) {
    try { execFileSync(c, ['--version'], { stdio: 'ignore' }); return c; } catch { /* try next */ }
  }
  return null;
})();

function render(record) {
  const code = `
import importlib.util, json, sys
spec = importlib.util.spec_from_file_location('pseo', 'Phase 17 pSEO Generator (Step 106).py')
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
h1, body, meta = m.build_h1_and_body('JFK', 'Madrid, Spain', json.loads(sys.argv[1]))
print(json.dumps({'h1': h1, 'body': body, 'meta': meta}))`;
  return JSON.parse(execFileSync(py, ['-c', code, JSON.stringify(record)], { cwd: root, encoding: 'utf8' }));
}

const deal = {
  status: 'deal', price: 296, median_baseline: 396, trailing_avg: 375, pct_below_avg: 0.2105,
  basis_text: '25% below 30-day median, 31 observations',
};

test('pSEO deal page: headline and body use the stated median figure, not the mean-based one',
  { skip: !py && 'python not available' }, () => {
    const r = render(deal);
    assert.match(r.h1, /25% Below 30-Day Median/);
    assert.match(r.body, /25% below the 30-day median of \$396/);
    assert.match(r.meta, /25% below the 30-day median of \$396/);
    for (const text of [r.h1, r.body, r.meta]) {
      assert.doesNotMatch(text, /average|21%|\$375/i);
    }
  });

test('pSEO page without a deal compares the price with the median',
  { skip: !py && 'python not available' }, () => {
    const r = render({ ...deal, status: 'priced_no_deal', price: 410, basis_text: '-4% below 30-day median, 31 observations' });
    assert.match(r.h1, /Current Price vs\. 30-Day Median/);
    assert.match(r.body, /30-day median for this route \(the middle price\) is \$396/);
    assert.doesNotMatch(r.h1 + r.body + r.meta, /average/i);
  });

test('pSEO page falls back to the formula when basis_text is missing, and never to the mean',
  { skip: !py && 'python not available' }, () => {
    const r = render({ ...deal, basis_text: '' });
    assert.match(r.h1, /25% Below 30-Day Median/); // (396 - 296) / 396 = 25%, from median_baseline
  });

test('pSEO priced record with no usable median says so instead of using the Cluster-4 wording',
  { skip: !py && 'python not available' }, () => {
    const r = render({ status: 'priced_no_deal', price: 410, trailing_avg: 400, basis_text: '' });
    assert.match(r.body, /We don't have enough price history/);
    assert.doesNotMatch(r.body, /doesn't get judged|average/i);
  });

test('pSEO featured (Cluster 4) page refers to a baseline, not an average',
  { skip: !py && 'python not available' }, () => {
    const r = render({ status: 'featured', price: 193 });
    assert.match(r.body, /doesn't get judged against a 30-day baseline/);
    assert.doesNotMatch(r.body, /average/i);
  });

test('homepage "best deal" order: the deal furthest below its median is first, whatever the mean-based figure says', () => {
  const home = read('index.html');
  const start = home.indexOf('function pctBelowMedian');
  const endMarker = '  alpha: (a, b) => a.display_name.localeCompare(b.display_name),\n};';
  const end = home.indexOf(endMarker, start) + endMarker.length;
  assert.ok(start !== -1 && end > start, 'comparator source found');
  const { SORT_COMPARATORS } = new Function(home.slice(start, end).replace('const SORT_COMPARATORS', 'var SORT_COMPARATORS') + '; return { SORT_COMPARATORS };')();
  const deals = [
    { display_name: 'A', price: 380, median_baseline: 400, pct_below_avg: 0.40 }, //  5% below median, big mean figure
    { display_name: 'B', price: 300, median_baseline: 400, pct_below_avg: 0.01 }, // 25% below median, tiny mean figure
    { display_name: 'C', price: 350, median_baseline: 400, pct_below_avg: 0.20 }, // 12.5% below median
    { display_name: 'D', price: 100 },                                            // no median: last, never NaN
  ];
  const order = [...deals].sort(SORT_COMPARATORS.best).map((d) => d.display_name);
  assert.deepEqual(order, ['B', 'C', 'A', 'D']);
});
