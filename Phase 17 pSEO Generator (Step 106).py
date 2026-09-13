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

    if record.get("status") == "deal":
        pct = round((record.get("pct_below_avg") or 0) * 100)
        h1 = f"Flights from {origin} to {dest}: {pct}% Below 30-Day Average"
        avg_html = fmt_price(record.get("trailing_avg"))
        body = (
            f'<p class="price-status is-deal">Today\'s price: <span class="price-num">{price_html}</span>{spark} '
            f"— {pct}% below the 30-day average of {avg_html}. This is a real, price-history-based deal, "
            f"not a marketing claim.</p>"
        )
        meta = f"Flights from {origin} to {dest}: {price_html} today, {pct}% below the 30-day average of {avg_html}. Real price-history-based deal detection, not guesswork."
    elif record.get("status") == "priced_no_deal":
        avg_html = fmt_price(record.get("trailing_avg"))
        h1 = f"Flights from {origin} to {dest}: Current Price vs. 30-Day Average"
        body = (
            f'<p class="price-status">Today\'s price: <span class="price-num">{price_html}</span>{spark} '
            f"— the 30-day average for this route is {avg_html}. Not a deal today, but worth watching."
            f"</p>"
        )
        meta = f"Flights from {origin} to {dest}: {price_html} today vs. a {avg_html} 30-day average. Track this route and get alerted the moment it's genuinely worth booking."
    else:  # "featured" -- Cluster 4, imagery-driven, no trailing_avg to compare against
        h1 = f"Flights from {origin} to {dest}"
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


def build_page(origin, origin_label, dest, dest_slug, record, image):
    h1, price_block, meta_description = build_h1_and_body(origin, dest, record)
    canonical = f"{SITE_URL}/data/{origin.lower()}-to-{dest_slug}"

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
  body {{ margin: 0; background: var(--sand); color: var(--text); font-family: 'Segoe UI', sans-serif; line-height: 1.6; }}
  .wrap {{ max-width: 760px; margin: 0 auto; padding: 48px 20px 80px; }}
  .site-nav {{ display: flex; gap: 18px; font-size: 0.85rem; margin-bottom: 20px; }}
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
</style>
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
    <a href="/blog/">Blog</a>
    <a href="/away-mode">Away Mode</a>
    <a href="/data/">All Routes</a>
  </nav>
  <div class="card">
    <h1>{h1}</h1>
    {photo_html}
    {price_block}
    {stale_note}
    {blog_link_html}

    <div class="signup-panel">
      <p class="label">Get an alert for this route</p>
      <form class="signup-form" id="signup-form" novalidate>
        <input type="email" id="email" name="email" placeholder="Email address" required>
        <select id="origin_iata" name="origin_iata" required>
          <option value="JFK"{" selected" if origin == "JFK" else ""}>JFK — New York</option>
          <option value="LAX"{" selected" if origin == "LAX" else ""}>LAX — Los Angeles</option>
          <option value="ORD"{" selected" if origin == "ORD" else ""}>ORD — Chicago</option>
          <option value="ATL"{" selected" if origin == "ATL" else ""}>ATL — Atlanta</option>
          <option value="DFW"{" selected" if origin == "DFW" else ""}>DFW — Dallas</option>
          <option value="SFO"{" selected" if origin == "SFO" else ""}>SFO — San Francisco</option>
          <option value="MIA"{" selected" if origin == "MIA" else ""}>MIA — Miami</option>
          <option value="IAD"{" selected" if origin == "IAD" else ""}>IAD — Washington DC</option>
          <option value="EWR"{" selected" if origin == "EWR" else ""}>EWR — Newark</option>
          <option value="SEA"{" selected" if origin == "SEA" else ""}>SEA — Seattle</option>
          <option value="IAH"{" selected" if origin == "IAH" else ""}>IAH — Houston</option>
          <option value="BOS"{" selected" if origin == "BOS" else ""}>BOS — Boston</option>
        </select>
        <button type="submit">Create alert</button>
      </form>
      <div id="signup-status" class="signup-status" aria-live="polite"></div>
      <p class="disclosure">100% free. Sparkfare may earn a commission on flights booked through emailed links, at no extra cost to you. <a href="/disclosure">Read our disclosure</a>.</p>
    </div>

    <p class="flight-cta">Want the full board? <a href="/">See today's deals →</a></p>
  </div>
</div>
<script>
  const VALID_ORIGINS = new Set(['JFK','LAX','ORD','ATL','DFW','SFO','MIA','IAD','EWR','SEA','IAH','BOS']);
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
      status.textContent = 'Please complete the required fields before creating your alert.';
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
      form.reset();
    }} catch (error) {{
      status.textContent = error.message || 'Something went wrong while creating the alert.';
      status.className = 'signup-status error';
    }}
  }});
</script>
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
</head>
<body>
<div class="wrap">
  <nav class="site-nav"><a href="/">Sparkfare</a><a href="/blog/">Blog</a><a href="/away-mode">Away Mode</a></nav>
  <div class="card">
    <h1>All Flight Routes</h1>
    <p>Every origin we track, paired with every destination we curate. Pick a route for today's real price and 30-day trend.</p>
    {body}
  </div>
</div>
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

            html = build_page(origin, origin_label, dest, dest_slug, record, images.get(dest))
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


if __name__ == "__main__":
    main()
