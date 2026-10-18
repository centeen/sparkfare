// K-B10 (ROADMAP step 132): the browser half of the brand checks. For every surface below, at 375 x 812 and 1,440 x 900:
//   contrast   WCAG AA text failures (scripts/contrast-audit.js)                          ratchet
//   gold       elements painted gold that are not a Deal chip or the mark                  ratchet
//   targets    interactive elements under 24 x 24 px                                       ratchet
//   smallText  visible text under 13 px                                                    ratchet
//   brandFont  the page's body font starts with Inter, Space Grotesk or IBM Plex Mono      must hold
// "Ratchet" = may not exceed scripts/brand-checks-baseline.json; lower the numbers as pages are fixed.
// Needs Playwright, which is NOT a dependency of this repo (adding it changes the lockfile): CI installs it with
// `npm i --no-save playwright`; locally set PLAYWRIGHT_DIR to a folder that has it. Usage:
//   node scripts/brand-checks.mjs [--dark] [--write-baseline] [--only <surface>]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createBrandServer } from './lib/brand-server.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = path.join(ROOT, 'scripts', 'brand-checks-baseline.json');

// 17 server-rendered surfaces. /sign-in loads Clerk, which is blocked here, so it shows its static shell. /digest and the email
// templates need a database or a mail client and are covered by their own tests; /plan and /passport are dark until Nov 9.
export const SURFACES = [
  { name: 'home', path: '/' },
  { name: 'route', path: '/flight/JFK/Lisbon%2C%20Portugal' },
  { name: 'check', path: '/check' },
  { name: 'time-off', path: '/time-off/sea' },
  { name: 'leave', path: '/leave' },
  { name: 'away-mode', path: '/away-mode' },
  { name: 'data-index', path: '/data/' },
  { name: 'data-route', path: '/data/jfk-to-prague-czechia' },
  { name: 'blog-post', path: '/blog/how-we-rank-deals' },
  { name: 'pricing', path: '/pricing' },
  { name: 'hub', path: '/hub' },
  { name: 'about', path: '/about' },
  { name: 'disclosure', path: '/disclosure' },
  { name: 'privacy', path: '/privacy' },
  { name: 'not-found', path: '/nope', status: 404 },
  { name: 'sign-in', path: '/sign-in' },
  { name: 'widget', path: '/widget' },
];
export const VIEWPORTS = [{ width: 375, height: 812 }, { width: 1440, height: 900 }];
export const RATCHETED = ['contrast', 'gold', 'targets', 'smallText'];

export function compare(results, baseline) {
  const problems = [];
  for (const r of results) {
    const base = (baseline.surfaces || {})[r.key] || {};
    for (const k of RATCHETED) {
      if (r[k] > (base[k] ?? 0)) problems.push(`${r.key}: ${k} ${r[k]} > baseline ${base[k] ?? 0}${r.examples && r.examples[k] && r.examples[k].length ? ' e.g. ' + r.examples[k].join('; ') : ''}`);
    }
    if (!r.brandFont) problems.push(`${r.key}: body font is "${r.bodyFont}", not a brand face`);
    if (r.status !== r.expectedStatus) problems.push(`${r.key}: HTTP ${r.status}, expected ${r.expectedStatus}`);
  }
  return problems;
}

function loadPlaywright() {
  const req = createRequire(import.meta.url);
  const paths = [process.env.PLAYWRIGHT_DIR, ROOT].filter(Boolean);
  return req(req.resolve('playwright', { paths }));
}

async function main() {
  const dark = process.argv.includes('--dark');
  const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
  const { chromium } = loadPlaywright();
  const contrastSrc = fs.readFileSync(path.join(ROOT, 'scripts', 'contrast-audit.js'), 'utf8');
  const pageSrc = fs.readFileSync(path.join(ROOT, 'scripts', 'lib', 'brand-page-checks.js'), 'utf8');
  const srv = await createBrandServer();
  const origin = 'http://127.0.0.1:' + srv.port;
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const s of SURFACES.filter((x) => !only || x.name === only)) {
      for (const vp of VIEWPORTS) {
        const ctx = await browser.newContext({ viewport: vp, colorScheme: dark ? 'dark' : 'light', reducedMotion: 'reduce' });
        const page = await ctx.newPage();
        // nothing leaves the machine: fonts are self-hosted, and Clerk, analytics and the live API are not needed
        await page.route('**/*', (route) => (route.request().url().startsWith(origin) ? route.continue() : route.abort()));
        const resp = await page.goto(origin + s.path, { waitUntil: 'load' });
        await page.waitForTimeout(1500);
        const contrast = await page.evaluate(contrastSrc);
        const extra = await page.evaluate(pageSrc);
        results.push({
          key: `${s.name}@${vp.width}`, status: resp.status(), expectedStatus: s.status || 200,
          contrast: contrast.failures.length, gold: contrast.goldOutsideChip.length,
          targets: extra.targets, smallText: extra.smallText, brandFont: extra.brandFont, bodyFont: extra.bodyFont,
          examples: { contrast: contrast.failures.slice(0, 3).map((f) => `${f.text} ${f.ratio}:1`), gold: contrast.goldOutsideChip.slice(0, 3), targets: extra.targetExamples.slice(0, 3), smallText: extra.smallExamples.slice(0, 3) },
        });
        await ctx.close();
      }
    }
  } finally { await browser.close(); await srv.close(); }

  const measured = Object.fromEntries(results.map((r) => [r.key, Object.fromEntries(RATCHETED.map((k) => [k, r[k]]))]));
  console.log('MEASURED ' + JSON.stringify(measured));
  const file = dark ? BASELINE.replace('.json', '-dark.json') : BASELINE;
  if (process.argv.includes('--write-baseline')) {
    const surfaces = Object.fromEntries(Object.entries(measured).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).filter(([, n]) => n > 0))]));
    fs.writeFileSync(file, JSON.stringify({ note: 'K-B10 browser-check ratchet. Numbers may only go down. See scripts/brand-checks.mjs.', mode: dark ? 'dark' : 'light', surfaces }, null, 2) + '\n');
    console.log('baseline written to ' + path.basename(file));
    return;
  }
  const baseline = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { surfaces: {} };
  const problems = compare(results, baseline);
  if (problems.length) { console.error('Brand checks failed:\n  ' + problems.join('\n  ')); process.exit(1); }
  console.log(`Brand checks passed (${results.length} surface/viewport runs).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(e); process.exit(1); });
