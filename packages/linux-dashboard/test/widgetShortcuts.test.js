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

test('keeps the display preview shortcut registered while the widget host is unavailable', () => {
  const h = harness({ widgetShortcutsInitialized: true, displayPreviewShortcut: 'Ctrl+Alt+Shift+0' });
  h.controller.updateOptions([{ widgetType: 1, title: 'Timer' }], false);
  assert.equal(h.callbacks.has('Ctrl+Alt+Shift+0'), true);
  h.controller.setHostAvailable(true);
  h.controller.setHostAvailable(false);
  assert.equal(h.callbacks.has('Ctrl+Alt+Shift+0'), true);
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

// One-time move of untouched default widget shortcuts to the menu order.
//
// Ways this migration could fail:
// 1. An untouched legacy install keeps the registry numbering (Randomiser on 1)
//    after the menu reorder, so the tray hints and launch keys disagree with the menu.
// 2. Only Show moves and Dismiss keeps the legacy chord, splitting a toggle into two
//    different widgets' Show and Dismiss.
// 3. An install from before Dismiss shortcuts (no Dismiss map) is treated as customised.
// 4. A customised Show or Dismiss chord, a cleared binding, a missing binding or an
//    extra binding is overwritten, or the other widgets move around it.
// 5. Display or Move Widget shortcuts are touched.
// 6. The new bindings are saved but the old chords stay registered, or the Settings
//    window is not told.
// 7. The empty inventory seen before the web host loads decides (and closes) the
//    migration before the real inventory arrives.
// 8. It runs again later, for example after a restart or after the user deliberately
//    picks the legacy numbering, because the done flag is missing or not persisted.
// 9. A fresh install gets legacy numbering, or is left without the flag.
const LEGACY_ORDER = [0, 1, 2, 3, 4, 6, 7, 12, 9];
const MENU_ORDER = [1, 7, 4, 3, 0, 2, 6, 12, 9];
const menuInventory = () => MENU_ORDER.map((widgetType) => ({ widgetType, title: `Widget ${widgetType}` }));
const numbered = (order) => Object.fromEntries(order.map((type, index) => [String(type), `Ctrl+Alt+Shift+${index + 1}`]));
const legacyInstall = (overrides = {}) => ({
  widgetShortcutsInitialized: true,
  widgetShortcuts: numbered(LEGACY_ORDER),
  widgetDismissShortcuts: numbered(LEGACY_ORDER),
  displayPreviewShortcut: 'Ctrl+Alt+Shift+0',
  displayPreviewDismissShortcut: 'Ctrl+Alt+Shift+0',
  moveWidgetPreviousShortcut: 'Ctrl+Alt+Shift+Left',
  moveWidgetNextShortcut: 'Ctrl+Alt+Shift+Right',
  ...overrides,
});

test('menu order migration moves untouched legacy defaults and re-registers them', () => {
  const h = harness(legacyInstall());
  let changes = 0;
  h.controller.on('changed', () => { changes += 1; });
  h.controller.updateOptions([], false);
  assert.equal(h.settings.widgetShortcutMenuOrderApplied, undefined, 'an empty inventory does not decide');
  changes = 0;
  h.controller.updateOptions(menuInventory());
  assert.deepEqual(h.settings.widgetShortcuts, numbered(MENU_ORDER));
  assert.deepEqual(h.settings.widgetDismissShortcuts, numbered(MENU_ORDER));
  assert.equal(h.settings.widgetShortcutMenuOrderApplied, true);
  assert.equal(h.settings.displayPreviewShortcut, 'Ctrl+Alt+Shift+0');
  assert.equal(h.settings.moveWidgetPreviousShortcut, 'Ctrl+Alt+Shift+Left');
  assert.equal(h.settings.moveWidgetNextShortcut, 'Ctrl+Alt+Shift+Right');
  assert.equal(changes, 1, 'the Settings window hears about the new bindings');
  const timer = h.controller.getStatuses().find((status) => status.widgetType === 1);
  assert.equal(timer.accelerator, 'Ctrl+Alt+Shift+1');
  h.callbacks.get('Ctrl+Alt+Shift+1')();
  h.callbacks.get('Ctrl+Alt+Shift+5')();
  assert.deepEqual(h.toggled, [1, 0]);
});

test('menu order migration treats a missing Dismiss map as defaults', () => {
  const h = harness(legacyInstall({ widgetDismissShortcuts: {} }));
  h.controller.updateOptions(menuInventory());
  assert.deepEqual(h.settings.widgetShortcuts, numbered(MENU_ORDER));
  assert.deepEqual(h.settings.widgetDismissShortcuts, numbered(MENU_ORDER));
});

const customised = {
  'a customised Show': (s) => { s.widgetShortcuts['12'] = 'Ctrl+Alt+Q'; },
  'a customised Dismiss': (s) => { s.widgetDismissShortcuts['12'] = 'Ctrl+Alt+Q'; },
  'a Show chord moved to another widget': (s) => { s.widgetShortcuts['0'] = 'Ctrl+Alt+Shift+2'; s.widgetShortcuts['1'] = 'Ctrl+Alt+Shift+1'; },
  'a cleared Show': (s) => { s.widgetShortcuts['12'] = null; },
  'a cleared Dismiss': (s) => { s.widgetDismissShortcuts['12'] = null; },
  'a missing Show': (s) => { delete s.widgetShortcuts['9']; delete s.widgetDismissShortcuts['9']; },
  'an extra Show': (s) => { s.widgetShortcuts['99'] = null; },
  'an extra Dismiss': (s) => { s.widgetDismissShortcuts['99'] = 'Ctrl+Alt+Q'; },
};
for (const [name, edit] of Object.entries(customised)) {
  test(`menu order migration leaves every binding alone with ${name}`, () => {
    const stored = legacyInstall();
    edit(stored);
    const h = harness(JSON.parse(JSON.stringify(stored)));
    h.controller.updateOptions(menuInventory());
    for (const type of Object.keys(stored.widgetShortcuts)) {
      assert.equal(h.settings.widgetShortcuts[type], stored.widgetShortcuts[type], `Show ${type}`);
    }
    for (const type of Object.keys(stored.widgetDismissShortcuts)) {
      assert.equal(h.settings.widgetDismissShortcuts[type], stored.widgetDismissShortcuts[type], `Dismiss ${type}`);
    }
    assert.equal(h.settings.widgetShortcutMenuOrderApplied, true, 'decided once even without migrating');
  });
}

test('a fresh install gets menu-order defaults and never migrates later', () => {
  const h = harness();
  h.controller.updateOptions(menuInventory());
  assert.deepEqual(h.settings.widgetShortcuts, numbered(MENU_ORDER));
  assert.equal(h.settings.widgetShortcutMenuOrderApplied, true);
  for (const [type, chord] of Object.entries(numbered(LEGACY_ORDER))) {
    h.settings.widgetShortcuts[type] = chord;
    h.settings.widgetDismissShortcuts[type] = chord;
  }
  h.controller.updateOptions(menuInventory().slice(0, 8));
  h.controller.updateOptions(menuInventory());
  assert.deepEqual(h.settings.widgetShortcuts, numbered(LEGACY_ORDER));
});

function persistedController(t, initial) {
  const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
  const { tmpdir } = require('node:os');
  const { join } = require('node:path');
  const { runInNewContext } = require('node:vm');
  const directory = mkdtempSync(join(tmpdir(), 'widget-shortcut-order-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  writeFileSync(join(directory, 'settings.json'), JSON.stringify(initial));
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
  return () => {
    const settings = exports.DashboardSettings.load();
    const registrar = { register: () => true, unregisterAll() {} };
    const preview = { isOpen: false, open() {}, close() {} };
    const controller = new WidgetShortcutController(settings, registrar, () => {}, () => {}, () => {}, preview);
    return { settings, controller };
  };
}

test('the migration runs once across restarts, even if the legacy numbering comes back', (t) => {
  const start = persistedController(t, legacyInstall());
  const first = start();
  first.controller.updateOptions(menuInventory());
  assert.deepEqual({ ...first.settings.widgetShortcuts }, numbered(MENU_ORDER));
  for (const [type, chord] of Object.entries(numbered(LEGACY_ORDER))) {
    first.settings.widgetShortcuts[type] = chord;
    first.settings.widgetDismissShortcuts[type] = chord;
  }
  first.settings.save();

  const restarted = start();
  restarted.controller.updateOptions([], false);
  restarted.controller.updateOptions(menuInventory());
  assert.deepEqual({ ...restarted.settings.widgetShortcuts }, numbered(LEGACY_ORDER));
  assert.deepEqual({ ...restarted.settings.widgetDismissShortcuts }, numbered(LEGACY_ORDER));
});
