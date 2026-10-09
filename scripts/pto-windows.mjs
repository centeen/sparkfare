// Prints the travel windows the PTO fare fetch should price, as JSON on stdout (ROADMAP step 73, Track B).
//
// The windows come from the same module the /time-off page uses (src/ptoCalendar.js), so the dates that get priced are
// the dates the page shows: one source of truth, no second copy of the holiday rules in Python. A window is a block of
// days off the default holiday set can produce: the best block per holiday for 0 to 3 PTO days, plus every block the
// optimizer picks for a spread of PTO budgets. Only windows that start within the next 120 days are kept, nearest first.
//
//   node scripts/pto-windows.mjs                 (uses today's date)
//   PTO_TODAY=2026-10-12 node scripts/pto-windows.mjs
import { buildPlan, summarizeByHoliday, destinationsForWindow, addDays, parseDay, COMMON_HOLIDAY_SET } from '../src/ptoCalendar.js';

const HORIZON_DAYS = 120;
const BUDGETS = [3, 5, 8, 10, 12, 15, 20, 25, 30];

export function pickWindows(today, { horizon = HORIZON_DAYS } = {}) {
  const lastDay = '2027-12-31';
  const base = buildPlan({ from: today, to: lastDay, keys: COMMON_HOLIDAY_SET, budget: 10 });
  const wanted = new Map();
  const add = (block) => wanted.set(`${block.start}:${block.end}`, block);
  for (const { options } of summarizeByHoliday({ holidays: base.holidays, blocks: base.blocks })) options.forEach(add);
  for (const budget of BUDGETS) buildPlan({ from: today, to: lastDay, keys: COMMON_HOLIDAY_SET, budget }).plan.forEach(add);

  const limit = addDays(today, horizon);
  // A fare is only worth searching for if the trip is at least 3 days away.
  const earliest = addDays(today, 3);
  return [...wanted.values()]
    .filter((b) => b.start >= earliest && b.start <= limit)
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.end < b.end ? -1 : 1))
    .map((b) => ({
      start: b.start,
      end: b.end,
      days_off: b.daysOff,
      pto_used: b.ptoUsed,
      destinations: destinationsForWindow(b.daysOff),
    }));
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('pto-windows.mjs')) {
  const today = process.env.PTO_TODAY || new Date().toISOString().slice(0, 10);
  parseDay(today); // throws on a malformed date
  process.stdout.write(JSON.stringify({ generated_for: today, horizon_days: HORIZON_DAYS, windows: pickWindows(today) }, null, 2) + '\n');
}
