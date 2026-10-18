// K-B1 (ROADMAP step 123): one header on every page, generator and Worker template.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import worker from '../src/index.js';
import { SITE_NAV_HTML, siteNavHtml } from '../src/siteHeader.js';
import { renderTimeOffOrigin } from '../src/ptoPages.js';

const root = new URL('../', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), 'utf8');
const norm = (s) => s.replace(/\r\n/g, '\n');
const NAV = norm(SITE_NAV_HTML);
const tracked = execFileSync('git', ['ls-files', '*.html'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
const NAV_RE = /<nav class="site-nav[^"]*"[^>]*>[\s\S]*?<\/nav>\s*<link rel="stylesheet" href="\/brand\/header\.css">\s*<script src="\/brand\/header\.js"><\/script>/;

test('every static page with a site nav carries exactly the shared header', () => {
  const pages = tracked.filter((f) => read(f).includes('class="site-nav'));
  assert.ok(pages.length > 900, 'expected hundreds of pages, found ' + pages.length);
  const wrong = [];
  for (const f of pages) {
    const m = norm(read(f)).match(NAV_RE);
    if (!m || m[0] !== NAV) wrong.push(f);
  }
  assert.deepEqual(wrong, []);
});

test('the header has the K-B1 primary links, the account menu, one Menu button, and no leftover old nav', () => {
  const hrefs = [...NAV.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(hrefs, ['/', '/', '/check', '/time-off', '/away-mode', '/data/', '/watchlists', '/trips', '/account', '/sign-in', '/brand/header.css']);
  assert.equal((NAV.match(/class="sf-menu-btn"/g) || []).length, 1);
  assert.match(NAV, /aria-expanded="false" aria-controls="sf-menu"/);
  assert.match(NAV, /id="sign-in-nav-link"/);
  assert.match(NAV, /class="sf-account-menu sf-signed-in-only" hidden/);
  for (const f of tracked.filter((x) => read(x).includes('class="site-nav'))) {
    assert.equal((read(f).match(/<nav class="site-nav/g) || []).length, 1, f);
    assert.doesNotMatch(read(f), /class="mobile-menu-btn"/, f);
  }
});

test('the generators and the Worker templates use the shared header, not their own copy', () => {
  for (const f of ['Phase 17 pSEO Generator (Step 106).py', 'Phase 20 Blog Generator.py']) {
    const py = read(f);
    assert.doesNotMatch(py, /<nav class="site-nav/, f);
    assert.match(py, /SITE_NAV_HTML = open\(.*brand.*header\.html/, f);
    assert.ok(py.includes('{SITE_NAV_HTML}'), f);
  }
  assert.equal(norm(read('brand/header.html')), NAV + '\n', 'brand/header.html is generated from src/siteHeader.js');
  for (const f of ['src/index.js', 'src/ptoPages.js']) assert.doesNotMatch(read(f), /<nav class="site-nav/, f);
  const pto = renderTimeOffOrigin({ origin: 'DEN', budget: 10, keys: undefined, now: new Date('2026-10-12T08:00:00Z'), appUrl: 'https://sparkfare.com' });
  assert.ok(norm(pto).includes(NAV), '/time-off pages carry the shared header');
});

test('a Worker route page carries the shared header; the Leave-by plan link appears only with its flag', async () => {
  const env = { ASSETS: { fetch: async () => ({ ok: true, json: async () => ({ deals: [{ origin: 'JFK', display_name: 'Paris, France', price: 400, observations: [] }], featured: [], priced_no_deal: [] }) }) } };
  const off = norm(await (await worker.fetch(new Request('https://sparkfare.com/flight/JFK/Paris%2C%20France'), env, { waitUntil() {} })).text());
  assert.ok(off.includes(NAV));
  assert.doesNotMatch(off, /Leave-by plan/);
  assert.equal(siteNavHtml({ ENABLE_LEAVE_BY_PLAN: 'true' }).includes('<a href="/plan?src=nav">Leave-by plan</a>'), true);
  assert.equal(siteNavHtml({}), SITE_NAV_HTML);
});

test('mobile: header at most 64px, menu collapses behind the button with scripts on, tap targets 44px', () => {
  const css = read('brand/header.css');
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*height: 64px/);
  assert.match(css, /\.sf-js \.sf-menu \{[^}]*display: none/);
  assert.match(css, /\.sf-open \.sf-menu \{ display: flex; \}/);
  assert.match(css, /\.sf-menu-btn \{[^}]*min-height: 44px; min-width: 44px/);
  const js = read('brand/header.js');
  assert.match(js, /aria-expanded/);
  assert.match(js, /Escape/);
});

test('the footer lists Disclosure, Terms, Privacy, Blog, Referrals and About; signing in reveals the account menu', () => {
  const f = read('site-footer.js');
  for (const l of ["['Disclosure', '/disclosure']", "['Terms', '/terms']", "['Privacy', '/privacy']", "['Blog', '/blog/']", "['Referrals', '/hub']", "['About', '/about']"]) assert.ok(f.includes(l), l);
  assert.match(read('nav-auth.js'), /sf-signed-in-only[\s\S]*hidden = false/);
  assert.match(read('index.html'), /sf-signed-in-only[\s\S]*hidden = false/);
});

test('the apply script is idempotent (nothing left to change)', () => {
  const out = execFileSync(process.execPath, ['scripts/apply-shared-header.mjs', '--check'], { cwd: root, encoding: 'utf8' });
  assert.match(out, /0 file\(s\) differ/);
});
