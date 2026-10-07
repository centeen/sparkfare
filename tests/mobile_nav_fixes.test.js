import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import worker from '../src/index.js';

const obs = (n) => Array(n).fill(0).map((_, i) => ({ price: 350 + i, date: new Date(Date.now() - (n - 1 - i) * 86400000).toISOString() }));
const env = {
  ASSETS: { fetch: async (req) => (req.url.includes('sparkfare_ranked_deals')
    ? { ok: true, json: async () => ({ deals: [{ origin: 'JFK', display_name: 'Paris, France', price: 350, observations: obs(15) }], featured: [], priced_no_deal: [] }) }
    : { ok: true, json: async () => ({}) }) },
};

test('route page carries the site nav, the sign-in hook, and a wrapping nav row', async () => {
  const res = await worker.fetch(new Request('https://sparkfare.com/flight/JFK/' + encodeURIComponent('Paris, France')), env);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /<nav class="site-nav">/);
  for (const href of ['/away-mode', '/blog/', '/data/', '/watchlists', '/hub', '/trips', '/account', '/privacy', '/sign-in']) {
    assert.ok(html.includes(`href="${href}"`), `nav missing ${href}`);
  }
  assert.match(html, /id="sign-in-nav-link"/);
  assert.match(html, /syncNavAuthStateLazy\(\)/);
  assert.match(html, /\.site-nav \{[^}]*flex-wrap: wrap/);
});

test('every .site-nav rule in the pSEO generator wraps, so no nav overflows a phone', () => {
  const src = fs.readFileSync('Phase 17 pSEO Generator (Step 106).py', 'utf8');
  const rules = src.match(/\.site-nav \{\{[^}]*\}\}/g) || [];
  assert.ok(rules.length >= 2, 'expected both generator templates to define .site-nav');
  for (const r of rules) assert.match(r, /flex-wrap: wrap/, r);
});

test('the generated /data/ listing wraps its nav', () => {
  const html = fs.readFileSync('data/index.html', 'utf8');
  assert.match(html, /\.site-nav \{[^}]*flex-wrap: wrap/);
});
