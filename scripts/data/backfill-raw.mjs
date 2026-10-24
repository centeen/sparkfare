// N1 one-off backfill (Addendum N): copies what already exists into the raw archive, so the history is not lost.
//   snapshots : every file in sparkfare_hourly_snapshots/ -> raw/fares/multi_origin/ (backfill: true)
//   history   : every distinct git version of the three history files -> raw/history_files/<name>/
// Idempotent: objects that already exist with the same content are skipped; different content under the same key is
// reported and the run fails at the end (nothing is overwritten).  Run it from the r2-backfill workflow (needs the
// Cloudflare secrets and a full git checkout).
//
//   node scripts/data/backfill-raw.mjs --mode snapshots|history [--limit N] [--dry-run] [--concurrency 6]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  archive, wranglerStore, wranglerRunner, runTimeFromSnapshotName, stamp, sha256, countRoutes, ConflictError,
} from './upload-raw.mjs';

export const HISTORY_FILES = [
  'sparkfare_price_history.json',
  'sparkfare_hourly_price_history.json',
  'sparkfare_price_history_other_origins.json',
];

export function snapshotJobs(dir) {
  return fs.readdirSync(dir).filter((f) => /^flight_prices_.*\.json$/.test(f)).sort().map((f) => {
    const runTime = runTimeFromSnapshotName(f);
    const bytes = fs.readFileSync(path.join(dir, f));
    let counts = null;
    try { counts = countRoutes(JSON.parse(bytes.toString('utf8'))); } catch { /* kept as received */ }
    return { base: 'raw/fares/multi_origin', label: `run=${stamp(runTime)}`, runTime, bytes, backfill: true,
      extra: { pipeline: 'multi_origin', source_path: `sparkfare_hourly_snapshots/${f}`, counts } };
  });
}

/** One job per distinct committed version of each history file (oldest first); identical content is uploaded once. */
export function historyJobs(files = HISTORY_FILES, git = (args) => execFileSync('git', args, { maxBuffer: 1 << 28 })) {
  const jobs = [];
  for (const file of files) {
    const log = git(['log', '--reverse', '--format=%H%x09%cI', '--', file]).toString('utf8').split('\n').filter(Boolean);
    const seen = new Set();
    for (const line of log) {
      const [sha, iso] = line.split('\t');
      let bytes;
      try { bytes = git(['show', `${sha}:${file}`]); } catch { continue; } // a commit that deleted the file
      const digest = sha256(bytes);
      if (seen.has(digest)) continue;
      seen.add(digest);
      jobs.push({ base: `raw/history_files/${file.replace(/\.json$/, '')}`, label: `commit=${sha.slice(0, 12)}`,
        runTime: new Date(iso), bytes, backfill: true, extra: { source_path: file, source_commit: sha } });
    }
  }
  return jobs;
}

export async function runJobs(store, jobs, { concurrency = 6, dryRun = false } = {}) {
  const tally = { uploaded: 0, skipped: 0, manifest_added: 0, conflicts: [], errors: [] };
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      try {
        const r = await archive(store, { ...job, dryRun });
        const k = r.status.replace('dry_run_', '');
        tally[k] = (tally[k] ?? 0) + 1;
      } catch (e) {
        (e instanceof ConflictError ? tally.conflicts : tally.errors).push(`${job.base}/${job.label}: ${e.message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
  return tally;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  (async () => {
    const a = process.argv.slice(2);
    const opt = (n, d) => (a.includes(`--${n}`) ? a[a.indexOf(`--${n}`) + 1] : d);
    const mode = opt('mode');
    const limit = Number(opt('limit', 0)) || 0;
    const dryRun = a.includes('--dry-run');
    if (!['snapshots', 'history'].includes(mode)) throw new Error('usage: backfill-raw.mjs --mode snapshots|history [--limit N] [--dry-run] [--concurrency N]');
    let jobs = mode === 'snapshots' ? snapshotJobs('sparkfare_hourly_snapshots') : historyJobs();
    if (limit) jobs = jobs.slice(0, limit);
    console.log(`${mode}: ${jobs.length} objects to check${dryRun ? ' (dry run)' : ''}`);
    const hasCreds = !!(process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID);
    if (!dryRun && !hasCreds) throw new Error('CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must be set');
    const store = dryRun && !hasCreds ? { fetch: async () => null, put: async () => {} } : wranglerStore({ run: wranglerRunner() });
    const t = await runJobs(store, jobs, { concurrency: Number(opt('concurrency', 6)), dryRun });
    console.log(JSON.stringify({ mode, checked: jobs.length, uploaded: t.uploaded, skipped: t.skipped, manifest_added: t.manifest_added, conflicts: t.conflicts.length, errors: t.errors.length }));
    for (const m of [...t.conflicts, ...t.errors].slice(0, 20)) console.error(m);
    if (t.conflicts.length || t.errors.length) process.exit(1);
  })().catch((e) => { console.error(`BACKFILL FAILED: ${e.message}`); process.exit(1); });
}
