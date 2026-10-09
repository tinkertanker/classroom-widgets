// Build teacher:desktop and Linux first. Use a decorated 2560x900 X11
// session (Xvfb + Openbox on headless Linux), with xdotool and ImageMagick:
// CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR=<dir> node_modules/.bin/electron --no-sandbox --disable-gpu tests/displayShell.cjs --background --case=<case>
// Cases: move, always-on-top, aspect, aspect-limit, pointer-missing, pointer-unavailable, pointer-success.
// As in arrange.cjs, one X screen is reported as two 1280x800 monitors.
// For capture only, the real X screen's capture ID is assigned to fixture
// monitor 2. This checks real window/renderer/IPC/shortcut behavior, not
// physical multi-monitor capture identity or a Wayland compositor.
const electron = require('electron');
const { app, BrowserWindow, Menu, Tray } = electron;
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

const scenario = process.argv.find(arg => arg.startsWith('--case='))?.slice(7);
assert.ok(['move', 'always-on-top', 'aspect', 'aspect-limit', 'pointer-missing', 'pointer-unavailable', 'pointer-success'].includes(scenario));
const root = resolve(__dirname, '..');
const evidence = resolve(process.env.CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR || join(tmpdir(), 'classroom-widgets-test-evidence/linux-display-shell'));
mkdirSync(evidence, { recursive: true });
const temporary = mkdtempSync(join(tmpdir(), 'classroom-display-shell-'));
app.setAppPath(root);
app.setPath('userData', temporary);
app.setPath('sessionData', temporary);
process.env.XDG_CONFIG_HOME = temporary;
writeFileSync(join(temporary, 'settings.json'), JSON.stringify({
  alwaysOnTop: scenario !== 'always-on-top',
  displayPreviewFrame: { left: 150, top: 140, width: 600, height: 460 },
  displayPreviewSourceId: 2,
}));
const displays = [0, 1].map(index => ({ id: index + 1, label: `Display ${index + 1}`, scaleFactor: 1, internal: false,
  bounds: { x: index * 1280, y: 0, width: 1280, height: 800 }, workArea: { x: index * 1280, y: 0, width: 1280, height: 800 } }));
const overlap = (a, b) => Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x))
  * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
app.whenReady().then(() => {
  const { screen, desktopCapturer } = electron;
  screen.getAllDisplays = () => displays;
  screen.getPrimaryDisplay = () => displays[0];
  screen.getDisplayMatching = rect => displays[overlap(rect, displays[1].bounds) > overlap(rect, displays[0].bounds) ? 1 : 0];
  const getSources = desktopCapturer.getSources.bind(desktopCapturer);
  desktopCapturer.getSources = async options => (await getSources(options)).map(source => ({ ...source, display_id: '2' }));
});
let tray;
let context;
const setContextMenu = Tray.prototype.setContextMenu;
Tray.prototype.setContextMenu = function (menu) { tray = menu; return setContextMenu.call(this, menu); };
Menu.prototype.popup = function () { context = this; }; // Use the real menu items, without leaving a popup grabbed.
const item = label => tray.items.find(entry => entry.label === label);
const delay = ms => new Promise(done => setTimeout(done, ms));
const lines = [];
const record = value => { lines.push(value); console.log(value); };
async function until(label, check) {
  for (let i = 0; i < 200; i++) {
    const result = await check();
    if (result) return result;
    await delay(50);
  }
  throw new Error(`Timed out: ${label}`);
}
const watchdog = setTimeout(() => finish(new Error('E2E timed out')), 60000);
require('../out/main/main');
app.whenReady().then(async () => {
  await until('widget tray', () => tray && item('⏱️  Timer'));
  if (scenario === 'move') {
    item('⏱️  Timer').click();
    const timer = await until('Timer window', () => BrowserWindow.getAllWindows().find(win => win.getTitle() === 'Timer'));
    timer.focus();
    await until('Timer focus remembered', () => timer.isFocused());
    record(`Remembered Timer: ${JSON.stringify(timer.getBounds())}`);
  }
  item('🖥️  Display').click();
  let win = await until('Display renderer', async () => {
    const candidate = BrowserWindow.getAllWindows().find(win => win.getTitle() === 'Display');
    return candidate && await candidate.webContents.executeJavaScript("Boolean(document.getElementById('power'))") && candidate;
  });
  const status = () => win.webContents.executeJavaScript("document.getElementById('status').textContent");
  const action = async label => {
    await win.webContents.executeJavaScript("document.getElementById('menu').click()");
    await until('Display context menu', () => context);
    const entry = context.items.find(item => item.label === label);
    assert.ok(entry?.enabled, `${label} is available`);
    entry.click();
    await delay(150);
  };
  const snapshot = async name => {
    const bounds = win.getBounds();
    // Include actual window decorations and, for aspect, the native Alt menu.
    execFileSync('import', ['-display', process.env.DISPLAY, '-window', 'root', '-crop',
      `${bounds.width + 8}x${bounds.height + 36}+${Math.max(0, bounds.x - 4)}+${Math.max(0, bounds.y - 28)}`, '+repage', join(evidence, `${name}.png`)]);
  };
  if (scenario === 'always-on-top') {
    record(`Opened with preference off: native Always On Top=${win.isAlwaysOnTop()}`);
    assert.equal(win.isAlwaysOnTop(), false, 'Display must obey saved Always On Top preference');
    item('Settings…').click();
    const settings = await until('Settings renderer', () => BrowserWindow.getAllWindows().find(win => win.getTitle() === 'Classroom Widgets Settings'));
    await until('Settings initialized', () => settings.webContents.executeJavaScript("document.querySelectorAll('.shortcut-row').length >= 9"));
    await settings.webContents.executeJavaScript("document.getElementById('alwaysOnTop').click()");
    await until('Display topmost on', () => win.isAlwaysOnTop());
    await settings.webContents.executeJavaScript("document.getElementById('alwaysOnTop').click()");
    await until('Display topmost off', () => !win.isAlwaysOnTop());
    win.close();
    await until('Display closed', () => win.isDestroyed());
    item('🖥️  Display').click();
    win = await until('reopened Display', () => BrowserWindow.getAllWindows().find(win => win.getTitle() === 'Display'));
    assert.equal(win.isAlwaysOnTop(), false, 'reopened Display must keep the current preference');
    record('PASS saved, live on/off, and reopened Display follow Always On Top');
    return;
  }
  if (scenario === 'aspect-limit') {
    win.focus();
    execFileSync('xdotool', ['key', 'Alt_L']);
    await until('native Alt menu visible', () => win.isMenuBarVisible());
    displays[1].bounds.width = 400; // Portrait source; preview remains on monitor 1.
    electron.screen.emit('display-metrics-changed', displays[1], ['bounds']);
    win.setBounds({ x: 150, y: 0, width: 1000, height: 1200 });
    await delay(200);
    await action('Match Display Aspect Ratio');
    record(`Portrait Match at work-area limit: outer=${JSON.stringify(win.getSize())}, content=${JSON.stringify(win.getContentSize())}`);
    assert.ok(win.getBounds().height <= 800, 'content-size matching must reserve native menu overhead within the work area');
    await snapshot('aspect-work-area-limit');
    record('PASS outer size including visible native menu stays within the work-area maximum');
    return;
  }
  if (scenario === 'aspect') {
    const measure = async label => {
      const dom = await win.webContents.executeJavaScript('({ width: innerWidth, height: innerHeight, videoWidth: document.getElementById("video").clientWidth, videoHeight: document.getElementById("video").clientHeight })');
      record(JSON.stringify({ label, size: win.getSize(), content: win.getContentSize(), menuVisible: win.isMenuBarVisible(), dom }));
      return dom;
    };
    await measure('decorated initial, menu hidden');
    await action('Match Display Aspect Ratio');
    const hidden = win.getContentSize();
    for (let i = 0; i < 3; i++) {
      await action('Match Display Aspect Ratio');
      assert.deepEqual(win.getContentSize(), hidden, 'hidden-menu repeated Match must be stable');
    }
    await measure('hidden Match repeated');
    win.focus();
    execFileSync('xdotool', ['key', 'Alt_L']);
    await until('native Alt menu visible', () => win.isMenuBarVisible());
    await measure('Alt menu visible');
    await action('Match Display Aspect Ratio');
    const visible = win.getContentSize();
    const dom = await measure('visible Match 1');
    await snapshot('aspect-visible-menu');
    assert.ok(Math.abs(dom.videoWidth - dom.videoHeight * 1.6) <= 1, 'actual preview viewport must match source 1280:800 with the native menu visible');
    for (let i = 2; i <= 4; i++) {
      await action('Match Display Aspect Ratio');
      await measure(`visible Match ${i}`);
      assert.deepEqual(win.getContentSize(), visible, 'visible-menu repeated Match must not shrink the preview');
    }
    record('PASS content-size aspect match, decorated X11, hidden and Alt-visible menu, repeated action');
    return;
  }
  await win.webContents.executeJavaScript("document.getElementById('power').click()");
  await until('real X11 capture live', async () => (await status()).startsWith('Live:'));
  if (scenario === 'move') {
    const timer = BrowserWindow.getAllWindows().find(win => win.getTitle() === 'Timer');
    const beforeTimer = timer.getBounds();
    const before = win.getBounds();
    win.focus();
    await until('Display focused', () => win.isFocused());
    execFileSync('xdotool', ['key', 'ctrl+alt+shift+Right']);
    await delay(300);
    record(`Focused Display moved: ${JSON.stringify(win.getBounds())}; Timer now ${JSON.stringify(timer.getBounds())}`);
    assert.deepEqual(timer.getBounds(), beforeTimer, 'focused Display must not move the previously focused Timer');
    assert.deepEqual(win.getBounds(), { ...before, x: before.x + 1280 }, 'Display move retains size and work-area offset');
    await until('capture suspended on source overlap', async () => (await status()).includes('overlaps the source display'));
    assert.equal(await win.webContents.executeJavaScript('document.getElementById("video").srcObject === null'), true);
    await snapshot('display-overlap-suspended');
    execFileSync('xdotool', ['key', 'ctrl+alt+shift+Left']);
    await until('Display moved back', () => win.getBounds().x === before.x);
    await until('capture live after moving clear', async () => (await status()).startsWith('Live:'));
    assert.deepEqual(timer.getBounds(), beforeTimer);
    await snapshot('display-live-after-move');
    record('PASS focused Display move both directions; remembered Timer unchanged; overlap clears video and moving clear resumes capture');
    return;
  }
  if (scenario === 'pointer-success') {
    // Read X11 directly: Electron can retain synthetic sendInputEvent's
    // cached cursor coordinates after xdotool has moved the native pointer.
    const nativeCursor = () => {
      const fields = Object.fromEntries(execFileSync('xdotool', ['getmouselocation', '--shell']).toString().trim().split('\n').map(line => line.split('=')));
      return { x: Number(fields.X), y: Number(fields.Y) };
    };
    await action('Move Pointer to Source Center');
    assert.deepEqual(nativeCursor(), { x: 1920, y: 400 });
    electron.ipcMain.on('display-preview:click', (_event, payload) => record(`Preview click IPC: ${JSON.stringify(payload)}`));
    await win.webContents.executeJavaScript(`document.getElementById('video').addEventListener('click', e => { window.clickProbe = { x: e.clientX, y: e.clientY }; }); true`);
    const point = await win.webContents.executeJavaScript(`(() => {
      const v = document.getElementById('video');
      const b = v.getBoundingClientRect();
      const scale = Math.min(b.width / v.videoWidth, b.height / v.videoHeight);
      const w = v.videoWidth * scale, h = v.videoHeight * scale;
      return { x: Math.round(b.x + (b.width - w) / 2 + w / 4), y: Math.round(b.y + (b.height - h) / 2 + h * 3 / 4) };
    })()`);
    win.focus();
    await until('Display focus before preview click', () => win.isFocused());
    win.webContents.sendInputEvent({ type: 'mouseMove', ...point });
    win.webContents.sendInputEvent({ type: 'mouseDown', ...point, button: 'left', clickCount: 1 });
    win.webContents.sendInputEvent({ type: 'mouseUp', ...point, button: 'left', clickCount: 1 });
    await delay(500);
    const cursor = nativeCursor();
    record(`Input ${JSON.stringify(point)}; DOM click ${JSON.stringify(await win.webContents.executeJavaScript('window.clickProbe ?? null'))}; status=${await status()}`);
    record(`Real preview click moved native cursor to ${JSON.stringify(cursor)}, expected about 1600,600`);
    assert.ok(Math.abs(cursor.x - 1600) <= 3 && Math.abs(cursor.y - 600) <= 3, 'actual preview click maps asymmetric source coordinates');
    record('PASS xdotool center action and real preview click move native pointer');
    return;
  }
  const originalPath = process.env.PATH;
  const originalDisplay = process.env.DISPLAY;
  if (scenario === 'pointer-missing') process.env.PATH = temporary;
  else process.env.DISPLAY = ':65432';
  try {
    await action('Move Pointer to Source Center');
    await delay(200);
    record(`Pointer failure status: ${await status()}`);
    assert.match(await status(), scenario === 'pointer-missing' ? /Install xdotool/i : /X11|XWayland/i);
    assert.match(await status(), /Preview remains live/i);
    assert.equal(await win.webContents.executeJavaScript('document.getElementById("status").title'), await status(), 'the full actionable status remains available when ellipsized');
    assert.equal(await win.webContents.executeJavaScript('Boolean(document.getElementById("video").srcObject?.active)'), true);
  } finally {
    process.env.PATH = originalPath;
    process.env.DISPLAY = originalDisplay;
  }
  await snapshot(scenario);
  record('PASS actionable pointer failure; live capture remains active');
}).then(() => finish(), finish);

function finish(error) {
  clearTimeout(watchdog);
  if (error) record(`FAIL: ${error.stack || error}`);
  writeFileSync(join(evidence, `${scenario}.txt`), lines.join('\n') + '\n');
  rmSync(temporary, { recursive: true, force: true });
  app.exit(error ? 1 : 0);
}
