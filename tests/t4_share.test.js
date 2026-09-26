import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { ogCardHtml } from '../src/index.js';
import satori from 'satori';
import { html as satoriHtml } from 'satori-html';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Minimal mock environment
const createMockEnv = () => ({
  DB: {
    prepare: () => ({
      bind: () => ({
        run: async () => ({ success: true })
      })
    })
  },
  ASSETS: {
    fetch: async (req) => {
      const url = new URL(req.url);
      if (url.pathname.includes('sparkfare_ranked_deals.json')) {
        return new Response(JSON.stringify({
          generated_at: "2026-09-18T10:32:58.235620+00:00",
          deals: [
            {
              display_name: "Tulum, Mexico",
              origin: "JFK",
              price: 249,
              status: "deal",
              departure_at: "2026-12-08T20:15:00-05:00",
              history_points: 15,
              pct_below_avg: 0.1975
            }
          ]
        }));
      }
      return new Response(JSON.stringify({ deals: [] }));
    }
  }
});

test('T4: /deal/:origin/:dest/:date permalink logs share_click and renders OG tags', async () => {
  const env = createMockEnv();
  
  let loggedEvent = null;
  env.DB.prepare = (query) => ({
    // F1: logEvent() now runs a no-bind CREATE TABLE IF NOT EXISTS events guard before its
    // INSERT -- same no-bind .run() gap already hit once for T5c's own mock.
    run: async () => ({ success: true }),
    bind: (...args) => ({
      run: async () => {
        if (query.includes('INSERT INTO events')) {
          loggedEvent = { type: args[0], origin: args[3], route: args[4] };
        }
        return { success: true };
      }
    })
  });

  const request = new Request('https://sparkfare.com/deal/JFK/Tulum,%20Mexico/2026-12-08');
  const response = await worker.fetch(request, env, {});
  
  assert.equal(response.status, 200);
  const html = await response.text();
  
  assert.match(html, /<meta property="og:image" content="https:\/\/sparkfare\.com\/og\/JFK\/Tulum%2C%20Mexico\/2026-12-08" \/>/);
  assert.match(html, /<meta http-equiv="refresh" content="0; url=\/\?origin=JFK" \/>/);
  
  assert.equal(loggedEvent.type, 'share_click');
  assert.equal(loggedEvent.origin, 'JFK');
  assert.equal(loggedEvent.route, 'Tulum, Mexico');
});

// NOTE: this test only proves the handler fails *safely* (500, no crash) in plain Node, where the
// WASM cannot load. It says nothing about whether the endpoint works in the Workers runtime -- and
// a test shaped exactly like this hid a production 500 on every share image (harfbuzzjs, pulled in
// by satori >= 0.33, cannot run in Workers). Real coverage of the card is the ogCardHtml() tests and
// the satori-version pin test at the end of this file, plus a live `curl` of a real /og/ URL after
// any deploy that touches this path.
test('T4: /og/:origin/:dest/:date fails safely (500) in plain Node where WASM cannot load', async () => {
  const env = createMockEnv();
  const request = new Request('https://sparkfare.com/og/JFK/Tulum,%20Mexico/2026-12-08');
  const response = await worker.fetch(request, env, {});

  // @resvg/resvg-wasm's own .wasm module has an internal `import 'wbg'` that plain `node --test`
  // has no loader for (no such gap under wrangler's real esbuild bundling, confirmed via a real
  // `wrangler deploy --dry-run`) -- an inherent test-environment limitation, not a bug, same as
  // this project's other WASM-dependent code. See the next test for real coverage of the font
  // file itself, which *was* a real bug (see below) and needs its own check independent of this
  // WASM gap.
  assert.equal(response.status, 500);
});

// F4 (2026-09-25): src/assets/Inter-Medium.ttf was in .gitignore's blanket `*.ttf` rule and had
// never actually been committed -- a fresh clone of this repo could not build the Worker at all
// (`wrangler deploy --dry-run` failed on this exact import). Fixed by committing a real, properly
// licensed (SIL OFL) static Inter Medium instance. This test exercises satori directly (the part
// of the /og/ pipeline that actually consumes this file) without resvg-wasm, so it runs cleanly
// under plain `node --test` and gives real regression coverage: a missing file, a re-gitignored
// file, or a variable font swapped back in by mistake (satori's opentype.js fork cannot parse
// Inter's own published variable-font fvar table -- confirmed by testing that directly before
// choosing to ship a static instance) would all fail this test immediately.
test('T4: src/assets/Inter-Medium.ttf is present, real, and satori can render with it', async () => {
  const fontPath = path.join(__dirname, '..', 'src', 'assets', 'Inter-Medium.ttf');
  assert.ok(fs.existsSync(fontPath), 'src/assets/Inter-Medium.ttf must exist -- required by the /og/* image generator');

  const fontData = fs.readFileSync(fontPath);
  assert.ok(fontData.length > 10000, 'font file should not be a stub/empty placeholder');

  const contentHtml = satoriHtml`<div style="display: flex; width: 1200px; height: 630px; font-family: 'Inter';">Sparkfare</div>`;
  const svg = await satori(contentHtml, {
    width: 1200,
    height: 630,
    fonts: [{ name: 'Inter', data: fontData, weight: 500, style: 'normal' }],
  });

  assert.match(svg, /<svg/);
  assert.match(svg, /<path/); // real glyph outlines were shaped from the font, not an empty frame
});

test('T4: /api/stats/deals returns public counter', async () => {
  const env = createMockEnv();
  const request = new Request('https://sparkfare.com/api/stats/deals');
  const response = await worker.fetch(request, env, {});
  
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.dealCount, 1);
  assert.match(data.message, /Deals spotted below their 30-day median: 1/);
});

// --- /og/ card content and layout (ogCardHtml) -------------------------------------------------
// Rendered through satori with `embedFont: false` so each text run comes back as a <text> element
// carrying its own box (x, y, width, height), which lets these tests catch content that would be
// cut off the 1200x630 canvas.

const INTER = () => fs.readFileSync(path.join(__dirname, '..', 'src', 'assets', 'Inter-Medium.ttf'));
const dealRecord = (over = {}) => ({
  status: 'deal', price: 547, basis_text: '27% below 30-day median, 23 observations',
  departure_at: '2026-11-27T10:00:00-05:00', ...over,
});
const card = (over = {}) => ogCardHtml({
  record: dealRecord(), origin: 'JFK', dest: 'Larnaca, Cyprus', date: '2026-11-27',
  generatedAtIso: '2026-09-26T10:48:00+00:00', ...over,
});
async function renderRuns(vdom) {
  const svg = await satori(vdom, {
    width: 1200, height: 630, embedFont: false,
    fonts: [{ name: 'Inter', data: INTER(), weight: 500, style: 'normal' }],
  });
  const runs = [...svg.matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)].map((m) => {
    const attrs = Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]]));
    return { text: m[2], x: +attrs.x, y: +attrs.y, width: +attrs.width, height: +attrs.height, size: +attrs['font-size'] };
  });
  return { runs, text: runs.map((r) => r.text).join('') };
}

test('og card: a deal card shows the record\'s own basis and an as-of time, with no emoji glyphs', async () => {
  const { text } = await renderRuns(card());
  assert.ok(text.includes('JFK → Larnaca, Cyprus'), `route line missing: ${text}`);
  assert.ok(text.includes('Rare Find: 27% below 30-day median, 23 observations'), `basis missing: ${text}`);
  assert.ok(text.includes('As of Sep 26, 6:48 AM ET. Prices may change.'), `as-of line missing: ${text}`);
  assert.doesNotMatch(text, /[✈️\u{1F300}-\u{1FAFF}]/u, 'Inter has no emoji glyphs; they render as NO GLYPH boxes');
});

test('og card: never states a claim without a basis (generic card instead)', async () => {
  for (const over of [
    { record: dealRecord({ basis_text: undefined }) },                       // a deal with no stated basis
    { record: dealRecord({ status: 'priced_no_deal' }) },                    // not a deal
    { record: dealRecord({ departure_at: '2027-01-01T10:00:00-05:00' }) },   // date mismatch
    { record: null },                                                        // unknown route
  ]) {
    const { text } = await renderRuns(card(over));
    assert.ok(text.includes('Never overpay for flights.'), `generic card expected, got: ${text}`);
    assert.doesNotMatch(text, /Rare Find|below 30-day/);
  }
});

test('og card: every real destination fits the canvas, on one route line, with basis and time visible', async () => {
  const names = new Set();
  for (const f of ['sparkfare_ranked_deals.json', 'sparkfare_ranked_deals_other_origins.json']) {
    const j = JSON.parse(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'));
    for (const bucket of ['deals', 'featured', 'priced_no_deal', 'insufficient_history', 'no_data']) {
      for (const r of j[bucket] || []) names.add(r.display_name);
    }
  }
  assert.ok(names.size >= 30, 'expected the full destination list');

  const MARGIN = 40;
  for (const dest of names) {
    const { runs, text } = await renderRuns(card({ dest }));
    for (const r of runs) {
      assert.ok(r.x >= 0 && r.x + r.width <= 1200 - MARGIN, `"${r.text}" runs off the right edge for ${dest}`);
      assert.ok(r.y >= 0 && r.y + r.height <= 630, `"${r.text}" runs off the bottom for ${dest}`);
    }
    // The route line is the only text set at 52, 60 or 72px; it must stay on a single line.
    const routeYs = new Set(runs.filter((r) => [52, 60, 72].includes(r.size)).map((r) => r.y));
    assert.equal(routeYs.size, 1, `route line for ${dest} wraps`);
    assert.ok(text.includes('27% below 30-day median, 23 observations'), `basis missing for ${dest}`);
    assert.ok(text.includes('As of'), `as-of line missing for ${dest}`);
  }
});

// The production 500 on every /og/ image: satori 0.33.0 added a `harfbuzzjs` dependency, whose
// Emscripten loader cannot run in Cloudflare Workers (it reads self.location, loads its own .wasm
// from disk, and calls addFunction, which compiles WASM from bytes at runtime, which Workers
// forbids). 0.32.0 is the last release without it. Nothing in plain Node would notice a bump.
test('og card: satori stays pinned to a Workers-compatible release (no harfbuzzjs)', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  assert.equal(pkg.dependencies.satori, '0.32.0', 'satori must be pinned exactly; >= 0.33.0 breaks /og/ on Cloudflare Workers');
  const installed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'node_modules', 'satori', 'package.json'), 'utf8'));
  assert.equal(installed.dependencies?.harfbuzzjs, undefined, 'installed satori depends on harfbuzzjs, which cannot run in Workers');
});
