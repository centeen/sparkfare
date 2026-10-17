// G61 (ROADMAP step 100, Addendum I): the LIVE-CHECKED PRICE tag was shown for carried-forward prices (the opposite of what it says), and as-of
// times printed in the viewer's zone with no zone name. These tests run the real functions from index.html.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const CRLF = String.fromCharCode(13, 10);
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').split(CRLF).join('\n');
const block = html.match(/const PRICE_FRESH_HOURS = 48;[\s\S]*?function asOfLineHTML\(item, style\) \{[\s\S]*?\n\}\n/)[0];
const api = vm.runInNewContext(`${block}; ({ priceFreshness, formatAsOf, asOfText, asOfLineHTML, PRICE_FRESH_HOURS })`);

const NOW = Date.parse('2026-10-17T12:00:00Z');
const ago = (hours) => new Date(NOW - hours * 3600000).toISOString();

test('only a fresh fetch within 48 hours is "current"', () => {
  assert.equal(api.PRICE_FRESH_HOURS, 48);
  assert.equal(api.priceFreshness({ found_at: ago(2) }, NOW), 'current');
  assert.equal(api.priceFreshness({ found_at: ago(48) }, NOW), 'current', '48 hours is the limit, inclusive');
  assert.equal(api.priceFreshness({ found_at: ago(48.1) }, NOW), 'aging');
  assert.equal(api.priceFreshness({ found_at: ago(100) }, NOW), 'aging');
  assert.equal(api.priceFreshness({}, NOW), 'aging', 'no found_at is never current');
  assert.equal(api.priceFreshness({ found_at: 'not a date' }, NOW), 'aging');
  assert.equal(api.priceFreshness(null, NOW), 'aging');
});

test('a carried-forward price is never "current", however new its found_at looks', () => {
  assert.equal(api.priceFreshness({ is_stale_fallback: true, found_at: ago(1) }, NOW), 'carried');
  assert.equal(api.priceFreshness({ is_stale_fallback: true, found_at: ago(200) }, NOW), 'carried');
  assert.equal(api.priceFreshness({ is_stale_fallback: true }, NOW), 'carried');
});

test('the tag is rendered only for a current price, and a deal still wears DEAL', () => {
  assert.match(html, /item\.status === 'deal'\s*\n\s*\? `<span class="badge deal">DEAL<\/span>`\s*\n\s*: priceFreshness\(item\) === 'current'\s*\n\s*\? `<span class="badge stale">LIVE-CHECKED PRICE<\/span>`/);
  assert.ok(!/: item\.is_stale_fallback\s*\n\s*\? `<span class="badge stale">/.test(html), 'the old rule (tag on stale records) is gone');
  assert.equal((html.match(/<span class="badge stale">/g) || []).length, 1, 'the tag is rendered in one place only');
});

test('every time carries a time zone name', () => {
  const item = { found_at: '2026-10-15T23:43:07.455933+00:00' };
  const ny = api.formatAsOf(item, 'America/New_York');
  const la = api.formatAsOf(item, 'America/Los_Angeles');
  const utc = api.formatAsOf(item, 'UTC');
  assert.match(ny, /EDT/);
  assert.match(la, /PDT/);
  assert.match(utc, /UTC/);
  assert.match(ny, /7:43/);
  assert.match(la, /4:43/);
  // Winter time shows the standard-time name, not a fixed one.
  assert.match(api.formatAsOf({ found_at: '2026-12-15T23:43:00Z' }, 'America/New_York'), /EST/);
  // With no zone given it uses the viewer's, and still names it.
  assert.match(api.formatAsOf(item), /[A-Z]{2,5}|GMT[+-]\d/);
});

test('a date with no time of day is shown as a date only, in UTC, so it never slips a day', () => {
  const out = api.formatAsOf({ last_fresh_date: '2026-10-16' });
  assert.match(out, /Oct 16/);
  assert.ok(!/\d:\d\d/.test(out), 'no invented time of day');
  assert.equal(api.formatAsOf({}), '');
  assert.equal(api.formatAsOf({ last_fresh_date: 'garbage' }), '');
  // found_at wins when both are present.
  assert.match(api.formatAsOf({ found_at: '2026-10-15T23:43:00Z', last_fresh_date: '2026-10-16' }, 'UTC'), /Oct 15/);
});

test('the wording: a current price says "Prices as of", a carried one says "Last seen" and that it is carried forward', () => {
  const cur = api.asOfText({ found_at: ago(3) }, NOW, 'UTC');
  assert.match(cur, /^Prices as of /);
  assert.doesNotMatch(cur, /Last seen|carried/);
  const carried = api.asOfText({ is_stale_fallback: true, found_at: '2026-10-08T10:00:00Z' }, NOW, 'UTC');
  assert.match(carried, /^Last seen Oct 8, 10:00 AM UTC\./);
  assert.match(carried, /carried forward/);
  assert.doesNotMatch(carried, /Prices as of|live|checked/i, 'no claim of a live check');
  const aging = api.asOfText({ found_at: ago(100) }, NOW, 'UTC');
  assert.match(aging, /^Prices as of /, 'an old fresh-looking price still says when, without a tag');
  assert.equal(api.asOfText({}, NOW), '');
});

test('the as-of paragraph is built once, for the hero and for the cards, and nothing formats a time without a zone', () => {
  assert.match(html, /\$\{asOfLineHTML\(topPick, '/);
  assert.match(html, /\$\{asOfLineHTML\(item, '/);
  assert.equal(api.asOfLineHTML({}, 'x'), '', 'no time, no paragraph');
  assert.match(api.asOfLineHTML({ found_at: ago(1) }, 'color: red;'), /^<p style="color: red;">Prices as of /);
  const unzoned = html.split('\n').filter((l) => /toLocaleString\(\[\], \{month: 'short', day: 'numeric', hour: 'numeric', minute:'2-digit'\}\)/.test(l));
  assert.deepEqual(unzoned, [], 'the old zone-less formatting is gone');
});

test('real data: every carried-forward record is "carried", and none of them would get the tag', () => {
  for (const f of ['sparkfare_ranked_deals.json', 'sparkfare_ranked_deals_other_origins.json']) {
    const d = JSON.parse(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8'));
    const at = Date.parse(d.generated_at);
    const rows = Object.values(d).flat().filter((x) => x && typeof x === 'object' && x.display_name);
    assert.ok(rows.length > 0, f);
    let stale = 0;
    for (const r of rows) {
      const f2 = api.priceFreshness(r, at);
      if (r.is_stale_fallback) { stale += 1; assert.equal(f2, 'carried', `${f}: ${r.display_name}`); }
      else assert.notEqual(f2, 'carried', `${f}: ${r.display_name}`);
    }
    assert.ok(stale >= 0);
  }
});
