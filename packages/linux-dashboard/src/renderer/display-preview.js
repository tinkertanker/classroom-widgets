const video = document.getElementById('video');
const power = document.getElementById('power');
const menu = document.getElementById('menu');
const status = document.getElementById('status');
let state = { powerState: 'off', powerEnabled: false, idleStartEnabled: false };
let stream = null;

function send(channel, payload) {
  window.displayPreview.send(channel, payload);
}

function applyState(next) {
  state = { ...state, ...next };
  status.textContent = state.statusMessage || '';
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

async function stopStream() {
  if (stream) stream.getTracks().forEach((track) => track.stop());
  stream = null;
  video.srcObject = null;
}

async function startStream({ sourceId, width, height }) {
  await stopStream();
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: sourceId,
        minWidth: width, maxWidth: width,
        minHeight: height, maxHeight: height,
      } },
    });
    stream.getTracks().forEach((track) => track.addEventListener('ended', () => send('display-preview:stream-error', { message: 'The capture stream ended.' })));
    video.srcObject = stream;
    await video.play();
  } catch (error) {
    send('display-preview:stream-error', { message: error instanceof Error ? error.message : String(error) });
  }
}

window.displayPreview.on('display-preview:state', applyState);
window.displayPreview.on('display-preview:start-stream', startStream);
window.displayPreview.on('display-preview:stop-stream', stopStream);
video.addEventListener('loadedmetadata', () => send('display-preview:stream-live', { videoWidth: video.videoWidth, videoHeight: video.videoHeight }));
video.addEventListener('error', () => send('display-preview:stream-error', { message: 'The preview video failed.' }));
power.addEventListener('click', () => send('display-preview:action', { action: 'toggle-power' }));
menu.addEventListener('click', () => send('display-preview:action', { action: 'open-menu' }));
video.addEventListener('click', (event) => {
  const bounds = video.getBoundingClientRect();
  send('display-preview:click', { x: event.clientX - bounds.left, y: event.clientY - bounds.top, imageRect: imageRect() });
});
applyState(state);
