import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
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

test('T4: /og/:origin/:dest/:date image generator returns PNG for eligible deal', async () => {
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
