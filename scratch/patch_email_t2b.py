import os

file_path = r'C:\Users\cente\sparkfare\src\email.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add sendPreDepartureSequenceEmail
new_function = """export async function sendPreDepartureSequenceEmail({ email, destination, departure_at, daysUntil, partner, trip_id, trip_length, passenger_count }, env = {}) {
  const resend = getResendClient(env);
  if (!resend) {
    return { ok: true, mocked: true, message: 'RESEND_API_KEY not set; sequence email mocked' };
  }

  const appUrl = env.APP_URL || process.env.APP_URL || 'https://sparkfare.com';
  const unsubscribeUrl = `${appUrl}/api/unsubscribe?email=${encodeURIComponent(email)}`;
  const departureDate = departure_at
    ? new Date(departure_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    : null;

  const title = `Your trip to ${destination} is in ${daysUntil} days`;
  const partnerHtml = partnersListHtml([partner], { appUrl, tripId: trip_id, partnerId: partner.slug });

  const response = await sendEmailWithGuard(resend, env, {
    from: env.EMAIL_FROM || process.env.EMAIL_FROM || 'Sparkfare <hello@sparkfare.com>',
    to: email,
    subject: `Prep for ${destination}: ${partner.name}`,
    html: emailShell(`
      ${disclosureHtml()}
      ${paragraphHtml(title + `. Here's one thing to check off your list before you go:`)}
      ${partnerHtml}
      ${openAppHtml(appUrl)}
      ${unsubscribeHtml(unsubscribeUrl)}
    `),
  });

  if (response.error) {
    throw new Error(`Resend rejected the send: ${response.error.message || JSON.stringify(response.error)}`);
  }

  return { ok: true, mocked: false, response };
}
"""

# Let's insert it at the bottom of the file
if "export async function sendPreDepartureSequenceEmail" not in content:
    content = content + "\n\n" + new_function
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Added sendPreDepartureSequenceEmail")
else:
    print("Already exists")
