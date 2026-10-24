"""
Workplan Step 106 (GTM Plan Update, Phase 17 -- Programmatic SEO generator).

Generates one static landing page per (origin, destination) pair -- 12 real US origins x 40
curated destinations = 480 pages, served at /data/{origin}-to-{destination} (extensionless, same
convention as /blog/*.html -- Cloudflare 307-redirects a .html URL to its extensionless form, so
every internal link/canonical here omits it, same lesson already learned building the blog).

TLV is deliberately excluded (12 origins, not 13) -- consistent with its existing de-prioritized,
not-marketed status; this is a public-facing acquisition surface, the opposite of TLV's placement.

Freshness split, same as everywhere else in this project: JFK pages read from its own always-fresh
daily file (sparkfare_ranked_deals.json); the other 11 origins read from the 24h-delayed combined
file (sparkfare_ranked_deals_other_origins.json). There is no single "daily JSON output" covering
all 12 origins, despite how the source GTM doc described it -- see CLAUDE.md's Step 106 entry.

Each page shows whatever is honestly true for that route today -- a real deal, a priced-but-not-a-
deal comparison, a Cluster-4 "featured" price with no baseline to compare against (Cluster 4 never
computes a baseline -- see the ranking script's own classify_destination()), or a plain
"building price history" / "no current data" state. Nothing here is fabricated to make every page
look like a deal.

Workplan Step 118 (seasonal SEO angle): H1s for any priced record (deal/priced_no_deal/featured)
name the season the route's own departure_at actually falls in (e.g. "JFK to Tokyo Winter
Flights: 22% Below 30-Day Median") -- derived from the real itinerary date, not the date the page
happens to be generated. The no-data "building price history" state has no fare to attach a season
to, so it's deliberately left in its plain, non-seasonal form.

Run manually with `python "Phase 17 pSEO Generator (Step 106).py"`, or via the
daily-compile-other-origins.yml workflow (runs after both the JFK and other-origins pipelines have
refreshed for the day, so both source files are current when this generates).
"""
import json
import os
import re
from datetime import datetime, timedelta, timezone
SITE_NAV_HTML = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'brand', 'header.html'), encoding='utf-8').read()

from unsplash_img import img_attrs

# K-B7: the photo on a route page spans the card, so a phone fetches the full width and a desktop at most the card width.
DEST_PHOTO_SIZES = "(max-width: 767px) 100vw, 760px"

DESTINATIONS_PATH = "sparkfare_destinations.json"
IMAGES_PATH = "sparkfare_images.json"
JFK_DEALS_PATH = "sparkfare_ranked_deals.json"
OTHER_DEALS_PATH = "sparkfare_ranked_deals_other_origins.json"
OUTPUT_DIR = "data"
SITEMAP_PATH = "sitemap.xml"
SITE_URL = "https://sparkfare.com"
SEO_CACHE_PATH = "sparkfare_seo_cache.json"

# Set to False and provide ANTHROPIC_API_KEY environment variable to use real Claude API
MOCK_CLAUDE_API = False

# The US origins only (TLV excluded), see module docstring. tests/origin_lists_sync.test.js keeps this in step
# with the fetch workflow, so add a new origin there and here together.
ORIGINS = [
    ("JFK", "New York"), ("LAX", "Los Angeles"), ("ORD", "Chicago"), ("ATL", "Atlanta"),
    ("DFW", "Dallas"), ("SFO", "San Francisco"), ("MIA", "Miami"), ("IAD", "Washington DC"),
    ("EWR", "Newark"), ("SEA", "Seattle"), ("IAH", "Houston"), ("BOS", "Boston"),
    ("DEN", "Denver"), ("PHX", "Phoenix"), ("LAS", "Las Vegas"),
    ("PHL", "Philadelphia"), ("MSP", "Minneapolis"), ("CLT", "Charlotte"),
    ("DTW", "Detroit"), ("FLL", "Fort Lauderdale"), ("BWI", "Baltimore"), ("AUS", "Austin"),
]

DEAL_BUCKETS = ("deals", "featured", "priced_no_deal", "insufficient_history", "no_data")


def slugify(name):
    s = name.lower()
    for ch in ("/", "&", "(", ")", ","):
        s = s.replace(ch, " ")
    s = re.sub(r"[^a-z0-9\s-]", "", s)
    return re.sub(r"\s+", "-", s.strip())


def load_json(path):
    if not os.path.exists(path):
        return {}
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def index_by_route(feed):
    """Maps (origin, display_name) -> record, across every bucket in a ranked-deals file."""
    by_route = {}
    for bucket in DEAL_BUCKETS:
        for record in feed.get(bucket, []):
            by_route[(record.get("origin"), record.get("display_name"))] = record
    return by_route


def fmt_price(price):
    return f"${price:,.0f}" if isinstance(price, (int, float)) else "N/A"


# K-B3 (ROADMAP step 127): the route page is built around the same fare ticket as the homepage (K-A6). The rules below mirror
# index.html's ticket helpers; tests/k_b3_route_page.test.js keeps the airline map and the thresholds in step with that file.
AIRLINE_NAMES = {
    "TK": "Turkish Airlines", "UA": "United", "AA": "American", "F9": "Frontier", "AV": "Avianca", "AC": "Air Canada",
    "KE": "Korean Air", "SK": "SAS", "B6": "JetBlue", "QR": "Qatar Airways", "CM": "Copa Airlines", "TP": "TAP Air Portugal",
    "BA": "British Airways", "AI": "Air India", "Y4": "Volaris", "CX": "Cathay Pacific", "AM": "Aeromexico",
    "AS": "Alaska Airlines", "LH": "Lufthansa", "FI": "Icelandair", "EY": "Etihad", "W6": "Wizz Air", "W4": "Wizz Air Malta",
    "LX": "Swiss", "EI": "Aer Lingus", "VB": "Viva Aerobus", "PR": "Philippine Airlines", "AT": "Royal Air Maroc",
    "JU": "Air Serbia", "DE": "Condor", "RO": "Tarom", "UX": "Air Europa", "LA": "LATAM", "OZ": "Asiana", "NH": "ANA",
    "A3": "Aegean", "AY": "Finnair", "BF": "French Bee", "DM": "Arajet", "6H": "Israir", "LO": "LOT Polish Airlines",
    "WN": "Southwest", "GF": "Gulf Air", "KQ": "Kenya Airways", "MU": "China Eastern", "ET": "Ethiopian", "SV": "Saudia",
    "KL": "KLM", "RJ": "Royal Jordanian", "CZ": "China Southern", "CA": "Air China", "QF": "Qantas", "AZ": "ITA Airways",
    "BR": "EVA Air", "WS": "WestJet", "SQ": "Singapore Airlines", "OS": "Austrian", "VS": "Virgin Atlantic",
}
PRICE_FRESH_HOURS = 48         # a price found within this long ago is "checked"; older is "as of"
LAPSE_DAYS = 3                 # last seen more than this many calendar days ago: no fare link, never a deal (J1 A3)
DEPARTURE_GUARD_HOURS = 48     # a fare that leaves within this long is not shown (J1 A2)
DEAL_FLOOR_PCT = 15            # D-021: a deal is at least this far below the median; the chart shades that region
TICKET_DISCLOSURE = "Sparkfare may earn a commission if you buy through this link, at no extra cost to you."
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
CLOCK_ICON = (
    '<svg class="chip-icon" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">'
    '<circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" stroke-width="1.2"/>'
    '<path d="M6 3.2V6l1.9 1.2" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>'
)


def esc(s):
    return (str(s if s is not None else "").replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def parse_when(value):
    """An ISO timestamp with or without an offset, as an aware UTC datetime; None if it cannot be read."""
    if not value:
        return None
    try:
        text = str(value).replace("Z", "+00:00")
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def short_date(iso_date):
    """'2026-10-17' -> 'Oct 17'."""
    try:
        return f"{MONTHS[int(iso_date[5:7]) - 1]} {int(iso_date[8:10])}"
    except (TypeError, ValueError, IndexError):
        return ""


def fare_dates_text(record):
    """'Mar 1-5, 4 nights' from the fare's own departure and return dates, as written (destination-local, no conversion)."""
    dep, ret = (record.get("departure_at") or "")[:10], (record.get("return_at") or "")[:10]
    if not short_date(dep):
        return ""
    if not short_date(ret):
        return short_date(dep)
    try:
        nights = (datetime.fromisoformat(ret) - datetime.fromisoformat(dep)).days
    except ValueError:
        nights = 0
    same_month = dep[5:7] == ret[5:7]
    span = f"{short_date(dep)}–{int(ret[8:10])}" if same_month else f"{short_date(dep)}–{short_date(ret)}"
    return span + (f", {nights} night{'s' if nights != 1 else ''}" if nights > 0 else "")


def fare_state(record, now):
    """What the page may say about the price: 'none' (no price, or the fare has left or leaves within 48 h), 'lapsed' (last seen more
    than 3 calendar days ago), 'carried' (carried forward from an earlier day), 'older' (a real price, but not found within 48 h) or
    'current'."""
    if not record or not isinstance(record.get("price"), (int, float)):
        return "none"
    departs = parse_when(record.get("departure_at"))
    if departs is not None and departs <= now + timedelta(hours=DEPARTURE_GUARD_HOURS):
        return "none"
    carried = bool(record.get("is_stale_fallback"))
    last = (record.get("last_fresh_date") or "")[:10] if carried else (record.get("found_at") or "")[:10]
    try:
        last_day = datetime.fromisoformat(last).replace(tzinfo=timezone.utc) if last else None
    except ValueError:
        last_day = None
    if last_day is not None and (now.date() - last_day.date()).days > LAPSE_DAYS:
        return "lapsed"
    if carried:
        return "carried"
    found = parse_when(record.get("found_at"))
    if found is None or now - found > timedelta(hours=PRICE_FRESH_HOURS):
        return "older"
    return "current"


def asof_text(record, state):
    """One honest line saying when the price was seen. Always a clock time and a zone, never 'live'."""
    if state == "lapsed" or state == "carried":
        last = (record.get("last_fresh_date") or record.get("found_at") or "")[:10]
        when = short_date(last)
        if state == "lapsed":
            return f"Last seen {when}." if when else ""
        return f"Last seen {when}. No newer price today, so this one is carried forward." if when else ""
    found = parse_when(record.get("found_at"))
    if found is None:
        return ""
    stamp = f"{MONTHS[found.month - 1]} {found.day}, {found.hour % 12 or 12}:{found.minute:02d} {'AM' if found.hour < 12 else 'PM'} UTC"
    # The UTC time is the no-JavaScript fallback; /as-of-local.js swaps it for the visitor's own zone (owner decision 2026-10-24).
    marked = f'<span data-asof="{found.astimezone(timezone.utc).isoformat()}">{stamp}</span>'
    return f"Checked {marked}." if state == "current" else f"Prices as of {marked}."


def chip_for(record, state):
    """(kind, label, with_clock_icon). One chip per fare: Deal, Typical, Building history, Last seen or No verdict."""
    if state == "lapsed":
        return "lastseen", "Last seen " + short_date((record.get("last_fresh_date") or record.get("found_at") or "")[:10]), True
    if record.get("status") == "deal":
        return "deal", "Deal", False
    if record.get("status") == "priced_no_deal":
        return "typical", "Typical", False
    if record.get("status") == "insufficient_history":
        return "building", "Building history", False
    return "noverdict", "No verdict", False


def route_chart_svg(record, state):
    """The route's own 30-day history as a chart: a solid line of the lowest fare seen each day, a dashed 30-day median, the region 15%
    or more below it (the deal floor, D-021) and today's fare as a dot (gold only on a deal). Describes the data, never predicts. Returns
    '' when there are fewer than two days to plot."""
    points = [(o.get("date"), o.get("price")) for o in (record.get("observations") or [])
              if isinstance(o.get("price"), (int, float)) and o.get("date")]
    price = record.get("price")
    if state in ("current", "older") and isinstance(price, (int, float)):
        today = (record.get("found_at") or "")[:10]
        if today and (not points or points[-1][0][:10] != today):
            points.append((today, price))
    points = points[-31:]
    if len(points) < 2:
        return ""
    median = record.get("median_baseline") if isinstance(record.get("median_baseline"), (int, float)) else None
    floor = median * (1 - DEAL_FLOOR_PCT / 100) if median else None
    values = [p for _, p in points] + [v for v in (median, floor) if v is not None]
    lo, hi = min(values), max(values)
    span = (hi - lo) or 1
    width, height, padx, pady = 640, 170, 10, 14

    def x(i):
        return padx + i * (width - 2 * padx) / (len(points) - 1)

    def y(v):
        return pady + (1 - (v - lo) / span) * (height - 2 * pady)

    parts = [f'<svg class="route-chart" viewBox="0 0 {width} {height}" role="img" aria-label="{esc(chart_alt(points, median, price))}">']
    if floor is not None:
        parts.append(f'<rect x="0" y="{y(floor):.1f}" width="{width}" height="{height - y(floor):.1f}" fill="var(--line)" opacity="0.35"/>')
    if median is not None:
        parts.append(f'<line x1="0" x2="{width}" y1="{y(median):.1f}" y2="{y(median):.1f}" stroke="var(--ink-2)" stroke-width="1.5" stroke-dasharray="5 4"/>')
    line = " ".join(f"{x(i):.1f},{y(p):.1f}" for i, (_, p) in enumerate(points))
    parts.append(f'<polyline points="{line}" fill="none" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>')
    if state in ("current", "older") and isinstance(price, (int, float)):
        dot = 'fill="var(--spark)" stroke="var(--spark-ink)" stroke-width="1.5"' if record.get("status") == "deal" else 'fill="var(--ink)"'
        parts.append(f'<circle cx="{x(len(points) - 1):.1f}" cy="{y(price):.1f}" r="5" {dot}/>')
    parts.append("</svg>")
    return "".join(parts)


def chart_alt(points, median, price):
    lowest = min(p for _, p in points)
    highest = max(p for _, p in points)
    text = f"Lowest fare seen each day over {len(points)} days, from ${lowest:,.0f} to ${highest:,.0f}."
    if median is not None:
        text += f" The 30-day median is ${median:,.0f}."
    return text


def chart_caption(record):
    median = record.get("median_baseline")
    bits = ["Solid line: the lowest fare we saw each day."]
    if isinstance(median, (int, float)):
        bits.append(f"Dashed line: the 30-day median, {fmt_price(median)}. Shaded area: {DEAL_FLOOR_PCT}% or more below the median.")
    return " ".join(bits)


def fare_link_href(record):
    from urllib.parse import quote
    return "/out/aviasales?url=" + quote(record.get("booking_link") or "", safe="") + "&src=route"


def build_ticket_html(origin, origin_label, dest, record, state, now):
    """The fare ticket: route, price with one chip, basis, dates and airline, as-of, then View fare and Watch. A last-seen fare has no
    fare link and no disclosure. Never called when there is no current price (see build_route_body)."""
    city, _, region = dest.partition(",")
    kind, label, icon = chip_for(record, state)
    chip = f'<span class="chip chip-{kind}">{CLOCK_ICON if icon else ""}{esc(label)}</span>'
    basis = ""
    if kind == "deal" and record.get("basis_text"):
        median = record.get("median_baseline")
        under = (" · " + fmt_price(round(median - record["price"])) + " under") if isinstance(median, (int, float)) and record["price"] < median else ""
        basis = f'<p class="ticket-basis">{esc(record["basis_text"])}{under}</p>'
    elif kind == "typical" and isinstance(record.get("median_baseline"), (int, float)):
        basis = f'<p class="ticket-basis">30-day median {fmt_price(round(record["median_baseline"]))}</p>'
    detail = [t for t in (fare_dates_text(record), AIRLINE_NAMES.get(record.get("airline"), record.get("airline") or ""), "round trip") if t]
    asof = asof_text(record, state)
    fare = ""
    if kind != "lastseen":
        fare = (f'<a class="fare-link" href="{esc(fare_link_href(record))}" target="_blank" rel="sponsored nofollow noopener" '
                f'aria-label="View this fare on a booking site (opens in a new tab). Sparkfare does not sell or book travel.">View fare ↗</a>')
    watch = f'<a class="watch-link" href="#signup-form" aria-label="Watch {esc(origin)} to {esc(city)} by email">Watch</a>'
    dot = " · "
    region_html = (' <span class="ticket-region">' + esc(region.strip()) + "</span>") if region.strip() else ""
    # asof_text() returns markup it built from numbers and fixed words only, so it is not escaped again.
    asof_html = ('<p class="ticket-asof">' + asof + "</p>") if asof else ""
    disclosure_html = ('<p class="ticket-disclosure">' + TICKET_DISCLOSURE + "</p>") if fare else ""
    return (
        '<div class="ticket">'
        f'<p class="ticket-route">{esc(origin)} → {esc(city.strip())}{region_html}</p>'
        f'<p class="ticket-price"><span class="price">{fmt_price(record["price"])}</span> {chip}</p>'
        f'{basis}'
        f'<p class="ticket-detail">{esc(dot.join(detail))}</p>'
        f'{asof_html}'
        '<div class="ticket-perf" aria-hidden="true"></div>'
        f'<div class="ticket-actions">{fare}{watch}</div>'
        f'{disclosure_html}'
        '</div>'
    )


def build_route_body(origin, origin_label, dest, record, now):
    """K-B3: the page's lead block. A route with a usable price gets the fare ticket and the 30-day chart; a route without one (building
    history, no data, or the fare has left) gets one honest sentence and no price, no chip and no fare link (J3 C2)."""
    state = fare_state(record, now)
    city = dest.partition(",")[0].strip()
    if state == "none":
        return (f'<div class="route-empty"><p class="chip chip-building">Building history</p>'
                f"<p class=\"route-empty-line\">We haven't seen enough fares for {esc(origin_label)} to {esc(city)} yet.</p>"
                f'<p class="route-empty-sub">Watch this route below and we\'ll email you when there is a fare to compare.</p></div>')
    ticket = build_ticket_html(origin, origin_label, dest, record, state, now)
    note = ""
    if record.get("status") == "featured":
        note = ("<p class=\"route-note\">This route doesn't get judged against a 30-day baseline (see our "
                "<a href=\"/blog/destination-clusters-explained\">destination groups</a> post for why), but it's a real, current fare.</p>")
    chart = route_chart_svg(record, state)
    figure = (f'<figure class="route-figure">{chart}<figcaption>{esc(chart_caption(record))}</figcaption></figure>' if chart else "")
    return ticket + note + figure


def pct_below_median(record):
    """The percentage a fare sits below its route's 30-day MEDIAN -- the one baseline the whole site
    states (the ranking script's basis_text, the homepage, emails and share cards). Reads the figure
    out of basis_text so there is a single source; falls back to the same formula the ranking script
    uses. Never uses pct_below_avg, which is measured against the mean and would show a different
    number for the same route. Returns an int, or None if there is no median to compare against."""
    m = re.match(r"\s*(-?\d+)% below 30-day median", record.get("basis_text") or "")
    if m:
        return int(m.group(1))
    median, price = record.get("median_baseline"), record.get("price")
    if isinstance(median, (int, float)) and median > 0 and isinstance(price, (int, float)):
        return round((median - price) / median * 100)
    return None


# Workplan Step 118 (GTM Launch Plan, Phase 20 -- seasonal SEO angle). Northern-hemisphere
# seasons, matching the US-origin audience this project actually targets. Derived from the
# record's own departure_at -- the real month a traveler would actually fly this route, not the
# date the page happens to be generated -- so "Winter Flights" means the priced itinerary itself
# departs in winter, not that today is a winter day. Only priced records (deal/priced_no_deal/
# featured) carry a real departure_at; the no-data "building history" state has no fare to attach
# a season to, so it's deliberately left out of the seasonal framing below.
_SEASONS = {12: "Winter", 1: "Winter", 2: "Winter", 3: "Spring", 4: "Spring", 5: "Spring",
            6: "Summer", 7: "Summer", 8: "Summer", 9: "Fall", 10: "Fall", 11: "Fall"}


def season_for_departure(record):
    departure_at = (record or {}).get("departure_at")
    if not departure_at:
        return None
    try:
        month = int(departure_at[5:7])
    except (TypeError, ValueError, IndexError):
        return None
    return _SEASONS.get(month)


_seo_cache = None

def load_seo_cache():
    global _seo_cache
    if _seo_cache is None:
        _seo_cache = load_json(SEO_CACHE_PATH)
    return _seo_cache

def save_seo_cache():
    if _seo_cache is not None:
        with open(SEO_CACHE_PATH, "w", encoding="utf-8") as f:
            json.dump(_seo_cache, f, indent=2)

def generate_destination_copy(dest_name):
    """
    Returns 150-200 words of SEO-optimized destination copy for the given destination.
    Uses sparkfare_seo_cache.json to avoid redundant API calls. Refreshes every 30 days.
    """
    cache = load_seo_cache()
    now_ts = datetime.now(timezone.utc).timestamp()
    
    # Check cache (valid for 30 days = 2592000 seconds)
    cached_entry = cache.get(dest_name)
    if cached_entry and (now_ts - cached_entry.get("generated_at", 0)) < 2592000:
        return cached_entry.get("copy", "")

    if MOCK_CLAUDE_API:
        # Mocked response to save credits during development
        generated_copy = (
            f"<p>{dest_name} offers a unique blend of cultural immersion and modern convenience. "
            f"Typical flight fares range dramatically depending on the season, with the best travel windows "
            f"often aligning with shoulder seasons for optimal pricing and weather.</p>"
            f"<p>Top activities in {dest_name} include exploring historical districts, sampling the rich "
            f"local cuisine, and taking advantage of regional transit to visit nearby attractions. "
            f"Whether you are planning a short getaway or a longer expedition, staying flexible with your "
            f"dates is the best way to find a favorable flight rate.</p>"
        )
    else:
        # Real Anthropic API Call
        import requests
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            print(f"Warning: ANTHROPIC_API_KEY not found. Skipping Claude generation for {dest_name}.")
            return ""
        
        prompt = (
            f"Write a factual, 150-200 word travel brief about {dest_name}. Focus on typical fare ranges, "
            f"best travel windows, and top activities. Do not use marketing hype or exclamation points. "
            f"Output ONLY raw HTML paragraphs (<p> tags). Do not use markdown blocks. "
            f"Never use the words book, booking, secure or lock in."
        )
        
        try:
            resp = requests.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json"
                },
                json={
                    "model": "claude-3-haiku-20240307",
                    "max_tokens": 400,
                    "messages": [{"role": "user", "content": prompt}]
                },
                timeout=20
            )
            resp.raise_for_status()
            generated_copy = resp.json()["content"][0]["text"].strip()
        except Exception as e:
            print(f"Error calling Claude API for {dest_name}: {e}")
            return ""

    # Update cache
    cache[dest_name] = {
        "generated_at": now_ts,
        "copy": generated_copy
    }
    save_seo_cache()
    return generated_copy


def build_h1_and_body(origin, dest, record):
    """Returns (h1, price_block_html, meta_description). Honest per real record status --
    never claims a deal that isn't one."""
    if not record or record.get("status") in (None, "insufficient_history", "no_data") or record.get("price") is None:
        h1 = f"Flights from {origin} to {dest}"
        body = (
            '<p class="price-status">We\'re still building enough price history on this route to '
            "show a real comparison. Check back soon, or watch this route below and we'll email you "
            "when there is a fare to compare.</p>"
        )
        meta = f"Track flight prices from {origin} to {dest}. One email when it drops below its usual price."
        return h1, body, meta

    price_html = fmt_price(record["price"])
    season = season_for_departure(record)
    route_label = f"{origin} to {dest} {season} Flights" if season else f"Flights from {origin} to {dest}"

    pct = pct_below_median(record)
    median_html = fmt_price(record.get("median_baseline"))
    if record.get("status") == "deal" and pct is not None:
        h1 = f"{route_label}: {pct}% Below 30-Day Median"
        body = (
            f'<p class="price-status is-deal">Today\'s price: <span class="price-num">{price_html}</span>'
            f"— {pct}% below the 30-day median of {median_html} (the median is the middle price, so one "
            f"unusually cheap or expensive day doesn't skew it). This is a real, price-history-based deal, "
            f"not a marketing claim.</p>"
        )
        meta = f"Flights from {origin} to {dest}: {price_html} today, {pct}% below the 30-day median of {median_html}. Real price-history-based deal detection, not guesswork."
    elif record.get("status") in ("deal", "priced_no_deal") and median_html != "N/A":
        h1 = f"{route_label}: Current Price vs. 30-Day Median"
        body = (
            f'<p class="price-status">Today\'s price: <span class="price-num">{price_html}</span>'
            f"— the 30-day median for this route (the middle price) is {median_html}. Not a deal today, "
            f"but worth watching.</p>"
        )
        meta = f"Flights from {origin} to {dest}: {price_html} today vs. a {median_html} 30-day median. Track this route and get one email when it drops below its usual price."
    elif record.get("status") != "featured":
        # A priced record with no usable median (for example an old carried-forward record): say so
        # plainly instead of reusing the Cluster-4 wording, which would be false for this route.
        h1 = route_label
        body = (
            f'<p class="price-status">Today\'s price: <span class="price-num">{price_html}</span>'
            f"— a real, current fare. We don't have enough price history on this route yet to compare it "
            f"against a 30-day median."
            f"</p>"
        )
        meta = f"Flights from {origin} to {dest}: {price_html} today. See the current fare and get alerted to future price drops."
    else:  # "featured" -- Cluster 4, imagery-driven, no baseline to compare against
        h1 = route_label
        body = (
            f'<p class="price-status">Today\'s price: <span class="price-num">{price_html}</span>'
            f"— this route doesn't get judged against a 30-day baseline (see our "
            f'<a href="/blog/destination-clusters-explained">destination groups</a> post for why), '
            f"but it's a real, current fare."
            f"</p>"
        )
        meta = f"Flights from {origin} to {dest}: {price_html} today. See the current fare and get alerted to future price drops."

    return h1, body, meta


def find_blog_post(dest_slug):
    path = os.path.join("blog", f"{dest_slug}.html")
    return path if os.path.exists(path) else None


# Workplan Step 131 -- pSEO internal-linking footer. Deliberately deterministic: a random pick
# would make the generated HTML diff every run even when nothing about the underlying prices
# changed, polluting git history for a script that already runs on an automated daily schedule.
# The offset is derived from each item's own position in a sorted list, so the same input data
# always produces the same links, while different pages still get different neighbors.
def pick_related(items_sorted, current, n=3):
    candidates = [i for i in items_sorted if i != current]
    if not candidates:
        return []
    idx = items_sorted.index(current) if current in items_sorted else 0
    offset = idx % len(candidates)
    rotated = candidates[offset:] + candidates[:offset]
    return rotated[:n]


def build_related_routes_html(origin, origin_labels, dest, dest_names_sorted, origin_codes_sorted, cluster_members):
    """'Related Routes' footer -- prevents the 480 /data/ pages from being SEO orphans (confirmed
    2026-09-14 that none of them linked to any other /data/ page). Does not filter by page status
    -- the thin 'still building price history' pages need real inbound links too, not just the
    pages currently showing a good price."""
    other_dests = pick_related(dest_names_sorted, dest, 3)
    from_html = "".join(
        f'<li><a href="/data/{origin.lower()}-to-{slugify(d)}">{d}</a></li>' for d in other_dests
    )

    other_origins = pick_related(origin_codes_sorted, origin, 3)
    to_html = "".join(
        f'<li><a href="/data/{o.lower()}-to-{slugify(dest)}">{origin_labels.get(o, o)} ({o})</a></li>' for o in other_origins
    )

    cluster_html = ""
    cluster = next((c for c, members in cluster_members.items() if dest in members), None)
    if cluster:
        cluster_dests = pick_related(cluster_members[cluster], dest, 3)
        if cluster_dests:
            cluster_links = "".join(
                f'<li><a href="/data/{origin.lower()}-to-{slugify(d)}">{d}</a></li>' for d in cluster_dests
            )
            cluster_html = f'<div><p class="related-label">Similar destinations</p><ul>{cluster_links}</ul></div>'

    return f"""
    <div class="related-routes">
      <div><p class="related-label">Also from {origin}</p><ul>{from_html}</ul></div>
      <div><p class="related-label">Also to {dest}</p><ul>{to_html}</ul></div>
      {cluster_html}
    </div>"""

def build_json_ld(origin, dest, dest_slug, record, ai_intro_copy, canonical, meta_description):
    import json
    price = record.get("price") if record else None
    
    org_schema = {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "Sparkfare",
        "url": "https://sparkfare.com",
        "logo": "https://sparkfare.com/sparkfare_mark.svg"
    }

    breadcrumb_schema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://sparkfare.com/"},
            {"@type": "ListItem", "position": 2, "name": "Routes", "item": "https://sparkfare.com/data/"},
            {"@type": "ListItem", "position": 3, "name": f"{origin} to {dest}", "item": canonical}
        ]
    }

    webpage_schema = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "url": canonical,
        "name": f"Flights from {origin} to {dest}",
        "description": meta_description,
        "speakable": {
            "@type": "SpeakableSpecification",
            "cssSelector": [".ai-intro-copy"]
        }
    }

    schemas = [org_schema, breadcrumb_schema, webpage_schema]

    if price:
        travel_schema = {
            "@context": "https://schema.org",
            "@type": "TravelAction",
            "name": f"Flight fares from {origin} to {dest}",
            "object": {
                "@type": "Flight",
                "departureAirport": {"@type": "Airport", "iataCode": origin},
                "arrivalAirport": {"@type": "Airport", "name": dest}
            },
            "result": {
                "@type": "Offer",
                "price": price,
                "priceCurrency": "USD"
            }
        }
        schemas.append(travel_schema)

    return f'<script type="application/ld+json">\n{json.dumps(schemas, indent=2)}\n</script>'



def signup_origin_options(selected):
    """<option> list for the signup form: every marketed origin, this page's origin preselected."""
    return "\n".join(
        '          <option value="%s"%s>%s - %s</option>' % (code, " selected" if code == selected else "", code, label)
        for code, label in ORIGINS
    )


def build_page(origin, origin_label, dest, dest_slug, record, image, dest_names_sorted, origin_labels, origin_codes_sorted, cluster_members):
    long_title, _old_block, meta_description = build_h1_and_body(origin, dest, record)
    # K-B3: the visible H1 is plain ("Chicago to Lisbon"); the long descriptive string stays in <title> and the share tags.
    h1 = f"{origin_label} to {dest.partition(',')[0].strip()}"
    price_block = build_route_body(origin, origin_label, dest, record, datetime.now(timezone.utc))
    canonical = f"{SITE_URL}/data/{origin.lower()}-to-{dest_slug}"
    
    # Mechanic 2: Programmatic SEO - Add Claude generated intro copy
    ai_intro_copy = generate_destination_copy(dest)

    photo_html = ""
    if image and image.get("image_url"):
        photo_html = (
            f'<img class="dest-photo" {img_attrs(image["image_url"], (480, 960), DEST_PHOTO_SIZES)} alt="{dest}" loading="lazy" decoding="async">'
            f'<p class="attribution">Photo by <a href="{image.get("photographer_link", "#")}" target="_blank" rel="noopener">{image.get("photographer_name", "Unsplash")}</a> on '
            f'<a href="{image.get("unsplash_link", "https://unsplash.com")}" target="_blank" rel="noopener">Unsplash</a></p>'
        )

    blog_path = find_blog_post(dest_slug)
    blog_link_html = ""
    if blog_path:
        blog_link_html = f'<p class="more-link"><a href="/blog/{dest_slug}">Read more about {dest} →</a></p>'

    about_html = ""
    if ai_intro_copy.strip():
        about_html = f'<h2 class="about-heading">About this route</h2><div class="ai-intro-copy">{ai_intro_copy}</div>'

    json_ld = build_json_ld(origin, dest, dest_slug, record, ai_intro_copy, canonical, meta_description)

    valid_origins = ",".join("'%s'" % c for c, _ in ORIGINS)
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{long_title} | Sparkfare</title>
<meta name="description" content="{meta_description}">
<link rel="canonical" href="{canonical}">
<meta property="og:title" content="{long_title}">
<meta property="og:description" content="{meta_description}">
{json_ld}
<meta property="og:type" content="website">
<meta property="og:url" content="{canonical}">
{f'<meta property="og:image" content="{image["image_url"]}">' if image and image.get("image_url") else ""}
<link rel="icon" href="/favicon.png" sizes="any">
<link rel="icon" type="image/svg+xml" href="/sparkfare_mark.svg">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="stylesheet" href="/brand/tokens.css">
<link rel="stylesheet" href="/brand/fonts.css">
<style>
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; background: var(--sand); color: var(--text); font-family: var(--font-body); line-height: 1.6; overflow-x: hidden; }}
  .wrap {{ max-width: 760px; margin: 0 auto; padding: 48px 20px 80px; }}
  .site-nav {{ display: flex; gap: 18px; font-size: 0.85rem; margin-bottom: 20px; flex-wrap: wrap; }}
  .site-nav a {{ color: var(--muted-dim); text-decoration: none; }}
  /* nav tap targets */ @media (max-width: 768px) {{ .site-nav {{ gap: 0 18px; }} .site-nav a {{ display: inline-block; padding: 11px 0; }} }}
  .site-nav a:hover {{ text-decoration: underline; }}
  .site-nav a.brand-link {{ display: inline-flex; align-items: center; gap: 6px; }}
  .brand-mark {{ width: 16px; height: 16px; flex-shrink: 0; }}
  .card {{ background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 28px; }}
  h1 {{ margin: 0 0 16px; font-size: 1.7rem; letter-spacing: -0.02em; }}
  .dest-photo {{ width: 100%; height: auto; max-height: 320px; object-fit: cover; border-radius: var(--radius); margin-bottom: 6px; }}
  .attribution {{ font-size: 0.8125rem; color: var(--muted-dim); margin: 0 0 20px; }}
  .attribution a {{ color: var(--muted-dim); }}
  .price-status {{ font-size: 1.05rem; margin: 0 0 20px; }}
  .price-status.is-deal {{ color: var(--ink); font-weight: 600; }}
  .price-num {{ font-family: var(--font-mono); }}
  .sparkline {{ vertical-align: middle; margin: 0 8px; }}
  .ticket {{ border: 1px solid var(--line); border-radius: var(--radius); padding: 18px 20px; margin: 0 0 20px; background: var(--card); }}
  .ticket-route {{ margin: 0 0 4px; font-size: 0.9375rem; font-weight: 600; color: var(--ink); }}
  .ticket-region {{ font-weight: 400; color: var(--ink-2); }}
  .ticket-price {{ display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin: 0 0 6px; }}
  .ticket-price .price {{ font-family: var(--font-mono); font-size: 32px; font-weight: 500; line-height: 1.1; color: var(--ink); font-variant-numeric: tabular-nums; }}
  .ticket-basis {{ margin: 0 0 6px; font-size: 0.8125rem; color: var(--ink-2); }}
  .ticket-detail {{ margin: 0 0 4px; font-size: 0.875rem; color: var(--ink); }}
  .ticket-asof {{ margin: 0 0 4px; font-size: 0.8125rem; color: var(--muted-dim); }}
  .ticket-perf {{ border-top: 2px dashed var(--line); margin: 12px 0; }}
  .ticket-actions {{ display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }}
  .ticket .fare-link, .ticket .watch-link {{ display: inline-flex; align-items: center; min-height: 44px; padding: 10px 18px; border-radius: var(--radius); font-size: 0.9375rem; font-weight: 600; text-decoration: none; }}
  .ticket .fare-link {{ background: var(--sage); color: var(--on-sage); }}
  .ticket .watch-link {{ background: transparent; color: var(--sage); border: 1px solid var(--sage); }}
  .ticket .watch-link:hover {{ background: var(--sage); color: var(--on-sage); }}
  .ticket-disclosure {{ margin: 8px 0 0; font-size: 0.8125rem; color: var(--ink-2); }}
  .chip {{ display: inline-flex; align-items: center; gap: 4px; font-size: 0.8125rem; font-weight: 600; line-height: 1.3; padding: 2px 10px; border-radius: var(--radius-pill); border: 1px solid transparent; }}
  .chip-deal {{ background: var(--spark); color: var(--on-spark); border-color: var(--spark-ink); }}
  .chip-typical {{ background: var(--card); color: var(--ink-2); border-color: var(--line); }}
  .chip-building {{ background: transparent; color: var(--ink-2); border: 1px dashed var(--line); }}
  .chip-lastseen {{ background: transparent; color: var(--clay); border-color: var(--clay); }}
  .chip-noverdict {{ background: transparent; color: var(--ink-2); border-color: var(--line); }}
  .chip-icon {{ flex: none; }}
  .route-note {{ margin: 0 0 20px; font-size: 0.9375rem; color: var(--ink-2); }}
  .route-note a {{ color: var(--sage); }}
  .route-figure {{ margin: 0 0 20px; }}
  .route-chart {{ display: block; width: 100%; height: auto; }}
  .route-figure figcaption {{ margin-top: 6px; font-size: 0.8125rem; color: var(--ink-2); }}
  .route-empty {{ border: 1px dashed var(--line); border-radius: var(--radius); padding: 18px 20px; margin: 0 0 20px; }}
  .route-empty .chip {{ margin: 0 0 8px; }}
  .route-empty-line {{ margin: 0 0 6px; font-size: 1.05rem; color: var(--ink); }}
  .route-empty-sub {{ margin: 0; color: var(--ink-2); }}
  .about-heading {{ font-size: 1.15rem; margin: 24px 0 8px; }}
  .ai-intro-copy {{ color: var(--text); }}
  .hook {{ color: var(--muted); margin: 0 0 24px; }}
  .more-link a {{ color: var(--sage); font-weight: 600; text-decoration: none; }}
  .more-link a:hover {{ text-decoration: underline; }}
  .signup-panel {{ margin-top: 24px; padding-top: 24px; border-top: 1px dashed var(--border); }}
  .signup-panel p.label {{ font-weight: 600; margin: 0 0 12px; }}
  .signup-form {{ display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }}
  .signup-form input, .signup-form select {{ padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--radius); font: inherit; background: var(--card); color: var(--text); }}
  .signup-form input[type=email] {{ flex: 1 1 220px; }}
  .signup-form button {{ background: var(--sage); color: var(--on-sage); border: none; padding: 10px 18px; border-radius: var(--radius); font-weight: 600; cursor: pointer; }}
  .signup-form button:hover {{ filter: brightness(1.1); }}
  .signup-status {{ margin-top: 10px; font-size: 0.88rem; }}
  .signup-status.error {{ color: #A33; }}
  .signup-status.success {{ color: var(--sage); }}
  .signup-status a {{ color: inherit; text-decoration: underline; }}
  .disclosure {{ font-size: 0.8125rem; color: var(--muted-dim); margin-top: 10px; }}
  .flight-cta {{ margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--border); font-size: 0.92rem; color: var(--muted); }}
  .flight-cta a {{ color: var(--sage); font-weight: 600; text-decoration: none; }}
  .flight-cta a:hover {{ text-decoration: underline; }}
  .related-routes {{ margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--border); display: flex; flex-wrap: wrap; gap: 24px; }}
  .related-routes > div {{ flex: 1 1 160px; min-width: 160px; }}
  .related-label {{ font-size: 0.8125rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted-dim); margin: 0 0 8px; }}
  .related-routes ul {{ list-style: none; margin: 0; padding: 0; }}
  .related-routes li {{ margin-bottom: 6px; font-size: 0.88rem; }}
  .related-routes a {{ color: var(--sage); text-decoration: none; }}
  .related-routes a:hover {{ text-decoration: underline; }}
</style>
<script async src="https://js.sparkloop.app/embed.js?publication_id=pub_7999f6c312f6" data-sparkloop></script>
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<div class="wrap">
  {SITE_NAV_HTML}
<main id="main">
  <div class="card">
    <h1>{h1}</h1>
      <div class="content-body">
        {price_block}
        {photo_html}
        {about_html}
      </div>
    {blog_link_html}

    <div class="signup-panel">
      <h2 class="label" style="font-size: 1.15rem; margin: 0 0 8px;">Get alerts from {origin}</h2>
      <p style="margin-bottom: 16px; font-size: 0.95rem; color: var(--muted-dim);">Watch this route. One email when it drops below its usual price.</p>
      <form class="signup-form" id="signup-form" novalidate>
        <input type="email" id="email" name="email" placeholder="Email address" aria-label="Email address" autocomplete="email" required>
        <select id="origin_iata" name="origin_iata" aria-label="Your home airport" required>
{signup_origin_options(origin)}
        </select>
        <button type="submit">Create free alert</button>
      </form>
      <div id="signup-status" class="signup-status" aria-live="polite"></div>
      <p class="disclosure" style="margin-top: 16px;">100% free. Sparkfare may earn a commission if you buy through our links, at no extra cost to you. <a href="/disclosure">Read our disclosure</a>.</p>
    </div>

    <p class="flight-cta">Want the full board? <a href="/">See today's deals →</a> · <a href="/how-it-works">How we judge deals</a></p>
    {build_related_routes_html(origin, origin_labels, dest, dest_names_sorted, origin_codes_sorted, cluster_members)}
  </div>
</main>
</div>
<script>
  const VALID_ORIGINS = new Set([{valid_origins}]);
  const form = document.getElementById('signup-form');
  const status = document.getElementById('signup-status');
  form.addEventListener('submit', async (event) => {{
    event.preventDefault();
    const formData = new FormData(form);
    const payload = {{
      id: 'local_' + Date.now(),
      email: String(formData.get('email') || '').trim(),
      origin_iata: String(formData.get('origin_iata') || '').trim().toUpperCase(),
      trip_length: '7-10',
      subscription_tier: 'free',
      partner_id: 'pseo',
    }};
    if (!payload.email || !payload.origin_iata) {{
      status.textContent = 'Please enter your email and choose your home airport.';
      status.className = 'signup-status error';
      return;
    }}
    if (!VALID_ORIGINS.has(payload.origin_iata)) {{
      status.textContent = 'Please choose a valid origin airport from the list.';
      status.className = 'signup-status error';
      return;
    }}
    status.textContent = 'Creating your alert…';
    status.className = 'signup-status';
    try {{
      const response = await fetch('/api/signup', {{
        method: 'POST',
        headers: {{ 'Content-Type': 'application/json' }},
        body: JSON.stringify(payload),
      }});
      const result = await response.json().catch(() => ({{ ok: false, error: 'Request failed' }}));
      if (!response.ok || !result.ok) throw new Error(result.error || 'Signup failed');
      status.textContent = `Alert created for ${{payload.origin_iata}}. Check your email to verify.`;
      status.className = 'signup-status success';
      const plusLink = document.createElement('a');
      plusLink.href = '/pricing?src=data';
      plusLink.textContent = 'Join the Plus waitlist';
      status.append(' Interested in Sparkfare Plus? ', plusLink, '.');
      form.reset();
    }} catch (error) {{
      status.textContent = error.message || 'Something went wrong while creating the alert.';
      status.className = 'signup-status error';
    }}
  }});
</script>
<script src="/nav-auth.js"></script>
<script>syncNavAuthStateLazy();</script>
<script src="/site-footer.js" defer></script>
<script src="/as-of-local.js" defer></script>
</body>
</html>
"""


def listing_row(origin, dest, slug, record, now):
    """One row of the route finder: the route page link, one chip and the latest price. A route with no usable fare says "No history yet" (or
    "No current fare" when it has a price but the fare has left) and shows no price."""
    state = fare_state(record, now)
    if state == "none":
        has_price = bool(record) and isinstance(record.get("price"), (int, float))
        chip = ("nodata", "No current fare") if has_price else ("building", "No history yet")
        price, rank = "", 2
    else:
        kind, label, _icon = chip_for(record, state)
        chip = (kind, label)
        price = fmt_price(record["price"])
        rank = 0 if kind == "deal" else 1
    return {"dest": dest, "slug": slug, "chip": chip, "price": price, "rank": rank,
            "amount": record["price"] if state != "none" else 0}


def build_listing_page(pages, records=None, now=None):
    """K-B9 (scan D-1): /data/ is a route finder, not a list of 880 bare links. One section per origin, each with one row per route (link, one
    chip, latest price), deals first, then by price. Every section is in the HTML, so a crawler or a visitor without JavaScript sees them all;
    with JavaScript an origin filter shows one at a time (the visitor's saved airport, else JFK)."""
    records = records or {}
    now = now or datetime.now(timezone.utc)
    by_origin = {}
    for origin, dest, dest_slug in pages:
        by_origin.setdefault(origin, []).append(listing_row(origin, dest, dest_slug, records.get((origin, dest)), now))

    options = "".join(f'<option value="{o}">{esc(label)} ({o})</option>' for o, label in ORIGINS)
    sections = []
    for origin, origin_label in ORIGINS:
        rows = sorted(by_origin.get(origin, []), key=lambda r: (r["rank"], r["amount"], r["dest"]))
        items = "".join(
            f'<li class="route-row"><a class="route-link" href="/data/{origin.lower()}-to-{r["slug"]}">{esc(r["dest"])}</a>'
            f'<span class="chip chip-{r["chip"][0]}">{esc(r["chip"][1])}</span>'
            f'<span class="route-price">{r["price"]}</span></li>'
            for r in rows
        )
        sections.append(
            f'<section class="origin-block" id="{origin.lower()}" data-origin="{origin}">'
            f'<h2>{esc(origin_label)} ({origin})</h2><ul class="route-list">{items}</ul></section>'
        )

    built = f"{MONTHS[now.month - 1]} {now.day}, {now.hour % 12 or 12}:{now.minute:02d} {'AM' if now.hour < 12 else 'PM'} UTC"
    valid = ",".join(f"'{o}'" for o, _ in ORIGINS)
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>All Flight Routes | Sparkfare</title>
<meta name="description" content="Every origin-destination route Sparkfare tracks, with today's price and 30-day median where available.">
<link rel="canonical" href="{SITE_URL}/data/">
<link rel="icon" href="/favicon.png" sizes="any">
<link rel="stylesheet" href="/brand/tokens.css">
<link rel="stylesheet" href="/brand/fonts.css">
<style>
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; background: var(--sand); color: var(--text); font-family: var(--font-body); line-height: 1.6; }}
  [hidden] {{ display: none !important; }}
  .wrap {{ max-width: 900px; margin: 0 auto; padding: 48px 20px 80px; }}
  .card {{ background: var(--card); border: 1px solid var(--border); border-radius: 6px; padding: 28px; }}
  h1 {{ margin: 0 0 8px; }}
  h2 {{ font-size: 1.2rem; margin: 24px 0 8px; }}
  .muted {{ color: var(--ink-2); font-size: 0.9rem; }}
  .site-nav {{ display: flex; gap: 18px; font-size: 0.85rem; margin-bottom: 20px; flex-wrap: wrap; }}
  .site-nav a {{ color: var(--muted-dim); text-decoration: none; }}
  /* nav tap targets */ @media (max-width: 768px) {{ .site-nav {{ gap: 0 18px; }} .site-nav a {{ display: inline-block; padding: 11px 0; }} }}
  .origin-filter {{ display: none; margin: 16px 0 4px; }}
  .js .origin-filter {{ display: block; }}
  .origin-filter label {{ display: block; font-size: 0.85rem; font-weight: 600; margin: 0 0 4px; }}
  .origin-filter select {{ width: 100%; max-width: 360px; min-height: 44px; padding: 10px; border: 1px solid var(--line); border-radius: 6px; background: var(--card); color: var(--ink); font: inherit; }}
  .route-list {{ list-style: none; margin: 0; padding: 0; }}
  .route-row {{ display: grid; grid-template-columns: minmax(0, 1fr) auto 5.5rem; align-items: center; gap: 4px 12px; border-top: 1px solid var(--line); }}
  .route-link {{ display: flex; align-items: center; min-height: 44px; color: var(--sage-dark); text-decoration: none; }}
  .route-link:hover {{ text-decoration: underline; }}
  .route-price {{ font-family: var(--font-mono); font-weight: 500; color: var(--ink); text-align: right; font-variant-numeric: tabular-nums; }}
  .chip {{ display: inline-flex; align-items: center; font-size: 0.8125rem; font-weight: 600; line-height: 1.3; padding: 2px 10px; border-radius: var(--radius-pill); border: 1px solid transparent; white-space: nowrap; }}
  .chip-deal {{ background: var(--spark); color: var(--on-spark); border-color: var(--spark-ink); }}
  .chip-typical {{ background: var(--card); color: var(--ink-2); border-color: var(--line); }}
  .chip-building {{ background: transparent; color: var(--ink-2); border: 1px dashed var(--line); }}
  .chip-lastseen {{ background: transparent; color: var(--clay); border-color: var(--clay); }}
  .chip-noverdict, .chip-nodata {{ background: transparent; color: var(--ink-2); border-color: var(--line); }}
  @media (max-width: 480px) {{ .route-row {{ grid-template-columns: minmax(0, 1fr) 5rem; }} .route-chip-wrap, .route-row .chip {{ grid-column: 1; justify-self: start; }} .route-price {{ grid-column: 2; grid-row: 1 / span 2; }} .route-row .chip {{ margin-bottom: 8px; }} }}
</style>
<script async src="https://js.sparkloop.app/embed.js?publication_id=pub_7999f6c312f6" data-sparkloop></script>
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<div class="wrap">
  {SITE_NAV_HTML}
<main id="main">
  <div class="card">
    <h1>All Flight Routes</h1>
    <p>Every origin we track, paired with every destination we curate. Pick a route for today's real price and 30-day trend.</p>
    <p class="muted">Page built {built}. Each route page shows when its fare was checked.</p>
    <form class="origin-filter" onsubmit="return false">
      <label for="origin-filter">Flying from</label>
      <select id="origin-filter">{options}</select>
    </form>
    {"".join(sections)}
  </div>
</main>
</div>
<script>
  (function () {{
    document.documentElement.classList.add('js');
    var select = document.getElementById('origin-filter');
    var blocks = document.querySelectorAll('.origin-block');
    var valid = [{valid}];
    function show(code) {{
      for (var i = 0; i < blocks.length; i++) blocks[i].hidden = blocks[i].getAttribute('data-origin') !== code;
      select.value = code;
    }}
    var start = (location.hash || '').slice(1).toUpperCase();
    if (valid.indexOf(start) < 0) {{ try {{ start = localStorage.getItem('sparkfare_selected_origin') || ''; }} catch (e) {{ start = ''; }} }}
    if (valid.indexOf(start) < 0) start = 'JFK';
    show(start);
    select.addEventListener('change', function () {{
      show(select.value);
      try {{ localStorage.setItem('sparkfare_selected_origin', select.value); }} catch (e) {{}}
      if (history.replaceState) history.replaceState(null, '', '#' + select.value.toLowerCase());
    }});
  }})();
</script>
<script src="/nav-auth.js"></script>
<script>syncNavAuthStateLazy();</script>
<script src="/site-footer.js" defer></script>
</body>
</html>
"""


def update_sitemap(urls):
    if not os.path.exists(SITEMAP_PATH):
        return
    with open(SITEMAP_PATH, encoding="utf-8") as f:
        content = f.read()

    existing = set(re.findall(r"<loc>(.*?)</loc>", content))
    new_urls = [u for u in urls if u not in existing]
    if not new_urls:
        return

    entries = "".join(f"  <url><loc>{u}</loc></url>\n" for u in new_urls)
    content = content.replace("</urlset>", entries + "</urlset>")
    with open(SITEMAP_PATH, "w", encoding="utf-8") as f:
        f.write(content)


def main():
    destinations = load_json(DESTINATIONS_PATH)
    images = load_json(IMAGES_PATH)
    jfk_feed = index_by_route(load_json(JFK_DEALS_PATH))
    other_feed = index_by_route(load_json(OTHER_DEALS_PATH))

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Workplan Step 131 -- computed once, upfront, not per-page: ORIGINS and destinations are
    # both known before the page loop runs, so no second pass over the generated output is needed
    # to build the "Related Routes" links.
    dest_names_sorted = sorted(destinations.keys())
    origin_codes_sorted = sorted(o for o, _ in ORIGINS)
    origin_labels = dict(ORIGINS)
    cluster_members = {}
    for d in dest_names_sorted:
        cluster = destinations[d].get("group")
        if cluster:
            cluster_members.setdefault(cluster, []).append(d)

    pages = []
    records = {}
    sitemap_urls = []
    status_counts = {}

    for origin, origin_label in ORIGINS:
        route_index = jfk_feed if origin == "JFK" else other_feed
        for dest in destinations:
            dest_slug = slugify(dest)
            record = route_index.get((origin, dest))
            status = (record or {}).get("status") or "no_data"
            status_counts[status] = status_counts.get(status, 0) + 1

            html = build_page(
                origin, origin_label, dest, dest_slug, record, images.get(dest),
                dest_names_sorted, origin_labels, origin_codes_sorted, cluster_members,
            )
            out_path = os.path.join(OUTPUT_DIR, f"{origin.lower()}-to-{dest_slug}.html")
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(html)

            pages.append((origin, dest, dest_slug))
            records[(origin, dest)] = record
            sitemap_urls.append(f"{SITE_URL}/data/{origin.lower()}-to-{dest_slug}")

    with open(os.path.join(OUTPUT_DIR, "index.html"), "w", encoding="utf-8") as f:
        f.write(build_listing_page(pages, records, datetime.now(timezone.utc)))
    sitemap_urls.append(f"{SITE_URL}/data/")

    update_sitemap(sitemap_urls)

    print(f"Generated {len(pages)} pSEO pages + 1 listing page in {OUTPUT_DIR}/ at {datetime.now(timezone.utc).isoformat()}")
    print("Status breakdown:", status_counts)

    # Mechanic 2: Programmatic SEO - Ping Google Search Console with the updated sitemap
    import urllib.request
    try:
        urllib.request.urlopen(f"https://www.google.com/ping?sitemap={SITE_URL}/sitemap.xml", timeout=10)
        print("Successfully pinged Google Search Console with the updated sitemap.")
    except Exception as e:
        print(f"Failed to ping Google Search Console: {e}")


if __name__ == "__main__":
    main()
