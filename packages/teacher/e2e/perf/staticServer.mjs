// Minimal static server for a teacher build directory, so several builds
// (a baseline and a fix) can be served side by side and measured in one
// interleaved run. It mirrors widgets.tk.sg: hashed /assets/ files are
// immutable, other paths fall back to index.html (single-page app), and
// responses are gzip-compressed when the browser asks (Cloudflare compresses
// too). Desktop shells read the same files from disk without compression;
// pass { compress: false } to model that.
//
// For the student app, `base: '/student/'` serves the build under that path
// and `proxy` forwards /socket.io/ and /api/ (WebSocket upgrades included) to
// a real server, which is how go.tk.sg serves it.
import { createServer, request as httpRequest } from 'node:http';
import { connect } from 'node:net';
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

const isProxied = (path) => path.startsWith('/socket.io/') || path.startsWith('/api/');

export async function serveBuild(directory, { compress = true, base = '/', proxy = null } = {}) {
  const root = resolve(directory);
  if (!existsSync(join(root, 'index.html'))) throw new Error(`${root} has no index.html; build the app first`);
  const target = proxy ? new URL(proxy) : null;
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
    if (target && isProxied(url.pathname)) {
      const upstream = httpRequest({
        host: target.hostname, port: target.port, method: request.method, path: request.url,
        headers: { ...request.headers, host: target.host },
      }, (reply) => {
        response.writeHead(reply.statusCode, reply.headers);
        reply.pipe(response);
      });
      upstream.on('error', () => response.destroy());
      request.pipe(upstream);
      return;
    }
    if (!url.pathname.startsWith(base) && `${url.pathname}/` !== base) {
      response.writeHead(404).end('Not found');
      return;
    }
    const path = url.pathname.slice(base.length - 1) || '/';
    const candidate = resolve(normalize(join(root, decodeURIComponent(path))));
    const isFile = candidate.startsWith(root + sep) && existsSync(candidate) && statSync(candidate).isFile();
    if (!isFile && path.startsWith('/assets/')) {
      response.writeHead(404).end('Not found');
      return;
    }
    const file = isFile ? candidate : join(root, 'index.html');
    const entry = load(file);
    const headers = {
      'content-type': entry.type,
      'cache-control': path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
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
  if (target) {
    server.on('upgrade', (request, socket, head) => {
      const upstream = connect(Number(target.port), target.hostname, () => {
        const lines = [`${request.method} ${request.url} HTTP/${request.httpVersion}`];
        for (let i = 0; i < request.rawHeaders.length; i += 2) lines.push(`${request.rawHeaders[i]}: ${request.rawHeaders[i + 1]}`);
        upstream.write(`${lines.join('\r\n')}\r\n\r\n`);
        if (head.length) upstream.write(head);
        upstream.pipe(socket).pipe(upstream);
      });
      upstream.on('error', () => socket.destroy());
      socket.on('error', () => upstream.destroy());
    });
  }
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    root,
    close: () => new Promise((done) => server.close(() => done())),
  };
}
