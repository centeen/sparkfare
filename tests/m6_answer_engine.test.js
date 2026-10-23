// tests/m6_answer_engine.test.js
// Package M6 (ROADMAP step 146): Answer-engine basics test suite.
// Verifies method page (/how-it-works), Q&A blocks, structured data schemas,
// llms.txt, IndexNow key resolution and ping utility, and brand compliance.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import worker from '../src/index.js';
import { renderTimeOffIndex, renderTimeOffOrigin, TIME_OFF_FAQS, TIME_OFF_FAQ_SCHEMA } from '../src/ptoPages.js';
import { INDEXNOW_KEY, INDEXNOW_KEY_FILE, buildIndexNowPayload, pingIndexNow } from '../src/indexNow.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('M6: /how-it-works page structure, tokens, brand rules, and core methodology math', () => {
  const html = read('how-it-works.html');

  // Single H1, skip-link, tokens and header
  assert.match(html, /<h1[^>]*>How Sparkfare Works<\/h1>/);
  assert.equal((html.match(/<h1/g) || []).length, 1, 'Exactly one h1 tag on the page');
  assert.ok(html.includes('<a class="skip-link" href="#main">Skip to content</a>'), 'Contains skip-link');
  assert.ok(html.includes('/brand/tokens.css'), 'Uses Brand v1 tokens');
  assert.ok(html.includes('/brand/fonts.css'), 'Uses Brand v1 fonts');
  assert.ok(html.includes('/brand/header.css'), 'Uses shared header styling');
  assert.ok(html.includes('/site-footer.js'), 'Includes site footer script');

  // Core ranking math stated plainly
  assert.ok(html.includes('30-Day Median'), 'Explains 30-day median baseline');
  assert.ok(html.includes('15% Deal Floor'), 'Explains 15% deal floor (D-021)');
  assert.ok(html.includes('10-Day Minimum History') || html.includes('10 distinct observation days'), 'Explains 10 observation days minimum');
  assert.ok(html.includes('48-hour freshness') || html.includes('48-Hour Freshness'), 'Explains 48-hour freshness cutoff');
  assert.ok(html.includes('3-day lapse') || html.includes('3 calendar days'), 'Explains 3-day lapse rule');

  // What the price is not & disclaimers
  assert.ok(html.includes('Sparkfare does not sell or book travel.'), 'Contains canonical disclaimer');
  assert.ok(html.includes('No price predictions'), 'Explicitly denies price predictions');

  // Links to core tools
  assert.ok(html.includes('href="/check"'), 'Links to /check');
  assert.ok(html.includes('href="/time-off"'), 'Links to /time-off');
  assert.ok(html.includes('href="/reports/holiday-2026"'), 'Links to Holiday Fare Report');
});

test('M6: /how-it-works structured data validates and matches visible FAQ content exactly', () => {
  const html = read('how-it-works.html');

  const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(jsonLdMatch, 'Page contains JSON-LD structured data');

  const schema = JSON.parse(jsonLdMatch[1]);
  const graph = schema['@graph'] || [schema];

  const faqSchema = graph.find((item) => item['@type'] === 'FAQPage');
  assert.ok(faqSchema, 'Contains FAQPage schema');
  assert.ok(Array.isArray(faqSchema.mainEntity), 'FAQPage has mainEntity array');
  assert.ok(faqSchema.mainEntity.length >= 3, 'At least 3 Q&A items in schema');

  for (const entity of faqSchema.mainEntity) {
    assert.equal(entity['@type'], 'Question');
    assert.ok(entity.name, 'Question has name');
    assert.ok(entity.acceptedAnswer && entity.acceptedAnswer.text, 'Question has acceptedAnswer text');

    // Schema text must match visible HTML text
    assert.ok(html.includes(entity.name), `Visible page contains question: "${entity.name}"`);
    assert.ok(html.includes(entity.acceptedAnswer.text), `Visible page contains answer for: "${entity.name}"`);

    // Sentence count rule: 2 to 4 sentences
    const sentences = entity.acceptedAnswer.text.split(/(?<=[.!?])\s+/).filter(Boolean);
    assert.ok(sentences.length >= 2 && sentences.length <= 4, `Answer must be 2-4 sentences, got ${sentences.length}: "${entity.acceptedAnswer.text}"`);
  }
});

test('M6: /check page has WebApplication and FAQPage structured data matching real visible content', () => {
  const html = read('check.html');

  assert.ok(html.includes('href="/how-it-works"'), 'check.html links to /how-it-works');

  const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(jsonLdMatch, 'check.html contains JSON-LD script');

  const schema = JSON.parse(jsonLdMatch[1]);
  const graph = schema['@graph'] || [schema];

  const webApp = graph.find((item) => item['@type'] === 'WebApplication');
  assert.ok(webApp, 'Contains WebApplication schema');
  assert.equal(webApp.url, 'https://sparkfare.com/check');

  const faqSchema = graph.find((item) => item['@type'] === 'FAQPage');
  assert.ok(faqSchema, 'Contains FAQPage schema');
  assert.ok(faqSchema.mainEntity.length >= 3, 'check.html has at least 3 FAQ items');

  for (const entity of faqSchema.mainEntity) {
    assert.ok(html.includes(entity.name), `check.html visible DOM contains question: "${entity.name}"`);
    assert.ok(html.includes(entity.acceptedAnswer.text), `check.html visible DOM contains answer for: "${entity.name}"`);

    const sentences = entity.acceptedAnswer.text.split(/(?<=[.!?])\s+/).filter(Boolean);
    assert.ok(sentences.length >= 2 && sentences.length <= 4, `Answer must be 2-4 sentences, got ${sentences.length}`);
  }
});

test('M6: /time-off pages have FAQ blocks and FAQPage structured data matching real visible content', () => {
  const indexHtml = renderTimeOffIndex({ appUrl: 'https://sparkfare.com', now: new Date('2026-10-23T12:00:00Z') });
  const originHtml = renderTimeOffOrigin({
    origin: 'JFK',
    budget: 10,
    keys: ['new_years', 'memorial_day', 'independence_day', 'labor_day', 'thanksgiving', 'day_after_thanksgiving', 'christmas'],
    now: new Date('2026-10-23T12:00:00Z'),
    appUrl: 'https://sparkfare.com',
  });

  for (const [name, html] of [['/time-off', indexHtml], ['/time-off/jfk', originHtml]]) {
    assert.ok(html.includes('href="/how-it-works"'), `${name} links to /how-it-works`);
    assert.ok(html.includes('id="time-off-faq"'), `${name} contains FAQ card`);

    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    assert.ok(jsonLdMatch, `${name} contains JSON-LD structured data`);

    const schema = JSON.parse(jsonLdMatch[1]);
    assert.equal(schema['@type'], 'FAQPage');
    assert.ok(schema.mainEntity.length >= 3, `${name} schema has at least 3 FAQ items`);

    for (const entity of schema.mainEntity) {
      assert.ok(html.includes(entity.name), `${name} visible DOM contains question: "${entity.name}"`);
      assert.ok(html.includes(entity.acceptedAnswer.text), `${name} visible DOM contains answer for: "${entity.name}"`);

      const sentences = entity.acceptedAnswer.text.split(/(?<=[.!?])\s+/).filter(Boolean);
      assert.ok(sentences.length >= 2 && sentences.length <= 4, `Answer must be 2-4 sentences, got ${sentences.length}`);
    }
  }
});

test('M6: Route pages and Holiday Fare Report link to /how-it-works', () => {
  // src/index.js renderRoutePage
  const workerSrc = read('src/index.js');
  assert.ok(workerSrc.includes('href="/how-it-works"'), 'src/index.js route page template links to /how-it-works');

  // Phase 17 pSEO generator
  const pseoGen = read('Phase 17 pSEO Generator (Step 106).py');
  assert.ok(pseoGen.includes('href="/how-it-works"'), 'pSEO generator links to /how-it-works');

  // Holiday Fare Report
  const reportHtml = read('reports/holiday-2026.html');
  assert.ok(reportHtml.includes('href="/how-it-works"'), 'reports/holiday-2026.html links to /how-it-works');

  const reportModule = read('src/holidayReport.js');
  assert.ok(reportModule.includes('href="/how-it-works"'), 'src/holidayReport.js links to /how-it-works');
});

test('M6: root llms.txt lists method page, report, /check, and /time-off with canonical disclaimer', () => {
  const llms = read('llms.txt');

  assert.ok(llms.startsWith('# Sparkfare'), 'llms.txt starts with # Sparkfare');
  assert.ok(llms.includes('Sparkfare does not sell or book travel.'), 'llms.txt includes canonical disclaimer');
  assert.ok(llms.includes('https://sparkfare.com/how-it-works'), 'llms.txt lists /how-it-works');
  assert.ok(llms.includes('https://sparkfare.com/reports/holiday-2026'), 'llms.txt lists holiday report');
  assert.ok(llms.includes('https://sparkfare.com/check'), 'llms.txt lists /check');
  assert.ok(llms.includes('https://sparkfare.com/time-off'), 'llms.txt lists /time-off');
});

test('M6: IndexNow key file and ping utility', async () => {
  // Key file on disk
  const keyFileOnDisk = read(INDEXNOW_KEY_FILE).trim();
  assert.equal(keyFileOnDisk, INDEXNOW_KEY, 'Key file content matches INDEXNOW_KEY');
  assert.match(INDEXNOW_KEY, /^[a-f0-9]{8,128}$/, 'INDEXNOW_KEY is valid hex format');

  // Payload builder
  const payload = buildIndexNowPayload({
    urls: ['https://sparkfare.com/how-it-works', 'https://sparkfare.com/check'],
  });
  assert.equal(payload.host, 'sparkfare.com');
  assert.equal(payload.key, INDEXNOW_KEY);
  assert.equal(payload.keyLocation, `https://sparkfare.com/${INDEXNOW_KEY}.txt`);
  assert.deepEqual(payload.urlList, ['https://sparkfare.com/how-it-works', 'https://sparkfare.com/check']);

  // Ping utility with mock fetch
  let captured = null;
  const mockFetch = async (url, opts) => {
    captured = { url, opts, body: JSON.parse(opts.body) };
    return { status: 200, ok: true };
  };

  const res = await pingIndexNow({
    urls: ['https://sparkfare.com/how-it-works'],
    fetchFn: mockFetch,
  });

  assert.equal(res.ok, true);
  assert.equal(res.status, 200);
  assert.equal(captured.url, 'https://api.indexnow.org/indexnow');
  assert.equal(captured.opts.method, 'POST');
  assert.deepEqual(captured.body.urlList, ['https://sparkfare.com/how-it-works']);
});

test('M6: Worker routes /how-it-works, /llms.txt, and IndexNow key', async () => {
  const env = {
    ASSETS: {
      fetch: async (req) => {
        const url = new URL(req.url);
        const filename = url.pathname.replace(/^\//, '');
        if (fs.existsSync(path.join(ROOT, filename))) {
          return new Response(fs.readFileSync(path.join(ROOT, filename), 'utf8'), { status: 200 });
        }
        return new Response('not found', { status: 404 });
      },
    },
  };

  // /how-it-works
  const resHow = await worker.fetch(new Request('https://sparkfare.com/how-it-works'), env, { waitUntil() {} });
  assert.equal(resHow.status, 200);
  assert.equal(resHow.headers.get('Content-Type'), 'text/html; charset=utf-8');
  const textHow = await resHow.text();
  assert.ok(textHow.includes('How Sparkfare Works'));

  // /llms.txt
  const resLlms = await worker.fetch(new Request('https://sparkfare.com/llms.txt'), env, { waitUntil() {} });
  assert.equal(resLlms.status, 200);
  assert.ok(resLlms.headers.get('Content-Type').includes('text/plain'));
  const textLlms = await resLlms.text();
  assert.ok(textLlms.includes('# Sparkfare'));

  // /<key>.txt
  const resKey = await worker.fetch(new Request(`https://sparkfare.com/${INDEXNOW_KEY}.txt`), env, { waitUntil() {} });
  assert.equal(resKey.status, 200);
  assert.ok(resKey.headers.get('Content-Type').includes('text/plain'));
  const textKey = await resKey.text();
  assert.equal(textKey.trim(), INDEXNOW_KEY);

  // wrangler.jsonc assets.run_worker_first contains all paths
  const wrangler = read('wrangler.jsonc');
  assert.ok(wrangler.includes('"/how-it-works"'));
  assert.ok(wrangler.includes('"/llms.txt"'));
  assert.ok(wrangler.includes(`"/${INDEXNOW_KEY}.txt"`));
});
