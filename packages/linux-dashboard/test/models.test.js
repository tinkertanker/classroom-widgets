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
