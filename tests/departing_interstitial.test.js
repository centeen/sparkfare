import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

const render = async () => {
  const res = await worker.fetch(new Request('https://sparkfare.com/departing/trip-123?url=' + encodeURIComponent('https://www.aviasales.com/x')), {}, { waitUntil() {} });
  assert.equal(res.status, 200);
  return res.text();
};

test('interstitial lists the seven away services, linked through /out with the trip id', async () => {
  const html = await render();
  for (const slug of ['safetywing', 'airhelp', 'yesim', 'wise', 'qeeq', 'welcome-pickups']) {
    assert.ok(html.includes(`href="/out/${slug}?trip_id=trip-123"`), slug);
  }
  assert.match(html, /Hotel booking <span class="via">coming soon<\/span>/);
  assert.ok(!html.includes('/out/hotel'));
});

test('interstitial shows the disclosure before the links, opens them in new tabs, and does not auto-redirect', async () => {
  const html = await render();
  assert.ok(html.indexOf('may earn a commission') < html.indexOf('/out/safetywing'));
  assert.ok(html.includes('target="_blank" rel="noopener sponsored"'));
  assert.ok(!html.includes('setTimeout'));
  assert.ok(html.includes('Continue to flight booking'));
  assert.ok(!html.includes('Continue to Aviasales'));
});
