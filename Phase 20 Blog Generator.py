import json
import os
import re
SITE_NAV_HTML = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'brand', 'header.html'), encoding='utf-8').read()

from unsplash_img import img_attrs

# K-B7: the hero photo spans the article column.
HERO_SIZES = "(max-width: 767px) 100vw, 760px"

# K-A3 (ROADMAP step 121): the same test as isCleanLine() in index.html. Keep the two in step.
BARRED_COPY = re.compile(r"(\d\s*[–-]?\s*\d*\s*%|[$€£]\s?\d|\b(hurry|last chance|act now|steal|insane|guaranteed|prices will rise|lowest ever|hack|instantly|limited time|move fast|vanish\w*|premium|arbitrage|only \d+ left)\b|the moment)", re.I)


def is_clean_line(text):
    return isinstance(text, str) and text.strip() != "" and not BARRED_COPY.search(text)


def slugify(text):
    text = text.lower()
    text = re.sub(r'[^a-z0-9]+', '-', text)
    return text.strip('-')

def main():
    print("Loading datasets...")
    with open('sparkfare_destinations.json', 'r', encoding='utf-8') as f:
        destinations = json.load(f)
        
    with open('sparkfare_images.json', 'r', encoding='utf-8') as f:
        images = json.load(f)
        
    affiliate_html = """      <p class="affiliate-disclosure" style="font-size: 0.85rem; margin: 24px 0 -8px;">Sparkfare may earn a commission if you buy through the partner links below, at no extra cost to you. <a href="/disclosure">Read our disclosure</a>.</p>
      <div class="affiliate-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin: 24px 0;">
        <div style="background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px;">
          <h3 style="margin: 0 0 4px; font-size: 1.05rem;">AirHelp</h3>
          <p style="margin: 0 0 12px; font-size: 0.9rem; color: var(--muted);">Flight delay, cancellation, and overbooking compensation handled for you.</p>
          <a href="/go/airhelp" style="font-size: 0.9rem; font-weight: 600; text-decoration: none; color: var(--amber); display: inline-block; padding: 4px 0;" target="_blank" rel="sponsored nofollow noopener">Check eligibility →</a>
        </div>
        <div style="background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px;">
          <h3 style="margin: 0 0 4px; font-size: 1.05rem;">Yesim</h3>
          <p style="margin: 0 0 12px; font-size: 0.9rem; color: var(--muted);">An eSIM for wherever you're landing. Data from the moment you land, on a supported network.</p>
          <a href="/go/yesim" style="font-size: 0.9rem; font-weight: 600; text-decoration: none; color: var(--amber); display: inline-block; padding: 4px 0;" target="_blank" rel="sponsored nofollow noopener">Get connected →</a>
        </div>
        <div style="background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px;">
          <h3 style="margin: 0 0 4px; font-size: 1.05rem;">Wise</h3>
          <p style="margin: 0 0 12px; font-size: 0.9rem; color: var(--muted);">Hold and spend in local currencies with no foreign transaction fees — real exchange rates wherever you travel.</p>
          <a href="/go/wise" style="font-size: 0.9rem; font-weight: 600; text-decoration: none; color: var(--amber); display: inline-block; padding: 4px 0;" target="_blank" rel="sponsored nofollow noopener">Learn more →</a>
        </div>
        <div style="background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px;">
          <h3 style="margin: 0 0 4px; font-size: 1.05rem;">US Global Mail</h3>
          <p style="margin: 0 0 12px; font-size: 0.9rem; color: var(--muted);">A virtual mailbox that opens, scans, and forwards your physical mail — so nothing piles up at home while you're away.</p>
          <a href="/go/us-global-mail" style="font-size: 0.9rem; font-weight: 600; text-decoration: none; color: var(--amber); display: inline-block; padding: 4px 0;" target="_blank" rel="sponsored nofollow noopener">Learn more →</a>
        </div>
        <div style="background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px;">
          <h3 style="margin: 0 0 4px; font-size: 1.05rem;">NordVPN</h3>
          <p style="margin: 0 0 12px; font-size: 0.9rem; color: var(--muted);">Keep your data off public airport and hotel Wi-Fi — set it up before you leave, not once you're already connected.</p>
          <a href="/go/nordvpn" style="font-size: 0.9rem; font-weight: 600; text-decoration: none; color: var(--amber); display: inline-block; padding: 4px 0;" target="_blank" rel="sponsored nofollow noopener">Learn more →</a>
        </div>
        <div style="background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px;">
          <h3 style="margin: 0 0 4px; font-size: 1.05rem;">Bounce</h3>
          <p style="margin: 0 0 12px; font-size: 0.9rem; color: var(--muted);">Luggage storage by the hour, wherever you land — no need to kill time dragging a bag around.</p>
          <a href="/go/bounce" style="font-size: 0.9rem; font-weight: 600; text-decoration: none; color: var(--amber); display: inline-block; padding: 4px 0;" target="_blank" rel="sponsored nofollow noopener">Find storage →</a>
        </div>
        <div style="background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px;">
          <h3 style="margin: 0 0 4px; font-size: 1.05rem;">Rocket Languages</h3>
          <p style="margin: 0 0 12px; font-size: 0.9rem; color: var(--muted);">Learn the language before you land — interactive courses built for real conversation, not just vocabulary lists.</p>
          <a href="/go/rocket-languages" style="font-size: 0.9rem; font-weight: 600; text-decoration: none; color: var(--amber); display: inline-block; padding: 4px 0;" target="_blank" rel="sponsored nofollow noopener">Learn more →</a>
        </div>
      </div>"""

    os.makedirs('blog', exist_ok=True)
    count = 0
    
    for dest_name, dest_data in destinations.items():
        slug = slugify(dest_name)
        img_data = images.get(dest_name, {})
        img_url = img_data.get('image_url', '')
        photographer = img_data.get('photographer_name', 'Unknown')
        photographer_link = img_data.get('photographer_link', '#')
        unsplash_link = img_data.get('unsplash_link', '#')
        
        copy = dest_data.get('copywriting', {})
        # K-A3: a generated line with a figure, a comparison or barred wording is never published (same rule as index.html's isCleanLine).
        hook = copy.get('the_hook', '')
        hook = hook if is_clean_line(hook) else ''
        on_ground = [item for item in copy.get('on_ground_reality', []) if is_clean_line(item)]
        on_ground_li = "\n".join([f"        <li>{item}</li>" for item in on_ground])
        away_transition = copy.get('away_mode_transition', '')
        away_transition = away_transition if is_clean_line(away_transition) else ''
        on_ground_section = f"      <h2>What it actually costs on the ground</h2>\n      <ul>\n{on_ground_li}\n      </ul>\n\n" if on_ground else ""
        away_section = f"      <h2>Before you settle your dates</h2>\n      <p>{away_transition}</p>\n" if away_transition else ""
        
        # Determine cluster phrase
        cluster = dest_data.get('group', 'long_haul')
        city_name = dest_name.split(',')[0]
        if cluster == "long_haul":
            cluster_text = f"Like every priced route, {city_name} earns a deal badge only when a fare falls below its own 30-day median by more than twice its usual day-to-day price swing, and only once the route has at least 10 days of price history spanning 14 days or more."
            subtitle = "the long-haul sprint that justifies itself"
        elif cluster == "shoulder_season":
            cluster_text = f"Like every priced route, {city_name} earns a deal badge only when a fare falls below its own 30-day median by more than twice its usual day-to-day price swing, and only once the route has at least 10 days of price history spanning 14 days or more."
            subtitle = "a route worth waiting for"
        elif cluster == "low_cost_carrier":
            cluster_text = f"Like every priced route, {city_name} earns a deal badge only when a fare falls below its own 30-day median by more than twice its usual day-to-day price swing, and only once the route has at least 10 days of price history spanning 14 days or more."
            subtitle = "a weekend sprint within reach"
        else:
            cluster_text = f"Sparkfare shows {city_name} whenever we have a current fare, whatever the price, and never badges it as a deal: this route isn't judged against a price baseline."
            subtitle = "a destination guide"
        
        html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{dest_name}: {subtitle.capitalize()}</title>
  <meta name="description" content="On-the-ground notes for {city_name} — plus why routes like this one need a genuine dip before Sparkfare calls it a deal.">
  <meta property="og:title" content="{dest_name}: {subtitle.capitalize()}">
  <meta property="og:description" content="On-the-ground notes for {city_name}, plus how to watch this route and hear when it drops below its usual price.">
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://sparkfare.com/blog/{slug}">
  <meta property="og:image" content="{img_url}">
  <link rel="canonical" href="https://sparkfare.com/blog/{slug}">
  <link rel="icon" href="/favicon.png" sizes="any">
  <link rel="icon" type="image/svg+xml" href="/sparkfare_mark.svg">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="stylesheet" href="/brand/tokens.css">
<link rel="stylesheet" href="/brand/fonts.css">
<style>
    body {{ margin: 0; font-family: var(--font-body); background: var(--sand); color: var(--text); line-height: 1.6; }}
    .wrap {{ max-width: 760px; margin: 0 auto; padding: 48px 20px 80px; }}
    .card {{ background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 28px; }}
    .hero-photo {{ width: 100%; height: auto; max-height: 340px; object-fit: cover; border-radius: var(--radius); margin-bottom: 20px; }}
    .attribution {{ font-size: 0.8125rem; color: var(--muted); margin: -14px 0 24px; }}
    h1 {{ margin-top: 0; font-size: 2rem; letter-spacing: -0.03em; }}
    h2 {{ font-size: 1.25rem; margin-top: 2em; }}
    p, li {{ color: var(--muted); }}
    a {{ color: var(--amber); }}
    .byline {{ font-size: 0.85rem; color: var(--muted); margin-top: -12px; margin-bottom: 24px; }}
    .cta {{ display: inline-block; margin-top: 8px; background: var(--sage); color: var(--on-sage); padding: 10px 18px; border-radius: var(--radius); text-decoration: none; font-weight: 600; }}
    .cta:hover {{ opacity: 0.92; }}
    .site-nav {{ display: flex; gap: 18px; font-size: 0.85rem; margin-bottom: 20px; flex-wrap: wrap; }}
    .site-nav a {{ color: var(--muted); text-decoration: none; }}
    /* nav tap targets */ @media (max-width: 768px) {{ .site-nav {{ gap: 0 18px; }} .site-nav a {{ display: inline-block; padding: 11px 0; }} }}
    .site-nav a:hover {{ text-decoration: underline; }}
    .site-nav a.brand-link {{ display: inline-flex; align-items: center; gap: 6px; }}
    .brand-mark {{ width: 16px; height: 16px; flex-shrink: 0; }}
  </style>
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
  <div class="wrap">
    {SITE_NAV_HTML}
<main id="main">

    <div class="card">
      <img class="hero-photo" {img_attrs(img_url, (480, 960), HERO_SIZES)} alt="{dest_name}" fetchpriority="high">
      <p class="attribution">Photo by <a href="{photographer_link}" target="_blank" rel="noopener">{photographer}</a> on <a href="{unsplash_link}" target="_blank" rel="noopener">Unsplash</a></p>
      
      <h1>{dest_name}: {subtitle}</h1>
      <p class="byline">Destination guide</p>

      <p>{(hook + ' ') if hook else ''}{cluster_text} Full math in <a href="/blog/how-we-rank-deals">how we rank deals</a>.</p>

{on_ground_section}{away_section}      
{affiliate_html}

      <p><a class="cta" href="/">See if {city_name} is on today's board</a></p>
    </div>
  </main>
</div>
<script src="/nav-auth.js"></script>
<script>syncNavAuthStateLazy();</script>
<script src="/site-footer.js" defer></script>
</body>
</html>
"""
        with open(f"blog/{slug}.html", "w", encoding="utf-8") as out:
            out.write(html_content)
        count += 1
            
    print(f"Successfully generated {{count}} destination blog posts with native embedded affiliates.")

if __name__ == "__main__":
    main()
