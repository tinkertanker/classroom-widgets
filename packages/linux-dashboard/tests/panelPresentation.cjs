// #213 real Electron check: an inventory that changes nothing about a panel's
// presentation must not touch its native window, its chrome or the tray menu.
// Build the teacher app (vite build) and this package first, then from the
// repository root:
// Run with an X11 window manager (e.g. Openbox), xprop, xdotool and ffmpeg installed:
// CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR=<dir> packages/linux-dashboard/node_modules/.bin/electron --no-sandbox --disable-gpu packages/linux-dashboard/tests/panelPresentation.cjs
// Evidence: panel-presentation.txt (per-step counts) and dark-panels.png.
const { app, BrowserWindow, globalShortcut, nativeTheme, screen, Tray } = require('electron');
const assert = require('node:assert/strict');
const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { execFileSync } = require('node:child_process');

const root = resolve(__dirname, '..');
const evidence = resolve(process.env.CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR
  || join(tmpdir(), 'classroom-widgets-test-evidence/panel-presentation'));
mkdirSync(evidence, { recursive: true });
const temporary = mkdtempSync(join(tmpdir(), 'classroom-panel-presentation-'));
app.setAppPath(root);
app.setPath('userData', temporary);
app.setPath('sessionData', temporary);
process.env.XDG_CONFIG_HOME = temporary;
nativeTheme.themeSource = 'light';
const { registerPrivilegedScheme, installProtocolHandler } = require('../out/main/appProtocol');
const { DashboardSettings } = require('../out/main/settings');
const { WidgetHostController } = require('../out/main/hostController');
const { WidgetShortcutController } = require('../out/main/widgetShortcuts');
const { TrayController } = require('../out/main/tray');
registerPrivilegedScheme();

const lines = [];
const record = message => { lines.push(message); console.log(message); };
const delay = ms => new Promise(done => setTimeout(done, ms));
// BrowserWindow.capturePage omits its child WebContentsView. Capture the actual
// desktop so evidence includes both the native stacking and rendered widget.
const capture = name => {
  const { width, height } = screen.getPrimaryDisplay().size;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'x11grab', '-video_size', `${width}x${height}`,
    '-i', process.env.DISPLAY, '-frames:v', '1', join(evidence, name)]);
};
async function until(label, check) {
  for (let i = 0; i < 300; i++) {
    const value = await check();
    if (value) return value;
    await delay(50);
  }
  throw new Error(`Timed out: ${label}`);
}

// Count every native presentation call per window, every chrome update and
// every tray menu the app builds.
const SETTERS = ['setTitle', 'setMinimumSize', 'setMaximumSize', 'setResizable', 'setAspectRatio'];
const counts = new Map();
const countFor = win => {
  if (!counts.has(win.id)) counts.set(win.id, { setters: 0, chrome: 0, calls: [] });
  return counts.get(win.id);
};
app.on('browser-window-created', (_event, win) => {
  for (const name of SETTERS) {
    const original = win[name].bind(win);
    win[name] = (...args) => {
      const entry = countFor(win);
      entry.setters++;
      entry.calls.push(name);
      return original(...args);
    };
  }
  const send = win.webContents.send.bind(win.webContents);
  win.webContents.send = (channel, ...args) => {
    if (channel === 'panel-chrome-update') countFor(win).chrome++;
    return send(channel, ...args);
  };
});
let trayMenus = 0;
let lastMenu = null;
const setContextMenu = Tray.prototype.setContextMenu;
Tray.prototype.setContextMenu = function (menu) {
  trayMenus++;
  lastMenu = menu;
  return setContextMenu.call(this, menu);
};
const resetCounts = () => { counts.clear(); trayMenus = 0; };
const panelWindows = () => BrowserWindow.getAllWindows()
  .filter(win => !win.isDestroyed() && win.webContents.getURL().endsWith('panel-chrome.html'));
const summary = () => {
  let setters = 0;
  let chrome = 0;
  const calls = {};
  for (const entry of counts.values()) {
    setters += entry.setters;
    chrome += entry.chrome;
    for (const name of entry.calls) calls[name] = (calls[name] ?? 0) + 1;
  }
  return { setters, chrome, trayMenus, calls };
};

const inventory = host => host.panelCoordinator.lastInventory;
const texts = view => view.executeJavaScript(`Array.from(document.querySelectorAll('textarea')).map(e => e.value)`);
const watchdog = setTimeout(() => finish(new Error('E2E timed out')), 150000);
let tray = null;

app.whenReady().then(async () => {
  installProtocolHandler();
  const settings = new DashboardSettings();
  const host = new WidgetHostController(settings, 'panel-presentation-e2e');
  const noop = () => {};
  const shortcuts = new WidgetShortcutController(settings, globalShortcut, noop, noop, noop,
    { open: noop, close: noop, isOpen: () => false });
  host.on('widgetOptionsChanged', () => shortcuts.updateOptions(host.widgetOptions));
  tray = new TrayController(host, settings, shortcuts, 'panel-presentation-e2e', noop, noop, noop, noop);
  await host.start();
  await until('host ready', () => host.widgetOptions.length > 0);

  // Four Lists, a Timer and a Traffic Light: resizable, fixed and
  // aspect-locked panels all have to stay untouched while one List is typed in.
  for (const type of [2, 2, 2, 2, 1, 4]) await host.addWidget(type);
  await until('six panels', () => inventory(host)?.widgets.length === 6 && panelWindows().length === 6);
  await until('six panels shown', () => panelWindows().every(win => win.isVisible()));
  const listId = inventory(host).widgets[0].id;
  // Seed the first List with a row in edit mode so keys go to its text box.
  const hostView = BrowserWindow.getAllWindows().find(win => win.webContents.getURL().includes('dashboard=1')).webContents;
  await hostView.executeJavaScript(`window.classroomPanelHost.applyStateChange(${JSON.stringify({
    schemaVersion: 1, widgetId: listId, baseRevision: 0, flush: true,
    state: { items: [{ id: 'row-0', text: 'Row', status: 0, isEditing: true }], inputs: ['Row'], statuses: [0] }
  })})`);
  const view = await until('editable List panel', async () => {
    for (const win of panelWindows()) {
      const child = win.contentView.children[0]?.webContents;
      if (child && (await texts(child))[0] === 'Row') return child;
    }
  });
  const listWindow = panelWindows().find(win => win.contentView.children[0]?.webContents === view);
  const ids = new Set(panelWindows().map(win => win.getNativeWindowHandle().readUInt32LE(0)));
  const order = () => (execFileSync('xprop', ['-root', '_NET_CLIENT_LIST_STACKING'], { encoding: 'utf8' })
    .match(/0x[0-9a-f]+/g) ?? []).map(value => parseInt(value, 16)).filter(id => ids.has(id));
  for (const [index, win] of panelWindows().entries()) win.setPosition(100 + index * 45, 80 + index * 35);
  listWindow.focus();
  // Move a real pointer over neighboring panels and back to the List editor.
  execFileSync('xdotool', ['mousemove', '--sync', '550', '350']);
  await delay(300);
  const [lx, ly] = listWindow.getPosition();
  execFileSync('xdotool', ['mousemove', '--sync', String(lx + 150), String(ly + 130)]);
  await delay(1600);
  const beforeOrder = order();
  assert.equal(beforeOrder.length, 6, 'six native windows must be represented in the X11 stack');
  assert.equal(beforeOrder.at(-1), listWindow.getNativeWindowHandle().readUInt32LE(0), 'List must start on top');

  // 1. Typing: one inventory per key, nothing presented changes.
  resetCounts();
  const startRevision = inventory(host).revision;
  await view.executeJavaScript(`document.querySelector('textarea').focus()`);
  for (const [index, key] of [...'ABCDE'].entries()) {
    view.sendInputEvent({ type: 'char', keyCode: key });
    await until(`edit ${index}`, () => inventory(host).widgets.find(widget => widget.id === listId)
      ?.snapshotPayload.state?.inputs?.[0] === `Row${'ABCDE'.slice(0, index + 1)}`);
    assert.deepEqual(order(), beforeOrder, 'accepted List edits must preserve native stacking order');
  }
  await delay(500);
  const typed = summary();
  const inventories = inventory(host).revision - startRevision;
  record(`typing 5 keys into one of 6 panels: inventories=${inventories} setters=${typed.setters} chromeUpdates=${typed.chrome} trayMenus=${typed.trayMenus} calls=${JSON.stringify(typed.calls)}`);
  record(`stable X11 stacking order: ${JSON.stringify(beforeOrder)}`);
  capture('edited-list.png');
  assert.ok(inventories >= 5, 'each key sends an inventory');
  assert.equal(typed.setters, 0, 'typing must not call native window setters');
  assert.equal(typed.chrome, 0, 'typing must not resend panel chrome');
  assert.equal(typed.trayMenus, 0, 'typing must not rebuild the tray menu');

  // 2. Theme: every panel's chrome must follow, still without native setters.
  resetCounts();
  nativeTheme.themeSource = 'dark';
  await until('dark inventory', () => inventory(host).widgets.every(widget => widget.snapshotPayload.theme === 'dark'));
  await until('dark chrome', async () => {
    const dark = await Promise.all(panelWindows().map(win => win.webContents.executeJavaScript(
      `document.getElementById('chrome').classList.contains('dark')`)));
    return dark.every(Boolean);
  });
  await delay(500);
  const themed = summary();
  record(`theme light->dark: setters=${themed.setters} chromeUpdates=${themed.chrome} trayMenus=${themed.trayMenus} calls=${JSON.stringify(themed.calls)}`);
  capture('dark-panels.png');

  // Change native fields with the same content revisions. Presentation and
  // snapshot deduplication must be independent, including aspect on creation.
  const panel = host.panelCoordinator.panels.get(listId);
  const original = inventory(host).widgets.find(widget => widget.id === listId);
  resetCounts();
  panel.apply({ ...original, title: 'Renamed List' });
  assert.equal(listWindow.getTitle(), 'Renamed List');
  assert.deepEqual(summary().calls, { setTitle: 1 });
  assert.equal(summary().chrome, 1);
  await until('updated chrome title', () => listWindow.webContents.executeJavaScript(
    `document.getElementById('title').textContent === 'Renamed List'`));
  resetCounts();
  panel.apply({ ...original, title: 'Renamed List', minimumContentSize: { width: 271, height: 193 },
    maximumContentSize: { width: 643, height: 517 }, aspectRatio: 2 });
  assert.deepEqual(listWindow.getMinimumSize(), [271, 223]);
  assert.deepEqual(listWindow.getMaximumSize(), [643, 547]);
  assert.deepEqual(summary().calls, { setMinimumSize: 1, setMaximumSize: 1, setAspectRatio: 1 });
  assert.equal(summary().chrome, 0);
  const aspectFrame = panel.snapConstraints();
  assert.equal(aspectFrame.aspect, 2);
  panel.apply({ ...original, isResizable: false });
  assert.equal(listWindow.isResizable(), false);
  panel.apply({ ...original, minimumContentSize: { width: 283, height: 201 },
    maximumContentSize: { width: 701, height: 563 } });
  assert.equal(listWindow.isResizable(), true);
  assert.deepEqual(listWindow.getMinimumSize(), [283, 231], 'new limits survive re-enabling resize');
  assert.deepEqual(listWindow.getMaximumSize(), [701, 593]);
  panel.apply(original);
  assert.deepEqual(listWindow.getMaximumSize(), [100000, 100000], 'removing the cap restores unlimited size');
  panel.applyPresentationSettings(0.65, true);
  await until('changed opacity', () => listWindow.webContents.executeJavaScript(
    `document.getElementById('chrome').style.backgroundColor.includes('0.65')`));
  panel.applyPresentationSettings(1, true);
  record('PASS changed title/min/max/resizable/aspect/opacity apply independently of content revisions');

  // 3. Hide and show the Timer: the tray menu must still follow visibility.
  resetCounts();
  await host.toggleWidget(1);
  await until('Timer hidden', () => inventory(host).widgets.find(widget => widget.snapshotPayload.widgetType === 1)?.hidden);
  await until('Timer window hidden', () => panelWindows().filter(win => win.isVisible()).length === 5);
  const afterHide = trayMenus;
  await host.showWidget(1);
  await until('Timer shown', () => !inventory(host).widgets.find(widget => widget.snapshotPayload.widgetType === 1)?.hidden);
  await until('Timer window shown', () => panelWindows().filter(win => win.isVisible()).length === 6);
  await delay(300);
  const toggled = summary();
  record(`hide then show Timer: trayMenus after hide=${afterHide}, after show=${toggled.trayMenus} setters=${toggled.setters} chromeUpdates=${toggled.chrome}`);

  // 3b. A reloaded chrome strip (View > Reload) gets its title and theme back.
  const reloaded = panelWindows()[0];
  const chromeState = () => reloaded.webContents.executeJavaScript(
    `[document.getElementById('title').textContent, document.getElementById('chrome').classList.contains('dark')]`);
  const [expectedTitle] = await chromeState();
  reloaded.webContents.reload();
  await until('reloaded chrome restored', async () => {
    const [title, dark] = await chromeState();
    return title === expectedTitle && title !== '' && dark;
  });
  record(`reload a panel chrome: title "${expectedTitle}" and dark theme restored`);
  reloaded.focus();
  await until('explicit raise', () => order().at(-1) === reloaded.getNativeWindowHandle().readUInt32LE(0));
  reloaded.hide();
  host.panelCoordinator.activate();
  assert.equal(reloaded.isVisible(), true, 'activation recovers an ordered-out window');
  await host.reloadWidgets();
  await until('replacement panels shown', () => panelWindows().length === 6 && panelWindows().every(win => win.isVisible()));
  await until('List restored after reload', async () => {
    for (const win of panelWindows()) if ((await texts(win.contentView.children[0].webContents))[0] === 'RowABCDE') return true;
    return false;
  });
  record('PASS explicit raise, hidden-window recovery and host reload retain edited List');

  // 4. Arrange in a row, then drag a panel: the tray's layout radio must
  // return to Free Placement without waiting for a panel to appear or go.
  const radio = label => lastMenu.items.find(item => item.label === 'Arrange Widgets').submenu.items
    .find(item => item.label === label).checked;
  host.panelCoordinator.arrange('row');
  await until('Row checked in tray', () => radio('Arrange in a Row'));
  const dragged = panelWindows()[0];
  const [x, y] = dragged.getPosition();
  dragged.setPosition(x + 40, y + 60);
  await until('Free Placement checked after drag', () => radio('Free Placement'));
  record('arrange row then drag a panel: tray layout back to Free Placement');

  // 5. Close every panel: the Arrange item must end up disabled.
  resetCounts();
  // Through each panel's own close button, as a teacher would.
  for (const win of panelWindows()) await win.webContents.executeJavaScript(`document.getElementById('close').click()`);
  await until('panels removed', () => inventory(host).widgets.length === 0);
  await until('no panel windows', () => panelWindows().length === 0);
  const arrangeEnabled = lastMenu.items.find(item => item.label === 'Arrange Widgets').enabled;
  record(`close all panels: trayMenus=${trayMenus} arrangeEnabled=${arrangeEnabled}`);

  assert.equal(themed.setters, 0, 'a theme change must not call size or title setters');
  assert.equal(themed.chrome, 6, 'a theme change updates each panel chrome once');
  assert.ok(afterHide >= 1, 'hiding a panel rebuilds the tray menu');
  assert.ok(toggled.trayMenus > afterHide, 'showing a panel rebuilds the tray menu');
  assert.ok(trayMenus >= 1, 'removing panels rebuilds the tray menu');
  assert.equal(arrangeEnabled, false, 'Arrange is disabled once no panel is shown');
  record('PASS no native, chrome or tray work for unchanged panels; theme, visibility and removal still apply');
}).then(() => finish(), finish);

function finish(error) {
  clearTimeout(watchdog);
  if (error) record(`FAIL: ${error.stack || error}`);
  writeFileSync(join(evidence, 'panel-presentation.txt'), lines.join('\n') + '\n');
  try { tray?.destroy(); } catch {}
  rmSync(temporary, { recursive: true, force: true });
  app.exit(error ? 1 : 0);
}
