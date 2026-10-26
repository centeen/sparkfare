// N10 (Addendum N, ROADMAP step 157): the shadow ranking job. Ranks the three feeds the site is built from against the curated
// store `fare_daily`, writes the shadow serving files to the private bucket (prefix serving-shadow/), writes route_verdict rows to
// D1 and a counts-only diff against the files the site serves today. NOTHING a visitor sees is read from or written by this.
//
//   node scripts/data/rank-curated.mjs [--dry-run] [--local] [--fare-daily-file rows.json] [--out-dir DIR] [--date YYYY-MM-DD] [--database sparkfare-db]
//     --dry-run  compute and report only: no R2 upload, no D1 write, and the diff goes to --out-dir instead of docs/data/shadow_diffs/
//     --local    no credentials: history rows come from --fare-daily-file and the previous shadow output is the committed file
//
// Each file is ranked "as of" its served file's own generated_at, so the diff measures the rules and the history, not the clock.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { wranglerStore, wranglerRunner } from './upload-raw.mjs';
import { pythonCommand } from './curate-backfill.mjs';

export const SHADOW_PREFIX = 'serving-shadow/';
export const HERE = path.dirname(fileURLToPath(import.meta.url));
// served file -> the feed it is ranked from. JFK daily, then the hourly file (every origin), then the non-JFK file.
export const PIPELINES = [
  { name: 'daily_jfk', feed: 'sparkfare_flight_prices.json', served: 'sparkfare_ranked_deals.json' },
  { name: 'hourly', feed: 'sparkfare_hourly_flight_prices.json', served: 'sparkfare_hourly_ranked_deals.json' },
  { name: 'other_origins', feed: 'sparkfare_flight_prices_other_origins.json', served: 'sparkfare_ranked_deals_other_origins.json' },
];
export const VERDICT_SOURCE = 'hourly'; // the file that covers every origin: route_verdict is written from it

/** SQL that reads the curated history: the 31 days before `today` (the script keeps 30 and drops today itself). */
export const historyQuery = (today) =>
  `SELECT route_key, obs_date, min_price, first_seen_at FROM fare_daily WHERE obs_date >= date('${today}','-31 day') ORDER BY route_key, obs_date`;

export function parseD1Rows(stdout) {
  const parsed = JSON.parse(stdout);
  const block = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!block || block.success === false || !Array.isArray(block.results)) throw new Error('unexpected D1 output');
  return block.results;
}

async function readHistoryRows(run, database, today) {
  const r = await run(['d1', 'execute', database, '--remote', '--json', '--command', historyQuery(today)]);
  if (r.code !== 0) throw new Error(`reading fare_daily failed (exit ${r.code}): ${(r.stderr || r.stdout).slice(0, 400)}`);
  return parseD1Rows(r.stdout);
}

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

export function runPython(script, args) {
  return execFileSync(pythonCommand(), [path.join(HERE, script), ...args], { maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'inherit'] }).toString('utf8');
}

export async function main(argv = process.argv.slice(2)) {
  const opt = (n, d) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : d);
  const dryRun = argv.includes('--dry-run');
  const local = argv.includes('--local');
  const today = opt('date', new Date().toISOString().slice(0, 10));
  const database = opt('database', 'sparkfare-db');
  const root = process.cwd();
  const work = opt('out-dir') ? path.resolve(opt('out-dir')) : fs.mkdtempSync(path.join(os.tmpdir(), 'rank-curated-'));
  fs.mkdirSync(work, { recursive: true });
  const hasCreds = !!(process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID);
  if (!local && !hasCreds) throw new Error('CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must be set (use --local for a run without credentials)');
  const run = local ? null : wranglerRunner();
  const store = local ? null : wranglerStore({ run });

  let rows;
  if (local) {
    if (!opt('fare-daily-file')) throw new Error('--local needs --fare-daily-file');
    rows = readJson(opt('fare-daily-file'));
  } else {
    rows = await readHistoryRows(run, database, today);
  }
  if (!rows.length) throw new Error('fare_daily returned no rows: nothing to rank against');
  const rowsFile = path.join(work, 'fare_daily_rows.json');
  fs.writeFileSync(rowsFile, JSON.stringify(rows));

  const pairs = [];
  let verdictSql = null;
  for (const p of PIPELINES) {
    const servedPath = path.join(root, p.served);
    const feedPath = path.join(root, p.feed);
    if (!fs.existsSync(feedPath) || !fs.existsSync(servedPath)) throw new Error(`missing input for ${p.name}: ${!fs.existsSync(feedPath) ? p.feed : p.served}`);
    const served = readJson(servedPath);
    // The previous shadow output is the carry-forward source, like the live script's previous output; on the first run it is the served file.
    let previousPath = servedPath;
    if (store) {
      const prev = await store.fetch(SHADOW_PREFIX + p.served);
      if (prev) { previousPath = path.join(work, `previous_${p.served}`); fs.writeFileSync(previousPath, prev); }
    }
    const outPath = path.join(work, `shadow_${p.served}`);
    const args = ['--feed', feedPath, '--fare-daily', rowsFile, '--previous', previousPath, '--out', outPath];
    if (served.generated_at) args.push('--now', served.generated_at);
    if (p.name === VERDICT_SOURCE) args.push('--verdicts-sql', path.join(work, 'route_verdict.sql'));
    const counts = runPython('rank_curated.py', args).trim().split('\n').pop();
    console.log(`${p.name}: ${counts}`);
    pairs.push(['--pair', p.name, outPath, servedPath]);
  }

  const diffDir = dryRun || local ? work : path.join(root, 'docs', 'data', 'shadow_diffs');
  fs.mkdirSync(diffDir, { recursive: true });
  const diffMd = path.join(diffDir, `${today}.md`);
  const diffJson = path.join(work, 'diff-latest.json');
  const summary = runPython('shadow_diff.py', [...pairs.flat(), '--date', today, '--out', diffMd, '--json-out', diffJson]).trim();
  console.log(summary);

  if (dryRun || local) { console.log(`${dryRun ? 'dry run' : 'local run'}: nothing uploaded or written to D1; files are in ${work}`); return { work, summary: JSON.parse(summary) }; }

  for (const p of PIPELINES) await store.put(SHADOW_PREFIX + p.served, fs.readFileSync(path.join(work, `shadow_${p.served}`)), 'application/json');
  await store.put(`${SHADOW_PREFIX}diff-latest.json`, fs.readFileSync(diffJson), 'application/json');
  const sqlPath = path.join(work, 'route_verdict.sql');
  if (fs.existsSync(sqlPath) && fs.statSync(sqlPath).size > 0) {
    const r = await run(['d1', 'execute', database, '--remote', '--file', sqlPath]);
    if (r.code !== 0) throw new Error(`writing route_verdict failed (exit ${r.code}): ${(r.stderr || r.stdout).slice(0, 400)}`);
  }
  console.log(`uploaded ${PIPELINES.length} shadow files and the diff pointer to ${SHADOW_PREFIX}; wrote route_verdict`);
  return { work, summary: JSON.parse(summary) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((e) => { console.error(`RANK CURATED FAILED: ${e.message}`); process.exit(1); });
}
