const test = require('node:test');
const assert = require('node:assert/strict');
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
