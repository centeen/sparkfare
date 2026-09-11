import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

SNAPSHOT_DIR = Path(os.environ.get("SPARKFARE_SNAPSHOT_DIR", "sparkfare_hourly_snapshots"))
OUTPUT_PATH = Path(os.environ.get("SPARKFARE_FREE_TIER_FEED_PATH", "sparkfare_flight_prices.json"))
DELAY_HOURS = int(os.environ.get("SPARKFARE_FREE_TIER_DELAY_HOURS", "24"))

# Accepts the newer plural SPARKFARE_FREE_ORIGINS (comma-separated, for compiling several origins
# into one combined view) or the original singular SPARKFARE_FREE_ORIGIN for backward
# compatibility. When more than one origin is requested, entries are keyed by the origin-qualified
# "{origin}:{display_name}" route key (matching the fetch script's own multi-origin convention) so
# two origins sharing a destination name (e.g. LAX:Bali, Indonesia and ORD:Bali, Indonesia) can't
# collide and silently overwrite each other in the compiled view.
_origins_env = os.environ.get("SPARKFARE_FREE_ORIGINS") or os.environ.get("SPARKFARE_FREE_ORIGIN", "JFK")
FREE_ORIGINS = [o.strip().upper() for o in _origins_env.split(",") if o.strip()]
MULTI_ORIGIN = len(FREE_ORIGINS) > 1


def load_snapshot(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as stream:
        return json.load(stream)


def snapshot_time(path: Path) -> datetime:
    timestamp = path.stem.removeprefix("flight_prices_")
    # %z matches both the intended 'Z' suffix and the actual '+0000' the fetch script has always
    # produced (its own filename-building has an order-of-operations bug: .replace(':', '') runs
    # before .replace('+00:00', 'Z'), so the second replace never finds its target -- see the fix
    # in "Phase 1 Flight Fetch Script (Step 8).py"). This parses existing files either way.
    for pattern in ("%Y-%m-%dT%H%M%S.%f%z", "%Y-%m-%dT%H%M%S%z"):
        try:
            return datetime.strptime(timestamp, pattern)
        except ValueError:
            continue
    raise ValueError(f"Invalid snapshot filename timestamp: {path.name}")


def compile_free_tier_view() -> None:
    if not FREE_ORIGINS:
        raise RuntimeError("SPARKFARE_FREE_ORIGINS/SPARKFARE_FREE_ORIGIN must contain at least one IATA origin.")
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

    chosen_time, snapshot_path = max(candidates)
    snapshot = load_snapshot(snapshot_path)
    origins_set = set(FREE_ORIGINS)
    view = {}

    for route_key, entry in snapshot.items():
        origin = entry.get("origin")
        if origin not in origins_set:
            continue
        display_name = entry.get("display_name", route_key.split(":", 1)[-1])
        key = f"{origin}:{display_name}" if MULTI_ORIGIN else display_name
        view[key] = dict(entry, display_name=display_name, origin=origin)

    if not view:
        raise RuntimeError(f"No routes found for free-tier origins {FREE_ORIGINS}.")

    OUTPUT_PATH.write_text(json.dumps(view, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Compiled {len(view)} routes for {FREE_ORIGINS} from {snapshot_path} ({chosen_time.isoformat()}).")


if __name__ == "__main__":
    compile_free_tier_view()
