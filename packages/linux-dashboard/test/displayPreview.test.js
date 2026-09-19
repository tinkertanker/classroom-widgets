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
  stopStream() {}
  popupMenu() {}
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
