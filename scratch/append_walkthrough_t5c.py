import os

file_path = r'C:\Users\cente\.gemini\antigravity-ide\brain\8f656439-dd2d-4029-9505-b95b2f526181\walkthrough.md'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

new_content = """

## Task T5c: Auto-expanding route-page content

### Changes Made
- **Automated Promotion Checker**: Implemented `checkAndLogRoutePromotions(env)` inside the worker's cron scheduled handler. This function evaluates all origin-destination pairs on the regular cadence.
- **T0 Event Logging**: When a route that hasn't been logged yet becomes eligible for indexing (spanDays >= 14, baselineN >= 10), the worker automatically inserts a `route_promoted` event into the D1 `events` table. This allows you to track the growth of your indexable route pages as a primary T0 business metric.
- **Sitemap Integration**: Because T5 was built correctly, the `GET /sitemap.xml` route is already entirely dynamic. As soon as the data pipeline deposits new data that makes a route eligible, it instantly appears in the sitemap without any further build step needed.

### Verification
- **Unit Tests**: Wrote `tests/t5c_auto_expand.test.js` to simulate a scheduled cron event. Asserts that an eligible route (e.g. JFK-CDG) gets a `route_promoted` INSERT statement in D1, an ineligible thin route (JFK-LHR) does not, and that the function doesn't double-log routes that are already promoted.
"""

content = content + new_content

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated walkthrough.md for T5c")
