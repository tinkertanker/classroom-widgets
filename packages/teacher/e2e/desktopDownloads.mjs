// Run with CHROME_BIN set when using a system Chromium installation.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { createStepLog, newTeacherContext, prepareEvidence, startStack } from './harness.mjs';

const evidence = prepareEvidence('desktop-downloads', ['downloads.txt', 'download-idle.png', 'download-hover.png', 'download-popup.png', 'download-tablet.png', 'corner-controls.png', 'menu-version.png', 'mobile-menu-dark.png', 'homepage-downloads.png']);
const { step, write } = createStepLog(join(evidence, 'downloads.txt'));
const platforms = [
  ['Windows', 'windows', 'windows-x64-setup.exe'],
  ['macOS', 'macos', 'macos.dmg'],
  ['Linux', 'linux', 'linux-x86_64.AppImage']
];
let stack;
let browser;

try {
  process.env.VITE_BUILD_ID = 'corner-controls-e2e';
  stack = await startStack();
  browser = await chromium.launch({ executablePath: process.env.CHROME_BIN });
  const context = await newTeacherContext(browser, { deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(stack.teacherUrl);
  const trigger = page.getByRole('button', { name: 'Download desktop apps', exact: true });
  await trigger.waitFor();
  const about = page.getByRole('link', { name: 'About', exact: true });
  assert.equal(await about.count(), 1, 'desktop has an About shortcut');
  assert.equal(await about.getAttribute('href'), '/about');
  assert.equal(await about.locator('svg[aria-hidden="true"]').count(), 1, 'About has a decorative Info icon');
  assert.equal(await page.getByText('Web corner-controls-e2e', { exact: true }).count(), 0, 'the version no longer occupies the canvas');
  for (const width of [800, 1000, 1100]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByTitle('Menu', { exact: true }).hover();
    await page.waitForTimeout(350);
    const toolbarBounds = await page.locator('.toolbar-content').boundingBox();
    for (const [name, control] of [['Download', trigger], ['About', about]]) {
      const buttonBounds = await control.boundingBox();
      const overlaps = buttonBounds.x < toolbarBounds.x + toolbarBounds.width
        && buttonBounds.x + buttonBounds.width > toolbarBounds.x
        && buttonBounds.y < toolbarBounds.y + toolbarBounds.height
        && buttonBounds.y + buttonBounds.height > toolbarBounds.y;
      step(`Toolbar at ${width}px: ${name}=${JSON.stringify(buttonBounds)}, toolbar=${JSON.stringify(toolbarBounds)}`);
      assert.equal(overlaps, false, `${name} must not overlap the toolbar at ${width}px`);
    }
  }
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.mouse.move(200, 100);
  assert.ok(await about.evaluate(element => Number(getComputedStyle(element).opacity) < 0.5), 'About is faded at rest');
  const aboutBounds = await about.boundingBox();
  const triggerBounds = await trigger.boundingBox();
  assert.equal(aboutBounds.y, triggerBounds.y, 'corner shortcuts are vertically aligned');
  assert.equal(aboutBounds.height, triggerBounds.height, 'corner shortcuts have matching heights');
  assert.equal(aboutBounds.x, 1400 - triggerBounds.x - triggerBounds.width, 'corner shortcuts have equal edge spacing');
  await page.getByTitle('Menu', { exact: true }).hover();
  await page.waitForTimeout(350);
  await page.screenshot({ path: join(evidence, 'corner-controls.png'), clip: { x: 0, y: 680, width: 1400, height: 220 } });
  await about.hover();
  await page.waitForFunction(() => getComputedStyle(document.querySelector('a[href="/about"]')).opacity === '1');
  await page.mouse.move(200, 100);
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('a[href="/about"]')).opacity) < 0.5);
  await about.focus();
  await page.waitForFunction(() => getComputedStyle(document.querySelector('a[href="/about"]')).opacity === '1');
  await about.evaluate(element => element.blur());
  step('PASS: About has its Info icon, mirrors Download, and becomes solid on hover and keyboard focus');
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
  await popup.getByRole('heading', { name: 'Get the desktop app' }).click();
  assert.equal(await popup.count(), 1, 'clicking popup text must not dismiss it');
  assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
  for (const [name, platform, suffix] of platforms) {
    const link = popup.getByRole('link', { name: new RegExp(name) });
    const href = await link.getAttribute('href');
    assert.equal(href, `${stack.serverUrl}/api/downloads/${platform}`);
    assert.equal(await link.getAttribute('target'), '_blank', 'download errors must not replace the teaching board');
    assert.equal(await link.getAttribute('rel'), 'noopener noreferrer');
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

  await page.setViewportSize({ width: 800, height: 900 });
  await trigger.click();
  await popup.waitFor();
  await page.screenshot({ path: join(evidence, 'download-tablet.png') });
  await page.keyboard.press('Escape');

  await page.setViewportSize({ width: 1400, height: 900 });
  await page.getByTitle('Menu', { exact: true }).click();
  const menu = page.getByRole('menu');
  const version = menu.getByText('Web corner-controls-e2e', { exact: true });
  await version.waitFor();
  const menuAboutBounds = await menu.getByRole('link', { name: 'About', exact: true }).boundingBox();
  const versionBounds = await version.boundingBox();
  assert.ok(versionBounds.y >= menuAboutBounds.y + menuAboutBounds.height, 'version is in the footer below About');
  await page.screenshot({ path: join(evidence, 'menu-version.png'), clip: { x: 0, y: 350, width: 1400, height: 550 } });
  await page.keyboard.press('Escape');
  step('PASS: the actual build label is available only in the Menu footer');

  for (const width of [541, 540, 539]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(100);
    assert.equal(await trigger.isVisible(), width >= 540, `Download visibility at ${width}px`);
    assert.equal(await about.isVisible(), width >= 540, `About visibility at ${width}px`);
  }
  await page.setViewportSize({ width: 800, height: 900 });
  await trigger.click();
  await popup.waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await trigger.waitFor({ state: 'hidden' });
  assert.equal(await about.isVisible(), false, 'About is hidden on mobile');
  assert.equal(await popup.count(), 0, 'an open download popup is dismissed on entering mobile layout');
  await page.getByTitle('Menu', { exact: true }).click();
  await version.waitFor();
  assert.equal(await menu.getByRole('link', { name: 'About', exact: true }).isVisible(), true);
  assert.equal(await menu.getByRole('link', { name: 'Get desktop apps', exact: true }).isVisible(), true);
  assert.equal(await menu.getByRole('link', { name: 'Get desktop apps', exact: true }).getAttribute('href'), '/about#desktop');
  await page.screenshot({ path: join(evidence, 'mobile-menu-dark.png') });
  await page.keyboard.press('Escape');
  assert.equal(await menu.count(), 0, 'hidden Download popup does not intercept the Menu Escape key');
  step('PASS: both corner shortcuts are hidden on mobile; Menu retains About, downloads and the version');

  await page.setViewportSize({ width: 1400, height: 900 });
  await trigger.waitFor();
  assert.equal(await trigger.getAttribute('aria-expanded'), 'false', 'returning to desktop does not restore a stale popup');
  await about.click();
  await page.waitForURL(`${stack.teacherUrl}/about`);
  step('PASS: the About corner shortcut navigates to the homepage');
  for (const [name, platform] of platforms) {
    const link = page.getByRole('link', { name: `Download for ${name}`, exact: true });
    assert.equal(await link.getAttribute('href'), `${stack.serverUrl}/api/downloads/${platform}`);
    assert.equal(await link.getAttribute('target'), '_blank');
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
