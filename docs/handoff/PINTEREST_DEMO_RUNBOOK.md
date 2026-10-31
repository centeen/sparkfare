# Pinterest demo video runbook (ROADMAP step 35)

Status: read-only research, 2026-10-31. Written from `src/pinterest.js`, `src/index.js` (lines ~493-620, 1232-1331, 4086-4319), `migrations/0015_pinterest_tokens.sql`, `tests/pinterest.test.js` and `wrangler.jsonc`. Nothing was run against Pinterest. The only network calls made while writing this were GETs to our own public site (`/sparkfare_ranked_deals*.json`, `/og/...`, `/deal/...`, `/admin/pinterest/login`).

**Rules for the recording.** No secret value is typed or shown anywhere. `$ADMIN_SECRET` below means a variable you set off camera. Never run `echo`, `-v`, `--trace` or `Get-ChildItem Env:` on camera. Do not click Aviasales or partner links. Do not email anyone.

## 0. Facts that decide the shape of the video

| Fact | Source |
|---|---|
| `ENABLE_PINTEREST` is `"true"` and `PINTEREST_ENV` is `"sandbox"` in production | `wrangler.jsonc` 151-152 |
| In sandbox, Pins and boards are visible only to the connected account, and a sandbox token is separate from a production token | comment in `src/pinterest.js` 19-28 |
| Pins can only be created in production once Standard access is granted (that is what the video is for) | same comment |
| The admin sign-in cookie lasts **one hour** (`ADMIN_COOKIE_SECONDS = 3600`), scoped to `/admin/pinterest` | `src/index.js` 501 |
| Redirect URI is `https://sparkfare.com/pinterest/callback` (no `APP_URL` var is set, so the default applies). It must be registered in the Pinterest app exactly | `src/index.js` 4110 |
| Not in the repo: what Pinterest's review form requires in the video. Check their form before recording | n/a |

Record in this order: all shots inside one hour of signing in, or sign in again part-way.

## 1. Setup (off camera)

```powershell
# Prompts for the secret without echoing it, keeps it in this session only.
$s = Read-Host -AsSecureString 'Admin secret'
$env:ADMIN_SECRET = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))
Remove-Variable s
```

Use `curl.exe`, not `curl` (PowerShell aliases `curl` to `Invoke-WebRequest`). Clear the variable when done: `Remove-Item Env:ADMIN_SECRET`.

Browser: a fresh window, no extensions visible, signed in to the Pinterest account that will be connected. Zoom the page to 125% so text is legible. Close the tab with the Pinterest developer console (it shows the app secret).

## 2. Pre-flight: pick one deal that passes `dealQuality`

There is no read-only route that lists pinnable deals, so this runs `dealQuality` and `fareStillShowable` (the same two checks `buildPinPayload` makes) on the live data files. It calls only `sparkfare.com`, never Pinterest, and prints only origin, destination and date. Run from the repo root:

```powershell
@'
import { dealQuality } from './src/dealQuality.js';
import { fareStillShowable } from './src/priceFreshness.js';
const base = 'https://sparkfare.com';
const now = new Date();
const pick = [];
for (const f of ['sparkfare_ranked_deals.json', 'sparkfare_ranked_deals_other_origins.json']) {
  const d = await (await fetch(`${base}/${f}`, { cache: 'no-store' })).json();
  for (const r of [...(d.deals || []), ...(d.featured || []), ...(d.priced_no_deal || [])]) {
    const q = dealQuality(r.observations || [], r, now);
    if (q.eligible && q.is_rare_find && r.departure_at && fareStillShowable(r, now.getTime())) pick.push(r);
  }
}
pick.sort((a, b) => a.departure_at.localeCompare(b.departure_at));
const r = pick.find((x) => Date.parse(x.departure_at) - now > 21 * 864e5) || pick[0];
console.log(r ? `origin=${r.origin}\ndestination=${r.display_name}\ndate=${r.departure_at.slice(0, 10)}\n(${pick.length} eligible)` : 'NONE ELIGIBLE - do not record today');
'@ | node --input-type=module -
```

Notes on the choice:
- It prefers a fare departing 21+ days out so the fare stays showable through the recording day (the pin route rejects a fare leaving within 48 hours, last seen over 3 days ago, or no longer a rare find).
- The destination must be typed exactly as printed (it is matched against `display_name`, for example `Sydney, Australia`).
- Run on 2026-10-31: 31 eligible records, first pick `IAD | Sydney, Australia | 2026-11-14` (it will differ on the day).
- Re-check that the share image resolves, still read-only: `curl.exe -s -o NUL -w "%{http_code}" "https://sparkfare.com/og/<ORIGIN>/<URL-encoded destination>/<DATE>"` should print `200` (Pinterest fetches this image, so it must be public). The `/deal/...` permalink should also be 200.
- If it prints `NONE ELIGIBLE`, do not record a Pin shot that day. Do not relax the rule.
- Data refreshes daily around 09:30 UTC. Run the pre-flight immediately before the Pin shot, not the night before.

## 3. Shots

Shot numbers are the order to record. Cut between shots; keep each under a minute.

### Shot 1: the app and what it is for (about 20 s)
Browser: `https://sparkfare.com/` homepage, then `https://sparkfare.com/deal/<ORIGIN>/<DEST>/<DATE>` for the pre-flight pick (the page the Pin will link to). Say: Sparkfare ranks flight fares against each route's own price history; only fares that clear the deal rule are pinned; Pins carry no affiliate link.

### Shot 2: admin sign-in (about 15 s)
Browser: `https://sparkfare.com/admin/pinterest/login`. Click into the field and paste from the password manager (the field is `type=password`, masked). Submit. You land on `/admin/pinterest/status`. This sets the one-hour cookie. Do not paste into the address bar and never use a `?secret=` URL (the code refuses it).

### Shot 3: status before connecting (about 10 s)
Page `/admin/pinterest/status`. Expect "Not connected", "Environment: sandbox", a "Connect Pinterest" link. If it already says Connected, either skip to shot 5 or reconnect (see section 6 for what that does).

### Shot 4: consent screen and callback (about 40 s)
Click **Connect Pinterest** (`GET /admin/pinterest/connect`). Pause on the Pinterest consent screen so every scope line is readable (scopes in section 5). Click **Give access**. You return to `https://sparkfare.com/pinterest/callback?...` which renders the status page: Connected, scopes granted, access token expiry. The URL briefly contains `code` and `state`; the code is single-use but crop or blur the address bar in editing.

### Shot 5: status after connecting (about 10 s)
`/admin/pinterest/status`: Connected, environment, scopes, expiry. Nothing else is shown (section 4).

### Shot 6: list boards (about 15 s)
Click **Choose a board & create a Pin** (`GET /admin/pinterest/boards`). The dropdown lists the account's boards. This is `GET /v5/boards` (needs `boards:read`). A sandbox account starts with none.

### Shot 7: create a board if the list is empty (about 20 s)
Type `Sparkfare flight deals` in "New board name", **Create board** (`POST /admin/pinterest/board`, needs `boards:write`). The page reloads with the board in the list. Skip if a board exists.

### Shot 8: create the Pin (about 40 s)
Fill the form with the pre-flight values: board, origin, destination, **Create Pin** (`POST /admin/pinterest/pin`, needs `pins:write`). The result box shows `ok: true`, Pinterest's response (a Pin id) and `pin_payload`. Point out: title `ORIGIN to DEST: $price round trip`, the basis text ("N% below 30-day median, N observations"), the "Search data retrieved <date>. Seen in search data; price can differ on the booking site." line, `link` is `sparkfare.com/deal/...`, `image_url` is `sparkfare.com/og/...`, and no Aviasales URL anywhere.

Same shot from a terminal (use this instead if the form misbehaves; the cookie is not needed, the Bearer header is):

```powershell
$body = '{"board_id":"<BOARD_ID>","origin":"<ORIGIN>","destination":"<DESTINATION>"}'
curl.exe -s -X POST "https://sparkfare.com/admin/pinterest/pin" -H "Authorization: Bearer $env:ADMIN_SECRET" -H "Content-Type: application/json" -d $body
```

The line on screen shows `$env:ADMIN_SECRET`, not its value. Use `<BOARD_ID>` from the boards dropdown (the option value; the page does not display it, so read it from the Pinterest board URL or the board-create response in shot 7).

Expected failure to show honestly if it happens: a 422 with the real reason (for example "Deal not currently eligible") means the pre-flight was stale; a Pinterest error body is returned as-is.

### Shot 9: the Pin on Pinterest (about 30 s)
Open Pinterest, the connected account, the board, the new Pin. Show the image, title, description and the destination link. In sandbox this is visible only to the connected account, so the Pin must be shown while signed in as that account. Click the Pin's link only if it goes to `sparkfare.com` (it does); do not click anything on Aviasales.

### Shot 10 (optional): ineligible route refused (about 20 s)
Submit a route that is not a current deal (for example one shown as "Building history" on the homepage). Expect HTTP 422 and the reason. This shows the quality gate. The read-only dry run for the PTO pins is `POST /admin/pinterest/pto-pins?dry=1` (builds 15 previews, creates nothing). Do not run it without `?dry=1`: that creates 15 real pins and a board.

## 4. `/admin/pinterest/status` never prints a token or secret: confirmed from code

`pinterestStatusHtml({ connected, scopes, expiresAt, environment })` (`src/index.js` 1239-1258) interpolates only: a Connected/Not connected pill, the environment name (`sandbox` or `production`), the `scopes` string, the `expiresAt` timestamp of the access token, and two fixed links. Its callers pass only those four fields (`getStoredPinterestTokens` returns the decrypted `accessToken` and `refreshToken` too, but the status handler reads only `.scopes` and `.expiresAt`, lines 4160-4167). The callback response (line 4147) and the status handler both go through this same function. Values are HTML-escaped.

Other places that could leak, checked:
- `/admin/pinterest/boards`: prints board id, name and privacy only.
- `/admin/pinterest/pin`: returns Pinterest's Pin response and our `pin_payload`; neither contains a token.
- Callback failure (line 4156) prints `Pinterest connection failed: <message>`, and that message embeds Pinterest's error JSON for a failed token exchange. That is an error body, not a token, but do not show a failure on camera without reading it first.
- `console.error` (line 4155) logs only `error.message`.
- At rest: both tokens are AES-GCM encrypted (`PINTEREST_TOKEN_ENCRYPTION_KEY`); `tests/pinterest.test.js` asserts the stored access token is not plaintext. The admin cookie holds an expiry and an HMAC, never the secret.
- One caveat: `scopes` is the `scope` field from Pinterest's token response, falling back to our requested list if the field is missing. So the page can show the requested scopes even if Pinterest did not echo them.

I did not execute the status page against a connected account (that would need the secrets). The existing test only covers the connect and callback flow; there is no test that asserts the status HTML lacks a token. That is cheap to add if you want a guard (a connected `env` fixture already exists in `connectedEnv()`).

## 5. Scopes on the consent screen

The authorize URL (`buildAuthorizeUrl`, `src/pinterest.js` 66) requests exactly `PINTEREST_SCOPES = 'boards:read,boards:write,pins:write'`, comma-separated, with `response_type=code` and a random `state`.

| Scope | Used by |
|---|---|
| `boards:read` | `GET /v5/boards` (shot 6, and the PTO route's board lookup) |
| `boards:write` | `POST /v5/boards` (shot 7) |
| `pins:write` | `POST /v5/pins` (shot 8) |

`pins:read` was dropped from the list on 2026-10-31 (nothing called a Pins read endpoint). Reconnect once after the change deploys so the stored token and the consent screen show three scopes. `user_accounts:read` is deliberately not requested (the status page therefore cannot show a username).

The consent screen's wording for each scope is Pinterest's, and I did not load it, so I cannot quote it here. Read it off the screen in shot 4.

## 6. Reconnecting: what happens to the stored token, and when `/pin` and `/board` refresh it

Reconnecting (`/admin/pinterest/connect` then the callback) exchanges a new code and calls `storePinterestTokens`, an upsert on the single row `id = 'default'`. It **overwrites** the access token, refresh token, expiry and scopes with the new ones, and sets `updated_at`. It does not touch `connected_at` (the column has a default and the upsert does not set it, so it keeps its first-ever value). There is one row, so there is never a second token; the old tokens are simply replaced. The code does not revoke the old refresh token at Pinterest, and I did not verify whether Pinterest invalidates it when a new one is issued.

Changing `PINTEREST_ENV` invalidates the stored token (sandbox and production tokens are separate): reconnect after changing it.

Does `/pin` or `/board` refresh the token? Not every time. Both call `getValidPinterestAccessToken` (line 599), which only refreshes when the stored access token is within 5 minutes of expiry (`needsRefresh`). Otherwise it reuses the stored access token as-is. When it does refresh, it persists the new access token and expiry immediately, and keeps the old refresh token if Pinterest's response has no new one. It does not store `refresh_token_expires_in`.

So, concretely:
- `/admin/pinterest/status` never refreshes; after the access token expires it still says "Connected" with a past expiry.
- `/boards`, `/board`, `/pin` and `/pto-pins` (non-dry) are the only things that refresh, and only past the 5-minute threshold.
- Nothing refreshes on a schedule. Per the comment in `src/pinterest.js`, a continuous refresh token lasts 60 days and silently disconnects if unused longer. The demo's Pin shot counts as a use, but a quiet account would still lapse without a scheduled refresh.
- If a refresh fails (revoked or expired refresh token) the route returns a 502 with `Pinterest token refresh failed (...)`; the fix is to reconnect.

Practical advice for the recording: connect once, record all shots, and do not reconnect between takes unless needed. A reconnect is harmless but it re-shows the consent screen.

## 7. After recording

```powershell
Remove-Item Env:ADMIN_SECRET
```

Delete the demo Pin and board only from the Pinterest account itself if you want them gone (there is no delete route here). Nothing in this runbook writes to D1 or sends email.

## 8. Open questions for the owner

1. Is a sandbox recording acceptable for the review, or must the video show production? The code cannot create production Pins before Standard access, so a sandbox video is what is possible now. Pinterest's form decides; it is not in the repo.
2. Add a test that the status HTML never contains a token (section 4)?
3. Add a scheduled refresh so the connection does not lapse after 60 idle days (section 6)? Out of scope here.
