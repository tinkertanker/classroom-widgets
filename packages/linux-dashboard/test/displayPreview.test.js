const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { DisplayCatalog } = require('../out/main/displayCatalog.js');
const { DisplayPreviewCoordinator } = require('../out/main/displayPreview.js');

class FakeWindow extends EventEmitter {
  constructor(bounds) {
    super();
    this.bounds = bounds;
    this.states = [];
    this.streams = [];
    this.stopStreams = 0;
    this.menu = [];
  }
  getBounds() { return this.bounds; }
  setBounds(bounds) { this.bounds = bounds; }
  setSize() {}
  getContentSize() { return { width: 480, height: 402 }; }
  show() {}
  focus() {}
  close() { this.emit('closed'); }
  setState(state) { this.states.push(state); }
  startStream(sourceId, size) { this.streams.push({ sourceId, size }); }
  stopStream() { this.stopStreams += 1; }
  popupMenu(template) { this.menu = template; }
}

function display(id, x, width = 800) {
  return {
    id,
    label: `Display ${id}`,
    bounds: { x, y: 0, width, height: 600 },
    workArea: { x, y: 0, width, height: 600 },
    scaleFactor: 1,
    internal: id === 1,
  };
}

test('overlapping start keeps power on and resumes after moving clear', async () => {
  const displays = [display(1, 0, 1000), display(2, 500, 1000)];
  const listeners = new Map();
  const fakeScreen = {
    getAllDisplays: () => displays,
    getDisplayMatching: () => displays[0],
    getCursorScreenPoint: () => ({ x: 100, y: 100 }),
    on(name, callback) { listeners.set(name, callback); },
    removeListener() {},
  };
  const fakeCapture = {
    calls: 0,
    async getSources() {
      this.calls += 1;
      return [{ id: 'screen:2:0', display_id: '2' }];
    },
  };
  let window;
  const coordinator = new DisplayPreviewCoordinator(
    { getDisplayPreviewFrame: () => undefined, getDisplayPreviewSourceId: () => null, setDisplayPreviewSourceId() {}, setDisplayPreviewFrame() {} },
    new DisplayCatalog(fakeScreen),
    { screen: fakeScreen, desktopCapturer: fakeCapture, createWindow: (bounds) => (window = new FakeWindow(bounds)) },
  );
  coordinator.open();
  window.emit('powerToggle');
  assert.equal(window.states.at(-1).powerState, 'on');
  assert.match(window.states.at(-1).statusMessage, /overlaps the source display/);
  window.bounds = { x: 0, y: 0, width: 400, height: 300 };
  listeners.get('display-metrics-changed')();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(fakeCapture.calls, 1);
  assert.equal(window.streams.length, 1);
});

test('source loss stops capture and selects the remaining display', async () => {
  const displays = [display(1, 0, 1000), display(2, 1000), display(3, 1800)];
  const listeners = new Map();
  const fakeScreen = {
    getAllDisplays: () => displays,
    getDisplayMatching: () => displays[0],
    getCursorScreenPoint: () => ({ x: 100, y: 100 }),
    on(name, callback) { listeners.set(name, callback); },
    removeListener() {},
  };
  const fakeCapture = {
    async getSources() {
      return [
        { id: 'screen:2:0', display_id: '2' },
        { id: 'screen:3:0', display_id: '3' },
      ];
    },
  };
  const settings = {
    sourceId: 2,
    getDisplayPreviewFrame: () => undefined,
    getDisplayPreviewSourceId: () => settings.sourceId,
    setDisplayPreviewSourceId(id) { settings.sourceId = id; },
    setDisplayPreviewFrame() {},
  };
  let window;
  const coordinator = new DisplayPreviewCoordinator(
    settings,
    new DisplayCatalog(fakeScreen),
    { screen: fakeScreen, desktopCapturer: fakeCapture, createWindow: (bounds) => (window = new FakeWindow(bounds)) },
  );
  coordinator.open();
  window.emit('powerToggle');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(window.streams.length, 1);

  displays.splice(1, 1);
  listeners.get('display-metrics-changed')();

  assert.equal(window.stopStreams, 1);
  assert.equal(window.states.at(-1).powerState, 'off');
  assert.equal(window.states.at(-1).sourceId, 3);
  assert.equal(settings.sourceId, null);
});

test('stale starts do not stream a source selected before capture resolves', async () => {
  const displays = [display(1, 0, 1000), display(2, 1000), display(3, 1800)];
  const listeners = new Map();
  const pending = [];
  const fakeScreen = {
    getAllDisplays: () => displays,
    getDisplayMatching: () => displays[0],
    getCursorScreenPoint: () => ({ x: 100, y: 100 }),
    on(name, callback) { listeners.set(name, callback); },
    removeListener() {},
  };
  const fakeCapture = {
    getSources() {
      return new Promise((resolve) => pending.push(resolve));
    },
  };
  const settings = {
    sourceId: 2,
    getDisplayPreviewFrame: () => undefined,
    getDisplayPreviewSourceId: () => settings.sourceId,
    setDisplayPreviewSourceId(id) { settings.sourceId = id; },
    setDisplayPreviewFrame() {},
  };
  let window;
  const coordinator = new DisplayPreviewCoordinator(
    settings,
    new DisplayCatalog(fakeScreen),
    { screen: fakeScreen, desktopCapturer: fakeCapture, createWindow: (bounds) => (window = new FakeWindow(bounds)) },
  );
  coordinator.open();
  window.emit('powerToggle');
  await new Promise((resolve) => setImmediate(resolve));
  window.emit('menuRequested');
  window.menu.find((item) => typeof item.label === 'string' && item.label.includes('Display 3')).click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(pending.length, 1);

  const sources = [
    { id: 'screen:2:0', display_id: '2' },
    { id: 'screen:3:0', display_id: '3' },
  ];
  pending[0](sources);
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(window.streams.length, 0);
});
