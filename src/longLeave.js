// G1 (Task C): Long Leave mode. A trip of 30 days or more gets its own stored trip-length token, `30_plus`, and a short
// lead section on /leave and /away-mode before the usual checklist.
//
// Everything visible is behind ENABLE_LONG_LEAVE (default "false"). With it off the token cannot be written (a client
// that still sends it is stored as "2+ weeks", the bucket it is split from), /api/long-leave says enabled:false, and
// /api/leave/plan and /api/events behave exactly as before, including logging no new events.
//
// Rules: plain, calm copy with no urgency; the insurance item is educational only, with no link, no partner and no
// tracking (ROADMAP step 19); the only partner link is the virtual mailbox, through /out with src=leave_long.

export const LONG_LEAVE_TOKEN = '30_plus';
export const LONG_LEAVE_FALLBACK = '2+ weeks';
export const LONG_LEAVE_SRC = 'leave_long';
export const MAIL_PARTNER_SLUG = 'us-global-mail';

// Checked 2026-10-13 on https://www.usps.com/manage/hold-mail.htm ("a minimum of 3 days and a maximum of 30 days";
// "To hold your mail longer or to reroute your mail, please sign up for a forwarding service") and on
// https://faq.usps.com/s/article/USPS-Hold-Mail-The-Basics. If USPS changes the limit, change it here and in the test.
export const USPS_HOLD_MAX_DAYS = 30;
export const USPS_HOLD_URL = 'https://www.usps.com/manage/hold-mail.htm';
export const USPS_FORWARD_URL = 'https://www.usps.com/manage/forward.htm';

export function longLeaveEnabled(env) {
  return env?.ENABLE_LONG_LEAVE === 'true';
}

export function isLongLeave(tripLength) {
  return tripLength === LONG_LEAVE_TOKEN;
}

// The 30_plus token is only storable while the flag is on. Every other value passes through untouched.
export function normalizeTripLength(value, env) {
  if (value === LONG_LEAVE_TOKEN && !longLeaveEnabled(env)) return LONG_LEAVE_FALLBACK;
  return value;
}

// /leave's length answers <-> stored trip_length tokens. Only unambiguous pairs map; anything else is null so a saved
// value is never overwritten, and a saved "2+ weeks" does not skip the question.
export function tripLengthFromLeaveLength(length) {
  if (length === 'weekend') return 'weekend';
  if (length === 'month_plus') return LONG_LEAVE_TOKEN;
  return null;
}

export function leaveLengthFromTripLength(tripLength) {
  if (tripLength === 'weekend') return 'weekend';
  if (tripLength === LONG_LEAVE_TOKEN) return 'month_plus';
  if (tripLength === '4-6' || tripLength === '7-10' || tripLength === '11-14') return 'one_two_weeks';
  return null;
}

// The three lead items, in order. `partners` is the live registry list; the partner link renders only for a partner
// that is in it.
export function buildLongLeaveLead(partners = []) {
  const live = new Set((partners || []).map((p) => p && p.slug).filter(Boolean));
  const mailLinks = [
    { label: 'USPS Hold Mail', href: USPS_HOLD_URL, external: true, sponsored: false },
    { label: 'USPS Forward Mail', href: USPS_FORWARD_URL, external: true, sponsored: false },
  ];
  if (live.has(MAIL_PARTNER_SLUG)) {
    const name = ((partners || []).find((p) => p && p.slug === MAIL_PARTNER_SLUG) || {}).name || 'US Global Mail';
    mailLinks.push({ label: `${name} (partner link)`, href: `/out/${MAIL_PARTNER_SLUG}?src=${LONG_LEAVE_SRC}`, external: false, sponsored: true, slug: MAIL_PARTNER_SLUG });
  }
  return [
    {
      key: 'mail',
      text: 'Decide what happens to your mail',
      action: `USPS Hold Mail can hold your mail at your local Post Office for up to ${USPS_HOLD_MAX_DAYS} days. For a longer absence, USPS offers mail forwarding instead. A virtual mailbox is a third option: it receives your mail, scans the envelope, and forwards what you ask for.`,
      links: mailLinks,
    },
    {
      key: 'vacancy',
      text: 'Ask your insurer about an empty home',
      action: 'Many homeowner policies change coverage if a home is unoccupied for a set period. Ask your insurer what their rule is before you go.',
      links: [],
    },
    {
      key: 'water',
      text: 'Water',
      action: 'Shut off the main water supply, or ask someone to check the home while you are away.',
      links: [],
    },
  ];
}
