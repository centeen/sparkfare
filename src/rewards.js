// Watchlists: how many routes a person can watch at once. A watchlist counts while it is still watching; once it has
// reached its target and emailed, it stops counting. Three confirmed referrals raise the limit (the hub's tier 3).
export const WATCHLIST_LIMIT_FREE = 3;
export const WATCHLIST_LIMIT_REFERRED = 10;
export const REFERRALS_FOR_MORE_WATCHLISTS = 3;
export function watchlistLimitFor(confirmedCount) {
  return confirmedCount >= REFERRALS_FOR_MORE_WATCHLISTS ? WATCHLIST_LIMIT_REFERRED : WATCHLIST_LIMIT_FREE;
}

export async function getEntitlements(env, userId) {
  let confirmedCount = 0;
  if (env?.DB) {
    const result = await env.DB.prepare("SELECT COUNT(*) as c FROM referrals WHERE referrer_id = ? AND status = 'confirmed'").bind(userId).first();
    confirmedCount = result?.c || 0;
  }

  return {
    confirmedReferrals: confirmedCount,
    maxOrigins: confirmedCount >= 1 ? 2 : 1,
    maxWatchlists: watchlistLimitFor(confirmedCount),
    earlyAccessFeatures: confirmedCount >= 5,
    foundingMemberBadge: confirmedCount >= 10,
  };
}
