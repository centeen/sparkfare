import os
import json
import time
from pathlib import Path
from datetime import datetime, timezone
import requests

TRAVELPAYOUTS_TOKEN = os.environ.get("TRAVELPAYOUTS_TOKEN")
MARKER = "314524"
CURRENCY = "usd"
DEFAULT_ORIGIN = "JFK"
ORIGINS = [origin.strip().upper() for origin in os.environ.get("SPARKFARE_ORIGINS", DEFAULT_ORIGIN).split(",") if origin.strip()]

DATASTORE_PATH = Path(os.environ.get(
    "SPARKFARE_FLIGHT_PRICES_PATH",
    Path(__file__).parent / "sparkfare_flight_prices.json",
))
SNAPSHOT_DIR = Path(os.environ["SPARKFARE_SNAPSHOT_DIR"]) if os.environ.get("SPARKFARE_SNAPSHOT_DIR") else None

# 40 destinations from "Sparkfare Destination List - IATA Mapped".
# Keyed internally by display_name, NOT iata - Guatemala City and Antigua,
# Guatemala both resolve to GUA, so iata cannot be a unique key here.
DESTINATIONS = [
    {"display_name": "Bali, Indonesia", "cluster": "Cluster 1: Long-Haul Volatility", "iata": "DPS"},
    {"display_name": "Tokyo, Japan", "cluster": "Cluster 1: Long-Haul Volatility", "iata": "HND"},
    {"display_name": "Cape Town, South Africa", "cluster": "Cluster 1: Long-Haul Volatility", "iata": "CPT"},
    {"display_name": "Sydney, Australia", "cluster": "Cluster 1: Long-Haul Volatility", "iata": "SYD"},
    {"display_name": "Maldives (Male)", "cluster": "Cluster 1: Long-Haul Volatility", "iata": "MLE"},
    {"display_name": "Buenos Aires, Argentina", "cluster": "Cluster 1: Long-Haul Volatility", "iata": "EZE"},
    {"display_name": "Rio de Janeiro, Brazil", "cluster": "Cluster 1: Long-Haul Volatility", "iata": "GIG"},
    {"display_name": "Phuket, Thailand", "cluster": "Cluster 1: Long-Haul Volatility", "iata": "HKT"},
    {"display_name": "Ho Chi Minh City, Vietnam", "cluster": "Cluster 1: Long-Haul Volatility", "iata": "SGN"},
    {"display_name": "Taipei, Taiwan", "cluster": "Cluster 1: Long-Haul Volatility", "iata": "TPE"},

    {"display_name": "Amalfi Coast, Italy", "cluster": "Cluster 2: Shoulder-Season Cliffs", "iata": "NAP"},
    {"display_name": "Algarve, Portugal", "cluster": "Cluster 2: Shoulder-Season Cliffs", "iata": "FAO"},
    {"display_name": "Athens, Greece", "cluster": "Cluster 2: Shoulder-Season Cliffs", "iata": "ATH"},
    {"display_name": "Thessaloniki, Greece", "cluster": "Cluster 2: Shoulder-Season Cliffs", "iata": "SKG"},
    {"display_name": "Larnaca, Cyprus", "cluster": "Cluster 2: Shoulder-Season Cliffs", "iata": "LCA"},
    {"display_name": "Lisbon, Portugal", "cluster": "Cluster 2: Shoulder-Season Cliffs", "iata": "LIS"},
    {"display_name": "Madrid, Spain", "cluster": "Cluster 2: Shoulder-Season Cliffs", "iata": "MAD"},
    {"display_name": "Dubrovnik, Croatia", "cluster": "Cluster 2: Shoulder-Season Cliffs", "iata": "DBV"},
    {"display_name": "Tulum, Mexico", "cluster": "Cluster 2: Shoulder-Season Cliffs", "iata": "CUN"},
    {"display_name": "Mallorca, Spain", "cluster": "Cluster 2: Shoulder-Season Cliffs", "iata": "PMI"},

    {"display_name": "San Jose, Costa Rica", "cluster": "Cluster 3: LCC Routing Anomalies", "iata": "SJO"},
    {"display_name": "Da Nang, Vietnam", "cluster": "Cluster 3: LCC Routing Anomalies", "iata": "DAD"},
    {"display_name": "Cebu, Philippines", "cluster": "Cluster 3: LCC Routing Anomalies", "iata": "CEB"},
    {"display_name": "Prague, Czechia", "cluster": "Cluster 3: LCC Routing Anomalies", "iata": "PRG"},
    {"display_name": "Budapest, Hungary", "cluster": "Cluster 3: LCC Routing Anomalies", "iata": "BUD"},
    {"display_name": "Sofia / Borovets, Bulgaria", "cluster": "Cluster 3: LCC Routing Anomalies", "iata": "SOF"},
    {"display_name": "Bogota, Colombia", "cluster": "Cluster 3: LCC Routing Anomalies", "iata": "BOG"},
    {"display_name": "Krakow, Poland", "cluster": "Cluster 3: LCC Routing Anomalies", "iata": "KRK"},
    {"display_name": "Bucharest, Romania", "cluster": "Cluster 3: LCC Routing Anomalies", "iata": "OTP"},
    {"display_name": "Guatemala City, Guatemala", "cluster": "Cluster 3: LCC Routing Anomalies", "iata": "GUA"},

    {"display_name": "Marrakech, Morocco", "cluster": "Cluster 4: Visual Clickbait", "iata": "RAK"},
    {"display_name": "Cappadocia, Turkey", "cluster": "Cluster 4: Visual Clickbait", "iata": "ASR"},
    {"display_name": "Petra, Jordan", "cluster": "Cluster 4: Visual Clickbait", "iata": "AMM"},
    {"display_name": "Oaxaca, Mexico", "cluster": "Cluster 4: Visual Clickbait", "iata": "OAX"},
    {"display_name": "Cusco, Peru", "cluster": "Cluster 4: Visual Clickbait", "iata": "CUZ"},
    {"display_name": "Luxor, Egypt", "cluster": "Cluster 4: Visual Clickbait", "iata": "LXR"},
    {"display_name": "Tbilisi, Georgia", "cluster": "Cluster 4: Visual Clickbait", "iata": "TBS"},
    {"display_name": "Baku, Azerbaijan", "cluster": "Cluster 4: Visual Clickbait", "iata": "GYD"},
    {"display_name": "Antigua, Guatemala", "cluster": "Cluster 4: Visual Clickbait", "iata": "GUA"},  # shares GUA with Guatemala City above - do not key by iata
    {"display_name": "Muscat, Oman", "cluster": "Cluster 4: Visual Clickbait", "iata": "MCT"},
]


def build_aviasales_link(origin, destination, depart_at, return_at=None, marker=MARKER, adults=1):
    """Constructs a marker-tagged Aviasales deep link. Verified working via manual test click."""
    depart_ddmm = datetime.fromisoformat(depart_at[:10]).strftime("%d%m")
    route = f"{origin}{depart_ddmm}{destination}"
    if return_at:
        return_ddmm = datetime.fromisoformat(return_at[:10]).strftime("%d%m")
        route += return_ddmm
    route += str(adults)
    return f"https://www.aviasales.com/search/{route}?marker={marker}"


def fetch_cheapest_tickets(origin: str, destination: str):
    """Calls /v1/prices/cheap for one origin-destination pair.

    Returns:
        list of ticket dicts if data was found,
        [] (empty list) if the call succeeded but no cached data exists for this route -
            this is NOT an error per the API docs (thin/old-date routes return empty silently),
        None if something actually went wrong (network error, API error, malformed response) -
            the caller should NOT overwrite existing stored data for this destination on None.
    """
    url = "https://api.travelpayouts.com/v1/prices/cheap"
    params = {
        "origin": origin,
        "destination": destination,
        "currency": CURRENCY,
        "token": TRAVELPAYOUTS_TOKEN,
    }
    try:
        resp = requests.get(url, params=params, timeout=15, headers={"Accept-Encoding": "gzip, deflate"})
        resp.raise_for_status()
        payload = resp.json()
    except requests.exceptions.RequestException as e:
        print(f"  API ERROR for {origin}->{destination}: {e}")
        return None

    if not payload.get("success"):
        print(f"  API returned success=false for {origin}->{destination}: {payload.get('error')}")
        return None

    data = payload.get("data", {})
    dest_results = data.get(destination, {})
    if not dest_results:
        print(f"  No cached data for {origin}->{destination} (not an error - route may be thin in the 48hr cache)")
        return []

    results = []
    for seq_key, ticket in dest_results.items():
        results.append({
            "sequence": seq_key,
            "price": ticket.get("price"),
            "airline": ticket.get("airline"),
            "flight_number": ticket.get("flight_number"),
            "departure_at": ticket.get("departure_at"),
            "return_at": ticket.get("return_at"),
            "expires_at": ticket.get("expires_at"),
            "booking_link": build_aviasales_link(
                origin, destination,
                ticket.get("departure_at"),
                ticket.get("return_at"),
            ),
        })
    return results


def load_datastore() -> dict:
    if not DATASTORE_PATH.exists():
        return {}
    try:
        with open(DATASTORE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError:
        print(f"WARNING: {DATASTORE_PATH} corrupted, starting fresh this run.")
        return {}


def save_datastore(store: dict):
    tmp_path = DATASTORE_PATH.with_suffix(".json.tmp")
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(store, f, indent=2, ensure_ascii=False)
    tmp_path.replace(DATASTORE_PATH)


def run_daily_fetch():
    if not TRAVELPAYOUTS_TOKEN:
        raise RuntimeError("TRAVELPAYOUTS_TOKEN environment variable not set.")
    if not ORIGINS:
        raise RuntimeError("SPARKFARE_ORIGINS must contain at least one IATA origin.")

    store = load_datastore()
    fetched_at = datetime.now(timezone.utc).isoformat()

    succeeded, empty, failed = [], [], []

    multi_origin = len(ORIGINS) > 1
    for origin in ORIGINS:
        for dest in DESTINATIONS:
            destination_name = dest["display_name"]
            key = f"{origin}:{destination_name}" if multi_origin else destination_name
            iata = dest["iata"]
            print(f"Fetching: {key} ({origin} -> {iata})...")

            results = fetch_cheapest_tickets(origin, iata)

            if results is None:
                # Real failure - deliberately do NOT touch store[key], so yesterday's
                # last-successful data for this route is preserved.
                failed.append(key)
            elif len(results) == 0:
                empty.append(key)
                store[key] = {
                    "display_name": destination_name,
                    "origin": origin,
                    "cluster": dest["cluster"],
                    "iata": iata,
                    "fetched_at": fetched_at,
                    "results": [],
                }
            else:
                succeeded.append(key)
                store[key] = {
                    "display_name": destination_name,
                    "origin": origin,
                    "cluster": dest["cluster"],
                    "iata": iata,
                    "fetched_at": fetched_at,
                    "results": results,
                }

            save_datastore(store)  # write after every route, not just at the end
            time.sleep(2)  # conservative delay - no confirmed rate limit for this cached endpoint

    if SNAPSHOT_DIR:
        SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
        snapshot_path = SNAPSHOT_DIR / f"flight_prices_{fetched_at.replace(':', '').replace('+00:00', 'Z')}.json"
        save_datastore(store)
        snapshot_path.write_text(json.dumps(store, indent=2, ensure_ascii=False), encoding="utf-8")

    print("\n" + "=" * 50)
    print(f"FETCH COMPLETE: {len(succeeded)} with data, {len(empty)} empty (not errors), {len(failed)} real failures.")
    if failed:
        print("FAILED - previous data preserved for these, investigate before relying on today's numbers:")
        for name in failed:
            print(f"  - {name}")
    if empty:
        print("EMPTY - no cached data found for this route/date, not necessarily a problem:")
        for name in empty:
            print(f"  - {name}")
    print("=" * 50)


if __name__ == "__main__":
    run_daily_fetch()
