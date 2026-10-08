// Writes the four Away Mode lifecycle emails to tmp/email-previews/away-*.html (nothing is sent).
// Usage: node scripts/preview-away-emails.mjs
import fs from 'node:fs';
import {
  sendStressValveEmail, sendDepartureBriefingEmail, sendDepartingSoonEmail, sendPreDepartureSequenceEmail,
} from '../src/email.js';

const out = new URL('../tmp/email-previews/', import.meta.url);
fs.mkdirSync(out, { recursive: true });
const real = globalThis.fetch;
let captured = null;
globalThis.fetch = async (url, options) => {
  if (String(url).includes('api.resend.com/emails')) {
    captured = JSON.parse(options.body);
    return new Response(JSON.stringify({ id: 'preview' }), { status: 200 });
  }
  return real(url, options);
};
const trip = { email: 'preview@example.com', trip_id: 'preview', destination: 'Lisbon, Portugal', departure_at: '2026-11-27T10:00:00-05:00', daysUntil: 7, passenger_count: 1 };
const env = { RESEND_API_KEY: 'preview', APP_URL: 'https://sparkfare.com' };
for (const [name, fn] of [
  ['stress-valve', sendStressValveEmail], ['departure-briefing', sendDepartureBriefingEmail],
  ['departing-soon', sendDepartingSoonEmail], ['pre-departure-sequence', sendPreDepartureSequenceEmail],
]) {
  await fn(trip, env);
  fs.writeFileSync(new URL(`away-${name}.html`, out), captured.html);
  console.log(`away-${name}.html  subject: ${captured.subject}`);
}
