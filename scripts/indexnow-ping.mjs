#!/usr/bin/env node
// Sends the public pages that changed in a commit range to IndexNow (Bing and other participating engines).
// Usage: node scripts/indexnow-ping.mjs <fromSha> <toSha> [--dry-run]
// Only pages on the allowlist in src/indexNow.js are sent; the payload is public URLs and the key, nothing else.
import { execFileSync } from 'node:child_process';
import { indexableUrlsFromFiles, pingIndexNow } from '../src/indexNow.js';

const [from, to = 'HEAD'] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const dry = process.argv.includes('--dry-run');
if (!from) { console.error('usage: indexnow-ping.mjs <fromSha> [toSha] [--dry-run]'); process.exit(2); }

const files = execFileSync('git', ['diff', '--name-only', '--diff-filter=AM', from, to], { encoding: 'utf8' }).split('\n').filter(Boolean);
const urls = indexableUrlsFromFiles(files);
console.log(`${files.length} changed files, ${urls.length} public pages on the allowlist`);
if (urls.length === 0) process.exit(0);
if (dry) { console.log(urls.slice(0, 20).join('\n')); process.exit(0); }
const CHUNK = 5000;
for (let i = 0; i < urls.length; i += CHUNK) {
  const res = await pingIndexNow({ urls: urls.slice(i, i + CHUNK) });
  console.log(`IndexNow: ${res.status} ${res.message}`);
  if (!res.ok) process.exit(1);
}
