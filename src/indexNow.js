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

// ---- Which pages may be sent (Hub Guard read, 2026-10-24) -------------------------------------------------------
// An allowlist, not an exclusion list: only canonical public content pages are ever sent. Everything else (account,
// trips, watchlists, sign-in, welcome, admin, departing, home-card and share links, plan or budget parameters, the
// report while ENABLE_REPORTS is off) is simply not on the list. Add a page here on purpose, never by pattern creep.
export const INDEXNOW_SITE = 'https://sparkfare.com';
const EXACT_PAGES = new Set(['/', '/how-it-works', '/check', '/time-off', '/away-mode', '/disclosure', '/privacy', '/blog/', '/data/']);
const PREFIX_PAGES = ['/blog/', '/data/'];

export function isIndexablePath(pathname) {
  if (typeof pathname !== 'string' || !pathname.startsWith('/')) return false;
  if (pathname.includes('?') || pathname.includes('#') || pathname.includes('..')) return false;
  if (EXACT_PAGES.has(pathname)) return true;
  return PREFIX_PAGES.some((p) => pathname.startsWith(p) && pathname.length > p.length && !pathname.endsWith('.json') && !pathname.includes('/_'));
}

// Maps a changed repo file (static page) to its public URL, or null when it is not a public content page.
export function urlForChangedFile(file) {
  const f = String(file || '').replace(/\\/g, '/');
  if (!/\.html$/.test(f)) return null;
  let p = '/' + f.replace(/\.html$/, '');
  if (p === '/index') p = '/';
  else if (p.endsWith('/index')) p = p.slice(0, -'index'.length);
  return isIndexablePath(p) ? INDEXNOW_SITE + p : null;
}

export function indexableUrlsFromFiles(files) {
  return [...new Set((files || []).map(urlForChangedFile).filter(Boolean))].sort();
}
