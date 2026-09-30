// Captures the real Classroom Widgets Timer (compact desktop panel surface) from the
// local teacher dev server (`pnpm dev:teacher`, http://127.0.0.1:3000; override with
// TEACHER_URL) as transparent PNG frames in assets/timer/. Run from the pipeline folder.
import { chromium } from 'playwright';
import fs from 'fs';
const OUT = 'assets/timer'; fs.mkdirSync(OUT, { recursive: true });
const FPS = 15, RUN_SECONDS = Number(process.env.RUN_SECONDS || 32), CHROME_SECONDS = 4;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 350, height: 415 }, deviceScaleFactor: 1.5, ignoreHTTPSErrors: true });
const p = await ctx.newPage();
p.on('pageerror', e => console.log('err:', e.message));
await p.clock.install({ time: new Date('2026-09-30T09:00:00') });
const TEACHER_URL = process.env.TEACHER_URL || 'http://127.0.0.1:3000';
await p.goto(`${TEACHER_URL}/?surface=widget-panel&widgetId=w1`, { waitUntil: 'networkidle' });
await p.clock.runFor(500);
await p.waitForFunction(() => !!window.classroomWidgetPanel, null, { timeout: 20000 });
await p.evaluate(() => window.classroomWidgetPanel.receiveSnapshot({
  schemaVersion: 1, workspaceId: 'ws', revision: 1, stateRevision: 1, widgetId: 'w1', widgetType: 1, title: 'Timer',
  preferredSize: { width: 350, height: 415 }, minimumSize: { width: 250, height: 306 }, maximumSize: null,
  isResizable: true, maintainsAspectRatio: true, hidden: false,
  state: { segmentValues: ['00', '05', '00'], soundMode: 'short', muted: false, creature: 'hamster' },
  theme: 'light', savedRandomiserLists: []
}));
await p.clock.runFor(1500);
await p.evaluate(() => document.fonts.ready);
await p.addStyleTag({ content: '*{transition:none!important;}' });
const shot = async (name, chrome) => {
  await p.evaluate((c) => document.documentElement.setAttribute('data-widget-chrome-visible', c ? 'true' : 'false'), chrome);
  await p.screenshot({ path: `${OUT}/${name}.png`, omitBackground: true });
};
await shot('idle_chrome', true);
await shot('idle_nochrome', false);
await p.evaluate(() => document.documentElement.setAttribute('data-widget-chrome-visible', 'true'));
await p.getByRole('button', { name: /start/i }).first().click();
const total = RUN_SECONDS * FPS;
for (let i = 0; i < total; i++) {
  if (i < CHROME_SECONDS * FPS) await shot(`run_chrome_${String(i).padStart(4, '0')}`, true);
  await shot(`run_${String(i).padStart(4, '0')}`, false);
  await p.clock.runFor(1000 / FPS);
}
console.log('frames', total);
await b.close();
