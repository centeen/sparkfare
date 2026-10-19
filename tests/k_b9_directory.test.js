// K-B9 (ROADMAP step 133, scan D-1 and B-1): /data/ is a route finder (an origin filter, one row per route with a chip and the latest price, deals first)
// and the destination guides are titled for the trip length they actually need, set in a 68-character measure at 17 px. Stacked on K-B3, whose
// fare-state and chip helpers the rows use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const index = read('data/index.html');
const GEN = 'Phase 17 pSEO Generator (Step 106).py';
const strip = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '');

function pyDriver(body) {
  const code = `
import importlib.util, json
from datetime import datetime, timezone, timedelta
spec = importlib.util.spec_from_file_location('gen', ${JSON.stringify(GEN)})
g = importlib.util.module_from_spec(spec); spec.loader.exec_module(g)
now = datetime(2026, 10, 19, 12, 0, tzinfo=timezone.utc)
iso = lambda d: d.isoformat()
${body}
`;
  for (const bin of ['python3', 'python', 'py']) {
    const r = spawnSync(bin, ['-c', code], { cwd: ROOT, encoding: 'utf8' });
    if (r.status === 0) return JSON.parse(r.stdout.trim().split('\n').pop());
    if (r.error || /not found|Microsoft Store/i.test(r.stderr || '')) continue;
    throw new Error(`${bin} failed: ${r.stderr}`);
  }
  return null;
}
const py = pyDriver('print(json.dumps(1))');

test('the finder has one section per origin and one row per route, each linking an existing route page', () => {
  const sections = [...index.matchAll(/<section class="origin-block" id="([a-z]{3})" data-origin="([A-Z]{3})">([\s\S]*?)<\/section>/g)];
  assert.equal(sections.length, 22);
  let rows = 0;
  for (const [, id, origin, body] of sections) {
    assert.equal(id, origin.toLowerCase());
    const links = [...body.matchAll(/<li class="route-row"><a class="route-link" href="(\/data\/[a-z]{3}-to-[a-z0-9-]+)">/g)];
    assert.equal(links.length, 40, origin);
    rows += links.length;
    for (const [, href] of links) {
      assert.ok(href.startsWith(`/data/${id}-to-`), href);
      assert.ok(fs.existsSync(path.join(ROOT, `${href.slice(1)}.html`)), `${href} has no page`);
    }
  }
  assert.equal(rows, 880);
});

test('every row has exactly one chip and a price that is empty only when the chip says there is no fare', () => {
  for (const [, row] of index.matchAll(/<li class="route-row">([\s\S]*?)<\/li>/g)) {
    assert.equal((row.match(/class="chip chip-/g) || []).length, 1);
    const chip = row.match(/class="chip chip-([a-z]+)">([^<]+)</);
    const price = row.match(/<span class="route-price">([^<]*)<\/span>/)[1];
    if (['No history yet', 'No current fare'].includes(chip[2])) assert.equal(price, '', row);
    else assert.match(price, /^\$[\d,]+$/, row);
    assert.ok(['deal', 'typical', 'building', 'noverdict', 'lastseen', 'nodata'].includes(chip[1]), chip[1]);
  }
});

test('within an origin, deals come first, then priced routes cheapest first, then routes with no fare', () => {
  for (const [, , body] of index.matchAll(/<section class="origin-block" id="([a-z]{3})" data-origin="([A-Z]{3})">([\s\S]*?)<\/section>/g).map((m) => m)) {
    const rows = [...body.matchAll(/class="chip chip-([a-z]+)">[^<]*<\/span><span class="route-price">([^<]*)</g)].map((m) => ({ kind: m[1], price: m[2] ? Number(m[2].replace(/[$,]/g, '')) : null }));
    const rank = (r) => (r.kind === 'deal' ? 0 : r.price === null ? 2 : 1);
    for (let i = 1; i < rows.length; i++) {
      assert.ok(rank(rows[i - 1]) <= rank(rows[i]), 'rank order');
      if (rank(rows[i - 1]) === rank(rows[i]) && rank(rows[i]) < 2) assert.ok(rows[i - 1].price <= rows[i].price, 'price order');
    }
  }
});

test('without JavaScript every origin is on the page; with it the filter shows one (saved airport, else JFK) and remembers the choice', () => {
  assert.match(index, /\.origin-filter \{ display: none; margin: 16px 0 4px; \}/);
  assert.match(index, /\.js \.origin-filter \{ display: block; \}/);
  assert.match(index, /\[hidden\] \{ display: none !important; \}/);
  assert.equal((index.match(/<option value="[A-Z]{3}">/g) || []).length, 22);
  assert.match(index, /document\.documentElement\.classList\.add\('js'\)/);
  assert.match(index, /localStorage\.getItem\('sparkfare_selected_origin'\)/);
  assert.match(index, /localStorage\.setItem\('sparkfare_selected_origin', select\.value\)/);
  assert.match(index, /if \(valid\.indexOf\(start\) < 0\) start = 'JFK';/);
  assert.ok(!/<section[^>]*\shidden/.test(index), 'no section is hidden in the markup');
});

test('page chrome: one H1, one <main>, the shared header, no hex colour, 44 px rows, tabular mono prices', () => {
  const b = strip(index);
  assert.equal((b.match(/<h1[\s>]/g) || []).length, 1);
  assert.equal((b.match(/<main[\s>]/g) || []).length, 1);
  assert.ok(index.includes('class="site-nav sf-nav"'));
  assert.ok(!/(?<=[:\s(,"'])#[0-9a-fA-F]{6}\b/.test(index.replace(/<script[\s\S]*?<\/script>/g, '')));
  assert.match(index, /\.route-link \{ display: flex; align-items: center; min-height: 44px;/);
  assert.match(index, /\.route-price \{ font-family: var\(--font-mono\); font-weight: 500; color: var\(--ink\); text-align: right; font-variant-numeric: tabular-nums; \}/);
  assert.match(index, /Page built [A-Z][a-z]{2} \d+, \d+:\d\d [AP]M UTC\./);
});

test('python: a row says "No history yet" with no price, "No current fare" when a fare has left, and "Last seen" for an old price', { skip: !py }, () => {
  const out = pyDriver(`base = dict(origin='JFK', price=400, status='priced_no_deal', median_baseline=450, found_at=iso(now - timedelta(hours=2)), departure_at=iso(now + timedelta(days=30)))
rows = [
  g.listing_row('JFK', 'A, X', 'a-x', dict(base, status='deal'), now),
  g.listing_row('JFK', 'B, X', 'b-x', base, now),
  g.listing_row('JFK', 'C, X', 'c-x', None, now),
  g.listing_row('JFK', 'D, X', 'd-x', dict(base, departure_at=iso(now - timedelta(days=1))), now),
  g.listing_row('JFK', 'E, X', 'e-x', dict(base, is_stale_fallback=True, last_fresh_date=(now - timedelta(days=5)).date().isoformat()), now),
]
print(json.dumps([[r['chip'], r['price'], r['rank']] for r in rows]))`);
  assert.deepEqual(out, [
    [['deal', 'Deal'], '$400', 0],
    [['typical', 'Typical'], '$400', 1],
    [['building', 'No history yet'], '', 2],
    [['nodata', 'No current fare'], '', 2],
    [['lastseen', 'Last seen Oct 14'], '$400', 1],
  ]);
});

// ---- the blog ----
const fit = JSON.parse(read('content/pto_destination_fit.json')).fit;
const dests = JSON.parse(read('sparkfare_destinations.json'));
const slugify = (t) => t.toLowerCase().replace(/[/&(),]/g, ' ').replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');

test('a destination guide never calls a trip a weekend when the planner says it needs more days off; the number is the planner\'s', () => {
  let retitled = 0;
  for (const [name, d] of Object.entries(dests)) {
    if (d.group !== 'low_cost_carrier') continue;
    const h = read(`blog/${slugify(name)}.html`);
    const title = h.match(/<title>([^<]*)<\/title>/)[1];
    const h1 = h.match(/<h1>([^<]*)<\/h1>/)[1];
    if (fit[name] > 3) {
      assert.match(title, new RegExp(`: A trip that wants ${fit[name]}\\+ days off$`), name);
      assert.match(h1, new RegExp(`: a trip that wants ${fit[name]}\\+ days off$`), name);
      assert.ok(!/weekend/i.test(title + h1 + h.match(/og:title" content="([^"]*)"/)[1]), name);
      retitled++;
    } else {
      assert.match(title, /A weekend sprint within reach$/, name);
    }
  }
  assert.equal(retitled, 7);
});

test('every post carries the measure rule once: plain paragraphs and list items at 17 px (var(--text-md)) capped at 68ch (var(--measure))', () => {
  const files = fs.readdirSync(path.join(ROOT, 'blog')).filter((f) => f.endsWith('.html'));
  assert.ok(files.length >= 73);
  for (const f of files) {
    const h = read(`blog/${f}`);
    assert.equal((h.match(/\.card p:not\(\[class\]\), \.card li:not\(\[class\]\) \{ font-size: var\(--text-md\); max-width: var\(--measure\); \}/g) || []).length, 1, f);
    assert.equal((h.match(/\.card h1, \.card h2 \{ max-width: var\(--measure\); \}/g) || []).length, 1, f);
  }
  const tokens = read('brand/tokens.css');
  assert.match(tokens, /--text-md: 17px;/);
  assert.match(tokens, /--measure: 68ch;/);
});

test('the blog generator carries the same rule and the trip-length subtitle, so a regeneration cannot undo either', () => {
  const g = read('Phase 20 Blog Generator.py');
  assert.ok(g.includes('.card p:not([class]), .card li:not([class]) {{ font-size: var(--text-md); max-width: var(--measure); }}'));
  assert.ok(g.includes('.card h1, .card h2 {{ max-width: var(--measure); }}'));
  assert.ok(g.includes('subtitle = f"a trip that wants {days}+ days off" if days and days > 3 else "a weekend sprint within reach"'));
  assert.ok(g.includes("'content', 'pto_destination_fit.json'"));
});
