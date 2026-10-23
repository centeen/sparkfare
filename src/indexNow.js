// src/indexNow.js
// Package M6 (ROADMAP step 146): IndexNow protocol integration.
// Used to ping search engines (Bing, Yandex, IndexNow participants) on publish of new or changed pages.

export const INDEXNOW_KEY = 'c07b7b13e9a149c5950d24490f058097';
export const INDEXNOW_KEY_FILE = `${INDEXNOW_KEY}.txt`;
export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

/**
 * Builds the standard JSON payload for an IndexNow request.
 */
export function buildIndexNowPayload({
  urls = [],
  host = 'sparkfare.com',
  key = INDEXNOW_KEY,
  keyLocation = `https://${host}/${INDEXNOW_KEY_FILE}`,
} = {}) {
  const urlList = Array.isArray(urls) ? urls : [urls];
  return {
    host,
    key,
    keyLocation,
    urlList,
  };
}

/**
 * Submits changed URLs to the IndexNow API.
 * Returns an object with { ok, status, message }.
 */
export async function pingIndexNow({
  urls = [],
  host = 'sparkfare.com',
  key = INDEXNOW_KEY,
  keyLocation = `https://${host}/${INDEXNOW_KEY_FILE}`,
  endpoint = INDEXNOW_ENDPOINT,
  fetchFn = fetch,
} = {}) {
  const payload = buildIndexNowPayload({ urls, host, key, keyLocation });
  if (payload.urlList.length === 0) {
    return { ok: false, status: 400, message: 'No URLs provided to ping' };
  }

  try {
    const res = await fetchFn(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'User-Agent': 'Sparkfare-IndexNow-Notifier/1.0',
      },
      body: JSON.stringify(payload),
    });

    // IndexNow returns 200 (OK), 202 (Accepted), or error status
    const ok = res.status === 200 || res.status === 202;
    return {
      ok,
      status: res.status,
      message: ok ? 'Submitted successfully' : `IndexNow returned status ${res.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      message: `Failed to ping IndexNow: ${err.message}`,
    };
  }
}
