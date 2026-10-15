// In-page instrumentation, installed with page.addInitScript before any app
// code runs. Everything is timed with performance.now(), relative to the
// navigation start, so Playwright's own round trips never enter a number.
//
// `watch` marks two times for a condition: `<name>:dom` when the DOM first
// satisfies it, and `<name>` after the next frame has been produced (a
// requestAnimationFrame callback followed by a posted task), which is when
// the content is on screen.
export function perfProbe(config) {
  const perf = {
    config,
    marks: {},
    longTasks: [],
    fcp: null,
    lcp: null,
    lcpSize: null,
    native: [],
  };
  window.__perf = perf;
  const now = () => performance.now();
  const observe = (type, callback) => {
    try {
      new PerformanceObserver((list) => callback(list.getEntries())).observe({ type, buffered: true });
    } catch {
      // entry type unsupported
    }
  };
  observe('longtask', (entries) => {
    for (const entry of entries) perf.longTasks.push([entry.startTime, entry.duration]);
  });
  observe('paint', (entries) => {
    for (const entry of entries) if (entry.name === 'first-contentful-paint') perf.fcp = entry.startTime;
  });
  observe('largest-contentful-paint', (entries) => {
    const last = entries[entries.length - 1];
    if (last) {
      perf.lcp = last.startTime;
      perf.lcpSize = last.size;
      perf.lcpTag = last.element ? last.element.tagName + (last.url ? ' ' + last.url.split('/').pop() : '') : null;
    }
  });

  const afterNextPaint = (callback) => requestAnimationFrame(() => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => callback(now());
    channel.port2.postMessage(0);
  });
  perf.afterNextPaint = () => new Promise((done) => afterNextPaint(done));

  perf.watch = (name, test) => new Promise((done) => {
    const check = () => {
      try {
        return Boolean(test());
      } catch {
        return false;
      }
    };
    const finish = () => {
      perf.marks[`${name}:dom`] = now();
      afterNextPaint((time) => {
        perf.marks[name] = time;
        done(time);
      });
    };
    if (check()) {
      finish();
      return;
    }
    const observer = new MutationObserver(() => {
      if (check()) {
        observer.disconnect();
        finish();
      }
    });
    observer.observe(document, { childList: true, subtree: true, characterData: true });
  });

  // Clicks in the page (no automation round trip) and resolves when `test`
  // holds and has been painted: { start, painted, dom }.
  perf.clickAndWait = (selector, name, test) => {
    const target = typeof selector === 'string' ? document.querySelector(selector) : selector();
    if (!target) return Promise.reject(new Error(`nothing matches ${selector}`));
    const start = now();
    const painted = perf.watch(name, test);
    target.click();
    return painted.then((time) => ({ start, painted: time, dom: perf.marks[`${name}:dom`] }));
  };

  // Frame intervals from requestAnimationFrame over `ms`.
  perf.recordFrames = (ms) => new Promise((done) => {
    const stamps = [];
    const start = now();
    const tick = (time) => {
      stamps.push(time);
      if (time - start < ms) requestAnimationFrame(tick);
      else done({ start, end: time, stamps });
    };
    requestAnimationFrame(tick);
  });

  for (const watcher of config.watch || []) {
    // eslint-disable-next-line no-new-func
    perf.watch(watcher.name, new Function(`return (${watcher.test})`)());
  }

  for (const [key, value] of Object.entries(config.localStorage || {})) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // opaque origin
    }
  }

  // The Linux shell's preload: a native flag and a message bridge. On
  // `panel-ready` it pushes the widget snapshot, as panelWindow.ts does.
  if (config.native) {
    window.__CLASSROOM_WIDGETS_LINUX__ = true;
    window.__CLASSROOM_WIDGETS_LINUX_VERSION__ = 'perf';
    if (config.panel) window.__CLASSROOM_WIDGET_PANEL__ = true;
    window.classroomNativeBridge = {
      postMessage(message) {
        const type = message && message.type;
        perf.native.push([now(), type]);
        if (type && !(type in perf.marks)) perf.marks[type] = now();
        if (type === 'panel-ready' && config.snapshot) {
          setTimeout(() => window.classroomWidgetPanel?.receiveSnapshot(config.snapshot), 0);
        }
        if (type === 'panel-content-ready') {
          afterNextPaint((time) => {
            perf.marks['panel-content-painted'] = time;
          });
        }
      },
    };
  }
}
