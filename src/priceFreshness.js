// Addendum J, J1 display (A1 to A3, A6; owner decisions D-021, D-030): what a fare's age, source and departure date allow a page to say.
// The same rules are written inline in index.html (priceFreshness and friends); tests/j1_display.test.js runs both and checks they agree.
//
//  - gone:    the outbound flight has left or leaves within DEPARTURE_BUFFER_HOURS. Not shown as a fare at all.
//  - lapsed:  last seen more than LAPSE_DAYS calendar days ago. "Last seen <date>", never a deal, never a hero, no fare link.
//  - carried: the pipeline kept yesterday's price (is_stale_fallback). "Last seen ...", never "checked".
//  - current: a fresh fetch within PRICE_FRESH_HOURS. "Search data retrieved N h ago".
//  - aging:   a fresh-looking record older than PRICE_FRESH_HOURS. "Search data retrieved ...".
export const PRICE_FRESH_HOURS = 48;
export const DEPARTURE_BUFFER_HOURS = 48;
export const LAPSE_DAYS = 3;

const DAY = 86400000;
const ms = (v) => { const t = v ? Date.parse(v) : NaN; return Number.isNaN(t) ? null : t; };

export function departsTooSoon(item, nowMs = Date.now()) {
  const t = ms(item && item.departure_at);
  return t !== null && t < nowMs + DEPARTURE_BUFFER_HOURS * 3600000;
}

// UTC midnight of the day the price was last seen: last_fresh_date for a carried-forward record, otherwise the day of found_at.
export function lastSeenDayMs(item) {
  if (!item) return null;
  const d = item.last_fresh_date;
  if (item.is_stale_fallback && typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return Date.parse(d + 'T00:00:00Z');
  const t = ms(item.found_at);
  if (t !== null) return Math.floor(t / DAY) * DAY;
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return Date.parse(d + 'T00:00:00Z');
  return null;
}

export function isLapsed(item, nowMs = Date.now()) {
  const day = lastSeenDayMs(item);
  if (day === null) return false;
  return Math.floor(nowMs / DAY) - Math.floor(day / DAY) > LAPSE_DAYS;
}

// Whether a fare may still be shown or sent as a fare at all: not departing within the buffer, not last seen more than LAPSE_DAYS ago.
// Everything that prints a fare outside the homepage and route pages (digest, newsletter, share cards, pins) checks this at send or
// render time, so a pipeline that misses a day or two cannot put a fare that has gone, or an old one, in front of someone.
export function fareStillShowable(item, nowMs = Date.now()) {
  const state = freshnessState(item, nowMs);
  return state !== 'gone' && state !== 'lapsed';
}

export function freshnessState(item, nowMs = Date.now()) {
  if (!item) return 'aging';
  if (departsTooSoon(item, nowMs)) return 'gone';
  if (isLapsed(item, nowMs)) return 'lapsed';
  if (item.is_stale_fallback) return 'carried';
  const t = ms(item.found_at);
  if (t === null) return 'aging';
  return (nowMs - t) / 3600000 <= PRICE_FRESH_HOURS ? 'current' : 'aging';
}

export function relativeAge(foundMs, nowMs) {
  const h = Math.max(0, (nowMs - foundMs) / 3600000);
  if (h < 1) return 'under 1 h ago';
  if (h < 48) return Math.floor(h) + ' h ago';
  return Math.floor(h / 24) + ' days ago';
}

function when(item, timeZone, markup) {
  const t = ms(item && item.found_at);
  if (t !== null) {
    const text = new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short', timeZone });
    // markup: wrap the time so /as-of-local.js can show it in the visitor's own zone (the text stays as the no-JavaScript fallback).
    return markup ? '<span data-asof="' + new Date(t).toISOString() + '">' + text + '</span>' : text;
  }
  const day = lastSeenDayMs(item);
  return day === null ? '' : new Date(day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
function dateOnly(item) {
  const day = lastSeenDayMs(item);
  return day === null ? '' : new Date(day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

// The one-line note under a price. A server has no viewer zone, so route pages pass 'UTC' and the zone name is printed.
export function fareNote(item, nowMs = Date.now(), timeZone = 'UTC', markup = false) {
  const state = freshnessState(item, nowMs);
  if (state === 'gone') return '';
  if (state === 'lapsed') return 'Last seen ' + dateOnly(item) + '.';
  const w = when(item, timeZone, markup);
  if (!w) return '';
  if (state === 'carried') return 'Last seen ' + w + '. No newer price today, so this one is carried forward.';
  const t = ms(item.found_at);
  // No found_at: there is no time to show a zone for and no age to count. Say only the day it was last seen.
  if (t === null) { const d = dateOnly(item); return d ? 'Last seen ' + d + '.' : ''; }
  if (state === 'current') return 'Search data retrieved ' + relativeAge(t, nowMs) + ' · ' + w;
  return 'Search data retrieved ' + w + ' · ' + relativeAge(t, nowMs);
}
