// Minimal static server for a teacher build directory, so several builds
// (a baseline and a fix) can be served side by side and measured in one
// interleaved run. It mirrors widgets.tk.sg: hashed /assets/ files are
// immutable, other paths fall back to index.html (single-page app), and
// responses are gzip-compressed when the browser asks (Cloudflare compresses
// too). Desktop shells read the same files from disk without compression;
// pass { compress: false } to model that.
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { gzipSync } from 'node:zlib';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.txt', '.xml']);

export async function serveBuild(directory, { compress = true } = {}) {
  const root = resolve(directory);
  if (!existsSync(join(root, 'index.html'))) throw new Error(`${root} has no index.html; build the teacher app first`);
  const cache = new Map();
  const load = (file) => {
    let entry = cache.get(file);
    if (!entry) {
      const body = readFileSync(file);
      const ext = extname(file).toLowerCase();
      entry = { body, gz: COMPRESSIBLE.has(ext) ? gzipSync(body, { level: 6 }) : null, type: TYPES[ext] || 'application/octet-stream' };
      cache.set(file, entry);
    }
    return entry;
  };

  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const candidate = resolve(normalize(join(root, decodeURIComponent(url.pathname))));
    const isFile = candidate.startsWith(root + sep) && existsSync(candidate) && statSync(candidate).isFile();
    if (!isFile && url.pathname.startsWith('/assets/')) {
      response.writeHead(404).end('Not found');
      return;
    }
    const file = isFile ? candidate : join(root, 'index.html');
    const entry = load(file);
    const headers = {
      'content-type': entry.type,
      'cache-control': url.pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    };
    let body = entry.body;
    if (compress && entry.gz && /\bgzip\b/.test(request.headers['accept-encoding'] || '')) {
      body = entry.gz;
      headers['content-encoding'] = 'gzip';
      headers.vary = 'accept-encoding';
    }
    headers['content-length'] = body.length;
    response.writeHead(200, headers);
    response.end(request.method === 'HEAD' ? undefined : body);
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    root,
    close: () => new Promise((done) => server.close(() => done())),
  };
}
