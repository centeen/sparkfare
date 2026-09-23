import os

file_path = r'C:\Users\cente\sparkfare\src\index.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Update import
import_target = "sendRouteRetrospectiveEmail } from './email.js';"
import_replacement = "sendRouteRetrospectiveEmail, sendPreDepartureSequenceEmail } from './email.js';"
if import_target in content:
    content = content.replace(import_target, import_replacement)

# Add sendPreDepartureSequenceAlerts function
new_function = """export async function sendPreDepartureSequenceAlerts(env) {
  if (env.ENABLE_T2B_SEQUENCE !== 'true') {
    return { sent: 0, skipped: 0, reason: 'T2b sequence flag disabled' };
  }
  if (!env?.DB) return { sent: 0, skipped: 0, reason: 'DB not configured' };

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS pre_departure_sequence_deliveries (
      trip_id TEXT,
      stage INTEGER,
      email TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (trip_id, stage)
    )
  `).run();

  const trips = await env.DB.prepare(`
    SELECT trips.trip_id AS trip_id, trips.destination AS destination, trips.departure_at AS departure_at,
           users.email AS email, users.partner_id AS partner_id, users.trip_length AS trip_length,
           users.passenger_count AS passenger_count
    FROM trips
    JOIN users ON users.id = trips.user_id
    WHERE users.unsubscribed_at IS NULL AND (users.paused_until IS NULL OR datetime(users.paused_until) < datetime('now'))
  `).all();

  const now = Date.now();
  let sent = 0;
  let skipped = 0;

  for (const trip of trips.results || []) {
    const departureTime = new Date(trip.departure_at).getTime();
    if (Number.isNaN(departureTime)) {
      skipped += 1;
      continue;
    }

    const daysUntil = Math.ceil((departureTime - now) / (24 * 60 * 60 * 1000));
    let stage = null;
    if (daysUntil === 14) stage = 14;
    else if (daysUntil === 7) stage = 7;
    else if (daysUntil === 1) stage = 1;
    else {
      skipped += 1;
      continue;
    }

    const alreadySent = await env.DB.prepare(
      'SELECT status FROM pre_departure_sequence_deliveries WHERE trip_id = ? AND stage = ? AND status = ?'
    ).bind(trip.trip_id, stage, 'sent').first();
    if (alreadySent) {
      skipped += 1;
      continue;
    }

    await env.DB.prepare(`
      INSERT OR REPLACE INTO pre_departure_sequence_deliveries (trip_id, stage, email, status, error)
      VALUES (?, ?, ?, 'pending', NULL)
    `).bind(trip.trip_id, stage, trip.email).run();

    try {
      const sentLogs = await env.DB.prepare(
        'SELECT partner_id FROM away_mode_email_log WHERE email = ? AND partner_id IS NOT NULL'
      ).bind(trip.email).all();
      const excludedPartnerIds = sentLogs.results ? sentLogs.results.map(r => r.partner_id) : [];

      const result = await sendPreDepartureSequenceEmail({
        email: trip.email,
        destination: trip.destination,
        departure_at: trip.departure_at,
        daysUntil: stage,
        excludedPartnerIds,
        trip_id: trip.trip_id,
        trip_length: trip.trip_length,
        passenger_count: trip.passenger_count,
      }, env);
      
      if (result.ok) {
        await logEvent(env, { event_type: 'away_mode_sequence_sent', route: trip.destination, meta: JSON.stringify({ stage, partner: result.partner_slug }) });
        await env.DB.prepare(
          'UPDATE pre_departure_sequence_deliveries SET status = ?, error = NULL WHERE trip_id = ? AND stage = ?'
        ).bind('sent', trip.trip_id, stage).run();
        sent += 1;
      }
    } catch (error) {
      console.error(`Pre-departure sequence alert failed for trip ${trip.trip_id} stage ${stage}:`, error);
      await env.DB.prepare(
        'UPDATE pre_departure_sequence_deliveries SET status = ?, error = ? WHERE trip_id = ? AND stage = ?'
      ).bind('failed', error.message, trip.trip_id, stage).run();
    }
  }

  return { sent, skipped };
}
"""

if "export async function sendPreDepartureSequenceAlerts" not in content:
    # Just append it before export default
    target_export = "export default {"
    if target_export in content:
        content = content.replace(target_export, new_function + "\n" + target_export)
        
        # Add to cron hooks:
        cron_target_1 = "      const result = await sendDepartingSoonAlerts(env);"
        cron_repl_1 = "      const result = await sendDepartingSoonAlerts(env);\n      await sendPreDepartureSequenceAlerts(env);"
        content = content.replace(cron_target_1, cron_repl_1)

        cron_target_2 = "      await sendDepartingSoonAlerts(env);"
        cron_repl_2 = "      await sendDepartingSoonAlerts(env);\n      await sendPreDepartureSequenceAlerts(env);"
        content = content.replace(cron_target_2, cron_repl_2)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print("Patched index.js with sendPreDepartureSequenceAlerts")
    else:
        print("Could not find export default")
else:
    print("Function already exists")
