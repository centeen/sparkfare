// N11 (Addendum N, ROADMAP step 158): writes docs/metrics/state_METRICS_auto_YYYY-MM-DD.md from metrics_daily, for the Hub to copy into the
// project's state_METRICS.md (item 125). Counts only, with as-of dates and sample sizes. Read-only against D1.
//
//   node scripts/data/metrics-auto.mjs [--days 7] [--as-of YYYY-MM-DD] [--out-dir DIR] [--rows-file rows.json] [--database sparkfare-db]
//     --rows-file  read the metrics_daily rows from a JSON file instead of D1 (no credentials; used by the tests)
//     --out-dir    where to write the file (default docs/metrics)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { wranglerRunner } from './upload-raw.mjs';
import { buildReport, renderMarkdown } from '../../src/metrics/report.js';

export const rowsQuery = (since) => `SELECT date, metric_id, dimension, value, n FROM metrics_daily WHERE date >= '${since}' ORDER BY date, metric_id, dimension`;

const addDays = (key, n) => new Date(new Date(`${key}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);

export async function main(argv = process.argv.slice(2)) {
  const opt = (n, d) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : d);
  const days = Number(opt('days', 7));
  if (!Number.isInteger(days) || days < 1 || days > 90) throw new Error('--days must be a whole number from 1 to 90');
  const today = new Date().toISOString().slice(0, 10);
  const asOf = opt('as-of', addDays(today, -1)); // the last complete UTC day
  if (!/^\d{4}-\d\d-\d\d$/.test(asOf)) throw new Error('--as-of must be YYYY-MM-DD');
  let rows;
  if (opt('rows-file')) {
    rows = JSON.parse(fs.readFileSync(opt('rows-file'), 'utf8'));
  } else {
    if (!(process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID)) throw new Error('CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must be set (or use --rows-file)');
    const r = await wranglerRunner()(['d1', 'execute', opt('database', 'sparkfare-db'), '--remote', '--json', '--command', rowsQuery(addDays(asOf, -(days + 35)))]);
    if (r.code !== 0) throw new Error(`reading metrics_daily failed (exit ${r.code}): ${(r.stderr || r.stdout).slice(0, 400)}`);
    const parsed = JSON.parse(r.stdout);
    rows = (Array.isArray(parsed) ? parsed[0] : parsed)?.results;
    if (!Array.isArray(rows)) throw new Error('unexpected D1 output');
  }
  if (!rows.length) throw new Error('metrics_daily has no rows: run the daily job first');
  const md = renderMarkdown(buildReport(rows, { asOf, days }));
  const dir = path.resolve(opt('out-dir', 'docs/metrics'));
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `state_METRICS_auto_${today}.md`);
  fs.writeFileSync(file, md);
  console.log(`wrote ${file} (${rows.length} metrics_daily rows read, as of ${asOf}, ${days} days)`);
  return { file, md };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((e) => { console.error(`METRICS AUTO FAILED: ${e.message}`); process.exit(1); });
}
