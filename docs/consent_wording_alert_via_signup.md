# Consent wording: homepage "Create alert" through account sign-up (D-081)

Status: PROPOSED, pending the Hub's Guard read (non-attorney) and the owner's approval. The flag `ENABLE_ALERT_VIA_SIGNUP` is `"false"`.

Each version below is the exact text shown beside the "Create alert" button. The version is written to `consent_log.wording_version` (with
`source = 'alert_via_signup'`) when a Clerk-verified person presses the button and is subscribed. `{airport}` is the chosen three-letter code,
or "your home airport" when none is chosen.

## v2_account_signup

```
Free account. At most one fare email a day, with fares from {airport}. Unsubscribe any time.
```

Where it lives in code: `NOTE_PREFIX` and `NOTE_SUFFIX` in `/alert-via-signup.js`; the version name is `WORDING_VERSION` there and
`ALERT_VIA_SIGNUP_WORDING_VERSION` in `src/index.js`. `tests/d081_alert_via_signup.test.js` fails if the line changes without a new version
here and in both constants.

## Notice when the saved airport is lost (not a consent line; nothing is subscribed)

```
Your account is ready, but your alert isn't on yet. Choose your home airport and press Create alert to turn it on.
```
