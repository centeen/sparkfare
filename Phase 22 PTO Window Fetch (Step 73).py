"""PTO window fares (ROADMAP step 73, Track B of claude_code_pto_fare_calendar_2026-10-09.md).

For each travel window the /time-off planner shows (see scripts/pto-windows.mjs), look up the lowest fare Travelpayouts has
seen for those exact dates, for each US origin and each destination that fits the window. Output: sparkfare_pto_window_prices.json.

Honest about the data: Travelpayouts' Data API is a cache of real users' searches (about 2 to 7 days), so far-off windows often
have no price. "No fare seen" is the normal state for most 2027 windows, not an error. Nothing here predicts or judges a price.

Modes
  live      price the windows, update the data file, never overwrite good data on an API error (the default)
  dry-run   sample 3 origins x the first 6 windows x 8 destinations on each endpoint, write NO data, print a report
            (hit rate overall and by days until departure, errors and rate limits). Used once to choose the endpoint.

Environment (all optional except the token)
  TRAVELPAYOUTS_TOKEN   required (the same token the other fetch scripts use)
  PTO_ENDPOINT          v3 (default: /aviasales/v3/prices_for_dates) or v1 (/v1/prices/cheap with depart_date / return_date)
  PTO_FLEX_DAYS         0 (default) = exact dates; N = cheapest fare departing within N days of the window start and returning
                        within N days of its end (the fallback if exact dates have too low a hit rate)
  PTO_MAX_CALLS         hard cap per run (default 800); PTO_SLEEP seconds between calls (default 2.0)
  PTO_API_BASE, PTO_WINDOWS_PATH, PTO_OUTPUT_PATH, PTO_TODAY (YYYY-MM-DD)  for tests and local runs
"""
import argparse
import importlib.util
import json
import os
import statistics
import sys
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).parent

TOKEN = os.environ.get("TRAVELPAYOUTS_TOKEN")
API_BASE = os.environ.get("PTO_API_BASE", "https://api.travelpayouts.com").rstrip("/")
ENDPOINT = os.environ.get("PTO_ENDPOINT", "v3")
FLEX_DAYS = int(os.environ.get("PTO_FLEX_DAYS", "0"))
MAX_CALLS = int(os.environ.get("PTO_MAX_CALLS", "800"))
SLEEP = float(os.environ.get("PTO_SLEEP", "2.0"))
WINDOWS_PATH = Path(os.environ.get("PTO_WINDOWS_PATH", ROOT / "pto_windows.json"))
OUTPUT_PATH = Path(os.environ.get("PTO_OUTPUT_PATH", ROOT / "sparkfare_pto_window_prices.json"))
CURRENCY = "usd"

US_ORIGINS = ["JFK", "LAX", "ORD", "ATL", "DFW", "SFO", "MIA", "IAD", "EWR", "SEA", "IAH", "BOS", "DEN", "PHX", "LAS"]
PER_WINDOW = 8
KEEP_OBSERVATION_DAYS = 60
DROP_AFTER_END_DAYS = 30


def _load_fetch_module():
    """Reuse the destination list and the link builder from the main fetch script (one source of truth)."""
    path = ROOT / "Phase 1 Flight Fetch Script (Step 8).py"
    spec = importlib.util.spec_from_file_location("sparkfare_fetch", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


_fetch = _load_fetch_module()
DESTINATIONS = _fetch.DESTINATIONS
build_aviasales_link = _fetch.build_aviasales_link
IATA_BY_NAME = {d["display_name"]: d["iata"] for d in DESTINATIONS}


def today_utc():
    override = os.environ.get("PTO_TODAY")
    return date.fromisoformat(override) if override else datetime.now(timezone.utc).date()


# ---- planning ---------------------------------------------------------------------------------------------------

def load_medians():
    """Recent median price per (origin, destination) from the ranked-deals files, used only to pick which destinations
    to price first (cheapest known routes first). Missing data just means no preference."""
    medians = {}
    for name in ("sparkfare_ranked_deals.json", "sparkfare_ranked_deals_other_origins.json", "sparkfare_hourly_ranked_deals.json"):
        path = ROOT / name
        if not path.exists():
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        for bucket in ("deals", "featured", "priced_no_deal"):
            for rec in data.get(bucket, []) or []:
                value = rec.get("median_baseline") or rec.get("price")
                if rec.get("origin") and rec.get("display_name") and value:
                    medians.setdefault((rec["origin"], rec["display_name"]), value)
    return medians


def plan_calls(windows, origins, medians, max_calls=MAX_CALLS, per_window=PER_WINDOW):
    """Nearest window first, then origin, then up to `per_window` fitting destinations (cheapest known median first),
    cut at the hard cap. A far-off window is the first to be dropped when the cap bites."""
    calls = []
    for window in windows:
        for origin in origins:
            fitting = [n for n in window["destinations"] if n in IATA_BY_NAME]
            fitting.sort(key=lambda n: (medians.get((origin, n), float("inf")), n))
            for name in fitting[:per_window]:
                if len(calls) >= max_calls:
                    return calls
                calls.append({"origin": origin, "start": window["start"], "end": window["end"], "name": name, "iata": IATA_BY_NAME[name], "days_off": window["days_off"]})
    return calls


# ---- the API ----------------------------------------------------------------------------------------------------

class ApiError(Exception):
    def __init__(self, message, status=None):
        super().__init__(message)
        self.status = status


def _month(day):
    return day[:7]


def _within(day_text, target, flex):
    try:
        return abs((date.fromisoformat(day_text[:10]) - date.fromisoformat(target)).days) <= flex
    except (TypeError, ValueError):
        return False


def _request(path, params):
    try:
        resp = requests.get(f"{API_BASE}{path}", params=params, timeout=20, headers={"Accept-Encoding": "gzip, deflate"})
    except requests.exceptions.RequestException as exc:
        raise ApiError(f"network error: {exc}")
    if resp.status_code == 429:
        raise ApiError("rate limited (HTTP 429)", 429)
    if resp.status_code >= 400:
        raise ApiError(f"HTTP {resp.status_code}", resp.status_code)
    try:
        return resp.json()
    except ValueError:
        raise ApiError("response was not JSON", resp.status_code)


def parse_v3(payload, start, end, flex=0):
    """prices_for_dates: {"success": true, "data": [{price, airline, flight_number, departure_at, return_at, ...}]}.
    Returns the cheapest ticket that matches the window (exact dates, or within `flex` days of each end)."""
    if not payload.get("success", True):
        raise ApiError(f"success=false: {payload.get('error')}")
    best = None
    for row in payload.get("data") or []:
        price = row.get("price")
        if not price:
            continue
        if flex == 0:
            if (row.get("departure_at") or "")[:10] != start or (row.get("return_at") or "")[:10] != end:
                continue
        elif not (_within(row.get("departure_at") or "", start, flex) and _within(row.get("return_at") or "", end, flex)):
            continue
        if best is None or price < best["price"]:
            best = row
    return best


def parse_v1(payload, iata, start, end, flex=0):
    """/v1/prices/cheap: {"success": true, "data": {IATA: {"0": {price, airline, departure_at, return_at, ...}}}}."""
    if not payload.get("success", True):
        raise ApiError(f"success=false: {payload.get('error')}")
    best = None
    for row in ((payload.get("data") or {}).get(iata) or {}).values():
        price = row.get("price")
        if not price:
            continue
        if flex == 0:
            if (row.get("departure_at") or "")[:10] != start or (row.get("return_at") or "")[:10] != end:
                continue
        elif not (_within(row.get("departure_at") or "", start, flex) and _within(row.get("return_at") or "", end, flex)):
            continue
        if best is None or price < best["price"]:
            best = row
    return best


def lookup(call, endpoint=None, flex=None):
    """One window x origin x destination. Returns a fare dict, {} when the cache has no matching fare (not an error),
    or raises ApiError (the caller must not overwrite stored data on an error)."""
    endpoint = endpoint or ENDPOINT
    flex = FLEX_DAYS if flex is None else flex
    start, end = call["start"], call["end"]
    if endpoint == "v3":
        if flex == 0:
            params = {"departure_at": start, "return_at": end, "limit": 1}
        else:  # month-wide search, filtered to the flexible window locally
            params = {"departure_at": _month(start), "return_at": _month(end), "limit": 100}
        params.update({"origin": call["origin"], "destination": call["iata"], "currency": CURRENCY, "sorting": "price", "one_way": "false", "token": TOKEN})
        row = parse_v3(_request("/aviasales/v3/prices_for_dates", params), start, end, flex)
    else:
        params = {"origin": call["origin"], "destination": call["iata"], "depart_date": start if flex == 0 else _month(start),
                  "return_date": end if flex == 0 else _month(end), "currency": CURRENCY, "token": TOKEN}
        row = parse_v1(_request("/v1/prices/cheap", params), call["iata"], start, end, flex)
    if not row:
        return {}
    return {
        "price": row["price"],
        "airline": row.get("airline"),
        "departure_at": row.get("departure_at"),
        "return_at": row.get("return_at"),
        "found_at": row.get("found_at"),
    }


# ---- the data file ----------------------------------------------------------------------------------------------

def load_store(path=None):
    path = path or OUTPUT_PATH
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            pass
    return {"windows": {}}


def merge(store, results, today, fetched_at, days_off_by_window):
    """results: list of (call, fare_dict_or_empty). Keeps earlier fares for a destination that has none today, so a
    route that dips out of the cache is shown as 'last seen' instead of vanishing; drops windows long past."""
    windows = store.setdefault("windows", {})
    today_s = today.isoformat()
    touched = {}
    for call, fare in results:
        key = f"{call['origin']}:{call['start']}:{call['end']}"
        win = windows.setdefault(key, {"origin": call["origin"], "start": call["start"], "end": call["end"],
                                        "days_off": call["days_off"], "fares": [], "observations": []})
        win["days_off"] = call["days_off"]
        touched.setdefault(key, [])
        if not fare:
            continue
        link = build_aviasales_link(call["origin"], call["iata"], fare.get("departure_at") or call["start"], fare.get("return_at") or call["end"])
        entry = {"destination": call["name"], "iata": call["iata"], "price": fare["price"], "airline": fare.get("airline"),
                 "departure_at": fare.get("departure_at"), "return_at": fare.get("return_at"),
                 "found_at": fare.get("found_at") or fetched_at, "booking_link": link}
        win["fares"] = [f for f in win["fares"] if f["destination"] != call["name"]] + [entry]
        touched[key].append(fare["price"])
    for key, prices in touched.items():
        if not prices:
            continue
        obs = [o for o in windows[key]["observations"] if o["date"] != today_s]
        obs.append({"date": today_s, "price": min(prices)})
        windows[key]["observations"] = obs
    cutoff = (today - timedelta(days=KEEP_OBSERVATION_DAYS)).isoformat()
    for win in windows.values():  # every window, priced today or not
        win["observations"] = [o for o in win["observations"] if o["date"] >= cutoff]
    for key in [k for k, w in windows.items() if w["end"] < (today - timedelta(days=DROP_AFTER_END_DAYS)).isoformat()]:
        del windows[key]
    for win in windows.values():
        win["fares"].sort(key=lambda f: f["price"])
    store["generated_at"] = fetched_at
    store["endpoint"] = ENDPOINT
    store["flex_days"] = FLEX_DAYS
    return store


# ---- runs -------------------------------------------------------------------------------------------------------

def run_live():
    if not TOKEN:
        raise RuntimeError("TRAVELPAYOUTS_TOKEN environment variable not set.")
    windows = json.loads(WINDOWS_PATH.read_text(encoding="utf-8"))["windows"]
    today = today_utc()
    calls = plan_calls(windows, US_ORIGINS, load_medians())
    print(f"Planned {len(calls)} calls (cap {MAX_CALLS}) over {len(windows)} windows; endpoint {ENDPOINT}, flex {FLEX_DAYS} days")
    results, hits, empties, errors, consecutive_429 = [], 0, 0, 0, 0
    for i, call in enumerate(calls, 1):
        try:
            fare = lookup(call)
            consecutive_429 = 0
        except ApiError as exc:
            errors += 1
            consecutive_429 = consecutive_429 + 1 if exc.status == 429 else 0
            print(f"  error {call['origin']}->{call['iata']} {call['start']}: {exc}")
            if consecutive_429 >= 3:
                print("Stopping: three rate-limit responses in a row.")
                break
            time.sleep(SLEEP)
            continue
        results.append((call, fare))
        hits += 1 if fare else 0
        empties += 0 if fare else 1
        time.sleep(SLEEP)
    fetched_at = datetime.now(timezone.utc).isoformat()
    store = merge(load_store(), results, today, fetched_at, {})
    store["last_run"] = {"calls": len(results) + errors, "priced": hits, "no_fare": empties, "errors": errors}
    OUTPUT_PATH.write_text(json.dumps(store, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Done: {hits} priced, {empties} with no fare seen, {errors} errors -> {OUTPUT_PATH.name}")
    if results == [] and errors > 0:
        sys.exit(1)  # nothing usable came back: let the workflow show a failure instead of a quiet green run


def dry_run_report(origins=("JFK", "DEN", "LAX"), n_windows=6, per_window=PER_WINDOW):
    if not TOKEN:
        raise RuntimeError("TRAVELPAYOUTS_TOKEN environment variable not set.")
    windows = json.loads(WINDOWS_PATH.read_text(encoding="utf-8"))["windows"][:n_windows]
    today = today_utc()
    medians = load_medians()
    calls = plan_calls(windows, list(origins), medians, max_calls=10_000, per_window=per_window)
    lines = [f"# PTO per-date dry run ({today.isoformat()})", "",
             f"{len(calls)} calls per endpoint: {len(origins)} origins x {len(windows)} windows x up to {per_window} destinations. No data was written.", ""]
    for endpoint in ("v3", "v1"):
        hit_days, all_days, ages, errors, statuses = [], [], [], [], {}
        for call in calls:
            days = (date.fromisoformat(call["start"]) - today).days
            all_days.append(days)
            try:
                fare = lookup(call, endpoint=endpoint, flex=0)
            except ApiError as exc:
                errors.append(str(exc))
                statuses[exc.status] = statuses.get(exc.status, 0) + 1
                time.sleep(SLEEP)
                continue
            if fare:
                hit_days.append(days)
                if fare.get("found_at"):
                    try:
                        ages.append((datetime.now(timezone.utc) - datetime.fromisoformat(fare["found_at"].replace("Z", "+00:00"))).total_seconds() / 3600)
                    except ValueError:
                        pass
            time.sleep(SLEEP)
        total = len(calls)
        lines += [f"## Endpoint {endpoint}",
                  f"- calls: {total}; priced: {len(hit_days)} ({100 * len(hit_days) / total:.0f}%); errors: {len(errors)}"]
        for lo, hi in ((0, 30), (31, 60), (61, 90), (91, 120)):
            n = sum(1 for d in all_days if lo <= d <= hi)
            h = sum(1 for d in hit_days if lo <= d <= hi)
            lines.append(f"- departing in {lo}-{hi} days: {h}/{n} priced" + (f" ({100 * h / n:.0f}%)" if n else ""))
        near = [d for d in all_days if d <= 120]
        near_hits = [d for d in hit_days if d <= 120]
        rate = 100 * len(near_hits) / len(near) if near else 0
        lines.append(f"- hit rate within 120 days: {rate:.0f}% -> " + ("exact dates are usable" if rate >= 20 else "UNDER 20%: use the 2-day flexibility fallback (PTO_FLEX_DAYS=2)"))
        lines.append(f"- median found_at age: " + (f"{statistics.median(ages):.1f} hours" if ages else "not provided by this endpoint"))
        if errors:
            lines.append(f"- error statuses: {statuses}; examples: {sorted(set(errors))[:3]}")
        lines.append("")
    report = "\n".join(lines)
    print(report)
    return report


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="sample the API, write no data, print a report")
    parser.add_argument("--report-path", help="also write the dry-run report here")
    args = parser.parse_args(argv)
    if args.dry_run:
        report = dry_run_report()
        if args.report_path:
            Path(args.report_path).write_text(report, encoding="utf-8")
    else:
        run_live()


if __name__ == "__main__":
    main()
