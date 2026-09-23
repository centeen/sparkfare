import os

file_path = r'C:\Users\cente\sparkfare\src\email.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target = """export async function sendPreDepartureSequenceEmail({ email, destination, departure_at, daysUntil, partner, trip_id, trip_length, passenger_count }, env = {}) {"""

replacement = """export async function sendPreDepartureSequenceEmail({ email, destination, departure_at, daysUntil, excludedPartnerIds = [], trip_id, trip_length, passenger_count }, env = {}) {
  const resend = getResendClient(env);
  if (!resend) {
    return { ok: true, mocked: true, message: 'RESEND_API_KEY not set; sequence email mocked' };
  }

  const activePartners = await getAwayModePartners(env);
  let available = activePartners;
  if (excludedPartnerIds.length > 0) {
    const filtered = activePartners.filter(p => !excludedPartnerIds.includes(p.slug));
    if (filtered.length > 0) available = filtered;
  }
  const partners = prioritizePartners(available, trip_length);
  const partner = partners[0];
  if (!partner) {
    return { ok: false, error: new Error('No live partners available') };
  }
"""

if target in content:
    content = content.replace(target, replacement)
    
    # Also we need to log it!
    log_target = """  if (response.error) {
    throw new Error(`Resend rejected the send: ${response.error.message || JSON.stringify(response.error)}`);
  }

  return { ok: true, mocked: false, response };"""

    log_replacement = """  if (response.error) {
    throw new Error(`Resend rejected the send: ${response.error.message || JSON.stringify(response.error)}`);
  }

  await logAwayModeEmail(env, { email, partnerId: partner.slug, emailType: 'pre_departure_day_' + daysUntil });

  return { ok: true, mocked: false, response, partner_slug: partner.slug };"""

    content = content.replace(log_target, log_replacement)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Patched email.js part 2")
else:
    print("Target not found in email.js")
