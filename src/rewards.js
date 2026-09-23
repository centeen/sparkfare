export async function getEntitlements(env, userId) {
  let confirmedCount = 0;
  if (env?.DB) {
    const result = await env.DB.prepare('SELECT COUNT(*) as c FROM referrals WHERE referrer_id = ? AND status = "confirmed"').bind(userId).first();
    confirmedCount = result?.c || 0;
  }

  return {
    confirmedReferrals: confirmedCount,
    maxOrigins: confirmedCount >= 1 ? 2 : 1,
    earlyBird: confirmedCount >= 3,
    earlyAccessFeatures: confirmedCount >= 5,
    foundingMemberBadge: confirmedCount >= 10,
  };
}
