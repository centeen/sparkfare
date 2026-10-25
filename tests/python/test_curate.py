"""Tests for the N9 curated store builder (scripts/data/curate.py) against the real migration, in an in-memory SQLite.

Run: py -m pytest tests/python
"""
import importlib.util
import itertools
import json
import random
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("curate", ROOT / "scripts" / "data" / "curate.py")
cu = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cu)
MIGRATION = (ROOT / "migrations" / "0036_curated_store.sql").read_text()


def result(price, dep="2027-03-01T10:30:00+00:00", airline="OZ", ret="2027-03-17T01:20:00+00:00"):
    return {"price": price, "airline": airline, "departure_at": dep, "return_at": ret}


def entry(origin, dest, fetched, *results):
    return {"display_name": dest, "origin": origin, "fetched_at": fetched, "results": list(results)}


def feed(*entries, bare_jfk=False):
    out = {}
    for e in entries:
        key = e["display_name"] if bare_jfk and e["origin"] == "JFK" else f"{e['origin']}:{e['display_name']}"
        out[key] = e
    return out


def curate_feeds(*feeds):
    cands = []
    for f in feeds:
        cands += cu.candidates_from_feed(f)[0]
    return cu.merge(cands)


def apply(rows, db=None):
    db = db or sqlite3.connect(":memory:")
    if not db.execute("select 1 from sqlite_master where name='fare_daily'").fetchone():
        db.executescript(MIGRATION)
    for r in rows:
        db.executescript(cu.row_sql(r))
    return db


def dump(db):
    return db.execute("select * from fare_daily order by route_key, obs_date").fetchall()


def test_cheapest_price_of_the_day_wins_across_runs():
    rows = curate_feeds(
        feed(entry("LAX", "Bali, Indonesia", "2026-10-20T01:00:00+00:00", result(900))),
        feed(entry("LAX", "Bali, Indonesia", "2026-10-20T07:00:00+00:00", result(800, airline="GA"))),
        feed(entry("LAX", "Bali, Indonesia", "2026-10-20T19:00:00+00:00", result(950))),
    )
    assert len(rows) == 1
    r = rows[0]
    assert (r["route_key"], r["obs_date"], r["min_price"], r["airline"], r["n_obs"]) == ("LAX:Bali, Indonesia", "2026-10-20", 800, "GA", 3)
    assert r["first_seen_at"] == "2026-10-20T01:00:00Z" and r["last_run_id"] == "20261020T190000Z"


def test_a_fare_departing_inside_the_buffer_is_not_a_fare():
    soon = "2026-10-21T00:00:00+00:00"  # 23 hours after the fetch
    rows = curate_feeds(feed(entry("ORD", "Tokyo, Japan", "2026-10-20T01:00:00+00:00", result(100, dep=soon), result(700))))
    assert rows[0]["min_price"] == 700
    assert curate_feeds(feed(entry("ORD", "Tokyo, Japan", "2026-10-20T01:00:00+00:00", result(100, dep=soon)))) == []


def test_jfk_daily_and_multi_origin_merge_into_one_history_with_the_cheapest_kept():
    daily = feed(entry("JFK", "Bali, Indonesia", "2026-10-20T08:00:00+00:00", result(507)), bare_jfk=True)  # bare key, as the daily fetch writes it
    hourly = feed(entry("JFK", "Bali, Indonesia", "2026-10-20T14:00:00+00:00", result(480, airline="QR")))
    rows = curate_feeds(daily, hourly)
    assert [(r["route_key"], r["min_price"], r["airline"], r["n_obs"]) for r in rows] == [("JFK:Bali, Indonesia", 480, "QR", 2)]


def test_history_keys_are_normalised_and_unknown_shapes_are_skipped():
    assert cu.normalize_route_key("JFK:JFK:Bali, Indonesia") == "JFK:Bali, Indonesia"
    assert cu.normalize_route_key("LAX:Bali, Indonesia") == "LAX:Bali, Indonesia"
    assert cu.normalize_route_key("Bali, Indonesia", jfk_bare=True) == "JFK:Bali, Indonesia"
    assert cu.normalize_route_key("Bali, Indonesia", jfk_bare=False) is None
    hist = {"JFK:JFK:Bali, Indonesia": [{"date": "2026-09-03", "price": 840}], "Tokyo, Japan": [{"date": "2026-09-03", "price": 900}],
            "LAX:Rome, Italy": [{"date": "2026-09-03", "price": -5}, {"date": "bad", "price": 5}]}
    c, skipped = cu.candidates_from_history(hist, "sparkfare_hourly_price_history.json")
    assert [x["route_key"] for x in c] == ["JFK:Bali, Indonesia"] and skipped == 3
    c, _ = cu.candidates_from_history(hist, "sparkfare_price_history.json")
    assert sorted(x["route_key"] for x in c) == ["JFK:Bali, Indonesia", "JFK:Tokyo, Japan"]


def test_a_history_price_below_the_fetched_ones_wins_and_a_history_only_day_has_one_observation():
    f = feed(entry("JFK", "Bali, Indonesia", "2026-09-06T18:00:00+00:00", result(900)))
    hist = {"JFK:Bali, Indonesia": [{"date": "2026-09-06", "price": 810, "found_at": "2026-09-06T02:00:00+00:00"}, {"date": "2026-09-03", "price": 840}]}
    cands = cu.candidates_from_feed(f)[0] + cu.candidates_from_history(hist, "sparkfare_price_history.json")[0]
    by_date = {r["obs_date"]: r for r in cu.merge(cands)}
    assert by_date["2026-09-06"]["min_price"] == 810 and by_date["2026-09-06"]["airline"] is None and by_date["2026-09-06"]["n_obs"] == 1
    assert by_date["2026-09-06"]["first_seen_at"] == "2026-09-06T02:00:00Z"
    d3 = by_date["2026-09-03"]
    assert (d3["min_price"], d3["n_obs"], d3["airline"]) == (840, 1, None)
    assert d3["first_seen_at"] == "2026-09-03T00:00:00Z"  # no real time known: the stand-in is used


def test_a_tie_prefers_the_candidate_that_has_the_airline():
    f = feed(entry("JFK", "Bali, Indonesia", "2026-09-06T18:00:00+00:00", result(810, airline="OZ")))
    hist = {"JFK:Bali, Indonesia": [{"date": "2026-09-06", "price": 810, "found_at": "2026-09-06T02:00:00+00:00"}]}
    r = cu.merge(cu.candidates_from_feed(f)[0] + cu.candidates_from_history(hist, "sparkfare_price_history.json")[0])[0]
    assert r["airline"] == "OZ" and r["first_seen_at"] == "2026-09-06T02:00:00Z"


def test_the_row_count_equals_the_distinct_route_days_in_the_raw_input():
    rnd = random.Random(7)
    feeds, expected = [], set()
    for run in range(40):
        t = datetime(2026, 10, 1 + run // 4, (run % 4) * 6, 5, tzinfo=timezone.utc).isoformat()
        es = []
        for origin, dest in itertools.product(["JFK", "LAX", "SEA"], ["Bali, Indonesia", "Rome, Italy", "Côte d'Azur, France"]):
            if rnd.random() < 0.7:
                es.append(entry(origin, dest, t, result(rnd.randint(300, 900))))
                expected.add((f"{origin}:{dest}", t[:10]))
        feeds.append(feed(*es))
    rows = curate_feeds(*feeds)
    assert {(r["route_key"], r["obs_date"]) for r in rows} == expected and len(rows) == len(expected)


def test_running_it_twice_and_in_any_order_changes_nothing():
    rnd = random.Random(11)
    feeds = [feed(entry("LAX", "Bali, Indonesia", f"2026-10-{d:02d}T{h:02d}:00:00+00:00", result(rnd.randint(300, 900), airline=rnd.choice("ABC"))))
             for d in range(1, 6) for h in (2, 9, 17)]
    rows = curate_feeds(*feeds)
    db = apply(rows)
    once = dump(db)
    apply(rows, db)
    assert dump(db) == once
    shuffled = rows[:]
    random.Random(3).shuffle(shuffled)
    assert dump(apply(shuffled)) == once


def test_an_upsert_can_only_lower_a_price_and_brings_its_own_airline():
    base = {"route_key": "LAX:Rome, Italy", "origin": "LAX", "destination": "Rome, Italy", "obs_date": "2026-10-20", "min_price": 500,
            "airline": "AA", "departure_at": "d1", "return_at": "r1", "n_obs": 3, "first_seen_at": "2026-10-20T05:00:00Z", "last_run_id": "20261020T050000Z"}
    db = apply([base])
    apply([dict(base, min_price=650, airline="ZZ", n_obs=1, first_seen_at="2026-10-20T09:00:00Z", last_run_id="20261020T090000Z")], db)
    (row,) = dump(db)
    assert (row[4], row[5], row[8], row[9], row[10]) == (500, "AA", 3, "2026-10-20T05:00:00Z", "20261020T090000Z")
    apply([dict(base, min_price=450, airline="BB", departure_at="d2", return_at="r2", n_obs=2, first_seen_at="2026-10-20T03:00:00Z")], db)
    (row,) = dump(db)
    assert (row[4], row[5], row[6], row[7], row[8], row[9]) == (450, "BB", "d2", "r2", 3, "2026-10-20T03:00:00Z")


def test_a_history_only_row_gets_its_airline_filled_when_a_feed_row_arrives_at_the_same_price():
    hist = {"route_key": "LAX:Rome, Italy", "origin": "LAX", "destination": "Rome, Italy", "obs_date": "2026-10-20", "min_price": 500,
            "airline": None, "departure_at": None, "return_at": None, "n_obs": 1, "first_seen_at": "2026-10-20T00:00:00Z", "last_run_id": "20261020T000000Z"}
    db = apply([hist])
    apply([dict(hist, airline="AA", departure_at="d", return_at="r", n_obs=2, last_run_id="20261020T120000Z")], db)
    (row,) = dump(db)
    assert (row[5], row[6], row[8]) == ("AA", "d", 2)


def test_values_with_quotes_are_escaped_and_a_nul_is_refused():
    rows = curate_feeds(feed(entry("LAX", "Côte d'Ivoire", "2026-10-20T01:00:00+00:00", result(700))))
    db = apply(rows)
    assert dump(db)[0][0] == "LAX:Côte d'Ivoire"
    try:
        cu.sql_value("a\x00b")
        raise AssertionError("expected ValueError")
    except ValueError:
        pass


def test_the_sql_is_split_into_files_of_at_most_the_requested_size(tmp_path):
    rows = curate_feeds(*[feed(entry("LAX", "Bali, Indonesia", f"2026-10-{d:02d}T01:00:00+00:00", result(700))) for d in range(1, 8)])
    files = cu.write_sql(rows, tmp_path, rows_per_file=3)
    assert files == ["fare_daily_0000.sql", "fare_daily_0001.sql", "fare_daily_0002.sql"]
    db = sqlite3.connect(":memory:")
    db.executescript(MIGRATION)
    for f in files:
        db.executescript((tmp_path / f).read_text(encoding="utf-8"))
    assert len(dump(db)) == 7


def test_the_migration_has_the_columns_the_addendum_names():
    db = sqlite3.connect(":memory:")
    db.executescript(MIGRATION)
    cols = lambda t: [r[1] for r in db.execute(f"pragma table_info({t})")]
    assert cols("fare_daily") == ["route_key", "origin", "destination", "obs_date", "min_price", "airline", "departure_at", "return_at", "n_obs", "first_seen_at", "last_run_id"]
    assert cols("route_verdict") == ["route_key", "verdict_date", "median_price", "distinct_days", "pct_vs_median", "verdict", "rule_version"]
    assert [r[1] for r in db.execute("pragma table_info(fare_daily)") if r[5]] == ["route_key", "obs_date"]


def test_staging_directory_end_to_end(tmp_path):
    (tmp_path / "feeds").mkdir()
    (tmp_path / "history").mkdir()
    (tmp_path / "feeds" / "run-1.json").write_text(json.dumps(feed(entry("JFK", "Bali, Indonesia", "2026-10-20T01:00:00+00:00", result(700)))))
    (tmp_path / "history" / "sparkfare_price_history.json__commit-abc.json").write_text(json.dumps({"Bali, Indonesia": [{"date": "2026-09-03", "price": 840}]}))
    cands, stats = cu.load_staging(tmp_path)
    rows = cu.merge(cands)
    assert stats["feed_files"] == 1 and stats["history_files"] == 1 and len(rows) == 2
    s = cu.summarise(rows, stats)
    assert s["routes"] == 1 and s["first_date"] == "2026-09-03" and s["origins"] == ["JFK"]


def test_since_date_keeps_only_recent_route_days_and_rejects_a_bad_date(tmp_path):
    rows = [{"obs_date": d} for d in ("2026-10-21", "2026-10-22", "2026-10-25")]
    assert [r["obs_date"] for r in cu.filter_since(rows, "2026-10-22")] == ["2026-10-22", "2026-10-25"]
    assert cu.filter_since(rows, None) == rows
    (tmp_path / "feeds").mkdir()
    try:
        cu.main(["--staging", str(tmp_path), "--out-dir", str(tmp_path / "o"), "--since-date", "yesterday"])
        assert False, "a bad date must be refused"
    except SystemExit as e:
        assert e.code == 2
