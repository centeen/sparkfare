// K-B8 (ROADMAP step 132, scan G-1): the /digest archive is a site page: brand tokens and fonts, the shared header, one <h1> and one <main>, a skip
// link, the site footer, no colour of its own in the page chrome, and rows tall enough to tap. The edition's own email markup (and its palette) is
// the E-1 work and is not changed here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSqliteD1 } from './helpers/sqliteD1.js';
import { archiveEditions, handleDigestRequest } from '../src/digestArchive.js';
import { SITE_NAV_HTML } from '../src/siteHeader.js';

const MIGRATIONS = ['migrations/0002_partners.sql', 'migrations/0013_events.sql', 'migrations/0014_digest_editions.sql'];
const DAY1 = new Date('2026-10-18T08:00:00Z');
const TODAY = new Date('2026-10-19T09:00:00Z');
const APP = 'https://sparkfare.com';
const obs = (p, n, end) => Array.from({ length: n }, (_, i) => ({ date: new Date(end.getTime() - (n - i) * 86400000).toISOString().slice(0, 10), price: p }));
const deal = (now) => ({
  display_name: 'Lisbon, Portugal', origin: 'SEA', price: 310, status: 'deal', airline: 'TP', median_baseline: 588,
  booking_link: 'https://www.aviasales.com/search/X?marker=1', departure_at: '2027-01-23T22:35:00-07:00', return_at: '2027-01-30T16:15:00-06:00',
  found_at: new Date(now.getTime() - 3600000).toISOString(), observations: obs(588, 20, now),
});
const config = async () => ({ appUrl: APP, destinations: { 'Lisbon, Portugal': 'x' }, tips: [{ id: 't', title: 'Tip', body: 'Body.' }], awayMode: null });

async function pages() {
  const env = { DB: makeSqliteD1(MIGRATIONS), ENABLE_DIGEST_ARCHIVE: 'true' };
  await archiveEditions(env, { now: DAY1, loadDeals: async (o) => (o === 'SEA' ? [deal(DAY1)] : []), buildConfig: config });
  const get = async (p, now = TODAY) => (await handleDigestRequest(new URL(APP + p), env, { appUrl: APP, now, buildConfig: config })).text();
  return { index: await get('/digest'), origin: await get('/digest/SEA'), old: await get('/digest/SEA/2026-10-18'), today: await get('/digest/SEA/2026-10-18', DAY1) };
}
const strip = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '');

test('every archive page loads the brand tokens, fonts and header styles, and the site scripts', async () => {
  const all = await pages();
  for (const [name, h] of Object.entries(all)) {
    for (const href of ['/brand/tokens.css', '/brand/fonts.css', '/brand/header.css']) assert.equal(h.split(`href="${href}"`).length - 1, 1, `${name}: ${href} exactly once`);
    for (const src of ['/brand/header.js', '/nav-auth.js', '/site-footer.js']) assert.equal(h.split(`src="${src}"`).length - 1, 1, `${name}: ${src} exactly once`);
    assert.ok(h.includes('syncNavAuthStateLazy()'), name);
  }
});

test('every archive page has the shared header, one skip link, exactly one <h1> and one <main> that closes before </body>', async () => {
  const all = await pages();
  for (const [name, h] of Object.entries(all)) {
    const b = strip(h);
    assert.equal(h.split(SITE_NAV_HTML).length - 1, 1, `${name}: shared header once`);
    assert.equal((b.match(/<h1[\s>]/g) || []).length, 1, `${name}: h1`);
    assert.equal((b.match(/<main[\s>]/g) || []).length, 1, `${name}: main`);
    assert.equal((b.match(/class="skip-link"/g) || []).length, 1, `${name}: skip link`);
    assert.ok(h.indexOf('<main') < h.indexOf('</main>') && h.indexOf('</main>') < h.lastIndexOf('</body>'), `${name}: main order`);
  }
});

test('the page chrome has no colour of its own: no hex in the list pages or in the chrome around an edition', async () => {
  const all = await pages();
  for (const name of ['index', 'origin']) assert.ok(!/#[0-9a-f]{3,8}\b/i.test(all[name].replace(/&#\d+;/g, '')), `${name} has a hex colour`);
  for (const name of ['old', 'today']) {
    const chrome = all[name].slice(all[name].indexOf('<a class="skip-link"'), all[name].indexOf('<!--sf-chrome-end-->') >= 0 ? undefined : all[name].indexOf('</h1>') + 2500);
    const mine = chrome.slice(0, chrome.indexOf('archive-signup') + 3000);
    assert.ok(!/#[0-9a-f]{6}\b/i.test(mine.slice(0, mine.indexOf('<script>'))), `${name}: chrome uses a hex colour`);
  }
});

test('list rows can be tapped: each edition link is a 44 px row and the origin links are padded', async () => {
  const { index } = await pages();
  assert.match(index, /\.edition-list a \{ display: inline-block; padding: 10px 0; \}/);
  assert.match(index, /\.origin-links a \{ display: inline-block; padding: 10px 8px 10px 0; \}/);
  assert.match(index, /<ul class="edition-list">/);
});

test('the signup form on an edition page uses 44 px fields and a Sage button', async () => {
  const { old } = await pages();
  assert.ok((old.match(/min-height:44px;padding:12px;font-size:16px;border:1px solid var\(--line\)/g) || []).length === 2);
  assert.match(old, /color:var\(--on-sage\);background:var\(--sage\)/);
});

test('an older edition keeps its stale banner, on tokens', async () => {
  const { old, today } = await pages();
  assert.match(old, /Prices from 2026-10-18\. Fares have likely changed\./);
  assert.ok(!today.includes('Fares have likely changed.'));
});
