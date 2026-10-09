// The /data/ pages are the anonymous SEO landing surface. On 2026-09-19 their email-only signup form was
// replaced by a sign-in button (cc6f0497), which stopped partner_id 'pseo' signups and made the funnel need
// a full account. The form is restored; the secondary sign-in link must use the parameter sign-in.html reads.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const pages = fs.readdirSync(new URL('../data/', import.meta.url)).filter((f) => f.endsWith('.html') && f !== 'index.html');

test('sign-in.html reads redirect_to, so no link may send redirect_url', () => {
  assert.match(read('sign-in.html'), /get\('redirect_to'\)/);
  assert.doesNotMatch(read('Phase 17 pSEO Generator (Step 106).py'), /redirect_url/);
});

test('every /data/ route page has the email signup form, tagged pseo, posting to /api/signup', () => {
  const route = pages.filter((f) => f.includes('-to-'));
  assert.ok(route.length >= 600, `expected 600 route pages, found ${route.length}`);
  const bad = [];
  for (const f of route) {
    const html = read(`data/${f}`);
    const ok = html.includes('<form class="signup-form" id="signup-form"')
      && html.includes('type="email"')
      && html.includes("partner_id: 'pseo'")
      && html.includes("fetch('/api/signup'")
      && html.includes('href="/sign-in?redirect_to=/watchlists"')
      && !html.includes('redirect_url');
    if (!ok) bad.push(f);
  }
  assert.deepEqual(bad.slice(0, 5), [], `${bad.length} pages missing the form or using redirect_url`);
});

test('each page preselects its own origin and offers all 15 marketed origins, never TLV', () => {
  const html = read('data/lax-to-lisbon-portugal.html');
  assert.match(html, /<option value="LAX" selected>/);
  assert.equal((html.match(/<option value="[A-Z]{3}"/g) || []).length, 15);
  assert.doesNotMatch(html, /value="TLV"/);
  assert.match(html, /new Set\(\['JFK','LAX'/);
});
