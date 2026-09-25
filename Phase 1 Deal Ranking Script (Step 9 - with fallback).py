import json
import os
from pathlib import Path
from datetime import datetime, timezone, timedelta
from statistics import mean, median
import requests

PRICE_FEED_PATH = Path(os.environ.get(
    "SPARKFARE_FLIGHT_PRICES_PATH",
    Path(__file__).parent / "sparkfare_flight_prices.json",
))  # written by Step 8
HISTORY_PATH = Path(os.environ.get(
    "SPARKFARE_PRICE_HISTORY_PATH",
    Path(__file__).parent / "sparkfare_price_history.json",
))  # accumulates over time
RANKED_OUTPUT_PATH = Path(os.environ.get(
    "SPARKFARE_RANKED_DEALS_PATH",
    Path(__file__).parent / "sparkfare_ranked_deals.json",
))  # consumed by Phase 2/6

HISTORY_WINDOW_DAYS = 30
MIN_HISTORY_POINTS = 10  # T1: raised from 7 to 10
MIN_HISTORY_SPAN_DAYS = 14  # T1: minimum span between first and last observation
STALENESS_CUTOFF_HOURS = 48  # T1: if no expires_at, suppress if older than 48h

# Workplan Step 66 (2026-09-12): before this, apply_fallback() had no upper bound on staleness -
# a route with no fresh data would keep re-displaying the same "last known price" indefinitely,
# potentially for months, with no visible warning beyond a last_fresh_date most visitors would
# never check. 7 days mirrors MIN_HISTORY_POINTS' own reasoning for what counts as a
# trustworthy signal - a flight price more than a week stale is no longer something to
# reasonably act on. Beyond this age, apply_fallback() stops carrying the price forward at all.
STALE_FALLBACK_MAX_AGE_DAYS = 7

# Per-cluster deal thresholds (fraction below 30-day trailing average).
# Cluster 4 deliberately excluded - see classify_destination().
CLUSTER_THRESHOLDS = {
    "Cluster 1: Long-Haul Volatility": 0.25,
    "Cluster 2: Shoulder-Season Cliffs": 0.15,
    "Cluster 3: LCC Routing Anomalies": 0.15,
}


def load_json(path: Path, default):
    if not path.exists():
        return default
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError:
        print(f"WARNING: {path} corrupted, starting fresh.")
        return default


def save_json(path: Path, data):
    tmp = path.with_suffix(".json.tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    tmp.replace(path)


def cheapest_result(entry: dict):
    """Lowest-priced result from today's fetch for one destination, or None if no results."""
    results = entry.get("results", [])
    if not results:
        return None
    return min(results, key=lambda r: r["price"])


def make_route_key(entry: dict, feed_key: str) -> str:
    display_name = entry.get("display_name", feed_key)
    return f"{entry['origin']}:{display_name}" if entry.get("origin") else display_name


def update_history(history: dict, feed: dict) -> dict:
    """Appends today's cheapest price per destination. Skips destinations with no data today -
    a missing day in the history is fine; writing a fake/zero price would corrupt the average.

    Workplan Step 65 fix (2026-09-12): the hourly multi-origin pipeline calls this multiple
    times per day (roughly hourly), but the trailing-average methodology (see
    sparkfare_ranking_methodology.md) is defined as one observation per calendar day - the
    day's CHEAPEST price, same "cheapest wins" principle cheapest_result() already applies
    within a single fetch. The old same-day branch simply overwrote today's stored price with
    whatever the LATEST hourly fetch saw, which could be higher than an earlier fetch that same
    day if the price ticked up later - understating how cheap the route had actually been that
    day and subtly corrupting the trailing average for every route on the hourly pipeline. Now
    takes the minimum of the existing same-day value and the new fetch. The once-daily JFK
    pipeline is unaffected either way, since it only ever calls this once per day."""
    today = datetime.now(timezone.utc).date().isoformat()
    cutoff = (datetime.now(timezone.utc).date() - timedelta(days=HISTORY_WINDOW_DAYS)).isoformat()

    for display_name, entry in feed.items():
        cheapest = cheapest_result(entry)
        if cheapest is None:
            continue

        route_key = make_route_key(entry, display_name)
        dest_history = history.setdefault(route_key, [])

        # The fetched_at timestamp comes from the feed entry
        feed_fetched_at = entry.get("fetched_at", datetime.now(timezone.utc).isoformat())

        if dest_history and dest_history[-1]["date"] == today:
            if cheapest["price"] < dest_history[-1]["price"]:
                dest_history[-1]["price"] = cheapest["price"]
                dest_history[-1]["found_at"] = feed_fetched_at
                dest_history[-1]["expires_at"] = cheapest.get("expires_at")
        else:
            dest_history.append({
                "date": today, 
                "price": cheapest["price"],
                "found_at": feed_fetched_at,
                "expires_at": cheapest.get("expires_at")
            })

        history[route_key] = [h for h in dest_history if h["date"] >= cutoff]

    return history


def deal_quality(observations, current_ticket, feed_fetched_at, now_dt):
    """Pure module returning {eligible, baseline, baseline_mean, baselineN, spanDays, staleness_hours, reasons, is_rare_find, basis_text}"""
    prices = [h["price"] for h in observations]
    baselineN = len(prices)
    reasons = []

    if baselineN > 0:
        spanDays = (datetime.fromisoformat(observations[-1]["date"]).date() - datetime.fromisoformat(observations[0]["date"]).date()).days
    else:
        spanDays = 0

    if baselineN < MIN_HISTORY_POINTS:
        reasons.append(f"Insufficient observations ({baselineN} < {MIN_HISTORY_POINTS})")
    if spanDays < MIN_HISTORY_SPAN_DAYS:
        reasons.append(f"History span too short ({spanDays} days < {MIN_HISTORY_SPAN_DAYS})")

    staleness_hours = 0
    # Fix (2026-09-25): `expires_at` is Travelpayouts' own raw fare-quote TTL -- observed on real
    # production JFK data to be roughly 1 hour after `found_at`, and not populated at all for most
    # other-origin routes in the same fetch (same shared fetch script, just whatever the airline's
    # own API response happened to include for that specific route/fare). It used to be treated as
    # an unconditional hard exclusion the moment it passed, completely bypassing the far more
    # lenient STALENESS_CUTOFF_HOURS (48h) grace every other record gets. Since the real pipeline
    # has a ~2 hour gap between fetch (06:00 UTC) and the daily email's general send (08:00 UTC),
    # and this exact `deal_quality()` gate is re-run again at send time (not just once at fetch
    # time), this was silently disqualifying every JFK record from the daily digest on a near-daily
    # basis -- found while investigating a reported (but actually already-fixed) origin-
    # personalization bug. `expires_at` isn't used to lock a live bookable quote anywhere in this
    # product (booking always redirects to Aviasales' own current price), so it no longer
    # independently disqualifies a record -- eligibility is now judged uniformly, for every record
    # regardless of whether `expires_at` is present, by the same `found_at`/48h staleness check.
    found_at = current_ticket.get("found_at", feed_fetched_at)
    if found_at:
        found_dt = datetime.fromisoformat(found_at.replace('Z', '+00:00'))
        if found_dt.tzinfo is None: found_dt = found_dt.replace(tzinfo=timezone.utc)
        age_td = now_dt - found_dt
        staleness_hours = age_td.total_seconds() / 3600
        if staleness_hours > STALENESS_CUTOFF_HOURS:
            reasons.append(f"Price older than {STALENESS_CUTOFF_HOURS}h ({staleness_hours:.1f}h)")

    eligible = len(reasons) == 0
    baseline = median(prices) if baselineN > 0 else 0
    baseline_mean = mean(prices) if baselineN > 0 else 0
    is_rare_find = False
    pct_below_avg = 0
    basis_text = ""

    if baselineN > 0 and baseline > 0:
        mad_val = median([abs(p - baseline) for p in prices])
        pct_below_avg = (baseline_mean - current_ticket["price"]) / baseline_mean
        if eligible and current_ticket["price"] <= baseline - 2 * mad_val:
            is_rare_find = True
            
        pct_diff = round(((baseline - current_ticket["price"]) / baseline) * 100)
        basis_text = f"{pct_diff}% below 30-day median, {baselineN} observations"

    return {
        "eligible": eligible,
        "baseline": baseline,
        "baseline_mean": baseline_mean,
        "baselineN": baselineN,
        "spanDays": spanDays,
        "staleness_hours": staleness_hours,
        "reasons": reasons,
        "is_rare_find": is_rare_find,
        "basis_text": basis_text,
        "pct_below_avg": pct_below_avg
    }


def classify_destination(display_name: str, entry: dict, history: dict) -> dict:
    """Classifies against history as it stood BEFORE today's price is added -
    today's own price must never bias the average it's being compared against."""
    cheapest = cheapest_result(entry)
    cluster = entry.get("cluster")
    route_key = make_route_key(entry, display_name)

    # Workplan Step 65 (2026-09-12, second fix): the hourly pipeline calls this function
    # multiple times per day. If an earlier run today already wrote today's price into the
    # history file (via update_history(), which runs after classification each time), a later
    # same-day run would otherwise load history that already includes today's own price -
    # directly violating the "today's own price must never bias the average it's compared
    # against" rule this function's docstring already promised. Exclude today's own entry here
    # unconditionally, regardless of how many times this has already run today.
    today = datetime.now(timezone.utc).date().isoformat()

    if cheapest is None:
        return {
            "display_name": display_name,
            "route_key": route_key,
            "origin": entry.get("origin"),
            "cluster": cluster,
            "status": "no_data",
            "history_points": len([h for h in history.get(route_key, []) if h["date"] != today]),
        }

    dest_history = [h for h in history.get(route_key, []) if h["date"] != today]
    prices = [h["price"] for h in dest_history]

    feed_fetched_at = entry.get("fetched_at", datetime.now(timezone.utc).isoformat())

    record = {
        "display_name": display_name,
        "route_key": route_key,
        "origin": entry.get("origin"),
        "cluster": cluster,
        "price": cheapest["price"],
        "booking_link": cheapest["booking_link"],
        "airline": cheapest["airline"],
        "departure_at": cheapest["departure_at"],
        "return_at": cheapest["return_at"],
        "history_points": len(prices),
        "price_history": prices,
        "observations": dest_history,
        "found_at": feed_fetched_at,
        "expires_at": cheapest.get("expires_at"),
    }

    if cluster not in CLUSTER_THRESHOLDS:
        record["status"] = "featured"
        record["pct_below_avg"] = None
        record["basis_text"] = ""
        return record

    now_dt = datetime.now(timezone.utc)
    dq = deal_quality(dest_history, cheapest, feed_fetched_at, now_dt)

    if not dq["eligible"]:
        record["status"] = "insufficient_history"
        record["pct_below_avg"] = None
        record["basis_text"] = ""
        # If it would have been a deal but was suppressed, log it
        if dq["baselineN"] > 0 and cheapest["price"] <= dq["baseline"]:
            try:
                requests.post("http://127.0.0.1:8787/api/events", json={
                    "event_type": "deal_suppressed",
                    "origin": entry.get("origin"),
                    "route": display_name,
                    "meta": {"price": cheapest["price"], "reasons": dq["reasons"]}
                }, timeout=3)
            except Exception as e:
                pass
        return record

    record["trailing_avg"] = round(dq["baseline_mean"], 2)
    record["median_baseline"] = round(dq["baseline"], 2)
    record["pct_below_avg"] = round(dq["pct_below_avg"], 4)
    record["status"] = "deal" if dq["is_rare_find"] else "priced_no_deal"
    record["basis_text"] = dq["basis_text"]
    return record


def flatten_previous_output(previous_output: dict) -> dict:
    """Flattens a prior ranked_deals.json into {display_name: record}, keeping only records
    that carry real price data - something worth falling back to."""
    by_name = {}
    for bucket in ("deals", "featured", "priced_no_deal", "insufficient_history", "no_data"):
        for record in previous_output.get(bucket, []):
            if record.get("price") is not None:
                by_name[record["display_name"]] = record
                by_name[record.get("route_key", record["display_name"])] = record
    return by_name


def apply_fallback(record: dict, previous_by_name: dict) -> dict:
    """If today's classification has no usable price (insufficient_history/no_data), carries
    forward the most recent known-good classification for this destination, if one exists AND
    is recent enough (see STALE_FALLBACK_MAX_AGE_DAYS). Tags the result as a stale fallback so a
    display layer can add a 'prices as of' note. Does NOT affect price history - that only ever
    accumulates genuinely fresh prices."""
    if record["status"] not in ("insufficient_history", "no_data"):
        record["is_stale_fallback"] = False
        record["last_fresh_date"] = datetime.now(timezone.utc).date().isoformat()
        return record

    previous = previous_by_name.get(record.get("route_key", record["display_name"]))
    if previous is None:
        record["is_stale_fallback"] = False  # genuinely never had data - nothing to fall back to
        return record

    last_fresh_date = previous.get("last_fresh_date")
    too_stale = True
    if last_fresh_date:
        try:
            age_days = (datetime.now(timezone.utc).date() - datetime.fromisoformat(last_fresh_date).date()).days
            too_stale = age_days > STALE_FALLBACK_MAX_AGE_DAYS
        except ValueError:
            too_stale = True  # malformed date - fail safe, don't display it as current

    if too_stale:
        # Too old to act on (or the date is missing/unparseable) - don't carry it forward.
        # Falls through as insufficient_history/no_data rather than showing a stale price
        # indefinitely with no visible upper bound.
        record["is_stale_fallback"] = False
        return record

    fallback = dict(previous)  # carries forward status/price/link/etc. from the last good day
    fallback["is_stale_fallback"] = True
    fallback["last_fresh_date"] = last_fresh_date
    fallback["history_points"] = record.get("history_points", 0)  # keep today's real count, not the stale one
    return fallback


def rank_deals() -> dict:
    feed = load_json(PRICE_FEED_PATH, {})
    if not feed:
        raise RuntimeError(f"{PRICE_FEED_PATH} not found or empty - run Step 8's fetch script first.")

    # Read the PREVIOUS run's output before we overwrite it - this is the fallback source.
    previous_output = load_json(RANKED_OUTPUT_PATH, {})
    previous_by_name = flatten_previous_output(previous_output)

    history = load_json(HISTORY_PATH, {})

    # Classify against history as it stood BEFORE today - today's own price must not
    # bias the average it's being compared against, or the threshold gets quietly harder
    # to hit than intended.
    #
    # Use each entry's own display_name field, NOT the feed dict key -- for a multi-origin feed
    # the dict key is itself origin-prefixed ("JFK:Bali, Indonesia"), and classify_destination()
    # separately prepends entry['origin'] again when building the history route_key. Passing the
    # already-prefixed key as display_name silently double-prefixed every multi-origin history
    # key ("JFK:JFK:Bali, Indonesia") and every output record's display_name from the day the
    # hourly pipeline started -- found 2026-09-11 while debugging missing destination
    # images/copy for non-JFK origins (their lookup by clean display_name failed against the
    # corrupted "ORIGIN:Destination" value). JFK's own single-origin daily pipeline was never
    # affected: its feed dict keys were never origin-prefixed to begin with.
    classified = [classify_destination(entry.get("display_name", name), entry, history) for name, entry in feed.items()]
    classified = [apply_fallback(c, previous_by_name) for c in classified]

    history = update_history(history, feed)
    save_json(HISTORY_PATH, history)

    deals = [c for c in classified if c["status"] == "deal"]
    featured = [c for c in classified if c["status"] == "featured"]
    priced_no_deal = [c for c in classified if c["status"] == "priced_no_deal"]
    insufficient = [c for c in classified if c["status"] == "insufficient_history"]
    no_data = [c for c in classified if c["status"] == "no_data"]

    deals.sort(key=lambda d: d.get("pct_below_avg") or 0, reverse=True)  # biggest bargains first

    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "deals": deals,
        "featured": featured,
        "priced_no_deal": priced_no_deal,
        "insufficient_history": insufficient,
        "no_data": no_data,
    }
    save_json(RANKED_OUTPUT_PATH, output)

    stale_count = sum(1 for c in classified if c.get("is_stale_fallback"))
    print(f"Ranking complete: {len(deals)} deals, {len(featured)} featured (Cluster 4), "
          f"{len(priced_no_deal)} priced but not deals, {len(insufficient)} still building history, "
          f"{len(no_data)} with no data today. ({stale_count} of these are stale fallbacks from a prior day.)")

    return output


if __name__ == "__main__":
    rank_deals()
