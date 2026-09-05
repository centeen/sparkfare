import json
import os
from pathlib import Path
from datetime import datetime, timezone, timedelta
from statistics import mean

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
MIN_HISTORY_POINTS = 7  # cold-start safeguard

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


def update_history(history: dict, feed: dict) -> dict:
    """Appends today's cheapest price per destination. Skips destinations with no data today -
    a missing day in the history is fine; writing a fake/zero price would corrupt the average."""
    today = datetime.now(timezone.utc).date().isoformat()
    cutoff = (datetime.now(timezone.utc).date() - timedelta(days=HISTORY_WINDOW_DAYS)).isoformat()

    for display_name, entry in feed.items():
        cheapest = cheapest_result(entry)
        if cheapest is None:
            continue

        route_key = f"{entry['origin']}:{display_name}" if entry.get("origin") else display_name
        dest_history = history.setdefault(route_key, [])

        if dest_history and dest_history[-1]["date"] == today:
            dest_history[-1]["price"] = cheapest["price"]  # re-running same day updates, doesn't duplicate
        else:
            dest_history.append({"date": today, "price": cheapest["price"]})

        history[route_key] = [h for h in dest_history if h["date"] >= cutoff]

    return history


def classify_destination(display_name: str, entry: dict, history: dict) -> dict:
    """Classifies against history as it stood BEFORE today's price is added -
    today's own price must never bias the average it's being compared against."""
    cheapest = cheapest_result(entry)
    cluster = entry.get("cluster")
    route_key = f"{entry['origin']}:{display_name}" if entry.get("origin") else display_name

    if cheapest is None:
        return {
            "display_name": display_name,
            "route_key": route_key,
            "origin": entry.get("origin"),
            "cluster": cluster,
            "status": "no_data",
            "history_points": len(history.get(route_key, [])),
        }

    dest_history = history.get(route_key, [])
    prices = [h["price"] for h in dest_history]

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
    }

    # Cluster 4 (Visual Clickbait): imagery-driven by design, not deal-driven.
    # Always featured when data exists - does not compete against a price threshold.
    if cluster not in CLUSTER_THRESHOLDS:
        record["status"] = "featured"
        record["pct_below_avg"] = None
        return record

    if len(prices) < MIN_HISTORY_POINTS:
        record["status"] = "insufficient_history"
        record["pct_below_avg"] = None
        return record

    trailing_avg = mean(prices)
    if trailing_avg <= 0:
        record["status"] = "insufficient_history"
        record["pct_below_avg"] = None
        return record

    pct_below_avg = (trailing_avg - cheapest["price"]) / trailing_avg
    threshold = CLUSTER_THRESHOLDS[cluster]

    record["trailing_avg"] = round(trailing_avg, 2)
    record["pct_below_avg"] = round(pct_below_avg, 4)
    record["status"] = "deal" if pct_below_avg >= threshold else "priced_no_deal"
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
    forward the most recent known-good classification for this destination, if one exists.
    Tags the result as a stale fallback so a display layer can add a 'prices as of' note.
    Does NOT affect price history - that only ever accumulates genuinely fresh prices."""
    if record["status"] not in ("insufficient_history", "no_data"):
        record["is_stale_fallback"] = False
        record["last_fresh_date"] = datetime.now(timezone.utc).date().isoformat()
        return record

    previous = previous_by_name.get(record.get("route_key", record["display_name"]))
    if previous is None:
        record["is_stale_fallback"] = False  # genuinely never had data - nothing to fall back to
        return record

    fallback = dict(previous)  # carries forward status/price/link/etc. from the last good day
    fallback["is_stale_fallback"] = True
    fallback["last_fresh_date"] = previous.get("last_fresh_date", "unknown")
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
    classified = [classify_destination(name, entry, history) for name, entry in feed.items()]
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
