// Addendum M, M1: writes the Day-14 baseline to docs/metrics/baseline_<date>.md from /admin/growth/data.
//
// Run it in your own terminal (the admin secret is read from the environment and never printed or written):
//   ADMIN_SECRET=... node scripts/growth-baseline.mjs --visits 1234
// Options: --visits N (from the Cloudflare dashboard; omit if unknown), --url https://sparkfare.com, --out path, --date YYYY-MM-DD.
// The Hub copies the file into the council project's state_METRICS.md. Counts only; no personal data.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { growthToMarkdown } from '../src/growth.js';

export async function buildBaseline({ fetchImpl = fetch, base = 'https://sparkfare.com', secret, visits = null, date = new Date().toISOString().slice(0, 10) }) {
  if (!secret) throw new Error('Set ADMIN_SECRET in the environment.');
  const res = await fetchImpl(`${base}/admin/growth/data`, { headers: { Authorization: `Bearer ${secret}` } });
  if (res.status === 401) throw new Error('The admin secret was refused.');
  if (!res.ok) throw new Error(`Growth data request failed: ${res.status}`);
  const body = await res.json();
  if (!body.ok) throw new Error('Growth data request returned an error.');
  return { date, markdown: growthToMarkdown(body.growth, { title: `Growth baseline ${date}`, visits }) };
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const visitsArg = arg('visits');
  const { date, markdown } = await buildBaseline({
    base: arg('url') || 'https://sparkfare.com',
    secret: process.env.ADMIN_SECRET,
    visits: visitsArg == null ? null : Number(visitsArg),
    date: arg('date'),
  });
  const out = arg('out') || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'metrics', `baseline_${date}.md`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, markdown);
  console.log(`Wrote ${out}`);
}
