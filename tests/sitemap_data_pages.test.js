// Every /data/ URL in sitemap.xml must have a generated page behind it. Task B of step 76 added 120 sitemap entries for
// PHL, MSP and CLT but the 120 new pages were left untracked (`git add -u` skips new files), so they merged as 404s.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), 'utf8');

test('every /data/ URL in sitemap.xml has a page file', () => {
  const urls = [...read('sitemap.xml').matchAll(/<loc>https:\/\/sparkfare\.com\/data\/([^<\/]+)<\/loc>/g)].map((m) => m[1]);
  assert.ok(urls.length >= 600, `expected the route pages in the sitemap, found ${urls.length}`);
  const missing = urls.filter((slug) => !fs.existsSync(fileURLToPath(new URL(`data/${slug}.html`, root))));
  assert.deepEqual(missing.slice(0, 10), [], `${missing.length} sitemap URLs have no page`);
});
