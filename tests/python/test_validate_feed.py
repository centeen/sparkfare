"""Golden-file tests for the N2 validation gate (scripts/data/validate_feed.py).

Each check has one passing fixture and one failing fixture (tests/fixtures/data/).  Run: py -m pytest tests/python
"""
import copy
import importlib.util
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("validate_feed", ROOT / "scripts" / "data" / "validate_feed.py")
vf = importlib.util.module_from_spec(spec)
spec.loader.exec_module(vf)

CFG = json.loads((ROOT / "config" / "data_quality.json").read_text())
DESTS = set(json.loads((ROOT / "sparkfare_destinations.json").read_text()).keys())
FIX = ROOT / "tests" / "fixtures" / "data"
GOOD_RANKED = json.loads((FIX / "ranked_ok.json").read_text())
GOOD_STORE = json.loads((FIX / "store_ok.json").read_text())
GOOD_STATS = json.loads((FIX / "stats_ok.json").read_text())
NOW = datetime(2026, 10, 24, 8, 0, tzinfo=timezone.utc)


def run(ranked=None, store=None, stats="default", baseline=None):
    stats = GOOD_STATS if stats == "default" else stats
    return vf.validate(copy.deepcopy(ranked or GOOD_RANKED), copy.deepcopy(store or GOOD_STORE), stats, baseline, CFG, DESTS, "daily_jfk", now=NOW)


def status_of(result, cid):
    return next(c["status"] for c in result["checks"] if c["id"] == cid)


def first_priced(ranked):
    return next(r for b in vf.PRICED_BUCKETS for r in ranked[b])


def test_clean_run_passes_every_check_and_changes_nothing():
    result, cleaned, quarantine = run()
    assert result["status"] == "ok"
    assert result["failed_checks"] == []
    assert quarantine == []
    assert cleaned == GOOD_RANKED
    assert status_of(result, "priced_routes_vs_recent_median") == "skipped"  # no baseline yet


# ---- file level: each one blocks the run ----------------------------------------------------------------------------

def test_schema_failure_blocks():
    bad = copy.deepcopy(GOOD_RANKED)
    del bad["generated_at"]
    result, _, _ = run(ranked=bad)
    assert result["status"] == "blocked" and status_of(result, "schema_ranked") == "fail"


def test_missing_schema_version_blocks():
    bad = copy.deepcopy(GOOD_RANKED)
    del bad["schema_version"]
    assert run(ranked=bad)[0]["status"] == "blocked"


def test_store_schema_failure_blocks():
    bad = copy.deepcopy(GOOD_STORE)
    next(iter(bad.values()))["results"] = "nope"
    result, _, _ = run(store=bad)
    assert result["status"] == "blocked" and status_of(result, "schema_store") == "fail"


def test_double_prefixed_key_blocks():
    bad = copy.deepcopy(GOOD_RANKED)
    first_priced(bad)["route_key"] = "JFK:JFK:Bali, Indonesia"
    result, _, _ = run(ranked=bad)
    assert result["status"] == "blocked" and status_of(result, "no_double_prefixed_keys") == "fail"


def test_duplicate_route_blocks():
    bad = copy.deepcopy(GOOD_RANKED)
    bad["no_data"].append(copy.deepcopy(first_priced(bad)))
    result, _, _ = run(ranked=bad)
    assert result["status"] == "blocked" and status_of(result, "one_record_per_route") == "fail"


def test_too_few_priced_routes_vs_recent_median_blocks():
    result, _, _ = run(baseline=[10, 10, 10, 10])  # 3 priced now, floor is 8
    assert result["status"] == "blocked" and status_of(result, "priced_routes_vs_recent_median") == "fail"


def test_priced_routes_near_the_median_pass():
    result, _, _ = run(baseline=[3, 3, 4, 3])
    assert status_of(result, "priced_routes_vs_recent_median") == "pass"


def test_baseline_needs_three_points():
    assert status_of(run(baseline=[100, 100])[0], "priced_routes_vs_recent_median") == "skipped"


def test_failed_calls_over_five_percent_block():
    stats = {**GOOD_STATS, "calls": 40, "failed": ["JFK:Bali, Indonesia", "JFK:Tokyo, Japan", "JFK:Prague, Czechia"]}
    result, _, _ = run(stats=stats)
    assert result["status"] == "blocked" and status_of(result, "failed_calls") == "fail"


def test_a_few_failed_calls_are_tolerated():
    stats = {**GOOD_STATS, "calls": 920, "failed": ["JFK:Bali, Indonesia"] * 10}
    assert status_of(run(stats=stats)[0], "failed_calls") == "pass"


def test_wrong_currency_blocks():
    result, _, _ = run(stats={**GOOD_STATS, "currency": "eur"})
    assert result["status"] == "blocked" and status_of(result, "currency") == "fail"


# ---- record level: quarantined, the rest publishes ---------------------------------------------------------------------

def many(n=200):
    """A ranked file with n priced records so one bad record is well under the 1% limit."""
    ranked = copy.deepcopy(GOOD_RANKED)
    base = first_priced(ranked)
    ranked["priced_no_deal"] = []
    dests = sorted(DESTS)
    for i in range(n):
        r = copy.deepcopy(base)
        r["display_name"] = dests[i % len(dests)]
        r["origin"] = CFG["origins"][i % len(CFG["origins"])]
        r["route_key"] = f"{r['origin']}:{r['display_name']}"
        ranked["priced_no_deal"].append(r)
    for b in ("deals", "featured"):
        ranked[b] = []
    # route keys must be unique: de-duplicate by dropping repeats
    seen, keep = set(), []
    for r in ranked["priced_no_deal"]:
        if r["route_key"] not in seen:
            seen.add(r["route_key"])
            keep.append(r)
    ranked["priced_no_deal"] = keep
    return ranked


@pytest.mark.parametrize("field,value,reason", [
    ("origin", "XXX", vf.UNKNOWN_ORIGIN),
    ("display_name", "Atlantis, Nowhere", vf.UNKNOWN_DESTINATION),
    ("price", -5, vf.BAD_PRICE),
    ("price", 0, vf.BAD_PRICE),
    ("price", 12.5, vf.BAD_PRICE),
    ("price", 250000, vf.PRICE_OVER_CEILING),
    ("departure_at", "2026-10-25T10:00:00-04:00", vf.DEPARTURE_TOO_SOON),
    ("departure_at", "not a date", vf.BAD_DEPARTURE),
    ("return_at", "2026-11-01T10:00:00-04:00", vf.RETURN_BEFORE_DEPARTURE),
])
def test_a_single_bad_record_is_quarantined_not_blocking(field, value, reason):
    ranked = many()
    assert len(ranked["priced_no_deal"]) >= 100
    victim = ranked["priced_no_deal"][5]
    victim["departure_at"] = "2027-03-01T10:00:00-05:00"
    victim["return_at"] = "2027-03-10T10:00:00-05:00"
    victim[field] = value
    if field == "display_name":
        victim["route_key"] = f"{victim['origin']}:{value}"
    if field == "origin":
        victim["route_key"] = f"{value}:{victim['display_name']}"
    n = len(ranked["priced_no_deal"])
    result, cleaned, quarantine = vf.validate(ranked, None, GOOD_STATS, None, CFG, DESTS, "daily_jfk", now=NOW)
    assert result["status"] == "ok", result["checks"]
    assert [q["reason"] for q in quarantine] == [reason]
    assert len(cleaned["priced_no_deal"]) == n - 1
    assert all(r["route_key"] != quarantine[0]["route_key"] for r in cleaned["priced_no_deal"])
    assert result["quarantine_reasons"] == [reason]


def test_too_many_bad_records_block_the_run():
    ranked = many(150)
    for r in ranked["priced_no_deal"][:10]:
        r["price"] = -1
    result, _, _ = vf.validate(ranked, None, GOOD_STATS, None, CFG, DESTS, "daily_jfk", now=NOW)
    assert result["status"] == "blocked" and status_of(result, "records_valid") == "fail"


def test_records_with_no_price_are_not_judged_on_price_or_dates():
    ranked = copy.deepcopy(GOOD_RANKED)
    assert ranked["no_data"], "fixture needs a no_data record"
    result, _, quarantine = vf.validate(ranked, None, GOOD_STATS, None, CFG, DESTS, "daily_jfk", now=NOW)
    assert quarantine == [] and result["status"] == "ok"


def test_result_contains_no_prices():
    result, _, _ = run()
    text = json.dumps(result)
    assert "price\"" not in text and "booking_link" not in text and "aviasales" not in text.lower()


# ---- command line ---------------------------------------------------------------------------------------------------

def test_cli_blocked_run_exits_1_and_leaves_the_ranked_file_alone(tmp_path):
    bad = copy.deepcopy(GOOD_RANKED)
    first_priced(bad)["route_key"] = "JFK:JFK:Bali, Indonesia"
    ranked = tmp_path / "ranked.json"
    ranked.write_text(json.dumps(bad))
    before = ranked.read_text()
    out = tmp_path / "result.json"
    code = vf.main(["--pipeline", "daily_jfk", "--ranked", str(ranked), "--out", str(out), "--write-clean"])
    assert code == 1
    assert json.loads(out.read_text())["status"] == "blocked"
    assert ranked.read_text() == before


def test_cli_ok_run_with_a_quarantined_record_rewrites_the_ranked_file(tmp_path):
    ranked_data = many()
    ranked_data["priced_no_deal"][3]["price"] = -1
    ranked = tmp_path / "ranked.json"
    ranked.write_text(json.dumps(ranked_data))
    q = tmp_path / "q.json"
    out = tmp_path / "result.json"
    code = vf.main(["--pipeline", "daily_jfk", "--ranked", str(ranked), "--out", str(out), "--quarantine-out", str(q), "--write-clean"])
    assert code == 0
    assert len(json.loads(ranked.read_text())["priced_no_deal"]) == len(ranked_data["priced_no_deal"]) - 1
    assert json.loads(q.read_text())["records"][0]["reason"] == vf.BAD_PRICE


def test_cli_unreadable_input_exits_2(tmp_path):
    assert vf.main(["--pipeline", "daily_jfk", "--ranked", str(tmp_path / "missing.json"), "--out", str(tmp_path / "r.json")]) == 2


def test_the_real_serving_files_pass_with_a_schema_version(tmp_path):
    """Calibration guard: the files committed today must pass, or the gate would block every real run."""
    for pipeline, ranked_name, store_name in [
        ("daily_jfk", "sparkfare_ranked_deals.json", "sparkfare_flight_prices.json"),
        ("multi_origin", "sparkfare_hourly_ranked_deals.json", "sparkfare_hourly_flight_prices.json"),
        ("multi_origin", "sparkfare_ranked_deals_other_origins.json", "sparkfare_flight_prices_other_origins.json"),
    ]:
        ranked = json.loads((ROOT / ranked_name).read_text())
        ranked.setdefault("schema_version", 1)
        store = json.loads((ROOT / store_name).read_text())
        result, _, quarantine = vf.validate(ranked, store, None, None, CFG, DESTS, pipeline)
        assert result["status"] == "ok", (ranked_name, result["checks"])
        assert quarantine == [], (ranked_name, quarantine[:3])


def test_config_origins_are_valid_codes_and_include_tlv():
    assert len(CFG["origins"]) == len(set(CFG["origins"]))
    assert all(len(o) == 3 and o.isupper() for o in CFG["origins"])
    assert CFG["origins"][-1] == "TLV"
