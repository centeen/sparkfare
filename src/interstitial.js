// The page shown between a signed-in deal-card click and the booking site
// (/departing/:trip_id). Pure helpers so the wording rules are testable: nothing on this page may
// say a fare is "locked" or "secured" (the visitor has booked nothing), and only trip fields that
// actually exist are rendered.

import { AWAY_MODE_PARTNERS } from './email.js';
import {
  INTERSTITIAL_HEADING, INTERSTITIAL_CTA, INTERSTITIAL_PARTNER_NOTE, INTERSTITIAL_DISCLOSURE, HOTEL_ROW_LABEL, viewOnPartnerLabel,
} from './referralCopy.js';

// Seven services that matter before a trip, in display order. Hotel has no partner yet. Other
// Away Mode partners live on /away-mode.
export const INTERSTITIAL_SERVICES = [
  { label: 'Travel insurance', slug: 'safetywing', via: 'SafetyWing' },
  { label: 'Flight delay & cancellation compensation', slug: 'airhelp', via: 'AirHelp' },
  { label: 'Hotel booking', slug: null },
  { label: 'Travel eSIM data', slug: 'yesim', via: 'Yesim' },
  { label: 'Foreign currency & card', slug: 'wise', via: 'Wise' },
  { label: 'Car rental', slug: 'qeeq', via: 'QEEQ' },
  { label: 'Airport pickup', slug: 'welcome-pickups', via: 'Welcome Pickups' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function parseDate(value) {
  if (!value) return null;
  const d = new Date(String(value).includes('T') || String(value).includes('Z') ? value : String(value).replace(' ', 'T') + 'Z');
  return Number.isNaN(d.getTime()) ? null : d;
}

// "Nov 12 to 26", "Nov 28 to Dec 3", "Dec 28, 2026 to Jan 4, 2027", or just "Nov 12" (one way).
export function formatDateRange(departureAt, returnAt) {
  const dep = parseDate(departureAt);
  if (!dep) return null;
  const ret = parseDate(returnAt);
  const md = (d) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  if (!ret) return md(dep);
  if (dep.getUTCFullYear() !== ret.getUTCFullYear()) {
    return `${md(dep)}, ${dep.getUTCFullYear()} to ${md(ret)}, ${ret.getUTCFullYear()}`;
  }
  if (dep.getUTCMonth() === ret.getUTCMonth()) return `${md(dep)} to ${ret.getUTCDate()}`;
  return `${md(dep)} to ${md(ret)}`;
}

// "From TLV · Nov 12 to 26 · round trip". Built only from fields the trips table really has:
// origin, dates, and round trip vs one way (inferred from return_at). Airline, stops and duration
// are not stored, so they are never shown.
export function buildRouteLine({ origin_iata, departure_at, return_at } = {}) {
  const parts = [];
  if (origin_iata) parts.push(`From ${String(origin_iata).toUpperCase()}`);
  const range = formatDateRange(departure_at, return_at);
  if (range) {
    parts.push(range);
    parts.push(return_at ? 'round trip' : 'one way');
  }
  return parts.join(' · ');
}

// The stored price is the one shown on the deal card at click time, so its honest timestamp is the
// click time (trips.clicked_at, SQLite UTC), not "live".
export function freshnessText(clickedAt) {
  const d = parseDate(clickedAt);
  if (!d) return 'Price as shown on Sparkfare when you clicked.';
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `Price as shown on Sparkfare when you clicked (${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${hh}:${mm} UTC).`;
}

export const FARE_CAVEAT = 'The final fare is confirmed on the booking site and may change.';
export const DISCLOSURE_TEXT = INTERSTITIAL_DISCLOSURE;

// Only a real Aviasales link may be offered as the way on. Anything else (missing, another host,
// a javascript: URL) is dropped, so this page can never be used as an open redirect.
export function sanitizeBookingTarget(raw) {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' || u.hostname !== 'www.aviasales.com') return null;
    return u.toString();
  } catch {
    return null;
  }
}

function blurbFor(slug) {
  return AWAY_MODE_PARTNERS.find((p) => p.slug === slug)?.blurb || '';
}

const REL = 'sponsored nofollow noopener noreferrer';

export function interstitialHtml({ tripId, destination, origin_iata, departure_at, return_at, price, clickedAt, target }) {
  const safeTarget = sanitizeBookingTarget(target);
  const tripParam = tripId ? `trip_id=${encodeURIComponent(tripId)}` : '';
  const routeLine = [destination, buildRouteLine({ origin_iata, departure_at, return_at })].filter(Boolean).join(' · ');
  const priceBlock = price
    ? `<p class="price">From <strong>$${escapeHtml(price)}</strong></p>
    <p class="fresh">${escapeHtml(freshnessText(clickedAt))} ${escapeHtml(FARE_CAVEAT)}</p>`
    : `<p class="fresh">${escapeHtml(FARE_CAVEAT)}</p>`;

  const flightHref = safeTarget
    ? `/out/aviasales?${tripParam ? tripParam + '&' : ''}url=${encodeURIComponent(safeTarget)}`
    : '/';
  const cta = safeTarget
    ? `<a id="continue" class="cta" href="${escapeHtml(flightHref)}" target="_blank" rel="${REL}">${escapeHtml(INTERSTITIAL_CTA)}</a>`
    : `<a id="continue" class="cta" href="/">Return to Sparkfare</a>`;

  const rows = INTERSTITIAL_SERVICES.map((svc) => {
    if (!svc.slug) {
      return `<li class="svc inert" aria-disabled="true"><span class="svc-main"><span class="svc-name">${escapeHtml(svc.label === 'Hotel booking' ? HOTEL_ROW_LABEL : svc.label)}</span></span></li>`;
    }
    const href = `/out/${svc.slug}${tripParam ? '?' + tripParam : ''}`;
    return `<li class="svc"><a href="${escapeHtml(href)}" target="_blank" rel="${REL}"><span class="svc-main"><span class="svc-name">${escapeHtml(svc.label)} <span class="via">${escapeHtml(svc.via)}</span></span><span class="svc-blurb">${escapeHtml(blurbFor(svc.slug))}</span></span><span class="svc-go">${escapeHtml(viewOnPartnerLabel(svc.via))}</span><span class="sr-only">(opens in a new tab)</span></a></li>`;
  }).join('\n        ');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>Your trip to ${escapeHtml(destination)} | Sparkfare</title>
  <link href="https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;500&family=Space+Grotesk:wght@500&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: start center; padding: 16px; background: #E8DCC5; color: #2B2620; font: 16px 'Segoe UI', Arial, sans-serif; }
    main { position: relative; width: min(100%, 520px); padding: 28px 24px 24px; background: #FAF6EE; border: 1px solid #D9CBB0; border-radius: 8px; text-align: center; box-shadow: 0 10px 30px rgba(43, 38, 32, 0.05); }
    .close { position: absolute; top: 8px; right: 8px; width: 44px; height: 44px; border: 0; background: transparent; color: #6B6255; font-size: 28px; line-height: 1; border-radius: 6px; cursor: pointer; }
    .close:hover { background: #EFE6D3; color: #2B2620; }
    :focus-visible { outline: 3px solid #2B2620; outline-offset: 2px; }
    h1 { font-family: 'Space Grotesk', sans-serif; font-size: 1.75rem; font-weight: 500; margin: 0 40px 6px; letter-spacing: -0.02em; }
    .route { margin: 0 0 12px; color: #5A5145; font-size: 0.95rem; }
    .price { margin: 0; font-size: 1.15rem; color: #2B2620; }
    .fresh { margin: 4px 0 16px; font-size: 0.875rem; color: #5A5145; }
    .cta { display: block; background: #E8B930; color: #2B2620; text-decoration: none; font-weight: 600; padding: 14px 24px; border-radius: 6px; font-size: 1.1rem; }
    .cta:hover { filter: brightness(1.05); }
    .partner-note { margin: 12px 0 0; font-size: 0.875rem; line-height: 1.4; color: #5A5145; }
    .disclosure { margin: 8px 0 0; font-size: 0.875rem; line-height: 1.4; color: #5A5145; }
    .disclosure a { color: inherit; }
    .more { margin: 24px 0 0; padding: 16px 0 0; border-top: 1px dashed #D9CBB0; text-align: left; }
    .more h2 { font-size: 1.05rem; margin: 0 0 8px; }
    .services { list-style: none; padding: 0; margin: 0; }
    .svc { border-top: 1px solid #EDE3CF; }
    .svc:first-child { border-top: 0; }
    .svc a, .svc.inert { display: flex; align-items: center; gap: 12px; padding: 10px 4px; color: inherit; text-decoration: none; }
    .svc a:hover .svc-name { text-decoration: underline; }
    .svc-main { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
    .svc-name { font-weight: 600; font-size: 0.95rem; }
    .via { font-weight: 400; font-size: 0.8rem; color: #5A5145; margin-left: 4px; }
    .svc-blurb { font-size: 0.85rem; color: #5A5145; line-height: 1.35; }
    .svc-go { color: #2B2620; font-size: 0.85rem; font-weight: 600; white-space: nowrap; }
    .svc.inert { opacity: 0.6; cursor: default; }
    .all { display: inline-block; margin-top: 8px; font-size: 0.9rem; color: #2B2620; }
    .note { margin: 16px 0 0; font-size: 0.875rem; color: #5A5145; text-align: center; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  </style>
</head>
<body>
  <main>
    <button type="button" class="close" id="close" aria-label="Close">&times;</button>
    <h1>${escapeHtml(INTERSTITIAL_HEADING)}</h1>
    ${routeLine ? `<p class="route">${escapeHtml(routeLine)}</p>` : ''}
    ${priceBlock}
    ${cta}
    <p class="partner-note">${escapeHtml(INTERSTITIAL_PARTNER_NOTE)}</p>
    <p class="disclosure">${escapeHtml(DISCLOSURE_TEXT)} <a href="/disclosure">Details</a></p>

    <section class="more" aria-labelledby="more-h">
      <h2 id="more-h">Round out your trip</h2>
      <ul class="services">
        ${rows}
      </ul>
      <a class="all" href="/away-mode" target="_blank" rel="noopener">More travel tools</a>
    </section>
    <p class="note">Check your inbox for your pre-trip guide.</p>
  </main>
  <script src="/site-footer.js" defer></script>
  <script>
    (function () {
      var tripId = ${JSON.stringify(tripId || null)};
      function closePage() {
        try {
          navigator.sendBeacon('/api/events', new Blob([JSON.stringify({ event_type: 'interstitial_close', sub_id: tripId })], { type: 'application/json' }));
        } catch (e) {}
        window.close();
        // A tab the browser will not let a script close falls back to the Sparkfare home page,
        // never to the booking site.
        setTimeout(function () { window.location.href = '/'; }, 200);
      }
      document.getElementById('close').addEventListener('click', closePage);
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePage(); });
    })();
  </script>
</body>
</html>`;
}
