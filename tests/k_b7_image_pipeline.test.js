// K-B7 (ROADMAP step 130): responsive Unsplash photos. The same URL rewrite lives in three places (index.html, the Python
// generators' helper, and the script that rewrites the generated pages); this file makes them agree.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { unsplashVariant, imgAttrs, QUALITY } from '../scripts/apply-image-pipeline.mjs';

const root = new URL('../', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), 'utf8');
const images = JSON.parse(read('sparkfare_images.json'));
const URLS = Object.values(images).map((i) => i.image_url).filter(Boolean);
const SAMPLE = 'https://images.unsplash.com/photo-1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3wx%3D&ixlib=rb-4.1.0&q=80&w=1080';

test('the variant is a 4:3 webp crop, keeps the signed parts untouched, and drops the old size and format', () => {
  const v = unsplashVariant(SAMPLE, 480);
  assert.equal(v, 'https://images.unsplash.com/photo-1?cs=tinysrgb&ixid=M3wx%3D&ixlib=rb-4.1.0&fm=webp&q=70&w=480&h=360&fit=crop&crop=entropy');
  assert.match(unsplashVariant(SAMPLE, 720), /&q=60&w=720&h=540&/);
  assert.match(unsplashVariant(SAMPLE, 960), /&q=70&w=960&h=720&/);
  assert.equal(unsplashVariant('https://example.com/a.jpg?w=1', 480), 'https://example.com/a.jpg?w=1', 'only Unsplash URLs are rewritten');
  assert.equal(unsplashVariant('https://images.unsplash.com/photo-2', 480), 'https://images.unsplash.com/photo-2?fm=webp&q=70&w=480&h=360&fit=crop&crop=entropy');
  assert.deepEqual(QUALITY, { 480: 70, 720: 60, 960: 70 });
});

test('the attributes carry src, srcset, sizes and explicit dimensions', () => {
  const a = imgAttrs(SAMPLE, [480, 960], '(max-width: 767px) 100vw, 760px');
  assert.match(a, /^src="[^"]*w=480[^"]*" srcset="[^"]*w=480[^"]* 480w, [^"]*w=960[^"]* 960w" sizes="\(max-width: 767px\) 100vw, 760px" width="480" height="360"$/);
  assert.equal(imgAttrs('https://example.com/x.jpg', [480, 960], 's'), 'src="https://example.com/x.jpg"');
});

test('index.html computes the same variants as the shared script, for every stored photo', () => {
  const html = read('index.html').replace(/\r\n/g, '\n');
  const start = html.indexOf('const UNSPLASH_HOST');
  const end = html.indexOf('const HERO_IMG_SIZES');
  assert.ok(start > 0 && end > start);
  const ctx = vm.createContext({});
  vm.runInContext(html.slice(start, end), ctx);
  const page = vm.runInContext('({ unsplashVariant, imgAttrs })', ctx);
  assert.ok(URLS.length >= 40);
  for (const u of URLS) {
    for (const w of [480, 720, 960]) assert.equal(page.unsplashVariant(u, w), unsplashVariant(u, w));
    assert.equal(page.imgAttrs(u, [480, 720], 's'), imgAttrs(u, [480, 720], 's'));
  }
  assert.match(html, /const HERO_IMG_SIZES = /);
  assert.match(html, /imgAttrs\(img\.image_url, \[480, 960\], HERO_IMG_SIZES\)[^`]*fetchpriority="high"/);
  assert.match(html, /imgAttrs\(img\.image_url, \[480, 720\], CARD_IMG_SIZES\)[^`]*loading="lazy" decoding="async"/);
  assert.match(html, /\.card-photo, \.card-photo-fallback \{\s*width: 100%;\s*height: auto;/);
  assert.match(html, /\.hero-photo, \.hero-photo-fallback \{\s*width: 100%;\s*height: auto;/);
});

function python() {
  for (const bin of ['python3', 'python']) {
    const r = spawnSync(bin, ['--version'], { encoding: 'utf8' });
    if (r.status === 0 && /Python 3/.test((r.stdout || '') + (r.stderr || ''))) return bin;
  }
  return null;
}

test('the Python helper the generators use gives byte-for-byte the same output (runs where Python is installed, as in CI)', (t) => {
  const bin = python();
  if (!bin) return t.skip('no Python 3 on this machine');
  const script = 'import json, sys\nsys.path.insert(0, ".")\nfrom unsplash_img import unsplash_variant, img_attrs\nurls = json.load(sys.stdin)\nprint(json.dumps([[unsplash_variant(u, w) for w in (480, 720, 960)] + [img_attrs(u, (480, 960), "S")] for u in urls]))';
  const sample = [SAMPLE, 'https://images.unsplash.com/photo-2', 'https://example.com/x.jpg?w=5', ...URLS];
  const r = spawnSync(bin, ['-c', script], { cwd: path.dirname(new URL('../package.json', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), input: JSON.stringify(sample), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  sample.forEach((u, i) => {
    assert.deepEqual(out[i], [unsplashVariant(u, 480), unsplashVariant(u, 720), unsplashVariant(u, 960), imgAttrs(u, [480, 960], 'S')], u);
  });
});

test('every generated page carries the responsive photo, with the credit line kept and no photo left at 1080 px jpg', () => {
  let pages = 0;
  for (const dir of ['data', 'blog']) {
    for (const f of fs.readdirSync(new URL(dir + '/', root)).filter((n) => n.endsWith('.html'))) {
      const html = read(`${dir}/${f}`);
      const m = html.match(/<img class="(dest|hero)-photo"[^>]*>/);
      if (!m) continue;
      pages++;
      const tag = m[0];
      assert.match(tag, /srcset="[^"]* 480w, [^"]* 960w"/, f);
      assert.match(tag, /sizes="\(max-width: 767px\) 100vw, 760px"/, f);
      assert.match(tag, /width="480" height="360"/, f);
      assert.match(tag, /fm=webp/, f);
      assert.doesNotMatch(tag, /fm=jpg|w=1080/, f);
      if (m[1] === 'dest') assert.match(tag, /loading="lazy" decoding="async"/, f);
      else { assert.match(tag, /fetchpriority="high"/, f); assert.doesNotMatch(tag, /loading="lazy"/, f); }
      assert.match(html, /<p class="attribution">Photo by /, f + ' keeps its credit line');
      assert.match(html, /\.(dest|hero)-photo \{ width: 100%; height: auto;/, f);
    }
  }
  assert.ok(pages > 800, 'expected hundreds of pages, found ' + pages);
});

test('a blog post still shares the full-size photo as its social image', () => {
  const html = read('blog/lisbon-portugal.html');
  assert.match(html, /<meta property="og:image" content="https:\/\/images\.unsplash\.com\/[^"]*w=1080/);
});

test('the generators emit the helper output, and the rewrite script finds nothing left to change', () => {
  const pseo = read('Phase 17 pSEO Generator (Step 106).py');
  assert.match(pseo, /from unsplash_img import img_attrs/);
  assert.match(pseo, /img_attrs\(image\["image_url"\], \(480, 960\), DEST_PHOTO_SIZES\)/);
  const blog = read('Phase 20 Blog Generator.py');
  assert.match(blog, /img_attrs\(img_url, \(480, 960\), HERO_SIZES\)/);
  assert.match(blog, /fetchpriority="high"/);
  const out = execFileSync(process.execPath, ['scripts/apply-image-pipeline.mjs', '--check'], { cwd: root, encoding: 'utf8' });
  assert.match(out, /0 file\(s\) differ/);
  assert.ok(fs.existsSync(new URL('unsplash_img.py', root)));
});
