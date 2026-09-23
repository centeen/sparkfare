import sys

# Patch index.html
with open(r'c:\Users\cente\sparkfare\index.html', 'r', encoding='utf-8') as f:
    content = f.read()

cookie_func = """function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}
const referralCode = new URLSearchParams(window.location.search).get('ref') || getCookie('ref');"""

content = content.replace("const referralCode = new URLSearchParams(window.location.search).get('ref');", cookie_func)

with open(r'c:\Users\cente\sparkfare\index.html', 'w', encoding='utf-8') as f:
    f.write(content)

# Patch src/index.js
with open(r'c:\Users\cente\sparkfare\src\index.js', 'r', encoding='utf-8') as f:
    src_content = f.read()

# Replace anti-abuse logic in /api/signup
old_logic = """        let referredBy = null;
        if (!existing && ref && ref !== userId) {
          const referrer = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(ref).first();
          if (referrer) {
            referredBy = ref;
          }
        } else if (existing) {
          storedEarlyAccess = existing.early_access ?? 0;
        }"""

new_logic = """        let referredBy = null;
        if (!existing && ref) {
          // Look up user_id from referral_codes
          const referrerRow = await env.DB.prepare('SELECT user_id FROM referral_codes WHERE code = ?').bind(ref).first();
          
          if (referrerRow) {
            const referrerId = referrerRow.user_id;
            
            // Check self-referral and IP abuse
            const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
            const ipHashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
            const ipHash = Array.from(new Uint8Array(ipHashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

            const ipCount = await env.DB.prepare(`
              SELECT count(*) as c FROM consent_log 
              WHERE ip_hash = ? AND source = 'referral_signup'
            `).bind(ipHash).first();
            
            if (referrerId !== userId && (!ipCount || ipCount.c < 3)) {
              referredBy = referrerId;
            }
          }
        } else if (existing) {
          storedEarlyAccess = existing.early_access ?? 0;
        }"""

src_content = src_content.replace(old_logic, new_logic)

# Replace INSERT INTO users to also INSERT INTO referrals
old_insert = """        const result = existing
          ? await env.DB.prepare(`
              UPDATE users SET origin_iata = ?, passenger_count = ?, trip_length = ?, subscription_tier = ?, verified_email = ?
              WHERE id = ?
            `).bind(origin_iata.toUpperCase(), safePassengerCount, trip_length, safeTier, resolvedVerified, resolvedId).run()
          : await env.DB.prepare(`
              INSERT INTO users (id, email, origin_iata, passenger_count, trip_length, subscription_tier, partner_id, referred_by, early_access, verified_email, verification_token)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              resolvedId,
              userEmail,
              origin_iata.toUpperCase(),
              safePassengerCount,
              trip_length,
              safeTier,
              newPartnerId,
              referredBy,
              storedEarlyAccess,
              resolvedVerified,
              verificationToken
            ).run();

        storedId = resolvedId;
        ctx.waitUntil(logEvent(env, { event_type: 'signup', user_id: storedId, origin: origin_iata.toUpperCase(), partner: newPartnerId }));"""

new_insert = """        const result = existing
          ? await env.DB.prepare(`
              UPDATE users SET origin_iata = ?, passenger_count = ?, trip_length = ?, subscription_tier = ?, verified_email = ?
              WHERE id = ?
            `).bind(origin_iata.toUpperCase(), safePassengerCount, trip_length, safeTier, resolvedVerified, resolvedId).run()
          : await env.DB.prepare(`
              INSERT INTO users (id, email, origin_iata, passenger_count, trip_length, subscription_tier, partner_id, referred_by, early_access, verified_email, verification_token)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              resolvedId,
              userEmail,
              origin_iata.toUpperCase(),
              safePassengerCount,
              trip_length,
              safeTier,
              newPartnerId,
              referredBy,
              storedEarlyAccess,
              resolvedVerified,
              verificationToken
            ).run();

        if (!existing && referredBy && result.success !== false) {
           await env.DB.prepare(`
             INSERT INTO referrals (id, referrer_id, referred_id, status)
             VALUES (?, ?, ?, 'pending')
           `).bind(crypto.randomUUID(), referredBy, resolvedId).run();
        }

        storedId = resolvedId;
        ctx.waitUntil(logEvent(env, { event_type: 'signup', user_id: storedId, origin: origin_iata.toUpperCase(), partner: newPartnerId }));"""

src_content = src_content.replace(old_insert, new_insert)

with open(r'c:\Users\cente\sparkfare\src\index.js', 'w', encoding='utf-8') as f:
    f.write(src_content)
