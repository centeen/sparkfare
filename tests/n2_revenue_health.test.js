import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import worker from '../src/index.js';
import { checkRevenueHealth } from '../src/index.js';
import { sendVerificationEmail, sendRouteRetrospectiveEmail, sendSunsetEmail, sendSupportAutoResponder, sendRevenueHealthAlertEmail } from '../src/email.js';

// N2: revenue health monitor. While scoping this, a real, live, previously-undiscovered bug was
// found in src/email.js: 4 of 13 email-sending functions (sendVerificationEmail,
// sendRouteRetrospectiveEmail, sendSunsetEmail, sendSupportAutoResponder) called
// `logAwayModeEmail(env, { email, partnerId: partner.slug, emailType: 'pre_departure_day_' +
// daysUntil })` and returned `partner_slug: partner.slug` -- neither `partner` nor `daysUntil`
// (nor, for sendSupportAutoResponder, even `email`) is defined in any of their scopes. This was a
// copy-paste from sendPreDepartureSequenceEmail (the one function where it's correct), landed in
// commit 91038f2 (2026-09-23). Every real (non-mocked) send of these 4 email types threw a
// ReferenceError immediately AFTER Resend had already accepted and sent the email -- meaning every
// caller saw a thrown exception instead of a clean { ok: true } result, even though the email
// genuinely went out. This directly affects revenue: sendRouteRetrospectiveEmail and
// sendSunsetEmail both feed real send/reconciliation flows this project depends on for engagement
// and re-engagement.

function fakeFetchThatAcceptsResendSend() {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    const urlStr = typeof url === 'string' ? url : url.url;
    if (urlStr.includes('api.resend.com/emails')) {
      return new Response(JSON.stringify({ id: 'fake-message-id' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return original(url, options);
  };
  return () => { globalThis.fetch = original; };
}

test('N2: sendVerificationEmail no longer throws on a real (non-mocked) send', async () => {
  const restore = fakeFetchThatAcceptsResendSend();
  try {
    const env = { RESEND_API_KEY: 'fake_key_for_test', APP_URL: 'https://sparkfare.com' };
    const result = await sendVerificationEmail({ email: 'test@example.com', verificationUrl: 'https://sparkfare.com/verify?t=abc' }, env);
    assert.equal(result.ok, true);
    assert.equal(result.mocked, false);
    assert.ok(!('partner_slug' in result), 'sendVerificationEmail has no partner content and must not claim a partner_slug');
  } finally {
    restore();
  }
});

test('N2: sendRouteRetrospectiveEmail no longer throws on a real (non-mocked) send', async () => {
  const restore = fakeFetchThatAcceptsResendSend();
  try {
    const env = { RESEND_API_KEY: 'fake_key_for_test', APP_URL: 'https://sparkfare.com' };
    const result = await sendRouteRetrospectiveEmail({
      email: 'test@example.com', origin: 'JFK', destination: 'Lisbon, Portugal',
      lockedPrice: 400, currentAvg: 450, pctDiff: 0.11,
    }, env);
    assert.equal(result.ok, true);
    assert.equal(result.mocked, false);
  } finally {
    restore();
  }
});

test('N2: sendSunsetEmail no longer throws on a real (non-mocked) send', async () => {
  const restore = fakeFetchThatAcceptsResendSend();
  try {
    const env = { RESEND_API_KEY: 'fake_key_for_test', APP_URL: 'https://sparkfare.com' };
    const result = await sendSunsetEmail({ email: 'test@example.com' }, env);
    assert.equal(result.ok, true);
    assert.equal(result.mocked, false);
  } finally {
    restore();
  }
});

test('N2: sendSupportAutoResponder no longer throws on a real (non-mocked) send', async () => {
  const restore = fakeFetchThatAcceptsResendSend();
  try {
    const env = { RESEND_API_KEY: 'fake_key_for_test' };
    const result = await sendSupportAutoResponder(env, 'test@example.com');
    assert.equal(result.ok, true);
    assert.equal(result.mocked, false);
  } finally {
    restore();
  }
});

test('N2: static guard -- the logAwayModeEmail/partner_slug tail only appears in a function that actually has daysUntil in scope', async () => {
  // Several functions (sendAwayModeFollowUpEmail, sendStressValveEmail, sendDepartureBriefingEmail,
  // sendPreDepartureSequenceEmail) legitimately pick a local `const partner = partners[0]` and
  // reference `partner.slug` for real reasons unrelated to this bug -- so the precise regression
  // signature isn't "mentions partner.slug" in general, it's specifically the
  // `emailType: 'pre_departure_day_' + daysUntil` construction (and the matching
  // `partner_slug: partner.slug` return), which can only be valid in a function whose own
  // destructured parameters actually include `daysUntil`.
  const emailJsPath = path.resolve(process.cwd(), 'src/email.js');
  const content = fs.readFileSync(emailJsPath, 'utf8');
  const functionBlocks = content.split(/(?=^export async function )/m);

  let checkedAtLeastOne = false;
  for (const block of functionBlocks) {
    const nameMatch = block.match(/^export async function (\w+)\(([^)]*)\)/);
    if (!nameMatch) continue;
    const [, name, paramList] = nameMatch;
    const hasDaysUntilParam = /\bdaysUntil\b/.test(paramList);
    // Strip // comment lines first -- several of these functions carry an explanatory comment
    // (added by this very fix) that quotes the old buggy code in prose, which would otherwise
    // false-positive this check on the exact functions it just fixed.
    const codeOnly = block.split('\n').filter(line => !line.trim().startsWith('//')).join('\n');
    const usesBrokenPattern = codeOnly.includes("emailType: 'pre_departure_day_' + daysUntil");
    if (usesBrokenPattern) {
      checkedAtLeastOne = true;
      assert.ok(hasDaysUntilParam, `${name} uses the 'pre_departure_day_' + daysUntil pattern but does not declare daysUntil as a parameter -- this is the exact N2 regression (ReferenceError on every real send)`);
    }
  }
  assert.ok(checkedAtLeastOne, 'expected at least one function (sendPreDepartureSequenceEmail) to legitimately use this pattern');
});

test('N2: checkRevenueHealth flags a missing TRAVELPAYOUTS_TOKEN and sends an alert', async () => {
  const restore = fakeFetchThatAcceptsResendSend();
  try {
    const env = { RESEND_API_KEY: 'fake_key_for_test' }; // no TRAVELPAYOUTS_TOKEN, no DB
    const result = await checkRevenueHealth(env, null);
    assert.equal(result.healthy, false);
    assert.ok(result.problems.some(p => p.includes('TRAVELPAYOUTS_TOKEN')));
    assert.equal(result.alert.ok, true);
    assert.equal(result.alert.mocked, false);
  } finally {
    restore();
  }
});

test('N2: checkRevenueHealth flags a reconcileBookings() error passed in by the caller', async () => {
  // TRAVELPAYOUTS_TOKEN must be set here -- if it weren't, reconcileBookings() would never have
  // attempted the real API call in the first place (it short-circuits to mocked mode), so a
  // thrown reconcileResult.error only happens in the realistic case where the token IS configured
  // but the actual Travelpayouts call failed.
  const env = { TRAVELPAYOUTS_TOKEN: 'real-token' }; // no RESEND_API_KEY -- alert send mocks, fine here
  const result = await checkRevenueHealth(env, { error: 'Travelpayouts statistics API returned 500: server error' });
  assert.equal(result.healthy, false);
  assert.ok(result.problems.some(p => p.includes('reconcileBookings() failed')));
});

test('N2: checkRevenueHealth is healthy when TRAVELPAYOUTS_TOKEN is set and reconciliation succeeded', async () => {
  const env = { TRAVELPAYOUTS_TOKEN: 'real-token', DB: null }; // no DB -- partner_conversions check is skipped
  const result = await checkRevenueHealth(env, { ok: true, checked: 3, matched: 0, updated: 0 });
  assert.equal(result.healthy, true);
  assert.deepEqual(result.problems, []);
  assert.equal(result.alert, null);
});

test('N2: checkRevenueHealth flags a stale (empty) partner_conversions table past day 7 of the month', async () => {
  const restore = fakeFetchThatAcceptsResendSend();
  try {
    const fixedNow = new Date(Date.UTC(2026, 8, 20)); // 2026-09-20, well past day 7
    const realDate = globalThis.Date;
    class MockDate extends realDate {
      constructor(...args) {
        if (args.length === 0) return new realDate(fixedNow);
        return new realDate(...args);
      }
      static now() { return fixedNow.getTime(); }
    }
    globalThis.Date = MockDate;

    const env = {
      RESEND_API_KEY: 'fake_key_for_test',
      TRAVELPAYOUTS_TOKEN: 'real-token',
      DB: {
        prepare: (sql) => ({
          bind: () => ({
            first: async () => {
              if (sql.includes('FROM partner_conversions')) return { n: 0 };
              return null;
            },
          }),
        }),
      },
    };

    globalThis.Date = realDate;
    const result = await checkRevenueHealth(env, { ok: true, checked: 0, matched: 0, updated: 0 });
    assert.equal(result.healthy, false);
    assert.ok(result.problems.some(p => p.includes('partner_conversions')));
  } finally {
    restore();
  }
});

test('N2: POST /api/check-revenue-health runs reconciliation and returns a health report', async () => {
  const env = {}; // no DB, no TRAVELPAYOUTS_TOKEN, no RESEND_API_KEY -- every step mocks cleanly
  const req = new Request('https://sparkfare.com/api/check-revenue-health', { method: 'POST' });
  const res = await worker.fetch(req, env, { waitUntil: () => {} });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.healthy, false); // no TRAVELPAYOUTS_TOKEN -- correctly flagged
  assert.ok(Array.isArray(data.problems));
});
