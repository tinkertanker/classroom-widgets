import { net, protocol } from 'electron';
import { existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
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
  protocol.handle(APP_SCHEME, (request) => {
    const url = new URL(request.url);
    if (url.host !== APP_HOST) {
      return new Response('Not found', { status: 404 });
    }

    const root = resolveWebRoot();
    const decoded = decodeURIComponent(url.pathname);
    const candidate = resolve(normalize(join(root, decoded)));
    const hasExtension = extname(candidate) !== '';
    const isFile = hasExtension && candidate.startsWith(root + sep) && existsSync(candidate) && statSync(candidate).isFile();
    const file = isFile ? candidate : join(root, 'index.html');
    const mime = MIME_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';

    try {
      const response = net.fetch(pathToFileURL(file).toString());
      return response.then((res) => {
        const headers = new Headers(res.headers);
        headers.set('content-type', mime);
        return new Response(res.body, { status: res.status, headers });
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
