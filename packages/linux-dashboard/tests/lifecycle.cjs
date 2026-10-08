// Real Electron regression contracts. Build teacher:desktop and Linux first.
// Run each case under X11 (or xvfb-run -a):
// CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR=<dir> node_modules/.bin/electron --no-sandbox --disable-gpu tests/lifecycle.cjs --background --case=<case>
// Cases: reload-failure, termination-failure, frames, quit, quit-late-inventory, autostart.
// Fault injection holds an ordinary snapshot acknowledgment and makes a
// different panel's checkpoint unavailable; the healthy editor remains real.
const { app, BrowserWindow, Menu, Tray, session } = require('electron');
const assert = require('node:assert/strict');
const { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

const scenario = process.argv.find(arg => arg.startsWith('--case='))?.slice(7);
assert.ok(['reload-failure', 'termination-failure', 'frames', 'quit', 'quit-late-inventory', 'autostart'].includes(scenario));
const root = resolve(__dirname, '..');
const evidence = resolve(process.env.CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR || join(tmpdir(), 'classroom-widgets-test-evidence/linux-lifecycle'));
mkdirSync(evidence, { recursive: true });
const temporary = mkdtempSync(join(tmpdir(), 'classroom-lifecycle-'));
app.setAppPath(root);
app.setPath('userData', temporary);
app.setPath('sessionData', temporary);
process.env.XDG_CONFIG_HOME = temporary;
const lines = [];
const record = message => { lines.push(message); console.log(message); };
const delay = ms => new Promise(done => setTimeout(done, ms));
async function until(label, check) {
  for (let i = 0; i < 200; i++) {
    const result = await check();
    if (result) return result;
    await delay(50);
  }
  throw new Error(`Timed out: ${label}`);
}
let host;
let menu;
const { WidgetHostController } = require('../out/main/hostController');
const start = WidgetHostController.prototype.start;
WidgetHostController.prototype.start = function (...args) {
  host = this;
  return start.apply(this, args);
};
const setContextMenu = Tray.prototype.setContextMenu;
Tray.prototype.setContextMenu = function (value) {
  menu = value;
  return setContextMenu.call(this, value);
};
const item = label => menu.items.find(entry => entry.label === label);
const inventory = () => host.panelCoordinator.lastInventory;
const panels = () => BrowserWindow.getAllWindows().filter(win => win.webContents.getURL().endsWith('panel-chrome.html'));
const panelFor = id => panels().find(win => new URL(win.contentView.children[0].webContents.getURL(), 'app://classroom/').searchParams.get('widgetId') === id);
const guest = win => win.contentView.children[0].webContents;
const text = win => guest(win).executeJavaScript("document.querySelector('textarea')?.value");
const watchdog = setTimeout(() => finish(new Error('E2E timed out')), 60000);
require('../out/main/main');

app.whenReady().then(async () => {
  await until('widget menu', () => host?.widgetOptions.length && item('✅  List'));
  if (scenario === 'autostart') {
    item('Settings…').click();
    const settings = await until('Settings window', () => BrowserWindow.getAllWindows().find(win => win.getTitle() === 'Classroom Widgets Settings'));
    const checked = () => settings.webContents.executeJavaScript("document.getElementById('launchAtLogin').checked");
    await until('Settings initialized', () => settings.webContents.executeJavaScript("document.querySelectorAll('.shortcut-row').length >= 9"));
    assert.equal(await checked(), false);
    await settings.webContents.executeJavaScript("document.getElementById('launchAtLogin').click()");
    await until('autostart file', () => existsSync(join(temporary, 'autostart/classroom-widgets.desktop')));
    await delay(200);
    record(`Settings on: checkbox=${await checked()}, tray=${item('Launch at Login').checked}, file=present`);
    assert.equal(item('Launch at Login').checked, true, 'Settings must update the existing tray checkmark');
    writeFileSync(join(evidence, 'autostart-on.png'), (await settings.webContents.capturePage()).toPNG());
    const login = item('Launch at Login');
    login.click(login);
    await until('autostart file removed', () => !existsSync(join(temporary, 'autostart/classroom-widgets.desktop')));
    await delay(200);
    record(`Tray off: checkbox=${await checked()}, tray=${item('Launch at Login').checked}, file=absent`);
    assert.equal(await checked(), false, 'tray toggle must update the already-open Settings checkbox');
    writeFileSync(join(evidence, 'autostart-off.png'), (await settings.webContents.capturePage()).toPNG());
    const menuBeforeOpacity = menu;
    await settings.webContents.executeJavaScript('window.classroomSettings.set({ backgroundOpacity: 0.63 })');
    await delay(200);
    assert.equal(menu, menuBeforeOpacity, 'opacity changes must not rebuild the tray');
    record('PASS bidirectional autostart controls and file, no tray rebuild for opacity');
    return;
  }

  item('✅  List').click();
  await until('List inventory', () => inventory()?.widgets.length === 1);
  const id = inventory().widgets[0].id;
  let list = await until('List editor', async () => {
    const win = panelFor(id);
    return win && await text(win) === '' && win;
  });
  await delay(500);
  if (scenario === 'frames') {
    list.setBounds({ x: 55, y: 77, width: 365, height: 443 });
    const moved = list.getBounds();
    record(`Immediate native move: ${JSON.stringify(moved)}`);
    item('Reload Widgets').click();
    await until('replacement List', () => panelFor(id) && panelFor(id) !== list);
    const restored = panelFor(id).getBounds();
    record(`After reload: ${JSON.stringify(restored)}`);
    assert.deepEqual(restored, moved, 'reload must drain the 400ms native frame debounce');
    host.panelCoordinator.arrange('row');
    const arranged = panelFor(id).getBounds();
    host.panelCoordinator.flushPersistedFrames();
    assert.equal(host.panelCoordinator.layout, 'row', 'draining programmatic arrangement must not change layout');
    host.panelCoordinator.arrange('freeform');
    assert.deepEqual(panelFor(id).getBounds(), moved, 'arrangement must preserve the saved freeform frame');
    record(`PASS native frame retained, arranged frame ${JSON.stringify(arranged)} did not overwrite freeform`);
    return;
  }

  // A reaches the host but its acknowledgment is held; B must stay pending
  // in the real React editor until a lifecycle checkpoint collects it.
  await guest(list).executeJavaScript('window.classroomWidgetPanel.receiveSnapshot = () => false; true');
  await guest(list).executeJavaScript("document.querySelector('textarea').focus()");
  guest(list).sendInputEvent({ type: 'char', keyCode: 'A' });
  await until('host A', () => inventory().widgets.find(widget => widget.id === id).snapshotPayload.state?.inputs?.[0] === 'A');
  guest(list).sendInputEvent({ type: 'char', keyCode: 'B' });
  await until('pending B rendered', async () => await text(list) === 'AB');
  assert.equal(inventory().widgets.find(widget => widget.id === id).snapshotPayload.state.inputs[0], 'A');

  if (scenario.startsWith('quit')) {
    const original = host.prepareForTermination.bind(host);
    let calls = 0;
    let prepared = false;
    host.prepareForTermination = async () => {
      calls++;
      await delay(300);
      prepared = await original();
      return prepared;
    };
    if (scenario === 'quit-late-inventory') {
      const flush = session.defaultSession.flushStorageData.bind(session.defaultSession);
      session.defaultSession.flushStorageData = async () => {
        await flush();
        // A real host update arrives after panels were drained but before
        // final app.quit(), as a shortcut or network update can do.
        await host.addWidget(7);
        await until('late inventory recreated a panel', () => panels().length > 0);
        record(`Late inventory during storage flush: panels=${panels().length}`);
      };
      app.on('before-quit', () => {
        if (prepared) setTimeout(() => finish(new Error('late inventory cancelled the final quit')), 1500);
      });
    }
    list.setBounds({ x: 83, y: 91, width: 365, height: 443 });
    const moved = list.getBounds();
    app.on('will-quit', () => {
      try {
        record(`Default menu Quit: checkpoint calls=${calls}, prepared=${prepared}`);
        assert.equal(calls, 1, 'ordinary/default Quit must checkpoint once');
        assert.equal(prepared, true, 'a repeated quit during checkpoint must not bypass it');
        assert.equal(inventory().widgets.find(widget => widget.id === id).snapshotPayload.state.inputs[0], 'AB');
        const frame = JSON.parse(readFileSync(join(temporary, 'settings.json'), 'utf8')).panelFrames[id];
        assert.deepEqual(frame, { left: moved.x, top: moved.y, width: moved.width, height: moved.height });
        record('PASS pending AB and latest native frame checkpointed before default Quit, repeated quit blocked');
        finish();
      } catch (error) { finish(error); }
    });
    const quit = Menu.getApplicationMenu().items.flatMap(entry => entry.submenu?.items || []).find(entry => entry.role === 'quit');
    assert.ok(quit, 'exercise Electron default Quit menu role');
    quit.click(undefined, list);
    setTimeout(() => app.quit(), 100);
    return 'quitting';
  }

  item('🔳  QR Code').click();
  await until('QR inventory', () => inventory().widgets.length === 2);
  const qrId = inventory().widgets.find(widget => widget.id !== id).id;
  const qr = await until('QR bridge', async () => {
    const win = panelFor(qrId);
    return win && await guest(win).executeJavaScript('Boolean(window.classroomWidgetPanel?.takePendingState)') && win;
  });
  await guest(qr).executeJavaScript('window.classroomWidgetPanel.takePendingState = undefined');
  const instance = inventory().hostInstanceId;
  if (scenario === 'termination-failure') {
    assert.equal(await host.prepareForTermination(), false, 'the broken QR checkpoint must refuse termination');
  } else {
    item('Reload Widgets').click();
  }
  await until('recreated healthy editor', () => panelFor(id) && panelFor(id) !== list);
  list = panelFor(id);
  await until('recreated text rendered', async () => typeof await text(list) === 'string');
  record(`Broken QR checkpoint: recreated List text=${JSON.stringify(await text(list))}, host=${inventory().widgets.find(widget => widget.id === id).snapshotPayload.state.inputs[0]}`);
  assert.equal(await text(list), 'AB', 'one failed panel must not discard a healthy panel checkpoint');
  assert.equal(inventory().hostInstanceId, instance, 'failed deactivation must leave the host in place');
  await until('replacement QR ready', () => guest(panelFor(qrId)).executeJavaScript('Boolean(window.classroomWidgetPanel?.takePendingState)'));
  await host.reloadWidgets();
  await until('successful reload', () => inventory().hostInstanceId !== instance);
  list = await until('AB restored after successful reload', async () => {
    const win = panelFor(id);
    return win && await text(win) === 'AB' && win;
  });
  writeFileSync(join(evidence, `${scenario}-restored.png`), (await guest(list).capturePage()).toPNG());
  record('PASS healthy pending AB survives failed checkpoint, editor recreation, and subsequent successful reload');
}).then(result => { if (result !== 'quitting') finish(); }, finish);

function finish(error) {
  clearTimeout(watchdog);
  if (error) record(`FAIL: ${error.stack || error}`);
  writeFileSync(join(evidence, `${scenario}.txt`), lines.join('\n') + '\n');
  rmSync(temporary, { recursive: true, force: true });
  app.exit(error ? 1 : 0);
}
