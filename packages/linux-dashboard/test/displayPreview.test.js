const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { setImmediate: settle } = require('node:timers/promises');
const { DisplayCatalog } = require('../out/main/displayCatalog.js');
const { DisplayPreviewCoordinator } = require('../out/main/displayPreview.js');
const pointer = require('../out/main/pointer.js');

class FakeWindow extends EventEmitter {
  constructor(bounds) {
    super();
    this.bounds = bounds;
    this.states = [];
    this.streams = [];
    this.activeStream = null;
    this.stopStreams = 0;
    this.menu = [];
    this.focused = false;
  }
  getBounds() { return this.bounds; }
  setBounds(bounds) { this.bounds = bounds; }
  setContentSize() {}
  getContentSize() { return { width: 480, height: 402 }; }
  show() {}
  showInactive() {}
  focus() { this.focused = true; }
  isFocused() { return this.focused; }
  setAlwaysOnTop(value) { this.alwaysOnTop = value; }
  close() { this.emit('closed'); }
  setState(state) { this.states.push(state); }
  startStream(sourceId, size) { this.activeStream = sourceId; this.streams.push({ sourceId, size }); }
  stopStream() { this.activeStream = null; this.stopStreams += 1; }
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
  assert.equal(settings.sourceId, 2, 'the saved source survives so a reconnect can find it again');
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
  assert.equal(pending.length, 2, 'switching sources preserves the pending capture intent');

  const sources = [
    { id: 'screen:2:0', display_id: '2' },
    { id: 'screen:3:0', display_id: '3' },
  ];
  pending[0](sources);
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(window.streams.length, 0);
  pending[1](sources);
  await settle();
  assert.deepEqual(window.streams, [{ sourceId: 'screen:3:0', size: { width: 800, height: 600 } }]);
});

test('auto-selecting the sole candidate does not overwrite the saved source', () => {
  const displays = [display(1, 0, 1000), display(2, 1000, 1000)];
  const fakeScreen = {
    getAllDisplays: () => displays,
    getDisplayMatching: () => displays[0],
    getCursorScreenPoint: () => ({ x: 100, y: 100 }),
    on() {},
    removeListener() {},
  };
  let rememberedId = null;
  let window;
  const coordinator = new DisplayPreviewCoordinator(
    {
      getDisplayPreviewFrame: () => undefined,
      getDisplayPreviewSourceId: () => rememberedId,
      setDisplayPreviewSourceId(id) { rememberedId = id; },
      setDisplayPreviewFrame() {},
    },
    new DisplayCatalog(fakeScreen),
    { screen: fakeScreen, desktopCapturer: { async getSources() { return []; } }, createWindow: (bounds) => (window = new FakeWindow(bounds)) },
  );
  coordinator.open();
  assert.equal(rememberedId, null, 'only a manual pick is saved');
  assert.equal(window.states.at(-1).sourceId, 2);
  assert.equal(window.states.at(-1).statusMessage, 'Click to see display');
});

function harness(t, getSources = async () => [{ id: 'screen:2:0', display_id: '2' }]) {
  const displays = [display(1, 0, 1000), display(2, 1000)];
  const screen = new EventEmitter();
  screen.getAllDisplays = () => displays;
  screen.getDisplayMatching = bounds => displays.find(item => {
    const center = bounds.x + bounds.width / 2;
    return center >= item.bounds.x && center < item.bounds.x + item.bounds.width;
  });
  screen.getCursorScreenPoint = () => ({ x: 100, y: 100 });
  const savedFrames = [];
  let remembered = 2;
  let window;
  const coordinator = new DisplayPreviewCoordinator({
    getDisplayPreviewFrame: () => undefined,
    getDisplayPreviewSourceId: () => remembered,
    setDisplayPreviewSourceId(id) { remembered = id; },
    setDisplayPreviewFrame(frame) { savedFrames.push(frame); },
  }, new DisplayCatalog(screen), {
    screen, desktopCapturer: { getSources },
    createWindow: bounds => (window = new FakeWindow(bounds)),
  });
  coordinator.open();
  t.after(() => coordinator.close());
  return { coordinator, window, displays, screen, savedFrames };
}

test('moving an idle preview onto its source requires turning it on after moving clear', async t => {
  let requests = 0;
  const { window } = harness(t, async () => {
    requests += 1;
    return [{ id: 'screen:2:0', display_id: '2' }];
  });
  window.setBounds({ x: 1100, y: 80, width: 480, height: 360 });
  window.emit('moved');
  assert.equal(window.states.at(-1).powerState, 'off');
  assert.equal(window.states.at(-1).statusMessage, 'Preview is on the source display. Move it fully clear, then turn the preview on.');
  assert.equal(requests, 0);

  window.setBounds({ x: 100, y: 80, width: 480, height: 360 });
  window.emit('moved');
  await settle();
  assert.equal(window.states.at(-1).powerState, 'off');
  assert.equal(window.states.at(-1).statusMessage, 'Click to see display');
  assert.equal(requests, 0, 'moving clear must not create capture intent');
  assert.equal(window.activeStream, null);
});

for (const displayId of ['1', '', undefined]) {
  test(`rejects a singleton with unverified display_id ${JSON.stringify(displayId)}`, async t => {
    const { window } = harness(t, async () => [{ id: 'screen:wrong:0', display_id: displayId }]);
    window.emit('powerToggle');
    await settle();
    assert.equal(window.streams.length, 0);
    assert.equal(window.activeStream, null);
    assert.equal(window.states.at(-1).powerState, 'off');
    assert.match(window.states.at(-1).statusMessage, /source unavailable|identity/i);
  });
}

test('moving onto a pending source immediately suspends and invalidates the lookup', async t => {
  const pending = [];
  const { window, savedFrames } = harness(t, () => new Promise(resolve => pending.push(resolve)));
  window.emit('powerToggle');
  window.setBounds({ x: 1100, y: 80, width: 480, height: 360 });
  window.emit('moved');
  assert.match(window.states.at(-1).statusMessage, /suspended/);
  assert.equal(savedFrames.length, 0, 'safety must not wait for frame persistence');
  pending[0]([{ id: 'screen:2:0', display_id: '2' }]);
  await settle();
  assert.equal(window.streams.length, 0, 'late completion must not start capture');
  window.setBounds({ x: 100, y: 80, width: 480, height: 360 });
  window.emit('moved');
  assert.equal(pending.length, 2, 'capture intent resumes after moving clear');
  pending[1]([{ id: 'screen:2:0', display_id: '2' }]);
  await settle();
  assert.equal(window.activeStream, 'screen:2:0');
});

test('lookup completion rechecks overlap even before a window event arrives', async t => {
  let resolve;
  const { window } = harness(t, () => new Promise(done => { resolve = done; }));
  window.emit('powerToggle');
  window.setBounds({ x: 1100, y: 80, width: 480, height: 360 });
  resolve([{ id: 'screen:2:0', display_id: '2' }]);
  await settle();
  assert.equal(window.streams.length, 0);
  assert.match(window.states.at(-1).statusMessage, /suspended/);
});

test('a live topology swap stops the stream and ignores late live/error events', async t => {
  const { window, displays, screen } = harness(t);
  window.emit('powerToggle');
  await settle();
  assert.equal(window.activeStream, 'screen:2:0');
  displays[0] = display(1, 800, 1000);
  displays[1] = display(2, 0);
  screen.emit('display-metrics-changed');
  assert.match(window.states.at(-1).statusMessage, /suspended/);
  assert.equal(window.activeStream, null);
  const suspended = window.states.at(-1);
  window.emit('streamLive');
  window.emit('streamError', 'obsolete stream ended');
  assert.deepEqual(window.states.at(-1), suspended);
});

test('live movement stops immediately, without the preference debounce', async t => {
  const { window, savedFrames } = harness(t);
  window.emit('powerToggle');
  await settle();
  window.setBounds({ x: 900, y: 80, width: 480, height: 360 });
  window.emit('moved');
  assert.equal(window.activeStream, null);
  assert.equal(savedFrames.length, 0);
});

test('safe movement during enumeration does not discard a matching result', async t => {
  let resolve;
  const { window, screen } = harness(t, () => new Promise(done => { resolve = done; }));
  window.emit('powerToggle');
  window.setBounds({ x: 50, y: 80, width: 480, height: 360 });
  screen.emit('display-metrics-changed');
  resolve([{ id: 'screen:2:0', display_id: '2' }]);
  await settle();
  assert.equal(window.activeStream, 'screen:2:0');
});

test('lookup completion refreshes changed source geometry and rejects its stale result', async t => {
  const pending = [];
  const { window, displays } = harness(t, () => new Promise(resolve => pending.push(resolve)));
  window.emit('powerToggle');
  displays[1] = display(2, 1300, 640);
  pending[0]([{ id: 'screen:stale:0', display_id: '2' }]);
  await settle();
  assert.equal(window.streams.length, 0);
  assert.equal(pending.length, 2);
  pending[1]([{ id: 'screen:fresh:0', display_id: '2' }]);
  await settle();
  assert.deepEqual(window.streams, [{ sourceId: 'screen:fresh:0', size: { width: 640, height: 600 } }]);
});

for (const action of ['stop', 'powerToggle', 'close']) {
  test(`${action} cancels pending enumeration`, async t => {
    let resolve;
    const { window, coordinator } = harness(t, () => new Promise(done => { resolve = done; }));
    window.emit('powerToggle');
    if (action === 'powerToggle') window.emit(action);
    else coordinator[action]();
    resolve([{ id: 'screen:2:0', display_id: '2' }]);
    await settle();
    assert.equal(window.streams.length, 0);
  });
}

test('pointer clicks require live captured geometry and refresh it after topology changes', async t => {
  const points = [];
  t.mock.method(pointer, 'movePointer', async (x, y) => { points.push({ x, y }); return 'moved'; });
  const { window, displays } = harness(t);
  const click = { x: 25, y: 75, imageRect: { x: 0, y: 0, width: 100, height: 100 } };
  window.emit('powerToggle');
  await settle();
  window.emit('previewClick', click);
  assert.equal(points.length, 0, 'no pointer mapping before the renderer is live');
  window.emit('streamLive');
  window.emit('previewClick', click);
  assert.deepEqual(points, [{ x: 1200, y: 450 }]);
  displays[1] = display(2, 1300, 640);
  window.emit('previewClick', click);
  assert.equal(points.length, 1, 'do not map an old captured image into new geometry');
  await settle();
  window.emit('streamLive');
  window.emit('previewClick', click);
  assert.deepEqual(points, [{ x: 1200, y: 450 }, { x: 1460, y: 450 }]);
});

function reconnectHarness(t, showOnReconnect = true, displays = [display(1, 0, 1000), display(2, 1000)], saved = null) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const screen = new EventEmitter();
  screen.getAllDisplays = () => displays;
  screen.getDisplayMatching = () => displays[0];
  screen.getCursorScreenPoint = () => ({ x: 100, y: 100 });
  const windows = [];
  let remembered = saved;
  const coordinator = new DisplayPreviewCoordinator({
    displayPreviewShowOnReconnect: showOnReconnect,
    getDisplayPreviewFrame: () => undefined,
    getDisplayPreviewSourceId: () => remembered,
    setDisplayPreviewSourceId(id) { remembered = id; },
    setDisplayPreviewFrame() {},
  }, new DisplayCatalog(screen), {
    screen, desktopCapturer: { async getSources() { return []; } },
    createWindow: bounds => { const window = new FakeWindow(bounds); windows.push(window); return window; },
  });
  t.after(() => coordinator.shutdown());
  return {
    coordinator, displays, screen, windows,
    remembered: () => remembered,
    unplug() { displays.splice(1, 1); screen.emit('display-removed'); },
    replug(id = 2) { displays.push(display(id, 1000)); screen.emit('display-added'); },
  };
}

test('unplugging the external display hides Display after the burst of notices settles', t => {
  const h = reconnectHarness(t);
  h.coordinator.open();
  h.unplug();
  h.screen.emit('display-metrics-changed');
  t.mock.timers.tick(500);
  h.screen.emit('display-metrics-changed');
  t.mock.timers.tick(500);
  assert.equal(h.coordinator.isOpen, true, 'each notice restarts the debounce');
  t.mock.timers.tick(300);
  assert.equal(h.coordinator.isOpen, false);
});

test('a reconnected display with a new id brings Display back and selects it', t => {
  const h = reconnectHarness(t);
  h.coordinator.open();
  h.unplug();
  t.mock.timers.tick(1000);
  h.replug(7);
  t.mock.timers.tick(1000);
  assert.equal(h.coordinator.isOpen, true);
  assert.equal(h.windows.length, 2);
  assert.equal(h.windows[1].states.at(-1).sourceId, 7);
  assert.equal(h.windows[1].focused, false, 'an automatic reopen must not steal focus');
});

test('an unplug and replug inside the debounce leaves Display open', t => {
  const h = reconnectHarness(t);
  h.coordinator.open();
  h.unplug();
  h.replug();
  t.mock.timers.tick(1000);
  assert.equal(h.coordinator.isOpen, true);
  assert.equal(h.windows.length, 1);
});

test('Display the user closed stays closed across unplug and replug', t => {
  const h = reconnectHarness(t);
  h.coordinator.open();
  h.coordinator.close();
  h.unplug();
  t.mock.timers.tick(1000);
  h.replug();
  t.mock.timers.tick(1000);
  assert.equal(h.coordinator.isOpen, false);
});

test('with reconnect showing off, an auto-hidden Display stays hidden', t => {
  const h = reconnectHarness(t, false);
  h.coordinator.open();
  h.unplug();
  t.mock.timers.tick(1000);
  h.replug();
  t.mock.timers.tick(1000);
  assert.equal(h.coordinator.isOpen, false);
});

test('unplugging a dock with two displays keeps the chosen one for the reconnect', t => {
  const h = reconnectHarness(t, true, [display(1, 0, 1000), display(2, 1000), display(3, 1800)], 3);
  h.coordinator.open();
  assert.equal(h.windows[0].states.at(-1).sourceId, 3);
  h.displays.splice(1, 2);
  h.screen.emit('display-removed');
  t.mock.timers.tick(1000);
  assert.equal(h.coordinator.isOpen, false);
  assert.equal(h.remembered(), 3);
  h.displays.push(display(3, 1800), display(2, 1000));
  h.screen.emit('display-added');
  t.mock.timers.tick(1000);
  assert.equal(h.windows[1].states.at(-1).sourceId, 3);
  assert.equal(h.windows[1].states.at(-1).statusMessage, 'Click to see display');
});

test('a dock whose displays return one at a time ends on the saved display', t => {
  const h = reconnectHarness(t, true, [display(1, 0, 1000), display(2, 1000), display(3, 1800)], 3);
  h.coordinator.open();
  h.displays.splice(1, 2);
  h.screen.emit('display-removed');
  t.mock.timers.tick(1000);
  h.displays.push(display(2, 1000));
  h.screen.emit('display-added');
  t.mock.timers.tick(1000);
  assert.equal(h.windows[1].states.at(-1).sourceId, 2, 'display 2 stands in');
  assert.equal(h.remembered(), 3, 'a stand-in is never saved');
  h.displays.push(display(3, 1800));
  h.screen.emit('display-added');
  assert.equal(h.windows[1].states.at(-1).sourceId, 3);
});

test('a live stand-in is not switched away outside the reopen window', async t => {
  const h = reconnectHarness(t, true, [display(1, 0, 1000), display(2, 1000), display(3, 1800)], 3);
  h.coordinator.open();
  h.displays.splice(2, 1);
  h.screen.emit('display-removed');
  assert.equal(h.windows[0].states.at(-1).sourceId, 2, 'display 2 stands in');
  h.windows[0].emit('powerToggle');
  h.displays.push(display(3, 1800));
  h.screen.emit('display-added');
  assert.equal(h.windows[0].states.at(-1).sourceId, 2);
  assert.equal(h.windows[0].states.at(-1).powerState, 'on');
});
