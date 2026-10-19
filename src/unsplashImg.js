// The same Unsplash URL rewrite as index.html, scripts/apply-image-pipeline.mjs and unsplash_img.py (K-B7), for pages the Worker renders.
// tests/k_b5_time_off.test.js runs this against the shared script on every stored photo, so the copies cannot drift apart. The query string
// is edited as plain text, not re-encoded, so the signed parts of an Unsplash URL (ixid) stay byte-for-byte as stored.
export const UNSPLASH = 'https://images.unsplash.com/';
const STRIP = new Set(['fm', 'q', 'w', 'h', 'fit', 'crop']);
export const QUALITY = { 480: 70, 720: 60, 960: 70 };

// The same photo as a 4:3 webp crop w pixels wide.
export function unsplashVariant(url, w) {
  if (!url || !url.startsWith(UNSPLASH)) return url;
  const i = url.indexOf('?');
  const base = i < 0 ? url : url.slice(0, i);
  const query = i < 0 ? '' : url.slice(i + 1);
  const keep = query.split('&').filter((p) => p && !STRIP.has(p.split('=')[0]));
  keep.push('fm=webp', `q=${QUALITY[w]}`, `w=${w}`, `h=${Math.round((w * 3) / 4)}`, 'fit=crop', 'crop=entropy');
  return `${base}?${keep.join('&')}`;
}

// src, srcset, sizes, width and height for an <img> (4:3; the first width is the fallback src).
export function imgAttrs(url, widths, sizes) {
  if (!url || !url.startsWith(UNSPLASH)) return `src="${url}"`;
  const first = widths[0];
  const srcset = widths.map((w) => `${unsplashVariant(url, w)} ${w}w`).join(', ');
  return `src="${unsplashVariant(url, first)}" srcset="${srcset}" sizes="${sizes}" width="${first}" height="${Math.round((first * 3) / 4)}"`;
}
