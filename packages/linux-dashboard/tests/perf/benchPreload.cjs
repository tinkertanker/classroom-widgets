// Session preload used only by benchEntry.cjs. It runs in every renderer of
// the app under test and pushes timing marks to the main process, so marks
// are recorded where they happen instead of being polled.
const { ipcRenderer } = require('electron');

const now = () => performance.timeOrigin + performance.now();
const send = (name, time, extra) => ipcRenderer.send('bench-mark', name, time, extra ?? null);
const search = new URLSearchParams(location.search);
const surface = location.href.endsWith('panel-chrome.html') ? 'chrome'
  : search.get('surface') ?? (search.get('dashboard') === '1' ? 'host' : 'other');

send('preload', now());
const observe = (type, callback) => {
  try {
    new PerformanceObserver((list) => list.getEntries().forEach(callback)).observe({ type, buffered: true });
  } catch {
    // Entry type unsupported in this renderer.
  }
};
observe('paint', (entry) => send(`paint:${entry.name}`, performance.timeOrigin + entry.startTime));
observe('largest-contentful-paint', (entry) => send('lcp', performance.timeOrigin + entry.startTime, { size: entry.size }));

let longTasks = { count: 0, total: 0, max: 0 };
observe('longtask', (entry) => {
  longTasks.count += 1;
  longTasks.total += entry.duration;
  longTasks.max = Math.max(longTasks.max, entry.duration);
});

const buttonEndingWith = (label) => Array.from(document.querySelectorAll('button'))
  .some((button) => button.textContent.trim().endsWith(label));
const contentPresent = {
  'widget-launcher': () => buttonEndingWith('Timer') && buttonEndingWith('Randomiser'),
  'widget-panel': () => {
    const root = document.querySelector('.compact-widget-panel-root');
    return Boolean(root && !root.querySelector('.compact-widget-panel-loading') && root.querySelector('button'));
  },
}[surface];

if (contentPresent) {
  let done = false;
  const check = () => {
    if (done || !contentPresent()) return;
    done = true;
    observer.disconnect();
    send('content', now());
    requestAnimationFrame(() => requestAnimationFrame(() => send('content-raf2', now())));
  };
  const observer = new MutationObserver(check);
  observer.observe(document, { childList: true, subtree: true });
  check();
}

// Two frames after the native window is shown, its content is on screen even
// when the page painted earlier while hidden.
ipcRenderer.on('bench-after-show', () => {
  requestAnimationFrame(() => requestAnimationFrame(() => send('show-raf2', now())));
});

// Frame pacing probe: rAF intervals between start and stop requests.
let frames = null;
const tick = (time) => {
  if (!frames) return;
  frames.push(time);
  requestAnimationFrame(tick);
};
ipcRenderer.on('bench-frames', (_event, command) => {
  if (command === 'start') {
    frames = [];
    longTasks = { count: 0, total: 0, max: 0 };
    requestAnimationFrame(tick);
    return;
  }
  const times = frames ?? [];
  frames = null;
  const intervals = times.slice(1).map((time, index) => time - times[index]);
  ipcRenderer.send('bench-frames-result', { intervals, longTasks });
});
