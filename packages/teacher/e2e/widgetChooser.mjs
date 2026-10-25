// Run: CHROME_BIN=/path/to/chrome pnpm --filter @classroom-widgets/teacher e2e:widget-chooser
// Failure modes: missing/duplicated choices, grouping changing availability,
// scrolling a whole dialog instead of one column, clipped names, keyboard focus
// stranded outside the viewport, search losing Display or launching offline widgets.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { createStepLog, newTeacherContext, prepareEvidence, startStack } from './harness.mjs';

const evidence = prepareEvidence('widget-chooser', ['chooser.txt', 'web.png', 'web-short.png', 'narrow.png', 'desktop.png', 'desktop-dark.png', 'empty.png']);
const { step, write } = createStepLog(join(evidence, 'chooser.txt'));
const groups = {
  'Run the class': ['Randomiser', 'Timer', 'List', 'Task Cue', 'Traffic Light', 'Volume Monitor'],
  Present: ['Text Banner', 'Image', 'QR Code'],
  'With students': ['Poll', 'Drop Box', 'RT Feedback', 'Questions & Comments', 'Handout', 'Fill in the Blanks', 'Code Fill-in-the-Blanks'],
  Extras: ['Sound Effects', 'Sticker', 'Visualiser'],
};
let stack;
let browser;

try {
  stack = await startStack();
  browser = await chromium.launch({ executablePath: process.env.CHROME_BIN });
  const context = await newTeacherContext(browser, { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(stack.teacherUrl);
  const open = async () => {
    await page.getByTitle('More widgets (⌘K)').click();
    await page.getByRole('dialog').getByRole('textbox').waitFor();
  };
  await open();
  const dialog = page.getByRole('dialog');
  for (const [title, names] of Object.entries(groups)) {
    const group = dialog.getByRole('region', { name: title, exact: true });
    await group.waitFor({ timeout: 5000 });
    assert.deepEqual(await group.getByRole('button').evaluateAll(elements => elements.map(e => e.getAttribute('aria-label') || e.textContent.trim())), names);
    assert.ok(await group.getByRole('group').evaluate(e => e.scrollHeight <= e.clientHeight + 1), `${title}: all choices fit at laptop size`);
  }
  await page.screenshot({ path: join(evidence, 'web.png') });
  step('PASS: full catalogue in four categories, no column scrolling at 1280×800');

  // A short viewport exercises the same overflow path as a longer catalogue.
  await page.setViewportSize({ width: 1280, height: 520 });
  const students = dialog.getByRole('region', { name: 'With students', exact: true });
  const list = students.getByRole('group');
  const headingBefore = await students.getByRole('heading').boundingBox();
  const presentBefore = await dialog.getByRole('region', { name: 'Present', exact: true }).boundingBox();
  assert.ok(await list.evaluate(e => e.scrollHeight > e.clientHeight), 'long column overflows on short screens');
  await list.hover();
  await page.mouse.wheel(0, 600);
  await page.waitForFunction(() => [...document.querySelectorAll('[role="group"]')].some(e => e.scrollTop > 0));
  assert.deepEqual(await students.getByRole('heading').boundingBox(), headingBefore, 'column heading stays fixed');
  assert.deepEqual(await dialog.getByRole('region', { name: 'Present', exact: true }).boundingBox(), presentBefore, 'neighboring column does not move');
  assert.ok(await dialog.evaluate(e => e.scrollHeight <= e.clientHeight + 1), 'no outer dialog scrollbar');
  await page.screenshot({ path: join(evidence, 'web-short.png') });
  step('PASS: wheel scrolls only the overflowing column; headings and adjacent categories stay fixed');

  await dialog.getByRole('textbox').fill('');
  await dialog.getByRole('textbox').press('ArrowDown');
  assert.equal(await page.locator(':focus').getAttribute('aria-label'), 'Randomiser');
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator(':focus').getAttribute('aria-label'), 'Text Banner');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('End');
  assert.equal(await page.locator(':focus').getAttribute('aria-label'), 'Code Fill-in-the-Blanks');
  const focusVisible = await page.locator(':focus').evaluate(e => {
    const item = e.getBoundingClientRect();
    const parent = e.closest('[role="group"]').getBoundingClientRect();
    // scrollTop is rounded to device pixels; rectangles can have half pixels.
    return item.top >= parent.top - 1 && item.bottom <= parent.bottom + 1;
  });
  assert.ok(focusVisible, 'keyboard navigation reveals the last item');
  step('PASS: arrow keys navigate categories; End reveals the last item in a scrolled column');

  await page.setViewportSize({ width: 390, height: 844 });
  const regions = dialog.getByRole('region');
  const bounds = await regions.evaluateAll(elements => elements.map(e => {
    const r = e.getBoundingClientRect();
    return { x: r.x, y: r.y, bottom: r.bottom };
  }));
  assert.ok(bounds.every(b => b.x === bounds[0].x), 'narrow categories share one column');
  assert.ok(bounds.slice(1).every((b, i) => b.y >= bounds[i].bottom), 'narrow categories stack without overlap');
  assert.ok(await dialog.getByRole('group').evaluateAll(elements => elements.every(e => e.clientHeight >= e.scrollHeight)), 'no nested scrolling on narrow screens');
  await dialog.getByRole('button', { name: 'Volume Monitor', exact: true }).focus();
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.locator(':focus').getAttribute('aria-label'), 'Text Banner', 'Down crosses a stacked category boundary');
  await page.keyboard.press('ArrowUp');
  assert.equal(await page.locator(':focus').getAttribute('aria-label'), 'Volume Monitor', 'Up returns to the previous stacked category');
  await page.keyboard.press('Home');
  assert.equal(await page.locator(':focus').getAttribute('aria-label'), 'Randomiser', 'Home reaches the start of the stacked list');
  await page.keyboard.press('ArrowUp');
  assert.equal(await page.locator(':focus').getAttribute('aria-label'), 'Search widgets', 'Up returns to search only from the first item');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('End');
  assert.equal(await page.locator(':focus').getAttribute('aria-label'), 'Visualiser', 'End reaches the end of the stacked list');
  assert.ok(await page.locator(':focus').evaluate(e => {
    const item = e.getBoundingClientRect();
    const scroller = e.closest('section').parentElement.getBoundingClientRect();
    return item.top >= scroller.top - 1 && item.bottom <= scroller.bottom + 1;
  }), 'keyboard navigation reveals the last item in the shared scroller');
  await page.screenshot({ path: join(evidence, 'narrow.png') });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal page overflow');
  step('PASS: narrow chooser has one scrolling list; Up/Down cross category boundaries and Home/End reveal the first/last item');

  await page.setViewportSize({ width: 1280, height: 800 });
  const search = dialog.getByRole('textbox');
  await search.fill('  qr code  ');
  await search.press('Enter');
  await dialog.waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Generate QR Code', exact: true }).waitFor();
  await open();
  await search.fill('with students');
  assert.equal(await dialog.getByRole('region').count(), 1, 'search matches group names');
  assert.equal(await dialog.getByRole('region').getByRole('button').count(), 7);
  await search.fill('nothing matches this');
  await dialog.getByText('No widgets found').waitFor();
  await page.screenshot({ path: join(evidence, 'empty.png') });
  await dialog.getByRole('button', { name: 'Clear search' }).click();
  assert.equal(await dialog.getByRole('region').count(), 4);
  stack.server.kill();
  await page.getByRole('button', { name: 'Disconnected from server', exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await dialog.getByRole('button', { name: 'QR Code', exact: true }).focus();
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.locator(':focus').getAttribute('aria-label'), 'Sound Effects', 'stacked navigation skips the disabled student category');
  await page.keyboard.press('ArrowUp');
  assert.equal(await page.locator(':focus').getAttribute('aria-label'), 'QR Code');
  await search.fill('Poll');
  assert.ok(await dialog.getByRole('button', { name: 'Poll', exact: true }).isDisabled());
  await search.press('Enter');
  assert.ok(await dialog.isVisible(), 'Enter cannot launch an offline widget');
  await search.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  step('PASS: trimmed search, group search, empty/reset, single-result launch, offline gating and Escape');

  const desktopContext = await newTeacherContext(browser, { viewport: { width: 850, height: 580 }, deviceScaleFactor: 2 });
  // Exercise the hosted desktop surface and its real native-message boundary.
  // This does not claim to run a native window manager.
  await desktopContext.addInitScript(() => {
    window.__CLASSROOM_WIDGETS_MACOS__ = true;
    window.chooserMessages = [];
    window.webkit = { messageHandlers: { classroomDashboard: { postMessage: message => window.chooserMessages.push(message) } } };
  });
  const desktop = await desktopContext.newPage();
  desktop.on('pageerror', error => errors.push(error.message));
  await desktop.goto(`${stack.teacherUrl}/?surface=widget-launcher`);
  await desktop.getByRole('heading', { name: 'Add a widget', exact: true }).waitFor();
  assert.equal(await desktop.getByRole('region').count(), 3);
  assert.deepEqual(await desktop.getByRole('region', { name: 'Present', exact: true }).getByRole('button').evaluateAll(elements => elements.map(e => e.getAttribute('aria-label'))), ['Link Shortener', 'Text Banner', 'QR Code', 'Display']);
  assert.equal(await desktop.getByRole('region').getByRole('button').count(), 10);
  assert.ok(await desktop.getByRole('group').evaluateAll(elements => elements.every(e => e.scrollHeight <= e.clientHeight + 1)), 'all desktop entries fit');
  await desktop.screenshot({ path: join(evidence, 'desktop.png') });
  await desktop.emulateMedia({ colorScheme: 'dark' });
  await desktop.screenshot({ path: join(evidence, 'desktop-dark.png') });
  await desktop.getByRole('textbox').fill('Display');
  await desktop.getByRole('textbox').press('Enter');
  assert.deepEqual(await desktop.evaluate(() => window.chooserMessages.map(m => m.type)), ['desktop-launcher-open-display-preview', 'desktop-launcher-close']);
  await desktop.getByRole('textbox').fill('Timer');
  await desktop.getByRole('button', { name: 'Timer', exact: true }).click();
  assert.deepEqual(await desktop.evaluate(() => window.chooserMessages.slice(-2)), [
    { type: 'desktop-launcher-add-widget', schemaVersion: 1, widgetType: 1 },
    { type: 'desktop-launcher-close', schemaVersion: 1 },
  ]);
  assert.deepEqual(errors, [], 'no browser errors');
  step('PASS: native-only catalogue, Display search/Enter, Timer click and native bridge payloads; light/dark captures');
} catch (error) {
  step(`FAIL: ${error.stack || error.message}`);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await stack?.stop();
  write();
}
