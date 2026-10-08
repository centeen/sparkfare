// The route page's "Get Deal Alerts" button used to link to /departing/<origin>, the booking
// interstitial. A visitor who tapped it saw "Check your inbox for your pre-trip guide" without ever
// signing up. No test requested the rendered CTA, so nothing caught it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

const days = (n) => Array(n).fill(0).map((_, i) => ({
  price: 400 + (n - i) * 5,
  date: new Date(Date.now() - (n - i) * 24 * 60 * 60 * 1000).toISOString(),
}));

const env = {
  ASSETS: {
    fetch: async (req) => {
      if (req.url.includes('sparkfare_ranked_deals')) {
        return {
          ok: true,
          json: async () => ({
            deals: [
              { origin: 'JFK', display_name: 'Rich, Place', price: 350, observations: days(15), basis_text: '17% below 30-day median, 31 observations' },
              { origin: 'JFK', display_name: 'Thin, Place', price: 400, observations: days(3) },
            ],
            featured: [],
            priced_no_deal: [],
          }),
        };
      }
      return { ok: false, json: async () => ({}) };
    },
  },
};

async function page(dest) {
  const res = await worker.fetch(
    new Request('https://sparkfare.com/flight/JFK/' + encodeURIComponent(dest)), env, { waitUntil() {} });
  return { status: res.status, html: await res.text() };
}

for (const dest of ['Rich, Place', 'Thin, Place']) {
  test(`route page "${dest}": Get Deal Alerts goes to the homepage signup form with the airport preset, not the booking interstitial`, async () => {
    const { status, html } = await page(dest);
    assert.equal(status, 200);
    const m = html.match(/<a href="([^"]*)" class="cta">Get Deal Alerts<\/a>/);
    assert.ok(m, 'the Get Deal Alerts button is on the page');
    assert.equal(m[1], '/?origin=JFK#signup-form');
  });

  test(`route page "${dest}": no link on the page targets /departing/`, async () => {
    const { html } = await page(dest);
    const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((x) => x[1]);
    assert.ok(hrefs.length > 5, 'page has links');
    assert.deepEqual(hrefs.filter((h) => h.includes('/departing/')), []);
  });
}

test('the signup form the button points at exists on the homepage', async () => {
  const { readFileSync } = await import('node:fs');
  const home = readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.match(home, /<form[^>]*id="signup-form"/);
});

test('homepage presets the signup airport from ?origin= and ignores anything else', async () => {
  const { readFileSync } = await import('node:fs');
  const home = readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const start = home.indexOf('function presetSignupOrigin');
  assert.ok(start !== -1, 'presetSignupOrigin exists in index.html');
  const end = home.indexOf('\n}\n', start) + 3;
  const fnText = home.slice(start, end);
  const preset = new Function(fnText + '; return presetSignupOrigin;')();
  const mk = () => ({ value: '', options: ['', 'JFK', 'LAX', 'TLV'].map((v) => ({ value: v })) });
  let sel = mk();
  assert.equal(preset('?origin=LAX', sel), true);
  assert.equal(sel.value, 'LAX');
  sel = mk();
  assert.equal(preset('?origin=lax', sel), true);
  assert.equal(sel.value, 'LAX');
  for (const bad of ['', '?origin=', '?origin=XXX', '?origin=JFKK', '?origin=<script>', '?ref=abc', '?origin=LAX%00']) {
    sel = mk();
    assert.equal(preset(bad, sel), false, bad);
    assert.equal(sel.value, '', bad);
  }
  assert.equal(preset('?origin=JFK', null), false);
  // it is wired to the real select, and it never touches the board's stored origin
  assert.ok(home.includes("presetSignupOrigin(window.location.search, document.getElementById('origin_iata'))"));
  assert.ok(!fnText.includes('localStorage'), 'must not overwrite the visitor\'s saved board origin');
});
