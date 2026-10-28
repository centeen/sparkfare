// Addendum N, N14 (DR, Framework): serve the three ranked-deals files from R2 instead of from the deploy, DARK behind ENABLE_R2_SERVING ("false").
//
// Why: every bot data commit deploys the whole Worker (about eight a day), so data and code ship together. With the files in R2 a data update is an object write and
// a deploy carries code only. Today both paths are live: the workflows commit the files to git (the source of truth, unchanged) AND publish each validated file to R2.
//
//   R2 layout (private bucket sparkfare-raw):
//     serving/<file>/latest.json      the newest validated copy; this is what the Worker reads (one get)
//     serving/<file>/v/<stamp>.json   an immutable copy per publish; the last 30 are kept for rollback
//     serving/<file>/versions.json    the index of those 30 (key, sha256, bytes, published_at)
//
// Flag off: /sparkfare_*_ranked_deals.json answer exactly as before (the asset, through the ASSETS binding). Flag on: the R2 copy answers, and if it is missing or R2
// errors the asset answers instead, so a bucket problem can never make the board empty. Rollback is one flag flip.
export const R2_SERVED_FILES = ['sparkfare_ranked_deals.json', 'sparkfare_ranked_deals_other_origins.json', 'sparkfare_hourly_ranked_deals.json'];
export const R2_SERVED_PATHS = R2_SERVED_FILES.map((f) => `/${f}`);

export const r2ServingEnabled = (env) => env?.ENABLE_R2_SERVING === 'true' && Boolean(env?.RAW);
export const latestKey = (file) => `serving/${file}/latest.json`;
export const versionKey = (file, stamp) => `serving/${file}/v/${stamp}.json`;
export const indexKey = (file) => `serving/${file}/versions.json`;

/** The bytes of the newest validated copy, or null (not there, or R2 failed). Never throws. */
export async function readLatestFromR2(env, file) {
  if (!r2ServingEnabled(env) || !R2_SERVED_FILES.includes(file)) return null;
  try {
    const object = await env.RAW.get(latestKey(file));
    if (!object) return null;
    return await object.arrayBuffer();
  } catch (error) {
    console.error(`R2 serving: could not read ${file}, using the deployed asset:`, error?.message || error);
    return null;
  }
}

/** The request for one of the served paths. Flag off, or any problem with R2: exactly what the asset binding returns. */
export async function serveRankedFile(request, env) {
  const file = new URL(request.url).pathname.slice(1);
  if (r2ServingEnabled(env) && (request.method === 'GET' || request.method === 'HEAD')) {
    const bytes = await readLatestFromR2(env, file);
    if (bytes) {
      return new Response(request.method === 'HEAD' ? null : bytes, {
        status: 200,
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-sparkfare-data-source': 'r2' },
      });
    }
  }
  return env.ASSETS.fetch(request);
}

/** Parsed JSON of a served file, from R2 when serving from R2 is on and the copy exists, otherwise from the deployed asset. Throws like a failed fetch does. */
export async function servedJson(env, file) {
  const bytes = await readLatestFromR2(env, file);
  if (bytes) return JSON.parse(new TextDecoder().decode(bytes));
  const res = await env.ASSETS.fetch(new Request(`https://assets.local/${file}`));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
