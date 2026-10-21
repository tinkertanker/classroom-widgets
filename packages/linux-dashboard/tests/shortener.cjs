// Build teacher assets and this package first. On headless Linux:
// xvfb-run -a node_modules/.bin/electron --no-sandbox --disable-gpu tests/shortener.cjs
// Also covers Settings hardening (#220) and Short.io save coalescing (#214).
const electron = require('electron');
const { app, BrowserWindow } = electron;
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } = fs;
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { runInNewContext } = require('node:vm');
const root = resolve(__dirname, '..');
app.setAppPath(root);
const temporary = mkdtempSync(join(tmpdir(), 'classroom-shortener-test-'));
app.setPath('userData', temporary);
const { registerPrivilegedScheme, installProtocolHandler } = require('../out/main/appProtocol');
registerPrivilegedScheme();
const { DashboardSettings } = require('../out/main/settings');
const { shortenerSettingsScript } = require('../out/main/shortenerSettings');
const { openSettingsWindow } = require('../out/main/settingsWindow');
const { WidgetShortcutController } = require('../out/main/widgetShortcuts');
const { WidgetPanelWindow } = require('../out/main/panelWindow');
const { parseDescriptor } = require('../out/main/models');
const { DisplayPreviewWindow } = require('../out/main/displayPreviewWindow');
const { preloadPath, rendererPath } = require('../out/main/paths');
const evidence = resolve(process.env.CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR || join(tmpdir(), 'classroom-widgets-test-evidence/linux-shortener'));
mkdirSync(evidence, { recursive: true });
const lines = [];
const record = line => { lines.push(line); console.log(line); };
const settingsFile = join(temporary, 'settings.json');
// Count completed settings.json writes (each save renames its temporary file over it).
let settingsWrites = 0;
const renameSync = fs.renameSync;
fs.renameSync = function (from, to) {
  if (to === settingsFile) settingsWrites += 1;
  return renameSync.apply(this, arguments);
};
const externalOpens = [];
electron.shell.openExternal = async url => { externalOpens.push(url); };
const onDisk = () => JSON.parse(readFileSync(settingsFile, 'utf8'));

async function waitFor(check) {
  for (let i = 0; i < 100; i++) {
    if (await check()) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Timed out waiting for renderer state');
}

app.whenReady().then(async () => {
  // Legacy files must retain unrelated settings and gain usable defaults.
  writeFileSync(join(temporary, 'settings.json'), JSON.stringify({ backgroundOpacity: 0.45, alwaysOnTop: false }));
  const settings = DashboardSettings.load();
  assert.equal(settings.backgroundOpacity, 0.45);
  assert.equal(settings.linkShortener.provider, 'tinyurl');
  const escaped = { provider: 'shortio', shortioApiKey: 'pk_"\\\n</script>', shortioDomain: 'go.school.edu' };
  const scope = { window: { dispatchEvent: e => assert.equal(e.type, 'classroom-shortener-settings-changed') }, Event: class { constructor(type) { this.type = type; } } };
  runInNewContext(shortenerSettingsScript(escaped), scope);
  assert.equal(scope.window.classroomShortenerSettings.shortioApiKey, escaped.shortioApiKey);

  installProtocolHandler();
  const makePanel = id => new WidgetPanelWindow(parseDescriptor({
    schemaVersion: 1, widgetId: id, title: 'Link Shortener', widgetType: 6,
    preferredSize: { width: 350, height: 440 }, minimumSize: { width: 300, height: 400 },
    maximumSize: null, isResizable: true, maintainsAspectRatio: false,
    revision: 1, stateRevision: 0, state: {}, workspaceId: 'test', theme: 'light', savedRandomiserLists: [],
  }), 1, false, '0.11.1', settings);
  const first = makePanel('shortener-first');
  const contents = first.view.webContents;
  await waitFor(() => contents.executeJavaScript("window.classroomShortenerSettings?.provider === 'tinyurl'"));
  await waitFor(() => contents.executeJavaScript("!!document.querySelector('[title=\"Link Shortener settings\"]')"));
  const shortcuts = new WidgetShortcutController(settings, { register: () => true, unregisterAll() {} }, () => {});
  shortcuts.updateOptions([{ widgetType: 6, title: 'Link Shortener' }, { widgetType: 1, title: 'Timer' }]);
  assert.equal(shortcuts.setShortcut(6, 'Ctrl+Alt+K').ok, true);
  openSettingsWindow(settings, shortcuts, '0.11.2');
  const win = BrowserWindow.getAllWindows().find(w => w.getTitle() === 'Classroom Widgets Settings');
  await waitFor(() => win.webContents.executeJavaScript("document.querySelector('#shortenerProvider')?.value === 'tinyurl'"));
  if (process.env.SCREENSHOT_DIR) {
    writeFileSync(join(process.env.SCREENSHOT_DIR, 'pr97-linux-default.png'), (await win.webContents.capturePage()).toPNG());
  }
  settings.on('changed', () => first.applyPresentationSettings(1, false));
  await win.webContents.executeJavaScript(`
    document.querySelector('#shortenerProvider').value = 'shortio';
    document.querySelector('#shortioApiKey').value = 'pk_verification_only';
    document.querySelector('#shortioDomain').value = 'go.school.edu';
    document.querySelector('#shortenerProvider').dispatchEvent(new Event('change'));
  `);
  await waitFor(() => contents.executeJavaScript("window.classroomShortenerSettings?.shortioDomain === 'go.school.edu'"));
  assert.equal(DashboardSettings.load().linkShortener.shortioApiKey, 'pk_verification_only');
  assert.equal(DashboardSettings.load().backgroundOpacity, 0.45);
  assert.equal(DashboardSettings.load().widgetShortcuts['6'], 'Ctrl+Alt+K');
  // The fixed Display and Move Widget rows precede one row per widget option.
  assert.deepEqual(
    await win.webContents.executeJavaScript("Array.from(document.querySelectorAll('.shortcut-row .shortcut-name'), n => n.textContent)"),
    ['Display', 'Move Widget to Previous Display', 'Move Widget to Next Display', 'Link Shortener', 'Timer'],
  );
  assert.equal(await win.webContents.executeJavaScript("document.querySelector('#shortioFields').hidden"), false);
  // capturePage may return the previous compositor frame immediately after input.
  await new Promise(resolve => setTimeout(resolve, 200));
  if (process.env.SCREENSHOT_DIR) {
    writeFileSync(join(process.env.SCREENSHOT_DIR, 'pr97-linux-shortio.png'), (await win.webContents.capturePage()).toPNG());
  }
  const second = makePanel('shortener-second');
  await waitFor(() => second.view.webContents.executeJavaScript("window.classroomShortenerSettings?.provider === 'shortio'"));
  await waitFor(() => second.view.webContents.executeJavaScript("document.body.innerText.includes('Short.io')"));
  contents.reload();
  await waitFor(() => contents.executeJavaScript("window.classroomShortenerSettings?.shortioApiKey === 'pk_verification_only'"));
  await waitFor(() => contents.executeJavaScript("!!document.querySelector('[title=\"Link Shortener settings\"]')"));
  let opened = false;
  first.on('openSettingsRequested', () => { opened = true; });
  await contents.executeJavaScript("document.querySelector('[title=\"Link Shortener settings\"]').click()");
  await waitFor(() => opened);

  // #220: Settings and Display Preview are sandboxed and keep their own page.
  assert.equal(win.webContents.getLastWebPreferences().sandbox, true, 'Settings is sandboxed');
  const settingsUrl = win.webContents.getURL();
  await win.webContents.executeJavaScript("location.href = 'https://example.com/settings-escape'; window.open('https://example.com/settings-popup'); true");
  await new Promise(resolve => setTimeout(resolve, 500));
  assert.equal(win.webContents.getURL(), settingsUrl, 'a renderer navigation must not replace settings.html');
  assert.equal(BrowserWindow.getAllWindows().filter(w => w.webContents.getURL().startsWith('https:')).length, 0);
  assert.deepEqual(externalOpens, ['https://example.com/settings-escape', 'https://example.com/settings-popup']);
  record(`PASS Settings sandboxed; navigation and window.open stayed on ${settingsUrl.split('/').pop()} and went to the system browser`);

  const before = JSON.stringify(onDisk());
  const writesBefore = settingsWrites;
  const preview = new DisplayPreviewWindow({ x: 40, y: 40, width: 480, height: 400 });
  const previewContents = BrowserWindow.getAllWindows().find(w => w.getTitle() === 'Display').webContents;
  await waitFor(() => previewContents.getURL().endsWith('display-preview.html') && !previewContents.isLoading());
  assert.equal(previewContents.getLastWebPreferences().sandbox, true, 'Display Preview is sandboxed');
  let reachedMain = 0;
  const countSettingsSet = () => { reachedMain += 1; };
  electron.ipcMain.on('settings:set', countSettingsSet);
  await previewContents.executeJavaScript(`
    window.displayPreview.send('settings:set', { alwaysOnTop: true, backgroundOpacity: 0.2, linkShortener: { provider: 'shortio', shortioApiKey: 'pk_attacker', shortioDomain: 'evil.example' } });
    window.displayPreview.send('settings:reset-positions');
    window.displayPreview.send('settings:capturing', true);
    true`);
  await new Promise(resolve => setTimeout(resolve, 700));
  assert.equal(reachedMain, 0, 'the Display Preview preload forwards no settings channels');
  electron.ipcMain.removeListener('settings:set', countSettingsSet);
  assert.equal(JSON.stringify(onDisk()), before, 'Display Preview cannot change settings');
  assert.equal(settingsWrites, writesBefore);
  assert.equal(settings.linkShortener.shortioApiKey, 'pk_verification_only');
  // Display Preview's own IPC is accepted only from display-preview.html.
  let powerToggles = 0;
  preview.on('powerToggle', () => { powerToggles += 1; });
  const togglePower = () => previewContents.executeJavaScript("window.displayPreview.send('display-preview:action', { action: 'toggle-power' }); true");
  await togglePower();
  await waitFor(() => powerToggles === 1);
  await previewContents.loadFile(rendererPath('settings.html'));
  await togglePower();
  const capture = await previewContents.executeJavaScript(`navigator.mediaDevices.getUserMedia({ audio: false, video: { mandatory: { chromeMediaSource: 'desktop' } } })
    .then(stream => { stream.getTracks().forEach(track => track.stop()); return 'granted'; }, error => error.name)`);
  await new Promise(resolve => setTimeout(resolve, 500));
  assert.equal(powerToggles, 1, 'Display Preview actions from another page are ignored');
  assert.equal(capture, 'NotAllowedError', 'screen capture is refused to another page in the preview window');
  preview.close();
  record(`PASS Display Preview sandboxed; settings IPC from it dropped; its own action accepted from its page only; capture on another page: ${capture}`);

  // The main-process guard itself: windows that carry the Settings preload but
  // are not the open Settings window (or not its settings.html) are ignored.
  for (const [label, load] of [['about:blank', w => w.loadURL('about:blank')], ['a second settings.html', w => w.loadFile(rendererPath('settings.html'))]]) {
    const rogue = new BrowserWindow({ show: false, webPreferences: { preload: preloadPath('settings'), contextIsolation: true, sandbox: true } });
    await load(rogue);
    await waitFor(() => rogue.webContents.executeJavaScript('typeof window.classroomSettings?.set === "function"'));
    const answer = await rogue.webContents.executeJavaScript(`(async () => {
      window.classroomSettings.set({ alwaysOnTop: true, backgroundOpacity: 0.2, linkShortener: { provider: 'shortio', shortioApiKey: 'pk_rogue', shortioDomain: 'evil.example' } });
      window.classroomSettings.resetPositions();
      try { await window.classroomSettings.get(); return 'answered'; } catch { return 'rejected'; }
    })()`);
    await new Promise(resolve => setTimeout(resolve, 700));
    assert.equal(answer, 'rejected', `settings:get from ${label} is refused`);
    assert.equal(JSON.stringify(onDisk()), before, `settings:set from ${label} is ignored`);
    assert.equal(settings.linkShortener.shortioApiKey, 'pk_verification_only');
    rogue.destroy();
    record(`PASS settings IPC from ${label} with the Settings preload was refused`);
  }
  // The open Settings window itself, once it shows a page other than settings.html
  // (loads started by the main process skip the navigation guard).
  await win.webContents.loadFile(rendererPath('display-preview.html'));
  const offPage = await win.webContents.executeJavaScript(`(async () => {
    window.classroomSettings.set({ linkShortener: { provider: 'shortio', shortioApiKey: 'pk_other_page', shortioDomain: 'evil.example' } });
    try { await window.classroomSettings.get(); return 'answered'; } catch { return 'rejected'; }
  })()`);
  await new Promise(resolve => setTimeout(resolve, 700));
  assert.equal(offPage, 'rejected');
  assert.equal(JSON.stringify(onDisk()), before);
  assert.equal(settings.linkShortener.shortioApiKey, 'pk_verification_only');
  await win.webContents.loadFile(rendererPath('settings.html'));
  await waitFor(() => win.webContents.executeJavaScript("document.querySelector('#shortioApiKey')?.value === 'pk_verification_only'"));
  record('PASS settings IPC from the Settings window on another page was refused; settings.html works again after reload');

  // #214: typing in the Short.io key field saves and broadcasts once it pauses.
  let broadcasts = 0;
  settings.on('changed', () => { broadcasts += 1; });
  const typed = 'pk_typed_key_0123456789abcdefghijk';
  settingsWrites = 0;
  await win.webContents.executeJavaScript(`(() => {
    const field = document.querySelector('#shortioApiKey');
    field.value = '';
    for (const character of ${JSON.stringify(typed)}) { field.value += character; field.dispatchEvent(new Event('input')); }
  })()`);
  await waitFor(() => settings.linkShortener.shortioApiKey === typed);
  await waitFor(() => onDisk().linkShortener.shortioApiKey === typed);
  await waitFor(() => contents.executeJavaScript(`window.classroomShortenerSettings?.shortioApiKey === ${JSON.stringify(typed)}`));
  await new Promise(resolve => setTimeout(resolve, 600));
  record(`Typed ${typed.length} characters: settings.json writes=${settingsWrites}, settings broadcasts=${broadcasts}`);
  // One of each; a runner stalled past the 300 ms pause mid-batch may add one.
  assert.ok(settingsWrites >= 1 && settingsWrites <= 2, `writes=${settingsWrites}`);
  assert.equal(broadcasts, settingsWrites);
  assert.equal((statSync(settingsFile).mode & 0o777).toString(8), '600', 'settings.json is private to the user');
  record(`PASS Short.io typing coalesced (${typed.length} keystrokes, ${settingsWrites} write); settings.json mode 600`);

  // Closing Settings straight after typing must not lose the last characters.
  // Hold the debounce open so only the close can write the change.
  const settingsWindowModule = require('../out/main/settingsWindow');
  settingsWindowModule.SHORTENER_SAVE_DELAY_MS = 60000;
  assert.equal(settingsWindowModule.SHORTENER_SAVE_DELAY_MS, 60000, 'the save delay override took effect');
  const lastTyped = 'pk_closed_straight_away';
  const writesBeforeClose = settingsWrites;
  await win.webContents.executeJavaScript(`(() => {
    const field = document.querySelector('#shortioApiKey');
    field.value = '';
    for (const character of ${JSON.stringify(lastTyped)}) { field.value += character; field.dispatchEvent(new Event('input')); }
  })()`);
  await waitFor(() => settings.linkShortener.shortioApiKey === lastTyped);
  await new Promise(resolve => setTimeout(resolve, 500)); // Past the normal 300 ms delay.
  assert.equal(settingsWrites, writesBeforeClose, 'the change is still pending before close');
  assert.notEqual(onDisk().linkShortener.shortioApiKey, lastTyped);
  const closed = new Promise(resolve => win.once('closed', resolve));
  win.close();
  await closed;
  settingsWindowModule.SHORTENER_SAVE_DELAY_MS = 300;
  assert.equal(settingsWrites, writesBeforeClose + 1, 'closing Settings wrote the pending change once');
  assert.equal(onDisk().linkShortener.shortioApiKey, lastTyped, 'closing Settings flushes the pending save');
  assert.equal(DashboardSettings.load().linkShortener.shortioApiKey, lastTyped);
  record('PASS closing Settings straight after typing kept the last value on disk');

  // A settings.json that cannot be parsed is moved aside, not overwritten.
  writeFileSync(settingsFile, '{"backgroundOpacity": 0.3, "linkShortener": ');
  const recovered = DashboardSettings.load();
  assert.equal(recovered.backgroundOpacity, 1);
  assert.equal(existsSync(settingsFile), false);
  const aside = readdirSync(temporary).filter(name => name.startsWith('settings.json.corrupt-'));
  assert.equal(aside.length, 1);
  assert.equal(readFileSync(join(temporary, aside[0]), 'utf8'), '{"backgroundOpacity": 0.3, "linkShortener": ');
  recovered.save();
  assert.equal(onDisk().backgroundOpacity, 1);
  assert.equal(readdirSync(temporary).filter(name => name.endsWith('.tmp')).length, 0);
  record(`PASS unreadable settings.json moved aside to ${aside[0].replace(/\d/g, 'N')}; defaults used and saved fresh`);

  first.closePermanently();
  second.closePermanently();
  record('PASS: legacy defaults, script escaping, settings UI, disk persistence, live/new/reloaded Electron panels, open-settings bridge');
}).then(() => finish(), finish);

function finish(error) {
  if (error) record(`FAIL: ${error.stack || error}`);
  writeFileSync(join(evidence, 'shortener.txt'), lines.join('\n') + '\n');
  app.exit(error ? 1 : 0);
}
app.on('quit', () => rmSync(temporary, { recursive: true, force: true }));
