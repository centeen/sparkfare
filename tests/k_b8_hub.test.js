// K-B8 (ROADMAP step 132, scan HUB-1): /hub. Signed-out copy says what signing in gives; no emoji locks (line icons with a text alternative);
// actions are Sage, not amber.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../hub.html', import.meta.url), 'utf8');
const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((x) => x.includes('loadStatus'));

test('no emoji marks: every tier has a line icon with a text alternative, and the page script sets none', () => {
  assert.ok(!/[\u{1F300}-\u{1FAFF}✅\u{1F512}]/u.test(html));
  const marks = html.match(/<span class="tier-status" role="img" aria-label="Locked"><svg [^>]*aria-hidden="true"/g) || [];
  assert.equal(marks.length, 4);
  assert.doesNotMatch(html, /Early Bird/i, 'the early-send tier was retired 2026-10-20');
  assert.match(html, /id="tier-3"[\s\S]*More Watchlist Routes/, 'tier 3 is now the watchlist limit');
});

test('the copy button and the signed-out button are Sage; amber is not used on this page', () => {
  assert.match(html, /button \{\s*padding: 10px 16px; background: var\(--sage\); color: var\(--on-sage\);/);
  const rule = html.match(/\.signed-out \.btn \{([^}]*)\}/)[1];
  assert.match(rule, /background: var\(--sage\); color: var\(--on-sage\)/);
  assert.match(rule, /min-height: 44px/);
  assert.ok(!/var\(--amber\)|#B8720F/i.test(html));
});

test('the referral count line and the link box are hidden before the page knows who is signed in', () => {
  assert.match(html, /<p class="sub" id="count-line" hidden>You have <strong id="ref-count">/);
  assert.match(html, /\[hidden\] \{ display: none !important; \}/);
});

function run(clerk, fetchImpl) {
  const els = {};
  const el = (id) => (els[id] ||= { value: '', textContent: '', innerHTML: '', hidden: undefined, attrs: {}, classList: { add() { this.added = true; } }, setAttribute(k, v) { this.attrs[k] = v; }, querySelector() { return (this.mark ||= { innerHTML: '', attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } }); }, addEventListener() {}, select() {} });
  const sandbox = { document: { getElementById: el }, fetch: async () => fetchImpl(), loadClerkLight: async () => clerk, syncNavAuthState() {}, setTimeout };
  vm.createContext(sandbox);
  vm.runInContext(inline, sandbox);
  return { els, done: new Promise((r) => setTimeout(r, 20)) };
}

test('unlocked tiers swap to a check icon, say "Unlocked", and locked ones stay locked', async () => {
  const { els, done } = run({ session: { getToken: async () => 'T' } },
    () => new Response(JSON.stringify({ ok: true, link: 'x', entitlements: { confirmedReferrals: 3 } }), { status: 200 }));
  await done;
  for (const id of ['tier-1', 'tier-3']) {
    assert.match(els[id].mark.innerHTML, /<svg /);
    assert.equal(els[id].mark.attrs['aria-label'], 'Unlocked');
  }
  for (const id of ['tier-5', 'tier-10']) assert.equal(els[id]?.mark, undefined, `${id} stays locked`);
});
