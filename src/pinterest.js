// Pinterest OAuth + Pin creation, built only for Standard-access review (ROADMAP step 35).
// Exactly one Pinterest account will ever connect -- Sparkfare's own -- so there is no per-user
// token table, just a single row keyed by PINTEREST_TOKEN_ROW_ID.
//
// Verified live against developers.pinterest.com on 2026-10-01, not assumed from the task memo:
// - Authorize: https://www.pinterest.com/oauth/ (client_id, redirect_uri, response_type=code,
//   scope, state). Scopes are comma- or space-separated.
// - Token exchange/refresh: POST https://api.pinterest.com/v5/oauth/token, HTTP Basic auth
//   (username=app id, password=app secret), application/x-www-form-urlencoded body.
// - Apps created on/after 2025-09-25 (this one, approved 2026-10-01) automatically get the
//   "continuous" refresh token (60-day expiry, refreshable indefinitely) -- the memo's
//   `continuous_refresh=true` param is for pre-2025-09-25 apps only and is deliberately omitted
//   here. The connected account must be refreshed at least every 60 days or it silently
//   disconnects; there is no code in this feature that does that on a schedule (see the report).
// - POST /v5/pins body: board_id, media_source: { source_type: 'image_url', url }, title,
//   description, link, alt_text.
// - GET /v5/boards: items have at least { id, name, privacy }.
// - Trial access (CORRECTED 2026-10-04, after a real run): an app with Trial access may NOT create
//   Pins on the production API. api.pinterest.com answers POST /v5/pins with code 29, "Apps with
//   Trial access may not create Pins in production ... use API Sandbox". Per Pinterest's Sandbox and
//   access-tier docs, Pins and Boards created under Trial are Sandbox entities visible only to their
//   creator, a Sandbox token is separate from a production token, and the OAuth token endpoint for
//   Sandbox is https://api-sandbox.pinterest.com/v5/oauth/token. This module therefore supports both
//   environments, chosen by the PINTEREST_ENV Worker var ("sandbox" while on Trial access,
//   "production" once Standard access is granted). The earlier note here claimed Trial calls to
//   production succeed; that was wrong. Switching environments invalidates the stored token:
//   reconnect after changing PINTEREST_ENV.
//
// Deliberately NOT requested: the `user_accounts:read` scope (needed for GET /v5/user_account,
// which would show a human-readable connected username on the status page). The task's own scope
// list is boards:read,boards:write,pins:read,pins:write only -- adding a fifth scope not asked for
// is exactly the kind of scope creep the project's ground rules warn against, so the status page
// shows "connected: yes" + granted scopes + expiry instead of a username. Flagged in the report,
// not decided silently.

export const PINTEREST_API_BASE = 'https://api.pinterest.com/v5';
export const PINTEREST_SANDBOX_API_BASE = 'https://api-sandbox.pinterest.com/v5';

// Base URL for API and OAuth-token calls. Anything other than the exact string "sandbox" is production.
export function pinterestApiBase(env) {
  return env?.PINTEREST_ENV === 'sandbox' ? PINTEREST_SANDBOX_API_BASE : PINTEREST_API_BASE;
}

export function pinterestEnvName(env) {
  return env?.PINTEREST_ENV === 'sandbox' ? 'sandbox' : 'production';
}
export const PINTEREST_OAUTH_AUTHORIZE_URL = 'https://www.pinterest.com/oauth/';
export const PINTEREST_OAUTH_TOKEN_URL = `${PINTEREST_API_BASE}/oauth/token`;
export const PINTEREST_SCOPES = 'boards:read,boards:write,pins:read,pins:write';
export const PINTEREST_TOKEN_ROW_ID = 'default';

// A 5-minute buffer avoids a request racing a token that expires mid-flight.
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

export function generateState() {
  return crypto.randomUUID();
}

// Pure: true only when both values are present, non-empty, and identical -- a missing cookie
// (expired, blocked, or a forged callback hit with no prior /connect visit) must fail closed.
export function verifyState(paramState, cookieState) {
  return Boolean(paramState) && Boolean(cookieState) && paramState === cookieState;
}

export function buildAuthorizeUrl({ appId, redirectUri, state, scopes = PINTEREST_SCOPES }) {
  if (!appId || !redirectUri || !state) {
    throw new Error('buildAuthorizeUrl requires appId, redirectUri, and state');
  }
  const url = new URL(PINTEREST_OAUTH_AUTHORIZE_URL);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scopes);
  url.searchParams.set('state', state);
  return url.toString();
}

// Pure: given a stored expiry and "now", does the access token need a refresh first?
export function needsRefresh(expiresAtIso, now = new Date()) {
  if (!expiresAtIso) return true;
  const expiresAt = new Date(expiresAtIso).getTime();
  if (!Number.isFinite(expiresAt)) return true;
  return expiresAt - now.getTime() <= REFRESH_BUFFER_MS;
}

// Builds the real POST /v5/pins JSON body for an already-fetched deal record, re-checking
// dealQuality itself rather than trusting a caller's `status` field -- the same discipline the
// /flight/:origin/:destination route and the widget deal lookup already apply, since a record's
// stored `status` is computed at ranking-pipeline time, hours before a Pin might actually be
// created. Returns { ok: false, error } for anything that isn't a genuine, current deal; never
// fabricates a price claim and never puts the raw affiliate `booking_link` in the Pin.
export function buildPinPayload(deal, { origin, destination, appUrl, boardId, dealQualityFn, now = new Date() } = {}) {
  if (!deal) {
    return { ok: false, error: `No route record found for ${origin} to ${destination}` };
  }
  if (!boardId) {
    return { ok: false, error: 'board_id is required' };
  }
  if (!appUrl) {
    return { ok: false, error: 'appUrl is required' };
  }

  const obs = deal.observations || (deal.price_history ? deal.price_history.map((p) => ({ price: p, date: now.toISOString() })) : []);
  const dq = dealQualityFn(obs, deal, now);
  if (!dq.eligible || !dq.is_rare_find) {
    return {
      ok: false,
      error: `Deal not currently eligible for a Pin (${origin} to ${destination}): ${dq.reasons && dq.reasons.length ? dq.reasons.join('; ') : 'not a rare find'}`,
    };
  }
  if (!deal.departure_at) {
    return { ok: false, error: 'Deal record has no departure_at -- cannot build a stable permalink/image date' };
  }

  const departureDate = deal.departure_at.slice(0, 10);
  const destPath = encodeURIComponent(destination);
  const imageUrl = `${appUrl}/og/${origin}/${destPath}/${departureDate}`;
  const link = `${appUrl}/deal/${origin}/${destPath}/${departureDate}`;
  const basis = dq.basis_text || deal.basis_text || '';
  const price = Math.round(deal.price);

  const title = `${origin} to ${destination}: $${price} round trip`.slice(0, 100);
  const description = [
    `Sparkfare found this fare ${basis ? `(${basis})` : ''}.`.replace('  ', ' '),
    `Fare data retrieved ${new Date(deal.found_at || now).toISOString().slice(0, 10)}.`,
    'Not sponsored -- ranked purely against this route\'s own 30-day price history.',
  ].join(' ').slice(0, 800);
  const altText = `${origin} to ${destination} flight deal, $${price} round trip, ${basis}`.slice(0, 500);

  return {
    ok: true,
    payload: {
      board_id: boardId,
      media_source: { source_type: 'image_url', url: imageUrl },
      title,
      description,
      link,
      alt_text: altText,
    },
  };
}

export async function exchangeCodeForToken({ appId, appSecret, code, redirectUri, apiBase = PINTEREST_API_BASE }, fetchImpl = fetch) {
  const basicAuth = btoa(`${appId}:${appSecret}`);
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });
  const response = await fetchImpl(`${apiBase}/oauth/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Pinterest token exchange failed (${response.status}): ${JSON.stringify(data)}`);
  }
  return data; // { access_token, refresh_token, expires_in, refresh_token_expires_in, scope, token_type }
}

export async function refreshAccessToken({ appId, appSecret, refreshToken, apiBase = PINTEREST_API_BASE }, fetchImpl = fetch) {
  const basicAuth = btoa(`${appId}:${appSecret}`);
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  const response = await fetchImpl(`${apiBase}/oauth/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Pinterest token refresh failed (${response.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

export async function listBoards({ accessToken, apiBase = PINTEREST_API_BASE }, fetchImpl = fetch) {
  const response = await fetchImpl(`${apiBase}/boards?page_size=100`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Pinterest list boards failed (${response.status}): ${JSON.stringify(data)}`);
  }
  return data; // { items: [{ id, name, privacy, ... }], bookmark }
}

// Sandbox boards are separate from production boards, so a sandbox account starts with none.
export async function createBoard({ accessToken, name, description = '', apiBase = PINTEREST_API_BASE }, fetchImpl = fetch) {
  if (!name || !String(name).trim()) throw new Error('A board name is required');
  const response = await fetchImpl(`${apiBase}/boards`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: String(name).trim(), description }),
  });
  const data = await response.json();
  return { ok: response.ok, status: response.status, data };
}

export async function createPin({ accessToken, payload, apiBase = PINTEREST_API_BASE }, fetchImpl = fetch) {
  const response = await fetchImpl(`${apiBase}/pins`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  return { ok: response.ok, status: response.status, data }; // never swallowed -- caller surfaces data on failure too
}

// --- Token-at-rest encryption (AES-GCM via Web Crypto, keyed by the PINTEREST_TOKEN_ENCRYPTION_KEY
// Worker secret). Nothing else in this codebase encrypts D1 columns at the application level --
// Cloudflare encrypts D1 storage itself, same as every other table here -- but the task memo asks
// for defense in depth specifically for these long-lived tokens, and a new KV namespace would be
// new Cloudflare infrastructure this session can't provision without a real deploy. AES-GCM via
// the Workers-native Web Crypto API needed no new dependency.

// Turns the PINTEREST_TOKEN_ENCRYPTION_KEY secret into 32 raw key bytes. Forgiving about the ways a
// pasted secret commonly gets mangled (surrounding quotes, stray whitespace or a wrapped line,
// URL-safe base64 instead of standard), and when it still can't be used the error says what is
// wrong (length, bad character position, wrong byte count) WITHOUT ever echoing the value.
export function parseEncryptionKey(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    throw new Error('PINTEREST_TOKEN_ENCRYPTION_KEY is not set');
  }
  let v = String(raw).trim();
  if (v.length >= 2 && ((v[0] === '"' && v.at(-1) === '"') || (v[0] === "'" && v.at(-1) === "'"))) v = v.slice(1, -1);
  v = v.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  const bad = v.search(/[^A-Za-z0-9+/]/);
  if (bad !== -1) {
    throw new Error(`PINTEREST_TOKEN_ENCRYPTION_KEY is not valid base64: it has a non-base64 character at position ${bad + 1} of ${v.length} (after trimming quotes and whitespace). Generate a new one with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`);
  }
  if (v.length % 4 === 1) {
    throw new Error(`PINTEREST_TOKEN_ENCRYPTION_KEY is not valid base64: ${v.length} characters is not a possible base64 length`);
  }
  const bytes = Uint8Array.from(atob(v + '='.repeat((4 - (v.length % 4)) % 4)), (c) => c.charCodeAt(0));
  if (bytes.length !== 32) {
    throw new Error(`PINTEREST_TOKEN_ENCRYPTION_KEY decodes to ${bytes.length} bytes; it must be exactly 32 (44 base64 characters ending in "=")`);
  }
  return bytes;
}

async function importAesKey(rawKeyBase64) {
  return crypto.subtle.importKey('raw', parseEncryptionKey(rawKeyBase64), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

function toBase64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function fromBase64(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export async function encryptToken(plaintext, rawKeyBase64) {
  const key = await importAesKey(rawKeyBase64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext));
  return { ciphertext: toBase64(ciphertext), iv: toBase64(iv) };
}

export async function decryptToken({ ciphertext, iv }, rawKeyBase64) {
  const key = await importAesKey(rawKeyBase64);
  const plainBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(iv) },
    key,
    fromBase64(ciphertext)
  );
  return new TextDecoder().decode(plainBuffer);
}
