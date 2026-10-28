// C1.2 / C1.3 (G112): the trip stream v2. A fare click sends only the checklist email, which asks "Got your ticket?".
// Only a Yes (trips.booking_self_report = 'booked') starts the stream: 21, 7 and 1 days before departure (30, 14 and 7
// for '2+ weeks' and '30_plus'), then a return-day note. Flag ENABLE_TRIP_STREAM_V2 (needs ENABLE_TRIP_SELF_REPORT).
import TRIP_COPY from '../content/emails/trip_stream.json' with { type: 'json' };
import { tripSelfReportEnabled } from './tripSelfReport.js';
import { TRIP_TAP_ANSWERS } from './postClickEmail.js';

// The stored answer keys, in tap order: the first is a Yes.
const [YES, STILL_DECIDING, NOT_GOING] = TRIP_TAP_ANSWERS;

export const tripStreamV2Enabled = (env) => env?.ENABLE_TRIP_STREAM_V2 === 'true' && tripSelfReportEnabled(env);

export const V2_ANSWER_LABELS = { [YES]: TRIP_COPY.got_your_ticket.yes, [STILL_DECIDING]: TRIP_COPY.got_your_ticket.still_deciding, [NOT_GOING]: TRIP_COPY.got_your_ticket.not_going };
export const answerLabels = (env, fallback) => (tripStreamV2Enabled(env) ? V2_ANSWER_LABELS : fallback);

export const SHORT_OFFSETS = [21, 7, 1];
export const LONG_OFFSETS = [30, 14, 7];
export const LONG_TRIP_LENGTHS = ['2+ weeks', '30_plus'];
export const offsetsFor = (tripLength) => (LONG_TRIP_LENGTHS.includes(tripLength) ? LONG_OFFSETS : SHORT_OFFSETS);

const dayNumber = (iso) => {
  const d = String(iso || '').slice(0, 10);
  const t = Date.parse(d + 'T00:00:00Z');
  return Number.isNaN(t) ? null : Math.round(t / 86400000);
};

/** Which stage (if any) is due today for a trip. `today` is a YYYY-MM-DD string. Pure. */
export function stageDueToday({ departure_at, return_at, trip_length }, today) {
  const t = dayNumber(today);
  if (t === null) return null;
  const dep = dayNumber(departure_at);
  if (dep !== null) {
    const pos = offsetsFor(trip_length).indexOf(dep - t);
    if (pos >= 0) return { stage: 'd' + (dep - t), position: pos, daysUntil: dep - t };
  }
  const ret = dayNumber(return_at);
  if (ret !== null && ret === t) return { stage: 'return', position: null, daysUntil: null };
  return null;
}

const fill = (s, vars) => String(s).replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));

/** Subject, body and partner slugs for a stage. Pure. */
export function stageCopy(due, { destination, departureDate }) {
  const vars = { Destination: destination, n: due.daysUntil, date: departureDate || '' };
  if (due.stage === 'return') return { subject: fill(TRIP_COPY.return.subject, vars), body: fill(TRIP_COPY.return.body, vars), partnerSlugs: [] };
  const c = TRIP_COPY.stages[due.position];
  return { subject: fill(c.subject, vars), body: fill(c.body, vars), partnerSlugs: c.partner_slugs };
}

export async function ensureTripStreamTable(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS trip_stream_deliveries (
    trip_id TEXT NOT NULL, stage TEXT NOT NULL, email TEXT NOT NULL, status TEXT NOT NULL, via TEXT, error TEXT,
    created_at TEXT DEFAULT (datetime('now')), PRIMARY KEY (trip_id, stage))`).run();
}

/** Trips that said Yes, belong to a reachable reader, and have a stage due today and not yet delivered. */
export async function collectTripStreamDue(env, today = new Date().toISOString().slice(0, 10)) {
  if (!tripStreamV2Enabled(env) || !env?.DB) return [];
  await ensureTripStreamTable(env);
  const rows = await env.DB.prepare(`
    SELECT trips.trip_id AS trip_id, trips.destination AS destination, trips.departure_at AS departure_at, trips.return_at AS return_at,
           users.email AS email, users.partner_id AS partner_id, users.trip_length AS trip_length, users.passenger_count AS passenger_count
    FROM trips JOIN users ON users.id = trips.user_id
    WHERE trips.booking_self_report = ? AND users.unsubscribed_at IS NULL
      AND (users.paused_until IS NULL OR datetime(users.paused_until) < datetime('now'))
  `).bind(YES).all();
  const due = [];
  for (const trip of rows.results || []) {
    const d = stageDueToday(trip, today);
    if (!d) continue;
    const done = await env.DB.prepare("SELECT 1 AS x FROM trip_stream_deliveries WHERE trip_id = ? AND stage = ? AND status = 'sent'").bind(trip.trip_id, d.stage).first();
    if (done) continue;
    due.push({ ...trip, ...d });
  }
  return due;
}

export async function markTripStreamSent(env, trip, via) {
  await ensureTripStreamTable(env);
  await env.DB.prepare("INSERT OR REPLACE INTO trip_stream_deliveries (trip_id, stage, email, status, via) VALUES (?, ?, ?, 'sent', ?)").bind(trip.trip_id, trip.stage, trip.email, via).run();
}
