const AIRLINES = {
  AA: 'American Airlines', AC: 'Air Canada', AI: 'Air India', AM: 'Aeroméxico', AS: 'Alaska Airlines',
  AT: 'Royal Air Maroc', AV: 'Avianca', B6: 'JetBlue', BA: 'British Airways', BF: 'French Bee',
  CA: 'Air China', CI: 'China Airlines', CM: 'Copa Airlines', CX: 'Cathay Pacific', DE: 'Condor',
  DL: 'Delta', DM: 'Arajet', EI: 'Aer Lingus', ET: 'Ethiopian Airlines', EY: 'Etihad',
  F9: 'Frontier', FI: 'Icelandair', FJ: 'Fiji Airways', H2: 'SKY Airline', IB: 'Iberia',
  IZ: 'Arkia', JX: 'STARLUX', KE: 'Korean Air', KL: 'KLM', KQ: 'Kenya Airways', KU: 'Kuwait Airways',
  LA: 'LATAM', LH: 'Lufthansa', LO: 'LOT Polish Airlines', LX: 'SWISS', LY: 'EL AL',
  MF: 'Xiamen Airlines', MS: 'EgyptAir', MU: 'China Eastern', N0: 'Norse Atlantic', OZ: 'Asiana',
  PD: 'Porter', PR: 'Philippine Airlines', QR: 'Qatar Airways', SK: 'SAS', SQ: 'Singapore Airlines',
  SV: 'Saudia', TK: 'Turkish Airlines', TP: 'TAP Air Portugal', UA: 'United', VB: 'Viva Aerobus',
  W4: 'Wizz Air Malta', W6: 'Wizz Air', WN: 'Southwest', WS: 'WestJet', Y4: 'Volaris',
};

const ORIGIN_CITIES = {
  JFK: 'New York', EWR: 'Newark', LAX: 'Los Angeles', ORD: 'Chicago', ATL: 'Atlanta', DFW: 'Dallas',
  SFO: 'San Francisco', MIA: 'Miami', IAD: 'Washington', SEA: 'Seattle', IAH: 'Houston',
  BOS: 'Boston', TLV: 'Tel Aviv',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function airlineName(code) {
  return AIRLINES[String(code || '').toUpperCase()] || null;
}

export function originCity(iata) {
  return ORIGIN_CITIES[String(iata || '').toUpperCase()] || String(iata || '');
}

export function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return '$' + Math.round(n).toLocaleString('en-US');
}

// "Lisbon, Portugal" -> { city: "Lisbon", country: "Portugal" }
export function splitDestination(displayName) {
  const name = String(displayName || '').trim();
  const i = name.lastIndexOf(',');
  if (i === -1) return { city: name, country: null };
  return { city: name.slice(0, i).trim(), country: name.slice(i + 1).trim() || null };
}

// The Aviasales search URL encodes both airports and both dates: /search/JFK2711LCA11121
// = JFK, 27 Nov, LCA, 11 Dec, 1 passenger. Only the destination airport is used here; the dates
// come from departure_at/return_at, which carry the year.
export function parseBookingLink(link) {
  const m = String(link || '').match(/\/search\/([A-Z]{3})(\d{2})(\d{2})([A-Z]{3})(\d{2})(\d{2})/);
  if (!m) return null;
  return { origin: m[1], destination: m[4] };
}

function dateParts(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

// Uses the date exactly as written (the airport's local date) instead of converting timezones,
// so a 22:35 departure doesn't slide to the next day for a reader in another zone.
export function formatWindow(departureAt, returnAt) {
  const dep = dateParts(departureAt);
  if (!dep) return null;
  const fmt = (p) => `${MONTHS[p.m - 1]} ${p.d}`;
  const ret = dateParts(returnAt);
  if (!ret) return { text: fmt(dep), days: null };
  const days = Math.round((Date.UTC(ret.y, ret.m - 1, ret.d) - Date.UTC(dep.y, dep.m - 1, dep.d)) / 86400000);
  const sameYear = dep.y === ret.y;
  const text = `${fmt(dep)}${sameYear ? '' : `, ${dep.y}`} – ${fmt(ret)}, ${ret.y}`;
  return { text, days: days > 0 ? days : null };
}

export function formatAsOf(iso) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return null;
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${hh}:${mm} UTC`;
}

export function formatEditionDate(date) {
  const d = new Date(date);
  return `${WEEKDAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function isoDay(date) {
  return new Date(date).toISOString().slice(0, 10);
}

export function dayOfYear(date) {
  const d = new Date(date);
  return Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86400000);
}

// Adds UTM parameters to links on sparkfare.com only. Affiliate and partner URLs are left exactly
// as they are so the Aviasales marker and other tracking parameters are never disturbed.
export function addUtm(url, { campaign, content } = {}) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  if (u.hostname !== 'sparkfare.com' && u.hostname !== 'www.sparkfare.com') return url;
  u.searchParams.set('utm_source', 'email');
  u.searchParams.set('utm_medium', 'daily');
  if (campaign) u.searchParams.set('utm_campaign', campaign);
  if (content) u.searchParams.set('utm_content', content);
  return u.toString();
}

// Deterministic: the same edition number or date always gives the same tip.
export function pickTip(tips, seed) {
  if (!Array.isArray(tips) || tips.length === 0) return null;
  const idx = ((Number(seed) || 0) % tips.length + tips.length) % tips.length;
  return tips[idx];
}

// Returns the price drop, in dollars, between the latest observation at least 7 days older than
// `foundAt` and the current price, or null when there is no such observation or the drop is
// under the threshold.
export function dropFromWeekAgo(observations, price, foundAt, minDrop = 25) {
  const found = dateParts(foundAt);
  if (!found || !Array.isArray(observations)) return null;
  const cutoff = Date.UTC(found.y, found.m - 1, found.d) - 7 * 86400000;
  let prior = null;
  for (const obs of observations) {
    const p = dateParts(obs?.date);
    if (!p || !Number.isFinite(Number(obs.price))) continue;
    if (Date.UTC(p.y, p.m - 1, p.d) <= cutoff) prior = Number(obs.price);
  }
  if (prior === null) return null;
  const drop = Math.round(prior - Number(price));
  return drop >= minDrop ? drop : null;
}
