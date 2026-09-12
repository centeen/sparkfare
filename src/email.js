import 'dotenv/config';
import { Resend } from 'resend';

function getResendClient(env) {
  const apiKey = env?.RESEND_API_KEY || process.env.RESEND_API_KEY;
  if (!apiKey) {
    return null;
  }

  return new Resend(apiKey);
}

// Workplan Step 100 (2026-09-12): brand styling for transactional emails, values taken directly
// from sparkfare_style_guide.md. Inline styles throughout, not a <style> block -- several major
// email clients (Outlook desktop, some webmail) strip <style> blocks or apply them
// unreliably, so inline is the only styling approach guaranteed to render everywhere. Every
// branded font declares a web-safe fallback so a client that can't load the Google Font still
// gets a reasonable sans-serif/monospace instead of a broken layout.
const EMAIL_COLORS = {
  paper: '#EDE6D6',
  ledger: '#2B2620',
  ledgerMuted: '#6B6255',
  line: '#DCD3BF',
  // The live site's established action color for links/CTAs -- not in the style guide document
  // itself, but used everywhere else on sparkfare.com, so emails stay consistent with it.
  sage: '#4F7A52',
};
const FONT_HEADLINE = "'Space Grotesk', Helvetica, Arial, sans-serif";
const FONT_BODY = "'Inter', Helvetica, Arial, sans-serif";
const FONT_NUMERALS = "'IBM Plex Mono', 'Courier New', monospace";

function emailShell(bodyHtml) {
  return `
    <div style="background:${EMAIL_COLORS.paper};padding:24px 16px;font-family:${FONT_BODY};">
      <div style="max-width:520px;margin:0 auto;">
        <p style="font-family:${FONT_HEADLINE};font-weight:500;font-size:18px;color:${EMAIL_COLORS.ledger};margin:0 0 20px;">Sparkfare</p>
        ${bodyHtml}
      </div>
    </div>
  `;
}

function disclosureHtml(text) {
  return `<p style="color:${EMAIL_COLORS.ledgerMuted};font-size:12px;line-height:1.5;margin:0 0 16px;">${text}</p>`;
}

function paragraphHtml(text) {
  return `<p style="color:${EMAIL_COLORS.ledger};font-size:15px;line-height:1.6;margin:0 0 16px;">${text}</p>`;
}

function linkHtml(href, text) {
  return `<a href="${href}" style="color:${EMAIL_COLORS.sage};">${text}</a>`;
}

function partnersListHtml(partners) {
  const items = partners.map((partner) => `
    <li style="margin:0 0 10px;color:${EMAIL_COLORS.ledger};font-size:15px;line-height:1.5;">
      <strong>${partner.name}</strong> — <span style="color:${EMAIL_COLORS.ledgerMuted};">${partner.blurb}</span> ${linkHtml(partner.link, 'Learn more')}
    </li>
  `).join('');
  return `<ul style="margin:0 0 16px;padding-left:20px;">${items}</ul>`;
}

function openAppHtml(appUrl) {
  return `<p style="margin:0 0 16px;">${linkHtml(appUrl, 'Open Sparkfare')}</p>`;
}

function unsubscribeHtml(url, label = 'Unsubscribe from Sparkfare emails') {
  return `<p style="margin:20px 0 0;border-top:1px solid ${EMAIL_COLORS.line};padding-top:16px;"><small style="color:${EMAIL_COLORS.ledgerMuted};font-size:12px;">${linkHtml(url, label)}</small></p>`;
}

export async function sendVerificationEmail({ email, verificationUrl }, env = {}) {
  const resend = getResendClient(env);
  if (!resend) {
    return { ok: true, mocked: true, message: 'RESEND_API_KEY not set; email mocked' };
  }

  const response = await resend.emails.send({
    from: env.EMAIL_FROM || process.env.EMAIL_FROM || 'Sparkfare <hello@sparkfare.com>',
    to: email,
    subject: 'Verify your Sparkfare account',
    html: emailShell(`
      ${paragraphHtml('Welcome to Sparkfare.')}
      ${paragraphHtml('Verify your email to start receiving deal alerts.')}
      <p style="margin:0 0 16px;">${linkHtml(verificationUrl, 'Verify my email')}</p>
    `),
  });

  if (response.error) {
    throw new Error(`Resend rejected the send: ${response.error.message || JSON.stringify(response.error)}`);
  }

  return { ok: true, mocked: false, response };
}

// Away Mode partner links -- only list a partner here once its real, approved affiliate
// link is in hand. A guessed or placeholder URL silently fails to track (same lesson as the
// Aviasales booking links: manually verify before trusting a link format).
const AWAY_MODE_PARTNERS = [
  {
    name: 'SafetyWing',
    blurb: 'Travel medical insurance built for people leaving home for a while.',
    link: 'https://safetywing.com/nomad-insurance?referenceID=26593442&utm_source=26593442&utm_medium=Ambassador',
  },
  {
    name: 'Bounce',
    blurb: 'Luggage storage by the hour, wherever you land — no need to kill time dragging a bag around.',
    link: 'https://go.bounce.com/SPARKFARE96253961631',
  },
  {
    name: 'US Global Mail',
    blurb: 'A virtual mailbox that opens, scans, and forwards your physical mail — so nothing piles up at home while you\'re away.',
    link: 'https://www.usglobalmail.com/?via=coby',
  },
  // Airalo (eSIM connectivity): Impact.com application declined 2026-09-11 -- a soft decline,
  // not permanent (they invited reapplying once there's more traffic/content). Add its tracking
  // link here only if a future application is actually approved.
  // Holafly (eSIM connectivity, chosen Airalo replacement, confirmed by the user 2026-09-11):
  // application submitted directly via Holafly's own affiliate portal, status PENDING as of
  // that date. Add its tracking link here only once actually approved -- do not guess.
];

// Records which publisher (if any) referred the recipient, for internal revenue-share
// accounting. This does NOT modify the actual outbound affiliate URLs above -- SafetyWing,
// Bounce, and US Global Mail's links are Coby's own personal referral links, not sub-ID-capable
// through a network, so an arbitrary partner_id query param would just be silently ignored by
// them (see workplan Step 91's own open dependency note). This log is Sparkfare's own separate
// record of "this send is attributable to partner X", used to manually reconcile what Sparkfare
// owes a publisher out of its own affiliate earnings -- a different, internal accounting
// question from what the affiliate networks themselves track.
async function logAwayModeEmail(env, { email, partnerId, emailType }) {
  if (!env?.DB) return;
  try {
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS away_mode_email_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        partner_id TEXT,
        email_type TEXT NOT NULL,
        sent_at TEXT DEFAULT (datetime('now'))
      )
    `).run();
    await env.DB.prepare(`
      INSERT INTO away_mode_email_log (email, partner_id, email_type) VALUES (?, ?, ?)
    `).bind(email, partnerId || null, emailType).run();
  } catch (error) {
    console.error('Away Mode email log write failed:', error);
  }
}

export async function sendAwayModeFollowUpEmail({ email, destination, departure_at, partner_id }, env = {}) {
  const resend = getResendClient(env);
  if (!resend) {
    return { ok: true, mocked: true, message: 'RESEND_API_KEY not set; away mode email mocked' };
  }

  const appUrl = env.APP_URL || process.env.APP_URL || 'https://sparkfare.com';
  const unsubscribeUrl = `${appUrl}/api/unsubscribe?email=${encodeURIComponent(email)}`;
  const departureDate = departure_at
    ? new Date(departure_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    : null;

  const response = await resend.emails.send({
    from: env.EMAIL_FROM || process.env.EMAIL_FROM || 'Sparkfare <hello@sparkfare.com>',
    to: email,
    subject: `Everything else, handled — before ${destination}`,
    html: emailShell(`
      ${disclosureHtml('Sparkfare may earn a commission on services booked through links in this email, at no extra cost to you.')}
      ${paragraphHtml(`You're booked for ${destination}${departureDate ? ` on ${departureDate}` : ''}. While that fare is locked in, here's what else is worth handling before you go:`)}
      ${partnersListHtml(AWAY_MODE_PARTNERS)}
      ${openAppHtml(appUrl)}
      ${unsubscribeHtml(unsubscribeUrl)}
    `),
  });

  if (response.error) {
    throw new Error(`Resend rejected the send: ${response.error.message || JSON.stringify(response.error)}`);
  }

  await logAwayModeEmail(env, { email, partnerId: partner_id, emailType: 'follow_up' });

  return { ok: true, mocked: false, response };
}

export async function sendBookingConfirmedEmail({ email, destination, partner_id }, env = {}) {
  const resend = getResendClient(env);
  if (!resend) {
    return { ok: true, mocked: true, message: 'RESEND_API_KEY not set; booking-confirmed email mocked' };
  }

  const appUrl = env.APP_URL || process.env.APP_URL || 'https://sparkfare.com';
  const unsubscribeUrl = `${appUrl}/api/unsubscribe?email=${encodeURIComponent(email)}`;

  const response = await resend.emails.send({
    from: env.EMAIL_FROM || process.env.EMAIL_FROM || 'Sparkfare <hello@sparkfare.com>',
    to: email,
    subject: `Booking confirmed — ${destination}`,
    html: emailShell(`
      ${paragraphHtml(`Your booking to ${destination} is confirmed. Have a great trip.`)}
      ${disclosureHtml('Sparkfare may earn a commission on services booked through links in this email, at no extra cost to you.')}
      ${paragraphHtml('Still time to handle the rest before you go:')}
      ${partnersListHtml(AWAY_MODE_PARTNERS)}
      ${openAppHtml(appUrl)}
      ${unsubscribeHtml(unsubscribeUrl)}
    `),
  });

  if (response.error) {
    throw new Error(`Resend rejected the send: ${response.error.message || JSON.stringify(response.error)}`);
  }

  await logAwayModeEmail(env, { email, partnerId: partner_id, emailType: 'booking_confirmed' });

  return { ok: true, mocked: false, response };
}

// Workplan Step 68. Distinct from the immediate post-click follow-up above (sendAwayMode
// FollowUpEmail) -- this fires close to the actual departure date, as a last-chance nudge for
// anything not yet handled, not right after booking. daysUntil is computed by the caller (see
// sendDepartingSoonAlerts in src/index.js) from the trip's real departure_at, not hardcoded,
// since the caller's query window can catch a trip anywhere from 0-3 days out depending on when
// the daily Cron first sees it.
export async function sendDepartingSoonEmail({ email, destination, departure_at, daysUntil, partner_id }, env = {}) {
  const resend = getResendClient(env);
  if (!resend) {
    return { ok: true, mocked: true, message: 'RESEND_API_KEY not set; departing-soon email mocked' };
  }

  const appUrl = env.APP_URL || process.env.APP_URL || 'https://sparkfare.com';
  const unsubscribeUrl = `${appUrl}/api/unsubscribe?email=${encodeURIComponent(email)}`;
  const departureDate = departure_at
    ? new Date(departure_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    : null;
  const timing = daysUntil <= 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`;

  const response = await resend.emails.send({
    from: env.EMAIL_FROM || process.env.EMAIL_FROM || 'Sparkfare <hello@sparkfare.com>',
    to: email,
    subject: `Departing ${timing} — ${destination}`,
    html: emailShell(`
      ${disclosureHtml('Sparkfare may earn a commission on services booked through links in this email, at no extra cost to you.')}
      ${paragraphHtml(`Your trip to ${destination}${departureDate ? ` (${departureDate})` : ''} departs ${timing}. Last call for anything still worth handling before you go:`)}
      ${partnersListHtml(AWAY_MODE_PARTNERS)}
      ${openAppHtml(appUrl)}
      ${unsubscribeHtml(unsubscribeUrl)}
    `),
  });

  if (response.error) {
    throw new Error(`Resend rejected the send: ${response.error.message || JSON.stringify(response.error)}`);
  }

  await logAwayModeEmail(env, { email, partnerId: partner_id, emailType: 'departing_soon' });

  return { ok: true, mocked: false, response };
}

export async function sendDailyDealEmail({ email, origin, deals }, env = {}) {
  const resend = getResendClient(env);
  if (!resend) {
    return { ok: true, mocked: true, message: 'RESEND_API_KEY not set; daily email mocked' };
  }

  const appUrl = env.APP_URL || process.env.APP_URL || 'https://sparkfare.com';
  const unsubscribeUrl = `${appUrl}/api/unsubscribe?email=${encodeURIComponent(email)}`;
  const dealHtml = (deals || []).slice(0, 3).map((deal) => `
    <li style="margin:0 0 12px;color:${EMAIL_COLORS.ledger};font-size:15px;line-height:1.5;">
      <strong>${deal.display_name}</strong> — <span style="font-family:${FONT_NUMERALS};">${deal.price ? '$' + Number(deal.price).toLocaleString('en-US') : 'N/A'}</span>
      <div>${deal.booking_link ? linkHtml(deal.booking_link, 'Book this fare') : ''}</div>
    </li>
  `).join('');

  const response = await resend.emails.send({
    from: env.EMAIL_FROM || process.env.EMAIL_FROM || 'Sparkfare <hello@sparkfare.com>',
    to: email,
    subject: `Sparkfare deals from ${origin}`,
    html: emailShell(`
      ${paragraphHtml(`Your saved origin is ${origin}.`)}
      ${disclosureHtml('Sparkfare may earn a commission on flights booked through links in this email, at no extra cost to you.')}
      <ul style="margin:0 0 16px;padding-left:20px;">${dealHtml}</ul>
      ${openAppHtml(appUrl)}
      ${unsubscribeHtml(unsubscribeUrl, 'Unsubscribe from daily deal emails')}
    `),
  });

  if (response.error) {
    throw new Error(`Resend rejected the send: ${response.error.message || JSON.stringify(response.error)}`);
  }

  return { ok: true, mocked: false, response };
}
