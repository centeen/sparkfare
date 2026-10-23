// Package M7: Conversion additions (ROADMAP step 142)
// 1. "See a sample digest" text link on homepage for the selected origin
// 2. /digest/:origin/latest redirects to latest daily edition (or /digest/:origin fallback)
// 3. Signup form records source: 'home'
// 4. Visitors arriving from a thin origin see the empty state plus links to /check and /time-off (plan coverage rule)
// 5. Zero pop-up, exit-intent, or scroll-triggered modals anywhere
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { DatabaseSync } from 'node:sqlite';
import { makeSqliteD1 } from './helpers/sqliteD1.js';
import { archiveEditions, handleDigestRequest } from '../src/digestArchive.js';

const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('homepage markup includes the "See a sample digest" link with correct initial JFK target', () => {
  const html = read('index.html');
  assert.match(html, /<a\s+href="\/digest\/JFK\/latest"\s+id="sample-digest-link"\s+class="sample-digest-link">See a sample digest<\/a>/);
  assert.match(html, /\.sample-digest-wrap\s*\{/);
  assert.match(html, /\.sample-digest-link\s*\{/);
});

test('syncSignupOrigin updates sample-digest-link href dynamically when origin changes', () => {
  const html = read('index.html');
  const a = html.indexOf('function syncSignupOrigin()');
  assert.ok(a > 0, 'syncSignupOrigin must exist');
  const b = html.indexOf('// K-B2: when the chosen airport has no verified deal today', a);
  const fnStr = html.slice(a, b);

  let currentOrigin = 'JFK';
  const elements = {
    origin_iata: { value: '' },
    'signup-origin-label': { textContent: '' },
    'sample-digest-link': { href: '' },
  };

  const sandbox = {
    getSelectedOrigin: () => currentOrigin,
    document: {
      getElementById: (id) => elements[id] || null,
    },
    encodeURIComponent,
  };

  const ctx = vm.createContext(sandbox);
  vm.runInContext(fnStr, ctx);

  // Test default origin (JFK)
  sandbox.syncSignupOrigin();
  assert.equal(elements.origin_iata.value, 'JFK');
  assert.equal(elements['signup-origin-label'].textContent, 'JFK');
  assert.equal(elements['sample-digest-link'].href, '/digest/JFK/latest');

  // Switch to ORD
  currentOrigin = 'ORD';
  sandbox.syncSignupOrigin();
  assert.equal(elements.origin_iata.value, 'ORD');
  assert.equal(elements['signup-origin-label'].textContent, 'ORD');
  assert.equal(elements['sample-digest-link'].href, '/digest/ORD/latest');

  // Switch to AUS (thin origin)
  currentOrigin = 'AUS';
  sandbox.syncSignupOrigin();
  assert.equal(elements.origin_iata.value, 'AUS');
  assert.equal(elements['signup-origin-label'].textContent, 'AUS');
  assert.equal(elements['sample-digest-link'].href, '/digest/AUS/latest');
});

test('/digest/:origin/latest redirects to latest daily edition when editions exist, or /digest/:origin when empty', async () => {
  const MIGRATIONS = ['migrations/0002_partners.sql', 'migrations/0013_events.sql', 'migrations/0014_digest_editions.sql'];
  const db = makeSqliteD1(MIGRATIONS);
  const env = { DB: db, ENABLE_DIGEST_ARCHIVE: 'true' };
  const APP = 'https://sparkfare.com';

  const DAY1 = new Date('2026-09-24T08:00:00Z');
  const DAY2 = new Date('2026-09-25T08:00:00Z');
  const config = async () => ({ appUrl: APP, destinations: {}, tips: [], awayMode: null });

  const dealFor = (origin, now) => ({
    display_name: 'San Jose, Costa Rica', origin, price: 278, status: 'deal', airline: 'B6',
    booking_link: 'https://www.aviasales.com/test',
    departure_at: '2026-10-23T22:35:00-07:00', return_at: '2026-10-25T16:15:00-06:00',
    found_at: new Date(now.getTime() - 3600000).toISOString(), observations: [],
  });

  // Archive Day 1 and Day 2 for LAX only
  await archiveEditions(env, { now: DAY1, loadDeals: async (o) => (o === 'LAX' ? [dealFor('LAX', DAY1)] : []), buildConfig: config });
  await archiveEditions(env, { now: DAY2, loadDeals: async (o) => (o === 'LAX' ? [dealFor('LAX', DAY2)] : []), buildConfig: config });

  // /digest/LAX/latest should redirect 302 to the latest edition (Day 2: 2026-09-25)
  const resLax = await handleDigestRequest(new URL(`${APP}/digest/LAX/latest`), env, { appUrl: APP });
  assert.equal(resLax.status, 302);
  assert.equal(resLax.headers.get('Location'), '/digest/LAX/2026-09-25');

  // /digest/AUS/latest (no editions in DB) should redirect 302 to /digest/AUS
  const resAus = await handleDigestRequest(new URL(`${APP}/digest/AUS/latest`), env, { appUrl: APP });
  assert.equal(resAus.status, 302);
  assert.equal(resAus.headers.get('Location'), '/digest/AUS');

  // /digest/latest should redirect 302 to /digest
  const resGeneral = await handleDigestRequest(new URL(`${APP}/digest/latest`), env, { appUrl: APP });
  assert.equal(resGeneral.status, 302);
  assert.equal(resGeneral.headers.get('Location'), '/digest');
});

test('thin origin empty state notice contains links to /check and /time-off (plan coverage rule)', () => {
  const html = read('index.html');

  // Check showOriginNotLiveYet
  const notLiveFn = html.slice(html.indexOf('function showOriginNotLiveYet('), html.indexOf('function loadOtherOriginsData()'));
  assert.match(notLiveFn, /<a href="\/check">check a price<\/a>/);
  assert.match(notLiveFn, /<a href="\/time-off">plan time off<\/a>/);

  // Check renderVerdictNotice
  const verdictFn = html.slice(html.indexOf('async function renderVerdictNotice('), html.indexOf('function renderWithSort('));
  assert.match(verdictFn, /<a href="\/check">check a price<\/a>/);
  assert.match(verdictFn, /<a href="\/time-off">plan time off<\/a>/);
  assert.match(verdictFn, /hero-notice-coverage/);
});

test('homepage signup form payload includes source: "home"', () => {
  const html = read('index.html');
  assert.match(html, /source:\s*'home'/);
});

test('confirm zero exit-intent, pop-up, or scroll-triggered modals anywhere on site', () => {
  const root = new URL('../', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
  const ignoreDirs = ['node_modules', '.git', 'scratch', 'tmp', '.wrangler'];

  function checkFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.isDirectory()) {
        if (!ignoreDirs.includes(ent.name)) {
          checkFiles(path.join(dir, ent.name));
        }
      } else if (ent.name.endsWith('.html') || (ent.name.endsWith('.js') && !ent.name.endsWith('.test.js'))) {
        const filePath = path.join(dir, ent.name);
        const content = fs.readFileSync(filePath, 'utf8');

        // Banned modal / exit intent behaviors:
        // 1. Mouseleave or mouseout-based exit intent triggers
        assert.doesNotMatch(content, /mouseleave\s*\(|addEventListener\s*\(\s*['"]mouseleave['"]/, `exit-intent trigger found in ${filePath}`);
        // 2. Scroll-triggered modal popups (scroll percentage showing a popup)
        assert.doesNotMatch(content, /scrollPercent|scrollDepth.*modal|showPopupOnScroll/i, `scroll-triggered popup found in ${filePath}`);
        // 3. Automated pop-ups / showModal
        assert.doesNotMatch(content, /\.showModal\(\)/, `dialog.showModal() popup found in ${filePath}`);
      }
    }
  }

  checkFiles(root);
});
