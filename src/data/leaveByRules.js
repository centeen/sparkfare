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

// Rules array
export const LEAVE_BY_RULES = [
  // 1. USPS Hold Mail (trip 3 to 30 days)
  {
    id: 'usps-hold-mail',
    title: 'Ask USPS to hold your mail',
    appliesWhen: {
      countries: ['*'],
      tripLengthBuckets: ['weekend', '4-6', '7-10', '11-14'],
      minDays: 3,
      maxDays: 30
    },
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

  // 2. USPS Forwarding (trip over 30 days)
  {
    id: 'usps-forwarding',
    title: 'Set up mail forwarding',
    appliesWhen: {
      countries: ['*'],
      tripLengthBuckets: ['2+ weeks', '30_plus', 'month_plus'],
      minDays: 31
    },
    actBy: { kind: 'suggested', daysBefore: 7 },
    why: 'For more than 30 days, USPS points you to a forwarding service. A virtual mailbox is another option.',
    officialUrl: 'https://www.usps.com/manage/hold-mail.htm',
    sourceUrl: 'https://www.usps.com/manage/hold-mail.htm',
    sourceName: 'USPS Hold Mail page',
    asOf: '2026-10-16',
    quote: 'please sign up for a forwarding service',
    status: 'active',
    partner: {
      slug: 'us-global-mail',
      name: 'US Global Mail',
      whenTripOverDays: 30,
      disclosure: 'Sparkfare may earn a commission if you buy through this link, at no extra cost to you.'
    }
  },

  // 3. International Driving Permit
  {
    id: 'idp',
    title: 'Get an International Driving Permit',
    appliesWhen: {
      countries: ['*'],
      answers: { car: ['yes'] }
    },
    actBy: {
      kind: 'sourced',
      windowDays: 180,
      daysBefore: 21
    },
    why: "AAA issues an International Driving Permit to U.S. licence holders. It can't be issued more than six months before the start date you want.",
    officialUrl: 'https://www.aaa.com/vacation/idpf.html',
    sourceUrl: 'https://www.aaa.com/vacation/idpf.html',
    sourceName: 'AAA IDP page',
    asOf: '2026-10-16',
    quote: 'International Driving Permits may not be issued more than six (6) months in advance of desired effective date.',
    status: 'active',
    partner: null
  },

  // 4. Bali Tourist Levy
  {
    id: 'bali-levy',
    title: 'Pay the Bali tourist levy',
    appliesWhen: {
      countries: ['ID']
    },
    actBy: { kind: 'suggested', daysBefore: 7 },
    why: 'Foreign visitors to Bali pay a levy of IDR 150,000, through the Love Bali site.',
    officialUrl: 'https://lovebali.baliprov.go.id',
    sourceUrl: 'https://lovebali.baliprov.go.id',
    sourceName: 'Love Bali site',
    asOf: '2026-10-16',
    quote: 'IDR 150,000',
    status: 'active',
    partner: null
  },

  // 5. ETIAS (Schengen, Cyprus excluded per D-014 / E2 check)
  {
    id: 'etias',
    title: 'European Travel Information and Authorisation System (ETIAS)',
    appliesWhen: {
      countries: ['PT', 'ES', 'IT', 'GR', 'HU', 'CZ', 'PL', 'HR', 'RO', 'BG']
    },
    actBy: null,
    why: 'Not required yet; the EU will announce the start date.',
    officialUrl: 'https://home-affairs.ec.europa.eu',
    sourceUrl: 'https://home-affairs.ec.europa.eu',
    sourceName: 'European Commission',
    asOf: '2026-10-16',
    quote: 'ETIAS is scheduled to start in the last quarter of 2026.',
    status: 'not_yet_required',
    partner: null
  },

  // 6. Home items (Section 2.2)
  {
    id: 'home-water-shutoff',
    title: 'Find your water shutoff',
    appliesWhen: { countries: ['*'] },
    actBy: { kind: 'suggested', daysBefore: 1 },
    why: 'Find your water shutoff and make sure it can be turned by hand.',
    status: 'active',
    isHomeItem: true,
    partner: null
  },
  {
    id: 'home-thermostat',
    title: 'Set your thermostat for the season',
    appliesWhen: { countries: ['*'] },
    actBy: { kind: 'suggested', daysBefore: 1 },
    why: 'Set your thermostat for the season.',
    status: 'active',
    isHomeItem: true,
    partner: null
  },
  {
    id: 'home-checkin',
    title: 'Ask someone to check on your home',
    appliesWhen: {
      countries: ['*'],
      tripLengthBuckets: ['4-6', '7-10', '11-14', '2+ weeks', '30_plus', 'one_two_weeks', 'month_plus'],
      minDays: 4
    },
    actBy: { kind: 'suggested', daysBefore: 7 },
    why: 'Ask someone to check on your home while you are away.',
    status: 'active',
    isHomeItem: true,
    partner: null
  },
  {
    id: 'home-pets',
    title: 'Line up care for your pets',
    appliesWhen: {
      countries: ['*'],
      answers: { pets: ['yes'] }
    },
    actBy: { kind: 'suggested', daysBefore: 14 },
    why: 'Line up care for your pets well before your trip.',
    status: 'active',
    isHomeItem: true,
    partner: null
  },
  {
    id: 'destination-phone-data',
    title: 'Sort your phone and data',
    appliesWhen: { countries: ['*'] },
    actBy: { kind: 'suggested', daysBefore: 3 },
    why: 'An eSIM can be set up before you leave.',
    status: 'active',
    isHomeItem: true,
    partner: {
      slug: 'yesim',
      name: 'Yesim',
      disclosure: 'Sparkfare may earn a commission if you buy through this link, at no extra cost to you.'
    }
  },

  // 7. Verification pending government rules (Section 0)
  {
    id: 'passport-renewal',
    title: 'Check your passport validity',
    appliesWhen: { countries: ['*'] },
    actBy: null,
    why: "Review U.S. State Department passport processing and validity requirements before travel.",
    officialUrl: 'https://travel.state.gov',
    sourceUrl: 'https://travel.state.gov',
    sourceName: 'U.S. Department of State',
    asOf: '2026-10-16',
    quote: null,
    status: 'needs_verification',
    partner: null
  },
  {
    id: 'australia-eta',
    title: 'Australia Electronic Travel Authority (ETA)',
    appliesWhen: { countries: ['AU'] },
    actBy: null,
    why: "Entry rules for Australia: check the Australian Department of Home Affairs official portal.",
    officialUrl: 'https://immi.homeaffairs.gov.au',
    sourceUrl: 'https://immi.homeaffairs.gov.au',
    sourceName: 'Australian Home Affairs',
    asOf: '2026-10-16',
    quote: null,
    status: 'needs_verification',
    partner: null
  },
  {
    id: 'brazil-evisa',
    title: 'Brazil Visitor Visa (eVisa)',
    appliesWhen: { countries: ['BR'] },
    actBy: null,
    why: "Entry rules for Brazil: verify current tourist visa requirements through official consular services.",
    officialUrl: 'https://brazil.vfsevisa.com',
    sourceUrl: 'https://brazil.vfsevisa.com',
    sourceName: 'VFS Global / Brazil Consular Services',
    asOf: '2026-10-16',
    quote: null,
    status: 'needs_verification',
    partner: null
  },
  {
    id: 'thailand-arrival-card',
    title: 'Thailand Arrival Card',
    appliesWhen: { countries: ['TH'] },
    actBy: null,
    why: "Entry rules for Thailand: verify arrival card guidelines with Thai Immigration.",
    officialUrl: 'https://tdac.immigration.go.th',
    sourceUrl: 'https://tdac.immigration.go.th',
    sourceName: 'Thai Immigration Bureau',
    asOf: '2026-10-16',
    quote: null,
    status: 'needs_verification',
    partner: null
  },
  {
    id: 'indonesia-arrival-declaration',
    title: 'Indonesia Electronic Customs Declaration',
    appliesWhen: { countries: ['ID'] },
    actBy: null,
    why: "Entry rules for Indonesia: complete the official customs and health declaration prior to arrival.",
    officialUrl: 'https://allindonesia.imigrasi.go.id',
    sourceUrl: 'https://allindonesia.imigrasi.go.id',
    sourceName: 'Directorate General of Immigration Indonesia',
    asOf: '2026-10-16',
    quote: null,
    status: 'needs_verification',
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

// Core Leave-By Plan Builder
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
  const countryName = (country && COUNTRY_NAMES[country]) || country || 'your destination';

  const items = [];
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
        const val = answers[k];
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

    if (heldByWatcher) {
      items.push({
        id: rule.id,
        title: rule.title,
        status: 'held',
        heldNotice: 'This changed recently. Check the official page:',
        why: null,
        actByDate: null,
        actByText: null,
        officialUrl: rule.officialUrl || null,
        sourceUrl: null,
        sourceName: null,
        asOf: null,
        quote: null,
        isHomeItem: Boolean(rule.isHomeItem),
        partner: null
      });
      continue;
    }

    // Track if a destination-specific rule fired
    if (country && !appliesWhen.countries.includes('*') && status === 'active') {
      hasSpecificCountryRule = true;
    }

    // Act-by date computation: only for active rules with actBy!
    // not_yet_required and needs_verification NEVER carry an act-by date (Section 1.1 / 10).
    let computedActByDate = null;
    let actByText = null;

    if (status === 'active' && rule.actBy && departureDate) {
      computedActByDate = computeActByDate(departureDate, rule.actBy);
      if (computedActByDate) {
        actByText = `Suggested by ${computedActByDate}`;
      }
    }

    // Source description
    let sourceLine = null;
    if (rule.sourceName && rule.asOf) {
      sourceLine = `Source: ${rule.sourceName}, checked ${rule.asOf}`;
    }

    items.push({
      id: rule.id,
      title: rule.title,
      status,
      why: rule.why,
      actByDate: computedActByDate,
      actByText,
      officialUrl: rule.officialUrl || null,
      sourceUrl: rule.sourceUrl || null,
      sourceName: rule.sourceName || null,
      asOf: rule.asOf || null,
      quote: rule.quote || null,
      isHomeItem: Boolean(rule.isHomeItem),
      partner: rule.partner || null
    });
  }

  // Country fallback: If destination has no specific active entry rule, add generic line (Section 2.4 / 9)
  const countryFallback = {
    text: `Entry rules for ${countryName}: see the U.S. State Department's page for ${countryName}.`,
    url: 'https://travel.state.gov'
  };

  return {
    destination: destination || null,
    country: country || null,
    countryName,
    tripDays,
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
