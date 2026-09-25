// Manual verification script for the nav "Sign in"/"Sign out" auth-state bug (2026-09-25).
//
// A signed-in user visiting /account (Preferences) still saw "Sign in" in the top nav --
// every page except index.html had a static <a class="sign-in-link"> with no auth-state
// awareness at all, because the 2026-09-14 fix that made index.html's nav correctly swap was
// hand-written directly into that one page and never factored out (see nav-auth.js's own
// header comment for the full root-cause story).
//
// This project has no browser-test harness in its `node --test` suite (tests/*.test.js are
// pure-Node unit tests) and Playwright isn't a committed devDependency -- this script is a
// manual verification tool, not part of `npm test`, per this project's existing precedent for
// pure-frontend rendering checks (see CLAUDE.md's B4/sparkline entry).
//
// Prerequisites:
//   npm install --no-save playwright && npx playwright install chromium
//   (or: run from any environment with a global `playwright` package + Chromium available)
//
// How to run:
//   1. Start a static server from the repo root: python3 -m http.server 8917
//   2. node tests/manual/verify_nav_auth_state.mjs
//
// What it checks, per page (account.html, trips.html, watchlists.html, away-mode.html,
// disclosure.html, privacy.html):
//   - Signed in (mocked Clerk session): #sign-in-nav-link reads "Sign out" with no href.
//   - Signed out, on a public page (away-mode/disclosure/privacy): #sign-in-nav-link still
//     reads "Sign in", with a redirect_to-tagged href (an improvement over the old plain
//     /sign-in href, not just a no-op check).
//   - Signed out, on an auth-gated page (account/trips/watchlists): correctly redirects to
//     /sign-in rather than rendering -- confirms this fix didn't touch that existing gate.

import { chromium } from 'playwright';

const BASE = process.env.NAV_AUTH_TEST_BASE || 'http://127.0.0.1:8917';

const MOCK_CLERK_SIGNED_IN = `
window.Clerk = {
  session: { getToken: async () => 'fake-token' },
  user: { primaryEmailAddress: { emailAddress: 'test@example.com' } },
  load: async () => {},
  signOut: async () => { window.__signOutCalled = true; },
};
`;

const MOCK_CLERK_SIGNED_OUT = `
window.Clerk = {
  session: null,
  user: null,
  load: async () => {},
  signOut: async () => {},
};
`;

const PUBLIC_PAGES = ['/away-mode.html', '/disclosure.html', '/privacy.html'];
const GATED_PAGES = ['/account.html', '/trips.html', '/watchlists.html'];

async function testPage(browser, path, mockScript) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push(String(err)));

  await context.route('**/clerk.sparkfare.com/npm/@clerk/clerk-js@6/dist/clerk.browser.js', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: mockScript })
  );
  await context.route('**/clerk.sparkfare.com/npm/@clerk/ui@1/dist/ui.browser.js', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: '// stub ui bundle' })
  );

  let redirected = false;
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame() && frame.url().includes('/sign-in')) redirected = true;
  });

  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);

  const linkText = await page.locator('#sign-in-nav-link').textContent().catch(() => null);
  const linkHref = await page.locator('#sign-in-nav-link').getAttribute('href').catch(() => null);
  await context.close();
  return { path, linkText, linkHref, redirected, consoleErrors };
}

const browser = await chromium.launch();
let allOk = true;
const record = (ok, label) => { console.log(label + (ok ? ' -> PASS' : ' -> FAIL')); if (!ok) allOk = false; };

console.log('=== Signed in: every page should show "Sign out" with no href ===');
for (const path of [...PUBLIC_PAGES, ...GATED_PAGES]) {
  const r = await testPage(browser, path, MOCK_CLERK_SIGNED_IN);
  const ok = r.linkText?.trim() === 'Sign out' && r.linkHref === null;
  record(ok, `${path}: text="${r.linkText}" href=${r.linkHref}`);
}

console.log('');
console.log('=== Signed out, public pages: "Sign in" with a redirect_to-tagged href ===');
for (const path of PUBLIC_PAGES) {
  const r = await testPage(browser, path, MOCK_CLERK_SIGNED_OUT);
  const ok = r.linkText?.trim() === 'Sign in' && r.linkHref?.startsWith('/sign-in?redirect_to=');
  record(ok, `${path}: text="${r.linkText}" href=${r.linkHref}`);
}

console.log('');
console.log('=== Signed out, gated pages: should redirect to /sign-in (existing behavior, unaffected) ===');
for (const path of GATED_PAGES) {
  const r = await testPage(browser, path, MOCK_CLERK_SIGNED_OUT);
  record(r.redirected, `${path}: redirected=${r.redirected}`);
}

await browser.close();
console.log('');
console.log(allOk ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED');
process.exit(allOk ? 0 : 1);
