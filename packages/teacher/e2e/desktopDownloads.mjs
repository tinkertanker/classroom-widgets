// Run with CHROME_BIN set when using a system Chromium installation.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { createStepLog, newTeacherContext, prepareEvidence, startStack } from './harness.mjs';

const evidence = prepareEvidence('desktop-downloads', ['downloads.txt', 'download-idle.png', 'download-hover.png', 'download-popup.png', 'download-narrow-dark.png', 'homepage-downloads.png']);
const { step, write } = createStepLog(join(evidence, 'downloads.txt'));
const platforms = [
  ['Windows', 'windows', 'windows-x64-setup.exe'],
  ['macOS', 'macos', 'macos.dmg'],
  ['Linux', 'linux', 'linux-x86_64.AppImage']
];
let stack;
let browser;

try {
  stack = await startStack();
  browser = await chromium.launch({ executablePath: process.env.CHROME_BIN });
  const context = await newTeacherContext(browser, { deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(stack.teacherUrl);
  const trigger = page.getByRole('button', { name: 'Download desktop apps', exact: true });
  await trigger.waitFor();
  const idleOpacity = await trigger.evaluate(element => Number(getComputedStyle(element).opacity));
  assert.ok(idleOpacity > 0 && idleOpacity < 0.5, 'Download is subtly visible by default');
  const corner = { x: 1050, y: 760, width: 350, height: 140 };
  await page.screenshot({ path: join(evidence, 'download-idle.png'), clip: corner });
  await trigger.hover();
  await page.waitForFunction(() => getComputedStyle(document.querySelector('[aria-controls="desktop-downloads"]')).opacity === '1');
  await page.screenshot({ path: join(evidence, 'download-hover.png'), clip: corner });
  await page.mouse.move(200, 100);
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('[aria-controls="desktop-downloads"]')).opacity) < 0.5);
  await trigger.focus();
  await page.waitForFunction(() => getComputedStyle(document.querySelector('[aria-controls="desktop-downloads"]')).opacity === '1');
  step('PASS: Download is faded at rest, solid on hover and keyboard focus, and fades again after hover');
  await trigger.click({ timeout: 10000 });
  const popup = page.getByRole('region', { name: 'Download desktop apps' });
  await popup.waitFor();
  await popup.getByRole('link').first().focus();
  await page.mouse.move(200, 100);
  await page.waitForFunction(() => getComputedStyle(document.querySelector('[aria-controls="desktop-downloads"]')).opacity === '1');
  assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
  for (const [name, platform, suffix] of platforms) {
    const link = popup.getByRole('link', { name: new RegExp(name) });
    const href = await link.getAttribute('href');
    assert.equal(href, `${stack.serverUrl}/api/downloads/${platform}`);
    // Exercise the actual server and GitHub metadata without fetching installers.
    const response = await fetch(href, { redirect: 'manual' });
    assert.equal(response.status, 302);
    const target = response.headers.get('location');
    assert.ok(target.startsWith('https://github.com/tinkertanker/classroom-widgets/releases/download/v'));
    assert.ok(target.endsWith(`-${suffix}`));
    step(`${name}: ${href} → ${response.status} ${target}`);
  }
  await page.screenshot({ path: join(evidence, 'download-popup.png') });
  await page.keyboard.press('Escape');
  assert.equal(await popup.count(), 0);
  assert.equal(await trigger.evaluate(element => element === document.activeElement), true);
  await page.keyboard.press('Enter');
  await popup.waitFor();
  await page.keyboard.press('Tab');
  assert.equal(await popup.getByRole('link').first().evaluate(element => element === document.activeElement), true);
  await page.mouse.click(200, 100);
  assert.equal(await popup.count(), 0);
  step('PASS: keyboard opening, tabbable downloads, Escape/focus restoration and outside-click dismissal');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await trigger.click();
  await popup.waitFor();
  const bounds = await popup.boundingBox();
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390, 'popup fits a narrow viewport');
  const downloadBounds = await trigger.boundingBox();
  const menuBounds = await page.getByTitle('Menu', { exact: true }).boundingBox();
  assert.ok(downloadBounds.y + downloadBounds.height <= menuBounds.y, 'Download must sit above the narrow-screen toolbar');
  await page.screenshot({ path: join(evidence, 'download-narrow-dark.png') });
  await page.keyboard.press('Escape');
  step('PASS: Download remains visible in narrow column layout and dark appearance');

  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(`${stack.teacherUrl}/about#desktop`);
  for (const [name, platform] of platforms) {
    const link = page.getByRole('link', { name: `Download for ${name}`, exact: true });
    assert.equal(await link.getAttribute('href'), `${stack.serverUrl}/api/downloads/${platform}`);
  }
  await page.locator('#desktop').scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(evidence, 'homepage-downloads.png') });
  assert.deepEqual(errors, [], 'no browser runtime errors');
  step('PASS: homepage and popup share the same stable platform URLs');
} catch (error) {
  step(`FAIL: ${error.stack || error.message}`);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await stack?.stop();
  write();
}
