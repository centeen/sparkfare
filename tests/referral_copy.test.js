// Referral-positioning copy pass (decision logged 2026-10-07): Sparkfare publishes fare information
// and sends people to the booking site; it does not sell, book, ticket, arrange or take payment for
// travel. These tests keep the wording from drifting back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  BANNED, scanText, scanRepo, loadAllowlist, stripJsComments,
} from '../scripts/check-referral-copy.js';
import * as copy from '../src/referralCopy.js';
import { sendBookingConfirmedEmail, sendTargetReachedEmail } from '../src/email.js';
import { renderV2Html, renderV2Text } from '../src/postClickEmail.js';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('the repo has no banned referral wording in user-facing files', () => {
  const found = scanRepo();
  assert.deepEqual(found, [], found.map((f) => `${f.file}:${f.line} [${f.id}] ${f.text}`).join('\n'));
});

// One failing and one passing example per banned phrase.
const EXAMPLES = {
  'book-now': ['<a>Book now</a>', '<a>View fare</a>'],
  'book-this-fare': ['<a>Book this fare</a>', '<a>View fare</a>'],
  'book-flight-button': ['<a>Book Flight</a>', '<a>View fare</a>'],
  'bare-book-button': ['<a href="x">Book</a>', '<a href="x">View fare</a>'],
  'bare-book-label': ["label: 'Book'", "label: 'Booking site'"],
  'continue-to-flight-booking': ['Continue to flight booking', 'Continue to fare search'],
  'book-your-flight': ['Book your flight today', 'Check your fare today'],
  'book-with-us': ['Book with us', 'Compare with us'],
  'we-book': ["we'll book it for you", 'you book on the partner site'],
  'we-arrange': ['we arrange the rest', 'partners arrange the rest'],
  'found-you-a-trip': ['we found you a trip', 'we found a fare'],
  'booked-for-you': ['booked for you', 'tracked for you'],
  'secured': ['Your fare is secured', 'Fares change'],
  'locked-in': ['You locked in $400', 'You clicked through at $400'],
  'reserve': ['We reserve a seat', 'Sparkfare is a deal-information service'],
  'sparkfare-booking': ['your Sparkfare booking', 'your trip on My Trips'],
  'your-booking': ['Pick up your booking', 'Pick up where you left off'],
  'booking-confirmed': ['Booking confirmed', 'Looks like you booked Lisbon with the airline'],
  'names-aviasales': ['<a>Continue to Aviasales</a>', '<a>View fare</a>'],
  'seller-of-travel': ['we are a seller of travel', 'we are a deal-information service'],
  'travel-agency': ['not a travel agency', 'a deal-information service'],
  'licensed': ['a licensed seller', 'a deal-information service'],
  'exempt': ['we are exempt', 'we never take payment'],
  'registered-state': ['residents of California', 'residents of any state'],
};

test('every banned rule has a failing and a passing example, and both behave', () => {
  const allow = loadAllowlist();
  assert.deepEqual(Object.keys(EXAMPLES).sort(), BANNED.map((b) => b.id).sort());
  for (const [id, [bad, good]] of Object.entries(EXAMPLES)) {
    const hit = scanText(bad, 'x.html', allow).map((f) => f.id);
    assert.ok(hit.includes(id), `"${bad}" should trip ${id}, got [${hit}]`);
    assert.deepEqual(scanText(good, 'x.html', allow).map((f) => f.id), [], `"${good}" should pass`);
  }
});

test('allowed phrases, code identifiers and JS comments do not trip the check', () => {
  const allow = loadAllowlist();
  const ok = [
    'Aviasales handles booking and payment.',
    'Sparkfare may earn a commission if you buy through a link, at no extra cost to you.',
    "Sparkfare doesn't sell or book travel.",
    'href="${item.booking_link}" data-x="${bookingLink}"',
  ];
  for (const line of ok) assert.deepEqual(scanText(line, 'x.html', allow), [], line);
  const js = "// Book this fare is the old label\nconst a = 'View fare'; /* locked in */\nconst b = 'ok';";
  assert.deepEqual(scanText(js, 'x.js', allow), []);
  assert.equal(stripJsComments("const u = 'http://x.test/a'; // Book now").includes('Book now'), false);
  assert.ok(stripJsComments("const u = 'http://x.test/a';").includes('http://x.test/a'));
});

test('an exception only excuses its own file and line', () => {
  const allow = loadAllowlist();
  const line = '<p>Before you board, ensure your international health coverage is locked in place.</p>';
  assert.deepEqual(scanText(line, 'blog/tbilisi.html', allow), []);
  assert.equal(scanText(line, 'index.html', allow).length, 1);
});

// ---- one definition, referenced everywhere ----

test('the static footer script carries exactly the strings in src/referralCopy.js', () => {
  const js = read('site-footer.js');
  assert.ok(js.includes(copy.FOOTER_LINE_1.replace(/"/g, '\\"')) || js.includes(copy.FOOTER_LINE_1), 'footer line 1 drifted');
  assert.ok(js.includes(copy.FOOTER_LINE_2_TEXT), 'footer line 2 drifted');
  for (const link of ['/disclosure', '/terms', '/privacy']) assert.ok(js.includes(link));
});

test("index.html's grid disclosure matches src/referralCopy.js", () => {
  assert.ok(read('index.html').includes(`const GRID_DISCLOSURE = '${copy.GRID_DISCLOSURE}'`));
});

test('every static page carries the footer script', () => {
  const pages = ['index', 'account', 'away-mode', 'check', 'disclosure', 'hub', 'privacy', 'reward-terms', 'terms', 'trips', 'watchlists', '404'];
  for (const p of pages) assert.ok(read(`${p}.html`).includes('/site-footer.js'), `${p}.html is missing the footer script`);
  for (const dir of ['blog', 'data']) {
    const missing = fs.readdirSync(new URL(`../${dir}`, import.meta.url)).filter((f) => f.endsWith('.html') && !read(`${dir}/${f}`).includes('/site-footer.js'));
    assert.deepEqual(missing, [], `${dir}/ pages without the footer script`);
  }
  // Generators emit it too, so regenerating cannot drop it.
  assert.ok(read('Phase 17 pSEO Generator (Step 106).py').split('/site-footer.js').length - 1 >= 2);
  assert.ok(read('Phase 20 Blog Generator.py').includes('/site-footer.js'));
});

test('terms.html and disclosure.html carry the "what Sparkfare does and does not do" section verbatim', () => {
  for (const page of ['terms.html', 'disclosure.html']) {
    const html = read(page);
    assert.ok(html.includes(copy.ABOUT_SECTION_TITLE), `${page} title`);
    assert.ok(html.includes(copy.ABOUT_SECTION_TEXT), `${page} text`);
  }
  assert.match(read('sitemap.xml'), /<loc>https:\/\/sparkfare\.com\/terms<\/loc>/);
});

test('copy never asserts a legal status or names a state', () => {
  const all = Object.values(copy).filter((v) => typeof v === 'string').join(' ')
    + [copy.viewFareLabel('X'), copy.viewFareAria('X'), copy.postClickReason('Y', 'Dec 6'), copy.bookingReportedSubject('Y', 'X'), copy.bookingReportedOpening('X')].join(' ');
  assert.doesNotMatch(all, /seller of travel|travel agency|licensed|exempt|california|florida|hawaii|washington/i);
});

// ---- emails ----

function stubResend() {
  const sent = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes('resend.com')) {
      sent.push(JSON.parse(options.body));
      return new Response(JSON.stringify({ data: { id: 'test-id' }, error: null }), { status: 200 });
    }
    return original(url, options);
  };
  return { sent, restore: () => { globalThis.fetch = original; } };
}
const ENV = { RESEND_API_KEY: 'test-key', APP_URL: 'https://sparkfare.com', EMAIL_FROM: 'Sparkfare <hello@sparkfare.com>' };

test('booking-confirmed email attributes the purchase to the partner and never says Sparkfare holds a booking', async () => {
  const { sent, restore } = stubResend();
  try {
    await sendBookingConfirmedEmail({ email: 'a@example.com', destination: 'Lisbon, Portugal', trip_id: 't1' }, ENV);
  } finally { restore(); }
  assert.equal(sent[0].subject, 'Looks like you booked Lisbon, Portugal on Aviasales');
  assert.ok(sent[0].html.includes('Aviasales reported a purchase from your Sparkfare click.'));
  assert.ok(sent[0].html.includes(copy.EMAIL_FOOTER_LINE));
  assert.doesNotMatch(sent[0].html, /booking.{0,12}confirmed|is confirmed/i);
});

test('target-reached email: neutral button label, no "book now", footer line present', async () => {
  const { sent, restore } = stubResend();
  try {
    await sendTargetReachedEmail({ email: 'a@example.com', origin: 'JFK', destination: 'Lisbon, Portugal', price: 400, targetPrice: 450, bookingLink: 'https://www.aviasales.com/search/X?marker=1' }, ENV);
  } finally { restore(); }
  assert.ok(sent[0].html.includes('View fare'));
  assert.ok(!sent[0].html.includes('on Aviasales'));
  assert.doesNotMatch(sent[0].html, /book now|Book this fare/i);
  assert.ok(sent[0].html.includes(copy.EMAIL_FOOTER_LINE));
});

test('post-click v2: View fare button, new footer reason, footer line, doesnt-sell line, html and text', () => {
  const view = {
    trip: { destination: 'Tulum, Mexico', origin_iata: 'JFK', departure_at: '2026-12-06T08:00:00-05:00', return_at: '2026-12-13T08:00:00-05:00', price_at_click: 412 },
    items: [], appUrl: 'https://sparkfare.com', tripId: 't1', bookingLink: 'https://www.aviasales.com/search/X?marker=1',
    postalAddress: '1 Test Way', unsubscribeUrl: 'https://sparkfare.com/api/unsubscribe?token=x', clickedDate: 'Dec 6',
  };
  const html = renderV2Html(view);
  const text = renderV2Text(view);
  for (const out of [html, text]) {
    assert.ok(out.includes(copy.EMAIL_PRIMARY_BUTTON));
    assert.doesNotMatch(out, /Continue to Aviasales/);
    assert.ok(out.includes(copy.postClickReason('Tulum, Mexico', 'Dec 6')));
    assert.ok(out.includes(copy.EMAIL_FOOTER_LINE));
    assert.ok(out.includes("Sparkfare doesn't sell or book travel."));
    assert.doesNotMatch(out, /clicked Book|flight booking/);
  }
});
