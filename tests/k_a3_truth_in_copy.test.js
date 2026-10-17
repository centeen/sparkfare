// K-A3 (ROADMAP step 121): truth in copy. The approved replacements are in place everywhere, generated destination copy never carries a figure or
// barred wording, the board's line under a price is built from the fare's own data, and the checker enforces the Brand v1 banned list.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { REPLACEMENTS, applyCopy } from '../scripts/apply-ka3-copy.mjs';
import { scanText, loadAllowlist } from '../scripts/check-referral-copy.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8').replace(/\r\n/g, '\n');

const html = read('index.html');
const block = html.match(/const AIRLINE_NAMES = [\s\S]*?\/\/ end K-A3 copy helpers/)[0];
const api = vm.runInNewContext(`${block}
;({ isCleanLine, fareDatesText, setLines: (o) => { destinationLines = o; } })`);

const served = [
  ...fs.readdirSync(root).filter((f) => f.endsWith('.html') && !f.startsWith('google81')),
  ...fs.readdirSync(path.join(root, 'blog')).map((f) => 'blog/' + f),
  ...fs.readdirSync(path.join(root, 'data')).map((f) => 'data/' + f),
  'src/index.js', 'src/email.js', 'src/ptoPages.js', 'Phase 17 pSEO Generator (Step 106).py', 'Phase 20 Blog Generator.py',
];

test('every replaced line is gone from every served file and generator, and applying the script again changes nothing', () => {
  const stringsBefore = REPLACEMENTS.filter(([b]) => typeof b === 'string').map(([b]) => b);
  const left = [];
  for (const f of served) {
    const s = read(f);
    for (const b of stringsBefore) if (s.includes(b)) left.push(`${f}: ${b.slice(0, 50)}`);
    assert.equal(applyCopy(s), s, `${f} is not stable under the script`);
  }
  assert.deepEqual(left, []);
});

test('the approved lines are in place', () => {
  assert.match(read('index.html'), /One email a day when a fare from your home airport beats its usual price\./);
  assert.match(read('widget.html'), /One email a day when a fare from your home airport beats its usual price\./);
  const route = read('data/jfk-to-prague-czechia.html');
  assert.match(route, /Watch this route\. One email when it drops below its usual price\./);
  assert.ok(!/Create a free account and a watchlist/.test(route), 'the second call to action is gone');
  assert.ok(!/instantly/i.test(route));
  assert.match(read('blog/index.html'), /how to watch this route and hear when it drops below its usual price/);
  assert.match(read('src/email.js'), /Compare airport parking before you go/);
  assert.match(read('src/email.js'), /Data from the moment you land, on a supported network/);
  const mig = read('migrations/0029_k_a3_partner_copy.sql');
  assert.match(mig, /Compare airport parking before you go/);
  assert.match(mig, /slug = 'parking-access'/);
  assert.match(mig, /Data from the moment you land, on a supported network/);
  assert.match(mig, /slug = 'yesim'/);
});

test('isCleanLine rejects figures, comparisons and barred wording, and accepts plain description', () => {
  for (const bad of ['70% below comparable Mediterranean pricing', 'Four-star dining from $12.', 'prices drop 40%', 'Move fast, premium positioning rarely lasts.', 'pricing that vanishes after April', 'Currency arbitrage meets temple culture.', 'you will be told instantly', 'the moment it is cheap', 'A proper dinner runs €18–25 per person.', '']) {
    assert.equal(api.isCleanLine(bad), false, bad);
  }
  for (const good of ['Temples, rice terraces and surf.', 'Tram 28 climbs through Alfama.', 'Mezcal, markets and colonial streets.']) assert.equal(api.isCleanLine(good), true, good);
  assert.equal(api.isCleanLine(undefined), false);
});

test('the same test exists in the blog generator, and the two agree on a corpus', () => {
  const corpus = ['70% below comparable pricing', 'Mezcal, markets and colonial streets.', 'prices drop 40%', 'Four-star dining from $12.', 'Move fast', 'a quiet walk by the river', 'vanishes after April', 'the moment it opens', 'Premium markups', 'Currency arbitrage', 'Only 3 left'];
  const driver = 'import importlib.util, json, sys\nspec = importlib.util.spec_from_file_location("blog", "Phase 20 Blog Generator.py")\nm = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)\nprint(json.dumps([m.is_clean_line(t) for t in json.loads(sys.argv[1])]))';
  let out = null;
  for (const bin of ['python3', 'python', 'py']) {
    const r = spawnSync(bin, ['-c', driver, JSON.stringify(corpus)], { cwd: root, encoding: 'utf8' });
    if (r.status === 0) { out = JSON.parse(r.stdout.trim().split('\n').pop()); break; }
  }
  if (out === null) return; // no interpreter on this machine; CI has one
  assert.deepEqual(out, corpus.map((t) => api.isCleanLine(t)));
});

test('real data: no destination blurb shown on the board or published in a guide contains a figure or barred wording', () => {
  const dests = JSON.parse(read('sparkfare_destinations.json'));
  let shown = 0;
  for (const [name, d] of Object.entries(dests)) {
    const c = d.copywriting || {};
    for (const line of (c.on_ground_reality || []).filter(api.isCleanLine)) { shown += 1; assert.ok(!/\d\s*%|\$\d/.test(line), `${name}: ${line}`); }
  }
  assert.ok(shown > 0, 'some clean lines remain');
  // Published destination guides: the intro, the list and the closing paragraph carry nothing the filter would reject.
  const bad = [];
  for (const f of fs.readdirSync(path.join(root, 'blog'))) {
    const s = read('blog/' + f);
    if (!s.includes('<p class="byline">Destination guide</p>')) continue;
    const pieces = [...s.matchAll(/<li>([^<]*)<\/li>/g)].map((m) => m[1]);
    const intro = s.match(/Destination guide<\/p>\s*<p>([\s\S]*?)<\/p>/);
    if (intro) pieces.push(intro[1].split('Like every')[0].split('Sparkfare shows')[0]);
    for (const p of pieces) if (p.trim() && !api.isCleanLine(p)) bad.push(`${f}: ${p.slice(0, 60)}`);
  }
  assert.deepEqual(bad, []);
});

test('the fare dates read as the fare lists them, a line in destination_lines.json is the only prose on a card, and the file ships empty', () => {
  assert.equal(api.fareDatesText({ departure_at: '2026-12-01T10:30:00+01:00', return_at: '2026-12-08T18:00:00+01:00' }), 'Dec 1\u20138, 7 nights');
  assert.equal(api.fareDatesText({ departure_at: '2026-12-30T10:00:00-05:00', return_at: '2027-01-06T10:00:00-05:00' }), 'Dec 30\u2013Jan 6, 7 nights');
  assert.equal(api.fareDatesText({}), '');
  assert.equal(read('content/destination_lines.json').trim(), '{}', 'ships empty');
  assert.match(html, /const curated = destinationLines && isCleanLine\(destinationLines\[item\.display_name\]\)/);
  assert.match(html, /\.filter\(isCleanLine\)/);
});

test('the checker enforces the Brand v1 banned list and passes on every page, template and generated page', () => {
  const allow = loadAllowlist();
  const hit = (text) => scanText(`<p>${text}</p>`, 'x.html', allow).map((f) => f.id);
  assert.ok(hit('Hurry, last chance').includes('brand-urgency'));
  assert.ok(hit('Only 3 left at this price').includes('brand-urgency'));
  assert.ok(hit('An insane steal').includes('brand-hype'));
  assert.ok(hit('Guaranteed lowest ever fares').includes('brand-hype'));
  assert.ok(hit('Get alerts instantly').includes('brand-speed'));
  assert.ok(hit('Email you the moment it drops').includes('brand-speed'));
  assert.ok(hit('LIVE-CHECKED PRICE').includes('brand-live-claim'));
  assert.ok(hit('Live prices for 480 routes').includes('brand-live-claim'));
  assert.deepEqual(hit('Data from the moment you land, on a supported network.'), []);
  assert.deepEqual(hit('One email a day when a fare beats its usual price.'), []);
  const r = spawnSync(process.execPath, ['scripts/check-referral-copy.js'], { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});
