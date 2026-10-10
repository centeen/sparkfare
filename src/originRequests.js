// ROADMAP step 50 (lite): "Don't see your airport?" requests. Pure helpers; the route lives in src/index.js.
//
// Demand signal only. A visitor types an airport code or a city; nothing is promised, no email is collected, and
// nothing is sent to them. The request is an `origin_request` event: `origin` holds a three-letter code when that
// is what they typed, `route` holds the normalized text, and `anon_id` holds a one-way hash of the IP address, used
// only to limit repeats.

export const MAX_REQUESTS_PER_IP_PER_DAY = 5;
export const MAX_TEXT_LENGTH = 60;

const ERROR = 'Enter an airport code (like PIT) or a city name.';

// Returns { ok: true, code, label } or { ok: false, error }.
//   code  three letters in upper case, or null when a city name was typed
//   label what requests are grouped by: the code, or the lower-cased city text
export function normalizeAirportRequest(input) {
  const text = String(input ?? '').replace(/\s+/g, ' ').trim();
  if (text.length < 2 || text.length > MAX_TEXT_LENGTH) return { ok: false, error: ERROR };
  // Letters (any language), spaces, hyphen, apostrophe, period and comma only: no digits, no links, no markup.
  if (!/^[\p{L}][\p{L} .,'’-]*$/u.test(text)) return { ok: false, error: ERROR };
  if (/\b(https?|www|com|org|net)\b/i.test(text)) return { ok: false, error: ERROR };
  if (/^[A-Za-z]{3}$/.test(text)) {
    const code = text.toUpperCase();
    return { ok: true, code, label: code };
  }
  const label = text.toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
  if (label.length < 2) return { ok: false, error: ERROR };
  return { ok: true, code: null, label };
}

export function sanitizeRequestSource(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40) || null;
}

export async function hashIp(ip) {
  const bytes = new TextEncoder().encode(`origin-request:${ip || 'unknown'}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Rows are { label, requests, requesters }; returns the same rows, most requested first.
export function rankRequests(rows) {
  return [...(rows || [])].sort((a, b) => (b.requests - a.requests) || (b.requesters - a.requesters) || String(a.label).localeCompare(String(b.label)));
}
