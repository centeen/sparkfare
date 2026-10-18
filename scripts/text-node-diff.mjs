// K-B10 / green lane (Addendum K Amendment 1, section 5): "a diff check shows zero changed text nodes".
// Renders every brand-check surface from a base checkout and from this checkout, in a real browser at 375 and 1,440 px, and compares
// the visible text of each page (document.body.innerText, which leaves out scripts, styles and hidden elements).
//   node scripts/text-node-diff.mjs <base-dir> [--strict]
// Prints one line per surface. With --strict (a PR labelled green-lane) any difference exits 1; without it the result is only reported.
// Needs Playwright (see scripts/brand-checks.mjs).
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createBrandServer } from './lib/brand-server.mjs';
import { SURFACES, VIEWPORTS } from './brand-checks.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function diffText(a, b) {
  const la = a.split('\n').map((s) => s.trim()).filter(Boolean);
  const lb = b.split('\n').map((s) => s.trim()).filter(Boolean);
  const sa = new Set(la); const sb = new Set(lb);
  return { removed: la.filter((l) => !sb.has(l)), added: lb.filter((l) => !sa.has(l)) };
}

async function renderAll(browser, serverRoot, label) {
  const srv = await createBrandServer({ root: serverRoot });
  const origin = 'http://127.0.0.1:' + srv.port;
  const out = {};
  try {
    for (const s of SURFACES) {
      for (const vp of VIEWPORTS) {
        const ctx = await browser.newContext({ viewport: vp, reducedMotion: 'reduce' });
        const page = await ctx.newPage();
        await page.route('**/*', (route) => (route.request().url().startsWith(origin) ? route.continue() : route.abort()));
        try {
          await page.goto(origin + s.path, { waitUntil: 'load' });
          await page.waitForTimeout(1200);
          out[`${s.name}@${vp.width}`] = await page.evaluate(() => document.body.innerText);
        } catch (e) { out[`${s.name}@${vp.width}`] = `ERROR ${label}: ${e.message}`; }
        await ctx.close();
      }
    }
  } finally { await srv.close(); }
  return out;
}

async function main() {
  const baseDir = path.resolve(process.argv[2] || '');
  if (!process.argv[2]) { console.error('usage: node scripts/text-node-diff.mjs <base-dir> [--strict]'); process.exit(2); }
  const strict = process.argv.includes('--strict');
  const req = createRequire(import.meta.url);
  const { chromium } = req(req.resolve('playwright', { paths: [process.env.PLAYWRIGHT_DIR, ROOT].filter(Boolean) }));
  const browser = await chromium.launch();
  let base; let head;
  try { base = await renderAll(browser, baseDir, 'base'); head = await renderAll(browser, ROOT, 'head'); } finally { await browser.close(); }
  let changed = 0;
  for (const key of Object.keys(head)) {
    const d = diffText(base[key] || '', head[key]);
    if (d.removed.length || d.added.length) {
      changed++;
      console.log(`CHANGED ${key}: ${d.removed.length} line(s) removed, ${d.added.length} added`);
      for (const l of d.removed.slice(0, 3)) console.log('  - ' + l.slice(0, 120));
      for (const l of d.added.slice(0, 3)) console.log('  + ' + l.slice(0, 120));
    } else console.log(`same    ${key}`);
  }
  console.log(changed ? `Text changed on ${changed} surface/viewport run(s).` : 'Text unchanged on every surface.');
  if (strict && changed) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(e); process.exit(1); });
