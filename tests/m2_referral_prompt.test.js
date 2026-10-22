import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { handleRequest } from '../src/index.js';
import { signWelcomeToken } from '../src/welcome.js';
import { renderDailyDigest } from '../src/emailTemplates/dailyDigest.js';
import { sendVerificationEmail } from '../src/email.js';

const welcomeHtml = fs.readFileSync(new URL('../welcome.html', import.meta.url), 'utf8');
const hubHtml = fs.readFileSync(new URL('../hub.html', import.meta.url), 'utf8');
const termsHtml = fs.readFileSync(new URL('../reward-terms.html', import.meta.url), 'utf8');

const APPROVED_PROMPT = "Know someone who'd use this? Share your link. When three friends confirm, you can watch up to 10 routes instead of 3.";

test('welcome.html contains the referral prompt markup, hidden by default', () => {
  assert.match(welcomeHtml, /id="referral-prompt-card"/);
  assert.match(welcomeHtml, /hidden/);
  assert.match(welcomeHtml, /Know someone who'd use this\? Share your link\. When three friends confirm, you can watch up to 10 routes instead of 3\./);
  assert.match(welcomeHtml, /id="welcome-ref-link"[\s\S]*readonly[\s\S]*aria-label="Your referral link"/);
  assert.match(welcomeHtml, /id="welcome-copy-btn"/);
  assert.match(welcomeHtml, /id="welcome-copy-status"/);
  // Uses brand design tokens, no hardcoded colors
  assert.ok(!/#B8720F|#3B5B57|#1D2321/i.test(welcomeHtml.slice(welcomeHtml.indexOf('referral-prompt-card'))));
});

test('GET /api/welcome returns prompt: false when flag is off or unset', async () => {
  const secret = 'test-secret-12345';
  const token = await signWelcomeToken(secret, 'user_123');
  const env = {
    UNSUBSCRIBE_SECRET: secret,
    ENABLE_REFERRAL_PROMPT: 'false',
    DB: {
      prepare: () => ({
        bind: () => ({ first: async () => null, run: async () => ({}) })
      })
    }
  };
  const req = new Request(`http://localhost/api/welcome?t=${encodeURIComponent(token)}`);
  const res = await handleRequest(req, env, { waitUntil: () => {} });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.prompt, false);
});

test('GET /api/welcome returns prompt: true with working link when flag is on and token is valid', async () => {
  const secret = 'test-secret-12345';
  const token = await signWelcomeToken(secret, 'user_123');
  let queriedUserId = null;
  const env = {
    UNSUBSCRIBE_SECRET: secret,
    ENABLE_REFERRAL_PROMPT: 'true',
    APP_URL: 'https://sparkfare.com',
    DB: {
      prepare: (sql) => ({
        bind: (...params) => ({
          first: async () => {
            if (sql.includes('SELECT code FROM referral_codes')) {
              queriedUserId = params[0];
              return { code: 'ref_abc123' };
            }
            return null;
          },
          run: async () => ({ success: true })
        })
      })
    }
  };
  const req = new Request(`http://localhost/api/welcome?t=${encodeURIComponent(token)}`);
  const res = await handleRequest(req, env, { waitUntil: () => {} });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.prompt, true);
  assert.equal(data.code, 'ref_abc123');
  assert.equal(data.link, 'https://sparkfare.com/r/ref_abc123');
  assert.equal(queriedUserId, 'user_123');
});

test('GET /api/welcome with invalid token returns prompt: false', async () => {
  const env = {
    UNSUBSCRIBE_SECRET: 'test-secret',
    ENABLE_REFERRAL_PROMPT: 'true',
    DB: { prepare: () => ({ bind: () => ({ first: async () => null, run: async () => ({}) }) }) }
  };
  const req = new Request('http://localhost/api/welcome?t=bad_token');
  const res = await handleRequest(req, env, { waitUntil: () => {} });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.prompt, false);
});

test('sendVerificationEmail includes referral prompt when flag is on and referralUrl is given', async () => {
  const origFetch = globalThis.fetch;
  let capturedBody = null;
  globalThis.fetch = async (url, init) => {
    try { capturedBody = JSON.parse(init.body); } catch { capturedBody = {}; }
    return new Response(JSON.stringify({ id: 'msg_123' }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };

  try {
    const env = {
      RESEND_API_KEY: 're_mock_key',
      ENABLE_REFERRAL_PROMPT: 'true',
      APP_URL: 'https://sparkfare.com'
    };

    await sendVerificationEmail(
      { email: 'user@example.com', verificationUrl: 'https://sparkfare.com/verify?t=1', referralUrl: 'https://sparkfare.com/r/ref_xyz' },
      env
    );

    assert.ok(capturedBody, 'email should be sent');
    assert.match(capturedBody.html, /Know someone who(&#39;|')d use this\?/);
    assert.match(capturedBody.html, /https:\/\/sparkfare\.com\/r\/ref_xyz/);
    assert.match(capturedBody.html, /When three friends confirm, you can watch up to 10 routes instead of 3\./);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('sendVerificationEmail omits referral prompt when flag is off', async () => {
  const origFetch = globalThis.fetch;
  let capturedBody = null;
  globalThis.fetch = async (url, init) => {
    try { capturedBody = JSON.parse(init.body); } catch { capturedBody = {}; }
    return new Response(JSON.stringify({ id: 'msg_123' }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };

  try {
    const env = {
      RESEND_API_KEY: 're_mock_key',
      ENABLE_REFERRAL_PROMPT: 'false',
      APP_URL: 'https://sparkfare.com'
    };

    await sendVerificationEmail(
      { email: 'user@example.com', verificationUrl: 'https://sparkfare.com/verify?t=1', referralUrl: 'https://sparkfare.com/r/ref_xyz' },
      env
    );

    assert.ok(capturedBody, 'email should be sent');
    assert.doesNotMatch(capturedBody.html, /When three friends confirm/);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('dailyDigest renders M2 referral prompt when enableReferralPrompt is true', () => {
  const result = renderDailyDigest({
    origin: 'JFK',
    city: 'New York',
    dateLabel: 'Oct 21',
    subject: 'Sample Digest',
    preheader: 'Deals',
    deals: [{
      destination: 'Paris',
      price: 350,
      booking_link: 'https://www.aviasales.com/flight',
      usual_price: 600,
      pct_below_usual: 41,
      departure_at: '2026-11-10',
      return_at: '2026-11-20',
      is_deal: true
    }],
    user: { email: 'subscriber@example.com' },
    config: {
      enableReferralPrompt: true,
      appUrl: 'https://sparkfare.com',
      referralUrl: 'https://sparkfare.com/r/ref_digest'
    }
  });

  // Replaces the old text in HTML
  assert.match(result.html, /Know someone who(&#39;|')d use this\?/);
  assert.match(result.html, /Share your link: <a [^>]*href="https:\/\/sparkfare\.com\/r\/ref_digest/);
  assert.match(result.html, /When three friends confirm, you can watch up to 10 routes instead of 3\./);
  assert.doesNotMatch(result.html, /get the same daily fares/);

  // Text mode
  assert.match(result.text, /Know someone who'd use this\? Share your link: https:\/\/sparkfare\.com\/r\/ref_digest/);
  assert.match(result.text, /When three friends confirm, you can watch up to 10 routes instead of 3\./);
});

test('dailyDigest retains original referral ask when enableReferralPrompt is false/unset', () => {
  const result = renderDailyDigest({
    origin: 'JFK',
    city: 'New York',
    dateLabel: 'Oct 21',
    subject: 'Sample Digest',
    preheader: 'Deals',
    deals: [],
    user: { email: 'subscriber@example.com' },
    config: {
      enableReferralPrompt: false,
      appUrl: 'https://sparkfare.com',
      referralUrl: 'https://sparkfare.com/r/ref_digest'
    }
  });

  assert.match(result.html, /Friends who sign up through your link get the same daily fares/);
  assert.doesNotMatch(result.html, /When three friends confirm/);
});

test('hub.html and reward-terms.html tier corrections: unbuilt second airport and empty early-access removed', () => {
  // hub.html
  assert.doesNotMatch(hubHtml, /Extra Origin/i);
  assert.doesNotMatch(hubHtml, /second home airport/i);
  assert.doesNotMatch(hubHtml, /Early Access/i);
  assert.doesNotMatch(hubHtml, /beta features/i);
  assert.match(hubHtml, /id="tier-3"/);
  assert.match(hubHtml, /Watch up to 10 routes at once instead of 3/);
  assert.match(hubHtml, /id="tier-10"/);
  assert.match(hubHtml, /Founding Member/);

  // reward-terms.html
  assert.doesNotMatch(termsHtml, /Extra Origin/i);
  assert.doesNotMatch(termsHtml, /second home airport/i);
  assert.doesNotMatch(termsHtml, /Early Access/i);
  assert.match(termsHtml, /3 Referrals \(More Watchlist Routes\):/);
  assert.match(termsHtml, /watch up to 10 routes at once instead of 3/i);
  assert.match(termsHtml, /10 Referrals \(Founding Member\):/);
});
