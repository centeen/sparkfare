import json
import os
from pathlib import Path
from datetime import datetime, timezone
import statistics

# Set paths
BASE_DIR = Path(os.environ.get("SPARKFARE_BASE_DIR", Path(__file__).resolve().parent.parent))
HISTORY_PATH = BASE_DIR / "sparkfare_price_history.json"
RANKED_DEALS_PATH = BASE_DIR / "sparkfare_ranked_deals.json"

MIN_HISTORY_POINTS = 10
MIN_HISTORY_SPAN_DAYS = 14
STALENESS_CUTOFF_HOURS = 48

def deal_quality(observations, current_ticket, feed_fetched_at, now_dt):
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
    expires_at = current_ticket.get("expires_at")
    if expires_at:
        exp_dt = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
        if exp_dt.tzinfo is None: exp_dt = exp_dt.replace(tzinfo=timezone.utc)
        if now_dt > exp_dt:
            reasons.append(f"Price expired at {expires_at}")
    else:
        found_at = current_ticket.get("found_at", feed_fetched_at)
        if found_at:
            found_dt = datetime.fromisoformat(found_at.replace('Z', '+00:00'))
            if found_dt.tzinfo is None: found_dt = found_dt.replace(tzinfo=timezone.utc)
            age_td = now_dt - found_dt
            staleness_hours = age_td.total_seconds() / 3600
            if staleness_hours > STALENESS_CUTOFF_HOURS:
                reasons.append(f"Price older than {STALENESS_CUTOFF_HOURS}h ({staleness_hours:.1f}h)")

    eligible = len(reasons) == 0
    baseline = statistics.median(prices) if baselineN > 0 else 0
    is_rare_find = False
    
    if baselineN > 0 and baseline > 0:
        mad_val = statistics.median([abs(p - baseline) for p in prices])
        if eligible and current_ticket["price"] <= baseline - 2 * mad_val:
            is_rare_find = True
            
    return {
        "eligible": eligible,
        "is_rare_find": is_rare_find,
        "reasons": reasons
    }

def main():
    if not HISTORY_PATH.exists() or not RANKED_DEALS_PATH.exists():
        print(f"Cannot run backtest: Missing data files at {HISTORY_PATH} or {RANKED_DEALS_PATH}")
        return

    with open(HISTORY_PATH, "r", encoding="utf-8") as f:
        history = json.load(f)
        
    with open(RANKED_DEALS_PATH, "r", encoding="utf-8") as f:
        ranked_deals = json.load(f)

    # We only care about deals that are currently badged.
    current_deals = ranked_deals.get("deals", [])
    now_dt = datetime.now(timezone.utc)

    print(f"Found {len(current_deals)} deals currently badged under the OLD rules.")
    print("-" * 50)
    
    suppressed_count = 0
    retained_count = 0

    for deal in current_deals:
        route_key = deal.get("route_key", deal.get("display_name"))
        obs = history.get(route_key, [])
        
        # Reconstruct current ticket mock
        ticket = {
            "price": deal["price"],
            "expires_at": None, # Usually we don't have expires_at in ranked deals easily
            "found_at": deal.get("found_at") or deal.get("last_fresh_date")
        }
        
        feed_fetched_at = ticket["found_at"] or now_dt.isoformat()
        
        dq = deal_quality(obs, ticket, feed_fetched_at, now_dt)
        
        if dq["is_rare_find"] and dq["eligible"]:
            retained_count += 1
            print(f"[RETAINED] {route_key} (Price: {ticket['price']})")
        else:
            suppressed_count += 1
            reason_str = ", ".join(dq["reasons"])
            if not dq["eligible"]:
                print(f"[SUPPRESSED - INELIGIBLE] {route_key}: {reason_str}")
            elif not dq["is_rare_find"]:
                print(f"[SUPPRESSED - NOT MAD RARE] {route_key}: Price {ticket['price']} does not pass MAD threshold.")
                
    print("-" * 50)
    print(f"Summary: {retained_count} deals retained, {suppressed_count} deals suppressed.")

if __name__ == "__main__":
    main()
