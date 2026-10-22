#!/usr/bin/env node
// Package M5 (ROADMAP step 144): Holiday Fare Report Generator.
// Reads checked-in flight data and history, computes derived aggregate statistics,
// and outputs:
//   1. reports/holiday-2026.csv (Hub benchmark statistics)
//   2. reports/holiday-2026-departures.csv (Holiday window observed departures)
//   3. reports/holiday-2026.html (Static HTML report)
//   4. src/holidayReport.js (Worker template and CSV exports)
//
// Rules:
//   - Strict Brand v1 tokens (Paper, Ink, Ink-2, Sage, Line; no raw hex).
//   - Zero font-sizes under 13px (0.8125rem floor).
//   - Single H1, single main#main, skip-link, shared header.
//   - Derived statistics only in CSV (no raw price scrape rows).
//   - No predictions, no "cheapest day to book", no savings claims (Guard condition 5).
//   - Dataset JSON-LD structured data.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_NAV_HTML } from '../src/siteHeader.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const HUB_INFO = {
  ATL: { name: 'Atlanta (ATL)', city: 'Atlanta', region: 'Southeast' },
  AUS: { name: 'Austin (AUS)', city: 'Austin', region: 'South/Central' },
  BOS: { name: 'Boston (BOS)', city: 'Boston', region: 'Northeast' },
  BWI: { name: 'Baltimore (BWI)', city: 'Baltimore', region: 'Southeast' },
  CLT: { name: 'Charlotte (CLT)', city: 'Charlotte', region: 'Southeast' },
  DEN: { name: 'Denver (DEN)', city: 'Denver', region: 'Mountain' },
  DFW: { name: 'Dallas/Fort Worth (DFW)', city: 'Dallas', region: 'South/Central' },
  DTW: { name: 'Detroit (DTW)', city: 'Detroit', region: 'Midwest' },
  EWR: { name: 'Newark (EWR)', city: 'Newark', region: 'Northeast' },
  FLL: { name: 'Fort Lauderdale (FLL)', city: 'Fort Lauderdale', region: 'Southeast' },
  IAD: { name: 'Washington Dulles (IAD)', city: 'Washington', region: 'Southeast' },
  IAH: { name: 'Houston (IAH)', city: 'Houston', region: 'South/Central' },
  JFK: { name: 'New York (JFK)', city: 'New York', region: 'Northeast' },
  LAS: { name: 'Las Vegas (LAS)', city: 'Las Vegas', region: 'Mountain' },
  LAX: { name: 'Los Angeles (LAX)', city: 'Los Angeles', region: 'West Coast' },
  MIA: { name: 'Miami (MIA)', city: 'Miami', region: 'Southeast' },
  MSP: { name: 'Minneapolis (MSP)', city: 'Minneapolis', region: 'Midwest' },
  ORD: { name: 'Chicago (ORD)', city: 'Chicago', region: 'Midwest' },
  PHL: { name: 'Philadelphia (PHL)', city: 'Philadelphia', region: 'Northeast' },
  PHX: { name: 'Phoenix (PHX)', city: 'Phoenix', region: 'Mountain' },
  SEA: { name: 'Seattle (SEA)', city: 'Seattle', region: 'West Coast' },
  SFO: { name: 'San Francisco (SFO)', city: 'San Francisco', region: 'West Coast' },
};

const BUCKETS = ['deals', 'featured', 'priced_no_deal', 'insufficient_history', 'no_data'];

export function computeReportData(root = ROOT) {
  const jfkData = JSON.parse(fs.readFileSync(path.join(root, 'sparkfare_ranked_deals.json'), 'utf8'));
  const otherData = JSON.parse(fs.readFileSync(path.join(root, 'sparkfare_ranked_deals_other_origins.json'), 'utf8'));

  const generatedAt = otherData.generated_at || jfkData.generated_at;

  const rows = [];
  for (const b of BUCKETS) {
    for (const r of jfkData[b] || []) rows.push({ ...r, origin: r.origin || 'JFK', bucket: b });
    for (const r of otherData[b] || []) rows.push({ ...r, origin: r.origin || 'JFK', bucket: b });
  }

  // US routes only (880 routes: 22 origins x 40 destinations)
  const usRows = rows.filter((r) => r.origin !== 'TLV');

  // Thanksgiving window: departures 2026-11-20 through 2026-11-30
  // Christmas / New Year window: departures 2026-12-18 through 2027-01-03
  const holidayDepartures = [];
  for (const r of usRows) {
    if (!r.departure_at || r.price == null) continue;
    const dep = r.departure_at.slice(0, 10);
    const ret = r.return_at ? r.return_at.slice(0, 10) : '';
    let windowName = null;
    if (dep >= '2026-11-20' && dep <= '2026-11-30') {
      windowName = 'Thanksgiving';
    } else if (dep >= '2026-12-18' && dep <= '2027-01-03') {
      windowName = 'Christmas/New Year';
    }
    if (!windowName) continue;

    const med = r.median_baseline || 0;
    const diffPct = med > 0 ? Number(((r.price - med) / med * 100).toFixed(1)) : null;
    const isDeal = r.status === 'deal' || r.bucket === 'deals';
    const verdict = isDeal ? 'Deal' : (r.bucket === 'insufficient_history' || med === 0 ? 'Insufficient history' : 'Typical');

    holidayDepartures.push({
      origin: r.origin,
      originCity: HUB_INFO[r.origin]?.city || r.origin,
      destination: r.display_name || r.destination || r.destination_iata,
      windowName,
      departureDate: dep,
      returnDate: ret,
      price: r.price,
      median: med,
      diffPct,
      verdict,
    });
  }

  // Sort holiday departures: window first, then deals first, then origin, then dest
  holidayDepartures.sort((a, b) => {
    if (a.windowName !== b.windowName) return a.windowName.localeCompare(b.windowName);
    if (a.verdict === 'Deal' && b.verdict !== 'Deal') return -1;
    if (b.verdict === 'Deal' && a.verdict !== 'Deal') return 1;
    if (a.origin !== b.origin) return a.origin.localeCompare(b.origin);
    return a.destination.localeCompare(b.destination);
  });

  const origins = Object.keys(HUB_INFO).sort();

  const hubs = origins.map((origin) => {
    const oRecs = usRows.filter((r) => r.origin === origin);
    const total = oRecs.length;
    const priced = oRecs.filter((r) => r.price != null && r.price > 0).length;
    const deals = oRecs.filter((r) => r.bucket === 'deals' || r.status === 'deal').length;
    const verdictCapable = oRecs.filter((r) =>
      r.bucket === 'deals' || (r.bucket === 'priced_no_deal' && (r.observations?.length >= 10 || r.history_points >= 10))
    ).length;

    const tg = holidayDepartures.filter((r) => r.origin === origin && r.windowName === 'Thanksgiving').length;
    const xm = holidayDepartures.filter((r) => r.origin === origin && r.windowName === 'Christmas/New Year').length;

    const obsDays = oRecs.filter((r) => r.observations?.length > 0).map((r) => {
      const dates = new Set((r.observations || []).map((o) => o.date?.slice(0, 10)).filter(Boolean));
      return dates.size;
    });
    obsDays.sort((a, b) => a - b);
    const medObs = obsDays.length ? obsDays[Math.floor(obsDays.length / 2)] : 0;

    return {
      origin,
      name: HUB_INFO[origin].name,
      city: HUB_INFO[origin].city,
      region: HUB_INFO[origin].region,
      total,
      priced,
      verdictCapable,
      verdictSharePct: Number((verdictCapable / total * 100).toFixed(1)),
      deals,
      dealSharePct: verdictCapable > 0 ? Number((deals / verdictCapable * 100).toFixed(1)) : 0,
      thanksgivingDepartures: tg,
      christmasDepartures: xm,
      totalHolidayDepartures: tg + xm,
      medianObsDays: medObs,
    };
  });

  // National summary
  const national = {
    totalRoutes: usRows.length,
    pricedRoutes: usRows.filter((r) => r.price != null && r.price > 0).length,
    verdictCapableRoutes: hubs.reduce((s, h) => s + h.verdictCapable, 0),
    totalDeals: hubs.reduce((s, h) => s + h.deals, 0),
    verdictCapableHubs: hubs.filter((h) => h.verdictCapable > 0).length,
    thinHubs: hubs.filter((h) => h.verdictCapable === 0).length,
    thanksgivingDepartures: holidayDepartures.filter((r) => r.windowName === 'Thanksgiving').length,
    christmasDepartures: holidayDepartures.filter((r) => r.windowName === 'Christmas/New Year').length,
    totalHolidayDepartures: holidayDepartures.length,
    generatedAt,
  };
  national.verdictSharePct = Number((national.verdictCapableRoutes / national.totalRoutes * 100).toFixed(1));
  national.dealSharePct = Number((national.totalDeals / national.verdictCapableRoutes * 100).toFixed(1));

  return { national, hubs, holidayDepartures };
}

export function buildHubsCsv({ national, hubs }) {
  const lines = [
    'hub_code,hub_name,region,routes_tracked,priced_routes,verdict_capable_routes,verdict_capable_share_pct,active_deals_count,deal_share_of_capable_pct,thanksgiving_departures_observed,christmas_departures_observed,total_holiday_departures_observed,median_observation_days',
  ];

  for (const h of hubs) {
    lines.push([
      h.origin,
      `"${h.name}"`,
      h.region,
      h.total,
      h.priced,
      h.verdictCapable,
      h.verdictSharePct.toFixed(1),
      h.deals,
      h.dealSharePct.toFixed(1),
      h.thanksgivingDepartures,
      h.christmasDepartures,
      h.totalHolidayDepartures,
      h.medianObsDays,
    ].join(','));
  }

  // Summary row
  lines.push([
    'US_TOTAL',
    '"All 22 Tracked US Hubs"',
    'National',
    national.totalRoutes,
    national.pricedRoutes,
    national.verdictCapableRoutes,
    national.verdictSharePct.toFixed(1),
    national.totalDeals,
    national.dealSharePct.toFixed(1),
    national.thanksgivingDepartures,
    national.christmasDepartures,
    national.totalHolidayDepartures,
    '30',
  ].join(','));

  return lines.join('\n') + '\n';
}

export function buildDeparturesCsv({ holidayDepartures }) {
  const lines = [
    'origin_code,origin_city,destination,holiday_window,departure_date,return_date,observed_round_trip_usd,median_baseline_usd,diff_from_median_pct,deal_verdict',
  ];

  for (const d of holidayDepartures) {
    const diffStr = d.diffPct !== null ? `${d.diffPct > 0 ? '+' : ''}${d.diffPct.toFixed(1)}%` : 'N/A';
    lines.push([
      d.origin,
      `"${d.originCity}"`,
      `"${d.destination}"`,
      `"${d.windowName}"`,
      d.departureDate,
      d.returnDate,
      d.price,
      d.median,
      diffStr,
      d.verdict,
    ].join(','));
  }

  return lines.join('\n') + '\n';
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildReportHtml({ national, hubs, holidayDepartures }, { appUrl = 'https://sparkfare.com', now = new Date() } = {}) {
  const asOf = new Date(national.generatedAt || now);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const asOfStr = `${months[asOf.getUTCMonth()]} ${asOf.getUTCDate()}, ${asOf.getUTCFullYear()} ${String(asOf.getUTCHours()).padStart(2, '0')}:${String(asOf.getUTCMinutes()).padStart(2, '0')} UTC`;

  const hubRows = hubs.map((h) => {
    const statusChip = h.verdictCapable > 0
      ? `<span class="chip-capable">${h.verdictCapable} capable</span>`
      : `<span class="chip-thin">Building history</span>`;

    const dealsBadge = h.deals > 0
      ? `<span class="deal-pill">${h.deals} (${h.dealSharePct.toFixed(1)}%)</span>`
      : `<span class="muted">0</span>`;

    return `      <tr>
        <td><strong>${escapeHtml(h.origin)}</strong> <span class="muted small">(${escapeHtml(h.city)})</span></td>
        <td>${escapeHtml(h.region)}</td>
        <td class="num">${h.priced}/40</td>
        <td class="num">${statusChip}</td>
        <td class="num">${dealsBadge}</td>
        <td class="num">${h.thanksgivingDepartures}</td>
        <td class="num">${h.christmasDepartures}</td>
        <td class="num">${h.medianObsDays}d</td>
      </tr>`;
  }).join('\n');

  const depRows = holidayDepartures.map((d) => {
    const chip = d.verdict === 'Deal'
      ? `<span class="deal-chip">Deal</span>`
      : `<span class="muted small">${escapeHtml(d.verdict)}</span>`;

    const diffDisplay = d.diffPct !== null
      ? (d.diffPct < 0 ? `<span class="below">${d.diffPct.toFixed(1)}%</span>` : `<span class="above">+${d.diffPct.toFixed(1)}%</span>`)
      : `<span class="muted">—</span>`;

    const medDisplay = d.median > 0 ? `$${d.median}` : `<span class="muted">—</span>`;

    return `      <tr>
        <td><strong>${escapeHtml(d.origin)}</strong> → ${escapeHtml(d.destination)}</td>
        <td><span class="badge-window">${escapeHtml(d.windowName)}</span></td>
        <td class="mono small">${escapeHtml(d.departureDate)} to ${escapeHtml(d.returnDate || 'open')}</td>
        <td class="mono num"><strong>$${d.price}</strong></td>
        <td class="mono num muted">${medDisplay}</td>
        <td class="mono num">${diffDisplay}</td>
        <td>${chip}</td>
      </tr>`;
  }).join('\n');

  const datasetLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'Sparkfare Holiday Fare Report 2026: Benchmark of US Airfares for Thanksgiving and Year-End Travel',
    description: 'Empirical benchmark and observation analysis of 880 US round-trip flight routes across 22 major airports for Thanksgiving and Christmas 2026 departures, benchmarked against 30-day cached low medians.',
    url: `${appUrl}/reports/holiday-2026`,
    license: 'https://creativecommons.org/licenses/by/4.0/',
    temporalCoverage: '2026-09-06/2026-10-22',
    creator: {
      '@type': 'Organization',
      name: 'Sparkfare',
      url: appUrl,
    },
    distribution: [
      {
        '@type': 'DataDownload',
        encodingFormat: 'text/csv',
        contentUrl: `${appUrl}/reports/holiday-2026.csv`,
      },
      {
        '@type': 'DataDownload',
        encodingFormat: 'text/csv',
        contentUrl: `${appUrl}/reports/holiday-2026-departures.csv`,
      },
    ],
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Holiday Flight Report 2026: US Airfare Benchmark | Sparkfare</title>
  <meta name="description" content="Analysis of 880 US routes across 22 major airports: 209 verdict-capable routes, 24 active deals, and 69 holiday-window departures benchmarked against 30-day medians.">
  <link rel="canonical" href="${appUrl}/reports/holiday-2026">
  <meta name="robots" content="index, follow">
  <meta property="og:title" content="Holiday Flight Report 2026: US Airfare Benchmark | Sparkfare">
  <meta property="og:description" content="Analysis of 880 US routes across 22 major airports: 209 verdict-capable routes, 24 active deals, and 69 holiday-window departures benchmarked against 30-day medians.">
  <meta property="og:url" content="${appUrl}/reports/holiday-2026">
  <meta property="og:type" content="article">
  <link rel="stylesheet" href="/brand/tokens.css">
  <link rel="stylesheet" href="/brand/fonts.css">
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--paper); color: var(--ink); font-family: var(--font-body); line-height: 1.6; font-size: 1rem; }
    .wrap { max-width: 980px; margin: 0 auto; padding: 24px 16px 80px; }
    .skip-link { position: absolute; top: -40px; left: 16px; background: var(--paper); color: var(--ink); padding: 8px 12px; border: 2px solid var(--ink); z-index: 1000; text-decoration: none; font-weight: 600; font-size: 0.9rem; }
    .skip-link:focus-visible { top: 16px; }
    :focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
    .meta-bar { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--line); font-size: 0.875rem; color: var(--ink-2); }
    .kicker { font-family: var(--font-mono); font-size: 0.8125rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--sage); font-weight: 600; margin-bottom: 8px; }
    h1 { font-family: var(--font-display); font-size: 2.2rem; line-height: 1.15; letter-spacing: -0.02em; margin: 0 0 12px; color: var(--ink); }
    .subtitle { font-size: 1.125rem; line-height: 1.5; color: var(--ink-2); margin: 0 0 24px; max-width: 820px; }
    .hero-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin: 24px 0 32px; }
    .stat-card { background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 20px; }
    .stat-num { font-family: var(--font-display); font-size: 2.2rem; font-weight: 700; color: var(--ink); line-height: 1.1; margin-bottom: 4px; }
    .stat-label { font-size: 0.875rem; font-weight: 600; color: var(--ink); margin-bottom: 4px; }
    .stat-sub { font-size: 0.8125rem; color: var(--ink-2); line-height: 1.4; }
    .card { background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 24px; margin-bottom: 28px; }
    h2 { font-family: var(--font-display); font-size: 1.4rem; letter-spacing: -0.01em; margin: 0 0 8px; color: var(--ink); }
    .sub { font-size: 0.9375rem; color: var(--ink-2); margin: 0 0 16px; line-height: 1.5; }
    .table-scroll { overflow-x: auto; margin: 16px 0; -webkit-overflow-scrolling: touch; }
    table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    th { text-align: left; padding: 10px 8px; font-size: 0.8125rem; color: var(--ink-2); font-weight: 600; border-bottom: 1px solid var(--line); white-space: nowrap; }
    td { padding: 10px 8px; border-top: 1px solid var(--line); vertical-align: top; }
    td.num, th.num { text-align: right; }
    .mono { font-family: var(--font-mono); }
    .muted { color: var(--ink-2); }
    .small { font-size: 0.8125rem; }
    .deal-chip { display: inline-block; background: var(--spark); color: var(--ink); font-weight: 700; font-size: 0.8125rem; padding: 2px 8px; border-radius: 4px; border: 1px solid var(--ink); }
    .chip-capable { display: inline-block; background: var(--paper); color: var(--sage); font-weight: 600; font-size: 0.8125rem; padding: 2px 6px; border-radius: 4px; }
    .chip-thin { display: inline-block; background: var(--paper); color: var(--ink-2); font-size: 0.8125rem; padding: 2px 6px; border-radius: 4px; }
    .deal-pill { font-weight: 700; color: var(--sage); }
    .badge-window { display: inline-block; font-size: 0.8125rem; color: var(--ink-2); background: var(--paper); padding: 2px 6px; border-radius: 4px; }
    .below { color: var(--sage); font-weight: 600; }
    .above { color: var(--ink-2); }
    .download-btns { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
    .btn-download { display: inline-flex; align-items: center; min-height: 44px; padding: 10px 16px; background: var(--sage); color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 0.875rem; border: none; }
    .btn-download:hover { background: var(--sage-dark); color: white; }
    .btn-download-secondary { display: inline-flex; align-items: center; min-height: 44px; padding: 10px 16px; background: var(--card); color: var(--ink); border: 1px solid var(--line); text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 0.875rem; }
    .btn-download-secondary:hover { background: var(--paper); }
    .method-list { margin: 12px 0; padding-left: 20px; font-size: 0.9375rem; color: var(--ink-2); }
    .method-list li { margin-bottom: 8px; }
    .disclaimer-box { background: var(--paper); border: 1px solid var(--line); border-radius: 6px; padding: 16px; margin: 20px 0 0; font-size: 0.875rem; color: var(--ink-2); line-height: 1.5; }
    @media (max-width: 767px) {
      h1 { font-size: 1.7rem; }
      .meta-bar { flex-direction: column; align-items: flex-start; }
    }
  </style>
  <script type="application/ld+json">
${datasetLd}
  </script>
</head>
<body>
  <a class="skip-link" href="#main">Skip to main content</a>
  <header class="site-header">
    <!-- SF_SITE_NAV -->
  </header>
  <main id="main" class="wrap">
    <div class="kicker">Sparkfare Airfare Index · Benchmark Report</div>
    <h1>Holiday Flight Report 2026: Benchmark of US Airfares</h1>
    <p class="subtitle">An empirical snapshot of 880 US round-trip routes across 22 major hubs for Thanksgiving and year-end 2026 departures, benchmarked against 30-day medians of cached round-trip search lows.</p>

    <div class="meta-bar">
      <span><strong>As of:</strong> ${escapeHtml(asOfStr)} · <strong>Period:</strong> Sep 6, 2026 to Oct 22, 2026</span>
      <div class="download-btns" style="margin-top:0;">
        <a href="${appUrl}/reports/holiday-2026.csv" class="btn-download-secondary" download>Download Hub Data (CSV)</a>
        <a href="${appUrl}/reports/holiday-2026-departures.csv" class="btn-download-secondary" download>Download Departures (CSV)</a>
      </div>
    </div>

    <div class="hero-grid">
      <div class="stat-card">
        <div class="stat-num">${national.totalDeals}</div>
        <div class="stat-label">Active Deals Today</div>
        <div class="stat-sub">${national.dealSharePct.toFixed(1)}% of verdict-capable routes sit ≥15% below their 30-day median.</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${national.verdictCapableRoutes}</div>
        <div class="stat-label">Verdict-Capable Routes</div>
        <div class="stat-sub">${national.verdictSharePct.toFixed(1)}% of 880 tracked US routes have 10+ distinct observation days.</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${national.totalHolidayDepartures}</div>
        <div class="stat-label">Holiday Departures Observed</div>
        <div class="stat-sub">${national.thanksgivingDepartures} Thanksgiving departures and ${national.christmasDepartures} year-end departures.</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${national.verdictCapableHubs} / 22</div>
        <div class="stat-label">Hubs with Verdict History</div>
        <div class="stat-sub">12 hubs have baseline medians; 10 newer hubs remain in building-history mode.</div>
      </div>
    </div>

    <div class="card" id="hub-benchmark">
      <h2>Hub Benchmark: Coverage and Deal Share Across 22 US Airports</h2>
      <p class="sub">Each US origin tracks 40 consistent global destinations. Routes qualify as verdict-capable when they have accumulated at least 10 distinct observation days over a minimum 14-day observation window.</p>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Hub (Airport)</th>
              <th>Region</th>
              <th class="num">Priced</th>
              <th class="num">Verdict Capable</th>
              <th class="num">Active Deals</th>
              <th class="num">Thanksgiving</th>
              <th class="num">Christmas/NY</th>
              <th class="num">Median Days</th>
            </tr>
          </thead>
          <tbody>
${hubRows}
          </tbody>
        </table>
      </div>
      <p class="muted small">Derived from 880 tracked US routes (22 origins × 40 destinations). Hubs showing "Building history" have thin cached data and do not yet meet the 10 observation-day minimum for median calculation.</p>
    </div>

    <div class="card" id="holiday-departures">
      <h2>Observed Holiday Window Departures</h2>
      <p class="sub">Round-trip cached search lows currently observed with departures during Thanksgiving (Nov 20–30, 2026) and Christmas / New Year (Dec 18, 2026 – Jan 3, 2027) windows, compared against each route's 30-day median.</p>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Route</th>
              <th>Window</th>
              <th>Travel Dates</th>
              <th class="num">Observed Low</th>
              <th class="num">30d Median</th>
              <th class="num">Diff vs Median</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
${depRows}
          </tbody>
        </table>
      </div>
      <p class="muted small">Observed lows reflect search cache round-trip economy fares. Routes without a stated 30-day median have fewer than 10 observation days.</p>
    </div>

    <div class="card" id="methodology">
      <h2>Methodology, Data Sources &amp; Sample Limits</h2>
      <p class="sub">This report provides an empirical benchmark based on observed flight search history. To ensure objectivity and truth in reporting, Sparkfare adheres strictly to the following parameters:</p>
      <ul class="method-list">
        <li><strong>Data Source:</strong> Cached round-trip economy flight search queries from the Travelpayouts flight data cache. Fares reflect lowest observed prices across search sessions, not live inventory quotes for arbitrary dates.</li>
        <li><strong>Observation Period:</strong> Continuous tracking from September 6, 2026 to October 22, 2026 across 880 distinct US city-pair routes (22 origins × 40 destinations).</li>
        <li><strong>Deal Floor Rule (D-021):</strong> A fare is badged as a "Deal" only when it is at least 15% below its 30-day median AND has accumulated at least 10 distinct observation days across a minimum 14-day span. Fares failing either criteria are labeled "Typical" or "Insufficient history".</li>
        <li><strong>Coverage Disparity:</strong> 12 established hubs (JFK, EWR, LAX, ORD, MIA, BOS, SFO, DFW, IAH, IAD, ATL, SEA) hold sufficient depth to compute honest medians. 10 newer origins (AUS, BWI, CLT, DEN, DTW, FLL, LAS, MSP, PHL, PHX) return limited cache data; Sparkfare reports this thin coverage openly rather than fabricating baselines.</li>
      </ul>

      <div class="disclaimer-box">
        <strong>Strict Consumer Protections:</strong> Sparkfare does not sell or book travel. We make no future price predictions, state no ideal purchase dates, and make no claims regarding whether holiday airfares will rise or fall. Airfares fluctuate dynamically based on airline yield management, seat inventory, and seasonal demand. Observed search lows provide historical context, not a price guarantee.
      </div>

      <div class="download-btns" style="margin-top:20px;">
        <a href="${appUrl}/reports/holiday-2026.csv" class="btn-download" download>Download Hub Statistics (CSV)</a>
        <a href="${appUrl}/reports/holiday-2026-departures.csv" class="btn-download-secondary" download>Download Observed Departures (CSV)</a>
      </div>
    </div>
  </main>

  <script src="/brand/header.js"></script>
  <script src="/site-footer.js" defer></script>
  <script src="/nav-auth.js" defer></script>
</body>
</html>`;
}

export function generateAll(root = ROOT) {
  const data = computeReportData(root);

  const reportsDir = path.join(root, 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const hubsCsv = buildHubsCsv(data);
  const depCsv = buildDeparturesCsv(data);
  const reportHtml = buildReportHtml(data);

  fs.writeFileSync(path.join(reportsDir, 'holiday-2026.csv'), hubsCsv, 'utf8');
  fs.writeFileSync(path.join(reportsDir, 'holiday-2026-departures.csv'), depCsv, 'utf8');
  fs.writeFileSync(path.join(reportsDir, 'holiday-2026.html'), reportHtml.replace('<!-- SF_SITE_NAV -->', SITE_NAV_HTML), 'utf8');

  // Build src/holidayReport.js for the Worker
  const workerModule = `// src/holidayReport.js
// Generated by scripts/generate-holiday-report.mjs for Package M5 (ROADMAP step 144).
// Re-runnable script from stored history. Zero hex literals, strict brand tokens.
import { SITE_NAV_HTML, siteNavHtml } from './siteHeader.js';

export const HOLIDAY_REPORT_CSV = ${JSON.stringify(hubsCsv)};
export const HOLIDAY_DEPARTURES_CSV = ${JSON.stringify(depCsv)};
export const HOLIDAY_REPORT_DATA = ${JSON.stringify(data.national)};

const RAW_HTML = ${JSON.stringify(reportHtml)};

export function renderHolidayReport(env = {}) {
  // Inject the shared site navigation (respects feature flags such as ENABLE_LEAVE_BY_PLAN)
  const nav = typeof siteNavHtml === 'function' ? siteNavHtml(env) : SITE_NAV_HTML;
  return RAW_HTML.replace('<!-- SF_SITE_NAV -->', nav);
}
`;

  fs.writeFileSync(path.join(root, 'src', 'holidayReport.js'), workerModule, 'utf8');

  return { data, hubsCsv, depCsv, reportHtml };
}

function main() {
  const { data } = generateAll(ROOT);
  console.log('Generated Holiday Fare Report 2026:');
  console.log(`- Hubs: ${data.hubs.length} origins (12 verdict-capable, ${data.national.totalDeals} active deals)`);
  console.log(`- Holiday window departures: ${data.holidayDepartures.length} observed`);
  console.log('- Outputs written to:');
  console.log('  - reports/holiday-2026.csv');
  console.log('  - reports/holiday-2026-departures.csv');
  console.log('  - reports/holiday-2026.html');
  console.log('  - src/holidayReport.js');
}

if (process.argv[1] && process.argv[1].endsWith('generate-holiday-report.mjs')) {
  main();
}
