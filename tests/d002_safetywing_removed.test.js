// D-002 (2026-10-13): the SafetyWing referral link is removed from every surface until ROADMAP Step 19 (insurance-referral
// licensing) is resolved. Educational insurance copy stays. Nothing below may reintroduce a SafetyWing link, name or call
// to action, and the old /out/ and /go/ links in emails already sent must land on /away-mode without logging a click.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import worker from '../src/index.js';
import { AWAY_MODE_PARTNERS, sendStressValveEmail, groupTravelHtml } from '../src/email.js';

const ROOT = path.resolve(process.cwd());
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

// Everything a visitor or a recipient can be shown: static pages, the blog, the Worker and its templates, the preview script.
function renderedFiles() {
  const out = [];
  for (const f of fs.readdirSync(ROOT)) if (f.endsWith('.html')) out.push(f);
  for (const dir of ['blog', 'data']) {
    const d = path.join(ROOT, dir);
    if (fs.existsSync(d)) for (const f of fs.readdirSync(d)) if (f.endsWith('.html')) out.push(`${dir}/${f}`);
  }
  for (const f of fs.readdirSync(path.join(ROOT, 'src'))) {
    if (f.endsWith('.js') || f.endsWith('.html')) out.push(`src/${f}`);
  }
  const tpl = path.join(ROOT, 'src', 'emailTemplates');
  if (fs.existsSync(tpl)) for (const f of fs.readdirSync(tpl)) out.push(`src/emailTemplates/${f}`);
  out.push('scripts/preview-email.mjs', 'Phase 20 Blog Generator.py', 'site-footer.js');
  return out.filter((p) => fs.existsSync(path.join(ROOT, p)));
}

test('migration 0023 blocks SafetyWing with the Step 19 / D-002 reason', () => {
  const sql = read('migrations/0023_safetywing_blocked_legal.sql');
  assert.match(sql, /UPDATE partners/);
  assert.match(sql, /status = 'blocked_legal'/);
  assert.match(sql, /status_reason = 'Step 19 open; D-002'/);
  assert.match(sql, /WHERE slug = 'safetywing'/);
});

test('no rendered page, template or generator contains safetywing.com, "Get covered" or a SafetyWing /out or /go link', () => {
  const bad = [];
  for (const p of renderedFiles()) {
    const s = read(p);
    if (/safetywing\.com/i.test(s)) bad.push(`${p}: safetywing.com`);
    if (/get covered/i.test(s)) bad.push(`${p}: "Get covered"`);
    if (/\/(out|go)\/safetywing/i.test(s)) bad.push(`${p}: /out|/go/safetywing link`);
  }
  assert.deepEqual(bad, []);
});

test('no blog post or page names SafetyWing as a recommendation', () => {
  const bad = [];
  for (const p of renderedFiles().filter((f) => f.endsWith('.html') || f === 'Phase 20 Blog Generator.py')) {
    if (/safetywing/i.test(read(p))) bad.push(p);
  }
  assert.deepEqual(bad, []);
});

test('AWAY_MODE_PARTNERS has no SafetyWing entry and no insurance category', () => {
  assert.equal(AWAY_MODE_PARTNERS.some((p) => p.slug === 'safetywing' || /safetywing/i.test(p.link || '')), false);
  assert.equal(AWAY_MODE_PARTNERS.some((p) => p.category_slug === 'insurance'), false);
});

test('group-travel line is educational and names no partner', () => {
  const html = groupTravelHtml(4);
  assert.match(html, /health insurer/i);
  assert.doesNotMatch(html, /safetywing/i);
  assert.equal(groupTravelHtml(1), '');
});

test('the stress-valve email carries no SafetyWing link or name and keeps its one remaining partner', async () => {
  const original = globalThis.fetch;
  let sent = null;
  globalThis.fetch = async (url, options) => {
    const u = typeof url === 'string' ? url : url.url;
    if (u.includes('api.resend.com/emails')) {
      sent = JSON.parse(options.body);
      return new Response(JSON.stringify({ id: 'fake' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return original(url, options);
  };
  try {
    const r = await sendStressValveEmail(
      { email: 'a@example.com', destination: 'Lisbon, Portugal', departure_at: '2026-12-01T10:00:00Z', trip_id: 't1', passenger_count: 3 },
      { RESEND_API_KEY: 're_test', APP_URL: 'https://sparkfare.com' });
    assert.equal(r.mocked, false);
    assert.doesNotMatch(sent.html, /safetywing/i);
    assert.doesNotMatch(sent.html, /get covered/i);
    assert.match(sent.html, /\/out\/us-global-mail/);
  } finally { globalThis.fetch = original; }
});

function trackingEnv({ status = 'live' } = {}) {
  const calls = [];
  const env = {
    calls,
    DB: {
      prepare: (query) => {
        calls.push(query);
        return {
          bind: () => ({
            first: async () => ({ slug: 'safetywing', status, url_template: 'https://example.invalid/should-never-be-used' }),
            run: async () => ({ success: true }),
          }),
          run: async () => ({ success: true }),
        };
      },
    },
  };
  return env;
}

for (const prefix of ['/out/', '/go/']) {
  for (const status of ['live', 'blocked_legal']) {
    test(`${prefix}safetywing redirects to /away-mode and logs nothing (DB row status: ${status})`, async () => {
      const env = trackingEnv({ status });
      const res = await worker.fetch(new Request(`https://sparkfare.com${prefix}safetywing?src=email_followup&trip_id=abc`), env, { waitUntil: () => {} });
      assert.equal(res.status, 302);
      assert.equal(new URL(res.headers.get('location')).pathname, '/away-mode');
      assert.doesNotMatch(res.headers.get('location'), /safetywing\.com|example\.invalid/);
      assert.equal(env.calls.length, 0, 'no partner lookup and no event insert for a retired slug');
    });
  }
}

test('a blocked_legal partner never renders a link: /api/partners asks for live rows only, and /out refuses', async () => {
  const queries = [];
  const env = {
    DB: {
      prepare: (query) => {
        queries.push(query);
        return {
          all: async () => ({ results: query.includes("WHERE status = 'live'") ? [{ slug: 'bounce', name: 'Bounce', category: 'Luggage', link: 'https://go.bounce.com/x', blurb: 'x' }] : [] }),
          bind: () => ({
            first: async () => ({ slug: 'someone', status: 'blocked_legal', url_template: 'https://partner.example/link' }),
            run: async () => ({ success: true }),
          }),
          run: async () => ({ success: true }),
        };
      },
    },
  };
  const list = await worker.fetch(new Request('https://sparkfare.com/api/partners'), env, { waitUntil: () => {} });
  const body = await list.json();
  assert.ok(queries.some((q) => q.includes("WHERE status = 'live'")));
  assert.deepEqual(body.partners.map((p) => p.slug), ['bounce']);
  const out = await worker.fetch(new Request('https://sparkfare.com/out/someone'), env, { waitUntil: () => {} });
  assert.equal(out.status, 403);
});

test('away-mode.html keeps the insurance prompt as plain text with no buttons, link or partner', () => {
  const html = read('away-mode.html');
  assert.match(html, /ask your health insurer and home insurer what they cover on a long trip/i);
  assert.doesNotMatch(html, /Need travel insurance\?/);
  assert.doesNotMatch(html, /'insurance':\s*'/);
});
