// Moves the real X pointer with xdotool over two widget panels of the real app
// (out/main/main.js with the teacher build and its hidden host) and checks
// that each panel's chrome strip shows while the pointer is over that panel,
// stays hidden on the other one, and hides again about 1.2 s after the pointer
// leaves, also once the other panel has closed. Build the teacher app and this
// package first, then from the repository root (install xvfb and xdotool on
// headless Linux):
// CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR=<dir> xvfb-run -a -s '-screen 0 1920x1080x24' packages/linux-dashboard/node_modules/.bin/electron --no-sandbox --disable-gpu packages/linux-dashboard/tests/panelHover.cjs --background
// Evidence: hover.txt (each step, what was observed and how long it took) and
// hover-chrome.png (a panel with its chrome shown under the pointer).
const { app, BrowserWindow, Tray } = require('electron');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

const root = resolve(__dirname, '..');
app.setAppPath(root);
const evidence = resolve(process.env.CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR || join(tmpdir(), 'classroom-widgets-test-evidence', 'linux-panel-hover'));
mkdirSync(evidence, { recursive: true });
const temporary = mkdtempSync(join(tmpdir(), 'classroom-panel-hover-'));
app.setPath('userData', temporary);
app.setPath('sessionData', temporary);
process.env.XDG_CONFIG_HOME = temporary;

let tray;
const setContextMenu = Tray.prototype.setContextMenu;
Tray.prototype.setContextMenu = function (menu) { tray = menu; return setContextMenu.call(this, menu); };
const item = (label) => tray?.items.find((entry) => entry.label === label);
const delay = (ms) => new Promise((done) => setTimeout(done, ms));
const lines = [];
const record = (line) => { lines.push(line); console.log(line); };
async function until(label, check, timeout = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = await check();
    if (value) return value;
    await delay(20);
  }
  throw new Error(`Timed out: ${label}`);
}

const panels = {};
const chromeShown = (panel) => panel.window.webContents.executeJavaScript("document.getElementById('chrome').classList.contains('visible')");
const pointerAt = (x, y) => execFileSync('xdotool', ['mousemove', String(x), String(y)]);
const centre = (panel) => {
  const bounds = panel.window.getBounds();
  return [bounds.x + Math.round(bounds.width / 2), bounds.y + Math.round(bounds.height / 2)];
};
const OUTSIDE = [1880, 1040];

async function open(label, title, frame) {
  item(label).click();
  const window = await until(`${title} panel`, () => BrowserWindow.getAllWindows().find((win) => win.getTitle() === title
    && win.isVisible() && win.webContents.getURL().endsWith('panel-chrome.html')));
  await until(`${title} chrome loaded`, async () => !window.webContents.isLoading()
    && await window.webContents.executeJavaScript("document.getElementById('title').textContent") === title);
  window.setBounds(frame);
  panels[title] = { title, window };
  return panels[title];
}

/** Waits for a panel's chrome to reach `shown` and returns how long it took from `since`. */
async function chromeBecomes(panel, shown, since, timeout) {
  await until(`${panel.title} chrome ${shown ? 'shown' : 'hidden'}`, async () => (await chromeShown(panel)) === shown, timeout);
  return Date.now() - since;
}

require('../out/main/main.js');

app.whenReady().then(async () => {
  try {
    execFileSync('xdotool', ['version']);
    await until('widgets in the tray', () => item('⏱️  Timer') && item('🎲  Randomiser'), 30000);
    pointerAt(...OUTSIDE);
    const timer = await open('⏱️  Timer', 'Timer', { x: 80, y: 80, width: 420, height: 330 });
    const randomiser = await open('🎲  Randomiser', 'Randomiser', { x: 900, y: 80, width: 420, height: 330 });
    await delay(1600);
    assert.equal(await chromeShown(timer), false, 'Timer chrome starts hidden with the pointer elsewhere');
    assert.equal(await chromeShown(randomiser), false, 'Randomiser chrome starts hidden with the pointer elsewhere');
    record('PASS both panels open with their chrome hidden while the pointer is elsewhere');

    let moved = Date.now();
    pointerAt(...centre(timer));
    const timerShown = await chromeBecomes(timer, true, moved, 1000);
    assert.equal(await chromeShown(randomiser), false, 'Randomiser chrome stays hidden while the pointer is over Timer');
    record(`PASS pointer over Timer shows its chrome after ${timerShown} ms; Randomiser chrome stays hidden`);

    moved = Date.now();
    pointerAt(...centre(randomiser));
    const randomiserShown = await chromeBecomes(randomiser, true, moved, 1000);
    assert.equal(await chromeShown(timer), true, 'Timer chrome lingers just after the pointer leaves');
    const timerHidden = await chromeBecomes(timer, false, moved, 3000);
    assert.ok(timerHidden >= 1100, `Timer chrome hid ${timerHidden} ms after the pointer left, before the 1.2 s grace period`);
    assert.equal(await chromeShown(randomiser), true, 'Randomiser chrome stays shown while the pointer is over it');
    record(`PASS pointer over Randomiser shows its chrome after ${randomiserShown} ms; Timer chrome hides ${timerHidden} ms after the pointer left`);
    writeFileSync(join(evidence, 'hover-chrome.png'), (await randomiser.window.capturePage()).toPNG());

    moved = Date.now();
    pointerAt(...OUTSIDE);
    const randomiserHidden = await chromeBecomes(randomiser, false, moved, 3000);
    assert.ok(randomiserHidden >= 1100, `Randomiser chrome hid ${randomiserHidden} ms after the pointer left, before the grace period`);
    record(`PASS pointer away from both panels hides Randomiser chrome after ${randomiserHidden} ms`);

    await timer.window.webContents.executeJavaScript("document.getElementById('close').click()");
    await until('Timer panel closed', () => timer.window.isDestroyed() || !timer.window.isVisible());
    moved = Date.now();
    pointerAt(...centre(randomiser));
    const afterClose = await chromeBecomes(randomiser, true, moved, 1000);
    moved = Date.now();
    pointerAt(...OUTSIDE);
    const afterCloseHidden = await chromeBecomes(randomiser, false, moved, 3000);
    record(`PASS after Timer closes, pointer over Randomiser shows its chrome after ${afterClose} ms and leaving hides it after ${afterCloseHidden} ms`);

    record('PASS');
    finish(0);
  } catch (error) {
    record(`FAIL: ${error.stack || error.message}`);
    finish(1);
  }
});

function finish(code) {
  writeFileSync(join(evidence, 'hover.txt'), lines.join('\n') + '\n');
  rmSync(temporary, { recursive: true, force: true });
  app.exit(code);
}
