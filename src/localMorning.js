// Addendum Q, Q7 (D-049c, G117): the local-morning send. Behind ENABLE_LOCAL_MORNING_SEND (default "false"). With the flag on, a reader's scheduled email goes out in
// 06:00 to 06:59 of their own home-airport time zone (src/originZones.js), the zone table (not code) handles daylight time, and nothing scheduled goes out between 21:00
// and 06:00 local. Transactional mail is exempt (it is never claimed against the send budget).
//
// How it is enforced: every non-transactional scheduled send already asks the send budget (src/sendBudget.js) for a slot. That one place now also asks this file whether the
// recipient's local clock allows the send, and a send outside the window is "deferred", which every caller already treats as "try again on a later run". An hourly trigger
// then simply runs the recipient jobs in each hour in which some origin is in its morning.
import { ORIGIN_TIME_ZONES } from './originZones.js';

export const MORNING_HOUR = 6;      // the send window is 06:00 to 06:59 local
export const QUIET_FROM_HOUR = 21;  // no scheduled send from 21:00 ...
export const QUIET_UNTIL_HOUR = 6;  // ... until 06:00 local
export const DAILY_JOBS_FROM_UTC_HOUR = 8;
export const HOURLY_CRON = '30 * * * *';
/** Emails that answer the reader's own action or are date-specific (the evening-before email) keep their own time; they only obey quiet hours. */
export const WINDOW_EXEMPT_KINDS = ['checklist', 'youre_set'];
/** Sent right after the reader's own confirmation, so it is neither held to the morning window nor to quiet hours (otherwise a late-evening confirmation would silently lose it). */
export const WINDOW_FREE_KINDS = ['welcome'];

export const localMorningEnabled = (env) => env?.ENABLE_LOCAL_MORNING_SEND === 'true';

/** The hour (0 to 23) it is in the origin's zone. UTC for an unknown origin. */
export function localHour(origin, now = new Date()) {
  const zone = ORIGIN_TIME_ZONES[String(origin || '').toUpperCase()] || 'UTC';
  try {
    const hour = new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric', hourCycle: 'h23' }).format(now);
    return Number(hour);
  } catch {
    return now.getUTCHours();
  }
}

export const isQuietHour = (hour) => hour >= QUIET_FROM_HOUR || hour < QUIET_UNTIL_HOUR;

/** Why a scheduled email of this kind may not go to this origin right now, or null. Always null with the flag off. */
export function sendWindowReason(env, { kind, origin, now = new Date() }) {
  if (!localMorningEnabled(env)) return null;
  if (WINDOW_FREE_KINDS.includes(kind)) return null;
  const hour = localHour(origin, now);
  if (WINDOW_EXEMPT_KINDS.includes(kind)) return isQuietHour(hour) ? 'quiet_hours' : null;
  if (isQuietHour(hour)) return 'quiet_hours';
  return hour === MORNING_HOUR ? null : 'outside_morning_window';
}

/** Origins that are inside 06:00 to 06:59 right now. */
export function originsInLocalMorning(now = new Date()) {
  return Object.keys(ORIGIN_TIME_ZONES).filter((origin) => localHour(origin, now) === MORNING_HOUR);
}

/** What one hourly run should do: the once-a-day jobs on the first run at or after 08:00 UTC, and the recipient jobs when some origin is in its morning. */
export function hourlyPlan(now = new Date()) {
  const origins = originsInLocalMorning(now);
  return { daily: now.getUTCHours() >= DAILY_JOBS_FROM_UTC_HOUR, recipients: origins.length > 0, origins };
}

/** At-most-once-a-day guard for the once-a-day jobs. Returns true when this call is the one that should run them. */
export async function claimDailyRun(env, job, now = new Date()) {
  if (!env?.DB) return true;
  try {
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS daily_job_runs (job TEXT NOT NULL, run_date TEXT NOT NULL, ran_at TEXT DEFAULT (datetime(\'now\')), PRIMARY KEY (job, run_date))').run();
    const res = await env.DB.prepare('INSERT OR IGNORE INTO daily_job_runs (job, run_date) VALUES (?, ?)').bind(job, now.toISOString().slice(0, 10)).run();
    return Number(res?.meta?.changes || 0) > 0;
  } catch (error) {
    console.error('claimDailyRun failed; running the job:', error?.message || error);
    return true;
  }
}
