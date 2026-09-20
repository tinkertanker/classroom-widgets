const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeAccelerator, WidgetShortcutController } = require('../out/main/widgetShortcuts.js');

function harness(settingsOverrides = {}, refused = []) {
  const callbacks = new Map();
  const settings = Object.assign({
    widgetShortcutsInitialized: false,
    widgetShortcuts: {},
    widgetDismissShortcuts: {},
    displayPreviewShortcut: null,
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
  const dismissed = [];
  const toggled = [];
  const displayed = [];
  return {
    settings, callbacks, launched, dismissed, toggled, displayed,
    controller: new WidgetShortcutController(
      settings,
      registrar,
      (type) => launched.push(type),
      (type) => dismissed.push(type),
      (type) => toggled.push(type),
      () => displayed.push(true),
    ),
  };
}

test('normalizes aliases and rejects bare or multiple keys', () => {
  assert.equal(normalizeAccelerator('shift + control + a'), 'Ctrl+Shift+A');
  assert.equal(normalizeAccelerator('A'), null);
  assert.equal(normalizeAccelerator('Ctrl+A+B'), null);
});

test('backfills defaults for widget types that arrive after the first inventory', () => {
  const h = harness();
  h.controller.updateOptions([{ widgetType: 40, title: 'Display' }]);
  h.controller.updateOptions([{ widgetType: 40, title: 'Display' }, { widgetType: 7, title: 'Timer' }]);
  assert.deepEqual(h.settings.widgetShortcuts, { '7': 'Ctrl+Alt+Shift+2', '40': 'Ctrl+Alt+Shift+1' });
  assert.deepEqual(h.settings.widgetDismissShortcuts, { '7': 'Ctrl+Alt+Shift+2', '40': 'Ctrl+Alt+Shift+1' });
});

test('backfills an unused default without taking an existing shortcut from another widget', () => {
  const h = harness({
    widgetShortcutsInitialized: true,
    widgetShortcuts: { '7': 'Ctrl+Alt+Shift+1' },
    widgetDismissShortcuts: { '7': 'Ctrl+Alt+Shift+1' },
  });

  h.controller.updateOptions([{ widgetType: 40, title: 'Randomiser' }, { widgetType: 7, title: 'Timer' }]);

  assert.equal(h.settings.widgetShortcuts['7'], 'Ctrl+Alt+Shift+1');
  assert.equal(h.settings.widgetShortcuts['40'], 'Ctrl+Alt+Shift+2');
  assert.equal(h.settings.widgetDismissShortcuts['40'], 'Ctrl+Alt+Shift+2');
  assert.deepEqual(h.controller.getStatuses().map((item) => item.state), ['active', 'active']);
});

test('preserves explicit clears and intended assignments when registration fails', () => {
  const h = harness({
    widgetShortcutsInitialized: true,
    widgetShortcuts: { '1': null, '2': 'Ctrl+Alt+K' },
    widgetDismissShortcuts: { '1': null, '2': 'Ctrl+Alt+K' },
  }, ['Ctrl+Alt+K']);
  h.controller.updateOptions([{ widgetType: 1, title: 'One' }, { widgetType: 2, title: 'Two' }]);
  assert.deepEqual(h.settings.widgetShortcuts, { '1': null, '2': 'Ctrl+Alt+K' });
  assert.deepEqual(h.controller.getStatuses().map((item) => item.state), ['inactive', 'conflict']);
});

test('reset is a no-op before options load', () => {
  const h = harness();
  h.controller.reset();
  assert.equal(h.settings.widgetShortcutsInitialized, false);
  assert.deepEqual(h.settings.widgetShortcuts, {});
});

test('setCapturing unregisters shortcuts and restores them', () => {
  const h = harness({ widgetShortcutsInitialized: true, widgetShortcuts: { '1': 'Ctrl+Alt+A' } });
  h.controller.updateOptions([{ widgetType: 1, title: 'One' }]);
  assert.equal(h.callbacks.has('Ctrl+Alt+A'), true);
  h.controller.setCapturing(true);
  assert.equal(h.callbacks.has('Ctrl+Alt+A'), false);
  assert.deepEqual(h.controller.getStatuses().map((item) => [item.state, item.detail]), [['inactive', 'Paused while recording']]);
  h.controller.setCapturing(false);
  assert.equal(h.callbacks.has('Ctrl+Alt+A'), true);
  assert.deepEqual(h.controller.getStatuses().map((item) => item.state), ['active']);
});

test('rejects duplicates and never launches while the host is unavailable', () => {
  const h = harness({
    widgetShortcutsInitialized: true,
    widgetShortcuts: { '1': 'Ctrl+Alt+A', '2': null },
    widgetDismissShortcuts: { '1': 'Ctrl+Alt+A', '2': null },
  });
  h.controller.updateOptions([{ widgetType: 1, title: 'One' }, { widgetType: 2, title: 'Two' }], false);
  assert.deepEqual(h.controller.setShortcut(2, 'Alt+Ctrl+A'), { ok: false, error: 'Already assigned to another widget.' });
  assert.equal(h.callbacks.has('Ctrl+Alt+A'), false);
  assert.deepEqual(h.launched, []);
  h.controller.setHostAvailable(true);
  h.callbacks.get('Ctrl+Alt+A')();
  assert.deepEqual(h.toggled, [1]);
});

test('distinct show and dismiss shortcuts always launch and dismiss separately', () => {
  const h = harness({
    widgetShortcutsInitialized: true,
    widgetShortcuts: { '1': 'Ctrl+Alt+1' },
    widgetDismissShortcuts: { '1': 'Ctrl+Alt+Shift+1' },
  });
  h.controller.updateOptions([{ widgetType: 1, title: 'Timer' }]);

  h.callbacks.get('Ctrl+Alt+1')();
  h.callbacks.get('Ctrl+Alt+1')();
  h.callbacks.get('Ctrl+Alt+Shift+1')();

  assert.deepEqual(h.launched, [1, 1]);
  assert.deepEqual(h.dismissed, [1]);
  assert.deepEqual(h.toggled, []);
});

test('assigns the display preview default and registers it', () => {
  const h = harness();
  h.controller.updateOptions([{ widgetType: 1, title: 'Timer' }]);
  assert.equal(h.settings.displayPreviewShortcut, 'Ctrl+Alt+Shift+0');
  h.callbacks.get('Ctrl+Alt+Shift+0')();
  assert.deepEqual(h.displayed, [true]);
});

test('keeps the display preview shortcut registered while the widget host is unavailable', () => {
  const h = harness({ widgetShortcutsInitialized: true, displayPreviewShortcut: 'Ctrl+Alt+Shift+0' });
  h.controller.updateOptions([{ widgetType: 1, title: 'Timer' }], false);
  assert.equal(h.callbacks.has('Ctrl+Alt+Shift+0'), true);
  h.controller.setHostAvailable(true);
  h.controller.setHostAvailable(false);
  assert.equal(h.callbacks.has('Ctrl+Alt+Shift+0'), true);
});

test('rejects a widget shortcut duplicated by the display preview shortcut', () => {
  const h = harness({
    widgetShortcutsInitialized: true,
    displayPreviewShortcut: 'Ctrl+Alt+Shift+0',
    widgetShortcuts: { '1': null },
    widgetDismissShortcuts: { '1': null },
  });
  h.controller.updateOptions([{ widgetType: 1, title: 'Timer' }]);
  assert.deepEqual(h.controller.setShortcut(1, 'Alt+Ctrl+Shift+0'), { ok: false, error: 'Already assigned to another widget.' });
});
