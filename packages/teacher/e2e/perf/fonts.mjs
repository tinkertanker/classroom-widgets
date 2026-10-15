// Google Fonts requests are third-party and outside this machine's control,
// so the benchmark answers them itself:
//   replay:<ms>  serve a recorded copy after <ms> (default; models a cold
//                connection to fonts.googleapis.com / fonts.gstatic.com).
//                With --network, the delay instead follows that link: four
//                round trips for the first request to each host (DNS, TCP,
//                TLS, request), one after that, plus the transfer time.
//                Responses answered here bypass Chrome's network emulation:
//                they never compete with the app's own files for the link,
//                which favours a build that loads Google Fonts. Use `serve`
//                for a fair comparison on a throttled link.
//   offline      fail at once, as a desktop app without internet does
//   hang:<ms>    fail after <ms>, as on a network that drops the requests
//   none         leave them alone. Any route makes Playwright disable the
//                HTTP cache, so only this mode and `serve` give a warm reload
//                (warm* metrics) its cached files; use it for builds that
//                make no Google Fonts requests.
//   serve        answer from a local HTTP/2 server that Chrome reaches through
//                its own network stack (host-resolver rules and a trusted
//                self-signed certificate), so --network throttling and the
//                HTTP cache apply to Google Fonts as to the app's own files.
//                With --network, opening a connection to each host also costs
//                three round trips (DNS, TCP, TLS), as the real hosts would.
// Recordings are fetched once with curl (which honours HTTPS_PROXY) and kept
// in <tmp>/classroom-widgets-perf-fonts.
import { execFile } from 'node:child_process';
import { createHash, createPublicKey } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createSecureServer } from 'node:http2';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const CACHE = join(tmpdir(), 'classroom-widgets-perf-fonts');
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const pending = new Map();

async function recorded(url) {
  mkdirSync(CACHE, { recursive: true });
  const file = join(CACHE, createHash('sha1').update(url).digest('hex'));
  if (!existsSync(`${file}.json`) && !pending.has(url)) {
    pending.set(url, (async () => {
      const { stdout } = await run('curl', ['-sS', '--fail', '-A', USER_AGENT, '-D', '-', '-o', file, url], { maxBuffer: 1 << 20 });
      const type = /content-type:\s*([^\r\n]+)/i.exec(stdout)?.[1] ?? 'application/octet-stream';
      writeFileSync(`${file}.json`, JSON.stringify({ contentType: type }));
    })());
  }
  await pending.get(url);
  return { ...JSON.parse(readFileSync(`${file}.json`, 'utf8')), body: readFileSync(file) };
}

export function parseFontsMode(mode = 'replay:100') {
  const [kind, value] = mode.split(':');
  if (!['replay', 'offline', 'hang', 'none', 'serve'].includes(kind)) throw new Error(`unknown --fonts mode ${mode}`);
  return { kind, ms: Number(value ?? (kind === 'replay' ? 100 : 0)) };
}

export function fontsInstaller({ kind, ms }, network = null) {
  const delay = (time) => new Promise((done) => setTimeout(done, time));
  return async (context) => {
    if (kind === 'none' || kind === 'serve') return;
    const connected = new Set();
    await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, async (route) => {
      if (kind === 'offline') return route.abort('internetdisconnected');
      if (kind === 'hang') {
        await delay(ms);
        return route.abort('timedout');
      }
      const started = Date.now();
      let response;
      try {
        response = await recorded(route.request().url());
      } catch (error) {
        console.warn(`fonts: could not record ${route.request().url()}: ${error.message}`);
        return route.abort('failed');
      }
      let wait = ms;
      if (network) {
        const host = new URL(route.request().url()).host;
        wait = (connected.has(host) ? 1 : 4) * network.rttMs + (response.body.length * 8) / network.downKbps;
        connected.add(host);
      }
      await delay(Math.max(0, wait - (Date.now() - started)));
      return route.fulfill({
        status: 200,
        body: response.body,
        headers: { 'content-type': response.contentType, 'access-control-allow-origin': '*' },
      });
    });
  };
}

const GOOGLE_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

async function certificate() {
  mkdirSync(CACHE, { recursive: true });
  const key = join(CACHE, 'host-key.pem');
  const cert = join(CACHE, 'host-cert.pem');
  if (!existsSync(cert)) {
    await run('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '3650', '-keyout', key, '-out', cert,
      '-subj', `/CN=${GOOGLE_HOSTS[0]}`, '-addext', `subjectAltName=${GOOGLE_HOSTS.map((host) => `DNS:${host}`).join(',')}`]);
  }
  return { key: readFileSync(key), cert: readFileSync(cert) };
}

// `serve` mode: starts the local Google Fonts host. Returns the Chromium
// arguments that route both hosts to it and trust its certificate.
export async function startFontsHost(network = null) {
  const { key, cert } = await certificate();
  const spki = createHash('sha256').update(createPublicKey(cert).export({ type: 'spki', format: 'der' })).digest('base64');
  const secure = createSecureServer({ key, cert, allowHTTP1: true }, async (request, response) => {
    const host = (request.headers[':authority'] ?? request.headers.host ?? '').split(':')[0];
    try {
      const recording = await recorded(`https://${host}${request.url}`);
      response.writeHead(200, {
        'content-type': recording.contentType,
        'access-control-allow-origin': '*',
        // What Google sends: a day for the stylesheet, a year for the faces.
        'cache-control': host === 'fonts.gstatic.com' ? 'public, max-age=31536000' : 'private, max-age=86400',
      });
      response.end(recording.body);
    } catch (error) {
      console.warn(`fonts: could not record https://${host}${request.url}: ${error.message}`);
      response.writeHead(502);
      response.end();
    }
  });
  const setupMs = network ? 3 * network.rttMs : 0;
  const sockets = new Set();
  // One port per host, as the real hosts have separate addresses: Chrome
  // shares an HTTP/2 connection between hosts only at the same address.
  const listeners = await Promise.all(GOOGLE_HOSTS.map(async (host) => {
    const listener = createServer((socket) => {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
      socket.pause();
      setTimeout(() => {
        secure.emit('connection', socket);
        socket.resume();
      }, setupMs);
    });
    await new Promise((done) => listener.listen(0, '127.0.0.1', done));
    return { host, listener, port: listener.address().port };
  }));
  return {
    args: [
      // A proxy (Chromium on Linux follows the *_proxy variables, which
      // --no-proxy-server does not override) would resolve the hosts itself.
      '--proxy-server=direct://',
      `--host-resolver-rules=${listeners.map(({ host, port }) => `MAP ${host} 127.0.0.1:${port}`).join(', ')}`,
      `--ignore-certificate-errors-spki-list=${spki}`,
    ],
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await Promise.all(listeners.map(({ listener }) => new Promise((done) => listener.close(done))));
      secure.close();
    },
  };
}
