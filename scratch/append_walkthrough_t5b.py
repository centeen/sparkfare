import os

file_path = r'C:\Users\cente\.gemini\antigravity-ide\brain\8f656439-dd2d-4029-9505-b95b2f526181\walkthrough.md'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

new_content = """

## Task T5b: Self-serve display ads on route pages

### Changes Made
- **Ad Slot Integration**: Reserved a dedicated, non-competing layout slot below the dual-pillar content on route pages. The slot implements a standard, network-agnostic async script block (currently templated with AdSense `adsbygoogle` code) which loads asynchronously to protect T5's Lighthouse/CWV scores.
- **Feature Flag**: Controlled by the `ENABLE_T5B_ADS` environment variable. When off (or undefined), there is zero visual change.
- **Thin-page suppression**: Integrated with the existing SEO logic. Even if the feature flag is on, ads will *never* render on thin (noindex) routes, ensuring that the domain avoids penalties from ad networks for showing ads on sparse/low-value pages.

### Verification
- **Unit Tests**: Wrote `tests/t5b_ads.test.js` to assert three scenarios: 
  1. Flag off = no ad slot rendered.
  2. Flag on + rich route = ad slot rendered.
  3. Flag on + thin route = no ad slot rendered (thin-page override succeeds).
"""

content = content + new_content

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated walkthrough.md for T5b")
