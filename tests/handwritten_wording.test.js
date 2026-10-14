// 2026-10-14 (referral-copy scope, step 3): the hand-written posts, the blog index cards, check.html, widget.html and the Tiqets and
// Welcome Pickups blurbs no longer say "worth booking" or use "booked" in Sparkfare's own voice. Slugs that contain "book" are
// unchanged on purpose (no redirects needed). privacy.html's descriptive "whether the fare was booked", about.html's "doesn't sell,
// book, ticket..." and the "Reserve discounted airport parking" partner blurb are deliberate and not covered here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('no "worth booking" on the blog index, /check or /widget', () => {
  for (const f of ['blog/index.html', 'check.html', 'widget.html']) {
    assert.ok(!/worth booking/i.test(read(f)), f);
  }
});

test('the hand-written posts no longer use the flagged phrases', () => {
  const banned = {
    'blog/cant-go-because-of-the-dog.html': /book early/i,
    'blog/departing-soon-alert-explained.html': /trip booked/i,
    'blog/same-day-cheapest-wins.html': /good day to book/i,
    'blog/unsubscribe-without-logging-in.html': /booking interstitial/i,
    'blog/what-happens-after-you-click-book.html': /got booked|booking flow|actual booking happens/i,
    'blog/what-happens-with-your-data.html': /got booked|was booked|resulting booking/i,
    'blog/why-book-through-us-first.html': /got booked|actual booking still|some bookings|before booking is|booking page/i,
    'blog/away-mode-checklist.html': /booked before you land|booked ahead/i,
  };
  for (const [f, re] of Object.entries(banned)) assert.ok(!re.test(read(f)), f);
});

test('the Tiqets and Welcome Pickups blurbs agree across the code fallback, the blog post and the migration', () => {
  const tiqets = 'Skip-the-line tickets and tours at your destination, sorted before you land.';
  const pickups = 'A driver waiting at arrivals with your name on a sign — set up ahead, fixed price.';
  const email = read('src/email.js');
  const blog = read('blog/away-mode-checklist.html');
  const mig = read('migrations/0024_partner_blurb_wording.sql');
  for (const [text, where] of [[email, 'src/email.js'], [blog, 'blog/away-mode-checklist.html'], [mig, 'migration 0024']]) {
    assert.ok(text.includes(tiqets), 'Tiqets blurb in ' + where);
    assert.ok(text.includes(pickups), 'Welcome Pickups blurb in ' + where);
  }
  assert.ok(!/booked before you land|booked ahead, fixed price/.test(email));
  assert.match(mig, /WHERE slug = 'tiqets'/);
  assert.match(mig, /WHERE slug = 'welcome-pickups'/);
});
