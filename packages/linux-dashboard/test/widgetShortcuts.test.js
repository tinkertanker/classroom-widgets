const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeAccelerator, WidgetShortcutController } = require('../out/main/widgetShortcuts.js');

function harness(settingsOverrides = {}, refused = []) {
  const callbacks = new Map();
  const settings = Object.assign({
    widgetShortcutsInitialized: false,
    widgetShortcuts: {},
    widgetDismissShortcuts: {},
    notifyChanged() { this.changed = (this.changed || 0) + 1; },
  }, settingsOverrides);
  const registrations = [];
  const registrar = {
    register(accelerator, callback) {
      registrations.push(accelerator);
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
  const preview = {
    isOpen: false,
    closed: 0,
    open() { this.isOpen = true; displayed.push(true); },
    close() { if (this.isOpen) this.closed += 1; this.isOpen = false; },
  };
  return {
    settings, callbacks, registrations, launched, dismissed, toggled, displayed, preview,
    controller: new WidgetShortcutController(
      settings,
      registrar,
      (type) => launched.push(type),
      (type) => dismissed.push(type),
      (type) => toggled.push(type),
      preview,
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

test('reset preserves regular widget bindings before options load', () => {
  const h = harness();
  h.controller.reset();
  assert.equal(h.settings.widgetShortcutsInitialized, false);
  assert.deepEqual(h.settings.widgetShortcuts, {});
});

for (const action of ['show', 'dismiss']) {
  test(`reset waits for inventory when a retained widget ${action} reserves Display's default`, () => {
    const h = harness({
      widgetShortcutsInitialized: true,
      widgetShortcuts: { '7': action === 'show' ? 'Shift+Alt+Ctrl+0' : 'Ctrl+Alt+T' },
      widgetDismissShortcuts: { '7': action === 'dismiss' ? 'Shift+Alt+Ctrl+0' : 'Ctrl+Alt+Y' },
      displayPreviewShortcut: 'Ctrl+Alt+S',
      displayPreviewDismissShortcut: 'Ctrl+Alt+D',
      moveWidgetPreviousShortcut: 'Ctrl+Alt+Shift+Left',
      moveWidgetNextShortcut: 'Ctrl+Alt+Shift+Right',
    });
    const before = JSON.stringify(h.settings);
    h.controller.updateOptions([], false);
    h.controller.reset();
    h.controller.updateOptions([], true);
    h.controller.reset();
    h.controller.updateOptions([], false);
    assert.equal(JSON.stringify(h.settings), before, 'waiting does not persist a conflicting partial reset');
    assert.equal(h.controller.getDisplayStatus().state, 'active');
    assert.equal(h.controller.getDisplayStatus().dismissState, 'active');
    assert.equal(h.callbacks.has('Ctrl+Alt+Shift+0'), false);

    h.controller.setCapturing(true);
    const inventory = [{ widgetType: 40, title: 'Randomiser' }, { widgetType: 7, title: 'Timer' }];
    h.controller.updateOptions(inventory, true);
    assert.equal(h.settings.displayPreviewShortcut, 'Ctrl+Alt+Shift+0');
    assert.equal(h.settings.displayPreviewDismissShortcut, 'Ctrl+Alt+Shift+0');
    assert.deepEqual(h.settings.widgetShortcuts, { '40': 'Ctrl+Alt+Shift+1', '7': 'Ctrl+Alt+Shift+2' });
    assert.deepEqual(h.settings.widgetDismissShortcuts, h.settings.widgetShortcuts);
    assert.equal(h.settings.changed, 1, 'the deferred reset persists once');
    assert.equal(h.callbacks.size, 0, 'inventory does not end recording');
    h.controller.setCapturing(false);
    h.callbacks.get('Ctrl+Alt+Shift+0')();
    h.callbacks.get('Ctrl+Alt+Shift+0')();
    assert.equal(h.displayed.length, 1);
    assert.equal(h.preview.closed, 1);
    h.callbacks.get('Ctrl+Alt+Shift+2')();
    assert.deepEqual(h.toggled, [7]);
    h.controller.updateOptions(inventory, true);
    assert.equal(h.settings.changed, 1, 'later inventory must not reset again');

    const reloaded = harness(JSON.parse(JSON.stringify(h.settings)));
    reloaded.controller.updateOptions(inventory);
    assert.equal(reloaded.controller.getDisplayStatus().state, 'active');
    assert.equal(reloaded.controller.getDisplayStatus().dismissState, 'active');
    assert.deepEqual(reloaded.settings.widgetShortcuts, h.settings.widgetShortcuts);
  });

  test(`an accepted Display ${action} edit or clear supersedes a waiting reset`, () => {
    for (const value of ['Ctrl+Alt+E', null]) {
      const h = harness({
        widgetShortcutsInitialized: true,
        widgetShortcuts: { '7': 'Ctrl+Alt+Shift+0' },
        widgetDismissShortcuts: { '7': 'Ctrl+Alt+Shift+0' },
        displayPreviewShortcut: 'Ctrl+Alt+S',
        displayPreviewDismissShortcut: 'Ctrl+Alt+D',
      });
      h.controller.updateOptions([], false);
      h.controller.reset();
      h.controller.setCapturing(true);
      assert.deepEqual(h.controller.setDisplayShortcut(value, action), { ok: true });
      h.controller.setCapturing(false);
      const inventory = [{ widgetType: 7, title: 'Timer' }];
      h.controller.updateOptions(inventory);
      assert.equal(h.settings.displayPreviewShortcut, action === 'show' ? value : 'Ctrl+Alt+S');
      assert.equal(h.settings.displayPreviewDismissShortcut, action === 'dismiss' ? value : 'Ctrl+Alt+D');
      assert.equal(h.settings.widgetShortcuts['7'], 'Ctrl+Alt+Shift+0');
      h.callbacks.get('Ctrl+Alt+Shift+0')();
      assert.deepEqual(h.toggled, [7]);
      assert.deepEqual(h.displayed, []);
      const reloaded = harness(JSON.parse(JSON.stringify(h.settings)));
      reloaded.controller.updateOptions(inventory);
      assert.equal(reloaded.settings.displayPreviewShortcut, h.settings.displayPreviewShortcut);
      assert.equal(reloaded.settings.displayPreviewDismissShortcut, h.settings.displayPreviewDismissShortcut);
    }
  });
}

test('rejected Display edits do not cancel a waiting reset', () => {
  const h = harness({
    widgetShortcutsInitialized: true,
    widgetShortcuts: { '7': 'Ctrl+Alt+Shift+0' },
    widgetDismissShortcuts: { '7': 'Ctrl+Alt+Shift+0' },
    displayPreviewShortcut: 'Ctrl+Alt+S',
    displayPreviewDismissShortcut: 'Ctrl+Alt+D',
  });
  h.controller.updateOptions([], false);
  h.controller.reset();
  assert.equal(h.controller.setDisplayShortcut('Shift+Alt+Ctrl+0', 'dismiss').ok, false);
  assert.equal(h.controller.setDisplayShortcut('S', 'show').ok, false);
  h.controller.updateOptions([{ widgetType: 7, title: 'Timer' }]);
  assert.equal(h.settings.displayPreviewShortcut, 'Ctrl+Alt+Shift+0');
  assert.equal(h.settings.displayPreviewDismissShortcut, 'Ctrl+Alt+Shift+0');
  assert.equal(h.settings.widgetShortcuts['7'], 'Ctrl+Alt+Shift+1');
  assert.equal(h.controller.getDisplayStatus().state, 'active');
  assert.equal(h.controller.getDisplayStatus().dismissState, 'active');
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

test('Display defaults initialize without inventory and register one presence toggle', () => {
  const h = harness();
  h.controller.updateOptions([], false);
  assert.equal(h.settings.displayPreviewShortcut, 'Ctrl+Alt+Shift+0');
  assert.equal(h.settings.displayPreviewDismissShortcut, 'Ctrl+Alt+Shift+0');
  assert.equal(h.settings.moveWidgetPreviousShortcut, 'Ctrl+Alt+Shift+Left');
  assert.equal(h.settings.moveWidgetNextShortcut, 'Ctrl+Alt+Shift+Right');
  assert.equal(h.settings.changed, 1, 'native defaults are persisted without teacher options');
  assert.deepEqual(h.registrations, ['Ctrl+Alt+Shift+0', 'Ctrl+Alt+Shift+Left', 'Ctrl+Alt+Shift+Right']);
  const toggle = h.callbacks.get('Ctrl+Alt+Shift+0');
  toggle();
  assert.equal(h.preview.isOpen, true);
  toggle();
  assert.equal(h.preview.isOpen, false);
  toggle();
  assert.equal(h.preview.isOpen, true);
  assert.equal(h.preview.closed, 1);
  assert.equal(h.controller.getDisplayStatus().dismissState, 'active');
  assert.deepEqual(h.launched, []);
});

test('Display migration copies custom Show only for missing Dismiss, not explicit null', () => {
  const legacy = harness({ displayPreviewShortcut: 'Ctrl+Alt+S' });
  legacy.controller.updateOptions([], false);
  assert.equal(legacy.settings.displayPreviewDismissShortcut, 'Ctrl+Alt+S');
  const cleared = harness({ displayPreviewShortcut: null, displayPreviewDismissShortcut: null });
  cleared.controller.updateOptions([], false);
  cleared.controller.updateOptions([{ widgetType: 7, title: 'Timer' }]);
  assert.equal(cleared.settings.displayPreviewShortcut, null);
  assert.equal(cleared.settings.displayPreviewDismissShortcut, null);
  const oneSided = harness({ displayPreviewShortcut: 'Ctrl+Alt+S', displayPreviewDismissShortcut: null });
  oneSided.controller.updateOptions([], false);
  assert.equal(oneSided.settings.displayPreviewDismissShortcut, null);
  assert.equal(oneSided.controller.getDisplayStatus().dismissDetail, 'Not assigned');
});

test('distinct Display Show raises only and Dismiss never opens an absent preview without a host', () => {
  const h = harness({ displayPreviewShortcut: 'Ctrl+Alt+S', displayPreviewDismissShortcut: 'Ctrl+Alt+D' });
  h.controller.updateOptions([], false);
  assert.equal(h.callbacks.has('Ctrl+Alt+D'), true);
  h.callbacks.get('Ctrl+Alt+D')();
  assert.equal(h.preview.isOpen, false);
  h.callbacks.get('Ctrl+Alt+S')();
  h.callbacks.get('Ctrl+Alt+S')();
  assert.equal(h.preview.isOpen, true);
  assert.equal(h.preview.closed, 0);
  assert.equal(h.displayed.length, 2);
  h.callbacks.get('Ctrl+Alt+D')();
  assert.equal(h.preview.isOpen, false);
  assert.equal(h.preview.closed, 1);
});

test('both Display chords reserve generic Show/Dismiss including absent inventory entries', () => {
  const h = harness({
    displayPreviewShortcut: 'Ctrl+Alt+S', displayPreviewDismissShortcut: 'Ctrl+Alt+D',
    widgetShortcuts: { '7': null, '99': 'Ctrl+Alt+U' },
    widgetDismissShortcuts: { '7': null, '99': 'Ctrl+Alt+V' },
  });
  h.controller.updateOptions([{ widgetType: 7, title: 'Timer' }]);
  for (const action of ['show', 'dismiss']) {
    for (const chord of ['Alt+Ctrl+S', 'Alt+Ctrl+D']) assert.equal(h.controller.setShortcut(7, chord, action).ok, false);
    for (const chord of ['Alt+Ctrl+U', 'Alt+Ctrl+V']) assert.equal(h.controller.setDisplayShortcut(chord, action).ok, false);
  }
  assert.equal(h.controller.setDisplayShortcut('S').ok, false);
  assert.equal(h.controller.setDisplayShortcut('Alt+Ctrl+S', 'dismiss').ok, true);
  assert.equal(h.controller.getDisplayStatus().dismissAccelerator, 'Ctrl+Alt+S');
  assert.equal(h.callbacks.size, 3, 'own Display pair can share a chord');
});

test('Display conflict status preserves assignments, and recording pause restores both actions', () => {
  const h = harness({ displayPreviewShortcut: 'Ctrl+Alt+S', displayPreviewDismissShortcut: 'Ctrl+Alt+D' }, ['Ctrl+Alt+D']);
  h.controller.updateOptions([], false);
  assert.equal(h.controller.getDisplayStatus().state, 'active');
  assert.equal(h.controller.getDisplayStatus().dismissState, 'conflict');
  assert.equal(h.settings.displayPreviewDismissShortcut, 'Ctrl+Alt+D');
  h.controller.setCapturing(true);
  assert.equal(h.callbacks.size, 0);
  assert.equal(h.controller.getDisplayStatus().detail, 'Paused while recording');
  assert.equal(h.controller.getDisplayStatus().dismissDetail, 'Paused while recording');
  h.controller.setCapturing(false);
  assert.equal(h.controller.getDisplayStatus().state, 'active');
  assert.equal(h.controller.getDisplayStatus().dismissState, 'conflict');
});

test('Display persisted collision reports conflict even without that widget in the inventory', () => {
  const h = harness({ displayPreviewShortcut: null, displayPreviewDismissShortcut: 'Ctrl+Alt+D', widgetDismissShortcuts: { '99': 'Ctrl+Alt+D' } });
  h.controller.updateOptions([], false);
  assert.equal(h.callbacks.has('Ctrl+Alt+D'), false);
  assert.equal(h.controller.getDisplayStatus().dismissState, 'conflict');
});

test('backfill avoids both Display chords; reset restores both native defaults even with no options', () => {
  const h = harness({ displayPreviewShortcut: 'Ctrl+Alt+Shift+1', displayPreviewDismissShortcut: 'Ctrl+Alt+Shift+2' });
  h.controller.updateOptions([{ widgetType: 7, title: 'Timer' }]);
  assert.equal(h.settings.widgetShortcuts['7'], 'Ctrl+Alt+Shift+3');
  h.controller.reset();
  assert.equal(h.settings.widgetShortcuts['7'], 'Ctrl+Alt+Shift+1');
  assert.equal(h.settings.displayPreviewShortcut, 'Ctrl+Alt+Shift+0');
  assert.equal(h.settings.displayPreviewDismissShortcut, 'Ctrl+Alt+Shift+0');
  assert.equal(h.controller.setDisplayShortcut(null, 'show').ok, true);
  assert.equal(h.controller.setDisplayShortcut(null, 'dismiss').ok, true);
  h.controller.updateOptions([], false);
  assert.equal(h.settings.displayPreviewShortcut, null);
  h.controller.reset();
  assert.equal(h.settings.displayPreviewShortcut, 'Ctrl+Alt+Shift+0');
  assert.equal(h.settings.displayPreviewDismissShortcut, 'Ctrl+Alt+Shift+0');
});

test('a stored Display chord equal to a move default leaves that move shortcut unassigned', () => {
  const h = harness({ displayPreviewShortcut: 'Ctrl+Alt+Shift+Left', displayPreviewDismissShortcut: 'Ctrl+Alt+D' });
  h.controller.updateOptions([], false);
  assert.equal(h.settings.moveWidgetPreviousShortcut, null);
  assert.equal(h.settings.moveWidgetNextShortcut, 'Ctrl+Alt+Shift+Right');
});

test('an accepted Move edit supersedes a waiting reset', () => {
  const h = harness({
    widgetShortcutsInitialized: true,
    widgetShortcuts: { '7': 'Ctrl+Alt+Shift+0' },
    widgetDismissShortcuts: { '7': 'Ctrl+Alt+Y' },
    displayPreviewShortcut: 'Ctrl+Alt+S',
    displayPreviewDismissShortcut: 'Ctrl+Alt+D',
    moveWidgetPreviousShortcut: 'Ctrl+Alt+P',
    moveWidgetNextShortcut: 'Ctrl+Alt+Q',
  });
  h.controller.updateOptions([], false);
  h.controller.reset();
  assert.deepEqual(h.controller.setMoveWidgetShortcut('next', 'Ctrl+Alt+N'), { ok: true });
  h.controller.updateOptions([{ widgetType: 7, title: 'Timer' }]);
  assert.equal(h.settings.moveWidgetNextShortcut, 'Ctrl+Alt+N');
  assert.equal(h.settings.displayPreviewShortcut, 'Ctrl+Alt+S');
});

test('reset waits for inventory when a retained widget binding reserves a move default', () => {
  const h = harness({
    widgetShortcutsInitialized: true,
    widgetShortcuts: { '7': 'Ctrl+Alt+Shift+Left' },
    widgetDismissShortcuts: { '7': 'Ctrl+Alt+Y' },
    displayPreviewShortcut: 'Ctrl+Alt+S',
    displayPreviewDismissShortcut: 'Ctrl+Alt+D',
    moveWidgetPreviousShortcut: 'Ctrl+Alt+P',
    moveWidgetNextShortcut: 'Ctrl+Alt+Q',
  });
  const before = JSON.stringify(h.settings);
  h.controller.updateOptions([], false);
  h.controller.reset();
  assert.equal(JSON.stringify(h.settings), before, 'waiting does not persist a partial reset');
  h.controller.updateOptions([{ widgetType: 7, title: 'Timer' }]);
  assert.equal(h.settings.moveWidgetPreviousShortcut, 'Ctrl+Alt+Shift+Left');
  assert.equal(h.settings.moveWidgetNextShortcut, 'Ctrl+Alt+Shift+Right');
  assert.equal(h.settings.displayPreviewShortcut, 'Ctrl+Alt+Shift+0');
});
