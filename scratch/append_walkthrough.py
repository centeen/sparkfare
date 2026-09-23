import os

walkthrough_path = r'C:\Users\cente\.gemini\antigravity-ide\brain\8f656439-dd2d-4029-9505-b95b2f526181\walkthrough.md'

new_content = """
## T6 Embeddable Widget

Implemented the self-serve embeddable widget for publishers to display flight deals on their sites.

### Key Changes
1. **Database Migration**: Created `widget_rate_limits` table in D1 to enforce per-IP rate limits (max 100 requests per hour per origin).
2. **Widget UI (`/widget`)**: Created `widget.html` designed to be loaded within an iframe. It dynamically fetches pricing data, renders the SVG sparkline for 30-day trends, and includes a backlink to the full T5 route page.
3. **Embed Generator (`/embed`)**: Created `embed.html` providing a self-serve UI for publishers to configure and copy their iframe snippet with a live preview.
4. **JSON API (`/api/widget/:origin/:destination`)**: Returns real-time pricing data for a specified route. Applies the T1 Honesty Guardrail so stale or non-deal routes return 404.
5. **Impression Logging**: The widget HTML explicitly POSTs a `widget_impression` event to `/api/events`, passing the publisher's `document.referrer`.

### Verification
- Added `t6_widget.test.js` to assert the API endpoints only return eligible deals and enforce the HTTP 429 rate limit correctly.
"""

with open(walkthrough_path, 'a', encoding='utf-8') as f:
    f.write(new_content)
