import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAffiliateLinkHealth } from '../src/index.js';

// Step 117: checkAffiliateLinkHealth used to only console.warn on a broken link, so a dead
// partner link (lost commission) was invisible unless someone happened to be tailing logs. It now
// returns the broken list and emails hello@sparkfare.com. Only 404/410/5xx and network errors
// count -- 403/405 on a HEAD request against a tracking domain is normal, not a dead link.

function makeEnv(partners) {
  return {
    RESEND_API_KEY: 'fake_key_for_test',
    DB: {
      prepare: () => ({
        all: async () => ({
          results: partners.map(p => ({ slug: p.slug, name: p.name, category: 'x', link: p.url, blurb: '' })),
        }),
      }),
    },
  };
}

function stubFetch(statusByUrl, sentAlerts) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    const urlStr = typeof url === 'string' ? url : url.url;
    if (urlStr.includes('api.resend.com/emails')) {
      sentAlerts.push(JSON.parse(options.body));
      return new Response(JSON.stringify({ id: 'fake-id' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    const status = statusByUrl[urlStr];
    if (status === 'throw') throw new Error('too many redirects');
    return new Response(null, { status: status ?? 200 });
  };
  return () => { globalThis.fetch = original; };
}

test('Step 117: dead links are returned and emailed; 403/405/2xx are healthy', async () => {
  const sent = [];
  const restore = stubFetch({
    'https://good.example/a': 200,
    'https://blocked.example/b': 403,
    'https://nohead.example/c': 405,
    'https://gone.example/d': 404,
    'https://expired.example/e': 410,
    'https://down.example/f': 503,
    'https://loop.example/g': 'throw',
  }, sent);
  try {
    const env = makeEnv([
      { slug: 'good', name: 'Good', url: 'https://good.example/a' },
      { slug: 'blocked', name: 'Blocked', url: 'https://blocked.example/b' },
      { slug: 'nohead', name: 'NoHead', url: 'https://nohead.example/c' },
      { slug: 'gone', name: 'Gone', url: 'https://gone.example/d' },
      { slug: 'expired', name: 'Expired', url: 'https://expired.example/e' },
      { slug: 'down', name: 'Down', url: 'https://down.example/f' },
      { slug: 'loop', name: 'Loop', url: 'https://loop.example/g' },
    ]);
    const result = await checkAffiliateLinkHealth(env);

    assert.equal(result.ok, true);
    assert.equal(result.checked, 7);
    assert.deepEqual(result.broken.map(b => b.slug).sort(), ['down', 'expired', 'gone', 'loop']);
    assert.equal(result.alerted, true);

    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, 'hello@sparkfare.com');
    assert.match(sent[0].subject, /4 broken links/);
    assert.match(sent[0].html, /Gone/);
    assert.doesNotMatch(sent[0].html, /Blocked/);
  } finally {
    restore();
  }
});

test('Step 117: all-healthy run sends no email', async () => {
  const sent = [];
  const restore = stubFetch({ 'https://good.example/a': 200 }, sent);
  try {
    const result = await checkAffiliateLinkHealth(makeEnv([{ slug: 'good', name: 'Good', url: 'https://good.example/a' }]));
    assert.deepEqual(result.broken, []);
    assert.equal(result.alerted, false);
    assert.equal(sent.length, 0);
  } finally {
    restore();
  }
});

test('Step 117: a failing alert send does not crash the check', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const urlStr = typeof url === 'string' ? url : url.url;
    if (urlStr.includes('api.resend.com/emails')) throw new Error('resend down');
    return new Response(null, { status: 404 });
  };
  try {
    const result = await checkAffiliateLinkHealth(makeEnv([{ slug: 'gone', name: 'Gone', url: 'https://gone.example/d' }]));
    assert.equal(result.broken.length, 1);
    assert.equal(result.alerted, false);
  } finally {
    globalThis.fetch = original;
  }
});

test('Step 117: {IATA} placeholder is filled in before probing, so templated links are not falsely flagged', async () => {
  const sent = [];
  const probed = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    const urlStr = typeof url === 'string' ? url : url.url;
    if (urlStr.includes('api.resend.com/emails')) {
      sent.push(JSON.parse(options.body));
      return new Response(JSON.stringify({ id: 'fake-id' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    probed.push(urlStr);
    // The literal-braces URL 404s on the real site; a real airport code works.
    return new Response(null, { status: urlStr.includes('{IATA}') ? 404 : 200 });
  };
  try {
    const result = await checkAffiliateLinkHealth(makeEnv([
      { slug: 'parking-access', name: 'Parking Access', url: 'https://parkingaccess.com/go/{IATA}?rfid=abc' },
    ]));
    assert.deepEqual(probed, ['https://parkingaccess.com/go/JFK?rfid=abc']);
    assert.deepEqual(result.broken, []);
    assert.equal(sent.length, 0);
  } finally {
    globalThis.fetch = original;
  }
});
