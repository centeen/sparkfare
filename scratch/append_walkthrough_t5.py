import os

file_path = r'C:\Users\cente\.gemini\antigravity-ide\brain\8f656439-dd2d-4029-9505-b95b2f526181\walkthrough.md'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

new_content = """

## Task T5: Programmatic route pages

### Changes Made
- **Routing Engine (`src/index.js`)**: Built new routes `GET /flight/:origin/:destination` and `GET /sitemap.xml`.
- **Dual-Pillar Rendering**: The `/flight/` route now renders a standalone HTML page displaying the current best price, median price baseline, and the new Away Mode partner list — presenting the flight deal and trip setup tools with equal visual weight.
- **Sparklines**: Integrated `generateSparklineSvg(prices)` to dynamically build the 30-day trailing price chart as an inline SVG using the brand's 'Spark gold' color.
- **Thin-Page SEO Guardrail**: The system computes data density using `dealQuality.js`. Any route with `< 14 days` of history or `< 10 data points` will get a `<meta name="robots" content="noindex">` tag and will be excluded from the `sitemap.xml`. Rich routes get a canonical URL and JSON-LD structured data.

### Verification
- **Test Suite**: Added `tests/t5_route_pages.test.js` using `node:test`. We mock the Cloudflare `ASSETS` binding to supply one rich deal and one thin deal. We assert that the thin route correctly receives the `noindex` tag, the rich route gets indexed and includes the sparkline + Away Mode list, and `sitemap.xml` properly filters the thin route out.
"""

content = content + new_content

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated walkthrough.md for T5")
