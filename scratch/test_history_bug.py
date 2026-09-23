import importlib.util
import sys
import os

script_path = r'c:\Users\cente\sparkfare\Phase 1 Deal Ranking Script (Step 9 - with fallback).py'
spec = importlib.util.spec_from_file_location("ranking", script_path)
ranking = importlib.util.module_from_spec(spec)
sys.modules["ranking"] = ranking
spec.loader.exec_module(ranking)

# Create mock data
feed = {
    "LAX:Bali, Indonesia": {
        "origin": "LAX",
        "results": [{"price": 400, "booking_link": "", "airline": "Delta", "departure_at": "", "return_at": ""}],
        "fetched_at": "2026-09-23T00:00:00Z",
        "display_name": "Bali, Indonesia"
    }
}
history = {}

# 1. Update history
history = ranking.update_history(history, feed)

# History should have LAX:Bali, Indonesia, not LAX:LAX:Bali, Indonesia
assert "LAX:Bali, Indonesia" in history
assert "LAX:LAX:Bali, Indonesia" not in history
assert len(history["LAX:Bali, Indonesia"]) == 1

# Mock history array so we have enough points (e.g. 10 days) to avoid "no_data"
# Wait, classify_destination only needs 1 point to show history_points > 0
# However, the script excludes "today" from history to avoid self-bias. 
# So we need to insert an older date into history!
history["LAX:Bali, Indonesia"] = [
    {"date": "2026-09-20", "price": 450, "found_at": "2026-09-20T00:00:00Z"}
]

# 2. Classify
entry = feed["LAX:Bali, Indonesia"]
feed_key = "LAX:Bali, Indonesia"
result = ranking.classify_destination(entry.get("display_name", feed_key), entry, history)

# Asserts
assert result["history_points"] == 1
assert result["route_key"] == "LAX:Bali, Indonesia"

print("Unit test passed: history_points > 0 and no double prefix.")
