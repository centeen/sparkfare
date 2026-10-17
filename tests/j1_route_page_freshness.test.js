// Addendum J, J1 display: the Worker's /flight/ route page states how old its price is, shows nothing for a fare that has left, and
// never makes a deal claim for a price last seen more than 3 days ago.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

const HOUR = 3600000;
const days = (n) => Array(n).fill(0).map((_, i) => ({
  price: 400 + (n - i) * 5,
  date: new Date(Date.now() - (n - i) * 24 * HOUR).toISOString(),
}));
const rec = (name, extra) => Object.assign({
  origin: 'JFK', display_name: name, price: 350, status: 'deal', observations: days(20),
  basis_text: '17% below 30-day median, 20 observations', departure_at: new Date(Date.now() + 30 * 24 * HOUR).toISOString(),
}, extra);

function envWith(records) {
  return { ASSETS: { fetch: async (req) => req.url.includes('sparkfare_ranked_deals')
    ? { ok: true, json: async () => ({ deals: records, featured: [], priced_no_deal: [] }) }
    : { ok: false, json: async () => ({}) } } };
}
async function page(records, dest) {
  const res = await worker.fetch(new Request('https://sparkfare.com/flight/JFK/' + encodeURIComponent(dest)), envWith(records), { waitUntil() {} });
  return { status: res.status, html: await res.text() };
}

test('a fresh price says how long ago it was checked, with a zone name', async () => {
  const { html } = await page([rec('Fresh, Place', { found_at: new Date(Date.now() - 3 * HOUR).toISOString() })], 'Fresh, Place');
  assert.match(html, /Checked 3 h ago · [A-Z][a-z]{2} \d{1,2}, \d{1,2}:\d\d [AP]M UTC/);
  assert.match(html, /\d+% below 30-day median/);
  assert.ok(!/<meta name="robots" content="noindex">/.test(html));
});

test('a carried-forward price says "Last seen" and that it is carried forward', async () => {
  const { html } = await page([rec('Carried, Place', {
    found_at: new Date(Date.now() - 30 * HOUR).toISOString(), is_stale_fallback: true, last_fresh_date: new Date(Date.now() - 24 * HOUR).toISOString().slice(0, 10),
  })], 'Carried, Place');
  assert.match(html, /Last seen .*carried forward/);
});

test('a price last seen more than 3 days ago shows only "Last seen <date>", no deal basis, and the page is noindex', async () => {
  const { html } = await page([rec('Old, Place', { found_at: new Date(Date.now() - 6 * 24 * HOUR).toISOString() })], 'Old, Place');
  assert.match(html, /Last seen [A-Z][a-z]{2} \d{1,2}\./);
  assert.ok(!/below 30-day median/.test(html), 'no deal claim');
  assert.match(html, /<meta name="robots" content="noindex">/);
});

test('a fare that has left or leaves within 48 hours is not shown as a fare', async () => {
  for (const hours of [-30, 10, 47]) {
    const { html } = await page([rec('Gone, Place', {
      found_at: new Date(Date.now() - HOUR).toISOString(), departure_at: new Date(Date.now() + hours * HOUR).toISOString(),
    })], 'Gone, Place');
    assert.match(html, /No current fare/, `departs in ${hours} h`);
    assert.ok(!/\$350/.test(html), 'the price is not shown');
    assert.ok(!/below 30-day median/.test(html));
    assert.match(html, /<meta name="robots" content="noindex">/);
  }
});
