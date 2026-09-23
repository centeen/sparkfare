import os

walkthrough_path = r"C:\Users\cente\.gemini\antigravity-ide\brain\8f656439-dd2d-4029-9505-b95b2f526181\walkthrough.md"

content = """
---

## Task T0: Instrumentation and Metrics Baseline

### Changes Made
- **Backend APIs (`src/index.js`)**: 
  - Unified the `GET /admin/metrics` endpoint. It now accepts either an `Authorization: Bearer` token or a `?secret=` query parameter to securely restrict access.
  - Adapted the existing `computeKPIs` function to power the `/admin/metrics` endpoint, properly exposing 14-day engagement cohorts, weekly rollups (signups, emails sent, opens, clicks), and outbound clicks by partner.
  - Audited existing event tracking to ensure proper propagation to the `events` table via the `logEvent` helper.

- **Metrics Snapshot Generation (`scratch/snapshot_metrics.js`)**:
  - Developed a standalone script that securely queries the `/admin/metrics` endpoint and automatically generates `state_METRICS.md`.
  - The generated markdown strictly matches the expected table format (Acquisition, Weekly Events, Cohorts, Outbound Clicks).

### What was tested
- Added `tests/t0_metrics.test.js` to ensure the endpoint correctly rejects requests with missing or invalid secrets (401 Unauthorized).
- Verified that with a valid secret, the endpoint correctly delegates to the DB and returns all required JSON structures (`viral`, `weekly_events`, `cohorts`).
- Verified `logEvent` correctly structures its payload and executes the SQL insert.

### Verification Results
- All unit tests pass locally.
- The snapshot script securely processes the payload and correctly formats the markdown file `state_METRICS.md`.
"""

with open(walkthrough_path, "a", encoding="utf-8") as f:
    f.write(content)

print("Appended T0 to walkthrough.md")
