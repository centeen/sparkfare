// Events for the leave-by plan (Addendum G, task G6). Every event has a FIXED shape built from a short list of tokens and small numbers.
// Nothing here ever carries a travel date, a passport detail, an email address or anything a visitor typed: a field that is not in the
// shape for its event is dropped, and a value that is not on its list becomes null (or the event is refused).
import { COUNTRY_NAMES, LEAVE_BY_RULES } from './data/leaveByRules.js';

export const PLAN_SOURCE = 'away-plan';
export const TRIP_BUCKETS = ['weekend', '4-6', '7-10', '11-14', '2+ weeks', '30_plus'];
export const PLAN_ENTRY_SOURCES = ['nav', 'home', 'away-mode', 'route', 'other'];
export const TASK_COUNT_BUCKETS = ['1-3', '4-9', '10+'];

// What the browser may send to POST /api/events while ENABLE_LEAVE_BY_PLAN is on.
export const CLIENT_PLAN_EVENTS = ['plan_start', 'plan_complete', 'item_done', 'away_mode_view'];
// Logged only by the Worker, when those features exist (reminders: G7, the Home card: G9). A browser can never send them.
export const SERVER_PLAN_EVENTS = ['reminder_optin', 'homecard_created', 'homecard_open'];

const RULE_IDS = new Set(LEAVE_BY_RULES.map((r) => r.id));

const bucketOrNull = (v) => (TRIP_BUCKETS.includes(v) ? v : null);
const countryOrNull = (v) => (typeof v === 'string' && Object.prototype.hasOwnProperty.call(COUNTRY_NAMES, v) ? v : null);

// Returns the meta to store, or null when the event must not be logged. `m` is whatever the caller sent; it is never copied as is.
export function planEventMeta(type, m) {
  const x = m && typeof m === 'object' ? m : {};
  switch (type) {
    case 'plan_start': // a visit to /plan and the entry point it came from
      return { src: PLAN_ENTRY_SOURCES.includes(x.src) ? x.src : 'other' };
    case 'plan_complete': {
      const country = countryOrNull(x.country);
      if (!country) return null;
      const n = Number(x.items_shown);
      return { country, trip_length_bucket: bucketOrNull(x.trip_length_bucket), items_shown: Number.isInteger(n) ? Math.min(60, Math.max(0, n)) : null };
    }
    case 'item_done': {
      const country = countryOrNull(x.country);
      if (!country || !RULE_IDS.has(x.rule_id)) return null;
      return { rule_id: x.rule_id, country, trip_length_bucket: bucketOrNull(x.trip_length_bucket) };
    }
    case 'away_mode_view': // a visit to /away-mode, counted so partner clicks can be compared per 100 views
      return {};
    case 'reminder_optin':
      return { trip_length_bucket: bucketOrNull(x.trip_length_bucket) };
    case 'homecard_created':
      return { tasks_bucket: TASK_COUNT_BUCKETS.includes(x.tasks_bucket) ? x.tasks_bucket : null };
    case 'homecard_open': // a count only: no token, no address, nothing about the card
      return {};
    default:
      return null;
  }
}

// Plan clicks arrive on /out/<partner>?src=away-plan&rule=<id>&bucket=<bucket>. Only a known rule id and a known bucket are kept.
export function planClickMeta(searchParams) {
  if (searchParams.get('src') !== PLAN_SOURCE) return {};
  const rule = searchParams.get('rule');
  const bucket = searchParams.get('bucket');
  return { rule_id: RULE_IDS.has(rule) ? rule : null, trip_length_bucket: bucketOrNull(bucket) };
}
