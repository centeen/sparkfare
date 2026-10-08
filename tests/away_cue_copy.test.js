// Away Move 1 (ROADMAP step 69): the lifecycle emails open with a home-first line that names a cue.
// Disclosure stays first, the cue line holds no affiliate link, and nothing implies a result.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  sendStressValveEmail, sendDepartureBriefingEmail, sendDepartingSoonEmail, sendPreDepartureSequenceEmail,
} from '../src/email.js';

const BANNED = [/you're booked/i, /locked in/i, /secured/i, /guaranteed/i, /protected/i, /book now/i, /we book/i, /insur/i];

async function capture(fn, trip) {
  const original = globalThis.fetch;
  let sent = null;
  globalThis.fetch = async (url, options) => {
    const u = typeof url === 'string' ? url : url.url;
    if (u.includes('api.resend.com/emails')) {
      sent = JSON.parse(options.body);
      return new Response(JSON.stringify({ id: 'fake' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return original(url, options);
  };
  try {
    const r = await fn({ email: 'a@example.com', trip_id: 't1', destination: 'Lisbon, Portugal', departure_at: '2026-11-27T10:00:00-05:00', daysUntil: 7, ...trip }, { RESEND_API_KEY: 'k', APP_URL: 'https://sparkfare.com' });
    assert.equal(r.mocked, false);
    return sent.html;
  } finally { globalThis.fetch = original; }
}

const CASES = [
  ['stress valve', sendStressValveEmail, /pick the moment each job gets done/, /When you pack your bag, sort the mail/],
  ['departure briefing', sendDepartureBriefingEmail, /Three cues worth setting now/, /When you lock the door, text the person checking in/],
  ['departing soon', sendDepartingSoonEmail, /Last pass: home \(water, mail, who has a key\)/, /do it at your next cue/],
  ['pre-departure sequence', sendPreDepartureSequenceEmail, /Pick the moment you'll do it/, /when you pack your bag/],
];

for (const [name, fn, cue1, cue2] of CASES) {
  test(`${name}: names a cue, disclosure first, no link above the first disclosure, no implied result`, async () => {
    const html = await capture(fn);
    assert.match(html, cue1);
    assert.match(html, cue2);
    const disclosure = html.indexOf('Sparkfare may earn a commission');
    const cue = html.search(cue1);
    const firstLink = html.search(/href="[^"]*\/(out|go)\//);
    assert.ok(disclosure >= 0, 'disclosure present');
    assert.ok(disclosure < cue, 'disclosure comes before the cue line');
    assert.ok(firstLink > cue, 'no affiliate link at or above the cue line');
    assert.ok(firstLink > disclosure, 'no affiliate link above the disclosure');
    // The partner list below is unchanged (SafetyWing's blurb names insurance); the new copy above it must not.
    for (const re of BANNED) assert.doesNotMatch(html.slice(0, html.indexOf("<ul")), re, `matches ${re}`);
  });
}

test('/away-mode leads with the home and pet worries before the vendor list', () => {
  const page = readFileSync(new URL('../away-mode.html', import.meta.url), 'utf8');
  const sub = page.match(/<p class="sub">([\s\S]*?)<\/p>/)[1];
  assert.match(sub, /^Before you leave: the water, the mail, the pets, and who has a key/);
  assert.doesNotMatch(sub, /Everything else, handled/);
});
