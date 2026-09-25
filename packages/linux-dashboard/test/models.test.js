const test = require('node:test');
const assert = require('node:assert/strict');
const { parseDescriptor } = require('../out/main/models.js');

const payload = (extra = {}) => ({
  schemaVersion: 1,
  widgetId: 'w-1',
  widgetType: 1,
  title: 'Timer',
  preferredSize: { width: 350, height: 415 },
  minimumSize: { width: 250, height: 306 },
  maximumSize: null,
  isResizable: true,
  maintainsAspectRatio: false,
  revision: 1,
  stateRevision: 0,
  state: {},
  workspaceId: 'ws',
  theme: 'light',
  savedRandomiserLists: [],
  ...extra,
});

test('descriptor defaults to visible when hidden is absent', () => {
  assert.equal(parseDescriptor(payload()).hidden, false);
});

test('descriptor treats non-boolean hidden as visible', () => {
  assert.equal(parseDescriptor(payload({ hidden: 'yes' })).hidden, false);
  assert.equal(parseDescriptor(payload({ hidden: 1 })).hidden, false);
});

// The teacher app sends compactWidgetOptions in menu order with menuGroup and an
// optional emoji. Ways parsing could fail: an older bundle without menuGroup, or a
// malformed value, drops the option or yields a group that is not a small integer,
// so the menu splits every row; a blank or non-string emoji produces a label with
// leading spaces; the order the teacher app chose is lost.
test('inventory options keep their order and fall back to group 0 and no emoji', () => {
  const { parseInventory } = require('../out/main/models.js');
  const inventory = parseInventory({
    schemaVersion: 1,
    hostInstanceId: 'host',
    inventoryRevision: 1,
    widgets: [],
    compactWidgetOptions: [
      { widgetType: 1, title: 'Timer', menuGroup: 0, emoji: '⏱️' },
      { widgetType: 7, title: 'Text Banner' },
      { widgetType: 4, title: 'Traffic Light', menuGroup: 1.5, emoji: '  ' },
      { widgetType: 3, title: 'Task Cue', menuGroup: -1, emoji: 5 },
      { widgetType: 0, title: 'Randomiser', menuGroup: '2' },
      { widgetType: 2, title: 'List', menuGroup: 2 },
    ],
  });
  assert.deepEqual(inventory.options, [
    { widgetType: 1, title: 'Timer', menuGroup: 0, emoji: '⏱️' },
    { widgetType: 7, title: 'Text Banner', menuGroup: 0 },
    { widgetType: 4, title: 'Traffic Light', menuGroup: 0 },
    { widgetType: 3, title: 'Task Cue', menuGroup: 0 },
    { widgetType: 0, title: 'Randomiser', menuGroup: 0 },
    { widgetType: 2, title: 'List', menuGroup: 2 },
  ]);
});
