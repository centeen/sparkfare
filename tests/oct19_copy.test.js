// The unflagged copy pass held for Oct 19 (owner request 2026-10-13, after Addendum A's audit): the commission line says
// "if you buy through", My Trips no longer talks about booking, Away Mode's label does not say "book", the privacy policy
// names the analytics beacon, and there is an About page with a real contact. None of it changes behaviour.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').split('\r\n').join('\n');
const textOf = (html) => html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('the commission line never says Sparkfare earns on something "booked through" its links', () => {
  const files = ['widget.html', 'Phase 17 pSEO Generator (Step 106).py'];
  for (const f of fs.readdirSync(path.join(ROOT, 'blog'))) if (f.endsWith('.html')) files.push(`blog/${f}`);
  const bad = files.filter((f) => /commission on (flights|services)[^.]{0,40}booked through/i.test(read(f)));
  assert.deepEqual(bad, []);
  assert.match(read('Phase 17 pSEO Generator (Step 106).py'), /may earn a commission if you buy through our links, at no extra cost to you\./);
  assert.match(read('widget.html'), /may earn a commission if you buy through emailed links/);
});

test('My Trips describes clicks to the booking partner and a reported purchase, not a booking', () => {
  const html = read('trips.html');
  assert.match(html, /clicked through, tracked here/);
  assert.doesNotMatch(html, /clicked through to book/);
  assert.match(html, /'Purchase reported' : 'Clicked'/);
  assert.doesNotMatch(html, /'Booked'/);
  assert.doesNotMatch(html, /<meta name="description"[^>]*booked trips/);
});

test('the Away Mode activities label does not use the word book', () => {
  assert.match(read('away-mode.html'), /Looking for tours or attractions\?/);
  assert.doesNotMatch(read('away-mode.html'), /Want to book/);
});

test('the privacy policy names Cloudflare Web Analytics and keeps it apart from accounts', () => {
  const t = textOf(read('privacy.html'));
  assert.match(t, /Cloudflare Web Analytics/);
  assert.match(t, /does not combine it with your account or email address/);
});

test('About page: real contact, canonical, in the sitemap, linked from privacy and disclosure, and its counts are true', () => {
  const html = read('about.html');
  const t = textOf(html);
  assert.match(html, /<title>About Sparkfare<\/title>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/sparkfare\.com\/about">/);
  assert.match(html, /href="mailto:hello@sparkfare\.com"/);
  assert.match(t, /doesn't sell, book, ticket, arrange or take payment for travel/);
  assert.doesNotMatch(t, /real-time|live (prices|fares)|guarantee|predict(s|ion)? (the|a) /i);
  assert.match(read('sitemap.xml'), /<loc>https:\/\/sparkfare\.com\/about<\/loc>/);
  // K-B1: About moved from the header to the sitewide footer, which every page loads.
  assert.match(read('site-footer.js'), /\['About', '\/about'\]/);
  for (const p of ['privacy.html', 'disclosure.html']) assert.match(read(p), /<script src="\/site-footer\.js"/);

  // "880 routes: 22 US hubs and 40 destinations" must stay equal to the real list (the homepage test uses the same source).
  const fetched = read('.github/workflows/hourly-multi-origin-fetch.yml').match(/'schedule' && '([^']+)'/)[1].split(',').filter((o) => o !== 'TLV');
  const destinations = Object.keys(JSON.parse(read('sparkfare_destinations.json'))).length;
  assert.match(t, new RegExp(`tracks ${fetched.length * destinations} routes: ${fetched.length} US hubs and ${destinations} destinations`));
});

test('About page links resolve to real pages', () => {
  const html = read('about.html');
  for (const href of [...html.matchAll(/<a href="(\/[^"#?]*)"/g)].map((m) => m[1])) {
    if (href === '/' ) continue;
    const candidates = [`${href.replace(/^\//, '')}.html`, `${href.replace(/^\//, '')}/index.html`, href.replace(/^\//, '')];
    const worker = ['/away-mode', '/check', '/watchlists', '/hub', '/trips', '/account', '/sign-in', '/data/', '/blog/', '/time-off'];
    const ok = candidates.some((c) => fs.existsSync(path.join(ROOT, c))) || worker.includes(href);
    assert.ok(ok, `${href} has no page`);
  }
});
