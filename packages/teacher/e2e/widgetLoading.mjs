// Production-bundle E2E: unused widgets must not be requested, while a newly
// selected widget must work on its first load and restore after a reload.
// Run: pnpm --filter @classroom-widgets/teacher e2e:widget-loading
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { preview } from 'vite';
import { createStepLog, newTeacherContext, prepareEvidence } from './harness.mjs';

const teacherDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(teacherDir, 'build/.vite/manifest.json'), 'utf8'));
const widgetEntries = Object.entries(manifest).filter(([source]) =>
  source.startsWith('src/features/widgets/') && source.endsWith('/index.tsx'));
assert.ok(widgetEntries.length > 15, 'production manifest identifies the widget entry chunks');
const evidence = prepareEvidence('widget-loading', ['widget-loading.txt', 'timer-restored.png']);
const { step, write } = createStepLog(join(evidence, 'widget-loading.txt'));
const violations = [];
let server;
let browser;

try {
  server = await preview({ root: teacherDir, preview: { port: 0, open: false } });
  browser = await chromium.launch({ executablePath: process.env.CHROME_BIN });
  const context = await newTeacherContext(browser, { deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const requests = new Set();
  page.on('request', request => requests.add(new URL(request.url()).pathname.slice(1)));

  async function checkLoads(label, expectedWidgets) {
    // Wait beyond the old requestIdleCallback timeout (2s), not just first paint.
    await page.waitForTimeout(3000);
    const loaded = widgetEntries.filter(([, entry]) => requests.has(entry.file))
      .map(([source]) => source.slice('src/features/widgets/'.length, -'/index.tsx'.length)).sort();
    const jsBytes = [...requests].filter(file => file.startsWith('assets/') && file.endsWith('.js'))
      .reduce((bytes, file) => bytes + readFileSync(join(teacherDir, 'build', file)).length, 0);
    step(`${label}: widget entries=${JSON.stringify(loaded)}, JavaScript bytes requested=${jsBytes}`);
    if (JSON.stringify(loaded) !== JSON.stringify([...expectedWidgets].sort())) {
      violations.push(`${label}: expected ${JSON.stringify(expectedWidgets)}, got ${JSON.stringify(loaded)}`);
    }
  }

  await page.goto(server.resolvedUrls.local[0]);
  await page.getByTitle('More widgets (⌘K)').waitFor();
  await checkLoads('Empty workspace', []);

  await page.getByTitle('More widgets (⌘K)').click();
  await page.getByRole('dialog').getByText('Timer', { exact: true }).click();
  await page.getByTestId('timer-bottom-controls-region').hover();
  await page.getByRole('button', { name: 'Mute timer sound' }).click();
  await page.getByRole('button', { name: /Start$/ }).click();
  await page.getByRole('button', { name: /Pause$/ }).click();
  await page.getByRole('button', { name: /Resume$/ }).waitFor();
  await checkLoads('First Timer opened, started and paused', ['timer']);

  requests.clear();
  await page.reload();
  await page.getByRole('button', { name: /Resume$/ }).waitFor();
  await page.getByRole('button', { name: 'Unmute timer sound' }).waitFor();
  await checkLoads('Paused, muted Timer restored', ['timer']);
  await page.getByTestId('timer-bottom-controls-region').hover();
  await page.screenshot({ path: join(evidence, 'timer-restored.png') });
  assert.deepEqual(errors, [], 'no JavaScript errors during first load or restoration');
  assert.deepEqual(violations, [], 'only widgets actually used may be loaded');
  step('PASS: on-demand loading, first interaction and saved restoration');
} catch (error) {
  step(`FAIL: ${error.stack || error.message}`);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await server?.close();
  write();
}
