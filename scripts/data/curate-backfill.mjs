// N9 (Addendum N, ROADMAP step 156): build the curated store `fare_daily` from the raw archive, then load it into D1.
//   1. Collect the raw inputs into a staging directory:
//        --source r2    (default)  read each object from the private sparkfare-raw bucket (the hourly snapshots and the old
//                                  git versions of the three history files, at the keys N1 wrote them to) and check that it
//                                  is byte-identical to the repo's copy of the same file
//        --source repo             read the repo's copies directly (no credentials; used for a local dry run)
//   2. Run scripts/data/curate.py on the staging directory (cheapest fare per route and day, one key format for every origin).
//   3. Unless --dry-run, apply the generated SQL files to production D1 with `wrangler d1 execute --remote --file`, one file at a time.
// Idempotent: the SQL can only lower a stored price and raise n_obs, so running it again changes nothing.
//
//   node scripts/data/curate-backfill.mjs [--source r2|repo] [--dry-run] [--limit N] [--keep DIR] [--database sparkfare-db]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFile, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { wranglerStore, wranglerRunner, sha256 } from './upload-raw.mjs';
import { snapshotJobs, historyJobs } from './backfill-raw.mjs';

// The N1 raw backfill archived every old version of the three history files up to 2026-10-23. Versions committed from
// 2026-10-24 on were never archived (only fetch outputs are archived from then on): they are recomputed from feeds that are
// archived, and the daily refresh covers those days, so a missing one is skipped and reported, never an error.
export const HISTORY_ARCHIVED_BEFORE = '2026-10-24';
export const isOptionalMissing = (job) => job.base.startsWith('raw/history_files/') && job.runTime.toISOString().slice(0, 10) >= HISTORY_ARCHIVED_BEFORE;

const dataKeyOf = (job) => `${job.base}/date=${job.runTime.toISOString().slice(0, 10)}/${job.label}.json.gz`;

/** Where each job's bytes come from. For r2 the object is fetched, gunzipped and compared with the repo copy. */
export async function collect(jobs, { source, store, concurrency = 6 }) {
  const out = new Array(jobs.length);
  const problems = [];
  const skipped = [];
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const i = next++;
      const job = jobs[i];
      if (source === 'repo') { out[i] = job.bytes; continue; }
      try {
        const gz = await store.fetch(dataKeyOf(job));
        if (!gz) {
          if (isOptionalMissing(job)) skipped.push(dataKeyOf(job)); else problems.push(`${dataKeyOf(job)}: not in the raw archive`);
          continue;
        }
        const bytes = zlib.gunzipSync(gz);
        if (sha256(bytes) !== sha256(job.bytes)) { problems.push(`${dataKeyOf(job)}: differs from the repo copy`); continue; }
        out[i] = bytes;
      } catch (e) { problems.push(`${dataKeyOf(job)}: ${e.message}`); }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
  return { bytes: out, problems, skipped };
}

export function stage(jobs, bytesList, dir) {
  fs.mkdirSync(path.join(dir, 'feeds'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'history'), { recursive: true });
  let feeds = 0; let history = 0;
  jobs.forEach((job, i) => {
    if (!bytesList[i]) return;
    if (job.base.startsWith('raw/history_files/')) {
      const name = job.base.split('/').pop() + '.json';
      fs.writeFileSync(path.join(dir, 'history', `${name}__${job.label.replace('=', '-')}.json`), bytesList[i]);
      history++;
    } else {
      fs.writeFileSync(path.join(dir, 'feeds', `${job.label.replace('=', '-')}.json`), bytesList[i]);
      feeds++;
    }
  });
  return { feeds, history };
}

export function pythonCommand() {
  if (process.env.PYTHON) return process.env.PYTHON;
  for (const c of ['python3', 'python', 'py']) {
    try { execFileSync(c, ['--version'], { stdio: 'ignore' }); return c; } catch { /* try the next */ }
  }
  throw new Error('no Python found (set PYTHON)');
}

export function runCurate(staging, outDir, extraArgs = []) {
  const py = pythonCommand();
  const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'curate.py');
  const out = execFileSync(py, [script, '--staging', staging, '--out-dir', outDir, ...extraArgs], { maxBuffer: 1 << 26 }).toString('utf8');
  return JSON.parse(out.trim().split('\n').pop());
}

export async function applySql(outDir, database) {
  const run = wranglerRunner();
  const files = fs.readdirSync(outDir).filter((f) => f.endsWith('.sql')).sort();
  let n = 0;
  for (const f of files) {
    const r = await run(['d1', 'execute', database, '--remote', '--file', path.join(outDir, f)]);
    if (r.code !== 0) throw new Error(`d1 execute failed on ${f} (exit ${r.code}): ${(r.stderr || r.stdout).slice(0, 600)}`);
    n++;
    if (n % 10 === 0) console.log(`applied ${n}/${files.length} files`);
  }
  return files.length;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  (async () => {
    const a = process.argv.slice(2);
    const opt = (n, d) => (a.includes(`--${n}`) ? a[a.indexOf(`--${n}`) + 1] : d);
    const source = opt('source', 'r2');
    if (!['r2', 'repo'].includes(source)) throw new Error('--source must be r2 or repo');
    const dryRun = a.includes('--dry-run');
    const limit = Number(opt('limit', 0)) || 0;
    let jobs = [...snapshotJobs('sparkfare_hourly_snapshots'), ...historyJobs()];
    if (limit) jobs = jobs.slice(0, limit);
    const hasCreds = !!(process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID);
    if ((source === 'r2' || !dryRun) && !hasCreds) throw new Error('CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must be set (use --source repo --dry-run for a local run)');
    const store = source === 'r2' ? wranglerStore({ run: wranglerRunner() }) : null;
    console.log(`${jobs.length} raw objects (${source}${dryRun ? ', dry run' : ''})`);
    const { bytes, problems, skipped } = await collect(jobs, { source, store, concurrency: Number(opt('concurrency', 6)) });
    if (problems.length) {
      for (const p of problems.slice(0, 20)) console.error(p);
      throw new Error(`${problems.length} raw object(s) could not be read; nothing was written`);
    }
    if (skipped.length) console.log(`${skipped.length} history-file version(s) committed after the raw backfill are not archived; skipped (their days come from archived feeds and the daily refresh)`);
    const work = opt('keep') ? path.resolve(opt('keep')) : fs.mkdtempSync(path.join(os.tmpdir(), 'curate-'));
    const staged = stage(jobs, bytes, path.join(work, 'staging'));
    const summary = runCurate(path.join(work, 'staging'), path.join(work, 'sql'));
    console.log(JSON.stringify({ staged, ...summary }));
    if (dryRun) { console.log(`dry run: SQL left in ${path.join(work, 'sql')}; nothing applied`); return; }
    const applied = await applySql(path.join(work, 'sql'), opt('database', 'sparkfare-db'));
    console.log(`applied ${applied} SQL file(s) to production D1`);
  })().catch((e) => { console.error(`CURATE FAILED: ${e.message}`); process.exit(1); });
}
