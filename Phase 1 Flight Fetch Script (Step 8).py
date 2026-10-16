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
    {"display_name": "Bali, Indonesia", "group": "long_haul", "iata": "DPS"},
    {"display_name": "Tokyo, Japan", "group": "long_haul", "iata": "HND"},
    {"display_name": "Cape Town, South Africa", "group": "long_haul", "iata": "CPT"},
    {"display_name": "Sydney, Australia", "group": "long_haul", "iata": "SYD"},
    {"display_name": "Maldives (Male)", "group": "long_haul", "iata": "MLE"},
    {"display_name": "Buenos Aires, Argentina", "group": "long_haul", "iata": "EZE"},
    {"display_name": "Rio de Janeiro, Brazil", "group": "long_haul", "iata": "GIG"},
    {"display_name": "Phuket, Thailand", "group": "long_haul", "iata": "HKT"},
    {"display_name": "Ho Chi Minh City, Vietnam", "group": "long_haul", "iata": "SGN"},
    {"display_name": "Taipei, Taiwan", "group": "long_haul", "iata": "TPE"},

    {"display_name": "Amalfi Coast, Italy", "group": "shoulder_season", "iata": "NAP"},
    {"display_name": "Algarve, Portugal", "group": "shoulder_season", "iata": "FAO"},
    {"display_name": "Athens, Greece", "group": "shoulder_season", "iata": "ATH"},
    {"display_name": "Thessaloniki, Greece", "group": "shoulder_season", "iata": "SKG"},
    {"display_name": "Larnaca, Cyprus", "group": "shoulder_season", "iata": "LCA"},
    {"display_name": "Lisbon, Portugal", "group": "shoulder_season", "iata": "LIS"},
    {"display_name": "Madrid, Spain", "group": "shoulder_season", "iata": "MAD"},
    {"display_name": "Dubrovnik, Croatia", "group": "shoulder_season", "iata": "DBV"},
    {"display_name": "Tulum, Mexico", "group": "shoulder_season", "iata": "CUN"},
    {"display_name": "Mallorca, Spain", "group": "shoulder_season", "iata": "PMI"},

    {"display_name": "San Jose, Costa Rica", "group": "low_cost_carrier", "iata": "SJO"},
    {"display_name": "Da Nang, Vietnam", "group": "low_cost_carrier", "iata": "DAD"},
    {"display_name": "Cebu, Philippines", "group": "low_cost_carrier", "iata": "CEB"},
    {"display_name": "Prague, Czechia", "group": "low_cost_carrier", "iata": "PRG"},
    {"display_name": "Budapest, Hungary", "group": "low_cost_carrier", "iata": "BUD"},
    {"display_name": "Sofia / Borovets, Bulgaria", "group": "low_cost_carrier", "iata": "SOF"},
    {"display_name": "Bogota, Colombia", "group": "low_cost_carrier", "iata": "BOG"},
    {"display_name": "Krakow, Poland", "group": "low_cost_carrier", "iata": "KRK"},
    {"display_name": "Bucharest, Romania", "group": "low_cost_carrier", "iata": "OTP"},
    {"display_name": "Guatemala City, Guatemala", "group": "low_cost_carrier", "iata": "GUA"},

    {"display_name": "Marrakech, Morocco", "group": "featured", "iata": "RAK"},
    {"display_name": "Cappadocia, Turkey", "group": "featured", "iata": "ASR"},
    {"display_name": "Petra, Jordan", "group": "featured", "iata": "AMM"},
    {"display_name": "Oaxaca, Mexico", "group": "featured", "iata": "OAX"},
    {"display_name": "Cusco, Peru", "group": "featured", "iata": "CUZ"},
    {"display_name": "Luxor, Egypt", "group": "featured", "iata": "LXR"},
    {"display_name": "Tbilisi, Georgia", "group": "featured", "iata": "TBS"},
    {"display_name": "Baku, Azerbaijan", "group": "featured", "iata": "GYD"},
    {"display_name": "Antigua, Guatemala", "group": "featured", "iata": "GUA"},  # shares GUA with Guatemala City above - do not key by iata
    {"display_name": "Muscat, Oman", "group": "featured", "iata": "MCT"},
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
                    "group": dest["group"],
                    "iata": iata,
                    "fetched_at": fetched_at,
                    "results": [],
                }
            else:
                succeeded.append(key)
                store[key] = {
                    "display_name": destination_name,
                    "origin": origin,
                    "group": dest["group"],
                    "iata": iata,
                    "fetched_at": fetched_at,
                    "results": results,
                }

            save_datastore(store)  # write after every route, not just at the end
            time.sleep(2)  # Travelpayouts confirmed 300 req/min per token (2026-09-06); this
            # keeps a full 480-request run to ~16 min at ~30 req/min, well under the limit and
            # spread out rather than bursted, per their own recommendation.

    if SNAPSHOT_DIR:
        SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
        # Order matters: strip '+00:00' to 'Z' BEFORE removing colons, or the colon-strip runs
        # first and leaves '+0000' behind since '+00:00' no longer exists to match. (This was
        # backwards until 2026-09-11 -- every existing snapshot file is named with '+0000', which
        # "Phase 11 Compile Free Tier View.py"'s parser has to tolerate for that reason.)
        snapshot_name = fetched_at.replace('+00:00', 'Z').replace(':', '')
        snapshot_path = SNAPSHOT_DIR / f"flight_prices_{snapshot_name}.json"
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
