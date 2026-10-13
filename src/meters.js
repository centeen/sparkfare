// F0: revenue per departure. Every partner has a revenue meter, a category slug and an attribution mode; every
// outbound click is logged with them and a coarse trip-length range; partner payouts are entered once a month;
// and the revenue report joins the two.
//
// Everything that changes behaviour is behind ENABLE_METER_TRACKING (default "false"). With it off, outbound_click
// events are unchanged and the /admin/payouts and /admin/revenue routes 404.
//
// Rules this module keeps (owner brief 2026-10-13):
//  - A click is never revenue. Every number is one of three tiers:
//      network_confirmed  payout rows exactly as entered (by Travelpayouts, a partner dashboard, or by hand)
//      allocated_estimate a partner's monthly payout split across segments by that partner's click share
//      clicks_only        segments that have clicks but no payout data
//  - Traveler data (trip length, party size, home origin, user id) is looked up server-side from an opaque trip
//    id and stored in the event's meta. It never goes in a URL, a query string or a partner sub_id.
//  - Insurance is out of scope while ROADMAP step 19 is open: an insurance partner's click is not enriched.

export const METERS = ['fare', 'leave', 'membership', 'audience', 'data'];
export const ATTRIBUTIONS = ['sub_id', 'none'];
export const TRIP_LENGTH_BUCKETS = ['weekend', '4-6', '7-10', '11-14', '2+ weeks', '30_plus'];
export const UNKNOWN_BUCKET = 'unknown';
export const PAYOUT_SOURCES = ['travelpayouts_api', 'partner_dashboard', 'manual']; // highest precedence first
export const SMALL_BUCKET_SIGNUPS = 30;

// meter: which revenue meter a click on this partner belongs to.
// category_slug: a short stable name (the partners table's `category` stays the display label).
// attribution: 'sub_id' only where the network reports conversions back with an id we send. Only Aviasales does
// today (marker=314524.<trip_id>). Every other partner link is a personal referral link that carries no id of ours,
// and where that is merely unconfirmed it is filled as 'none' (see the report in the F0 hand-off).
export const PARTNER_REGISTRY = {
  aviasales: { meter: 'fare', category_slug: 'flights', attribution: 'sub_id' },
  'us-global-mail': { meter: 'leave', category_slug: 'mail', attribution: 'none' },
  bounce: { meter: 'leave', category_slug: 'luggage_storage', attribution: 'none' },
  airhelp: { meter: 'leave', category_slug: 'flight_compensation', attribution: 'none' },
  yesim: { meter: 'leave', category_slug: 'esim', attribution: 'none' },
  holafly: { meter: 'leave', category_slug: 'esim', attribution: 'none' },
  wise: { meter: 'leave', category_slug: 'currency', attribution: 'none' },
  nordvpn: { meter: 'leave', category_slug: 'vpn', attribution: 'none' },
  'rocket-languages': { meter: 'leave', category_slug: 'language', attribution: 'none' },
  tiqets: { meter: 'leave', category_slug: 'activities', attribution: 'none' },
  gocity: { meter: 'leave', category_slug: 'city_pass', attribution: 'none' },
  qeeq: { meter: 'leave', category_slug: 'car_rental', attribution: 'none' },
  'welcome-pickups': { meter: 'leave', category_slug: 'transfers', attribution: 'none' },
  timekettle: { meter: 'leave', category_slug: 'travel_gear', attribution: 'none' },
  'parking-access': { meter: 'leave', category_slug: 'parking', attribution: 'none' },
  rover: { meter: 'leave', category_slug: 'pet_care', attribution: 'none' },
  'pet-gear': { meter: 'leave', category_slug: 'pet_supplies', attribution: 'none' },
  // Insurance: meter leave, category insurance. Step 19 is open, so it is never enriched or counted as new tracking.
  safetywing: { meter: 'leave', category_slug: 'insurance', attribution: 'none' },
};

export function registryFor(slug) {
  return PARTNER_REGISTRY[String(slug || '').toLowerCase()] || null;
}

export function meterForPartner(slug) {
  return registryFor(slug)?.meter || null;
}

// A flight outbound click is a click on a fare-meter partner (today: Aviasales; later a Fare Search partner would
// be added to the registry with meter "fare" and be counted here without any other change).
export function isFlightOutbound(slug) {
  return meterForPartner(slug) === 'fare';
}

export function isInsurancePartner(slug) {
  return registryFor(slug)?.category_slug === 'insurance';
}

// Adds the registry fields to a partner object (used on AWAY_MODE_PARTNERS and on rows read from D1).
export function withRegistryFields(partner) {
  const r = registryFor(partner?.slug);
  return r ? { ...partner, meter: r.meter, category_slug: r.category_slug, attribution: r.attribution } : partner;
}

export function meterTrackingEnabled(env) {
  return env?.ENABLE_METER_TRACKING === 'true';
}

export function bucketTripLength(raw) {
  return TRIP_LENGTH_BUCKETS.includes(raw) ? raw : UNKNOWN_BUCKET;
}

// Extra meta for an outbound_click, looked up server-side. `tripId` is the only identifier taken from the URL, and
// it is an opaque uuid. One indexed query (trips PK joined to users PK) resolves the traveler; a click without a
// trip id, or with an unknown one, has null traveler fields and user_known false. Never throws.
// The signed-in user cannot be read from the request itself: /out is a plain navigation, and the Worker's Clerk
// check reads only an Authorization header, so a trip id is the only way to a user (see the F0 hand-off).
export async function clickContext(env, { slug, tripId, src = null, slot = null }) {
  if (!meterTrackingEnabled(env)) return {};
  const reg = registryFor(slug);
  if (!reg || reg.category_slug === 'insurance') return {};
  const out = {
    meter: reg.meter,
    category: reg.category_slug,
    trip_length_bucket: null,
    origin: null,
    party_size: null,
    src: src || null,
    slot: slot || null,
    trip_id: null,
    user_known: false,
  };
  const id = tripId && tripId !== 'anon' ? String(tripId) : null;
  if (!id || !env?.DB) return out;
  out.trip_id = id;
  try {
    const row = await env.DB.prepare(
      `SELECT users.trip_length AS trip_length, users.passenger_count AS party_size,
              users.origin_iata AS user_origin, trips.origin_iata AS route_origin
       FROM trips JOIN users ON users.id = trips.user_id WHERE trips.trip_id = ?`
    ).bind(id).first();
    if (row) {
      out.user_known = true;
      out.trip_length_bucket = TRIP_LENGTH_BUCKETS.includes(row.trip_length) ? row.trip_length : null;
      out.party_size = Number.isFinite(Number(row.party_size)) ? Number(row.party_size) : null;
      out.origin = row.user_origin || row.route_origin || null;
    }
  } catch (error) {
    // a missing table or column: leave the traveler fields null; the redirect and the click are unaffected
  }
  return out;
}

// ---------- partner payouts ----------

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidMonth(m) {
  return typeof m === 'string' && MONTH_RE.test(m);
}

// Returns { rows, errors }. Nothing is written unless errors is empty (all or nothing).
export function validatePayoutRows(input, knownSlugs = Object.keys(PARTNER_REGISTRY)) {
  const list = Array.isArray(input) ? input : input && typeof input === 'object' ? [input] : null;
  if (!list || list.length === 0) return { rows: [], errors: ['body must be a payout row or a non-empty array of rows'] };
  if (list.length > 200) return { rows: [], errors: ['at most 200 rows per request'] };
  const known = new Set(knownSlugs);
  const rows = [];
  const errors = [];
  list.forEach((r, i) => {
    const at = `row ${i}`;
    if (!r || typeof r !== 'object') { errors.push(`${at}: must be an object`); return; }
    if (!isValidMonth(r.month)) errors.push(`${at}: month must be YYYY-MM`);
    const partner = String(r.partner_id || '').toLowerCase();
    if (!known.has(partner)) errors.push(`${at}: unknown partner_id "${String(r.partner_id || '').slice(0, 40)}"`);
    const amount = typeof r.amount_usd === 'number' ? r.amount_usd : Number(r.amount_usd);
    if (r.amount_usd === undefined || r.amount_usd === null || r.amount_usd === '' || !Number.isFinite(amount) || amount < 0) {
      errors.push(`${at}: amount_usd must be a number >= 0`);
    }
    const conversions = r.conversions === undefined || r.conversions === null || r.conversions === '' ? 0 : Number(r.conversions);
    if (!Number.isInteger(conversions) || conversions < 0) errors.push(`${at}: conversions must be an integer >= 0`);
    const source = r.source === undefined || r.source === null || r.source === '' ? 'manual' : String(r.source);
    if (!PAYOUT_SOURCES.includes(source)) errors.push(`${at}: source must be one of ${PAYOUT_SOURCES.join(', ')}`);
    const note = r.note === undefined || r.note === null ? null : String(r.note).slice(0, 200);
    rows.push({ month: r.month, partner_id: partner, amount_usd: Math.round(amount * 100) / 100, conversions, source, note });
  });
  return { rows: errors.length ? [] : rows, errors };
}

async function ensurePayoutsTable(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS partner_payouts (
      month TEXT NOT NULL,
      partner_id TEXT NOT NULL,
      amount_usd REAL NOT NULL,
      conversions INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL,
      note TEXT,
      entered_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (month, partner_id, source)
    )
  `).run();
}

export async function upsertPayouts(env, rows) {
  await ensurePayoutsTable(env);
  for (const r of rows) {
    await env.DB.prepare(`
      INSERT INTO partner_payouts (month, partner_id, amount_usd, conversions, source, note, entered_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(month, partner_id, source) DO UPDATE SET
        amount_usd = excluded.amount_usd, conversions = excluded.conversions,
        note = excluded.note, entered_at = datetime('now')
    `).bind(r.month, r.partner_id, r.amount_usd, r.conversions, r.source, r.note).run();
  }
  return rows.length;
}

export async function listPayouts(env, month) {
  await ensurePayoutsTable(env);
  const res = await env.DB.prepare(
    `SELECT month, partner_id, amount_usd, conversions, source, note, entered_at
     FROM partner_payouts WHERE month = ? ORDER BY partner_id, source`
  ).bind(month).all();
  return res.results || [];
}

// ---------- the revenue report ----------

const NOT_BOT = "(meta IS NULL OR meta NOT LIKE '%\"ua_class\":\"bot\"%')";

function monthBounds(month) {
  const [y, m] = month.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  const f = (d) => d.toISOString().slice(0, 19).replace('T', ' ');
  return { start: f(start), end: f(end) };
}

const cents = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const per100 = (n, d) => (d > 0 ? Math.round((n / d) * 100 * 100) / 100 : null);

// Splits `amount` across weights so the parts add back to `amount` to the cent: rounded shares, with any
// rounding remainder given to the largest segment.
export function allocate(amount, weights) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  const total = entries.reduce((a, [, w]) => a + w, 0);
  if (!total) return {};
  const out = {};
  let assigned = 0;
  let largest = entries[0][0];
  for (const [k, w] of entries) {
    out[k] = cents((amount * w) / total);
    assigned += out[k];
    if (w > weights[largest]) largest = k;
  }
  out[largest] = cents(out[largest] + (amount - assigned));
  return out;
}

export async function computeRevenueReport(env, { month, now = new Date() } = {}) {
  const { start, end } = monthBounds(month);
  const notes = [];
  const safe = async (sql, binds) => {
    try { return (await env.DB.prepare(sql).bind(...binds).all()).results || []; } catch (e) { return null; }
  };

  // Clicks, bots excluded the same way /admin/metrics excludes them. Rows from before the bot class carry no
  // ua_class and count (they are reported separately as unclassified).
  // Clicks by src (the surface), for the same month: lets a branch such as leave_long be split out.
  const srcRows = await safe(`
    SELECT COALESCE(NULLIF(source, ''), '(none)') AS src, partner, count(*) AS n
    FROM events
    WHERE event_type = 'outbound_click' AND partner IS NOT NULL AND ts >= ? AND ts < ? AND ${NOT_BOT}
    GROUP BY src, partner`, [start, end]);

  const clickRows = await safe(`
    SELECT partner, json_extract(meta, '$.trip_length_bucket') AS bucket, count(*) AS n,
           sum(CASE WHEN meta IS NULL OR json_extract(meta, '$.ua_class') IS NULL THEN 1 ELSE 0 END) AS unclassified
    FROM events
    WHERE event_type = 'outbound_click' AND partner IS NOT NULL AND ts >= ? AND ts < ? AND ${NOT_BOT}
    GROUP BY partner, bucket`, [start, end]);
  if (clickRows === null) notes.push('events table not available');

  let payoutRows;
  try { payoutRows = await listPayouts(env, month); } catch (e) { payoutRows = []; notes.push('partner_payouts table not available'); }

  const signupRows = await safe(
    'SELECT trip_length AS bucket, count(*) AS n FROM users WHERE created_at >= ? AND created_at < ? GROUP BY trip_length', [start, end]);
  if (signupRows === null) notes.push('users table not available');

  // Per partner: clicks by segment.
  const partners = {};
  let unclassified = 0;
  for (const r of clickRows || []) {
    const p = (partners[r.partner] = partners[r.partner] || { clicks: 0, segments: {} });
    const seg = TRIP_LENGTH_BUCKETS.includes(r.bucket) ? r.bucket : UNKNOWN_BUCKET;
    p.clicks += r.n;
    p.segments[seg] = (p.segments[seg] || 0) + r.n;
    unclassified += r.unclassified || 0;
  }

  // Per partner payout: all rows are listed as entered; totals use the highest-precedence source so two sources
  // for the same partner and month are never added together.
  const rowsByPartner = {};
  for (const r of payoutRows) (rowsByPartner[r.partner_id] = rowsByPartner[r.partner_id] || []).push(r);
  const chosen = {};
  for (const [pid, list] of Object.entries(rowsByPartner)) {
    chosen[pid] = [...list].sort((a, b) => PAYOUT_SOURCES.indexOf(a.source) - PAYOUT_SOURCES.indexOf(b.source))[0];
  }

  const byPartner = [];
  const allocated = []; // { partner_id, meter, segment, amount_usd }
  const clicksOnly = [];
  const slugs = new Set([...Object.keys(partners), ...Object.keys(chosen)]);
  for (const slug of [...slugs].sort()) {
    const meter = meterForPartner(slug) || 'unknown';
    const c = partners[slug] || { clicks: 0, segments: {} };
    const payout = chosen[slug] || null;
    byPartner.push({
      partner_id: slug, meter, category: registryFor(slug)?.category_slug || null,
      human_clicks: c.clicks,
      payout_usd: payout ? payout.amount_usd : null,
      payout_source: payout ? payout.source : null,
      revenue_per_click_usd: payout && c.clicks > 0 ? Math.round((payout.amount_usd / c.clicks) * 10000) / 10000 : null,
    });
    if (payout && c.clicks > 0) {
      for (const [seg, amt] of Object.entries(allocate(payout.amount_usd, c.segments))) {
        allocated.push({ partner_id: slug, meter, segment: seg, amount_usd: amt });
      }
    } else if (c.clicks > 0) {
      for (const [seg, n] of Object.entries(c.segments)) clicksOnly.push({ partner_id: slug, meter, segment: seg, clicks: n });
    }
  }

  const byMeter = {};
  for (const row of byPartner) {
    const m = (byMeter[row.meter] = byMeter[row.meter] || { human_clicks: 0, payout_usd: 0, partners_with_payout: 0 });
    m.human_clicks += row.human_clicks;
    if (row.payout_usd !== null) { m.payout_usd = cents(m.payout_usd + row.payout_usd); m.partners_with_payout += 1; }
  }
  for (const m of Object.values(byMeter)) {
    m.revenue_per_click_usd = m.human_clicks > 0 && m.partners_with_payout > 0 ? Math.round((m.payout_usd / m.human_clicks) * 10000) / 10000 : null;
  }

  // Gate view: per trip-length bucket.
  const signups = {};
  for (const r of signupRows || []) {
    const b = TRIP_LENGTH_BUCKETS.includes(r.bucket) ? r.bucket : UNKNOWN_BUCKET;
    signups[b] = (signups[b] || 0) + r.n;
  }
  const clicksBy = (meter, bucket) => byPartner.reduce((a, p) => {
    if (p.meter !== meter) return a;
    return a + ((partners[p.partner_id]?.segments[bucket]) || 0);
  }, 0);
  const allocLeave = (bucket) => cents(allocated.filter((a) => a.meter === 'leave' && a.segment === bucket).reduce((s, a) => s + a.amount_usd, 0));
  const gate = [...TRIP_LENGTH_BUCKETS, UNKNOWN_BUCKET].map((bucket) => {
    const s = signups[bucket] || 0;
    const leaveClicks = clicksBy('leave', bucket);
    const flightClicks = clicksBy('fare', bucket);
    const al = allocLeave(bucket);
    return {
      trip_length_bucket: bucket,
      signups: s,
      leave_clicks: leaveClicks,
      flight_clicks: flightClicks,
      leave_clicks_per_100_signups: per100(leaveClicks, s),
      flight_clicks_per_100_signups: per100(flightClicks, s),
      allocated_leave_revenue_usd: al,
      allocated_leave_revenue_per_100_signups_usd: per100(al, s),
      too_small: s < SMALL_BUCKET_SIGNUPS,
      note: s < SMALL_BUCKET_SIGNUPS ? `too small: fewer than ${SMALL_BUCKET_SIGNUPS} signups` : null,
    };
  });

  // By src: each src's human clicks, and each partner's payout split across srcs by click share (an estimate, and it
  // adds back to the payout like the segment allocation does).
  const srcWeights = {}; // partner -> { src: n }
  for (const r of srcRows || []) (srcWeights[r.partner] = srcWeights[r.partner] || {})[r.src] = r.n;
  const bySrc = {};
  for (const [partner, weights] of Object.entries(srcWeights)) {
    const payout = chosen[partner] || null;
    const split = payout ? allocate(payout.amount_usd, weights) : {};
    for (const [src, n] of Object.entries(weights)) {
      const e = (bySrc[src] = bySrc[src] || { src, human_clicks: 0, allocated_estimate_usd: 0, partners: {} });
      e.human_clicks += n;
      e.partners[partner] = (e.partners[partner] || 0) + n;
      if (split[src] !== undefined) e.allocated_estimate_usd = cents(e.allocated_estimate_usd + split[src]);
    }
  }

  return {
    month,
    generated_at: now.toISOString(),
    bots_excluded: true,
    tiers: {
      network_confirmed: 'payout rows exactly as entered (source, amount, conversions); nothing here is inferred from clicks',
      allocated_estimate: 'ESTIMATE: each partner\'s monthly payout split across segments in proportion to that partner\'s human clicks in each segment; it adds back to the payout',
      clicks_only: 'segments with human clicks but no payout data; a click is never revenue',
    },
    by_meter: byMeter,
    by_partner: byPartner,
    network_confirmed: payoutRows,
    allocated_estimate: { label: 'estimate', rows: allocated },
    clicks_only: clicksOnly,
    by_src: Object.values(bySrc).sort((a, b) => b.human_clicks - a.human_clicks),
    gate_view: gate,
    unclassified_clicks: unclassified,
    notes: [
      ...notes,
      'a click has a trip-length bucket only when its link carried a trip id; other clicks are in the unknown segment',
      'totals use one payout row per partner and month: travelpayouts_api, then partner_dashboard, then manual',
      'signups are users created in the month, grouped by their current trip_length',
      'clicks recorded before the bot class existed have no ua_class and are counted; see unclassified_clicks',
    ],
  };
}
