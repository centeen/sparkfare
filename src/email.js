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

  return { ok: true, mocked: false, response };
}
