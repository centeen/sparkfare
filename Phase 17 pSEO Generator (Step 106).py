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
deal comparison, a Cluster-4 "featured" price with no average to compare against (Cluster 4 never
computes trailing_avg -- see the ranking script's own classify_destination()), or a plain
"building price history" / "no current data" state. Nothing here is fabricated to make every page
look like a deal.

Workplan Step 118 (seasonal SEO angle): H1s for any priced record (deal/priced_no_deal/featured)
name the season the route's own departure_at actually falls in (e.g. "JFK to Tokyo Winter
Flights: 22% Below 30-Day Average") -- derived from the real itinerary date, not the date the page
happens to be generated. The no-data "building price history" state has no fare to attach a season
to, so it's deliberately left in its plain, non-seasonal form.

Run manually with `python "Phase 17 pSEO Generator (Step 106).py"`, or via the
daily-compile-other-origins.yml workflow (runs after both the JFK and other-origins pipelines have
refreshed for the day, so both source files are current when this generates).
"""
import json
import os
import re
from datetime import datetime, timezone

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

# Deliberately 12, not 13 -- TLV excluded, see module docstring.
ORIGINS = [
    ("JFK", "New York"), ("LAX", "Los Angeles"), ("ORD", "Chicago"), ("ATL", "Atlanta"),
    ("DFW", "Dallas"), ("SFO", "San Francisco"), ("MIA", "Miami"), ("IAD", "Washington DC"),
    ("EWR", "Newark"), ("SEA", "Seattle"), ("IAH", "Houston"), ("BOS", "Boston"),
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


def sparkline_svg(record):
    """Same polyline/point math as index.html's sparklineSVG() -- kept visually identical."""
    history = list(record.get("price_history") or [])
    price = record.get("price")
    if price is None:
        return ""
    prices = history + [price]
    if len(prices) < 2:
        return ""

    width, height = 60, 20
    lo, hi = min(prices), max(prices)
    rng = hi - lo

    def xy(p, i):
        x = (i / (len(prices) - 1)) * width
        y = height / 2 if rng == 0 else height - ((p - lo) / rng) * height
        return x, y

    points = " ".join(f"{x:.1f},{y:.1f}" for x, y in (xy(p, i) for i, p in enumerate(prices)))
    last_x, last_y = xy(prices[-1], len(prices) - 1)

    return (
        f'<svg class="sparkline" viewBox="0 0 {width} {height}" width="{width}" height="{height}" '
        f'role="img" aria-label="30-day price trend">'
        f'<polyline points="{points}" fill="none" stroke="#2B2620" stroke-width="1.5" '
        f'stroke-linejoin="round" stroke-linecap="round"/>'
        f'<circle cx="{last_x:.1f}" cy="{last_y:.1f}" r="2" fill="#E8B930"/></svg>'
    )


def fmt_price(price):
    return f"${price:,.0f}" if isinstance(price, (int, float)) else "N/A"


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
            f"dates is the best way to secure a favorable flight rate.</p>"
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
            f"Output ONLY raw HTML paragraphs (<p> tags). Do not use markdown blocks."
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
            "show a real comparison. Check back soon, or create an alert below and we'll email you "
            "the moment there's something worth seeing.</p>"
        )
        meta = f"Track flight prices from {origin} to {dest}. Get a real alert the moment a fare is genuinely worth booking -- no guesswork, no fake urgency."
        return h1, body, meta

    price_html = fmt_price(record["price"])
    spark = sparkline_svg(record)
    season = season_for_departure(record)
    route_label = f"{origin} to {dest} {season} Flights" if season else f"Flights from {origin} to {dest}"

    if record.get("status") == "deal":
        pct = round((record.get("pct_below_avg") or 0) * 100)
        h1 = f"{route_label}: {pct}% Below 30-Day Average"
        avg_html = fmt_price(record.get("trailing_avg"))
        body = (
            f'<p class="price-status is-deal">Today\'s price: <span class="price-num">{price_html}</span>{spark} '
            f"— {pct}% below the 30-day average of {avg_html}. This is a real, price-history-based deal, "
            f"not a marketing claim.</p>"
        )
        meta = f"Flights from {origin} to {dest}: {price_html} today, {pct}% below the 30-day average of {avg_html}. Real price-history-based deal detection, not guesswork."
    elif record.get("status") == "priced_no_deal":
        avg_html = fmt_price(record.get("trailing_avg"))
        h1 = f"{route_label}: Current Price vs. 30-Day Average"
        body = (
            f'<p class="price-status">Today\'s price: <span class="price-num">{price_html}</span>{spark} '
            f"— the 30-day average for this route is {avg_html}. Not a deal today, but worth watching."
            f"</p>"
        )
        meta = f"Flights from {origin} to {dest}: {price_html} today vs. a {avg_html} 30-day average. Track this route and get alerted the moment it's genuinely worth booking."
    else:  # "featured" -- Cluster 4, imagery-driven, no trailing_avg to compare against
        h1 = route_label
        body = (
            f'<p class="price-status">Today\'s price: <span class="price-num">{price_html}</span>{spark} '
            f"— this route doesn't get judged against a 30-day average (see our "
            f'<a href="/blog/destination-clusters-explained">destination clusters</a> post for why), '
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
            cluster_html = f'<div><p class="related-label">Similar destinations ({cluster})</p><ul>{cluster_links}</ul></div>'

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
            "name": f"Book Flight from {origin} to {dest}",
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



def build_page(origin, origin_label, dest, dest_slug, record, image, dest_names_sorted, origin_labels, origin_codes_sorted, cluster_members):
    h1, price_block, meta_description = build_h1_and_body(origin, dest, record)
    canonical = f"{SITE_URL}/data/{origin.lower()}-to-{dest_slug}"
    
    # Mechanic 2: Programmatic SEO - Add Claude generated intro copy
    ai_intro_copy = generate_destination_copy(dest)

    photo_html = ""
    if image and image.get("image_url"):
        photo_html = (
            f'<img class="dest-photo" src="{image["image_url"]}" alt="{dest}" loading="lazy">'
            f'<p class="attribution">Photo by <a href="{image.get("photographer_link", "#")}" target="_blank" rel="noopener">{image.get("photographer_name", "Unsplash")}</a> on '
            f'<a href="{image.get("unsplash_link", "https://unsplash.com")}" target="_blank" rel="noopener">Unsplash</a></p>'
        )

    blog_path = find_blog_post(dest_slug)
    blog_link_html = ""
    if blog_path:
        blog_link_html = f'<p class="more-link"><a href="/blog/{dest_slug}">Read more about {dest} →</a></p>'

    stale_note = ""
    if record and record.get("is_stale_fallback"):
        stale_note = '<p class="stale-note">This price is carried forward from the most recent day we had real data for this route -- see our <a href="/blog/stale-fallback-prices">stale-fallback policy</a>.</p>'

    json_ld = build_json_ld(origin, dest, dest_slug, record, ai_intro_copy, canonical, meta_description)

    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{h1} | Sparkfare</title>
<meta name="description" content="{meta_description}">
<link rel="canonical" href="{canonical}">
<meta property="og:title" content="{h1}">
<meta property="og:description" content="{meta_description}">
{json_ld}
<meta property="og:type" content="website">
<meta property="og:url" content="{canonical}">
{f'<meta property="og:image" content="{image["image_url"]}">' if image and image.get("image_url") else ""}
<link rel="icon" href="/favicon.png" sizes="any">
<link rel="icon" type="image/svg+xml" href="/sparkfare_mark.svg">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<style>
  :root {{
    --sand: #E8DCC5; --card: #FAF6EE; --border: #D9CBB0; --amber: #B8720F; --sage: #4F7A52;
    --text: #2E2318; --muted: #6B5A45; --muted-dim: #605142; --radius: 6px;
  }}
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; background: var(--sand); color: var(--text); font-family: 'Segoe UI', sans-serif; line-height: 1.6; overflow-x: hidden; }}
  .wrap {{ max-width: 760px; margin: 0 auto; padding: 48px 20px 80px; }}
  .site-nav {{ display: flex; gap: 18px; font-size: 0.85rem; margin-bottom: 20px; flex-wrap: wrap; }}
  .site-nav a {{ color: var(--muted-dim); text-decoration: none; }}
  .site-nav a:hover {{ text-decoration: underline; }}
  .site-nav a.brand-link {{ display: inline-flex; align-items: center; gap: 6px; }}
  .brand-mark {{ width: 16px; height: 16px; flex-shrink: 0; }}
  .card {{ background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 28px; }}
  h1 {{ margin: 0 0 16px; font-size: 1.7rem; letter-spacing: -0.02em; }}
  .dest-photo {{ width: 100%; max-height: 320px; object-fit: cover; border-radius: var(--radius); margin-bottom: 6px; }}
  .attribution {{ font-size: 0.75rem; color: var(--muted-dim); margin: 0 0 20px; }}
  .attribution a {{ color: var(--muted-dim); }}
  .price-status {{ font-size: 1.05rem; margin: 0 0 20px; }}
  .price-status.is-deal {{ color: var(--amber); font-weight: 600; }}
  .price-num {{ font-family: 'IBM Plex Mono', 'Courier New', monospace; }}
  .sparkline {{ vertical-align: middle; margin: 0 8px; }}
  .stale-note {{ font-size: 0.85rem; color: var(--muted-dim); }}
  .stale-note a {{ color: var(--muted-dim); }}
  .hook {{ color: var(--muted); margin: 0 0 24px; }}
  .more-link a {{ color: var(--sage); font-weight: 600; text-decoration: none; }}
  .more-link a:hover {{ text-decoration: underline; }}
  .signup-panel {{ margin-top: 24px; padding-top: 24px; border-top: 1px dashed var(--border); }}
  .signup-panel p.label {{ font-weight: 600; margin: 0 0 12px; }}
  .signup-form {{ display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }}
  .signup-form input, .signup-form select {{ padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--radius); font: inherit; background: #fff; color: var(--text); }}
  .signup-form input[type=email] {{ flex: 1 1 220px; }}
  .signup-form button {{ background: var(--sage); color: var(--card); border: none; padding: 10px 18px; border-radius: var(--radius); font-weight: 600; cursor: pointer; }}
  .signup-form button:hover {{ filter: brightness(1.1); }}
  .signup-status {{ margin-top: 10px; font-size: 0.88rem; }}
  .signup-status.error {{ color: #A33; }}
  .signup-status.success {{ color: var(--sage); }}
  .disclosure {{ font-size: 0.78rem; color: var(--muted-dim); margin-top: 10px; }}
  .flight-cta {{ margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--border); font-size: 0.92rem; color: var(--muted); }}
  .flight-cta a {{ color: var(--sage); font-weight: 600; text-decoration: none; }}
  .flight-cta a:hover {{ text-decoration: underline; }}
  .related-routes {{ margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--border); display: flex; flex-wrap: wrap; gap: 24px; }}
  .related-routes > div {{ flex: 1 1 160px; min-width: 160px; }}
  .related-label {{ font-size: 0.76rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted-dim); margin: 0 0 8px; }}
  .related-routes ul {{ list-style: none; margin: 0; padding: 0; }}
  .related-routes li {{ margin-bottom: 6px; font-size: 0.88rem; }}
  .related-routes a {{ color: var(--sage); text-decoration: none; }}
  .related-routes a:hover {{ text-decoration: underline; }}
</style>
<script async src="https://js.sparkloop.app/embed.js?publication_id=pub_7999f6c312f6" data-sparkloop></script>
</head>
<body>
<div class="wrap">
  <nav class="site-nav">
    <a href="/" class="brand-link">
      <svg class="brand-mark" viewBox="0 0 44 44" aria-hidden="true">
        <path d="M8,8 L8,36 L30,36 L27,29 L30,22 L27,15 L30,8 Z" fill="none" stroke="#2B2620" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>
        <circle cx="18" cy="22" r="3.5" fill="#E8B930"/>
      </svg>
      Sparkfare
    </a>
    <a href="/away-mode">Away Mode</a>
    <a href="/blog/">Blog</a>
    <a href="/data/">All Routes</a>
    <a href="/watchlists">Watchlists</a>
    <a href="/hub">Referrals</a>
    <a href="/trips">Trips</a>
    <a href="/account">Preferences</a>
    <a href="/privacy">Privacy</a>
    <a class="sign-in-link" id="sign-in-nav-link" href="/sign-in">Sign in</a>
  </nav>
  <div class="card">
    <h1>{h1}</h1>
      <div class="content-body">
        {photo_html}
        {price_block}
        <div class="ai-intro-copy" style="margin-top: 24px; color: var(--text);">
          {ai_intro_copy}
        </div>
      </div>{stale_note}
    {blog_link_html}

    <div class="signup-panel">
      <p class="label" style="font-size: 1.15rem; margin-bottom: 8px;">Never miss a price drop to {dest}</p>
      <p style="margin-bottom: 16px; font-size: 0.95rem; color: var(--muted-dim);">Join Sparkfare for free to track this exact route and get notified instantly when airlines slash the fare.</p>
      <a href="/sign-in?redirect_url=/watchlists" class="cta" style="display:inline-block; background: var(--sage); color: var(--card); text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 1rem; transition: filter 0.2s;">Create free alert</a>
      <p class="disclosure" style="margin-top: 16px;">100% free. Sparkfare may earn a commission on flights booked through our links, at no extra cost to you. <a href="/disclosure">Read our disclosure</a>.</p>
    </div>

    <p class="flight-cta">Want the full board? <a href="/">See today's deals →</a></p>
    {build_related_routes_html(origin, origin_labels, dest, dest_names_sorted, origin_codes_sorted, cluster_members)}
  </div>
</div>
<script src="/nav-auth.js"></script>
<script>syncNavAuthStateLazy();</script>
</body>
</html>
"""


def build_listing_page(pages):
    """A lightweight /data/ index grouped by origin -- not a full page-by-page SEO surface, just
    enough for crawlability and a human to navigate from."""
    by_origin = {}
    for origin, dest, dest_slug in pages:
        by_origin.setdefault(origin, []).append((dest, dest_slug))

    sections = []
    for origin, origin_label in ORIGINS:
        links = "".join(
            f'<li><a href="/data/{origin.lower()}-to-{slug}">{dest}</a></li>'
            for dest, slug in sorted(by_origin.get(origin, []))
        )
        sections.append(f"<h2>{origin} — {origin_label}</h2><ul>{links}</ul>")

    body = "".join(sections)
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>All Flight Routes | Sparkfare</title>
<meta name="description" content="Every origin-destination route Sparkfare tracks, with today's price and 30-day average where available.">
<link rel="canonical" href="{SITE_URL}/data/">
<link rel="icon" href="/favicon.png" sizes="any">
<style>
  :root {{ --sand: #E8DCC5; --card: #FAF6EE; --border: #D9CBB0; --text: #2E2318; --muted-dim: #605142; }}
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; background: var(--sand); color: var(--text); font-family: 'Segoe UI', sans-serif; line-height: 1.6; }}
  .wrap {{ max-width: 900px; margin: 0 auto; padding: 48px 20px 80px; }}
  .site-nav {{ display: flex; gap: 18px; font-size: 0.85rem; margin-bottom: 20px; }}
  .site-nav a {{ color: var(--muted-dim); text-decoration: none; }}
  .card {{ background: var(--card); border: 1px solid var(--border); border-radius: 6px; padding: 28px; }}
  h1 {{ margin: 0 0 8px; }}
  h2 {{ font-size: 1.05rem; margin: 24px 0 8px; }}
  ul {{ columns: 2; padding-left: 20px; margin: 0; }}
  li {{ break-inside: avoid; margin-bottom: 4px; font-size: 0.92rem; }}
  a {{ color: #4F7A52; text-decoration: none; }}
  a:hover {{ text-decoration: underline; }}
</style>
<script async src="https://js.sparkloop.app/embed.js?publication_id=pub_7999f6c312f6" data-sparkloop></script>
</head>
<body>
<div class="wrap">
  <nav class="site-nav"><a href="/">Sparkfare</a><a href="/away-mode">Away Mode</a><a href="/blog/">Blog</a><a href="/watchlists">Watchlists</a><a href="/hub">Referrals</a><a href="/trips">Trips</a><a href="/account">Preferences</a><a href="/privacy">Privacy</a><a id="sign-in-nav-link" href="/sign-in">Sign in</a></nav>
  <div class="card">
    <h1>All Flight Routes</h1>
    <p>Every origin we track, paired with every destination we curate. Pick a route for today's real price and 30-day trend.</p>
    {body}
  </div>
</div>
<script src="/nav-auth.js"></script>
<script>syncNavAuthStateLazy();</script>
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
        cluster = destinations[d].get("cluster_archetype")
        if cluster:
            cluster_members.setdefault(cluster, []).append(d)

    pages = []
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
            sitemap_urls.append(f"{SITE_URL}/data/{origin.lower()}-to-{dest_slug}")

    with open(os.path.join(OUTPUT_DIR, "index.html"), "w", encoding="utf-8") as f:
        f.write(build_listing_page(pages))
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
