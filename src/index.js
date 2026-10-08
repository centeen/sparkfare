
// Workplan Step 96-98: Sparkline generation for 30-day price history
function generateSparklineSvg(prices) {
  if (!prices || prices.length === 0) return '';
  const validPrices = prices.filter(p => typeof p === 'number' && !isNaN(p));
  if (validPrices.length < 2) return '';

  const w = 120;
  const h = 32;
  const paddingY = 4;
  const max = Math.max(...validPrices);
  const min = Math.min(...validPrices);
  const range = max === min ? 1 : max - min;

  const points = validPrices.map((p, i) => {
    const x = (i / (validPrices.length - 1)) * w;
    const y = h - paddingY - ((p - min) / range) * (h - 2 * paddingY);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const lastY = h - paddingY - ((validPrices[validPrices.length - 1] - min) / range) * (h - 2 * paddingY);

  return `
<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="30-day price trend">
  <polyline points="${points}" fill="none" stroke="#2B2620" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
  <circle cx="${w}" cy="${lastY.toFixed(1)}" r="2.5" fill="#E8B930"/>
</svg>`.trim();
}

function renderRoutePage(deal, origin, destination, partnersHtml, isThin, env = {}) {
  // F3: `destination` here is the real display_name text (e.g. "Larnaca, Cyprus") -- fine to
  // embed raw in visible text (h1/title/JSON-LD), but a URL needs it percent-encoded, or the
  // comma/space in most real destination names would produce an invalid/mismatched link. The
  // canonical URL in particular must exactly match what the sitemap emits and what the
  // /flight/:origin/:destination handler below expects to decode back out.
  const destPath = encodeURIComponent(destination);
  const metaRobots = isThin ? '<meta name="robots" content="noindex">' : '';
  const canonical = isThin ? '' : `<link rel="canonical" href="https://sparkfare.com/flight/${origin}/${destPath}">`;
  const prices = (deal.observations || []).map(o => o.price);
  const sparklineSvg = generateSparklineSvg(prices);

  const bestPrice = deal.price || 0;
  const basis = deal.basis_text || '';
  // The button says "Get Deal Alerts", so it goes to the alert signup form on the homepage. It must
  // never go to /departing/: that is the booking interstitial, which treats the path segment as a
  // trip id, tells the visitor "Check your inbox for your pre-trip guide" when they have signed up
  // for nothing, and logs an interstitial_view for a trip that does not exist.
  const ctaLink = `/?origin=${encodeURIComponent(origin)}#signup-form`;

  // JSON-LD
  const jsonLd = isThin ? '' : `
  <script type="application/ld+json">
  {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": "Flight Deal from ${origin} to ${destination}",
    "offers": {
      "@type": "Offer",
      "priceCurrency": "USD",
      "price": "${bestPrice}",
      "availability": "https://schema.org/InStock"
    }
  }
  </script>`;

  const enableAds = env.ENABLE_T5B_ADS === 'true' && !isThin;
  const adHtml = enableAds ? `
    <div class="ad-slot" style="margin-top: 48px; text-align: center; background: #E3D9C4; padding: 24px; border-radius: 8px;">
      <span style="color: #6B6255; font-size: 0.85rem; display: block; margin-bottom: 12px; font-family: Arial, sans-serif;">Advertisement</span>
      <!-- Placeholder for self-serve ad network tag (e.g. AdSense) -->
      <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"></script>
      <ins class="adsbygoogle"
           style="display:block; min-height: 90px;"
           data-ad-client="ca-pub-0000000000000000"
           data-ad-slot="0000000000"
           data-ad-format="auto"
           data-full-width-responsive="true"></ins>
      <script>
           (adsbygoogle = window.adsbygoogle || []).push({});
      </script>
    </div>
  ` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cheap flights from ${origin} to ${destination} | Sparkfare</title>
  ${metaRobots}
  ${canonical}
  ${jsonLd}
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500&family=Roboto+Mono:wght@400;500&display=swap');
    body {
      margin: 0;
      padding: 0;
      background-color: #EDE6D6;
      color: #2B2620;
      font-family: Arial, sans-serif;
    }
    header {
      padding: 24px 32px;
      border-bottom: 1px solid #DCD3BF;
    }
    .site-nav { display: flex; gap: 18px; font-size: 0.85rem; margin: 0 0 16px; flex-wrap: wrap; }
    .site-nav a { color: #605142; text-decoration: none; }
    /* nav tap targets */ @media (max-width: 768px) { .site-nav { gap: 0 18px; } .site-nav a { display: inline-block; padding: 11px 0; } }
    .site-nav a:hover { text-decoration: underline; }
    .site-nav a.brand-link { display: inline-flex; align-items: center; gap: 6px; }
    .brand-mark { width: 16px; height: 16px; flex-shrink: 0; }
    .tagline {
      font-family: 'Space Grotesk', sans-serif;
      font-weight: 500;
      font-size: 1.1rem;
      margin: 0;
    }
    main {
      padding: 48px 32px;
      max-width: 1000px;
      margin: 0 auto;
    }
    h1 {
      font-family: 'Space Grotesk', sans-serif;
      font-weight: 500;
      font-size: 2.5rem;
      margin-top: 0;
      margin-bottom: 48px;
    }
    .columns {
      display: flex;
      gap: 48px;
      flex-wrap: wrap;
    }
    .col {
      flex: 1;
      min-width: 320px;
      background: #E3D9C4;
      padding: 32px;
      border-radius: 8px;
      box-sizing: border-box;
    }
    .col h2 {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 1.5rem;
      margin-top: 0;
      margin-bottom: 24px;
    }
    .price-display {
      font-family: 'Roboto Mono', monospace;
      font-size: 2rem;
      font-weight: 500;
      margin-bottom: 8px;
    }
    .sparkline-container {
      margin-bottom: 24px;
    }
    .basis {
      color: #6B6255;
      font-size: 0.9rem;
      margin-bottom: 32px;
    }
    .cta {
      display: inline-block;
      background: #E8B930;
      color: #2B2620;
      text-decoration: none;
      font-weight: 600;
      padding: 14px 32px;
      border-radius: 6px;
      font-size: 1.1rem;
      transition: filter 0.2s;
    }
    .cta:hover {
      filter: brightness(1.05);
    }
    .partners-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .partners-list li {
      margin-bottom: 16px;
      padding-bottom: 16px;
      border-bottom: 1px solid #DCD3BF;
    }
    .partners-list li:last-child {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
    }
    .partner-name {
      font-weight: bold;
      margin-right: 8px;
    }
    .partner-blurb {
      color: #6B6255;
      font-size: 0.9rem;
      margin-top: 4px;
      margin-bottom: 8px;
      display: block;
    }
    .partner-link {
      color: #2B2620;
      text-decoration: underline;
      font-size: 0.9rem;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <header>
    <nav class="site-nav">
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
      <a href="/watchlists">Watchlists</a>
      <a href="/hub">Referrals</a>
      <a href="/trips">Trips</a>
      <a href="/account">Preferences</a>
      <a href="/privacy">Privacy</a>
      <a class="sign-in-link" id="sign-in-nav-link" href="/sign-in">Sign in</a>
    </nav>
    <p class="tagline">It only sparks when the fare's real.</p>
  </header>
  <main>
    <h1>Flight deals to ${destination}</h1>
    <div class="columns">
      <div class="col">
        <h2>The Fare</h2>
        <div class="price-display">$${bestPrice}</div>
        <div class="sparkline-container">
          ${sparklineSvg}
        </div>
        <div class="basis">${basis}</div>
        <a href="${ctaLink}" class="cta">Get Deal Alerts</a>
      </div>
      
      <div class="col">
        <h2>Everything else, handled.</h2>
        ${env.ENABLE_LEAVE_READY === 'true' ? '<p style="font-size: 0.9rem; margin: -4px 0 12px;">Leaving soon? <a href="/leave?src=route">Run the leave-ready checklist</a>.</p>' : ''}
        <p class="affiliate-disclosure" style="font-size: 0.85rem; color: #6B6255; margin: -8px 0 16px;">Sparkfare may earn a commission if you buy through these partner links, at no extra cost to you. <a href="/disclosure" style="color: inherit;">Read our disclosure</a>.</p>
        <ul class="partners-list">
          ${partnersHtml}
        </ul>
      </div>
    </div>
    ${adHtml}
  </main>
<script src="/nav-auth.js"></script><script>syncNavAuthStateLazy();</script>
<script src="/site-footer.js" defer></script>
</body>
</html>`;
}


import 'dotenv/config';
import { sendVerificationEmail, sendDailyDealEmail, sendAwayModeFollowUpEmail, sendBookingConfirmedEmail, sendDepartingSoonEmail, sendSunsetEmail, sendTargetReachedEmail, sendStressValveEmail, sendDepartureBriefingEmail, sendRouteRetrospectiveEmail, sendPreDepartureSequenceEmail, buildArchiveConfig, sendRevenueHealthAlertEmail } from './email.js';
import { Webhook } from 'standardwebhooks';
import { Resend } from 'resend';
import { getEntitlements } from './rewards.js';
import { dealQuality, EMAIL_DEAL_QUALITY_OPTIONS } from './dealQuality.js';
import { computePriceCheck, parseCheckPrice } from './priceCheck.js';
import { viewOnPartnerLabel } from './referralCopy.js';
import { readSendingGuardStatus } from './email.js';
import { buildLeaveReadyPlan, normalizeAnswers, QUESTION_KEYS } from './leaveReady.js';
import { verifyReactivateToken } from './postClickEmail.js';
import { outboundClickMeta } from './botClass.js';
import { sendWeeklyStandup } from './weeklyStandup.js';
import { archiveEditions, archiveWeeklyEditions, handleDigestRequest, renderDigestSitemap, archiveEnabled, archiveWriteEnabled } from './digestArchive.js';
import {
  generateState, verifyState, buildAuthorizeUrl, needsRefresh, buildPinPayload,
  exchangeCodeForToken, refreshAccessToken, listBoards, createPin,
  encryptToken, decryptToken, PINTEREST_TOKEN_ROW_ID, PINTEREST_SCOPES, createBoard, pinterestApiBase, pinterestEnvName } from './pinterest.js';

import { initWasm, Resvg } from '@resvg/resvg-wasm';
// `satori/standalone` is the build meant for runtimes that cannot compile WASM from bytes at runtime
// (Cloudflare Workers): it does not bundle Yoga's WASM, so it is supplied as a precompiled module in
// the /og/ handler below. Pinned to satori 0.32.0 in package.json on purpose -- see the comment there.
import satori, { init as initYoga } from 'satori/standalone';
import { html as satoriHtml } from 'satori-html';

let wasmInitialized = false;
let yogaInitialized = false;


// TLV (Tel Aviv) is a deliberate 13th origin, added for a small group of design-partner
// testers -- not a real US-market decision. See CLAUDE.md's "Decisions locked" section.
const VALID_ORIGINS = new Set([
  'JFK','LAX','ORD','ATL','DFW','SFO','MIA','IAD','EWR','SEA','IAH','BOS','DEN','PHX','LAS','TLV'
]);

// Workplan Step 93: the "Early Bird" referral loop's early-access digest, one hour ahead of the
// general 08:00 UTC send. Must be added to wrangler.jsonc's crons array verbatim -- this string
// is how scheduled() below tells the two triggers apart.
const EARLY_DIGEST_CRON = '0 7 * * *';

// Workplan Step 117 (GTM Plan Update, Phase 19). Monday 09:00 UTC -- must match wrangler.jsonc's
// crons array exactly, same drift risk already documented for EARLY_DIGEST_CRON above.
const WEEKLY_LINK_HEALTH_CRON = '0 9 * * 1';

// Starts the daily data pipeline on time. GitHub's own scheduler has started daily-fetch.yml 5 to 8 hours
// late every day, but a workflow_dispatch starts within seconds, so this Cloudflare trigger asks GitHub to
// run it. Must match wrangler.jsonc's crons array exactly. daily-fetch.yml keeps its own schedule as a
// fallback; a second run is harmless (same-day prices keep the minimum) and the compile's gate skips a
// duplicate.
const DAILY_FETCH_TRIGGER_CRON = '30 3 * * *';
const GITHUB_REPO = 'centeen/sparkfare';
const DAILY_FETCH_WORKFLOW = 'daily-fetch.yml';

export async function dispatchDailyFetch(env, fetchImpl = fetch) {
  if (!env?.GITHUB_DISPATCH_TOKEN) {
    console.error('Daily fetch dispatch skipped: GITHUB_DISPATCH_TOKEN is not set');
    return { ok: false, skipped: true };
  }
  const res = await fetchImpl(
    `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${DAILY_FETCH_WORKFLOW}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'sparkfare-worker',
      },
      body: JSON.stringify({ ref: 'main' }),
    }
  );
  if (res.status !== 204) {
    console.error('Daily fetch dispatch failed:', res.status, await res.text().catch(() => ''));
    return { ok: false, status: res.status };
  }
  return { ok: true };
}

// Workplan Step 101 (booking reconciliation). The Travelpayouts campaign ID for the Aviasales
// program -- a *different* numeric ID from the `314524` affiliate marker used in booking links.
// Found via app.travelpayouts.com/programs/<id>/about; confirmed as 569853 directly from the
// dashboard (see CLAUDE.md Phase 10b section). Used to filter the statistics API to this
// campaign only when reconciling paid bookings.
const AVIASALES_CAMPAIGN_ID = 569853;

export async function logEvent(env, data) {
  if (!env?.DB) return;
  try {
    // F1: T0's `events` table had no CREATE TABLE IF NOT EXISTS guard anywhere in this codebase
    // (every other D1 table added since -- watchlists, early_bird_snapshots, trips, etc. -- gets
    // one inline right before first use). Without it, every INSERT here throws "no such table:
    // events" in production if the table was never created there by hand, silently swallowed by
    // this function's own catch below with nothing but a console.error -- matching exactly the
    // "no analytics as of Sep 23" report. Self-heals on first call, same pattern as every other
    // table in this file.
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        user_id TEXT,
        anon_id TEXT,
        origin TEXT,
        route TEXT,
        partner TEXT,
        sub_id TEXT,
        source TEXT,
        meta TEXT,
        ts TEXT DEFAULT (datetime('now'))
      )
    `).run();
    await env.DB.prepare(`
      INSERT INTO events (id, event_type, user_id, anon_id, origin, route, partner, sub_id, source, meta)
      VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      data.event_type,
      data.user_id || null,
      data.anon_id || null,
      data.origin || null,
      data.route || null,
      data.partner || null,
      data.sub_id || null,
      data.source || null,
      data.meta ? JSON.stringify(data.meta) : null
    ).run();
  } catch (err) {
    console.error("Failed to log event:", err);
  }
}

// Small confirm / result pages for the unsubscribe and reactivate links. A GET never changes state:
// mail scanners and link prefetchers follow GET links, so every state change sits behind a POST button.
function actionPage({ title, message, action = null, button = null, status = 200 }) {
  const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const form = action ? `<form method="POST" action="${esc(action)}"><input type="hidden" name="List-Unsubscribe" value="One-Click"><button type="submit" style="font-size:16px;padding:12px 20px;border:0;border-radius:6px;background:#2B2620;color:#FBF8F0;cursor:pointer;">${esc(button)}</button></form>` : '';
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title></head><body style="font-family:Inter,Arial,sans-serif;background:#EDE6D6;color:#2B2620;padding:32px 16px;"><div style="max-width:480px;margin:0 auto;"><h1 style="font-size:22px;font-weight:500;">${esc(title)}</h1><p style="font-size:16px;line-height:1.5;">${esc(message)}</p>${form}</div></body></html>`, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

// A browser form POST wants a page back; Gmail's one-click POST wants a short machine answer.
function wantsHtml(request) {
  return (request.headers.get('accept') || '').includes('text/html');
}

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ROADMAP step 35: Pinterest OAuth + Pin creation (admin-only). Reuses the exact same
// shared-secret pattern /admin/metrics already established in this codebase -- there is no
// Clerk-based admin-role concept anywhere in this project's D1 schema, so a real auth system
// would be new scope well beyond this task.
function isAdminAuthorized(request, url, env) {
  const authHeader = request.headers.get('Authorization');
  const querySecret = url.searchParams.get('secret');
  return Boolean(env.ADMIN_SECRET) && (authHeader === `Bearer ${env.ADMIN_SECRET}` || querySecret === env.ADMIN_SECRET);
}

// Manual trigger routes (the /api/send-*, reconcile, health-check and X-post routes). Each one runs a
// real batch job or sends real email, and used to be callable by anyone: POST /api/send-daily-alert
// would mail the daily template to any address a stranger supplied, spending sender reputation and
// risking the bounce/complaint circuit breaker that blocks all guarded email. Nothing calls them over
// HTTP in production (the crons call the functions directly), so they now require ADMIN_SECRET as a
// Bearer token. Header only, not ?secret=: a secret in a URL ends up in access logs and history. Fails
// closed when ADMIN_SECRET is not configured. Constant-time compare.
function adminBearerOk(request, env) {
  const expected = env?.ADMIN_SECRET;
  if (!expected) return false;
  const header = request.headers.get('Authorization') || '';
  if (!header.startsWith('Bearer ')) return false;
  const given = header.slice('Bearer '.length);
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

function requireAdmin(request, env) {
  return adminBearerOk(request, env) ? null : jsonResponse(401, { ok: false, error: 'Unauthorized' });
}

function parseCookies(request) {
  const header = request.headers.get('Cookie') || '';
  const out = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

async function getStoredPinterestTokens(env) {
  if (!env?.DB) return null;
  const row = await env.DB.prepare('SELECT * FROM pinterest_tokens WHERE id = ?').bind(PINTEREST_TOKEN_ROW_ID).first();
  if (!row) return null;
  const accessToken = await decryptToken({ ciphertext: row.access_token_ciphertext, iv: row.access_token_iv }, env.PINTEREST_TOKEN_ENCRYPTION_KEY);
  const refreshToken = await decryptToken({ ciphertext: row.refresh_token_ciphertext, iv: row.refresh_token_iv }, env.PINTEREST_TOKEN_ENCRYPTION_KEY);
  return { accessToken, refreshToken, expiresAt: row.expires_at, scopes: row.scopes, connectedAt: row.connected_at };
}

async function storePinterestTokens(env, { accessToken, refreshToken, expiresAt, scopes }) {
  const accessEnc = await encryptToken(accessToken, env.PINTEREST_TOKEN_ENCRYPTION_KEY);
  const refreshEnc = await encryptToken(refreshToken, env.PINTEREST_TOKEN_ENCRYPTION_KEY);
  await env.DB.prepare(`
    INSERT INTO pinterest_tokens (id, access_token_ciphertext, access_token_iv, refresh_token_ciphertext, refresh_token_iv, expires_at, scopes, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      access_token_ciphertext = excluded.access_token_ciphertext,
      access_token_iv = excluded.access_token_iv,
      refresh_token_ciphertext = excluded.refresh_token_ciphertext,
      refresh_token_iv = excluded.refresh_token_iv,
      expires_at = excluded.expires_at,
      scopes = excluded.scopes,
      updated_at = datetime('now')
  `).bind(PINTEREST_TOKEN_ROW_ID, accessEnc.ciphertext, accessEnc.iv, refreshEnc.ciphertext, refreshEnc.iv, expiresAt, scopes).run();
}

// Refreshes first if the stored token is within 5 minutes of expiry, persisting the refreshed
// token immediately so the next call doesn't redo the same refresh. Throws if nothing is
// connected yet -- every caller below treats that as "connect first," not a silent default.
async function getValidPinterestAccessToken(env) {
  const stored = await getStoredPinterestTokens(env);
  if (!stored) throw new Error('No Pinterest account connected. Visit /admin/pinterest/connect first.');
  if (!needsRefresh(stored.expiresAt)) return stored.accessToken;
  const refreshed = await refreshAccessToken({
    appId: env.PINTEREST_APP_ID,
    appSecret: env.PINTEREST_APP_SECRET,
    refreshToken: stored.refreshToken,
    apiBase: pinterestApiBase(env),
  });
  const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  await storePinterestTokens(env, {
    accessToken: refreshed.access_token,
    // Pinterest's refresh response may or may not include a new refresh_token; keep the old one
    // if it doesn't, since the "continuous" refresh token is meant to be reused indefinitely.
    refreshToken: refreshed.refresh_token || stored.refreshToken,
    expiresAt,
    scopes: refreshed.scope || stored.scopes,
  });
  return refreshed.access_token;
}

// Workplan Step 106b -- Passenger Count (roadmap "Group Travel Multiplier"). Clamped to a sane
// 1-9 range rather than trusted as-is: it flows straight into affiliate-copy math ("insure all N
// passengers"), so a garbage or absurd value would corrupt real email content, not just a stored
// number. Defaults to 1 (a solo traveler) whenever omitted -- matches the DB column's own
// DEFAULT 1, so a signup source that never sends this field (the anonymous pSEO landing pages,
// deliberately -- see CLAUDE.md) still gets a sane value with no extra code needed.
function normalizePassengerCount(value) {
  if (value === undefined || value === null || value === '') return 1;
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, 9);
}

function withTripMarker(bookingLink, tripId) {
  const url = new URL(bookingLink);
  if (url.hostname !== 'www.aviasales.com') throw new Error('Invalid booking link');
  url.searchParams.set('marker', `314524.${tripId}`);
  return url.toString();
}

async function loadJsonAsset(env, filename) {
  if (!env?.ASSETS) return {};
  const response = await env.ASSETS.fetch(new Request(`https://sparkfare.local/${filename}`));
  if (!response.ok) return {};
  return response.json();
}

async function loadHtmlAsset(env, filename) {
  if (!env?.ASSETS) throw new Error('ASSETS binding not configured');
  const response = await env.ASSETS.fetch(new Request(`https://sparkfare.local/${filename}`));
  if (!response.ok) throw new Error(`Asset not found: ${filename}`);
  return response.text();
}

// Workplan Step 67 (free/paid serving-layer split). A "soft" gate, deliberately -- there's no
// billing yet, so nobody actually has subscription_tier = 'paid' in production today, and the
// underlying JSON files themselves stay public static assets exactly as they already are (same
// non-technical-secrecy precedent already used for the TLV origin: nothing to protect until
// someone has actually paid for it). This just builds the real serving distinction the "Decisions
// locked" tier split describes, so it exists and is tested before there's a paying customer to
// build it against blind.

// The daily email evaluates freshness differently from the live site: the free-tier feeds are
// deliberately 24h+ delayed and the pipeline commits around 11:00 UTC, so at the 08:00 UTC send
// every record is ~21-45h old and its ~1h expires_at window has long passed. Applying the
// site's default rules there rejected 100% of deals (verified against 2026-09-24 data), so every
// subscriber was skipped. Email instead ignores expires_at, allows up to EMAIL_STALENESS_CUTOFF_HOURS
// since found_at (still excludes week-old stale-fallback carry-forwards), and labels prices "as of".
async function applyDealQualityFilter(env, ctx, filtered, dqOptions = {}) {
  const now = new Date();
  const apply = async (arr) => {
    const valid = [];
    for (const deal of (arr || [])) {
      const obs = deal.observations || (deal.price_history ? deal.price_history.map(p => ({price: p, date: new Date().toISOString()})) : []);
      const dq = dealQuality(obs, deal, now, dqOptions);
      if (dq.eligible) {
        deal.basis_text = dq.basis_text || deal.basis_text;
        deal.pct_below_avg = dq.pct_below_avg || deal.pct_below_avg;
        valid.push(deal);
      } else {
        const promise = logEvent(env, {
          event_type: 'deal_suppressed',
          origin: deal.origin,
          route: deal.display_name,
          meta: { price: deal.price, reasons: dq.reasons }
        });
        if (ctx && ctx.waitUntil) ctx.waitUntil(promise);
        else await promise;
      }
    }
    return valid;
  };
  
  filtered.deals = await apply(filtered.deals);
  filtered.featured = await apply(filtered.featured);
  return filtered;
}

function filterDealsByOrigin(combined, origin) {
  const pick = (list) => (list || []).filter((record) => record.origin === origin);
  return {
    deals: pick(combined.deals),
    featured: pick(combined.featured),
    priced_no_deal: pick(combined.priced_no_deal),
    insufficient_history: pick(combined.insufficient_history),
    no_data: pick(combined.no_data),
  };
}

// Shared by /api/deals and the Step 115 watchlist checker below -- same tier/origin freshness
// split either way. Extracted so watchlists can't accidentally become a backdoor to hourly-fresh
// data for free users; a watchlist's alert-worthiness is checked against exactly the same file a
// free or paid user would actually see on the board for that origin.
function rankedDealsFilename(tier, origin) {
  return tier === 'paid'
    ? 'sparkfare_hourly_ranked_deals.json'
    : (origin === 'JFK' ? 'sparkfare_ranked_deals.json' : 'sparkfare_ranked_deals_other_origins.json');
}

// The deals a digest for one origin contains: same free-tier file, origin filter and email
// freshness rules for the emailed digest and the public archive, so the two can never disagree.
// `cache` (a Map) lets one run share file loads and per-origin results across many users.
async function loadDigestDeals(env, origin, cache = new Map()) {
  const key = `deals:${origin}`;
  if (cache.has(key)) return cache.get(key);
  const filename = rankedDealsFilename('free', origin);
  if (!cache.has(filename)) cache.set(filename, await loadJsonAsset(env, filename));
  let filtered = filterDealsByOrigin(cache.get(filename), origin);
  filtered = await applyDealQualityFilter(env, null, filtered, EMAIL_DEAL_QUALITY_OPTIONS);
  const deals = [...(filtered.deals || []), ...(filtered.featured || [])];
  cache.set(key, deals);
  return deals;
}

// Searches every priced category (deals/featured/priced_no_deal) for a specific route -- not
// insufficient_history or no_data, since neither carries a real, current price a target-price
// comparison could trust.
function findRouteRecord(combined, origin, destination) {
  const searchable = [
    ...(combined.deals || []),
    ...(combined.featured || []),
    ...(combined.priced_no_deal || []),
  ];
  return searchable.find((record) => record.origin === origin && record.display_name === destination) || null;
}

// Workplan Step 116 (GTM Plan Update, Phase 19 -- "The Sparkfare Index"). The inverse of a deal:
// routes where today's price sits ABOVE its own 30-day median, not below it -- "how
// overpriced is this route right now," the mirror image of a deal's basis_text figure (which is
// undefined/irrelevant for a route that isn't a deal at all). Reads both the JFK daily file and
// the 24h-delayed combined file for the other 11 US origins -- the same two-file split already
// documented for the pSEO generator (Step 106) -- and deliberately excludes TLV, consistent with
// its existing de-prioritized/not-marketed status (TLV is excluded from every public-facing
// surface, this dashboard included). Only records with a real median_baseline (deals/
// priced_no_deal) are considered -- insufficient_history/no_data records have nothing to compare.
export async function computePriceGougingWatchlist(env) {
  const [jfk, others] = await Promise.all([
    loadJsonAsset(env, 'sparkfare_ranked_deals.json'),
    loadJsonAsset(env, 'sparkfare_ranked_deals_other_origins.json'),
  ]);

  const allRecords = [
    ...(jfk.deals || []), ...(jfk.featured || []), ...(jfk.priced_no_deal || []),
    ...(others.deals || []), ...(others.featured || []), ...(others.priced_no_deal || []),
  ];

  const withGougeRatio = allRecords
    .filter((record) => typeof record.price === 'number' && typeof record.median_baseline === 'number' && record.median_baseline > 0)
    .map((record) => ({
      origin: record.origin,
      destination: record.display_name,
      price: record.price,
      median: record.median_baseline,
      pctAboveMedian: (record.price - record.median_baseline) / record.median_baseline,
      bookingLink: record.booking_link || null,
    }))
    .filter((record) => record.pctAboveMedian > 0)
    .sort((a, b) => b.pctAboveMedian - a.pctAboveMedian);

  return {
    generated_at: new Date().toISOString(),
    watchlist: withGougeRatio.slice(0, 5),
  };
}

// Step 107/116 (GTM Plan Update) -- the X (Twitter) posting broadcaster. Capped to at most one
// post per day per Coby's explicit decision (2026-09-23), after real research showed X's old
// free written-application process no longer exists: every new developer is on pay-per-use
// billing by default, and every post here includes a link (the /deal/ permalink below), which is
// billed at the more expensive per-post-with-a-link rate. One post/day keeps this in the range
// discussed in x_api_developer_application_draft.md rather than scaling uncapped with however
// many deals the board happens to flag on a given day.
function percentEncodeRFC3986(str) {
  return encodeURIComponent(str).replace(/[!*'()]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

async function hmacSha1Base64(key, message) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

// OAuth 1.0a User Context signing for X API v2. Only the URL and OAuth parameters go into the
// signature base string -- the JSON request body is deliberately excluded, since the "include
// body params in the signature" rule only applies to application/x-www-form-urlencoded bodies
// (X API v2's POST /2/tweets uses application/json), per X's own OAuth 1.0a documentation.
async function buildOAuth1Header(method, url, keys) {
  const oauthParams = {
    oauth_consumer_key: keys.apiKey,
    oauth_nonce: crypto.randomUUID().replace(/-/g, ''),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: keys.accessToken,
    oauth_version: '1.0',
  };

  const paramString = Object.keys(oauthParams).sort()
    .map((k) => `${percentEncodeRFC3986(k)}=${percentEncodeRFC3986(oauthParams[k])}`)
    .join('&');
  const baseString = `${method.toUpperCase()}&${percentEncodeRFC3986(url)}&${percentEncodeRFC3986(paramString)}`;
  const signingKey = `${percentEncodeRFC3986(keys.apiSecret)}&${percentEncodeRFC3986(keys.accessTokenSecret)}`;
  const signature = await hmacSha1Base64(signingKey, baseString);

  const headerParams = { ...oauthParams, oauth_signature: signature };
  const header = 'OAuth ' + Object.keys(headerParams).sort()
    .map((k) => `${percentEncodeRFC3986(k)}="${percentEncodeRFC3986(headerParams[k])}"`)
    .join(', ');
  return header;
}

// Only ever picks a genuine, dealQuality-eligible deal -- per this project's own honesty rule
// (never display a price claim not backed by the guardrails), a day with no real deal anywhere
// gets no post at all rather than forcing a "featured"/"priced_no_deal" route into deal-shaped
// copy it hasn't earned.
async function pickBestDailyDeal(env) {
  const [jfk, others] = await Promise.all([
    loadJsonAsset(env, 'sparkfare_ranked_deals.json'),
    loadJsonAsset(env, 'sparkfare_ranked_deals_other_origins.json'),
  ]);
  const candidates = [...(jfk.deals || []), ...(others.deals || [])];
  const now = new Date();
  let best = null;
  for (const deal of candidates) {
    const obs = deal.observations || (deal.price_history ? deal.price_history.map(p => ({ price: p, date: now.toISOString() })) : []);
    const dq = dealQuality(obs, deal, now);
    if (!dq.eligible) continue;
    // The percentage is measured against the 30-day MEDIAN, the same baseline dealQuality judges
    // the deal on and basis_text states everywhere else (never the mean-based pct_below_avg).
    const pctBelowMedian = dq.baseline > 0 ? (dq.baseline - Number(deal.price)) / dq.baseline : 0;
    if (!best || pctBelowMedian > best.pct_below_median) best = { ...deal, pct_below_median: pctBelowMedian };
  }
  return best;
}

function buildXPostText(deal) {
  const pct = Math.round((deal.pct_below_median || 0) * 100);
  const price = Math.round(deal.price);
  const date = new Date().toISOString().slice(0, 10);
  const link = `https://sparkfare.com/deal/${deal.origin}/${encodeURIComponent(deal.display_name)}/${date}`;
  return `${deal.origin} to ${deal.display_name}: $${price} round trip -- ${pct}% below its 30-day median.\n\n${link}`;
}

export async function sendDailyXPost(env) {
  if (env?.ENABLE_X_BROADCASTER !== 'true') {
    return { ok: true, sent: false, reason: 'disabled' };
  }
  const keys = {
    apiKey: env?.X_API_KEY,
    apiSecret: env?.X_API_SECRET,
    accessToken: env?.X_ACCESS_TOKEN,
    accessTokenSecret: env?.X_ACCESS_TOKEN_SECRET,
  };
  if (!keys.apiKey || !keys.apiSecret || !keys.accessToken || !keys.accessTokenSecret) {
    return { ok: true, sent: false, reason: 'not_configured' };
  }

  if (env?.DB) {
    // F1: see logEvent()'s own comment -- events had no creation guard anywhere, so this SELECT
    // would throw "no such table" before ever reaching the actual post, silently failing the
    // daily X broadcaster's dedupe check (and, since this SELECT has no try/catch of its own, the
    // whole function) every run.
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        user_id TEXT,
        anon_id TEXT,
        origin TEXT,
        route TEXT,
        partner TEXT,
        sub_id TEXT,
        source TEXT,
        meta TEXT,
        ts TEXT DEFAULT (datetime('now'))
      )
    `).run();
    const today = new Date().toISOString().slice(0, 10);
    const already = await env.DB.prepare(
      `SELECT id FROM events WHERE event_type = 'x_post_sent' AND date(ts) = ? LIMIT 1`
    ).bind(today).first();
    if (already) {
      return { ok: true, sent: false, reason: 'already_posted_today' };
    }
  }

  const deal = await pickBestDailyDeal(env);
  if (!deal) {
    await logEvent(env, { event_type: 'x_post_skipped_no_deal' });
    return { ok: true, sent: false, reason: 'no_eligible_deal' };
  }

  const url = 'https://api.x.com/2/tweets';
  const text = buildXPostText(deal);
  const authHeader = await buildOAuth1Header('POST', url, keys);
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader },
    body: JSON.stringify({ text }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('X post failed:', response.status, JSON.stringify(body));
    return { ok: false, sent: false, status: response.status, body };
  }

  await logEvent(env, {
    event_type: 'x_post_sent',
    origin: deal.origin,
    route: deal.display_name,
    meta: { price: deal.price, pct_below_median: deal.pct_below_median, tweet_id: body?.data?.id },
  });
  return { ok: true, sent: true, tweet_id: body?.data?.id };
}

function priceGougingIndexHtml(data) {
  const rows = data.watchlist.map((route) => `
    <tr>
      <td>${route.origin} → ${route.destination}</td>
      <td style="font-family:'IBM Plex Mono','Courier New',monospace;">$${Number(route.price).toLocaleString('en-US')}</td>
      <td style="font-family:'IBM Plex Mono','Courier New',monospace;">$${Number(route.median).toFixed(0)}</td>
      <td>+${Math.round(route.pctAboveMedian * 100)}%</td>
    </tr>
  `).join('');

  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>The Sparkfare Index | Sparkfare</title>
<style>
  body{margin:0;background:#E8DCC5;color:#2E2318;font:16px 'Segoe UI',sans-serif;}
  .wrap{max-width:760px;margin:0 auto;padding:48px 20px 80px;}
  h1{font-size:2rem;letter-spacing:-0.03em;margin:0 0 8px;}
  .sub{color:#6B5A45;margin:0 0 24px;max-width:56ch;}
  table{width:100%;border-collapse:collapse;background:#FAF6EE;border:1px solid #D9CBB0;border-radius:6px;overflow:hidden;}
  th,td{text-align:left;padding:12px 14px;border-bottom:1px solid #D9CBB0;font-size:0.92rem;}
  th{color:#6B5A45;font-weight:600;font-size:0.8rem;text-transform:uppercase;letter-spacing:0.04em;}
  tr:last-child td{border-bottom:none;}
  a{color:#4F7A52;}
  .site-nav { display: flex; gap: 18px; font-size: 0.85rem; margin-bottom: 20px; flex-wrap: wrap; }
  .site-nav a { color: #605142; text-decoration: none; }
  /* nav tap targets */ @media (max-width: 768px) { .site-nav { gap: 0 18px; } .site-nav a { display: inline-block; padding: 11px 0; } }
  .site-nav a:hover { text-decoration: underline; }
  .site-nav a.brand-link { display: inline-flex; align-items: center; gap: 6px; }
  .brand-mark { width: 16px; height: 16px; flex-shrink: 0; }
</style></head>
<body><div class="wrap">
    <nav class="site-nav">
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
      <a href="/watchlists">Watchlists</a>
      <a href="/hub">Referrals</a>
      <a href="/trips">Trips</a>
      <a href="/account">Preferences</a>
      <a href="/privacy">Privacy</a>
      <a class="sign-in-link" id="sign-in-nav-link" href="/sign-in">Sign in</a>
    </nav>
  <h1>The Sparkfare Index</h1>
  <p class="sub">The 5 routes currently priced furthest above their own 30-day median, across our tracked origins. Updated whenever this page is requested. <a href="/">See today's real deals →</a></p>
  <table>
    <thead><tr><th>Route</th><th>Today</th><th>30-day median</th><th>Above median</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="4">No priced routes are currently above their 30-day median.</td></tr>'}</tbody>
  </table>
</div>
<script src="/nav-auth.js"></script><script>syncNavAuthStateLazy();</script>
</body></html>`;
}

// Workplan Step 122 (GTM Launch Plan, Phase 20 -- Zero-CAC KPI dashboard), scoped with the user
// directly 2026-09-13: the source doc's 3 categories (Acquisition Velocity via organic search
// impressions/co-registration/social clicks, Viral Coefficient, Away Mode revenue ARPU) can't all
// be built from real data today -- there's no analytics/Search Console API integration anywhere
// in this project, and Steps 107/108 (the social broadcaster and co-registration) are themselves
// still blocked on external API credentials that don't exist. Away Mode ARPU specifically can't
// be computed either: SafetyWing/Bounce/US Global Mail are Coby's personal referral links with no
// sub-ID tracking, the exact gap step92_revenue_share_tradeoffs.md already documents in detail.
// Built from real D1 data only, per the user's explicit choice -- every number here is real,
// gaps are labeled as not-yet-tracked rather than guessed at:
//   - Viral Coefficient -> the real Early Bird referral mechanics (Step 93): how many users have
//     successfully referred at least one friend, and what fraction of all signups arrived via a
//     referral.
//   - Acquisition Velocity -> pSEO signup volume (Step 106's partner_id: 'pseo' tag) stands in for
//     the undoable "organic search impressions" metric -- it's the one acquisition number this
//     project can actually attribute today.
//   - Revenue -> real flight-booking revenue per user (trips.price_eur from reconcileBookings,
//     Step 101) stands in for the undoable "Away Mode ARPU".
export async function computeKPIs(env) {
  if (!env?.DB) return null;

  const scalar = async (sql, fallback = 0) => {
    try {
      const row = await env.DB.prepare(sql).first();
      const value = row ? Object.values(row)[0] : null;
      return typeof value === 'number' ? value : fallback;
    } catch (error) {
      console.error(`KPI query failed (${sql}):`, error.message);
      return fallback;
    }
  };

  const totalUsers = await scalar('SELECT COUNT(*) FROM users');
  const verifiedUsers = await scalar('SELECT COUNT(*) FROM users WHERE verified_email = 1');
  const activeSubscribers = await scalar('SELECT COUNT(*) FROM users WHERE is_subscribed = 1');
  const earlyAccessUsers = await scalar('SELECT COUNT(*) FROM users WHERE early_access = 1');
  const uniqueReferrers = await scalar('SELECT COUNT(DISTINCT referred_by) FROM users WHERE referred_by IS NOT NULL');
  const referredSignups = await scalar('SELECT COUNT(*) FROM users WHERE referred_by IS NOT NULL');
  const pseoSignups = await scalar("SELECT COUNT(*) FROM users WHERE partner_id = 'pseo'");

  const totalTrips = await scalar('SELECT COUNT(*) FROM trips');
  const bookedTrips = await scalar("SELECT COUNT(*) FROM trips WHERE status = 'booked'");
  const totalRevenueEur = await scalar("SELECT COALESCE(SUM(price_eur), 0) FROM trips WHERE status = 'booked' AND price_eur IS NOT NULL");

  const totalWatchlists = await scalar('SELECT COUNT(*) FROM watchlists');
  const notifiedWatchlists = await scalar('SELECT COUNT(*) FROM watchlists WHERE notified_at IS NOT NULL');

  const allRows = async (sql, fallback = []) => {
    try {
      const res = await env.DB.prepare(sql).all();
      return res.results || fallback;
    } catch (error) {
      console.error(`KPI query failed (${sql}):`, error.message);
      return fallback;
    }
  };

  const weeklyEvents = await allRows(`
    SELECT
      strftime('%Y-%W', ts) as week,
      SUM(CASE WHEN event_type = 'signup' THEN 1 ELSE 0 END) as signups,
      SUM(CASE WHEN event_type = 'referral_signup' THEN 1 ELSE 0 END) as referral_signups,
      SUM(CASE WHEN event_type = 'alert_email_sent' THEN 1 ELSE 0 END) as emails_sent,
      SUM(CASE WHEN event_type = 'email_open' THEN 1 ELSE 0 END) as email_opens,
      SUM(CASE WHEN event_type = 'email_click' THEN 1 ELSE 0 END) as email_clicks,
      SUM(CASE WHEN event_type = 'check_run' THEN 1 ELSE 0 END) as check_runs,
      SUM(CASE WHEN event_type = 'check_share' THEN 1 ELSE 0 END) as check_shares,
      SUM(CASE WHEN event_type = 'check_signup' THEN 1 ELSE 0 END) as check_signups
    FROM events
    GROUP BY week
    ORDER BY week DESC
    LIMIT 12
  `);

  const outboundClicks = await allRows(`
    SELECT
      strftime('%Y-%W', ts) as week,
      partner,
      COUNT(*) as clicks
    FROM events
    WHERE event_type = 'outbound_click' AND partner IS NOT NULL
      AND (meta IS NULL OR meta NOT LIKE '%"ua_class":"bot"%')
    GROUP BY week, partner
    ORDER BY week DESC, clicks DESC
    LIMIT 50
  `);

  // Clicks whose User-Agent identified a crawler, link-preview fetcher or HTTP library. Kept out of
  // outbound_clicks above so launch numbers are not inflated by them; shown here so the volume is visible.
  const botOutboundClicks = await allRows(`
    SELECT strftime('%Y-%W', ts) as week, COUNT(*) as clicks
    FROM events
    WHERE event_type = 'outbound_click' AND meta LIKE '%"ua_class":"bot"%'
    GROUP BY week
    ORDER BY week DESC
    LIMIT 12
  `);

  const partnerConversions = await allRows(`
    SELECT
      slug as partner,
      month,
      reported_conversions,
      reported_revenue
    FROM partner_conversions
    ORDER BY month DESC, reported_revenue DESC
  `);

  const cohorts = await allRows(`
    SELECT
      strftime('%Y-%W', s.ts) as signup_week,
      COUNT(DISTINCT s.user_id) as cohort_size,
      COUNT(DISTINCT CASE WHEN e.ts <= datetime(s.ts, '+14 days') THEN e.user_id END) as engaged_users
    FROM events s
    LEFT JOIN events e ON s.user_id = e.user_id AND e.event_type IN ('email_open', 'email_click')
    WHERE s.event_type = 'signup'
    GROUP BY signup_week
    ORDER BY signup_week DESC
    LIMIT 12
  `);

  return {
    generated_at: new Date().toISOString(),
    viral: {
      unique_referrers: uniqueReferrers,
      referred_signups: referredSignups,
      total_users: totalUsers,
      referrer_rate: totalUsers > 0 ? uniqueReferrers / totalUsers : 0,
      viral_coefficient: totalUsers > 0 ? referredSignups / totalUsers : 0,
      early_access_users: earlyAccessUsers,
    },
    acquisition: {
      pseo_signups: pseoSignups,
      total_users: totalUsers,
      verified_users: verifiedUsers,
      active_subscribers: activeSubscribers,
    },
    revenue: {
      total_trips: totalTrips,
      booked_trips: bookedTrips,
      booking_conversion_rate: totalTrips > 0 ? bookedTrips / totalTrips : 0,
      total_revenue_eur: totalRevenueEur,
      revenue_per_active_subscriber_eur: activeSubscribers > 0 ? totalRevenueEur / activeSubscribers : 0,
    },
    watchlists: {
      total: totalWatchlists,
      notified: notifiedWatchlists,
    },
    weekly_events: weeklyEvents,
    outbound_clicks: outboundClicks,
    bot_outbound_clicks: botOutboundClicks,
    partner_conversions: partnerConversions,
    cohorts: cohorts
  };
}

// ROADMAP step 35: minimal admin-only Pinterest status page. Deliberately shows no human-readable
// account name -- that needs GET /v5/user_account, which needs the user_accounts:read scope this
// task's own scope list doesn't include; see src/pinterest.js's top comment. noindex/nofollow
// matches /kpi's own precedent for an admin page that happens to be reachable without being in
// run_worker_first.
const escapeAdminHtml = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// `secret` is only known on pages reached with ?secret= (not the post-OAuth callback page, which
// Pinterest redirects the browser to directly). When it's absent, say how to continue in words
// instead of rendering a link that would 401 or a literal placeholder.
function pinterestStatusHtml({ connected, scopes, expiresAt, secret = '', environment = 'production' }) {
  const q = secret ? `?secret=${encodeURIComponent(secret)}` : '';
  const links = secret
    ? `<p><a href="/admin/pinterest/connect${q}">${connected ? 'Reconnect' : 'Connect'} Pinterest</a></p>
${connected ? `<p><a href="/admin/pinterest/boards${q}">Choose a board &amp; create a Pin</a></p>` : ''}`
    : `<p>Open <code>/admin/pinterest/status?secret=&hellip;</code> with your admin secret to ${connected ? 'choose a board and create a Pin' : 'connect Pinterest'}.</p>`;
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8">
<title>Pinterest connection | Sparkfare admin</title>
<meta name="robots" content="noindex, nofollow">
<style>body{font-family:'Segoe UI',sans-serif;max-width:600px;margin:48px auto;padding:0 20px;color:#2E2318}
a{color:#4F7A52}.pill{display:inline-block;padding:2px 10px;border-radius:99px;font-size:0.85rem;font-weight:600}
.pill.yes{background:#dff0d8;color:#2d5a2d}.pill.no{background:#f0d8d8;color:#5a2d2d}</style></head>
<body>
<h1>Pinterest connection</h1>
<p>Status: <span class="pill ${connected ? 'yes' : 'no'}">${connected ? 'Connected' : 'Not connected'}</span> &middot; Environment: <strong>${escapeAdminHtml(environment)}</strong></p>
${environment === 'sandbox' ? '<p>Sandbox mode: Pins and boards created here are separate from your real Pinterest account and visible only to you. If you just switched environments, reconnect.</p>' : ''}
${connected ? `<p>Scopes granted: <code>${escapeAdminHtml(scopes)}</code></p><p>Access token expires: ${escapeAdminHtml(expiresAt)}</p>` : ''}
${links}
</body></html>`;
}

function pinterestBoardsHtml(boards, secret, environment = 'production') {
  const options = boards.map((b) => `<option value="${escapeAdminHtml(b.id)}">${escapeAdminHtml(b.name)} (${escapeAdminHtml(b.privacy)})</option>`).join('');
  // Serialized for a JS string context; '<' escaped so a secret can't close the script tag.
  const secretJs = JSON.stringify(secret || '').replace(/</g, '\\u003c');
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8">
<title>Create a Pin | Sparkfare admin</title>
<meta name="robots" content="noindex, nofollow">
<style>body{font-family:'Segoe UI',sans-serif;max-width:600px;margin:48px auto;padding:0 20px;color:#2E2318}
label{display:block;margin-top:14px;font-weight:600}input,select{width:100%;padding:8px;margin-top:4px;box-sizing:border-box}
button{margin-top:18px;padding:10px 18px;background:#4F7A52;color:#fff;border:none;border-radius:4px;cursor:pointer}
pre{background:#FAF6EE;border:1px solid #D9CBB0;padding:12px;white-space:pre-wrap;word-break:break-word}</style></head>
<body>
<h1>Create a Pin from a real deal</h1>
<p>Environment: <strong>${escapeAdminHtml(environment)}</strong>${environment === 'sandbox' ? ' (sandbox boards are separate from your real boards; create one below if the list is empty)' : ''}</p>
<form id="board-form" style="margin-bottom:24px">
  <label for="board_name">New board name</label>
  <input id="board_name" placeholder="Sparkfare flight deals">
  <button type="submit">Create board</button>
</form>
<p>Only a deal that currently passes <code>dealQuality</code> can be pinned; ineligible routes are rejected with the real reason.</p>
<form id="pin-form">
  <label for="board_id">Board</label>
  <select id="board_id" required>${options}</select>
  <label for="origin">Origin (IATA, e.g. JFK)</label>
  <input id="origin" required>
  <label for="destination">Destination (exact name, e.g. "Larnaca, Cyprus")</label>
  <input id="destination" required>
  <button type="submit">Create Pin</button>
</form>
<pre id="result" hidden></pre>
<script>
document.getElementById('board-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const result = document.getElementById('result');
  result.hidden = false;
  result.textContent = 'Creating board...';
  try {
    const res = await fetch('/admin/pinterest/board?secret=' + encodeURIComponent(${secretJs}), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: document.getElementById('board_name').value }),
    });
    const data = await res.json();
    result.textContent = JSON.stringify(data, null, 2);
    if (data.ok) setTimeout(() => location.reload(), 1200);
  } catch (err) {
    result.textContent = 'Request failed: ' + err.message;
  }
});
document.getElementById('pin-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const result = document.getElementById('result');
  result.hidden = false;
  result.textContent = 'Creating Pin...';
  try {
    const res = await fetch('/admin/pinterest/pin?secret=' + encodeURIComponent(${secretJs}), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        board_id: document.getElementById('board_id').value,
        origin: document.getElementById('origin').value,
        destination: document.getElementById('destination').value,
      }),
    });
    result.textContent = JSON.stringify(await res.json(), null, 2);
  } catch (err) {
    result.textContent = 'Request failed: ' + err.message;
  }
});
</script>
</body></html>`;
}

function kpiDashboardHtml(kpi) {
  const pct = (n) => `${(n * 100).toFixed(1)}%`;
  const eur = (n) => `€${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

  const card = (label, value, note) => `
    <div class="kpi-card">
      <p class="kpi-label">${label}</p>
      <p class="kpi-value">${value}</p>
      ${note ? `<p class="kpi-note">${note}</p>` : ''}
    </div>
  `;

  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Zero-CAC KPIs | Sparkfare</title>
<meta name="robots" content="noindex, nofollow">
<style>
  body{margin:0;background:#E8DCC5;color:#2E2318;font:16px 'Segoe UI',sans-serif;}
  .wrap{max-width:900px;margin:0 auto;padding:48px 20px 80px;}
  h1{font-size:1.8rem;letter-spacing:-0.03em;margin:0 0 4px;}
  h2{font-size:1.1rem;margin:32px 0 12px;}
  .sub{color:#6B5A45;margin:0 0 8px;font-size:0.85rem;}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;}
  .kpi-card{background:#FAF6EE;border:1px solid #D9CBB0;border-radius:6px;padding:16px 18px;}
  .kpi-label{color:#6B5A45;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.04em;margin:0 0 6px;}
  .kpi-value{font-family:'IBM Plex Mono','Courier New',monospace;font-size:1.5rem;margin:0;}
  .kpi-note{color:#605142;font-size:0.78rem;margin:6px 0 0;}
  .gap-note{background:#FAF6EE;border:1px dashed #D9CBB0;border-radius:6px;padding:14px 18px;font-size:0.85rem;color:#605142;margin-top:32px;}
  .table-wrap{overflow-x:auto;margin:16px 0;background:#FAF6EE;border:1px solid #D9CBB0;border-radius:6px;}
  table{width:100%;border-collapse:collapse;font-size:0.9rem;}
  th,td{padding:12px 16px;text-align:left;border-bottom:1px solid #E8DCC5;}
  th{color:#6B5A45;font-weight:600;background:#FDFBFA;white-space:nowrap;}
  tr:last-child td{border-bottom:none;}
  td{font-family:'IBM Plex Mono','Courier New',monospace;}
  td:first-child{font-family:inherit;}
</style></head>
<body><div class="wrap">
  <h1>Zero-CAC KPIs</h1>
  <p class="sub">Generated ${kpi.generated_at}. Every number below is computed directly from real D1 data -- nothing here is estimated or fabricated.</p>

  <h2>Viral Coefficient (Early Bird referral loop)</h2>
  <div class="grid">
    ${card('Users who referred someone', kpi.viral.unique_referrers, `${pct(kpi.viral.referrer_rate)} of all users`)}
    ${card('Signups via referral', kpi.viral.referred_signups, `${pct(kpi.viral.viral_coefficient)} of all users`)}
    ${card('Early-access users', kpi.viral.early_access_users, 'referrer + referred, combined')}
  </div>

  <h2>Acquisition Velocity</h2>
  <div class="grid">
    ${card('pSEO signups', kpi.acquisition.pseo_signups, "partner_id = 'pseo' (Step 106)")}
    ${card('Total users', kpi.acquisition.total_users)}
    ${card('Verified users', kpi.acquisition.verified_users)}
    ${card('Active subscribers', kpi.acquisition.active_subscribers, 'is_subscribed = 1 (not sunset-pruned)')}
  </div>

  <h2>Revenue</h2>
  <div class="grid">
    ${card('Booked trips', kpi.revenue.booked_trips, `${pct(kpi.revenue.booking_conversion_rate)} of ${kpi.revenue.total_trips} tracked clicks`)}
    ${card('Total flight revenue', eur(kpi.revenue.total_revenue_eur), 'from reconciled Travelpayouts bookings')}
    ${card('Revenue per active subscriber', eur(kpi.revenue.revenue_per_active_subscriber_eur))}
  </div>

  <h2>Watchlists (Step 115)</h2>
  <div class="grid">
    ${card('Total watchlists', kpi.watchlists.total)}
    ${card('Target reached', kpi.watchlists.notified)}
  </div>

  <h2>Weekly Rollups</h2>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Week</th>
          <th>Signups</th>
          <th>Ref. Signups</th>
          <th>Ref. Share</th>
          <th>Emails Sent</th>
          <th>Opens</th>
          <th>Clicks</th>
          <th>Open Rate</th>
          <th>Click Rate</th>
        </tr>
      </thead>
      <tbody>
        ${(kpi.weekly_events || []).map(row => {
          const openRate = row.emails_sent > 0 ? (row.email_opens / row.emails_sent) : 0;
          const clickRate = row.emails_sent > 0 ? (row.email_clicks / row.emails_sent) : 0;
          const refShare = row.signups > 0 ? ((row.referral_signups || 0) / row.signups) : 0;
          return `
            <tr>
              <td>${row.week}</td>
              <td>${row.signups}</td>
              <td>${row.referral_signups || 0}</td>
              <td>${pct(refShare)}</td>
              <td>${row.emails_sent}</td>
              <td>${row.email_opens}</td>
              <td>${row.email_clicks}</td>
              <td>${pct(openRate)}</td>
              <td>${pct(clickRate)}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  </div>

  <h2>First-14-Day Cohort Engagement</h2>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Signup Week</th>
          <th>Cohort Size</th>
          <th>Engaged Users</th>
          <th>Engagement Rate</th>
        </tr>
      </thead>
      <tbody>
        ${(kpi.cohorts || []).map(row => {
          const rate = row.cohort_size > 0 ? (row.engaged_users / row.cohort_size) : 0;
          return `
            <tr>
              <td>${row.signup_week}</td>
              <td>${row.cohort_size}</td>
              <td>${row.engaged_users}</td>
              <td>${pct(rate)}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  </div>

  <h2>Outbound Clicks by Partner (Weekly)</h2>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Week</th>
          <th>Partner</th>
          <th>Clicks</th>
        </tr>
      </thead>
      <tbody>
        ${(kpi.outbound_clicks || []).map(row => `
          <tr>
            <td>${row.week}</td>
            <td>${row.partner}</td>
            <td>${row.clicks}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <h2>Reported Conversions (Monthly)</h2>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Month</th>
          <th>Partner</th>
          <th>Conversions</th>
          <th>Revenue</th>
        </tr>
      </thead>
      <tbody>
        ${(kpi.partner_conversions || []).map(row => `
          <tr>
            <td>${row.month}</td>
            <td>${row.partner}</td>
            <td>${row.reported_conversions}</td>
            <td>$${row.reported_revenue.toFixed(2)}</td>
          </tr>
        `).join('')}
        ${!(kpi.partner_conversions && kpi.partner_conversions.length) ? '<tr><td colspan="4">No manual conversions reported yet.</td></tr>' : ''}
      </tbody>
    </table>
  </div>

  <p class="gap-note">Not tracked here, by design: organic search impressions and social referral clicks
  (no analytics/Search Console API integration exists yet), co-registration lead volume (Step 108,
  blocked on a SparkLoop/Beehiiv account), and full Away Mode affiliate ARPU (SafetyWing/Bounce/US
  Global Mail are personal referral links with no sub-ID tracking -- see
  step92_revenue_share_tradeoffs.md). Revenue above covers flight bookings only.</p>
</div>
</body></html>`;
}

// Workplan Steps 123-126 (Business Plan V2.0, Module A -- the 45-day sunset policy). Protects the
// domain's sender score by pausing users who haven't opened an email in 45 days, before Gmail/
// Apple Mail start flagging the daily send as spam on their behalf. Only considers accounts old
// enough to have had a real 45-day chance to open something -- a brand-new signup with no
// last_opened_at yet (NULL, since nothing has arrived for them to open) must not be pruned just
// because the column is empty. Idempotent by construction: once is_subscribed flips to 0, the
// WHERE clause below no longer matches that user on a later run, so the goodbye email only ever
// fires once per person, without needing a separate delivery-log table.
const SUNSET_INACTIVE_AFTER_DAYS = 45;

export async function pruneInactiveSubscribers(env) {
  if (!env?.DB) return { pruned: 0 };

  const candidates = await env.DB.prepare(`
    SELECT email FROM users
    WHERE is_subscribed = 1
      AND created_at <= datetime('now', '-' || ? || ' days')
      AND (last_opened_at IS NULL OR last_opened_at <= datetime('now', '-' || ? || ' days'))
  `).bind(SUNSET_INACTIVE_AFTER_DAYS, SUNSET_INACTIVE_AFTER_DAYS).all();

  let pruned = 0;
  for (const candidate of candidates.results || []) {
    const result = await env.DB.prepare(
      'UPDATE users SET is_subscribed = 0 WHERE email = ? AND is_subscribed = 1'
    ).bind(candidate.email).run();
    if (!result?.success || !result.meta?.changes) continue;
    pruned += 1;
    try {
      await sendSunsetEmail({ email: candidate.email }, env);
    } catch (error) {
      console.error(`Sunset email failed for ${candidate.email}:`, error);
    }
  }
  return { pruned };
}

// Workplan Step 115 (Business Plan V2.0, Module B -- target-price watchlists, moved to
// launch-blocker priority given the CTR gap between the general digest (~5%) and personalized
// alerts like this one (35%+ target)). Fires the "Target Reached" email exactly once per
// watchlist -- notified_at IS NULL is both the query filter and the flag flipped right after a
// successful send, the same idempotency shape already used for the sunset pruning above, so no
// separate delivery-log table is needed. Deliberately checks each watchlist against the SAME
// tier-appropriate file a user would actually see on the board (rankedDealsFilename) rather than
// always reading the hourly file -- otherwise a free-tier watchlist would quietly become a
// backdoor to hourly-fresh data the free tier isn't supposed to have.
export async function checkWatchlists(env) {
  if (!env?.DB) return { checked: 0, notified: 0 };

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS watchlists (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      origin_iata TEXT NOT NULL,
      destination TEXT NOT NULL,
      target_price INTEGER NOT NULL,
      notified_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

  const watchlists = await env.DB.prepare(`
    SELECT w.id AS id, w.origin_iata AS origin_iata, w.destination AS destination,
           w.target_price AS target_price, u.email AS email, u.subscription_tier AS subscription_tier
    FROM watchlists w
    JOIN users u ON u.id = w.user_id
    WHERE w.notified_at IS NULL
  `).all();

  const rows = watchlists.results || [];
  if (rows.length === 0) return { checked: 0, notified: 0 };

  const fileCache = new Map();
  let notified = 0;

  for (const row of rows) {
    const tier = row.subscription_tier === 'paid' ? 'paid' : 'free';
    const filename = rankedDealsFilename(tier, row.origin_iata);
    if (!fileCache.has(filename)) {
      fileCache.set(filename, await loadJsonAsset(env, filename));
    }
    const combined = fileCache.get(filename);
    const record = findRouteRecord(combined, row.origin_iata, row.destination);
    if (!record || typeof record.price !== 'number' || record.price > row.target_price) continue;

    const result = await env.DB.prepare(
      "UPDATE watchlists SET notified_at = datetime('now') WHERE id = ? AND notified_at IS NULL"
    ).bind(row.id).run();
    if (!result?.success || !result.meta?.changes) continue;

    try {
      await sendTargetReachedEmail({
        email: row.email,
        origin: row.origin_iata,
        destination: row.destination,
        price: record.price,
        targetPrice: row.target_price,
        bookingLink: record.booking_link,
      }, env);
      await logEvent(env, { event_type: 'alert_email_sent', origin: row.origin_iata, route: row.destination });
      notified += 1;
    } catch (error) {
      console.error(`Target-reached email failed for ${row.email}:`, error);
    }
  }

  return { checked: rows.length, notified };
}

// Workplan Step 93 (2026-09-12): earlyOnly powers the "Early Bird" referral loop's early-access
// digest send. It reuses this same function and the existing daily_alert_deliveries idempotency
// table rather than adding a parallel send path -- an early_access user who already has a
// status='sent' row for today (from the early run) is automatically skipped when the general run
// calls this again later, for free, via the existing per-day dedupe below. This is what makes
// "ahead of the general send" literally true rather than cosmetic: the early run uses a genuinely
// earlier Cron Trigger (see EARLY_DIGEST_CRON / wrangler.jsonc), not just a different sort order
// within one send.
// Workplan Step 109 (GTM Plan Update, Phase 18 -- Early Bird FOMO banner). Snapshots each route's
// price at the 07:00 Early Bird run, keyed by (route_key, snapshot_date), so the 08:00 general run
// can diff against it and tell a recipient their top deal already moved. Per-route, not per-user
// -- both runs currently read from the same `deals` array (see the flagged, separately-tracked
// bug about sendDailyAlerts not actually varying that array by origin yet), so a per-route
// snapshot is the correct granularity regardless of how that gets fixed later.
async function snapshotEarlyBirdPrices(env, deals, snapshotDate) {
  if (!env?.DB) return;
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS early_bird_snapshots (
      route_key TEXT NOT NULL,
      snapshot_date TEXT NOT NULL,
      price INTEGER,
      PRIMARY KEY (route_key, snapshot_date)
    )
  `).run();
  for (const deal of deals) {
    if (!deal.route_key || typeof deal.price !== 'number') continue;
    await env.DB.prepare(`
      INSERT OR REPLACE INTO early_bird_snapshots (route_key, snapshot_date, price) VALUES (?, ?, ?)
    `).bind(deal.route_key, snapshotDate, deal.price).run();
  }
}

async function getEarlyBirdPriceJump(env, deal, snapshotDate) {
  if (!env?.DB || !deal?.route_key || typeof deal.price !== 'number') return null;
  const snapshot = await env.DB.prepare(
    'SELECT price FROM early_bird_snapshots WHERE route_key = ? AND snapshot_date = ?'
  ).bind(deal.route_key, snapshotDate).first();
  if (!snapshot || typeof snapshot.price !== 'number' || snapshot.price >= deal.price) return null;
  return { destination: deal.display_name, from: snapshot.price, to: deal.price };
}

export async function sendDailyAlerts(env, { earlyOnly = false } = {}) {
  // Kill switch for the daily digest (the 07:00 early run and the 08:00 general run), including the
  // sunset pruning and goodbye emails that run at the top of it. Only the exact string "false" turns it
  // off, so a missing variable keeps today's behavior. Flip it in wrangler.jsonc and merge (auto-deploys
  // in about 1 to 2 minutes). It does not touch the other lifecycle emails or the weekly newsletter.
  if (env?.ENABLE_DAILY_DIGEST === 'false') return { sent: 0, skipped: 0, reason: 'daily digest disabled (ENABLE_DAILY_DIGEST=false)' };
  if (!env?.DB) return { sent: 0, skipped: 0, reason: 'DB not configured' };

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS daily_alert_deliveries (
      delivery_key TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      delivered_on TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

  const { pruned } = await pruneInactiveSubscribers(env);

  const isMonday = new Date().getUTCDay() === 1;
  const freqCheck = `(frequency = 'daily' OR frequency = 'instant' ${isMonday ? "OR frequency = 'weekly'" : ""})`;
  const pauseCheck = `(paused_until IS NULL OR datetime(paused_until) < datetime('now'))`;
  
  const users = await env.DB.prepare(earlyOnly
    ? `SELECT id, email, origin_iata FROM users WHERE verified_email = 1 AND unsubscribed_at IS NULL AND is_subscribed = 1 AND early_access = 1 AND ${pauseCheck} AND ${freqCheck}`
    : `SELECT id, email, origin_iata FROM users WHERE verified_email = 1 AND unsubscribed_at IS NULL AND is_subscribed = 1 AND ${pauseCheck} AND ${freqCheck}`
  ).all();
  let sent = 0;
  let skipped = 0;
  const deliveredOn = new Date().toISOString().slice(0, 10);

  // Real bug found and fixed 2026-09-13 (flagged separately mid-session, applied here): this
  // used to load a single shared `deals` array from loadRankedDeals() (always JFK's own file,
  // unconditionally) and send THE SAME content to every subscriber regardless of their real
  // origin_iata -- only the email subject line ever reflected their actual origin. Every
  // non-JFK subscriber had been silently receiving JFK deal content mislabeled with their own
  // origin since the feature was built. Fixed the same way /api/deals and checkWatchlists already
  // pick a file: rankedDealsFilename('free', origin) -- this function has no session/auth
  // context, so free tier is the correct default, same as every other unauthenticated path. A
  // per-run file cache means users sharing an origin don't each trigger a redundant
  // env.ASSETS.fetch().
  const fileCache = new Map();

  for (const user of users.results || []) {
    const deliveryKey = `${user.email}:${deliveredOn}`;
    const alreadySent = await env.DB.prepare(
      'SELECT status FROM daily_alert_deliveries WHERE delivery_key = ? AND status = ?'
    ).bind(deliveryKey, 'sent').first();
    if (alreadySent) {
      skipped += 1;
      continue;
    }

    await env.DB.prepare(`
      INSERT OR REPLACE INTO daily_alert_deliveries
        (delivery_key, email, delivered_on, status, error)
      VALUES (?, ?, ?, 'pending', NULL)
    `).bind(deliveryKey, user.email, deliveredOn).run();

    try {
      const deals = await loadDigestDeals(env, user.origin_iata, fileCache);

      if (deals.length === 0) {
        console.warn(`Daily alert: no eligible deals for origin ${user.origin_iata}; skipping ${user.email}`);
        skipped += 1;
        continue;
      }

      if (earlyOnly) {
        await snapshotEarlyBirdPrices(env, deals, deliveredOn);
      }
      const priceJump = earlyOnly ? null : await getEarlyBirdPriceJump(env, deals[0], deliveredOn);
      const result = await sendDailyDealEmail({
        email: user.email,
        origin: user.origin_iata,
        deals,
        priceJump,
        userId: user.id,
      }, env);
      if (result.ok) {
        await logEvent(env, { event_type: 'alert_email_sent', user_id: user.id, origin: user.origin_iata });
        await env.DB.prepare(
          'UPDATE daily_alert_deliveries SET status = ?, error = NULL WHERE delivery_key = ?'
        ).bind('sent', deliveryKey).run();
        sent += 1;
      }
    } catch (error) {
      console.error(`Daily alert failed for ${user.email}:`, error);
      await env.DB.prepare(
        'UPDATE daily_alert_deliveries SET status = ?, error = ? WHERE delivery_key = ?'
      ).bind('failed', error.message, deliveryKey).run();
    }
  }

  return { sent, skipped, pruned };
}

// Workplan Step 68. Distinct from sendDailyAlerts (deal-alert digest, all verified users) and
// sendAwayModeFollowUpEmail (fires once, immediately on trip click) -- this fires once per trip,
// close to the actual departure date, as a last-chance nudge. DEPARTING_SOON_WINDOW_DAYS=3 is a
// judgment call, not a spec handed down anywhere -- long enough to still act on travel
// insurance/mail-forwarding, close enough to feel like a genuine "coming up soon" reminder.
//
// Deliberately does the day-count math in JS rather than a SQL date-range query: departure_at is
// stored in ISO-8601-with-offset format (e.g. "2026-10-04T15:32:00-04:00", as constructed by the
// flight fetch script), NOT SQLite's own datetime()-generated space-separated format -- comparing
// those two text formats directly in SQL (e.g. `BETWEEN datetime('now') AND datetime('now','+3
// days')`) would be a fragile string comparison across mismatched formats, not a real date
// comparison. The trips table is small enough that fetching all of a user's active trips and
// filtering with real Date parsing in JS is both simpler and actually correct.
const DEPARTING_SOON_WINDOW_DAYS = 3;

export async function sendDepartingSoonAlerts(env) {
  if (!env?.DB) return { sent: 0, skipped: 0, reason: 'DB not configured' };

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS departing_soon_deliveries (
      trip_id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

  const trips = await env.DB.prepare(`
    SELECT trips.trip_id AS trip_id, trips.destination AS destination, trips.departure_at AS departure_at,
           users.email AS email, users.partner_id AS partner_id, users.trip_length AS trip_length,
           users.passenger_count AS passenger_count
    FROM trips
    JOIN users ON users.id = trips.user_id
    WHERE users.unsubscribed_at IS NULL AND (users.paused_until IS NULL OR datetime(users.paused_until) < datetime('now'))
  `).all();

  const now = Date.now();
  let sent = 0;
  let skipped = 0;

  for (const trip of trips.results || []) {
    const departureTime = new Date(trip.departure_at).getTime();
    if (Number.isNaN(departureTime)) {
      skipped += 1;
      continue; // malformed date -- skip rather than guess
    }

    const daysUntil = Math.ceil((departureTime - now) / (24 * 60 * 60 * 1000));
    if (daysUntil < 0 || daysUntil > DEPARTING_SOON_WINDOW_DAYS) {
      skipped += 1;
      continue;
    }

    const alreadySent = await env.DB.prepare(
      'SELECT status FROM departing_soon_deliveries WHERE trip_id = ? AND status = ?'
    ).bind(trip.trip_id, 'sent').first();
    if (alreadySent) {
      skipped += 1;
      continue;
    }

    await env.DB.prepare(`
      INSERT OR REPLACE INTO departing_soon_deliveries (trip_id, email, status, error)
      VALUES (?, ?, 'pending', NULL)
    `).bind(trip.trip_id, trip.email).run();

    try {
      const result = await sendDepartingSoonEmail({
        email: trip.email,
        destination: trip.destination,
        departure_at: trip.departure_at,
        daysUntil,
        partner_id: trip.partner_id,
        trip_id: trip.trip_id,
        trip_length: trip.trip_length,
        passenger_count: trip.passenger_count,
      }, env);
      if (result.ok) {
        await logEvent(env, { event_type: 'alert_email_sent', route: trip.destination });
        await env.DB.prepare(
          'UPDATE departing_soon_deliveries SET status = ?, error = NULL WHERE trip_id = ?'
        ).bind('sent', trip.trip_id).run();
        sent += 1;
      }
    } catch (error) {
      console.error(`Departing-soon alert failed for trip ${trip.trip_id}:`, error);
      await env.DB.prepare(
        'UPDATE departing_soon_deliveries SET status = ?, error = ? WHERE trip_id = ?'
      ).bind('failed', error.message, trip.trip_id).run();
    }
  }

  return { sent, skipped };
}

// Workplan Step 110 (GTM Plan Update, Phase 18 -- "The Stress Valve"), resolved 2026-09-13: an
// ADDITIONAL touchpoint alongside sendAwayModeFollowUpEmail's existing immediate send, not a
// replacement -- see sendStressValveEmail's own comment in src/email.js. Targets 2 days after a
// trip's clicked_at, not its departure_at (this fires early in the trip lifecycle, regardless of
// how far out the actual flight is). A small window (not an exact "=== 2") is used deliberately,
// same reasoning as DEPARTING_SOON_WINDOW_DAYS's own JS-side date math: a real conversion date
// comparison against clicked_at, tolerant of the cron not landing on the exact calendar boundary
// every single day, backed by an idempotent per-trip delivery log so the window can never cause a
// duplicate send.
const STRESS_VALVE_MIN_DAYS = 2;
const STRESS_VALVE_MAX_DAYS = 4;

export async function sendStressValveAlerts(env) {
  if (!env?.DB) return { sent: 0, skipped: 0, reason: 'DB not configured' };

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS stress_valve_deliveries (
      trip_id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

  const trips = await env.DB.prepare(`
    SELECT trips.trip_id AS trip_id, trips.destination AS destination, trips.departure_at AS departure_at,
           trips.clicked_at AS clicked_at, users.email AS email, users.partner_id AS partner_id,
           users.trip_length AS trip_length, users.passenger_count AS passenger_count
    FROM trips
    JOIN users ON users.id = trips.user_id
    WHERE users.unsubscribed_at IS NULL AND (users.paused_until IS NULL OR datetime(users.paused_until) < datetime('now'))
  `).all();

  const now = Date.now();
  let sent = 0;
  let skipped = 0;

  for (const trip of trips.results || []) {
    const clickedTime = new Date(trip.clicked_at).getTime();
    if (Number.isNaN(clickedTime)) {
      skipped += 1;
      continue;
    }

    const daysSinceClick = Math.floor((now - clickedTime) / (24 * 60 * 60 * 1000));
    if (daysSinceClick < STRESS_VALVE_MIN_DAYS || daysSinceClick > STRESS_VALVE_MAX_DAYS) {
      skipped += 1;
      continue;
    }

    const alreadySent = await env.DB.prepare(
      'SELECT status FROM stress_valve_deliveries WHERE trip_id = ? AND status = ?'
    ).bind(trip.trip_id, 'sent').first();
    if (alreadySent) {
      skipped += 1;
      continue;
    }

    await env.DB.prepare(`
      INSERT OR REPLACE INTO stress_valve_deliveries (trip_id, email, status, error)
      VALUES (?, ?, 'pending', NULL)
    `).bind(trip.trip_id, trip.email).run();

    try {
      const result = await sendStressValveEmail({
        email: trip.email,
        destination: trip.destination,
        departure_at: trip.departure_at,
        partner_id: trip.partner_id,
        trip_id: trip.trip_id,
        trip_length: trip.trip_length,
        passenger_count: trip.passenger_count,
      }, env);
      if (result.ok) {
        await env.DB.prepare(
          'UPDATE stress_valve_deliveries SET status = ?, error = NULL WHERE trip_id = ?'
        ).bind('sent', trip.trip_id).run();
        sent += 1;
      }
    } catch (error) {
      console.error(`Stress-valve alert failed for trip ${trip.trip_id}:`, error);
      await env.DB.prepare(
        'UPDATE stress_valve_deliveries SET status = ?, error = ? WHERE trip_id = ?'
      ).bind('failed', error.message, trip.trip_id).run();
    }
  }

  return { sent, skipped };
}

// Workplan Step 111 (GTM Plan Update, Phase 18 -- "The Departure Briefing"), refined 2026-09-13
// by sparkfare_launch_plan.md to be an ADDITION alongside the existing Day-3
// sendDepartingSoonEmail (Step 68, DEPARTING_SOON_WINDOW_DAYS = 3, untouched), not a change to
// it. Targets 7 days before departure -- a separate delivery-log table keyed by trip_id keeps
// this fully independent of the Day-3 alert's own idempotency, so a trip can legitimately receive
// both emails at their respective points in its lifecycle.
const DEPARTURE_BRIEFING_MIN_DAYS = 6;
const DEPARTURE_BRIEFING_MAX_DAYS = 8;

export async function sendDepartureBriefingAlerts(env) {
  if (!env?.DB) return { sent: 0, skipped: 0, reason: 'DB not configured' };

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS departure_briefing_deliveries (
      trip_id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

  const trips = await env.DB.prepare(`
    SELECT trips.trip_id AS trip_id, trips.destination AS destination, trips.departure_at AS departure_at,
           users.email AS email, users.partner_id AS partner_id, users.trip_length AS trip_length,
           users.passenger_count AS passenger_count
    FROM trips
    JOIN users ON users.id = trips.user_id
    WHERE users.unsubscribed_at IS NULL AND (users.paused_until IS NULL OR datetime(users.paused_until) < datetime('now'))
  `).all();

  const now = Date.now();
  let sent = 0;
  let skipped = 0;

  for (const trip of trips.results || []) {
    const departureTime = new Date(trip.departure_at).getTime();
    if (Number.isNaN(departureTime)) {
      skipped += 1;
      continue;
    }

    const daysUntil = Math.ceil((departureTime - now) / (24 * 60 * 60 * 1000));
    if (daysUntil < DEPARTURE_BRIEFING_MIN_DAYS || daysUntil > DEPARTURE_BRIEFING_MAX_DAYS) {
      skipped += 1;
      continue;
    }

    const alreadySent = await env.DB.prepare(
      'SELECT status FROM departure_briefing_deliveries WHERE trip_id = ? AND status = ?'
    ).bind(trip.trip_id, 'sent').first();
    if (alreadySent) {
      skipped += 1;
      continue;
    }

    await env.DB.prepare(`
      INSERT OR REPLACE INTO departure_briefing_deliveries (trip_id, email, status, error)
      VALUES (?, ?, 'pending', NULL)
    `).bind(trip.trip_id, trip.email).run();

    try {
      const result = await sendDepartureBriefingEmail({
        email: trip.email,
        destination: trip.destination,
        departure_at: trip.departure_at,
        partner_id: trip.partner_id,
        trip_id: trip.trip_id,
        trip_length: trip.trip_length,
        passenger_count: trip.passenger_count,
      }, env);
      if (result.ok) {
        await env.DB.prepare(
          'UPDATE departure_briefing_deliveries SET status = ?, error = NULL WHERE trip_id = ?'
        ).bind('sent', trip.trip_id).run();
        sent += 1;
      }
    } catch (error) {
      console.error(`Departure-briefing alert failed for trip ${trip.trip_id}:`, error);
      await env.DB.prepare(
        'UPDATE departure_briefing_deliveries SET status = ?, error = ? WHERE trip_id = ?'
      ).bind('failed', error.message, trip.trip_id).run();
    }
  }

  return { sent, skipped };
}

// Workplan Step 114 (GTM Plan Update, Phase 19 -- "Route Retrospective"). Targets ~2 days after a
// trip's return_at -- re-uses the same tier-aware rankedDealsFilename() helper as checkWatchlists
// so "today's average" means the same thing everywhere it's computed. A route with no current
// data (insufficient_history/no_data, or simply not in today's feed) has nothing to compare
// against, so it's skipped rather than guessed -- it'll simply never get a retrospective, which is
// preferable to a fabricated comparison.
const ROUTE_RETROSPECTIVE_MIN_DAYS = 1;
const ROUTE_RETROSPECTIVE_MAX_DAYS = 4;

export async function sendRouteRetrospectives(env) {
  if (!env?.DB) return { sent: 0, skipped: 0, reason: 'DB not configured' };

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS route_retrospective_deliveries (
      trip_id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

  const trips = await env.DB.prepare(`
    SELECT trips.trip_id AS trip_id, trips.destination AS destination, trips.origin_iata AS origin_iata,
           trips.return_at AS return_at, trips.price_at_click AS price_at_click, trips.price_eur AS price_eur,
           users.email AS email, users.subscription_tier AS subscription_tier
    FROM trips
    JOIN users ON users.id = trips.user_id
    WHERE users.unsubscribed_at IS NULL AND (users.paused_until IS NULL OR datetime(users.paused_until) < datetime('now')) AND trips.return_at IS NOT NULL
  `).all();

  const now = Date.now();
  let sent = 0;
  let skipped = 0;
  const fileCache = new Map();

  for (const trip of trips.results || []) {
    const returnTime = new Date(trip.return_at).getTime();
    if (Number.isNaN(returnTime)) {
      skipped += 1;
      continue;
    }

    const daysSinceReturn = Math.floor((now - returnTime) / (24 * 60 * 60 * 1000));
    if (daysSinceReturn < ROUTE_RETROSPECTIVE_MIN_DAYS || daysSinceReturn > ROUTE_RETROSPECTIVE_MAX_DAYS) {
      skipped += 1;
      continue;
    }

    const alreadySent = await env.DB.prepare(
      'SELECT status FROM route_retrospective_deliveries WHERE trip_id = ? AND status = ?'
    ).bind(trip.trip_id, 'sent').first();
    if (alreadySent) {
      skipped += 1;
      continue;
    }

    const tier = trip.subscription_tier === 'paid' ? 'paid' : 'free';
    const filename = rankedDealsFilename(tier, trip.origin_iata);
    if (!fileCache.has(filename)) {
      fileCache.set(filename, await loadJsonAsset(env, filename));
    }
    const combined = fileCache.get(filename);
    const record = findRouteRecord(combined, trip.origin_iata, trip.destination);
    if (!record || typeof record.median_baseline !== 'number' || record.median_baseline <= 0) {
      skipped += 1;
      continue; // nothing current to compare against -- skip rather than fabricate a comparison
    }

    const lockedPrice = typeof trip.price_eur === 'number' ? trip.price_eur : trip.price_at_click;
    const currentMedian = record.median_baseline;
    const pctDiff = (currentMedian - lockedPrice) / currentMedian;

    await env.DB.prepare(`
      INSERT OR REPLACE INTO route_retrospective_deliveries (trip_id, email, status, error)
      VALUES (?, ?, 'pending', NULL)
    `).bind(trip.trip_id, trip.email).run();

    try {
      const result = await sendRouteRetrospectiveEmail({
        email: trip.email,
        origin: trip.origin_iata,
        destination: trip.destination,
        lockedPrice,
        currentMedian,
        pctDiff,
      }, env);
      if (result.ok) {
        await env.DB.prepare(
          'UPDATE route_retrospective_deliveries SET status = ?, error = NULL WHERE trip_id = ?'
        ).bind('sent', trip.trip_id).run();
        sent += 1;
      }
    } catch (error) {
      console.error(`Route retrospective failed for trip ${trip.trip_id}:`, error);
      await env.DB.prepare(
        'UPDATE route_retrospective_deliveries SET status = ?, error = ? WHERE trip_id = ?'
      ).bind('failed', error.message, trip.trip_id).run();
    }
  }

  return { sent, skipped };
}

// Workplan Step 117 (GTM Plan Update, Phase 19 -- affiliate link health-check). A weekly HEAD
// request against every real partner link in AWAY_MODE_PARTNERS -- a lightweight safeguard
// against exactly the kind of silent link-rot this project has already had to fix reactively
// elsewhere (the disclosure.html/away-mode.html partner-list staleness bugs, 2026-09-13). A
// redirect (3xx) is treated as healthy on its own -- affiliate links routinely redirect through a
// tracking domain to the merchant's real page, that's expected, not a failure. Only an explicit
// 404/410 (link is genuinely gone) or 5xx (server error) counts as broken. `fetch`'s own
// redirect-loop failure (a real "too many redirects" throw) is caught and treated as broken too.

export async function checkAffiliateLinkHealth(env) {
  // Same partner source as the live Away Mode surfaces (D1 `partners` where status = 'live',
  // falling back to the in-memory list), so the check covers exactly what visitors can click.
  const { getAwayModePartners, sendLinkHealthAlertEmail } = await import('./email.js');
  const partners = await getAwayModePartners(env);

  const broken = [];
  let checked = 0;
  for (const partner of partners) {
    // Some templates carry an {IATA} placeholder (Parking Access) that /out/:slug fills in per
    // visitor. Probe with a real airport code, not the literal braces, which always 404s.
    const url = partner.link ? partner.link.replace(/\{IATA\}/g, 'JFK') : partner.link;
    if (!url) continue;
    checked += 1;
    try {
      const resp = await fetch(url, { method: 'HEAD' });
      // Only a genuinely gone link (404/410) or a server error counts. 403/405 are common for
      // HEAD requests against tracking domains and don't mean the link is dead, so alerting on
      // them would just train the operator to ignore this email.
      if (resp.status === 404 || resp.status === 410 || resp.status >= 500) {
        console.warn(`Affiliate link check failed: ${partner.slug || url} returned ${resp.status}`);
        broken.push({ slug: partner.slug, name: partner.name, url, reason: `HTTP ${resp.status}` });
      }
    } catch (e) {
      console.warn(`Affiliate link check error: ${partner.slug || url} - ${e.message}`);
      broken.push({ slug: partner.slug, name: partner.name, url, reason: e.message });
    }
  }

  let alert = null;
  if (broken.length > 0) {
    // A failed alert send must not take down the check itself -- the broken list is still
    // returned (and shown by the manual endpoint) either way.
    try {
      alert = await sendLinkHealthAlertEmail(env, broken);
    } catch (e) {
      console.error('Affiliate link health alert email failed:', e);
      alert = { ok: false, error: e.message };
    }
  }

  return { ok: true, checked, broken, alerted: !!(alert && alert.ok && !alert.mocked) };
}

export async function reconcileBookings(env) {
  if (!env?.TRAVELPAYOUTS_TOKEN) {
    return { ok: true, mocked: true, message: 'TRAVELPAYOUTS_TOKEN not set; reconciliation mocked' };
  }
  if (!env?.DB) {
    return { ok: true, checked: 0, matched: 0, updated: 0 };
  }

  const clicked = await env.DB.prepare(`
    SELECT trip_id FROM trips WHERE status = 'clicked' AND clicked_at >= datetime('now', '-30 days')
  `).all();
  const clickedTripIds = new Set((clicked.results || []).map((row) => row.trip_id));

  if (clickedTripIds.size === 0) {
    return { ok: true, checked: 0, matched: 0, updated: 0 };
  }

  const lookbackDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const response = await fetch('https://api.travelpayouts.com/statistics/v1/execute_query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Access-Token': env.TRAVELPAYOUTS_TOKEN,
    },
    body: JSON.stringify({
      fields: ['sub_id', 'state', 'date', 'price_eur'],
      filters: [
        { field: 'date', op: 'ge', value: lookbackDate },
        { field: 'campaign_id', op: 'eq', value: AVIASALES_CAMPAIGN_ID },
        { field: 'type', op: 'eq', value: 'action' },
      ],
      sort: [{ field: 'date', order: 'desc' }],
      offset: 0,
      limit: 1000,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Travelpayouts statistics API returned ${response.status}: ${text}`);
  }

  const data = await response.json();
  let matched = 0;
  let updated = 0;

  for (const row of data.results || []) {
    if (row.state !== 'paid' || !clickedTripIds.has(row.sub_id)) continue;
    matched += 1;
    // price_eur is Travelpayouts' own figure for this specific paid action -- persisted here so a
    // real per-trip/per-partner revenue-share amount can eventually be computed by joining trips
    // to users.partner_id, instead of being fetched and discarded (see Workplan Step 101).
    const priceEur = typeof row.price_eur === 'number' ? row.price_eur : null;
    const result = await env.DB.prepare(
      "UPDATE trips SET status = 'booked', price_eur = ? WHERE trip_id = ? AND status = 'clicked'"
    ).bind(priceEur, row.sub_id).run();
    if (result?.success && result.meta?.changes > 0) {
      updated += 1;
      try {
        const tripInfo = await env.DB.prepare(`
          SELECT trips.destination AS destination, users.email AS email, users.partner_id AS partner_id,
                 users.trip_length AS trip_length, users.passenger_count AS passenger_count
          FROM trips JOIN users ON users.id = trips.user_id
          WHERE trips.trip_id = ?
        `).bind(row.sub_id).first();
        if (tripInfo?.email) {
          await sendBookingConfirmedEmail({
            email: tripInfo.email,
            destination: tripInfo.destination,
            partner_id: tripInfo.partner_id,
            trip_id: row.sub_id,
            trip_length: tripInfo.trip_length,
            passenger_count: tripInfo.passenger_count,
          }, env);
        }
      } catch (error) {
        console.error('Booking-confirmed email failed:', error);
      }
    }
  }

  return { ok: true, checked: clickedTripIds.size, matched, updated };
}

// N2 (2026-09-25): revenue health monitor. reconcileBookings() above is the one real, automated
// revenue-tracking job in this project (Travelpayouts flight-booking reconciliation) -- like
// every other job in the scheduled() cron handler, an error thrown inside it is only ever
// console.error'd, invisible unless someone happens to be running `wrangler tail` at that exact
// moment. Given this project's own repeated history of silent revenue/data-pipeline failures (the
// missing ASSETS binding, the missing CLERK_JWT_KEY, an empty deals array shipping for months --
// all catalogued elsewhere in CLAUDE.md), the actual revenue pipeline deserves real alerting, not
// a log line nobody is watching. Takes reconcileBookings()'s own result/thrown-error (the caller
// in scheduled() passes whichever it got) rather than re-running reconciliation a second time.
// Data-pipeline freshness limits for the daily health check, in hours. Chosen against observed
// behavior, not the schedules: GitHub runs these workflows late and sometimes skips slots (2026-10: the
// daily fetch started 5 to 7.5 hours after its slot for 12 days; the hourly one has gaps up to about 7.5
// hours). The check runs at 08:00 UTC, when yesterday's daily file is about 20 hours old, so 36 hours
// means "a whole day was missed", and 12 hours for the hourly feed means "stalled for half a day".
export const DATA_FRESHNESS_LIMITS = [
  { file: 'sparkfare_ranked_deals.json', label: 'JFK daily deals', maxAgeHours: 36 },
  { file: 'sparkfare_ranked_deals_other_origins.json', label: 'other-origins daily deals', maxAgeHours: 36 },
  { file: 'sparkfare_hourly_ranked_deals.json', label: 'hourly multi-origin deals', maxAgeHours: 12 },
];

// Reads each ranked-deals file the site and emails serve and reports what is wrong with it: not
// readable, older than its limit, no priced routes at all, or corrupted route keys (the
// "JFK:JFK:Bali" double-prefix bug). Returns { problems, details, skipped }. Without the ASSETS binding
// it reports nothing rather than guessing (tests and local runs have none).
export async function checkDataFreshness(env, now = new Date()) {
  if (!env?.ASSETS) return { problems: [], details: [], skipped: 'ASSETS binding not configured' };
  const problems = [];
  const details = [];
  for (const { file, label, maxAgeHours } of DATA_FRESHNESS_LIMITS) {
    let data = {};
    try {
      data = await loadJsonAsset(env, file);
    } catch (error) {
      data = {};
    }
    const generated = data?.generated_at ? new Date(data.generated_at) : null;
    if (!data || Object.keys(data).length === 0 || !generated || Number.isNaN(generated.getTime())) {
      problems.push(`${label} (${file}) could not be read or has no generated_at, so the board and emails may be serving nothing or stale data.`);
      details.push({ file, ok: false, reason: 'unreadable' });
      continue;
    }
    const ageHours = (now - generated) / (1000 * 60 * 60);
    const records = ['deals', 'featured', 'priced_no_deal', 'insufficient_history', 'no_data']
      .flatMap((bucket) => (Array.isArray(data[bucket]) ? data[bucket] : []));
    const priced = ['deals', 'featured', 'priced_no_deal'].reduce((n, b) => n + (Array.isArray(data[b]) ? data[b].length : 0), 0);
    const doublePrefixed = records.filter((r) => typeof r?.route_key === 'string' && r.route_key.split(':').length > 2).length;
    const detail = { file, ageHours: Math.round(ageHours * 10) / 10, maxAgeHours, priced, doublePrefixed, generated_at: data.generated_at };
    details.push(detail);
    if (ageHours > maxAgeHours) {
      problems.push(`${label} is ${Math.round(ageHours)} hours old (generated ${data.generated_at}); the limit is ${maxAgeHours}. The pipeline that produces ${file} has stalled or been skipped.`);
    }
    if (priced === 0) {
      problems.push(`${label} (${file}) has no priced routes at all: every route is missing data or history.`);
    }
    if (doublePrefixed > 0) {
      problems.push(`${label} (${file}) has ${doublePrefixed} route key(s) with a doubled origin prefix, the corruption that broke non-JFK deals before.`);
    }
  }
  return { problems, details };
}

// Pipeline picture for the weekly standup: file ages and problems, plus the email guard. Never throws.
async function standupPipeline(env) {
  const out = { problems: [], details: [], guard: null };
  try {
    const f = await checkDataFreshness(env);
    out.problems = f.problems;
    out.details = f.details;
  } catch (error) { console.error('standup: freshness failed', error); }
  try {
    if (env?.DB) out.guard = await readSendingGuardStatus(env);
  } catch (error) { console.error('standup: guard status failed', error); }
  return out;
}

async function runWeeklyStandup(env, options = {}) {
  const { sendWeeklyStandupEmail } = await import('./email.js');
  return sendWeeklyStandup(env, { ...options, pipeline: await standupPipeline(env), send: sendWeeklyStandupEmail });
}

export async function checkRevenueHealth(env, reconcileResult) {
  const problems = [];

  if (!env?.TRAVELPAYOUTS_TOKEN) {
    problems.push('TRAVELPAYOUTS_TOKEN is not set -- flight-booking reconciliation is running in mocked mode. No real Travelpayouts conversions are being checked or recorded.');
  } else if (reconcileResult?.error) {
    problems.push(`reconcileBookings() failed: ${reconcileResult.error}`);
  }

  // Manual Away Mode partner revenue (SafetyWing/Bounce/etc. -- personal referral links with no
  // automated sub-ID reporting, see CLAUDE.md's Step 91/92 notes) relies entirely on someone
  // hand-entering rows into partner_conversions (see migrations/0002_partners.sql). This table has
  // no automated writer by design, so "empty" isn't itself a bug -- but flag it as a nudge once
  // the current month is more than a week old and still has nothing recorded, rather than let it
  // silently go unreconciled for an entire month.
  if (env?.DB) {
    try {
      const now = new Date();
      if (now.getUTCDate() > 7) {
        const monthKey = now.toISOString().slice(0, 7); // "2026-09"
        const row = await env.DB.prepare('SELECT COUNT(*) as n FROM partner_conversions WHERE month = ?').bind(monthKey).first();
        if (!row || row.n === 0) {
          problems.push(`No partner_conversions rows recorded yet for ${monthKey} -- Away Mode partner revenue for this month may not have been manually reconciled.`);
        }
      }
    } catch (error) {
      console.error('Revenue health: partner_conversions check failed', error);
    }
  }

  // Data-pipeline freshness: the board, the emails and /check all read these files, so a stalled
  // workflow shows up here instead of as a day-old board nobody notices.
  let freshness = { problems: [], details: [] };
  try {
    freshness = await checkDataFreshness(env);
    problems.push(...freshness.problems);
  } catch (error) {
    console.error('Data freshness check failed:', error);
  }

  // The email circuit breaker silently blocks every guarded email when bounces or complaints spike.
  // Nothing else reports that, so say so here.
  let emailGuard = null;
  if (env?.DB) {
    try {
      emailGuard = await readSendingGuardStatus(env);
      if (emailGuard?.tripped) {
        problems.push(`The email sending guard is tripped (${emailGuard.reason}), so guarded email (digest, verification, lifecycle emails) is being skipped until the 7-day window improves.`);
      }
    } catch (error) {
      console.error('Revenue health: sending guard status check failed', error);
    }
  }

  let alert = null;
  if (problems.length > 0) {
    try {
      alert = await sendRevenueHealthAlertEmail(env, problems);
    } catch (error) {
      console.error('Revenue health alert send failed:', error);
    }
  }

  return { ok: true, healthy: problems.length === 0, problems, alert, freshness: freshness.details, emailGuard };
}

async function getClerkSession(request, env) {
  if (!env?.CLERK_SECRET_KEY) {
    return { configured: false, authenticated: false, user: null };
  }

  try {
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return { configured: true, authenticated: false, user: null };
    }

    const { verifyToken } = await import('@clerk/backend');
    const payload = await verifyToken(token, {
      jwtKey: env.CLERK_JWT_KEY,
      secretKey: env.CLERK_SECRET_KEY,
    });

    return {
      configured: true,
      authenticated: true,
      user: {
        id: payload.sub,
        email: payload.email || null,
      },
    };
  } catch (error) {
    console.error('Clerk verifyToken failed:', error.message);
    return {
      configured: true,
      authenticated: false,
      user: null,
      error: error.message,
    };
  }
}

// Clerk's session token carries no email claim by default, so look the primary address up from
// Clerk's Backend API when we need to create a users row for a signed-in visitor.
async function fetchClerkEmail(env, userId) {
  const { createClerkClient } = await import('@clerk/backend');
  const user = await createClerkClient({ secretKey: env.CLERK_SECRET_KEY }).users.getUser(userId);
  const primary = user.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId) || user.emailAddresses?.[0];
  return primary?.emailAddress || null;
}

// trips.user_id (and watchlists.user_id) REFERENCE users(id) and D1 enforces foreign keys, but a
// users row used to exist only if the visitor had also submitted the alert-signup form. Anyone who
// signed in with Clerk and clicked "Book this fare" first -- including every account created on the
// production Clerk instance, whose ids differ from the old development-instance ids -- hit a
// FOREIGN KEY failure on the trips insert, which the frontend reports as "Something went wrong
// tracking this trip". Make sure the row exists first; if the same email is already stored under
// an older id (e.g. a dev-instance account), re-key that row and its child rows to the new id.
export async function ensureUserRow(env, session, lookupEmail = fetchClerkEmail) {
  if (!env?.DB) return;
  const id = session.user.id;
  const existing = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(id).first();
  if (existing) return;

  const email = (session.user.email || (await lookupEmail(env, id)) || '').trim().toLowerCase();
  if (!email) throw new Error('Could not determine the signed-in user email address');

  const byEmail = await env.DB.prepare('SELECT id FROM users WHERE lower(email) = ?').bind(email).first();
  if (!byEmail) {
    await env.DB.prepare('INSERT INTO users (id, email, verified_email) VALUES (?, ?, 1)').bind(id, email).run();
    return;
  }

  const oldId = byEmail.id;
  const { results } = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all();
  const tables = new Set((results || []).map((r) => r.name));
  const statements = [env.DB.prepare('PRAGMA defer_foreign_keys = on')];
  for (const table of ['trips', 'watchlists', 'push_subscriptions', 'events']) {
    if (tables.has(table)) statements.push(env.DB.prepare(`UPDATE ${table} SET user_id = ? WHERE user_id = ?`).bind(id, oldId));
  }
  statements.push(env.DB.prepare('UPDATE users SET id = ?, verified_email = 1 WHERE id = ?').bind(id, oldId));
  await env.DB.batch(statements);
}

export async function handleRequest(request, env, ctx = { waitUntil: () => {} }) {
  const url = new URL(request.url);

  if (url.pathname.startsWith('/share/') && request.method === 'GET') {
    let trip = null;

    if (url.pathname === '/share/deal') {
      const dest = url.searchParams.get('dest');
      const origin = url.searchParams.get('origin');
      const price = url.searchParams.get('price');
      if (!dest || !origin || !price) return new Response('Missing deal parameters', { status: 400 });
      trip = {
        destination: dest,
        origin_iata: origin,
        price_at_click: price,
        hotel_name: null,
        tour_name: null,
        event_name: null
      };
    } else {
      const tripId = url.pathname.split('/')[2];
      if (!tripId || !env?.DB) return jsonResponse(404, { ok: false, error: 'Not found' });

      trip = await env.DB.prepare(`
        SELECT trip_id, destination, origin_iata, departure_at, price_at_click, hotel_name, tour_name, event_name, is_open
        FROM trips
        WHERE trip_id = ?
      `).bind(tripId).first();
    }

    if (!trip) return new Response('Trip not found', { status: 404 });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Join my Sparkfare trip to ${trip.destination}!</title>
  
  <meta property="og:title" content="Join my Sparkfare trip to ${trip.destination}!">
  <meta property="og:description" content="I'm watching a flight from ${trip.origin_iata} at $${trip.price_at_click}. Open the page to see the fare and join the trip.">
  <meta property="og:image" content="https://images.unsplash.com/photo-1436491865332-7a61a109cc05?q=80&w=1200&auto=format&fit=crop">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
  
  <link rel="icon" type="image/svg+xml" href="/sparkfare_mark.svg">
  <style>
    body { background: #E8DCC5; color: #2E2318; font-family: 'Segoe UI', sans-serif; text-align: center; padding: 50px; }
    .card { background: #FAF6EE; padding: 40px; border-radius: 12px; max-width: 500px; margin: 0 auto; border: 1px solid #D9CBB0; }
    .btn { display: inline-block; background: #E8B930; color: #2B2620; padding: 15px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <svg class="brand-mark" viewBox="0 0 44 44" aria-hidden="true" style="width: 44px; height: 44px; margin: 0 auto 20px;">
      <path d="M8,8 L8,36 L30,36 L27,29 L30,22 L27,15 L30,8 Z" fill="none" stroke="#2B2620" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="18" cy="22" r="3.5" fill="#E8B930"/>
    </svg>
    <h1 style="margin-top:0;">✈️ ${trip.destination}</h1>
    <p><strong>From:</strong> ${trip.origin_iata} • <strong>Flight:</strong> $${trip.price_at_click}</p>
    ${trip.hotel_name ? `<p><strong>Hotel:</strong> ${trip.hotel_name}</p>` : ''}
    ${trip.tour_name ? `<p><strong>Tour:</strong> ${trip.tour_name}</p>` : ''}
    ${trip.event_name ? `<p><strong>Event:</strong> ${trip.event_name}</p>` : ''}
    ${trip.event_name ? `<p><strong>Event:</strong> ${trip.event_name}</p>` : ''}
    <br/>
    ${trip.is_open ? `<a href="/?join=${trip.trip_id}" class="btn">Join this trip</a>` : `<a href="/" class="btn">Build your own Sparkfare trip</a>`}
  </div>
<script src="/site-footer.js" defer></script>
</body>
</html>`;
    return new Response(html, { headers: { 'Content-Type': 'text/html' } });
  }

  if (url.pathname.match(/^\/api\/trips\/[^/]+\/open$/) && request.method === 'PATCH') {
    const session = await getClerkSession(request, env);
    if (!session.authenticated) return jsonResponse(401, { ok: false, error: 'Not authenticated' });

    const tripId = url.pathname.split('/')[3];
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(400, { ok: false, error: 'Request body must be valid JSON' });
    }

    if (env?.DB) {
      await env.DB.prepare(`
        UPDATE trips SET is_open = ? WHERE trip_id = ? AND user_id = ?
      `).bind(body.is_open ? 1 : 0, tripId, session.user.id).run();
    }
    return jsonResponse(200, { ok: true });
  }

  if (url.pathname.match(/^\/api\/trips\/[^/]+\/public$/) && request.method === 'GET') {
    const tripId = url.pathname.split('/')[3];
    if (!env?.DB) return jsonResponse(404, { ok: false, error: 'Not found' });

    const trip = await env.DB.prepare(`
      SELECT trip_id, destination, hotel_name, tour_name, event_name
      FROM trips
      WHERE trip_id = ? AND is_open = 1
    `).bind(tripId).first();

    if (!trip) return jsonResponse(404, { ok: false, error: 'Trip not found or not open' });
    return jsonResponse(200, { ok: true, trip });
  }

  if (url.pathname === '/api/trips' && request.method === 'GET') {
    const session = await getClerkSession(request, env);
    if (!session.authenticated) return jsonResponse(401, { ok: false, error: 'Not authenticated' });

    if (!env?.DB) return jsonResponse(200, { ok: true, trips: [] });

    const result = await env.DB.prepare(`
      SELECT trip_id, destination, origin_iata, departure_at, return_at, price_at_click, clicked_at, status, hotel_name, tour_name, event_name, is_open
      FROM trips
      WHERE user_id = ?
      ORDER BY clicked_at DESC
    `).bind(session.user.id).all();

    return jsonResponse(200, { ok: true, trips: result.results || [] });
  }

  if (url.pathname === '/api/trips' && request.method === 'POST') {
    const session = await getClerkSession(request, env);
    if (!session.authenticated) return jsonResponse(401, { ok: false, error: 'Not authenticated' });

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(400, { ok: false, error: 'Request body must be valid JSON' });
    }

    const { destination, origin_iata, departure_at, return_at, price_at_click, booking_link } = body;
    if (!destination || !origin_iata || !departure_at || price_at_click == null || !booking_link) {
      return jsonResponse(400, { ok: false, error: 'Missing trip fields' });
    }
    if (!VALID_ORIGINS.has(String(origin_iata).toUpperCase())) {
      return jsonResponse(400, { ok: false, error: 'Invalid origin_iata value' });
    }

    const tripId = crypto.randomUUID();
    try {
      await ensureUserRow(env, session);
      const trackedBookingLink = withTripMarker(booking_link, tripId);
      if (env?.DB) {
        await env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS trips (
            trip_id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            destination TEXT NOT NULL,
            origin_iata TEXT NOT NULL,
            departure_at TEXT NOT NULL,
            return_at TEXT,
            price_at_click INTEGER NOT NULL,
            clicked_at TEXT DEFAULT (datetime('now')),
            status TEXT DEFAULT 'clicked',
            price_eur REAL,
            hotel_name TEXT,
            tour_name TEXT,
            event_name TEXT,
            is_open INTEGER DEFAULT 0
          )
        `).run();
        try { await env.DB.prepare("ALTER TABLE trips ADD COLUMN hotel_name TEXT").run(); } catch(e) {}
        try { await env.DB.prepare("ALTER TABLE trips ADD COLUMN tour_name TEXT").run(); } catch(e) {}
        try { await env.DB.prepare("ALTER TABLE trips ADD COLUMN event_name TEXT").run(); } catch(e) {}
        try { await env.DB.prepare("ALTER TABLE trips ADD COLUMN is_open INTEGER DEFAULT 0").run(); } catch(e) {}
        const result = await env.DB.prepare(`
          INSERT INTO trips
            (trip_id, user_id, destination, origin_iata, departure_at, return_at, price_at_click)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          tripId,
          session.user.id,
          destination,
          String(origin_iata).toUpperCase(),
          departure_at,
          return_at || null,
          Number(price_at_click)
        ).run();
        if (!result || result.success === false) throw new Error('Trip insert failed');
      }

      let followUpEmail = session.user.email;
      let followUpPartnerId = null;
      let followUpTripLength = null;
      let followUpPassengerCount = null;
      if (env?.DB) {
        const userRecord = await env.DB.prepare('SELECT email, partner_id, trip_length, passenger_count FROM users WHERE id = ?').bind(session.user.id).first();
        if (userRecord?.email) followUpEmail = userRecord.email;
        if (userRecord) {
          followUpPartnerId = userRecord.partner_id;
          followUpTripLength = userRecord.trip_length;
          followUpPassengerCount = userRecord.passenger_count;
        }
      }
      if (followUpEmail) {
        const sendPromise = sendAwayModeFollowUpEmail({
          email: followUpEmail,
          destination,
          departure_at,
          return_at: return_at || null,
          origin_iata: String(origin_iata).toUpperCase(),
          price_at_click: Number(price_at_click),
          booking_link: trackedBookingLink,
          partner_id: followUpPartnerId,
          trip_id: tripId,
          trip_length: followUpTripLength,
          passenger_count: followUpPassengerCount,
        }, env).catch((error) => {
          console.error('Away Mode follow-up email failed:', error);
        });
        if (ctx?.waitUntil) {
          ctx.waitUntil(sendPromise);
        } else {
          await sendPromise;
        }
      }

      return jsonResponse(200, {
        ok: true,
        trip_id: tripId,
        redirect_url: `/departing/${tripId}?url=${encodeURIComponent(trackedBookingLink)}`,
      });
    } catch (error) {
      console.error('Trip tracking failed:', error);
      return jsonResponse(400, { ok: false, error: error.message || 'Unable to track trip' });
    }
  }

  if (url.pathname === '/api/signup' && request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(400, { ok: false, error: 'Request body must be valid JSON' });
    }

    try {
      const { id, email, origin_iata, passenger_count, trip_length, subscription_tier, partner_id, ref } = body;
      const signupSource = String(body.source || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40) || null;
      const session = await getClerkSession(request, env);
      const userId = session.authenticated ? session.user.id : id;
      const userEmail = session.authenticated ? session.user.email || email : email;

      if (!userId || !userEmail || !origin_iata || !trip_length) {
        return jsonResponse(400, { ok: false, error: 'Missing required fields' });
      }

      if (!VALID_ORIGINS.has(origin_iata.toUpperCase())) {
        return jsonResponse(400, { ok: false, error: 'Invalid origin_iata value' });
      }

      // The tier is never taken from the request: this endpoint is public, so a client-supplied
      // `subscription_tier: "paid"` would hand out a paid tier to anyone (a new row, or any existing
      // email's row on resubmit). A new row is always 'free'; an existing row keeps whatever tier it has.
      // Only a verified payment event may ever set 'paid' (see plus_tier_design_2026-10-07.md).
      const safeTier = 'free';
      const safePassengerCount = normalizePassengerCount(passenger_count);
      const verifiedEmail = session.authenticated ? 1 : 0;
      const newPartnerId = partner_id || null;
      let storedId = userId;
      let storedPartnerId = newPartnerId;
      let storedEarlyAccess = 0;

      if (env?.DB) {
        // F2: consent_log had no CREATE TABLE IF NOT EXISTS guard anywhere. The referral
        // IP-abuse check below (a direct, non-waitUntil'd SELECT against it) sits inside this
        // whole handler's outer try/catch -- a missing table there would throw and fail the
        // ENTIRE signup for anyone arriving via a ?ref= link, not just skip the abuse check.
        await env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS consent_log (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            email TEXT,
            source TEXT,
            wording_version TEXT,
            ip_hash TEXT,
            ts TEXT DEFAULT (datetime('now'))
          )
        `).run();
        const existing = await env.DB.prepare('SELECT id, verified_email, partner_id, early_access FROM users WHERE email = ?').bind(userEmail).first();
        // Only trust a Clerk-verified session to move the primary key / promote verified_email.
        // An unauthenticated resubmit of the public form must never downgrade an already-linked,
        // verified row back to a placeholder local_* id.
        const resolvedId = session.authenticated ? userId : (existing ? existing.id : userId);
        const resolvedVerified = session.authenticated ? 1 : (existing ? existing.verified_email : 0);

        // partner_id is first-touch attribution: an existing row's value is never overwritten by
        // a later resubmit (e.g. updating trip_length directly on the site shouldn't silently
        // erase which publisher originally referred this user).
        storedPartnerId = existing ? existing.partner_id : newPartnerId;

        // Workplan Step 93: the "Early Bird" referral loop. Only ever evaluated for a genuinely
        // NEW signup (never on a resubmit/update) -- ref is a referring user's own id, read off
        // the URL (?ref=<id>) they shared. A self-referral (ref === the new signup's own id) is
        // rejected outright; an unrecognized ref is silently ignored rather than erroring the
        // signup.
        //
        // Workplan Step 130 (Roadmap Q3 2027, "Verified-Only" Early Bird fraud protection):
        // early_access is deliberately NOT granted here anymore. Granting it instantly on signup
        // meant anyone could unlock the referrer's 07:00 UTC VIP digest just by submitting any
        // throwaway address with ?ref=<id> attached -- no proof a real person was behind that
        // inbox. The grant now happens in the /api/webhooks/resend handler, the moment (and only
        // if) this referred user's own email.opened event actually fires -- see that handler for
        // the rest of the story. This request still records `referred_by` so that later event can
        // find its way back to both users; it's a one-time flag either way, not a counter, so
        // referring multiple friends doesn't need to do anything further once it's already set.
        let referredBy = null;
        if (!existing && ref) {
          // Look up user_id from referral_codes
          const referrerRow = await env.DB.prepare('SELECT user_id FROM referral_codes WHERE code = ?').bind(ref).first();
          
          if (referrerRow) {
            const referrerId = referrerRow.user_id;
            
            // Check self-referral and IP abuse
            const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
            const ipHashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
            const ipHash = Array.from(new Uint8Array(ipHashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

            const ipCount = await env.DB.prepare(`
              SELECT count(*) as c FROM consent_log 
              WHERE ip_hash = ? AND source = 'referral_signup'
            `).bind(ipHash).first();
            
            if (referrerId !== userId && (!ipCount || ipCount.c < 3)) {
              referredBy = referrerId;
            }
          }
        } else if (existing) {
          storedEarlyAccess = existing.early_access ?? 0;
        }

        let verificationToken = null;
        if (!session.authenticated && resolvedVerified === 0) {
           verificationToken = crypto.randomUUID();
        }

        const result = existing
          ? await env.DB.prepare(`
              UPDATE users
              SET id = ?, verified_email = ?, origin_iata = ?, passenger_count = ?, trip_length = ?, subscription_tier = COALESCE(?, subscription_tier), unsubscribed_at = NULL, verification_token = ?
              WHERE email = ?
            `).bind(
              resolvedId,
              resolvedVerified,
              origin_iata.toUpperCase(),
              safePassengerCount,
              trip_length,
              null, // COALESCE(NULL, subscription_tier) keeps the existing tier
              verificationToken,
              userEmail
            ).run()
          : await env.DB.prepare(`
              INSERT INTO users (
                id, email, verified_email, origin_iata, passenger_count, trip_length, subscription_tier, partner_id, early_access, referred_by, verification_token
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              userId,
              userEmail,
              verifiedEmail,
              origin_iata.toUpperCase(),
              safePassengerCount,
              trip_length,
              safeTier,
              newPartnerId,
              storedEarlyAccess,
              referredBy,
              verificationToken
            ).run();

        if (!existing && referredBy && result.success !== false) {
           await env.DB.prepare(`
             INSERT INTO referrals (id, referrer_id, referred_id, status)
             VALUES (?, ?, ?, 'pending')
           `).bind(crypto.randomUUID(), referredBy, resolvedId).run();
        }

        storedId = resolvedId;
        ctx.waitUntil(logEvent(env, { event_type: 'signup', user_id: storedId, origin: origin_iata.toUpperCase(), partner: newPartnerId, source: signupSource }));
        if (signupSource === 'leave') {
          ctx.waitUntil(logEvent(env, { event_type: 'leave_signup', user_id: storedId, origin: origin_iata.toUpperCase(), source: 'leave' }));
        }
        if (signupSource === 'check') {
          ctx.waitUntil(logEvent(env, { event_type: 'check_signup', user_id: storedId, origin: origin_iata.toUpperCase(), source: 'check' }));
        }
        if (referredBy) {
          ctx.waitUntil(logEvent(env, { event_type: 'referral_signup', user_id: storedId, origin: origin_iata.toUpperCase(), meta: { referred_by: referredBy } }));
        }

        if (verificationToken) {
          const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
          const ipHashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
          const ipHash = Array.from(new Uint8Array(ipHashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
          
          ctx.waitUntil(env.DB.prepare(`INSERT INTO consent_log (id, user_id, email, source, wording_version, ip_hash) VALUES (?, ?, ?, ?, ?, ?)`).bind(
            crypto.randomUUID(), storedId, userEmail, referredBy ? 'referral_signup' : 'alert_signup', 'v1_double_optin', ipHash
          ).run());

          const verificationUrl = `${env.APP_URL || 'https://sparkfare.com'}/api/verify?token=${verificationToken}`;
          ctx.waitUntil(sendVerificationEmail({ email: userEmail, verificationUrl }, env));
        }

        if (!result || result.success === false) {
          return jsonResponse(500, { ok: false, error: 'Unable to save your alert right now' });
        }
      }

      // T3: generate/fetch referral code so the frontend can build a /r/<code> share link
      // immediately after signup, without requiring a Clerk session.
      let refCode = null;
      if (env.ENABLE_T3_REFERRALS === 'true' && env.DB && storedId) {
        try {
          let codeRow = await env.DB.prepare('SELECT code FROM referral_codes WHERE user_id = ?').bind(storedId).first();
          if (!codeRow) {
            refCode = 'ref_' + Math.random().toString(36).substring(2, 8);
            await env.DB.prepare('INSERT OR IGNORE INTO referral_codes (id, user_id, code) VALUES (?, ?, ?)').bind(crypto.randomUUID(), storedId, refCode).run();
          } else {
            refCode = codeRow.code;
          }
        } catch (e) { console.error('ref_code generation failed:', e); }
      }

      return jsonResponse(200, {
        ok: true,
        user: {
          id: storedId,
          email: userEmail,
          origin_iata: origin_iata.toUpperCase(),
          passenger_count: safePassengerCount,
          trip_length,
          subscription_tier: safeTier,
          partner_id: storedPartnerId,
          early_access: storedEarlyAccess,
          ref_code: refCode,
        },
      });
    } catch (error) {
      console.error('Signup storage failed:', error);
      return jsonResponse(500, { ok: false, error: 'Unable to save your alert right now' });
    }
  }

  if (url.pathname === '/api/session' && request.method === 'GET') {
    const session = await getClerkSession(request, env);
    if (!session.configured) {
      return jsonResponse(200, {
        ok: true,
        configured: false,
        authenticated: false,
        message: 'Clerk secret key not configured yet.',
      });
    }

    return jsonResponse(session.authenticated ? 200 : 401, {
      ok: session.authenticated,
      configured: true,
      authenticated: session.authenticated,
      user: session.user,
    });
  }

  if (url.pathname === '/api/account' && request.method === 'GET') {
    const session = await getClerkSession(request, env);
    if (!session.authenticated) {
      return jsonResponse(401, { ok: false, error: 'Not authenticated' });
    }

    let accountData = {};
    if (env?.DB) {
      try {
        const user = await env.DB.prepare('SELECT origin_iata, passenger_count, trip_length, has_pet, away_needs, frequency, paused_until, notify_email, notify_push FROM users WHERE id = ?').bind(session.user.id).first();
        if (user) {
          accountData = user;
        }
      } catch (error) {
        // B12: frequency/paused_until (and, before 2026-09-23, has_pet/away_needs/notify_email/
        // notify_push) were referenced here before they were ever migrated into the live D1
        // schema -- an uncaught D1 "no such column" error here previously surfaced as a raw
        // Worker exception on account page load, not a clean error. Degrade to empty preferences
        // instead of throwing; the POST /api/preferences guards below self-heal the schema on
        // the next save.
        console.error('/api/account GET error:', error);
      }
    }

    return jsonResponse(200, {
      ok: true,
      user: session.user,
      preferences: accountData,
      account_status: 'active',
      subscription_tier: 'free',
    });
  }

  if (url.pathname === '/api/preferences' && request.method === 'POST') {
    const session = await getClerkSession(request, env);
    if (!session.authenticated) {
      return jsonResponse(401, { ok: false, error: 'Not authenticated' });
    }

    try {
      const body = await request.json();
      const { origin_iata, passenger_count, trip_length, has_pet, away_needs, frequency, paused_until, notify_email, notify_push } = body;

      if (origin_iata && !VALID_ORIGINS.has(origin_iata.toUpperCase())) {
        return jsonResponse(400, { ok: false, error: 'Invalid origin_iata value' });
      }

      // null (not a normalized default) whenever the field is genuinely absent from the payload,
      // so a partial update via COALESCE below preserves whatever the row already had instead of
      // silently resetting it to 1 -- normalizePassengerCount()'s own "default to 1" behavior is
      // only correct for a brand-new row (see /api/signup), not a partial preferences edit.
      const safePassengerCount = (passenger_count === undefined || passenger_count === null || passenger_count === '')
        ? null
        : normalizePassengerCount(passenger_count);
      const updatedOrigin = origin_iata ? origin_iata.toUpperCase() : null;

      let safeAwayNeeds = undefined;
      if (away_needs !== undefined && away_needs !== null) {
        let parsed = [];
        try { parsed = JSON.parse(away_needs); } catch(e) {}
        if (Array.isArray(parsed)) {
          const VALID_KEYS = new Set(['pet', 'insurance', 'bags', 'mail', 'flight_delay', 'data_arrival', 'public_wifi', 'language', 'currency', 'gear', 'parking']);
          safeAwayNeeds = JSON.stringify(parsed.filter(k => VALID_KEYS.has(k)));
        }
      }

      // This previously only echoed the payload back without ever writing to D1 -- a real,
      // pre-existing gap found while wiring passenger_count through to Away Mode email
      // personalization (a preference that's never actually saved can't inform anything
      // downstream). Fixed here rather than left in place, since it directly undermines the
      // point of collecting this data at all.
      if (env?.DB) {
        try { await env.DB.prepare('ALTER TABLE users ADD COLUMN has_pet BOOLEAN DEFAULT 0').run(); } catch(e) {}
        try { await env.DB.prepare('ALTER TABLE users ADD COLUMN away_needs TEXT').run(); } catch(e) {}
        try { await env.DB.prepare('ALTER TABLE users ADD COLUMN notify_email INTEGER DEFAULT 1').run(); } catch(e) {}
        try { await env.DB.prepare('ALTER TABLE users ADD COLUMN notify_push INTEGER DEFAULT 0').run(); } catch(e) {}
        // B12: frequency/paused_until were added to this handler's SELECT/UPDATE without ever
        // being migrated into the live D1 schema -- the 2026-09-23 fix (commit 84c5095) guarded
        // has_pet/away_needs/notify_email/notify_push but missed these two, so every save still
        // threw "no such column: frequency" (masked by the catch block below, or surfaced as its
        // real D1 error message after that fix). Same guard pattern, closing the gap.
        try { await env.DB.prepare("ALTER TABLE users ADD COLUMN frequency TEXT DEFAULT 'daily'").run(); } catch(e) {}
        try { await env.DB.prepare('ALTER TABLE users ADD COLUMN paused_until TEXT').run(); } catch(e) {}

        let updateQuery = `
          UPDATE users SET
            origin_iata = COALESCE(?, origin_iata),
            passenger_count = COALESCE(?, passenger_count),
            trip_length = COALESCE(?, trip_length),
            has_pet = COALESCE(?, has_pet),
            away_needs = COALESCE(?, away_needs),
            frequency = COALESCE(?, frequency),
            notify_email = COALESCE(?, notify_email),
            notify_push = COALESCE(?, notify_push)
        `;
        const binds = [updatedOrigin, safePassengerCount, trip_length ?? null, has_pet ?? null, safeAwayNeeds ?? null, frequency ?? null, notify_email ?? null, notify_push ?? null];
        
        if (paused_until !== undefined) {
          updateQuery += `, paused_until = ?`;
          binds.push(paused_until === 'null' || paused_until === null ? null : paused_until);
        }
        
        updateQuery += ` WHERE id = ?`;
        binds.push(session.user.id);

        await env.DB.prepare(updateQuery).bind(...binds).run();
      }

      return jsonResponse(200, {
        ok: true,
        user_id: session.user.id,
        updated: {
          origin_iata: updatedOrigin,
          passenger_count: safePassengerCount,
          trip_length: trip_length ?? null,
          has_pet: has_pet ?? null,
          away_needs: safeAwayNeeds ?? null,
          frequency: frequency ?? null,
          paused_until: paused_until ?? undefined,
          notify_email: notify_email ?? null,
          notify_push: notify_push ?? null,
        },
      });
    } catch (error) {
      console.error('/api/preferences POST error:', error);
      return jsonResponse(400, { ok: false, error: error.message || 'Failed to save preferences' });
    }
  }

  if (url.pathname === '/api/push/subscribe' && request.method === 'POST') {
    if (env.ENABLE_T7B_PUSH !== 'true') return new Response('Not found', { status: 404 });
    const session = await getClerkSession(request, env);
    if (!session.authenticated) return jsonResponse(401, { ok: false, error: 'Not authenticated' });
    
    try {
      const sub = await request.json();
      if (!sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
        return jsonResponse(400, { ok: false, error: 'Invalid push subscription object' });
      }
      
      await env.DB.prepare(`
        INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth)
        VALUES (?, ?, ?, ?)
        ON CONFLICT (endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth
      `).bind(sub.endpoint, session.user.id, sub.keys.p256dh, sub.keys.auth).run();
      
      return jsonResponse(200, { ok: true });
    } catch (e) {
      return jsonResponse(400, { ok: false, error: 'Bad request' });
    }
  }

  if (url.pathname === '/api/push/unsubscribe' && request.method === 'POST') {
    if (env.ENABLE_T7B_PUSH !== 'true') return new Response('Not found', { status: 404 });
    const session = await getClerkSession(request, env);
    if (!session.authenticated) return jsonResponse(401, { ok: false, error: 'Not authenticated' });
    
    try {
      const { endpoint } = await request.json();
      if (endpoint) {
        await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?')
          .bind(endpoint, session.user.id).run();
      } else {
        await env.DB.prepare('DELETE FROM push_subscriptions WHERE user_id = ?')
          .bind(session.user.id).run();
      }
      return jsonResponse(200, { ok: true });
    } catch (e) {
      return jsonResponse(400, { ok: false, error: 'Bad request' });
    }
  }

  if (url.pathname === '/api/push/vapid-public-key' && request.method === 'GET') {
    if (env.ENABLE_T7B_PUSH !== 'true') return new Response('Not found', { status: 404 });
    if (!env.VAPID_PUBLIC_KEY) return new Response('VAPID not configured', { status: 500 });
    return jsonResponse(200, { publicKey: env.VAPID_PUBLIC_KEY });
  }

  if (url.pathname === '/api/verify' && request.method === 'GET') {
    const token = url.searchParams.get('token');
    if (!token) {
      return new Response('Invalid or missing verification link', { status: 400 });
    }

    if (env?.DB) {
      const user = await env.DB.prepare('SELECT email FROM users WHERE verification_token = ?').bind(token).first();
      if (!user) {
        return new Response('This verification link has expired or is invalid.', { status: 404 });
      }

      const result = await env.DB.prepare('UPDATE users SET verified_email = 1, verification_token = NULL WHERE verification_token = ?').bind(token).run();
      if (!result || result.success === false) {
        return new Response('Failed to verify user', { status: 500 });
      }
    }

    return Response.redirect('https://sparkfare.com/', 302);
  }

  if (url.pathname === '/api/send-daily-alert' && request.method === 'POST') {
    const denied = requireAdmin(request, env);
    if (denied) return denied;
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(400, { ok: false, error: 'Request body must be valid JSON' });
    }

    const { email, origin, deals } = body;
    if (!email || !origin) {
      return jsonResponse(400, { ok: false, error: 'Email and origin are required' });
    }

    try {
      const result = await sendDailyDealEmail({ email, origin, deals: deals || [] }, env);
      return jsonResponse(200, {
        ok: true,
        sent: true,
        mocked: result.mocked || false,
      });
    } catch (error) {
      console.error('Daily alert test send failed:', error);
      return jsonResponse(502, { ok: false, error: error.message || 'Email send failed' });
    }
  }

  // Signed-token unsubscribe (post-click email v2). A GET never changes state, because link
  // scanners and prefetchers follow GET links: it shows a confirm page whose button POSTs back.
  // The one-click POST (List-Unsubscribe-Post) is handled by the POST route below.
  if (url.pathname === '/api/unsubscribe' && request.method === 'GET' && url.searchParams.get('token')) {
    const { verifyUnsubscribeToken, escapeHtml } = await import('./postClickEmail.js');
    const tokenEmail = await verifyUnsubscribeToken(url.searchParams.get('token'), env.UNSUBSCRIBE_SECRET);
    if (!tokenEmail) return new Response('This unsubscribe link is not valid.', { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Unsubscribe</title></head><body style="font-family:Inter,Arial,sans-serif;background:#EDE6D6;color:#2B2620;padding:32px 16px;"><div style="max-width:480px;margin:0 auto;"><h1 style="font-size:22px;font-weight:500;">Unsubscribe from Sparkfare emails?</h1><p style="font-size:16px;line-height:1.5;">This will stop emails to ${escapeHtml(tokenEmail)}.</p><form method="POST" action="/api/unsubscribe?token=${encodeURIComponent(url.searchParams.get('token'))}"><input type="hidden" name="List-Unsubscribe" value="One-Click"><button type="submit" style="font-size:16px;padding:12px 20px;border:0;border-radius:6px;background:#2B2620;color:#FBF8F0;cursor:pointer;">Yes, unsubscribe me</button></form></div></body></html>`, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  // Legacy bare-email link, kept only for emails already sitting in inboxes from before signed links.
  // It proves nothing about who is asking, and scanners follow GET links, so a GET never unsubscribes:
  // it shows a confirm page whose button POSTs back (the one-click branch below). New emails never
  // contain this form of link while UNSUBSCRIBE_SECRET is set.
  if (url.pathname === '/api/unsubscribe' && request.method === 'GET') {
    const email = url.searchParams.get('email');
    if (!email) return new Response('Email is required', { status: 400 });
    return actionPage({
      title: 'Unsubscribe from Sparkfare emails?',
      message: `This will stop emails to ${email}.`,
      action: `/api/unsubscribe?email=${encodeURIComponent(email)}`,
      button: 'Yes, unsubscribe me',
    });
  }

  // Workplan Step 126 (Business Plan V2.0, Module A). One-click, no login required, same
  // discipline as /api/unsubscribe above -- reverses a Step 123-125 sunset pruning by resetting
  // is_subscribed and last_opened_at, so the user gets a fresh 45-day window starting now.
  if (url.pathname === '/api/reactivate' && (request.method === 'GET' || request.method === 'POST')) {
    const token = url.searchParams.get('token');
    if (!token) return actionPage({ title: 'This link is no longer valid', message: 'Open the newest Sparkfare email, or sign in and change your alerts under Preferences.', status: 400 });
    const tokenEmail = await verifyReactivateToken(token, env.UNSUBSCRIBE_SECRET);
    if (!tokenEmail) return actionPage({ title: 'This link is not valid', message: 'Open the newest Sparkfare email, or sign in and change your alerts under Preferences.', status: 400 });

    if (request.method === 'GET') {
      return actionPage({
        title: 'Turn your Sparkfare alerts back on?',
        message: `Daily alerts will resume for ${tokenEmail}.`,
        action: `/api/reactivate?token=${encodeURIComponent(token)}`,
        button: 'Yes, turn them back on',
      });
    }
    if (env?.DB) {
      const result = await env.DB.prepare(
        "UPDATE users SET is_subscribed = 1, last_opened_at = datetime('now') WHERE email = ?"
      ).bind(tokenEmail).run();
      if (!result || result.success === false) {
        return new Response('Unable to reactivate right now', { status: 500 });
      }
    }
    return actionPage({ title: 'Your alerts are back on', message: 'Your Sparkfare daily alerts are back on.' });
  }

  if (url.pathname === '/api/unsubscribe' && request.method === 'POST' && url.searchParams.get('token')) {
    const { verifyUnsubscribeToken } = await import('./postClickEmail.js');
    const tokenEmail = await verifyUnsubscribeToken(url.searchParams.get('token'), env.UNSUBSCRIBE_SECRET);
    if (!tokenEmail) return jsonResponse(400, { ok: false, error: 'Invalid unsubscribe token' });
    if (env?.DB) {
      await env.DB.prepare("UPDATE users SET unsubscribed_at = datetime('now') WHERE email = ?").bind(tokenEmail).run();
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS email_suppressions (
          email TEXT PRIMARY KEY,
          reason TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        )
      `).run();
      await env.DB.prepare('INSERT OR IGNORE INTO email_suppressions (email, reason) VALUES (?, ?)').bind(tokenEmail, 'unsubscribed').run();
    }
    if (wantsHtml(request)) return actionPage({ title: 'You are unsubscribed', message: `Sparkfare emails to ${tokenEmail} have stopped.` });
    return jsonResponse(200, { ok: true, unsubscribed: true });
  }

  if (url.pathname === '/api/unsubscribe' && request.method === 'POST') {
    try {
      let email;
      const contentType = request.headers.get('content-type') || '';
      if (contentType.includes('application/x-www-form-urlencoded')) {
        const formData = await request.formData();
        if (formData.get('List-Unsubscribe') === 'One-Click') {
          email = url.searchParams.get('email');
        }
      } else {
        const body = await request.json();
        email = body.email;
      }

      if (!email) {
        return jsonResponse(400, { ok: false, error: 'Email is required' });
      }

      if (env?.DB) {
        const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
        if (!user) {
          return jsonResponse(404, { ok: false, error: 'User not found' });
        }

        const result = await env.DB.prepare("UPDATE users SET unsubscribed_at = datetime('now') WHERE email = ?").bind(email).run();
        if (!result || result.success === false) {
          return jsonResponse(500, { ok: false, error: 'Failed to unsubscribe user' });
        }
        // F2: email_suppressions had no CREATE TABLE IF NOT EXISTS guard anywhere.
        await env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS email_suppressions (
            email TEXT PRIMARY KEY,
            reason TEXT,
            created_at TEXT DEFAULT (datetime('now'))
          )
        `).run();
        ctx.waitUntil(env.DB.prepare('INSERT OR IGNORE INTO email_suppressions (email, reason) VALUES (?, ?)').bind(email, 'unsubscribed').run());
      }

      if (wantsHtml(request)) return actionPage({ title: 'You are unsubscribed', message: `Sparkfare emails to ${email} have stopped.` });
      return jsonResponse(200, { ok: true, unsubscribed: true, email });
    } catch (error) {
      return jsonResponse(400, { ok: false, error: 'Invalid request body' });
    }
  }

  if (url.pathname === '/api/reconcile-bookings' && request.method === 'POST') {
    const denied = requireAdmin(request, env);
    if (denied) return denied;
    try {
      const result = await reconcileBookings(env);
      return jsonResponse(200, result);
    } catch (error) {
      console.error('Booking reconciliation failed:', error);
      return jsonResponse(502, { ok: false, error: error.message || 'Reconciliation failed' });
    }
  }

  // N2: manual trigger for the revenue health monitor, mirroring /api/reconcile-bookings and
  // /api/check-affiliate-link-health's own manual-test-endpoint pattern. Runs reconciliation
  // itself first so a manual check reflects the real current state, same as the scheduled() cron
  // does, rather than requiring two separate calls.
  // Manual weekly standup (admin only). ?dry=1 returns the metrics and the text without sending anything;
  // otherwise it sends now, even if this week's brief already went out.
  if (url.pathname === '/api/send-weekly-standup' && request.method === 'POST') {
    const denied = requireAdmin(request, env);
    if (denied) return denied;
    try {
      const result = await runWeeklyStandup(env, { dryRun: url.searchParams.get('dry') === '1', force: true });
      return jsonResponse(200, result);
    } catch (error) {
      console.error('Weekly standup failed:', error);
      return jsonResponse(502, { ok: false, error: error.message || 'Weekly standup failed' });
    }
  }

  if (url.pathname === '/api/check-revenue-health' && request.method === 'POST') {
    const denied = requireAdmin(request, env);
    if (denied) return denied;
    try {
      let reconcileResult = null;
      try {
        reconcileResult = await reconcileBookings(env);
      } catch (error) {
        reconcileResult = { error: error.message };
      }
      const result = await checkRevenueHealth(env, reconcileResult);
      return jsonResponse(200, { ...result, reconcileResult });
    } catch (error) {
      console.error('Revenue health check failed:', error);
      return jsonResponse(502, { ok: false, error: error.message || 'Revenue health check failed' });
    }
  }

  if (url.pathname === '/api/send-departing-soon-alerts' && request.method === 'POST') {
    const denied = requireAdmin(request, env);
    if (denied) return denied;
    try {
      const result = await sendDepartingSoonAlerts(env);
      await sendPreDepartureSequenceAlerts(env);
      return jsonResponse(200, result);
    } catch (error) {
      console.error('Departing-soon alert batch failed:', error);
      return jsonResponse(502, { ok: false, error: error.message || 'Departing-soon alerts failed' });
    }
  }

  if (url.pathname === '/admin/metrics' && request.method === 'GET') {
    const authHeader = request.headers.get('Authorization');
    const querySecret = url.searchParams.get('secret');
    if (authHeader !== `Bearer ${env.ADMIN_SECRET}` && querySecret !== env.ADMIN_SECRET) {
      return jsonResponse(401, { ok: false, error: 'Unauthorized' });
    }
    const metrics = await computeKPIs(env);
    return jsonResponse(200, metrics);
  }

  // ROADMAP step 35: Pinterest OAuth + Pin creation, built only for the Standard-access review
  // demo -- not scheduled/auto-posting. Every route below is both flag- and admin-gated except
  // the OAuth callback itself, which Pinterest redirects the browser to directly (it can't carry
  // our admin secret through that redirect) -- its real protection is the `state` cookie match,
  // the same mechanism every OAuth callback relies on instead of a separate secret.
  if (url.pathname.startsWith('/admin/pinterest/') || url.pathname === '/pinterest/callback') {
    if (env.ENABLE_PINTEREST !== 'true') {
      return new Response('Not found', { status: 404 });
    }

    if (url.pathname === '/admin/pinterest/connect' && request.method === 'GET') {
      if (!isAdminAuthorized(request, url, env)) return jsonResponse(401, { ok: false, error: 'Unauthorized' });
      const state = generateState();
      const redirectUri = `${env.APP_URL || 'https://sparkfare.com'}/pinterest/callback`;
      const authorizeUrl = buildAuthorizeUrl({ appId: env.PINTEREST_APP_ID, redirectUri, state });
      return new Response(null, {
        status: 302,
        headers: {
          Location: authorizeUrl,
          // 10-minute window to complete the OAuth round trip; HttpOnly so no page script can
          // read or tamper with it, Secure+Lax since Pinterest's own redirect back is a top-level
          // cross-site GET (Strict would drop the cookie before the callback ever sees it).
          'Set-Cookie': `pinterest_oauth_state=${state}; Max-Age=600; Path=/; HttpOnly; Secure; SameSite=Lax`,
        },
      });
    }

    if (url.pathname === '/pinterest/callback' && request.method === 'GET') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const cookieState = parseCookies(request).pinterest_oauth_state;
      if (!code || !verifyState(state, cookieState)) {
        return new Response('Invalid or expired OAuth state. Start again at /admin/pinterest/connect.', { status: 400 });
      }
      try {
        const redirectUri = `${env.APP_URL || 'https://sparkfare.com'}/pinterest/callback`;
        const tokenData = await exchangeCodeForToken({
          appId: env.PINTEREST_APP_ID,
          appSecret: env.PINTEREST_APP_SECRET,
          code,
          redirectUri,
          apiBase: pinterestApiBase(env),
        });
        const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
        await storePinterestTokens(env, {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresAt,
          scopes: tokenData.scope || PINTEREST_SCOPES,
        });
        return new Response(pinterestStatusHtml({ connected: true, scopes: tokenData.scope || PINTEREST_SCOPES, expiresAt, environment: pinterestEnvName(env) }), {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            // Clear the one-time state cookie now that it's been consumed.
            'Set-Cookie': 'pinterest_oauth_state=; Max-Age=0; Path=/',
          },
        });
      } catch (error) {
        console.error('Pinterest OAuth callback failed:', error.message);
        return new Response(`Pinterest connection failed: ${error.message}`, { status: 502 });
      }
    }

    if (url.pathname === '/admin/pinterest/status' && request.method === 'GET') {
      if (!isAdminAuthorized(request, url, env)) return jsonResponse(401, { ok: false, error: 'Unauthorized' });
      const stored = await getStoredPinterestTokens(env);
      return new Response(
        pinterestStatusHtml(stored ? { connected: true, scopes: stored.scopes, expiresAt: stored.expiresAt, secret: url.searchParams.get('secret') || '', environment: pinterestEnvName(env) } : { connected: false, secret: url.searchParams.get('secret') || '', environment: pinterestEnvName(env) }),
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    if (url.pathname === '/admin/pinterest/boards' && request.method === 'GET') {
      if (!isAdminAuthorized(request, url, env)) return jsonResponse(401, { ok: false, error: 'Unauthorized' });
      try {
        const accessToken = await getValidPinterestAccessToken(env);
        const boards = await listBoards({ accessToken, apiBase: pinterestApiBase(env) });
        const secret = url.searchParams.get('secret') || '';
        return new Response(pinterestBoardsHtml(boards.items || [], secret, pinterestEnvName(env)), {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      } catch (error) {
        return new Response(`Could not list boards: ${error.message}`, { status: 502 });
      }
    }

    if (url.pathname === '/admin/pinterest/board' && request.method === 'POST') {
      if (!isAdminAuthorized(request, url, env)) return jsonResponse(401, { ok: false, error: 'Unauthorized' });
      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse(400, { ok: false, error: 'Invalid JSON body' });
      }
      if (!body?.name || !String(body.name).trim()) return jsonResponse(400, { ok: false, error: 'name is required' });
      try {
        const accessToken = await getValidPinterestAccessToken(env);
        const result = await createBoard({ accessToken, name: body.name, description: body.description || '', apiBase: pinterestApiBase(env) });
        return jsonResponse(result.ok ? 200 : result.status, { ok: result.ok, pinterest_response: result.data });
      } catch (error) {
        return jsonResponse(502, { ok: false, error: error.message });
      }
    }

    if (url.pathname === '/admin/pinterest/pin' && request.method === 'POST') {
      if (!isAdminAuthorized(request, url, env)) return jsonResponse(401, { ok: false, error: 'Unauthorized' });
      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse(400, { ok: false, error: 'Invalid JSON body' });
      }
      const { board_id: boardId, origin, destination } = body;
      if (!boardId || !origin || !destination) {
        return jsonResponse(400, { ok: false, error: 'board_id, origin, and destination are all required' });
      }
      const originUpper = origin.toUpperCase();
      const filename = originUpper === 'JFK' ? 'sparkfare_ranked_deals.json' : 'sparkfare_ranked_deals_other_origins.json';
      const combined = await loadJsonAsset(env, filename);
      const deal = findRouteRecord(combined, originUpper, destination);
      const built = buildPinPayload(deal, {
        origin: originUpper,
        destination,
        appUrl: env.APP_URL || 'https://sparkfare.com',
        boardId,
        dealQualityFn: dealQuality,
      });
      if (!built.ok) {
        return jsonResponse(422, { ok: false, error: built.error });
      }
      try {
        const accessToken = await getValidPinterestAccessToken(env);
        const result = await createPin({ accessToken, payload: built.payload, apiBase: pinterestApiBase(env) });
        // Never swallowed -- Pinterest's own error body (including any Trial-access restriction
        // message) is returned to the admin as-is, per the task's own instruction.
        return jsonResponse(result.ok ? 200 : result.status, { ok: result.ok, pinterest_response: result.data, pin_payload: built.payload });
      } catch (error) {
        return jsonResponse(502, { ok: false, error: error.message });
      }
    }

    return new Response('Not found', { status: 404 });
  }

  if (url.pathname === '/api/referrals/status' && request.method === 'GET') {
    if (env.ENABLE_T3_REFERRALS !== 'true') {
      return jsonResponse(404, { ok: false, error: 'Referrals feature not enabled' });
    }
    const session = await getClerkSession(request, env);
    if (!session.authenticated) return jsonResponse(401, { ok: false, error: 'Not authenticated' });

    let code = 'ref_default';
    let entitlements = { confirmedReferrals: 0, maxOrigins: 1, earlyBird: false, earlyAccessFeatures: false, foundingMemberBadge: false };
    
    if (env?.DB) {
      let codeRow = await env.DB.prepare('SELECT code FROM referral_codes WHERE user_id = ?').bind(session.user.id).first();
      if (!codeRow) {
        code = 'ref_' + Math.random().toString(36).substring(2, 8);
        await env.DB.prepare('INSERT INTO referral_codes (id, user_id, code) VALUES (?, ?, ?)').bind(crypto.randomUUID(), session.user.id, code).run();
      } else {
        code = codeRow.code;
      }
      entitlements = await getEntitlements(env, session.user.id);
    }
    
    return jsonResponse(200, { ok: true, code, link: `${env?.APP_URL || 'https://sparkfare.com'}/r/${code}`, entitlements });
  }

  if (url.pathname === '/api/health') {
    return jsonResponse(200, { ok: true, status: 'healthy' });
  }


  // Workplan Step 124 (Business Plan V2.0, Module A). Resend signs its webhooks using the
  // Standard Webhooks spec (svix-compatible) -- verified here with the same 'standardwebhooks'
  // package Resend's own SDK depends on internally, not a hand-rolled signature check. Refuses
  // to process anything if RESEND_WEBHOOK_SECRET isn't set, rather than silently skipping
  // verification -- accepting unverified webhook data would let anyone forge last_opened_at
  // updates. The secret itself has to come from Resend's own dashboard when the webhook endpoint
  // is registered there; nothing here can generate or guess it.
  if (url.pathname === '/api/webhooks/resend' && request.method === 'POST') {
    if (!env?.RESEND_WEBHOOK_SECRET) {
      return jsonResponse(503, { ok: false, error: 'Webhook not configured' });
    }

    const payload = await request.text();
    // Resend delivers webhooks through Svix, which sends `svix-id` / `svix-timestamp` /
    // `svix-signature`. The Standard Webhooks spec (and the `standardwebhooks` library used to
    // verify) names the same three headers `webhook-*`. The signature scheme is identical, so
    // accept either family. Reading only `webhook-*` meant every real Resend delivery arrived
    // with null headers and was rejected with 401 -- confirmed against live traffic 2026-09-26.
    const headerValue = (name) => request.headers.get(`webhook-${name}`) || request.headers.get(`svix-${name}`);
    const headers = {
      'webhook-id': headerValue('id'),
      'webhook-timestamp': headerValue('timestamp'),
      'webhook-signature': headerValue('signature'),
    };

    let event;
    try {
      const wh = new Webhook(env.RESEND_WEBHOOK_SECRET);
      event = wh.verify(payload, headers);
    } catch (error) {
      return jsonResponse(401, { ok: false, error: 'Invalid signature' });
    }

    // F2: email_suppressions had no CREATE TABLE IF NOT EXISTS guard anywhere -- a missing table
    // here wouldn't break this webhook's 200 response (the inserts below are all ctx.waitUntil'd),
    // but would silently mean a real bounce or spam complaint never actually got suppressed.
    // Awaited directly, not ctx.waitUntil'd, so it's guaranteed to finish before the bounce/
    // complaint branches below fire their own (separately ctx.waitUntil'd) inserts -- two
    // independent waitUntil promises have no ordering guarantee relative to each other.
    if (env?.DB) {
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS email_suppressions (
          email TEXT PRIMARY KEY,
          reason TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        )
      `).run();
    }

    if (event?.type === 'email.clicked' && env?.DB) {
      ctx.waitUntil(logEvent(env, { event_type: 'email_click', meta: { email_id: event.data?.email_id, link: event.data?.click?.link } }));
    }

    if (event?.type === 'email.bounced' && env?.DB) {
      const recipients = event.data?.to || [];
      for (const email of recipients) {
        ctx.waitUntil(env.DB.prepare('INSERT OR IGNORE INTO email_suppressions (email, reason) VALUES (?, ?)').bind(email, 'bounce').run());
      }
      ctx.waitUntil(logEvent(env, { event_type: 'email_bounce', meta: { email_id: event.data?.email_id } }));
    }

    if (event?.type === 'email.complained' && env?.DB) {
      const recipients = event.data?.to || [];
      for (const email of recipients) {
        ctx.waitUntil(env.DB.prepare('INSERT OR IGNORE INTO email_suppressions (email, reason) VALUES (?, ?)').bind(email, 'complaint').run());
      }
      ctx.waitUntil(logEvent(env, { event_type: 'email_complaint', meta: { email_id: event.data?.email_id } }));
    }

    if (event?.type === 'email.opened' && env?.DB) {
      ctx.waitUntil(logEvent(env, { event_type: 'email_open', meta: { email_id: event.data?.email_id } }));
      const recipients = event.data?.to || [];
      for (const recipientEmail of recipients) {
        await env.DB.prepare(
          "UPDATE users SET last_opened_at = datetime('now') WHERE email = ?"
        ).bind(recipientEmail).run();

        
        // T3: Transition pending referrals to confirmed on first email open
        const recipient = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(recipientEmail).first();
        if (recipient) {
          const pendingRef = await env.DB.prepare("SELECT id, referrer_id FROM referrals WHERE referred_id = ? AND status = 'pending'").bind(recipient.id).first();
          if (pendingRef) {
            await env.DB.prepare("UPDATE referrals SET status = 'confirmed', updated_at = datetime('now') WHERE id = ?").bind(pendingRef.id).run();
            // Also update early_access for backward compatibility with tests
            await env.DB.prepare('UPDATE users SET early_access = 1 WHERE id = ?').bind(recipient.id).run();
            await env.DB.prepare('UPDATE users SET early_access = 1 WHERE id = ?').bind(pendingRef.referrer_id).run();
          }
        }
      }
    }

    return jsonResponse(200, { ok: true });
  }

  // GET /api/watchlist -- returns all watchlists for the authenticated user, newest first.
  // Companion to POST /api/watchlist below; added when the watchlist UI was built so the page
  // can render a user's existing watchlists on load without a separate data-fetch endpoint.
  if (url.pathname === '/api/watchlist' && request.method === 'GET') {
    const session = await getClerkSession(request, env);
    if (!session.authenticated) return jsonResponse(401, { ok: false, error: 'Not authenticated' });
    if (!env?.DB) return jsonResponse(200, { ok: true, watchlists: [] });

    const rows = await env.DB.prepare(`
      SELECT id, origin_iata, destination, target_price, notified_at, created_at
      FROM watchlists
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).bind(session.user.id).all();

    return jsonResponse(200, {
      ok: true,
      watchlists: (rows.results || []).map((row) => ({
        id: row.id,
        origin_iata: row.origin_iata,
        destination: row.destination,
        target_price: row.target_price,
        status: row.notified_at ? 'notified' : 'watching',
        notified_at: row.notified_at || null,
        created_at: row.created_at,
      })),
    });
  }

  // Workplan Step 115 (Business Plan V2.0, Module B). Validates destination against the same
  // sparkfare_destinations.json the frontend board already fetches, so a watchlist can't be
  // created for a route Sparkfare doesn't actually curate or track prices for.
  if (url.pathname === '/api/watchlist' && request.method === 'POST') {
    const session = await getClerkSession(request, env);
    if (!session.authenticated) return jsonResponse(401, { ok: false, error: 'Not authenticated' });

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(400, { ok: false, error: 'Request body must be valid JSON' });
    }

    const { origin_iata, destination, target_price } = body;
    if (!origin_iata || !destination || target_price == null) {
      return jsonResponse(400, { ok: false, error: 'Missing watchlist fields' });
    }
    const originIata = String(origin_iata).toUpperCase();
    if (!VALID_ORIGINS.has(originIata)) {
      return jsonResponse(400, { ok: false, error: 'Invalid origin_iata value' });
    }
    const targetPrice = Number(target_price);
    if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
      return jsonResponse(400, { ok: false, error: 'Invalid target_price value' });
    }

    const destinations = await loadJsonAsset(env, 'sparkfare_destinations.json');
    if (!Object.prototype.hasOwnProperty.call(destinations, destination)) {
      return jsonResponse(400, { ok: false, error: 'Unknown destination' });
    }

    if (!env?.DB) return jsonResponse(200, { ok: true, mocked: true });

    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS watchlists (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        origin_iata TEXT NOT NULL,
        destination TEXT NOT NULL,
        target_price INTEGER NOT NULL,
        notified_at TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `).run();

    ctx.waitUntil(logEvent(env, { event_type: 'alert_subscribed', user_id: session.user.id, origin: originIata, route: destination }));
    const watchlistId = crypto.randomUUID();
    const result = await env.DB.prepare(`
      INSERT INTO watchlists (id, user_id, origin_iata, destination, target_price)
      VALUES (?, ?, ?, ?, ?)
    `).bind(watchlistId, session.user.id, originIata, destination, targetPrice).run();
    if (!result || result.success === false) {
      return jsonResponse(502, { ok: false, error: 'Unable to create watchlist' });
    }

    return jsonResponse(200, { ok: true, watchlist_id: watchlistId });
  }

  // ROADMAP step 49: "Is this a good price?" checker. Flag-gated (ENABLE_PRICE_CHECK, default
  // off). Compares a visitor's price with the median of the route's daily lowest cached fares and
  // states the basis; no prediction and no verdict beyond the percentage. Uses the free-tier file
  // for the origin (JFK daily, others 24h-delayed), same as the public board, so a free visitor
  // sees nothing the board wouldn't show them.
  // Away Move 3: builds the Leave-ready plan from six answers. Flag-gated like /leave. Nothing is stored about the
  // visitor: each answered question is logged as an anonymous leave_answer (key and answer, never free text) and the
  // plan as leave_result_view. Partner links come only from the live registry, free route first (see src/leaveReady.js).
  if (url.pathname === '/api/leave/plan' && request.method === 'POST') {
    if (env.ENABLE_LEAVE_READY !== 'true') return jsonResponse(404, { ok: false, error: 'Not found' });
    let body;
    try { body = await request.json(); } catch { return jsonResponse(400, { ok: false, error: 'Request body must be valid JSON' }); }
    const { getAwayModePartners } = await import('./email.js');
    const partners = await getAwayModePartners(env);
    const plan = buildLeaveReadyPlan(body && body.answers, partners);
    for (const key of QUESTION_KEYS) {
      if (plan.answers[key] !== 'skip') ctx.waitUntil(logEvent(env, { event_type: 'leave_answer', source: 'leave', meta: { key, answer: plan.answers[key] } }));
    }
    ctx.waitUntil(logEvent(env, { event_type: 'leave_result_view', source: 'leave', meta: { open: plan.open.length, done: plan.done.length } }));
    return jsonResponse(200, { ok: true, plan: { done: plan.done, open: plan.open, summary: plan.summary } });
  }

  if (url.pathname === '/api/check' && request.method === 'GET') {
    if (env.ENABLE_PRICE_CHECK !== 'true') return jsonResponse(404, { ok: false, error: 'Not found' });
    const rawOrigin = String(url.searchParams.get('origin') || '').trim().toUpperCase();
    const destination = String(url.searchParams.get('dest') || '').trim();
    if (!rawOrigin || !destination || destination.length > 80) {
      return jsonResponse(400, { ok: false, error: 'origin and dest are required' });
    }
    const price = parseCheckPrice(url.searchParams.get('price'));
    if (price === null) {
      return jsonResponse(400, { ok: false, error: 'price must be a positive number' });
    }
    const src = String(url.searchParams.get('src') || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40) || null;
    const respond = (payload) => {
      ctx.waitUntil(logEvent(env, {
        event_type: 'check_run',
        origin: rawOrigin,
        route: destination,
        source: src,
        meta: { status: payload.status, pct: payload.pct_diff ?? null, direction: payload.direction ?? null },
      }));
      return jsonResponse(200, { ok: true, ...payload });
    };

    // TLV is the unmarketed design-partner origin: not offered here either.
    if (!VALID_ORIGINS.has(rawOrigin) || rawOrigin === 'TLV') {
      return respond({ status: 'unsupported_origin', origin: rawOrigin, destination, price });
    }

    const combined = await loadJsonAsset(env, rankedDealsFilename('free', rawOrigin));
    if (!combined || Object.keys(combined).length === 0) {
      return jsonResponse(502, { ok: false, error: 'Deal data not available' });
    }
    const buckets = ['deals', 'featured', 'priced_no_deal', 'insufficient_history', 'no_data'];
    let record = null;
    for (const bucket of buckets) {
      record = (combined[bucket] || []).find((r) => r.origin === rawOrigin && r.display_name === destination) || null;
      if (record) break;
    }
    if (!record) {
      const known = await loadJsonAsset(env, 'sparkfare_destinations.json');
      return respond({
        status: Object.prototype.hasOwnProperty.call(known || {}, destination) ? 'no_data' : 'unsupported_destination',
        origin: rawOrigin, destination, price,
      });
    }
    const result = computePriceCheck(record, price, new Date());
    return respond({ ...result, generated_at: combined.generated_at || null });
  }

  if (url.pathname === '/api/check/share' && request.method === 'POST') {
    if (env.ENABLE_PRICE_CHECK !== 'true') return jsonResponse(404, { ok: false, error: 'Not found' });
    let body = {};
    try { body = await request.json(); } catch { /* an empty body still counts as a share */ }
    const origin = String(body.origin || '').toUpperCase().slice(0, 3) || null;
    const route = String(body.dest || '').slice(0, 80) || null;
    ctx.waitUntil(logEvent(env, { event_type: 'check_share', origin, route }));
    return jsonResponse(200, { ok: true });
  }

  if (url.pathname === '/api/deals' && request.method === 'GET') {
    const origin = String(url.searchParams.get('origin') || '').toUpperCase();
    if (!VALID_ORIGINS.has(origin)) {
      return jsonResponse(400, { ok: false, error: 'Unknown or missing origin' });
    }

    let tier = 'free';
    if (env?.DB) {
      const session = await getClerkSession(request, env);
      if (session.authenticated) {
        const user = await env.DB.prepare('SELECT subscription_tier FROM users WHERE id = ?').bind(session.user.id).first();
        if (user?.subscription_tier === 'paid') tier = 'paid';
      }
    }

    // Paid: genuinely fresher data straight from the hourly multi-origin pipeline (covers all
    // 13 origins, including JFK -- it's fetched hourly there too, just served to free users from
    // JFK's separate always-fresh-daily pipeline instead). Free: unchanged from what's served
    // today -- JFK's own daily file, or the 24h-delayed combined file for every other origin.
    const filename = rankedDealsFilename(tier, origin);

    const combined = await loadJsonAsset(env, filename);
    if (!combined || Object.keys(combined).length === 0) {
      return jsonResponse(502, { ok: false, error: 'Deal data not available' });
    }

    const filtered = filterDealsByOrigin(combined, origin);
    const checked = await applyDealQualityFilter(env, ctx, filtered);

    return jsonResponse(200, {
      ok: true,
      tier,
      origin,
      generated_at: combined.generated_at || null,
      ...checked,
    });
  }

  if (url.pathname === '/api/partners' && request.method === 'GET') {
    if (env?.DB) {
      try {
        const { results } = await env.DB.prepare(`SELECT slug, name, category, url_template as link, commission_note as blurb FROM partners WHERE status = 'live'`).all();
        return jsonResponse(200, { ok: true, partners: results });
      } catch (err) {
        return jsonResponse(500, { ok: false, error: err.message });
      }
    }
    return jsonResponse(500, { ok: false, error: 'No DB' });
  }

  // Workplan Step 113 (GTM Plan Update, Phase 19). Privacy-first: no Clerk session required to
  // click a partner link, so this deliberately reads trip_id/partner_id from the URL's own query
  // string (set when the link was built) rather than requiring authentication just to redirect somewhere.
  
  // Referral link handler
  if (url.pathname.startsWith('/r/')) {
    const code = url.pathname.split('/')[2];
    if (code) {
      // Set a cookie valid for 30 days
      const headers = new Headers();
      headers.set('Set-Cookie', `ref=${code}; Path=/; Max-Age=2592000; SameSite=Lax`);
      headers.set('Location', '/');
      return new Response('', { status: 302, headers });
    }
  }

  // The flight itself: the interstitial's primary button. Logged like every other outbound click,
  // then sent to the tracked Aviasales link carried in ?url=. Only https://www.aviasales.com URLs
  // are accepted, so this cannot be used as an open redirect.
  if (url.pathname === '/out/aviasales') {
    const { sanitizeBookingTarget } = await import('./interstitial.js');
    const target = sanitizeBookingTarget(url.searchParams.get('url'));
    if (!target) return new Response('Bad request', { status: 400 });
    if (ctx?.waitUntil) {
      ctx.waitUntil(logEvent(env, { event_type: 'outbound_click', sub_id: url.searchParams.get('trip_id') || 'anon', partner: 'aviasales', route: url.pathname, source: url.searchParams.get('src') || null, meta: outboundClickMeta(request, url.searchParams.get('slot')) }));
    }
    return Response.redirect(target, 302);
  }

  if (url.pathname.startsWith('/out/') || url.pathname.startsWith('/go/')) {
    const prefix = url.pathname.startsWith('/out/') ? '/out/' : '/go/';
    const affiliateSlug = url.pathname.slice(prefix.length).split('/')[0];
    
    let partner = null;
    if (env?.DB) {
      try {
        partner = await env.DB.prepare(`SELECT * FROM partners WHERE slug = ?`).bind(affiliateSlug).first();
      } catch (err) { console.error('DB fetch partner failed:', err); }
    }
    
    if (!partner) {
      const { getAwayModePartners } = await import('./email.js');
      const partners = await getAwayModePartners(env);
      const memPartner = partners.find(p => p.slug === affiliateSlug);
      if (memPartner) {
        partner = { slug: memPartner.slug, status: 'live', url_template: memPartner.link };
      }
    }
    
    if (!partner) return new Response('Not found', { status: 404 });
    if (partner.status !== 'live') return new Response('Forbidden', { status: 403 });

    if (env?.DB) {
      try {
        // F1: same missing-table gap as logEvent() -- this raw INSERT bypasses that helper
        // entirely, so it needs its own guard rather than inheriting logEvent()'s.
        await env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS events (
            id TEXT PRIMARY KEY,
            event_type TEXT NOT NULL,
            user_id TEXT,
            anon_id TEXT,
            origin TEXT,
            route TEXT,
            partner TEXT,
            sub_id TEXT,
            source TEXT,
            meta TEXT,
            ts TEXT DEFAULT (datetime('now'))
          )
        `).run();
        const subId = url.searchParams.get('trip_id') || url.searchParams.get('partner_id') || 'anon';
        await env.DB.prepare(`
          INSERT INTO events (id, event_type, sub_id, partner, route, source, meta)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          crypto.randomUUID(),
          'outbound_click',
          subId,
          affiliateSlug,
          url.pathname,
          url.searchParams.get('src') || null,
          JSON.stringify(outboundClickMeta(request, url.searchParams.get('slot')))
        ).run();
      } catch (error) {
        console.error('Away Mode click logging failed:', error);
      }
    }

    
    let targetUrl = partner.url_template;
    if (affiliateSlug === 'parking-access') {
      const iata = url.searchParams.get('iata');
      const arrival = url.searchParams.get('arrival');
      const exit = url.searchParams.get('exit');
      if (iata && arrival && exit) {
        targetUrl = `https://parkingaccess.com/search/${iata.toUpperCase()}?arrival=${arrival}&exit=${exit}&rfid=UoznfWZeo8`;
      } else if (iata) {
        targetUrl = `https://parkingaccess.com/go/${iata.toUpperCase()}?rfid=UoznfWZeo8`;
      } else {
        targetUrl = `https://parkingaccess.com/airports?rfid=UoznfWZeo8`;
      }
    }

    return Response.redirect(targetUrl, 302);

  }

  if (url.pathname === '/api/send-stress-valve-alerts' && request.method === 'POST') {
    const denied = requireAdmin(request, env);
    if (denied) return denied;
    try {
      const result = await sendStressValveAlerts(env);
      return jsonResponse(200, result);
    } catch (error) {
      console.error('Stress-valve alert batch failed:', error);
      return jsonResponse(502, { ok: false, error: error.message || 'Stress-valve alerts failed' });
    }
  }

  if (url.pathname === '/api/send-departure-briefing-alerts' && request.method === 'POST') {
    const denied = requireAdmin(request, env);
    if (denied) return denied;
    try {
      const result = await sendDepartureBriefingAlerts(env);
      return jsonResponse(200, result);
    } catch (error) {
      console.error('Departure-briefing alert batch failed:', error);
      return jsonResponse(502, { ok: false, error: error.message || 'Departure-briefing alerts failed' });
    }
  }

  if (url.pathname === '/api/send-route-retrospectives' && request.method === 'POST') {
    const denied = requireAdmin(request, env);
    if (denied) return denied;
    try {
      const result = await sendRouteRetrospectives(env);
      return jsonResponse(200, result);
    } catch (error) {
      console.error('Route retrospective batch failed:', error);
      return jsonResponse(502, { ok: false, error: error.message || 'Route retrospectives failed' });
    }
  }

  if (url.pathname === '/api/send-daily-x-post' && request.method === 'POST') {
    const denied = requireAdmin(request, env);
    if (denied) return denied;
    try {
      const result = await sendDailyXPost(env);
      return jsonResponse(200, result);
    } catch (error) {
      console.error('Daily X post failed:', error);
      return jsonResponse(502, { ok: false, error: error.message || 'Daily X post failed' });
    }
  }



  if (url.pathname === '/api/events' && request.method === 'POST') {
    try {
      const data = await request.json();
      if (!data || !data.event_type) {
        return jsonResponse(400, { ok: false, error: 'Missing event_type' });
      }
      
      const allowedEvents = new Set(['share_click', 'widget_impression', 'referral_signup', 'interstitial_close']);
      if (allowedEvents.has(data.event_type)) {
        ctx.waitUntil(logEvent(env, {
          event_type: data.event_type,
          user_id: data.user_id || null,
          origin: data.origin || null,
          route: data.route || null,
          partner: data.partner || null,
          sub_id: data.sub_id || null,
          source: data.source || null,
          meta: data.meta || null
        }));
      }
      return jsonResponse(200, { ok: true });
    } catch (e) {
      return jsonResponse(400, { ok: false, error: 'Invalid payload' });
    }
  }

  if (url.pathname === '/api/check-affiliate-link-health' && request.method === 'POST') {
    const denied = requireAdmin(request, env);
    if (denied) return denied;
    try {
      const result = await checkAffiliateLinkHealth(env);
      return jsonResponse(200, result);
    } catch (error) {
      console.error('Affiliate link health check failed:', error);
      return jsonResponse(502, { ok: false, error: error.message || 'Link health check failed' });
    }
  }

  // B8: custom 404. Deliberately NOT done via wrangler.jsonc's `not_found_handling` -- that
  // option serves 404.html (or intercepts) at the *assets* layer, before the Worker ever runs,
  // for any path with no run_worker_first match and no static asset. That's exactly the fallback
  // path /flight/*, /og/*, /r/*, /deal/*, /sitemap.xml, /admin/metrics and /share/* all currently
  // rely on to reach this file at all (none of them are in run_worker_first, proven live by the
  // /embed Worker-exception bug fixed in commit 8980665 -- if unmatched paths didn't fall through
  // to the Worker, that bug could never have been observed). Setting not_found_handling would
  // have silently turned every one of those into a 404 response, never reaching their real
  // handlers above. Rendering the custom page here instead, as this function's own last resort,
  // changes nothing about routing -- it only replaces what was already a bare 404 in the exact
  // same fallback case.
  try {
    const html = await loadHtmlAsset(env, '404.html');
    return new Response(html, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  } catch (error) {
    return new Response('Not found', { status: 404 });
  }
}

export async function sendPreDepartureSequenceAlerts(env) {
  if (env.ENABLE_T2B_SEQUENCE !== 'true') {
    return { sent: 0, skipped: 0, reason: 'T2b sequence flag disabled' };
  }
  if (!env?.DB) return { sent: 0, skipped: 0, reason: 'DB not configured' };

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS pre_departure_sequence_deliveries (
      trip_id TEXT,
      stage INTEGER,
      email TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (trip_id, stage)
    )
  `).run();

  const trips = await env.DB.prepare(`
    SELECT trips.trip_id AS trip_id, trips.destination AS destination, trips.departure_at AS departure_at,
           users.email AS email, users.partner_id AS partner_id, users.trip_length AS trip_length,
           users.passenger_count AS passenger_count
    FROM trips
    JOIN users ON users.id = trips.user_id
    WHERE users.unsubscribed_at IS NULL AND (users.paused_until IS NULL OR datetime(users.paused_until) < datetime('now'))
  `).all();

  const now = Date.now();
  let sent = 0;
  let skipped = 0;

  for (const trip of trips.results || []) {
    const departureTime = new Date(trip.departure_at).getTime();
    if (Number.isNaN(departureTime)) {
      skipped += 1;
      continue;
    }

    const daysUntil = Math.ceil((departureTime - now) / (24 * 60 * 60 * 1000));
    let stage = null;
    if (daysUntil === 14) stage = 14;
    else if (daysUntil === 7) stage = 7;
    else if (daysUntil === 1) stage = 1;
    else {
      skipped += 1;
      continue;
    }

    const alreadySent = await env.DB.prepare(
      'SELECT status FROM pre_departure_sequence_deliveries WHERE trip_id = ? AND stage = ? AND status = ?'
    ).bind(trip.trip_id, stage, 'sent').first();
    if (alreadySent) {
      skipped += 1;
      continue;
    }

    await env.DB.prepare(`
      INSERT OR REPLACE INTO pre_departure_sequence_deliveries (trip_id, stage, email, status, error)
      VALUES (?, ?, ?, 'pending', NULL)
    `).bind(trip.trip_id, stage, trip.email).run();

    try {
      const sentLogs = await env.DB.prepare(
        'SELECT partner_id FROM away_mode_email_log WHERE email = ? AND partner_id IS NOT NULL'
      ).bind(trip.email).all();
      const excludedPartnerIds = sentLogs.results ? sentLogs.results.map(r => r.partner_id) : [];

      const result = await sendPreDepartureSequenceEmail({
        email: trip.email,
        destination: trip.destination,
        departure_at: trip.departure_at,
        daysUntil: stage,
        excludedPartnerIds,
        trip_id: trip.trip_id,
        trip_length: trip.trip_length,
        passenger_count: trip.passenger_count,
      }, env);
      
      if (result.ok) {
        await logEvent(env, { event_type: 'away_mode_sequence_sent', route: trip.destination, meta: JSON.stringify({ stage, partner: result.partner_slug }) });
        await env.DB.prepare(
          'UPDATE pre_departure_sequence_deliveries SET status = ?, error = NULL WHERE trip_id = ? AND stage = ?'
        ).bind('sent', trip.trip_id, stage).run();
        sent += 1;
      }
    } catch (error) {
      console.error(`Pre-departure sequence alert failed for trip ${trip.trip_id} stage ${stage}:`, error);
      await env.DB.prepare(
        'UPDATE pre_departure_sequence_deliveries SET status = ?, error = ? WHERE trip_id = ? AND stage = ?'
      ).bind('failed', error.message, trip.trip_id, stage).run();
    }
  }

  return { sent, skipped };
}


async function checkAndLogRoutePromotions(env) {
  const { dealQuality } = await import('./dealQuality.js');

  // F1: same missing-table gap as logEvent() -- this SELECT runs before any INSERT in this
  // function and has no try/catch of its own, so a missing events table threw uncaught here,
  // silently killing route-promotion logging every scheduled run (contained only by the outer
  // try/catch in scheduled(), which just logs it and moves on).
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      user_id TEXT,
      anon_id TEXT,
      origin TEXT,
      route TEXT,
      partner TEXT,
      sub_id TEXT,
      source TEXT,
      meta TEXT,
      ts TEXT DEFAULT (datetime('now'))
    )
  `).run();

  // Get already promoted routes
  const existing = await env.DB.prepare("SELECT route FROM events WHERE event_type = 'route_promoted'").all();
  const promotedSet = new Set(existing.results.map(r => r.route));
  
  // F3: same TLV leak as the sitemap generator above -- excluded from every other public
  // acquisition surface in this codebase.
  const origins = Array.from(VALID_ORIGINS).filter((o) => o !== 'TLV');
  const now = new Date();
  let newCount = 0;

  for (const origin of origins) {
    const raw = await loadJsonAsset(env, `sparkfare_ranked_deals${origin === 'JFK' ? '' : '_other_origins'}.json`);
    // F3: same field-name bug as the sitemap/route-page handler -- deal.destination is always
    // undefined on real records (the field is display_name), so every route in an origin
    // collapsed onto the same "{origin}-undefined" key, meaning only the very first eligible
    // route per origin could ever be logged as promoted. priced_no_deal was also missing, same
    // as the sitemap fix, so this metric was undercounting real indexable routes on two fronts.
    const allDeals = [...(raw.deals || []), ...(raw.featured || []), ...(raw.priced_no_deal || [])].filter(d => d.origin === origin);

    for (const deal of allDeals) {
      const obs = deal.observations || (deal.price_history ? deal.price_history.map(p => ({price: p, date: now.toISOString()})) : []);
      const dq = dealQuality(obs, deal, now);

      if (dq.spanDays >= 14 && dq.baselineN >= 10) {
        const routeKey = `${origin}-${deal.display_name}`;
        if (!promotedSet.has(routeKey)) {
          // Log new promotion
          await env.DB.prepare(`
            INSERT INTO events (id, event_type, route, origin)
            VALUES (?, 'route_promoted', ?, ?)
          `).bind(crypto.randomUUID(), routeKey, origin).run();
          
          promotedSet.add(routeKey);
          console.log(`Promoted route to indexable: ${routeKey}`);
          newCount++;
        }
      }
    }
  }
  return newCount;
}

// Builds the /og/ share card. Kept as a pure, exported function (no WASM, no I/O) so the layout and
// honesty rules can be unit-tested in plain Node; the WASM-dependent rendering stays in the handler.
//
// The claim on a deal card is the record's own `basis_text` (built by dealQuality / the ranking
// script, e.g. "27% below 30-day median, 23 observations") rather than a percentage recomputed
// here: this card used to show a mean-based figure labelled "median", which disagreed with the rest
// of the site. No basis_text means no claim: the generic card is used instead.
export function ogCardHtml({ record, origin, dest, date, generatedAtIso }) {
  if (record && record.status === 'deal' && record.basis_text && record.departure_at && record.departure_at.startsWith(date)) {
    const price = record.price;
    const generatedAt = new Date(generatedAtIso).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' ET';
    // Inter has no emoji glyphs (the old airplane rendered as two "NO GLYPH" boxes), and a long
    // destination wraps: size the route line to its length so the basis and timestamp at the
    // bottom, which the honesty rule requires, can never be pushed off the canvas.
    const routeLabel = `${origin} → ${dest}`;
    const routeSize = routeLabel.length > 30 ? 52 : routeLabel.length > 22 ? 60 : 72;

    return satoriHtml`<div style="display: flex; flex-direction: column; width: 1200px; height: 630px; background-color: #FAF6EE; padding: 56px 72px; justify-content: space-between; font-family: 'Inter';">
        <div style="display: flex; flex-direction: column;">
          <div style="font-size: 34px; color: #6B5A45; text-transform: uppercase; letter-spacing: 4px;">SPARKFARE</div>
          <div style="font-size: ${routeSize}px; color: #2B2620; margin-top: 14px; line-height: 1.15;">${routeLabel}</div>
        </div>
        <div style="display: flex; align-items: baseline;">
          <div style="font-size: 128px; color: #4F7A52;">$${price}</div>
          <div style="font-size: 34px; color: #6B5A45; margin-left: 20px;">round trip</div>
        </div>
        <div style="display: flex; flex-direction: column;">
          <div style="display: flex;">
            <div style="background-color: #E8DCC5; color: #4F7A52; padding: 10px 24px; border-radius: 50px; font-size: 30px;">
              Rare Find: ${record.basis_text}
            </div>
          </div>
          <div style="font-size: 22px; color: #6B5A45; margin-top: 22px;">
            As of ${generatedAt}. Prices may change.
          </div>
        </div>
      </div>`;
  }
  return satoriHtml`<div style="display: flex; flex-direction: column; width: 1200px; height: 630px; background-color: #FAF6EE; padding: 80px; justify-content: center; align-items: center; font-family: 'Inter';">
      <div style="font-size: 64px; color: #6B5A45; text-transform: uppercase; letter-spacing: 4px; margin-bottom: 40px;">SPARKFARE</div>
      <div style="font-size: 96px; color: #2B2620; text-align: center;">Never overpay for flights.</div>
    </div>`;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    if (url.pathname.startsWith('/og/')) {
      const parts = url.pathname.split('/');
      if (parts.length >= 5) {
        const origin = parts[2];
        const dest = decodeURIComponent(parts[3]);
        const date = parts[4];
        
        const tier = 'free';
        const filename = rankedDealsFilename(tier, origin);
        const combined = await loadJsonAsset(env, filename);
        const record = findRouteRecord(combined, origin, dest);
        
        const contentHtml = ogCardHtml({ record, origin, dest, date, generatedAtIso: combined.generated_at });
        
        try {
          if (!wasmInitialized) {
            const wasmModule = await import('@resvg/resvg-wasm/index_bg.wasm');
            await initWasm(wasmModule.default);
            wasmInitialized = true;
          }
          if (!yogaInitialized) {
            const yogaModule = await import('satori/yoga.wasm');
            await initYoga(yogaModule.default);
            yogaInitialized = true;
          }
          const interFontModule = await import('./assets/Inter-Medium.ttf');
          const interFont = interFontModule.default;
          
          const svg = await satori(contentHtml, {
            width: 1200,
            height: 630,
            fonts: [
              {
                name: 'Inter',
                data: interFont,
                weight: 500,
                style: 'normal',
              },
            ],
          });
          const resvg = new Resvg(svg);
          const pngData = resvg.render();
          const pngBuffer = pngData.asPng();
          return new Response(pngBuffer, {
            headers: {
              'Content-Type': 'image/png',
              'Cache-Control': 'public, max-age=3600',
            },
          });
        } catch (e) {
            console.error('Image gen error', e);
            return new Response('Error generating image', { status: 500 });
        }
      }
    }

    if (url.pathname.startsWith('/deal/')) {
      const parts = url.pathname.split('/');
      if (parts.length >= 5) {
        const origin = parts[2];
        const dest = decodeURIComponent(parts[3]);
        const date = parts[4];
        
        await logEvent(env, { event_type: 'share_click', origin: origin, route: dest, source: url.searchParams.get('ref') });
        
        const ogUrl = `https://${url.host}/og/${origin}/${encodeURIComponent(dest)}/${date}`;
        
        const htmlText = `<!doctype html>
        <html>
        <head>
          <title>${origin} to ${dest} | Sparkfare Deals</title>
          <meta property="og:title" content="${origin} to ${dest} Deal" />
          <meta property="og:description" content="Sparkfare found a rare deal from ${origin} to ${dest}." />
          <meta property="og:image" content="${ogUrl}" />
          <meta property="og:url" content="${url.href}" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:image" content="${ogUrl}" />
          <meta http-equiv="refresh" content="0; url=/?origin=${origin}" />
        </head>
        <body>
          <p>Redirecting you to the deal...</p>
        </body>
        </html>`;
        
        return new Response(htmlText, { headers: { 'Content-Type': 'text/html' } });
      }
    }

    if (url.pathname === '/api/stats/deals') {
       const [jfk, others] = await Promise.all([
          loadJsonAsset(env, 'sparkfare_ranked_deals.json'),
          loadJsonAsset(env, 'sparkfare_ranked_deals_other_origins.json'),
       ]);
       const allRecords = [
          ...(jfk.deals || []),
          ...(others.deals || []),
       ];
       const dealCount = allRecords.length;
       return jsonResponse(200, { dealCount, message: `Deals spotted below their 30-day median: ${dealCount}` });
    }

    if (url.pathname.startsWith('/departing/')) {
      const tripId = url.pathname.split('/')[2];
      const trip = { tripId, destination: 'your destination', target: url.searchParams.get('url') };

      if (env?.DB && tripId) {
        try {
          const row = await env.DB.prepare('SELECT destination, origin_iata, departure_at, return_at, price_at_click, clicked_at FROM trips WHERE trip_id = ?').bind(tripId).first();
          if (row) {
            trip.destination = row.destination;
            trip.origin_iata = row.origin_iata;
            trip.departure_at = row.departure_at;
            trip.return_at = row.return_at;
            trip.price = row.price_at_click;
            trip.clickedAt = row.clicked_at;
          }
        } catch (err) {
          console.error("Failed to load trip for interstitial:", err);
        }
        if (ctx?.waitUntil) ctx.waitUntil(logEvent(env, { event_type: 'interstitial_view', sub_id: tripId, route: url.pathname }));
      }

      const { interstitialHtml } = await import('./interstitial.js');
      return new Response(interstitialHtml(trip), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    // Workplan Step 116 ("The Sparkfare Index"). Rendered from the Worker, like /departing/
    // above, rather than as a static asset -- avoids any risk of the same kind of static-asset
    // path-collision/redirect surprise already hit once with /blog/*.html (Cloudflare treating
    // "/index" specially the way it treats a directory's own index.html is a real, untested risk;
    // rendering it dynamically sidesteps the question entirely).
    if (url.pathname === '/index') {
      const data = await computePriceGougingWatchlist(env);
      return new Response(priceGougingIndexHtml(data), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    // Workplan Step 122 (Zero-CAC KPI dashboard). Unlike /index above, this reveals real business
    // metrics (revenue, referral/acquisition volume) -- not meant for public consumption, so it's
    // gated behind a shared secret query param rather than served openly. There's no admin-role
    // concept anywhere in this project's D1 schema yet, so a full Clerk-based admin auth system
    // would be new scope well beyond "build the dashboard" -- a secret-gated route matches the
    // existing precedent already used for POST /api/webhooks/resend.
    if (url.pathname === '/kpi') {
      const providedKey = url.searchParams.get('key');
      if (!env?.KPI_DASHBOARD_SECRET || providedKey !== env.KPI_DASHBOARD_SECRET) {
        return new Response('Not found', { status: 404 });
      }
      const kpi = await computeKPIs(env);
      if (!kpi) return new Response('KPI data not available', { status: 502 });
      
      if (url.searchParams.get('json') === '1') {
        return jsonResponse(200, kpi);
      }
      return new Response(kpiDashboardHtml(kpi), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    if (url.pathname === '/api/admin/trigger-newsletter' && request.method === 'POST') {
      const providedKey = url.searchParams.get('key');
      if (!env?.KPI_DASHBOARD_SECRET || providedKey !== env.KPI_DASHBOARD_SECRET) {
        return new Response('Not found', { status: 404 });
      }
      
      let payload;
      try {
        payload = await request.json();
      } catch {
        return jsonResponse(400, { ok: false, error: 'Invalid JSON payload' });
      }

      if (env?.DB) {
        const { sendSundayNewsletter } = await import('./email.js');
        for (const [origin, data] of Object.entries(payload)) {
          const users = await env.DB.prepare(`SELECT id, email, notify_email, notify_push FROM users WHERE origin_iata = ? AND verified_email = 1 AND COALESCE(is_subscribed, 1) = 1 AND unsubscribed_at IS NULL AND (paused_until IS NULL OR datetime(paused_until) < datetime('now'))`).bind(origin).all();
          if (users.results && users.results.length > 0) {
            ctx.waitUntil(sendSundayNewsletter(env, users.results, data));
          }
        }
      }
      return jsonResponse(200, { ok: true });
    }


    // T5: Programmatic route pages
    if (url.pathname.startsWith('/flight/')) {
      const parts = url.pathname.split('/');
      if (parts.length === 4) {
        const origin = parts[2].toUpperCase();
        // F3: real ranked-deals records have no `destination` field at all -- the field is
        // `display_name` (e.g. "Larnaca, Cyprus"), matched case-sensitively, and findRouteRecord()
        // (already used correctly elsewhere in this file, e.g. for watchlists/route
        // retrospectives) is the existing, proven lookup for it -- covers deals/featured/
        // priced_no_deal, not just the first two. Decode rather than uppercase: display_name is
        // mixed-case and the sitemap below encodes it verbatim via encodeURIComponent.
        const destination = decodeURIComponent(parts[3]);

        if (VALID_ORIGINS.has(origin)) {
          const raw = await loadJsonAsset(env, `sparkfare_ranked_deals${origin === 'JFK' ? '' : '_other_origins'}.json`);
          const targetDeal = findRouteRecord(raw, origin, destination);

          if (targetDeal) {
            const now = new Date();
            const obs = targetDeal.observations || (targetDeal.price_history ? targetDeal.price_history.map(p => ({price: p, date: now.toISOString()})) : []);
            const dq = dealQuality(obs, targetDeal, now);
            
            // Thin-page policy: must have >= 14 days history and >= 10 observations
            const isThin = dq.spanDays < 14 || dq.baselineN < 10;
            
            // Re-run guardrail to make sure we don't show stale/invalid basis
            if (dq.eligible) {
              targetDeal.basis_text = dq.basis_text;
            } else {
              targetDeal.basis_text = '';
            }

            const { getAwayModePartners } = await import('./email.js');
            const activePartners = await getAwayModePartners(env);
            
            const partnersHtml = activePartners.map(p => `
              <li>
                <span class="partner-name">${p.name}</span>
                <span class="partner-blurb">${p.category} — ${p.blurb || 'Recommended partner'}</span>
                <a class="partner-link" href="/out/${p.slug}" rel="sponsored nofollow noopener">${viewOnPartnerLabel(p.name)}</a>
              </li>
            `).join('');

            return new Response(renderRoutePage(targetDeal, origin, destination, partnersHtml, isThin, env), {
              headers: { 'Content-Type': 'text/html; charset=utf-8' }
            });
          }
        }
      }
      return new Response('Route not found', { status: 404 });
    }

    if (url.pathname === '/digest' || url.pathname.startsWith('/digest/')) {
      const appUrl = env.APP_URL || 'https://sparkfare.com';
      return handleDigestRequest(url, env, { appUrl, buildConfig: () => buildArchiveConfig(env, { appUrl }) });
    }

    if (url.pathname === '/sitemap-digest.xml') {
      return renderDigestSitemap(env, { appUrl: env.APP_URL || 'https://sparkfare.com' });
    }

    // ROADMAP step 49: the /check page. Flag-gated like /hub. A URL carrying a result (?o=&d=&p=)
    // is noindex: the page recomputes it live on load, so it is a view, not content to index.
    if (url.pathname === '/check') {
      if (env.ENABLE_PRICE_CHECK !== 'true') {
        return new Response('Not found', { status: 404 });
      }
      let html = await loadHtmlAsset(env, 'check.html');
      html = html.replace('<!--ROBOTS-->', url.search ? '<meta name="robots" content="noindex">' : '');
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    // Away Move 3 (ROADMAP step 55): the Leave-ready page. Flag-gated (ENABLE_LEAVE_READY, default off: 404),
    // mirroring /check. The page view is logged as leave_view; /api/leave/plan builds the plan.
    if (url.pathname === '/leave') {
      if (env.ENABLE_LEAVE_READY !== 'true') {
        return new Response('Not found', { status: 404 });
      }
      if (request.method === 'GET') ctx.waitUntil(logEvent(env, { event_type: 'leave_view', source: url.searchParams.get('src') ? String(url.searchParams.get('src')).toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40) : null }));
      const html = await loadHtmlAsset(env, 'leave.html');
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    if (url.pathname === '/hub' || url.pathname === '/reward-terms') {
      if (env.ENABLE_T3_REFERRALS !== 'true') {
        return new Response('Not found', { status: 404 });
      }
      const filename = url.pathname === '/hub' ? 'hub.html' : 'reward-terms.html';
      const html = await loadHtmlAsset(env, filename);
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    // /sitemap-routes.xml is the path that actually reaches this handler in production: a static
    // sitemap.xml (pSEO /data/ pages + blog) ships as an asset and shadows /sitemap.xml, since that
    // path isn't in wrangler.jsonc's run_worker_first. /sitemap.xml stays matched here so direct
    // Worker calls (and the existing test) keep working.
    if (url.pathname === '/sitemap.xml' || url.pathname === '/sitemap-routes.xml') {
      let urls = [];
      // F3: VALID_ORIGINS includes TLV (a design-partner testing origin, deliberately
      // de-prioritized/not-marketed -- see CLAUDE.md's "Decisions locked" section). Every other
      // public acquisition surface in this codebase (the pSEO generator, the Sparkfare Index
      // dashboard) explicitly excludes it from what actually gets marketed/indexed; this sitemap
      // hadn't been, which would have publicly advertised TLV routes to search engines.
      const origins = Array.from(VALID_ORIGINS).filter((o) => o !== 'TLV');

      const now = new Date();
      for (const origin of origins) {
        const raw = await loadJsonAsset(env, `sparkfare_ranked_deals${origin === 'JFK' ? '' : '_other_origins'}.json`);
        // F3: real records have no `destination` field (it's `display_name`) -- deal.destination
        // was always undefined, so every URL below collapsed to the same bogus ".../undefined"
        // link, and priced_no_deal (the single largest real-data bucket -- 18 JFK routes, 119
        // more across the other origins) was never even considered, despite plenty of those
        // having well over the 10-observation/14-day thin-page bar. findRouteRecord()'s own
        // three-bucket coverage (deals/featured/priced_no_deal) is the existing correct pattern.
        const allDeals = [...(raw.deals || []), ...(raw.featured || []), ...(raw.priced_no_deal || [])].filter(d => d.origin === origin);

        for (const deal of allDeals) {
          const obs = deal.observations || (deal.price_history ? deal.price_history.map(p => ({price: p, date: now.toISOString()})) : []);
          const dq = dealQuality(obs, deal, now);

          if (dq.spanDays >= 14 && dq.baselineN >= 10) {
            urls.push(`https://sparkfare.com/flight/${origin}/${encodeURIComponent(deal.display_name)}`);
          }
        }
      }
      
      // Remove duplicates
      urls = [...new Set(urls)];
      
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${urls.map(u => `
  <url>
    <loc>${u}</loc>
    <changefreq>daily</changefreq>
  </url>`).join('')}
</urlset>`;

      return new Response(xml.trim(), {
        headers: { 
          'Content-Type': 'application/xml',
          'Cache-Control': 'public, max-age=14400'
        }
      });
    }


    // T6: Embeddable Widget Generator
    if (url.pathname === '/embed') {
      // embed.html has never existed in this repo (the working embeddable widget is /widget), so
      // this threw 'Asset not found' -> Cloudflare error 1101 on every request. If the asset is
      // absent, fall through to the normal custom 404 instead of crashing.
      try {
        const html = await loadHtmlAsset(env, 'embed.html');
        return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      } catch (err) {
        console.warn('/embed: no embed.html asset, serving 404:', err.message);
      }
    }

    // T6: Widget Embed UI
    if (url.pathname === '/widget') {
      const html = await loadHtmlAsset(env, 'widget.html');
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    // T6: Widget API Endpoint
    if (url.pathname.startsWith('/api/widget/')) {
      const parts = url.pathname.split('/');
      if (parts.length === 5) {
        const origin = parts[3].toUpperCase();
        const dest = decodeURIComponent(parts[4]).toUpperCase();
        
        if (VALID_ORIGINS.has(origin)) {
          // IP Rate Limiting (100 requests per hour per origin per IP)
          const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
          const nowSeconds = Math.floor(Date.now() / 1000);
          const windowStart = nowSeconds - 3600; // 1 hour window
          
          if (env.DB) {
            try {
              // Purge old limits
              await env.DB.prepare('DELETE FROM widget_rate_limits WHERE window_start < ?').bind(windowStart).run();
              
              const record = await env.DB.prepare('SELECT request_count FROM widget_rate_limits WHERE ip_hash = ? AND origin = ?').bind(ip, origin).first();
              
              if (record && record.request_count >= 100) {
                return new Response('Rate limit exceeded', { status: 429 });
              }
              
              await env.DB.prepare(`
                INSERT INTO widget_rate_limits (ip_hash, origin, request_count, window_start)
                VALUES (?, ?, 1, ?)
                ON CONFLICT(ip_hash, origin) DO UPDATE SET request_count = request_count + 1
              `).bind(ip, origin, nowSeconds).run();
            } catch (e) {
              console.error('Rate limiting error:', e);
            }
          }

          const raw = await loadJsonAsset(env, `sparkfare_ranked_deals${origin === 'JFK' ? '' : '_other_origins'}.json`);
          const dealList = raw.deals || [];
          // Real ranked-deals records carry `display_name` (e.g. "Paris, France"), never a
          // `destination` field -- matching on `.destination` made every lookup throw/miss (same
          // class of bug as the T5 route pages, F3). `dest` is already upper-cased above, so
          // compare case-insensitively.
          const matchesRoute = (d) =>
            d.origin === origin && typeof d.display_name === 'string' && d.display_name.toUpperCase() === dest;
          const targetDeal = dealList.find(matchesRoute) || (raw.featured || []).find(matchesRoute) || null;

          if (targetDeal) {
            const now = new Date();
            const obs = targetDeal.observations || (targetDeal.price_history ? targetDeal.price_history.map(p => ({price: p, date: now.toISOString()})) : []);
            const { dealQuality } = await import('./dealQuality.js');
            const dq = dealQuality(obs, targetDeal, now);
            
            if (dq.eligible) {
              targetDeal.basis_text = dq.basis_text;
              return jsonResponse(200, { ok: true, deal: targetDeal }, { 'Cache-Control': 'public, max-age=3600' });
            } else {
              return jsonResponse(404, { ok: false, error: 'Deal not currently eligible' });
            }
          } else {
            return jsonResponse(404, { ok: false, error: 'Deal not found' });
          }
        }
      }
      return jsonResponse(400, { ok: false, error: 'Invalid origin or destination' });
    }

    return handleRequest(request, env, ctx);
  },
  async scheduled(event, env) {
    if (event.cron === DAILY_FETCH_TRIGGER_CRON) {
      try {
        await dispatchDailyFetch(env);
      } catch (error) {
        console.error('Daily fetch dispatch threw:', error);
      }
      return;
    }
    // Workplan Step 117: the weekly link-health check runs on its own, separate cron
    // (WEEKLY_LINK_HEALTH_CRON) and returns early -- it has nothing to do with the daily
    // digest/reconciliation flow below and shouldn't accidentally trigger it.
    if (event.cron === WEEKLY_LINK_HEALTH_CRON) {
      try {
        await checkAffiliateLinkHealth(env);
      } catch (error) {
        console.error('Scheduled affiliate link health check failed:', error);
      }
      // The weekly standup brief (step 65) rides this same Monday trigger. Failure-isolated: a problem
      // building it must never affect the link check above or anything else.
      try {
        await runWeeklyStandup(env);
      } catch (error) {
        console.error('Scheduled weekly standup failed:', error);
      }
      return;
    }

    // Workplan Step 93: EARLY_DIGEST_CRON must match wrangler.jsonc's crons array exactly, or
    // the early run silently gets misidentified as the general run (and vice versa) -- same
    // category of drift risk already seen with the hourly-fetch cron timing. The early run only
    // ever sends the digest; reconciliation and departing-soon alerts stay on the one general run
    // per day, since neither has an "early" variant of its own.
    const isEarlyRun = event.cron === EARLY_DIGEST_CRON;
    // The archive step is idempotent (first run of the day wins) and runs before the sends so the
    // email's "View in browser" link points at an edition that already exists.
    if (archiveWriteEnabled(env)) {
      try {
        const appUrl = env.APP_URL || 'https://sparkfare.com';
        const archiveCache = new Map();
        await archiveEditions(env, {
          loadDeals: (origin) => loadDigestDeals(env, origin, archiveCache),
          buildConfig: () => buildArchiveConfig(env, { appUrl }),
        });
        // The Sunday flagship edition (E3), built from the week's stored dailies; a no-op until a week
        // with enough dailies behind it has ended, and idempotent after that.
        await archiveWeeklyEditions(env, { buildConfig: () => buildArchiveConfig(env, { appUrl }) });
      } catch (error) {
        console.error('Scheduled digest archive failed:', error);
      }
    }
    try {
      await sendDailyAlerts(env, { earlyOnly: isEarlyRun });
    } catch (error) {
      console.error('Scheduled daily alerts failed:', error);
    }
    if (isEarlyRun) return;
    let reconcileResult = null;
    try {
      reconcileResult = await reconcileBookings(env);
    } catch (error) {
      console.error('Scheduled booking reconciliation failed:', error);
      reconcileResult = { error: error.message };
    }
    try {
      await checkRevenueHealth(env, reconcileResult);
    } catch (error) {
      console.error('Scheduled revenue health check failed:', error);
    }
    try {
      await sendDepartingSoonAlerts(env);
      await sendPreDepartureSequenceAlerts(env);
    } catch (error) {
      console.error('Scheduled departing-soon alerts failed:', error);
    }
    try {
      await checkWatchlists(env);
    } catch (error) {
      console.error('Scheduled watchlist check failed:', error);
    }
    try {
      await sendStressValveAlerts(env);
    } catch (error) {
      console.error('Scheduled stress-valve alerts failed:', error);
    }
    try {
      await sendDepartureBriefingAlerts(env);
    } catch (error) {
      console.error('Scheduled departure-briefing alerts failed:', error);
    }
    try {
      await sendRouteRetrospectives(env);
    } catch (error) {
      console.error('Scheduled route retrospectives failed:', error);
    }
    try {
      await sendDailyXPost(env);
    } catch (error) {
      console.error('Scheduled daily X post failed:', error);
    }
    try {
      await checkAndLogRoutePromotions(env);
    } catch (error) {
      console.error('Scheduled route promotion check failed:', error);
    }
  },
  async email(message, env, ctx) {
    if (message.to.toLowerCase() === 'hello@sparkfare.com') {
      const { sendSupportAutoResponder } = await import('./email.js');
      try {
        await sendSupportAutoResponder(env, message.from);
      } catch (error) {
        console.error('Failed to send auto-responder:', error);
      }
    }
  },
};
