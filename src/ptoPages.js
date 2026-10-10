// PTO calendar pages (ROADMAP step 72, Track A): server-rendered HTML for /time-off and /time-off/<origin>.
// Everything a crawler or an AI assistant needs is in the HTML without JavaScript; the small script at the end only
// handles the share button and the email form. Pure functions: the Worker passes in `now` and the flags.
import { escapeHtml, originCity } from './emailTemplates/helpers.js';
import { GRID_DISCLOSURE } from './referralCopy.js';
import {
  COMMON_HOLIDAY_SET, HOLIDAY_ORDER, HOLIDAY_NAMES, DEFAULT_HOLIDAY_CODE,
  encodeHolidaySet, decodeHolidaySet, holidaysInRange, bridgeOpportunities, optimize, summarizeByHoliday,
  describeBlock, destinationsForWindow, tripLengthBucket, rangeLabel, dayLabel,
} from './ptoCalendar.js';

// The 15 marketed US origins. TLV is a testing origin and gets no PTO page (US holiday calendar).
export const PTO_ORIGINS = ['JFK', 'LAX', 'ORD', 'ATL', 'DFW', 'SFO', 'MIA', 'IAD', 'EWR', 'SEA', 'IAH', 'BOS', 'DEN', 'PHX', 'LAS', 'PHL', 'MSP', 'CLT'];
export const PTO_LAST_DAY = '2027-12-31';
export const DEFAULT_BUDGET = 10;

export function isPtoOrigin(code) {
  return PTO_ORIGINS.includes(String(code || '').toUpperCase());
}

// 0 to 30 whole PTO days; anything else falls back to the default.
export function parseBudget(value) {
  if (value === null || value === undefined || value === '') return DEFAULT_BUDGET;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 30 ? n : DEFAULT_BUDGET;
}

// The route-page slug the /data/ pages use (same rules as the pSEO generator's slugify).
export function destinationSlug(name) {
  let s = String(name).toLowerCase();
  for (const ch of ['/', '&', '(', ')', ',']) s = s.split(ch).join(' ');
  s = s.replace(/[^a-z0-9\s-]/g, '');
  return s.trim().replace(/\s+/g, '-');
}
export const routePagePath = (origin, destination) => `/data/${origin.toLowerCase()}-to-${destinationSlug(destination)}`;

const todayOf = (now) => now.toISOString().slice(0, 10);
const yearRange = (block) => `${rangeLabel(block.start, block.end)}, ${block.end.slice(0, 4)}`;
const money = (n) => `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

function planUrl(appUrl, origin, { budget = DEFAULT_BUDGET, code = DEFAULT_HOLIDAY_CODE, suffix = '' } = {}) {
  const base = `${appUrl}/time-off/${origin.toLowerCase()}${suffix}`;
  const isDefault = budget === DEFAULT_BUDGET && code === DEFAULT_HOLIDAY_CODE;
  return isDefault ? base : `${base}?budget=${budget}&h=${code}`;
}

const NAV = `<nav class="site-nav">
      <a href="/" class="brand-link">
        <svg class="brand-mark" viewBox="0 0 44 44" aria-hidden="true">
          <path d="M8,8 L8,36 L30,36 L27,29 L30,22 L27,15 L30,8 Z" fill="none" stroke="#2B2620" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>
          <circle cx="18" cy="22" r="3.5" fill="#E8B930"/>
        </svg>
        Sparkfare
      </a>
      <a href="/away-mode">Away Mode</a>
      <a href="/blog/">Blog</a>
      <a href="/data/">All Routes</a>
      <a href="/check">Check a price</a>
      <a href="/time-off">Time off</a>
      <a href="/watchlists">Watchlists</a>
      <a href="/hub">Referrals</a>
      <a href="/trips">Trips</a>
      <a href="/account">Preferences</a>
      <a href="/privacy">Privacy</a>
      <a class="sign-in-link" id="sign-in-nav-link" href="/sign-in">Sign in</a>
    </nav>`;

const STYLE = `<style>
    :root { --sand: #E8DCC5; --card: #FAF6EE; --border: #D9CBB0; --amber: #B8720F; --text: #2E2318; --muted: #6B5A45; --sage: #4F7A52; --sage-dark: #3F6442; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--sand); color: var(--text); font-family: 'Segoe UI', sans-serif; line-height: 1.6; }
    .wrap { max-width: 760px; margin: 0 auto; padding: 32px 16px 80px; }
    .card { background: var(--card); border: 1px solid var(--border); border-radius: 6px; padding: 22px; margin-bottom: 18px; }
    h1, h2, h3 { margin: 0 0 8px; letter-spacing: -0.02em; }
    h1 { font-size: 1.7rem; } h2 { font-size: 1.2rem; } h3 { font-size: 1.02rem; }
    .sub, .muted { color: var(--muted); } .sub { margin: 0 0 16px; }
    .small { font-size: 0.85rem; }
    label { display: block; font-size: 0.85rem; font-weight: 600; margin: 12px 0 4px; }
    input[type="number"], input[type="email"], select { width: 100%; min-height: 44px; padding: 10px; border: 1px solid var(--border); border-radius: 6px; background: #fff; color: var(--text); font: inherit; }
    .checks { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 2px 14px; margin-top: 6px; }
    .checks label { display: flex; align-items: center; gap: 8px; font-weight: 400; margin: 0; min-height: 44px; }
    .checks input { width: 20px; height: 20px; flex: none; }
    button, .btn { display: inline-block; min-height: 44px; padding: 10px 18px; background: var(--sage); color: #fff; border: none; border-radius: 6px; cursor: pointer; font: inherit; font-weight: 600; text-decoration: none; }
    button:hover, .btn:hover { background: var(--sage-dark); }
    .btn.secondary, button.secondary { background: transparent; color: var(--sage-dark); border: 1px solid var(--sage); }
    .btn.secondary:hover, button.secondary:hover { background: #eef4ee; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
    .totals { font-size: 1.05rem; font-weight: 600; margin: 4px 0 14px; }
    .block { border-top: 1px solid var(--border); padding: 14px 0; }
    .block:first-of-type { border-top: none; padding-top: 0; }
    .block h3 { margin-bottom: 2px; }
    .range { color: var(--muted); font-size: 0.9rem; margin: 0 0 6px; }
    .pill { display: inline-block; font-size: 0.78rem; background: #E8DCC5; color: var(--sage-dark); border-radius: 50px; padding: 2px 10px; margin-right: 6px; }
    details summary { cursor: pointer; min-height: 44px; display: flex; align-items: center; color: var(--sage-dark); font-weight: 600; }
    .fares { margin: 6px 0 0; padding: 0; list-style: none; } .fares li { padding: 6px 0; border-top: 1px solid var(--border); } .fare-link { min-height: 44px; margin-left: 6px; padding: 6px 12px; font-size: 0.85rem; }
    .fit { display: flex; flex-wrap: wrap; gap: 6px 14px; margin: 6px 0 0; padding: 0; list-style: none; }
    .fit a { color: var(--sage-dark); display: inline-block; min-height: 28px; }
    table { width: 100%; border-collapse: collapse; font-size: 0.92rem; }
    th, td { text-align: left; padding: 8px 6px; border-top: 1px solid var(--border); vertical-align: top; }
    th { font-size: 0.8rem; color: var(--muted); font-weight: 600; border-top: none; }
    .status { margin-top: 8px; font-size: 0.85rem; color: var(--sage-dark); min-height: 1.2em; } .status.error { color: #9A3412; }
    .origins { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 6px 10px; padding: 0; list-style: none; margin: 8px 0 0; }
    .origins a { display: flex; align-items: center; min-height: 44px; color: var(--sage-dark); }
    a { color: var(--sage-dark); }
    .site-nav { display: flex; gap: 18px; font-size: 0.85rem; margin-bottom: 20px; flex-wrap: wrap; }
    .site-nav a { color: #605142; text-decoration: none; }
    @media (max-width: 768px) { .site-nav { gap: 0 18px; } .site-nav a { display: inline-block; padding: 11px 0; } }
    .site-nav a:hover { text-decoration: underline; }
    .site-nav a.brand-link { display: inline-flex; align-items: center; gap: 6px; }
    .brand-mark { width: 16px; height: 16px; flex-shrink: 0; }
  </style>`;

export function page({ title, description, canonical, robots, ogImage, body, script = '' }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${escapeHtml(canonical)}" />
  <meta name="robots" content="${robots}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(canonical)}" />
  ${ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}" />\n  <meta name="twitter:card" content="summary_large_image" />\n  <meta name="twitter:image" content="${escapeHtml(ogImage)}" />` : ''}
  <link rel="icon" type="image/svg+xml" href="/sparkfare_mark.svg" />
  <link rel="icon" type="image/png" href="/favicon.png" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  ${STYLE}
</head>
<body>
  <div class="wrap">
    ${NAV}
${body}
  </div>
${script}
<script src="/nav-auth.js"></script><script>syncNavAuthStateLazy();</script>
<script src="/site-footer.js" defer></script>
</body>
</html>
`;
}

export { page as renderSitePage };

const METHOD_NOTE =`<p class="muted small">How this works: weekends and the holidays you pick are free days off; any other weekday inside a block is a PTO day. Holiday dates follow the US federal calendar (OPM), including the observed day when a holiday falls on a weekend. Many employers do not give every federal holiday, so choose the ones yours does. The plan only counts days inside the blocks it shows.</p>`;

// ---- /time-off --------------------------------------------------------------------------------------------

export function renderTimeOffIndex({ appUrl, now }) {
  const from = todayOf(now);
  const holidays = holidaysInRange({ from, to: PTO_LAST_DAY, keys: COMMON_HOLIDAY_SET });
  const blocks = bridgeOpportunities({ from, to: PTO_LAST_DAY, holidays });
  const rows = summarizeByHoliday({ holidays, blocks }).map(({ holiday, options }) => {
    const opts = options.map((b) => {
      const d = describeBlock(b);
      return `<div>${escapeHtml(d.headline)} <span class="muted">(${escapeHtml(yearRange(b))})</span></div>`;
    }).join('') || '<span class="muted">No long weekend with 3 or fewer PTO days.</span>';
    return `<tr><td><strong>${escapeHtml(holiday.name)}</strong><br><span class="muted small">${escapeHtml(dayLabel(holiday.observed))}, ${holiday.observed.slice(0, 4)}</span></td><td>${opts}</td></tr>`;
  }).join('');
  const originLinks = PTO_ORIGINS.map((o) => `<li><a href="/time-off/${o.toLowerCase()}">${escapeHtml(originCity(o))} (${o})</a></li>`).join('');
  const body = `    <div class="card">
      <h1>Long weekends and PTO planner, 2026-2027</h1>
      <p class="sub">Every long weekend through the end of 2027, how many PTO days each one takes, and the best plan for your PTO budget. Pick your home airport to see the plan and destinations that fit each window.</p>
      <h2>Choose your airport</h2>
      <ul class="origins">${originLinks}</ul>
    </div>
    <div class="card">
      <h2>The holidays and their best bridges</h2>
      <p class="sub">Using the holidays most private employers give. Choose your own set on any airport page.</p>
      <table><thead><tr><th>Holiday</th><th>Options</th></tr></thead><tbody>${rows}</tbody></table>
      ${METHOD_NOTE}
    </div>`;
  return page({
    title: 'Long weekends and PTO planner, 2026-2027 | Sparkfare',
    description: 'Every long weekend through 2027, how many PTO days each takes, and the best plan for your PTO budget, with destinations that fit each window.',
    canonical: `${appUrl}/time-off`,
    robots: 'index, follow',
    ogImage: null,
    body,
  });
}

// ---- /time-off/<origin> -------------------------------------------------------------------------------

function holidayCheckboxes(keys) {
  const chosen = new Set(keys);
  return HOLIDAY_ORDER.map((key) => `<label><input type="checkbox" name="hk" value="${key}"${chosen.has(key) ? ' checked' : ''}> ${escapeHtml(HOLIDAY_NAMES[key])}</label>`).join('');
}

function fitList(block, origin) {
  const names = destinationsForWindow(block.daysOff, origin);
  if (names.length === 0) return '';
  const link = (n) => `<li><a href="${routePagePath(origin, n)}">${escapeHtml(n)}</a></li>`;
  const first = names.slice(0, 6);
  const rest = names.slice(6);
  return `<ul class="fit">${first.map(link).join('')}</ul>${rest.length ? `<details><summary>${rest.length} more that fit this window</summary><ul class="fit">${rest.map(link).join('')}</ul></details>` : ''}`;
}

// ---- window fares (Track B, ENABLE_PTO_FARES) ---------------------------------------------------------------
// `store` is sparkfare_pto_window_prices.json, or null when fares are off. A fare older than FRESH_DAYS is shown as
// "last seen" without a link, and a window with no fare says so plainly: that is the normal state for far-off dates.
export const FARE_FRESH_DAYS = 3;
const shortDate = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? null : `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]} ${d.getUTCDate()}`; };
// Trip dates come from the fare itself (local airport dates), not the window it was filed under: with flexible dates the two can differ.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fareDayLabel = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m && MONTHS[Number(m[2]) - 1] ? `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}` : null; };
const tripDates = (fare) => { const a = fareDayLabel(fare.departure_at); const b = fareDayLabel(fare.return_at); return a && b ? `${a} – ${b}` : null; };
const FARE_ARIA = 'View this fare on Aviasales (opens in a new tab). Sparkfare does not sell or book travel.';

export function faresForWindow(store, origin, block) {
  const list = store?.windows?.[`${origin}:${block.start}:${block.end}`]?.fares;
  return Array.isArray(list) ? list.filter((f) => f && Number.isFinite(Number(f.price)) && Number(f.price) > 0) : [];
}

function fareLine(fare, origin, now) {
  const seen = shortDate(fare.found_at);
  const trip = tripDates(fare);
  const ageDays = (now.getTime() - new Date(fare.found_at).getTime()) / 86400000;
  const fresh = Number.isFinite(ageDays) && ageDays <= FARE_FRESH_DAYS;
  const name = `<a href="${routePagePath(origin, fare.destination)}">${escapeHtml(fare.destination)}</a>`;
  if (!fresh || !fare.booking_link) {
    return `<li>${name}: last seen ${money(fare.price)}${trip ? ` for ${escapeHtml(trip)}` : ''}${seen ? `, on ${escapeHtml(seen)}` : ''}</li>`;
  }
  const href = `/out/aviasales?url=${encodeURIComponent(fare.booking_link)}&src=pto`;
  return `<li>${name}: from ${money(fare.price)}${trip ? `, ${escapeHtml(trip)}` : ''}, seen ${escapeHtml(seen || 'recently')} <a class="btn secondary fare-link" href="${href}" target="_blank" rel="sponsored nofollow noopener noreferrer" aria-label="${FARE_ARIA}">View fare ↗</a></li>`;
}

function faresHtml(block, origin, store, now) {
  const fares = faresForWindow(store, origin, block).sort((a, b) => a.price - b.price);
  if (fares.length === 0) {
    return '<p class="muted small" style="margin:8px 0 0;">No fare seen yet for these dates.</p>';
  }
  return `<p class="muted small" style="margin:8px 0 0;">Lowest fares seen in search data:</p><ul class="fares">${fares.slice(0, 6).map((f) => fareLine(f, origin, now)).join('')}</ul>`;
}

function fareNote(store, now) {
  const flex = Number(store?.flex_days) || 0;
  const checked = store?.generated_at ? shortDate(store.generated_at) : null;
  const flexText = flex > 0 ? ` Fares are the cheapest seen departing within ${flex} day${flex === 1 ? '' : 's'} of the window start and returning within ${flex} day${flex === 1 ? '' : 's'} of its end.` : '';
  return `<p class="affiliate-note muted small" id="grid-disclosure" style="margin:0 0 12px;">${escapeHtml(GRID_DISCLOSURE)} <a href="/disclosure">Details</a></p>
      <p class="muted small" style="margin:0 0 12px;">Fares come from search data and can change or disappear; this is not a quote. Prices checked daily${checked ? `; last check ${escapeHtml(checked)}` : ''}.${escapeHtml(flexText)}</p>`;
}

function blockHtml(block, origin, { leaveReady, faresStore = null, now = new Date(), watchEnabled = false }) {
  const d = describeBlock(block);
  const holidayNames = block.holidayKeys.map((k) => HOLIDAY_NAMES[k]).join(', ');
  const watchBtn = watchEnabled
    ? `<div class="actions" style="margin-top:8px;"><button type="button" class="secondary pto-watch-btn" data-start="${escapeHtml(block.start)}" data-end="${escapeHtml(block.end)}" data-origin="${escapeHtml(origin)}">Watch this weekend</button></div>`
    : '';
  return `<div class="block" data-window-start="${escapeHtml(block.start)}" data-window-end="${escapeHtml(block.end)}">
        <h3>${escapeHtml(d.headline)}</h3>
        <p class="range">${escapeHtml(yearRange(block))}${holidayNames ? ` · ${escapeHtml(holidayNames)}` : ''}</p>
        <p style="margin:0 0 4px;"><span class="pill">${block.daysOff} days off</span><span class="pill">${block.ptoUsed === 0 ? 'no PTO needed' : `${block.ptoUsed} PTO day${block.ptoUsed === 1 ? '' : 's'}`}</span></p>
        <p class="muted small" style="margin:6px 0 0;">Destinations that fit this window:</p>
        ${fitList(block, origin)}
        ${faresStore ? faresHtml(block, origin, faresStore, now) : '<p class="muted small" style="margin:8px 0 0;">Fares appear here as we see them.</p>'}
        ${watchBtn}
        ${leaveReady ? `<p class="small" style="margin:6px 0 0;"><a href="/leave?src=pto">Before you go: get your home ready</a></p>` : ''}
      </div>`;
}

export function renderTimeOffOrigin({ origin, budget = DEFAULT_BUDGET, keys = COMMON_HOLIDAY_SET, now, appUrl, hasVariant = false, leaveReady = false, faresStore = null, watchEnabled = false }) {
  const from = todayOf(now);
  const city = originCity(origin);
  const code = encodeHolidaySet(keys);
  const holidays = holidaysInRange({ from, to: PTO_LAST_DAY, keys });
  const blocks = bridgeOpportunities({ from, to: PTO_LAST_DAY, holidays });
  const { plan, totals } = optimize({ budget, blocks });
  const summary = summarizeByHoliday({ holidays, blocks });
  const longest = plan.reduce((m, b) => Math.max(m, b.daysOff), 0);
  const bucket = tripLengthBucket(longest || 4);
  const bareUrl = `${appUrl}/time-off/${origin.toLowerCase()}`;
  const shareUrl = planUrl(appUrl, origin, { budget, code });
  const icsUrl = planUrl(appUrl, origin, { budget, code, suffix: '.ics' });

  const headline = plan.length === 0
    ? `No long weekend fits ${budget} PTO day${budget === 1 ? '' : 's'} with this holiday set`
    : `${totals.ptoUsed} PTO day${totals.ptoUsed === 1 ? '' : 's'}, ${totals.daysOff} days off`;
  const planHtml = plan.length
    ? plan.map((b) => blockHtml(b, origin, { leaveReady, faresStore, now, watchEnabled })).join('')
    : '<p class="muted">Try a bigger PTO budget, or add more holidays to your set.</p>';

  const opportunityRows = summary.map(({ holiday, options }) => {
    const opts = options.map((b) => `<div>${escapeHtml(describeBlock(b).headline)} <span class="muted">(${escapeHtml(yearRange(b))})</span></div>`).join('') || '<span class="muted">No long weekend with 3 or fewer PTO days.</span>';
    return `<tr><td><strong>${escapeHtml(holiday.name)}</strong><br><span class="muted small">${escapeHtml(dayLabel(holiday.observed))}, ${holiday.observed.slice(0, 4)}</span></td><td>${opts}</td></tr>`;
  }).join('');

  const body = `    <div class="card">
      <h1>Long weekends from ${escapeHtml(city)}: 2026-2027</h1>
      <p class="sub">Tell us how many PTO days you have and which holidays your employer gives. We find the blocks that turn the fewest days off into the most days away, then show destinations that fit each one.</p>
      <form method="get" action="/time-off/${origin.toLowerCase()}">
        <input type="hidden" name="hs" value="1" />
        <label for="budget">PTO days you can use (0 to 30)</label>
        <input id="budget" name="budget" type="number" inputmode="numeric" min="0" max="30" value="${budget}" />
        <details style="margin-top:8px;">
          <summary>Holidays your employer gives (${keys.length} selected)</summary>
          <div class="checks">${holidayCheckboxes(keys)}</div>
          <p class="muted small" style="margin:8px 0 0;">Many employers do not give every federal holiday. Pick yours.</p>
        </details>
        <div class="actions"><button type="submit">Update plan</button></div>
      </form>
    </div>
    <div class="card" id="plan">
      <h2>Your plan</h2>
      <p class="totals">${headline}</p>
      ${faresStore ? fareNote(faresStore, now) : ''}
      ${planHtml}
      <div class="actions">
        <a class="btn" id="ics-link" href="${icsUrl.replace(appUrl, '')}" rel="nofollow">Add to calendar (.ics)</a>
        <button type="button" class="secondary" id="share-btn" data-url="${escapeHtml(shareUrl)}" data-text="${escapeHtml(`${totals.ptoUsed} PTO days, ${totals.daysOff} days off from ${city}`)}">Share this plan</button>
      </div>
      <div class="status" id="share-status" aria-live="polite"></div>
    </div>
    <div class="card">
      <h2>Get an email when fares appear for your long weekends</h2>
      <p class="sub">Save your home airport and we'll email you when a fare there is genuinely worth a look.</p>
      <form id="alert-form" novalidate data-trip-length="${bucket}" data-origin="${origin}">
        <label for="alert-email">Email</label>
        <input id="alert-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" required />
        <div class="actions"><button type="submit">Get deal alerts</button></div>
        <div id="alert-status" class="status" aria-live="polite"></div>
      </form>
    </div>
    <div class="card">
      <h2>Every holiday and its best bridges</h2>
      <table><thead><tr><th>Holiday</th><th>Options</th></tr></thead><tbody>${opportunityRows}</tbody></table>
      ${METHOD_NOTE}
    </div>`;

  const script = `<script>
  (function () {
    var share = document.getElementById('share-btn');
    var shareStatus = document.getElementById('share-status');
    function beacon(type, meta) {
      try { fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event_type: type, origin: ${JSON.stringify(origin)}, source: 'pto', meta: meta || null }), keepalive: true }); } catch (e) {}
    }
    if (share) share.addEventListener('click', function () {
      var url = share.getAttribute('data-url');
      var text = share.getAttribute('data-text');
      if (navigator.share) {
        navigator.share({ title: 'Sparkfare time-off planner', text: text, url: url }).then(function () { beacon('pto_share', { channel: 'native' }); }).catch(function () {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function () { shareStatus.textContent = 'Link copied.'; beacon('pto_share', { channel: 'copy' }); }, function () { shareStatus.textContent = url; });
      } else { shareStatus.textContent = url; }
    });
    var form = document.getElementById('alert-form');
    var status = document.getElementById('alert-status');
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var email = document.getElementById('alert-email').value.trim();
      status.className = 'status';
      if (!/^\\S+@\\S+\\.\\S+$/.test(email)) { status.textContent = 'Enter a valid email.'; status.className = 'status error'; return; }
      status.textContent = 'Saving…';
      fetch('/api/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'local_' + Date.now(), email: email, origin_iata: form.getAttribute('data-origin'), trip_length: form.getAttribute('data-trip-length'), source: 'pto' }) })
        .then(function (res) { return res.json().then(function (data) { if (!res.ok || !data.ok) throw new Error(data.error || 'failed'); }); })
        .then(function () { status.textContent = "You're on the list. Check your inbox to confirm your email."; })
        .catch(function () { status.textContent = 'Could not sign you up. Try again.'; status.className = 'status error'; });
    });
    var watchButtons = document.querySelectorAll('.pto-watch-btn');
    watchButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var start = btn.getAttribute('data-start');
        var end = btn.getAttribute('data-end');
        var orig = btn.getAttribute('data-origin');
        var email = prompt('Enter your email to watch this long weekend:');
        if (!email) return;
        if (!/^\S+@\S+\.\S+$/.test(email)) { alert('Please enter a valid email.'); return; }
        btn.disabled = true;
        btn.textContent = 'Setting watch…';
        fetch('/api/pto-watch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email, origin_iata: orig, window_start: start, window_end: end })
        }).then(function (res) {
          return res.json().then(function (data) {
            if (!res.ok || !data.ok) throw new Error(data.error || 'Failed');
          });
        }).then(function () {
          btn.textContent = 'Watching ✓';
        }).catch(function (err) {
          alert('Could not set watch: ' + (err.message || 'Error'));
          btn.disabled = false;
          btn.textContent = 'Watch this weekend';
        });
      });
    });
  })();
  </script>`;

  return page({
    title: `Long weekends from ${city}: 2026-2027 | Sparkfare`,
    description: `Every 2026 and 2027 long weekend from ${city}, how many PTO days each takes, and the best plan for your PTO budget, with destinations that fit each window.`,
    canonical: bareUrl,
    robots: hasVariant ? 'noindex, follow' : 'index, follow',
    ogImage: `${appUrl}/og/time-off/${origin.toLowerCase()}.png`,
    body,
    script,
  });
}

// The share card: totals and place, never a fare.
export function ptoCardText({ origin, budget, keys, now }) {
  const from = todayOf(now);
  const holidays = holidaysInRange({ from, to: PTO_LAST_DAY, keys });
  const blocks = bridgeOpportunities({ from, to: PTO_LAST_DAY, holidays });
  const { totals } = optimize({ budget, blocks });
  return { city: originCity(origin), ...totals, budget };
}

export function ptoSitemapUrls(appUrl) {
  return [
    `${appUrl}/time-off`,
    `${appUrl}/blog/how-we-built-the-2027-long-weekend-calendar`,
    ...PTO_ORIGINS.map((o) => `${appUrl}/time-off/${o.toLowerCase()}`),
  ];
}

// Resolve ?h= / ?hk= into a holiday list: a valid compact code wins, then repeated hk values, then the default set.
export function holidayKeysFromParams(params) {
  const code = params.get('h');
  if (code) {
    const decoded = decodeHolidaySet(code);
    if (decoded) return decoded; // '0' is a real choice: no holidays
  }
  const picked = params.getAll('hk').filter((k) => HOLIDAY_ORDER.includes(k));
  if (picked.length > 0) return HOLIDAY_ORDER.filter((k) => picked.includes(k));
  // The form always sends `hs`, so an empty `hk` list with `hs` means every box was unchecked.
  if (params.has('hs')) return [];
  return COMMON_HOLIDAY_SET;
}
export { money };
