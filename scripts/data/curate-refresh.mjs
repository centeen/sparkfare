// N9 (Addendum N, ROADMAP step 156): the daily refresh of the curated store `fare_daily`.
// The backfill (curate-backfill.mjs) rebuilds everything from the private raw archive. This keeps the store current: it reads
// the files the pipelines have just committed, keeps only the last few days, and upserts them with the same curate.py.
//   feeds:    the daily JFK fetch, the hourly multi-origin fetch, and the hourly snapshots from the last few days
//   history:  the three price-history files as they are now (the days a feed no longer shows)
// Idempotent and order-free: the SQL can only lower a stored price and raise n_obs, so running it twice changes nothing.
//
//   node scripts/data/curate-refresh.mjs [--days 3] [--dry-run] [--keep DIR] [--database sparkfare-db] [--today YYYY-MM-DD]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCurate, applySql } from './curate-backfill.mjs';
import { HISTORY_FILES } from './backfill-raw.mjs';

export const FEED_FILES = ['sparkfare_flight_prices.json', 'sparkfare_hourly_flight_prices.json'];
export const SNAPSHOT_DIR = 'sparkfare_hourly_snapshots';

/** First UTC date (YYYY-MM-DD) the refresh writes: `days` calendar days including today. */
export function sinceDate(today, days) {
  const d = new Date(`${today}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`bad date: ${today}`);
  d.setUTCDate(d.getUTCDate() - (Math.max(1, days) - 1));
  return d.toISOString().slice(0, 10);
}

/** Snapshot files whose run date (from the file name) is on or after `since`. */
export function recentSnapshots(names, since) {
  return names.filter((f) => {
    const m = /^flight_prices_(\d{4}-\d\d-\d\d)T/.exec(f);
    return m && m[1] >= since;
  }).sort();
}

/** Copy the inputs into a staging directory laid out the way curate.py reads it. Returns counts. */
export function stageRefresh(root, dir, since) {
  fs.mkdirSync(path.join(dir, 'feeds'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'history'), { recursive: true });
  let feeds = 0; let history = 0;
  const snapDir = path.join(root, SNAPSHOT_DIR);
  const snaps = fs.existsSync(snapDir) ? recentSnapshots(fs.readdirSync(snapDir), since) : [];
  for (const f of snaps) { fs.copyFileSync(path.join(snapDir, f), path.join(dir, 'feeds', `snapshot-${f}`)); feeds++; }
  for (const f of FEED_FILES) {
    const src = path.join(root, f);
    if (fs.existsSync(src)) { fs.copyFileSync(src, path.join(dir, 'feeds', `current-${f}`)); feeds++; }
  }
  for (const f of HISTORY_FILES) {
    const src = path.join(root, f);
    // the part before "__" is the history file's own name: curate.py treats only sparkfare_price_history.json as the JFK daily file
    if (fs.existsSync(src)) { fs.copyFileSync(src, path.join(dir, 'history', `${f}__now.json`)); history++; }
  }
  return { feeds, history, snapshots: snaps.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  (async () => {
    const a = process.argv.slice(2);
    const opt = (n, d) => (a.includes(`--${n}`) ? a[a.indexOf(`--${n}`) + 1] : d);
    const dryRun = a.includes('--dry-run');
    const days = Number(opt('days', 3));
    if (!Number.isInteger(days) || days < 1 || days > 14) throw new Error('--days must be a whole number from 1 to 14');
    const today = opt('today', new Date().toISOString().slice(0, 10));
    const since = sinceDate(today, days);
    if (!dryRun && !(process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID)) {
      throw new Error('CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must be set (use --dry-run for a local run)');
    }
    const work = opt('keep') ? path.resolve(opt('keep')) : fs.mkdtempSync(path.join(os.tmpdir(), 'curate-refresh-'));
    const staged = stageRefresh(process.cwd(), path.join(work, 'staging'), since);
    if (staged.feeds === 0 && staged.history === 0) throw new Error('no input files found; run from the repository root');
    const summary = runCurate(path.join(work, 'staging'), path.join(work, 'sql'), ['--since-date', since]);
    console.log(JSON.stringify({ since, staged, ...summary }));
    if (summary.rows === 0) throw new Error(`no route-days on or after ${since}: the pipelines have not produced fresh data`);
    if (dryRun) { console.log(`dry run: SQL left in ${path.join(work, 'sql')}; nothing applied`); return; }
    const applied = await applySql(path.join(work, 'sql'), opt('database', 'sparkfare-db'));
    console.log(`applied ${applied} SQL file(s) to production D1`);
  })().catch((e) => { console.error(`CURATE REFRESH FAILED: ${e.message}`); process.exit(1); });
}
