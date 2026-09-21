const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { setImmediate: settle } = require('node:timers/promises');
const { DisplayCatalog } = require('../out/main/displayCatalog.js');
const { DisplayPreviewCoordinator } = require('../out/main/displayPreview.js');
const { WidgetShortcutController } = require('../out/main/widgetShortcuts.js');

function harness(t, getSources = async () => [{ id: 'screen:2:0', display_id: '2' }]) {
  const displays = [0, 1000].map((x, index) => ({ id: index + 1, bounds: { x, y: 0, width: 1000, height: 800 }, workArea: { x, y: 0, width: 1000, height: 800 }, scaleFactor: 1 }));
  const screen = new EventEmitter();
  screen.getAllDisplays = () => displays;
  screen.getCursorScreenPoint = () => ({ x: 100, y: 100 });
  screen.getDisplayMatching = bounds => displays[bounds.x >= 1000 ? 1 : 0];
  const windows = [];
  class Window extends EventEmitter {
    constructor(bounds) { super(); this.bounds = bounds; this.shows = 0; this.streams = []; this.active = null; }
    getBounds() { return this.bounds; }
    getContentSize() { return { width: 480, height: 360 }; }
    setBounds(bounds) { this.bounds = bounds; }
    setSize() {}
    show() { this.shows += 1; }
    focus() {}
    close() { this.emit('closed'); }
    setState(state) { this.state = state; }
    startStream(id) { this.streams.push(id); this.active = id; }
    stopStream() { this.active = null; }
    popupMenu() {}
  }
  const settings = {
    frame: { left: 100, top: 80, width: 480, height: 360 }, sourceId: 2,
    widgetShortcuts: {}, widgetDismissShortcuts: {},
    displayPreviewShortcut: 'Ctrl+Alt+S', displayPreviewDismissShortcut: 'Ctrl+Alt+D',
    notifyChanged() {},
    getDisplayPreviewFrame() { return this.frame; },
    setDisplayPreviewFrame(frame) { this.frame = frame; },
    getDisplayPreviewSourceId() { return this.sourceId; },
    setDisplayPreviewSourceId(id) { this.sourceId = id; },
  };
  const preview = new DisplayPreviewCoordinator(settings, new DisplayCatalog(screen), {
    screen, desktopCapturer: { getSources }, createWindow: bounds => { const win = new Window(bounds); windows.push(win); return win; },
  });
  const callbacks = new Map();
  const unexpectedWidget = () => assert.fail('Display must not touch teacher widgets');
  const shortcuts = new WidgetShortcutController(settings, {
    register(key, callback) { callbacks.set(key, callback); return true; }, unregisterAll() { callbacks.clear(); },
  }, unexpectedWidget, unexpectedWidget, unexpectedWidget, preview);
  shortcuts.updateOptions([], false);
  t.after(() => preview.close());
  return { preview, shortcuts, settings, screen, windows, press: key => callbacks.get(key)() };
}

test('Display Show raises the singleton and Dismiss flushes its latest frame without opening', t => {
  const h = harness(t);
  h.press('Ctrl+Alt+D');
  assert.equal(h.windows.length, 0);
  h.press('Ctrl+Alt+S');
  h.press('Ctrl+Alt+S');
  assert.equal(h.windows.length, 1);
  assert.equal(h.windows[0].shows, 2);
  const bounds = { x: 123, y: 87, width: 530, height: 370 };
  h.windows[0].setBounds(bounds);
  h.windows[0].emit('moved');
  h.press('Ctrl+Alt+D');
  assert.equal(h.preview.isOpen, false);
  assert.deepEqual(h.settings.frame, { left: 123, top: 87, width: 530, height: 370 });
  h.press('Ctrl+Alt+S');
  assert.deepEqual(h.windows[1].bounds, bounds);
  assert.equal(h.settings.sourceId, 2);
  assert.equal(h.windows[1].state.powerState, 'off');
});

test('Dismiss cancels deferred enumeration even when Show reopens before it resolves', async t => {
  let resolve;
  let requests = 0;
  const h = harness(t, () => { requests += 1; return new Promise(done => { resolve = done; }); });
  h.press('Ctrl+Alt+S');
  h.windows[0].emit('powerToggle');
  h.press('Ctrl+Alt+D');
  h.press('Ctrl+Alt+S');
  resolve([{ id: 'screen:2:0', display_id: '2' }]);
  await settle();
  h.screen.emit('display-metrics-changed');
  await settle();
  assert.equal(requests, 1);
  assert.equal(h.windows[0].streams.length, 0);
  assert.equal(h.windows[1].streams.length, 0);
  assert.equal(h.windows[1].state.powerState, 'off');
  assert.equal(h.settings.sourceId, 2);
});

test('Dismiss stops live capture and same-key toggle clears suspended resume intent', async t => {
  let requests = 0;
  const h = harness(t, async () => { requests += 1; return [{ id: 'screen:2:0', display_id: '2' }]; });
  h.press('Ctrl+Alt+S');
  h.windows[0].emit('powerToggle');
  await settle();
  assert.equal(h.windows[0].active, 'screen:2:0');
  h.press('Ctrl+Alt+D');
  assert.equal(h.windows[0].active, null);
  h.press('Ctrl+Alt+S');
  assert.equal(h.windows[1].state.powerState, 'off');
  h.windows[1].emit('powerToggle');
  await settle();
  h.windows[1].setBounds({ x: 1100, y: 80, width: 480, height: 360 });
  h.windows[1].emit('moved');
  assert.equal(h.windows[1].state.powerState, 'on');
  assert.equal(h.windows[1].active, null);
  h.shortcuts.setDisplayShortcut('Ctrl+Alt+S', 'dismiss');
  h.press('Ctrl+Alt+S');
  assert.equal(h.preview.isOpen, false);
  h.press('Ctrl+Alt+S');
  h.windows[2].setBounds({ x: 100, y: 80, width: 480, height: 360 });
  h.windows[2].emit('moved');
  await settle();
  assert.equal(requests, 2, 'neither dismiss nor reopen restores capture intent');
  assert.equal(h.windows[2].state.powerState, 'off');
  assert.equal(h.windows[2].active, null);
});
