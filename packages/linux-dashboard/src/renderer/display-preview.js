const video = document.getElementById('video');
const power = document.getElementById('power');
const menu = document.getElementById('menu');
const status = document.getElementById('status');
let state = { powerState: 'off', powerEnabled: false, idleStartEnabled: false };
let stream = null;
let streamId = null;
let startToken = 0;

function send(channel, payload) {
  window.displayPreview.send(channel, payload);
}

function applyState(next) {
  state = { ...state, ...next };
  status.textContent = state.statusMessage || '';
  status.title = status.textContent;
  power.textContent = state.powerState === 'on' ? 'Turn preview off' : 'Turn preview on';
  power.disabled = !state.powerEnabled;
}

function imageRect() {
  const width = video.videoWidth;
  const height = video.videoHeight;
  const bounds = { x: 0, y: 0, width: video.clientWidth, height: video.clientHeight };
  if (!(width > 0 && height > 0 && bounds.width > 0 && bounds.height > 0)) return bounds;
  const scale = Math.min(bounds.width / width, bounds.height / height);
  const imageWidth = width * scale;
  const imageHeight = height * scale;
  return { x: (bounds.width - imageWidth) / 2, y: (bounds.height - imageHeight) / 2, width: imageWidth, height: imageHeight };
}

function stopStream() {
  startToken += 1;
  streamId = null;
  if (stream) stream.getTracks().forEach((track) => track.stop());
  stream = null;
  video.srcObject = null;
}

async function startStream({ streamId: id, sourceId, width, height }) {
  stopStream();
  const token = ++startToken;
  streamId = id;
  try {
    const next = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: sourceId,
        maxWidth: width,
        maxHeight: height,
      } },
    });
    if (token !== startToken) {
      next.getTracks().forEach((track) => track.stop());
      return;
    }
    stream = next;
    stream.getTracks().forEach((track) => track.addEventListener('ended', () => {
      if (token === startToken) send('display-preview:stream-error', { streamId: id, message: 'The capture stream ended.' });
    }));
    video.srcObject = stream;
    await video.play();
    if (token !== startToken) return;
    send('display-preview:stream-live', { streamId: id });
  } catch (error) {
    if (token !== startToken) return;
    send('display-preview:stream-error', { streamId: id, message: error instanceof Error ? error.message : String(error) });
  }
}

window.displayPreview.on('display-preview:state', applyState);
window.displayPreview.on('display-preview:start-stream', startStream);
window.displayPreview.on('display-preview:stop-stream', stopStream);
video.addEventListener('error', () => {
  if (stream && video.srcObject === stream && video.error) {
    send('display-preview:stream-error', { streamId, message: 'The preview video failed.' });
  }
});
power.addEventListener('click', () => send('display-preview:action', { action: 'toggle-power' }));
menu.addEventListener('click', () => send('display-preview:action', { action: 'open-menu' }));
video.addEventListener('click', (event) => {
  const bounds = video.getBoundingClientRect();
  send('display-preview:click', { streamId, x: event.clientX - bounds.left, y: event.clientY - bounds.top, imageRect: imageRect() });
});
applyState(state);
