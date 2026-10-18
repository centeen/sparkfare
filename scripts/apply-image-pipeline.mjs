// K-B7: rewrites the photo <img> in the generated pages (data/*.html and blog/*.html) to the responsive form the generators now emit.
// Idempotent: a page already carrying srcset is skipped. Usage: node scripts/apply-image-pipeline.mjs [--check]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');

export const UNSPLASH = 'https://images.unsplash.com/';
export const STRIP = new Set(['fm', 'q', 'w', 'h', 'fit', 'crop']);
export const QUALITY = { 480: 70, 720: 60, 960: 70 };
export const DEST_PHOTO_SIZES = '(max-width: 767px) 100vw, 760px';
export const HERO_SIZES = '(max-width: 767px) 100vw, 760px';

// Same logic as unsplash_img.py and index.html's unsplashVariant(): edit the query as text, keep the signed parts as stored.
export function unsplashVariant(url, w) {
  if (!url.startsWith(UNSPLASH)) return url;
  const i = url.indexOf('?');
  const base = i < 0 ? url : url.slice(0, i);
  const query = i < 0 ? '' : url.slice(i + 1);
  const keep = query.split('&').filter((p) => p && !STRIP.has(p.split('=')[0]));
  keep.push('fm=webp', 'q=' + QUALITY[w], 'w=' + w, 'h=' + Math.round((w * 3) / 4), 'fit=crop', 'crop=entropy');
  return base + '?' + keep.join('&');
}

export function imgAttrs(url, widths, sizes) {
  if (!url.startsWith(UNSPLASH)) return `src="${url}"`;
  const first = widths[0];
  const srcset = widths.map((w) => `${unsplashVariant(url, w)} ${w}w`).join(', ');
  return `src="${unsplashVariant(url, first)}" srcset="${srcset}" sizes="${sizes}" width="${first}" height="${Math.round((first * 3) / 4)}"`;
}

const DEST_RE = /<img class="dest-photo" src="([^"]*)" alt="([^"]*)" loading="lazy">/;
const HERO_RE = /<img class="hero-photo" src="([^"]*)" alt="([^"]*)">/;

export function rewrite(html) {
  return html
    .replace(DEST_RE, (m, url, alt) => `<img class="dest-photo" ${imgAttrs(url, [480, 960], DEST_PHOTO_SIZES)} alt="${alt}" loading="lazy" decoding="async">`)
    .replace(HERO_RE, (m, url, alt) => `<img class="hero-photo" ${imgAttrs(url, [480, 960], HERO_SIZES)} alt="${alt}" fetchpriority="high">`)
    // width/height attributes must not stretch the image: the stylesheet decides the height
    .replace('.dest-photo { width: 100%; max-height: 320px;', '.dest-photo { width: 100%; height: auto; max-height: 320px;')
    .replace('.hero-photo { width: 100%; max-height: 340px;', '.hero-photo { width: 100%; height: auto; max-height: 340px;');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let changed = 0;
  for (const dir of ['data', 'blog']) {
    for (const f of fs.readdirSync(path.join(ROOT, dir)).filter((n) => n.endsWith('.html'))) {
      const p = path.join(ROOT, dir, f);
      const s = fs.readFileSync(p, 'utf8');
      const n = rewrite(s);
      if (n !== s) { changed++; if (!check) fs.writeFileSync(p, n); else console.log('would change', dir + '/' + f); }
    }
  }
  console.log(check ? `${changed} file(s) differ` : `${changed} file(s) written`);
  if (check && changed) process.exit(1);
}
