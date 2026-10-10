import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { formatWindowRange, nextLongWeekend } from '../src/ptoCalendar.js';
import { buildPtoPromo, sendDailyDealEmail } from '../src/email.js';
import { renderDailyDigest } from '../src/emailTemplates/dailyDigest.js';
import { classifyDeals } from '../src/digestChange.js';
import { ptoSitemapUrls, PTO_ORIGINS } from '../src/ptoPages.js';
import worker from '../src/index.js';
import { encryptToken, PINTEREST_TOKEN_ROW_ID } from '../src/pinterest.js';

test('formatWindowRange formats single-month and multi-month windows', () => {
  assert.equal(formatWindowRange('2026-11-26', '2026-11-29'), 'Nov 26-29');
  assert.equal(formatWindowRange('2026-12-31', '2027-01-03'), 'Dec 31 - Jan 3');
  assert.equal(formatWindowRange('2027-07-03', '2027-07-05'), 'Jul 3-5');
});

test('nextLongWeekend finds Thanksgiving 4-day weekend with 0 PTO from 2026-10-09', () => {
  const lw = nextLongWeekend({ today: '2026-10-09' });
  assert.ok(lw, 'expected an upcoming long weekend');
  assert.equal(lw.start, '2026-11-26');
  assert.equal(lw.end, '2026-11-29');
  assert.equal(lw.daysOff, 4);
  assert.equal(lw.ptoUsed, 0);
});

test('buildPtoPromo respects feature flags and builds correct promo data', () => {
  const envOff = { ENABLE_PTO_DIGEST_BLOCK: 'false', ENABLE_PTO_CALENDAR: 'true' };
  assert.equal(buildPtoPromo({ env: envOff, origin: 'DEN', appUrl: 'https://sparkfare.com', today: '2026-10-09' }), null);

  const envCalOff = { ENABLE_PTO_DIGEST_BLOCK: 'true', ENABLE_PTO_CALENDAR: 'false' };
  assert.equal(buildPtoPromo({ env: envCalOff, origin: 'DEN', appUrl: 'https://sparkfare.com', today: '2026-10-09' }), null);

  const envOn = { ENABLE_PTO_DIGEST_BLOCK: 'true', ENABLE_PTO_CALENDAR: 'true' };
  const promo = buildPtoPromo({ env: envOn, origin: 'DEN', appUrl: 'https://sparkfare.com', today: '2026-10-09' });
  assert.ok(promo);
  assert.equal(promo.leadingText, 'Next long weekend from Denver: Nov 26-29.');
  assert.equal(promo.dateRange, 'Nov 26-29');
  assert.equal(promo.linkText, 'See your time-off plan');
  assert.equal(promo.href, 'https://sparkfare.com/time-off/den?src=digest');
});

test('renderDailyDigest includes promo line under deals when ptoPromo is supplied', () => {
  const promo = {
    leadingText: 'Next long weekend from Denver: Nov 26-29.',
    dateRange: 'Nov 26-29',
    linkText: 'See your time-off plan',
    href: 'https://sparkfare.com/time-off/den?src=digest',
  };
  const rendered = renderDailyDigest({
    origin: 'DEN',
    deals: [{ display_name: 'Cancun, Mexico', price: 250, booking_link: 'https://aviasales.com' }],
    edition: 1,
    user: { id: 'usr_1' },
    config: {
      appUrl: 'https://sparkfare.com',
      ptoPromo: promo,
    },
  });

  assert.ok(rendered.html.includes('Next long weekend from Denver: Nov 26-29.'));
  assert.ok(rendered.html.includes('href="https://sparkfare.com/time-off/den?src=digest"'));
  assert.ok(rendered.html.includes('See your time-off plan'));
  assert.ok(rendered.text.includes('Next long weekend from Denver: Nov 26-29. See your time-off plan: https://sparkfare.com/time-off/den?src=digest'));

  // Deals are rendered above promo line
  const dealsIndex = rendered.html.indexOf('Cancun, Mexico');
  const promoIndex = rendered.html.indexOf('Next long weekend from Denver: Nov 26-29.');
  assert.ok(dealsIndex < promoIndex, 'deals must appear before pto promo');
});

test('classifyDeals is unchanged when promo block is active (skip-if-unchanged isolation)', () => {
  const deals = [{ display_name: 'Cancun, Mexico', price: 250 }];
  const previous = [{ display_name: 'Cancun, Mexico', price: 250 }];
  const classified = classifyDeals(deals, previous);
  assert.equal(classified.changed, false);
  assert.equal(classified.deals[0].email_status, 'still_available');
});

test('POST /admin/pinterest/pto-pins dry-run returns one pin per US origin with auth', async () => {
  const KEY = Buffer.alloc(32, 7).toString('base64');
  const encAccess = await encryptToken('access_token_123', KEY);
  const encRefresh = await encryptToken('refresh_token_123', KEY);

  const mockDb = {
    prepare: (query) => ({
      bind: () => ({
        first: async () => {
          if (query.includes('FROM pinterest_tokens')) {
            return {
              id: PINTEREST_TOKEN_ROW_ID,
              access_token_ciphertext: encAccess.ciphertext,
              access_token_iv: encAccess.iv,
              refresh_token_ciphertext: encRefresh.ciphertext,
              refresh_token_iv: encRefresh.iv,
              expires_at: new Date(Date.now() + 3600000).toISOString(),
              scopes: 'boards:read,boards:write,pins:read,pins:write',
            };
          }
          return null;
        },
      }),
    }),
  };

  const env = {
    ENABLE_PINTEREST: 'true',
    ADMIN_SECRET: 'test_admin_secret',
    PINTEREST_TOKEN_ENCRYPTION_KEY: KEY,
    DB: mockDb,
    APP_URL: 'https://sparkfare.com',
  };

  // 1. Unauthorized request
  const unauthReq = new Request('https://sparkfare.com/admin/pinterest/pto-pins?dry=1', {
    method: 'POST',
  });
  const unauthRes = await worker.fetch(unauthReq, env);
  assert.equal(unauthRes.status, 401);

  // 2. Authorized dry-run request
  const authReq = new Request('https://sparkfare.com/admin/pinterest/pto-pins?dry=1', {
    method: 'POST',
    headers: { Authorization: 'Bearer test_admin_secret' },
  });
  const authRes = await worker.fetch(authReq, env);
  assert.equal(authRes.status, 200);
  const data = await authRes.json();
  assert.equal(data.ok, true);
  assert.equal(data.dry_run, true);
  assert.equal(data.count, PTO_ORIGINS.length);
  assert.equal(data.board_name, 'Long weekends 2027');
  assert.equal(data.pins.length, PTO_ORIGINS.length);

  const denPin = data.pins.find((p) => p.origin === 'DEN');
  assert.ok(denPin);
  assert.equal(denPin.link, 'https://sparkfare.com/time-off/den?src=pinterest');
  assert.equal(denPin.media_source.url, 'https://sparkfare.com/og/time-off/den.png');
  assert.ok(denPin.title.includes('Denver (DEN)'));
});

test('content/pto_press_2027.md exists and contains 2027 national findings', () => {
  const content = fs.readFileSync('content/pto_press_2027.md', 'utf8');
  assert.ok(content.includes('42 total days off'));
  assert.ok(content.includes('Thanksgiving'));
  assert.ok(content.includes('Memorial Day'));
  assert.ok(content.includes(`${PTO_ORIGINS.length} major US origin hubs`));
  assert.ok(content.includes('sparkfare.com/time-off'));
});

test('blog/how-we-built-the-2027-long-weekend-calendar.html exists and carries required sections', () => {
  const html = fs.readFileSync('blog/how-we-built-the-2027-long-weekend-calendar.html', 'utf8');
  assert.ok(html.includes('How we built the 2027 long-weekend calendar'));
  assert.ok(html.includes('/* nav tap targets */'));
  assert.ok(html.includes('OPM'));
  assert.ok(html.includes('dynamic programming'));
  assert.ok(html.includes('href="/time-off"'));
  assert.ok(html.includes('href="/blog/how-we-rank-deals"'));
});

test('ptoSitemapUrls includes the blog post URL when PTO calendar is enabled', () => {
  const urls = ptoSitemapUrls('https://sparkfare.com');
  assert.ok(urls.includes('https://sparkfare.com/time-off'));
  assert.ok(urls.includes('https://sparkfare.com/blog/how-we-built-the-2027-long-weekend-calendar'));
  assert.ok(urls.includes('https://sparkfare.com/time-off/den'));
});

test('homepage and blog index include conditional Time off link and callouts', () => {
  const indexHtml = fs.readFileSync('index.html', 'utf8');
  assert.ok(indexHtml.includes('<a href="/time-off" class="pto-calendar-only" style="display:none;">Time off</a>'));
  assert.ok(indexHtml.includes('id="pto-board-callout"'));
  assert.ok(indexHtml.includes("fetch('/time-off'"));

  const blogIndexHtml = fs.readFileSync('blog/index.html', 'utf8');
  assert.ok(blogIndexHtml.includes('<a href="/time-off" class="pto-calendar-only" style="display:none;">Time off</a>'));
  assert.ok(blogIndexHtml.includes('href="/blog/how-we-built-the-2027-long-weekend-calendar"'));
  assert.ok(blogIndexHtml.includes("fetch('/time-off'"));
});
