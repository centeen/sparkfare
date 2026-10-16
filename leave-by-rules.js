// Leave-by plan rules as data (G23 / Addendum E).
// Pure data and pure functions. Zero I/O, zero network, zero state mutation.
// Compliant with Section 1, 2, 9, 10 of docs/leave_by_plan_design.md.

// Destination-to-country mapping for all 40 sparkfare destinations.
// Keyed by both canonical display name and common short name.
export const DESTINATION_COUNTRY_MAP = {
  'Bali, Indonesia': 'ID',
  'Bali': 'ID',
  'Tokyo, Japan': 'JP',
  'Tokyo': 'JP',
  'Cape Town, South Africa': 'ZA',
  'Cape Town': 'ZA',
  'Sydney, Australia': 'AU',
  'Sydney': 'AU',
  'Maldives (Male)': 'MV',
  'Maldives': 'MV',
  'Buenos Aires, Argentina': 'AR',
  'Buenos Aires': 'AR',
  'Rio de Janeiro, Brazil': 'BR',
  'Rio de Janeiro': 'BR',
  'Phuket, Thailand': 'TH',
  'Phuket': 'TH',
  'Ho Chi Minh City, Vietnam': 'VN',
  'Ho Chi Minh City': 'VN',
  'Taipei, Taiwan': 'TW',
  'Taipei': 'TW',
  'Amalfi Coast, Italy': 'IT',
  'Amalfi Coast': 'IT',
  'Algarve, Portugal': 'PT',
  'Algarve': 'PT',
  'Athens, Greece': 'GR',
  'Athens': 'GR',
  'Thessaloniki, Greece': 'GR',
  'Thessaloniki': 'GR',
  'Larnaca, Cyprus': 'CY',
  'Larnaca': 'CY',
  'Madrid, Spain': 'ES',
  'Madrid': 'ES',
  'Dubrovnik, Croatia': 'HR',
  'Dubrovnik': 'HR',
  'Tulum, Mexico': 'MX',
  'Tulum': 'MX',
  'Mallorca, Spain': 'ES',
  'Mallorca': 'ES',
  'San Jose, Costa Rica': 'CR',
  'San Jose': 'CR',
  'Da Nang, Vietnam': 'VN',
  'Da Nang': 'VN',
  'Cebu, Philippines': 'PH',
  'Cebu': 'PH',
  'Prague, Czechia': 'CZ',
  'Prague': 'CZ',
  'Budapest, Hungary': 'HU',
  'Budapest': 'HU',
  'Sofia / Borovets, Bulgaria': 'BG',
  'Sofia / Borovets': 'BG',
  'Bogota, Colombia': 'CO',
  'Bogota': 'CO',
  'Krakow, Poland': 'PL',
  'Krakow': 'PL',
  'Bucharest, Romania': 'RO',
  'Bucharest': 'RO',
  'Guatemala City, Guatemala': 'GT',
  'Guatemala City': 'GT',
  'Marrakech, Morocco': 'MA',
  'Marrakech': 'MA',
  'Cappadocia, Turkey': 'TR',
  'Cappadocia': 'TR',
  'Petra, Jordan': 'JO',
  'Petra': 'JO',
  'Oaxaca, Mexico': 'MX',
  'Oaxaca': 'MX',
  'Cusco, Peru': 'PE',
  'Cusco': 'PE',
  'Luxor, Egypt': 'EG',
  'Luxor': 'EG',
  'Tbilisi, Georgia': 'GE',
  'Tbilisi': 'GE',
  'Baku, Azerbaijan': 'AZ',
  'Baku': 'AZ',
  'Antigua, Guatemala': 'GT',
  'Antigua': 'GT',
  'Muscat, Oman': 'OM',
  'Muscat': 'OM',
  'Lisbon, Portugal': 'PT',
  'Lisbon': 'PT'
};

// ISO country code to Country Name for fallback messaging
export const COUNTRY_NAMES = {
  'ID': 'Indonesia',
  'JP': 'Japan',
  'ZA': 'South Africa',
  'AU': 'Australia',
  'MV': 'Maldives',
  'AR': 'Argentina',
  'BR': 'Brazil',
  'TH': 'Thailand',
  'VN': 'Vietnam',
  'TW': 'Taiwan',
  'IT': 'Italy',
  'PT': 'Portugal',
  'GR': 'Greece',
  'CY': 'Cyprus',
  'ES': 'Spain',
  'HR': 'Croatia',
  'MX': 'Mexico',
  'CR': 'Costa Rica',
  'PH': 'Philippines',
  'CZ': 'Czechia',
  'HU': 'Hungary',
  'BG': 'Bulgaria',
  'CO': 'Colombia',
  'PL': 'Poland',
  'RO': 'Romania',
  'GT': 'Guatemala',
  'MA': 'Morocco',
  'TR': 'Turkey',
  'JO': 'Jordan',
  'PE': 'Peru',
  'EG': 'Egypt',
  'GE': 'Georgia',
  'AZ': 'Azerbaijan',
  'OM': 'Oman'
};

export function getCountryForDestination(dest) {
  if (!dest || typeof dest !== 'string') return null;
  const trimmed = dest.trim();
  return DESTINATION_COUNTRY_MAP[trimmed] || null;
}

export function leaveByPlanEnabled(env) {
  return Boolean(env && env.ENABLE_LEAVE_BY_PLAN === 'true');
}

// The 40 destinations, in the order of sparkfare_destinations.json (tests keep the two in step).
export const LEAVE_BY_DESTINATIONS = [
  "Bali, Indonesia",
  "Tokyo, Japan",
  "Cape Town, South Africa",
  "Sydney, Australia",
  "Maldives (Male)",
  "Buenos Aires, Argentina",
  "Rio de Janeiro, Brazil",
  "Phuket, Thailand",
  "Ho Chi Minh City, Vietnam",
  "Taipei, Taiwan",
  "Amalfi Coast, Italy",
  "Algarve, Portugal",
  "Athens, Greece",
  "Thessaloniki, Greece",
  "Larnaca, Cyprus",
  "Madrid, Spain",
  "Dubrovnik, Croatia",
  "Tulum, Mexico",
  "Mallorca, Spain",
  "San Jose, Costa Rica",
  "Da Nang, Vietnam",
  "Cebu, Philippines",
  "Prague, Czechia",
  "Budapest, Hungary",
  "Sofia / Borovets, Bulgaria",
  "Bogota, Colombia",
  "Krakow, Poland",
  "Bucharest, Romania",
  "Guatemala City, Guatemala",
  "Marrakech, Morocco",
  "Cappadocia, Turkey",
  "Petra, Jordan",
  "Oaxaca, Mexico",
  "Cusco, Peru",
  "Luxor, Egypt",
  "Tbilisi, Georgia",
  "Baku, Azerbaijan",
  "Antigua, Guatemala",
  "Muscat, Oman",
  "Lisbon, Portugal"
];

// Verified 2026-10-16: each of these State Department addresses returned the country page.
export const COUNTRY_SLUGS = {
  ID: 'indonesia', JP: 'japan', ZA: 'south-africa', AU: 'australia', MV: 'maldives', AR: 'argentina', BR: 'brazil',
  TH: 'thailand', VN: 'vietnam', TW: 'taiwan', IT: 'italy', PT: 'portugal', GR: 'greece', CY: 'cyprus', ES: 'spain',
  HR: 'croatia', MX: 'mexico', CR: 'costa-rica', PH: 'philippines', CZ: 'czechia', HU: 'hungary', BG: 'bulgaria',
  CO: 'colombia', PL: 'poland', RO: 'romania', GT: 'guatemala', MA: 'morocco', TR: 'turkey', JO: 'jordan', PE: 'peru',
  EG: 'egypt', GE: 'georgia', AZ: 'azerbaijan', OM: 'oman'
};

export function stateDeptCountryUrl(code) {
  const slug = COUNTRY_SLUGS[code];
  return slug ? `https://travel.state.gov/en/international-travel/travel-advisories/${slug}.html` : 'https://travel.state.gov';
}

// The 14 destinations in the 30 ETIAS countries (EU ETIAS site, read 2026-10-16).
const ETIAS_COUNTRIES = ['PT', 'ES', 'IT', 'GR', 'CY', 'HU', 'CZ', 'PL', 'HR', 'RO', 'BG'];

const COMMISSION_LINE = 'Sparkfare may earn a commission if you buy through this link, at no extra cost to you.';

// Trip depth (Addendum G, section 4): up to 10 days is Short, 11 to 29 Standard, 30 or more Long.
export function depthForDays(days) {
  if (days <= 10) return 'short';
  if (days <= 29) return 'standard';
  return 'long';
}

// Rules array. Fields beyond the G1 shape: `kind` (entry, mail, home, travel, phone, note) and `shortRank` (lower shows first
// when a Short plan has room for three items). A rule without `quote` and `sourceUrl` is a plain suggestion (a home item).
export const LEAVE_BY_RULES = [
  // The passport check itself is G5 (ENABLE_PASSPORT_CHECK). Until then the first item points at the State Department page for
  // the destination; the address is filled in per country by buildLeaveByPlan.
  {
    id: 'passport-check',
    kind: 'passport',
    title: 'Check your passport',
    appliesWhen: { countries: ['*'] },
    actBy: null,
    why: null,
    officialUrl: null,
    sourceUrl: null,
    sourceName: 'U.S. Department of State',
    asOf: '2026-10-16',
    quote: null,
    status: 'held',
    partner: null
  },

  // Mail
  {
    id: 'usps-hold-mail',
    kind: 'mail',
    shortRank: 2,
    title: 'Ask USPS to hold your mail',
    appliesWhen: { countries: ['*'], minDays: 3, maxDays: 30 },
    actBy: { kind: 'suggested', daysBefore: 3 },
    why: 'USPS can hold your mail for 3 to 30 days.',
    officialUrl: 'https://www.usps.com/manage/hold-mail.htm',
    sourceUrl: 'https://www.usps.com/manage/hold-mail.htm',
    sourceName: 'USPS Hold Mail page',
    asOf: '2026-10-16',
    quote: 'a minimum of 3 days and a maximum of 30 days',
    status: 'active',
    partner: null
  },
  {
    id: 'usps-forwarding',
    kind: 'mail',
    title: 'Set up mail forwarding',
    appliesWhen: { countries: ['*'], minDays: 31 },
    actBy: { kind: 'suggested', daysBefore: 7 },
    why: 'For more than 30 days, USPS points you to a forwarding service. A virtual mailbox is another option.',
    officialUrl: 'https://www.usps.com/manage/hold-mail.htm',
    sourceUrl: 'https://www.usps.com/manage/hold-mail.htm',
    sourceName: 'USPS Hold Mail page',
    asOf: '2026-10-16',
    quote: 'please sign up for a forwarding service',
    status: 'active',
    partner: { slug: 'us-global-mail', name: 'US Global Mail', disclosure: COMMISSION_LINE }
  },

  // Entry steps, read on the official pages 2026-10-16
  {
    id: 'thailand-arrival-card',
    kind: 'entry',
    shortRank: 1,
    title: 'Fill in the Thailand Digital Arrival Card',
    appliesWhen: { countries: ['TH'] },
    actBy: { kind: 'suggested', daysBefore: 3 },
    why: 'Thailand asks visitors to submit the arrival card 3 days before they arrive.',
    officialUrl: 'https://tdac.immigration.go.th/arrival-card/',
    sourceUrl: 'https://tdac.immigration.go.th/arrival-card/',
    sourceName: 'Thailand Digital Arrival Card',
    asOf: '2026-10-16',
    quote: 'Foreigners are required to submit their arrival card information 3 days in advance of their arrival date in Thailand.',
    status: 'active',
    partner: null
  },
  {
    id: 'australia-eta',
    kind: 'entry',
    shortRank: 1,
    title: 'Apply for an Australian ETA, if your passport is eligible',
    appliesWhen: { countries: ['AU'] },
    actBy: { kind: 'suggested', daysBefore: 7 },
    why: 'Australia uses an Electronic Travel Authority for eligible passports. You apply in the Australian ETA app, from outside Australia.',
    officialUrl: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/electronic-travel-authority-601',
    sourceUrl: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/electronic-travel-authority-601',
    sourceName: 'Australian Department of Home Affairs',
    asOf: '2026-10-16',
    quote: 'There is a service charge of AUD20 to use the Australian ETA app.',
    status: 'active',
    partner: null
  },
  {
    id: 'brazil-evisa',
    kind: 'entry',
    shortRank: 1,
    title: 'Check whether you need a Brazil eVisa',
    appliesWhen: { countries: ['BR'] },
    actBy: null,
    why: null,
    officialUrl: 'https://brazil.vfsevisa.com/',
    sourceUrl: 'https://brazil.vfsevisa.com/',
    sourceName: 'Brazil eVisa portal',
    asOf: '2026-10-16',
    quote: null,
    status: 'held',
    partner: null
  },
  {
    id: 'indonesia-arrival-card',
    kind: 'entry',
    shortRank: 1,
    title: 'Complete the Indonesia arrival card',
    appliesWhen: { countries: ['ID'] },
    actBy: { kind: 'suggested', daysBefore: 1 },
    why: 'Indonesia lets you complete the arrival card online only within 72 hours of arriving. It is free.',
    officialUrl: 'https://allindonesia.imigrasi.go.id/',
    sourceUrl: 'https://travel.state.gov/en/international-travel/travel-advisories/indonesia.html',
    sourceName: 'U.S. Department of State, Indonesia page',
    asOf: '2026-10-16',
    quote: 'Within 72 hours of arrival only: Complete an arrival card online or through the All Indonesia mobile app.',
    status: 'active',
    partner: null
  },
  {
    id: 'bali-levy',
    kind: 'entry',
    shortRank: 1,
    title: 'Pay the Bali tourist levy',
    appliesWhen: { countries: ['ID'] },
    actBy: { kind: 'suggested', daysBefore: 7 },
    why: 'Bali charges foreign visitors a tourist levy, paid through the official Love Bali site.',
    officialUrl: 'https://lovebali.baliprov.go.id/',
    sourceUrl: 'https://lovebali.baliprov.go.id/',
    sourceName: 'Love Bali',
    asOf: '2026-10-16',
    quote: 'pay the Bali Foreign Tourist Levy',
    status: 'active',
    partner: null
  },
  {
    id: 'etias',
    kind: 'note',
    title: 'European Travel Information and Authorisation System (ETIAS)',
    appliesWhen: { countries: ETIAS_COUNTRIES },
    actBy: null,
    why: 'Not required yet; the EU has not set a start date.',
    officialUrl: 'https://travel-europe.europa.eu/en/etias',
    sourceUrl: 'https://travel-europe.europa.eu/en/etias',
    sourceName: 'Official ETIAS website',
    asOf: '2026-10-16',
    quote: 'ETIAS is currently not in operation and no applications for travel authorisations are collected at this point.',
    status: 'not_yet_required',
    partner: null
  },

  // Travel documents
  {
    id: 'idp',
    kind: 'travel',
    shortRank: 4,
    title: 'Get an International Driving Permit',
    appliesWhen: { countries: ['*'], answers: { driving: ['yes'] } },
    actBy: { kind: 'sourced', windowDays: 180, daysBefore: 21 },
    why: "AAA issues an International Driving Permit to U.S. licence holders. It can't be issued more than six months before the start date you want.",
    officialUrl: 'https://www.aaa.com/vacation/idpf.html',
    sourceUrl: 'https://www.aaa.com/vacation/idpf.html',
    sourceName: 'AAA IDP page',
    asOf: '2026-10-16',
    quote: 'International Driving Permits may not be issued more than six (6) months in advance of desired effective date.',
    status: 'active',
    partner: null
  },
  {
    id: 'step',
    kind: 'travel',
    shortRank: 6,
    title: 'Enroll your trip in STEP',
    appliesWhen: { countries: ['*'], minDays: 4 },
    actBy: { kind: 'suggested', daysBefore: 14 },
    why: 'STEP is a free State Department service. Enrolling lets the embassy reach you in an emergency.',
    officialUrl: 'https://mytravel.state.gov/s/step',
    sourceUrl: 'https://mytravel.state.gov/s/step',
    sourceName: 'U.S. Department of State, STEP',
    asOf: '2026-10-16',
    quote: 'is a free service to allow U.S. citizens and nationals to enroll their trip abroad',
    status: 'active',
    partner: null
  },

  // Phone and data (one disclosed partner; which one leads is an open question)
  {
    id: 'destination-phone-data',
    kind: 'phone',
    shortRank: 7,
    title: 'Sort your phone and data',
    appliesWhen: { countries: ['*'], minDays: 11 },
    actBy: { kind: 'suggested', daysBefore: 3 },
    why: 'An eSIM can be set up before you leave.',
    status: 'active',
    isHomeItem: true,
    partner: { slug: 'yesim', name: 'Yesim', disclosure: COMMISSION_LINE }
  },

  // Home items: plain suggestions with no source line, because they are not facts about a government or a provider.
  {
    id: 'home-pets',
    kind: 'home',
    shortRank: 3,
    title: 'Line up care for your pet',
    appliesWhen: { countries: ['*'], answers: { pet_home: ['yes'] } },
    actBy: { kind: 'suggested', daysBefore: 14 },
    why: 'Line up care for your pet well before you leave.',
    status: 'active',
    isHomeItem: true,
    partner: null
  },
  {
    id: 'home-water-shutoff',
    kind: 'home',
    shortRank: 3,
    title: 'Find your water shutoff',
    appliesWhen: { countries: ['*'] },
    actBy: { kind: 'suggested', daysBefore: 1 },
    why: 'Find your water shutoff and make sure it can be turned by hand.',
    status: 'active',
    isHomeItem: true,
    partner: null
  },
  {
    id: 'home-checkin',
    kind: 'home',
    shortRank: 4,
    title: 'Ask someone to check on your home',
    appliesWhen: { countries: ['*'], minDays: 4, answers: { keeper: ['no'] } },
    actBy: { kind: 'suggested', daysBefore: 7 },
    why: 'Ask someone you trust to look in while you are away.',
    status: 'active',
    isHomeItem: true,
    partner: null
  },
  {
    id: 'home-keeper-handoff',
    kind: 'home',
    shortRank: 4,
    title: 'Give whoever checks in a handoff sheet',
    appliesWhen: { countries: ['*'], answers: { keeper: ['yes'] } },
    actBy: { kind: 'suggested', daysBefore: 3 },
    why: 'A one-page sheet of what to do and who to call keeps it simple for them.',
    internalUrl: '/blog/one-page-home-handoff-sheet',
    status: 'active',
    isHomeItem: true,
    partner: null
  },
  {
    id: 'home-airport-parking',
    kind: 'home',
    shortRank: 5,
    title: 'Sort your airport parking',
    appliesWhen: { countries: ['*'], answers: { airport_parking: ['yes'] } },
    actBy: { kind: 'suggested', daysBefore: 7 },
    why: 'Work out where the car will be while you are away, and how you will get back to it.',
    status: 'active',
    isHomeItem: true,
    partner: null
  },
  {
    id: 'home-thermostat',
    kind: 'home',
    shortRank: 5,
    title: 'Set your thermostat for the season',
    appliesWhen: { countries: ['*'] },
    actBy: { kind: 'suggested', daysBefore: 1 },
    why: 'Set your thermostat for the season.',
    status: 'active',
    isHomeItem: true,
    partner: null
  }
];

// Helper to determine trip duration in days
export function computeTripDays(departureDate, returnDate, tripLengthBucket) {
  if (departureDate && returnDate) {
    const d1 = new Date(departureDate);
    const d2 = new Date(returnDate);
    if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
      const diffMs = d2.getTime() - d1.getTime();
      const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
      if (days >= 0) return days;
    }
  }
  // Bucket approximations
  switch (tripLengthBucket) {
    case 'weekend': return 3;
    case '4-6': return 5;
    case '7-10': return 8;
    case '11-14': return 12;
    case 'one_two_weeks': return 10;
    case '2+ weeks': return 16;
    case '30_plus':
    case 'month_plus': return 35;
    default: return 7;
  }
}

// Format Date YYYY-MM-DD
export function formatDateIso(d) {
  if (!d || isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

// Compute act-by date
export function computeActByDate(departureDate, actBy) {
  if (!departureDate || !actBy) return null;
  const d = new Date(departureDate);
  if (isNaN(d.getTime())) return null;
  const daysBefore = actBy.daysBefore || 0;
  const target = new Date(d.getTime() - daysBefore * 86400000);
  return formatDateIso(target);
}

// Core Leave-By Plan Builder. Pure: no I/O, so the same file runs in the browser (guest plans are computed there and stored
// nowhere) and in the Worker. `overrides` holds watcher holds and owner confirmations; it always comes from the server.
export function buildLeaveByPlan({
  destination,
  departureDate = null,
  returnDate = null,
  tripLengthBucket = null,
  answers = {},
  now = new Date(),
  overrides = null
} = {}) {
  const country = getCountryForDestination(destination);
  const tripDays = computeTripDays(departureDate, returnDate, tripLengthBucket);
  const depth = depthForDays(tripDays);
  const countryName = (country && COUNTRY_NAMES[country]) || country || 'your destination';

  const found = [];
  let hasSpecificCountryRule = false;

  for (const baseRule of LEAVE_BY_RULES) {
    // Owner confirmations and watcher holds (Addendum G, G2) live in D1, not in this file. A held rule keeps only its id,
    // title and official link; a confirmed one carries the date the owner confirmed it.
    const ov = overrides ? overrides[baseRule.id] : null;
    const rule = ov && ov.status === 'confirmed' && ov.asOf ? { ...baseRule, asOf: ov.asOf } : baseRule;
    const heldByWatcher = Boolean(ov && ov.status === 'held');
    const { appliesWhen } = rule;
    const status = heldByWatcher ? 'held' : rule.status;

    // Country match
    const countryMatch = appliesWhen.countries.includes('*') || (country && appliesWhen.countries.includes(country));
    if (!countryMatch) continue;

    // Answers match
    if (appliesWhen.answers) {
      let answersMatch = true;
      for (const [k, allowed] of Object.entries(appliesWhen.answers)) {
        const val = answers ? answers[k] : undefined;
        if (!val || !allowed.includes(val)) {
          answersMatch = false;
          break;
        }
      }
      if (!answersMatch) continue;
    }

    // Trip duration match
    if (appliesWhen.minDays !== undefined && tripDays < appliesWhen.minDays) continue;
    if (appliesWhen.maxDays !== undefined && tripDays > appliesWhen.maxDays) continue;

    const officialUrl = rule.kind === 'passport' ? stateDeptCountryUrl(country) : rule.officialUrl || null;

    // A held rule shows only a notice and the official link: no date, no why line, no quote, no partner.
    if (status === 'held') {
      found.push({
        id: rule.id,
        kind: rule.kind || null,
        rank: rule.shortRank || 99,
        title: rule.title,
        status: 'held',
        heldNotice: heldByWatcher ? 'This changed recently. Check the official page:' : 'Check the official page:',
        why: null,
        actByDate: null,
        actByText: null,
        officialUrl,
        sourceUrl: null,
        sourceName: null,
        asOf: null,
        quote: null,
        isHomeItem: Boolean(rule.isHomeItem),
        internalUrl: null,
        partner: null
      });
      continue;
    }

    // Track if a destination-specific rule fired
    if (country && !appliesWhen.countries.includes('*') && status === 'active') {
      hasSpecificCountryRule = true;
    }

    // Act-by date computation: only for active rules with actBy!
    // not_yet_required and held NEVER carry an act-by date.
    let computedActByDate = null;
    let actByText = null;
    if (status === 'active' && rule.actBy && departureDate) {
      computedActByDate = computeActByDate(departureDate, rule.actBy);
      if (computedActByDate) actByText = `Suggested by ${computedActByDate}`;
    }

    found.push({
      id: rule.id,
      kind: rule.kind || null,
      rank: rule.shortRank || 99,
      title: rule.title,
      status,
      why: rule.why,
      actByDate: computedActByDate,
      actByText,
      officialUrl,
      sourceUrl: rule.sourceUrl || null,
      sourceName: rule.sourceName || null,
      asOf: rule.asOf || null,
      quote: rule.quote || null,
      isHomeItem: Boolean(rule.isHomeItem),
      internalUrl: rule.internalUrl || null,
      partner: rule.partner || null
    });
  }

  // Depth: Short is the passport item plus at most three others (entry step first, then mail, then home essentials).
  // The ETIAS line is a note, not an item, so it never counts toward the three.
  let kept = found;
  if (depth === 'short') {
    const others = found.filter((i) => i.kind !== 'passport' && i.kind !== 'note');
    const top = new Set(
      others.map((i, idx) => ({ i, idx })).sort((a, b) => a.i.rank - b.i.rank || a.idx - b.idx).slice(0, 3).map((x) => x.i.id)
    );
    kept = found.filter((i) => i.kind === 'passport' || i.kind === 'note' || top.has(i.id));
  }

  // Order: the passport item first, then dated items by act-by date, then undated items and notes.
  const passport = kept.filter((i) => i.kind === 'passport');
  const rest = kept.filter((i) => i.kind !== 'passport').map((i, idx) => ({ i, idx }));
  rest.sort((a, b) => {
    const da = a.i.actByDate;
    const db = b.i.actByDate;
    if (da && db) return da < db ? -1 : da > db ? 1 : a.idx - b.idx;
    if (da) return -1;
    if (db) return 1;
    return a.idx - b.idx;
  });
  const items = [...passport, ...rest.map((x) => x.i)].map((i) => {
    const { rank, ...out } = i;
    return out;
  });

  // Country fallback: a destination with no specific active entry rule gets one plain line (Section 2.4 / 9)
  const countryFallback = {
    text: `Entry rules for ${countryName}: see the U.S. State Department page for ${countryName}.`,
    url: stateDeptCountryUrl(country)
  };

  return {
    destination: destination || null,
    country: country || null,
    countryName,
    tripDays,
    depth,
    departureDate: departureDate ? formatDateIso(new Date(departureDate)) : null,
    returnDate: returnDate ? formatDateIso(new Date(returnDate)) : null,
    hasSpecificCountryRule,
    items,
    countryFallback
  };
}

// Generates an iCalendar (.ics) string entirely in memory
export function buildLeaveByIcs(items = [], { title = 'Sparkfare Leave-By Plan' } = {}) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Sparkfare//Leave-By Plan//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ];

  for (const item of items) {
    if (!item.actByDate) continue;
    const cleanDate = item.actByDate.replace(/-/g, '');
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${item.id}-${cleanDate}@sparkfare.com`);
    lines.push(`DTSTAMP:${cleanDate}T000000Z`);
    lines.push(`DTSTART;VALUE=DATE:${cleanDate}`);
    lines.push(`SUMMARY:${item.title}`);
    lines.push(`DESCRIPTION:${item.why}`);
    lines.push('STATUS:CONFIRMED');
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
