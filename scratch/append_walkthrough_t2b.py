import os

file_path = r'C:\Users\cente\.gemini\antigravity-ide\brain\8f656439-dd2d-4029-9505-b95b2f526181\walkthrough.md'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

new_content = """

## Task T2b: Automated pre-departure Away Mode sequence

### Changes Made
- **Sequence Email (`src/email.js`)**: Added `sendPreDepartureSequenceEmail()` which formats an email with a single partner from the registry. The function now accepts `excludedPartnerIds`, filtering them out before prioritizing the remaining partners to ensure the user sees a *new* partner each time.
- **Alert Logic (`src/index.js`)**: Created `sendPreDepartureSequenceAlerts()`, which identifies users whose `departure_at` is exactly 14, 7, or 1 days away. It tracks sent stages in a new `pre_departure_sequence_deliveries` table to prevent double-sends, and fetches previously seen partners from `away_mode_email_log` so they can be excluded.
- **Cron Job`: Added `sendPreDepartureSequenceAlerts` to the scheduled handler.
- **T0 Metrics**: Logs an `away_mode_sequence_sent` event with the stage and partner slug whenever it successfully fires, tracking the click-through rate.
- **Feature Flag**: Added `ENABLE_T2B_SEQUENCE`. This keeps the new sequence disabled by default, ensuring safety until you are ready to flip it on.

### Verification
- **Unit Tests**: Built `tests/t2b_sequence.test.js` using `node:test` to verify that the offsets (14, 7, 1) trigger properly, that idempotency checks out, and that `excludedPartnerIds` are fetched and passed down.

"""

content = content + new_content

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated walkthrough.md")
