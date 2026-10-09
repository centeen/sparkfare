// /hub told signed-in users "Please sign in to view." because its fetch sent no Authorization header and the
// API only accepts a Clerk bearer token. These tests run the page's real inline script against a fake Clerk.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../hub.html', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const inline = scripts.find((s) => s.includes('loadStatus'));

function run({ clerk, fetchImpl }) {
  const els = {};
  const el = (id) => (els[id] ||= { value: '', textContent: '', innerHTML: '', classList: { add() { this.added = true; }, contains() { return !!this.added; } }, querySelector: () => ({ textContent: '' }), addEventListener() {}, select() {} });
  const calls = [];
  const sandbox = {
    document: { getElementById: el },
    fetch: async (url, opts) => { calls.push({ url, auth: opts?.headers?.Authorization }); return fetchImpl(url, opts); },
    loadClerkLight: async () => clerk,
    syncNavAuthState() {},
    setTimeout,
  };
  vm.createContext(sandbox);
  vm.runInContext(inline, sandbox);
  return { els, calls, done: new Promise((r) => setTimeout(r, 20)) };
}

const ok = (body) => new Response(JSON.stringify(body), { status: 200 });

test('signed in: sends the Clerk bearer token and shows the invite link', async () => {
  const { els, calls, done } = run({
    clerk: { session: { getToken: async () => 'TOKEN123' } },
    fetchImpl: () => ok({ ok: true, link: 'https://sparkfare.com/r/ref_abc', entitlements: { confirmedReferrals: 3 } }),
  });
  await done;
  assert.deepEqual(calls, [{ url: '/api/referrals/status', auth: 'Bearer TOKEN123' }]);
  assert.equal(els['ref-link'].value, 'https://sparkfare.com/r/ref_abc');
  assert.equal(els['ref-count'].textContent, 3);
});

test('signed out: asks to sign in, with a link, and makes no API call', async () => {
  const { els, calls, done } = run({ clerk: { session: null }, fetchImpl: () => ok({}) });
  await done;
  assert.equal(calls.length, 0);
  assert.equal(els['ref-link'].value, 'Please sign in to view.');
  assert.match(els['copy-status'].innerHTML, /href="\/sign-in\?redirect_to=%2Fhub"/);
});

test('signed in but the API fails: does not tell a signed-in person to sign in', async () => {
  const { els, done } = run({
    clerk: { session: { getToken: async () => 'T' } },
    fetchImpl: () => new Response('x', { status: 500 }),
  });
  await done;
  assert.doesNotMatch(els['ref-link'].value, /sign in/i);
  assert.match(els['ref-link'].value, /Could not load/);
});

test('nav-auth.js loads before the inline script that needs loadClerkLight', () => {
  assert.ok(html.indexOf('src="/nav-auth.js"') !== -1 && html.indexOf('src="/nav-auth.js"') < html.indexOf('async function loadStatus'));
});
