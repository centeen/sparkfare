import sys

content = """
## T3: Referral loop v1
**Status: Complete**

We've successfully implemented the v1 of the Sparkfare referral loop.

**Changes Made:**
1. **Feature Flag (`ENABLE_T3_REFERRALS`)**: The referral hub, reward terms, and API endpoints are hidden behind this flag in `wrangler.jsonc` and `src/index.js`.
2. **Attribution & Anti-Abuse**: `POST /api/signup` now reads the `ref` cookie, resolves it to the referrer's `user_id`, and correctly populates the `referrals` table. We implemented anti-abuse logic to prevent self-referrals and IP spamming.
3. **Frontend Views**: 
   - Linked `reward-terms.html` from `hub.html`.
   - Updated `index.html` to properly extract the `ref` cookie instead of relying only on the URL query param.
   - Updated `account.html` to fetch the feature flag status and conditionally display the Referral Hub link.
4. **KPI Dashboard**: Added "Ref. Signups" and "Ref. Share" to the weekly events table on `/kpi` to track the percentage of new users joining via referrals.
5. **Testing**: Implemented automated test coverage in `tests/t3_referrals.test.js` validating attribution, anti-abuse, and feature flagging.

**Validation:**
- Passed automated unit tests for attribution and feature toggles.
- Successfully verified KPI metrics computation and HTML rendering.
"""

with open(r'C:\Users\cente\.gemini\antigravity-ide\brain\8f656439-dd2d-4029-9505-b95b2f526181\walkthrough.md', 'a', encoding='utf-8') as f:
    f.write(content)

with open(r'C:\Users\cente\.gemini\antigravity-ide\brain\8f656439-dd2d-4029-9505-b95b2f526181\task.md', 'r', encoding='utf-8') as f:
    task = f.read()

task = task.replace('- `[ ]` 5.1. Update `walkthrough.md`.', '- `[x]` 5.1. Update `walkthrough.md`.')
task = task.replace('- `[ ]` 5. Verification & Walkthrough', '- `[x]` 5. Verification & Walkthrough')

with open(r'C:\Users\cente\.gemini\antigravity-ide\brain\8f656439-dd2d-4029-9505-b95b2f526181\task.md', 'w', encoding='utf-8') as f:
    f.write(task)
