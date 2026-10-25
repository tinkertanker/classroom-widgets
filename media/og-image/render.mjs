// Same explicit-time Chromium → PNG → ffmpeg approach as the display demo.
import { createRequire } from 'node:module';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, copyFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { pipeline } from 'node:stream/promises';

const here = dirname(fileURLToPath(import.meta.url));
const teacher = join(here, '../../packages/teacher');
const { chromium } = createRequire(join(teacher, 'package.json'))('playwright-core');
const browsers = join(homedir(), '.agent-browser/browsers');
const executablePath = process.env.CHROME_PATH || join(browsers,
  readdirSync(browsers).filter(name => name.startsWith('chrome-')).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).at(-1), 'chrome');
const temp = mkdtempSync(join(tmpdir(), 'og-card-'));
let browser;
try {
  browser = await chromium.launch({ executablePath });
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
  await page.goto(pathToFileURL(join(here, 'card.html')).href);
  await page.waitForFunction(() => document.fonts.status === 'loaded'
    && ['500', '600', '700'].every(weight => [...document.fonts].some(f => f.family.includes('Poppins') && f.weight === weight && f.status === 'loaded'))
    && [...document.images].every(image => image.complete && image.naturalWidth > 0));
  await page.evaluate(() => Promise.all([...document.images].map(image => image.decode())));
  await page.evaluate(() => window.renderAt(3));
  await page.screenshot({ path: join(temp, 'poster.png') });
  execFileSync('magick', [join(temp, 'poster.png'), '-resize', '1200x630', '-strip', '-sampling-factor', '4:2:0', '-quality', '88', join(temp, 'poster.jpg')]);

  if (!process.argv.includes('--still')) {
    const ffmpeg = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'png', '-i', '-',
      '-vf', 'scale=1200:630:flags=lanczos', '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', join(temp, 'video.mp4')],
    { stdio: ['pipe', 'inherit', 'inherit'] });
    const finished = new Promise((resolve, reject) => {
      ffmpeg.on('error', reject);
      ffmpeg.on('close', code => code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)));
    });
    async function* frames() {
      for (let frame = 0; frame < 180; frame++) {
        await page.evaluate(t => window.renderAt(t), frame / 30);
        yield await page.screenshot();
        if (frame % 30 === 0) console.log(`Rendered ${frame}/180 frames`);
      }
    }
    await Promise.all([pipeline(frames(), ffmpeg.stdin), finished]);
    copyFileSync(join(temp, 'video.mp4'), join(teacher, 'public/og-video-v2.mp4'));
  }
  copyFileSync(join(temp, 'poster.jpg'), join(teacher, 'public/og-image-v2.jpg'));
  console.log(`Rendered 1200×630 poster${process.argv.includes('--still') ? '' : ' and 6s / 30fps silent H.264 video'}`);
} finally {
  await browser?.close();
  rmSync(temp, { recursive: true, force: true });
}
