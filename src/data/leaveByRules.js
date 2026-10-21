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

// Late-plan mode (Addendum G, task G4): with this many days or fewer before leaving, show only what can still be done, then a short
// "Past its window" list. The State Department's page for urgent passport travel (read 2026-10-16, "Get Your Passport Fast", last
// updated September 30, 2026) says to make an appointment when you are within 14 calendar days of your travel date; the plan makes
// no statement about whether an appointment is available.
export const LATE_PLAN_DAYS = 7;
export const PASSPORT_URGENT_URL = 'https://travel.state.gov/en/passports/apply/get-fast.html';
export const FASTEST_ROUTE_LINE = "Here's the fastest official route now.";

// Whole days from one YYYY-MM-DD to another (both read as UTC midnights, so daylight saving never shifts the count).
export function daysBetweenIso(fromIso, toIso) {
  const a = Date.parse(fromIso + 'T00:00:00Z');
  const b = Date.parse(toIso + 'T00:00:00Z');
  if (isNaN(a) || isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}

// Trip depth (Addendum G, section 4): up to 10 days is Short, 11 to 29 Standard, 30 or more Long.
// The signup trip-length bucket for a trip of this many days, so plan events and partner clicks line up with the buckets used everywhere else.
export function bucketForDays(days) {
  if (days <= 3) return 'weekend';
  if (days <= 6) return '4-6';
  if (days <= 10) return '7-10';
  if (days <= 14) return '11-14';
  if (days <= 29) return '2+ weeks';
  return '30_plus';
}

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
    title: 'Get your Brazil visa before you go',
    appliesWhen: { countries: ['BR'] },
    actBy: null,
    why: 'U.S. citizens need a visa to enter Brazil, and it has to be approved before you travel. The eVisa is applied for on the official Brazil portal.',
    officialUrl: 'https://brazil.vfsevisa.com/',
    sourceUrl: 'https://travel.state.gov/en/international-travel/travel-advisories/brazil.html',
    sourceName: 'U.S. Department of State, Brazil page (last updated August 06, 2026)',
    asOf: '2026-10-17',
    quote: 'U.S. citizen travelers must obtain a visa before they travel to Brazil.',
    status: 'active',
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
    partner: { slug: 'parking-access', name: 'Parking Access', disclosure: COMMISSION_LINE }
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
  today = null,
  overrides = null,
  passportCheckEnabled = false,
  passportExpiry = null,
  origin = null
} = {}) {
  // "Today" is the visitor's own date, passed in by the page (the browser knows the local date; the server only has UTC).
  const nowDate = now instanceof Date && !isNaN(now.getTime()) ? now : new Date();
  const todayIso = typeof today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(today) ? today : formatDateIso(nowDate);
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

  // Late plan (G4): with LATE_PLAN_DAYS or fewer to go, split off the items whose suggested date has already passed. A passed item
  // that has an official page moves to "Past its window" and links that page as the fastest route. A passed item with no official
  // page (a home suggestion, a partner-only item) is still doable, so it stays in the list without its past date.
  const departureIso = departureDate && !isNaN(new Date(departureDate).getTime()) ? formatDateIso(new Date(departureDate)) : null;
  const daysUntil = departureIso ? daysBetweenIso(todayIso, departureIso) : null;
  const late = daysUntil !== null && daysUntil <= LATE_PLAN_DAYS;
  let achievable = found;
  let past = [];
  if (late) {
    achievable = [];
    for (const i of found) {
      if (i.kind === 'passport') {
        // The passport check proper is G5. Until then, say where to go if it needs renewing now.
        achievable.push({ ...i, lateNote: "If it needs renewing, here's the fastest official route now.", lateUrl: PASSPORT_URGENT_URL });
      } else if (i.status === 'active' && i.actByDate && i.actByDate < todayIso) {
        if (i.officialUrl) past.push({ ...i, pastNote: FASTEST_ROUTE_LINE, fastestUrl: i.officialUrl });
        else achievable.push({ ...i, actByDate: null, actByText: null });
      } else {
        achievable.push(i);
      }
    }
  }

  // Depth: Short is the passport item plus at most three others (entry step first, then mail, then home essentials).
  // The ETIAS line is a note, not an item, so it never counts toward the three. In late mode the same cap applies to each list.
  const capShort = (list) => {
    if (depth !== 'short') return list;
    const others = list.filter((i) => i.kind !== 'passport' && i.kind !== 'note');
    const top = new Set(
      others.map((i, idx) => ({ i, idx })).sort((a, b) => a.i.rank - b.i.rank || a.idx - b.idx).slice(0, 3).map((x) => x.i.id)
    );
    return list.filter((i) => i.kind === 'passport' || i.kind === 'note' || top.has(i.id));
  };
  const kept = capShort(achievable);
  past = capShort(past);

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
  const pastItems = past
    .sort((a, b) => (a.actByDate < b.actByDate ? -1 : a.actByDate > b.actByDate ? 1 : 0))
    .map((i) => {
      const { rank, actByDate, actByText, ...out } = i;
      // A date that has passed is not shown; the item says where to go now.
      return { ...out, actByDate: null, actByText: null };
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
    bucket: bucketForDays(tripDays),
    departureDate: departureDate ? formatDateIso(new Date(departureDate)) : null,
    returnDate: returnDate ? formatDateIso(new Date(returnDate)) : null,
    hasSpecificCountryRule,
    late,
    daysUntil,
    items,
    pastItems,
    countryFallback,
    // The passport check (G5): only when the flag is on and the traveler gave an expiry month and year. Computed here and never stored.
    passport: passportCheckEnabled && passportExpiry
      ? checkPassport({ destination, departureDate, returnDate, expiryMonth: passportExpiry.month, expiryYear: passportExpiry.year, today: todayIso, overrides, origin })
      : null
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

// ---- Passport check (Addendum G, task G5; flag ENABLE_PASSPORT_CHECK) ----
//
// One rule per destination country, each quoting the "Valid passport requirements" subsection of the State Department's country page
// (read 2026-10-16; "pageDate" is the page's own "Last Updated" line). Rules are for a US passport. kind says what the months count from:
//   entry     the passport must still have N months after you arrive (the leaving date is used for the arrival day)
//   departure the passport must still have N months (or days) after you leave the country (the back date is used)
//   at_entry  valid when you arrive, no months stated
//   stay      valid for the whole stay
//   check     the page does not say what its months count from: always "Check the official page"
// A rule marked held (Egypt, or any rule the watcher or owner holds) never produces a verdict.

export const PASSPORT_PROCESSING = {
  id: 'passport-processing-time',
  title: 'Passport processing times',
  officialUrl: 'https://travel.state.gov/en/passports/apply/help/processing-time.html',
  sourceUrl: 'https://travel.state.gov/en/passports/apply/help/processing-time.html',
  sourceName: 'U.S. Department of State, passport processing times',
  quote: 'Routine processing takes 4-6 weeks. Expedited processing takes 2-3 weeks.',
  pageDate: 'October 05, 2026',
  asOf: '2026-10-16',
  routineWeeksMax: 6,
  status: 'active'
};

export const PASSPORT_RULES = [
  { id: 'passport-ID', country: 'ID', kind: 'entry', months: 6, quote: "Must have 6 months validity beyond your arrival date. 2 blank pages required for entry.", pageDate: 'July 09, 2026', asOf: '2026-10-16', status: 'active' },
  { id: 'passport-JP', country: 'JP', kind: 'stay', quote: "Passport must be valid for the entire stay. 1 blank page required per entry stamp.", pageDate: 'August 11, 2025', asOf: '2026-10-16', status: 'active' },
  { id: 'passport-ZA', country: 'ZA', kind: 'departure', days: 30, quote: "Passport must be valid for 30 days after your planned exit from South Africa. Must have 2 consecutive empty visa pages per entry not including endorsement pages.", pageDate: 'August 11, 2025', asOf: '2026-10-16', status: 'active' },
  { id: 'passport-AU', country: 'AU', kind: 'at_entry', quote: "Your passport must be valid at the time of entry. You must have 1 blank page available per stamp.", pageDate: 'August 13, 2026', asOf: '2026-10-16', status: 'active' },
  { id: 'passport-MV', country: 'MV', kind: 'entry', months: 6, quote: "Must have 6 months validity beyond your arrival date. 1 page required for entry stamp.", pageDate: 'October 16, 2025', asOf: '2026-10-16', status: 'active' },
  { id: 'passport-AR', country: 'AR', kind: 'at_entry', quote: "Your passport must be valid at the time of entry. You need at least 1 blank page in your passport for entry and exit stamps.", pageDate: 'July 16, 2026', asOf: '2026-10-16', status: 'active' },
  { id: 'passport-BR', country: 'BR', kind: 'entry', months: 1, quote: "Your passport must be valid for one month at the time of entry. Your passport must have at least one blank page available per stamp.", pageDate: 'August 06, 2026', asOf: '2026-10-16', status: 'active' },
  { id: 'passport-TH', country: 'TH', kind: 'entry', months: 6, quote: "Your passport must have six months\u2019 validity beyond your arrival date.", pageDate: 'August 20, 2026', asOf: '2026-10-16', status: 'active' },
  { id: 'passport-VN', country: 'VN', kind: 'entry', months: 6, quote: "Your passport must have 6 months\u2019 validity beyond your arrival date. You must have 1 blank page available per stamp.", pageDate: 'July 02, 2026', asOf: '2026-10-16', status: 'active' },
  { id: 'passport-TW', country: 'TW', kind: 'stay', quote: "Your passport must be valid at the time of entry. Passports must be valid through your intended stay. 1 blank page available per entry or exit stamp.", pageDate: 'September 17, 2026', asOf: '2026-10-16', status: 'active' },
  { id: 'passport-IT', country: 'IT', kind: 'departure', months: 3, recommendMonths: 6, quote: "Passports must be valid for at least 3 months beyond your planned date of departure from the Schengen area. A 6-month validity is recommended. Passports must have 2 blank pages for entry stamp.", pageDate: 'August 11, 2025', asOf: '2026-10-16', status: 'active' },
  { id: 'passport-PT', country: 'PT', kind: 'departure', months: 3, quote: "Must have 3 months validity beyond your date of departure. 2 blank pages required for entry.", pageDate: 'December 11, 2025', asOf: '2026-10-16', status: 'active' },
  { id: 'passport-GR', country: 'GR', kind: 'departure', months: 3, quote: "Must have 3 months\u2019 validity beyond your date of departure. 1 blank page available per stamp.", pageDate: 'February 19, 2026', asOf: '2026-10-16', status: 'active' },
  { id: 'passport-CY', country: 'CY', kind: 'departure', months: 3, quote: "Must have 3 months\u2019 validity beyond your date of departure. 2 blank pages required for entry.", pageDate: 'August 13, 2026', asOf: '2026-10-16', status: 'active' },
  { id: 'passport-ES', country: 'ES', kind: 'departure', months: 3, quote: "Must have 3 months validity beyond your date of departure. 1 blank passport page per entry and exit.", pageDate: 'August 11, 2025', asOf: '2026-10-16', status: 'active' },
  { id: 'passport-HR', country: 'HR', kind: 'departure', months: 3, quote: "Must have 3 months\u2019 validity beyond your date of departure. 1 blank page available per stamp.", pageDate: 'December 11, 2025', asOf: '2026-10-16', status: 'active' },
  { id: 'passport-MX', country: 'MX', kind: 'at_entry', quote: "Your passport must be valid at the time of entry. 1 blank passport page per stamp required for air travelers.", pageDate: 'August 11, 2025', asOf: '2026-10-16', status: 'active' },
  { id: 'passport-CR', country: 'CR', kind: 'stay', quote: "Passport must be valid for the period of the stay.", pageDate: 'August 11, 2025', asOf: '2026-10-16', status: 'active' },
  { id: 'passport-PH', country: 'PH', kind: 'entry', months: 6, quote: "Must have 6 months\u2019 validity beyond your arrival date. Passport must have sufficient space for an entry visa stamp.", pageDate: 'August 13, 2026', asOf: '2026-10-16', status: 'active' },
  { id: 'passport-CZ', country: 'CZ', kind: 'departure', months: 3, quote: "Must have 3 months\u2019 validity beyond your departure date. 2 blank pages required for entry.", pageDate: 'December 11, 2025', asOf: '2026-10-16', status: 'active' },
  { id: 'passport-HU', country: 'HU', kind: 'departure', months: 3, quote: "Your passport must be valid at the time of entry. Your passport must have 3 months validity beyond your date of departure.", pageDate: 'April 23, 2026', asOf: '2026-10-16', status: 'active' },
  { id: 'passport-BG', country: 'BG', kind: 'departure', months: 3, quote: "Must have 3 months validity beyond date of departure from the Schengen area. 2 blank page available per stamp.", pageDate: 'December 04, 2025', asOf: '2026-10-16', status: 'active' },
  { id: 'passport-CO', country: 'CO', kind: 'stay', recommendMonths: 6, quote: "Must be valid at the time of entry and for the duration of your stay. Must have 1 blank passport page for entry stamp unless enrolled in Migraci\u00f3n Autom\u00e1tica, Colombia\u2019s program for frequent travelers. Recommend 6 months validity.", pageDate: 'August 11, 2025', asOf: '2026-10-16', status: 'active' },
  { id: 'passport-PL', country: 'PL', kind: 'entry', months: 6, quote: "Your passport must be valid at the time of entry. Must have 6 months\u2019 validity beyond your arrival date. Must have 1 blank page available for entry.", pageDate: 'August 20, 2026', asOf: '2026-10-16', status: 'active' },
  { id: 'passport-RO', country: 'RO', kind: 'departure', months: 3, quote: "Must have 3 months validity beyond your date of departure. 1 blank page available per stamp.", pageDate: 'November 12, 2025', asOf: '2026-10-16', status: 'active' },
  { id: 'passport-GT', country: 'GT', kind: 'at_entry', quote: "Your passport must be valid at the time of entry.", pageDate: 'June 11, 2026', asOf: '2026-10-16', status: 'active' },
  { id: 'passport-MA', country: 'MA', kind: 'entry', months: 6, quote: "Your passport must have at least six months\u2019 validity at time of entry. Your passport must have 1 blank page available per stamp.", pageDate: 'July 30, 2026', asOf: '2026-10-16', status: 'active' },
  { id: 'passport-TR', country: 'TR', kind: 'entry', months: 6, quote: "must have 6 months\u2019 validity beyond your date of entry. Your passport must have at least 1 blank page available.", pageDate: 'June 11, 2026', asOf: '2026-10-16', status: 'active' },
  { id: 'passport-JO', country: 'JO', kind: 'entry', months: 6, quote: "Must have 6 months\u2019 validity beyond your arrival date.", pageDate: 'May 14, 2026', asOf: '2026-10-16', status: 'active' },
  { id: 'passport-PE', country: 'PE', kind: 'entry', months: 6, quote: "Must have 6 months\u2019 validity from the date of entry. 1 blank visa page required for entry stamp.", pageDate: 'August 20, 2026', asOf: '2026-10-16', status: 'active' },
  { id: 'passport-EG', country: 'EG', kind: 'check', quote: "Passport must be valid for 6 months. At least 1 blank passport page is needed.", pageDate: 'August 11, 2025', asOf: '2026-10-16', status: 'held' },
  { id: 'passport-GE', country: 'GE', kind: 'at_entry', quote: "Your passport must be valid at the time of entry. Your passport must have at least 1 blank page for an entry stamp.", pageDate: 'September 17, 2026', asOf: '2026-10-16', status: 'active' },
  { id: 'passport-AZ', country: 'AZ', kind: 'entry', months: 6, quote: "Must have 6 months\u2019 validity beyond your arrival date. 1 blank page available per stamp.", pageDate: 'September 10, 2026', asOf: '2026-10-16', status: 'active' },
  { id: 'passport-OM', country: 'OM', kind: 'entry', months: 6, quote: "Your passport must be valid at the time of entry. Must have 6 months of validity beyond your arrival date. 1 blank page available per stamp.", pageDate: 'April 16, 2026', asOf: '2026-10-16', status: 'active' }
].map((r) => ({
  ...r,
  title: 'Passport rule: ' + COUNTRY_NAMES[r.country],
  officialUrl: stateDeptCountryUrl(r.country),
  sourceUrl: stateDeptCountryUrl(r.country),
  sourceName: 'U.S. Department of State, ' + COUNTRY_NAMES[r.country] + ' page'
}));

// Everything the weekly watcher checks and /admin/rules lists.
export const ALL_WATCHED_RULES = [...LEAVE_BY_RULES, ...PASSPORT_RULES, PASSPORT_PROCESSING];

export const PASSPORT_GENERAL_URL = 'https://travel.state.gov';

export function passportRuleFor(code) {
  return PASSPORT_RULES.find((r) => r.country === code) || null;
}

// The rule in plain words, built from kind and numbers only (the quote stays the page's own words).
export function passportRequirementText(rule) {
  if (!rule) return null;
  const amount = rule.months != null ? rule.months + (rule.months === 1 ? ' month' : ' months') : rule.days != null ? rule.days + ' days' : null;
  switch (rule.kind) {
    case 'entry': return 'Valid for ' + amount + ' after the day you arrive.';
    case 'departure': return 'Valid for ' + amount + ' after the day you leave the country.';
    case 'at_entry': return 'Valid on the day you arrive.';
    case 'stay': return 'Valid for your whole stay.';
    default: return 'The page does not say how long it must stay valid. Check the official page.';
  }
}

function parseIso(iso) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const t = Date.parse(iso + 'T00:00:00Z');
  return isNaN(t) ? null : new Date(t);
}

// Adds whole months in UTC, keeping the day of the month where the target month has it, else the month's last day.
export function addMonthsIso(iso, months) {
  const d = parseIso(iso);
  if (!d) return null;
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + months;
  const day = d.getUTCDate();
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return formatDateIso(new Date(Date.UTC(y, m, Math.min(day, last))));
}

export function addDaysIso(iso, days) {
  const d = parseIso(iso);
  return d ? formatDateIso(new Date(d.getTime() + days * 86400000)) : null;
}

const PASSPORT_DISCLAIMER = (countryName) => 'Based on a US passport. Check the State Department page for ' + countryName + ' before you travel.';

// The passport check. Pure: nothing is stored or sent, and the expiry month and year are used here and nowhere else.
// Input: destination, departureDate and returnDate (YYYY-MM-DD), expiryMonth (1-12) and expiryYear. The expiry is read as the FIRST day
// of its month, the conservative choice. Results: 'fine', 'renew', 'check' (the rule is held or unclear) or 'hidden' (TLV origin).
export function checkPassport({
  destination,
  departureDate,
  returnDate,
  expiryMonth,
  expiryYear,
  today = null,
  now = new Date(),
  overrides = null,
  origin = null
} = {}) {
  const code = getCountryForDestination(destination);
  const countryName = (code && COUNTRY_NAMES[code]) || 'your destination';
  const countryUrl = stateDeptCountryUrl(code);
  const base = { country: code || null, countryName, countryUrl, disclaimer: PASSPORT_DISCLAIMER(countryName), rule: null };

  // A traveler whose origin is Tel Aviv gets the general link, not a verdict (the rules assume a US passport).
  if (origin && String(origin).toUpperCase() === 'TLV') {
    return { ...base, ok: true, result: 'hidden', headline: null, generalUrl: PASSPORT_GENERAL_URL,
      note: 'Passport rules depend on your passport. See the State Department for travel information.' };
  }

  const month = Number(expiryMonth);
  const year = Number(expiryYear);
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000 || year > 2100) {
    return { ...base, ok: false, error: 'expiry', result: null, headline: null };
  }
  const dep = parseIso(departureDate);
  const ret = parseIso(returnDate);
  if (!dep || !ret || ret < dep) return { ...base, ok: false, error: 'dates', result: null, headline: null };

  const nowDate = now instanceof Date && !isNaN(now.getTime()) ? now : new Date();
  const todayIso = typeof today === 'string' && parseIso(today) ? today : formatDateIso(nowDate);
  const expiryFirstDay = year + '-' + String(month).padStart(2, '0') + '-01';

  const baseRule = passportRuleFor(code);
  const ov = overrides && baseRule ? overrides[baseRule.id] : null;
  const heldByWatcher = Boolean(ov && ov.status === 'held');
  const rule = baseRule && ov && ov.status === 'confirmed' && ov.asOf ? { ...baseRule, asOf: ov.asOf } : baseRule;
  const held = !rule || heldByWatcher || rule.status === 'held' || rule.kind === 'check';
  if (held) {
    return { ...base, ok: true, result: 'check', headline: 'Check the official page.', expiryFirstDay,
      heldNotice: heldByWatcher ? 'This changed recently. Check the official page:' : 'Check the official page:' };
  }

  const departureIso = formatDateIso(dep);
  const returnIso = formatDateIso(ret);
  let requiredBy;
  switch (rule.kind) {
    case 'entry': requiredBy = addMonthsIso(departureIso, rule.months); break;
    case 'departure': requiredBy = rule.days != null ? addDaysIso(returnIso, rule.days) : addMonthsIso(returnIso, rule.months); break;
    case 'at_entry': requiredBy = departureIso; break;
    default: requiredBy = returnIso; // stay
  }
  const ruleOut = {
    kind: rule.kind,
    requirementText: passportRequirementText(rule),
    recommendation: rule.recommendMonths ? 'The page recommends ' + rule.recommendMonths + ' months of validity.' : null,
    quote: rule.quote,
    pageDate: rule.pageDate,
    asOf: rule.asOf,
    sourceName: rule.sourceName,
    sourceUrl: rule.sourceUrl
  };

  if (expiryFirstDay >= requiredBy) {
    return { ...base, ok: true, result: 'fine', headline: 'Fine for this trip.', expiryFirstDay, requiredBy, rule: ruleOut };
  }

  // Renew: suggest the leaving date minus the routine processing time (the top of its range), labeled a suggestion.
  const actByDate = addDaysIso(departureIso, -7 * PASSPORT_PROCESSING.routineWeeksMax);
  const pastDue = actByDate < todayIso;
  return {
    ...base,
    ok: true,
    result: 'renew',
    headline: 'Renew before you go.',
    expiryFirstDay,
    requiredBy,
    rule: ruleOut,
    renew: {
      actByDate,
      actByText: 'Suggested by ' + actByDate,
      note: 'Routine service takes 4-6 weeks plus mailing. Expedited takes 2-3 weeks.',
      processing: { quote: PASSPORT_PROCESSING.quote, pageDate: PASSPORT_PROCESSING.pageDate, asOf: PASSPORT_PROCESSING.asOf, sourceUrl: PASSPORT_PROCESSING.sourceUrl },
      pastDue,
      urgentUrl: pastDue ? PASSPORT_URGENT_URL : null,
      urgentNote: pastDue ? "Here's the fastest official route now." : null
    }
  };
}
