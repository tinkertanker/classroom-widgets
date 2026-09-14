// Build teacher assets and this package first. On headless Linux:
// xvfb-run -a node_modules/.bin/electron --no-sandbox --disable-gpu tests/shortener.cjs
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync, writeFileSync } = require('node:fs');
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
  assert.equal(await win.webContents.executeJavaScript("document.querySelectorAll('.shortcut-row').length"), 2);
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
  first.closePermanently();
  second.closePermanently();
  win.destroy();
  console.log('PASS: legacy defaults, script escaping, settings UI, disk persistence, live/new/reloaded Electron panels, open-settings bridge');
}).then(() => app.exit(0), error => { console.error(error); app.exit(1); });
app.on('quit', () => rmSync(temporary, { recursive: true, force: true }));
