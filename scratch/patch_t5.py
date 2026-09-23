import os

file_path = r'C:\Users\cente\sparkfare\src\index.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

helpers = """
// Workplan Step 96-98: Sparkline generation for 30-day price history
function generateSparklineSvg(prices) {
  if (!prices || prices.length === 0) return '';
  const validPrices = prices.filter(p => typeof p === 'number' && !isNaN(p));
  if (validPrices.length < 2) return '';

  const w = 120;
  const h = 32;
  const paddingY = 4;
  const max = Math.max(...validPrices);
  const min = Math.min(...validPrices);
  const range = max === min ? 1 : max - min;

  const points = validPrices.map((p, i) => {
    const x = (i / (validPrices.length - 1)) * w;
    const y = h - paddingY - ((p - min) / range) * (h - 2 * paddingY);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const lastY = h - paddingY - ((validPrices[validPrices.length - 1] - min) / range) * (h - 2 * paddingY);

  return `
<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="30-day price trend">
  <polyline points="${points}" fill="none" stroke="#2B2620" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
  <circle cx="${w}" cy="${lastY.toFixed(1)}" r="2.5" fill="#E8B930"/>
</svg>`.trim();
}

function renderRoutePage(deal, origin, destination, partnersHtml, isThin) {
  const metaRobots = isThin ? '<meta name="robots" content="noindex">' : '';
  const canonical = isThin ? '' : `<link rel="canonical" href="https://sparkfare.com/flight/${origin}/${destination}">`;
  const prices = (deal.observations || []).map(o => o.price);
  const sparklineSvg = generateSparklineSvg(prices);

  const bestPrice = deal.price || 0;
  const basis = deal.basis_text || '';
  const ctaLink = `/departing/${origin}?ref=route_${origin}_${destination}`;

  // JSON-LD
  const jsonLd = isThin ? '' : `
  <script type="application/ld+json">
  {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": "Flight Deal from ${origin} to ${destination}",
    "offers": {
      "@type": "Offer",
      "priceCurrency": "USD",
      "price": "${bestPrice}",
      "availability": "https://schema.org/InStock"
    }
  }
  </script>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cheap flights from ${origin} to ${destination} | Sparkfare</title>
  ${metaRobots}
  ${canonical}
  ${jsonLd}
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500&family=Roboto+Mono:wght@400;500&display=swap');
    body {
      margin: 0;
      padding: 0;
      background-color: #EDE6D6;
      color: #2B2620;
      font-family: Arial, sans-serif;
    }
    header {
      padding: 24px 32px;
      border-bottom: 1px solid #DCD3BF;
    }
    .tagline {
      font-family: 'Space Grotesk', sans-serif;
      font-weight: 500;
      font-size: 1.1rem;
      margin: 0;
    }
    main {
      padding: 48px 32px;
      max-width: 1000px;
      margin: 0 auto;
    }
    h1 {
      font-family: 'Space Grotesk', sans-serif;
      font-weight: 500;
      font-size: 2.5rem;
      margin-top: 0;
      margin-bottom: 48px;
    }
    .columns {
      display: flex;
      gap: 48px;
      flex-wrap: wrap;
    }
    .col {
      flex: 1;
      min-width: 320px;
      background: #E3D9C4;
      padding: 32px;
      border-radius: 8px;
      box-sizing: border-box;
    }
    .col h2 {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 1.5rem;
      margin-top: 0;
      margin-bottom: 24px;
    }
    .price-display {
      font-family: 'Roboto Mono', monospace;
      font-size: 2rem;
      font-weight: 500;
      margin-bottom: 8px;
    }
    .sparkline-container {
      margin-bottom: 24px;
    }
    .basis {
      color: #6B6255;
      font-size: 0.9rem;
      margin-bottom: 32px;
    }
    .cta {
      display: inline-block;
      background: #E8B930;
      color: #2B2620;
      text-decoration: none;
      font-weight: 600;
      padding: 14px 32px;
      border-radius: 6px;
      font-size: 1.1rem;
      transition: filter 0.2s;
    }
    .cta:hover {
      filter: brightness(1.05);
    }
    .partners-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .partners-list li {
      margin-bottom: 16px;
      padding-bottom: 16px;
      border-bottom: 1px solid #DCD3BF;
    }
    .partners-list li:last-child {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
    }
    .partner-name {
      font-weight: bold;
      margin-right: 8px;
    }
    .partner-blurb {
      color: #6B6255;
      font-size: 0.9rem;
      margin-top: 4px;
      margin-bottom: 8px;
      display: block;
    }
    .partner-link {
      color: #2B2620;
      text-decoration: underline;
      font-size: 0.9rem;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <header>
    <p class="tagline">It only sparks when the fare's real.</p>
  </header>
  <main>
    <h1>Flight deals to ${destination}</h1>
    <div class="columns">
      <div class="col">
        <h2>The Fare</h2>
        <div class="price-display">$${bestPrice}</div>
        <div class="sparkline-container">
          ${sparklineSvg}
        </div>
        <div class="basis">${basis}</div>
        <a href="${ctaLink}" class="cta">Get Deal Alerts</a>
      </div>
      
      <div class="col">
        <h2>Everything else, handled.</h2>
        <ul class="partners-list">
          ${partnersHtml}
        </ul>
      </div>
    </div>
  </main>
</body>
</html>`;
}
"""

routes = """
    // T5: Programmatic route pages
    if (url.pathname.startsWith('/flight/')) {
      const parts = url.pathname.split('/');
      if (parts.length === 4) {
        const origin = parts[2].toUpperCase();
        const destination = parts[3].toUpperCase();
        
        if (VALID_ORIGINS.has(origin)) {
          const raw = await loadJsonAsset(env, `sparkfare_ranked_deals${origin === 'JFK' ? '' : '_other_origins'}.json`);
          const dealList = raw.deals || [];
          
          let targetDeal = null;
          for (const d of dealList) {
            if (d.origin === origin && d.destination === destination) {
              targetDeal = d;
              break;
            }
          }
          
          if (!targetDeal && raw.featured) {
            for (const d of raw.featured) {
              if (d.origin === origin && d.destination === destination) {
                targetDeal = d;
                break;
              }
            }
          }

          if (targetDeal) {
            const now = new Date();
            const obs = targetDeal.observations || (targetDeal.price_history ? targetDeal.price_history.map(p => ({price: p, date: now.toISOString()})) : []);
            const dq = dealQuality(obs, targetDeal, now);
            
            // Thin-page policy: must have >= 14 days history and >= 10 observations
            const isThin = dq.spanDays < 14 || dq.baselineN < 10;
            
            // Re-run guardrail to make sure we don't show stale/invalid basis
            if (dq.eligible) {
              targetDeal.basis_text = dq.basis_text;
            } else {
              targetDeal.basis_text = '';
            }

            const { getAwayModePartners } = await import('./email.js');
            const activePartners = await getAwayModePartners(env);
            
            const partnersHtml = activePartners.map(p => `
              <li>
                <span class="partner-name">${p.name}</span>
                <span class="partner-blurb">${p.category} — ${p.blurb || 'Recommended partner'}</span>
                <a class="partner-link" href="/go/${p.slug}">View Partner</a>
              </li>
            `).join('');

            return new Response(renderRoutePage(targetDeal, origin, destination, partnersHtml, isThin), {
              headers: { 'Content-Type': 'text/html; charset=utf-8' }
            });
          }
        }
      }
      return new Response('Route not found', { status: 404 });
    }

    if (url.pathname === '/sitemap.xml') {
      let urls = [];
      const origins = Array.from(VALID_ORIGINS);
      
      const now = new Date();
      for (const origin of origins) {
        const raw = await loadJsonAsset(env, `sparkfare_ranked_deals${origin === 'JFK' ? '' : '_other_origins'}.json`);
        const allDeals = [...(raw.deals || []), ...(raw.featured || [])].filter(d => d.origin === origin);
        
        for (const deal of allDeals) {
          const obs = deal.observations || (deal.price_history ? deal.price_history.map(p => ({price: p, date: now.toISOString()})) : []);
          const dq = dealQuality(obs, deal, now);
          
          if (dq.spanDays >= 14 && dq.baselineN >= 10) {
            urls.push(`https://sparkfare.com/flight/${origin}/${deal.destination}`);
          }
        }
      }
      
      // Remove duplicates
      urls = [...new Set(urls)];
      
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${urls.map(u => `
  <url>
    <loc>${u}</loc>
    <changefreq>daily</changefreq>
  </url>`).join('')}
</urlset>`;

      return new Response(xml.trim(), {
        headers: { 
          'Content-Type': 'application/xml',
          'Cache-Control': 'public, max-age=14400'
        }
      });
    }
"""

target = "    return handleRequest(request, env, ctx);"

if target in content:
    content = helpers + "\n\n" + content.replace(target, routes + "\n" + target)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Patched index.js with T5 routes")
else:
    print("Could not find handleRequest target")
