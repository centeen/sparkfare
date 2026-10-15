// D-013 (2026-10-15, Addendum C task C2): Petcube is staged dark. The partner row exists but is hidden; nothing a visitor
// or recipient can see mentions it, and /out/petcube behaves like a retired slug (302 to /away-mode, nothing logged).
// The flip PR (C3) removes these guards deliberately; until then this file must stay green.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import worker from '../src/index.js';
import { makeSqliteD1 } from './helpers/sqliteD1.js';
import { AWAY_MODE_PARTNERS } from '../src/email.js';
import { PARTNER_REGISTRY } from '../src/meters.js';

const ROOT = path.resolve(process.cwd());
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const MIGRATIONS = fs.readdirSync(path.join(ROOT, 'migrations')).filter((f) => f.endsWith('.sql')).sort().map((f) => `migrations/${f}`);

// Everything a visitor or a recipient can be shown. Migrations, tests, docs and the registry/guard in src are not.
function visibleFiles() {
  const out = [];
  for (const f of fs.readdirSync(ROOT)) if (f.endsWith('.html')) out.push(f);
  for (const dir of ['blog', 'data']) {
    const d = path.join(ROOT, dir);
    if (fs.existsSync(d)) for (const f of fs.readdirSync(d)) if (f.endsWith('.html')) out.push(`${dir}/${f}`);
  }
  out.push('src/email.js', 'src/embed.html', 'src/widget.html', 'src/leaveReady.js', 'src/longLeave.js', 'src/ptoPages.js', 'src/interstitial.js',
    'Phase 20 Blog Generator.py', 'site-footer.js', 'long-leave.js', 'nav-auth.js');
  const tpl = path.join(ROOT, 'src', 'emailTemplates');
  if (fs.existsSync(tpl)) for (const f of fs.readdirSync(tpl)) out.push(`src/emailTemplates/${f}`);
  return out.filter((p) => fs.existsSync(path.join(ROOT, p)));
}

test('migration 0025 seeds petcube as a hidden pending row with no stored link and the approved blurb', () => {
  const DB = makeSqliteD1(MIGRATIONS);
  const row = DB.raw.prepare("SELECT * FROM partners WHERE slug = 'petcube'").get();
  assert.ok(row, 'petcube row exists');
  assert.equal(row.status, 'pending');
  assert.equal(row.url_template, '', 'no link is stored before the flip PR');
  assert.equal(row.meter, 'leave');
  assert.equal(row.category_slug, 'pet_care');
  assert.equal(row.attribution, 'none');
  assert.equal(row.commission_note, 'Check in on a pet you leave at home. See them, talk to them and play through the app while you are away.');
  assert.doesNotMatch(row.status_reason || '', /https?:/);
});

test('the live-partner query the site uses never returns petcube', () => {
  const DB = makeSqliteD1(MIGRATIONS);
  const live = DB.raw.prepare("SELECT slug FROM partners WHERE status = 'live'").all().map((r) => r.slug);
  assert.equal(live.includes('petcube'), false);
  assert.ok(live.length >= 13, 'the other live partners are untouched');
});

test('no page, blog post, email template or generator mentions Petcube, and it is not in AWAY_MODE_PARTNERS', () => {
  const bad = visibleFiles().filter((p) => /petcube/i.test(read(p)));
  assert.deepEqual(bad, []);
  assert.equal(AWAY_MODE_PARTNERS.some((p) => p.slug === 'petcube' || /petcube/i.test(p.name || '') || /petcube/i.test(p.link || '')), false);
});

test('disclosure.html does not list Petcube while it is hidden', () => {
  assert.doesNotMatch(read('disclosure.html'), /petcube/i);
});

test('the registry knows petcube as a leave-meter pet-care partner (so F0 can enrich its clicks after the flip)', () => {
  assert.deepEqual(PARTNER_REGISTRY.petcube, { meter: 'leave', category_slug: 'pet_care', attribution: 'none' });
});

function trackingEnv(status) {
  const calls = [];
  return {
    calls,
    DB: {
      prepare: (query) => {
        calls.push(query);
        return {
          all: async () => ({ results: [] }),
          bind: () => ({
            first: async () => ({ slug: 'petcube', status, url_template: 'https://example.invalid/should-never-be-used' }),
            run: async () => ({ success: true }),
          }),
          run: async () => ({ success: true }),
        };
      },
    },
  };
}

for (const prefix of ['/out/', '/go/']) {
  for (const status of ['pending', 'live']) {
    test(`${prefix}petcube redirects to /away-mode and logs nothing (DB row status: ${status})`, async () => {
      const env = trackingEnv(status);
      const res = await worker.fetch(new Request(`https://sparkfare.com${prefix}petcube?src=away_mode&trip_id=abc`), env, { waitUntil: () => {} });
      assert.equal(res.status, 302);
      assert.equal(new URL(res.headers.get('location')).pathname, '/away-mode');
      assert.doesNotMatch(res.headers.get('location'), /example\.invalid|awin/i);
      assert.equal(env.calls.length, 0, 'no partner lookup and no outbound_click event');
    });
  }
}
