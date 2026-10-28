// Addendum Q, C1.1 (G114), DARK: the signed, no-account preference page and the daily-or-weekly choice at signup.
//   ENABLE_SIGNED_PREFS      /prefs?token=...  pause, weekly, daily or stop, from a link in every commercial email's footer. The token is a signed email
//                            ("prefs:<email>", so no unsubscribe or reactivate token works here). A GET only shows the page; every change is a POST.
//   ENABLE_SIGNUP_FREQUENCY  every signup form offers "Daily digest (you can switch anytime)" or "Weekly edition, Sundays" (signup-frequency.js); /api/signup stores the
//                            choice for a NEW address only, so nobody can change someone else's setting through the public form.
// Copy lives in content/prefs.json for the Hub's Guard read.
import PREFS_COPY from '../content/prefs.json' with { type: 'json' };
import { signPrefsToken, verifyPrefsToken } from './postClickEmail.js';

export const signedPrefsEnabled = (env) => env?.ENABLE_SIGNED_PREFS === 'true' && Boolean(env?.UNSUBSCRIBE_SECRET);
export const signupFrequencyEnabled = (env) => env?.ENABLE_SIGNUP_FREQUENCY === 'true';
export const PREFS_ACTIONS = ['daily', 'weekly', 'pause', 'stop'];
export const PAUSE_DAYS = 30;

const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const C = PREFS_COPY.page;

export async function prefsUrl(env, email) {
  if (!signedPrefsEnabled(env) || !email) return null;
  return `${env.APP_URL || 'https://sparkfare.com'}/prefs?token=${encodeURIComponent(await signPrefsToken(email, env.UNSUBSCRIBE_SECRET))}`;
}

/** Adds the "Change how often, or pause" line to a commercial email (HTML and text). Idempotent; a no-op when the page is off or there is no secret. */
export function withPrefsLink({ html, text }, url) {
  if (!url) return { html, text };
  const label = PREFS_COPY.footer.link;
  let outHtml = html;
  if (typeof html === 'string' && !html.includes('/prefs?token=')) {
    const line = `<p style="margin:12px 0 0;font-size:12px;line-height:18px;"><a href="${esc(url)}">${esc(label)}</a></p>`;
    const marker = '<!--sf-postal-footer-->';
    outHtml = html.includes(marker) ? html.replace(marker, `${line}${marker}`) : `${html}${line}`;
  }
  let outText = text;
  if (typeof text === 'string' && !text.includes('/prefs?token=')) outText = `${text}\n\n${label}: ${url}`;
  return { html: outHtml, text: outText };
}

function frequencyLabelOf(user) {
  if (user?.unsubscribed_at) return C.now_stopped;
  if (user?.paused_until && new Date(user.paused_until.replace(' ', 'T') + (user.paused_until.endsWith('Z') ? '' : 'Z')) > new Date()) return C.now_paused.replace('{date}', String(user.paused_until).slice(0, 10));
  return user?.frequency === 'weekly' ? C.now_weekly : C.now_daily;
}

function page({ title, lines, form = null, status = 200 }) {
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">
<title>${esc(title)}</title><link rel="stylesheet" href="/brand/tokens.css"><link rel="stylesheet" href="/brand/fonts.css">
<style>body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.5 var(--font-body,Inter,Arial,sans-serif)}main{max-width:480px;margin:0 auto;padding:32px 16px}h1{font:500 24px/1.2 var(--font-display,'Space Grotesk',Arial,sans-serif);margin:0 0 12px}
form{margin:0 0 12px}button{width:100%;min-height:44px;font:600 16px var(--font-body,Inter,Arial,sans-serif);border-radius:8px;border:1px solid var(--sage);background:#fff;color:var(--sage);cursor:pointer}button.primary{background:var(--sage);color:var(--on-sage,#fff)}</style></head>
<body><main id="main"><h1>${esc(title)}</h1>${lines.map((l) => `<p>${esc(l)}</p>`).join('')}${form || ''}</main></body></html>`;
  return new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' } });
}

const button = (token, action, label, primary = false) => `<form method="POST" action="/prefs"><input type="hidden" name="token" value="${esc(token)}"><input type="hidden" name="action" value="${action}"><button type="submit"${primary ? ' class="primary"' : ''}>${esc(label)}</button></form>`;

async function readUser(env, email) {
  try { return await env.DB.prepare('SELECT frequency, paused_until, unsubscribed_at FROM users WHERE email = ?').bind(email).first(); } catch { return null; }
}

/** GET /prefs?token=: shows the page; changes nothing. */
export async function handlePrefsGet(request, env) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const email = await verifyPrefsToken(token, env.UNSUBSCRIBE_SECRET);
  if (!email) return page({ title: C.title, lines: [C.bad_link], status: 400 });
  const user = env?.DB ? await readUser(env, email) : null;
  const stopped = Boolean(user?.unsubscribed_at);
  const form = stopped ? '' : button(token, 'daily', C.daily, user?.frequency !== 'weekly') + button(token, 'weekly', C.weekly, user?.frequency === 'weekly') + button(token, 'pause', C.pause) + button(token, 'stop', C.stop);
  return page({ title: C.title, lines: [C.intro, frequencyLabelOf(user)], form });
}

/** POST /prefs: applies one of the four actions for the address the token names, and only that address. */
export async function handlePrefsPost(request, env, { logEvent } = {}) {
  let token; let action;
  try {
    const ct = request.headers.get('content-type') || '';
    if (ct.includes('application/json')) { const b = await request.json(); token = b.token; action = b.action; }
    else { const f = await request.formData(); token = f.get('token'); action = f.get('action'); }
  } catch { return page({ title: C.title, lines: [C.bad_link], status: 400 }); }
  const email = await verifyPrefsToken(token, env.UNSUBSCRIBE_SECRET);
  if (!email || !PREFS_ACTIONS.includes(action)) return page({ title: C.title, lines: [C.bad_link], status: 400 });
  if (env?.DB) {
    try { await env.DB.prepare("ALTER TABLE users ADD COLUMN frequency TEXT DEFAULT 'daily'").run(); } catch { /* already there */ }
    try { await env.DB.prepare('ALTER TABLE users ADD COLUMN paused_until TEXT').run(); } catch { /* already there */ }
    // Never turn a stopped address back on from here: a stop is final until the person signs up again.
    const guard = 'AND unsubscribed_at IS NULL';
    if (action === 'daily') await env.DB.prepare(`UPDATE users SET frequency = 'daily', paused_until = NULL WHERE email = ? ${guard}`).bind(email).run();
    else if (action === 'weekly') await env.DB.prepare(`UPDATE users SET frequency = 'weekly', paused_until = NULL WHERE email = ? ${guard}`).bind(email).run();
    else if (action === 'pause') await env.DB.prepare(`UPDATE users SET paused_until = datetime('now', '+${PAUSE_DAYS} days') WHERE email = ? ${guard}`).bind(email).run();
    else {
      await env.DB.prepare("UPDATE users SET unsubscribed_at = datetime('now') WHERE email = ?").bind(email).run();
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS email_suppressions (email TEXT PRIMARY KEY, reason TEXT, created_at TEXT DEFAULT (datetime('now')))").run();
      await env.DB.prepare("INSERT OR IGNORE INTO email_suppressions (email, reason) VALUES (?, 'unsubscribed')").bind(email).run();
    }
    if (logEvent) await logEvent(env, { event_type: 'prefs_change', source: 'prefs', meta: { action } });
  }
  return page({ title: C.title, lines: [C[`saved_${action}`]] });
}
