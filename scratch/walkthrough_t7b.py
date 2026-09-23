import os

walkthrough_path = r"C:\Users\cente\.gemini\antigravity-ide\brain\8f656439-dd2d-4029-9505-b95b2f526181\walkthrough.md"

with open(walkthrough_path, "r", encoding="utf-8") as f:
    content = f.read()

new_section = """

---

## T7b. Web Push Notifications

Implemented Web Push Notifications as a secondary channel to complement email delivery.

### Features
* **Opt-in Management:** Users can toggle `notify_email` and `notify_push` independently in their account preferences.
* **Service Worker (`sw.js`):** Receives background push events from Cloudflare, displaying them as browser notifications and tracking clicks via `POST /api/events`.
* **Push Integration:** The backend seamlessly handles subscription persistence (`push_subscriptions` table in D1) and dynamically routes alerts via the `web-push` library running directly in the Worker context.
* **Feature Flagged:** `ENABLE_T7B_PUSH` in `wrangler.jsonc` securely gates all push-related API surfaces.

> [!NOTE]
> Web Push operates behind VAPID keys. Ensure `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` are populated in the production Worker's secrets to go live.
"""

if "## T7b. Web Push Notifications" not in content:
    with open(walkthrough_path, "a", encoding="utf-8") as f:
        f.write(new_section)
    print("Walkthrough updated successfully.")
else:
    print("Walkthrough already contains T7b section.")
