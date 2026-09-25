// Drives the real app (out/main/main.js with the teacher build and its hidden
// host) from an install whose widget shortcuts are still the legacy
// registry-order defaults, and records every tray menu it builds. Build the
// teacher app and this package first, then from the repository root (install
// xvfb on headless Linux):
// xvfb-run -a packages/linux-dashboard/node_modules/.bin/electron --no-sandbox --disable-gpu packages/linux-dashboard/tests/trayMenu.cjs --background
// Evidence goes to $CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR (default: the system temp
// directory's classroom-widgets-test-evidence/linux-tray-menu): tray-menu.txt,
// settings.json as persisted after the run, and settings-window.png.
const { app, BrowserWindow, Tray } = require('electron');
const assert = require('node:assert/strict');
const { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

const root = resolve(__dirname, '..');
app.setAppPath(root);
const evidence = resolve(process.env.CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR || join(tmpdir(), 'classroom-widgets-test-evidence', 'linux-tray-menu'));
mkdirSync(evidence, { recursive: true });
const temporary = mkdtempSync(join(tmpdir(), 'classroom-tray-menu-test-'));
process.env.XDG_CONFIG_HOME = temporary;
const userData = join(temporary, 'ClassroomWidgets');
app.setPath('userData', userData);
mkdirSync(userData, { recursive: true });

const LEGACY_ORDER = [0, 1, 2, 3, 4, 6, 7, 12, 9];
const MENU_ORDER = [1, 7, 4, 3, 0, 2, 6, 12, 9];
const numbered = (order) => Object.fromEntries(order.map((type, index) => [String(type), `Ctrl+Alt+Shift+${index + 1}`]));
writeFileSync(join(userData, 'settings.json'), JSON.stringify({
  widgetShortcutsInitialized: true,
  widgetShortcuts: numbered(LEGACY_ORDER),
  widgetDismissShortcuts: numbered(LEGACY_ORDER),
  displayPreviewShortcut: 'Ctrl+Alt+Shift+0',
  displayPreviewDismissShortcut: 'Ctrl+Alt+Shift+0',
  moveWidgetPreviousShortcut: 'Ctrl+Alt+Shift+Left',
  moveWidgetNextShortcut: 'Ctrl+Alt+Shift+Right',
}));

const menus = [];
const setContextMenu = Tray.prototype.setContextMenu;
Tray.prototype.setContextMenu = function (menu) {
  menus.push(menu);
  return setContextMenu.call(this, menu);
};

const describe = (items, indent = '') => items.flatMap((item) => {
  if (item.type === 'separator') return [`${indent}────`];
  const flags = [
    item.type === 'radio' || item.type === 'checkbox' ? `${item.type}:${item.checked ? 'on' : 'off'}` : null,
    item.enabled ? null : 'disabled',
  ].filter(Boolean);
  const line = `${indent}${item.label}${item.accelerator ? `    [${item.accelerator}]` : ''}${flags.length ? `    (${flags.join(', ')})` : ''}`;
  return [line, ...(item.submenu ? describe(item.submenu.items, indent + '    ') : [])];
});
const log = [];
const record = (title, menu) => log.push(`## ${title}`, ...describe(menu.items), '');
const latest = () => menus[menus.length - 1];
const item = (label) => latest().items.find((entry) => entry.label === label);

async function waitFor(what, check) {
  for (let i = 0; i < 300; i++) {
    if (await check()) return;
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error(`Timed out waiting for ${what}`);
}

require('../out/main/main.js');

app.whenReady().then(async () => {
  try {
    await waitFor('the first tray menu', () => menus.length > 0);
    record('Before the teacher app sends widgets', menus[0]);
    assert.deepEqual(menus[0].items.slice(0, 2).map((entry) => [entry.label, entry.enabled]), [['🖥️  Display', true], ['Loading widgets…', false]]);

    await waitFor('widget options in the tray', () => item('⏱️  Timer'));
    const loaded = latest();
    record('Widgets loaded (legacy shortcuts migrated)', loaded);
    const widgetRows = loaded.items.slice(0, loaded.items.findIndex((entry) => entry.label === 'Arrange Widgets'));
    assert.deepEqual(widgetRows.map((entry) => (entry.type === 'separator' ? '---' : `${entry.label} ${entry.accelerator}`)), [
      '🖥️  Display Ctrl+Alt+Shift+0',
      '⏱️  Timer Ctrl+Alt+Shift+1', '🔤  Text Banner Ctrl+Alt+Shift+2', '---',
      '🚦  Traffic Light Ctrl+Alt+Shift+3', '📋  Task Cue Ctrl+Alt+Shift+4', '---',
      '🎲  Randomiser Ctrl+Alt+Shift+5', '✅  List Ctrl+Alt+Shift+6', '---',
      '🔗  Link Shortener Ctrl+Alt+Shift+7', '🔳  QR Code Ctrl+Alt+Shift+8', '🔊  Sound Effects Ctrl+Alt+Shift+9', '---',
    ]);
    assert.deepEqual(loaded.items.slice(widgetRows.length).map((entry) => entry.type === 'separator' ? '---' : entry.label), [
      'Arrange Widgets', 'Open Widget Launcher', '---',
      'Settings…', 'Launch at Login', '---',
      'Check for Updates…', 'Reload Widgets', `About Classroom Widgets (v${JSON.parse(readFileSync(join(root, '..', '..', 'version.json'), 'utf8')).version})`, 'Open Full Web App', '---',
      'Quit Classroom Widgets',
    ]);
    assert.equal(item('Arrange Widgets').enabled, false);
    const persisted = JSON.parse(readFileSync(join(userData, 'settings.json'), 'utf8'));
    assert.deepEqual(persisted.widgetShortcuts, numbered(MENU_ORDER));
    assert.deepEqual(persisted.widgetDismissShortcuts, numbered(MENU_ORDER));
    assert.equal(persisted.widgetShortcutMenuOrderApplied, true);

    item('⏱️  Timer').click();
    await waitFor('a Timer panel to enable Arrange Widgets', () => item('Arrange Widgets')?.enabled);
    record('After clicking Timer', latest());

    item('Settings…').click();
    let settingsWindow;
    await waitFor('the Settings window', () => (settingsWindow = BrowserWindow.getAllWindows().find((win) => win.getTitle() === 'Classroom Widgets Settings')));
    await waitFor('Settings shortcut rows', () => settingsWindow.webContents.executeJavaScript("document.querySelectorAll('.shortcut-row').length >= 9"));
    const rows = await settingsWindow.webContents.executeJavaScript(
      "[...document.querySelectorAll('.shortcut-row')].map((row) => row.querySelector('.shortcut-name').textContent + ': ' + [...row.querySelectorAll('.shortcut-capture')].map((c) => c.textContent).join(' / '))",
    );
    log.push('## Settings window shortcut rows', ...rows, '');
    for (const [index, title] of ['Timer', 'Text Banner', 'Traffic Light', 'Task Cue', 'Randomiser', 'List'].entries()) {
      assert.ok(rows.some((row) => row.startsWith(`${title}: Ctrl+Alt+Shift+${index + 1}`)), `${title} row shows its migrated shortcut`);
    }
    await new Promise((done) => setTimeout(done, 300));
    writeFileSync(join(evidence, 'settings-window.png'), (await settingsWindow.webContents.capturePage()).toPNG());
    writeFileSync(join(evidence, 'settings.json'), readFileSync(join(userData, 'settings.json')));
    log.push('PASS');
    writeFileSync(join(evidence, 'tray-menu.txt'), log.join('\n') + '\n');
    process.stdout.write(`PASS — evidence in ${evidence}\n`);
    finish(0);
  } catch (error) {
    log.push(`FAIL: ${error.stack || error.message}`);
    writeFileSync(join(evidence, 'tray-menu.txt'), log.join('\n') + '\n');
    process.stderr.write(`${error.stack || error.message}\n`);
    finish(1);
  }
});

function finish(code) {
  rmSync(temporary, { recursive: true, force: true });
  app.exit(code);
}
