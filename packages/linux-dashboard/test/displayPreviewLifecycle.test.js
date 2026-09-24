const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { setImmediate: settle } = require('node:timers/promises');
const { runInNewContext } = require('node:vm');

function renderer() {
  const channels = new Map();
  const sent = [];
  const requests = [];
  function element() {
    const listeners = new Map();
    return {
      addEventListener: (name, callback) => listeners.set(name, callback),
      dispatch: (name, value) => listeners.get(name)?.(value),
    };
  }
  const elements = { video: element(), power: element(), menu: element(), status: element() };
  Object.assign(elements.video, {
    videoWidth: 800, videoHeight: 600, clientWidth: 400, clientHeight: 300,
    play: async () => {}, getBoundingClientRect: () => ({ left: 0, top: 0 }),
  });
  runInNewContext(readFileSync(join(__dirname, '../src/renderer/display-preview.js'), 'utf8'), {
    document: { getElementById: id => elements[id] },
    navigator: { mediaDevices: { getUserMedia: options => new Promise((resolve, reject) => requests.push({ options, resolve, reject })) } },
    window: { displayPreview: { on: (name, callback) => channels.set(name, callback), send: (channel, payload) => sent.push({ channel, payload }) } },
  });
  return {
    ...elements, sent, requests,
    setState: state => channels.get('display-preview:state')(state),
    start: streamId => channels.get('display-preview:start-stream')({ streamId, sourceId: `screen:${streamId}:0`, width: 800, height: 600 }),
    stop: () => channels.get('display-preview:stop-stream')(),
  };
}

function mediaStream() {
  const listeners = new Map();
  const track = {
    readyState: 'live',
    stop() { this.readyState = 'ended'; },
    addEventListener: (name, callback) => listeners.set(name, callback),
    end: () => listeners.get('ended')?.(),
  };
  return { getTracks: () => [track], track };
}

test('renderer stop in the same turn as start cannot be overtaken by getUserMedia', async () => {
  const h = renderer();
  const start = h.start(1);
  h.stop();
  await settle();
  const stream = mediaStream();
  h.requests[0].resolve(stream);
  await start;
  assert.equal(h.video.srcObject, null);
  assert.equal(stream.track.readyState, 'ended');
  assert.equal(h.sent.length, 0);
});

test('renderer discards an older getUserMedia completion after a replacement starts', async () => {
  const h = renderer();
  const first = h.start(1);
  await settle();
  const second = h.start(2);
  await settle();
  const current = mediaStream();
  h.requests[1].resolve(current);
  await second;
  const stale = mediaStream();
  h.requests[0].resolve(stale);
  await first;
  assert.equal(stale.track.readyState, 'ended');
  assert.equal(h.video.srcObject, current);
});

test('renderer ignores ended events from replaced tracks and metadata after stop', async () => {
  const h = renderer();
  const first = h.start(1);
  await settle();
  const stale = mediaStream();
  h.requests[0].resolve(stale);
  await first;
  const second = h.start(2);
  await settle();
  const current = mediaStream();
  h.requests[1].resolve(current);
  await second;
  const sentBefore = h.sent.length;
  stale.track.end();
  assert.equal(h.sent.length, sentBefore, 'obsolete ended must not stop the replacement');
  h.stop();
  h.video.dispatch('loadedmetadata');
  assert.equal(h.sent.length, sentBefore, 'late metadata must not announce a stopped stream');
});

test('renderer identifies live, error and click messages with the current stream', async () => {
  const h = renderer();
  const start = h.start(42);
  await settle();
  const stream = mediaStream();
  h.requests[0].resolve(stream);
  await start;
  assert.equal(h.sent.find(item => item.channel === 'display-preview:stream-live')?.payload.streamId, 42);
  h.video.dispatch('click', { clientX: 100, clientY: 200 });
  assert.equal(h.sent.at(-1).payload.streamId, 42);
  stream.track.end();
  assert.equal(h.sent.at(-1).channel, 'display-preview:stream-error');
  assert.equal(h.sent.at(-1).payload.streamId, 42);
  h.stop();
  h.video.dispatch('click', { clientX: 100, clientY: 200 });
  assert.equal(h.sent.at(-1).payload.streamId, null);
});

test('renderer cannot announce live after stop interrupts video.play', async () => {
  const h = renderer();
  let finishPlay;
  h.video.play = () => new Promise(resolve => { finishPlay = resolve; });
  const start = h.start(1);
  await settle();
  h.requests[0].resolve(mediaStream());
  await settle();
  h.stop();
  finishPlay();
  await start;
  h.video.dispatch('loadedmetadata');
  assert.equal(h.sent.length, 0);
});

function previewWindow() {
  let native;
  class BrowserWindow extends EventEmitter {
    constructor() {
      super();
      native = this;
      this.sent = [];
      this.webContents = new EventEmitter();
      this.webContents.id = 1;
      this.webContents.isDestroyed = () => false;
      this.webContents.send = (channel, payload) => this.sent.push({ channel, payload });
    }
    isDestroyed() { return false; }
    async loadFile() {}
  }
  const exports = {};
  runInNewContext(readFileSync(join(__dirname, '../out/main/displayPreviewWindow.js'), 'utf8'), {
    exports,
    require(name) {
      if (name === 'electron') return { BrowserWindow, ipcMain: new EventEmitter(), app: { getAppPath: () => '.' } };
      if (name === './webContentsSetup') return { allowMediaCapture() {} };
      if (name === './log') return { log: { warn() {} } };
      return require(name);
    },
  });
  const window = new exports.DisplayPreviewWindow({ x: 0, y: 0, width: 480, height: 360 });
  native.webContents.emit('did-finish-load');
  return { window, native };
}

test('window rejects delayed live/error/click IPC from stopped or replaced streams', () => {
  const { window, native } = previewWindow();
  const received = [];
  for (const event of ['streamLive', 'streamError', 'previewClick']) window.on(event, () => received.push(event));
  const click = { x: 20, y: 30, imageRect: { x: 0, y: 0, width: 100, height: 100 } };
  window.startStream('screen:2:0', { width: 800, height: 600 });
  const first = native.sent.at(-1).payload;
  window.handleStreamLive(first);
  assert.deepEqual(received, ['streamLive']);
  window.stopStream();
  window.handleStreamLive(first);
  window.handleStreamError({ ...first, message: 'old failure' });
  window.handleClick({ ...click, streamId: first.streamId });
  assert.deepEqual(received, ['streamLive']);
  window.startStream('screen:3:0', { width: 640, height: 480 });
  const second = native.sent.at(-1).payload;
  assert.notEqual(second.streamId, first.streamId);
  window.handleStreamError({ ...first, message: 'late old failure' });
  window.handleClick({ ...click, streamId: first.streamId });
  window.handleStreamLive(second);
  window.handleClick({ ...click, streamId: second.streamId });
  assert.deepEqual(received, ['streamLive', 'streamLive', 'previewClick']);
  window.handleStreamError({ ...second, message: 'current failure' });
  assert.equal(received.at(-1), 'streamError');
});
