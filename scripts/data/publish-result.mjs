// N2 (Addendum N, ROADMAP step 150): record what the validation gate decided, next to the raw object it judged.
//   raw/fares/<pipeline>/date=.../run=....result.json     write-once: the gate's result for that run (counts and check ids only)
//   raw/quarantine/<pipeline>/date=.../run=....json        records set aside, with a reason code (only when there are some)
//   state/<pipeline>/latest.json                           mutable pointer the Worker's health check reads (status, age, failed checks)
//   state/<pipeline>/recent.json                           priced-route counts of the last OK runs (the completeness baseline)
// The raw data object and its manifest from N1 are never touched: a correction or a verdict is always a new object.
//
//   node scripts/data/publish-result.mjs get-baseline --pipeline P --out baseline.json
//   node scripts/data/publish-result.mjs publish --pipeline P --store <fetch store> --result result.json [--quarantine q.json] [--stats stats.json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PIPELINES, detectRunTime, stamp, wranglerStore, wranglerRunner } from './upload-raw.mjs';

export const RECENT_KEEP = 14;
const json = (o) => Buffer.from(JSON.stringify(o, null, 2) + '\n');
const readJson = async (store, key) => {
  const b = await store.fetch(key);
  if (!b) return null;
  try { return JSON.parse(b.toString('utf8')); } catch { return null; }
};

export async function getBaseline(store, pipeline) {
  const recent = await readJson(store, `state/${pipeline}/recent.json`);
  return Array.isArray(recent?.priced_counts) ? recent.priced_counts : [];
}

export async function publishResult(store, { pipeline, runTime, result, quarantine = null, stats = null, now = new Date() }) {
  if (!PIPELINES.includes(pipeline)) throw new Error(`unknown pipeline ${pipeline}`);
  const date = runTime.toISOString().slice(0, 10);
  const label = `run=${stamp(runTime)}`;
  const resultKey = `raw/fares/${pipeline}/date=${date}/${label}.result.json`;
  const out = { ...result, run_id: label, run_time: runTime.toISOString(), pipeline };
  if (stats?.started_at) out.fetch_started_at = stats.started_at;
  if (stats?.finished_at) out.fetch_finished_at = stats.finished_at;

  const wrote = [];
  if (!(await store.fetch(resultKey))) { await store.put(resultKey, json(out), 'application/json'); wrote.push(resultKey); }
  if (quarantine?.records?.length) {
    const qKey = `raw/quarantine/${pipeline}/date=${date}/${label}.json`;
    if (!(await store.fetch(qKey))) { await store.put(qKey, json({ ...quarantine, run_id: label }), 'application/json'); wrote.push(qKey); }
  }

  const latest = {
    pipeline, run_id: label, status: out.status, run_time: out.run_time, checked_at: out.checked_at,
    published_at: now.toISOString(), failed_checks: out.failed_checks ?? [], priced: out.counts?.priced ?? null,
    calls: out.counts?.calls ?? null, failed_calls: out.counts?.failed ?? null, result_key: resultKey,
  };
  await store.put(`state/${pipeline}/latest.json`, json(latest), 'application/json');

  if (out.status === 'ok' && typeof out.counts?.priced === 'number') {
    const prev = await getBaseline(store, pipeline);
    const counts = [...prev, out.counts.priced].slice(-RECENT_KEEP);
    await store.put(`state/${pipeline}/recent.json`, json({ pipeline, priced_counts: counts, updated_at: now.toISOString() }), 'application/json');
  }
  return { resultKey, wrote, latest };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  (async () => {
    const [cmd, ...rest] = process.argv.slice(2);
    const o = {};
    for (let i = 0; i < rest.length; i += 2) o[rest[i].replace(/^--/, '').replace('-', '_')] = rest[i + 1];
    if (!PIPELINES.includes(o.pipeline)) throw new Error(`--pipeline must be one of ${PIPELINES.join(', ')}`);
    if (!(process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID)) throw new Error('CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must be set');
    const store = wranglerStore({ bucket: 'sparkfare-raw', run: wranglerRunner() });
    if (cmd === 'get-baseline') {
      let counts = [];
      try { counts = await getBaseline(store, o.pipeline); } catch (e) { console.error(`baseline unavailable (${e.message}); the completeness check will be skipped`); }
      fs.writeFileSync(o.out, JSON.stringify(counts));
      console.log(JSON.stringify({ baseline_points: counts.length }));
    } else if (cmd === 'publish') {
      const storeData = JSON.parse(fs.readFileSync(o.store, 'utf8'));
      const runTime = detectRunTime(storeData) ?? new Date();
      const result = JSON.parse(fs.readFileSync(o.result, 'utf8'));
      const quarantine = o.quarantine && fs.existsSync(o.quarantine) ? JSON.parse(fs.readFileSync(o.quarantine, 'utf8')) : null;
      const stats = o.stats && fs.existsSync(o.stats) ? JSON.parse(fs.readFileSync(o.stats, 'utf8')) : null;
      const r = await publishResult(store, { pipeline: o.pipeline, runTime, result, quarantine, stats });
      console.log(JSON.stringify({ status: r.latest.status, wrote: r.wrote }));
    } else {
      throw new Error('usage: publish-result.mjs get-baseline|publish --pipeline P ...');
    }
  })().catch((e) => { console.error(`PUBLISH RESULT FAILED: ${e.message}`); process.exit(1); });
}
