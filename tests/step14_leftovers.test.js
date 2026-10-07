// ROADMAP step 14 leftovers: shared nav on the Worker-served pages that had none, and the
// Away Mode lead-magnet banner (previously dead code that could never become visible).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import worker from '../src/index.js';

const read = (f) => fs.readFileSync(f, 'utf8');
const navHrefs = (html) => {
  const m = /<nav class="site-nav">([\s\S]*?)<\/nav>/.exec(html);
  assert.ok(m, 'page has no <nav class="site-nav">');
  return [...m[1].matchAll(/href="([^"]+)"/g)].map((x) => x[1]);
};
const CANONICAL = navHrefs(read('away-mode.html'));

test('the canonical nav is the full 10-link set', () => {
  assert.equal(CANONICAL.length, 11); // brand link + 10 destinations incl. sign in and Check a price
  assert.ok(CANONICAL.includes('/hub') && CANONICAL.includes('/sign-in') && CANONICAL.includes('/data/') && CANONICAL.includes('/check'));
});

for (const f of ['hub.html', 'reward-terms.html']) {
  test(`${f} has the same nav as the rest of the site and the signed-in hook`, () => {
    const html = read(f);
    assert.deepEqual(navHrefs(html), CANONICAL);
    assert.match(html, /id="sign-in-nav-link"/);
    assert.match(html, /<script src="\/nav-auth\.js"><\/script><script>syncNavAuthStateLazy\(\);<\/script>/);
  });
}

test('/index (Worker-rendered) has the same nav and the signed-in hook', async () => {
  const env = {
    ASSETS: { fetch: async () => ({ ok: true, json: async () => ({ deals: [], featured: [], priced_no_deal: [] }) }) },
  };
  const res = await worker.fetch(new Request('http://localhost/index'), env);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.deepEqual(navHrefs(html), CANONICAL);
  assert.match(html, /syncNavAuthStateLazy\(\)/);
});

test('lead-magnet banner: hidden until triggered, dismissible, gold-free, and wired to checklist answers', () => {
  const html = read('away-mode.html');
  // hidden (and out of the tab order) by default
  assert.match(html, /#lead-magnet-banner \{[^}]*visibility: hidden/);
  // has a real dismiss control with a 44px target, remembered per session, storage guarded
  assert.match(html, /id="lead-magnet-close"[^>]*aria-label="Dismiss"/);
  assert.match(html, /min-width: 44px;\s*min-height: 44px/);
  assert.match(html, /try \{ sessionStorage\.setItem\('sparkfare_lead_magnet_dismissed'/);
  // shown from BOTH the Yes and No handlers (previously nothing ever added .visible)
  const calls = html.match(/showLeadMagnet\(\);/g) || [];
  assert.ok(calls.length >= 2, `expected showLeadMagnet() in the Yes and No handlers, found ${calls.length}`);
  // page gets bottom padding while shown, so it cannot cover the last card
  assert.match(html, /document\.body\.style\.paddingBottom = leadMagnet\.offsetHeight/);
  // gold is reserved for deal signals; the CTA must not use the old #FFC107
  const ctaRules = [...html.matchAll(/\.lead-magnet-cta \{([^}]*)\}/g)].map((m) => m[1]).join(' ');
  assert.ok(ctaRules, 'lead-magnet CTA rule not found');
  assert.ok(!/#FFC107|#E8B930/i.test(ctaRules), 'the lead-magnet CTA must not use gold');
  assert.match(ctaRules, /var\(--sage\)/);
  // never for signed-in users
  assert.match(html, /if \(isUserSignedIn \|\| leadMagnetDismissed\(\)\) return;/);
});
