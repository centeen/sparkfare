// Away Move 2 (ROADMAP step 70): one-tap trip self-report. Pure helpers plus one guarded query helper.
// The answer is stored in trips.booking_self_report / trips.self_reported_at (migration 0016) and NEVER in trips.status:
// reconcileBookings() only flips rows still 'clicked', and the booked-confirmation email hangs off that update.
import { TRIP_TAP_ANSWERS, signTripTapToken } from './postClickEmail.js';

export const ANSWER_LABELS = { booked: 'Booked', not_yet: 'Not yet', not_going: 'Not going' };

// Only the exact string "true" turns this on. Off: the routes 404 and the email is unchanged.
export function tripSelfReportEnabled(env) {
  return env?.ENABLE_TRIP_SELF_REPORT === 'true';
}

export function isValidAnswer(answer) {
  return TRIP_TAP_ANSWERS.includes(answer);
}

// One signed link per answer. Empty when the flag is off, the signing secret is missing or there is no trip id,
// so the caller can drop the whole block.
export async function buildTripTapUrls(env, tripId, appUrl) {
  if (!tripSelfReportEnabled(env) || !env?.UNSUBSCRIBE_SECRET || !tripId) return null;
  const urls = {};
  for (const answer of TRIP_TAP_ANSWERS) {
    const token = await signTripTapToken(tripId, answer, env.UNSUBSCRIBE_SECRET);
    urls[answer] = `${appUrl}/api/trip-status?token=${encodeURIComponent(token)}`;
  }
  return urls;
}

const NOT_GOING_FILTER = " AND (trips.booking_self_report IS NULL OR trips.booking_self_report <> 'not_going')";

// Runs a trips query (one ending in its WHERE clause) leaving out trips the traveler said they are not taking.
// If the column does not exist yet (migration 0016 not applied), runs the query without the filter instead of failing.
export async function allTripsExceptNotGoing(env, baseSql) {
  try {
    return await env.DB.prepare(baseSql + NOT_GOING_FILTER).all();
  } catch (error) {
    if (!/no such column/i.test(String(error?.message || error))) throw error;
    return env.DB.prepare(baseSql).all();
  }
}
