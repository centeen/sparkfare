// ROADMAP step 65: the weekly standup brief. One short owner email every Monday (it rides the existing
// Monday 09:00 UTC Cron Trigger, so no new trigger is used) summarising the last 7 days against the 7 before,
// and listing anything that looks wrong. Aggregated counts only: no user email address or id ever appears.
//
// The data-pipeline ages and the email guard come from index.js (checkDataFreshness and
// readSendingGuardStatus live there and in email.js) and are passed in as `pipeline`, which keeps this module
// free of an import cycle and testable without the Worker.
import { escapeHtml } from './emailTemplates/helpers.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// SQLite's datetime('now') format, which is what events.ts, trips.clicked_at and friends hold.
const sql = (d) => d.toISOString().slice(0, 19).replace('T', ' ');
const NOT_BOT = "(meta IS NULL OR meta NOT LIKE '%\"ua_class\":\"bot\"%')";
const IS_BOT = "meta LIKE '%\"ua_class\":\"bot\"%'";

async function one(env, query, params = []) {
  try {
    const row = await env.DB.prepare(query).bind(...params).first();
    if (!row) return null;
    const v = Object.values(row)[0];
    return typeof v === 'number' ? v : (v == null ? 0 : Number(v));
  } catch {
    return null; // a missing table or column shows as "n/a", it never blocks the email
  }
}

async function rows(env, query, params = []) {
  try {
    return (await env.DB.prepare(query).bind(...params).all()).results || [];
  } catch {
    return null;
  }
}

// Counts an event type in [from, to).
const countEvents = (env, type, from, to, extra = '') =>
  one(env, `SELECT COUNT(*) FROM events WHERE event_type = ? AND ts >= ? AND ts < ? ${extra}`, [type, sql(from), sql(to)]);

export async function computeWeeklyStandup(env, { now = new Date(), pipeline = null } = {}) {
  if (!env?.DB) return null;
  const end = now;
  const start = new Date(now.getTime() - 7 * DAY_MS);
  const prevStart = new Date(now.getTime() - 14 * DAY_MS);
  const both = async (fn) => ({ week: await fn(start, end), prev: await fn(prevStart, start) });

  const signups = await both((a, b) => countEvents(env, 'signup', a, b));
  const verifiedNew = await both((a, b) => one(env, 'SELECT COUNT(*) FROM users WHERE created_at >= ? AND created_at < ? AND verified_email = 1', [sql(a), sql(b)]));
  const referralSignups = await both((a, b) => countEvents(env, 'referral_signup', a, b));
  const signupSources = await rows(env, `SELECT COALESCE(source, partner, 'direct') AS label, COUNT(*) AS n FROM events
    WHERE event_type = 'signup' AND ts >= ? AND ts < ? GROUP BY label ORDER BY n DESC LIMIT 5`, [sql(start), sql(end)]);

  const checkRuns = await both((a, b) => countEvents(env, 'check_run', a, b));
  const checkShares = await both((a, b) => countEvents(env, 'check_share', a, b));
  const checkSignups = await both((a, b) => countEvents(env, 'check_signup', a, b));
  const topChecked = await rows(env, `SELECT route AS label, COUNT(*) AS n FROM events
    WHERE event_type = 'check_run' AND ts >= ? AND ts < ? AND route IS NOT NULL GROUP BY route ORDER BY n DESC LIMIT 3`, [sql(start), sql(end)]);

  const emailsSent = await both((a, b) => countEvents(env, 'alert_email_sent', a, b));
  const emailOpens = await both((a, b) => countEvents(env, 'email_open', a, b));
  const bounces = await both((a, b) => countEvents(env, 'email_bounce', a, b));
  const complaints = await both((a, b) => countEvents(env, 'email_complaint', a, b));
  const unsubscribes = await both((a, b) => one(env, "SELECT COUNT(*) FROM email_suppressions WHERE reason = 'unsubscribed' AND created_at >= ? AND created_at < ?", [sql(a), sql(b)]));

  const clicks = await both((a, b) => countEvents(env, 'outbound_click', a, b, `AND ${NOT_BOT}`));
  const botClicks = await both((a, b) => countEvents(env, 'outbound_click', a, b, `AND ${IS_BOT}`));
  const topPartners = await rows(env, `SELECT partner AS label, COUNT(*) AS n FROM events
    WHERE event_type = 'outbound_click' AND ts >= ? AND ts < ? AND partner IS NOT NULL AND ${NOT_BOT} GROUP BY partner ORDER BY n DESC LIMIT 3`, [sql(start), sql(end)]);

  const tripsTracked = await both((a, b) => one(env, 'SELECT COUNT(*) FROM trips WHERE clicked_at >= ? AND clicked_at < ?', [sql(a), sql(b)]));
  const watchlistsCreated = await both((a, b) => one(env, 'SELECT COUNT(*) FROM watchlists WHERE created_at >= ? AND created_at < ?', [sql(a), sql(b)]));
  const watchlistsNotified = await both((a, b) => one(env, 'SELECT COUNT(*) FROM watchlists WHERE notified_at >= ? AND notified_at < ?', [sql(a), sql(b)]));
  const digestEditions = await both((a, b) => one(env, 'SELECT COUNT(*) FROM digest_editions WHERE created_at >= ? AND created_at < ?', [a.toISOString(), b.toISOString()]));

  const totals = {
    users: await one(env, 'SELECT COUNT(*) FROM users'),
    verified: await one(env, 'SELECT COUNT(*) FROM users WHERE verified_email = 1'),
    unsubscribed: await one(env, 'SELECT COUNT(*) FROM users WHERE unsubscribed_at IS NOT NULL'),
    bookingsReported: await one(env, "SELECT COUNT(*) FROM trips WHERE status = 'booked'"),
    revenueEur: await one(env, "SELECT COALESCE(SUM(price_eur), 0) FROM trips WHERE status = 'booked'"),
    digestEditionsStored: await one(env, 'SELECT COUNT(*) FROM digest_editions'),
    partnerConversionsThisMonth: await one(env, 'SELECT COUNT(*) FROM partner_conversions WHERE month = ?', [now.toISOString().slice(0, 7)]),
  };

  // Things that deserve a look. Each is a plain sentence; the list is empty when nothing is wrong.
  const flags = [];
  for (const problem of pipeline?.problems || []) flags.push(problem);
  if (pipeline?.guard?.tripped) flags.push(`The email sending guard is tripped (${pipeline.guard.reason}); guarded email is being skipped.`);
  if ((complaints.week || 0) > 0) flags.push(`${complaints.week} spam complaint${complaints.week === 1 ? '' : 's'} this week.`);
  if ((bounces.week || 0) > 0) flags.push(`${bounces.week} email bounce${bounces.week === 1 ? '' : 's'} this week.`);
  if ((emailsSent.week === 0) && (totals.verified || 0) > 0) flags.push(`No digest emails were sent in the last 7 days, but there are ${totals.verified} verified subscribers.`);
  if (new Date(now).getUTCDate() > 7 && totals.partnerConversionsThisMonth === 0) flags.push('No partner revenue has been entered for this month yet (partner_conversions).');

  return {
    window: { start: start.toISOString(), end: end.toISOString(), key: sql(start).slice(0, 10) },
    signups, verifiedNew, referralSignups, signupSources,
    checkRuns, checkShares, checkSignups, topChecked,
    emailsSent, emailOpens, bounces, complaints, unsubscribes,
    clicks, botClicks, topPartners,
    tripsTracked, watchlistsCreated, watchlistsNotified, digestEditions,
    totals, pipeline: pipeline?.details || [], flags,
  };
}

// ---------- rendering ----------

const fmt = (v) => (v === null || v === undefined ? 'n/a' : String(v));

function delta(week, prev) {
  if (week === null || prev === null || week === undefined || prev === undefined) return '';
  const d = week - prev;
  if (d === 0) return ' (same as last week)';
  return ` (${d > 0 ? '+' : ''}${d} vs last week)`;
}

function openRate(m) {
  const sent = m.emailsSent.week;
  const opens = m.emailOpens.week;
  if (!sent) return 'n/a';
  return `${Math.round(((opens || 0) / sent) * 100)}%`;
}

function dayLabel(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function pipelineLine(d) {
  if (d.ok === false) return `${d.file}: unreadable`;
  return `${d.file}: ${d.ageHours}h old (limit ${d.maxAgeHours}h)`;
}

// The structure both renderers share: [{ title, lines: [string] }].
function sections(m) {
  const list = (items) => (items && items.length ? items.map((r) => `${r.label} (${r.n})`).join(', ') : 'none');
  return [
    {
      title: 'People',
      lines: [
        `New signups: ${fmt(m.signups.week)}${delta(m.signups.week, m.signups.prev)}; verified new: ${fmt(m.verifiedNew.week)}; via referral: ${fmt(m.referralSignups.week)}`,
        `Where signups came from: ${m.signupSources === null ? 'n/a' : list(m.signupSources)}`,
        `All time: ${fmt(m.totals.users)} users, ${fmt(m.totals.verified)} verified, ${fmt(m.totals.unsubscribed)} unsubscribed`,
      ],
    },
    {
      title: 'Price checker (/check)',
      lines: [
        `Checks run: ${fmt(m.checkRuns.week)}${delta(m.checkRuns.week, m.checkRuns.prev)}; links shared: ${fmt(m.checkShares.week)}; signups from it: ${fmt(m.checkSignups.week)}`,
        `Most checked routes: ${m.topChecked === null ? 'n/a' : list(m.topChecked)}`,
      ],
    },
    {
      title: 'Email',
      lines: [
        `Digests sent: ${fmt(m.emailsSent.week)}${delta(m.emailsSent.week, m.emailsSent.prev)}; opens: ${fmt(m.emailOpens.week)}; open rate: ${openRate(m)}`,
        `Unsubscribes: ${fmt(m.unsubscribes.week)}; bounces: ${fmt(m.bounces.week)}; spam complaints: ${fmt(m.complaints.week)}`,
      ],
    },
    {
      title: 'Clicks and trips',
      lines: [
        `Partner and fare clicks (bots excluded): ${fmt(m.clicks.week)}${delta(m.clicks.week, m.clicks.prev)}; flagged as bots: ${fmt(m.botClicks.week)}`,
        `Top partners: ${m.topPartners === null ? 'n/a' : list(m.topPartners)}`,
        `Trips tracked: ${fmt(m.tripsTracked.week)}${delta(m.tripsTracked.week, m.tripsTracked.prev)}; paid purchases reported by Travelpayouts (all time): ${fmt(m.totals.bookingsReported)}, about EUR ${fmt(m.totals.revenueEur)}`,
        `Watchlists created: ${fmt(m.watchlistsCreated.week)}; target reached: ${fmt(m.watchlistsNotified.week)}`,
      ],
    },
    {
      title: 'Pipeline',
      lines: [
        ...(m.pipeline.length ? m.pipeline.map(pipelineLine) : ['file ages: not available']),
        `Digest editions stored privately this week: ${fmt(m.digestEditions.week)} (${fmt(m.totals.digestEditionsStored)} in total)`,
      ],
    },
  ];
}

export function renderWeeklyStandup(m) {
  const range = `${dayLabel(m.window.start)} to ${dayLabel(m.window.end)}`;
  const flagWord = m.flags.length ? ` (${m.flags.length} to look at)` : '';
  const subject = `Sparkfare weekly, ${range}: ${fmt(m.signups.week)} signup${m.signups.week === 1 ? '' : 's'}, ${fmt(m.checkRuns.week)} price check${m.checkRuns.week === 1 ? '' : 's'}${flagWord}`;
  const blocks = sections(m);

  const textFlags = m.flags.length ? ['TO LOOK AT', ...m.flags.map((f) => `- ${f}`), ''] : ['Nothing flagged.', ''];
  const text = [`Sparkfare weekly, ${range} (UTC)`, '', ...textFlags,
    ...blocks.flatMap((b) => [b.title.toUpperCase(), ...b.lines.map((l) => `- ${l}`), '']),
    'Counts only, no personal data. Last 7 days against the 7 before.'].join('\n');

  const c = { paper: '#EDE6D6', card: '#FBF8F0', ink: '#2B2620', muted: '#6B6255', line: '#DCD3BF', warn: '#9A3412' };
  const flagHtml = m.flags.length
    ? `<div style="border:1px solid ${c.warn};border-radius:8px;padding:12px 16px;margin:0 0 16px;background:${c.card};"><strong style="color:${c.warn};">To look at</strong><ul style="margin:8px 0 0;padding-left:20px;">${m.flags.map((f) => `<li style="margin:0 0 6px;">${escapeHtml(f)}</li>`).join('')}</ul></div>`
    : `<p style="margin:0 0 16px;color:${c.muted};">Nothing flagged.</p>`;
  const blockHtml = blocks.map((b) => `<h2 style="font-size:16px;margin:20px 0 6px;color:${c.ink};">${escapeHtml(b.title)}</h2><ul style="margin:0;padding-left:20px;">${b.lines.map((l) => `<li style="margin:0 0 6px;">${escapeHtml(l)}</li>`).join('')}</ul>`).join('');
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:${c.paper};"><div style="max-width:620px;margin:0 auto;padding:24px 16px;font-family:Inter,Helvetica,Arial,sans-serif;font-size:15px;line-height:22px;color:${c.ink};">
<h1 style="font-family:'Space Grotesk',Helvetica,Arial,sans-serif;font-size:22px;font-weight:500;margin:0 0 4px;">Sparkfare weekly</h1>
<p style="margin:0 0 16px;color:${c.muted};">${escapeHtml(range)} (UTC), against the 7 days before</p>
${flagHtml}${blockHtml}
<p style="margin:24px 0 0;font-size:13px;color:${c.muted};">Counts only, no personal data. Sent by the Monday 09:00 UTC job; set <code>ENABLE_WEEKLY_STANDUP</code> to <code>"false"</code> to stop it.</p>
</div></body></html>`;
  return { subject, html, text };
}

// ---------- sending ----------

export function standupEnabled(env) {
  return env?.ENABLE_WEEKLY_STANDUP !== 'false';
}

// Builds the brief and sends it once per window. `send` is sendWeeklyStandupEmail from email.js, injected so
// this module needs no import of it; `force` skips the once-per-week check (manual runs).
export async function sendWeeklyStandup(env, { now = new Date(), pipeline = null, send, force = false, dryRun = false } = {}) {
  if (!standupEnabled(env)) return { ok: true, sent: false, reason: 'disabled (ENABLE_WEEKLY_STANDUP=false)' };
  if (!env?.DB) return { ok: true, sent: false, reason: 'DB not configured' };
  const metrics = await computeWeeklyStandup(env, { now, pipeline });
  const rendered = renderWeeklyStandup(metrics);
  if (dryRun) return { ok: true, sent: false, dryRun: true, metrics, subject: rendered.subject, text: rendered.text };

  if (!force) {
    const already = await one(env, "SELECT COUNT(*) FROM events WHERE event_type = 'weekly_standup_sent' AND sub_id = ?", [metrics.window.key]);
    if (already) return { ok: true, sent: false, reason: `already sent for the week starting ${metrics.window.key}` };
  }
  const result = await send(env, rendered);
  if (result?.ok && !result.mocked) {
    try {
      await env.DB.prepare("INSERT INTO events (id, event_type, sub_id, meta) VALUES (?, 'weekly_standup_sent', ?, ?)")
        .bind(crypto.randomUUID(), metrics.window.key, JSON.stringify({ flags: metrics.flags.length })).run();
    } catch (error) {
      console.error('weekly standup: could not record the send', error);
    }
  }
  return { ok: !!result?.ok, sent: !!(result?.ok && !result.mocked), mocked: !!result?.mocked, subject: rendered.subject, flags: metrics.flags.length };
}
