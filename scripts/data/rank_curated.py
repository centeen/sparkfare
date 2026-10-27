#!/usr/bin/env python3
"""One ranking job, in shadow (Addendum N, N10; framework D2).

Ranks a fetch output against the CURATED history (`fare_daily`, built by scripts/data/curate.py) instead of the per-pipeline history
files, and writes a serving file with the same name and shape as today's.  Nothing here touches a served file: the output goes
wherever --out says (the workflow sends it to `serving-shadow/` in the private bucket).

The rules are not copied.  The existing ranking script is loaded by file path and its own `rank_deals()` is run, with its path
constants pointed at temporary files, so the D-021 deal floor, the rare-find (MAD) test, 10 distinct days over 14, the 48-hour
rules and the stale-fallback carry-forward are literally the same code (Addendum N decision A: no edit to the live script before Nov 9).
Only two things differ from a normal run, both on purpose:
  * the history comes from `fare_daily` (30 days before today, today excluded, one route key format for every origin);
  * the `deal_suppressed` event POST (to localhost, up to 3 s each) is switched off, and the history file the script would write is a
    throwaway.

  python scripts/data/rank_curated.py --feed FEED.json --fare-daily ROWS.json --out OUT.json
         [--previous PREV.json] [--now 2026-10-26T08:00:00+00:00] [--verdicts-sql OUT.sql]
    ROWS.json  a list of {route_key, obs_date, min_price, first_seen_at} (the columns of fare_daily)
"""
import argparse
import importlib.util
import json
import re
import shutil
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RULES_PATH = ROOT / "Phase 1 Deal Ranking Script (Step 9 - with fallback).py"
RULE_VERSION = "d021-j1"  # recorded on every route_verdict row; change it when the ranking rules change


def load_rules():
    """The live ranking script, loaded by path under another module name (it is never run as __main__ here)."""
    spec = importlib.util.spec_from_file_location("sparkfare_ranking_rules", RULES_PATH)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def frozen_datetime(now):
    """A datetime class whose now() is fixed: the ranking script reads the clock through its module-level `datetime`."""
    class Frozen(datetime):
        @classmethod
        def now(cls, tz=None):
            return now if tz is None else now.astimezone(tz)
    return Frozen


def history_from_rows(rows, now, window_days):
    """fare_daily rows -> the history format the ranking script reads: {route_key: [{date, price, found_at, expires_at}]}.
    Same window as update_history(): dates from today minus window_days; today itself is left out by classify_destination()."""
    cutoff = (now.date() - timedelta(days=window_days)).isoformat()
    history = {}
    for r in sorted(rows, key=lambda r: (r["route_key"], r["obs_date"])):
        if r["obs_date"] < cutoff:
            continue
        history.setdefault(r["route_key"], []).append({
            "date": r["obs_date"], "price": r["min_price"], "found_at": r.get("first_seen_at"), "expires_at": None,
        })
    return history


def rank_shadow(feed, rows, previous=None, now=None, rules=None):
    """Run the live ranking code on `feed` against the curated history.  Returns the serving-file dict."""
    rules = rules or load_rules()
    now = now or datetime.now(timezone.utc)
    work = Path(tempfile.mkdtemp(prefix="rank-curated-"))
    saved = (rules.PRICE_FEED_PATH, rules.HISTORY_PATH, rules.RANKED_OUTPUT_PATH, rules.datetime, rules.requests.post)
    try:
        (work / "feed.json").write_text(json.dumps(feed), encoding="utf-8")
        (work / "history.json").write_text(json.dumps(history_from_rows(rows, now, rules.HISTORY_WINDOW_DAYS)), encoding="utf-8")
        if previous is not None:  # the script reads the previous output from its output path: that is the carry-forward source
            (work / "out.json").write_text(json.dumps(previous), encoding="utf-8")
        rules.PRICE_FEED_PATH, rules.HISTORY_PATH, rules.RANKED_OUTPUT_PATH = work / "feed.json", work / "history.json", work / "out.json"
        rules.datetime = frozen_datetime(now)
        rules.requests.post = lambda *a, **k: None
        rules.rank_deals()
        return json.loads((work / "out.json").read_text(encoding="utf-8"))
    finally:
        rules.PRICE_FEED_PATH, rules.HISTORY_PATH, rules.RANKED_OUTPUT_PATH, rules.datetime, rules.requests.post = saved
        shutil.rmtree(work, ignore_errors=True)


BUCKETS = ("deals", "featured", "priced_no_deal", "insufficient_history", "no_data")


def verdict_rows(output, verdict_date):
    """One route_verdict row per record that has a route key.  pct_vs_median is in percentage points below the 30-day median."""
    rows = {}
    for bucket in BUCKETS:
        for rec in output.get(bucket, []):
            rk = rec.get("route_key")
            if not rk:
                continue
            median_price, price = rec.get("median_baseline"), rec.get("price")
            pct = None
            if isinstance(median_price, (int, float)) and median_price > 0 and isinstance(price, (int, float)):
                pct = round((median_price - price) / median_price * 100, 2)
            rows[rk] = {
                "route_key": rk, "verdict_date": verdict_date, "median_price": median_price,
                "distinct_days": len(rec.get("observations") or []) or rec.get("history_points"),
                "pct_vs_median": pct, "verdict": rec.get("status"), "rule_version": RULE_VERSION,
            }
    return list(rows.values())


def _sql(v):
    if v is None:
        return "NULL"
    if isinstance(v, (int, float)):
        return repr(float(v)) if isinstance(v, float) else str(v)
    return "'" + str(v).replace("'", "''") + "'"


def verdicts_sql(rows):
    cols = ["route_key", "verdict_date", "median_price", "distinct_days", "pct_vs_median", "verdict", "rule_version"]
    return "\n".join(
        f"INSERT OR REPLACE INTO route_verdict ({', '.join(cols)}) VALUES ({', '.join(_sql(r[c]) for c in cols)});" for r in rows
    ) + ("\n" if rows else "")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--feed", required=True)
    ap.add_argument("--fare-daily", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--previous")
    ap.add_argument("--now")
    ap.add_argument("--verdicts-sql")
    a = ap.parse_args(argv)
    now = datetime.fromisoformat(a.now) if a.now else datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    feed = json.loads(Path(a.feed).read_text(encoding="utf-8"))
    rows = json.loads(Path(a.fare_daily).read_text(encoding="utf-8"))
    previous = json.loads(Path(a.previous).read_text(encoding="utf-8")) if a.previous and Path(a.previous).exists() else None
    out = rank_shadow(feed, rows, previous, now)
    Path(a.out).write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    if a.verdicts_sql:
        Path(a.verdicts_sql).write_text(verdicts_sql(verdict_rows(out, now.date().isoformat())), encoding="utf-8")
    print(json.dumps({b: len(out.get(b, [])) for b in BUCKETS}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
