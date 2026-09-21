const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');
const { DashboardSettings } = require('../out/main/settings.js');

test('display preview settings round-trip through getters and setters', () => {
  const settings = new DashboardSettings();
  const frame = { left: -100, top: 20, width: 480, height: 360 };
  settings.setDisplayPreviewFrame(frame);
  settings.setDisplayPreviewSourceId(42);
  settings.setDisplayPreviewShortcut('Ctrl+Alt+Shift+0');
  assert.deepEqual(settings.getDisplayPreviewFrame(), frame);
  assert.equal(settings.getDisplayPreviewSourceId(), 42);
  assert.equal(settings.getDisplayPreviewShortcut(), 'Ctrl+Alt+Shift+0');
  settings.setDisplayPreviewSourceId(null);
  settings.setDisplayPreviewShortcut(null);
  assert.equal(settings.getDisplayPreviewSourceId(), null);
  assert.equal(settings.getDisplayPreviewShortcut(), null);
});

function persistedSettings(t, initial) {
  const directory = mkdtempSync(join(tmpdir(), 'display-shortcuts-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, 'settings.json');
  writeFileSync(path, JSON.stringify(initial));
  const exports = {};
  runInNewContext(readFileSync(join(__dirname, '../out/main/settings.js'), 'utf8'), {
    exports,
    process: { ...process, env: { ...process.env, XDG_CONFIG_HOME: directory } },
    require(name) {
      if (name === 'electron') return { app: { getPath: () => directory } };
      if (name === './log') return { log: { warn() {} } };
      if (name.startsWith('./')) return require('../out/main/' + name.slice(2));
      return require(name);
    },
  });
  return { load: () => exports.DashboardSettings.load(), raw: () => JSON.parse(readFileSync(path, 'utf8')) };
}

test('Display Show and Dismiss explicit null assignments survive save and reload', t => {
  const h = persistedSettings(t, { displayPreviewShortcut: 'Ctrl+Alt+S', displayPreviewDismissShortcut: 'Ctrl+Alt+D' });
  const settings = h.load();
  assert.equal(settings.displayPreviewDismissShortcut, 'Ctrl+Alt+D');
  settings.setDisplayPreviewShortcut(null);
  settings.setDisplayPreviewDismissShortcut(null);
  assert.equal(h.raw().displayPreviewShortcut, null);
  assert.equal(h.raw().displayPreviewDismissShortcut, null);
  const reloaded = h.load();
  assert.equal(reloaded.displayPreviewShortcut, null);
  assert.equal(reloaded.displayPreviewDismissShortcut, null);
});

test('legacy Display Show is retained and missing Dismiss stays distinguishable from null', t => {
  const h = persistedSettings(t, { displayPreviewShortcut: 'Ctrl+Alt+S' });
  const settings = h.load();
  settings.save();
  assert.equal(h.raw().displayPreviewShortcut, 'Ctrl+Alt+S');
  assert.equal(Object.hasOwn(h.raw(), 'displayPreviewDismissShortcut'), false);
  settings.setDisplayPreviewDismissShortcut(null);
  assert.equal(h.load().displayPreviewDismissShortcut, null);
});
