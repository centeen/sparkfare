// K-B3 (ROADMAP step 127): the static /data/ route pages are built around the fare ticket, with one fare link and one call to action.
// The generator's freshness rules are run through a real Python interpreter (skipped if none); the generated pages are read from disk.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GEN = 'Phase 17 pSEO Generator (Step 106).py';
const genSource = fs.readFileSync(path.join(ROOT, GEN), 'utf8');
const dir = path.join(ROOT, 'data');
const strip = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '');
const pages = fs.readdirSync(dir).filter((f) => f.endsWith('.html') && f !== 'index.html');

function pyDriver(body) {
  const code = `
import importlib.util, json, sys
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
const rec = `dict(origin='JFK', display_name='Lisbon, Portugal', price=350, status='deal', median_baseline=500,
  basis_text='30% below 30-day median, 20 observations', airline='TP', booking_link='https://www.aviasales.com/search/X?marker=1',
  departure_at=iso(now + timedelta(days=60)), return_at=iso(now + timedelta(days=67)), found_at=iso(now - timedelta(hours=3)),
  observations=[dict(date=(now - timedelta(days=i)).date().isoformat(), price=450 + i) for i in range(20, 0, -1)])`;
const py = pyDriver('print(json.dumps(1))');

test('every route page has one H1, one <main> and either one fare ticket or the empty state, never both', () => {
  assert.ok(pages.length >= 880);
  for (const f of pages) {
    const h = fs.readFileSync(path.join(dir, f), 'utf8');
    const body = h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '');
    assert.equal((body.match(/<h1[\s>]/g) || []).length, 1, f);
    assert.equal((body.match(/<main[\s>]/g) || []).length, 1, f);
    const tickets = (body.match(/<div class="ticket">/g) || []).length;
    const empties = (body.match(/<div class="route-empty">/g) || []).length;
    assert.equal(tickets + empties, 1, `${f}: ${tickets} tickets, ${empties} empty states`);
  }
});

test('the H1 is plain "<City> to <City>"; the long descriptive string stays in <title>', () => {
  for (const f of pages) {
    const h = fs.readFileSync(path.join(dir, f), 'utf8');
    const h1 = h.match(/<h1>([^<]*)<\/h1>/)[1];
    assert.match(h1, /^[A-Za-z .]+ to [^:]+$/, f);
    assert.ok(!/Flights|Median|%/.test(h1), `${f}: ${h1}`);
  }
  const priced = fs.readFileSync(path.join(dir, pages.find((f) => /chip-deal">Deal/.test(fs.readFileSync(path.join(dir, f), 'utf8')))), 'utf8');
  assert.match(priced.match(/<title>([^<]*)<\/title>/)[1], /Below 30-Day Median \| Sparkfare$/);
});

test('at most one fare link per page, only on a ticket, always with rel, the booking-site label and the disclosure beside it', () => {
  let withLink = 0;
  for (const f of pages) {
    const h = fs.readFileSync(path.join(dir, f), 'utf8');
    const links = h.match(/<a class="fare-link"[^>]*>/g) || [];
    assert.ok(links.length <= 1, f);
    if (links.length === 1) {
      withLink++;
      assert.match(links[0], /href="\/out\/aviasales\?url=[^"]+&amp;src=route"/, f);
      assert.match(links[0], /rel="sponsored nofollow noopener"/, f);
      assert.match(links[0], /aria-label="View this fare on a booking site/, f);
      assert.ok(h.includes('Sparkfare may earn a commission if you buy through this link, at no extra cost to you.'), f);
      assert.ok(/<div class="ticket">/.test(h), f);
    } else {
      assert.ok(!strip(h).includes('ticket-disclosure'), `${f}: disclosure without a fare link`);
    }
    // one call to action: the single signup form; no second account call to action
    assert.equal((h.match(/id="signup-form"/g) || []).length, 1, f);
    assert.ok(!/Create a free account/.test(h), f);
  }
  assert.ok(withLink > 50, `only ${withLink} pages have a fare link`);
});

test('an empty state shows no price, no chip but Building history, and no fare link', () => {
  const f = pages.find((p) => fs.readFileSync(path.join(dir, p), 'utf8').includes('route-empty-line'));
  const h = fs.readFileSync(path.join(dir, f), 'utf8');
  assert.match(h, /We haven't seen enough fares for .+ to .+ yet\./);
  const b = strip(h);
  assert.ok(!b.includes('class="fare-link"') && !b.includes('ticket-price') && !b.includes('<svg class="route-chart"'));
});

test('no page has gold outside the Deal chip and the chart dot, and no leaked placeholder text', () => {
  for (const f of pages) {
    const h = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.ok(!/undefined|\{\{|\bNone\b|\bnan\b/.test(strip(h)), f);
    assert.ok(!/#E8B930/i.test(h.replace(/<style[\s\S]*?<\/style>/g, '')), f);
  }
});

test('the airline map and thresholds match index.html', () => {
  const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const js = Object.fromEntries([...idx.match(/const AIRLINE_NAMES = \{([^}]*)\}/)[1].matchAll(/'?([A-Z0-9]{2})'?: '([^']+)'/g)].map((m) => [m[1], m[2]]));
  const pyMap = Object.fromEntries([...genSource.match(/AIRLINE_NAMES = \{([^}]*)\}/)[1].matchAll(/"([A-Z0-9]{2})": "([^"]+)"/g)].map((m) => [m[1], m[2]]));
  assert.deepEqual(pyMap, js);
  for (const [name, re] of [['PRICE_FRESH_HOURS', /const PRICE_FRESH_HOURS = (\d+)/], ['LAPSE_DAYS', /const LAPSE_DAYS = (\d+)/]]) {
    assert.equal(genSource.match(new RegExp(`${name} = (\\d+)`))[1], idx.match(re)[1], name);
  }
  assert.equal(genSource.match(/DEPARTURE_GUARD_HOURS = (\d+)/)[1], '48');
});

test('python: a current fare is a ticket with dates, airline, a zone-stamped as-of line and a fare link', { skip: !py }, () => {
  const out = pyDriver(`r = ${rec}
html = g.build_route_body('JFK', 'New York', 'Lisbon, Portugal', r, now)
print(json.dumps(html))`);
  assert.match(out, /JFK → Lisbon <span class="ticket-region">Portugal<\/span>/);
  assert.match(out, /\$350/);
  assert.match(out, /chip-deal">Deal/);
  assert.match(out, /30% below 30-day median, 20 observations · \$150 under/);
  assert.match(out, /Dec 18–25, 7 nights · TAP Air Portugal · round trip/);
  assert.match(out, /Checked <span data-asof="2026-10-19T09:00:00[^"]*">Oct 19, 9:00 AM UTC<\/span>\./);
  assert.match(out, /class="fare-link"/);
  assert.match(out, /rel="sponsored nofollow noopener"/);
  assert.match(out, /href="\/out\/aviasales\?url=[^"]+&amp;src=route"/);
  assert.ok(out.includes('Sparkfare may earn a commission if you buy through this link, at no extra cost to you.'));
  assert.match(out, /<svg class="route-chart"/);
});

test('python: a fare that leaves within 48 hours, or has already left, is not shown', { skip: !py }, () => {
  const out = pyDriver(`a = ${rec}; a['departure_at'] = iso(now + timedelta(hours=47))
b = ${rec}; b['departure_at'] = iso(now - timedelta(days=1))
c = ${rec}; c['departure_at'] = iso(now + timedelta(hours=49))
print(json.dumps([g.fare_state(x, now) for x in (a, b, c)]))`);
  assert.deepEqual(out, ['none', 'none', 'current']);
});

test('python: last seen more than 3 calendar days ago has no fare link, no disclosure and no chart dot; a carried fare says so', { skip: !py }, () => {
  const out = pyDriver(`r = ${rec}; r['is_stale_fallback'] = True; r['last_fresh_date'] = (now - timedelta(days=4)).date().isoformat()
lapsed = g.build_route_body('JFK', 'New York', 'Lisbon, Portugal', r, now)
r2 = ${rec}; r2['is_stale_fallback'] = True; r2['last_fresh_date'] = (now - timedelta(days=2)).date().isoformat()
carried = g.build_route_body('JFK', 'New York', 'Lisbon, Portugal', r2, now)
r3 = ${rec}; r3['found_at'] = iso(now - timedelta(hours=60))
older = g.build_route_body('JFK', 'New York', 'Lisbon, Portugal', r3, now)
print(json.dumps([lapsed, carried, older]))`);
  const [lapsed, carried, older] = out;
  assert.match(lapsed, /chip-lastseen/);
  assert.match(lapsed, /Last seen Oct 15\./);
  assert.ok(!/fare-link|ticket-disclosure/.test(lapsed));
  assert.ok(!/<circle cx="[0-9]+\.[0-9]" cy="[0-9]+\.[0-9]" r="5" fill/.test(lapsed), "no chart dot for a lapsed fare");
  assert.match(carried, /Last seen Oct 17\. No newer price today, so this one is carried forward\./);
  assert.match(carried, /class="fare-link"/);
  assert.match(older, /Prices as of <span data-asof="2026-10-17T00:00:00[^"]*">Oct 17, 12:00 AM UTC<\/span>\./);
});

test('python: the chart needs two days of history; a median adds the dashed line and the 15% region', { skip: !py }, () => {
  const out = pyDriver(`r = ${rec}
full = g.route_chart_svg(r, 'current')
r1 = ${rec}; r1['observations'] = []; r1['found_at'] = iso(now)
none = g.route_chart_svg(r1, 'none')
r2 = ${rec}; r2['status'] = 'priced_no_deal'
typical = g.route_chart_svg(r2, 'current')
print(json.dumps([full, none, typical]))`);
  const [full, none, typical] = out;
  assert.match(full, /stroke-dasharray/);
  assert.match(full, /<rect /);
  assert.match(full, /fill="var\(--spark\)"/);
  assert.equal(none, '');
  assert.ok(!/var\(--spark\)/.test(typical), 'the gold dot is only for a deal');
});
