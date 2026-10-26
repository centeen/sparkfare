"""Tests for the N10 shadow ranking job (scripts/data/rank_curated.py and shadow_diff.py).

The point of N10 is that ranking from the curated store gives the SAME verdicts as the live script on the same history, so the
golden tests run the live script directly (`rules.rank_deals()` with its own history file) and the shadow job (`rank_shadow()` with
the same history expressed as fare_daily rows) on fixture feeds and compare every record.

Run: py -m pytest tests/python
"""
import copy
import importlib.util
import json
import shutil
import sqlite3
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def load(name, rel):
    spec = importlib.util.spec_from_file_location(name, ROOT / rel)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


rc = load("rank_curated_under_test", "scripts/data/rank_curated.py")
sd = load("shadow_diff_under_test", "scripts/data/shadow_diff.py")
rules = rc.load_rules()

NOW = datetime(2026, 10, 25, 8, 0, tzinfo=timezone.utc)
FETCHED = "2026-10-25T07:30:00+00:00"
DEP = "2027-02-10T10:00:00+00:00"  # far enough away
RET = "2027-02-20T10:00:00+00:00"


def iso(day_offset):
    return (NOW.date() + timedelta(days=day_offset)).isoformat()


def ticket(price, dep=DEP, airline="OZ"):
    return {"price": price, "booking_link": "https://example.test/x", "airline": airline, "departure_at": dep, "return_at": RET, "expires_at": None}


def feed_entry(origin, name, group, *tickets, fetched=FETCHED):
    return {"display_name": name, "origin": origin, "group": group, "fetched_at": fetched, "results": list(tickets)}


def points(prices, last_day=-1):
    """One observation per day ending at `last_day` (relative to NOW), oldest first."""
    n = len(prices)
    return [{"date": iso(last_day - (n - 1 - i)), "price": p, "found_at": f"{iso(last_day - (n - 1 - i))}T06:00:00Z", "expires_at": None}
            for i, p in enumerate(prices)]


def rows_from_history(history):
    return [{"route_key": rk, "obs_date": h["date"], "min_price": h["price"], "first_seen_at": h["found_at"]}
            for rk, hs in history.items() for h in hs]


def run_old(feed, history, previous=None):
    """The live script's own rank_deals(), on the same inputs, with the clock fixed."""
    work = Path(tempfile.mkdtemp(prefix="old-rank-"))
    saved = (rules.PRICE_FEED_PATH, rules.HISTORY_PATH, rules.RANKED_OUTPUT_PATH, rules.datetime, rules.requests.post)
    try:
        (work / "feed.json").write_text(json.dumps(feed))
        (work / "history.json").write_text(json.dumps(history))
        if previous is not None:
            (work / "out.json").write_text(json.dumps(previous))
        rules.PRICE_FEED_PATH, rules.HISTORY_PATH, rules.RANKED_OUTPUT_PATH = work / "feed.json", work / "history.json", work / "out.json"
        rules.datetime = rc.frozen_datetime(NOW)
        rules.requests.post = lambda *a, **k: None
        rules.rank_deals()
        return json.loads((work / "out.json").read_text())
    finally:
        rules.PRICE_FEED_PATH, rules.HISTORY_PATH, rules.RANKED_OUTPUT_PATH, rules.datetime, rules.requests.post = saved
        shutil.rmtree(work, ignore_errors=True)


def by_key(out):
    return {r["route_key"]: r for b in rc.BUCKETS for r in out[b]}


COMPARED = ("status", "price", "history_points", "median_baseline", "trailing_avg", "pct_below_avg", "basis_text", "is_stale_fallback", "group")


def assert_same(feed, history, previous=None):
    old = run_old(feed, copy.deepcopy(history), copy.deepcopy(previous))
    new = rc.rank_shadow(feed, rows_from_history(history), copy.deepcopy(previous), NOW, rules)
    o, n = by_key(old), by_key(new)
    assert o.keys() == n.keys()
    for k in o:
        for field in COMPARED:
            assert o[k].get(field) == n[k].get(field), (k, field, o[k].get(field), n[k].get(field))
        assert [(h["date"], h["price"]) for h in o[k].get("observations", [])] == [(h["date"], h["price"]) for h in n[k].get("observations", [])]
    for b in rc.BUCKETS:  # the same routes land in the same buckets, in the same order
        assert [r["route_key"] for r in old[b]] == [r["route_key"] for r in new[b]], b
    return old, new


def test_golden_every_verdict_matches_the_live_script():
    flat = [500 + (i % 5) for i in range(20)]
    feed = {
        "JFK:Deal City": feed_entry("JFK", "Deal City", "long_haul", ticket(300)),                    # far below a flat median
        "JFK:Typical City": feed_entry("JFK", "Typical City", "long_haul", ticket(502)),              # near the median
        "JFK:Shallow City": feed_entry("JFK", "Shallow City", "shoulder_season", ticket(470)),        # below, but under the 15% floor
        "JFK:New City": feed_entry("JFK", "New City", "low_cost_carrier", ticket(400)),               # too little history
        "JFK:Short City": feed_entry("JFK", "Short City", "long_haul", ticket(400)),                  # 10 days but span too short
        "LAX:Featured City": feed_entry("LAX", "Featured City", "featured", ticket(250)),            # not judged against a median
        "LAX:Leaving City": feed_entry("LAX", "Leaving City", "long_haul", ticket(200, dep=(NOW + timedelta(hours=10)).isoformat())),  # leaves within 48 h
        "LAX:Empty City": feed_entry("LAX", "Empty City", "long_haul"),
    }
    history = {
        "JFK:Deal City": points(flat), "JFK:Typical City": points(flat),
        "JFK:Shallow City": points([500] * 20), "JFK:New City": points([500] * 4),
        "JFK:Short City": points([500] * 10), "LAX:Featured City": points(flat),
        "LAX:Leaving City": points(flat), "LAX:Empty City": points(flat),
    }
    old, new = assert_same(feed, history)
    k = by_key(new)
    assert k["JFK:Deal City"]["status"] == "deal"
    assert k["JFK:Typical City"]["status"] == "priced_no_deal"
    assert k["JFK:Shallow City"]["status"] == "priced_no_deal"
    assert k["JFK:New City"]["status"] == "insufficient_history"
    assert k["LAX:Featured City"]["status"] == "featured"
    assert k["LAX:Leaving City"]["status"] == "no_data"


def test_golden_a_stale_fallback_is_carried_from_the_previous_output_the_same_way():
    flat = [500] * 20
    feed = {"JFK:Gone City": feed_entry("JFK", "Gone City", "long_haul")}  # no fare today
    history = {"JFK:Gone City": points(flat)}
    previous = {"schema_version": 1, "generated_at": "2026-10-24T08:00:00+00:00", "deals": [], "featured": [], "no_data": [], "insufficient_history": [],
                "priced_no_deal": [{
                    "display_name": "Gone City", "route_key": "JFK:Gone City", "origin": "JFK", "group": "long_haul", "status": "priced_no_deal",
                    "price": 480, "booking_link": "x", "airline": "OZ", "departure_at": DEP, "return_at": RET, "history_points": 20,
                    "last_fresh_date": iso(-1), "observations": points(flat), "median_baseline": 500, "trailing_avg": 500, "pct_below_avg": 0.04,
                    "basis_text": "4% below 30-day median, 20 observations", "is_stale_fallback": False}]}
    old, new = assert_same(feed, history, previous)
    assert by_key(new)["JFK:Gone City"]["is_stale_fallback"] is True


def test_golden_a_deal_is_never_a_deal_when_carried_forward():
    flat = [500] * 20
    feed = {"JFK:Gone City": feed_entry("JFK", "Gone City", "long_haul")}
    history = {"JFK:Gone City": points(flat)}
    previous = {"schema_version": 1, "generated_at": "x", "featured": [], "no_data": [], "insufficient_history": [], "priced_no_deal": [], "deals": [{
        "display_name": "Gone City", "route_key": "JFK:Gone City", "origin": "JFK", "group": "long_haul", "status": "deal", "price": 300,
        "booking_link": "x", "airline": "OZ", "departure_at": DEP, "return_at": RET, "history_points": 20, "last_fresh_date": iso(-1),
        "observations": points(flat), "median_baseline": 500, "pct_below_avg": 0.4, "basis_text": "x", "is_stale_fallback": False}]}
    old, new = assert_same(feed, history, previous)
    assert by_key(new)["JFK:Gone City"]["status"] == "priced_no_deal"


def test_todays_own_price_and_days_older_than_the_window_are_left_out_of_the_history():
    rows = [
        {"route_key": "JFK:A", "obs_date": iso(-40), "min_price": 100, "first_seen_at": None},   # older than 30 days
        {"route_key": "JFK:A", "obs_date": iso(-30), "min_price": 200, "first_seen_at": None},   # the oldest day kept
        {"route_key": "JFK:A", "obs_date": iso(-1), "min_price": 300, "first_seen_at": "2026-10-24T06:00:00Z"},
    ]
    h = rc.history_from_rows(rows, NOW, 30)
    assert [p["date"] for p in h["JFK:A"]] == [iso(-30), iso(-1)]
    feed = {"JFK:A": feed_entry("JFK", "A", "long_haul", ticket(250))}
    rows.append({"route_key": "JFK:A", "obs_date": iso(0), "min_price": 1, "first_seen_at": None})  # today's price must not bias the median
    out = rc.rank_shadow(feed, rows, None, NOW, rules)
    assert [(o["date"], o["price"]) for o in by_key(out)["JFK:A"]["observations"]] == [(iso(-30), 200), (iso(-1), 300)]


def test_the_shadow_job_posts_no_events_leaves_the_script_untouched_and_creates_no_files(tmp_path, monkeypatch):
    calls = []
    monkeypatch.setattr(rules.requests, "post", lambda *a, **k: calls.append(a))
    before = (rules.PRICE_FEED_PATH, rules.HISTORY_PATH, rules.RANKED_OUTPUT_PATH, rules.datetime, rules.requests.post)
    monkeypatch.chdir(tmp_path)
    flat = [500] * 20
    # a fare that is eligible and below the median would normally be "suppressed" only when history is thin; thin history triggers the POST
    feed = {"JFK:Thin City": feed_entry("JFK", "Thin City", "long_haul", ticket(400))}
    rc.rank_shadow(feed, rows_from_history({"JFK:Thin City": points([500] * 4)}), None, NOW, rules)
    assert calls == []
    assert (rules.PRICE_FEED_PATH, rules.HISTORY_PATH, rules.RANKED_OUTPUT_PATH, rules.datetime, rules.requests.post) == before
    assert list(tmp_path.iterdir()) == []
    served = ROOT / "sparkfare_ranked_deals.json"
    assert served.exists()  # the committed serving file is only ever an input (--previous), never the --out target by default
    assert flat  # keep the fixture referenced


def test_route_verdict_rows_load_into_the_real_table_and_loading_twice_changes_nothing():
    feed = {"JFK:Deal City": feed_entry("JFK", "Deal City", "long_haul", ticket(300)), "JFK:Featured": feed_entry("JFK", "Featured", "featured", ticket(250))}
    history = {"JFK:Deal City": points([500 + (i % 5) for i in range(20)]), "JFK:Featured": points([500] * 20)}
    out = rc.rank_shadow(feed, rows_from_history(history), None, NOW, rules)
    rows = rc.verdict_rows(out, "2026-10-25")
    db = sqlite3.connect(":memory:")
    db.executescript((ROOT / "migrations" / "0036_curated_store.sql").read_text())
    sql = rc.verdicts_sql(rows)
    db.executescript(sql)
    db.executescript(sql)
    got = {r[0]: r for r in db.execute("SELECT route_key, verdict_date, median_price, distinct_days, pct_vs_median, verdict, rule_version FROM route_verdict")}
    assert len(got) == 2
    assert got["JFK:Deal City"][5] == "deal" and got["JFK:Deal City"][6] == rc.RULE_VERSION
    assert got["JFK:Deal City"][3] == 20 and got["JFK:Deal City"][4] > 15
    assert got["JFK:Featured"][5] == "featured" and got["JFK:Featured"][4] is None  # no median verdict for a featured fare


def test_verdict_sql_escapes_quotes():
    sql = rc.verdicts_sql([{"route_key": "JFK:Cote d'Azur", "verdict_date": "2026-10-25", "median_price": None, "distinct_days": 3,
                            "pct_vs_median": None, "verdict": "no_data", "rule_version": "v"}])
    db = sqlite3.connect(":memory:")
    db.executescript((ROOT / "migrations" / "0036_curated_store.sql").read_text())
    db.executescript(sql)
    assert db.execute("SELECT route_key FROM route_verdict").fetchone()[0] == "JFK:Cote d'Azur"


# ---------- the diff -------------------------------------------------------------------------------

def doc(*records, bucket="priced_no_deal"):
    d = {b: [] for b in rc.BUCKETS}
    for r in records:
        d.setdefault(r.pop("_bucket", bucket), []).append(r)
    return d


def rec(key, status="priced_no_deal", price=500, median=550, mean_pct=0.1, origin="JFK", **extra):
    return {"route_key": key, "display_name": key.split(":")[1], "origin": origin, "status": status, "price": price,
            "median_baseline": median, "pct_below_avg": mean_pct, **extra}


def test_diff_identical_files_are_clean():
    a = doc(rec("JFK:A"), rec("JFK:B", price=400, median=600))
    d = sd.diff_files(copy.deepcopy(a), a)
    assert sd.clean(d["_all"]) and d["_all"]["served"] == 2 and d["_all"]["shadow"] == 2 and d["transitions"] == {}


def test_diff_counts_missing_added_status_price_and_pct_differences():
    served = doc(rec("JFK:A"), rec("JFK:B"), rec("JFK:C"), rec("JFK:D"), rec("JFK:Gone"))
    shadow = doc(rec("JFK:A", status="deal", _bucket="deals"), rec("JFK:B", price=510), rec("JFK:C", median=700), rec("JFK:D", mean_pct=0.1005), rec("JFK:New"))
    d = sd.diff_files(shadow, served)["_all"]
    assert d["missing"] == 1 and d["added"] == 1
    assert d["status_changes"] == 1 and d["price_diffs"] == 1
    assert d["pct_median_diffs"] == 2  # B: price moved the median-based figure too; C: median moved
    assert d["pct_mean_diffs"] == 0    # D differs by 0.005 point: under the 0.1 point tolerance
    assert d["served_deals"] == 0 and d["shadow_deals"] == 1


def test_diff_splits_by_origin_and_records_transitions():
    served = doc(rec("JFK:A", status="deal", _bucket="deals"), rec("LAX:B", origin="LAX"))
    shadow = doc(rec("JFK:A"), rec("LAX:B", origin="LAX"))
    d = sd.diff_files(shadow, served)
    assert d["JFK"]["status_changes"] == 1 and d["LAX"]["status_changes"] == 0
    assert d["transitions"] == {"deal -> priced_no_deal": 1}


def test_the_report_is_counts_only():
    served = doc(rec("JFK:Secret Route", status="deal", price=123, _bucket="deals"))
    shadow = doc(rec("JFK:Secret Route", price=124))
    md = sd.render_markdown("2026-10-25", {"daily_jfk": sd.diff_files(shadow, served), "hourly": None})
    assert "Secret Route" not in md and "123" not in md and "124" not in md
    assert "Not compared" in md and "differences below" in md and "deal -> priced_no_deal: 1" in md


def test_the_cli_writes_the_report_and_the_pointer(tmp_path):
    a = doc(rec("JFK:A"))
    (tmp_path / "s.json").write_text(json.dumps(a))
    (tmp_path / "v.json").write_text(json.dumps(a))
    assert sd.main(["--pair", "daily_jfk", str(tmp_path / "s.json"), str(tmp_path / "v.json"), "--pair", "other", str(tmp_path / "nope.json"), str(tmp_path / "v.json"),
                    "--date", "2026-10-25", "--out", str(tmp_path / "d.md"), "--json-out", str(tmp_path / "d.json")]) == 0
    j = json.loads((tmp_path / "d.json").read_text())
    assert j["date"] == "2026-10-25" and j["files"]["daily_jfk"]["clean"] is True and j["files"]["other"] is None
    assert "identical" in (tmp_path / "d.md").read_text()


def test_the_clock_is_the_one_passed_in_not_the_wall_clock():
    # With now = Feb 9 2027 the fixture fare (leaving Feb 10) is inside the 48-hour buffer, so the route has no fare;
    # with the real clock (2026) it would be a normal priced route.
    later = datetime(2027, 2, 9, 8, 0, tzinfo=timezone.utc)
    feed = {"JFK:A": feed_entry("JFK", "A", "long_haul", ticket(400, dep="2027-02-10T10:00:00+00:00"))}
    rows = [{"route_key": "JFK:A", "obs_date": (later.date() - timedelta(days=i)).isoformat(), "min_price": 500, "first_seen_at": None} for i in range(1, 21)]
    assert by_key(rc.rank_shadow(feed, rows, None, later, rules))["JFK:A"]["status"] == "no_data"
    assert by_key(rc.rank_shadow(feed, rows, None, NOW, rules))["JFK:A"]["status"] != "no_data"
