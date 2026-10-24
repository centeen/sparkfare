// A6 (owner decision 2026-10-24): fare times are shown in the visitor's own time zone, site-wide.
// Browser pages ship UTC text inside <span data-asof> and /as-of-local.js swaps it for the visitor's zone; emails use the recipient's
// home-airport zone (an email cannot know where it is opened).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fareNote } from '../src/priceFreshness.js';
import { formatAsOf } from '../src/emailTemplates/helpers.js';
import { ORIGIN_TIME_ZONES } from '../src/originZones.js';
import { ORIGIN_TIME_ZONES as FROM_PLAN } from '../src/planReminders.js';
import { sendSundayNewsletter } from '../src/email.js';

const NOW = Date.parse('2026-10-24T13:00:00Z');
const FOUND = '2026-10-24T08:04:00Z';

test('the browser script replaces the UTC text with the visitor zone and leaves other spans alone', () => {
  const src = fs.readFileSync(new URL('../as-of-local.js', import.meta.url), 'utf8');
  const make = (iso) => ({ textContent: 'Oct 24, 8:04 AM UTC', getAttribute: () => iso });
  const run = (zone, spans) => {
    const RealDate = Date;
    const document = { querySelectorAll: () => spans };
    // toLocaleString([], opts): pin the visitor's zone through a Date subclass so the test does not depend on the machine's zone.
    class ZoneDate extends RealDate {
      toLocaleString(loc, opts) { return super.toLocaleString('en-US', { ...opts, timeZone: zone }); }
    }
    vm.runInNewContext(src, { document, Date: ZoneDate });
  };
  const a = make(FOUND); run('America/New_York', [a]);
  assert.equal(a.textContent, 'Oct 24, 4:04 AM EDT');
  const b = make(FOUND); run('Asia/Jerusalem', [b]);
  assert.match(b.textContent, /^Oct 24, 11:04 AM GMT\+3$/);
  const bad = make('not a date'); run('America/New_York', [bad]);
  assert.equal(bad.textContent, 'Oct 24, 8:04 AM UTC', 'an unreadable time keeps the UTC text');
});

test('route page note: UTC text with a data-asof marker for the script; plain text without markup', () => {
  const item = { found_at: FOUND };
  const marked = fareNote(item, NOW, 'UTC', true);
  assert.match(marked, /^Checked 4 h ago · <span data-asof="2026-10-24T08:04:00\.000Z">Oct 24, 8:04 AM UTC<\/span>$/);
  assert.equal(fareNote(item, NOW, 'UTC'), 'Checked 4 h ago · Oct 24, 8:04 AM UTC', 'callers that print text (newsletter, tests) are unchanged');
});

test('as-of-local.js is a public asset and the pSEO generator and route page load it', () => {
  assert.ok(fs.existsSync(new URL('../as-of-local.js', import.meta.url)));
  const ignore = fs.readFileSync(new URL('../.assetsignore', import.meta.url), 'utf8');
  assert.ok(!/^\*\.js$|^as-of-local\.js$/m.test(ignore), 'not asset-ignored');
  assert.ok(fs.readFileSync(new URL('../Phase 17 pSEO Generator (Step 106).py', import.meta.url), 'utf8').includes('<script src="/as-of-local.js" defer></script>'));
});

test('emails print the time in the recipient home-airport zone, with the zone name; unknown origin stays UTC', () => {
  assert.equal(formatAsOf(FOUND, ORIGIN_TIME_ZONES.JFK), 'Oct 24, 4:04 AM EDT');
  assert.equal(formatAsOf(FOUND, ORIGIN_TIME_ZONES.LAX), 'Oct 24, 1:04 AM PDT');
  assert.equal(formatAsOf(FOUND, ORIGIN_TIME_ZONES.PHX), 'Oct 24, 1:04 AM MST');
  assert.equal(formatAsOf(FOUND, undefined), 'Oct 24, 08:04 UTC');
  assert.equal(formatAsOf(FOUND, 'Not/AZone'), 'Oct 24, 08:04 UTC');
  assert.equal(formatAsOf('garbage', 'America/New_York'), null);
});

test('the zone map is shared with the plan reminders and covers every marketed origin', () => {
  assert.strictEqual(FROM_PLAN, ORIGIN_TIME_ZONES);
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').split(String.fromCharCode(13, 10)).join('\n');
  const select = html.match(/<select id="origin-select">([\s\S]*?)<\/select>/)[1];
  for (const code of [...select.matchAll(/<option value="([A-Z]{3})"/g)].map((m) => m[1])) {
    assert.ok(ORIGIN_TIME_ZONES[code], `${code} has a zone`);
  }
});

test('the Sunday newsletter shows each fare time in the origin zone', async () => {
  const original = globalThis.fetch;
  const sent = [];
  globalThis.fetch = async (url, options) => {
    if (String(url).includes('api.resend.com')) { sent.push(JSON.parse(options.body)); return new Response(JSON.stringify({ data: [] }), { status: 200 }); }
    return original(url, options);
  };
  const realNow = Date.now;
  Date.now = () => NOW;
  try {
    const db = { prepare: () => ({ bind: () => ({ all: async () => ({ results: [] }), first: async () => null, run: async () => ({}) }), all: async () => ({ results: [] }), first: async () => null, run: async () => ({}) }) };
    const deal = { display_name: 'Lisbon, Portugal', price: 300, booking_link: 'https://example.com', departure_at: '2026-12-01T10:00:00Z', found_at: FOUND };
    await sendSundayNewsletter({ RESEND_API_KEY: 'k', APP_URL: 'https://sparkfare.com', DB: db }, [{ id: 'u', email: 'a@example.com' }], { deals: [deal], subjectA: 'A', subjectB: 'B', origin: 'LAX' });
    const html = JSON.stringify(sent);
    assert.match(html, /Checked 4 h ago · Oct 24, 1:04 AM PDT/);
    assert.ok(!/8:04 AM UTC/.test(html));
  } finally { Date.now = realNow; globalThis.fetch = original; }
});
