#!/usr/bin/env node
// K-A2 (ROADMAP step 120): action colour. Every button and text link is Sage (white text on fills); gold (--spark) is only the Deal chip's
// fill and the mark's dot; amber is retired. Rewrites CSS only (inside <style> blocks and style="..." attributes), one rule at a time.
//   node scripts/apply-action-colour.mjs <html files...>                 static pages, blog, data
//   node scripts/apply-action-colour.mjs --py <generator.py ...>         Python f-string generators (braces doubled)
//   node scripts/apply-action-colour.mjs --js <src/file.js|html ...>     Worker templates
// Idempotent. Changes no text, link, flag or script.
import fs from 'node:fs';
import { inCss } from './apply-brand-tokens.mjs';

const CHIP = 'background: var(--spark); color: var(--ink); border: 1px solid var(--spark-ink);';

export function rewriteRule(sel, body) {
  let b = body;
  const s = sel.trim();
  // The Deal chip: gold fill, ink text, 1px spark-ink border.
  if (/\.badge\.deal/.test(s)) {
    b = b.replace(/color\s*:\s*var\(--(amber|spark-ink)\)\s*;\s*border\s*:\s*1px solid var\(--(amber|spark-ink)\)\s*;?/, CHIP);
    return b;
  }
  // A deal price is plain ink: the chip carries the signal.
  if (/\.is-deal/.test(s) || /wl-price/.test(s)) b = b.replace(/(^|[;\s])color\s*:\s*var\(--(amber|spark-ink)\)/g, '$1color: var(--ink)');
  // A gold button or selected pill becomes a sage one with white text.
  if (/background\s*:\s*var\(--spark\)/.test(b) && !/\.badge|\.chip/.test(s)) {
    b = b.replace(/background\s*:\s*var\(--spark\)/g, 'background: var(--sage)');
    b = b.replace(/border-color\s*:\s*var\(--spark\)/g, 'border-color: var(--sage)');
    b = b.replace(/(^|[;\s{])color\s*:\s*var\(--(text|ink)\)/g, '$1color: var(--on-sage)');
  }
  // Gold text (a link) becomes sage.
  b = b.replace(/(^|[;\s{])color\s*:\s*var\(--spark\)/g, '$1color: var(--sage)');
  b = b.replace(/border-bottom\s*:\s*2px solid var\(--spark\)/g, 'border-bottom: 2px solid var(--sage)');
  return b;
}

export function actionCss(css) {
  // inline style="..." attributes arrive without a selector: treat the whole text as one rule body
  if (!/[{}]/.test(css)) return rewriteRule('', css);
  return css.replace(/([^{}]+)\{([^{}]*)\}/g, (m, sel, body) => `${sel}{${rewriteRule(sel, body)}}`);
}

export const actionTransform = (src) => inCss(src, actionCss);

if (process.argv[1]?.endsWith('apply-action-colour.mjs')) {
  const args = process.argv.slice(2);
  const mode = args[0]?.startsWith('--') ? args.shift() : '';
  let changed = 0;
  for (const file of args) {
    const raw = fs.readFileSync(file, 'utf8');
    const crlf = raw.includes('\r\n');
    const before = raw.replace(/\r\n/g, '\n');
    let after;
    if (mode === '--py') {
      after = before.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/g, (m, a, body, c) => a + actionCss(body.replace(/\{\{/g, '{').replace(/\}\}/g, '}')).replace(/\{/g, '{{').replace(/\}/g, '}}') + c);
    } else {
      after = actionTransform(before);
    }
    if (after !== before) { fs.writeFileSync(file, crlf ? after.replace(/\n/g, '\r\n') : after); changed += 1; }
  }
  console.log(`rewrote ${changed} of ${args.length} files`);
}
