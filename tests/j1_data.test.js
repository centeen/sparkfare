// Addendum J, J1 (data): the deal floor (D-021), distinct observation days, and dropping fares that have left or leave within 48 hours.
// The Python ranking script is exercised through a real interpreter (skipped if none is installed); dealQuality.js directly.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dealQuality, distinctObservations, MIN_DEAL_PCT_BELOW } from '../src/dealQuality.js';

const SCRIPT = 'Phase 1 Deal Ranking Script (Step 9 - with fallback).py';
const DRIVER = `
import importlib.util, json, sys
from datetime import datetime, timezone, timedelta
spec = importlib.util.spec_from_file_location("rank", ${JSON.stringify(SCRIPT)})
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
now = datetime.now(timezone.utc)
iso = lambda d: d.isoformat()
def obs(prices, start_days_ago=20):
    return [{"date": (now - timedelta(days=start_days_ago - i)).date().isoformat(), "price": p} for i, p in enumerate(prices)]
out = {}
# departure rule
out["soon"] = m.departs_too_soon(iso(now + timedelta(hours=47)))
out["later"] = m.departs_too_soon(iso(now + timedelta(hours=49)))
out["past"] = m.departs_too_soon(iso(now - timedelta(days=3)))
out["unknown"] = m.departs_too_soon(None)
entry = {"results": [
  {"price": 100, "departure_at": iso(now - timedelta(days=1))},
  {"price": 120, "departure_at": iso(now + timedelta(hours=10))},
  {"price": 300, "departure_at": iso(now + timedelta(days=30))},
  {"price": 280, "departure_at": iso(now + timedelta(days=40))}]}
out["cheapest"] = m.cheapest_result(entry)["price"]
out["none_left"] = m.cheapest_result({"results": [{"price": 1, "departure_at": iso(now - timedelta(days=1))}]})
# deal floor
base = obs([300] * 15)
fresh = iso(now - timedelta(hours=1))
def dq(price, observations=base):
    return m.deal_quality(observations, {"price": price, "found_at": fresh}, fresh, now)
out["ten_pct"] = dq(270)["is_rare_find"]
out["seventeen_pct"] = dq(250)["is_rare_find"]
out["exact_15"] = dq(255)["is_rare_find"]
dup = [{"date": o["date"], "price": o["price"]} for o in base[:3] for _ in range(5)]
r = dq(250, dup)
out["dup_n"] = r["baselineN"]; out["dup_eligible"] = r["eligible"]
r = dq(250, base + base[:5])
out["repeat_n"] = r["baselineN"]; out["basis"] = r["basis_text"]
# fallback
prev_deal = {"display_name": "X", "route_key": "A:X", "status": "deal", "price": 1, "last_fresh_date": now.date().isoformat(),
             "departure_at": iso(now + timedelta(days=20)), "observations": obs([300] * 12), "history_points": 3}
rec = {"display_name": "X", "route_key": "A:X", "status": "no_data", "history_points": 99}
fb = m.apply_fallback(dict(rec), {"A:X": prev_deal})
out["fb_status"] = fb["status"]; out["fb_stale"] = fb["is_stale_fallback"]; out["fb_points"] = fb["history_points"]
gone = dict(prev_deal, departure_at=iso(now - timedelta(days=2)))
fb2 = m.apply_fallback(dict(rec), {"A:X": gone})
out["gone_carried"] = fb2.get("is_stale_fallback") and fb2.get("price") is not None
print(json.dumps(out))
`;
function runPython() {
  for (const bin of ['python3', 'python', 'py']) {
    const r = spawnSync(bin, ['-c', DRIVER], { encoding: 'utf8' });
    if (r.status === 0) return JSON.parse(r.stdout.trim().split('\n').pop());
    if (r.error || /not found|Microsoft Store/i.test(r.stderr || '')) continue;
    throw new Error(`${bin} failed: ${r.stderr}`);
  }
  return null;
}
const py = runPython();

test('python: departure rule keeps fares more than 48 hours out and drops the rest', { skip: !py }, () => {
  assert.equal(py.soon, true);
  assert.equal(py.later, false);
  assert.equal(py.past, true);
  assert.equal(py.unknown, false);
});
test('python: the cheapest fare is chosen among fares that have not left; none left means no fare', { skip: !py }, () => {
  assert.equal(py.cheapest, 280);
  assert.equal(py.none_left, null);
});
test('python: a fare 10% below the median is not a deal; 17% is; exactly 15% is', { skip: !py }, () => {
  assert.equal(py.ten_pct, false);
  assert.equal(py.seventeen_pct, true);
  assert.equal(py.exact_15, true);
});
test('python: repeated dates count once, so 15 observations on 3 days are not enough history', { skip: !py }, () => {
  assert.equal(py.dup_n, 3);
  assert.equal(py.dup_eligible, false);
  assert.equal(py.repeat_n, 15);
  assert.match(py.basis, /15 observations/);
});
test('python: a carried-forward price is never a deal, its count matches its own observations, and a departed fare is not carried', { skip: !py }, () => {
  assert.equal(py.fb_status, 'priced_no_deal');
  assert.equal(py.fb_stale, true);
  assert.equal(py.fb_points, 12);
  assert.equal(py.gone_carried, false);
});

const obs = (prices) => prices.map((price, i) => ({ date: new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10), price }));
const now = new Date('2026-09-20T12:00:00Z');
const ticket = (price) => ({ price, found_at: '2026-09-20T10:00:00Z' });

test('js: floor constant and 15% rule match the Python script', () => {
  assert.equal(MIN_DEAL_PCT_BELOW, 0.15);
  const base = obs(Array(15).fill(300));
  assert.equal(dealQuality(base, ticket(270), now).is_rare_find, false);
  assert.equal(dealQuality(base, ticket(250), now).is_rare_find, true);
  assert.equal(dealQuality(base, ticket(255), now).is_rare_find, true);
});
test('js: repeated dates count once', () => {
  const base = obs(Array(15).fill(300));
  const dup = [...base.slice(0, 3), ...base.slice(0, 3), ...base.slice(0, 3)];
  assert.equal(distinctObservations(dup).length, 3);
  assert.equal(dealQuality(dup, ticket(250), now).eligible, false);
  const r = dealQuality([...base, ...base.slice(0, 5)], ticket(250), now);
  assert.equal(r.baselineN, 15);
  assert.match(r.basis_text, /15 observations/);
});
test('js: the cheapest price on a repeated date is the one kept', () => {
  const d = distinctObservations([{ date: '2026-09-01', price: 300 }, { date: '2026-09-01T09:00', price: 280 }]);
  assert.deepEqual(d.map((o) => o.price), [280]);
});
