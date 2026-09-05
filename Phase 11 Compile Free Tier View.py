import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

SNAPSHOT_DIR = Path(os.environ.get("SPARKFARE_SNAPSHOT_DIR", "sparkfare_hourly_snapshots"))
OUTPUT_PATH = Path(os.environ.get("SPARKFARE_FREE_TIER_FEED_PATH", "sparkfare_flight_prices.json"))
FREE_ORIGIN = os.environ.get("SPARKFARE_FREE_ORIGIN", "JFK").strip().upper()
DELAY_HOURS = int(os.environ.get("SPARKFARE_FREE_TIER_DELAY_HOURS", "24"))


def load_snapshot(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as stream:
        return json.load(stream)


def snapshot_time(path: Path) -> datetime:
    timestamp = path.stem.removeprefix("flight_prices_")
    for pattern in ("%Y-%m-%dT%H%M%S.%fZ", "%Y-%m-%dT%H%M%SZ"):
        try:
            return datetime.strptime(timestamp, pattern).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    raise ValueError(f"Invalid snapshot filename timestamp: {path.name}")


def compile_free_tier_view() -> None:
    if not SNAPSHOT_DIR.exists():
        raise RuntimeError(f"Snapshot directory not found: {SNAPSHOT_DIR}")

    cutoff = datetime.now(timezone.utc) - timedelta(hours=DELAY_HOURS)
    candidates = []
    for path in SNAPSHOT_DIR.glob("flight_prices_*.json"):
        fetched_at = snapshot_time(path)
        if fetched_at <= cutoff:
            candidates.append((fetched_at, path))

    if not candidates:
        raise RuntimeError(f"No snapshot is at least {DELAY_HOURS} hours old.")

    snapshot_time, snapshot_path = max(candidates)
    snapshot = load_snapshot(snapshot_path)
    prefix = f"{FREE_ORIGIN}:"
    view = {}

    for route_key, entry in snapshot.items():
        if entry.get("origin", FREE_ORIGIN) != FREE_ORIGIN and not route_key.startswith(prefix):
            continue
        display_name = entry.get("display_name", route_key.removeprefix(prefix))
        view[display_name] = dict(entry, display_name=display_name, origin=FREE_ORIGIN)

    if not view:
        raise RuntimeError(f"No routes found for free-tier origin {FREE_ORIGIN}.")

    OUTPUT_PATH.write_text(json.dumps(view, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Compiled {len(view)} routes from {snapshot_path} ({snapshot_time.isoformat()}).")


if __name__ == "__main__":
    compile_free_tier_view()
