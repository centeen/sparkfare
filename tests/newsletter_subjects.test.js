// D-009: the Sunday newsletter's subject lines and intro are validated after generation. A curiosity-gap subjectA must be
// truthful to the first deal, under 58 characters, and free of hype, unbacked savings claims and the banned referral words.
// If subjectA fails, subjectB goes out; if both fail, a deterministic direct subject does. These tests run the real Python
// module (no network, no API key) and the generator itself in mock mode.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());

function findPython() {
  for (const cmd of ['python3', 'python', 'py']) {
    const r = spawnSync(cmd, ['--version'], { encoding: 'utf8' });
    if (r.status === 0 && /Python 3/.test(`${r.stdout}${r.stderr}`)) return cmd;
  }
  return null;
}
const PYTHON = findPython();
const maybe = { skip: PYTHON ? false : 'python is not available' };

const SNIPPET = `
import json, os, sys
sys.path.insert(0, os.environ["SF_ROOT"])
import newsletter_subjects as n
req = json.load(sys.stdin)
fn = req["fn"]
if fn == "violations":
    out = n.subject_violations(req["subject"], req["deals"])
elif fn == "intro":
    out = n.intro_violations(req["intro"])
elif fn == "choose":
    out = n.choose_copy(req["copy"], req["origin"], req["deals"])
elif fn == "mock":
    out = n.mock_copy(req["origin"], req["deals"])
elif fn == "direct":
    out = n.direct_subject(req["origin"], req["deals"])
elif fn == "consts":
    out = {"max": n.SUBJECT_MAX_LEN, "safe_intro": n.SAFE_INTRO, "origins": sorted(n.ORIGIN_CITY.keys())}
else:
    raise SystemExit("unknown fn")
print(json.dumps(out))
`;

function py(req) {
  const r = spawnSync(PYTHON, ['-c', SNIPPET], { input: JSON.stringify(req), encoding: 'utf8', env: { ...process.env, SF_ROOT: ROOT } });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

const DEALS = [
  { display_name: 'Lisbon, Portugal', price: 412 },
  { display_name: 'Prague, Czechia', price: 455 },
  { display_name: 'Bali, Indonesia', price: 810 },
];
const passes = (subject, deals = DEALS) => py({ fn: 'violations', subject, deals }).length === 0;
const reasons = (subject, deals = DEALS) => py({ fn: 'violations', subject, deals });

test('the handoff example shapes pass', maybe, () => {
  assert.equal(passes('Where $412 gets you from Boston this week'), true);
  assert.equal(passes('The cheapest place we found from Chicago'), true);
  assert.equal(passes('Lowest fares from Boston: Lisbon $412'), true);
});

test('each banned hype phrase fails', maybe, () => {
  for (const s of [
    "You won't believe these prices", 'Flights to Lisbon are dirt cheap', 'Dirt-cheap flights', 'Huge drops this week',
    'A steal from Boston', 'Prices drop right now', 'Hurry, Lisbon is $412', 'Last chance for Lisbon', 'Unbeatable fares from Boston',
  ]) assert.equal(passes(s), false, s);
});

test('savings claims fail: percentages, "% off", save, discount, free', maybe, () => {
  for (const s of ['27% below the median to Lisbon', '30% off flights to Lisbon', 'Save big from Boston', 'Discount fares to Lisbon', 'Free alerts for Lisbon', '20 percent cheaper to Lisbon']) {
    assert.equal(passes(s), false, s);
  }
});

test('banned referral words fail in a subject', maybe, () => {
  for (const s of ['Book Lisbon from $412', 'Your flight is booked', 'Fares secured for Lisbon', 'Locked in: Lisbon $412', 'Reserve Lisbon today', 'We arrange your Lisbon trip', 'Fully licensed fares']) {
    assert.equal(passes(s), false, s);
  }
});

test('length: under 58 characters', maybe, () => {
  const ok = 'Where $412 gets you from Boston this week'; // 41
  assert.equal(passes(ok), true);
  const s57 = 'Where $412 gets you from ' + 'x'.repeat(57 - 'Where $412 gets you from '.length);
  const s58 = s57 + 'x';
  assert.equal(s57.length, 57);
  assert.equal(passes(s57), true);
  assert.equal(passes(s58), false);
  assert.match(reasons(s58).join(' '), /too long/);
});

test('truthful to the first deal: price and destination', maybe, () => {
  assert.equal(passes('Where $455 gets you from Boston this week'), false, "the second deal's price");
  assert.match(reasons('Where $455 gets you from Boston this week').join(' '), /first deal's price/);
  assert.equal(passes('Where $412 gets you from Boston, say Prague'), false, "another destination");
  assert.equal(passes('Lisbon from Boston this week'), true, 'the first destination is fine');
  assert.equal(passes('Where $1,299 gets you from Boston'), false);
  assert.equal(passes('Where $412 gets you from Boston', []), false, 'no deals means no price can be true');
});

test('choose_copy: a passing subjectA is kept and subjectB too', maybe, () => {
  const r = py({ fn: 'choose', origin: 'BOS', deals: DEALS, copy: { intro: 'Three fares we tracked.', subjectA: 'Where $412 gets you from Boston', subjectB: 'Lowest fares from Boston: Lisbon $412' } });
  assert.equal(r.subject_used, 'A');
  assert.equal(r.subjectA, 'Where $412 gets you from Boston');
  assert.equal(r.subjectB, 'Lowest fares from Boston: Lisbon $412');
  assert.deepEqual(r.rejections, []);
});

test('choose_copy: a failing subjectA is replaced by subjectB, and the rejection is logged', maybe, () => {
  const r = py({ fn: 'choose', origin: 'BOS', deals: DEALS, copy: { intro: 'Fares.', subjectA: "You won't believe these prices", subjectB: 'Lowest fares from Boston: Lisbon $412' } });
  assert.equal(r.subject_used, 'B');
  assert.equal(r.subjectA, 'Lowest fares from Boston: Lisbon $412');
  assert.equal(r.subjectB, 'Lowest fares from Boston: Lisbon $412');
  assert.equal(r.rejections.length, 1);
  assert.equal(r.rejections[0].field, 'subjectA');
  assert.match(r.rejections[0].reasons.join(' '), /hype/);
});

test('choose_copy: both failing sends the deterministic direct subject', maybe, () => {
  const r = py({ fn: 'choose', origin: 'BOS', deals: DEALS, copy: { intro: 'Fares.', subjectA: 'Hurry, steal of the week', subjectB: 'Book Lisbon now' } });
  assert.equal(r.subject_used, 'fallback');
  assert.equal(r.subjectA, 'Lowest fares from Boston: Lisbon $412');
  assert.equal(r.subjectB, r.subjectA);
  assert.deepEqual(r.rejections.map((x) => x.field).sort(), ['subjectA', 'subjectB']);
  assert.equal(passes(r.subjectA), true);
});

test('choose_copy: a failing subjectB alone is replaced while a good subjectA stays', maybe, () => {
  const r = py({ fn: 'choose', origin: 'BOS', deals: DEALS, copy: { intro: 'Fares.', subjectA: 'Where $412 gets you from Boston', subjectB: '30% off Lisbon' } });
  assert.equal(r.subject_used, 'A');
  assert.equal(r.subjectA, 'Where $412 gets you from Boston');
  assert.equal(r.subjectB, 'Lowest fares from Boston: Lisbon $412');
});

test('choose_copy: missing or non-string subjects fall back, and a hype intro is replaced', maybe, () => {
  const r = py({ fn: 'choose', origin: 'BOS', deals: DEALS, copy: { intro: 'Huge price drops, dirt cheap, hurry!', subjectA: null } });
  assert.equal(r.subject_used, 'fallback');
  const safe = py({ fn: 'consts' }).safe_intro;
  assert.equal(r.intro, safe);
  assert.ok(r.rejections.some((x) => x.field === 'intro'));
  const empty = py({ fn: 'choose', origin: 'BOS', deals: DEALS, copy: {} });
  assert.equal(empty.subject_used, 'fallback');
  assert.equal(empty.intro, safe);
});

test('the intro is held to the same bans', maybe, () => {
  assert.deepEqual(py({ fn: 'intro', intro: 'Here are the lowest fares we tracked from Boston this week.' }), []);
  for (const t of ['You will love these, dirt cheap!', 'A huge drop on Lisbon', 'Prices are unbeatable', 'We booked the best fares', 'Save 30% on Lisbon', 'Fares are secured for you']) {
    assert.notDeepEqual(py({ fn: 'intro', intro: t }), [], t);
  }
});

test('mock-mode copy follows the same rules, for every origin and awkward deals', maybe, () => {
  const origins = py({ fn: 'consts' }).origins;
  assert.ok(origins.length >= 23);
  const cases = [
    DEALS,
    [{ display_name: 'Sofia / Borovets, Bulgaria', price: 99999.6 }],
    [{ display_name: 'Ho Chi Minh City, Vietnam', price: 1234 }, { display_name: 'Cusco, Peru', price: 900 }],
  ];
  for (const origin of origins) {
    for (const deals of cases) {
      const m = py({ fn: 'mock', origin, deals });
      assert.deepEqual(py({ fn: 'violations', subject: m.subjectA, deals }), [], `${origin} A: ${m.subjectA}`);
      assert.deepEqual(py({ fn: 'violations', subject: m.subjectB, deals }), [], `${origin} B: ${m.subjectB}`);
      assert.deepEqual(py({ fn: 'intro', intro: m.intro }), [], `${origin} intro: ${m.intro}`);
    }
  }
});

test('the old mock strings and the old hype example are gone', maybe, () => {
  const src = fs.readFileSync(path.join(ROOT, 'Phase 19 Newsletter Generator.py'), 'utf8');
  assert.doesNotMatch(src, /You won't believe these prices/);
  assert.doesNotMatch(src, /are dirt cheap right now/);
  assert.doesNotMatch(src, /huge price drops/i);
  assert.match(src, /import newsletter_subjects as ns/);
  assert.match(src, /ns\.choose_copy\(/);
});

test('the generator in mock mode writes validated subjects and logs which was used', maybe, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'newsletter-'));
  try {
    fs.writeFileSync(path.join(dir, 'sparkfare_ranked_deals.json'), JSON.stringify({ deals: [
      { display_name: 'Lisbon, Portugal', price: 412, origin: 'JFK', median_baseline: 600 },
      { display_name: 'Prague, Czechia', price: 455, origin: 'JFK', median_baseline: 640 },
    ] }));
    fs.writeFileSync(path.join(dir, 'sparkfare_ranked_deals_other_origins.json'), JSON.stringify({ deals: [
      { display_name: 'Madrid, Spain', price: 421, origin: 'LAX', median_baseline: 558 },
    ] }));
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY; delete env.KPI_DASHBOARD_SECRET;
    const r = spawnSync(PYTHON, [path.join(ROOT, 'Phase 19 Newsletter Generator.py')], { cwd: dir, env, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /\[JFK\] subject used: A/);
    const payload = JSON.parse(fs.readFileSync(path.join(dir, 'mock_newsletter_payload.json'), 'utf8'));
    assert.deepEqual(Object.keys(payload).sort(), ['JFK', 'LAX']);
    for (const [origin, p] of Object.entries(payload)) {
      assert.deepEqual(py({ fn: 'violations', subject: p.subjectA, deals: p.deals }), [], `${origin} ${p.subjectA}`);
      assert.deepEqual(py({ fn: 'violations', subject: p.subjectB, deals: p.deals }), [], `${origin} ${p.subjectB}`);
      assert.ok(['A', 'B', 'fallback'].includes(p.subject_used));
      assert.ok(Array.isArray(p.subject_rejections));
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
