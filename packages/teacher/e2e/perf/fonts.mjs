// Google Fonts requests are third-party and outside this machine's control,
// so the benchmark answers them itself:
//   replay:<ms>  serve a recorded copy after <ms> (default; models a cold
//                connection to fonts.googleapis.com / fonts.gstatic.com)
//   offline      fail at once, as a desktop app without internet does
//   hang:<ms>    fail after <ms>, as on a network that drops the requests
// Recordings are fetched once with curl (which honours HTTPS_PROXY) and kept
// in <tmp>/classroom-widgets-perf-fonts.
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
  if (!['replay', 'offline', 'hang'].includes(kind)) throw new Error(`unknown --fonts mode ${mode}`);
  return { kind, ms: Number(value ?? (kind === 'replay' ? 100 : 0)) };
}

export function fontsInstaller({ kind, ms }) {
  const delay = (time) => new Promise((done) => setTimeout(done, time));
  return async (context) => {
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
      await delay(Math.max(0, ms - (Date.now() - started)));
      return route.fulfill({
        status: 200,
        body: response.body,
        headers: { 'content-type': response.contentType, 'access-control-allow-origin': '*' },
      });
    });
  };
}
