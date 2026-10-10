// Build teacher with `pnpm --filter @classroom-widgets/teacher build:desktop`
// and Linux with `npm --prefix packages/linux-dashboard run build`, then run:
// CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR=<dir> xvfb-run -a packages/linux-dashboard/node_modules/.bin/electron --no-sandbox --disable-gpu packages/linux-dashboard/tests/widgetEditing.cjs
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

const evidence = resolve(process.env.CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR
  || join(tmpdir(), 'classroom-widgets-test-evidence/widget-editing'));
mkdirSync(evidence, { recursive: true });
const temporary = mkdtempSync(join(tmpdir(), 'classroom-widget-editing-'));
app.setAppPath(resolve(__dirname, '..'));
app.setPath('userData', temporary);
app.setPath('sessionData', temporary);
process.env.XDG_CONFIG_HOME = temporary;
const { registerPrivilegedScheme, installProtocolHandler } = require('../out/main/appProtocol');
const { DashboardSettings } = require('../out/main/settings');
const { WidgetHostController } = require('../out/main/hostController');
registerPrivilegedScheme();

const lines = [];
const record = message => { lines.push(message); console.log(message); };
const delay = ms => new Promise(done => setTimeout(done, ms));
async function until(label, check) {
  for (let i = 0; i < 200; i++) {
    const value = await check();
    if (value) return value;
    await delay(50);
  }
  throw new Error(`Timed out: ${label}`);
}
const button = label => `Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().endsWith(${JSON.stringify(label)}))`;
const exists = (view, expression) => view.executeJavaScript(`!!(${expression})`);
async function click(view, expression) {
  await until(`click target ${expression}`, () => exists(view, expression));
  const point = await view.executeJavaScript(`(() => {
    const element = ${expression};
    element.focus();
    element.scrollIntoView({ block: 'nearest' });
    const rect = element.getBoundingClientRect();
    return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
  })()`);
  view.focus();
  view.sendInputEvent({ type: 'mouseMove', ...point });
  view.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...point });
  view.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...point });
  await delay(100);
}
async function fill(view, selector, value) {
  await until(`input ${selector}`, () => exists(view, `document.querySelector(${JSON.stringify(selector)})`));
  await view.executeJavaScript(`(() => { const input = document.querySelector(${JSON.stringify(selector)}); input.focus(); input.select(); })()`);
  await view.insertText(value);
  await until('typed value rendered', () => view.executeJavaScript(`document.querySelector(${JSON.stringify(selector)})?.value === ${JSON.stringify(value)}`));
}
async function focusByKeyboard(view, expression) {
  view.focus();
  for (let i = 0; i < 40; i++) {
    if (await view.executeJavaScript(`document.activeElement === (${expression}) && document.activeElement.matches(':focus-visible')`)) return;
    view.sendInputEvent({ type: 'keyDown', keyCode: 'Tab' });
    view.sendInputEvent({ type: 'keyUp', keyCode: 'Tab' });
    await delay(20);
  }
  throw new Error(`Cannot keyboard-focus ${expression}`);
}
async function activate(view, expression) {
  await focusByKeyboard(view, expression);
  view.sendInputEvent({ type: 'keyDown', keyCode: 'Space' });
  view.sendInputEvent({ type: 'keyUp', keyCode: 'Space' });
  await delay(100);
}
async function capture(view, name) {
  await delay(200); // capturePage can otherwise read the previous compositor frame.
  writeFileSync(join(evidence, `${name}.png`), (await view.capturePage()).toPNG());
}
const watchdog = setTimeout(() => finish(new Error('E2E timed out')), 90000);
app.whenReady().then(async () => {
  installProtocolHandler();
  const host = new WidgetHostController(new DashboardSettings(), 'widget-editing-e2e');
  await host.start();
  await until('host ready', () => host.widgetOptions.length > 0);
  await host.addWidget(0);
  const window = await until('Randomiser window', () => BrowserWindow.getAllWindows()
    .find(win => win.webContents.getURL().endsWith('panel-chrome.html')));
  const view = window.contentView.children[0].webContents;
  await until('Randomiser ready', () => exists(view, button('Settings')));
  await click(view, button('Settings'));
  await until('Randomiser settings', () => exists(view, 'document.querySelector("#textarea")'));
  await fill(view, '#textarea', 'Alice\nBob\nCharlie');
  await click(view, button('Saved Lists'));
  await click(view, button('Save Current'));
  await capture(view, 'saved-list-name-form');
  assert.ok(await exists(view, `document.querySelector('input[placeholder="My list..."]')`),
    'D01: mouse-clicking Save Current must open the name form, not dismiss both dialogs');
  assert.ok(await exists(view, 'document.querySelector("#textarea")'), 'parent Settings stays mounted');
  await fill(view, 'input[placeholder="My list..."]', 'Class names');
  view.sendInputEvent({ type: 'keyDown', keyCode: 'Enter' });
  view.sendInputEvent({ type: 'keyUp', keyCode: 'Enter' });
  await until('saved name dialog closed', async () => !await exists(view, `document.querySelector('input[placeholder="My list..."]')`));
  await click(view, button('Saved Lists'));
  assert.ok(await view.executeJavaScript('document.body.innerText.includes("Class names")'), 'saved list is available');
  // A click outside the child dialog closes only that dialog, not its parent.
  view.sendInputEvent({ type: 'mouseDown', x: 2, y: 2, button: 'left', clickCount: 1 });
  view.sendInputEvent({ type: 'mouseUp', x: 2, y: 2, button: 'left', clickCount: 1 });
  await delay(150);
  assert.ok(await exists(view, 'document.querySelector("#textarea")'), 'child backdrop leaves parent Settings open');
  assert.ok(!await exists(view, button('Save Current')), 'child backdrop closes Saved Lists');
  view.sendInputEvent({ type: 'mouseDown', x: 2, y: 2, button: 'left', clickCount: 1 });
  view.sendInputEvent({ type: 'mouseUp', x: 2, y: 2, button: 'left', clickCount: 1 });
  await until('parent backdrop dismissal', async () => !await exists(view, 'document.querySelector("#textarea")'));
  record('PASS D01: nested mouse input saves a list; child and parent backdrops dismiss only their own dialog');

  await delay(250); // Let the parent modal's closing animation finish before reopening.
  await click(view, button('Settings'));
  await fill(view, '#textarea', 'Zebra');
  await fill(view, 'textarea[placeholder="Removed items will appear here..."]', 'Dormouse');
  await click(view, button('Saved Lists'));
  await click(view, button('Load'));
  assert.equal(await view.executeJavaScript('document.querySelector("#textarea").value'), 'Alice\nBob\nCharlie');
  await click(view, button('Save'));
  await click(view, button('Randomise!!'));
  await until('draw complete', () => exists(view, button('Again!')));
  await capture(view, 'loaded-list-draw');
  assert.ok(!await view.executeJavaScript('document.body.innerText.includes("Zebra")'),
    'D02: draw must use the loaded list, not the previously active Zebra');
  await click(view, 'document.querySelector("button[title=Settings]")');
  assert.equal(await view.executeJavaScript('document.querySelector("#textarea").value'), 'Alice\nBob\nCharlie',
    'loaded choices survive closing and reopening Settings');
  assert.equal(await view.executeJavaScript('document.querySelectorAll("textarea")[1].value'), '',
    'loading a saved list also clears the previous removed choices');
  await until('persisted loaded list', () => {
    const state = host.panelCoordinator.lastInventory.widgets[0]?.snapshotPayload.state;
    return state?.choices?.join('\n') === 'Alice\nBob\nCharlie' && state.removedChoices?.length === 0;
  });
  const saved = host.panelCoordinator.lastInventory.widgets[0].snapshotPayload.state;
  assert.deepEqual(saved.choices, ['Alice', 'Bob', 'Charlie']);
  assert.deepEqual(saved.removedChoices, []);
  record('PASS D02: loading a list changes actual draw choices and persisted state, and clears removed choices');

  window.hide();
  await host.addWidget(1);
  const timerWindow = await until('Timer window', () => BrowserWindow.getAllWindows()
    .find(win => win !== window && win.webContents.getURL().endsWith('panel-chrome.html')));
  const timer = timerWindow.contentView.children[0].webContents;
  await until('Timer rendered', () => exists(timer, button('Start')));
  timerWindow.focus();
  const displayedTime = () => timer.executeJavaScript(`Array.from(document.querySelectorAll('span[title="Click to edit"]')).map(e => e.textContent).join(':')`);
  const editSegment = async (index, value) => {
    await click(timer, `document.querySelectorAll('span[title="Click to edit"]')[${index}]`);
    await fill(timer, 'input', value);
    timer.sendInputEvent({ type: 'keyDown', keyCode: 'Enter' });
    timer.sendInputEvent({ type: 'keyUp', keyCode: 'Enter' });
    await until('segment edit committed', async () => !await exists(timer, 'document.querySelector("input")'));
  };
  const quickAdd = async label => {
    await activate(timer, `document.querySelector('[aria-label="Show add time options"]')`);
    await activate(timer, button(label));
  };
  await editSegment(1, '05');
  assert.equal(await displayedTime(), '00:05:10');
  await quickAdd('+1m');
  const observed = { idle: await displayedTime() };
  await focusByKeyboard(timer, button('Start'));
  await capture(timer, 'timer-idle-quick-add');
  await activate(timer, button('Start'));
  await activate(timer, button('Pause'));
  await editSegment(1, '03');
  await editSegment(2, '23');
  assert.equal(await displayedTime(), '00:03:23');
  await quickAdd('+2m');
  observed.paused = await displayedTime();
  assert.ok(await exists(timer, button('Resume')), 'quick-add keeps a paused timer paused');
  await focusByKeyboard(timer, button('Resume'));
  await capture(timer, 'timer-paused-quick-add');
  // The edited value plus the increment can equal the hook's old remaining time.
  // This must still update the editor even when React's numeric state is unchanged.
  await editSegment(1, '04');
  await editSegment(2, '23');
  await quickAdd('+1m');
  observed.pausedEqualTotal = await displayedTime();
  await activate(timer, button('Resume'));
  assert.ok(await exists(timer, button('Pause')), 'Resume starts the countdown');
  assert.ok(!await exists(timer, `document.querySelector('span[title="Click to edit"]')`), 'running time is not editable');
  observed.resumesEditedTime = await timer.executeJavaScript(`document.querySelector('[data-testid="timer-visual-shell"]').textContent.includes('05:23')`);
  await activate(timer, button('Restart'));
  observed.restart = await displayedTime();
  record(`D03 observed: ${JSON.stringify(observed)}`);
  assert.deepEqual(observed, {
    idle: '00:06:10', paused: '00:05:23', pausedEqualTotal: '00:05:23', resumesEditedTime: true, restart: '00:09:10'
  }, 'D03: quick-add uses edited values, preserves paused state and retains the restart duration');
  record('PASS D03: idle and paused manual edits survive quick-add, Resume and Restart');
}).then(() => finish(), finish);

function finish(error) {
  clearTimeout(watchdog);
  if (error) record(`FAIL: ${error.stack || error}`);
  writeFileSync(join(evidence, 'widget-editing.txt'), lines.join('\n') + '\n');
  rmSync(temporary, { recursive: true, force: true });
  app.exit(error ? 1 : 0);
}
