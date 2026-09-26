import 'dotenv/config';
import { Resend } from 'resend';
import { renderDailyDigest } from './emailTemplates/dailyDigest.js';
import DESTINATION_BLURBS from '../content/destinations.json' with { type: 'json' };
import FARE_TIPS from '../content/fare_tips.json' with { type: 'json' };

function getResendClient(env) {
  const apiKey = env?.RESEND_API_KEY || process.env.RESEND_API_KEY;
  if (!apiKey) {
    return null;
  }

  return new Resend(apiKey);
}

// Workplan Step 100 (2026-09-12): brand styling for transactional emails, values taken directly
// from sparkfare_style_guide.md. Inline styles throughout, not a <style> block -- several major
// email clients (Outlook desktop, some webmail) strip <style> blocks or apply them
// unreliably, so inline is the only styling approach guaranteed to render everywhere. Every
// branded font declares a web-safe fallback so a client that can't load the Google Font still
// gets a reasonable sans-serif/monospace instead of a broken layout.
const EMAIL_COLORS = {
  paper: '#EDE6D6',
  ledger: '#2B2620',
  ledgerMuted: '#6B6255',
  line: '#DCD3BF',
  // The live site's established action color for links/CTAs -- not in the style guide document
  // itself, but used everywhere else on sparkfare.com, so emails stay consistent with it.
  sage: '#4F7A52',
};
// Workplan Step 112 (GTM Plan Update, Phase 18). The system-font names in this stack are for
// clients that strip web fonts entirely (many do) -- '-apple-system'/BlinkMacSystemFont match San
// Francisco on Apple Mail/iOS, 'Segoe UI' matches Outlook/Windows Mail, so a client with no
// Space Grotesk support still gets a real system sans instead of a generic serif default.
const FONT_HEADLINE = "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const FONT_BODY = "'Inter', Helvetica, Arial, sans-serif";
const FONT_NUMERALS = "'IBM Plex Mono', 'Courier New', monospace";

// Dark-mode equivalents of the Paper/Ledger palette above -- not in sparkfare_style_guide.md
// (a light-only "paper" theme), so these are a reasoned inversion (dark ledger-brown background,
// paper-toned text) rather than a documented brand value. Applied via a <style> block + class
// hooks alongside the inline styles every element already carries, since @media queries can't
// target inline style="" attributes directly -- clients that strip <style> blocks (Outlook
// desktop) just keep rendering the light inline styles, which is a safe, correct fallback, not a
// broken one.
const EMAIL_DARK_COLORS = {
  bg: '#1C1810',
  ledger: '#EDE6D6',
  ledgerMuted: '#A99C87',
  line: '#3A3226',
};

function darkModeStyleTag() {
  return `
    <style>
      @media (prefers-color-scheme: dark) {
        .sf-bg { background: ${EMAIL_DARK_COLORS.bg} !important; }
        .sf-text, .sf-text a { color: ${EMAIL_DARK_COLORS.ledger} !important; }
        .sf-muted, .sf-muted a { color: ${EMAIL_DARK_COLORS.ledgerMuted} !important; }
        .sf-line { border-color: ${EMAIL_DARK_COLORS.line} !important; }
      }
    </style>
  `;
}

function emailShell(bodyHtml) {
  return `
    ${darkModeStyleTag()}
    <div class="sf-bg" style="background:${EMAIL_COLORS.paper};padding:24px 16px;font-family:${FONT_BODY};">
      <div style="max-width:520px;margin:0 auto;">
        <p class="sf-text" style="font-family:${FONT_HEADLINE};font-weight:500;font-size:18px;color:${EMAIL_COLORS.ledger};margin:0 0 20px;">Sparkfare</p>
        ${bodyHtml}
      </div>
    </div>
  `;
}

export const AFFILIATE_DISCLOSURE_TEXT = "Sparkfare may earn a commission if you buy through this link, at no extra cost to you.";


let sendingGuardBlocked = null;
let sendingGuardCheckedAt = null;
export function _resetSendingGuardForTests() { sendingGuardBlocked = null; sendingGuardCheckedAt = null; }

// Bounce/complaint circuit breaker thresholds. The point of the breaker is to stop hammering
// inboxes when list quality has genuinely collapsed, not to react to one unlucky address, so a
// rate only means something once there are enough sends behind it.
//
// - Over the last 7 days, with at least GUARD_MIN_SAMPLE sends behind it, trip on a bounce rate
//   above 5% or a complaint rate above 0.3%. 0.3% is the line Gmail/Yahoo enforce against bulk
//   senders (0.1% is their *target*); the previous 0.1% trip point meant one complaint blocked
//   everything until the 7-day window cleared.
// - Below that sample size a percentage is noise (1 bounce in 10 sends reads as 10%), so fall back
//   to absolute counts: 10 bounces or 3 complaints in the window is a real signal even at tiny
//   volume, a single one is not.
// `sent` is alert_email_sent events, which not every send path logs, so it undercounts real sends
// and errs on the side of a higher rate; that is the safer direction for a circuit breaker.
export const SENDING_GUARD = {
  windowDays: 7,
  minSample: 100,
  bounceRate: 0.05,
  complaintRate: 0.003,
  bounceCountBelowSample: 10,
  complaintCountBelowSample: 3,
  cacheMs: 10 * 60 * 1000,
};

// Pure decision, separate from the D1 read so the thresholds can be tested directly.
export function evaluateSendingGuard({ bounces = 0, complaints = 0, sent = 0 } = {}) {
  const g = SENDING_GUARD;
  if (sent >= g.minSample) {
    const bounceRate = bounces / sent;
    const complaintRate = complaints / sent;
    if (bounceRate > g.bounceRate) return { tripped: true, reason: `bounce rate ${(bounceRate * 100).toFixed(2)}% over ${sent} sends` };
    if (complaintRate > g.complaintRate) return { tripped: true, reason: `complaint rate ${(complaintRate * 100).toFixed(2)}% over ${sent} sends` };
    return { tripped: false, reason: null };
  }
  if (bounces >= g.bounceCountBelowSample) return { tripped: true, reason: `${bounces} bounces with only ${sent} sends logged` };
  if (complaints >= g.complaintCountBelowSample) return { tripped: true, reason: `${complaints} complaints with only ${sent} sends logged` };
  return { tripped: false, reason: null };
}

// Shared by sendEmailWithGuard() and the Sunday newsletter's batch path (which can't go through
// sendEmailWithGuard per recipient). The verdict is cached for SENDING_GUARD.cacheMs, so a trip
// clears on its own once the window improves instead of lasting for the life of the isolate.
async function isSendingGuardTripped(env) {
  const now = Date.now();
  const fresh = sendingGuardCheckedAt !== null && now - sendingGuardCheckedAt < SENDING_GUARD.cacheMs;
  if (!fresh && env?.DB) {
    // Fails open: if the stats query errors (for example the `events` table doesn't exist in this
    // database), the guard can't judge bounce/complaint rates, so it logs and lets the send
    // proceed. Throwing here would silently stop every guarded email, the daily digest included.
    try {
      const stats = await env.DB.prepare(`
        SELECT 
          SUM(CASE WHEN event_type = 'email_bounce' THEN 1 ELSE 0 END) as bounces,
          SUM(CASE WHEN event_type = 'email_complaint' THEN 1 ELSE 0 END) as complaints,
          SUM(CASE WHEN event_type = 'alert_email_sent' THEN 1 ELSE 0 END) as sent
        FROM events 
        WHERE ts > datetime('now', '-${SENDING_GUARD.windowDays} days')
      `).first();
      const verdict = evaluateSendingGuard({
        bounces: stats?.bounces || 0,
        complaints: stats?.complaints || 0,
        sent: stats?.sent || 0,
      });
      sendingGuardBlocked = verdict.tripped;
      sendingGuardCheckedAt = now;
      if (verdict.tripped) console.error(`Sending guard tripped: ${verdict.reason}`);
    } catch (error) {
      console.error('Sending guard stats query failed; allowing the send:', error);
    }
  }
  return !!sendingGuardBlocked;
}

async function sendEmailWithGuard(resend, env, options) {
  // F2: neither `events` (shared with T0, see CLAUDE.md's F1 entry) nor `email_suppressions`
  // (T7's own) had a CREATE TABLE IF NOT EXISTS guard anywhere -- and unlike F1's silent
  // analytics gap, this function runs before every one of the ~12 guarded email sends in this
  // file with no try/catch of its own, so a missing table here doesn't degrade gracefully: it
  // throws and blocks the send entirely. If either table was ever missing in production, this
  // could have meant zero outbound email of any kind, not just missing deliverability signals.
  if (env?.DB) {
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS email_suppressions (
        email TEXT PRIMARY KEY,
        reason TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `).run();
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
  }

  if (await isSendingGuardTripped(env)) {
    console.error("Sending guard is active. Skipping email send.");
    return { error: { message: "Sending guard tripped due to high bounce/complaint rates." } };
  }

  if (env?.DB) {
    const isSuppressed = await env.DB.prepare('SELECT 1 FROM email_suppressions WHERE email = ?').bind(options.to).first();
    if (isSuppressed) {
      console.log(`Skipping email to ${options.to} (suppressed)`);
      return { data: { id: 'suppressed' } };
    }
  }

  const appUrl = env?.APP_URL || 'https://sparkfare.com';
  const unsubscribeUrl = `${appUrl}/api/unsubscribe?email=${encodeURIComponent(options.to)}`;
  
  options.headers = options.headers || {};
  options.headers['List-Unsubscribe'] = `<${unsubscribeUrl}>`;
  options.headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';

  return await resend.emails.send(options);
}


export function disclosureHtml(textOverride = null) {
  const text = textOverride || AFFILIATE_DISCLOSURE_TEXT;
  return `
    <p style="font-size: 13px; color: #605142; margin: 0 0 24px; padding-bottom: 20px; border-bottom: 1px dashed #D9CBB0; font-style: italic;">
      ${text}
    </p>
  `;
}

function paragraphHtml(text) {
  return `<p class="sf-text" style="color:${EMAIL_COLORS.ledger};font-size:15px;line-height:1.6;margin:0 0 16px;">${text}</p>`;
}

function linkHtml(href, text) {
  return `<a href="${href}" style="color:${EMAIL_COLORS.sage};">${text}</a>`;
}

// Workplan Step 106b (roadmap "The Group Travel Multiplier"). Only rendered when passengerCount
// is a real party of more than 1 -- a solo traveler (the common case, and the default whenever
// this preference was never set) gets the plain, unmodified copy each function already had.
export function groupTravelHtml(passengerCount) {
  const n = Number(passengerCount);
  if (!Number.isFinite(n) || n <= 1) return '';
  return paragraphHtml(`You're traveling with ${n - 1} other${n - 1 === 1 ? '' : 's'} — worth covering the whole group, not just yourself (e.g. insuring all ${n} passengers via SafetyWing), on what's below.`);
}

// Workplan Step 106b, second half (roadmap "Dynamic Contextual Upsell Injection", scoped down to
// just trip_length -- the roadmap's own destination/international-visa half has no live partner
// to pitch yet, see AWAY_MODE_PARTNERS' Airalo/Holafly notes). Reorders (never removes) a
// partner list so the single most relevant partner for a trip's actual length leads: a short
// "weekend" trip leads with Bounce (luggage storage matters more, mail forwarding barely does for
// 2-3 days); a long trip (11-14 days or 2+ weeks) leads with US Global Mail (the opposite problem
// -- mail piling up for two-plus weeks is the real worry). Middle-length trips (4-6, 7-10) and any
// trip_length this project doesn't recognize get no reordering -- there's no strong enough signal
// either way to justify picking a lead partner for those.
export function prioritizePartners(partners, tripLength) {
  const leadSlug = tripLength === 'weekend' ? 'bounce'
    : (tripLength === '11-14' || tripLength === '2+ weeks') ? 'us-global-mail'
    : null;
  if (!leadSlug) return partners;
  const lead = partners.find((partner) => partner.slug === leadSlug);
  if (!lead) return partners;
  return [lead, ...partners.filter((partner) => partner.slug !== leadSlug)];
}

function partnersListHtml(partners, { appUrl, tripId, partnerId } = {}) {
  const items = partners.map((partner) => {
    const href = appUrl ? buildAwayModeLink(appUrl, partner.slug, { tripId, partnerId }) : partner.link;
    return `
    <li class="sf-text" style="margin:0 0 10px;color:${EMAIL_COLORS.ledger};font-size:15px;line-height:1.5;">
      <strong>${partner.name}</strong> — <span class="sf-muted" style="color:${EMAIL_COLORS.ledgerMuted};">${partner.blurb}</span> ${linkHtml(href, 'Learn more')}
    </li>
  `;
  }).join('');
  return `<ul style="margin:0 0 16px;padding-left:20px;">${items}</ul>`;
}

function openAppHtml(appUrl) {
  return `<p style="margin:0 0 16px;">${linkHtml(appUrl, 'Open Sparkfare')}</p>`;
}

function unsubscribeHtml(url, label = 'Unsubscribe from Sparkfare emails') {
  return `<p class="sf-line" style="margin:20px 0 0;border-top:1px solid ${EMAIL_COLORS.line};padding-top:16px;"><small class="sf-muted" style="color:${EMAIL_COLORS.ledgerMuted};font-size:12px;">${linkHtml(url, label)}</small></p>`;
}

export async function sendVerificationEmail({ email, verificationUrl }, env = {}) {
  const resend = getResendClient(env);
  if (!resend) {
    return { ok: true, mocked: true, message: 'RESEND_API_KEY not set; email mocked' };
  }

  const response = await sendEmailWithGuard(resend, env, {
    from: env.EMAIL_FROM || process.env.EMAIL_FROM || 'Sparkfare <hello@sparkfare.com>',
    to: email,
    subject: 'Verify your Sparkfare account',
    html: emailShell(`
      ${paragraphHtml('Welcome to Sparkfare.')}
      ${paragraphHtml('Verify your email to start receiving deal alerts.')}
      <p style="margin:0 0 16px;">${linkHtml(verificationUrl, 'Verify my email')}</p>
    `),
  });

  if (response.error) {
    throw new Error(`Resend rejected the send: ${response.error.message || JSON.stringify(response.error)}`);
  }

  // N2 (2026-09-25): this call used to be `logAwayModeEmail(env, { email, partnerId:
  // partner.slug, emailType: 'pre_departure_day_' + daysUntil })` followed by a return including
  // `partner_slug: partner.slug` -- neither `partner` nor `daysUntil` is ever defined in this
  // function's scope (a copy-paste from sendPreDepartureSequenceEmail, the one function where
  // that pattern IS correct -- commit 91038f2, 2026-09-23). This verification email has no
  // partner/affiliate content at all, so `ReferenceError: partner is not defined` threw on every
  // single real (non-mocked) send, right after Resend had already accepted and sent the email --
  // meaning every real signup verification email since 2026-09-23 reported as a failure to its
  // caller despite actually being delivered. Found while investigating N2 (revenue health) and
  // fixed here since it's the same bug repeated across several functions in this file -- see the
  // matching fixes in sendRouteRetrospectiveEmail, sendSunsetEmail, and sendSupportAutoResponder.
  return { ok: true, mocked: false, response };
}

// Away Mode partner links -- only list a partner here once its real, approved affiliate
// link is in hand. A guessed or placeholder URL silently fails to track (same lesson as the
// Aviasales booking links: manually verify before trusting a link format).
//
// `slug` (Workplan Step 113, GTM Plan Update Phase 19) is the /go/:affiliate path segment used
// for privacy-first server-side click attribution -- see buildAwayModeLink() below and the
// GET /go/:affiliate route in src/index.js. It's a stable identifier independent of the partner's
// own URL, so the real affiliate link can change without touching every email template that
// own URL, so the real affiliate link can change without touching every email template that
// links to it.
export async function getAwayModePartners(env) {
  if (env?.DB) {
    try {
      const { results } = await env.DB.prepare(`SELECT slug, name, category, url_template as link, commission_note as blurb FROM partners WHERE status = 'live'`).all();
      return results;
    } catch (e) { console.error('Failed to load partners from DB', e); }
  }
  return AWAY_MODE_PARTNERS;
}

const AWAY_MODE_PARTNERS = [
  {
    slug: 'timekettle',
    name: 'Timekettle',
    blurb: 'Translator earbuds for real conversations abroad, from ordering dinner to asking directions.',
    link: 'https://www.awin1.com/cread.php?awinmid=97799&awinaffid=3086775&ued=https%3A%2F%2Ftimekettle.co',
  },
  {
    slug: 'parking-access',
    name: 'Parking Access',
    blurb: 'Book airport parking ahead and skip the gate-price surprise when you\'re heading out.',
    link: 'https://parkingaccess.com/?rfid=UoznfWZeo8',
  },
  {
    slug: 'safetywing',
    name: 'SafetyWing',
    blurb: 'Travel medical insurance built for people leaving home for a while.',
    link: 'https://safetywing.com/nomad-insurance?referenceID=26593442&utm_source=26593442&utm_medium=Ambassador',
  },
  {
    slug: 'airhelp',
    name: 'AirHelp',
    blurb: 'Flight delay, cancellation, and overbooking compensation — they handle the airline claim so you don\'t have to.',
    link: 'https://airhelp.tpo.lu/znw4dRjM',
  },
  {
    slug: 'yesim',
    name: 'Yesim',
    blurb: 'An eSIM for wherever you\'re landing — data the moment you touch down, no local SIM card hunt.',
    link: 'https://yesim.tpo.lu/DaBlyOCx',
  },
  {
    // Approved via Partnerize 2026-09-18, per user directly. Eighth real, live Away Mode partner.
    // FinTech / multi-currency spending without foreign transaction fees.
    slug: 'wise',
    name: 'Wise',
    blurb: 'Hold and spend in local currencies with no foreign transaction fees — real exchange rates wherever you travel.',
    link: 'https://wise.prf.hn/click/camref:1011l5R5kP',
  },
  {
    slug: 'us-global-mail',
    name: 'US Global Mail',
    blurb: 'A virtual mailbox that opens, scans, and forwards your physical mail — so nothing piles up at home while you\'re away.',
    link: 'https://www.usglobalmail.com/?via=coby',
  },
  {
    slug: 'nordvpn',
    name: 'NordVPN',
    blurb: 'Keep your data off public airport and hotel Wi-Fi — set it up before you leave, not once you\'re already connected.',
    link: 'https://go.nordvpn.net/aff_c?aff_id=2495&offer_id=314&url_id=7264',
  },
  {
    slug: 'bounce',
    name: 'Bounce',
    blurb: 'Luggage storage by the hour, wherever you land — no need to kill time dragging a bag around.',
    link: 'https://go.bounce.com/SPARKFARE96253961631',
  },
  {
    // Workplan Step 73 (language learning -- replaces Babbel, per user 2026-09-16).
    // Approved via CJ 2026-09-16; first Content/upsell partner wired live. Pre-trip language
    // prep is a genuine Away Mode use case (know a few phrases before you land) without
    // overlapping any of the existing logistics/insurance/connectivity partners.
    slug: 'rocket-languages',
    name: 'Rocket Languages',
    blurb: 'Learn the language before you land — interactive courses built for real conversation, not just vocabulary lists.',
    link: 'https://www.rocketlanguages.com/?ref=cj&cjevent=7755712',
  },
  {
    // N1 ("Complete the trip"), flipped live 2026-09-25 with real tracking links supplied
    // directly by Coby -- see migrations/0010_complete_trip_partners_live.sql. Activities/
    // tickets, distinct from the existing leaving-home-logistics partners above.
    slug: 'tiqets',
    name: 'Tiqets',
    blurb: 'Skip-the-line tickets and tours at your destination, booked before you land.',
    link: 'https://tiqets.tpo.lu/p0pwNloI',
  },
  {
    slug: 'gocity',
    name: 'GoCity',
    blurb: 'One pass, several attractions — worth it if you\'re packing a lot into one city.',
    link: 'https://gocity.tpo.lu/n8KrVAZY',
  },
  {
    slug: 'qeeq',
    name: 'QEEQ',
    blurb: 'Car rental comparison at your destination, so you\'re not negotiating at the counter.',
    link: 'https://qeeq.tpo.lu/UjZTOlwU',
  },
  {
    slug: 'welcome-pickups',
    name: 'Welcome Pickups',
    blurb: 'A driver waiting at arrivals with your name on a sign — booked ahead, fixed price.',
    link: 'https://tpo.lu/kuJ7K9NS',
  },
  // Airalo (eSIM connectivity): Impact.com application declined 2026-09-11 -- a soft decline,
  // not permanent (they invited reapplying once there's more traffic/content). Add its tracking
  // link here only if a future application is actually approved.
  // Holafly (eSIM connectivity): was the chosen Airalo replacement as of 2026-09-11, but Yesim
  // (above) is now the primary eSIM partner as of 2026-09-13, per the user directly -- Holafly is
  // the designated fallback if Yesim's coverage or terms don't work out, not dropped entirely.
  // Its application was still PENDING as of this date. Add its tracking link here only once
  // actually approved, and only if Yesim needs a genuine fallback -- do not guess a link.
];

// Workplan Step 113. Builds a /out/:partner link instead of linking straight to a partner's raw
// URL, so the real click (not just "an email was sent") gets logged server-side before the
// redirect. tripId/partnerId are optional -- away-mode.html's anonymous, no-session page omits
// both and still gets a valid (if less specific) click record.

export function buildAwayModeLink(appUrl, slug, { tripId, partnerId, iata, arrival, exit } = {}) {
  const params = new URLSearchParams();
  if (tripId) params.set('trip_id', tripId);
  if (partnerId) params.set('partner_id', partnerId);
  if (iata) params.set('iata', iata);
  if (arrival) params.set('arrival', arrival);
  if (exit) params.set('exit', exit);
  const query = params.toString();
  return `${appUrl}/out/${slug}${query ? `?${query}` : ''}`;
}


// Records which publisher (if any) referred the recipient, for internal revenue-share
// accounting. This does NOT modify the actual outbound affiliate URLs above -- SafetyWing,
// Bounce, and US Global Mail's links are Coby's own personal referral links, not sub-ID-capable
// through a network, so an arbitrary partner_id query param would just be silently ignored by
// them (see workplan Step 91's own open dependency note). This log is Sparkfare's own separate
// record of "this send is attributable to partner X", used to manually reconcile what Sparkfare
// owes a publisher out of its own affiliate earnings -- a different, internal accounting
// question from what the affiliate networks themselves track.
async function logAwayModeEmail(env, { email, partnerId, emailType }) {
  if (!env?.DB) return;
  try {
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS away_mode_email_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        partner_id TEXT,
        email_type TEXT NOT NULL,
        sent_at TEXT DEFAULT (datetime('now'))
      )
    `).run();
    await env.DB.prepare(`
      INSERT INTO away_mode_email_log (email, partner_id, email_type) VALUES (?, ?, ?)
    `).bind(email, partnerId || null, emailType).run();
  } catch (error) {
    console.error('Away Mode email log write failed:', error);
  }
}

export async function sendAwayModeFollowUpEmail({ email, destination, departure_at, partner_id, trip_id, trip_length, passenger_count }, env = {}) {
  const resend = getResendClient(env);
  if (!resend) {
    return { ok: true, mocked: true, message: 'RESEND_API_KEY not set; away mode email mocked' };
  }

  const appUrl = env.APP_URL || process.env.APP_URL || 'https://sparkfare.com';
  const unsubscribeUrl = `${appUrl}/api/unsubscribe?email=${encodeURIComponent(email)}`;
  const departureDate = departure_at
    ? new Date(departure_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    : null;
  const activePartners = await getAwayModePartners(env);
  const partners = prioritizePartners(activePartners, trip_length);

  const response = await sendEmailWithGuard(resend, env, {
    from: env.EMAIL_FROM || process.env.EMAIL_FROM || 'Sparkfare <hello@sparkfare.com>',
    to: email,
    subject: `Everything else, handled — before ${destination}`,
    html: emailShell(`
      ${disclosureHtml()}
      ${paragraphHtml(`You're booked for ${destination}${departureDate ? ` on ${departureDate}` : ''}. While that fare is locked in, here's what else is worth handling before you go:`)}
      ${groupTravelHtml(passenger_count)}
      ${partnersListHtml(partners, { appUrl, tripId: trip_id, partnerId: partner_id })}
      ${openAppHtml(appUrl)}
      ${unsubscribeHtml(unsubscribeUrl)}
    `),
  });

  if (response.error) {
    throw new Error(`Resend rejected the send: ${response.error.message || JSON.stringify(response.error)}`);
  }

  await logAwayModeEmail(env, { email, partnerId: partner_id, emailType: 'follow_up' });

  return { ok: true, mocked: false, response };
}

// Workplan Step 110 (GTM Plan Update, Phase 18 -- "The Stress Valve"), resolved 2026-09-13 per
// the user directly: this is a NEW, additional touchpoint, not a replacement of
// sendAwayModeFollowUpEmail's existing immediate-send behavior (Step 52/54, CONFIRMED live). It
// fires separately, 2 days after a trip click (see sendStressValveAlerts in src/index.js for the
// scheduled lookup), and is deliberately curated to just 2 partners rather than the full
// AWAY_MODE_PARTNERS list -- the source doc's own framing ("the stress valve") is specifically
// about the two logistics worries (health coverage, mail piling up) that are still unresolved a
// couple of days after booking, not a repeat of the full checklist already shown immediately.
const STRESS_VALVE_PARTNER_SLUGS = ['safetywing', 'us-global-mail'];

export async function sendStressValveEmail({ email, destination, departure_at, partner_id, trip_id, trip_length, passenger_count }, env = {}) {
  const resend = getResendClient(env);
  if (!resend) {
    return { ok: true, mocked: true, message: 'RESEND_API_KEY not set; stress-valve email mocked' };
  }

  const appUrl = env.APP_URL || process.env.APP_URL || 'https://sparkfare.com';
  const unsubscribeUrl = `${appUrl}/api/unsubscribe?email=${encodeURIComponent(email)}`;
  const departureDate = departure_at
    ? new Date(departure_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    : null;
  const activePartners = await getAwayModePartners(env);
  const partners = prioritizePartners(
    activePartners.filter((partner) => STRESS_VALVE_PARTNER_SLUGS.includes(partner.slug)),
    trip_length
  );

  const response = await sendEmailWithGuard(resend, env, {
    from: env.EMAIL_FROM || process.env.EMAIL_FROM || 'Sparkfare <hello@sparkfare.com>',
    to: email,
    subject: `Two days in — is ${destination} actually handled?`,
    html: emailShell(`
      ${disclosureHtml()}
      ${paragraphHtml(`Your trip to ${destination}${departureDate ? ` on ${departureDate}` : ''} is booked. Two things worth locking down now, before they turn into a scramble later:`)}
      ${groupTravelHtml(passenger_count)}
      ${partnersListHtml(partners, { appUrl, tripId: trip_id, partnerId: partner_id })}
      ${openAppHtml(appUrl)}
      ${unsubscribeHtml(unsubscribeUrl)}
    `),
  });

  if (response.error) {
    throw new Error(`Resend rejected the send: ${response.error.message || JSON.stringify(response.error)}`);
  }

  await logAwayModeEmail(env, { email, partnerId: partner_id, emailType: 'stress_valve' });

  return { ok: true, mocked: false, response };
}

// Workplan Step 111 (GTM Plan Update, Phase 18 -- "The Departure Briefing"), refined 2026-09-13
// by sparkfare_launch_plan.md: an ADDITION alongside the existing Day-3 sendDepartingSoonEmail
// (Step 68, CONFIRMED live), not a change to DEPARTING_SOON_WINDOW_DAYS. Fires exactly 7 days
// before departure (see sendDepartureBriefingAlerts in src/index.js), curated to the 3 partners
// most relevant that close to a trip (connectivity, luggage, delay/cancellation coverage) rather
// than the full list.
const DEPARTURE_BRIEFING_PARTNER_SLUGS = ['yesim', 'bounce', 'airhelp'];

export async function sendDepartureBriefingEmail({ email, destination, departure_at, partner_id, trip_id, trip_length, passenger_count }, env = {}) {
  const resend = getResendClient(env);
  if (!resend) {
    return { ok: true, mocked: true, message: 'RESEND_API_KEY not set; departure-briefing email mocked' };
  }

  const appUrl = env.APP_URL || process.env.APP_URL || 'https://sparkfare.com';
  const unsubscribeUrl = `${appUrl}/api/unsubscribe?email=${encodeURIComponent(email)}`;
  const departureDate = departure_at
    ? new Date(departure_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    : null;
  const activePartners = await getAwayModePartners(env);
  const partners = prioritizePartners(
    activePartners.filter((partner) => DEPARTURE_BRIEFING_PARTNER_SLUGS.includes(partner.slug)),
    trip_length
  );

  const response = await sendEmailWithGuard(resend, env, {
    from: env.EMAIL_FROM || process.env.EMAIL_FROM || 'Sparkfare <hello@sparkfare.com>',
    to: email,
    subject: `One week out — ${destination}`,
    html: emailShell(`
      ${disclosureHtml()}
      ${paragraphHtml(`${destination}${departureDate ? ` (${departureDate})` : ''} is one week out. Time to actually set up the three things that matter most this close to departure:`)}
      ${groupTravelHtml(passenger_count)}
      ${partnersListHtml(partners, { appUrl, tripId: trip_id, partnerId: partner_id })}
      ${openAppHtml(appUrl)}
      ${unsubscribeHtml(unsubscribeUrl)}
    `),
  });

  if (response.error) {
    throw new Error(`Resend rejected the send: ${response.error.message || JSON.stringify(response.error)}`);
  }

  await logAwayModeEmail(env, { email, partnerId: partner_id, emailType: 'departure_briefing' });

  return { ok: true, mocked: false, response };
}

// Workplan Step 114 (GTM Plan Update, Phase 19 -- "Route Retrospective"). Fires once per trip,
// ~2 days after its return_at, comparing the price the user actually locked in against that
// route's current 30-day trailing average -- a re-engagement hook, not an action item, so there's
// no partner list or disclosure-before-links concern here (no affiliate link in this email at
// all). pctDiff > 0 means the locked price was cheaper than today's average (a "nice call" framing);
// pctDiff <= 0 means prices have since dropped below what was paid.
export async function sendRouteRetrospectiveEmail({ email, origin, destination, lockedPrice, currentAvg, pctDiff }, env = {}) {
  const resend = getResendClient(env);
  if (!resend) {
    return { ok: true, mocked: true, message: 'RESEND_API_KEY not set; route retrospective email mocked' };
  }

  const appUrl = env.APP_URL || process.env.APP_URL || 'https://sparkfare.com';
  const unsubscribeUrl = `${appUrl}/api/unsubscribe?email=${encodeURIComponent(email)}`;
  const lockedHtml = `<span style="font-family:${FONT_NUMERALS};">$${Number(lockedPrice).toLocaleString('en-US')}</span>`;
  const currentHtml = `<span style="font-family:${FONT_NUMERALS};">$${Number(currentAvg).toLocaleString('en-US')}</span>`;
  const pctLabel = `${Math.abs(Math.round(pctDiff * 100))}%`;
  const verdict = pctDiff > 0
    ? `You locked in ${lockedHtml} — that's ${pctLabel} below today's average of ${currentHtml}. Good call.`
    : `You locked in ${lockedHtml}. Today's average for that route is ${currentHtml}, ${pctLabel} lower — worth knowing for next time.`;

  const response = await sendEmailWithGuard(resend, env, {
    from: env.EMAIL_FROM || process.env.EMAIL_FROM || 'Sparkfare <hello@sparkfare.com>',
    to: email,
    subject: `How your ${destination} fare held up`,
    html: emailShell(`
      ${paragraphHtml(`Hope ${destination} was worth the trip. A quick look back at ${origin} → ${destination}:`)}
      ${paragraphHtml(verdict)}
      ${openAppHtml(appUrl)}
      ${unsubscribeHtml(unsubscribeUrl)}
    `),
  });

  if (response.error) {
    throw new Error(`Resend rejected the send: ${response.error.message || JSON.stringify(response.error)}`);
  }

  // N2: this email has no partner/affiliate content at all (its own doc comment: "No affiliate
  // links or disclosure in this email -- it's a pure re-engagement/trust-building send"), so the
  // `partner.slug`/`daysUntil` references a stray copy-paste left here (commit 91038f2,
  // 2026-09-23) always threw a ReferenceError, after the real email had already sent. See the
  // matching fix note in sendVerificationEmail above for the full story.
  return { ok: true, mocked: false, response };
}

export async function sendBookingConfirmedEmail({ email, destination, partner_id, trip_id, trip_length, passenger_count }, env = {}) {
  const resend = getResendClient(env);
  if (!resend) {
    return { ok: true, mocked: true, message: 'RESEND_API_KEY not set; booking-confirmed email mocked' };
  }

  const appUrl = env.APP_URL || process.env.APP_URL || 'https://sparkfare.com';
  const unsubscribeUrl = `${appUrl}/api/unsubscribe?email=${encodeURIComponent(email)}`;
  const activePartners = await getAwayModePartners(env);
  const partners = prioritizePartners(activePartners, trip_length);

  const response = await sendEmailWithGuard(resend, env, {
    from: env.EMAIL_FROM || process.env.EMAIL_FROM || 'Sparkfare <hello@sparkfare.com>',
    to: email,
    subject: `Booking confirmed — ${destination}`,
    html: emailShell(`
      ${paragraphHtml(`Your booking to ${destination} is confirmed. Have a great trip.`)}
      ${disclosureHtml()}
      ${paragraphHtml('Still time to handle the rest before you go:')}
      ${groupTravelHtml(passenger_count)}
      ${partnersListHtml(partners, { appUrl, tripId: trip_id, partnerId: partner_id })}
      ${openAppHtml(appUrl)}
      ${unsubscribeHtml(unsubscribeUrl)}
    `),
  });

  if (response.error) {
    throw new Error(`Resend rejected the send: ${response.error.message || JSON.stringify(response.error)}`);
  }

  await logAwayModeEmail(env, { email, partnerId: partner_id, emailType: 'booking_confirmed' });

  return { ok: true, mocked: false, response };
}

// Workplan Step 68. Distinct from the immediate post-click follow-up above (sendAwayMode
// FollowUpEmail) -- this fires close to the actual departure date, as a last-chance nudge for
// anything not yet handled, not right after booking. daysUntil is computed by the caller (see
// sendDepartingSoonAlerts in src/index.js) from the trip's real departure_at, not hardcoded,
// since the caller's query window can catch a trip anywhere from 0-3 days out depending on when
// the daily Cron first sees it.
export async function sendDepartingSoonEmail({ email, destination, departure_at, daysUntil, partner_id, trip_id, trip_length, passenger_count }, env = {}) {
  const resend = getResendClient(env);
  if (!resend) {
    return { ok: true, mocked: true, message: 'RESEND_API_KEY not set; departing-soon email mocked' };
  }

  const appUrl = env.APP_URL || process.env.APP_URL || 'https://sparkfare.com';
  const unsubscribeUrl = `${appUrl}/api/unsubscribe?email=${encodeURIComponent(email)}`;
  const departureDate = departure_at
    ? new Date(departure_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    : null;
  const timing = daysUntil <= 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`;
  const activePartners = await getAwayModePartners(env);
  const partners = prioritizePartners(activePartners, trip_length);

  const response = await sendEmailWithGuard(resend, env, {
    from: env.EMAIL_FROM || process.env.EMAIL_FROM || 'Sparkfare <hello@sparkfare.com>',
    to: email,
    subject: `Departing ${timing} — ${destination}`,
    html: emailShell(`
      ${disclosureHtml()}
      ${paragraphHtml(`Your trip to ${destination}${departureDate ? ` (${departureDate})` : ''} departs ${timing}. Last call for anything still worth handling before you go:`)}
      ${groupTravelHtml(passenger_count)}
      ${partnersListHtml(partners, { appUrl, tripId: trip_id, partnerId: partner_id })}
      ${openAppHtml(appUrl)}
      ${unsubscribeHtml(unsubscribeUrl)}
    `),
  });

  if (response.error) {
    throw new Error(`Resend rejected the send: ${response.error.message || JSON.stringify(response.error)}`);
  }

  await logAwayModeEmail(env, { email, partnerId: partner_id, emailType: 'departing_soon' });

  return { ok: true, mocked: false, response };
}

// Workplan Step 126 (Business Plan V2.0, Module A -- the 45-day sunset policy). Sent once, the
// same moment a user's is_subscribed flag flips to 0 for inactivity (see the pruning check in
// sendDailyAlerts). Copy is taken directly from sparkfare_project_updates.md, not paraphrased.
// Deliberately includes both a reactivation link (the primary CTA) and the standard unsubscribe
// footer -- someone who doesn't want to reactivate should still be able to opt out completely,
// same "make leaving easy" discipline as every other email's unsubscribe link.
export async function sendSunsetEmail({ email }, env = {}) {
  const resend = getResendClient(env);
  if (!resend) {
    return { ok: true, mocked: true, message: 'RESEND_API_KEY not set; sunset email mocked' };
  }

  const appUrl = env.APP_URL || process.env.APP_URL || 'https://sparkfare.com';
  const reactivateUrl = `${appUrl}/api/reactivate?email=${encodeURIComponent(email)}`;
  const unsubscribeUrl = `${appUrl}/api/unsubscribe?email=${encodeURIComponent(email)}`;

  const response = await sendEmailWithGuard(resend, env, {
    from: env.EMAIL_FROM || process.env.EMAIL_FROM || 'Sparkfare <hello@sparkfare.com>',
    to: email,
    subject: "We've paused your Sparkfare alerts",
    html: emailShell(`
      ${paragraphHtml("We noticed you haven't checked the ledger recently. We've paused your daily alerts to keep your inbox clean.")}
      <p style="margin:0 0 16px;">${linkHtml(reactivateUrl, 'Turn my alerts back on')}</p>
      ${unsubscribeHtml(unsubscribeUrl, "No thanks, unsubscribe me completely")}
    `),
  });

  if (response.error) {
    throw new Error(`Resend rejected the send: ${response.error.message || JSON.stringify(response.error)}`);
  }

  // N2: this is the 45-day-sunset goodbye email (Module A, Step 126) -- no partner content, so
  // the same stray copy-paste (see sendVerificationEmail above) always threw here too.
  return { ok: true, mocked: false, response };
}

// Workplan Step 109 (GTM Plan Update, Phase 18 -- Early Bird FOMO banner). `priceJump`, when
// present, means checkEarlyBirdPriceJumps() (src/index.js) found this recipient's top deal at a
// higher price now than it was at the 07:00 Early Bird run for the same route today -- a real,
// measured jump, not a guess. `userId`, when present, builds the same referral link Step 93's
// share panel already uses, so the banner's CTA and the frontend share link point at the exact
// same /?ref= mechanic rather than inventing a second one.
function fomoBannerHtml({ priceJump, appUrl, userId }) {
  if (!priceJump) return '';
  const fromHtml = `<span style="font-family:${FONT_NUMERALS};">$${Number(priceJump.from).toLocaleString('en-US')}</span>`;
  const toHtml = `<span style="font-family:${FONT_NUMERALS};">$${Number(priceJump.to).toLocaleString('en-US')}</span>`;
  const referralUrl = userId ? `${appUrl}/?ref=${encodeURIComponent(userId)}` : null;
  return `
    <div class="sf-line" style="border:1px solid ${EMAIL_COLORS.line};border-radius:6px;padding:12px 14px;margin:0 0 16px;">
      <p class="sf-text" style="margin:0 0 8px;color:${EMAIL_COLORS.ledger};font-size:14px;line-height:1.5;">
        <strong>${priceJump.destination}</strong> already moved from ${fromHtml} to ${toHtml} since the 7am Early Bird send.
      </p>
      <p class="sf-muted" style="margin:0;color:${EMAIL_COLORS.ledgerMuted};font-size:13px;">
        ${referralUrl ? linkHtml(referralUrl, 'Refer a friend to unlock 7am early access') : 'Refer a friend to unlock 7am early access, before prices like this move again.'}
      </p>
    </div>
  `;
}

// Everything the v2 template needs that isn't in the deal list. Away Mode partner names and
// blurbs always come from the in-code list, matched by slug against the live rows in the
// `partners` table: that table's `blurb` column is really the internal commission note, which must
// never appear in an email.
async function pickAwayModePartner(env, appUrl, seed) {
  const live = await getAwayModePartners(env);
  const liveSlugs = new Set((live || []).map((p) => p.slug));
  const candidates = AWAY_MODE_PARTNERS.filter((p) => liveSlugs.has(p.slug) && p.blurb);
  if (candidates.length === 0) return null;
  const partner = candidates[seed % candidates.length];
  return { name: partner.name, blurb: partner.blurb, href: buildAwayModeLink(appUrl, partner.slug) };
}

// Config for the public archive render: no user, so no unsubscribe link, referral link or
// personal data of any kind.
export async function buildArchiveConfig(env, { appUrl = 'https://sparkfare.com', now = new Date() } = {}) {
  const day = Math.floor(now.getTime() / 86400000);
  return {
    appUrl,
    destinations: DESTINATION_BLURBS,
    tips: FARE_TIPS,
    awayMode: await pickAwayModePartner(env, appUrl, day),
  };
}

async function buildDigestConfig({ env, appUrl, unsubscribeUrl, userId, priceJump, now, viewInBrowserUrl }) {
  const postalAddress = env.EMAIL_POSTAL_ADDRESS || process.env.EMAIL_POSTAL_ADDRESS || null;
  if (!postalAddress) console.warn('EMAIL_POSTAL_ADDRESS is not set; the daily email footer will have no postal address.');

  let referralUrl = null;
  if (env.ENABLE_T3_REFERRALS === 'true' && env.DB && userId) {
    try {
      const row = await env.DB.prepare('SELECT code FROM referral_codes WHERE user_id = ?').bind(userId).first();
      if (row?.code) referralUrl = `${appUrl}/r/${encodeURIComponent(row.code)}`;
    } catch (e) { console.error('referral code lookup failed:', e); }
  }

  const day = Math.floor(now.getTime() / 86400000);
  return {
    appUrl,
    unsubscribeUrl,
    postalAddress,
    referralUrl,
    priceJump,
    viewInBrowserUrl,
    destinations: DESTINATION_BLURBS,
    tips: FARE_TIPS,
    awayMode: await pickAwayModePartner(env, appUrl, day),
  };
}

export async function sendDailyDealEmail({ email, origin, deals, priceJump, userId }, env = {}) {
  const resend = getResendClient(env);
  if (!resend) {
    return { ok: true, mocked: true, message: 'RESEND_API_KEY not set; daily email mocked' };
  }

  const appUrl = env.APP_URL || process.env.APP_URL || 'https://sparkfare.com';
  const unsubscribeUrl = `${appUrl}/api/unsubscribe?email=${encodeURIComponent(email)}`;

  if (env.ENABLE_EMAIL_V2 === 'true') {
    const now = new Date();
    // When the web archive is on, today's stored edition supplies the edition number and the
    // "View in browser" link, so the email and the archived page always match.
    let edition = null;
    let viewInBrowserUrl = null;
    if (env.ENABLE_DIGEST_ARCHIVE === 'true' && env.DB) {
      try {
        const date = now.toISOString().slice(0, 10);
        const row = await env.DB.prepare(
          'SELECT edition_number FROM digest_editions WHERE origin = ? AND edition_date = ? AND kind = ?'
        ).bind(origin, date, 'daily').first();
        if (row) {
          edition = row.edition_number;
          viewInBrowserUrl = `${appUrl}/digest/${origin}/${date}`;
        }
      } catch (e) { console.error('digest edition lookup failed:', e); }
    }
    const rendered = renderDailyDigest({
      origin,
      deals,
      edition,
      user: { id: userId || null },
      now,
      config: await buildDigestConfig({ env, appUrl, unsubscribeUrl, userId, priceJump, now, viewInBrowserUrl }),
    });
    const response = await sendEmailWithGuard(resend, env, {
      from: env.EMAIL_FROM || process.env.EMAIL_FROM || 'Sparkfare <hello@sparkfare.com>',
      to: email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
    if (response.error) {
      throw new Error(`Resend rejected the send: ${response.error.message || JSON.stringify(response.error)}`);
    }
    return { ok: true, mocked: false, response };
  }

  const dealHtml = (deals || []).slice(0, 3).map((deal) => `
    <li style="margin:0 0 12px;color:${EMAIL_COLORS.ledger};font-size:15px;line-height:1.5;">
      <strong>${deal.display_name}</strong> — <span style="font-family:${FONT_NUMERALS};">${deal.price ? '$' + Number(deal.price).toLocaleString('en-US') : 'N/A'}</span>
      <div>${deal.booking_link ? linkHtml(deal.booking_link, 'Book this fare') : ''}</div>
    </li>
  `).join('');

  const response = await sendEmailWithGuard(resend, env, {
    from: env.EMAIL_FROM || process.env.EMAIL_FROM || 'Sparkfare <hello@sparkfare.com>',
    to: email,
    subject: `Sparkfare deals from ${origin}`,
    html: emailShell(`
      ${paragraphHtml(`Your saved origin is ${origin}.`)}
      ${fomoBannerHtml({ priceJump, appUrl, userId })}
      ${disclosureHtml('Sparkfare may earn a commission on flights booked through links in this email, at no extra cost to you.')}
      <ul style="margin:0 0 16px;padding-left:20px;">${dealHtml}</ul>
      ${openAppHtml(appUrl)}
      ${unsubscribeHtml(unsubscribeUrl, 'Unsubscribe from daily deal emails')}
    `),
  });

  if (response.error) {
    throw new Error(`Resend rejected the send: ${response.error.message || JSON.stringify(response.error)}`);
  }

  return { ok: true, mocked: false, response };
}

// Workplan Step 115 (Business Plan V2.0, Module B). Fires once per watchlist, the moment
// checkWatchlists() finds a real price at or below the user's target. High-priority framing --
// this is meant to prompt an immediate look, not sit in a digest.
export async function sendTargetReachedEmail({ email, origin, destination, price, targetPrice, bookingLink }, env = {}) {
  const resend = getResendClient(env);
  if (!resend) {
    return { ok: true, mocked: true, message: 'RESEND_API_KEY not set; target-reached email mocked' };
  }

  const appUrl = env.APP_URL || process.env.APP_URL || 'https://sparkfare.com';
  const unsubscribeUrl = `${appUrl}/api/unsubscribe?email=${encodeURIComponent(email)}`;
  const priceHtml = `<span style="font-family:${FONT_NUMERALS};">$${Number(price).toLocaleString('en-US')}</span>`;
  const targetHtml = `<span style="font-family:${FONT_NUMERALS};">$${Number(targetPrice).toLocaleString('en-US')}</span>`;

  const response = await sendEmailWithGuard(resend, env, {
    from: env.EMAIL_FROM || process.env.EMAIL_FROM || 'Sparkfare <hello@sparkfare.com>',
    to: email,
    subject: `Target reached — ${destination} from ${origin}`,
    html: emailShell(`
      ${disclosureHtml('Sparkfare may earn a commission on flights booked through links in this email, at no extra cost to you.')}
      ${paragraphHtml(`${destination} from ${origin} just hit ${priceHtml} — at or below the ${targetHtml} target you set. This is a live price, not a forecast; book now if you want it.`)}
      <p style="margin:0 0 16px;">${bookingLink ? linkHtml(bookingLink, 'Book this fare') : linkHtml(appUrl, 'See today\'s board')}</p>
      ${unsubscribeHtml(unsubscribeUrl)}
    `),
  });

  if (response.error) {
    throw new Error(`Resend rejected the send: ${response.error.message || JSON.stringify(response.error)}`);
  }

  return { ok: true, mocked: false, response };
}

export async function sendSupportAutoResponder(env, toEmail) {
  const resend = getResendClient(env);
  if (!resend) return { ok: false, mocked: true };

  const response = await sendEmailWithGuard(resend, env, {
    from: env.EMAIL_FROM || process.env.EMAIL_FROM || 'Sparkfare <hello@sparkfare.com>',
    to: toEmail,
    subject: 'Thanks for writing to Sparkfare',
    html: emailShell(`
      ${paragraphHtml('Thanks for writing to Sparkfare. We are an automated financial instrument, not a travel agency. We do not provide customer support, booking assistance, or price predictions.')}
      ${paragraphHtml('If you are experiencing a technical issue with your account, please reply to this email with details and we will review it.')}
    `),
  });

  if (response.error) {
    throw new Error(`Resend rejected the send: ${response.error.message || JSON.stringify(response.error)}`);
  }

  // N2: same stray copy-paste as sendVerificationEmail above -- this one was doubly broken, since
  // neither `partner`/`daysUntil` NOR `email` (this function's recipient param is `toEmail`) are
  // in scope here. Every real auto-response threw immediately after sending.
  return { ok: true, mocked: false, response };
}

// N2 (2026-09-25): revenue health monitor. Plain internal ops alert to hello@sparkfare.com --
// deliberately NOT routed through sendEmailWithGuard(), since that helper's suppression-list/
// List-Unsubscribe machinery exists for real subscribers, not an internal address that will never
// unsubscribe from its own operator's alerts. Called from checkRevenueHealth() in src/index.js.
export async function sendRevenueHealthAlertEmail(env, problems) {
  const resend = getResendClient(env);
  if (!resend) {
    return { ok: true, mocked: true, message: 'RESEND_API_KEY not set; revenue health alert mocked' };
  }

  const to = env.OPS_ALERT_EMAIL || process.env.OPS_ALERT_EMAIL || 'hello@sparkfare.com';
  const listHtml = problems.map(p => `<li style="margin:0 0 8px;">${p}</li>`).join('');

  const response = await resend.emails.send({
    from: env.EMAIL_FROM || process.env.EMAIL_FROM || 'Sparkfare <hello@sparkfare.com>',
    to,
    subject: `Sparkfare revenue health: ${problems.length} issue${problems.length === 1 ? '' : 's'} found`,
    html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#2B2620;"><p>The daily revenue health check found ${problems.length} issue${problems.length === 1 ? '' : 's'}:</p><ul>${listHtml}</ul></div>`,
  });

  if (response.error) {
    // Don't throw here -- this is the alert path itself; a failed alert send shouldn't crash the
    // scheduled job that's trying to report a *different* problem. Log and move on.
    console.error('Revenue health alert email failed:', response.error);
    return { ok: false, mocked: false, response };
  }

  return { ok: true, mocked: false, response };
}

// Step 117: internal ops alert when the weekly affiliate link health check finds a dead partner
// link. Same shape/rationale as sendRevenueHealthAlertEmail above (plain internal mail, not routed
// through sendEmailWithGuard, never throws on a failed send).
export async function sendLinkHealthAlertEmail(env, broken) {
  const resend = getResendClient(env);
  if (!resend) {
    return { ok: true, mocked: true, message: 'RESEND_API_KEY not set; link health alert mocked' };
  }

  const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const to = env.OPS_ALERT_EMAIL || process.env.OPS_ALERT_EMAIL || 'hello@sparkfare.com';
  const plural = broken.length === 1 ? '' : 's';
  const listHtml = broken.map(b =>
    `<li style="margin:0 0 8px;"><strong>${escapeHtml(b.name || b.slug || 'Unknown partner')}</strong> &mdash; ${escapeHtml(b.reason)}<br><span style="color:#6B6259;word-break:break-all;">${escapeHtml(b.url)}</span></li>`
  ).join('');

  const response = await resend.emails.send({
    from: env.EMAIL_FROM || process.env.EMAIL_FROM || 'Sparkfare <hello@sparkfare.com>',
    to,
    subject: `Sparkfare affiliate links: ${broken.length} broken link${plural}`,
    html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#2B2620;"><p>The weekly affiliate link health check found ${broken.length} broken partner link${plural}. Visitors clicking these are not earning commission:</p><ul>${listHtml}</ul></div>`,
  });

  if (response.error) {
    console.error('Link health alert email failed:', response.error);
    return { ok: false, mocked: false, response };
  }

  return { ok: true, mocked: false, response };
}

// Mechanic 6: Auto-Generated Sunday Newsletter
export async function sendSundayNewsletter(env, users, originData) {
  const resend = getResendClient(env);
  if (!resend) {
    console.warn('RESEND_API_KEY missing, skipping Sunday newsletter');
    return;
  }

  const { deals, intro, subjectA, subjectB } = originData;
  if (!deals || deals.length === 0) return;

  const dealsHtml = deals.map(d => `
    <div style="margin-bottom:20px; padding:15px; border:1px solid ${EMAIL_COLORS.line}; border-radius:6px; background:#fff;">
      <p style="margin:0 0 5px; font-weight:bold; font-size:16px;">${d.display_name}</p>
      <p style="margin:0 0 10px; color:${EMAIL_COLORS.sage}; font-weight:bold; font-size:18px;">$${d.price} <span style="font-size:12px; font-weight:normal; color:${EMAIL_COLORS.ledgerMuted};">round trip</span></p>
      <a href="${d.booking_link}" style="display:inline-block; padding:8px 16px; background:${EMAIL_COLORS.sage}; color:#fff; text-decoration:none; border-radius:4px; font-weight:bold; font-size:14px;">View Dates</a>
    </div>
  `).join('');

  const bodyHtml = `
    ${paragraphHtml(intro || 'We found some great flight deals from your home airport this week.')}
    <div style="margin: 30px 0;">
      ${dealsHtml}
    </div>
    ${paragraphHtml(`Ready to go? Click through to secure these fares before they jump.`)}
    ${disclosureHtml(`Prices update daily and may change. ${env?.AWAY_MODE_DISCLAIMER || ''}`)}
  `;

  const html = emailShell(bodyHtml);

  // F2: the batch path used to skip the bounce/complaint circuit breaker entirely.
  if (await isSendingGuardTripped(env)) {
    console.error('Sending guard is active. Skipping Sunday newsletter.');
    return;
  }

  // Split users 50/50 for A/B testing subject lines based on user ID parity.
  let emailUsers = users.filter(user => user.notify_email !== 0); // default to true if undefined

  // F2: this batch send goes straight to resend.batch.send(), completely bypassing
  // sendEmailWithGuard() -- the only place that checks email_suppressions or attaches
  // List-Unsubscribe headers. The caller's own users query already excludes unsubscribed_at,
  // but a bounced or spam-complained address (suppressed via the Resend webhook, a *separate*
  // signal from unsubscribed_at) had no protection here at all, a direct violation of T7's own
  // "suppressed address never receives an email" acceptance criterion. Filtered out here instead
  // of routing 100s of individual sends through sendEmailWithGuard, since a batch call is the
  // whole point of resend.batch.send().
  if (env?.DB && emailUsers.length > 0) {
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS email_suppressions (
        email TEXT PRIMARY KEY,
        reason TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `).run();
    // D1 caps a single query at 100 bound parameters, so look suppressions up in chunks -- one
    // big IN (...) list would throw for any origin with more than ~100 subscribers.
    const suppressedSet = new Set();
    const LOOKUP_CHUNK = 90;
    for (let i = 0; i < emailUsers.length; i += LOOKUP_CHUNK) {
      const chunkEmails = emailUsers.slice(i, i + LOOKUP_CHUNK).map((u) => u.email);
      const placeholders = chunkEmails.map(() => '?').join(',');
      const suppressed = await env.DB.prepare(
        `SELECT email FROM email_suppressions WHERE email IN (${placeholders})`
      ).bind(...chunkEmails).all();
      for (const r of suppressed.results || []) suppressedSet.add(r.email);
    }
    emailUsers = emailUsers.filter((u) => !suppressedSet.has(u.email));
  }

  const appUrl = env?.APP_URL || 'https://sparkfare.com';
  const batchRequests = emailUsers.map(user => {
    const isEven = user.id.charCodeAt(user.id.length - 1) % 2 === 0;
    const subject = isEven ? subjectA : subjectB;
    const unsubscribeUrl = `${appUrl}/api/unsubscribe?email=${encodeURIComponent(user.email)}`;

    return {
      from: env.EMAIL_FROM || process.env.EMAIL_FROM || 'Sparkfare Deals <hello@sparkfare.com>',
      to: [user.email],
      subject: subject || 'Your Sunday Deals are here',
      html: html,
      headers: {
        'X-Entity-Ref-ID': 'newsletter-' + Date.now(),
        'X-AB-Test-Variant': isEven ? 'A' : 'B',
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      }
    };
  });

  const chunkSize = 100;
  for (let i = 0; i < batchRequests.length; i += chunkSize) {
    const chunk = batchRequests.slice(i, i + chunkSize);
    try {
      await resend.batch.send(chunk);
    } catch (e) {
      console.error('Failed to send newsletter batch for origin:', e);
    }
  }

  // Push notifications
  if (env.ENABLE_T7B_PUSH === 'true' && env.DB) {
    const pushUsers = users.filter(user => user.notify_push === 1);
    if (pushUsers.length > 0) {
      const { sendWebPush } = await import('./push.js');
      const userIds = pushUsers.map(u => `'${u.id}'`).join(',');
      const subs = await env.DB.prepare(`SELECT * FROM push_subscriptions WHERE user_id IN (${userIds})`).all();
      
      if (subs.results && subs.results.length > 0) {
        const title = 'Sparkfare Weekly Deals';
        const body = `We found ${deals.length} great flight deals from your home airport. Check them out!`;
        const pushPayload = { title, body, url: 'https://sparkfare.com' };
        
        await Promise.allSettled(subs.results.map(sub => {
          return sendWebPush(env, { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, pushPayload);
        }));
      }
    }
  }
}


export async function sendPreDepartureSequenceEmail({ email, destination, departure_at, daysUntil, excludedPartnerIds = [], trip_id, trip_length, passenger_count }, env = {}) {
  const resend = getResendClient(env);
  if (!resend) {
    return { ok: true, mocked: true, message: 'RESEND_API_KEY not set; sequence email mocked' };
  }

  const activePartners = await getAwayModePartners(env);
  let available = activePartners;
  if (excludedPartnerIds.length > 0) {
    const filtered = activePartners.filter(p => !excludedPartnerIds.includes(p.slug));
    if (filtered.length > 0) available = filtered;
  }
  const partners = prioritizePartners(available, trip_length);
  const partner = partners[0];
  if (!partner) {
    return { ok: false, error: new Error('No live partners available') };
  }


  const appUrl = env.APP_URL || process.env.APP_URL || 'https://sparkfare.com';
  const unsubscribeUrl = `${appUrl}/api/unsubscribe?email=${encodeURIComponent(email)}`;
  const departureDate = departure_at
    ? new Date(departure_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    : null;

  const title = `Your trip to ${destination} is in ${daysUntil} days`;
  const partnerHtml = partnersListHtml([partner], { appUrl, tripId: trip_id, partnerId: partner.slug });

  const response = await sendEmailWithGuard(resend, env, {
    from: env.EMAIL_FROM || process.env.EMAIL_FROM || 'Sparkfare <hello@sparkfare.com>',
    to: email,
    subject: `Prep for ${destination}: ${partner.name}`,
    html: emailShell(`
      ${disclosureHtml()}
      ${paragraphHtml(title + `. Here's one thing to check off your list before you go:`)}
      ${partnerHtml}
      ${openAppHtml(appUrl)}
      ${unsubscribeHtml(unsubscribeUrl)}
    `),
  });

  if (response.error) {
    throw new Error(`Resend rejected the send: ${response.error.message || JSON.stringify(response.error)}`);
  }

  await logAwayModeEmail(env, { email, partnerId: partner.slug, emailType: 'pre_departure_day_' + daysUntil });

  return { ok: true, mocked: false, response, partner_slug: partner.slug };
}
