// Addendum Q, Q4 (D-049; Guard conditions, non-attorney guidance, verify with counsel): what every non-transactional email must carry, in one place.
//
// - A postal address in every commercial email (CAN-SPAM). `EMAIL_POSTAL_ADDRESS` is a Worker secret. When it is unset, non-transactional mail FAILS
//   CLOSED: the send is skipped and an `email_blocked_no_postal_address` event is logged (the 09:30 UTC data alert turns that into one owner email a day).
//   Transactional mail (verification, confirmations, the support reply) still sends: it is exempt from the rule and must never be blocked by it.
// - The footer is added at the one chokepoint every send goes through (`sendEmailWithGuard()`, plus the digest and newsletter batch paths), so a
//   template cannot forget it. A template that already renders the address itself (the v2 digest, the post-click checklist) is left alone.
import { escapeHtml } from './emailTemplates/helpers.js';

export const TRANSACTIONAL = 'transactional';
export const STREAMS = ['transactional', 'alert', 'trip', 'digest', 'care'];
// Where emailShell() leaves room for the footer, so it sits inside the card instead of below it.
export const POSTAL_FOOTER_MARKER = '<!--sf-postal-footer-->';

export const isTransactional = (stream) => stream === TRANSACTIONAL;

export function postalAddressOf(env) {
  const raw = env?.EMAIL_POSTAL_ADDRESS || (typeof process !== 'undefined' ? process.env?.EMAIL_POSTAL_ADDRESS : '') || '';
  const value = String(raw).trim();
  return value || null;
}

export function postalFooterHtml(address) {
  return `<p class="sf-muted" style="margin:20px 0 0;font-size:12px;line-height:18px;color:#5A4C3C;">Sparkfare &middot; ${escapeHtml(address)}</p>`;
}

/** The message with the postal address in both parts. Idempotent: a part that already carries the address is left as it is. */
export function withPostalAddress({ html, text }, address) {
  let outHtml = html;
  if (typeof html === 'string' && address) {
    if (html.includes(escapeHtml(address))) outHtml = html.split(POSTAL_FOOTER_MARKER).join('');
    else if (html.includes(POSTAL_FOOTER_MARKER)) outHtml = html.replace(POSTAL_FOOTER_MARKER, postalFooterHtml(address));
    else outHtml = `${html}${postalFooterHtml(address)}`;
  }
  let outText = text;
  if (typeof text === 'string' && address && !text.includes(address)) outText = `${text}\n\nSparkfare, ${address}`;
  return { html: outHtml, text: outText };
}

/** One `email_blocked_no_postal_address` event per skipped send (counts only: the stream, never an address). Never throws. */
export async function logBlockedNoPostalAddress(env, stream) {
  if (!env?.DB) return;
  try {
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY, event_type TEXT NOT NULL, user_id TEXT, anon_id TEXT, origin TEXT, route TEXT, partner TEXT, sub_id TEXT, source TEXT, meta TEXT,
        ts TEXT DEFAULT (datetime('now'))
      )`).run();
    await env.DB.prepare("INSERT INTO events (id, event_type, source, meta) VALUES (lower(hex(randomblob(16))), 'email_blocked_no_postal_address', 'email', ?)")
      .bind(JSON.stringify({ stream: stream || 'unclassified' })).run();
  } catch (error) { console.error('email_blocked_no_postal_address log failed:', error); }
}

export const BLOCKED_NO_POSTAL_MESSAGE = 'Blocked: EMAIL_POSTAL_ADDRESS is not set, so this non-transactional email was not sent.';
