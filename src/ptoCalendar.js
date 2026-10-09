// PTO calendar (ROADMAP step 72, Track A). Pure functions: no I/O, no clock, no local-time Date methods.
//
// Every date is a 'YYYY-MM-DD' string and all arithmetic is UTC at midnight, so a day is always exactly
// 86,400,000 ms and a daylight-saving change cannot move a date. Spec: claude_code_pto_fare_calendar_2026-10-09.md.
import FIT_FILE from '../content/pto_destination_fit.json' with { type: 'json' };

export const DESTINATION_FIT = FIT_FILE.fit;

const DAY = 86400000;
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ---- dates -------------------------------------------------------------------------------------------

export function parseDay(day) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day));
  if (!m) throw new Error(`Not a YYYY-MM-DD date: ${day}`);
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (formatDay(ms) !== day) throw new Error(`Not a real date: ${day}`);
  return ms;
}
export function formatDay(ms) { return new Date(ms).toISOString().slice(0, 10); }
export function addDays(day, n) { return formatDay(parseDay(day) + n * DAY); }
export function dayOfWeek(day) { return new Date(parseDay(day)).getUTCDay(); } // 0 = Sunday
export function isWeekend(day) { const d = dayOfWeek(day); return d === 0 || d === 6; }
export function dayLabel(day) { const ms = parseDay(day); const d = new Date(ms); return `${WEEKDAY[d.getUTCDay()]} ${MONTH[d.getUTCMonth()]} ${d.getUTCDate()}`; }
export function shortDay(day) { const d = new Date(parseDay(day)); return `${MONTH[d.getUTCMonth()]} ${d.getUTCDate()}`; }
export function rangeLabel(start, end) { return `${shortDay(start)} to ${shortDay(end)}`; }
export function daysBetweenInclusive(start, end) { return Math.round((parseDay(end) - parseDay(start)) / DAY) + 1; }

// The nth (1-based) given weekday (0 = Sunday) of a month (1-12).
function nthWeekday(year, month, weekday, n) {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const date = 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
  return formatDay(Date.UTC(year, month - 1, date));
}
function lastWeekday(year, month, weekday) {
  const lastDate = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const last = new Date(Date.UTC(year, month - 1, lastDate)).getUTCDay();
  return formatDay(Date.UTC(year, month - 1, lastDate - ((last - weekday + 7) % 7)));
}
const pad = (n) => String(n).padStart(2, '0');

// ---- holidays ----------------------------------------------------------------------------------------

// Bit order is part of the compact `?h=` code, so only ever append.
export const HOLIDAY_ORDER = [
  'new_year', 'mlk', 'presidents', 'memorial', 'juneteenth', 'independence', 'labor',
  'columbus', 'veterans', 'thanksgiving', 'christmas', 'day_after_thanksgiving',
];
export const HOLIDAY_NAMES = {
  new_year: "New Year's Day",
  mlk: 'Martin Luther King Jr. Day',
  presidents: "Presidents' Day",
  memorial: 'Memorial Day',
  juneteenth: 'Juneteenth',
  independence: 'Independence Day',
  labor: 'Labor Day',
  columbus: "Columbus / Indigenous Peoples' Day",
  veterans: 'Veterans Day',
  thanksgiving: 'Thanksgiving',
  christmas: 'Christmas Day',
  day_after_thanksgiving: 'Day after Thanksgiving',
};
// What most private employers give. Many do not give every federal holiday, so the page lets people pick their own.
export const COMMON_HOLIDAY_SET = ['new_year', 'memorial', 'independence', 'labor', 'thanksgiving', 'day_after_thanksgiving', 'christmas'];

// The 11 federal holidays for a year, plus the day after Thanksgiving (not federal, but a day off at many employers).
// `date` is the calendar date; `observed` follows OPM's rule: a Saturday holiday is observed the Friday before, a
// Sunday holiday the Monday after, so New Year's on a Saturday is observed on Dec 31 of the previous year.
export function federalHolidays(year) {
  const fixed = (month, date) => `${year}-${pad(month)}-${pad(date)}`;
  const thanksgiving = nthWeekday(year, 11, 4, 4);
  const dates = {
    new_year: fixed(1, 1),
    mlk: nthWeekday(year, 1, 1, 3),
    presidents: nthWeekday(year, 2, 1, 3),
    memorial: lastWeekday(year, 5, 1),
    juneteenth: fixed(6, 19),
    independence: fixed(7, 4),
    labor: nthWeekday(year, 9, 1, 1),
    columbus: nthWeekday(year, 10, 1, 2),
    veterans: fixed(11, 11),
    thanksgiving,
    christmas: fixed(12, 25),
    day_after_thanksgiving: addDays(thanksgiving, 1),
  };
  return HOLIDAY_ORDER.map((key) => {
    const date = dates[key];
    const dow = dayOfWeek(date);
    const observed = dow === 6 ? addDays(date, -1) : dow === 0 ? addDays(date, 1) : date;
    return { key, name: HOLIDAY_NAMES[key], date, observed };
  });
}

// Compact code for a holiday set: a bitmask in base 36 (default set -> a short string).
export function encodeHolidaySet(keys) {
  let mask = 0;
  for (const key of keys) {
    const i = HOLIDAY_ORDER.indexOf(key);
    if (i >= 0) mask |= (1 << i);
  }
  return mask.toString(36);
}
export function decodeHolidaySet(code) {
  if (typeof code !== 'string' || !/^[0-9a-z]{1,4}$/.test(code)) return null;
  const mask = parseInt(code, 36);
  if (!Number.isFinite(mask) || mask < 0 || mask >= (1 << HOLIDAY_ORDER.length)) return null;
  return HOLIDAY_ORDER.filter((_, i) => mask & (1 << i));
}
export const DEFAULT_HOLIDAY_CODE = encodeHolidaySet(COMMON_HOLIDAY_SET);

// Holidays in the chosen set whose observed date falls in [from, to], in date order.
export function holidaysInRange({ from, to, keys = COMMON_HOLIDAY_SET }) {
  const wanted = new Set(keys);
  const firstYear = Number(from.slice(0, 4));
  const lastYear = Number(to.slice(0, 4)) + 1; // next year's New Year's can be observed on Dec 31
  const out = [];
  for (let year = firstYear; year <= lastYear; year += 1) {
    for (const h of federalHolidays(year)) {
      if (wanted.has(h.key) && h.observed >= from && h.observed <= to) out.push(h);
    }
  }
  return out.sort((a, b) => (a.observed < b.observed ? -1 : a.observed > b.observed ? 1 : HOLIDAY_ORDER.indexOf(a.key) - HOLIDAY_ORDER.indexOf(b.key)));
}

// ---- bridges -----------------------------------------------------------------------------------------

const MAX_PTO_PER_BLOCK = 5;
const REACH = 7; // how far either side of a holiday a block may stretch

// Every block of consecutive days off that contains a holiday and needs 0 to 5 PTO days. A block is the whole
// run of days off: weekends and holidays are free, any other weekday inside it is a PTO day, and a block never
// stops short of an adjacent day that is already off (that day would be free). Candidates, not a plan: they
// overlap, and optimize() picks a set that does not.
export function bridgeOpportunities({ from, to, holidays }) {
  const observed = new Set(holidays.map((h) => h.observed));
  const isOff = (day) => isWeekend(day) || observed.has(day);
  const seen = new Set();
  const blocks = [];
  for (const h of holidays) {
    for (let back = 0; back <= REACH; back += 1) {
      for (let fwd = 0; fwd <= REACH; fwd += 1) {
        const start = addDays(h.observed, -back);
        const end = addDays(h.observed, fwd);
        if (start < from || end > to) continue;
        if (isOff(addDays(start, -1)) || isOff(addDays(end, 1))) continue; // not the whole run of days off
        const ptoDates = [];
        const holidayKeys = [];
        for (let d = start; d <= end; d = addDays(d, 1)) {
          if (!isOff(d)) ptoDates.push(d);
        }
        if (ptoDates.length > MAX_PTO_PER_BLOCK) continue;
        for (const other of holidays) if (other.observed >= start && other.observed <= end) holidayKeys.push(other.key);
        const id = `${start}:${end}`;
        if (seen.has(id)) continue;
        seen.add(id);
        const daysOff = daysBetweenInclusive(start, end);
        blocks.push({
          start, end, ptoDates, ptoUsed: ptoDates.length, daysOff, holidayKeys,
          efficiency: ptoDates.length === 0 ? null : Math.round((daysOff / ptoDates.length) * 100) / 100,
        });
      }
    }
  }
  return blocks.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.end < b.end ? -1 : a.end > b.end ? 1 : 0));
}

// Compact date range label for a window (e.g. "Nov 26-29" or "Dec 31 - Jan 3").
export function formatWindowRange(start, end) {
  const s = new Date(parseDay(start));
  const e = new Date(parseDay(end));
  const sMonth = MONTH[s.getUTCMonth()];
  const eMonth = MONTH[e.getUTCMonth()];
  if (sMonth === eMonth) {
    return `${sMonth} ${s.getUTCDate()}-${e.getUTCDate()}`;
  }
  return `${sMonth} ${s.getUTCDate()} - ${eMonth} ${e.getUTCDate()}`;
}

// Earliest upcoming long-weekend block (at least 3 days off, 0 or 1 PTO used) from today.
export function nextLongWeekend({ today, keys = COMMON_HOLIDAY_SET } = {}) {
  const from = today || new Date().toISOString().slice(0, 10);
  const to = addDays(from, 365);
  const holidays = holidaysInRange({ from, to, keys });
  const blocks = bridgeOpportunities({ from, to, holidays });
  const upcoming = blocks.filter((b) => b.start >= from && b.daysOff >= 3);
  if (!upcoming.length) return null;
  const zeroPto = upcoming.filter((b) => b.ptoUsed === 0);
  return zeroPto[0] || upcoming.find((b) => b.ptoUsed <= 1) || upcoming[0];
}

// A free block (no PTO) counts from 3 days; a block that needs PTO must reach minDaysOff.
function eligible(block, minDaysOff, budget) {
  if (block.ptoUsed > budget) return false;
  return block.ptoUsed === 0 ? block.daysOff >= 3 : block.daysOff >= minDaysOff;
}

// The set of non-overlapping blocks that gives the most days off within the PTO budget (ties: fewer PTO days used,
// then the order of the input). Dynamic programming over blocks sorted by end date, so it is exact and deterministic;
// a greedy "best ratio first" pass can leave budget unused or take a block that blocks a better pair.
// Totals count only the days inside chosen blocks, never more.
export function optimize({ budget, blocks, minDaysOff = 4 }) {
  const cap = Math.max(0, Math.min(30, Math.floor(Number(budget) || 0)));
  const items = blocks
    .filter((b) => eligible(b, minDaysOff, cap))
    .sort((a, b) => (a.end < b.end ? -1 : a.end > b.end ? 1 : a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  const n = items.length;
  const score = (b) => b.daysOff * 1000 - b.ptoUsed;

  // prev[i]: how many of the first items end strictly before items[i] starts (so they can precede it)
  const prev = items.map((it, i) => {
    let lo = 0; let hi = i;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (items[mid].end < it.start) lo = mid + 1; else hi = mid; }
    return lo;
  });

  // dp[i][b]: best score using the first i items spending at most b PTO days
  const dp = Array.from({ length: n + 1 }, () => new Array(cap + 1).fill(0));
  for (let i = 1; i <= n; i += 1) {
    const it = items[i - 1];
    for (let b = 0; b <= cap; b += 1) {
      let best = dp[i - 1][b];
      if (it.ptoUsed <= b) {
        const taken = score(it) + dp[prev[i - 1]][b - it.ptoUsed];
        if (taken > best) best = taken;
      }
      dp[i][b] = best;
    }
  }
  const plan = [];
  let b = cap;
  let i = n;
  while (i >= 1) {
    if (dp[i][b] === dp[i - 1][b]) {
      i -= 1; // not taken
    } else {
      const it = items[i - 1];
      plan.push(it);
      b -= it.ptoUsed;
      i = prev[i - 1]; // continue with the items that can precede this one
    }
  }
  plan.reverse();
  const totals = plan.reduce((t, x) => ({ ptoUsed: t.ptoUsed + x.ptoUsed, daysOff: t.daysOff + x.daysOff }), { ptoUsed: 0, daysOff: 0 });
  return { plan, totals, budget: cap };
}

// One call for the page: holidays in range, candidate blocks, the optimizer's plan.
export function buildPlan({ from, to, keys = COMMON_HOLIDAY_SET, budget = 10, minDaysOff = 4 }) {
  const holidays = holidaysInRange({ from, to, keys });
  const blocks = bridgeOpportunities({ from, to, holidays });
  return { holidays, blocks, ...optimize({ budget, blocks, minDaysOff }) };
}

// For the opportunities list: per holiday, the free block (if any) and, for each PTO count 1 to 3, the block with
// the most days off. Never repeats a block.
export function summarizeByHoliday({ holidays, blocks, minDaysOff = 4 }) {
  const used = new Set();
  return holidays.map((holiday) => {
    const around = blocks.filter((b) => b.start <= holiday.observed && b.end >= holiday.observed);
    const options = [];
    for (let pto = 0; pto <= 3; pto += 1) {
      const candidates = around.filter((b) => b.ptoUsed === pto && (pto === 0 ? b.daysOff >= 3 : b.daysOff >= minDaysOff));
      if (candidates.length === 0) continue;
      candidates.sort((a, b) => b.daysOff - a.daysOff || (a.start < b.start ? -1 : 1));
      const best = candidates[0];
      const id = `${best.start}:${best.end}`;
      if (used.has(id)) continue;
      used.add(id);
      options.push(best);
    }
    return { holiday, options };
  });
}

// The wording for a block: what to request off and what it buys.
export function describeBlock(block) {
  const range = rangeLabel(block.start, block.end);
  if (block.ptoUsed === 0) return { headline: `No time off needed: ${block.daysOff} days`, range, ask: null };
  const dates = block.ptoDates.map(dayLabel);
  const list = dates.length === 1 ? dates[0] : dates.length === 2 ? `${dates[0]} and ${dates[1]}` : `${dates.slice(0, -1).join(', ')} and ${dates[dates.length - 1]}`;
  return { headline: `Take ${list} off, get ${block.daysOff} days`, range, ask: list };
}

// ---- trip length and destinations --------------------------------------------------------------------

// The signup form's trip-length values.
export function tripLengthBucket(daysOff) {
  if (daysOff <= 3) return 'weekend';
  if (daysOff <= 6) return '4-6';
  if (daysOff <= 10) return '7-10';
  if (daysOff <= 14) return '11-14';
  return '2+ weeks';
}

// Destinations a window of this many days can sensibly fit (a 4-day weekend never suggests Bali).
export function destinationsForWindow(daysOff, origin = null, fit = DESTINATION_FIT) {
  return Object.keys(fit)
    .filter((name) => fit[name] <= daysOff)
    .sort((a, b) => a.localeCompare(b));
}

// ---- iCalendar (RFC 5545) ----------------------------------------------------------------------------

function icsEscape(text) {
  return String(text).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}
const encoder = new TextEncoder();
// Fold at 75 octets with CRLF + space, never inside a multi-byte character.
function foldLine(line) {
  if (encoder.encode(line).length <= 75) return line;
  const parts = [];
  let current = '';
  let size = 0;
  let limit = 75;
  for (const ch of line) {
    const bytes = encoder.encode(ch).length;
    if (size + bytes > limit) { parts.push(current); current = ''; size = 0; limit = 74; } // continuation lines lose 1 octet to the space
    current += ch;
    size += bytes;
  }
  parts.push(current);
  return parts.join('\r\n ');
}
const compact = (day) => day.replace(/-/g, '');
function stamp(now) { return now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z'); }

// All-day events for a plan. No fares in the file (they go stale; the link does not).
export function buildIcs({ origin, originCity, plan, pageUrl, now = new Date() }) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Sparkfare//Time-off planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(`Sparkfare long weekends from ${originCity || origin}`)}`,
  ];
  for (const block of plan) {
    const d = describeBlock(block);
    const summary = block.ptoUsed === 0 ? 'Long weekend (no time off needed)' : `Long weekend (request off: ${d.ask})`;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${block.start}-${block.end}-${origin}@sparkfare.com`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART;VALUE=DATE:${compact(block.start)}`,
      `DTEND;VALUE=DATE:${compact(addDays(block.end, 1))}`, // exclusive end
      `SUMMARY:${icsEscape(summary)}`,
      `DESCRIPTION:${icsEscape(`${d.headline} (${d.range}). Prices and plans: ${pageUrl}`)}`,
      `URL:${pageUrl}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
