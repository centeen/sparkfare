import json
import os
import io
from datetime import datetime, timezone, timedelta
import re
import urllib.request
import textwrap
import argparse
from PIL import Image, ImageDraw, ImageFont

BROADCAST_HISTORY_FILE = "sparkfare_broadcast_history.json"
RANKED_DEALS_FILE = "sparkfare_ranked_deals.json"
IMAGES_FILE = "sparkfare_images.json"

# Fonts
SPACE_GROTESK_URL = "https://raw.githubusercontent.com/google/fonts/main/ofl/spacegrotesk/SpaceGrotesk%5Bwght%5D.ttf"
IBM_PLEX_MONO_URL = "https://raw.githubusercontent.com/google/fonts/main/ofl/ibmplexmono/IBMPlexMono-Bold.ttf"

COLORS = {
    'paper': '#EDE6D6',
    'ledger': '#2B2620',
    'spark_gold': '#E8B930'
}

def load_json(filepath, default_val=None):
    if not os.path.exists(filepath):
        return default_val if default_val is not None else {}
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(filepath, data):
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)

def get_font(url, filename, size):
    if not os.path.exists(filename):
        try:
            print(f"Downloading font from {url}...")
            urllib.request.urlretrieve(url, filename)
        except Exception as e:
            print(f"Failed to download font {url}: {e}")
            return ImageFont.load_default()
    try:
        return ImageFont.truetype(filename, size)
    except Exception as e:
        print(f"Failed to load font {filename}: {e}")
        return ImageFont.load_default()

def select_best_deal():
    deals_data = load_json(RANKED_DEALS_FILE)
    if not deals_data or 'deals' not in deals_data:
        print("No deals data found.")
        return None
    
    deals = deals_data['deals']
    # Filter to only actual "deal" status
    deals = [d for d in deals if d.get('status') == 'deal']
    if not deals:
        print("No active deals currently.")
        return None
        
    history = load_json(BROADCAST_HISTORY_FILE, {})
    now = datetime.now(timezone.utc)
    
    candidates = []
    for d in deals:
        dest_name = d.get('display_name')
        last_broadcast_str = history.get(dest_name)
        if last_broadcast_str:
            last_broadcast = datetime.fromisoformat(last_broadcast_str)
            if (now - last_broadcast).days < 7:
                continue # Cooldown
        candidates.append(d)
        
    if not candidates:
        print("No deals available that aren't on cooldown.")
        return None
        
    # Biggest drop first, measured against the 30-day MEDIAN the site states everywhere
    # (basis_text), not the mean-based pct_below_avg.
    candidates.sort(key=lambda x: pct_below_median(x) or 0, reverse=True)
    return candidates[0]

def pct_below_median(deal):
    """Percent a fare sits below its route's 30-day MEDIAN (an int), or None if there is no median.
    Reads the figure from basis_text so every surface shows the same number; falls back to the
    same formula the ranking script uses. Never uses pct_below_avg (mean-based, a different number)."""
    m = re.match(r"\s*(-?\d+)% below 30-day median", deal.get('basis_text') or '')
    if m:
        return int(m.group(1))
    median_value, price = deal.get('median_baseline'), deal.get('price')
    if isinstance(median_value, (int, float)) and median_value > 0 and isinstance(price, (int, float)):
        return round((median_value - price) / median_value * 100)
    return None


def generate_image(deal, img_data):
    # Base size
    W, H = 1080, 1080
    
    if img_data and img_data.get('image_url'):
        url = img_data['image_url']
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as response:
                bg = Image.open(io.BytesIO(response.read())).convert('RGBA')
        except Exception as e:
            print(f"Failed to load image: {e}")
            bg = Image.new('RGBA', (W, H), COLORS['paper'])
    else:
        bg = Image.new('RGBA', (W, H), COLORS['paper'])
        
    # Resize and crop to 1080x1080
    bg_w, bg_h = bg.size
    ratio = max(W/bg_w, H/bg_h)
    new_w = int(bg_w * ratio)
    new_h = int(bg_h * ratio)
    bg = bg.resize((new_w, new_h), Image.Resampling.LANCZOS)
    
    left = (new_w - W) / 2
    top = (new_h - H) / 2
    right = (new_w + W) / 2
    bottom = (new_h + H) / 2
    bg = bg.crop((left, top, right, bottom))
    
    # Create dark gradient overlay for text readability
    overlay = Image.new('RGBA', (W, H), (0,0,0,0))
    draw_overlay = ImageDraw.Draw(overlay)
    # Bottom gradient
    for y in range(H):
        alpha = int(255 * (y / H) * 0.9)
        draw_overlay.line([(0, y), (W, y)], fill=(28, 24, 16, alpha))
    
    out = Image.alpha_composite(bg, overlay)
    draw = ImageDraw.Draw(out)
    
    font_main = get_font(SPACE_GROTESK_URL, "spacegrotesk.ttf", 90)
    font_sub = get_font(SPACE_GROTESK_URL, "spacegrotesk.ttf", 50)
    font_price = get_font(IBM_PLEX_MONO_URL, "ibmplex.ttf", 140)
    
    origin = deal.get('origin', 'JFK')
    dest = deal.get('display_name', 'Unknown')
    price = deal.get('price', 0)
    pct = pct_below_median(deal)
    
    text_origin = f"Flights from {origin} to"
    text_dest = dest
    
    # Text placement
    margin = 80
    
    # Price and PCT
    price_text = f"${price}"
    pct_text = f"{pct}% BELOW 30-DAY MEDIAN" if pct is not None else ""
    
    draw.text((margin, H - 320), price_text, font=font_price, fill=COLORS['spark_gold'])
    draw.text((margin, H - 180), pct_text, font=font_sub, fill=COLORS['paper'])
    
    # Destination
    draw.text((margin, margin), text_origin, font=font_sub, fill=COLORS['paper'])
    # wrap dest
    lines = textwrap.wrap(text_dest, width=15)
    y_offset = margin + 70
    for line in lines:
        draw.text((margin, y_offset), line, font=font_main, fill=COLORS['paper'])
        y_offset += 100
        
    # Sparkfare branding
    draw.text((W - margin - 350, H - margin - 40), "sparkfare.com", font=font_sub, fill=COLORS['paper'])
    
    return out.convert('RGB')

def post_bluesky(image_path, text, link):
    handle = os.environ.get('BLUESKY_HANDLE')
    password = os.environ.get('BLUESKY_PASSWORD')
    if not handle or not password:
        print("Bluesky credentials missing.")
        return
        
    try:
        from atproto import Client, client_utils
        client = Client()
        client.login(handle, password)
        
        with open(image_path, 'rb') as f:
            img_data = f.read()
            
        tb = client.send_image(
            text=text,
            image=img_data,
            image_alt="Flight deal card for " + text
        )
        print("Posted to Bluesky successfully.")
    except ImportError:
        print("atproto not installed. Cannot post to Bluesky.")
    except Exception as e:
        print(f"Bluesky post failed: {e}")

def post_mastodon(image_path, text, link):
    import requests
    api_url = os.environ.get('MASTODON_API_URL')
    token = os.environ.get('MASTODON_ACCESS_TOKEN')
    
    if not api_url or not token:
        print("Mastodon credentials missing.")
        return
        
    headers = {'Authorization': f'Bearer {token}'}
    
    try:
        # 1. Upload media
        with open(image_path, 'rb') as f:
            files = {'file': f}
            res = requests.post(f"{api_url}/api/v2/media", headers=headers, files=files)
        res.raise_for_status()
        media_id = res.json()['id']
        
        # 2. Post status
        status = f"{text}\n\n{link}"
        payload = {'status': status, 'media_ids[]': [media_id]}
        res = requests.post(f"{api_url}/api/v1/statuses", headers=headers, data=payload)
        res.raise_for_status()
        print("Posted to Mastodon successfully.")
    except Exception as e:
        print(f"Mastodon post failed: {e}")

def post_telegram(image_path, text, link):
    import requests
    bot_token = os.environ.get('TELEGRAM_BOT_TOKEN')
    chat_id = os.environ.get('TELEGRAM_CHAT_ID')
    
    if not bot_token or not chat_id:
        print("Telegram credentials missing.")
        return
        
    url = f"https://api.telegram.org/bot{bot_token}/sendPhoto"
    caption = f"{text}\n\n*Includes affiliate links*\n\n{link}"
    
    try:
        with open(image_path, 'rb') as f:
            files = {'photo': f}
            data = {'chat_id': chat_id, 'caption': caption}
            res = requests.post(url, files=files, data=data)
        res.raise_for_status()
        print("Posted to Telegram successfully.")
    except Exception as e:
        print(f"Telegram post failed: {e}")

PTO_ORIGINS = ['JFK', 'LAX', 'ORD', 'ATL', 'DFW', 'SFO', 'MIA', 'IAD', 'EWR', 'SEA', 'IAH', 'BOS', 'DEN', 'PHX', 'LAS']

ORIGIN_CITIES = {
    'JFK': 'New York', 'LAX': 'Los Angeles', 'ORD': 'Chicago', 'ATL': 'Atlanta',
    'DFW': 'Dallas', 'SFO': 'San Francisco', 'MIA': 'Miami', 'IAD': 'Washington',
    'EWR': 'Newark', 'SEA': 'Seattle', 'IAH': 'Houston', 'BOS': 'Boston',
    'DEN': 'Denver', 'PHX': 'Phoenix', 'LAS': 'Las Vegas'
}

def compute_next_long_weekend(now_dt=None):
    if now_dt is None:
        now_dt = datetime.now(timezone.utc)
    candidates = []
    for y in [now_dt.year, now_dt.year + 1]:
        # Thanksgiving block: 4th Thu in Nov to Sun
        nov1 = datetime(y, 11, 1, tzinfo=timezone.utc)
        thursday_offset = (3 - nov1.weekday() + 7) % 7
        tg = nov1 + timedelta(days=thursday_offset + 21)
        sun_tg = tg + timedelta(days=3)
        candidates.append((tg, sun_tg))
        
        # Christmas block: Dec 25
        xmas = datetime(y, 12, 25, tzinfo=timezone.utc)
        dow = xmas.weekday()
        if dow == 4:
            candidates.append((xmas, xmas + timedelta(days=2)))
        elif dow == 0:
            candidates.append((xmas - timedelta(days=2), xmas))
        else:
            candidates.append((xmas, xmas + timedelta(days=3)))

        # New Year: Jan 1
        ny = datetime(y, 1, 1, tzinfo=timezone.utc)
        candidates.append((ny, ny + timedelta(days=2)))

        # Memorial Day: last Mon in May
        may31 = datetime(y, 5, 31, tzinfo=timezone.utc)
        mem = may31 - timedelta(days=may31.weekday())
        candidates.append((mem - timedelta(days=2), mem))

        # Labor Day: 1st Mon in Sep
        sep1 = datetime(y, 9, 1, tzinfo=timezone.utc)
        mon_offset = (0 - sep1.weekday() + 7) % 7
        lab = sep1 + timedelta(days=mon_offset)
        candidates.append((lab - timedelta(days=2), lab))

    upcoming = [c for c in candidates if c[0] >= now_dt - timedelta(days=1)]
    upcoming.sort(key=lambda c: c[0])
    if not upcoming:
        return "Nov 26-29"
    start, end = upcoming[0]
    months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    s_m, e_m = months[start.month - 1], months[end.month - 1]
    if s_m == e_m:
        return f"{s_m} {start.day}-{end.day}"
    return f"{s_m} {start.day} - {e_m} {end.day}"

def select_pto_origin(requested_origin=None):
    if requested_origin and requested_origin.upper() in PTO_ORIGINS:
        return requested_origin.upper()
    history = load_json(BROADCAST_HISTORY_FILE, {})
    now = datetime.now(timezone.utc)
    candidates = []
    for o in PTO_ORIGINS:
        key = f"pto_{o}"
        last_str = history.get(key)
        if last_str:
            try:
                last_dt = datetime.fromisoformat(last_str)
                if (now - last_dt).days < 7:
                    continue
            except Exception:
                pass
        candidates.append(o)
    return candidates[0] if candidates else PTO_ORIGINS[0]

def get_share_card_image(origin):
    card_url = f"https://sparkfare.com/og/time-off/{origin.lower()}.png"
    out_path = f"deal_card.jpg"
    try:
        req = urllib.request.Request(card_url, headers={'User-Agent': 'SparkfareSocialBot/1.0'})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = resp.read()
            with open(out_path, 'wb') as f:
                f.write(data)
            print(f"Downloaded share card from {card_url}")
            return out_path
    except Exception as e:
        print(f"Could not download remote share card ({e}), generating local card...")
    
    W, H = 1200, 630
    img = Image.new("RGB", (W, H), color=COLORS['paper'])
    draw = ImageDraw.Draw(img)
    draw.rectangle([20, 20, W - 20, H - 20], outline="#D9CBB0", width=2)
    font_title = get_font(SPACE_GROTESK_URL, "SpaceGrotesk-Bold.ttf", 46)
    font_sub = get_font(IBM_PLEX_MONO_URL, "IBMPlexMono-Bold.ttf", 26)
    city = ORIGIN_CITIES.get(origin, origin)
    draw.text((60, 180), "Sparkfare Time-Off Planner", fill="#2B2620", font=font_title)
    draw.text((60, 260), f"2026-2027 Long Weekends from {city} ({origin})", fill="#4F7A52", font=font_title)
    draw.text((60, 380), f"sparkfare.com/time-off/{origin.lower()}", fill="#6B5A45", font=font_sub)
    img.save(out_path, quality=90)
    return out_path

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true', help="Generate image and skip posting")
    parser.add_argument('--pto', action='store_true', help="Broadcast weekly long weekend PTO post")
    parser.add_argument('--origin', type=str, default=None, help="Origin code for PTO broadcast")
    args = parser.parse_args()
    
    if args.pto:
        origin = select_pto_origin(args.origin)
        city = ORIGIN_CITIES.get(origin, origin)
        date_range = compute_next_long_weekend()
        text = f"Next long weekend from {city}: {date_range}. See your time-off plan."
        link = f"https://sparkfare.com/time-off/{origin.lower()}?src=social"
        img_path = get_share_card_image(origin)
        
        print(f"Selected PTO Origin: {origin} ({city})")
        print("Post Text:", text)
        print("Post Link:", link)
        print("Image Path:", img_path)
        
        if args.dry_run:
            print("Dry run complete. Exiting without posting.")
            return
            
        post_bluesky(img_path, f"{text}\n\n{link}", link)
        post_mastodon(img_path, text, link)
        post_telegram(img_path, text, link)
        
        history = load_json(BROADCAST_HISTORY_FILE, {})
        history[f"pto_{origin}"] = datetime.now(timezone.utc).isoformat()
        save_json(BROADCAST_HISTORY_FILE, history)
        print(f"Updated {BROADCAST_HISTORY_FILE}")
        return

    deal = select_best_deal()
    if not deal:
        print("No deal to broadcast today.")
        return
        
    dest_name = deal['display_name']
    print(f"Selected deal: {dest_name} from {deal['origin']} at ${deal['price']}")
    
    images_data = load_json(IMAGES_FILE)
    img_data = images_data.get(dest_name, {})
    
    img = generate_image(deal, img_data)
    img_path = "deal_card.jpg"
    img.save(img_path, quality=90)
    print(f"Saved image to {img_path}")
    
    # Prepare text
    origin = deal.get('origin', 'JFK')
    pct = pct_below_median(deal)
    slug = dest_name.split(',')[0].lower().replace(' ', '-').replace('--', '-')
    
    # Soft-launch mode: Observed prices, no "deal" framing or seasonal hooks yet.
    text = f"Current flight price observation: {origin} to {dest_name} is ${deal['price']}."
    
    import urllib.parse
    encoded_dest = urllib.parse.quote(dest_name)
    link = f"https://sparkfare.com/share/deal?origin={origin}&dest={encoded_dest}&price={deal['price']}"
    
    print("Post Text:", text)
    print("Post Link:", link)
    
    if args.dry_run:
        print("Dry run complete. Exiting without posting.")
        return
        
    # Post
    post_bluesky(img_path, f"{text}\n\n{link}", link)
    post_mastodon(img_path, text, link)
    post_telegram(img_path, text, link)
    
    # Update idempotency history
    history = load_json(BROADCAST_HISTORY_FILE, {})
    history[dest_name] = datetime.now(timezone.utc).isoformat()
    save_json(BROADCAST_HISTORY_FILE, history)
    print(f"Updated {BROADCAST_HISTORY_FILE}")

if __name__ == '__main__':
    main()
