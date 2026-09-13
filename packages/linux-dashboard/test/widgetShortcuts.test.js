const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeAccelerator, WidgetShortcutController } = require('../out/main/widgetShortcuts.js');

function harness(settingsOverrides = {}, refused = []) {
  const callbacks = new Map();
  const settings = Object.assign({
    widgetShortcutsInitialized: false,
    widgetShortcuts: {},
    notifyChanged() { this.changed = (this.changed || 0) + 1; },
  }, settingsOverrides);
  const registrar = {
    register(accelerator, callback) {
      if (refused.includes(accelerator)) return false;
      callbacks.set(accelerator, callback);
      return true;
    },
    unregisterAll() { callbacks.clear(); },
  };
  const launched = [];
  return { settings, callbacks, launched, controller: new WidgetShortcutController(settings, registrar, (type) => launched.push(type)) };
}

test('normalizes aliases and rejects bare or multiple keys', () => {
  assert.equal(normalizeAccelerator('shift + control + a'), 'Ctrl+Shift+A');
  assert.equal(normalizeAccelerator('A'), null);
  assert.equal(normalizeAccelerator('Ctrl+A+B'), null);
});

test('assigns defaults once by widgetType and does not assign later types', () => {
  const h = harness();
  h.controller.updateOptions([{ widgetType: 40, title: 'Forty' }, { widgetType: 7, title: 'Seven' }]);
  assert.deepEqual(h.settings.widgetShortcuts, { '7': 'Ctrl+Alt+Shift+2', '40': 'Ctrl+Alt+Shift+1' });
  h.controller.updateOptions([{ widgetType: 7, title: 'Renamed' }, { widgetType: 40, title: 'Forty' }, { widgetType: 9, title: 'New' }]);
  assert.equal(h.settings.widgetShortcuts['7'], 'Ctrl+Alt+Shift+2');
  assert.equal(h.settings.widgetShortcuts['9'], undefined);
});

test('preserves explicit clears and intended assignments when registration fails', () => {
  const h = harness({ widgetShortcutsInitialized: true, widgetShortcuts: { '1': null, '2': 'Ctrl+Alt+K' } }, ['Ctrl+Alt+K']);
  h.controller.updateOptions([{ widgetType: 1, title: 'One' }, { widgetType: 2, title: 'Two' }]);
  assert.deepEqual(h.settings.widgetShortcuts, { '1': null, '2': 'Ctrl+Alt+K' });
  assert.deepEqual(h.controller.getStatuses().map((item) => item.state), ['inactive', 'conflict']);
});

test('rejects duplicates and never launches while the host is unavailable', () => {
  const h = harness({ widgetShortcutsInitialized: true, widgetShortcuts: { '1': 'Ctrl+Alt+A', '2': null } });
  h.controller.updateOptions([{ widgetType: 1, title: 'One' }, { widgetType: 2, title: 'Two' }], false);
  assert.deepEqual(h.controller.setShortcut(2, 'Alt+Ctrl+A'), { ok: false, error: 'Already assigned to another widget.' });
  assert.equal(h.callbacks.has('Ctrl+Alt+A'), false);
  assert.deepEqual(h.launched, []);
  h.controller.setHostAvailable(true);
  h.callbacks.get('Ctrl+Alt+A')();
  assert.deepEqual(h.launched, [1]);
});
