import { dealQuality, EMAIL_DEAL_QUALITY_OPTIONS } from '../dealQuality.js';
import {
  escapeHtml, airlineName, originCity, formatMoney, splitDestination, parseBookingLink, formatWindow,
  formatAsOf, formatEditionDate, isoDay, dayOfYear, addUtm, pickTip, dropFromWeekAgo,
} from './helpers.js';

export const DISCLOSURE_TEXT = 'Sparkfare may earn a commission on flights booked through links in this email, at no extra cost to you.';
export const MAX_DEALS = 6;

// Archive mode (no user) leaves these two comments in the HTML. The web archive swaps them for
// page chrome (robots meta, nav, signup form, stale-prices banner) when it serves an edition.
export const ARCHIVE_HEAD_MARKER = '<!--SF_HEAD-->';
export const ARCHIVE_BODY_MARKER = '<!--SF_BODY_TOP-->';

// Palette from sparkfare_style_guide.md. Links and buttons use a darker sage than the site's
// #4F7A52 because that value is only about 3.8:1 on Paper, below the 4.5:1 minimum for body text.
const LIGHT = { bg: '#EDE6D6', card: '#E3D9C4', line: '#DCD3BF', text: '#2B2620', muted: '#6B6255', link: '#3F6643', btn: '#3F6643', btnText: '#F7F2E7', gold: '#E8B930' };
const DARK = { bg: '#211F1A', card: '#2A2822', line: '#3A362C', text: '#EDE6D6', muted: '#B3A992', link: '#8DB890', btn: '#8DB890', btnText: '#211F1A' };

const FONT_HEAD = "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, Helvetica, sans-serif";
const FONT_BODY = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, Helvetica, sans-serif";
const FONT_NUM = "'IBM Plex Mono', ui-monospace, Menlo, Consolas, 'Courier New', monospace";

const CHIPS = { new: 'NEW', price_drop: 'PRICE DROP', still_available: 'STILL AVAILABLE' };

function prepareDeal(deal, { origin, now, destinations, linkForDeal }) {
  const price = Number(deal.price);
  const parsed = parseBookingLink(deal.booking_link);
  const { city, country } = splitDestination(deal.display_name);
  const observations = Array.isArray(deal.observations) ? deal.observations : [];
  const dq = dealQuality(observations, deal, now, EMAIL_DEAL_QUALITY_OPTIONS);

  // A comparison is shown only when dealQuality says this route has enough recent history to make
  // it fair. The percentage comes from dealQuality's own median baseline, not the feed's
  // mean-based pct_below_avg, so the "usual" price and the percentage always agree.
  let comparison = null;
  if (dq.eligible && deal.status !== 'featured' && dq.baseline > 0 && price > 0 && price < dq.baseline) {
    const pct = Math.round(((dq.baseline - price) / dq.baseline) * 100);
    if (pct >= 1) comparison = { pct, usual: Math.round(dq.baseline), n: dq.baselineN };
  }

  const dealOrigin = deal.origin || parsed?.origin || origin;
  const window = formatWindow(deal.departure_at, deal.return_at);
  const asOf = formatAsOf(deal.found_at) || (deal.last_fresh_date ? `${deal.last_fresh_date}` : null);
  const status = CHIPS[deal.email_status] ? deal.email_status : 'new';

  return {
    raw: deal,
    price,
    priceText: formatMoney(price),
    city,
    country,
    originIata: dealOrigin,
    routeText: parsed ? `${dealOrigin} → ${parsed.destination}` : null,
    comparison,
    window,
    airline: airlineName(deal.airline),
    asOf,
    status,
    bookingLink: (linkForDeal ? linkForDeal(deal, parsed) : deal.booking_link) || null,
    whyGo: destinations?.[deal.display_name] || null,
    weekDrop: dropFromWeekAgo(observations, price, deal.found_at),
  };
}

function orderDeals(list) {
  return [...list].sort((a, b) => {
    if (!!a.comparison !== !!b.comparison) return a.comparison ? -1 : 1;
    if (a.comparison && b.comparison && a.comparison.pct !== b.comparison.pct) return b.comparison.pct - a.comparison.pct;
    return a.price - b.price;
  });
}

function buildSubject({ hero, more, city, iata }) {
  const dest = hero.city;
  const moreText = more > 0 ? ` + ${more} more` : '';
  const pctText = hero.comparison ? ` (${hero.comparison.pct}% below usual)` : '';
  const build = (where, pct, tail) => `${dest} ${hero.priceText} from ${where}${pct}${tail}`;
  const attempts = [
    build(city, pctText, moreText),
    build(city, '', moreText),
    build(iata, pctText, moreText),
    build(iata, '', moreText),
    build(iata, '', ''),
  ];
  return attempts.find((s) => s.length <= 58) || attempts[attempts.length - 1];
}

function buildIntro(deals, city) {
  const n = deals.length;
  const withDrop = deals.filter((d) => d.weekDrop).sort((a, b) => b.weekDrop - a.weekDrop)[0];
  const head = `${n} fare${n === 1 ? '' : 's'} from ${city} made today's list.`;
  if (withDrop) return `${head} The biggest move: ${withDrop.city}, down $${withDrop.weekDrop} from a week ago.`;
  const lead = deals[0];
  return `${head} The lowest is ${lead.city} at ${lead.priceText}.`;
}

export function renderDailyDigest({ origin, deals = [], edition = null, user = null, now = new Date(), config = {} } = {}) {
  const isArchive = !user;
  const appUrl = config.appUrl || 'https://sparkfare.com';
  const campaign = isoDay(now);
  const utm = (url, content) => addUtm(url, { campaign, content });
  const city = originCity(origin);

  const prepared = orderDeals((deals || []).filter((d) => Number(d?.price) > 0).map((d) => prepareDeal(d, { origin, now, destinations: config.destinations, linkForDeal: config.linkForDeal })))
    .slice(0, MAX_DEALS);

  const editionLabel = Number.isFinite(Number(edition)) && edition !== null ? `Edition ${Number(edition)}` : null;
  const dateLabel = formatEditionDate(now);
  const hero = prepared[0] || null;
  const rest = prepared.slice(1);

  const subject = hero
    ? buildSubject({ hero, more: rest.length, city, iata: origin })
    : `Sparkfare deals from ${city}`;
  const preheader = hero
    ? `${hero.city} ${hero.priceText}${hero.comparison ? `, ${hero.comparison.pct}% below usual` : ''}${rest.length ? ` · plus ${rest.length} more from ${city}` : ` from ${city}`}`
    : `Today's fares from ${city}`;

  const tip = pickTip(config.tips, edition ?? dayOfYear(now));
  const intro = hero ? buildIntro(prepared, city) : null;

  const links = {
    prefs: utm(`${appUrl}/account`, 'footer_prefs'),
    signup: utm(`${appUrl}/`, 'archive_signup'),
    methodology: utm(`${appUrl}/blog/how-we-rank-deals`, 'methodology'),
    unsubscribe: !isArchive ? config.unsubscribeUrl || null : null,
    viewInBrowser: config.viewInBrowserUrl ? utm(config.viewInBrowserUrl, 'view_in_browser') : null,
    referral: !isArchive && config.referralUrl ? utm(config.referralUrl, 'referral') : null,
    watch: (d) => utm(`${appUrl}/watchlists?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(d.raw.display_name)}`, 'watch_route'),
  };

  const html = buildHtml({ subject, preheader, origin, city, dateLabel, editionLabel, intro, hero, rest, tip, links, config, isArchive, utm, appUrl });
  const text = buildText({ city, origin, dateLabel, editionLabel, intro, hero, rest, tip, links, config, isArchive, utm, appUrl });
  return { subject, preheader, html, text };
}

// ---------- HTML ----------

function chipHtml(status) {
  return `<span class="sf-muted sf-line" style="display:inline-block;border:1px solid ${LIGHT.line};border-radius:4px;padding:3px 8px;font-family:${FONT_BODY};font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.05em;color:${LIGHT.muted};">${CHIPS[status]}</span>`;
}

function goldBadgeHtml(pct) {
  return `<span style="display:inline-block;background:${LIGHT.gold};border-radius:4px;padding:3px 8px;font-family:${FONT_BODY};font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.05em;color:#2B2620;">${pct}% BELOW USUAL</span>`;
}

function buttonHtml(href, label) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td class="sf-btn" bgcolor="${LIGHT.btn}" style="background:${LIGHT.btn};border-radius:6px;">
    <a class="sf-btn-text" href="${escapeHtml(href)}" style="display:inline-block;padding:14px 22px;font-family:${FONT_BODY};font-size:16px;line-height:20px;font-weight:600;color:${LIGHT.btnText};text-decoration:none;">${escapeHtml(label)}</a>
  </td></tr></table>`;
}

function linkHtml(href, label, extra = '') {
  return `<a class="sf-link" href="${escapeHtml(href)}" style="color:${LIGHT.link};text-decoration:underline;${extra}">${escapeHtml(label)}</a>`;
}

function metaLines(d) {
  const lines = [];
  if (d.window) lines.push(`${d.window.text}${d.window.days ? ` · ${d.window.days} days` : ''}`);
  if (d.airline) lines.push(d.airline);
  return lines;
}

function heroCardHtml(d, links) {
  const meta = metaLines(d).map((l) => `<p class="sf-text" style="margin:0 0 4px;font-family:${FONT_BODY};font-size:16px;line-height:24px;color:${LIGHT.text};">${escapeHtml(l)}</p>`).join('');
  const cmp = d.comparison
    ? `<p class="sf-text" style="margin:0 0 4px;font-family:${FONT_BODY};font-size:16px;line-height:24px;color:${LIGHT.text};">Usually ~<span style="font-family:${FONT_NUM};">$${d.comparison.usual.toLocaleString('en-US')}</span> · ${d.comparison.pct}% below its 30-day median (N=${d.comparison.n})</p>`
    : '';
  const asOf = `<p class="sf-muted" style="margin:8px 0 16px;font-family:${FONT_BODY};font-size:14px;line-height:20px;color:${LIGHT.muted};">Price as of ${escapeHtml(d.asOf || 'the last check')}. Fares change fast.</p>`;
  const why = d.whyGo ? `<p class="sf-muted" style="margin:16px 0 0;font-family:${FONT_BODY};font-size:14px;line-height:20px;color:${LIGHT.muted};"><strong>Why go:</strong> ${escapeHtml(d.whyGo)}</p>` : '';
  const book = d.bookingLink ? buttonHtml(d.bookingLink, `See ${d.originIata} → ${d.city} fares`) : '';
  return `
  <tr><td style="padding:0 0 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="sf-card sf-line" bgcolor="${LIGHT.card}" style="background:${LIGHT.card};border:1px solid ${LIGHT.line};border-radius:8px;">
      <tr><td style="padding:20px;">
        <p style="margin:0 0 12px;">${chipHtml(d.status)}${d.comparison ? ` ${goldBadgeHtml(d.comparison.pct)}` : ''}</p>
        <h2 class="sf-text" style="margin:0;font-family:${FONT_HEAD};font-size:26px;line-height:32px;font-weight:500;color:${LIGHT.text};">${escapeHtml(d.city)}${d.country ? ` <span class="sf-muted" style="font-size:16px;color:${LIGHT.muted};">${escapeHtml(d.country)}</span>` : ''}</h2>
        ${d.routeText ? `<p class="sf-muted" style="margin:4px 0 8px;font-family:${FONT_NUM};font-size:14px;line-height:20px;color:${LIGHT.muted};">${escapeHtml(d.routeText)}</p>` : ''}
        <p class="sf-text" style="margin:0 0 8px;font-family:${FONT_NUM};font-size:40px;line-height:48px;font-weight:600;color:${LIGHT.text};">${escapeHtml(d.priceText)}</p>
        ${cmp}${meta}${asOf}
        ${book}
        <p style="margin:12px 0 0;font-family:${FONT_BODY};font-size:16px;line-height:24px;">${linkHtml(links.watch(d), 'Watch this route', 'display:inline-block;padding:10px 0;')}</p>
        ${why}
      </td></tr>
    </table>
  </td></tr>`;
}

function compactCardHtml(d, links) {
  const meta = metaLines(d).join(' · ');
  const cmp = d.comparison ? `${d.comparison.pct}% below its 30-day median (N=${d.comparison.n}) · usually ~$${d.comparison.usual.toLocaleString('en-US')}` : '';
  return `
  <tr><td style="padding:0 0 12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="sf-card sf-line" bgcolor="${LIGHT.card}" style="background:${LIGHT.card};border:1px solid ${LIGHT.line};border-radius:8px;">
      <tr><td style="padding:16px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td valign="top" style="padding:0 12px 0 0;">
            <p style="margin:0 0 6px;">${chipHtml(d.status)}${d.comparison ? ` ${goldBadgeHtml(d.comparison.pct)}` : ''}</p>
            <h3 class="sf-text" style="margin:0;font-family:${FONT_HEAD};font-size:20px;line-height:26px;font-weight:500;color:${LIGHT.text};">${escapeHtml(d.city)}${d.country ? ` <span class="sf-muted" style="font-size:16px;color:${LIGHT.muted};">${escapeHtml(d.country)}</span>` : ''}</h3>
            ${d.routeText ? `<p class="sf-muted" style="margin:2px 0 0;font-family:${FONT_NUM};font-size:14px;line-height:20px;color:${LIGHT.muted};">${escapeHtml(d.routeText)}</p>` : ''}
          </td>
          <td valign="top" align="right" class="sf-text" style="font-family:${FONT_NUM};font-size:26px;line-height:32px;font-weight:600;color:${LIGHT.text};white-space:nowrap;">${escapeHtml(d.priceText)}</td>
        </tr></table>
        ${meta ? `<p class="sf-text" style="margin:8px 0 0;font-family:${FONT_BODY};font-size:16px;line-height:24px;color:${LIGHT.text};">${escapeHtml(meta)}</p>` : ''}
        ${cmp ? `<p class="sf-text" style="margin:2px 0 0;font-family:${FONT_BODY};font-size:16px;line-height:24px;color:${LIGHT.text};">${escapeHtml(cmp)}</p>` : ''}
        <p class="sf-muted" style="margin:6px 0 0;font-family:${FONT_BODY};font-size:14px;line-height:20px;color:${LIGHT.muted};">Price as of ${escapeHtml(d.asOf || 'the last check')}.</p>
        ${d.whyGo ? `<p class="sf-muted" style="margin:6px 0 0;font-family:${FONT_BODY};font-size:14px;line-height:20px;color:${LIGHT.muted};"><strong>Why go:</strong> ${escapeHtml(d.whyGo)}</p>` : ''}
        <p style="margin:8px 0 0;font-family:${FONT_BODY};font-size:16px;line-height:20px;">
          ${d.bookingLink ? linkHtml(d.bookingLink, `See ${d.city} fares`, 'display:inline-block;padding:12px 16px 12px 0;') : ''}${linkHtml(links.watch(d), 'Watch this route', 'display:inline-block;padding:12px 0;')}
        </p>
      </td></tr>
    </table>
  </td></tr>`;
}

function sectionBox(inner) {
  return `<tr><td style="padding:0 0 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="sf-line" style="border:1px solid ${LIGHT.line};border-radius:8px;"><tr><td style="padding:16px 20px;">${inner}</td></tr></table>
  </td></tr>`;
}

function headingHtml(text) {
  return `<p class="sf-text" style="margin:0 0 6px;font-family:${FONT_HEAD};font-size:18px;line-height:24px;font-weight:500;color:${LIGHT.text};">${escapeHtml(text)}</p>`;
}

function bodyPara(inner, extra = '') {
  return `<p class="sf-text" style="margin:0;font-family:${FONT_BODY};font-size:16px;line-height:24px;color:${LIGHT.text};${extra}">${inner}</p>`;
}

function buildHtml({ subject, preheader, origin, city, dateLabel, editionLabel, intro, hero, rest, tip, links, config, isArchive, utm, appUrl }) {
  const logoBase = `${appUrl}/email-assets`;
  const filler = '&nbsp;&zwnj;'.repeat(60);
  const away = config.awayMode;
  const awayBlock = away
    ? sectionBox(`${headingHtml('Complete the trip')}${bodyPara(`<strong>${escapeHtml(away.name)}</strong> — ${escapeHtml(away.blurb)} ${linkHtml(utm(away.href, 'away_mode'), 'Learn more')}`)}`)
    : '';
  const tipBlock = tip
    ? sectionBox(`${headingHtml(`Fare tip: ${tip.title}`)}${bodyPara(escapeHtml(tip.body))}${tip.link ? `<p style="margin:8px 0 0;font-family:${FONT_BODY};font-size:16px;line-height:24px;">${linkHtml(utm(`${appUrl}${tip.link}`, 'fare_tip'), tip.linkText || 'Learn more')}</p>` : ''}`)
    : '';
  const referralBlock = links.referral
    ? sectionBox(`${headingHtml('Know someone who\'d like these?')}${bodyPara(`Friends who sign up through your link get the same daily fares. ${linkHtml(links.referral, 'Share your link')}`)}`)
    : '';
  const priceJump = config.priceJump
    ? sectionBox(bodyPara(`<strong>${escapeHtml(config.priceJump.destination)}</strong> moved from $${Number(config.priceJump.from).toLocaleString('en-US')} to $${Number(config.priceJump.to).toLocaleString('en-US')} since the 7am Early Bird send.`))
    : '';

  const footerLines = [
    isArchive ? `Get this in your inbox every morning: ${linkHtml(links.signup, 'sign up free')}` : `You follow deals from ${escapeHtml(city)} (${escapeHtml(origin)}).`,
    !isArchive ? `${linkHtml(links.prefs, 'Change airport or frequency')}` : null,
    links.viewInBrowser ? linkHtml(links.viewInBrowser, 'View in browser') : null,
    !isArchive && links.unsubscribe ? linkHtml(links.unsubscribe, 'Unsubscribe') : null,
    config.postalAddress ? escapeHtml(config.postalAddress) : null,
  ].filter(Boolean).map((l) => `<p class="sf-muted" style="margin:0 0 8px;font-family:${FONT_BODY};font-size:14px;line-height:20px;color:${LIGHT.muted};">${l}</p>`).join('');

  const cards = hero ? heroCardHtml(hero, links) + rest.map((d) => compactCardHtml(d, links)).join('') : '';
  const empty = hero ? '' : `<tr><td style="padding:0 0 16px;">${bodyPara(`No new fares from ${escapeHtml(city)} made today's list.`)}</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(subject)}</title>
${isArchive ? ARCHIVE_HEAD_MARKER : ''}
<style>
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  .sf-logo-dark { display: none; }
  @media (prefers-color-scheme: dark) {
    .sf-bg { background: ${DARK.bg} !important; }
    .sf-card { background: ${DARK.card} !important; }
    .sf-line { border-color: ${DARK.line} !important; }
    .sf-text { color: ${DARK.text} !important; }
    .sf-muted { color: ${DARK.muted} !important; }
    .sf-link { color: ${DARK.link} !important; }
    .sf-btn { background: ${DARK.btn} !important; }
    .sf-btn-text { color: ${DARK.btnText} !important; }
    .sf-logo-light { display: none !important; }
    .sf-logo-dark { display: inline-block !important; }
  }
  @media only screen and (max-width: 620px) { .sf-wrap { width: 100% !important; } }
</style>
</head>
<body class="sf-bg" style="margin:0;padding:0;background:${LIGHT.bg};">
${isArchive ? ARCHIVE_BODY_MARKER : ''}
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${LIGHT.bg};opacity:0;">${escapeHtml(preheader)}${filler}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="sf-bg" bgcolor="${LIGHT.bg}" style="background:${LIGHT.bg};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" class="sf-wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
  <tr><td style="padding:0 0 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td valign="middle" style="font-family:${FONT_HEAD};font-size:20px;line-height:28px;font-weight:500;">
        <img class="sf-logo-light" src="${logoBase}/sparkfare-mark-light.png" width="28" height="28" alt="" style="vertical-align:middle;border:0;">
        <img class="sf-logo-dark" src="${logoBase}/sparkfare-mark-dark.png" width="28" height="28" alt="" style="vertical-align:middle;border:0;display:none;">
        <span class="sf-text" style="vertical-align:middle;color:${LIGHT.text};">&nbsp;Sparkfare</span>
      </td>
      <td valign="middle" align="right" class="sf-muted" style="font-family:${FONT_BODY};font-size:14px;line-height:20px;color:${LIGHT.muted};">${escapeHtml(city)} (${escapeHtml(origin)}) · ${escapeHtml(dateLabel)}${editionLabel ? ` · ${escapeHtml(editionLabel)}` : ''}</td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:0 0 16px;">
    <p class="sf-muted" style="margin:0;font-family:${FONT_BODY};font-size:14px;line-height:20px;color:${LIGHT.muted};font-style:italic;">${escapeHtml(DISCLOSURE_TEXT)}</p>
  </td></tr>
  ${intro ? `<tr><td style="padding:0 0 16px;">${bodyPara(escapeHtml(intro))}</td></tr>` : ''}
  ${priceJump}
  ${cards}${empty}
  ${awayBlock}
  ${tipBlock}
  ${referralBlock}
  <tr><td style="padding:8px 0 0;border-top:1px solid ${LIGHT.line};" class="sf-line">
    <p class="sf-muted" style="margin:16px 0 8px;font-family:${FONT_BODY};font-size:14px;line-height:20px;color:${LIGHT.muted};">How we decide what counts as a deal: ${linkHtml(links.methodology, 'read the methodology')}.</p>
    ${footerLines}
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

// ---------- Plain text ----------

function buildText({ city, origin, dateLabel, editionLabel, intro, hero, rest, tip, links, config, isArchive, utm, appUrl }) {
  const out = [];
  out.push(`SPARKFARE — ${city} (${origin}) · ${dateLabel}${editionLabel ? ` · ${editionLabel}` : ''}`);
  out.push('');
  out.push(DISCLOSURE_TEXT);
  out.push('');
  if (intro) { out.push(intro); out.push(''); }
  if (config.priceJump) {
    out.push(`${config.priceJump.destination} moved from $${Number(config.priceJump.from).toLocaleString('en-US')} to $${Number(config.priceJump.to).toLocaleString('en-US')} since the 7am Early Bird send.`);
    out.push('');
  }
  const deals = hero ? [hero, ...rest] : [];
  if (!hero) { out.push(`No new fares from ${city} made today's list.`); out.push(''); }
  for (const d of deals) {
    out.push(`${CHIPS[d.status]} — ${d.city}${d.country ? `, ${d.country}` : ''}  ${d.priceText}${d.routeText ? `  (${d.routeText})` : ''}`);
    if (d.comparison) out.push(`Usually ~$${d.comparison.usual.toLocaleString('en-US')} · ${d.comparison.pct}% below its 30-day median (N=${d.comparison.n})`);
    if (d.window) out.push(`${d.window.text}${d.window.days ? ` · ${d.window.days} days` : ''}`);
    if (d.airline) out.push(d.airline);
    out.push(`Price as of ${d.asOf || 'the last check'}. Fares change fast.`);
    if (d.whyGo) out.push(`Why go: ${d.whyGo}`);
    if (d.bookingLink) out.push(`See fares: ${d.bookingLink}`);
    out.push(`Watch this route: ${links.watch(d)}`);
    out.push('');
  }
  if (config.awayMode) {
    out.push(`COMPLETE THE TRIP — ${config.awayMode.name}: ${config.awayMode.blurb}`);
    out.push(utm(config.awayMode.href, 'away_mode'));
    out.push('');
  }
  if (tip) {
    out.push(`FARE TIP — ${tip.title}`);
    out.push(tip.body);
    if (tip.link) out.push(utm(`${appUrl}${tip.link}`, 'fare_tip'));
    out.push('');
  }
  if (links.referral) { out.push(`Share Sparkfare with a friend: ${links.referral}`); out.push(''); }
  out.push(`How we decide what counts as a deal: ${links.methodology}`);
  out.push('');
  if (isArchive) out.push(`Get this in your inbox every morning: ${links.signup}`);
  else {
    out.push(`You follow deals from ${city} (${origin}).`);
    out.push(`Change airport or frequency: ${links.prefs}`);
  }
  if (links.viewInBrowser) out.push(`View in browser: ${links.viewInBrowser}`);
  if (!isArchive && links.unsubscribe) out.push(`Unsubscribe: ${links.unsubscribe}`);
  if (config.postalAddress) out.push(config.postalAddress);
  return out.join('\n');
}
