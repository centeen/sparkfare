import os

file_path = r'C:\Users\cente\sparkfare\src\index.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the UPDATE and INSERT block in /api/signup

target = """        const result = existing
          ? await env.DB.prepare(`
              UPDATE users
              SET id = ?, verified_email = ?, origin_iata = ?, passenger_count = ?, trip_length = ?, subscription_tier = ?, unsubscribed_at = NULL
              WHERE email = ?
            `).bind(
              resolvedId,
              resolvedVerified,
              origin_iata.toUpperCase(),
              safePassengerCount,
              trip_length,
              safeTier,
              userEmail
            ).run()
          : await env.DB.prepare(`
              INSERT INTO users (
                id, email, verified_email, origin_iata, passenger_count, trip_length, subscription_tier, partner_id, early_access, referred_by
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              userId,
              userEmail,
              verifiedEmail,
              origin_iata.toUpperCase(),
              safePassengerCount,
              trip_length,
              safeTier,
              newPartnerId,
              storedEarlyAccess,
              referredBy
            ).run();

        storedId = resolvedId;
        ctx.waitUntil(logEvent(env, { event_type: 'signup', user_id: storedId, origin: origin_iata.toUpperCase(), partner: newPartnerId }));
        if (referredBy) {
          ctx.waitUntil(logEvent(env, { event_type: 'referral_signup', user_id: storedId, origin: origin_iata.toUpperCase(), meta: { referred_by: referredBy } }));
        }"""

replacement = """        let verificationToken = null;
        if (!session.authenticated && resolvedVerified === 0) {
           verificationToken = crypto.randomUUID();
        }

        const result = existing
          ? await env.DB.prepare(`
              UPDATE users
              SET id = ?, verified_email = ?, origin_iata = ?, passenger_count = ?, trip_length = ?, subscription_tier = ?, unsubscribed_at = NULL, verification_token = ?
              WHERE email = ?
            `).bind(
              resolvedId,
              resolvedVerified,
              origin_iata.toUpperCase(),
              safePassengerCount,
              trip_length,
              safeTier,
              verificationToken,
              userEmail
            ).run()
          : await env.DB.prepare(`
              INSERT INTO users (
                id, email, verified_email, origin_iata, passenger_count, trip_length, subscription_tier, partner_id, early_access, referred_by, verification_token
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              userId,
              userEmail,
              verifiedEmail,
              origin_iata.toUpperCase(),
              safePassengerCount,
              trip_length,
              safeTier,
              newPartnerId,
              storedEarlyAccess,
              referredBy,
              verificationToken
            ).run();

        storedId = resolvedId;
        ctx.waitUntil(logEvent(env, { event_type: 'signup', user_id: storedId, origin: origin_iata.toUpperCase(), partner: newPartnerId }));
        if (referredBy) {
          ctx.waitUntil(logEvent(env, { event_type: 'referral_signup', user_id: storedId, origin: origin_iata.toUpperCase(), meta: { referred_by: referredBy } }));
        }

        if (verificationToken) {
          const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
          const ipHashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
          const ipHash = Array.from(new Uint8Array(ipHashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
          
          ctx.waitUntil(env.DB.prepare(`INSERT INTO consent_log (id, user_id, email, source, wording_version, ip_hash) VALUES (?, ?, ?, ?, ?, ?)`).bind(
            crypto.randomUUID(), storedId, userEmail, referredBy ? 'referral_signup' : 'alert_signup', 'v1_double_optin', ipHash
          ).run());

          const verificationUrl = `${env.APP_URL || 'https://sparkfare.com'}/api/verify?token=${verificationToken}`;
          ctx.waitUntil(sendVerificationEmail({ email: userEmail, verificationUrl }, env));
        }"""

if target in content:
    content = content.replace(target, replacement)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Signup successfully patched")
else:
    print("Target not found")
