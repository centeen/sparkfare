import os
import json
import requests
import datetime

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
KPI_DASHBOARD_SECRET = os.environ.get("KPI_DASHBOARD_SECRET")

# Mock for local testing if secrets aren't present
MOCK_MODE = not ANTHROPIC_API_KEY or not KPI_DASHBOARD_SECRET

VALID_ORIGINS = ['JFK','LAX','ORD','ATL','DFW','SFO','MIA','IAD','EWR','SEA','IAH','BOS','TLV']

def get_deals():
    deals = {}
    try:
        with open("sparkfare_ranked_deals.json", "r") as f:
            data = json.load(f)
            deals['JFK'] = sorted(data.get("deals", []), key=lambda x: x.get('pct_below_avg', 0), reverse=True)[:3]
    except Exception as e:
        print(f"Error loading JFK deals: {e}")

    try:
        with open("sparkfare_ranked_deals_other_origins.json", "r") as f:
            data = json.load(f)
            all_other = data.get("deals", [])
            for origin in VALID_ORIGINS:
                if origin == 'JFK': continue
                origin_deals = [d for d in all_other if d.get('origin') == origin]
                deals[origin] = sorted(origin_deals, key=lambda x: x.get('pct_below_avg', 0), reverse=True)[:3]
    except Exception as e:
        print(f"Error loading other origin deals: {e}")
        
    return deals

def call_claude(destinations):
    if not destinations:
        return {"intro": "We found some great flight deals this week.", "subjectA": "New Flight Deals Inside", "subjectB": "Check out these low fares"}
        
    if MOCK_MODE:
        return {
            "intro": f"Ready to explore {', '.join(destinations)}? We tracked huge price drops on these routes this week.",
            "subjectA": "You won't believe these prices",
            "subjectB": f"Flights to {destinations[0]} are dirt cheap right now"
        }

    prompt = f"""
    Write a 2-sentence email intro for a flight deal newsletter about traveling to {', '.join(destinations)}. 
    Keep it punchy, engaging, and focus on the excitement of travel. 
    Also write two A/B subject lines:
    - subjectA: A curiosity-gap style subject line (e.g. "You won't believe what flights to X cost today")
    - subjectB: A direct-price style subject line (e.g. "Cheap flights to X, Y, and Z")
    
    Return ONLY a raw JSON object with keys "intro", "subjectA", "subjectB". No markdown, no wrapping.
    """

    headers = {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    }

    payload = {
        "model": "claude-3-haiku-20240307",
        "max_tokens": 150,
        "temperature": 0.7,
        "messages": [{"role": "user", "content": prompt}]
    }

    resp = requests.post("https://api.anthropic.com/v1/messages", headers=headers, json=payload)
    if resp.status_code != 200:
        print(f"Claude API Error: {resp.text}")
        return {"intro": "We found some great flight deals this week.", "subjectA": "New Flight Deals Inside", "subjectB": "Check out these low fares"}
        
    try:
        content = resp.json()['content'][0]['text'].strip()
        return json.loads(content)
    except Exception as e:
        print(f"Claude JSON parsing error: {e}\nRaw output: {content}")
        return {"intro": "We found some great flight deals this week.", "subjectA": "New Flight Deals Inside", "subjectB": "Check out these low fares"}

def main():
    print("Gathering deals for newsletter...")
    deals_by_origin = get_deals()
    
    payload = {}
    for origin, deals in deals_by_origin.items():
        if not deals:
            continue
            
        dests = [d['display_name'] for d in deals]
        print(f"[{origin}] Top deals: {', '.join(dests)}")
        
        copy = call_claude(dests)
        payload[origin] = {
            "deals": deals,
            "intro": copy.get("intro"),
            "subjectA": copy.get("subjectA"),
            "subjectB": copy.get("subjectB")
        }

    print("Sending payload to Sparkfare Cloudflare Worker...")
    if MOCK_MODE:
        print("MOCK MODE: Skipping API call.")
        with open("mock_newsletter_payload.json", "w") as f:
            json.dump(payload, f, indent=2)
        return

    res = requests.post(
        f"https://sparkfare.com/api/admin/trigger-newsletter?key={KPI_DASHBOARD_SECRET}",
        json=payload
    )
    
    if res.status_code == 200:
        print("Success! Newsletters queued.")
    else:
        print(f"Failed to trigger newsletter: {res.status_code} {res.text}")
        exit(1)

if __name__ == "__main__":
    main()
