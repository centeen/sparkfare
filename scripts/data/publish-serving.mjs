// N14 (Addendum N, ROADMAP step 161): publish the validated ranked-deals files to R2 next to the git commit, so the Worker can serve them without a deploy.
//   serving/<file>/latest.json       the newest validated copy (what the Worker reads when ENABLE_R2_SERVING is on)
//   serving/<file>/v/<stamp>.json    one immutable copy per publish; the last 30 are kept
//   serving/<file>/versions.json     the index of those versions
// A file is published only if it parses, carries generated_at and the deal lists, and differs from the current latest. Run AFTER the validation gate and the git commit,
// never instead of them. Rollback: `rollback --file F --version <stamp>` copies an old version back to latest (or just set ENABLE_R2_SERVING to "false").
//
//   node scripts/data/publish-serving.mjs publish --files a.json,b.json
//   node scripts/data/publish-serving.mjs rollback --file a.json --version 20261101T110000Z
//   node scripts/data/publish-serving.mjs versions --file a.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { wranglerStore, wranglerRunner, sha256, BUCKET } from './upload-raw.mjs';

export const SERVED_FILES = ['sparkfare_ranked_deals.json', 'sparkfare_ranked_deals_other_origins.json', 'sparkfare_hourly_ranked_deals.json'];
export const KEEP_VERSIONS = 30;
export const latestKey = (file) => `serving/${file}/latest.json`;
export const versionKey = (file, stamp) => `serving/${file}/v/${stamp}.json`;
export const indexKey = (file) => `serving/${file}/versions.json`;
export const stampOf = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');

/** Throws unless the bytes are a servable ranked-deals file. */
export function validateServable(bytes, file) {
  let data;
  try { data = JSON.parse(bytes.toString('utf8')); } catch { throw new Error(`${file} is not valid JSON`); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(`${file} is not a ranked-deals object`);
  if (!data.generated_at || Number.isNaN(Date.parse(data.generated_at))) throw new Error(`${file} has no generated_at`);
  if (!Array.isArray(data.deals) || !Array.isArray(data.featured)) throw new Error(`${file} has no deals / featured lists`);
  return data;
}

const readIndex = async (store, file) => {
  const b = await store.fetch(indexKey(file));
  if (!b) return [];
  try { const v = JSON.parse(b.toString('utf8')); return Array.isArray(v) ? v : []; } catch { return []; }
};

/** Publish one file's bytes. Returns { status: 'published' | 'unchanged', version?, pruned }. */
export async function publishFile(store, { file, bytes, now = new Date() }) {
  if (!SERVED_FILES.includes(file)) throw new Error(`${file} is not a served file`);
  validateServable(bytes, file);
  const sha = sha256(bytes);
  const index = await readIndex(store, file);
  if (index.length && index[index.length - 1].sha256 === sha) {
    // Same content as the newest version. Make sure latest.json really holds it (a half-finished earlier publish), otherwise nothing to do.
    const current = await store.fetch(latestKey(file));
    if (current && sha256(current) === sha) return { status: 'unchanged', pruned: [] };
  }
  const stamp = stampOf(now);
  const vKey = versionKey(file, stamp);
  // Order matters: the immutable copy first, then latest (what visitors get), then the index. A failure in between leaves the previous latest in place.
  await store.put(vKey, bytes, 'application/json');
  await store.put(latestKey(file), bytes, 'application/json');
  const next = [...index.filter((v) => v.key !== vKey), { key: vKey, version: stamp, sha256: sha, bytes: bytes.length, published_at: now.toISOString() }];
  const pruned = next.length > KEEP_VERSIONS ? next.splice(0, next.length - KEEP_VERSIONS) : [];
  await store.put(indexKey(file), Buffer.from(JSON.stringify(next, null, 2) + '\n'), 'application/json');
  for (const old of pruned) await store.delete(old.key);
  return { status: 'published', version: stamp, pruned: pruned.map((p) => p.key) };
}

/** Make an older version the latest again. The index is left as it is (a rollback is a new publish of old bytes, not a deletion of history). */
export async function rollbackFile(store, { file, version }) {
  const bytes = await store.fetch(versionKey(file, version));
  if (!bytes) throw new Error(`no version ${version} of ${file}`);
  validateServable(bytes, file);
  await store.put(latestKey(file), bytes, 'application/json');
  return { status: 'rolled_back', version, sha256: sha256(bytes) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  (async () => {
    const [cmd, ...rest] = process.argv.slice(2);
    const o = {};
    for (let i = 0; i < rest.length; i += 2) o[rest[i].replace(/^--/, '')] = rest[i + 1];
    if (!(process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID)) throw new Error('CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must be set');
    const store = wranglerStore({ bucket: BUCKET, run: wranglerRunner() });
    if (cmd === 'publish') {
      const files = String(o.files || '').split(',').map((s) => s.trim()).filter(Boolean);
      if (!files.length) throw new Error('--files a.json,b.json is required');
      const out = [];
      let failed = 0;
      for (const f of files) {
        try { out.push({ file: f, ...(await publishFile(store, { file: path.basename(f), bytes: fs.readFileSync(f) })) }); }
        catch (e) { failed += 1; out.push({ file: f, status: 'failed', error: e.message }); }
      }
      console.log(JSON.stringify(out));
      if (failed) process.exit(1);
    } else if (cmd === 'rollback') {
      console.log(JSON.stringify(await rollbackFile(store, { file: o.file, version: o.version })));
    } else if (cmd === 'versions') {
      console.log(JSON.stringify(await readIndex(store, o.file), null, 2));
    } else {
      throw new Error('usage: publish-serving.mjs publish --files a,b | rollback --file F --version V | versions --file F');
    }
  })().catch((e) => { console.error(`PUBLISH SERVING FAILED: ${e.message}`); process.exit(1); });
}
