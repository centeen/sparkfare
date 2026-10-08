// Away Move 3 (ROADMAP step 55): the "Leave-ready" page. Pure functions, no I/O.
// The plan lists what is done and what is still open from six short answers. It never scores the traveler,
// never says a home is protected or ready, and puts the free route first: a partner link appears only for an
// entry in the live partner registry and only after the free step.

export const LENGTH_OPTIONS = ['weekend', 'one_two_weeks', 'month_plus', 'skip'];
export const YES_NO = ['yes', 'no', 'skip'];

// key -> allowed answers. `length` is a bucket; the rest are yes / no / skip.
export const QUESTIONS = [
  { key: 'length', text: 'How long will you be away?', options: [['weekend', 'A weekend'], ['one_two_weeks', '1 to 2 weeks'], ['month_plus', 'A month or more'], ['skip', 'Skip']] },
  { key: 'pets', text: 'Are pets staying home while you are away?', options: [['yes', 'Yes'], ['no', 'No'], ['skip', 'Skip']] },
  { key: 'plants', text: 'Do you have plants that need watering while you are gone?', options: [['yes', 'Yes'], ['no', 'No'], ['skip', 'Skip']] },
  { key: 'checkin', text: 'Is someone going to check in on your home?', options: [['yes', 'Yes'], ['no', 'No'], ['skip', 'Skip']] },
  { key: 'mail', text: 'Is your mail sorted for while you are away?', options: [['yes', 'Yes'], ['no', 'No'], ['skip', 'Skip']] },
  { key: 'water', text: 'Do you know where your water shutoff is?', options: [['yes', 'Yes'], ['no', 'No'], ['skip', 'Skip']] },
];

export const QUESTION_KEYS = QUESTIONS.map((q) => q.key);

// The free official route for mail. Checked 2026-10-08: usps.com/manage/hold-mail.htm.
export const USPS_HOLD_MAIL = { label: 'USPS Hold Mail (free)', href: 'https://www.usps.com/manage/hold-mail.htm' };
export const MAIL_PARTNER_SLUG = 'us-global-mail';

// Keeps only the six known keys and only allowed values; anything else becomes 'skip'. Never keeps free text.
export function normalizeAnswers(raw) {
  const out = {};
  for (const q of QUESTIONS) {
    const allowed = q.options.map((o) => o[0]);
    const v = raw && typeof raw === 'object' ? raw[q.key] : undefined;
    out[q.key] = allowed.includes(v) ? v : 'skip';
  }
  return out;
}

// Maps the length bucket to the trip_length values /api/signup already stores.
export function tripLengthForSignup(length) {
  if (length === 'weekend') return 'weekend';
  if (length === 'month_plus') return '2+ weeks';
  return '7-10';
}

function summaryFor(openCount) {
  if (openCount === 0) return 'Nothing left to sort from your answers.';
  return openCount === 1 ? '1 thing left to sort' : `${openCount} things left to sort`;
}

// partners: the live registry entries, [{ slug, name, ... }]. A slug not in this list never renders as a link.
export function buildLeaveReadyPlan(answersRaw, partners = []) {
  const a = normalizeAnswers(answersRaw);
  const liveSlugs = new Set((partners || []).map((p) => p && p.slug).filter(Boolean));
  const partnerByslug = Object.fromEntries((partners || []).filter(Boolean).map((p) => [p.slug, p]));
  const done = [];
  const open = [];
  const skipped = [];
  const note = (key) => { if (a[key] === 'skip') skipped.push(key); };

  // Someone checking in
  if (a.checkin === 'yes') done.push({ key: 'checkin', text: 'Someone is checking in on your home.' });
  else if (a.checkin === 'no') open.push({ key: 'checkin', text: 'Ask someone to check on your home', action: 'Pick one person, give them a key and your return date, and tell them where the water shutoff is.', links: [] });
  note('checkin');

  // Water shutoff
  if (a.water === 'yes') done.push({ key: 'water', text: 'You know where your water shutoff is.' });
  else if (a.water === 'no') open.push({ key: 'water', text: 'Find your water shutoff', action: 'Locate the main valve (often where the water line enters the home, near the meter) and check you can turn it by hand.', links: [] });
  note('water');

  // Mail: free route first, then the partner only if it is live (and only worth a mention for a long trip)
  if (a.mail === 'yes') done.push({ key: 'mail', text: 'Your mail is sorted.' });
  else if (a.mail === 'no') {
    const links = [{ label: USPS_HOLD_MAIL.label, href: USPS_HOLD_MAIL.href, external: true, sponsored: false }];
    let action = 'Ask the post office to hold your mail, or have a neighbor collect it.';
    if (a.length === 'month_plus' && liveSlugs.has(MAIL_PARTNER_SLUG)) {
      action += ' For a long trip, a virtual mailbox can also open, scan and forward mail.';
      links.push({ label: `${partnerByslug[MAIL_PARTNER_SLUG].name || 'US Global Mail'} (partner link)`, href: `/out/${MAIL_PARTNER_SLUG}?src=leave`, external: false, sponsored: true, slug: MAIL_PARTNER_SLUG });
    }
    open.push({ key: 'mail', text: 'Sort your mail', action, links });
  }
  note('mail');

  // Pets: free steps only today (no live pet partner)
  if (a.pets === 'yes') open.push({ key: 'pets', text: 'Line up care for your pets', action: 'Choose who covers (friend, sitter, boarding or a home check), meet them with your pet first, and write down feeding, medication and vet details. Do not write alarm codes on the sheet.', links: [] });
  note('pets');

  // Plants
  if (a.plants === 'yes') open.push({ key: 'plants', text: 'Decide who waters the plants', action: 'Ask your check-in person, or group plants together and water them well just before you leave.', links: [] });
  note('plants');

  // length is context, not a to-do
  note('length');

  return { answers: a, done, open, skipped, summary: summaryFor(open.length) };
}
