// N1 (Addendum N, ROADMAP step 148): keep every fetch as received, write-once, in the private R2 bucket
// `sparkfare-raw`.  Key layout:
//   raw/fares/<pipeline>/date=YYYY-MM-DD/run=<YYYYMMDDTHHMMSSZ>.json.gz
//   raw/fares/<pipeline>/date=YYYY-MM-DD/run=<YYYYMMDDTHHMMSSZ>.manifest.json
//   raw/history_files/<name>/date=YYYY-MM-DD/commit=<sha12>.json.gz   (backfill of old history-file versions)
// Rules: an existing object is never overwritten. The same input uploaded twice is a no-op; a different input under an
// existing key is a conflict and an error. The manifest is written after the data object, so a manifest means the data
// is there. No personal data is stored: raw fares and counts only.
//
// Library + CLI:  node scripts/data/upload-raw.mjs --pipeline multi_origin --file sparkfare_hourly_flight_prices.json
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const BUCKET = 'sparkfare-raw';
export const PIPELINES = ['daily_jfk', 'multi_origin', 'pto_windows'];

export class ConflictError extends Error {}

export const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

/** Newest timestamp inside a fetch output: per-route `fetched_at`, else top-level `generated_at`. Null if none. */
export function detectRunTime(obj) {
  if (!obj || typeof obj !== 'object') return null;
  let best = null;
  for (const v of Object.values(obj)) {
    const t = v && typeof v === 'object' ? Date.parse(v.fetched_at) : NaN;
    if (!Number.isNaN(t) && (best === null || t > best)) best = t;
  }
  if (best === null) {
    const g = Date.parse(obj.generated_at);
    if (!Number.isNaN(g)) best = g;
  }
  return best === null ? null : new Date(best);
}

/** Counts only (no prices): how many route entries and how many had results. Null when the shape is not route-keyed. */
export function countRoutes(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const entries = Object.values(obj).filter((v) => v && typeof v === 'object' && !Array.isArray(v) && 'results' in v);
  if (!entries.length) return null;
  return { routes: entries.length, routes_with_results: entries.filter((v) => Array.isArray(v.results) && v.results.length).length };
}

export const stamp = (date) => date.toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';

/** Run time encoded in a snapshot file name, e.g. flight_prices_2026-09-06T180853.396844+0000.json or ...T143835.043637Z.json */
export function runTimeFromSnapshotName(name) {
  const m = name.match(/(\d{4})-(\d\d)-(\d\d)T(\d\d)(\d\d)(\d\d)/);
  if (!m) throw new Error(`cannot read a run time from file name: ${name}`);
  return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`);
}

/**
 * Archive one object (plus its manifest) in `store`. `store` has fetch(key) -> Buffer|null and put(key, buf, contentType).
 * Returns { status: 'uploaded' | 'skipped' | 'manifest_added', dataKey }.  Throws ConflictError if the key holds different data.
 */
export async function archive(store, { base, label, runTime, bytes, backfill = false, extra = {}, now = new Date(), dryRun = false }) {
  const date = runTime.toISOString().slice(0, 10);
  const dataKey = `${base}/date=${date}/${label}.json.gz`;
  const manifestKey = `${base}/date=${date}/${label}.manifest.json`;
  const inputSha = sha256(bytes);

  const existingManifest = await store.fetch(manifestKey);
  if (existingManifest) {
    let prev = null;
    try { prev = JSON.parse(existingManifest.toString('utf8')); } catch { /* treated as a conflict below */ }
    if (prev && prev.input_sha256 === inputSha) return { status: 'skipped', dataKey };
    throw new ConflictError(`${dataKey} already exists with different data (existing sha ${prev?.input_sha256 ?? 'unreadable'}, new ${inputSha}); raw objects are write-once`);
  }

  const gz = zlib.gzipSync(bytes, { level: 9 });
  const manifest = {
    schema_version: 1,
    kind: 'raw_manifest',
    run_id: label,
    run_time: runTime.toISOString(),
    key: dataKey,
    input_sha256: inputSha,
    input_bytes: bytes.length,
    gz_bytes: gz.length,
    backfill,
    code_commit: process.env.GITHUB_SHA || null,
    workflow_run_id: process.env.GITHUB_RUN_ID || null,
    uploaded_at: now.toISOString(),
    ...extra,
  };

  const existingData = await store.fetch(dataKey);
  let status = 'uploaded';
  if (existingData) {
    // A data object without a manifest: an earlier run stopped between the two writes. Verify, then add only the manifest.
    const prevSha = sha256(zlib.gunzipSync(existingData));
    if (prevSha !== inputSha) throw new ConflictError(`${dataKey} already exists with different data (existing sha ${prevSha}, new ${inputSha}); raw objects are write-once`);
    status = 'manifest_added';
  }
  if (dryRun) return { status: `dry_run_${status}`, dataKey };
  if (!existingData) await store.put(dataKey, gz, 'application/gzip');
  await store.put(manifestKey, Buffer.from(JSON.stringify(manifest, null, 2) + '\n'), 'application/json');
  return { status, dataKey };
}

const NOT_FOUND = /does not exist|not found|NoSuchKey|10007/i;

/** R2 store backed by `wrangler r2 object get|put --remote`. `run(args)` resolves { code, stdout, stderr }. */
export function wranglerStore({ bucket = BUCKET, run }) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r2-'));
  let n = 0;
  return {
    async fetch(key) {
      const file = path.join(tmp, `get-${n++}`);
      const r = await run(['r2', 'object', 'get', `${bucket}/${key}`, '--remote', '--file', file]);
      if (r.code === 0) { const b = fs.readFileSync(file); fs.rmSync(file, { force: true }); return b; }
      if (NOT_FOUND.test(`${r.stderr}\n${r.stdout}`)) return null;
      throw new Error(`r2 get failed for ${key} (exit ${r.code}): ${(r.stderr || r.stdout).slice(0, 400)}`);
    },
    async put(key, buf, contentType) {
      const file = path.join(tmp, `put-${n++}`);
      fs.writeFileSync(file, buf);
      const r = await run(['r2', 'object', 'put', `${bucket}/${key}`, '--remote', '--file', file, '--content-type', contentType]);
      fs.rmSync(file, { force: true });
      if (r.code !== 0) throw new Error(`r2 put failed for ${key} (exit ${r.code}): ${(r.stderr || r.stdout).slice(0, 400)}`);
    },
  };
}

/**
 * A secret pasted into GitHub often carries a trailing newline or space, and wrangler then rejects the account id
 * ("Invalid account ID", seen on the first real backfill run, 2026-10-24). Trim the two Cloudflare values; leave the rest.
 */
export function cleanCloudflareEnv(env) {
  const out = { ...env };
  for (const k of ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID']) if (typeof out[k] === 'string') out[k] = out[k].trim();
  return out;
}

/** Runs wrangler: WRANGLER_JS (a path to bin/wrangler.js) if set, else `npx wrangler`. Token comes from the environment only. */
export function wranglerRunner(rawEnv = process.env) {
  const env = cleanCloudflareEnv(rawEnv);
  const js = env.WRANGLER_JS;
  return (args) => new Promise((resolve) => {
    const [cmd, argv] = js ? [process.execPath, [js, ...args]] : [process.platform === 'win32' ? 'npx.cmd' : 'npx', ['--yes', 'wrangler', ...args]];
    execFile(cmd, argv, { env, maxBuffer: 1 << 26, shell: process.platform === 'win32' && !js }, (err, stdout, stderr) => {
      resolve({ code: err ? (typeof err.code === 'number' ? err.code : 1) : 0, stdout: String(stdout), stderr: String(stderr) });
    });
  });
}

/** Archive one fetch-output file for a pipeline. */
export async function archiveFile(store, { pipeline, file, runTime, backfill = false, dryRun = false }) {
  if (!PIPELINES.includes(pipeline)) throw new Error(`unknown pipeline ${pipeline}; expected one of ${PIPELINES.join(', ')}`);
  const bytes = fs.readFileSync(file);
  let parsed = null;
  try { parsed = JSON.parse(bytes.toString('utf8')); } catch { /* raw is kept as received even if it does not parse */ }
  const rt = runTime ? new Date(runTime) : (detectRunTime(parsed) ?? new Date());
  if (Number.isNaN(rt.getTime())) throw new Error(`invalid run time: ${runTime}`);
  return archive(store, {
    base: `raw/fares/${pipeline}`,
    label: `run=${stamp(rt)}`,
    runTime: rt,
    bytes,
    backfill,
    dryRun,
    extra: { pipeline, source_path: path.basename(file), counts: countRoutes(parsed) },
  });
}

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--backfill' || a === '--dry-run') o[a.slice(2).replace('-', '_')] = true;
    else if (a.startsWith('--')) o[a.slice(2).replace('-', '_')] = argv[++i];
    else throw new Error(`unexpected argument ${a}`);
  }
  return o;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  (async () => {
    const o = parseArgs(process.argv.slice(2));
    if (!o.pipeline || !o.file) throw new Error('usage: upload-raw.mjs --pipeline <name> --file <path> [--run-time ISO] [--backfill] [--dry-run]');
    const hasCreds = !!(process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID);
    if (!o.dry_run && !hasCreds) throw new Error('CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must be set (GitHub secrets in Actions)');
    // A dry run without credentials only shows the keys it would write (it cannot see what is already in the bucket).
    const store = o.dry_run && !hasCreds ? { fetch: async () => null, put: async () => {} } : wranglerStore({ run: wranglerRunner() });
    const res = await archiveFile(store, { pipeline: o.pipeline, file: o.file, runTime: o.run_time, backfill: !!o.backfill, dryRun: !!o.dry_run });
    console.log(JSON.stringify(res));
  })().catch((e) => { console.error(`RAW UPLOAD FAILED: ${e.message}`); process.exit(1); });
}
