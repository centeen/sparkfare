// C1.4 (G116): the v2 lifecycle email anatomy. Flag ENABLE_LIFECYCLE_V2 (exact string "true"). Off: every email is as before.
export const lifecycleV2Enabled = (env) => env?.ENABLE_LIFECYCLE_V2 === 'true';

const LONG = ['11-14', '2+ weeks', '30_plus'];

/** The slug that should lead, or null when nothing in the context points at one. Pure. */
export function leadSlugFor({ tripLength = null, passengerCount = null, daysUntil = null } = {}) {
  if (daysUntil !== null && daysUntil <= 2) return 'bounce'; // the night before: bags
  if (daysUntil !== null && daysUntil <= 9) return tripLength === 'weekend' ? 'bounce' : 'yesim'; // the last week: phone and data
  if (Number(passengerCount) >= 3) return 'airhelp'; // a larger party: delay compensation applies per traveler
  if (tripLength === 'weekend') return 'bounce';
  if (LONG.includes(tripLength)) return 'us-global-mail'; // mail piles up on a long absence
  return null;
}

/** At most one partner: the lead for this context when it is available, else the first available. Pure. */
export function pickLifecyclePartner(partners, context) {
  if (!Array.isArray(partners) || partners.length === 0) return [];
  const slug = leadSlugFor(context);
  const lead = slug ? partners.find((p) => p.slug === slug) : null;
  return [lead || partners[0]];
}
