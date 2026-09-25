import { renderDailyDigest, ARCHIVE_HEAD_MARKER, ARCHIVE_BODY_MARKER } from './emailTemplates/dailyDigest.js';
import { escapeHtml, originCity, isoDay, formatEditionDate } from './emailTemplates/helpers.js';

// The 12 public US origins. TLV is excluded, like every other public-facing surface.
export const ARCHIVE_ORIGINS = ['JFK', 'LAX', 'ORD', 'ATL', 'DFW', 'SFO', 'MIA', 'IAD', 'EWR', 'SEA', 'IAH', 'BOS'];
const MAX_STORED_DEALS = 12;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const FONT_BODY = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, Helvetica, sans-serif";
const FONT_HEAD = "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, Helvetica, sans-serif";

export function archiveEnabled(env) {
  return env?.ENABLE_DIGEST_ARCHIVE === 'true';
}

const KEPT_FIELDS = [
  'display_name', 'origin', 'price', 'status', 'airline', 'booking_link', 'departure_at', 'return_at',
  'found_at', 'last_fresh_date', 'observations', 'email_status',
];

function slimDeal(deal) {
  const out = {};
  for (const key of KEPT_FIELDS) if (deal[key] !== undefined) out[key] = deal[key];
  return out;
}

// Stores one immutable edition per origin per day. The first run of the day wins, so the 07:00
// and 08:00 sends (and the email's "View in browser" link) all point at the same edition.
export async function archiveEditions(env, { now = new Date(), loadDeals, buildConfig, origins = ARCHIVE_ORIGINS } = {}) {
  if (!env?.DB) return { archived: 0, skipped: 0, reason: 'DB not configured' };
  const date = isoDay(now);
  let archived = 0;
  let skipped = 0;
  const config = await buildConfig();

  for (const origin of origins) {
    try {
      const existing = await env.DB.prepare(
        'SELECT id FROM digest_editions WHERE origin = ? AND edition_date = ? AND kind = ?'
      ).bind(origin, date, 'daily').first();
      if (existing) { skipped += 1; continue; }

      const deals = await loadDeals(origin);
      if (!deals || deals.length === 0) { skipped += 1; continue; }

      const countRow = await env.DB.prepare(
        'SELECT COUNT(*) AS n FROM digest_editions WHERE origin = ? AND kind = ?'
      ).bind(origin, 'daily').first();
      const editionNumber = (countRow?.n || 0) + 1;

      const slim = deals.slice(0, MAX_STORED_DEALS).map(slimDeal);
      const rendered = renderDailyDigest({ origin, deals: slim, edition: editionNumber, user: null, now, config });
      await env.DB.prepare(`
        INSERT OR IGNORE INTO digest_editions
          (id, origin, edition_date, kind, edition_number, subject, html_public, deals_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(crypto.randomUUID(), origin, date, 'daily', editionNumber, rendered.subject, rendered.html, JSON.stringify(slim), now.toISOString()).run();
      archived += 1;
    } catch (error) {
      console.error(`Digest archive failed for ${origin}:`, error);
    }
  }
  return { archived, skipped };
}

// ---------- Web pages ----------

function htmlResponse(html, status = 200) {
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
}

function notFound() {
  return new Response('Not found', { status: 404 });
}

function navHtml() {
  const link = (href, label) => `<a class="sf-link" href="${href}" style="color:#3F6643;text-decoration:none;margin-right:16px;">${label}</a>`;
  return `<p style="margin:0 0 16px;font-family:${FONT_BODY};font-size:14px;line-height:20px;">
    ${link('/', 'Sparkfare')}${link('/digest', 'Digest')}${link('/data/', 'All routes')}${link('/blog/', 'Blog')}${link('/account', 'Preferences')}
  </p>`;
}

function signupHtml(origin) {
  const options = ARCHIVE_ORIGINS.map((o) => `<option value="${o}"${o === origin ? ' selected' : ''}>${escapeHtml(originCity(o))} (${o})</option>`).join('');
  return `<div class="sf-card sf-line" style="background:#E3D9C4;border:1px solid #DCD3BF;border-radius:8px;padding:16px 20px;margin:0 0 16px;font-family:${FONT_BODY};">
    <p class="sf-text" style="margin:0 0 8px;font-family:${FONT_HEAD};font-size:18px;line-height:24px;font-weight:500;color:#2B2620;">Get this in your inbox every morning</p>
    <form id="archive-signup" style="margin:0;">
      <label for="archive-email" style="position:absolute;left:-9999px;">Email</label>
      <input id="archive-email" name="email" type="email" required placeholder="you@example.com" autocomplete="email" style="box-sizing:border-box;width:100%;padding:12px;font-size:16px;border:1px solid #DCD3BF;border-radius:6px;margin:0 0 8px;">
      <label for="archive-origin" style="position:absolute;left:-9999px;">Home airport</label>
      <select id="archive-origin" name="origin_iata" style="box-sizing:border-box;width:100%;padding:12px;font-size:16px;border:1px solid #DCD3BF;border-radius:6px;margin:0 0 8px;">${options}</select>
      <button type="submit" style="min-height:44px;padding:12px 22px;font-size:16px;font-weight:600;color:#F7F2E7;background:#3F6643;border:0;border-radius:6px;cursor:pointer;">Get deal alerts</button>
    </form>
    <p id="archive-status" class="sf-muted" aria-live="polite" style="margin:8px 0 0;font-size:14px;line-height:20px;color:#6B6255;">Free. Unsubscribe any time.</p>
  </div>
  <script>
    (function () {
      var form = document.getElementById('archive-signup');
      var status = document.getElementById('archive-status');
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        var data = new FormData(form);
        var payload = {
          id: 'local_' + Date.now(),
          email: String(data.get('email') || '').trim(),
          origin_iata: String(data.get('origin_iata') || '').toUpperCase(),
          trip_length: '7-10',
          passenger_count: 1,
          subscription_tier: 'free',
          partner_id: 'digest_archive'
        };
        status.textContent = 'Creating your alert…';
        fetch('/api/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
          .then(function (r) { return r.json().catch(function () { return { ok: false }; }).then(function (j) { return { ok: r.ok && j.ok, j: j }; }); })
          .then(function (res) {
            if (!res.ok) throw new Error((res.j && res.j.error) || 'Signup failed');
            status.textContent = 'Alert created for ' + payload.origin_iata + '. Check your email to verify.';
            form.reset();
          })
          .catch(function (err) { status.textContent = err.message || 'Something went wrong.'; });
      });
    })();
  </script>`;
}

function staleBannerHtml(editionDate, origin) {
  return `<div class="sf-line" style="border:1px solid #DCD3BF;border-radius:8px;padding:12px 16px;margin:0 0 16px;font-family:${FONT_BODY};font-size:16px;line-height:24px;">
    <span class="sf-text" style="color:#2B2620;">Prices from ${escapeHtml(editionDate)}. Fares have likely changed.</span>
    <a class="sf-link" href="/?origin=${encodeURIComponent(origin)}" style="color:#3F6643;">See today's deals →</a>
  </div>`;
}

function chrome({ kind, origin, editionDate, isToday, appUrl, canonicalPath }) {
  const indexable = kind === 'weekly';
  const head = [
    `<meta name="robots" content="${indexable ? 'index, follow' : 'noindex, follow'}">`,
    indexable && canonicalPath ? `<link rel="canonical" href="${appUrl}${canonicalPath}">` : '',
    '<link rel="icon" href="/favicon.png" sizes="any">',
    '<link rel="icon" type="image/svg+xml" href="/sparkfare_mark.svg">',
  ].filter(Boolean).join('\n');
  const bodyTop = `<div class="sf-bg" style="background:#EDE6D6;padding:16px 12px 0;"><div style="max-width:600px;margin:0 auto;">
    ${navHtml()}
    ${isToday ? '' : staleBannerHtml(editionDate, origin)}
    ${signupHtml(origin)}
  </div></div>`;
  return { head, bodyTop };
}

function applyChrome(html, parts) {
  return html.replace(ARCHIVE_HEAD_MARKER, parts.head).replace(ARCHIVE_BODY_MARKER, parts.bodyTop);
}

// Old editions link to the live route page instead of a stale affiliate deep link.
function staleLinkForDeal(appUrl) {
  return (deal, parsed) => (parsed ? `${appUrl}/flight/${deal.origin || parsed.origin}/${parsed.destination}` : `${appUrl}/`);
}

function parseStoredTime(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

async function renderEditionPage(row, { env, appUrl, now, buildConfig }) {
  const isToday = row.edition_date === isoDay(now);
  const kind = row.kind;
  const canonicalPath = `/digest/${row.origin}/${row.edition_date}${kind === 'weekly' ? '/weekly' : ''}`;
  let html = row.html_public;
  if (!isToday) {
    const config = await buildConfig();
    const rendered = renderDailyDigest({
      origin: row.origin,
      deals: JSON.parse(row.deals_json),
      edition: row.edition_number,
      user: null,
      now: parseStoredTime(row.created_at),
      config: { ...config, linkForDeal: staleLinkForDeal(appUrl) },
    });
    html = rendered.html;
  }
  return applyChrome(html, chrome({ kind, origin: row.origin, editionDate: row.edition_date, isToday, appUrl, canonicalPath }));
}

function listPage({ title, intro, robots, canonical, sections, appUrl }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="${robots}">
${canonical ? `<link rel="canonical" href="${appUrl}${canonical}">` : ''}
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(intro)}">
<link rel="icon" href="/favicon.png" sizes="any">
<style>
  body { margin: 0; background: #EDE6D6; color: #2B2620; font-family: ${FONT_BODY}; font-size: 16px; line-height: 24px; }
  .wrap { max-width: 720px; margin: 0 auto; padding: 24px 16px; }
  a { color: #3F6643; }
  h1, h2 { font-family: ${FONT_HEAD}; font-weight: 500; }
  ul { padding-left: 20px; }
  li { margin: 0 0 8px; }
  .muted { color: #6B6255; font-size: 14px; }
  @media (prefers-color-scheme: dark) { body { background: #211F1A; color: #EDE6D6; } a { color: #8DB890; } .muted { color: #B3A992; } }
</style>
</head>
<body><div class="wrap">
${navHtml()}
<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(intro)}</p>
${sections}
</div></body></html>`;
}

function editionLink(row) {
  const path = `/digest/${row.origin}/${row.edition_date}${row.kind === 'weekly' ? '/weekly' : ''}`;
  return `<li><a href="${path}">${escapeHtml(row.subject)}</a> <span class="muted">· ${escapeHtml(originCity(row.origin))} · ${escapeHtml(formatEditionDate(row.edition_date))}${row.kind === 'weekly' ? ' · weekly' : ''}</span></li>`;
}

const LIST_COLUMNS = 'origin, edition_date, kind, edition_number, subject';

export async function handleDigestRequest(url, env, { appUrl = 'https://sparkfare.com', now = new Date(), buildConfig } = {}) {
  if (!archiveEnabled(env) || !env?.DB) return notFound();
  const parts = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean); // ['digest', origin?, date?, 'weekly'?]

  if (parts.length === 1) {
    const daily = (await env.DB.prepare(
      `SELECT ${LIST_COLUMNS} FROM digest_editions WHERE kind = 'daily' AND edition_date >= ? ORDER BY edition_date DESC, origin ASC LIMIT 60`
    ).bind(isoDay(new Date(now.getTime() - 7 * 86400000))).all()).results || [];
    const weekly = (await env.DB.prepare(
      `SELECT ${LIST_COLUMNS} FROM digest_editions WHERE kind = 'weekly' ORDER BY edition_date DESC, origin ASC LIMIT 24`
    ).all()).results || [];
    const originLinks = ARCHIVE_ORIGINS.map((o) => `<a href="/digest/${o}">${escapeHtml(originCity(o))}</a>`).join(' · ');
    const sections = `
      <p>Browse by airport: ${originLinks}</p>
      ${weekly.length ? `<h2>Weekly editions</h2><ul>${weekly.map(editionLink).join('')}</ul>` : ''}
      <h2>Latest daily editions</h2>
      ${daily.length ? `<ul>${daily.map(editionLink).join('')}</ul>` : '<p>No editions yet.</p>'}
      <p class="muted">Each edition is a snapshot. Prices carry an "as of" time and change quickly. <a href="/blog/how-we-rank-deals">How we decide what counts as a deal</a>.</p>`;
    return htmlResponse(listPage({
      title: 'The Sparkfare digest archive',
      intro: 'Past editions of the daily flight-deal email, by home airport.',
      robots: 'index, follow', canonical: '/digest', sections, appUrl,
    }));
  }

  const origin = (parts[1] || '').toUpperCase();
  if (!ARCHIVE_ORIGINS.includes(origin)) return notFound();

  if (parts.length === 2) {
    const rows = (await env.DB.prepare(
      `SELECT ${LIST_COLUMNS} FROM digest_editions WHERE origin = ? ORDER BY edition_date DESC, kind ASC LIMIT 30`
    ).bind(origin).all()).results || [];
    return htmlResponse(listPage({
      title: `Sparkfare digest: deals from ${originCity(origin)}`,
      intro: `Recent editions of the daily flight-deal email for ${originCity(origin)} (${origin}).`,
      robots: 'noindex, follow',
      sections: rows.length ? `<ul>${rows.map(editionLink).join('')}</ul>` : '<p>No editions yet.</p>',
      appUrl,
    }));
  }

  const date = parts[2];
  const kind = parts[3] === 'weekly' && parts.length === 4 ? 'weekly' : (parts.length === 3 ? 'daily' : null);
  if (!DATE_RE.test(date) || !kind) return notFound();
  const row = await env.DB.prepare(
    'SELECT * FROM digest_editions WHERE origin = ? AND edition_date = ? AND kind = ?'
  ).bind(origin, date, kind).first();
  if (!row) return notFound();
  return htmlResponse(await renderEditionPage(row, { env, appUrl, now, buildConfig }));
}

export async function renderDigestSitemap(env, { appUrl = 'https://sparkfare.com' } = {}) {
  let weekly = [];
  if (archiveEnabled(env) && env?.DB) {
    weekly = (await env.DB.prepare(
      "SELECT origin, edition_date FROM digest_editions WHERE kind = 'weekly' ORDER BY edition_date DESC LIMIT 500"
    ).all()).results || [];
  }
  const urls = archiveEnabled(env)
    ? [`${appUrl}/digest`, ...weekly.map((r) => `${appUrl}/digest/${r.origin}/${r.edition_date}/weekly`)]
    : [];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `
  <url><loc>${u}</loc></url>`).join('')}
</urlset>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=3600' } });
}

