// The lifecycle emails name the departure date and say "today / tomorrow / in N days". The Worker runs in
// UTC, so formatting the departure with `new Date(iso).toLocaleDateString()` and counting elapsed hours moved
// an evening departure to the next date and "tomorrow" to "in 2 days". Both now read the date as written,
// in the departure's own UTC offset.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatLongDate, calendarDaysUntil } from '../src/postClickEmail.js';
import { sendStressValveEmail, sendDepartureBriefingEmail, sendDepartingSoonEmail } from '../src/email.js';

test('formatLongDate reads the calendar date as written', () => {
  assert.equal(formatLongDate('2026-10-24T22:35:00-04:00'), 'October 24');
  assert.equal(formatLongDate('2026-11-23T01:55:00-05:00'), 'November 23');
  assert.equal(formatLongDate('2026-12-06'), 'December 6');
  assert.equal(formatLongDate('not a date'), null);
  assert.equal(formatLongDate(null), null);
  assert.equal(formatLongDate('2026-13-01'), null);
});

test('calendarDaysUntil counts calendar days in the departure offset', () => {
  const at = (iso) => Date.parse(iso);
  // 22:35 local on Oct 24, now 08:00 UTC Oct 23 (04:00 local): tomorrow, not "in 2 days".
  assert.equal(calendarDaysUntil('2026-10-24T22:35:00-04:00', at('2026-10-23T08:00:00Z')), 1);
  // 06:00 local today, now 04:00 local: today, not tomorrow.
  assert.equal(calendarDaysUntil('2026-10-23T06:00:00-04:00', at('2026-10-23T08:00:00Z')), 0);
  // A UTC "now" that is still the previous day in a far-east offset.
  assert.equal(calendarDaysUntil('2026-10-24T09:00:00+09:00', at('2026-10-23T20:00:00Z')), 0);
  assert.equal(calendarDaysUntil('2026-10-24T09:00:00+09:00', at('2026-10-22T20:00:00Z')), 1);
  // Seven days out by the calendar, whatever the hour.
  assert.equal(calendarDaysUntil('2026-11-27T10:00:00-05:00', at('2026-11-20T11:00:00Z')), 7);
  assert.equal(calendarDaysUntil('2026-11-27T23:00:00-05:00', at('2026-11-20T11:00:00Z')), 7);
  // No offset or a date only: read in UTC.
  assert.equal(calendarDaysUntil('2026-11-27', at('2026-11-25T23:00:00Z')), 2);
  assert.equal(calendarDaysUntil('2026-11-27T10:00:00Z', at('2026-11-26T01:00:00Z')), 1);
  // Past dates are negative; unreadable input is null.
  assert.equal(calendarDaysUntil('2026-11-20T10:00:00Z', at('2026-11-22T01:00:00Z')), -2);
  assert.equal(calendarDaysUntil('garbage', at('2026-11-22T01:00:00Z')), null);
  assert.equal(calendarDaysUntil(null, at('2026-11-22T01:00:00Z')), null);
});

async function render(fn, trip) {
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
    const r = await fn({ email: 'a@example.com', trip_id: 't1', destination: 'Lisbon, Portugal', ...trip }, { RESEND_API_KEY: 're_test', APP_URL: 'https://sparkfare.com' });
    assert.equal(r.mocked, false);
    return sent;
  } finally { globalThis.fetch = original; }
}

// 22:35 on Oct 24 at -04:00 is 02:35Z on Oct 25: the case the old formatting got wrong.
// (The pre-departure sequence email does not print the date, only "in N days", so it is not in this list.)
const EVENING = '2026-10-24T22:35:00-04:00';

for (const [name, fn, extra] of [
  ['stress valve', sendStressValveEmail, {}],
  ['departure briefing', sendDepartureBriefingEmail, {}],
  ['departing soon', sendDepartingSoonEmail, { daysUntil: 1 }],
]) {
  test(`${name}: an evening departure keeps its local date`, async () => {
    const sent = await render(fn, { departure_at: EVENING, ...extra });
    assert.match(sent.html, /October 24/);
    assert.doesNotMatch(sent.html, /October 25/);
  });
}

test('departing soon: the caller\'s calendar day count is what the subject says', async () => {
  const sent = await render(sendDepartingSoonEmail, { departure_at: EVENING, daysUntil: 1 });
  assert.match(sent.subject, /^Departing tomorrow/);
});
