// Guard read 2026-11-01 ~20:30, PR A: hooks and filter, water post, partner-selection post, clusters page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const idxRe = new Function(`return ${read('../index.html').match(/const BARRED_COPY = (\/.*\/i);/)[1]}`)();
const genRe = new RegExp(read('../Phase 20 Blog Generator.py').match(/^BARRED_COPY = re\.compile\(r"(.*)", re\.I\)$/m)[1], 'i');

test('hooks: Rio keeps only its descriptive sentence; the prediction, comparison and instruction are gone everywhere', () => {
  const post = read('../blog/rio-de-janeiro-brazil.html');
  assert.ok(post.includes('<p>World-class beaches, iconic peaks, and vibrant street culture. Like every priced route'));
  assert.ok(!/crater|fraction of|Move decisively|softens/i.test(post));
  assert.ok(!/crater|fraction of/i.test(read('../blog/index.html')));
  for (const p of ['larnaca-cyprus', 'bogota-colombia']) assert.ok(!/prices collapse|collapse regional|collapse regional pricing/i.test(read(`../blog/${p}.html`)), p);
});

test('the filter (generator and homepage, in step) and the checker catch the prediction and urgency family', () => {
  for (const s of ['fares crater when demand softens', 'prices plummet', 'April prices collapse', 'collapse regional pricing', 'Move decisively', "don't wait", 'at a fraction of peak-season costs', 'fraction-of-season pricing', 'your window closes fast', 'rates reset']) {
    assert.ok(idxRe.test(s), 'index.html: ' + s);
    assert.ok(genRe.test(s), 'generator: ' + s);
  }
  for (const ok of ['Baku collapses centuries into a single skyline', 'World-class beaches, iconic peaks, and vibrant street culture.']) {
    assert.ok(!idxRe.test(ok) && !genRe.test(ok), ok);
  }
  assert.ok(read('../scripts/check-referral-copy.js').includes('crater|plummet|prices? collapse|softens?|move decisively|don.t wait|fraction[- ]of|pricing windows?'));
  for (const s of ['Rare pricing windows make this journey', 'surprisingly accessible']) {
    assert.ok(idxRe.test(s) && genRe.test(s), s);
  }
});

test('water post: attribution, figures, title and the efficacy sentence', () => {
  const t = read('../blog/water-not-burglars.html');
  assert.ok(t.includes('<title>Water and an empty home: what to check before you go</title>'));
  assert.ok(!/what actually damages|The numbers point at water|8\.1%|more than any gadget|come from a poll run by PEMCO/.test(t));
  assert.ok(t.includes('burglary down 8.6% in 2024') && t.includes('August 5, 2025') && !/779,542/.test(t) && t.includes('does not name a source for them') && t.includes('24% correctly named') && t.includes('57% rely on'));
  assert.ok(t.includes('PEMCO surveys of Pacific Northwest residents') && t.includes('as reported by CBS News, August 5, 2025') && t.includes('cbsnews.com/news/fbi-crime-report-2025'));
  assert.ok(!/one insurer's view and a trade article's report|PEMCO poll/.test(t));
  const meta = t.match(/name="description" content="([^"]*)"/)[1];
  assert.equal(t.match(/og:description" content="([^"]*)"/)[1], meta);
  assert.ok(read('../blog/index.html').includes('>Water and an empty home: what to check before you go</a>'));
});

test('partner-selection post: no medical-coverage example, no hard count, no regulatory label, a disclosure line that matches the page', () => {
  const t = read('../blog/how-we-pick-away-mode-partners.html');
  assert.ok(!/medical coverage|Thirteen|FTC-style|actually trust|every partner link on every page|through the links below/i.test(t));
  assert.ok(t.includes('partner links on Away Mode, at no extra cost to you'));
  assert.ok(t.includes('On Away Mode, every partner link appears after our disclosure, not before.') && t.includes('<h2>Disclosure comes first</h2>'));
  assert.ok(!/in our emails, every partner link|earlier version of our daily email/.test(t));
});

test('clusters page states the deployed rule and drops the unsourced pattern claims', () => {
  const t = read('../blog/destination-clusters-explained.html');
  assert.ok(t.includes('at least 15% below the route') && t.includes('at least two median absolute deviations below it'));
  assert.ok(t.includes('clears both the 15% floor and the two-deviation bar'));
  assert.ok(!/more than twice its usual|real cliff|real fare arbitrage|falls well below the route/.test(t));
});

test('Sydney: the price/scarcity sentence is gone from the post and its index card; the clusters heading no longer claims a pattern', () => {
  assert.ok(!/Rare pricing windows|surprisingly accessible|rare window/i.test(read('../blog/sydney-australia.html') + read('../blog/index.html')));
  assert.ok(read('../blog/sydney-australia.html').includes("Sydney's opera-house skyline meets world-class beaches and culinary innovation. Like every priced route"));
  const c = read('../blog/destination-clusters-explained.html');
  assert.ok(c.includes('<h2>Shoulder-season routes</h2>') && !/big shoulder-season drop/.test(c));
});

// ---- Guard read ~21:30: hook rule, seven hooks, index cards, Building-history numbers ----
const HOOK_RE = new RegExp(read('../Phase 20 Blog Generator.py').match(/^HOOK_BLOCK = re\.compile\(r"(.*)", re\.I\)$/m)[1], 'i');
const destPosts = fs.readdirSync(new URL('../blog/', import.meta.url)).filter((f) => f.endsWith('.html')
  && /earns a deal badge only when|never badges it as a deal/.test(read('../blog/' + f)));

test('hook rule: every destination post opens with at most one hook sentence that passes it', () => {
  assert.equal(destPosts.length, 40);
  let hooks = 0;
  for (const f of destPosts) {
    const t = read('../blog/' + f);
    const p = t.match(/<p>([^<]*?)(?:Like every priced route|Sparkfare shows)/)[1].trim();
    if (!p) continue;
    hooks += 1;
    assert.equal(p.split(/(?<=[.!?])\s+/).length, 1, f + ': ' + p);
    assert.ok(!HOOK_RE.test(p), f + ': ' + p);
  }
  assert.ok(hooks >= 8 && hooks <= 20, 'hooks left: ' + hooks);
});

test('the seven hooks the Guard failed read as the Guard wrote them (or are gone)', () => {
  const opener = (slug) => read('../blog/' + slug + '.html').match(/<p>([^<]*?)(?:Like every priced route|Sparkfare shows)/)[1].trim();
  assert.equal(opener('antigua-guatemala'), 'Colonial cobblestones, volcanic vistas, and authentic indigenous markets.');
  assert.equal(opener('athens-greece'), 'Athenian antiquity meets Mediterranean coast.');
  assert.equal(opener('cappadocia-turkey'), 'Otherworldly rock formations, world-class hospitality, and gourmet dining.');
  assert.equal(opener('thessaloniki-greece'), 'Thessaloniki delivers Byzantine heritage, Aegean seafood, and Balkan culture.');
  assert.ok(opener('baku-azerbaijan').startsWith('Baku collapses centuries into a single skyline') && !/less than/.test(opener('baku-azerbaijan')));
  assert.equal(opener('krakow-poland'), 'Medieval Old Town meets cutting-edge craft scene.');
  assert.ok(opener('cusco-peru').startsWith('Fifteenth-century Incan stone walls') && !/prices that make/.test(read('../blog/cusco-peru.html')));
});

test('index: every destination card title is the post\'s own title; no "what it costs" or price-comparison card remains', () => {
  const idx = read('../blog/index.html');
  for (const f of destPosts) {
    const slug = f.replace('.html', '');
    const title = read('../blog/' + f).match(/<title>([^<]*)<\/title>/)[1];
    assert.ok(idx.includes('href="/blog/' + slug + '">' + title + '</a>'), slug);
  }
  assert.ok(!/what it costs on the ground|when to actually go|genuinely rare dip|fraction-of|price tier|premium|markup|priced for real/i.test(idx));
});

test('Building history says 10 distinct days across 14 everywhere, and the water post drops the count it could not source', () => {
  for (const f of ['../blog/index.html', '../blog/building-history-explained.html']) assert.ok(!/7 real days/.test(read(f)), f);
  assert.ok(read('../blog/building-history-explained.html').includes('10 distinct days of price data across at least 14 days'));
  assert.ok(!/779,542/.test(read('../blog/water-not-burglars.html')));
});
