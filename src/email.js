import 'dotenv/config';
import { Resend } from 'resend';

function getResendClient(env) {
  const apiKey = env?.RESEND_API_KEY || process.env.RESEND_API_KEY;
  if (!apiKey) {
    return null;
  }

  return new Resend(apiKey);
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
    html: `
      <p>Welcome to Sparkfare.</p>
      <p>Verify your email to start receiving deal alerts.</p>
      <p><a href="${verificationUrl}">Verify my email</a></p>
    `,
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
  // Airalo (eSIM connectivity): affiliate application is still "waiting for approval" in
  // Impact.com as of 2026-09-05. Add its tracking link here once approved.
];

export async function sendAwayModeFollowUpEmail({ email, destination, departure_at }, env = {}) {
  const resend = getResendClient(env);
  if (!resend) {
    return { ok: true, mocked: true, message: 'RESEND_API_KEY not set; away mode email mocked' };
  }

  const appUrl = env.APP_URL || process.env.APP_URL || 'https://sparkfare.com';
  const unsubscribeUrl = `${appUrl}/api/unsubscribe?email=${encodeURIComponent(email)}`;
  const departureDate = departure_at
    ? new Date(departure_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    : null;

  const partnersHtml = AWAY_MODE_PARTNERS.map((partner) => `
    <li><strong>${partner.name}</strong> — ${partner.blurb} <a href="${partner.link}">Learn more</a></li>
  `).join('');

  const response = await resend.emails.send({
    from: env.EMAIL_FROM || process.env.EMAIL_FROM || 'Sparkfare <hello@sparkfare.com>',
    to: email,
    subject: `Everything else, handled — before ${destination}`,
    html: `
      <p><small>Sparkfare may earn a commission on services booked through links in this email, at no extra cost to you.</small></p>
      <p>You're booked for ${destination}${departureDate ? ` on ${departureDate}` : ''}. While that fare is locked in, here's what else is worth handling before you go:</p>
      <ul>${partnersHtml}</ul>
      <p><a href="${appUrl}">Open Sparkfare</a></p>
      <p><small><a href="${unsubscribeUrl}">Unsubscribe from Sparkfare emails</a></small></p>
    `,
  });

  if (response.error) {
    throw new Error(`Resend rejected the send: ${response.error.message || JSON.stringify(response.error)}`);
  }

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
    <li>
      <strong>${deal.display_name}</strong> — ${deal.price ? '$' + Number(deal.price).toLocaleString('en-US') : 'N/A'}
      <div>${deal.booking_link ? `<a href="${deal.booking_link}">Book this fare</a>` : ''}</div>
    </li>
  `).join('');

  const response = await resend.emails.send({
    from: env.EMAIL_FROM || process.env.EMAIL_FROM || 'Sparkfare <hello@sparkfare.com>',
    to: email,
    subject: `Sparkfare deals from ${origin}`,
    html: `
      <p>Your saved origin is ${origin}.</p>
      <p><small>Sparkfare may earn a commission on flights booked through links in this email, at no extra cost to you.</small></p>
      <ul>${dealHtml}</ul>
      <p><a href="${appUrl}">Open Sparkfare</a></p>
      <p><small><a href="${unsubscribeUrl}">Unsubscribe from daily deal emails</a></small></p>
    `,
  });

  if (response.error) {
    throw new Error(`Resend rejected the send: ${response.error.message || JSON.stringify(response.error)}`);
  }

  return { ok: true, mocked: false, response };
}
