import 'dotenv/config';
import { sendVerificationEmail, sendDailyDealEmail, sendAwayModeFollowUpEmail, sendBookingConfirmedEmail, sendDepartingSoonEmail, sendSunsetEmail, sendTargetReachedEmail, sendStressValveEmail, sendDepartureBriefingEmail, sendRouteRetrospectiveEmail, AWAY_MODE_PARTNERS } from './email.js';
import { Webhook } from 'standardwebhooks';
import { Resend } from 'resend';

// TLV (Tel Aviv) is a deliberate 13th origin, added for a small group of design-partner
// testers -- not a real US-market decision. See CLAUDE.md's "Decisions locked" section.
const VALID_ORIGINS = new Set([
  'JFK','LAX','ORD','ATL','DFW','SFO','MIA','IAD','EWR','SEA','IAH','BOS','TLV'
]);

// Workplan Step 93: the "Early Bird" referral loop's early-access digest, one hour ahead of the
// general 08:00 UTC send. Must be added to wrangler.jsonc's crons array verbatim -- this string
// is how scheduled() below tells the two triggers apart.
const EARLY_DIGEST_CRON = '0 7 * * *';

// Workplan Step 117 (GTM Plan Update, Phase 19). Monday 09:00 UTC -- must match wrangler.jsonc's
// crons array exactly, same drift risk already documented for EARLY_DIGEST_CRON above.
const WEEKLY_LINK_HEALTH_CRON = '0 9 * * 1';

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Workplan Step 106b -- Passenger Count (roadmap "Group Travel Multiplier"). Clamped to a sane
// 1-9 range rather than trusted as-is: it flows straight into affiliate-copy math ("insure all N
// passengers"), so a garbage or absurd value would corrupt real email content, not just a stored
// number. Defaults to 1 (a solo traveler) whenever omitted -- matches the DB column's own
// DEFAULT 1, so a signup source that never sends this field (the anonymous pSEO landing pages,
// deliberately -- see CLAUDE.md) still gets a sane value with no extra code needed.
function normalizePassengerCount(value) {
  if (value === undefined || value === null || value === '') return 1;
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, 9);
}

function withTripMarker(bookingLink, tripId) {
  const url = new URL(bookingLink);
  if (url.hostname !== 'www.aviasales.com') throw new Error('Invalid booking link');
  url.searchParams.set('marker', `314524.${tripId}`);
  return url.toString();
}

async function loadJsonAsset(env, filename) {
  if (!env?.ASSETS) return {};
  const response = await env.ASSETS.fetch(new Request(`https://sparkfare.local/${filename}`));
  if (!response.ok) return {};
  return response.json();
}

// Workplan Step 67 (free/paid serving-layer split). A "soft" gate, deliberately -- there's no
// billing yet, so nobody actually has subscription_tier = 'paid' in production today, and the
// underlying JSON files themselves stay public static assets exactly as they already are (same
// non-technical-secrecy precedent already used for the TLV origin: nothing to protect until
// someone has actually paid for it). This just builds the real serving distinction the "Decisions
// locked" tier split describes, so it exists and is tested before there's a paying customer to
// build it against blind.
function filterDealsByOrigin(combined, origin) {
  const pick = (list) => (list || []).filter((record) => record.origin === origin);
  return {
    deals: pick(combined.deals),
    featured: pick(combined.featured),
    priced_no_deal: pick(combined.priced_no_deal),
    insufficient_history: pick(combined.insufficient_history),
    no_data: pick(combined.no_data),
  };
}

// Shared by /api/deals and the Step 115 watchlist checker below -- same tier/origin freshness
// split either way. Extracted so watchlists can't accidentally become a backdoor to hourly-fresh
// data for free users; a watchlist's alert-worthiness is checked against exactly the same file a
// free or paid user would actually see on the board for that origin.
function rankedDealsFilename(tier, origin) {
  return tier === 'paid'
    ? 'sparkfare_hourly_ranked_deals.json'
    : (origin === 'JFK' ? 'sparkfare_ranked_deals.json' : 'sparkfare_ranked_deals_other_origins.json');
}

// Searches every priced category (deals/featured/priced_no_deal) for a specific route -- not
// insufficient_history or no_data, since neither carries a real, current price a target-price
// comparison could trust.
function findRouteRecord(combined, origin, destination) {
  const searchable = [
    ...(combined.deals || []),
    ...(combined.featured || []),
    ...(combined.priced_no_deal || []),
  ];
  return searchable.find((record) => record.origin === origin && record.display_name === destination) || null;
}

// Workplan Step 116 (GTM Plan Update, Phase 19 -- "The Sparkfare Index"). The inverse of a deal:
// routes where today's price sits ABOVE its own 30-day trailing average, not below it -- "how
// overpriced is this route right now," a genuinely different metric from pct_below_avg (which is
// undefined/irrelevant for a route that isn't a deal at all). Reads both the JFK daily file and
// the 24h-delayed combined file for the other 11 US origins -- the same two-file split already
// documented for the pSEO generator (Step 106) -- and deliberately excludes TLV, consistent with
// its existing de-prioritized/not-marketed status (TLV is excluded from every public-facing
// surface, this dashboard included). Only records with a real trailing_avg (deals/featured/
// priced_no_deal) are considered -- insufficient_history/no_data records have nothing to compare.
export async function computePriceGougingWatchlist(env) {
  const [jfk, others] = await Promise.all([
    loadJsonAsset(env, 'sparkfare_ranked_deals.json'),
    loadJsonAsset(env, 'sparkfare_ranked_deals_other_origins.json'),
  ]);

  const allRecords = [
    ...(jfk.deals || []), ...(jfk.featured || []), ...(jfk.priced_no_deal || []),
    ...(others.deals || []), ...(others.featured || []), ...(others.priced_no_deal || []),
  ];

  const withGougeRatio = allRecords
    .filter((record) => typeof record.price === 'number' && typeof record.trailing_avg === 'number' && record.trailing_avg > 0)
    .map((record) => ({
      origin: record.origin,
      destination: record.display_name,
      price: record.price,
      trailingAvg: record.trailing_avg,
      pctAboveAvg: (record.price - record.trailing_avg) / record.trailing_avg,
      bookingLink: record.booking_link || null,
    }))
    .filter((record) => record.pctAboveAvg > 0)
    .sort((a, b) => b.pctAboveAvg - a.pctAboveAvg);

  return {
    generated_at: new Date().toISOString(),
    watchlist: withGougeRatio.slice(0, 5),
  };
}

function priceGougingIndexHtml(data) {
  const rows = data.watchlist.map((route) => `
    <tr>
      <td>${route.origin} → ${route.destination}</td>
      <td style="font-family:'IBM Plex Mono','Courier New',monospace;">$${Number(route.price).toLocaleString('en-US')}</td>
      <td style="font-family:'IBM Plex Mono','Courier New',monospace;">$${Number(route.trailingAvg).toFixed(0)}</td>
      <td>+${Math.round(route.pctAboveAvg * 100)}%</td>
    </tr>
  `).join('');

  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>The Sparkfare Index | Sparkfare</title>
<style>
  body{margin:0;background:#E8DCC5;color:#2E2318;font:16px 'Segoe UI',sans-serif;}
  .wrap{max-width:760px;margin:0 auto;padding:48px 20px 80px;}
  h1{font-size:2rem;letter-spacing:-0.03em;margin:0 0 8px;}
  .sub{color:#6B5A45;margin:0 0 24px;max-width:56ch;}
  table{width:100%;border-collapse:collapse;background:#FAF6EE;border:1px solid #D9CBB0;border-radius:6px;overflow:hidden;}
  th,td{text-align:left;padding:12px 14px;border-bottom:1px solid #D9CBB0;font-size:0.92rem;}
  th{color:#6B5A45;font-weight:600;font-size:0.8rem;text-transform:uppercase;letter-spacing:0.04em;}
  tr:last-child td{border-bottom:none;}
  a{color:#4F7A52;}
</style></head>
<body><div class="wrap">
  <h1>The Sparkfare Index</h1>
  <p class="sub">The 5 routes currently priced furthest above their own 30-day trailing average, across our tracked origins. Updated whenever this page is requested. <a href="/">See today's real deals →</a></p>
  <table>
    <thead><tr><th>Route</th><th>Today</th><th>30-day avg</th><th>Above avg</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="4">No priced routes are currently above their trailing average.</td></tr>'}</tbody>
  </table>
</div></body></html>`;
}

// Workplan Step 122 (GTM Launch Plan, Phase 20 -- Zero-CAC KPI dashboard), scoped with the user
// directly 2026-09-13: the source doc's 3 categories (Acquisition Velocity via organic search
// impressions/co-registration/social clicks, Viral Coefficient, Away Mode revenue ARPU) can't all
// be built from real data today -- there's no analytics/Search Console API integration anywhere
// in this project, and Steps 107/108 (the social broadcaster and co-registration) are themselves
// still blocked on external API credentials that don't exist. Away Mode ARPU specifically can't
// be computed either: SafetyWing/Bounce/US Global Mail are Coby's personal referral links with no
// sub-ID tracking, the exact gap step92_revenue_share_tradeoffs.md already documents in detail.
// Built from real D1 data only, per the user's explicit choice -- every number here is real,
// gaps are labeled as not-yet-tracked rather than guessed at:
//   - Viral Coefficient -> the real Early Bird referral mechanics (Step 93): how many users have
//     successfully referred at least one friend, and what fraction of all signups arrived via a
//     referral.
//   - Acquisition Velocity -> pSEO signup volume (Step 106's partner_id: 'pseo' tag) stands in for
//     the undoable "organic search impressions" metric -- it's the one acquisition number this
//     project can actually attribute today.
//   - Revenue -> real flight-booking revenue per user (trips.price_eur from reconcileBookings,
//     Step 101) stands in for the undoable "Away Mode ARPU".
export async function computeKPIs(env) {
  if (!env?.DB) return null;

  const scalar = async (sql, fallback = 0) => {
    try {
      const row = await env.DB.prepare(sql).first();
      const value = row ? Object.values(row)[0] : null;
      return typeof value === 'number' ? value : fallback;
    } catch (error) {
      console.error(`KPI query failed (${sql}):`, error.message);
      return fallback;
    }
  };

  const totalUsers = await scalar('SELECT COUNT(*) FROM users');
  const verifiedUsers = await scalar('SELECT COUNT(*) FROM users WHERE verified_email = 1');
  const activeSubscribers = await scalar('SELECT COUNT(*) FROM users WHERE is_subscribed = 1');
  const earlyAccessUsers = await scalar('SELECT COUNT(*) FROM users WHERE early_access = 1');
  const uniqueReferrers = await scalar('SELECT COUNT(DISTINCT referred_by) FROM users WHERE referred_by IS NOT NULL');
  const referredSignups = await scalar('SELECT COUNT(*) FROM users WHERE referred_by IS NOT NULL');
  const pseoSignups = await scalar("SELECT COUNT(*) FROM users WHERE partner_id = 'pseo'");

  const totalTrips = await scalar('SELECT COUNT(*) FROM trips');
  const bookedTrips = await scalar("SELECT COUNT(*) FROM trips WHERE status = 'booked'");
  const totalRevenueEur = await scalar("SELECT COALESCE(SUM(price_eur), 0) FROM trips WHERE status = 'booked' AND price_eur IS NOT NULL");

  const totalWatchlists = await scalar('SELECT COUNT(*) FROM watchlists');
  const notifiedWatchlists = await scalar('SELECT COUNT(*) FROM watchlists WHERE notified_at IS NOT NULL');

  return {
    generated_at: new Date().toISOString(),
    viral: {
      unique_referrers: uniqueReferrers,
      referred_signups: referredSignups,
      total_users: totalUsers,
      referrer_rate: totalUsers > 0 ? uniqueReferrers / totalUsers : 0,
      viral_coefficient: totalUsers > 0 ? referredSignups / totalUsers : 0,
      early_access_users: earlyAccessUsers,
    },
    acquisition: {
      pseo_signups: pseoSignups,
      total_users: totalUsers,
      verified_users: verifiedUsers,
      active_subscribers: activeSubscribers,
    },
    revenue: {
      total_trips: totalTrips,
      booked_trips: bookedTrips,
      booking_conversion_rate: totalTrips > 0 ? bookedTrips / totalTrips : 0,
      total_revenue_eur: totalRevenueEur,
      revenue_per_active_subscriber_eur: activeSubscribers > 0 ? totalRevenueEur / activeSubscribers : 0,
    },
    watchlists: {
      total: totalWatchlists,
      notified: notifiedWatchlists,
    },
  };
}

function kpiDashboardHtml(kpi) {
  const pct = (n) => `${(n * 100).toFixed(1)}%`;
  const eur = (n) => `€${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

  const card = (label, value, note) => `
    <div class="kpi-card">
      <p class="kpi-label">${label}</p>
      <p class="kpi-value">${value}</p>
      ${note ? `<p class="kpi-note">${note}</p>` : ''}
    </div>
  `;

  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Zero-CAC KPIs | Sparkfare</title>
<meta name="robots" content="noindex, nofollow">
<style>
  body{margin:0;background:#E8DCC5;color:#2E2318;font:16px 'Segoe UI',sans-serif;}
  .wrap{max-width:900px;margin:0 auto;padding:48px 20px 80px;}
  h1{font-size:1.8rem;letter-spacing:-0.03em;margin:0 0 4px;}
  h2{font-size:1.1rem;margin:32px 0 12px;}
  .sub{color:#6B5A45;margin:0 0 8px;font-size:0.85rem;}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;}
  .kpi-card{background:#FAF6EE;border:1px solid #D9CBB0;border-radius:6px;padding:16px 18px;}
  .kpi-label{color:#6B5A45;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.04em;margin:0 0 6px;}
  .kpi-value{font-family:'IBM Plex Mono','Courier New',monospace;font-size:1.5rem;margin:0;}
  .kpi-note{color:#605142;font-size:0.78rem;margin:6px 0 0;}
  .gap-note{background:#FAF6EE;border:1px dashed #D9CBB0;border-radius:6px;padding:14px 18px;font-size:0.85rem;color:#605142;margin-top:32px;}
</style></head>
<body><div class="wrap">
  <h1>Zero-CAC KPIs</h1>
  <p class="sub">Generated ${kpi.generated_at}. Every number below is computed directly from real D1 data -- nothing here is estimated or fabricated.</p>

  <h2>Viral Coefficient (Early Bird referral loop)</h2>
  <div class="grid">
    ${card('Users who referred someone', kpi.viral.unique_referrers, `${pct(kpi.viral.referrer_rate)} of all users`)}
    ${card('Signups via referral', kpi.viral.referred_signups, `${pct(kpi.viral.viral_coefficient)} of all users`)}
    ${card('Early-access users', kpi.viral.early_access_users, 'referrer + referred, combined')}
  </div>

  <h2>Acquisition Velocity</h2>
  <div class="grid">
    ${card('pSEO signups', kpi.acquisition.pseo_signups, "partner_id = 'pseo' (Step 106)")}
    ${card('Total users', kpi.acquisition.total_users)}
    ${card('Verified users', kpi.acquisition.verified_users)}
    ${card('Active subscribers', kpi.acquisition.active_subscribers, 'is_subscribed = 1 (not sunset-pruned)')}
  </div>

  <h2>Revenue</h2>
  <div class="grid">
    ${card('Booked trips', kpi.revenue.booked_trips, `${pct(kpi.revenue.booking_conversion_rate)} of ${kpi.revenue.total_trips} tracked clicks`)}
    ${card('Total flight revenue', eur(kpi.revenue.total_revenue_eur), 'from reconciled Travelpayouts bookings')}
    ${card('Revenue per active subscriber', eur(kpi.revenue.revenue_per_active_subscriber_eur))}
  </div>

  <h2>Watchlists (Step 115)</h2>
  <div class="grid">
    ${card('Total watchlists', kpi.watchlists.total)}
    ${card('Target reached', kpi.watchlists.notified)}
  </div>

  <p class="gap-note">Not tracked here, by design: organic search impressions and social referral clicks
  (no analytics/Search Console API integration exists yet), co-registration lead volume (Step 108,
  blocked on a SparkLoop/Beehiiv account), and full Away Mode affiliate ARPU (SafetyWing/Bounce/US
  Global Mail are personal referral links with no sub-ID tracking -- see
  step92_revenue_share_tradeoffs.md). Revenue above covers flight bookings only.</p>
</div></body></html>`;
}

// Workplan Steps 123-126 (Business Plan V2.0, Module A -- the 45-day sunset policy). Protects the
// domain's sender score by pausing users who haven't opened an email in 45 days, before Gmail/
// Apple Mail start flagging the daily send as spam on their behalf. Only considers accounts old
// enough to have had a real 45-day chance to open something -- a brand-new signup with no
// last_opened_at yet (NULL, since nothing has arrived for them to open) must not be pruned just
// because the column is empty. Idempotent by construction: once is_subscribed flips to 0, the
// WHERE clause below no longer matches that user on a later run, so the goodbye email only ever
// fires once per person, without needing a separate delivery-log table.
const SUNSET_INACTIVE_AFTER_DAYS = 45;

export async function pruneInactiveSubscribers(env) {
  if (!env?.DB) return { pruned: 0 };

  const candidates = await env.DB.prepare(`
    SELECT email FROM users
    WHERE is_subscribed = 1
      AND created_at <= datetime('now', '-' || ? || ' days')
      AND (last_opened_at IS NULL OR last_opened_at <= datetime('now', '-' || ? || ' days'))
  `).bind(SUNSET_INACTIVE_AFTER_DAYS, SUNSET_INACTIVE_AFTER_DAYS).all();

  let pruned = 0;
  for (const candidate of candidates.results || []) {
    const result = await env.DB.prepare(
      'UPDATE users SET is_subscribed = 0 WHERE email = ? AND is_subscribed = 1'
    ).bind(candidate.email).run();
    if (!result?.success || !result.meta?.changes) continue;
    pruned += 1;
    try {
      await sendSunsetEmail({ email: candidate.email }, env);
    } catch (error) {
      console.error(`Sunset email failed for ${candidate.email}:`, error);
    }
  }
  return { pruned };
}

// Workplan Step 115 (Business Plan V2.0, Module B -- target-price watchlists, moved to
// launch-blocker priority given the CTR gap between the general digest (~5%) and personalized
// alerts like this one (35%+ target)). Fires the "Target Reached" email exactly once per
// watchlist -- notified_at IS NULL is both the query filter and the flag flipped right after a
// successful send, the same idempotency shape already used for the sunset pruning above, so no
// separate delivery-log table is needed. Deliberately checks each watchlist against the SAME
// tier-appropriate file a user would actually see on the board (rankedDealsFilename) rather than
// always reading the hourly file -- otherwise a free-tier watchlist would quietly become a
// backdoor to hourly-fresh data the free tier isn't supposed to have.
export async function checkWatchlists(env) {
  if (!env?.DB) return { checked: 0, notified: 0 };

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS watchlists (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      origin_iata TEXT NOT NULL,
      destination TEXT NOT NULL,
      target_price INTEGER NOT NULL,
      notified_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

  const watchlists = await env.DB.prepare(`
    SELECT w.id AS id, w.origin_iata AS origin_iata, w.destination AS destination,
           w.target_price AS target_price, u.email AS email, u.subscription_tier AS subscription_tier
    FROM watchlists w
    JOIN users u ON u.id = w.user_id
    WHERE w.notified_at IS NULL
  `).all();

  const rows = watchlists.results || [];
  if (rows.length === 0) return { checked: 0, notified: 0 };

  const fileCache = new Map();
  let notified = 0;

  for (const row of rows) {
    const tier = row.subscription_tier === 'paid' ? 'paid' : 'free';
    const filename = rankedDealsFilename(tier, row.origin_iata);
    if (!fileCache.has(filename)) {
      fileCache.set(filename, await loadJsonAsset(env, filename));
    }
    const combined = fileCache.get(filename);
    const record = findRouteRecord(combined, row.origin_iata, row.destination);
    if (!record || typeof record.price !== 'number' || record.price > row.target_price) continue;

    const result = await env.DB.prepare(
      "UPDATE watchlists SET notified_at = datetime('now') WHERE id = ? AND notified_at IS NULL"
    ).bind(row.id).run();
    if (!result?.success || !result.meta?.changes) continue;

    try {
      await sendTargetReachedEmail({
        email: row.email,
        origin: row.origin_iata,
        destination: row.destination,
        price: record.price,
        targetPrice: row.target_price,
        bookingLink: record.booking_link,
      }, env);
      notified += 1;
    } catch (error) {
      console.error(`Target-reached email failed for ${row.email}:`, error);
    }
  }

  return { checked: rows.length, notified };
}

// Workplan Step 93 (2026-09-12): earlyOnly powers the "Early Bird" referral loop's early-access
// digest send. It reuses this same function and the existing daily_alert_deliveries idempotency
// table rather than adding a parallel send path -- an early_access user who already has a
// status='sent' row for today (from the early run) is automatically skipped when the general run
// calls this again later, for free, via the existing per-day dedupe below. This is what makes
// "ahead of the general send" literally true rather than cosmetic: the early run uses a genuinely
// earlier Cron Trigger (see EARLY_DIGEST_CRON / wrangler.jsonc), not just a different sort order
// within one send.
// Workplan Step 109 (GTM Plan Update, Phase 18 -- Early Bird FOMO banner). Snapshots each route's
// price at the 07:00 Early Bird run, keyed by (route_key, snapshot_date), so the 08:00 general run
// can diff against it and tell a recipient their top deal already moved. Per-route, not per-user
// -- both runs currently read from the same `deals` array (see the flagged, separately-tracked
// bug about sendDailyAlerts not actually varying that array by origin yet), so a per-route
// snapshot is the correct granularity regardless of how that gets fixed later.
async function snapshotEarlyBirdPrices(env, deals, snapshotDate) {
  if (!env?.DB) return;
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS early_bird_snapshots (
      route_key TEXT NOT NULL,
      snapshot_date TEXT NOT NULL,
      price INTEGER,
      PRIMARY KEY (route_key, snapshot_date)
    )
  `).run();
  for (const deal of deals) {
    if (!deal.route_key || typeof deal.price !== 'number') continue;
    await env.DB.prepare(`
      INSERT OR REPLACE INTO early_bird_snapshots (route_key, snapshot_date, price) VALUES (?, ?, ?)
    `).bind(deal.route_key, snapshotDate, deal.price).run();
  }
}

async function getEarlyBirdPriceJump(env, deal, snapshotDate) {
  if (!env?.DB || !deal?.route_key || typeof deal.price !== 'number') return null;
  const snapshot = await env.DB.prepare(
    'SELECT price FROM early_bird_snapshots WHERE route_key = ? AND snapshot_date = ?'
  ).bind(deal.route_key, snapshotDate).first();
  if (!snapshot || typeof snapshot.price !== 'number' || snapshot.price >= deal.price) return null;
  return { destination: deal.display_name, from: snapshot.price, to: deal.price };
}

export async function sendDailyAlerts(env, { earlyOnly = false } = {}) {
  if (!env?.DB) return { sent: 0, skipped: 0, reason: 'DB not configured' };

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS daily_alert_deliveries (
      delivery_key TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      delivered_on TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

  const { pruned } = await pruneInactiveSubscribers(env);

  const users = await env.DB.prepare(earlyOnly
    ? `SELECT id, email, origin_iata FROM users WHERE verified_email = 1 AND unsubscribed_at IS NULL AND is_subscribed = 1 AND early_access = 1`
    : `SELECT id, email, origin_iata FROM users WHERE verified_email = 1 AND unsubscribed_at IS NULL AND is_subscribed = 1`
  ).all();
  let sent = 0;
  let skipped = 0;
  const deliveredOn = new Date().toISOString().slice(0, 10);

  // Real bug found and fixed 2026-09-13 (flagged separately mid-session, applied here): this
  // used to load a single shared `deals` array from loadRankedDeals() (always JFK's own file,
  // unconditionally) and send THE SAME content to every subscriber regardless of their real
  // origin_iata -- only the email subject line ever reflected their actual origin. Every
  // non-JFK subscriber had been silently receiving JFK deal content mislabeled with their own
  // origin since the feature was built. Fixed the same way /api/deals and checkWatchlists already
  // pick a file: rankedDealsFilename('free', origin) -- this function has no session/auth
  // context, so free tier is the correct default, same as every other unauthenticated path. A
  // per-run file cache means users sharing an origin don't each trigger a redundant
  // env.ASSETS.fetch().
  const fileCache = new Map();

  for (const user of users.results || []) {
    const deliveryKey = `${user.email}:${deliveredOn}`;
    const alreadySent = await env.DB.prepare(
      'SELECT status FROM daily_alert_deliveries WHERE delivery_key = ? AND status = ?'
    ).bind(deliveryKey, 'sent').first();
    if (alreadySent) {
      skipped += 1;
      continue;
    }

    await env.DB.prepare(`
      INSERT OR REPLACE INTO daily_alert_deliveries
        (delivery_key, email, delivered_on, status, error)
      VALUES (?, ?, ?, 'pending', NULL)
    `).bind(deliveryKey, user.email, deliveredOn).run();

    try {
      const filename = rankedDealsFilename('free', user.origin_iata);
      if (!fileCache.has(filename)) {
        fileCache.set(filename, await loadJsonAsset(env, filename));
      }
      const filtered = filterDealsByOrigin(fileCache.get(filename), user.origin_iata);
      const deals = [
        ...(filtered.deals || []),
        ...(filtered.featured || []),
      ];

      if (earlyOnly) {
        await snapshotEarlyBirdPrices(env, deals, deliveredOn);
      }
      const priceJump = earlyOnly ? null : await getEarlyBirdPriceJump(env, deals[0], deliveredOn);
      const result = await sendDailyDealEmail({
        email: user.email,
        origin: user.origin_iata,
        deals,
        priceJump,
        userId: user.id,
      }, env);
      if (result.ok) {
        await env.DB.prepare(
          'UPDATE daily_alert_deliveries SET status = ?, error = NULL WHERE delivery_key = ?'
        ).bind('sent', deliveryKey).run();
        sent += 1;
      }
    } catch (error) {
      console.error(`Daily alert failed for ${user.email}:`, error);
      await env.DB.prepare(
        'UPDATE daily_alert_deliveries SET status = ?, error = ? WHERE delivery_key = ?'
      ).bind('failed', error.message, deliveryKey).run();
    }
  }

  return { sent, skipped, pruned };
}

// Workplan Step 68. Distinct from sendDailyAlerts (deal-alert digest, all verified users) and
// sendAwayModeFollowUpEmail (fires once, immediately on trip click) -- this fires once per trip,
// close to the actual departure date, as a last-chance nudge. DEPARTING_SOON_WINDOW_DAYS=3 is a
// judgment call, not a spec handed down anywhere -- long enough to still act on travel
// insurance/mail-forwarding, close enough to feel like a genuine "coming up soon" reminder.
//
// Deliberately does the day-count math in JS rather than a SQL date-range query: departure_at is
// stored in ISO-8601-with-offset format (e.g. "2026-10-04T15:32:00-04:00", as constructed by the
// flight fetch script), NOT SQLite's own datetime()-generated space-separated format -- comparing
// those two text formats directly in SQL (e.g. `BETWEEN datetime('now') AND datetime('now','+3
// days')`) would be a fragile string comparison across mismatched formats, not a real date
// comparison. The trips table is small enough that fetching all of a user's active trips and
// filtering with real Date parsing in JS is both simpler and actually correct.
const DEPARTING_SOON_WINDOW_DAYS = 3;

export async function sendDepartingSoonAlerts(env) {
  if (!env?.DB) return { sent: 0, skipped: 0, reason: 'DB not configured' };

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS departing_soon_deliveries (
      trip_id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

  const trips = await env.DB.prepare(`
    SELECT trips.trip_id AS trip_id, trips.destination AS destination, trips.departure_at AS departure_at,
           users.email AS email, users.partner_id AS partner_id, users.trip_length AS trip_length,
           users.passenger_count AS passenger_count
    FROM trips
    JOIN users ON users.id = trips.user_id
    WHERE users.unsubscribed_at IS NULL
  `).all();

  const now = Date.now();
  let sent = 0;
  let skipped = 0;

  for (const trip of trips.results || []) {
    const departureTime = new Date(trip.departure_at).getTime();
    if (Number.isNaN(departureTime)) {
      skipped += 1;
      continue; // malformed date -- skip rather than guess
    }

    const daysUntil = Math.ceil((departureTime - now) / (24 * 60 * 60 * 1000));
    if (daysUntil < 0 || daysUntil > DEPARTING_SOON_WINDOW_DAYS) {
      skipped += 1;
      continue;
    }

    const alreadySent = await env.DB.prepare(
      'SELECT status FROM departing_soon_deliveries WHERE trip_id = ? AND status = ?'
    ).bind(trip.trip_id, 'sent').first();
    if (alreadySent) {
      skipped += 1;
      continue;
    }

    await env.DB.prepare(`
      INSERT OR REPLACE INTO departing_soon_deliveries (trip_id, email, status, error)
      VALUES (?, ?, 'pending', NULL)
    `).bind(trip.trip_id, trip.email).run();

    try {
      const result = await sendDepartingSoonEmail({
        email: trip.email,
        destination: trip.destination,
        departure_at: trip.departure_at,
        daysUntil,
        partner_id: trip.partner_id,
        trip_id: trip.trip_id,
        trip_length: trip.trip_length,
        passenger_count: trip.passenger_count,
      }, env);
      if (result.ok) {
        await env.DB.prepare(
          'UPDATE departing_soon_deliveries SET status = ?, error = NULL WHERE trip_id = ?'
        ).bind('sent', trip.trip_id).run();
        sent += 1;
      }
    } catch (error) {
      console.error(`Departing-soon alert failed for trip ${trip.trip_id}:`, error);
      await env.DB.prepare(
        'UPDATE departing_soon_deliveries SET status = ?, error = ? WHERE trip_id = ?'
      ).bind('failed', error.message, trip.trip_id).run();
    }
  }

  return { sent, skipped };
}

// Workplan Step 110 (GTM Plan Update, Phase 18 -- "The Stress Valve"), resolved 2026-09-13: an
// ADDITIONAL touchpoint alongside sendAwayModeFollowUpEmail's existing immediate send, not a
// replacement -- see sendStressValveEmail's own comment in src/email.js. Targets 2 days after a
// trip's clicked_at, not its departure_at (this fires early in the trip lifecycle, regardless of
// how far out the actual flight is). A small window (not an exact "=== 2") is used deliberately,
// same reasoning as DEPARTING_SOON_WINDOW_DAYS's own JS-side date math: a real conversion date
// comparison against clicked_at, tolerant of the cron not landing on the exact calendar boundary
// every single day, backed by an idempotent per-trip delivery log so the window can never cause a
// duplicate send.
const STRESS_VALVE_MIN_DAYS = 2;
const STRESS_VALVE_MAX_DAYS = 4;

export async function sendStressValveAlerts(env) {
  if (!env?.DB) return { sent: 0, skipped: 0, reason: 'DB not configured' };

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS stress_valve_deliveries (
      trip_id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

  const trips = await env.DB.prepare(`
    SELECT trips.trip_id AS trip_id, trips.destination AS destination, trips.departure_at AS departure_at,
           trips.clicked_at AS clicked_at, users.email AS email, users.partner_id AS partner_id,
           users.trip_length AS trip_length, users.passenger_count AS passenger_count
    FROM trips
    JOIN users ON users.id = trips.user_id
    WHERE users.unsubscribed_at IS NULL
  `).all();

  const now = Date.now();
  let sent = 0;
  let skipped = 0;

  for (const trip of trips.results || []) {
    const clickedTime = new Date(trip.clicked_at).getTime();
    if (Number.isNaN(clickedTime)) {
      skipped += 1;
      continue;
    }

    const daysSinceClick = Math.floor((now - clickedTime) / (24 * 60 * 60 * 1000));
    if (daysSinceClick < STRESS_VALVE_MIN_DAYS || daysSinceClick > STRESS_VALVE_MAX_DAYS) {
      skipped += 1;
      continue;
    }

    const alreadySent = await env.DB.prepare(
      'SELECT status FROM stress_valve_deliveries WHERE trip_id = ? AND status = ?'
    ).bind(trip.trip_id, 'sent').first();
    if (alreadySent) {
      skipped += 1;
      continue;
    }

    await env.DB.prepare(`
      INSERT OR REPLACE INTO stress_valve_deliveries (trip_id, email, status, error)
      VALUES (?, ?, 'pending', NULL)
    `).bind(trip.trip_id, trip.email).run();

    try {
      const result = await sendStressValveEmail({
        email: trip.email,
        destination: trip.destination,
        departure_at: trip.departure_at,
        partner_id: trip.partner_id,
        trip_id: trip.trip_id,
        trip_length: trip.trip_length,
        passenger_count: trip.passenger_count,
      }, env);
      if (result.ok) {
        await env.DB.prepare(
          'UPDATE stress_valve_deliveries SET status = ?, error = NULL WHERE trip_id = ?'
        ).bind('sent', trip.trip_id).run();
        sent += 1;
      }
    } catch (error) {
      console.error(`Stress-valve alert failed for trip ${trip.trip_id}:`, error);
      await env.DB.prepare(
        'UPDATE stress_valve_deliveries SET status = ?, error = ? WHERE trip_id = ?'
      ).bind('failed', error.message, trip.trip_id).run();
    }
  }

  return { sent, skipped };
}

// Workplan Step 111 (GTM Plan Update, Phase 18 -- "The Departure Briefing"), refined 2026-09-13
// by sparkfare_launch_plan.md to be an ADDITION alongside the existing Day-3
// sendDepartingSoonEmail (Step 68, DEPARTING_SOON_WINDOW_DAYS = 3, untouched), not a change to
// it. Targets 7 days before departure -- a separate delivery-log table keyed by trip_id keeps
// this fully independent of the Day-3 alert's own idempotency, so a trip can legitimately receive
// both emails at their respective points in its lifecycle.
const DEPARTURE_BRIEFING_MIN_DAYS = 6;
const DEPARTURE_BRIEFING_MAX_DAYS = 8;

export async function sendDepartureBriefingAlerts(env) {
  if (!env?.DB) return { sent: 0, skipped: 0, reason: 'DB not configured' };

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS departure_briefing_deliveries (
      trip_id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

  const trips = await env.DB.prepare(`
    SELECT trips.trip_id AS trip_id, trips.destination AS destination, trips.departure_at AS departure_at,
           users.email AS email, users.partner_id AS partner_id, users.trip_length AS trip_length,
           users.passenger_count AS passenger_count
    FROM trips
    JOIN users ON users.id = trips.user_id
    WHERE users.unsubscribed_at IS NULL
  `).all();

  const now = Date.now();
  let sent = 0;
  let skipped = 0;

  for (const trip of trips.results || []) {
    const departureTime = new Date(trip.departure_at).getTime();
    if (Number.isNaN(departureTime)) {
      skipped += 1;
      continue;
    }

    const daysUntil = Math.ceil((departureTime - now) / (24 * 60 * 60 * 1000));
    if (daysUntil < DEPARTURE_BRIEFING_MIN_DAYS || daysUntil > DEPARTURE_BRIEFING_MAX_DAYS) {
      skipped += 1;
      continue;
    }

    const alreadySent = await env.DB.prepare(
      'SELECT status FROM departure_briefing_deliveries WHERE trip_id = ? AND status = ?'
    ).bind(trip.trip_id, 'sent').first();
    if (alreadySent) {
      skipped += 1;
      continue;
    }

    await env.DB.prepare(`
      INSERT OR REPLACE INTO departure_briefing_deliveries (trip_id, email, status, error)
      VALUES (?, ?, 'pending', NULL)
    `).bind(trip.trip_id, trip.email).run();

    try {
      const result = await sendDepartureBriefingEmail({
        email: trip.email,
        destination: trip.destination,
        departure_at: trip.departure_at,
        partner_id: trip.partner_id,
        trip_id: trip.trip_id,
        trip_length: trip.trip_length,
        passenger_count: trip.passenger_count,
      }, env);
      if (result.ok) {
        await env.DB.prepare(
          'UPDATE departure_briefing_deliveries SET status = ?, error = NULL WHERE trip_id = ?'
        ).bind('sent', trip.trip_id).run();
        sent += 1;
      }
    } catch (error) {
      console.error(`Departure-briefing alert failed for trip ${trip.trip_id}:`, error);
      await env.DB.prepare(
        'UPDATE departure_briefing_deliveries SET status = ?, error = ? WHERE trip_id = ?'
      ).bind('failed', error.message, trip.trip_id).run();
    }
  }

  return { sent, skipped };
}

// Workplan Step 114 (GTM Plan Update, Phase 19 -- "Route Retrospective"). Targets ~2 days after a
// trip's return_at -- re-uses the same tier-aware rankedDealsFilename() helper as checkWatchlists
// so "today's average" means the same thing everywhere it's computed. A route with no current
// data (insufficient_history/no_data, or simply not in today's feed) has nothing to compare
// against, so it's skipped rather than guessed -- it'll simply never get a retrospective, which is
// preferable to a fabricated comparison.
const ROUTE_RETROSPECTIVE_MIN_DAYS = 1;
const ROUTE_RETROSPECTIVE_MAX_DAYS = 4;

export async function sendRouteRetrospectives(env) {
  if (!env?.DB) return { sent: 0, skipped: 0, reason: 'DB not configured' };

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS route_retrospective_deliveries (
      trip_id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

  const trips = await env.DB.prepare(`
    SELECT trips.trip_id AS trip_id, trips.destination AS destination, trips.origin_iata AS origin_iata,
           trips.return_at AS return_at, trips.price_at_click AS price_at_click, trips.price_eur AS price_eur,
           users.email AS email, users.subscription_tier AS subscription_tier
    FROM trips
    JOIN users ON users.id = trips.user_id
    WHERE users.unsubscribed_at IS NULL AND trips.return_at IS NOT NULL
  `).all();

  const now = Date.now();
  let sent = 0;
  let skipped = 0;
  const fileCache = new Map();

  for (const trip of trips.results || []) {
    const returnTime = new Date(trip.return_at).getTime();
    if (Number.isNaN(returnTime)) {
      skipped += 1;
      continue;
    }

    const daysSinceReturn = Math.floor((now - returnTime) / (24 * 60 * 60 * 1000));
    if (daysSinceReturn < ROUTE_RETROSPECTIVE_MIN_DAYS || daysSinceReturn > ROUTE_RETROSPECTIVE_MAX_DAYS) {
      skipped += 1;
      continue;
    }

    const alreadySent = await env.DB.prepare(
      'SELECT status FROM route_retrospective_deliveries WHERE trip_id = ? AND status = ?'
    ).bind(trip.trip_id, 'sent').first();
    if (alreadySent) {
      skipped += 1;
      continue;
    }

    const tier = trip.subscription_tier === 'paid' ? 'paid' : 'free';
    const filename = rankedDealsFilename(tier, trip.origin_iata);
    if (!fileCache.has(filename)) {
      fileCache.set(filename, await loadJsonAsset(env, filename));
    }
    const combined = fileCache.get(filename);
    const record = findRouteRecord(combined, trip.origin_iata, trip.destination);
    if (!record || typeof record.trailing_avg !== 'number') {
      skipped += 1;
      continue; // nothing current to compare against -- skip rather than fabricate a comparison
    }

    const lockedPrice = typeof trip.price_eur === 'number' ? trip.price_eur : trip.price_at_click;
    const currentAvg = record.trailing_avg;
    const pctDiff = (currentAvg - lockedPrice) / currentAvg;

    await env.DB.prepare(`
      INSERT OR REPLACE INTO route_retrospective_deliveries (trip_id, email, status, error)
      VALUES (?, ?, 'pending', NULL)
    `).bind(trip.trip_id, trip.email).run();

    try {
      const result = await sendRouteRetrospectiveEmail({
        email: trip.email,
        origin: trip.origin_iata,
        destination: trip.destination,
        lockedPrice,
        currentAvg,
        pctDiff,
      }, env);
      if (result.ok) {
        await env.DB.prepare(
          'UPDATE route_retrospective_deliveries SET status = ?, error = NULL WHERE trip_id = ?'
        ).bind('sent', trip.trip_id).run();
        sent += 1;
      }
    } catch (error) {
      console.error(`Route retrospective failed for trip ${trip.trip_id}:`, error);
      await env.DB.prepare(
        'UPDATE route_retrospective_deliveries SET status = ?, error = ? WHERE trip_id = ?'
      ).bind('failed', error.message, trip.trip_id).run();
    }
  }

  return { sent, skipped };
}

// Workplan Step 117 (GTM Plan Update, Phase 19 -- affiliate link health-check). A weekly HEAD
// request against every real partner link in AWAY_MODE_PARTNERS -- a lightweight safeguard
// against exactly the kind of silent link-rot this project has already had to fix reactively
// elsewhere (the disclosure.html/away-mode.html partner-list staleness bugs, 2026-09-13). A
// redirect (3xx) is treated as healthy on its own -- affiliate links routinely redirect through a
// tracking domain to the merchant's real page, that's expected, not a failure. Only an explicit
// 404/410 (link is genuinely gone) or 5xx (server error) counts as broken. `fetch`'s own
// redirect-loop failure (a real "too many redirects" throw) is caught and treated as broken too.
export async function checkAffiliateLinkHealth(env) {
  const results = [];
  for (const partner of AWAY_MODE_PARTNERS) {
    try {
      const response = await fetch(partner.link, { method: 'HEAD', redirect: 'follow' });
      const broken = response.status === 404 || response.status === 410 || response.status >= 500;
      results.push({ slug: partner.slug, name: partner.name, status: response.status, broken });
    } catch (error) {
      results.push({ slug: partner.slug, name: partner.name, status: null, broken: true, error: error.message });
    }
  }

  const broken = results.filter((r) => r.broken);
  if (broken.length > 0) {
    const apiKey = env?.RESEND_API_KEY || process.env.RESEND_API_KEY;
    const resend = apiKey ? new Resend(apiKey) : null;
    if (resend) {
      try {
        await resend.emails.send({
          from: env.EMAIL_FROM || process.env.EMAIL_FROM || 'Sparkfare <hello@sparkfare.com>',
          to: 'hello@sparkfare.com',
          subject: `Away Mode link health check: ${broken.length} broken link${broken.length === 1 ? '' : 's'}`,
          html: `<p>The weekly affiliate link health-check found ${broken.length} broken link(s):</p><ul>${broken.map((r) => `<li>${r.name} (${r.slug}): ${r.error ? r.error : `HTTP ${r.status}`}</li>`).join('')}</ul>`,
        });
      } catch (error) {
        console.error('Link-health alert email failed:', error);
      }
    }
  }

  return { checked: results.length, broken: broken.length, results };
}

// Aviasales' program/campaign_id on Travelpayouts' statistics API -- NOT the same as the
// 314524 affiliate marker used in booking links. Found via the program page URL in the
// Travelpayouts dashboard (app.travelpayouts.com/programs/<id>/about), not guessed.
const AVIASALES_CAMPAIGN_ID = 569853;

export async function reconcileBookings(env) {
  if (!env?.TRAVELPAYOUTS_TOKEN) {
    return { ok: true, mocked: true, message: 'TRAVELPAYOUTS_TOKEN not set; reconciliation mocked' };
  }
  if (!env?.DB) {
    return { ok: true, checked: 0, matched: 0, updated: 0 };
  }

  const clicked = await env.DB.prepare(`
    SELECT trip_id FROM trips WHERE status = 'clicked' AND clicked_at >= datetime('now', '-30 days')
  `).all();
  const clickedTripIds = new Set((clicked.results || []).map((row) => row.trip_id));

  if (clickedTripIds.size === 0) {
    return { ok: true, checked: 0, matched: 0, updated: 0 };
  }

  const lookbackDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const response = await fetch('https://api.travelpayouts.com/statistics/v1/execute_query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Access-Token': env.TRAVELPAYOUTS_TOKEN,
    },
    body: JSON.stringify({
      fields: ['sub_id', 'state', 'date', 'price_eur'],
      filters: [
        { field: 'date', op: 'ge', value: lookbackDate },
        { field: 'campaign_id', op: 'eq', value: AVIASALES_CAMPAIGN_ID },
        { field: 'type', op: 'eq', value: 'action' },
      ],
      sort: [{ field: 'date', order: 'desc' }],
      offset: 0,
      limit: 1000,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Travelpayouts statistics API returned ${response.status}: ${text}`);
  }

  const data = await response.json();
  let matched = 0;
  let updated = 0;

  for (const row of data.results || []) {
    if (row.state !== 'paid' || !clickedTripIds.has(row.sub_id)) continue;
    matched += 1;
    // price_eur is Travelpayouts' own figure for this specific paid action -- persisted here so a
    // real per-trip/per-partner revenue-share amount can eventually be computed by joining trips
    // to users.partner_id, instead of being fetched and discarded (see Workplan Step 101).
    const priceEur = typeof row.price_eur === 'number' ? row.price_eur : null;
    const result = await env.DB.prepare(
      "UPDATE trips SET status = 'booked', price_eur = ? WHERE trip_id = ? AND status = 'clicked'"
    ).bind(priceEur, row.sub_id).run();
    if (result?.success && result.meta?.changes > 0) {
      updated += 1;
      try {
        const tripInfo = await env.DB.prepare(`
          SELECT trips.destination AS destination, users.email AS email, users.partner_id AS partner_id,
                 users.trip_length AS trip_length, users.passenger_count AS passenger_count
          FROM trips JOIN users ON users.id = trips.user_id
          WHERE trips.trip_id = ?
        `).bind(row.sub_id).first();
        if (tripInfo?.email) {
          await sendBookingConfirmedEmail({
            email: tripInfo.email,
            destination: tripInfo.destination,
            partner_id: tripInfo.partner_id,
            trip_id: row.sub_id,
            trip_length: tripInfo.trip_length,
            passenger_count: tripInfo.passenger_count,
          }, env);
        }
      } catch (error) {
        console.error('Booking-confirmed email failed:', error);
      }
    }
  }

  return { ok: true, checked: clickedTripIds.size, matched, updated };
}

async function getClerkSession(request, env) {
  if (!env?.CLERK_SECRET_KEY) {
    return { configured: false, authenticated: false, user: null };
  }

  try {
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return { configured: true, authenticated: false, user: null };
    }

    const { verifyToken } = await import('@clerk/backend');
    const payload = await verifyToken(token, {
      jwtKey: env.CLERK_JWT_KEY,
      secretKey: env.CLERK_SECRET_KEY,
    });

    return {
      configured: true,
      authenticated: true,
      user: {
        id: payload.sub,
        email: payload.email || null,
      },
    };
  } catch (error) {
    console.error('Clerk verifyToken failed:', error.message);
    return {
      configured: true,
      authenticated: false,
      user: null,
      error: error.message,
    };
  }
}

export async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);

  if (url.pathname.startsWith('/share/') && request.method === 'GET') {
    let trip = null;

    if (url.pathname === '/share/deal') {
      const dest = url.searchParams.get('dest');
      const origin = url.searchParams.get('origin');
      const price = url.searchParams.get('price');
      if (!dest || !origin || !price) return new Response('Missing deal parameters', { status: 400 });
      trip = {
        destination: dest,
        origin_iata: origin,
        price_at_click: price,
        hotel_name: null,
        tour_name: null,
        event_name: null
      };
    } else {
      const tripId = url.pathname.split('/')[2];
      if (!tripId || !env?.DB) return jsonResponse(404, { ok: false, error: 'Not found' });

      trip = await env.DB.prepare(`
        SELECT trip_id, destination, origin_iata, departure_at, price_at_click, hotel_name, tour_name, event_name, is_open
        FROM trips
        WHERE trip_id = ?
      `).bind(tripId).first();
    }

    if (!trip) return new Response('Trip not found', { status: 404 });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Join my Sparkfare trip to ${trip.destination}!</title>
  
  <meta property="og:title" content="Join my Sparkfare trip to ${trip.destination}!">
  <meta property="og:description" content="I locked in a flight from ${trip.origin_iata} for $${trip.price_at_click}. Click to build your own package and join the trip.">
  <meta property="og:image" content="https://images.unsplash.com/photo-1436491865332-7a61a109cc05?q=80&w=1200&auto=format&fit=crop">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
  
  <link rel="icon" type="image/svg+xml" href="/sparkfare_mark.svg">
  <style>
    body { background: #E8DCC5; color: #2E2318; font-family: 'Segoe UI', sans-serif; text-align: center; padding: 50px; }
    .card { background: #FAF6EE; padding: 40px; border-radius: 12px; max-width: 500px; margin: 0 auto; border: 1px solid #D9CBB0; }
    .btn { display: inline-block; background: #E8B930; color: #2B2620; padding: 15px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <svg class="brand-mark" viewBox="0 0 44 44" aria-hidden="true" style="width: 44px; height: 44px; margin: 0 auto 20px;">
      <path d="M8,8 L8,36 L30,36 L27,29 L30,22 L27,15 L30,8 Z" fill="none" stroke="#2B2620" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="18" cy="22" r="3.5" fill="#E8B930"/>
    </svg>
    <h1 style="margin-top:0;">✈️ ${trip.destination}</h1>
    <p><strong>From:</strong> ${trip.origin_iata} • <strong>Flight:</strong> $${trip.price_at_click}</p>
    ${trip.hotel_name ? `<p><strong>Hotel:</strong> ${trip.hotel_name}</p>` : ''}
    ${trip.tour_name ? `<p><strong>Tour:</strong> ${trip.tour_name}</p>` : ''}
    ${trip.event_name ? `<p><strong>Event:</strong> ${trip.event_name}</p>` : ''}
    ${trip.event_name ? `<p><strong>Event:</strong> ${trip.event_name}</p>` : ''}
    <br/>
    ${trip.is_open ? `<a href="/?join=${trip.trip_id}" class="btn">Join this trip</a>` : `<a href="/" class="btn">Build your own Sparkfare trip</a>`}
  </div>
</body>
</html>`;
    return new Response(html, { headers: { 'Content-Type': 'text/html' } });
  }

  if (url.pathname.match(/^\/api\/trips\/[^/]+\/open$/) && request.method === 'PATCH') {
    const session = await getClerkSession(request, env);
    if (!session.authenticated) return jsonResponse(401, { ok: false, error: 'Not authenticated' });

    const tripId = url.pathname.split('/')[3];
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(400, { ok: false, error: 'Request body must be valid JSON' });
    }

    if (env?.DB) {
      await env.DB.prepare(`
        UPDATE trips SET is_open = ? WHERE trip_id = ? AND user_id = ?
      `).bind(body.is_open ? 1 : 0, tripId, session.user.id).run();
    }
    return jsonResponse(200, { ok: true });
  }

  if (url.pathname.match(/^\/api\/trips\/[^/]+\/public$/) && request.method === 'GET') {
    const tripId = url.pathname.split('/')[3];
    if (!env?.DB) return jsonResponse(404, { ok: false, error: 'Not found' });

    const trip = await env.DB.prepare(`
      SELECT trip_id, destination, hotel_name, tour_name, event_name
      FROM trips
      WHERE trip_id = ? AND is_open = 1
    `).bind(tripId).first();

    if (!trip) return jsonResponse(404, { ok: false, error: 'Trip not found or not open' });
    return jsonResponse(200, { ok: true, trip });
  }

  if (url.pathname === '/api/trips' && request.method === 'GET') {
    const session = await getClerkSession(request, env);
    if (!session.authenticated) return jsonResponse(401, { ok: false, error: 'Not authenticated' });

    if (!env?.DB) return jsonResponse(200, { ok: true, trips: [] });

    const result = await env.DB.prepare(`
      SELECT trip_id, destination, origin_iata, departure_at, return_at, price_at_click, clicked_at, status, hotel_name, tour_name, event_name, is_open
      FROM trips
      WHERE user_id = ?
      ORDER BY clicked_at DESC
    `).bind(session.user.id).all();

    return jsonResponse(200, { ok: true, trips: result.results || [] });
  }

  if (url.pathname === '/api/trips' && request.method === 'POST') {
    const session = await getClerkSession(request, env);
    if (!session.authenticated) return jsonResponse(401, { ok: false, error: 'Not authenticated' });

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(400, { ok: false, error: 'Request body must be valid JSON' });
    }

    const { destination, origin_iata, departure_at, return_at, price_at_click, booking_link } = body;
    if (!destination || !origin_iata || !departure_at || price_at_click == null || !booking_link) {
      return jsonResponse(400, { ok: false, error: 'Missing trip fields' });
    }
    if (!VALID_ORIGINS.has(String(origin_iata).toUpperCase())) {
      return jsonResponse(400, { ok: false, error: 'Invalid origin_iata value' });
    }

    const tripId = crypto.randomUUID();
    try {
      const trackedBookingLink = withTripMarker(booking_link, tripId);
      if (env?.DB) {
        await env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS trips (
            trip_id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            destination TEXT NOT NULL,
            origin_iata TEXT NOT NULL,
            departure_at TEXT NOT NULL,
            return_at TEXT,
            price_at_click INTEGER NOT NULL,
            clicked_at TEXT DEFAULT (datetime('now')),
            status TEXT DEFAULT 'clicked',
            price_eur REAL,
            hotel_name TEXT,
            tour_name TEXT,
            event_name TEXT,
            is_open INTEGER DEFAULT 0
          )
        `).run();
        try { await env.DB.prepare("ALTER TABLE trips ADD COLUMN hotel_name TEXT").run(); } catch(e) {}
        try { await env.DB.prepare("ALTER TABLE trips ADD COLUMN tour_name TEXT").run(); } catch(e) {}
        try { await env.DB.prepare("ALTER TABLE trips ADD COLUMN event_name TEXT").run(); } catch(e) {}
        try { await env.DB.prepare("ALTER TABLE trips ADD COLUMN is_open INTEGER DEFAULT 0").run(); } catch(e) {}
        const result = await env.DB.prepare(`
          INSERT INTO trips
            (trip_id, user_id, destination, origin_iata, departure_at, return_at, price_at_click)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          tripId,
          session.user.id,
          destination,
          String(origin_iata).toUpperCase(),
          departure_at,
          return_at || null,
          Number(price_at_click)
        ).run();
        if (!result || result.success === false) throw new Error('Trip insert failed');
      }

      let followUpEmail = session.user.email;
      let followUpPartnerId = null;
      let followUpTripLength = null;
      let followUpPassengerCount = null;
      if (env?.DB) {
        const userRecord = await env.DB.prepare('SELECT email, partner_id, trip_length, passenger_count FROM users WHERE id = ?').bind(session.user.id).first();
        if (userRecord?.email) followUpEmail = userRecord.email;
        if (userRecord) {
          followUpPartnerId = userRecord.partner_id;
          followUpTripLength = userRecord.trip_length;
          followUpPassengerCount = userRecord.passenger_count;
        }
      }
      if (followUpEmail) {
        const sendPromise = sendAwayModeFollowUpEmail({
          email: followUpEmail,
          destination,
          departure_at,
          partner_id: followUpPartnerId,
          trip_id: tripId,
          trip_length: followUpTripLength,
          passenger_count: followUpPassengerCount,
        }, env).catch((error) => {
          console.error('Away Mode follow-up email failed:', error);
        });
        if (ctx?.waitUntil) {
          ctx.waitUntil(sendPromise);
        } else {
          await sendPromise;
        }
      }

      return jsonResponse(200, {
        ok: true,
        trip_id: tripId,
        redirect_url: `/departing/${tripId}?url=${encodeURIComponent(trackedBookingLink)}`,
      });
    } catch (error) {
      console.error('Trip tracking failed:', error);
      return jsonResponse(400, { ok: false, error: error.message || 'Unable to track trip' });
    }
  }

  if (url.pathname === '/api/signup' && request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(400, { ok: false, error: 'Request body must be valid JSON' });
    }

    try {
      const { id, email, origin_iata, passenger_count, trip_length, subscription_tier, partner_id, ref } = body;
      const session = await getClerkSession(request, env);
      const userId = session.authenticated ? session.user.id : id;
      const userEmail = session.authenticated ? session.user.email || email : email;

      if (!userId || !userEmail || !origin_iata || !trip_length) {
        return jsonResponse(400, { ok: false, error: 'Missing required fields' });
      }

      if (!VALID_ORIGINS.has(origin_iata.toUpperCase())) {
        return jsonResponse(400, { ok: false, error: 'Invalid origin_iata value' });
      }

      const safeTier = subscription_tier || 'free';
      const safePassengerCount = normalizePassengerCount(passenger_count);
      const verifiedEmail = session.authenticated ? 1 : 0;
      const newPartnerId = partner_id || null;
      let storedId = userId;
      let storedPartnerId = newPartnerId;
      let storedEarlyAccess = 0;

      if (env?.DB) {
        const existing = await env.DB.prepare('SELECT id, verified_email, partner_id, early_access FROM users WHERE email = ?').bind(userEmail).first();
        // Only trust a Clerk-verified session to move the primary key / promote verified_email.
        // An unauthenticated resubmit of the public form must never downgrade an already-linked,
        // verified row back to a placeholder local_* id.
        const resolvedId = session.authenticated ? userId : (existing ? existing.id : userId);
        const resolvedVerified = session.authenticated ? 1 : (existing ? existing.verified_email : 0);

        // partner_id is first-touch attribution: an existing row's value is never overwritten by
        // a later resubmit (e.g. updating trip_length directly on the site shouldn't silently
        // erase which publisher originally referred this user).
        storedPartnerId = existing ? existing.partner_id : newPartnerId;

        // Workplan Step 93: the "Early Bird" referral loop. Only ever evaluated for a genuinely
        // NEW signup (never on a resubmit/update) -- ref is a referring user's own id, read off
        // the URL (?ref=<id>) they shared. A self-referral (ref === the new signup's own id) is
        // rejected outright; an unrecognized ref is silently ignored rather than erroring the
        // signup.
        //
        // Workplan Step 130 (Roadmap Q3 2027, "Verified-Only" Early Bird fraud protection):
        // early_access is deliberately NOT granted here anymore. Granting it instantly on signup
        // meant anyone could unlock the referrer's 07:00 UTC VIP digest just by submitting any
        // throwaway address with ?ref=<id> attached -- no proof a real person was behind that
        // inbox. The grant now happens in the /api/webhooks/resend handler, the moment (and only
        // if) this referred user's own email.opened event actually fires -- see that handler for
        // the rest of the story. This request still records `referred_by` so that later event can
        // find its way back to both users; it's a one-time flag either way, not a counter, so
        // referring multiple friends doesn't need to do anything further once it's already set.
        let referredBy = null;
        if (!existing && ref && ref !== userId) {
          const referrer = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(ref).first();
          if (referrer) {
            referredBy = ref;
          }
        } else if (existing) {
          storedEarlyAccess = existing.early_access ?? 0;
        }

        const result = existing
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

        if (!result || result.success === false) {
          return jsonResponse(500, { ok: false, error: 'Unable to save your alert right now' });
        }
      }

      return jsonResponse(200, {
        ok: true,
        user: {
          id: storedId,
          email: userEmail,
          origin_iata: origin_iata.toUpperCase(),
          passenger_count: safePassengerCount,
          trip_length,
          subscription_tier: safeTier,
          partner_id: storedPartnerId,
          early_access: storedEarlyAccess,
        },
      });
    } catch (error) {
      console.error('Signup storage failed:', error);
      return jsonResponse(500, { ok: false, error: 'Unable to save your alert right now' });
    }
  }

  if (url.pathname === '/api/session' && request.method === 'GET') {
    const session = await getClerkSession(request, env);
    if (!session.configured) {
      return jsonResponse(200, {
        ok: true,
        configured: false,
        authenticated: false,
        message: 'Clerk secret key not configured yet.',
      });
    }

    return jsonResponse(session.authenticated ? 200 : 401, {
      ok: session.authenticated,
      configured: true,
      authenticated: session.authenticated,
      user: session.user,
    });
  }

  if (url.pathname === '/api/account' && request.method === 'GET') {
    const session = await getClerkSession(request, env);
    if (!session.authenticated) {
      return jsonResponse(401, { ok: false, error: 'Not authenticated' });
    }

    return jsonResponse(200, {
      ok: true,
      user: session.user,
      account_status: 'active',
      subscription_tier: 'free',
    });
  }

  if (url.pathname === '/api/preferences' && request.method === 'POST') {
    const session = await getClerkSession(request, env);
    if (!session.authenticated) {
      return jsonResponse(401, { ok: false, error: 'Not authenticated' });
    }

    try {
      const body = await request.json();
      const { origin_iata, passenger_count, trip_length } = body;

      if (origin_iata && !VALID_ORIGINS.has(origin_iata.toUpperCase())) {
        return jsonResponse(400, { ok: false, error: 'Invalid origin_iata value' });
      }

      // null (not a normalized default) whenever the field is genuinely absent from the payload,
      // so a partial update via COALESCE below preserves whatever the row already had instead of
      // silently resetting it to 1 -- normalizePassengerCount()'s own "default to 1" behavior is
      // only correct for a brand-new row (see /api/signup), not a partial preferences edit.
      const safePassengerCount = (passenger_count === undefined || passenger_count === null || passenger_count === '')
        ? null
        : normalizePassengerCount(passenger_count);
      const updatedOrigin = origin_iata ? origin_iata.toUpperCase() : null;

      // This previously only echoed the payload back without ever writing to D1 -- a real,
      // pre-existing gap found while wiring passenger_count through to Away Mode email
      // personalization (a preference that's never actually saved can't inform anything
      // downstream). Fixed here rather than left in place, since it directly undermines the
      // point of collecting this data at all.
      if (env?.DB) {
        await env.DB.prepare(`
          UPDATE users SET
            origin_iata = COALESCE(?, origin_iata),
            passenger_count = COALESCE(?, passenger_count),
            trip_length = COALESCE(?, trip_length)
          WHERE id = ?
        `).bind(updatedOrigin, safePassengerCount, trip_length ?? null, session.user.id).run();
      }

      return jsonResponse(200, {
        ok: true,
        user_id: session.user.id,
        updated: {
          origin_iata: updatedOrigin,
          passenger_count: safePassengerCount,
          trip_length: trip_length ?? null,
        },
      });
    } catch (error) {
      return jsonResponse(400, { ok: false, error: 'Invalid JSON body' });
    }
  }

  if (url.pathname === '/api/verify' && request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(400, { ok: false, error: 'Request body must be valid JSON' });
    }

    const { email } = body;
    if (!email) {
      return jsonResponse(400, { ok: false, error: 'Email is required' });
    }

    if (env?.DB) {
      const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
      if (!user) {
        return jsonResponse(404, { ok: false, error: 'User not found' });
      }

      const result = await env.DB.prepare('UPDATE users SET verified_email = 1 WHERE email = ?').bind(email).run();
      if (!result || result.success === false) {
        return jsonResponse(500, { ok: false, error: 'Failed to verify user' });
      }
    }

    const verificationUrl = `${env.APP_URL || 'https://sparkfare.com'}/account`;
    try {
      await sendVerificationEmail({ email, verificationUrl }, env);
    } catch (error) {
      console.error('Verification email send failed:', error);
      return jsonResponse(200, {
        ok: true,
        verified_email: 1,
        email,
        email_send_error: error.message || 'Email send failed',
      });
    }

    return jsonResponse(200, { ok: true, verified_email: 1, email });
  }

  if (url.pathname === '/api/send-daily-alert' && request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(400, { ok: false, error: 'Request body must be valid JSON' });
    }

    const { email, origin, deals } = body;
    if (!email || !origin) {
      return jsonResponse(400, { ok: false, error: 'Email and origin are required' });
    }

    try {
      const result = await sendDailyDealEmail({ email, origin, deals: deals || [] }, env);
      return jsonResponse(200, {
        ok: true,
        sent: true,
        mocked: result.mocked || false,
      });
    } catch (error) {
      console.error('Daily alert test send failed:', error);
      return jsonResponse(502, { ok: false, error: error.message || 'Email send failed' });
    }
  }

  if (url.pathname === '/api/unsubscribe' && request.method === 'GET') {
    const email = url.searchParams.get('email');
    if (!email) return new Response('Email is required', { status: 400 });

    if (env?.DB) {
      const result = await env.DB.prepare(
        'UPDATE users SET unsubscribed_at = datetime("now") WHERE email = ?'
      ).bind(email).run();
      if (!result || result.success === false) {
        return new Response('Unable to unsubscribe right now', { status: 500 });
      }
    }

    return new Response('You have been unsubscribed from Sparkfare daily deal emails.', {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  // Workplan Step 126 (Business Plan V2.0, Module A). One-click, no login required, same
  // discipline as /api/unsubscribe above -- reverses a Step 123-125 sunset pruning by resetting
  // is_subscribed and last_opened_at, so the user gets a fresh 45-day window starting now.
  if (url.pathname === '/api/reactivate' && request.method === 'GET') {
    const email = url.searchParams.get('email');
    if (!email) return new Response('Email is required', { status: 400 });

    if (env?.DB) {
      const result = await env.DB.prepare(
        "UPDATE users SET is_subscribed = 1, last_opened_at = datetime('now') WHERE email = ?"
      ).bind(email).run();
      if (!result || result.success === false) {
        return new Response('Unable to reactivate right now', { status: 500 });
      }
    }

    return new Response('Your Sparkfare daily alerts are back on.', {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  if (url.pathname === '/api/unsubscribe' && request.method === 'POST') {
    try {
      const body = await request.json();
      const { email } = body;

      if (!email) {
        return jsonResponse(400, { ok: false, error: 'Email is required' });
      }

      if (env?.DB) {
        const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
        if (!user) {
          return jsonResponse(404, { ok: false, error: 'User not found' });
        }

        const result = await env.DB.prepare('UPDATE users SET unsubscribed_at = datetime("now") WHERE email = ?').bind(email).run();
        if (!result || result.success === false) {
          return jsonResponse(500, { ok: false, error: 'Failed to unsubscribe user' });
        }
      }

      return jsonResponse(200, { ok: true, unsubscribed: true, email });
    } catch (error) {
      return jsonResponse(400, { ok: false, error: 'Invalid JSON body' });
    }
  }

  if (url.pathname === '/api/reconcile-bookings' && request.method === 'POST') {
    try {
      const result = await reconcileBookings(env);
      return jsonResponse(200, result);
    } catch (error) {
      console.error('Booking reconciliation failed:', error);
      return jsonResponse(502, { ok: false, error: error.message || 'Reconciliation failed' });
    }
  }

  if (url.pathname === '/api/send-departing-soon-alerts' && request.method === 'POST') {
    try {
      const result = await sendDepartingSoonAlerts(env);
      return jsonResponse(200, result);
    } catch (error) {
      console.error('Departing-soon alert batch failed:', error);
      return jsonResponse(502, { ok: false, error: error.message || 'Departing-soon alerts failed' });
    }
  }

  if (url.pathname === '/api/health') {
    return jsonResponse(200, { ok: true, status: 'healthy' });
  }


  // Workplan Step 124 (Business Plan V2.0, Module A). Resend signs its webhooks using the
  // Standard Webhooks spec (svix-compatible) -- verified here with the same 'standardwebhooks'
  // package Resend's own SDK depends on internally, not a hand-rolled signature check. Refuses
  // to process anything if RESEND_WEBHOOK_SECRET isn't set, rather than silently skipping
  // verification -- accepting unverified webhook data would let anyone forge last_opened_at
  // updates. The secret itself has to come from Resend's own dashboard when the webhook endpoint
  // is registered there; nothing here can generate or guess it.
  if (url.pathname === '/api/webhooks/resend' && request.method === 'POST') {
    if (!env?.RESEND_WEBHOOK_SECRET) {
      return jsonResponse(503, { ok: false, error: 'Webhook not configured' });
    }

    const payload = await request.text();
    const headers = {
      'webhook-id': request.headers.get('webhook-id'),
      'webhook-timestamp': request.headers.get('webhook-timestamp'),
      'webhook-signature': request.headers.get('webhook-signature'),
    };

    let event;
    try {
      const wh = new Webhook(env.RESEND_WEBHOOK_SECRET);
      event = wh.verify(payload, headers);
    } catch (error) {
      return jsonResponse(401, { ok: false, error: 'Invalid signature' });
    }

    if (event?.type === 'email.opened' && env?.DB) {
      const recipients = event.data?.to || [];
      for (const recipientEmail of recipients) {
        await env.DB.prepare(
          "UPDATE users SET last_opened_at = datetime('now') WHERE email = ?"
        ).bind(recipientEmail).run();

        // Workplan Step 129 (Roadmap Q3 2027, "Verified-Only" Early Bird fraud protection). A
        // referred signup's early_access is deferred until this exact moment -- see the
        // /api/signup note for why. Gated on early_access still being 0 so a referred user's
        // later opens (there will be many) never re-trigger this; it only ever fires once per
        // referral, the same idempotency shape used everywhere else in this file.
        const recipient = await env.DB.prepare(
          'SELECT id, early_access, referred_by FROM users WHERE email = ?'
        ).bind(recipientEmail).first();
        if (recipient?.referred_by && recipient.early_access !== 1) {
          await env.DB.prepare('UPDATE users SET early_access = 1 WHERE id = ?').bind(recipient.id).run();
          await env.DB.prepare('UPDATE users SET early_access = 1 WHERE id = ?').bind(recipient.referred_by).run();
        }
      }
    }

    return jsonResponse(200, { ok: true });
  }

  // GET /api/watchlist -- returns all watchlists for the authenticated user, newest first.
  // Companion to POST /api/watchlist below; added when the watchlist UI was built so the page
  // can render a user's existing watchlists on load without a separate data-fetch endpoint.
  if (url.pathname === '/api/watchlist' && request.method === 'GET') {
    const session = await getClerkSession(request, env);
    if (!session.authenticated) return jsonResponse(401, { ok: false, error: 'Not authenticated' });
    if (!env?.DB) return jsonResponse(200, { ok: true, watchlists: [] });

    const rows = await env.DB.prepare(`
      SELECT id, origin_iata, destination, target_price, notified_at, created_at
      FROM watchlists
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).bind(session.user.id).all();

    return jsonResponse(200, {
      ok: true,
      watchlists: (rows.results || []).map((row) => ({
        id: row.id,
        origin_iata: row.origin_iata,
        destination: row.destination,
        target_price: row.target_price,
        status: row.notified_at ? 'notified' : 'watching',
        notified_at: row.notified_at || null,
        created_at: row.created_at,
      })),
    });
  }

  // Workplan Step 115 (Business Plan V2.0, Module B). Validates destination against the same
  // sparkfare_destinations.json the frontend board already fetches, so a watchlist can't be
  // created for a route Sparkfare doesn't actually curate or track prices for.
  if (url.pathname === '/api/watchlist' && request.method === 'POST') {
    const session = await getClerkSession(request, env);
    if (!session.authenticated) return jsonResponse(401, { ok: false, error: 'Not authenticated' });

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(400, { ok: false, error: 'Request body must be valid JSON' });
    }

    const { origin_iata, destination, target_price } = body;
    if (!origin_iata || !destination || target_price == null) {
      return jsonResponse(400, { ok: false, error: 'Missing watchlist fields' });
    }
    const originIata = String(origin_iata).toUpperCase();
    if (!VALID_ORIGINS.has(originIata)) {
      return jsonResponse(400, { ok: false, error: 'Invalid origin_iata value' });
    }
    const targetPrice = Number(target_price);
    if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
      return jsonResponse(400, { ok: false, error: 'Invalid target_price value' });
    }

    const destinations = await loadJsonAsset(env, 'sparkfare_destinations.json');
    if (!Object.prototype.hasOwnProperty.call(destinations, destination)) {
      return jsonResponse(400, { ok: false, error: 'Unknown destination' });
    }

    if (!env?.DB) return jsonResponse(200, { ok: true, mocked: true });

    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS watchlists (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        origin_iata TEXT NOT NULL,
        destination TEXT NOT NULL,
        target_price INTEGER NOT NULL,
        notified_at TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `).run();

    const watchlistId = crypto.randomUUID();
    const result = await env.DB.prepare(`
      INSERT INTO watchlists (id, user_id, origin_iata, destination, target_price)
      VALUES (?, ?, ?, ?, ?)
    `).bind(watchlistId, session.user.id, originIata, destination, targetPrice).run();
    if (!result || result.success === false) {
      return jsonResponse(502, { ok: false, error: 'Unable to create watchlist' });
    }

    return jsonResponse(200, { ok: true, watchlist_id: watchlistId });
  }

  if (url.pathname === '/api/deals' && request.method === 'GET') {
    const origin = String(url.searchParams.get('origin') || '').toUpperCase();
    if (!VALID_ORIGINS.has(origin)) {
      return jsonResponse(400, { ok: false, error: 'Unknown or missing origin' });
    }

    let tier = 'free';
    if (env?.DB) {
      const session = await getClerkSession(request, env);
      if (session.authenticated) {
        const user = await env.DB.prepare('SELECT subscription_tier FROM users WHERE id = ?').bind(session.user.id).first();
        if (user?.subscription_tier === 'paid') tier = 'paid';
      }
    }

    // Paid: genuinely fresher data straight from the hourly multi-origin pipeline (covers all
    // 13 origins, including JFK -- it's fetched hourly there too, just served to free users from
    // JFK's separate always-fresh-daily pipeline instead). Free: unchanged from what's served
    // today -- JFK's own daily file, or the 24h-delayed combined file for every other origin.
    const filename = rankedDealsFilename(tier, origin);

    const combined = await loadJsonAsset(env, filename);
    if (!combined || Object.keys(combined).length === 0) {
      return jsonResponse(502, { ok: false, error: 'Deal data not available' });
    }

    return jsonResponse(200, {
      ok: true,
      tier,
      origin,
      generated_at: combined.generated_at || null,
      ...filterDealsByOrigin(combined, origin),
    });
  }

  // Workplan Step 113 (GTM Plan Update, Phase 19). Privacy-first: no Clerk session required to
  // click a partner link, so this deliberately reads trip_id/partner_id from the URL's own query
  // string (set when the link was built -- see buildAwayModeLink() in src/email.js) rather than
  // requiring authentication just to redirect somewhere. A slug that isn't a real partner 404s
  // instead of redirecting nowhere.
  if (url.pathname.startsWith('/go/')) {
    const affiliateSlug = url.pathname.slice('/go/'.length).split('/')[0];
    const partner = AWAY_MODE_PARTNERS.find((p) => p.slug === affiliateSlug);
    if (!partner) return new Response('Not found', { status: 404 });

    if (env?.DB) {
      try {
        await env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS away_mode_clicks (
            id TEXT PRIMARY KEY,
            trip_id TEXT,
            partner_id TEXT,
            affiliate_slug TEXT NOT NULL,
            clicked_at TEXT DEFAULT (datetime('now'))
          )
        `).run();
        await env.DB.prepare(`
          INSERT INTO away_mode_clicks (id, trip_id, partner_id, affiliate_slug)
          VALUES (?, ?, ?, ?)
        `).bind(
          crypto.randomUUID(),
          url.searchParams.get('trip_id') || null,
          url.searchParams.get('partner_id') || null,
          affiliateSlug
        ).run();
      } catch (error) {
        console.error('Away Mode click logging failed:', error);
      }
    }

    return Response.redirect(partner.link, 302);
  }

  if (url.pathname === '/api/send-stress-valve-alerts' && request.method === 'POST') {
    try {
      const result = await sendStressValveAlerts(env);
      return jsonResponse(200, result);
    } catch (error) {
      console.error('Stress-valve alert batch failed:', error);
      return jsonResponse(502, { ok: false, error: error.message || 'Stress-valve alerts failed' });
    }
  }

  if (url.pathname === '/api/send-departure-briefing-alerts' && request.method === 'POST') {
    try {
      const result = await sendDepartureBriefingAlerts(env);
      return jsonResponse(200, result);
    } catch (error) {
      console.error('Departure-briefing alert batch failed:', error);
      return jsonResponse(502, { ok: false, error: error.message || 'Departure-briefing alerts failed' });
    }
  }

  if (url.pathname === '/api/send-route-retrospectives' && request.method === 'POST') {
    try {
      const result = await sendRouteRetrospectives(env);
      return jsonResponse(200, result);
    } catch (error) {
      console.error('Route retrospective batch failed:', error);
      return jsonResponse(502, { ok: false, error: error.message || 'Route retrospectives failed' });
    }
  }

  if (url.pathname === '/api/check-affiliate-link-health' && request.method === 'POST') {
    try {
      const result = await checkAffiliateLinkHealth(env);
      return jsonResponse(200, result);
    } catch (error) {
      console.error('Affiliate link health check failed:', error);
      return jsonResponse(502, { ok: false, error: error.message || 'Link health check failed' });
    }
  }

  return new Response('Not found', { status: 404 });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/departing/')) {
      return new Response(`<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Taking you to your fare | Sparkfare</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#E8DCC5;color:#2E2318;font:16px 'Segoe UI',sans-serif}main{width:min(100%,520px);padding:32px;background:#FAF6EE;border:1px solid #D9CBB0;border-radius:8px;text-align:center}h1{font-size:1.8rem; margin-top:0;}p{color:#6B5A45}.teaser{margin:20px 0;padding:20px 0;border-top:1px dashed #D9CBB0;border-bottom:1px dashed #D9CBB0;font-size:.95rem}.cta{display:inline-block;background:#E8B930;color:#2E2318;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:6px;font-size:1.05rem; cursor:pointer; border:none; margin-top:10px;}.cta:hover{filter:brightness(1.05);}</style></head><body><main><h1>Final price is confirmed on the next page</h1><p class="teaser"><strong>Check your inbox</strong> — we just sent your Away Mode checklist.</p><p id="fallback" hidden><a id="continue" class="cta" href="" target="_blank" rel="noopener">Continue to Aviasales</a></p></main><script>const target=new URLSearchParams(location.search).get('url'),fallback=document.getElementById('fallback'),link=document.getElementById('continue');if(target){link.href=target;fallback.hidden=false;}else{fallback.hidden=false;link.href='/';link.textContent='Return to Sparkfare';link.removeAttribute('target');}</script></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    // Workplan Step 116 ("The Sparkfare Index"). Rendered from the Worker, like /departing/
    // above, rather than as a static asset -- avoids any risk of the same kind of static-asset
    // path-collision/redirect surprise already hit once with /blog/*.html (Cloudflare treating
    // "/index" specially the way it treats a directory's own index.html is a real, untested risk;
    // rendering it dynamically sidesteps the question entirely).
    if (url.pathname === '/index') {
      const data = await computePriceGougingWatchlist(env);
      return new Response(priceGougingIndexHtml(data), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    // Workplan Step 122 (Zero-CAC KPI dashboard). Unlike /index above, this reveals real business
    // metrics (revenue, referral/acquisition volume) -- not meant for public consumption, so it's
    // gated behind a shared secret query param rather than served openly. There's no admin-role
    // concept anywhere in this project's D1 schema yet, so a full Clerk-based admin auth system
    // would be new scope well beyond "build the dashboard" -- a secret-gated route matches the
    // existing precedent already used for POST /api/webhooks/resend.
    if (url.pathname === '/kpi') {
      const providedKey = url.searchParams.get('key');
      if (!env?.KPI_DASHBOARD_SECRET || providedKey !== env.KPI_DASHBOARD_SECRET) {
        return new Response('Not found', { status: 404 });
      }
      const kpi = await computeKPIs(env);
      if (!kpi) return new Response('KPI data not available', { status: 502 });
      return new Response(kpiDashboardHtml(kpi), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    if (url.pathname === '/api/admin/trigger-newsletter' && request.method === 'POST') {
      const providedKey = url.searchParams.get('key');
      if (!env?.KPI_DASHBOARD_SECRET || providedKey !== env.KPI_DASHBOARD_SECRET) {
        return new Response('Not found', { status: 404 });
      }
      
      let payload;
      try {
        payload = await request.json();
      } catch {
        return jsonResponse(400, { ok: false, error: 'Invalid JSON payload' });
      }

      if (env?.DB) {
        const { sendSundayNewsletter } = await import('./email.js');
        for (const [origin, data] of Object.entries(payload)) {
          const users = await env.DB.prepare(`SELECT id, email FROM users WHERE origin_iata = ? AND unsubscribed_at IS NULL`).bind(origin).all();
          if (users.results && users.results.length > 0) {
            ctx.waitUntil(sendSundayNewsletter(env, users.results, data));
          }
        }
      }
      return jsonResponse(200, { ok: true });
    }

    return handleRequest(request, env, ctx);
  },
  async scheduled(event, env) {
    // Workplan Step 117: the weekly link-health check runs on its own, separate cron
    // (WEEKLY_LINK_HEALTH_CRON) and returns early -- it has nothing to do with the daily
    // digest/reconciliation flow below and shouldn't accidentally trigger it.
    if (event.cron === WEEKLY_LINK_HEALTH_CRON) {
      try {
        await checkAffiliateLinkHealth(env);
      } catch (error) {
        console.error('Scheduled affiliate link health check failed:', error);
      }
      return;
    }

    // Workplan Step 93: EARLY_DIGEST_CRON must match wrangler.jsonc's crons array exactly, or
    // the early run silently gets misidentified as the general run (and vice versa) -- same
    // category of drift risk already seen with the hourly-fetch cron timing. The early run only
    // ever sends the digest; reconciliation and departing-soon alerts stay on the one general run
    // per day, since neither has an "early" variant of its own.
    const isEarlyRun = event.cron === EARLY_DIGEST_CRON;
    try {
      await sendDailyAlerts(env, { earlyOnly: isEarlyRun });
    } catch (error) {
      console.error('Scheduled daily alerts failed:', error);
    }
    if (isEarlyRun) return;
    try {
      await reconcileBookings(env);
    } catch (error) {
      console.error('Scheduled booking reconciliation failed:', error);
    }
    try {
      await sendDepartingSoonAlerts(env);
    } catch (error) {
      console.error('Scheduled departing-soon alerts failed:', error);
    }
    try {
      await checkWatchlists(env);
    } catch (error) {
      console.error('Scheduled watchlist check failed:', error);
    }
    try {
      await sendStressValveAlerts(env);
    } catch (error) {
      console.error('Scheduled stress-valve alerts failed:', error);
    }
    try {
      await sendDepartureBriefingAlerts(env);
    } catch (error) {
      console.error('Scheduled departure-briefing alerts failed:', error);
    }
    try {
      await sendRouteRetrospectives(env);
    } catch (error) {
      console.error('Scheduled route retrospectives failed:', error);
    }
  },
  async email(message, env, ctx) {
    if (message.to.toLowerCase() === 'hello@sparkfare.com') {
      const { sendSupportAutoResponder } = await import('./email.js');
      try {
        await sendSupportAutoResponder(env, message.from);
      } catch (error) {
        console.error('Failed to send auto-responder:', error);
      }
    }
  },
};
