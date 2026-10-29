// C1.5 (Addendum Q): the care email. One email, once, at 60 days without a click, offering daily, weekly or pause by signed links
// (stream 'care'). Flag ENABLE_CARE_EMAIL (exact "true"); also needs ENABLE_SIGNED_PREFS (the links are /prefs links).
import { signedPrefsEnabled } from './prefs.js';
import { ensureClickSchema } from './clickSignal.js';

export const CARE_RULE = { noClickDays: 60, minAccountDays: 60, maxPerRun: 100, trackingProofDays: 30 };
export const careEmailEnabled = (env) => env?.ENABLE_CARE_EMAIL === 'true' && signedPrefsEnabled(env);

export async function ensureCareColumn(env) {
  try { await env.DB.prepare('ALTER TABLE users ADD COLUMN care_sent_at TEXT').run(); } catch { /* already there */ }
}

/** True only if at least one click was recorded recently, so "no click in 60 days" means something. With click tracking off nobody has a click. */
export async function clickTrackingLooksAlive(env) {
  await ensureClickSchema(env);
  const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM users WHERE last_clicked_at IS NOT NULL AND last_clicked_at > datetime('now', '-' || ? || ' days')`).bind(CARE_RULE.trackingProofDays).first();
  return Number(row?.n || 0) > 0;
}

export async function collectCareCandidates(env) {
  await ensureClickSchema(env);
  await ensureCareColumn(env);
  const rows = await env.DB.prepare(`
    SELECT email FROM users
    WHERE is_subscribed = 1 AND unsubscribed_at IS NULL AND verified_email = 1
      AND (paused_until IS NULL OR datetime(paused_until) < datetime('now'))
      AND care_sent_at IS NULL
      AND created_at <= datetime('now', '-' || ? || ' days')
      AND (last_clicked_at IS NULL OR last_clicked_at <= datetime('now', '-' || ? || ' days'))
    ORDER BY created_at LIMIT ?
  `).bind(CARE_RULE.minAccountDays, CARE_RULE.noClickDays, CARE_RULE.maxPerRun).all();
  return (rows.results || []).map((r) => r.email);
}

/** Sends the care email to everyone due, once each. Never throws per address. */
export async function sendCareEmails(env, { sendCareEmail }) {
  if (!careEmailEnabled(env)) return { sent: 0, reason: 'ENABLE_CARE_EMAIL off' };
  if (!env?.DB) return { sent: 0, reason: 'DB not configured' };
  if (!(await clickTrackingLooksAlive(env))) return { sent: 0, reason: 'no recent clicks recorded; click tracking may be off' };
  let sent = 0; let skipped = 0;
  for (const email of await collectCareCandidates(env)) {
    try {
      const result = await sendCareEmail({ email }, env);
      if (result?.ok && !result.deferred && !result.mocked) {
        // Mark first-send only after Resend accepted it; a suppressed address is also marked so it is not retried every day.
        await env.DB.prepare("UPDATE users SET care_sent_at = datetime('now') WHERE email = ? AND care_sent_at IS NULL").bind(email).run();
        sent += 1;
      } else skipped += 1;
    } catch (error) {
      console.error('Care email failed for ' + email + ':', error);
      skipped += 1;
    }
  }
  return { sent, skipped };
}
