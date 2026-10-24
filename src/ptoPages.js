// PTO calendar pages (ROADMAP step 72, Track A): server-rendered HTML for /time-off and /time-off/<origin>.
// Everything a crawler or an AI assistant needs is in the HTML without JavaScript; the small script at the end only
// handles the share button and the email form. Pure functions: the Worker passes in `now` and the flags.
import { escapeHtml, originCity } from './emailTemplates/helpers.js';
import { SITE_NAV_HTML } from './siteHeader.js';
import { GRID_DISCLOSURE } from './referralCopy.js';
import {
  COMMON_HOLIDAY_SET, HOLIDAY_ORDER, HOLIDAY_NAMES, DEFAULT_HOLIDAY_CODE,
  encodeHolidaySet, decodeHolidaySet, holidaysInRange, bridgeOpportunities, optimize, summarizeByHoliday,
  describeBlock, destinationsForWindow, tripLengthBucket, rangeLabel, dayLabel, DESTINATION_FIT, parseDay,
} from './ptoCalendar.js';
import { imgAttrs } from './unsplashImg.js';

// The 15 marketed US origins. TLV is a testing origin and gets no PTO page (US holiday calendar).
export const PTO_ORIGINS = ['JFK', 'LAX', 'ORD', 'ATL', 'DFW', 'SFO', 'MIA', 'IAD', 'EWR', 'SEA', 'IAH', 'BOS', 'DEN', 'PHX', 'LAS', 'PHL', 'MSP', 'CLT', 'DTW', 'FLL', 'BWI', 'AUS'];
export const PTO_LAST_DAY = '2027-12-31';
export const DEFAULT_BUDGET = 10;
const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

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

const NAV = SITE_NAV_HTML;

const STYLE = `<link rel="stylesheet" href="/brand/tokens.css">
<link rel="stylesheet" href="/brand/fonts.css">
<style>
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--sand); color: var(--text); font-family: var(--font-body); line-height: 1.6; }
    .wrap { max-width: 760px; margin: 0 auto; padding: 32px 16px 80px; }
    .card { background: var(--card); border: 1px solid var(--border); border-radius: 6px; padding: 22px; margin-bottom: 18px; }
    h1, h2, h3 { margin: 0 0 8px; letter-spacing: -0.02em; }
    h1 { font-size: 1.7rem; } h2 { font-size: 1.2rem; } h3 { font-size: 1.02rem; }
    .sub, .muted { color: var(--muted); } .sub { margin: 0 0 16px; }
    .small { font-size: 0.85rem; }
    label { display: block; font-size: 0.85rem; font-weight: 600; margin: 12px 0 4px; }
    input[type="number"], input[type="email"], select { width: 100%; min-height: 44px; padding: 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--card); color: var(--text); font: inherit; }
    .checks { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 2px 14px; margin-top: 6px; }
    .checks label { display: flex; align-items: center; gap: 8px; font-weight: 400; margin: 0; min-height: 44px; }
    .checks input { width: 20px; height: 20px; flex: none; }
    button, .btn { display: inline-block; min-height: 44px; padding: 10px 18px; background: var(--sage); color: var(--on-sage); border: none; border-radius: 6px; cursor: pointer; font: inherit; font-weight: 600; text-decoration: none; }
    button:hover, .btn:hover { background: var(--sage-dark); }
    .btn.secondary, button.secondary { background: transparent; color: var(--sage-dark); border: 1px solid var(--sage); }
    .btn.secondary:hover, button.secondary:hover { background: var(--paper-deep); }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
    .totals { font-size: 1.05rem; font-weight: 600; margin: 4px 0 14px; }
    .block { border-top: 1px solid var(--border); padding: 14px 0; }
    .block:first-of-type { border-top: none; padding-top: 0; }
    .block h3 { margin-bottom: 2px; }
    .range { color: var(--muted); font-size: 0.9rem; margin: 0 0 6px; }
    .pill { display: inline-block; font-size: 0.8125rem; background: var(--paper); color: var(--sage-dark); border-radius: 50px; padding: 2px 10px; margin-right: 6px; }
    details summary { cursor: pointer; min-height: 44px; display: flex; align-items: center; color: var(--sage-dark); font-weight: 600; }
    .fares { margin: 6px 0 0; padding: 0; list-style: none; } .fares li { padding: 6px 0; border-top: 1px solid var(--border); } .fare-link { min-height: 44px; margin-left: 6px; padding: 6px 12px; font-size: 0.85rem; }
    .fit { display: flex; flex-wrap: wrap; gap: 6px 14px; margin: 6px 0 0; padding: 0; list-style: none; }
    .fit a { color: var(--sage-dark); display: inline-block; min-height: 28px; }
    table { width: 100%; border-collapse: collapse; font-size: 0.92rem; }
    th, td { text-align: left; padding: 8px 6px; border-top: 1px solid var(--border); vertical-align: top; }
    th { font-size: 0.8125rem; color: var(--muted); font-weight: 600; border-top: none; }
    .status { margin-top: 8px; font-size: 0.85rem; color: var(--sage-dark); min-height: 1.2em; } .status.error { color: var(--clay); }
    .origins { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 6px 10px; padding: 0; list-style: none; margin: 8px 0 0; }
    .origins a { display: flex; align-items: center; min-height: 44px; color: var(--sage-dark); }
    a { color: var(--sage-dark); }
    /* K-B5: the plan headline is the hero; each window is one line that opens on tap. */
    .hero-num { font-family: var(--font-display); font-size: 44px; font-weight: 700; line-height: 1.1; letter-spacing: -0.02em; color: var(--ink); margin: 0; }
    .hero-sub { font-family: var(--font-mono); font-size: 1rem; color: var(--ink-2); margin: 4px 0 14px; }
    .strip { position: relative; height: 14px; border-radius: 7px; background: var(--paper-deep); margin: 4px 0 4px; }
    .strip i { position: absolute; top: 0; bottom: 0; min-width: 6px; border-radius: 7px; background: var(--sage); }
    .strip-months { display: flex; justify-content: space-between; font-size: 0.8125rem; color: var(--ink-2); margin: 0 0 14px; }
    details.window { border-top: 1px solid var(--border); }
    details.window > summary { list-style: none; display: flex; flex-wrap: wrap; align-items: center; gap: 2px 12px; min-height: 48px; padding: 6px 0; cursor: pointer; color: var(--ink); font-weight: 400; }
    details.window > summary::-webkit-details-marker { display: none; }
    details.window > summary::after { content: '+'; margin-left: auto; font-weight: 600; color: var(--sage-dark); }
    details.window[open] > summary::after { content: '\\2212'; }
    .win-range { font-weight: 600; } .win-name { color: var(--ink-2); } .win-meta { color: var(--ink-2); font-size: 0.9rem; }
    .win-body { padding: 0 0 16px; }
    .win-take { margin: 0 0 10px; }
    .postcards { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; margin: 0 0 8px; padding: 0; list-style: none; }
    .postcard-link { display: block; color: var(--ink); text-decoration: none; }
    .postcard-photo { display: block; width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: var(--radius); background: var(--paper-deep); }
    .postcard-name { display: block; margin-top: 4px; font-weight: 600; }
    .postcard-region { font-weight: 400; color: var(--ink-2); }
    .postcard-credit { margin: 2px 0 0; font-size: 0.8125rem; color: var(--ink-2); }
    .postcard-credit a { color: var(--ink-2); }
    details.see-all > summary { min-height: 44px; }
    details.holidays > summary { min-height: 44px; display: flex; align-items: center; font-weight: 600; font-size: 1.2rem; color: var(--ink); }
    .site-nav { display: flex; gap: 18px; font-size: 0.85rem; margin-bottom: 20px; flex-wrap: wrap; }
    .site-nav a { color: var(--ink-2); text-decoration: none; }
    @media (max-width: 768px) { .site-nav { gap: 0 18px; } .site-nav a { display: inline-block; padding: 11px 0; } }
    .site-nav a:hover { text-decoration: underline; }
    .site-nav a.brand-link { display: inline-flex; align-items: center; gap: 6px; }
    .brand-mark { width: 16px; height: 16px; flex-shrink: 0; }
    .print-only { display: none; }
    /* M4: print stylesheet for a clean 1- to 2-page calendar sheet */
    @media print {
      @page { size: auto; margin: 12mm 15mm; }
      body { background: white !important; color: var(--ink) !important; font-size: 11pt; line-height: 1.4; }
      .wrap { max-width: 100% !important; padding: 0 !important; margin: 0 !important; }
      .site-nav, .sf-nav, .skip-link, .sf-account, .sf-menu-btn,
      .actions, button, .btn, form, input, select, label,
      .affiliate-note, #grid-disclosure, .fares, .status,
      .pto-watch-btn, details.window > summary::after, details.holidays > summary::after,
      .see-all, .postcards, site-footer, script, #time-off-faq, .faq-item {
        display: none !important;
      }
      .print-only { display: block !important; margin-bottom: 8pt !important; border-bottom: 1px solid var(--border) !important; padding-bottom: 4pt !important; font-size: 9pt !important; color: var(--ink-2) !important; }
      details { display: block !important; }
      details > summary { display: block !important; cursor: default !important; font-weight: 600; min-height: auto !important; padding: 2pt 0 !important; }
      details > summary::-webkit-details-marker { display: none !important; }
      details > .win-body { display: block !important; padding: 0 0 6pt !important; }
      .card { background: transparent !important; border: none !important; padding: 0 !important; margin: 0 0 12pt 0 !important; box-shadow: none !important; break-inside: avoid; page-break-inside: avoid; }
      .block, details.window { border-top: 1px solid var(--border) !important; padding: 4pt 0 !important; break-inside: avoid; page-break-inside: avoid; }
      .hero-num { font-size: 26pt !important; color: var(--ink) !important; }
      .hero-sub { font-size: 11pt !important; color: var(--ink-2) !important; margin-bottom: 6pt !important; }
      .strip { background: var(--paper-deep) !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .strip i { background: var(--sage) !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .strip-months { font-size: 8pt !important; color: var(--ink-2) !important; margin: 0 0 8pt !important; }
      .win-range { font-size: 10.5pt !important; }
      .win-name { font-size: 9.5pt !important; color: var(--ink-2) !important; }
      .win-meta { font-size: 9pt !important; color: var(--ink-2) !important; }
      .win-take { margin: 2pt 0 4pt !important; font-size: 9.5pt !important; color: var(--ink-2) !important; }
      h1 { font-size: 18pt !important; margin-bottom: 4pt !important; }
      h2 { font-size: 13pt !important; margin-bottom: 4pt !important; }
      .sub { font-size: 9.5pt !important; margin-bottom: 6pt !important; }
      table { width: 100% !important; border-collapse: collapse !important; font-size: 9.5pt !important; }
      th, td { padding: 4pt 6pt !important; border-top: 1px solid var(--border) !important; }
      th { font-size: 8.5pt !important; color: var(--ink-2) !important; }
      p.muted.small { font-size: 8.5pt !important; color: var(--ink-2) !important; }
    }
    .faq-item { border-top: 1px solid var(--border); padding: 12px 0; }
    .faq-item:first-of-type { border-top: none; padding-top: 0; }
    .faq-item summary { font-weight: 600; font-size: 0.95rem; color: var(--ink); cursor: pointer; list-style: none; display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 4px 0; min-height: 44px; }
    .faq-item summary::-webkit-details-marker { display: none; }
    .faq-item summary::after { content: "+"; font-size: 1.15rem; font-weight: 700; color: var(--sage); flex-shrink: 0; }
    .faq-item[open] summary::after { content: "\\2212"; }
    .faq-answer { padding: 6px 0 4px; color: var(--ink-2); font-size: 0.875rem; line-height: 1.55; }
  </style>`;

export function page({ title, description, canonical, robots, ogImage, body, script = '', jsonLd = null }) {
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
  ${ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="${escapeHtml(ogImage)}" />` : ''}
  ${jsonLd ? `<script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
</script>` : ''}
  <link rel="icon" type="image/svg+xml" href="/sparkfare_mark.svg" />
  <link rel="icon" type="image/png" href="/favicon.png" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <script src="/utm.js"></script>
  ${STYLE}
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
  <div class="wrap">
    ${NAV}
<main id="main">
${body}
</main>
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

export const TIME_OFF_FAQS = [
  {
    q: 'How are long-weekend bridge days calculated?',
    a: 'Sparkfare combines official federal holidays with adjacent weekends to identify contiguous days away from work. Any weekday between a weekend and an observed holiday is counted as a paid time off day. The optimizer schedules your chosen PTO budget to get you the most days off.',
  },
  {
    q: 'Which holidays are included by default?',
    a: 'The planner starts with seven holidays turned on: New Year\'s Day, Memorial Day, Independence Day, Labor Day, Thanksgiving, the day after Thanksgiving and Christmas. Federal holidays use the observed dates set by the Office of Personnel Management, and the day after Thanksgiving is not a federal holiday. Many employers do not give all of them, so turn on the ones yours does.',
  },
  {
    q: 'Does the planner show flight prices?',
    a: 'The planner shows dates and the days off they give you, not prices. Fares on the linked route pages are cached lows and can change at any time. Sparkfare does not sell or book travel.',
  },
];

export const TIME_OFF_FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  'mainEntity': TIME_OFF_FAQS.map((item) => ({
    '@type': 'Question',
    'name': item.q,
    'acceptedAnswer': {
      '@type': 'Answer',
      'text': item.a,
    },
  })),
};

export const TIME_OFF_FAQ_HTML = `    <div class="card" id="time-off-faq">
      <h2>Frequently Asked Questions</h2>
${TIME_OFF_FAQS.map((item, idx) => `      <div class="faq-item">
        <details${idx === 0 ? ' open' : ''}>
          <summary>${escapeHtml(item.q)}</summary>
          <div class="faq-answer">${escapeHtml(item.a)}</div>
        </details>
      </div>`).join('\n')}
      <p class="muted small" style="margin-top:14px;">For details on how deal baselines and fares are measured, read about <a href="/how-it-works">how Sparkfare works</a>.</p>
    </div>`;

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

  // M4: national 2027 long weekends bridge table
  const holidays2027 = holidaysInRange({ from: '2027-01-01', to: '2027-12-31', keys: COMMON_HOLIDAY_SET });
  const blocks2027 = bridgeOpportunities({ from: '2027-01-01', to: '2027-12-31', holidays: holidays2027 });
  const national2027Rows = summarizeByHoliday({ holidays: holidays2027, blocks: blocks2027 }).map(({ holiday, options }) => {
    const opts = options.map((b) => {
      const d = describeBlock(b);
      return `<div>${escapeHtml(d.headline)} <span class="muted">(${escapeHtml(yearRange(b))})</span></div>`;
    }).join('') || '<span class="muted">No long weekend with 3 or fewer PTO days.</span>';
    return `<tr><td><strong>${escapeHtml(holiday.name)}</strong><br><span class="muted small">${escapeHtml(dayLabel(holiday.observed))}, 2027</span></td><td>${opts}</td></tr>`;
  }).join('');
  const asOfDate = `${MONTHS_FULL[now.getUTCMonth()]} ${now.getUTCFullYear()}`;

  const body = `    <div class="card">
      <h1>Long weekends and PTO planner, 2026-2027</h1>
      <p class="sub">Every long weekend through the end of 2027, how many PTO days each one takes, and the best plan for your PTO budget. Pick your home airport to see the plan and destinations that fit each window.</p>
      <h2>Choose your airport</h2>
      <ul class="origins">${originLinks}</ul>
    </div>
    <div class="card" id="2027-long-weekends">
      <h2>2027 long weekends</h2>
      <p class="sub">National bridge opportunities for 2027 with the standard federal holiday schedule. Turn weekends and observed holidays into extended trips with minimal PTO.</p>
      <table><thead><tr><th>Holiday</th><th>2027 Options &amp; Bridges</th></tr></thead><tbody>${national2027Rows}</tbody></table>
      ${METHOD_NOTE}
      <p class="muted small as-of" style="margin-top:10px;">As of ${escapeHtml(asOfDate)}. Based on official OPM federal calendar rules.</p>
    </div>
    <div class="card" id="embed-section">
      <h2>Embed this calendar</h2>
      <p class="sub">Add the 2027 national long-weekend calendar to your website or editorial coverage. Free to embed with attribution.</p>
      <label for="embed-code">HTML embed snippet</label>
      <textarea id="embed-code" readonly rows="3" style="width:100%;min-height:70px;padding:8px;font-family:var(--font-mono);font-size:0.85rem;border:1px solid var(--border);border-radius:6px;background:var(--card);color:var(--text);">&lt;iframe src="${appUrl}/time-off/embed" width="100%" height="450" frameborder="0" title="Sparkfare 2027 Long Weekends Calendar"&gt;&lt;/iframe&gt;
&lt;p&gt;&lt;small&gt;Calendar provided by &lt;a href="${appUrl}/time-off" target="_blank" rel="noopener"&gt;Sparkfare&lt;/a&gt;&lt;/small&gt;&lt;/p&gt;</textarea>
      <div class="actions" style="margin-top:8px;">
        <button type="button" class="secondary" id="copy-embed-btn">Copy embed code</button>
      </div>
      <div class="status" id="embed-status" aria-live="polite"></div>
    </div>
    <div class="card">
      <h2>All holiday bridges through 2027</h2>
      <p class="sub">Using the holidays most private employers give. Choose your own set on any airport page.</p>
      <table><thead><tr><th>Holiday</th><th>Options</th></tr></thead><tbody>${rows}</tbody></table>
      ${METHOD_NOTE}
    </div>
${TIME_OFF_FAQ_HTML}`;

  const script = `<script>
  (function() {
    var btn = document.getElementById('copy-embed-btn');
    var code = document.getElementById('embed-code');
    var status = document.getElementById('embed-status');
    if (btn && code) {
      btn.addEventListener('click', function() {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(code.value).then(function() {
            if (status) status.textContent = 'Embed code copied to clipboard.';
          }, function() {
            if (status) status.textContent = 'Please select and copy the code above.';
          });
        } else {
          code.select();
          if (status) status.textContent = 'Code selected. Press Ctrl+C or Cmd+C to copy.';
        }
      });
    }
  })();
  </script>`;

  return page({
    title: 'Long weekends and PTO planner, 2026-2027 | Sparkfare',
    description: 'Every long weekend through 2027, how many PTO days each takes, and the best plan for your PTO budget, with destinations that fit each window.',
    canonical: `${appUrl}/time-off`,
    robots: 'index, follow',
    ogImage: null,
    body,
    script,
    jsonLd: TIME_OFF_FAQ_SCHEMA,
  });
}

// ---- /time-off/embed (M4 national calendar iframe) ---------------------------------------------------------

export function renderTimeOffEmbed({ appUrl, now = new Date() }) {
  const holidays2027 = holidaysInRange({ from: '2027-01-01', to: '2027-12-31', keys: COMMON_HOLIDAY_SET });
  const blocks2027 = bridgeOpportunities({ from: '2027-01-01', to: '2027-12-31', holidays: holidays2027 });
  const rows = summarizeByHoliday({ holidays: holidays2027, blocks: blocks2027 }).map(({ holiday, options }) => {
    const opts = options.map((b) => {
      const d = describeBlock(b);
      return `<div>${escapeHtml(d.headline)} <span class="muted">(${escapeHtml(yearRange(b))})</span></div>`;
    }).join('') || '<span class="muted">No long weekend with 3 or fewer PTO days.</span>';
    return `<tr><td><strong>${escapeHtml(holiday.name)}</strong><br><span class="muted small">${escapeHtml(dayLabel(holiday.observed))}, 2027</span></td><td>${opts}</td></tr>`;
  }).join('');
  const asOfDate = `${MONTHS_FULL[now.getUTCMonth()]} ${now.getUTCFullYear()}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>2027 Long Weekends Calendar | Sparkfare</title>
  <link rel="stylesheet" href="/brand/tokens.css">
  <link rel="stylesheet" href="/brand/fonts.css">
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 16px; background: var(--paper); color: var(--ink); font-family: var(--font-body); line-height: 1.5; font-size: 0.92rem; }
    h2 { margin: 0 0 6px; font-size: 1.25rem; font-family: var(--font-display); letter-spacing: -0.02em; }
    .sub { color: var(--ink-2); margin: 0 0 14px; font-size: 0.88rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    th { text-align: left; padding: 6px 4px; font-size: 0.8125rem; color: var(--ink-2); font-weight: 600; border-bottom: 1px solid var(--line); }
    td { padding: 8px 4px; border-top: 1px solid var(--line); vertical-align: top; }
    .muted { color: var(--ink-2); }
    .small { font-size: 0.82rem; }
    .method { margin: 12px 0 6px; }
    .credit { margin: 14px 0 0; padding-top: 10px; border-top: 1px solid var(--line); font-size: 0.85rem; color: var(--ink-2); display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
    a { color: var(--sage); text-decoration: underline; font-weight: 500; }
    a:hover { color: var(--sage-dark); }
  </style>
</head>
<body>
  <h2>2027 Long Weekends &amp; Bridges</h2>
  <p class="sub">National federal holidays and optimal vacation bridge days for 2027.</p>
  <table>
    <thead><tr><th>Holiday</th><th>2027 Options &amp; Bridges</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="muted small method">How this works: weekends and observed holidays are free days off; weekdays between them are PTO days. Holiday dates follow official US federal calendar (OPM) rules, including observed days. Many employers do not give every federal holiday.</p>
  <div class="credit">
    <span>As of ${escapeHtml(asOfDate)} · Federal OPM rules</span>
    <a href="${escapeHtml(appUrl)}/time-off" target="_blank" rel="noopener">See full 2027 time-off planner on Sparkfare ↗</a>
  </div>
</body>
</html>`;
}

// ---- /time-off/<origin> -------------------------------------------------------------------------------

function holidayCheckboxes(keys) {
  const chosen = new Set(keys);
  return HOLIDAY_ORDER.map((key) => `<label><input type="checkbox" name="hk" value="${key}"${chosen.has(key) ? ' checked' : ''}> ${escapeHtml(HOLIDAY_NAMES[key])}</label>`).join('');
}

const POSTCARD_SIZES = '(max-width: 767px) calc(100vw - 64px), 220px';
const POSTCARDS_PER_WINDOW = 3;

// K-B5: destinations for a window, best first. A destination with a fare seen for these dates comes first (cheapest first); the rest are ranked by
// fit: the larger a destination's minimum days off, the better it uses a window that long (a nine-day window suits Bali better than Mexico City),
// ties alphabetical. Only destinations that fit the window at all are ever listed.
export function rankDestinations(block, origin, faresStore = null) {
  const fit = destinationsForWindow(block.daysOff, origin);
  const withFare = [];
  for (const f of faresForWindow(faresStore, origin, block).sort((x, y) => x.price - y.price)) {
    if (fit.includes(f.destination) && !withFare.includes(f.destination)) withFare.push(f.destination);
  }
  const rest = fit.filter((n) => !withFare.includes(n)).sort((x, y) => (DESTINATION_FIT[y] - DESTINATION_FIT[x]) || x.localeCompare(y));
  return [...withFare, ...rest];
}

function postcardHtml(name, origin, images) {
  const [city, ...region] = name.split(',');
  const img = images && images[name];
  const photo = img && img.image_url
    ? `<img class="postcard-photo" ${imgAttrs(img.image_url, [480, 720], POSTCARD_SIZES)} alt="" loading="lazy" decoding="async">`
    : '<div class="postcard-photo" aria-hidden="true"></div>';
  const credit = img && img.image_url
    ? `<p class="postcard-credit">Photo by <a href="${escapeHtml(img.photographer_link)}" target="_blank" rel="noopener">${escapeHtml(img.photographer_name)}</a> on <a href="${escapeHtml(img.unsplash_link)}" target="_blank" rel="noopener">Unsplash</a></p>`
    : '';
  const regionText = region.join(',').trim();
  return `<li><a class="postcard-link" href="${routePagePath(origin, name)}">${photo}<span class="postcard-name">${escapeHtml(city.trim())}${regionText ? ` <span class="postcard-region">${escapeHtml(regionText)}</span>` : ''}</span></a>${credit}</li>`;
}

function destinationsHtml(ranked, origin, images) {
  if (ranked.length === 0) return '';
  const top = ranked.slice(0, POSTCARDS_PER_WINDOW);
  const rest = ranked.slice(POSTCARDS_PER_WINDOW);
  const link = (n) => `<li><a href="${routePagePath(origin, n)}">${escapeHtml(n)}</a></li>`;
  return `<ul class="postcards">${top.map((n) => postcardHtml(n, origin, images)).join('')}</ul>${rest.length ? `<details class="see-all"><summary>See all ${ranked.length} that fit this window</summary><ul class="fit">${rest.map(link).join('')}</ul></details>` : ''}`;
}

// A compact calendar strip: one bar from today to the end of the planning range, with each chosen window marked. Decoration only; the windows are listed below.
function stripHtml(plan, from) {
  if (plan.length === 0) return '';
  const t0 = parseDay(from);
  const span = parseDay(PTO_LAST_DAY) - t0;
  const pct = (n) => Math.max(0, Math.min(100, n)).toFixed(2);
  const marks = plan.map((b) => {
    const left = ((parseDay(b.start) - t0) / span) * 100;
    const width = ((parseDay(b.end) - parseDay(b.start) + 86400000) / span) * 100;
    return `<i style="left:${pct(left)}%;width:${pct(width)}%"></i>`;
  }).join('');
  const MONTHS_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const startDate = new Date(t0);
  const labels = [`${MONTHS_ABBR[startDate.getUTCMonth()]} ${startDate.getUTCFullYear()}`, 'Jan 2027', 'Jul 2027', 'Dec 2027'];
  return `<div class="strip" role="img" aria-label="${plan.length} window${plan.length === 1 ? '' : 's'} between ${escapeHtml(rangeLabel(plan[0].start, plan[plan.length - 1].end).replace(' to ', ' and '))}">${marks}</div>
      <div class="strip-months" aria-hidden="true">${labels.map((l) => `<span>${l}</span>`).join('')}</div>`;
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
const FARE_ARIA = 'View this fare on a booking site (opens in a new tab). Sparkfare does not sell or book travel.';

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

function blockHtml(block, origin, { leaveReady, faresStore = null, now = new Date(), watchEnabled = false, images = null }) {
  const d = describeBlock(block);
  const holidayNames = block.holidayKeys.map((k) => HOLIDAY_NAMES[k]).join(', ');
  const ptoText = block.ptoUsed === 0 ? 'no PTO needed' : `${block.ptoUsed} PTO day${block.ptoUsed === 1 ? '' : 's'}`;
  const watchBtn = watchEnabled
    ? `<div class="actions" style="margin-top:8px;"><button type="button" class="secondary pto-watch-btn" data-start="${escapeHtml(block.start)}" data-end="${escapeHtml(block.end)}" data-origin="${escapeHtml(origin)}">Watch this weekend</button></div>`
    : '';
  return `<details class="window block" data-window-start="${escapeHtml(block.start)}" data-window-end="${escapeHtml(block.end)}">
        <summary><span class="win-range">${escapeHtml(rangeLabel(block.start, block.end))}</span>${holidayNames ? `<span class="win-name">${escapeHtml(holidayNames)}</span>` : ''}<span class="win-meta">${block.daysOff} days off \u00b7 ${ptoText}</span></summary>
        <div class="win-body">
        <p class="win-take">${escapeHtml(d.headline)} <span class="muted small">(${escapeHtml(yearRange(block))})</span></p>
        ${destinationsHtml(rankDestinations(block, origin, faresStore), origin, images)}
        ${faresStore ? faresHtml(block, origin, faresStore, now) : '<p class="muted small" style="margin:8px 0 0;">Fares appear here as we see them.</p>'}
        ${watchBtn}
        ${leaveReady ? (block.daysOff >= 5
          ? `<p class="small" style="margin:6px 0 0;"><a href="/leave?src=pto">Before you go: get your home ready</a></p>`
          : `<p class="small" style="margin:6px 0 0;">Leaving for longer? <a href="/leave?src=pto">Make a checklist</a></p>`) : ''}
        </div>
      </details>`;
}

export function renderTimeOffOrigin({ origin, budget = DEFAULT_BUDGET, keys = COMMON_HOLIDAY_SET, now, appUrl, hasVariant = false, leaveReady = false, faresStore = null, watchEnabled = false, images = null }) {
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
    ? plan.map((b) => blockHtml(b, origin, { leaveReady, faresStore, now, watchEnabled, images })).join('')
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
      <div class="print-only">Sparkfare · Long weekends from ${escapeHtml(city)} (2026-2027) · sparkfare.com/time-off/${origin.toLowerCase()}</div>
      <h2>Your plan</h2>
      ${plan.length === 0 ? `<p class="totals">${headline}</p>` : `<p class="hero-num">${totals.daysOff} days off</p><p class="hero-sub">for ${totals.ptoUsed} PTO day${totals.ptoUsed === 1 ? '' : 's'}</p>`}
      ${stripHtml(plan, from)}
      ${faresStore ? fareNote(faresStore, now) : ''}
      ${planHtml}
      <div class="actions">
        <a class="btn" id="ics-link" href="${icsUrl.replace(appUrl, '')}" rel="nofollow">Add to calendar (.ics)</a>
        <button type="button" class="secondary" id="share-btn" data-url="${escapeHtml(shareUrl)}" data-text="${escapeHtml(`${totals.ptoUsed} PTO days, ${totals.daysOff} days off from ${city}`)}">Share this plan</button>
      </div>
      <div class="status" id="share-status" aria-live="polite"></div>
    </div>
    <div class="card">
      <h2>Get deal alerts from ${escapeHtml(city)}</h2>
      <p class="sub">At most one fare email a day when a fare from your home airport beats its usual price.</p>
      <form id="alert-form" novalidate data-trip-length="${bucket}" data-origin="${origin}">
        <label for="alert-email">Email</label>
        <input id="alert-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" required />
        <div class="actions"><button type="submit">Get deal alerts</button></div>
        <div id="alert-status" class="status" aria-live="polite"></div>
      </form>
    </div>
    <div class="card">
      <details class="holidays">
        <summary>Every holiday and its best bridges</summary>
        <table><thead><tr><th>Holiday</th><th>Options</th></tr></thead><tbody>${opportunityRows}</tbody></table>
        ${METHOD_NOTE}
      </details>
    </div>
${TIME_OFF_FAQ_HTML}`;

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
      fetch('/api/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'local_' + Date.now(), email: email, origin_iata: form.getAttribute('data-origin'), trip_length: form.getAttribute('data-trip-length'), source: 'pto', utm: (typeof window.sparkfareUtm === 'function' && window.sparkfareUtm()) || undefined }) })
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
    jsonLd: TIME_OFF_FAQ_SCHEMA,
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
