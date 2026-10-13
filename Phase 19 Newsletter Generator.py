import os
import json
import requests
import datetime
import sys

# The subject and intro rules live in newsletter_subjects.py so they can be tested without the network.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import newsletter_subjects as ns

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
KPI_DASHBOARD_SECRET = os.environ.get("KPI_DASHBOARD_SECRET")
# Model used for the intro and subject lines. Overridable without a code change if this ID is retired.
NEWSLETTER_MODEL = os.environ.get("NEWSLETTER_MODEL", "claude-3-haiku-20240307")

# Mock for local testing if secrets aren't present
MOCK_MODE = not ANTHROPIC_API_KEY or not KPI_DASHBOARD_SECRET

VALID_ORIGINS = ['JFK','LAX','ORD','ATL','DFW','SFO','MIA','IAD','EWR','SEA','IAH','BOS','DEN','PHX','LAS','PHL','MSP','CLT','DTW','FLL','BWI','AUS','TLV']

def pct_below_median_key(record):
    """Rank by how far below its 30-day MEDIAN a fare sits, the baseline every badge states."""
    median_value, price = record.get("median_baseline"), record.get("price")
    if isinstance(median_value, (int, float)) and median_value > 0 and isinstance(price, (int, float)):
        return (median_value - price) / median_value
    return 0.0


def get_deals():
    deals = {}
    try:
        with open("sparkfare_ranked_deals.json", "r") as f:
            data = json.load(f)
            deals['JFK'] = sorted(data.get("deals", []), key=pct_below_median_key, reverse=True)[:3]
    except Exception as e:
        print(f"Error loading JFK deals: {e}")

    try:
        with open("sparkfare_ranked_deals_other_origins.json", "r") as f:
            data = json.load(f)
            all_other = data.get("deals", [])
            for origin in VALID_ORIGINS:
                if origin == 'JFK': continue
                origin_deals = [d for d in all_other if d.get('origin') == origin]
                deals[origin] = sorted(origin_deals, key=pct_below_median_key, reverse=True)[:3]
    except Exception as e:
        print(f"Error loading other origin deals: {e}")
        
    return deals

GENERIC_COPY = {
    "intro": "We found some flight deals this week.",
    "subjectA": "New flight deals inside",
    "subjectB": "Flight deals from your airport",
}


def call_claude(origin, deals):
    """Ask the model for an intro and two subject lines. The result is untrusted: main() validates it."""
    if not deals:
        return dict(GENERIC_COPY)

    if MOCK_MODE:
        return ns.mock_copy(origin, deals)

    city = ns.origin_city(origin)
    first = deals[0]
    first_dest = ns.dest_city(first.get("display_name"))
    first_price = int(round(float(first.get("price"))))
    dests = ", ".join(ns.dest_city(d.get("display_name")) for d in deals)

    prompt = f"""
    Write copy for a weekly flight-deal email from Sparkfare, going to people who fly from {city} ({origin}).
    The email lists these destinations, in this order: {dests}. The FIRST one is {first_dest}, at ${first_price} round trip.

    Return a 2-sentence intro and two subject lines.
    - subjectA: a curiosity-gap line that is TRUE of the first deal. Example shapes: "Where $412 gets you from Boston this week",
      "The cheapest place we found from Chicago". If you mention a price it must be exactly ${first_price}. Do not name any
      destination except {first_dest}.
    - subjectB: a direct, price-led line, for example "Lowest fares from {city}: {first_dest} ${first_price}".
    Hard limits, both subjects: under 58 characters. Never use: "you won't believe", "dirt cheap", "huge", "steal", "right now",
    "hurry", "last chance", "unbeatable", any percentage or "% off", "save", "discount", "free", or any form of the words "book",
    "secure", "lock", "reserve". Do not say Sparkfare books, arranges or secures anything. No exclamation marks.
    The intro: calm and factual, no hype, same word limits as above.

    Return ONLY a raw JSON object with keys "intro", "subjectA", "subjectB". No markdown, no wrapping.
    """

    headers = {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    }

    payload = {
        "model": NEWSLETTER_MODEL,
        "max_tokens": 300,
        "temperature": 0.7,
        "messages": [{"role": "user", "content": prompt}]
    }

    resp = requests.post("https://api.anthropic.com/v1/messages", headers=headers, json=payload)
    if resp.status_code != 200:
        print(f"Claude API Error: {resp.text}")
        return dict(GENERIC_COPY)

    content = ""
    try:
        content = resp.json()['content'][0]['text'].strip()
        return json.loads(content)
    except Exception as e:
        print(f"Claude JSON parsing error: {e}; raw output: {content}")
        return dict(GENERIC_COPY)


def main():
    print("Gathering deals for newsletter...")
    deals_by_origin = get_deals()
    
    payload = {}
    for origin, deals in deals_by_origin.items():
        if not deals:
            continue
            
        dests = [d['display_name'] for d in deals]
        print(f"[{origin}] Top deals: {', '.join(dests)}")

        generated = call_claude(origin, deals)
        copy = ns.choose_copy(generated, origin, deals)
        # Log which subject went out, and why a generated one was rejected (D-009).
        print(f"[{origin}] subject used: {copy['subject_used']} -> {copy['subjectA']!r}")
        for r in copy["rejections"]:
            print(f"[{origin}] REJECTED {r['field']} {r['value']!r}: {'; '.join(r['reasons'])}")
        payload[origin] = {
            "deals": deals,
            "intro": copy["intro"],
            "subjectA": copy["subjectA"],
            "subjectB": copy["subjectB"],
            "subject_used": copy["subject_used"],
            "subject_rejections": copy["rejections"],
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
