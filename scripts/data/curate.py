#!/usr/bin/env python3
"""Curated store builder (Addendum N, N9; framework D2): raw fares in, one row per route and day out.

For every route (key `<ORIGIN>:<destination>`, the same format for every origin including JFK) and every UTC day it keeps the
cheapest fare seen that day across all pipelines and sources (Workplan Step 65: cheapest of the day wins; ties prefer the
candidate that carries airline and dates, then the earliest fetch).  Two kinds of input:

  * feed files: a raw fetch output, route-keyed, `results[]` per route (the hourly snapshots and the daily JFK fetch);
  * history files: old versions of a price-history file, `{route_key: [{date, price, found_at}, ...]}` (the days the raw
    fetches never saw, back to 2026-09-03 for JFK).  Their route keys are normalised (a doubled origin prefix is stripped;
    a bare key in the JFK history file is JFK).

Output is SQL for the `fare_daily` table (migrations/0036): one INSERT ... ON CONFLICT upsert per route-day that can only lower
a stored price and only raise `n_obs` / `last_run_id`, so running it twice on the same raw, or in any order, changes nothing.
Nothing here reads the database, and nothing reads `fare_daily` yet.

  python scripts/data/curate.py --staging DIR --out-dir OUT [--rows-per-file 500]
    DIR/feeds/<anything>.json                      raw fetch outputs (run time = newest `fetched_at` inside)
    DIR/history/<history file name>__<label>.json  a version of one history file
  Prints a JSON summary (counts only) on stdout.
"""
import argparse
import json
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

DEPARTURE_BUFFER_HOURS = 48  # same rule as the ranking script's cheapest_result(): a fare leaving within 48 h is not a fare
JFK_DAILY_HISTORY = "sparkfare_price_history.json"
PREFIX = re.compile(r"^([A-Z]{3}):(?:\1:)*")


# ---------- small helpers -------------------------------------------------

def parse_time(value):
    """ISO-8601 -> aware UTC datetime, or None."""
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def iso_z(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def run_stamp(dt):
    return dt.strftime("%Y%m%dT%H%M%SZ")


def departs_too_soon(departure_at, now_dt):
    dep = parse_time(departure_at)
    return dep is not None and dep < now_dt + timedelta(hours=DEPARTURE_BUFFER_HOURS)


def valid_price(p):
    return isinstance(p, (int, float)) and not isinstance(p, bool) and p > 0


def normalize_route_key(key, jfk_bare=False):
    """`JFK:JFK:Bali` -> `JFK:Bali`; a bare name -> `JFK:<name>` only in the JFK daily history file; otherwise None."""
    m = PREFIX.match(key)
    if m:
        return m.group(1) + ":" + key[m.end():]
    return f"JFK:{key}" if jfk_bare and key else None


# ---------- candidates ------------------------------------------------------

def candidates_from_feed(feed):
    """Every route's cheapest usable fare in one raw fetch output.  Returns (candidates, run_time or None, skipped count)."""
    run_dt = None
    for entry in feed.values():
        t = parse_time(entry.get("fetched_at")) if isinstance(entry, dict) else None
        if t and (run_dt is None or t > run_dt):
            run_dt = t
    out, skipped = [], 0
    for key, entry in feed.items():
        if not isinstance(entry, dict) or not isinstance(entry.get("results"), list):
            continue
        origin = entry.get("origin")
        dest = entry.get("display_name") or key.split(":", 1)[-1]
        fetched = parse_time(entry.get("fetched_at")) or run_dt
        if not origin or not dest or fetched is None:
            skipped += 1
            continue
        usable = [r for r in entry["results"] if valid_price(r.get("price")) and not departs_too_soon(r.get("departure_at"), fetched)]
        if not usable:
            continue
        best = min(usable, key=lambda r: r["price"])
        out.append({
            "route_key": f"{origin}:{dest}", "origin": origin, "destination": dest,
            "obs_date": fetched.date().isoformat(), "price": best["price"], "airline": best.get("airline"),
            "departure_at": best.get("departure_at"), "return_at": best.get("return_at"),
            "seen_at": fetched, "run_id": run_stamp(fetched), "feed": True, "exact": True,
        })
    return out, run_dt, skipped


def candidates_from_history(history, source_file):
    """One candidate per recorded day in a version of a price-history file.  Returns (candidates, skipped count)."""
    jfk_bare = source_file == JFK_DAILY_HISTORY
    out, skipped = [], 0
    for key, points in history.items():
        rk = normalize_route_key(key, jfk_bare)
        if rk is None or not isinstance(points, list):
            skipped += 1
            continue
        origin, dest = rk.split(":", 1)
        for p in points:
            if not isinstance(p, dict) or not valid_price(p.get("price")) or not re.match(r"^\d{4}-\d\d-\d\d$", str(p.get("date", ""))[:10]):
                skipped += 1
                continue
            date = str(p["date"])[:10]
            found = parse_time(p.get("found_at"))
            seen = found or datetime.fromisoformat(date + "T00:00:00+00:00")
            out.append({
                "route_key": rk, "origin": origin, "destination": dest, "obs_date": date, "price": p["price"],
                "airline": None, "departure_at": None, "return_at": None,
                "seen_at": seen, "run_id": run_stamp(seen), "feed": False, "exact": found is not None,
            })
    return out, skipped


# ---------- merge -------------------------------------------------------------

def _better(a, b):
    """True if candidate a should win over b: cheaper; on a tie more detail (airline known), then the earlier sighting."""
    if a["price"] != b["price"]:
        return a["price"] < b["price"]
    if bool(a["airline"]) != bool(b["airline"]):
        return bool(a["airline"])
    return a["seen_at"] < b["seen_at"]


def merge(candidates):
    """Collapse candidates to one row per (route_key, obs_date).  Order of the input does not change the result.
    A history-file point with no fetch time gets midnight as a stand-in; that stand-in is used for first_seen_at and
    last_run_id only when the day has no point with a real time."""
    groups = {}
    for c in candidates:
        groups.setdefault((c["route_key"], c["obs_date"]), []).append(c)
    out = []
    for (rk, date), cs in sorted(groups.items()):
        best = cs[0]
        for c in cs[1:]:
            if _better(c, best):
                best = c
        timed = [c for c in cs if c["exact"]] or cs
        out.append({
            "route_key": rk, "origin": best["origin"], "destination": best["destination"], "obs_date": date,
            "min_price": best["price"], "airline": best["airline"], "departure_at": best["departure_at"], "return_at": best["return_at"],
            "n_obs": max(len({c["run_id"] for c in cs if c["feed"]}), 1),
            "first_seen_at": iso_z(min(c["seen_at"] for c in timed)), "last_run_id": max(c["run_id"] for c in timed),
        })
    return out


# ---------- SQL ----------------------------------------------------------------

def sql_value(v):
    if v is None:
        return "NULL"
    if isinstance(v, (int, float)):
        return repr(float(v)) if isinstance(v, float) else str(v)
    s = str(v)
    if "\x00" in s:
        raise ValueError("NUL character in a value")
    return "'" + s.replace("'", "''") + "'"


COLUMNS = ["route_key", "origin", "destination", "obs_date", "min_price", "airline", "departure_at", "return_at",
           "n_obs", "first_seen_at", "last_run_id"]

# On a conflict the cheaper price wins and brings its own airline and dates; an equal price keeps the stored row and only fills gaps.
UPSERT_TAIL = """ON CONFLICT(route_key, obs_date) DO UPDATE SET
  airline = CASE WHEN excluded.min_price < fare_daily.min_price THEN excluded.airline ELSE COALESCE(fare_daily.airline, excluded.airline) END,
  departure_at = CASE WHEN excluded.min_price < fare_daily.min_price THEN excluded.departure_at ELSE COALESCE(fare_daily.departure_at, excluded.departure_at) END,
  return_at = CASE WHEN excluded.min_price < fare_daily.min_price THEN excluded.return_at ELSE COALESCE(fare_daily.return_at, excluded.return_at) END,
  min_price = MIN(fare_daily.min_price, excluded.min_price),
  n_obs = MAX(fare_daily.n_obs, excluded.n_obs),
  first_seen_at = CASE WHEN fare_daily.first_seen_at IS NULL OR excluded.first_seen_at < fare_daily.first_seen_at THEN excluded.first_seen_at ELSE fare_daily.first_seen_at END,
  last_run_id = CASE WHEN fare_daily.last_run_id IS NULL OR excluded.last_run_id > fare_daily.last_run_id THEN excluded.last_run_id ELSE fare_daily.last_run_id END;"""


def row_sql(row):
    values = ", ".join(sql_value(row[c]) for c in COLUMNS)
    return f"INSERT INTO fare_daily ({', '.join(COLUMNS)}) VALUES ({values})\n{UPSERT_TAIL}"


def write_sql(rows, out_dir, rows_per_file=500):
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    files = []
    for i in range(0, len(rows), rows_per_file):
        path = out_dir / f"fare_daily_{i // rows_per_file:04d}.sql"
        path.write_text("\n".join(row_sql(r) for r in rows[i:i + rows_per_file]) + "\n", encoding="utf-8")
        files.append(path.name)
    return files


# ---------- staging directory -----------------------------------------------------

def load_staging(staging):
    staging = Path(staging)
    cands, stats = [], {"feed_files": 0, "history_files": 0, "skipped_entries": 0, "feed_files_without_run_time": 0}
    for f in sorted((staging / "feeds").glob("*.json")) if (staging / "feeds").is_dir() else []:
        feed = json.loads(f.read_text(encoding="utf-8"))
        c, run_dt, skipped = candidates_from_feed(feed)
        if run_dt is None:
            stats["feed_files_without_run_time"] += 1
        cands += c
        stats["feed_files"] += 1
        stats["skipped_entries"] += skipped
    for f in sorted((staging / "history").glob("*.json")) if (staging / "history").is_dir() else []:
        source = f.name.split("__", 1)[0]
        c, skipped = candidates_from_history(json.loads(f.read_text(encoding="utf-8")), source)
        cands += c
        stats["history_files"] += 1
        stats["skipped_entries"] += skipped
    return cands, stats


def summarise(rows, stats):
    by_route = {}
    for r in rows:
        by_route.setdefault(r["route_key"], set()).add(r["obs_date"])
    depth = sorted(len(v) for v in by_route.values())
    dates = sorted({r["obs_date"] for r in rows})
    return {
        **stats, "rows": len(rows), "routes": len(by_route),
        "first_date": dates[0] if dates else None, "last_date": dates[-1] if dates else None,
        "days_per_route_min": depth[0] if depth else 0, "days_per_route_median": depth[len(depth) // 2] if depth else 0,
        "days_per_route_max": depth[-1] if depth else 0,
        "origins": sorted({r["origin"] for r in rows}),
    }


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--staging", required=True)
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--rows-per-file", type=int, default=500)
    a = ap.parse_args(argv)
    cands, stats = load_staging(a.staging)
    rows = merge(cands)
    files = write_sql(rows, a.out_dir, a.rows_per_file)
    print(json.dumps({**summarise(rows, stats), "sql_files": len(files)}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
