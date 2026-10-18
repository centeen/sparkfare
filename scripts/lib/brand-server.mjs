// K-B10: serves the repo the way Cloudflare does, for the brand checks. Static files come from disk; the paths in
// wrangler.jsonc's assets.run_worker_first, and any path with no file, go to the Worker (src/index.js) with the same
// vars. There is no D1 database, so pages that need one show their empty state, which is what a visitor with no data sees.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain' };

// wrangler.jsonc has comments and trailing commas; strip them outside strings.
export function parseJsonc(src) {
  let out = ''; let i = 0; let inStr = false;
  while (i < src.length) {
    const c = src[i]; const n = src[i + 1];
    if (inStr) { out += c; if (c === String.fromCharCode(92)) { out += n; i += 2; continue; } if (c === '"') inStr = false; i++; continue; }
    if (c === '"') { inStr = true; out += c; i++; continue; }
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
    out += c; i++;
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
}

export function loadConfig(root = ROOT) {
  const cfg = parseJsonc(fs.readFileSync(path.join(root, 'wrangler.jsonc'), 'utf8'));
  return { vars: cfg.vars || {}, runWorkerFirst: (cfg.assets && cfg.assets.run_worker_first) || [] };
}

function matches(pattern, pathname) {
  if (pattern.endsWith('/*')) return pathname === pattern.slice(0, -2) || pathname.startsWith(pattern.slice(0, -1));
  return pathname === pattern;
}

function fileFor(root, pathname) {
  const rel = decodeURIComponent(pathname).replace(/^\/+/, '');
  const tries = rel === '' ? ['index.html'] : [rel, rel + '.html', path.join(rel, 'index.html')];
  for (const t of tries) {
    const f = path.join(root, t);
    if (f.startsWith(root) && fs.existsSync(f) && fs.statSync(f).isFile()) return f;
  }
  return null;
}

export async function createBrandServer({ root = ROOT, port = 0 } = {}) {
  // the Worker comes from the checkout being served, so a base checkout renders with its own code
  const { default: worker } = await import(pathToFileURL(path.join(root, 'src', 'index.js')).href);
  const cfg = loadConfig(root);
  const assets = {
    fetch: async (req) => {
      const f = fileFor(root, new URL(req.url).pathname);
      if (!f) return new Response('not found', { status: 404 });
      return new Response(fs.readFileSync(f), { status: 200, headers: { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' } });
    },
  };
  const env = { ...cfg.vars, ASSETS: assets };
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const workerFirst = cfg.runWorkerFirst.some((p) => matches(p, url.pathname));
      const file = workerFirst ? null : fileFor(root, url.pathname);
      let response;
      if (file) response = new Response(fs.readFileSync(file), { status: 200, headers: { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' } });
      else response = await worker.fetch(new Request(url.href, { method: req.method, headers: req.headers }), env, ctx);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (e) {
      res.writeHead(500); res.end('harness error: ' + e.message);
    }
  });
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  return { server, port: server.address().port, close: () => new Promise((r) => server.close(r)) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { port } = await createBrandServer({ port: Number(process.env.PORT) || 8917 });
  console.log('brand server on http://127.0.0.1:' + port);
}
