import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { dealQuality } from '../src/dealQuality.js';
import {
  generateState, verifyState, buildAuthorizeUrl, needsRefresh, buildPinPayload,
  exchangeCodeForToken, refreshAccessToken, listBoards, createPin,
  encryptToken, decryptToken, PINTEREST_SCOPES,
} from '../src/pinterest.js';

function stubFetch(responseBody, status = 200) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => responseBody,
    };
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

function eligibleObservations(n = 20, basePrice = 800) {
  const now = Date.now();
  return Array.from({ length: n }, (_, i) => ({
    price: basePrice,
    date: new Date(now - (n - i) * 24 * 60 * 60 * 1000).toISOString(),
  }));
}

test('Pinterest: generateState produces distinct, non-empty values', () => {
  const a = generateState();
  const b = generateState();
  assert.ok(a && typeof a === 'string');
  assert.notEqual(a, b);
});

test('Pinterest: verifyState rejects missing/mismatched state, accepts an exact match', () => {
  assert.equal(verifyState('abc', 'abc'), true);
  assert.equal(verifyState('abc', 'def'), false);
  assert.equal(verifyState('abc', undefined), false);
  assert.equal(verifyState(undefined, 'abc'), false);
  assert.equal(verifyState('', ''), false);
});

test('Pinterest: buildAuthorizeUrl includes all required OAuth params', () => {
  const url = buildAuthorizeUrl({ appId: 'app123', redirectUri: 'https://sparkfare.com/pinterest/callback', state: 'xyz' });
  const parsed = new URL(url);
  assert.equal(parsed.origin + parsed.pathname, 'https://www.pinterest.com/oauth/');
  assert.equal(parsed.searchParams.get('client_id'), 'app123');
  assert.equal(parsed.searchParams.get('redirect_uri'), 'https://sparkfare.com/pinterest/callback');
  assert.equal(parsed.searchParams.get('response_type'), 'code');
  assert.equal(parsed.searchParams.get('scope'), PINTEREST_SCOPES);
  assert.equal(parsed.searchParams.get('state'), 'xyz');
});

test('Pinterest: buildAuthorizeUrl throws without required fields', () => {
  assert.throws(() => buildAuthorizeUrl({ appId: 'a', redirectUri: 'b' }));
});

test('Pinterest: needsRefresh -- expiry logic', () => {
  const now = new Date('2026-10-01T12:00:00Z');
  assert.equal(needsRefresh(null, now), true, 'no stored expiry at all');
  assert.equal(needsRefresh('2026-10-01T12:03:00Z', now), true, 'inside the 5-minute buffer');
  assert.equal(needsRefresh('2026-10-01T13:00:00Z', now), false, 'well past the buffer, not yet expired');
  assert.equal(needsRefresh('2026-10-01T11:00:00Z', now), true, 'already expired');
});

test('Pinterest: buildPinPayload accepts a real eligible deal and never leaks the raw affiliate link', () => {
  const deal = {
    origin: 'JFK',
    display_name: 'Larnaca, Cyprus',
    price: 547,
    booking_link: 'https://www.aviasales.com/search/JFK2711LCA11121?marker=314524',
    departure_at: '2026-11-27T22:35:00-05:00',
    found_at: new Date().toISOString(),
    observations: eligibleObservations(20, 800).map((o, i) => (i === 19 ? { ...o, price: 547 } : o)),
  };
  const result = buildPinPayload(deal, {
    origin: 'JFK',
    destination: 'Larnaca, Cyprus',
    appUrl: 'https://sparkfare.com',
    boardId: 'board1',
    dealQualityFn: dealQuality,
  });
  assert.equal(result.ok, true);
  assert.equal(result.payload.board_id, 'board1');
  assert.equal(result.payload.media_source.source_type, 'image_url');
  assert.equal(result.payload.media_source.url, 'https://sparkfare.com/og/JFK/Larnaca%2C%20Cyprus/2026-11-27');
  assert.equal(result.payload.link, 'https://sparkfare.com/deal/JFK/Larnaca%2C%20Cyprus/2026-11-27');
  assert.ok(!JSON.stringify(result.payload).includes('aviasales.com'), 'the raw affiliate link must never appear in the Pin');
  assert.ok(result.payload.title.includes('547'));
});

test('Pinterest: buildPinPayload rejects a route with no record at all', () => {
  const result = buildPinPayload(null, { origin: 'JFK', destination: 'Nowhere', appUrl: 'https://sparkfare.com', boardId: 'b', dealQualityFn: dealQuality });
  assert.equal(result.ok, false);
  assert.match(result.error, /No route record found/);
});

test('Pinterest: buildPinPayload rejects a deal with insufficient history (not dealQuality-eligible)', () => {
  const deal = {
    origin: 'JFK', display_name: 'Thin Route', price: 500,
    departure_at: '2026-12-01T00:00:00Z', found_at: new Date().toISOString(),
    observations: eligibleObservations(3, 500), // well under MIN_HISTORY_POINTS (10)
  };
  const result = buildPinPayload(deal, { origin: 'JFK', destination: 'Thin Route', appUrl: 'https://sparkfare.com', boardId: 'b', dealQualityFn: dealQuality });
  assert.equal(result.ok, false);
  assert.match(result.error, /not currently eligible/);
});

test('Pinterest: buildPinPayload rejects a priced-but-not-a-deal route (eligible history, price not a rare find)', () => {
  // Oscillating (not perfectly flat -- a zero-variance series makes "price <= median" trivially
  // true, which is a dealQuality edge case, not a useful test of this rejection path) price
  // history with a real, fresh, plenty-of-observations route whose current price sits exactly at
  // the median -- nowhere near 2 MADs below it -- so dealQuality.is_rare_find stays false. Must
  // still be rejected, not pinned as if it were a genuine deal.
  const now = Date.now();
  const observations = Array.from({ length: 20 }, (_, i) => ({
    price: i % 2 === 0 ? 790 : 810,
    date: new Date(now - (20 - i) * 24 * 60 * 60 * 1000).toISOString(),
  }));
  const deal = {
    origin: 'JFK', display_name: 'Flat Route', price: 800,
    departure_at: '2026-12-01T00:00:00Z', found_at: new Date().toISOString(),
    observations,
  };
  const result = buildPinPayload(deal, { origin: 'JFK', destination: 'Flat Route', appUrl: 'https://sparkfare.com', boardId: 'b', dealQualityFn: dealQuality });
  assert.equal(result.ok, false);
});

test('Pinterest: buildPinPayload rejects when board_id or appUrl is missing', () => {
  const deal = { origin: 'JFK', display_name: 'X', price: 500, departure_at: '2026-12-01T00:00:00Z', found_at: new Date().toISOString(), observations: eligibleObservations(20, 500) };
  assert.equal(buildPinPayload(deal, { origin: 'JFK', destination: 'X', appUrl: 'https://sparkfare.com', dealQualityFn: dealQuality }).ok, false);
  assert.equal(buildPinPayload(deal, { origin: 'JFK', destination: 'X', boardId: 'b', dealQualityFn: dealQuality }).ok, false);
});

test('Pinterest: encryptToken/decryptToken round-trip, and ciphertext never contains the plaintext', async () => {
  const key = 'xeW7Lw8wQKq3n1m2p3q4r5s6t7u8v9w0'.slice(0, 32); // 32-byte-ish raw passphrase stand-in
  const keyB64 = Buffer.from(key).toString('base64');
  const plaintext = 'pina_super_secret_token_value';
  const enc = await encryptToken(plaintext, keyB64);
  assert.ok(!enc.ciphertext.includes(plaintext));
  const decrypted = await decryptToken(enc, keyB64);
  assert.equal(decrypted, plaintext);
});

test('Pinterest: exchangeCodeForToken sends Basic auth and the right grant_type, surfaces API errors', async () => {
  const stub = stubFetch({ access_token: 'at', refresh_token: 'rt', expires_in: 2592000, scope: PINTEREST_SCOPES });
  try {
    const data = await exchangeCodeForToken({ appId: 'app', appSecret: 'secret', code: 'authcode', redirectUri: 'https://sparkfare.com/pinterest/callback' });
    assert.equal(data.access_token, 'at');
    const call = stub.calls[0];
    assert.equal(call.url, 'https://api.pinterest.com/v5/oauth/token');
    assert.equal(call.init.headers.Authorization, `Basic ${Buffer.from('app:secret').toString('base64')}`);
    assert.match(call.init.body, /grant_type=authorization_code/);
    assert.match(call.init.body, /code=authcode/);
  } finally {
    stub.restore();
  }

  const failing = stubFetch({ error: 'invalid_grant' }, 400);
  try {
    await assert.rejects(
      () => exchangeCodeForToken({ appId: 'app', appSecret: 'secret', code: 'bad', redirectUri: 'https://sparkfare.com/pinterest/callback' }),
      /Pinterest token exchange failed \(400\)/
    );
  } finally {
    failing.restore();
  }
});

test('Pinterest: refreshAccessToken sends grant_type=refresh_token', async () => {
  const stub = stubFetch({ access_token: 'new_at', expires_in: 2592000 });
  try {
    await refreshAccessToken({ appId: 'app', appSecret: 'secret', refreshToken: 'pinr_refresh' });
    assert.match(stub.calls[0].init.body, /grant_type=refresh_token/);
    assert.match(stub.calls[0].init.body, /refresh_token=pinr_refresh/);
  } finally {
    stub.restore();
  }
});

test('Pinterest: listBoards and createPin call the real production API, never the sandbox domain', async () => {
  const boardsStub = stubFetch({ items: [{ id: '123', name: 'Deals', privacy: 'PUBLIC' }] });
  try {
    const boards = await listBoards({ accessToken: 'at' });
    assert.equal(boards.items[0].id, '123');
    assert.match(boardsStub.calls[0].url, /^https:\/\/api\.pinterest\.com\/v5\/boards/);
  } finally {
    boardsStub.restore();
  }

  const pinStub = stubFetch({ id: 'pin_1' });
  try {
    const result = await createPin({ accessToken: 'at', payload: { board_id: '123' } });
    assert.equal(result.ok, true);
    assert.equal(pinStub.calls[0].url, 'https://api.pinterest.com/v5/pins');
    assert.doesNotMatch(pinStub.calls[0].url, /sandbox/);
  } finally {
    pinStub.restore();
  }
});

test('Pinterest: createPin never swallows a Trial-access (or any) API error -- returns the real body', async () => {
  const stub = stubFetch({ code: 7, message: 'This endpoint is restricted for your access level.' }, 403);
  try {
    const result = await createPin({ accessToken: 'at', payload: {} });
    assert.equal(result.ok, false);
    assert.equal(result.status, 403);
    assert.match(result.data.message, /restricted/);
  } finally {
    stub.restore();
  }
});

test('Pinterest: every route 404s when ENABLE_PINTEREST is off', async () => {
  const env = { ENABLE_PINTEREST: 'false', ADMIN_SECRET: 'shh' };
  const ctx = { waitUntil: () => {} };
  const paths = [
    'https://sparkfare.com/admin/pinterest/connect?secret=shh',
    'https://sparkfare.com/pinterest/callback?code=x&state=y',
    'https://sparkfare.com/admin/pinterest/status?secret=shh',
    'https://sparkfare.com/admin/pinterest/boards?secret=shh',
  ];
  for (const path of paths) {
    const res = await worker.fetch(new Request(path), env, ctx);
    assert.equal(res.status, 404, path);
  }
  const pinRes = await worker.fetch(new Request('https://sparkfare.com/admin/pinterest/pin?secret=shh', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  }), env, ctx);
  assert.equal(pinRes.status, 404);
});

test('Pinterest: admin routes reject a request with no/wrong secret even when the flag is on', async () => {
  const env = { ENABLE_PINTEREST: 'true', ADMIN_SECRET: 'shh' };
  const ctx = { waitUntil: () => {} };
  const res1 = await worker.fetch(new Request('https://sparkfare.com/admin/pinterest/connect'), env, ctx);
  assert.equal(res1.status, 401);
  const res2 = await worker.fetch(new Request('https://sparkfare.com/admin/pinterest/connect?secret=wrong'), env, ctx);
  assert.equal(res2.status, 401);
});

test('Pinterest: /admin/pinterest/connect redirects to Pinterest with a state cookie, when the flag is on and authorized', async () => {
  const env = { ENABLE_PINTEREST: 'true', ADMIN_SECRET: 'shh', PINTEREST_APP_ID: 'app123', APP_URL: 'https://sparkfare.com' };
  const ctx = { waitUntil: () => {} };
  const res = await worker.fetch(new Request('https://sparkfare.com/admin/pinterest/connect?secret=shh'), env, ctx);
  assert.equal(res.status, 302);
  const location = res.headers.get('Location');
  assert.match(location, /^https:\/\/www\.pinterest\.com\/oauth\//);
  assert.match(location, /client_id=app123/);
  assert.match(location, /redirect_uri=https%3A%2F%2Fsparkfare.com%2Fpinterest%2Fcallback/);
  const cookie = res.headers.get('Set-Cookie');
  assert.match(cookie, /pinterest_oauth_state=/);
  assert.match(cookie, /HttpOnly/);
});

test('Pinterest: /pinterest/callback rejects a state that does not match the cookie', async () => {
  const env = { ENABLE_PINTEREST: 'true', APP_URL: 'https://sparkfare.com' };
  const ctx = { waitUntil: () => {} };
  const res = await worker.fetch(new Request('https://sparkfare.com/pinterest/callback?code=abc&state=mismatch', {
    headers: { Cookie: 'pinterest_oauth_state=different' },
  }), env, ctx);
  assert.equal(res.status, 400);
});

test('Pinterest: full connect -> callback -> boards -> pin flow end to end, with every Pinterest/D1 call mocked', async () => {
  const stored = {};
  const env = {
    ENABLE_PINTEREST: 'true',
    ADMIN_SECRET: 'shh',
    APP_URL: 'https://sparkfare.com',
    PINTEREST_APP_ID: 'app123',
    PINTEREST_APP_SECRET: 'secret456',
    PINTEREST_TOKEN_ENCRYPTION_KEY: Buffer.from('0123456789abcdef0123456789abcdef').toString('base64').slice(0, 44),
    DB: {
      prepare: (sql) => ({
        bind: (...args) => ({
          first: async () => (sql.includes('SELECT * FROM pinterest_tokens') ? stored.row || null : null),
          run: async () => {
            if (sql.includes('INSERT INTO pinterest_tokens')) {
              const [id, accessCt, accessIv, refreshCt, refreshIv, expiresAt, scopes] = args;
              stored.row = { id, access_token_ciphertext: accessCt, access_token_iv: accessIv, refresh_token_ciphertext: refreshCt, refresh_token_iv: refreshIv, expires_at: expiresAt, scopes };
            }
            return { success: true };
          },
        }),
      }),
    },
    ASSETS: {
      fetch: async () => ({
        ok: true,
        json: async () => ({
          deals: [{
            origin: 'JFK', display_name: 'Larnaca, Cyprus', price: 547,
            booking_link: 'https://www.aviasales.com/search/x?marker=1',
            departure_at: '2026-11-27T22:35:00-05:00', found_at: new Date().toISOString(),
            observations: eligibleObservations(20, 800).map((o, i) => (i === 19 ? { ...o, price: 547 } : o)),
          }],
        }),
      }),
    },
  };
  const ctx = { waitUntil: () => {} };

  // 1. Connect: get the redirect + state cookie.
  const connectRes = await worker.fetch(new Request('https://sparkfare.com/admin/pinterest/connect?secret=shh'), env, ctx);
  assert.equal(connectRes.status, 302);
  const stateCookie = connectRes.headers.get('Set-Cookie').match(/pinterest_oauth_state=([^;]+)/)[1];

  // 2. Callback: mock Pinterest's token endpoint, confirm the token gets stored (encrypted).
  const tokenStub = stubFetch({ access_token: 'at_1', refresh_token: 'pinr_1', expires_in: 2592000, scope: PINTEREST_SCOPES });
  let callbackRes;
  try {
    callbackRes = await worker.fetch(new Request(`https://sparkfare.com/pinterest/callback?code=authcode&state=${stateCookie}`, {
      headers: { Cookie: `pinterest_oauth_state=${stateCookie}` },
    }), env, ctx);
  } finally {
    tokenStub.restore();
  }
  assert.equal(callbackRes.status, 200);
  assert.ok(stored.row, 'token row should be persisted');
  assert.ok(!stored.row.access_token_ciphertext.includes('at_1'), 'the access token must not be stored in plaintext');

  // 3. Boards: mock GET /v5/boards.
  const boardsStub = stubFetch({ items: [{ id: 'board_1', name: 'Flight Deals', privacy: 'PUBLIC' }] });
  let boardsRes;
  try {
    boardsRes = await worker.fetch(new Request('https://sparkfare.com/admin/pinterest/boards?secret=shh'), env, ctx);
  } finally {
    boardsStub.restore();
  }
  assert.equal(boardsRes.status, 200);
  const boardsHtml = await boardsRes.text();
  assert.match(boardsHtml, /Flight Deals/);
  assert.match(boardsStub.calls[0].init.headers.Authorization, /Bearer at_1/);

  // 4. Pin: mock POST /v5/pins, confirm the real eligible deal gets pinned with no affiliate link.
  const pinStub = stubFetch({ id: 'real_pin_id' });
  let pinRes;
  try {
    pinRes = await worker.fetch(new Request('https://sparkfare.com/admin/pinterest/pin?secret=shh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ board_id: 'board_1', origin: 'JFK', destination: 'Larnaca, Cyprus' }),
    }), env, ctx);
  } finally {
    pinStub.restore();
  }
  assert.equal(pinRes.status, 200);
  const pinJson = await pinRes.json();
  assert.equal(pinJson.ok, true);
  assert.equal(pinJson.pinterest_response.id, 'real_pin_id');
  assert.doesNotMatch(JSON.stringify(pinJson.pin_payload), /aviasales/);
  assert.match(pinStub.calls[0].url, /^https:\/\/api\.pinterest\.com\/v5\/pins$/);
});

// Admin-page hardening: board names come from Pinterest and the secret from the query string, so
// neither may be able to inject markup/script into the boards page; and no page may show the
// literal placeholder link that used to render when the admin secret wasn't in scope.
async function connectedEnv() {
  const key = Buffer.from('0123456789abcdef0123456789abcdef').toString('base64').slice(0, 44);
  const acc = await encryptToken('at_x', key);
  const ref = await encryptToken('pinr_x', key);
  const row = {
    access_token_ciphertext: acc.ciphertext, access_token_iv: acc.iv,
    refresh_token_ciphertext: ref.ciphertext, refresh_token_iv: ref.iv,
    expires_at: new Date(Date.now() + 3600 * 1000).toISOString(), scopes: PINTEREST_SCOPES, connected_at: 'now',
  };
  return {
    ENABLE_PINTEREST: 'true', ADMIN_SECRET: 'shh', PINTEREST_TOKEN_ENCRYPTION_KEY: key,
    DB: { prepare: () => ({ bind: () => ({ first: async () => row, run: async () => ({}) }) }) },
  };
}

test('Pinterest: boards page escapes board names/ids and a hostile secret', async () => {
  const env = await connectedEnv();
  env.ADMIN_SECRET = 'a</script><img src=x onerror=alert(1)>';
  const stub = stubFetch({ items: [{ id: '1"><script>alert(1)</script>', name: '<img src=x onerror=alert(1)>', privacy: 'PUBLIC' }] });
  let html;
  try {
    const res = await worker.fetch(new Request('https://sparkfare.com/admin/pinterest/boards', {
      headers: { Authorization: `Bearer ${env.ADMIN_SECRET}` },
    }), env, { waitUntil: () => {} });
    assert.equal(res.status, 200);
    html = await res.text();
  } finally { stub.restore(); }
  assert.ok(!html.includes('<img src=x'), 'board name must be HTML-escaped');
  assert.ok(!html.includes('<script>alert(1)'), 'board id must be HTML-escaped');
  assert.match(html, /&lt;img src=x/);
});

test('Pinterest: the secret is embedded as an escaped JS string, not raw, on the boards page', async () => {
  const env = await connectedEnv();
  env.ADMIN_SECRET = 'x</script><b>';
  const stub = stubFetch({ items: [] });
  let html;
  try {
    const res = await worker.fetch(new Request(`https://sparkfare.com/admin/pinterest/boards?secret=${encodeURIComponent(env.ADMIN_SECRET)}`), env, { waitUntil: () => {} });
    html = await res.text();
  } finally { stub.restore(); }
  assert.ok(!html.includes('x</script><b>'), 'a secret containing </script> must not appear raw');
  assert.ok(html.includes('encodeURIComponent("x' + String.fromCharCode(92) + 'u003c/script>'), 'secret should be a JSON string with < escaped');
});

test('Pinterest: status page links carry the real secret (encoded) and never a placeholder', async () => {
  const env = await connectedEnv();
  env.ADMIN_SECRET = 's&p ace';
  const res = await worker.fetch(new Request(`https://sparkfare.com/admin/pinterest/status?secret=${encodeURIComponent(env.ADMIN_SECRET)}`), env, { waitUntil: () => {} });
  const html = await res.text();
  assert.ok(!html.includes('YOUR_ADMIN_SECRET'));
  assert.match(html, /href="\/admin\/pinterest\/boards\?secret=s%26p%20ace"/);
});

test('Pinterest: the post-OAuth status page (no secret in scope) has no dead placeholder link', async () => {
  const env = await connectedEnv();
  const code = 'authcode';
  const stub = stubFetch({ access_token: 'at_1', refresh_token: 'pinr_1', expires_in: 3600, scope: PINTEREST_SCOPES });
  let html;
  try {
    const res = await worker.fetch(new Request(`https://sparkfare.com/pinterest/callback?code=${code}&state=st`, {
      headers: { Cookie: 'pinterest_oauth_state=st' },
    }), env, { waitUntil: () => {} });
    assert.equal(res.status, 200);
    html = await res.text();
  } finally { stub.restore(); }
  assert.ok(!html.includes('YOUR_ADMIN_SECRET'));
  assert.match(html, /\/admin\/pinterest\/status\?secret=/);
});
