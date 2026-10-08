// Post-click email v2 (Phase A). Pure builders and renderers plus the unsubscribe-token helpers.
// Nothing here does I/O except the WebCrypto calls in the token helpers, so every rule below is
// directly unit-testable. The sender in src/email.js decides whether to use this at all
// (ENABLE_EMAIL_CHECKLIST_V2, a postal address, a signing secret and a booking link must all exist).

import { EMAIL_PRIMARY_BUTTON, EMAIL_FOOTER_LINE, postClickReason } from './referralCopy.js';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "Dec 6" from an ISO date or datetime, or null. Reads the calendar date as written (the first 10
// characters) instead of converting through a timezone, so a late-evening departure with an offset
// never shows as the next or previous day.
export function formatShortDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return null;
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${MONTHS_SHORT[month - 1]} ${day}`;
}

export function isAviasalesLink(raw) {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && u.hostname === 'www.aviasales.com';
  } catch {
    return false;
  }
}

// ---- Rules (change these, not the functions) ---------------------------------------------------
export const CHECKLIST_CONFIG = {
  // Registry slug -> checklist item. A live partner with no entry here is never featured.
  slugToItem: {
    yesim: 'esim',
    'welcome-pickups': 'transfer',
    wise: 'money',
    'us-global-mail': 'mail',
    'parking-access': 'parking',
    bounce: 'luggage',
    tiqets: 'tours',
    gocity: 'tours',
    'rocket-languages': 'language',
    timekettle: 'translator',
    nordvpn: 'vpn',
  },
  // Never featured in this email. Medical cover is held back pending the insurance decision
  // (research doc section 7, decision 1); flight-disruption help is not a before-you-go item.
  excludedItems: ['medical', 'disruption'],
  // Order used to fill the top three and then the teaser. One partner per item.
  priority: ['esim', 'transfer', 'money', 'mail', 'parking', 'luggage', 'vpn', 'tours', 'language', 'translator'],
  // Items that need a real country on the trip to be shown. With no country field they are skipped.
  internationalOnly: ['esim', 'transfer', 'money', 'language', 'translator'],
  // Shown when the country is unknown (nothing is inferred from the destination string).
  safeWhenUnknown: ['luggage', 'parking', 'tours', 'vpn'],
  homeCountry: 'United States',
  topCount: 3,
  teaserCount: 4,
  // Minimum days before departure for an item to still make sense. null days (no departure date)
  // only blocks items that need a date.
  minDaysAhead: { esim: 1, transfer: 1, money: 3, mail: 7, parking: 5, luggage: 0, tours: 0, vpn: 0, language: 14, translator: 14 },
  minTripDays: { mail: 14 },
  chips: {
    esim: 'Day before you fly', transfer: 'This week', money: 'Before you pack',
    mail: '1 to 2 weeks before', parking: '1 week before', luggage: 'Last day',
    tours: 'Any time', language: '2+ weeks before', translator: '2+ weeks before', vpn: 'Before you go',
  },
  // Short benefit headlines. NEW COPY, written for this email; flagged for review in the report.
  headlines: {
    esim: 'Land with data already on', transfer: 'Know how you’re getting from the airport',
    money: 'Have a way to pay locally', mail: 'Keep your mail from piling up',
    parking: 'Sort airport parking ahead', luggage: 'Free up your last day',
    tours: 'Line up things to do', language: 'Learn a few phrases first',
    translator: 'Talk to people, not just point', vpn: 'Protect your connection on public Wi-Fi',
  },
  teaserLabels: {
    esim: 'Travel eSIM', transfer: 'Airport transfer', money: 'Money abroad', mail: 'Mail forwarding',
    parking: 'Airport parking', luggage: 'Luggage storage on your last day', tours: 'Tours and attraction tickets',
    language: 'Language basics', translator: 'Translator earbuds', vpn: 'Public Wi-Fi protection',
  },
  buttonLabels: {
    esim: 'See eSIM options', transfer: 'Check airport transfers', money: 'See how it works',
    mail: 'See mail forwarding', parking: 'Check airport parking', luggage: 'Find luggage storage',
    tours: 'Browse tours and tickets', language: 'See the courses', translator: 'See translator earbuds', vpn: 'See the VPN',
  },
  // Blurbs that make an absolute or unsupported claim in the repo are replaced with a neutral
  // factual line here (flagged in the report). Everything else uses the repo blurb unchanged.
  blurbOverrides: {
    wise: 'Hold and spend in local currencies when you travel.',
    'welcome-pickups': 'A driver waiting at arrivals with your name on a sign, booked ahead.',
  },
  // Preferred partner when several map to the same item.
  preferredSlugs: { tours: ['tiqets', 'gocity'] },
};

const DAY_MS = 86400000;

function dayNumber(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return null;
  return Math.floor(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / DAY_MS);
}

export function daysBetween(fromIso, toIso) {
  const a = dayNumber(fromIso);
  const b = dayNumber(toIso);
  return a === null || b === null ? null : b - a;
}

export function daysToDeparture(departure_at, now = new Date()) {
  return daysBetween(now.toISOString(), departure_at);
}

// ---- Display helpers ---------------------------------------------------------------------------
export function formatDateRange(departure_at, return_at) {
  const d = formatShortDate(departure_at);
  const r = formatShortDate(return_at);
  if (!d) return null;
  if (!r) return d;
  const [dm, dd] = d.split(' ');
  const [rm, rd] = r.split(' ');
  return dm === rm ? `${d} to ${rd}` : `${d} to ${r}`;
}

// "JFK to CUN · Dec 6 to 13 · round trip", built only from fields that exist. The destination
// airport code is not stored on a trip, so the route reads "JFK to {destination}" never "to CUN".
export function routeLine(trip) {
  const parts = [];
  if (trip.origin_iata && trip.destination) parts.push(`${String(trip.origin_iata).toUpperCase()} to ${trip.destination}`);
  const range = formatDateRange(trip.departure_at, trip.return_at);
  if (range) parts.push(range);
  if (trip.return_at) parts.push('round trip');
  return parts.filter(Boolean).join(' · ');
}

export function priceLine(trip) {
  const p = Number(trip.price_at_click);
  if (!Number.isFinite(p) || p <= 0) return '';
  const base = `From $${Math.round(p).toLocaleString('en-US')}`;
  // Freshness is only claimed when a real as-of time was passed in. None is stored today.
  const asOf = trip.price_as_of ? formatAsOf(trip.price_as_of) : null;
  return asOf ? `${base} · last seen ${asOf}` : base;
}

export function formatAsOf(iso) {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return null;
  const date = formatShortDate(t.toISOString());
  const hh = t.getUTCHours();
  const mm = String(t.getUTCMinutes()).padStart(2, '0');
  return `${date}, ${((hh + 11) % 12) + 1}:${mm} ${hh < 12 ? 'am' : 'pm'} UTC`;
}

export const FARES_CHANGE_TEXT = 'Fares change. The final price is confirmed on the booking site.';
export const V2_DISCLOSURE_TEXT = "Sponsored: Sparkfare may earn a commission if you book through the button above or the buttons below, at no extra cost to you. Sparkfare doesn't sell or book travel.";

// ---- Selection ---------------------------------------------------------------------------------
export function buildChecklist(trip, partners, now = new Date(), config = CHECKLIST_CONFIG) {
  const live = (partners || []).filter((p) => p && p.slug && (p.status === undefined || p.status === 'live'));
  const days = daysToDeparture(trip.departure_at, now);
  const tripDays = daysBetween(trip.departure_at, trip.return_at);
  const country = trip.country ? String(trip.country) : null;
  const international = country ? country.toLowerCase() !== config.homeCountry.toLowerCase() : null;

  const eligible = (itemKey) => {
    if (config.excludedItems.includes(itemKey)) return false;
    if (international === null) {
      if (!config.safeWhenUnknown.includes(itemKey)) return false;
    } else if (!international && config.internationalOnly.includes(itemKey)) {
      return false;
    }
    if ((itemKey === 'language' || itemKey === 'translator') && !(trip.language && !/^english$/i.test(String(trip.language)))) return false;
    const minDays = config.minDaysAhead[itemKey];
    if (minDays > 0 && (days === null || days < minDays)) return false;
    if (minDays === 0 && days !== null && days < 0) return false;
    const minTrip = config.minTripDays[itemKey];
    if (minTrip && (tripDays === null || tripDays < minTrip)) return false;
    return true;
  };

  const items = [];
  for (const itemKey of config.priority) {
    if (!eligible(itemKey)) continue;
    const prefer = config.preferredSlugs[itemKey] || [];
    const candidates = live
      .filter((p) => config.slugToItem[p.slug] === itemKey)
      .sort((a, b) => {
        const ai = prefer.indexOf(a.slug); const bi = prefer.indexOf(b.slug);
        return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
      });
    const partner = candidates[0];
    if (!partner) continue;
    items.push({
      item_key: itemKey,
      partner_id: partner.slug,
      name: partner.name,
      timing_chip: config.chips[itemKey],
      headline: config.headlines[itemKey],
      line: config.blurbOverrides[partner.slug] || partner.blurb || '',
      button_label: config.buttonLabels[itemKey],
      teaser_label: config.teaserLabels[itemKey],
      href_slug: partner.slug,
    });
  }
  return items;
}

// ---- Links -------------------------------------------------------------------------------------
export function partnerHref(appUrl, slug, tripId, slot) {
  const q = new URLSearchParams();
  if (tripId) q.set('trip_id', tripId);
  q.set('src', 'email_v2');
  q.set('slot', String(slot));
  return `${appUrl}/out/${slug}?${q.toString()}`;
}

export function flightHref(appUrl, bookingLink, tripId) {
  const q = new URLSearchParams();
  q.set('url', bookingLink);
  if (tripId) q.set('trip_id', tripId);
  q.set('src', 'email_v2');
  q.set('slot', 'flight');
  return `${appUrl}/out/aviasales?${q.toString()}`;
}

// ---- Rendering ---------------------------------------------------------------------------------
const C = { paper: '#EDE6D6', paperDeep: '#E3D9C4', card: '#FBF8F0', ledger: '#2B2620', muted: '#6B6255', gold: '#E8B930', line: '#DCD3BF' };
const F_HEAD = "'Space Grotesk','Helvetica Neue',Helvetica,Arial,sans-serif";
const F_BODY = "Inter,'Helvetica Neue',Helvetica,Arial,sans-serif";
const F_MONO = "'IBM Plex Mono',Menlo,Consolas,'Courier New',monospace";
const REL = 'sponsored noopener noreferrer';

export function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function spacer(h) { return `<tr><td style="height:${h}px;line-height:${h}px;font-size:0;">&nbsp;</td></tr>`; }

function partnerCard(item, appUrl, tripId, slot) {
  return `
  <tr><td style="background:${C.card};border:1px solid ${C.line};border-radius:10px;padding:18px 20px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-size:13px;line-height:18px;"><span style="background:${C.gold};color:${C.ledger};font-weight:700;padding:3px 8px;border-radius:10px;">${escapeHtml(item.timing_chip)}</span></td>
      <td align="right" style="font-size:13px;line-height:18px;color:${C.muted};">Sponsored</td>
    </tr></table>
    <div style="font-family:${F_HEAD};font-size:18px;line-height:24px;font-weight:500;margin-top:10px;color:${C.ledger};">${escapeHtml(item.headline)}</div>
    <div style="font-size:15px;line-height:22px;color:${C.ledger};margin-top:4px;"><strong>${escapeHtml(item.name)}:</strong> ${escapeHtml(item.line)}</div>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:12px;"><tr>
      <td style="background:${C.ledger};border-radius:6px;"><a href="${escapeHtml(partnerHref(appUrl, item.href_slug, tripId, slot))}" rel="${REL}" target="_blank" style="display:inline-block;padding:12px 18px;font-size:15px;font-weight:700;color:${C.card};text-decoration:none;">${escapeHtml(item.button_label)} &rarr;</a></td>
    </tr></table>
  </td></tr>
  ${spacer(12)}`;
}

export function renderV2Html({ trip, items, appUrl, tripId, bookingLink, postalAddress, unsubscribeUrl, clickedDate }) {
  const top = items.slice(0, CHECKLIST_CONFIG.topCount);
  const teaser = items.slice(CHECKLIST_CONFIG.topCount, CHECKLIST_CONFIG.topCount + CHECKLIST_CONFIG.teaserCount);
  const n = items.length + 1; // the saved trip itself counts as item 1
  const dest = escapeHtml(trip.destination);
  const route = routeLine(trip);
  const price = priceLine(trip);
  const shortDate = formatShortDate(trip.departure_at);
  const preheader = `Fares can change. Pick up where you left off${top.length ? `, then sort ${top.length === 1 ? 'the one thing' : `the ${top.length} things`} that matter most for ${dest}` : ''}.`;
  const why = postClickReason(dest, clickedDate);
  const pct = Math.max(1, Math.round((1 / n) * 100));

  const cards = top.map((it, i) => partnerCard(it, appUrl, tripId, i + 1)).join('');
  const header = top.length ? `
  <tr><td style="padding:0 4px;">
    <div style="font-family:${F_HEAD};font-size:22px;line-height:28px;font-weight:500;color:${C.ledger};">Your ${dest} pre-flight checklist</div>
    <div style="font-size:15px;line-height:22px;color:${C.muted};margin-top:4px;">${top.length === 1 ? 'The one that matters most' : `The ${top.length} that matter most`} for this trip.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;"><tr>
      <td style="font-size:14px;line-height:20px;color:${C.ledger};">1 of ${n} done &middot; <span style="color:${C.muted};">Trip saved</span></td>
    </tr><tr><td style="padding-top:6px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paperDeep};border-radius:4px;"><tr>
        <td width="${pct}%" style="background:${C.gold};height:8px;line-height:8px;font-size:0;border-radius:4px;">&nbsp;</td><td style="height:8px;font-size:0;">&nbsp;</td>
      </tr></table>
    </td></tr></table>
  </td></tr>
  ${spacer(14)}` : '';
  const teaserBlock = items.length > top.length ? `
  <tr><td style="background:${C.paperDeep};border-radius:10px;padding:18px 20px;">
    <div style="font-family:${F_HEAD};font-size:17px;line-height:24px;font-weight:500;color:${C.ledger};">${teaser.length} more worth a look for this trip</div>
    <div style="font-size:15px;line-height:22px;color:${C.ledger};margin-top:6px;">${teaser.map((t) => escapeHtml(t.teaser_label)).join(' &middot; ')}</div>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:12px;"><tr>
      <td style="border:2px solid ${C.ledger};border-radius:6px;"><a href="${escapeHtml(appUrl)}/away-mode" style="display:inline-block;padding:10px 16px;font-size:15px;font-weight:700;color:${C.ledger};text-decoration:none;">Open my full checklist</a></td>
    </tr></table>
  </td></tr>
  ${spacer(16)}` : '';

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(followUpSubjectFor(trip))}</title></head>
<body style="margin:0;padding:0;background:${C.paper};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.paper};font-size:1px;line-height:1px;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;font-family:${F_BODY};color:${C.ledger};">
  <tr><td style="padding:0 4px 16px 4px;font-family:${F_HEAD};font-size:20px;font-weight:500;color:${C.ledger};">Sparkfare</td></tr>
  <tr><td style="background:${C.card};border:1px solid ${C.line};border-radius:10px;padding:24px;">
    <div style="font-size:13px;line-height:18px;color:${C.muted};letter-spacing:0.6px;text-transform:uppercase;">Your trip</div>
    <div style="font-family:${F_HEAD};font-size:30px;line-height:36px;font-weight:500;margin:4px 0 6px 0;color:${C.ledger};">${dest}</div>
    ${route ? `<div style="font-size:15px;line-height:22px;color:${C.ledger};">${escapeHtml(route)}</div>` : ''}
    ${price ? `<div style="font-size:15px;line-height:22px;margin-top:10px;"><strong style="font-family:${F_MONO};font-size:18px;">${escapeHtml(price)}</strong></div>` : ''}
    <div style="font-size:14px;line-height:20px;color:${C.muted};margin-top:2px;">${FARES_CHANGE_TEXT}</div>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:18px;"><tr>
      <td style="background:${C.gold};border-radius:6px;"><a href="${escapeHtml(flightHref(appUrl, bookingLink, tripId))}" rel="${REL}" target="_blank" style="display:inline-block;padding:14px 22px;font-size:16px;font-weight:700;color:${C.ledger};text-decoration:none;">${EMAIL_PRIMARY_BUTTON}</a></td>
    </tr></table>
    <div style="font-size:14px;line-height:20px;color:${C.muted};margin-top:12px;border-top:1px dashed ${C.line};padding-top:10px;">${V2_DISCLOSURE_TEXT} <a href="${escapeHtml(appUrl)}/disclosure" style="color:${C.ledger};">Details</a></div>
    <div style="font-size:14px;line-height:20px;color:${C.muted};margin-top:10px;">Not ready? Your trip is saved in <a href="${escapeHtml(appUrl)}/trips" style="color:${C.ledger};">My Trips</a>.</div>
  </td></tr>
  ${spacer(20)}
  ${header}
  ${cards}
  ${teaserBlock}
  <tr><td style="padding:8px 4px 8px 4px;border-top:1px solid ${C.line};font-size:14px;line-height:21px;color:${C.muted};">
    ${escapeHtml(why)}<br>
    <a href="${escapeHtml(unsubscribeUrl)}" style="color:${C.ledger};">Unsubscribe</a> &middot;
    <a href="${escapeHtml(appUrl)}/disclosure" style="color:${C.ledger};">Affiliate disclosure</a><br>
    Sparkfare &middot; ${escapeHtml(postalAddress)}<br>
    ${EMAIL_FOOTER_LINE}
  </td></tr>
</table></td></tr></table></body></html>`;
}

function followUpSubjectFor(trip) {
  const when = formatShortDate(trip.departure_at);
  return `${trip.destination}${when ? `, ${when}` : ''}: your pre-flight checklist`;
}

export function renderV2Text({ trip, items, appUrl, tripId, bookingLink, postalAddress, unsubscribeUrl, clickedDate }) {
  const top = items.slice(0, CHECKLIST_CONFIG.topCount);
  const teaser = items.slice(CHECKLIST_CONFIG.topCount, CHECKLIST_CONFIG.topCount + CHECKLIST_CONFIG.teaserCount);
  const lines = [`Sparkfare`, '', 'YOUR TRIP', trip.destination];
  const route = routeLine(trip); if (route) lines.push(route);
  const price = priceLine(trip); if (price) lines.push(price);
  lines.push(FARES_CHANGE_TEXT, '', `${EMAIL_PRIMARY_BUTTON}: ${flightHref(appUrl, bookingLink, tripId)}`, '', `${V2_DISCLOSURE_TEXT} Details: ${appUrl}/disclosure`, '', `Not ready? Your trip is saved in My Trips: ${appUrl}/trips`);
  if (top.length) {
    lines.push('', `YOUR ${trip.destination.toUpperCase()} PRE-FLIGHT CHECKLIST`, `1 of ${items.length + 1} done: Trip saved`);
    top.forEach((it, i) => {
      lines.push('', `[${it.timing_chip}] ${it.headline} (Sponsored)`, `${it.name}: ${it.line}`, `${it.button_label}: ${partnerHref(appUrl, it.href_slug, tripId, i + 1)}`);
    });
  }
  if (teaser.length) lines.push('', `${teaser.length} more worth a look: ${teaser.map((t) => t.teaser_label).join(', ')}`, `Open my full checklist: ${appUrl}/away-mode`);
  lines.push('', postClickReason(trip.destination, clickedDate), `Unsubscribe: ${unsubscribeUrl}`, `Affiliate disclosure: ${appUrl}/disclosure`, `Sparkfare, ${postalAddress}`, EMAIL_FOOTER_LINE);
  return lines.join('\n');
}

// ---- Signed unsubscribe tokens -----------------------------------------------------------------
// token = base64url(email) + "." + base64url(HMAC-SHA256(secret, email)). No expiry on purpose:
// an unsubscribe link in an old email must keep working. The secret is a Worker secret.
const enc = new TextEncoder();
const b64u = {
  encode(bytes) { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  decode(str) { const s = atob(str.replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(s, (c) => c.charCodeAt(0)); },
};

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function signUnsubscribeToken(email, secret) {
  const key = await hmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(email)));
  return `${b64u.encode(enc.encode(email))}.${b64u.encode(sig)}`;
}

export async function verifyUnsubscribeToken(token, secret) {
  if (!token || !secret || typeof token !== 'string' || !token.includes('.')) return null;
  try {
    const [emailPart, sigPart] = token.split('.');
    const email = new TextDecoder().decode(b64u.decode(emailPart));
    const key = await hmacKey(secret);
    const ok = await crypto.subtle.verify('HMAC', key, b64u.decode(sigPart), enc.encode(email));
    return ok ? email : null;
  } catch {
    return null;
  }
}

// Reactivation (the link in the 45-day sunset email) uses its own token. The signed message is
// "reactivate:<email>", so an unsubscribe token (which signs the bare email) can never reactivate
// anyone, and a reactivate token can never unsubscribe anyone.
export async function signReactivateToken(email, secret) {
  const key = await hmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`reactivate:${email}`)));
  return `${b64u.encode(enc.encode(email))}.${b64u.encode(sig)}`;
}

export async function verifyReactivateToken(token, secret) {
  if (!token || !secret || typeof token !== 'string' || !token.includes('.')) return null;
  try {
    const [emailPart, sigPart] = token.split('.');
    const email = new TextDecoder().decode(b64u.decode(emailPart));
    const key = await hmacKey(secret);
    const ok = await crypto.subtle.verify('HMAC', key, b64u.decode(sigPart), enc.encode(`reactivate:${email}`));
    return ok ? email : null;
  } catch {
    return null;
  }
}

// Trip self-report taps (Away Move 2). The token carries a trip id, one answer and an expiry, never an email.
// The signed message is "trip-tap:" + the encoded payload, so a token made for any other purpose (unsubscribe signs the bare
// email, reactivate signs "reactivate:<email>") can never verify here, and this one can never verify there.
export const TRIP_TAP_ANSWERS = ['booked', 'not_yet', 'not_going'];
export const TRIP_TAP_TTL_DAYS = 120;

export async function signTripTapToken(tripId, answer, secret, now = Date.now()) {
  if (!tripId || !secret || !TRIP_TAP_ANSWERS.includes(answer)) throw new Error('signTripTapToken needs a trip id, a valid answer and a secret');
  const payload = b64u.encode(enc.encode(JSON.stringify({ t: String(tripId), a: answer, e: Math.floor(now / 1000) + TRIP_TAP_TTL_DAYS * 86400 })));
  const key = await hmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`trip-tap:${payload}`)));
  return `${payload}.${b64u.encode(sig)}`;
}

// Returns { tripId, answer } for a valid, unexpired token, otherwise null.
export async function verifyTripTapToken(token, secret, now = Date.now()) {
  if (!token || !secret || typeof token !== 'string' || token.split('.').length !== 2) return null;
  try {
    const [payload, sigPart] = token.split('.');
    const key = await hmacKey(secret);
    const ok = await crypto.subtle.verify('HMAC', key, b64u.decode(sigPart), enc.encode(`trip-tap:${payload}`));
    if (!ok) return null;
    const data = JSON.parse(new TextDecoder().decode(b64u.decode(payload)));
    if (!data || typeof data.t !== 'string' || !TRIP_TAP_ANSWERS.includes(data.a)) return null;
    if (typeof data.e !== 'number' || data.e * 1000 < now) return null;
    return { tripId: data.t, answer: data.a };
  } catch {
    return null;
  }
}
