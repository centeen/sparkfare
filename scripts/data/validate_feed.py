#!/usr/bin/env python3
"""Validation gate for a fare pipeline run (Addendum N, N2; framework DR-09, DR-10, DR-11, DR-13).

Runs after ranking and before the workflow commits anything.  It checks the ranked serving file and the fetch store
against schemas/ and config/data_quality.json and writes a result file.  Fail closed:

  * a file-level failure (schema, doubled origin prefix, duplicate routes, too few priced routes, too many failed calls,
    too many bad records) sets status "blocked" and exits 1; the workflow then restores yesterday's files and does not
    commit, so the board keeps serving the last good data;
  * a record-level failure (unknown origin or destination, bad price, departure inside the buffer, return before
    departure) removes just that record from the ranked file and lists it in the quarantine file with a reason code,
    as long as such records are under max_quarantine_ratio of the priced records.

No prices or personal data go into the result file: counts, check ids and reason codes only (quarantined records are
listed by route key and reason in the separate quarantine file, which is raw-archive material, never served).

  python scripts/data/validate_feed.py --pipeline multi_origin --ranked sparkfare_hourly_ranked_deals.json \
      --store sparkfare_hourly_flight_prices.json --stats fetch_run_stats.json --baseline baseline.json \
      --out validation_result.json --quarantine-out quarantine.json --write-clean
"""
import argparse
import json
import re
import statistics
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BUCKETS = ["deals", "featured", "priced_no_deal", "insufficient_history", "no_data"]
PRICED_BUCKETS = ["deals", "featured", "priced_no_deal"]
DOUBLE_PREFIX = re.compile(r"^[A-Z]{3}:[A-Z]{3}:")
MIN_BASELINE_POINTS = 3

# Reason codes for quarantined records.
UNKNOWN_ORIGIN = "unknown_origin"
UNKNOWN_DESTINATION = "unknown_destination"
BAD_PRICE = "bad_price"
PRICE_OVER_CEILING = "price_over_ceiling"
DEPARTURE_TOO_SOON = "departure_inside_buffer"
BAD_DEPARTURE = "unreadable_departure"
RETURN_BEFORE_DEPARTURE = "return_before_departure"


def load_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def parse_dt(value):
    """Aware datetime from an ISO string with Z or an offset; None if it does not parse."""
    if not isinstance(value, str) or not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def schema_errors(instance, schema_path, limit=3):
    """First few schema violations as short strings; empty if valid.  Needs the jsonschema package."""
    import jsonschema  # imported here so the rest of the module can be used without it

    schema = load_json(schema_path)
    validator = jsonschema.Draft202012Validator(schema)
    out = []
    for err in validator.iter_errors(instance):
        where = "/".join(str(p) for p in list(err.absolute_path)[:4]) or "(root)"
        out.append(f"{where}: {err.message[:120]}")
        if len(out) >= limit:
            break
    return out


def record_problem(rec, cfg, destinations, now):
    """Reason code if a ranked record should be quarantined, else None."""
    if rec.get("origin") not in cfg["origins"]:
        return UNKNOWN_ORIGIN
    if rec.get("display_name") not in destinations:
        return UNKNOWN_DESTINATION
    price = rec.get("price")
    if price is None:
        return None  # records without a price (no_data, building history) have nothing more to check
    if isinstance(price, bool) or not isinstance(price, (int, float)) or price <= 0 or float(price) != int(price):
        return BAD_PRICE
    if price > cfg["price_ceiling_usd"]:
        return PRICE_OVER_CEILING
    dep = parse_dt(rec.get("departure_at"))
    if dep is None:
        return BAD_DEPARTURE
    if dep < now + timedelta(hours=cfg["departure_buffer_hours"]):
        return DEPARTURE_TOO_SOON
    ret = rec.get("return_at")
    if ret:
        r = parse_dt(ret)
        if r is None or r <= dep:
            return RETURN_BEFORE_DEPARTURE
    return None


def check(checks, cid, ok, detail="", skipped=False):
    checks.append({"id": cid, "status": "skipped" if skipped else ("pass" if ok else "fail"), "detail": detail})
    return ok


def validate(ranked, store, stats, baseline, cfg, destinations, pipeline, now=None, schemas_dir=None):
    """Returns (result, cleaned_ranked, quarantine).  cleaned_ranked is ranked minus quarantined records."""
    schemas_dir = Path(schemas_dir) if schemas_dir else ROOT / "schemas"
    checks = []
    quarantine = []

    # --- file level: schemas ---------------------------------------------------------------------------------
    r_errs = schema_errors(ranked, schemas_dir / "ranked_deals.schema.json")
    check(checks, "schema_ranked", not r_errs, "; ".join(r_errs))
    s_errs = schema_errors(store, schemas_dir / "fetch_store.schema.json") if store is not None else []
    check(checks, "schema_store", not s_errs, "; ".join(s_errs), skipped=store is None)

    if r_errs:  # nothing below can be trusted on a file that does not match its schema
        result = _result(pipeline, checks, {}, quarantine, stats, cfg, ranked)
        return result, ranked, quarantine

    gen = parse_dt(ranked.get("generated_at")) or datetime.now(timezone.utc)
    now = now or gen

    records = [(b, r) for b in BUCKETS for r in ranked[b]]

    # --- file level: keys ------------------------------------------------------------------------------------
    doubled = [r["route_key"] for _, r in records if DOUBLE_PREFIX.match(r["route_key"])]
    if store:
        doubled += [k for k in store if DOUBLE_PREFIX.match(k)]
    check(checks, "no_double_prefixed_keys", not doubled, f"{len(doubled)} key(s), e.g. {doubled[:2]}" if doubled else "")
    seen, dup = set(), []
    for _, r in records:
        if r["route_key"] in seen:
            dup.append(r["route_key"])
        seen.add(r["route_key"])
    check(checks, "one_record_per_route", not dup, f"{len(dup)} duplicate route key(s), e.g. {dup[:2]}" if dup else "")

    # --- record level -> quarantine --------------------------------------------------------------------------
    cleaned = {k: v for k, v in ranked.items() if k not in BUCKETS}
    for b in BUCKETS:
        cleaned[b] = []
    for b, r in records:
        reason = record_problem(r, cfg, destinations, now)
        if reason:
            quarantine.append({"route_key": r["route_key"], "bucket": b, "reason": reason})
        else:
            cleaned[b].append(r)
    priced_before = sum(len(ranked[b]) for b in PRICED_BUCKETS)
    ratio = len(quarantine) / priced_before if priced_before else 0.0
    check(checks, "records_valid", ratio <= cfg["max_quarantine_ratio"],
          f"{len(quarantine)} record(s) quarantined of {priced_before} priced ({ratio:.1%}); limit {cfg['max_quarantine_ratio']:.0%}" if quarantine else "")

    # --- file level: completeness ----------------------------------------------------------------------------
    priced = sum(len(cleaned[b]) for b in PRICED_BUCKETS)
    recent = [int(x) for x in (baseline or []) if isinstance(x, (int, float))][-cfg["recent_runs_for_median"]:]
    if len(recent) >= MIN_BASELINE_POINTS:
        floor = statistics.median(recent) * cfg["min_priced_ratio_of_recent_median"]
        check(checks, "priced_routes_vs_recent_median", priced >= floor,
              f"{priced} priced routes; the floor is {floor:.0f} (80% of the median of the last {len(recent)} runs)")
    else:
        check(checks, "priced_routes_vs_recent_median", True,
              f"only {len(recent)} earlier run(s) on record; need {MIN_BASELINE_POINTS}", skipped=True)

    if stats:
        calls, failed = int(stats.get("calls", 0)), len(stats.get("failed", []))
        fr = failed / calls if calls else 0.0
        check(checks, "failed_calls", fr <= cfg["max_failed_call_ratio"],
              f"{failed} of {calls} calls failed ({fr:.1%}); limit {cfg['max_failed_call_ratio']:.0%}")
        cur = stats.get("currency")
        check(checks, "currency", cur is None or str(cur).lower() == cfg["currency"], f"currency {cur}", skipped=cur is None)
    else:
        check(checks, "failed_calls", True, "no run stats supplied", skipped=True)
        check(checks, "currency", True, "no run stats supplied", skipped=True)

    counts = {"records": len(records), "priced": priced, "quarantined": len(quarantine),
              "store_routes": len(store) if store else None}
    result = _result(pipeline, checks, counts, quarantine, stats, cfg, ranked)
    return result, cleaned, quarantine


def _result(pipeline, checks, counts, quarantine, stats, cfg, ranked):
    failed = [c["id"] for c in checks if c["status"] == "fail"]
    out_counts = dict(counts)
    if stats:
        out_counts.update({k: (len(v) if isinstance(v, list) else v) for k, v in
                           {"calls": stats.get("calls"), "ok": stats.get("ok"), "empty": stats.get("empty"),
                            "failed": stats.get("failed")}.items() if v is not None})
    return {
        "schema_version": 1,
        "kind": "run_result",
        "pipeline": pipeline,
        "status": "blocked" if failed else "ok",
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "ranked_generated_at": ranked.get("generated_at") if isinstance(ranked, dict) else None,
        "failed_checks": failed,
        "checks": checks,
        "counts": out_counts,
        "quarantine_reasons": sorted({q["reason"] for q in quarantine}),
        "thresholds": {k: cfg[k] for k in ("price_ceiling_usd", "departure_buffer_hours", "min_priced_ratio_of_recent_median",
                                             "max_failed_call_ratio", "max_quarantine_ratio")},
    }


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pipeline", required=True)
    ap.add_argument("--ranked", required=True)
    ap.add_argument("--store")
    ap.add_argument("--stats")
    ap.add_argument("--baseline", help="JSON list of priced-route counts from earlier OK runs, oldest first")
    ap.add_argument("--config", default=str(ROOT / "config" / "data_quality.json"))
    ap.add_argument("--destinations", default=str(ROOT / "sparkfare_destinations.json"))
    ap.add_argument("--out", required=True)
    ap.add_argument("--quarantine-out")
    ap.add_argument("--write-clean", action="store_true", help="when status is ok, rewrite the ranked file without quarantined records")
    args = ap.parse_args(argv)

    try:
        cfg = load_json(args.config)
        destinations = set(load_json(args.destinations).keys())
        ranked = load_json(args.ranked)
        store = load_json(args.store) if args.store else None
        stats = load_json(args.stats) if args.stats and Path(args.stats).exists() else None
        baseline = load_json(args.baseline) if args.baseline and Path(args.baseline).exists() else None
        if isinstance(baseline, dict):
            baseline = baseline.get("priced_counts")
    except (OSError, ValueError) as exc:
        print(f"VALIDATION COULD NOT RUN: {exc}", file=sys.stderr)
        return 2

    result, cleaned, quarantine = validate(ranked, store, stats, baseline, cfg, destinations, args.pipeline)
    Path(args.out).write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    if args.quarantine_out and quarantine:
        Path(args.quarantine_out).write_text(json.dumps({"pipeline": args.pipeline, "records": quarantine}, indent=2) + "\n", encoding="utf-8")

    for c in result["checks"]:
        print(f"  [{c['status']:>7}] {c['id']}: {c['detail']}")
    if result["status"] == "ok":
        if quarantine and args.write_clean:
            Path(args.ranked).write_text(json.dumps(cleaned, indent=2, ensure_ascii=False), encoding="utf-8")
            print(f"VALIDATION OK; {len(quarantine)} record(s) quarantined and removed from {args.ranked}")
        else:
            print("VALIDATION OK")
        return 0
    print(f"VALIDATION BLOCKED: {', '.join(result['failed_checks'])}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
