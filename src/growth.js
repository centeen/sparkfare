// Addendum M, M1 (ROADMAP step 140): measurement. Where each signup came from, how many confirmed, and referrals.
//
// What is stored: users.signup_source (migration 0031), the first-touch value for a signup, set once on a new row and never
// overwritten by a later resubmit. Confirmation is users.verified_email = 1 (set by /api/verify, which also logs an
// `email_verified` event with the timestamp from that moment on). The report holds counts only: no email, no user id.

// The set of values a signup may carry. Anything else the form sends is kept out of this column (the raw tag still goes
// to the signup event's meta.utm).
export const SIGNUP_SOURCES = ['home', 'check', 'leave', 'pto', 'widget', 'route', 'digest', 'share', 'referral', 'report', 'direct'];

// The anonymous landing pages identify themselves by partner_id rather than source (the 880 pSEO pages and the digest archive
// page were not changed to send one; see the M0 plan). Map them here so no page needs regenerating.
const PARTNER_SOURCE = { pseo: 'route', digest_archive: 'digest' };

function clean(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
}

// referral > the form's own source > the page's partner_id > 'direct'.
export function computeSignupSource({ source, partnerId, referredBy } = {}) {
  if (referredBy) return 'referral';
  const s = clean(source);
  if (s && SIGNUP_SOURCES.includes(s)) return s;
  const mapped = PARTNER_SOURCE[clean(partnerId)];
  if (mapped) return mapped;
  return 'direct';
}

// A referral is confirmed when the friend verifies their email address (the plan's Guard condition 7). The first-open
// transition in the Resend webhook stays as a fallback, so both paths call this. Returns true if a pending row was moved.
export async function confirmPendingReferral(env, userId) {
  if (!env?.DB || !userId) return false;
  const pending = await env.DB.prepare(
    "SELECT id FROM referrals WHERE referred_id = ? AND status = 'pending'"
  ).bind(userId).first();
  if (!pending) return false;
  await env.DB.prepare(
    "UPDATE referrals SET status = 'confirmed', updated_at = datetime('now') WHERE id = ?"
  ).bind(pending.id).run();
  return true;
}

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

function daysAgo(now, n) {
  return new Date(now.getTime() - n * 86400000);
}

async function all(env, sql, binds = []) {
  try {
    const out = await env.DB.prepare(sql).bind(...binds).all();
    return out?.results || [];
  } catch (error) {
    // A table that does not exist yet reads as empty, never as an error page.
    console.error('growth query failed:', error);
    return [];
  }
}

export async function computeGrowth(env, now = new Date()) {
  const since28 = dayKey(daysAgo(now, 28));
  const since7 = dayKey(daysAgo(now, 7));
  const sinceTs = (d) => d + ' 00:00:00';

  // Signups by source: cohort of users created in the window, and how many of that cohort have confirmed so far.
  const bySource = async (since) => all(env,
    `SELECT COALESCE(signup_source, 'unknown') AS source, COUNT(*) AS signups, SUM(CASE WHEN verified_email = 1 THEN 1 ELSE 0 END) AS confirmed
       FROM users WHERE created_at >= ? GROUP BY COALESCE(signup_source, 'unknown') ORDER BY signups DESC`,
    [sinceTs(since)]);
  const rate = (r) => ({ source: r.source, signups: r.signups, confirmed: r.confirmed || 0, rate: r.signups ? Math.round(((r.confirmed || 0) / r.signups) * 1000) / 10 : null });

  const sources7 = (await bySource(since7)).map(rate);
  const sources28 = (await bySource(since28)).map(rate);
  const sum = (rows, key) => rows.reduce((n, r) => n + (r[key] || 0), 0);
  const total = (rows) => {
    const s = sum(rows, 'signups'); const c = sum(rows, 'confirmed');
    return { signups: s, confirmed: c, rate: s ? Math.round((c / s) * 1000) / 10 : null };
  };

  // Per day and source: signups (users.created_at) and confirmations (email_verified events, which exist from the day M1 shipped).
  const signupDays = await all(env,
    `SELECT substr(created_at, 1, 10) AS day, COALESCE(signup_source, 'unknown') AS source, COUNT(*) AS signups
       FROM users WHERE created_at >= ? GROUP BY day, source ORDER BY day DESC, signups DESC`, [sinceTs(since28)]);
  const confirmDays = await all(env,
    `SELECT substr(ts, 1, 10) AS day, COALESCE(source, 'unknown') AS source, COUNT(*) AS confirmations
       FROM events WHERE event_type = 'email_verified' AND ts >= ? GROUP BY day, source ORDER BY day DESC`, [sinceTs(since28)]);

  // The raw campaign tag (utm.js) that came with a signup, from the signup event; joined to see how many confirmed.
  const utm28 = await all(env,
    `SELECT json_extract(e.meta, '$.utm') AS utm, COUNT(*) AS signups, SUM(CASE WHEN u.verified_email = 1 THEN 1 ELSE 0 END) AS confirmed
       FROM events e LEFT JOIN users u ON u.id = e.user_id
      WHERE e.event_type = 'signup' AND e.ts >= ? AND json_extract(e.meta, '$.utm') IS NOT NULL
      GROUP BY utm ORDER BY signups DESC`, [sinceTs(since28)]);

  const refRow = async (since) => {
    const rows = await all(env,
      `SELECT COUNT(*) AS sent, SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed
         FROM referrals WHERE created_at >= ?`, [sinceTs(since)]);
    const r = rows[0] || {};
    return { sent: r.sent || 0, confirmed: r.confirmed || 0 };
  };

  return {
    generated_at: now.toISOString(),
    windows: { last7_since: since7, last28_since: since28 },
    visits: null,
    visits_note: 'Visits are not read automatically (no Cloudflare analytics token). Read them in the Cloudflare dashboard.',
    totals: { last7: total(sources7), last28: total(sources28) },
    by_source: { last7: sources7, last28: sources28 },
    by_day: { signups: signupDays, confirmations: confirmDays },
    by_utm_last28: utm28.map((r) => ({ utm: r.utm, signups: r.signups, confirmed: r.confirmed || 0 })),
    referrals: { last7: await refRow(since7), last28: await refRow(since28) },
  };
}

// Plain-text version, used by the baseline script and tests.
export function growthToMarkdown(g, { title = 'Growth baseline', visits = null } = {}) {
  const line = (r) => `| ${r.source} | ${r.signups} | ${r.confirmed} | ${r.rate == null ? 'n/a' : r.rate + '%'} |`;
  const table = (rows) => ['| Source | Signups | Confirmed | Rate |', '| --- | --- | --- | --- |', ...rows.map(line)].join('\n');
  const t = g.totals;
  return [
    `# ${title}`,
    '',
    `Generated ${g.generated_at}. Counts only; no personal data.`,
    '',
    `Visits: ${visits == null ? 'not supplied (read the Cloudflare dashboard)' : visits}`,
    '',
    `## Last 7 days (since ${g.windows.last7_since})`,
    `Signups ${t.last7.signups}, confirmed ${t.last7.confirmed}, rate ${t.last7.rate == null ? 'n/a' : t.last7.rate + '%'}`,
    '',
    table(g.by_source.last7),
    '',
    `## Last 28 days (since ${g.windows.last28_since})`,
    `Signups ${t.last28.signups}, confirmed ${t.last28.confirmed}, rate ${t.last28.rate == null ? 'n/a' : t.last28.rate + '%'}`,
    '',
    table(g.by_source.last28),
    '',
    `## Referrals`,
    `Last 7 days: ${g.referrals.last7.sent} sent, ${g.referrals.last7.confirmed} confirmed. Last 28 days: ${g.referrals.last28.sent} sent, ${g.referrals.last28.confirmed} confirmed.`,
    '',
    'Rows labelled `unknown` were created before source tagging shipped (2026-10-21).',
    '',
  ].join('\n');
}

export function growthAdminPageHtml() {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>Growth</title>
<style>
body{font:14px/1.5 system-ui,Segoe UI,Arial,sans-serif;margin:24px;color:#2B2620;background:#FBF7EF}
table{border-collapse:collapse;margin:8px 0 20px}th,td{border:1px solid #d9d0c0;padding:6px 10px;text-align:left}
th{background:#efe7d6}input{padding:6px;width:320px}button{padding:6px 10px;cursor:pointer}
</style></head><body>
<h1>Growth</h1>
<p>Enter the admin secret to load the numbers. It stays in this page and is sent only as an Authorization header. Counts only.</p>
<p><input id="secret" type="password" placeholder="admin secret" autocomplete="off"> <button id="load">Load</button></p>
<div id="msg"></div><div id="out"></div>
<script>
(function(){
var msg=document.getElementById('msg'),out=document.getElementById('out');
function el(tag,txt){var e=document.createElement(tag);if(txt!=null)e.textContent=txt;return e;}
function table(head,rows){var t=el('table'),tr=el('tr');head.forEach(function(h){tr.appendChild(el('th',h));});t.appendChild(tr);
 rows.forEach(function(r){var row=el('tr');r.forEach(function(c){row.appendChild(el('td',c==null?'':c));});t.appendChild(row);});return t;}
function pct(r){return r==null?'n/a':r+'%';}
function show(g){out.textContent='';
 out.appendChild(el('p','Generated '+g.generated_at+'. '+g.visits_note));
 [['Last 7 days','last7'],['Last 28 days','last28']].forEach(function(w){
  var t=g.totals[w[1]];out.appendChild(el('h2',w[0]+': '+t.signups+' signups, '+t.confirmed+' confirmed ('+pct(t.rate)+')'));
  out.appendChild(table(['Source','Signups','Confirmed','Rate'],g.by_source[w[1]].map(function(r){return [r.source,r.signups,r.confirmed,pct(r.rate)];})));
  var rf=g.referrals[w[1]];out.appendChild(el('p','Referrals: '+rf.sent+' sent, '+rf.confirmed+' confirmed'));});
 out.appendChild(el('h2','Campaign tags, last 28 days'));
 out.appendChild(table(['Tag','Signups','Confirmed'],g.by_utm_last28.map(function(r){return [r.utm,r.signups,r.confirmed];})));
 out.appendChild(el('h2','Signups per day and source, last 28 days'));
 out.appendChild(table(['Day','Source','Signups'],g.by_day.signups.map(function(r){return [r.day,r.source,r.signups];})));
 out.appendChild(el('h2','Confirmations per day and source (from 2026-10-21)'));
 out.appendChild(table(['Day','Source','Confirmations'],g.by_day.confirmations.map(function(r){return [r.day,r.source,r.confirmations];})));}
document.getElementById('load').onclick=function(){
 fetch('/admin/growth/data',{headers:{'Authorization':'Bearer '+document.getElementById('secret').value}}).then(function(r){
  if(r.status===401){msg.textContent='Wrong secret.';return null;}return r.json();}).then(function(j){if(j&&j.ok){msg.textContent='';show(j.growth);}});};
})();
</script></body></html>`;
}
