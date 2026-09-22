const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');

function harness() {
  const ipcMain = new EventEmitter();
  const handlers = new Map();
  ipcMain.handle = (name, handler) => handlers.set(name, handler);
  const shortcuts = new EventEmitter();
  const display = { title: 'Display', accelerator: 'Ctrl+Alt+S', dismissAccelerator: null };
  const calls = [];
  shortcuts.getStatuses = () => [];
  shortcuts.getDisplayStatus = () => display;
  const move = { title: 'Move to Next Display', accelerator: 'Ctrl+Alt+Shift+M' };
  shortcuts.getMoveWidgetStatus = () => move;
  shortcuts.setMoveWidgetShortcut = (...args) => { calls.push(['move', ...args]); return { ok: true }; };
  shortcuts.setDisplayShortcut = (...args) => { calls.push(args); return { ok: true }; };
  shortcuts.setCapturing = active => calls.push(['capturing', active]);
  shortcuts.reset = () => calls.push(['reset']);
  let window;
  class BrowserWindow extends EventEmitter {
    constructor() { super(); window = this; this.sent = []; this.webContents = { send: (...args) => this.sent.push(args) }; }
    isDestroyed() { return false; }
    loadFile() {}
  }
  const exports = {};
  runInNewContext(readFileSync(join(__dirname, '../out/main/settingsWindow.js'), 'utf8'), {
    exports, process,
    require(name) {
      if (name === 'electron') return { BrowserWindow, ipcMain, app: { getAppPath: () => '.' } };
      if (name === './panelWindow') return { rendererDir: () => '.' };
      if (name.startsWith('./')) return require('../out/main/' + name.slice(2));
      return require(name);
    },
  });
  exports.openSettingsWindow({}, shortcuts, 'test');
  return { handlers, ipcMain, shortcuts, display, calls, window };
}

test('settings exposes and updates native Display status without widget inventory', () => {
  const h = harness();
  assert.equal(h.handlers.get('settings:get')().displayShortcut, h.display);
  h.shortcuts.emit('changed');
  assert.equal(h.window.sent.at(-1)[0], 'settings:shortcuts-changed');
  assert.equal(h.window.sent.at(-1)[2], h.display);
});

test('Display settings IPC validates action and nullable accelerator; reset/recording restore registration', () => {
  const h = harness();
  const set = h.handlers.get('settings:set-display-shortcut');
  assert.equal(typeof set, 'function');
  assert.equal(set({}, 'dismiss', null).ok, true);
  assert.deepEqual(h.calls.shift(), [null, 'dismiss']);
  assert.equal(set({}, 'show', 'Ctrl+Alt+S').ok, true);
  assert.deepEqual(h.calls.shift(), ['Ctrl+Alt+S', 'show']);
  for (const [action, value] of [['toggle', null], ['show', undefined], ['dismiss', 7]]) assert.equal(set({}, action, value).ok, false);
  assert.equal(h.calls.length, 0);
  h.ipcMain.emit('settings:capturing', {}, true);
  h.window.emit('closed');
  h.ipcMain.emit('settings:reset-shortcuts');
  assert.deepEqual(h.calls, [['capturing', true], ['capturing', false], ['reset']]);
});
