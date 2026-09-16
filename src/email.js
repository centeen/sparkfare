import 'dotenv/config';
import { Resend } from 'resend';

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

function disclosureHtml(text) {
  return `<p class="sf-muted" style="color:${EMAIL_COLORS.ledgerMuted};font-size:12px;line-height:1.5;margin:0 0 16px;">${text}</p>`;
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

  const response = await resend.emails.send({
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
// links to it.
export const AWAY_MODE_PARTNERS = [
  {
    slug: 'safetywing',
    name: 'SafetyWing',
    blurb: 'Travel medical insurance built for people leaving home for a while.',
    link: 'https://safetywing.com/nomad-insurance?referenceID=26593442&utm_source=26593442&utm_medium=Ambassador',
  },
  {
    slug: 'bounce',
    name: 'Bounce',
    blurb: 'Luggage storage by the hour, wherever you land — no need to kill time dragging a bag around.',
    link: 'https://go.bounce.com/SPARKFARE96253961631',
  },
  {
    slug: 'us-global-mail',
    name: 'US Global Mail',
    blurb: 'A virtual mailbox that opens, scans, and forwards your physical mail — so nothing piles up at home while you\'re away.',
    link: 'https://www.usglobalmail.com/?via=coby',
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
    slug: 'nordvpn',
    name: 'NordVPN',
    blurb: 'Keep your data off public airport and hotel Wi-Fi — set it up before you leave, not once you\'re already connected.',
    link: 'https://go.nordvpn.net/aff_c?aff_id=2495&offer_id=314&url_id=7264',
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

// Workplan Step 113. Builds a /go/:affiliate link instead of linking straight to a partner's raw
// URL, so the real click (not just "an email was sent") gets logged server-side before the
// redirect. tripId/partnerId are optional -- away-mode.html's anonymous, no-session page omits
// both and still gets a valid (if less specific) click record.
function buildAwayModeLink(appUrl, slug, { tripId, partnerId } = {}) {
  const params = new URLSearchParams();
  if (tripId) params.set('trip_id', tripId);
  if (partnerId) params.set('partner_id', partnerId);
  const query = params.toString();
  return `${appUrl}/go/${slug}${query ? `?${query}` : ''}`;
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
  const partners = prioritizePartners(AWAY_MODE_PARTNERS, trip_length);

  const response = await resend.emails.send({
    from: env.EMAIL_FROM || process.env.EMAIL_FROM || 'Sparkfare <hello@sparkfare.com>',
    to: email,
    subject: `Everything else, handled — before ${destination}`,
    html: emailShell(`
      ${disclosureHtml('Sparkfare may earn a commission on services booked through links in this email, at no extra cost to you.')}
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
  const curatedPartners = prioritizePartners(
    AWAY_MODE_PARTNERS.filter((partner) => STRESS_VALVE_PARTNER_SLUGS.includes(partner.slug)),
    trip_length
  );

  const response = await resend.emails.send({
    from: env.EMAIL_FROM || process.env.EMAIL_FROM || 'Sparkfare <hello@sparkfare.com>',
    to: email,
    subject: `Two days in — is ${destination} actually handled?`,
    html: emailShell(`
      ${disclosureHtml('Sparkfare may earn a commission on services booked through links in this email, at no extra cost to you.')}
      ${paragraphHtml(`Your trip to ${destination}${departureDate ? ` on ${departureDate}` : ''} is booked. Two things worth locking down now, before they turn into a scramble later:`)}
      ${groupTravelHtml(passenger_count)}
      ${partnersListHtml(curatedPartners, { appUrl, tripId: trip_id, partnerId: partner_id })}
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
  const curatedPartners = prioritizePartners(
    AWAY_MODE_PARTNERS.filter((partner) => DEPARTURE_BRIEFING_PARTNER_SLUGS.includes(partner.slug)),
    trip_length
  );

  const response = await resend.emails.send({
    from: env.EMAIL_FROM || process.env.EMAIL_FROM || 'Sparkfare <hello@sparkfare.com>',
    to: email,
    subject: `One week out — ${destination}`,
    html: emailShell(`
      ${disclosureHtml('Sparkfare may earn a commission on services booked through links in this email, at no extra cost to you.')}
      ${paragraphHtml(`${destination}${departureDate ? ` (${departureDate})` : ''} is one week out. Time to actually set up the three things that matter most this close to departure:`)}
      ${groupTravelHtml(passenger_count)}
      ${partnersListHtml(curatedPartners, { appUrl, tripId: trip_id, partnerId: partner_id })}
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

  const response = await resend.emails.send({
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

  return { ok: true, mocked: false, response };
}

export async function sendBookingConfirmedEmail({ email, destination, partner_id, trip_id, trip_length, passenger_count }, env = {}) {
  const resend = getResendClient(env);
  if (!resend) {
    return { ok: true, mocked: true, message: 'RESEND_API_KEY not set; booking-confirmed email mocked' };
  }

  const appUrl = env.APP_URL || process.env.APP_URL || 'https://sparkfare.com';
  const unsubscribeUrl = `${appUrl}/api/unsubscribe?email=${encodeURIComponent(email)}`;
  const partners = prioritizePartners(AWAY_MODE_PARTNERS, trip_length);

  const response = await resend.emails.send({
    from: env.EMAIL_FROM || process.env.EMAIL_FROM || 'Sparkfare <hello@sparkfare.com>',
    to: email,
    subject: `Booking confirmed — ${destination}`,
    html: emailShell(`
      ${paragraphHtml(`Your booking to ${destination} is confirmed. Have a great trip.`)}
      ${disclosureHtml('Sparkfare may earn a commission on services booked through links in this email, at no extra cost to you.')}
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
  const partners = prioritizePartners(AWAY_MODE_PARTNERS, trip_length);

  const response = await resend.emails.send({
    from: env.EMAIL_FROM || process.env.EMAIL_FROM || 'Sparkfare <hello@sparkfare.com>',
    to: email,
    subject: `Departing ${timing} — ${destination}`,
    html: emailShell(`
      ${disclosureHtml('Sparkfare may earn a commission on services booked through links in this email, at no extra cost to you.')}
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

  const response = await resend.emails.send({
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

export async function sendDailyDealEmail({ email, origin, deals, priceJump, userId }, env = {}) {
  const resend = getResendClient(env);
  if (!resend) {
    return { ok: true, mocked: true, message: 'RESEND_API_KEY not set; daily email mocked' };
  }

  const appUrl = env.APP_URL || process.env.APP_URL || 'https://sparkfare.com';
  const unsubscribeUrl = `${appUrl}/api/unsubscribe?email=${encodeURIComponent(email)}`;
  const dealHtml = (deals || []).slice(0, 3).map((deal) => `
    <li style="margin:0 0 12px;color:${EMAIL_COLORS.ledger};font-size:15px;line-height:1.5;">
      <strong>${deal.display_name}</strong> — <span style="font-family:${FONT_NUMERALS};">${deal.price ? '$' + Number(deal.price).toLocaleString('en-US') : 'N/A'}</span>
      <div>${deal.booking_link ? linkHtml(deal.booking_link, 'Book this fare') : ''}</div>
    </li>
  `).join('');

  const response = await resend.emails.send({
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

  const response = await resend.emails.send({
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
