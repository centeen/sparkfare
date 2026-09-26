import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

// nav-auth.js is a classic browser script (top-level function declarations, no exports), so it is
// evaluated in a vm sandbox with a minimal fake DOM. This covers the logic that decides whether a
// signed-in visitor sees "Sign out" on the high-traffic content pages (/blog/*, /data/*), and that
// anonymous visitors do NOT pay for downloading Clerk just to relabel one link.

const navAuthSource = fs.readFileSync(new URL('../nav-auth.js', import.meta.url), 'utf8');

function makeSandbox({ cookie = '', loadClerkLightResult = null } = {}) {
  const link = {
    textContent: 'Sign in',
    href: '/sign-in',
    style: {},
    attrs: { href: '/sign-in' },
    listeners: {},
    removeAttribute(name) { delete this.attrs[name]; if (name === 'href') this.href = null; },
    addEventListener(type, fn) { this.listeners[type] = fn; },
  };
  const calls = { loadClerkLight: 0 };
  const context = {
    document: { cookie, getElementById: (id) => (id === 'sign-in-nav-link' ? link : null) },
    window: { location: { pathname: '/blog/how-we-rank-deals', search: '' } },
    encodeURIComponent,
  };
  vm.createContext(context);
  vm.runInContext(navAuthSource, context);
  if (loadClerkLightResult !== undefined) {
    // Replace the real loader (which appends a <script> tag) with a stub, exactly as it would
    // resolve in a browser: a Clerk object, or null on failure.
    context.loadClerkLight = () => { calls.loadClerkLight += 1; return Promise.resolve(loadClerkLightResult); };
  }
  return { context, link, calls };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test('hasClerkSessionHint: signed-out and empty cookies are not a hint', () => {
  for (const cookie of ['', 'other=1', '__client_uat=0', '__client_uat=0; __client_uat_TrxutjDg=0', '__client_uat=']) {
    const { context } = makeSandbox({ cookie });
    assert.equal(context.hasClerkSessionHint(), false, `cookie "${cookie}"`);
  }
});

test('hasClerkSessionHint: a signed-in __client_uat (plain or suffixed) or a __session is a hint', () => {
  for (const cookie of [
    '__client_uat=1780000000',
    '__client_uat=0; __client_uat_TrxutjDg=1780000000',
    'a=b; __session=eyJhbGciOi',
    'a=b; __session_TrxutjDg=eyJhbGciOi',
  ]) {
    const { context } = makeSandbox({ cookie });
    assert.equal(context.hasClerkSessionHint(), true, `cookie "${cookie}"`);
  }
});

test('syncNavAuthStateLazy: anonymous visitor never loads Clerk and gets a redirect_to sign-in link', async () => {
  const { context, link, calls } = makeSandbox({ cookie: '__client_uat=0' });
  context.syncNavAuthStateLazy();
  await tick();
  assert.equal(calls.loadClerkLight, 0, 'Clerk must not be downloaded for an anonymous visitor');
  assert.equal(link.textContent, 'Sign in');
  assert.equal(link.href, '/sign-in?redirect_to=%2Fblog%2Fhow-we-rank-deals');
});

test('syncNavAuthStateLazy: signed-in visitor loads Clerk and sees "Sign out" wired to signOut', async () => {
  let signedOut = false;
  const clerk = { session: { id: 's' }, signOut: async () => { signedOut = true; } };
  const { context, link, calls } = makeSandbox({ cookie: '__client_uat=1780000000', loadClerkLightResult: clerk });
  // The click handler reloads the page after signing out; give it somewhere to do that.
  context.window.location.reload = () => {};
  context.syncNavAuthStateLazy();
  await tick();
  assert.equal(calls.loadClerkLight, 1);
  assert.equal(link.textContent, 'Sign out');
  assert.equal(link.href, null);
  await link.listeners.click({ preventDefault() {} });
  assert.equal(signedOut, true);
});

test('syncNavAuthStateLazy: a stale cookie with no real Clerk session falls back to "Sign in"', async () => {
  const { context, link } = makeSandbox({ cookie: '__client_uat=1780000000', loadClerkLightResult: { session: null } });
  context.syncNavAuthStateLazy();
  await tick();
  assert.equal(link.textContent, 'Sign in');
  assert.match(link.href, /^\/sign-in\?redirect_to=/);
});

test('syncNavAuthStateLazy: if Clerk fails to load, the visitor still gets a working sign-in link', async () => {
  const { context, link } = makeSandbox({ cookie: '__client_uat=1780000000', loadClerkLightResult: null });
  context.syncNavAuthStateLazy();
  await tick();
  assert.equal(link.textContent, 'Sign in');
  assert.match(link.href, /^\/sign-in\?redirect_to=/);
});

// Regression guard: every content page must carry the hook. A new blog post copied from an old
// template, or a pSEO generator change, that drops it would silently bring the "Sign in shown to a
// signed-in user" bug back on that page.
function pagesIn(dir) {
  return fs.readdirSync(new URL(`../${dir}/`, import.meta.url))
    .filter((f) => f.endsWith('.html'))
    .map((f) => path.join(dir, f));
}

for (const dir of ['blog', 'data']) {
  test(`every ${dir}/*.html page has the nav-auth hook`, () => {
    const pages = pagesIn(dir);
    assert.ok(pages.length > 0);
    const missing = pages.filter((p) => {
      const html = fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
      return !(
        html.includes('id="sign-in-nav-link"') &&
        html.includes('<script src="/nav-auth.js"></script>') &&
        html.includes('syncNavAuthStateLazy()')
      );
    });
    assert.deepEqual(missing, [], `pages missing the nav-auth hook: ${missing.slice(0, 5).join(', ')}`);
  });
}

test('the pSEO generator templates emit the nav-auth hook', () => {
  const src = fs.readFileSync(new URL('../Phase 17 pSEO Generator (Step 106).py', import.meta.url), 'utf8');
  assert.equal((src.match(/id="sign-in-nav-link"/g) || []).length, 2, 'both templates (route page + listing page)');
  assert.equal((src.match(/syncNavAuthStateLazy\(\)/g) || []).length, 2);
});
