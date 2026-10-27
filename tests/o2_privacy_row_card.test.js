// O2 flip guard: while the end-of-row card is on, the privacy page must say that its "shown" count is logged. The count only exists once
// ENABLE_ROW_ALERT_CARD is "true", so the wording and the flag move together (a flag flip without the sentence fails here).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (rel) => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const flagOn = /"ENABLE_ROW_ALERT_CARD":\s*"true"/.test(read('wrangler.jsonc'));
const text = read('privacy.html').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('with the end-of-row card on, the privacy page says the "shown" count is logged and what it contains', () => {
  if (!flagOn) return; // flag off: nothing is logged, so the sentence is not required yet
  assert.match(text, /the email sign-up card at the end of today.s deals, we also log that it was shown/);
  assert.match(text, /count with the airport you chose and how many columns it filled/);
  assert.match(text, /carries no email address, account ID or other identifier/);
});

test('the sentence is in the page in this PR, and the page date is current', () => {
  assert.match(text, /the email sign-up card at the end of today.s deals, we also log that it was shown/);
  assert.match(read('privacy.html'), /Last updated: (October|November|December) \d{1,2}, 2026/);
});

test('what the sentence promises matches what the Worker stores: airport, span and visitor class, no id or email', () => {
  const src = read('src/index.js');
  const block = src.slice(src.indexOf("data.event_type === 'row_card_view'"), src.indexOf("data.event_type === 'row_card_view'") + 900);
  assert.match(block, /origin: originCode/);
  assert.match(block, /meta: \{ span, ua_class/);
  assert.doesNotMatch(block, /user_id|email/);
});
