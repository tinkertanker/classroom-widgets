// Renders compose/index.html frame by frame with Playwright and pipes PNGs into ffmpeg.
// Usage: node render.mjs [--stills t1,t2,...] [--out out/video_noaudio.mp4] [--from s --to s]
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import http from 'http'; import fs from 'fs'; import path from 'path';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? a.push([v.slice(2), arr[i + 1]]) : 0, a), []));
const root = path.resolve('.');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
// Local-only static server for compose/ and assets/: loopback, confined to the pipeline folder.
const HOST = '127.0.0.1';
const server = http.createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent(req.url.split('?')[0]); } catch { rel = null; }
  if (rel === null || rel.includes('\0')) { res.writeHead(400); res.end(); return; }
  const f = path.resolve(root, '.' + path.sep + rel);
  if (f !== root && !f.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); res.end(d); });
});
await new Promise((ok, fail) => server.once('error', fail).listen(0, HOST, ok));
const port = server.address().port;
const TL = JSON.parse(fs.readFileSync('timeline.json', 'utf8'));
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
p.on('pageerror', e => console.log('pageerror', e.message));
p.on('console', m => { if (m.type() === 'error') console.log('console', m.text()); });
await p.goto(`http://${HOST}:${port}/compose/index.html`);
await p.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
const cdp = await p.context().newCDPSession(p);
const grab = async () => Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true })).data, 'base64');
if (args.stills) {
  fs.mkdirSync('out/stills', { recursive: true });
  for (const ts of args.stills.split(',')) {
    const t = Number(ts); await p.evaluate((t) => window.renderAt(t), t);
    fs.writeFileSync(`out/stills/t${t.toFixed(2)}.png`, await grab());
  }
} else {
  fs.mkdirSync('out', { recursive: true });
  const fps = TL.fps, from = Number(args.from || 0), to = Number(args.to || TL.duration);
  const n = Math.round((to - from) * fps);
  const out = args.out || 'out/video_noaudio.mp4';
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-tune', 'animation', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    const t = from + i / fps;
    await p.evaluate((t) => window.renderAt(t), t);
    const buf = await grab();
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 150 === 0) console.log(`frame ${i}/${n} t=${t.toFixed(2)} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
  console.log('wrote', out);
}
await b.close(); server.close();
