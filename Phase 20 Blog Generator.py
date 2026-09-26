import json
import os
import re

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
        
    affiliate_html = """      <div class="affiliate-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin: 24px 0;">
        <div style="background: #fff; border: 1px solid var(--border); border-radius: var(--radius); padding: 16px;">
          <h3 style="margin: 0 0 4px; font-size: 1.05rem;">SafetyWing</h3>
          <p style="margin: 0 0 12px; font-size: 0.9rem; color: var(--muted);">Travel medical coverage — because regular health insurance rarely crosses borders.</p>
          <a href="/go/safetywing" style="font-size: 0.9rem; font-weight: 600; text-decoration: none; color: var(--amber);" target="_blank" rel="noopener">Get covered →</a>
        </div>
        <div style="background: #fff; border: 1px solid var(--border); border-radius: var(--radius); padding: 16px;">
          <h3 style="margin: 0 0 4px; font-size: 1.05rem;">AirHelp</h3>
          <p style="margin: 0 0 12px; font-size: 0.9rem; color: var(--muted);">Flight delay, cancellation, and overbooking compensation handled for you.</p>
          <a href="/go/airhelp" style="font-size: 0.9rem; font-weight: 600; text-decoration: none; color: var(--amber);" target="_blank" rel="noopener">Check eligibility →</a>
        </div>
        <div style="background: #fff; border: 1px solid var(--border); border-radius: var(--radius); padding: 16px;">
          <h3 style="margin: 0 0 4px; font-size: 1.05rem;">Yesim</h3>
          <p style="margin: 0 0 12px; font-size: 0.9rem; color: var(--muted);">An eSIM for wherever you're landing — data the moment you touch down.</p>
          <a href="/go/yesim" style="font-size: 0.9rem; font-weight: 600; text-decoration: none; color: var(--amber);" target="_blank" rel="noopener">Get connected →</a>
        </div>
        <div style="background: #fff; border: 1px solid var(--border); border-radius: var(--radius); padding: 16px;">
          <h3 style="margin: 0 0 4px; font-size: 1.05rem;">Wise</h3>
          <p style="margin: 0 0 12px; font-size: 0.9rem; color: var(--muted);">Hold and spend in local currencies with no foreign transaction fees — real exchange rates wherever you travel.</p>
          <a href="/go/wise" style="font-size: 0.9rem; font-weight: 600; text-decoration: none; color: var(--amber);" target="_blank" rel="noopener">Learn more →</a>
        </div>
        <div style="background: #fff; border: 1px solid var(--border); border-radius: var(--radius); padding: 16px;">
          <h3 style="margin: 0 0 4px; font-size: 1.05rem;">US Global Mail</h3>
          <p style="margin: 0 0 12px; font-size: 0.9rem; color: var(--muted);">A virtual mailbox that opens, scans, and forwards your physical mail — so nothing piles up at home while you're away.</p>
          <a href="/go/us-global-mail" style="font-size: 0.9rem; font-weight: 600; text-decoration: none; color: var(--amber);" target="_blank" rel="noopener">Learn more →</a>
        </div>
        <div style="background: #fff; border: 1px solid var(--border); border-radius: var(--radius); padding: 16px;">
          <h3 style="margin: 0 0 4px; font-size: 1.05rem;">NordVPN</h3>
          <p style="margin: 0 0 12px; font-size: 0.9rem; color: var(--muted);">Keep your data off public airport and hotel Wi-Fi — set it up before you leave, not once you're already connected.</p>
          <a href="/go/nordvpn" style="font-size: 0.9rem; font-weight: 600; text-decoration: none; color: var(--amber);" target="_blank" rel="noopener">Learn more →</a>
        </div>
        <div style="background: #fff; border: 1px solid var(--border); border-radius: var(--radius); padding: 16px;">
          <h3 style="margin: 0 0 4px; font-size: 1.05rem;">Bounce</h3>
          <p style="margin: 0 0 12px; font-size: 0.9rem; color: var(--muted);">Luggage storage by the hour, wherever you land — no need to kill time dragging a bag around.</p>
          <a href="/go/bounce" style="font-size: 0.9rem; font-weight: 600; text-decoration: none; color: var(--amber);" target="_blank" rel="noopener">Find storage →</a>
        </div>
        <div style="background: #fff; border: 1px solid var(--border); border-radius: var(--radius); padding: 16px;">
          <h3 style="margin: 0 0 4px; font-size: 1.05rem;">Rocket Languages</h3>
          <p style="margin: 0 0 12px; font-size: 0.9rem; color: var(--muted);">Learn the language before you land — interactive courses built for real conversation, not just vocabulary lists.</p>
          <a href="/go/rocket-languages" style="font-size: 0.9rem; font-weight: 600; text-decoration: none; color: var(--amber);" target="_blank" rel="noopener">Learn more →</a>
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
        hook = copy.get('the_hook', '')
        on_ground = copy.get('on_ground_reality', [])
        on_ground_li = "\n".join([f"        <li>{item}</li>" for item in on_ground])
        away_transition = copy.get('away_mode_transition', '')
        
        # Determine cluster phrase
        cluster = dest_data.get('cluster_archetype', 'Cluster 1')
        city_name = dest_name.split(',')[0]
        if "1" in cluster:
            cluster_text = f"Sparkfare files {city_name} under Cluster 1, meaning it needs a real 25% dip below its own 30-day average before we badge it a deal."
            subtitle = "the long-haul sprint that justifies itself"
        elif "2" in cluster:
            cluster_text = f"Sparkfare files {city_name} under Cluster 2, meaning it needs a real 20% dip below its own 30-day average before we badge it a deal."
            subtitle = "a route worth waiting for"
        elif "3" in cluster:
            cluster_text = f"Sparkfare files {city_name} under Cluster 3, meaning it needs a real 15% dip below its own 30-day average before we badge it a deal."
            subtitle = "a weekend sprint within reach"
        else:
            cluster_text = f"Sparkfare tracks {city_name} looking for significant price drops below its own 30-day average."
            subtitle = "a destination guide"
        
        html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{dest_name}: {subtitle.capitalize()}</title>
  <meta name="description" content="Real on-the-ground prices for {city_name} — plus why routes like this one need a genuine dip before Sparkfare calls it a deal.">
  <meta property="og:title" content="{dest_name}: {subtitle.capitalize()}">
  <meta property="og:description" content="Real on-the-ground prices for {city_name}, plus how to catch this route when it's genuinely worth booking.">
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://sparkfare.com/blog/{slug}">
  <meta property="og:image" content="{img_url}">
  <link rel="canonical" href="https://sparkfare.com/blog/{slug}">
  <link rel="icon" href="/favicon.png" sizes="any">
  <link rel="icon" type="image/svg+xml" href="/sparkfare_mark.svg">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <style>
    :root {{
      --sand: #E8DCC5;
      --card: #FAF6EE;
      --border: #D9CBB0;
      --amber: #B8720F;
      --sage: #4F7A52;
      --text: #2E2318;
      --muted: #6B5A45;
      --radius: 6px;
    }}
    body {{ margin: 0; font-family: 'Segoe UI', sans-serif; background: var(--sand); color: var(--text); line-height: 1.6; }}
    .wrap {{ max-width: 760px; margin: 0 auto; padding: 48px 20px 80px; }}
    .card {{ background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 28px; }}
    .hero-photo {{ width: 100%; max-height: 340px; object-fit: cover; border-radius: var(--radius); margin-bottom: 20px; }}
    .attribution {{ font-size: 0.75rem; color: var(--muted); margin: -14px 0 24px; }}
    h1 {{ margin-top: 0; font-size: 2rem; letter-spacing: -0.03em; }}
    h2 {{ font-size: 1.25rem; margin-top: 2em; }}
    p, li {{ color: var(--muted); }}
    a {{ color: var(--amber); }}
    .byline {{ font-size: 0.85rem; color: var(--muted); margin-top: -12px; margin-bottom: 24px; }}
    .cta {{ display: inline-block; margin-top: 8px; background: var(--sage); color: #fff; padding: 10px 18px; border-radius: var(--radius); text-decoration: none; font-weight: 600; }}
    .cta:hover {{ opacity: 0.92; }}
    .site-nav {{ display: flex; gap: 18px; font-size: 0.85rem; margin-bottom: 20px; flex-wrap: wrap; }}
    .site-nav a {{ color: var(--muted); text-decoration: none; }}
    .site-nav a:hover {{ text-decoration: underline; }}
    .site-nav a.brand-link {{ display: inline-flex; align-items: center; gap: 6px; }}
    .brand-mark {{ width: 16px; height: 16px; flex-shrink: 0; }}
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
      <a href="/trips">Trips</a>
      <a href="/account">Preferences</a>
      <a href="/privacy">Privacy</a>
    </nav>

    <div class="card">
      <img class="hero-photo" src="{img_url}" alt="{dest_name}">
      <p class="attribution">Photo by <a href="{photographer_link}" target="_blank" rel="noopener">{photographer}</a> on <a href="{unsplash_link}" target="_blank" rel="noopener">Unsplash</a></p>
      
      <h1>{dest_name}: {subtitle}</h1>
      <p class="byline">Destination guide</p>

      <p>{hook} {cluster_text} Full math in <a href="/blog/how-we-rank-deals">how we rank deals</a>.</p>

      <h2>What it actually costs on the ground</h2>
      <ul>
{on_ground_li}
      </ul>

      <h2>Before you lock in dates</h2>
      <p>{away_transition}</p>
      
{affiliate_html}

      <p><a class="cta" href="/">See if {city_name} is on today's board</a></p>
    </div>
  </div>
</body>
</html>
"""
        with open(f"blog/{slug}.html", "w", encoding="utf-8") as out:
            out.write(html_content)
        count += 1
            
    print(f"Successfully generated {{count}} destination blog posts with native embedded affiliates.")

if __name__ == "__main__":
    main()
