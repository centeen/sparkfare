// The blog index fetched '/data/sparkfare_ranked_deals.json' for weeks: the file lives at
// '/sparkfare_ranked_deals.json', so the request 404ed, nothing was ever filled in, and the 48 cards
// kept an empty dark gradient over their photo. A static page that fetches a JSON file must point at one
// that exists.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');

function pages() {
  const out = [];
  for (const f of fs.readdirSync(root)) if (f.endsWith('.html') && !f.startsWith('google')) out.push({ rel: f, dir: '/' });
  for (const d of ['blog', 'data']) {
    for (const f of fs.readdirSync(path.join(root, d))) if (f.endsWith('.html')) out.push({ rel: `${d}/${f}`, dir: `/${d}/` });
  }
  return out;
}

test('every literal fetch of a .json file in a static page points at a file that exists', () => {
  const missing = [];
  let checked = 0;
  for (const { rel, dir } of pages()) {
    const html = fs.readFileSync(path.join(root, rel), 'utf8');
    for (const m of html.matchAll(/fetch\(\s*(['"`])([^'"`$?{]+\.json)\1/g)) {
      checked++;
      const url = new URL(m[2], `https://sparkfare.com${dir}`);
      if (!fs.existsSync(path.join(root, decodeURIComponent(url.pathname)))) missing.push(`${rel} fetches ${m[2]} (resolves to ${url.pathname})`);
    }
  }
  assert.ok(checked >= 5, `expected to find the homepage's data fetches, found ${checked}`);
  assert.deepEqual(missing, []);
});

test('blog index: no empty price overlay is drawn, and nothing requests the old wrong path', () => {
  const html = fs.readFileSync(path.join(root, 'blog/index.html'), 'utf8');
  assert.doesNotMatch(html, /\/data\/sparkfare_ranked_deals\.json/);
  assert.doesNotMatch(html, /loadLivePrices/);
  assert.match(html, /\.price-overlay:empty\s*\{\s*display:\s*none;?\s*\}/);
  // The markup still has the (now always empty) overlay divs; none of them carries text.
  const overlays = [...html.matchAll(/<div class="price-overlay"[^>]*>([^<]*)<\/div>/g)];
  assert.ok(overlays.length >= 40);
  assert.ok(overlays.every((m) => m[1].trim() === ''));
});
