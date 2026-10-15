import { protocol } from 'electron';
import { existsSync, statSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { log } from './log';
import { resolveWebRoot } from './webRoot';

export const APP_SCHEME = 'app';
export const APP_HOST = 'classroomwidgets';
export const ORIGIN = `${APP_SCHEME}://${APP_HOST}`;

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.wasm': 'application/wasm',
  '.map': 'application/json',
  '.txt': 'text/plain',
};

/** Must run before app 'ready'. */
export function registerPrivilegedScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
    },
  ]);
}

/** Serves the bundled teacher build under app://classroomwidgets/. */
export function installProtocolHandler(): void {
  protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url);
    if (url.host !== APP_HOST) {
      return new Response('Not found', { status: 404 });
    }

    const root = resolve(resolveWebRoot());
    const decoded = decodeURIComponent(url.pathname);
    const candidate = resolve(normalize(join(root, decoded)));
    const hasExtension = extname(candidate) !== '';
    const isFile = hasExtension && candidate.startsWith(root + sep) && existsSync(candidate) && statSync(candidate).isFile();
    const file = isFile ? candidate : join(root, 'index.html');
    const mime = MIME_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';

    try {
      // Read the file directly: going through net.fetch(file://) streamed every
      // body from the network service into this process and back out, which
      // took ~3 ms per file when idle and ~10 ms under a page load's burst.
      const [body, info] = await Promise.all([readFile(file), stat(file)]);
      return new Response(body, {
        status: 200,
        headers: { 'content-type': mime, 'last-modified': info.mtime.toUTCString() },
      });
    } catch (error) {
      log.error(`app:// fetch failed for ${file}: ${error instanceof Error ? error.message : String(error)}`);
      return new Response('Not found', { status: 404 });
    }
  });
}

export function buildUrl(query: Record<string, string>): string {
  const params = new URLSearchParams(query);
  return `${ORIGIN}/?${params.toString()}`;
}

export function isAllowed(url: string): boolean {
  const lowered = url.toLowerCase();
  return lowered.startsWith(`${ORIGIN}/`)
    || lowered === ORIGIN
    || lowered.startsWith('about:')
    || lowered.startsWith('devtools://');
}
