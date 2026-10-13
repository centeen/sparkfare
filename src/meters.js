// F0: revenue-per-departure measurement. Records which revenue meter an outbound click belongs to and the
// trip-length bucket of the traveler behind it, then joins what networks and partners report back to those
// buckets. Everything here is behind ENABLE_METER_TRACKING (default "false"); with the flag off, outbound_click
// events are byte-identical to before.
//
// Rules this module keeps (owner brief 2026-10-13):
//  - A click is never revenue. Every number is labelled one of three tiers:
//      network_confirmed  what a network or partner reported (booking counts, ticket value, payout totals)
//      allocated_estimate a confirmed total spread over clicks, or a ticket value times an assumed rate
//      clicks_only        counts of outbound clicks, with no money attached
//  - Traveler data (trip length, dates, party size, email, user id) is stored in the event's meta server-side
//    and never goes in a URL, a query string or a partner sub_id.
//  - Insurance is out of scope while ROADMAP step 19 is open: an insurance partner's click gets no new
//    tracking fields from this module.

export const METERS = ['fare', 'leave', 'membership', 'audience', 'data'];
export const TRIP_LENGTH_BUCKETS = ['weekend', '4-6', '7-10', '11-14', '2+ weeks', '30+ days'];
export const UNKNOWN_BUCKET = 'unknown';

// What Aviasales pays Sparkfare, as a share of the ticket, per the owner's brief ("~1.1% of ticket, zero on
// low-cost carriers"). It is an assumption used only to turn confirmed ticket value into an allocated
// estimate, and it overstates a low-cost-carrier booking, which pays nothing.
export const FARE_ALLOCATION_RATE = 0.011;

const INSURANCE_SLUGS = new Set(['safetywing', 'world-nomads', 'worldnomads']);

export function meterTrackingEnabled(env) {
  return env?.ENABLE_METER_TRACKING === 'true';
}

export function isInsurancePartner(slug, category) {
  if (INSURANCE_SLUGS.has(String(slug || '').toLowerCase())) return true;
  return /insurance/i.test(String(category || ''));
}

export function bucketTripLength(raw) {
  return TRIP_LENGTH_BUCKETS.includes(raw) ? raw : UNKNOWN_BUCKET;
}

// 'aviasales' is the fare meter; every Away Mode partner is the leave meter. Insurance returns null: no new
// tracking while step 19 is open.
export function meterForClick(slug, category) {
  if (String(slug || '').toLowerCase() === 'aviasales') return 'fare';
  if (isInsurancePartner(slug, category)) return null;
  return 'leave';
}

// The trip owner's trip-length bucket, looked up server-side from the trip id the link already carries.
// Anonymous clicks (no trip id) and unknown ids are 'unknown'. Never throws.
export async function lookupTripLengthBucket(env, tripId) {
  if (!env?.DB || !tripId || tripId === 'anon') return UNKNOWN_BUCKET;
  try {
    const row = await env.DB.prepare(
      'SELECT users.trip_length AS trip_length FROM trips JOIN users ON users.id = trips.user_id WHERE trips.trip_id = ?'
    ).bind(tripId).first();
    return bucketTripLength(row?.trip_length);
  } catch (error) {
    return UNKNOWN_BUCKET;
  }
}

// Extra fields for an outbound_click event's meta. Empty when the flag is off or the click is insurance.
export async function meterMeta(env, { slug, category, tripId }) {
  if (!meterTrackingEnabled(env)) return {};
  const meter = meterForClick(slug, category);
  if (!meter) return {};
  return { meter, trip_length: await lookupTripLengthBucket(env, tripId) };
}

function round(n, places = 2) {
  const f = 10 ** places;
  return Math.round((Number(n) + Number.EPSILON) * f) / f;
}

async function rows(env, sql, binds = []) {
  try {
    const res = await env.DB.prepare(sql).bind(...binds).all();
    return res.results || [];
  } catch (error) {
    return null; // a missing table or column: the section reports "not available", the report still returns
  }
}

// sinceDays: the click and trip window. Payouts are entered per calendar month, so a month is included if any
// of it falls in the window.
export async function computeMeterReport(env, { sinceDays = 90, now = new Date() } = {}) {
  const notes = [];
  const since = `-${Math.max(1, Math.floor(sinceDays))} days`;
  const bucket = (b) => (TRIP_LENGTH_BUCKETS.includes(b) ? b : UNKNOWN_BUCKET);
  const emptyBucket = () => ({
    departures: 0,
    fare: { clicks: 0, confirmed_bookings: 0, confirmed_ticket_eur: 0, allocated_revenue_eur: 0 },
    leave: { clicks: 0, allocated_revenue: 0 },
  });
  const byBucket = {};
  const at = (b) => (byBucket[bucket(b)] = byBucket[bucket(b)] || emptyBucket());

  // 1. Clicks (clicks_only tier). Bot-classified clicks are left out; rows from before the bot class count.
  const clickRows = await rows(env, `
    SELECT json_extract(meta, '$.meter') AS meter, json_extract(meta, '$.trip_length') AS trip_length,
           partner, strftime('%Y-%m', ts) AS month, count(*) AS n
    FROM events
    WHERE event_type = 'outbound_click' AND ts >= datetime('now', ?)
      AND COALESCE(json_extract(meta, '$.ua_class'), '') != 'bot'
    GROUP BY 1, 2, 3, 4`, [since]);
  const clicks = { fare: 0, leave: 0, untagged: 0 };
  const leaveClicksByPartnerMonth = {}; // `${slug}|${month}` -> { bucket: n }
  if (clickRows === null) notes.push('events table not available');
  for (const r of clickRows || []) {
    const meter = r.meter === 'fare' || r.meter === 'leave' ? r.meter : null;
    if (!meter) { clicks.untagged += r.n; continue; } // recorded before tracking, or an insurance click
    clicks[meter] += r.n;
    const b = bucket(r.trip_length);
    at(b)[meter].clicks += r.n;
    if (meter === 'leave') {
      const key = `${r.partner}|${r.month}`;
      leaveClicksByPartnerMonth[key] = leaveClicksByPartnerMonth[key] || {};
      leaveClicksByPartnerMonth[key][b] = (leaveClicksByPartnerMonth[key][b] || 0) + r.n;
    }
  }

  // 2. Departures: tracked trips by the traveler's trip-length bucket. ASSUMED definition (see report notes).
  const tripRows = await rows(env, `
    SELECT users.trip_length AS trip_length, count(*) AS n
    FROM trips JOIN users ON users.id = trips.user_id
    WHERE trips.clicked_at >= datetime('now', ?)
    GROUP BY 1`, [since]);
  if (tripRows === null) notes.push('trips table not available');
  for (const r of tripRows || []) at(r.trip_length).departures += r.n;

  // 3. Fare: confirmed paid bookings (network_confirmed: count and ticket value, not revenue) and the
  //    allocated estimate (ticket value x FARE_ALLOCATION_RATE).
  const bookingRows = await rows(env, `
    SELECT users.trip_length AS trip_length, count(*) AS n, COALESCE(SUM(trips.price_eur), 0) AS ticket_eur
    FROM trips JOIN users ON users.id = trips.user_id
    WHERE trips.status = 'booked' AND trips.price_eur IS NOT NULL AND trips.clicked_at >= datetime('now', ?)
    GROUP BY 1`, [since]);
  let bookings = 0;
  let ticketEur = 0;
  for (const r of bookingRows || []) {
    const b = at(r.trip_length);
    b.fare.confirmed_bookings += r.n;
    b.fare.confirmed_ticket_eur = round(b.fare.confirmed_ticket_eur + r.ticket_eur);
    b.fare.allocated_revenue_eur = round(b.fare.confirmed_ticket_eur * FARE_ALLOCATION_RATE);
    bookings += r.n;
    ticketEur += r.ticket_eur;
  }

  // 4. Leave: partner-reported monthly revenue (network_confirmed, entered by the owner) spread over that
  //    partner's non-bot clicks that month by trip-length bucket (allocated_estimate). A month with no clicks
  //    is unallocated and reported as such.
  const payoutRows = await rows(env, `
    SELECT slug, month, reported_conversions, reported_revenue
    FROM partner_conversions
    WHERE month >= strftime('%Y-%m', datetime('now', ?))`, [since]);
  if (payoutRows === null) notes.push('partner_conversions table not available');
  let reportedRevenue = 0;
  let unallocatedRevenue = 0;
  const payouts = [];
  for (const p of payoutRows || []) {
    const revenue = Number(p.reported_revenue) || 0;
    if (revenue <= 0) continue;
    reportedRevenue += revenue;
    const shares = leaveClicksByPartnerMonth[`${p.slug}|${p.month}`];
    const total = shares ? Object.values(shares).reduce((a, b) => a + b, 0) : 0;
    if (!total) {
      unallocatedRevenue += revenue;
      payouts.push({ slug: p.slug, month: p.month, reported_revenue: revenue, allocated: false });
      continue;
    }
    for (const [b, n] of Object.entries(shares)) {
      at(b).leave.allocated_revenue = round(at(b).leave.allocated_revenue + (revenue * n) / total);
    }
    payouts.push({ slug: p.slug, month: p.month, reported_revenue: revenue, allocated: true });
  }

  // 5. Per departure, per bucket. Null when the bucket has no tracked departures; the 'unknown' bucket is
  //    reported but has no per-departure figure because it is not a real trip-length group.
  const perBucket = {};
  for (const [b, v] of Object.entries(byBucket)) {
    const d = v.departures;
    const per = (x) => (b !== UNKNOWN_BUCKET && d > 0 ? round(x / d) : null);
    perBucket[b] = {
      ...v,
      per_departure: {
        fare_allocated_revenue_eur: per(v.fare.allocated_revenue_eur),
        leave_allocated_revenue: per(v.leave.allocated_revenue),
      },
    };
  }

  return {
    generated_at: now.toISOString(),
    window_days: sinceDays,
    tiers: {
      clicks_only: 'outbound clicks with no money attached; a click is never revenue',
      network_confirmed: 'what Travelpayouts or a partner reported: paid bookings and ticket value (not revenue), and the monthly payout totals the owner enters',
      allocated_estimate: 'a confirmed total spread over clicks, or confirmed ticket value times an assumed rate',
    },
    meters: {
      fare: {
        clicks_only: { clicks: clicks.fare },
        network_confirmed: { paid_bookings: bookings, ticket_value_eur: round(ticketEur) },
        allocated_estimate: { revenue_eur: round(ticketEur * FARE_ALLOCATION_RATE), rate_assumed: FARE_ALLOCATION_RATE },
      },
      leave: {
        clicks_only: { clicks: clicks.leave },
        network_confirmed: { reported_revenue: round(reportedRevenue), payouts },
        allocated_estimate: { revenue: round(reportedRevenue - unallocatedRevenue), unallocated_revenue: round(unallocatedRevenue) },
      },
      membership: { status: 'not measured: Plus is waitlist only' },
      audience: { status: 'not measured: held until the digest archive is public' },
      data: { status: 'not measured: not covered by Travelpayouts written OK' },
    },
    untagged_clicks: clicks.untagged,
    by_trip_length: perBucket,
    notes: [
      ...notes,
      'departure = a tracked trip (a trips row) in the window; trips are created only for signed-in booking clicks',
      'fare revenue is an allocated estimate: confirmed ticket value x assumed rate; zero on low-cost carriers, so this overstates',
      'leave payouts are entered monthly by the owner in partner_conversions; currency is whatever the owner enters (assumed USD)',
      'clicks without a trip id (anonymous) land in the unknown bucket',
    ],
  };
}
