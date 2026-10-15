// Electron entry for one benchmark launch of the real Linux shell. It installs
// observers, then requires the shell's own compiled main.js from BENCH_APP_DIR,
// so main.ts runs unmodified. Spawned by launchBench.cjs; see that file.
const { app, BrowserWindow, contentTracing, ipcMain, protocol, session, webContents: allContents } = require('electron');
const { readdirSync, readFileSync, writeFileSync } = require('node:fs');
const { join, resolve } = require('node:path');

const now = () => performance.timeOrigin + performance.now();
const entryTime = now();
const appDir = resolve(process.env.BENCH_APP_DIR);
const profile = resolve(process.env.BENCH_PROFILE);
const scenario = process.env.BENCH_SCENARIO || 'startup';
const out = process.env.BENCH_OUT;
const spawnTime = Number(process.env.BENCH_SPAWN || entryTime);

app.setAppPath(appDir);
app.setPath('userData', profile);
app.setPath('sessionData', profile);
process.env.XDG_CONFIG_HOME = join(profile, 'xdg');

const result = { scenario, appDir, spawnTime, creationTime: process.getCreationTime?.() ?? null, marks: [], contents: {}, windows: {}, phases: {}, samples: {}, errors: [] };
const contentsInfo = new Map();
const listeners = new Set();
const mark = (name, time = now(), extra = null) => {
  result.marks.push({ name, t: time - spawnTime, ...(extra ? { extra } : {}) });
  for (const listener of [...listeners]) listener(name, time, extra);
};
const waitFor = (predicate, label, timeout = 30000) => new Promise((done, fail) => {
  const timer = setTimeout(() => {
    listeners.delete(listener);
    fail(new Error(`Timed out waiting for ${label}`));
  }, timeout);
  const listener = (name, time, extra) => {
    if (!predicate(name, time, extra)) return;
    clearTimeout(timer);
    listeners.delete(listener);
    done({ name, time, extra });
  };
  listeners.add(listener);
});
const delay = (ms) => new Promise((done) => setTimeout(done, ms));
mark('entry', entryTime);

// --- Process accounting from /proc (all descendants of this main process) ---
function processTree() {
  const parents = new Map();
  for (const name of readdirSync('/proc')) {
    if (!/^\d+$/.test(name)) continue;
    try {
      const stat = readFileSync(`/proc/${name}/stat`, 'utf8');
      const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
      parents.set(Number(name), Number(fields[1]));
    } catch {
      // Process exited while scanning.
    }
  }
  const pids = [process.pid];
  for (let index = 0; index < pids.length; index++) {
    for (const [pid, parent] of parents) if (parent === pids[index]) pids.push(pid);
  }
  return pids;
}
function processKind(pid) {
  if (pid === process.pid) return 'browser';
  try {
    // Chromium rewrites its process title, so arguments may be space separated.
    const cmdline = readFileSync(`/proc/${pid}/cmdline`, 'utf8').split(/[\0 ]/);
    const type = cmdline.find((arg) => arg.startsWith('--type='))?.slice(7) ?? 'other';
    if (type === 'utility') return `utility:${cmdline.find((arg) => arg.startsWith('--utility-sub-type='))?.slice(19) ?? '?'}`;
    return type;
  } catch {
    return 'gone';
  }
}
function sampleProcesses() {
  const roles = new Map();
  for (const contents of allContents.getAllWebContents()) {
    if (contents.isDestroyed()) continue;
    const info = contentsInfo.get(contents.id);
    roles.set(contents.getOSProcessId(), info?.role ?? 'unknown');
  }
  return processTree().map((pid) => {
    const entry = { pid, kind: processKind(pid), role: roles.get(pid) ?? null, cpuNs: 0, pssKiB: 0, privateKiB: 0 };
    try {
      entry.cpuNs = Number(readFileSync(`/proc/${pid}/schedstat`, 'utf8').split(' ')[0]);
      const rollup = readFileSync(`/proc/${pid}/smaps_rollup`, 'utf8');
      entry.pssKiB = Number(/^Pss:\s+(\d+)/m.exec(rollup)?.[1] ?? 0);
      for (const match of rollup.matchAll(/^Private_(?:Clean|Dirty):\s+(\d+) kB/gm)) entry.privateKiB += Number(match[1]);
    } catch {
      entry.kind = 'gone';
    }
    return entry;
  });
}
const totals = (processes) => processes.reduce((sum, entry) => ({
  processes: sum.processes + 1,
  cpuMs: sum.cpuMs + entry.cpuNs / 1e6,
  pssKiB: sum.pssKiB + entry.pssKiB,
  privateKiB: sum.privateKiB + entry.privateKiB,
}), { processes: 0, cpuMs: 0, pssKiB: 0, privateKiB: 0 });
function snapshot(label) {
  const processes = sampleProcesses();
  result.samples[label] = { t: now() - spawnTime, totals: totals(processes), processes, protocol: { ...protocolStats } };
  return processes;
}
async function cpuOver(label, ms, during) {
  const before = new Map(sampleProcesses().map((entry) => [entry.pid, entry]));
  const started = now();
  const extra = during ? await during() : null;
  const remaining = ms - (now() - started);
  if (remaining > 0) await delay(remaining);
  const elapsed = now() - started;
  const after = sampleProcesses();
  const byKind = {};
  let total = 0;
  for (const entry of after) {
    const delta = (entry.cpuNs - (before.get(entry.pid)?.cpuNs ?? 0)) / 1e6;
    total += delta;
    const key = entry.role ? `${entry.kind}:${entry.role}` : entry.kind;
    byKind[key] = (byKind[key] ?? 0) + delta;
  }
  result.samples[label] = { elapsedMs: elapsed, cpuMs: total, cpuPercent: (100 * total) / elapsed, byKind, extra };
}

// --- Observers on every window and web contents the shell creates ---
const roleFor = (url) => {
  if (url.endsWith('panel-chrome.html')) return 'chrome';
  if (!url.startsWith('app://')) return null;
  const params = new URL(url).searchParams;
  if (params.get('surface') === 'widget-launcher') return 'launcher';
  if (params.get('surface') === 'widget-panel') return 'panel';
  if (params.get('dashboard') === '1') return 'host';
  return 'other';
};
app.on('web-contents-created', (_event, contents) => {
  const info = { id: contents.id, created: now() - spawnTime, role: null, widgetId: null };
  contentsInfo.set(contents.id, info);
  result.contents[contents.id] = info;
  const contentsMark = (name, time = now(), extra = null) => mark(name, time, { ...(extra ?? {}), wc: contents.id, role: info.role, widgetId: info.widgetId });
  contents.on('did-start-navigation', (details) => {
    if (!details.isMainFrame || info.role) return;
    info.role = roleFor(details.url);
    if (info.role === 'panel') info.widgetId = new URL(details.url).searchParams.get('widgetId');
    contentsMark('nav-start');
  });
  contents.on('dom-ready', () => contentsMark('dom-ready'));
  contents.on('did-finish-load', () => contentsMark('did-finish-load'));
  contents.once('destroyed', () => mark('wc-destroyed', now(), { wc: info.id, role: info.role, widgetId: info.widgetId }));
});
app.on('browser-window-created', (_event, win) => {
  const id = win.id;
  const wc = win.webContents.id;
  result.windows[id] = { id, wc, created: now() - spawnTime };
  const windowMark = (name) => mark(name, now(), { win: id, wc, role: contentsInfo.get(wc)?.role ?? null });
  windowMark('win-created');
  win.once('ready-to-show', () => windowMark('ready-to-show'));
  win.on('show', () => {
    windowMark('show');
    if (!win.webContents.isDestroyed()) win.webContents.send('bench-after-show');
  });
  win.once('closed', () => mark('win-closed', now(), { win: id, wc }));
});
ipcMain.on('bench-mark', (event, name, time, extra) => {
  const info = contentsInfo.get(event.sender.id);
  mark(name, time, { ...(extra ?? {}), wc: event.sender.id, role: info?.role ?? null, widgetId: info?.widgetId ?? null });
});
ipcMain.on('native-message', (event, message) => {
  if (!message || typeof message !== 'object') return;
  const info = contentsInfo.get(event.sender.id);
  const extra = { wc: event.sender.id, role: info?.role ?? null, widgetId: info?.widgetId ?? null };
  if (message.type === 'widget-panels-changed') {
    extra.widgets = Array.isArray(message.widgets)
      ? message.widgets.map((widget) => ({ id: widget.widgetId ?? widget.id, type: widget.widgetType, hidden: widget.hidden === true }))
      : [];
    extra.options = Array.isArray(message.compactWidgetOptions) ? message.compactWidgetOptions.length : 0;
  }
  mark(`msg:${message.type}`, now(), extra);
});

app.on('will-finish-launching', () => mark('will-finish-launching'));
let tracing = null;
app.whenReady().then(() => {
  mark('ready');
  // Optional Chromium trace (BENCH_TRACE=<file.json>) for profiling, not for timing runs.
  if (process.env.BENCH_TRACE) {
    tracing = contentTracing.startRecording({
      included_categories: (process.env.BENCH_TRACE_CATEGORIES || 'v8,v8.execute,blink,loading,devtools.timeline,disabled-by-default-v8.compile,disabled-by-default-devtools.timeline,toplevel,navigation,electron').split(','),
    });
  }
  // External (non app://) requests are observed, and dropped for BENCH_NETWORK=blocked.
  const external = { urls: ['http://*/*', 'https://*/*'] };
  const started = new Map();
  session.defaultSession.webRequest.onBeforeRequest(external, (details, callback) => {
    started.set(details.id, now());
    // `blocked` makes runs independent of network latency (an offline room).
    callback({ cancel: process.env.BENCH_NETWORK === 'blocked' });
  });
  const requestDone = (details) => {
    const begin = started.get(details.id);
    started.delete(details.id);
    const url = new URL(details.url);
    mark('net', now(), { host: url.host, path: url.pathname.slice(0, 40), wc: details.webContentsId ?? null,
      ms: begin ? now() - begin : null, cached: details.fromCache ?? null, error: details.error ?? null,
      role: contentsInfo.get(details.webContentsId)?.role ?? null, type: details.resourceType });
  };
  session.defaultSession.webRequest.onCompleted(external, requestDone);
  session.defaultSession.webRequest.onErrorOccurred(external, requestDone);
  const preload = join(__dirname, 'benchPreload.cjs');
  if (session.defaultSession.registerPreloadScript) {
    session.defaultSession.registerPreloadScript({ type: 'frame', id: 'bench', filePath: preload });
  } else {
    session.defaultSession.setPreloads([preload]);
  }
  void runScenario().catch((error) => {
    result.errors.push(String(error?.stack ?? error));
  }).finally(finish);
});

// Time spent in the shell's app:// handler until it returns a Response (the
// body then streams separately). Wrapped before main.js installs it.
const protocolStats = { count: 0, totalMs: 0, maxMs: 0 };
const handle = protocol.handle.bind(protocol);
protocol.handle = (scheme, handler) => handle(scheme, async (request) => {
  const started = now();
  try {
    return await handler(request);
  } finally {
    const ms = now() - started;
    protocolStats.count += 1;
    protocolStats.totalMs += ms;
    protocolStats.maxMs = Math.max(protocolStats.maxMs, ms);
  }
});

const beforeMain = now();
require(join(appDir, 'out', 'main', 'main.js'));
mark('main-required', now(), { requireMs: now() - beforeMain });

// --- Scenario driving ---
const contentsByRole = (role) => allContents.getAllWebContents().filter((contents) => !contents.isDestroyed() && contentsInfo.get(contents.id)?.role === role);
const hostContents = () => contentsByRole('host')[0];
const isMark = (name, role) => (markName, _time, extra) => markName === name && extra?.role === role;

async function startupPhase() {
  const painted = await waitFor(isMark('content-raf2', 'launcher'), 'launcher content painted', 60000);
  const launcherWc = painted.extra.wc;
  // The launcher counts as up once its content is painted and two frames have
  // been produced after its native window was shown, in whichever order.
  const shown = result.marks.find((entry) => entry.name === 'show-raf2' && entry.extra?.wc === launcherWc);
  if (!shown) await waitFor((name, _time, extra) => name === 'show-raf2' && extra?.wc === launcherWc, 'launcher shown', 10000);
  const interactive = now();
  mark('launcher-interactive', interactive);
  snapshot('launcher-interactive');
}

async function clickIn(contents, expression) {
  const clicked = await contents.executeJavaScript(`(() => { const element = ${expression}; if (!element) return false; element.click(); return true; })()`);
  if (!clicked) throw new Error(`No click target ${expression}`);
}
const buttonEndingWith = (label) => `Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().endsWith(${JSON.stringify(label)}))`;
async function until(label, check, timeout = 15000) {
  const started = now();
  while (now() - started < timeout) {
    const value = await check();
    if (value) return value;
    await delay(25);
  }
  throw new Error(`Timed out: ${label}`);
}

async function openWidget(type, label) {
  await delay(400);
  const requested = now();
  const protocolBefore = { ...protocolStats };
  mark(`${label}:request`, requested);
  const contentPainted = waitFor((name, _time, extra) => name === 'content-raf2' && extra?.role === 'panel'
    && !openWidgets.has(extra.widgetId), `${label} painted`, 30000);
  await hostContents().executeJavaScript(`window.classroomPanelHost.addWidget(${type})`);
  const painted = await contentPainted;
  const widgetId = painted.extra.widgetId;
  openWidgets.add(widgetId);
  const viewWc = painted.extra.wc;
  const chromeWindow = BrowserWindow.getAllWindows().find((win) => win.contentView.children[0]?.webContents?.id === viewWc);
  // CPU the panel's renderers used from spawn to painted content: a companion
  // to wall-clock that is less sensitive to other load on the machine.
  const cpuOf = (contents) => {
    try {
      return Number(readFileSync(`/proc/${contents.getOSProcessId()}/schedstat`, 'utf8').split(' ')[0]) / 1e6;
    } catch {
      return null;
    }
  };
  const viewCpuMs = cpuOf(allContents.fromId(viewWc));
  const chromeCpuMs = chromeWindow ? cpuOf(chromeWindow.webContents) : null;
  const rel = (time) => time - requested;
  const at = (predicate) => {
    const entry = result.marks.find((candidate) => candidate.t + spawnTime >= requested && predicate(candidate));
    return entry ? entry.t + spawnTime - requested : null;
  };
  const phase = {
    widgetId,
    inventory: at((entry) => entry.name === 'msg:widget-panels-changed' && entry.extra?.widgets?.some((widget) => widget.id === widgetId)),
    windowCreated: at((entry) => entry.name === 'win-created' && entry.extra?.win === chromeWindow?.id),
    windowShown: at((entry) => entry.name === 'show' && entry.extra?.win === chromeWindow?.id),
    chromeLoaded: at((entry) => entry.name === 'did-finish-load' && entry.extra?.wc === chromeWindow?.webContents.id),
    viewNavStart: at((entry) => entry.name === 'nav-start' && entry.extra?.wc === viewWc),
    viewPreload: at((entry) => entry.name === 'preload' && entry.extra?.wc === viewWc),
    viewFirstPaint: at((entry) => entry.name === 'paint:first-contentful-paint' && entry.extra?.wc === viewWc),
    viewLoaded: at((entry) => entry.name === 'did-finish-load' && entry.extra?.wc === viewWc),
    panelReady: at((entry) => entry.name === 'msg:panel-ready' && entry.extra?.wc === viewWc),
    contentReady: at((entry) => entry.name === 'msg:panel-content-ready' && entry.extra?.wc === viewWc),
    content: at((entry) => entry.name === 'content' && entry.extra?.wc === viewWc),
    contentPainted: rel(painted.time),
    viewCpuMs,
    chromeCpuMs,
    protocol: { count: protocolStats.count - protocolBefore.count, totalMs: protocolStats.totalMs - protocolBefore.totalMs },
  };
  result.phases[label] = phase;
  return { widgetId, view: allContents.fromId(viewWc), window: chromeWindow };
}
const openWidgets = new Set();

async function closeWidget(panel) {
  const closed = waitFor((name, _time, extra) => name === 'win-closed' && extra?.win === panel.window.id, 'panel destroyed', 15000);
  panel.window.close();
  await closed;
  openWidgets.delete(panel.widgetId);
}

async function framesDuring(contents, action, ms) {
  const resultPromise = new Promise((done) => ipcMain.once('bench-frames-result', (_event, value) => done(value)));
  contents.send('bench-frames', 'start');
  await action();
  await delay(ms);
  contents.send('bench-frames', 'stop');
  const { intervals, longTasks } = await resultPromise;
  const sorted = [...intervals].sort((a, b) => a - b);
  const pick = (q) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : null;
  return { frames: intervals.length, p50: pick(0.5), p95: pick(0.95), max: sorted.at(-1) ?? null, over33ms: intervals.filter((value) => value > 33.4).length, longTasks };
}

async function panelsPhase() {
  await delay(1500);
  snapshot('idle-launcher');
  for (const win of BrowserWindow.getAllWindows()) {
    if (contentsInfo.get(win.webContents.id)?.role === 'launcher') win.close();
  }
  await delay(1000);
  await cpuOver('cpu-idle', 4000);
  snapshot('idle-no-panels');

  let panel = await openWidget(1, 'timer-first');
  await delay(800);
  await closeWidget(panel);
  panel = await openWidget(0, 'randomiser-first');
  await delay(800);
  await closeWidget(panel);
  panel = await openWidget(1, 'timer-repeat');
  await delay(800);
  await closeWidget(panel);
  panel = await openWidget(0, 'randomiser-repeat');
  await delay(800);
  await closeWidget(panel);

  const timer = await openWidget(1, 'timer-both');
  const randomiser = await openWidget(0, 'randomiser-both');
  await delay(2500);
  snapshot('timer-and-randomiser-open');
  await cpuOver('cpu-panels-idle', 4000);

  await timer.view.executeJavaScript(`document.querySelector('[aria-label="Mute timer sound"]')?.click()`);
  await clickIn(timer.view, buttonEndingWith('Start'));
  await until('timer running', () => timer.view.executeJavaScript(`!!(${buttonEndingWith('Pause')})`));
  await delay(500);
  await cpuOver('cpu-timer-running', 5000);

  await clickIn(randomiser.view, buttonEndingWith('Settings'));
  await until('randomiser settings', () => randomiser.view.executeJavaScript(`!!document.querySelector('#textarea')`));
  const names = Array.from({ length: 30 }, (_, index) => `Student ${index + 1}`).join('\n');
  await randomiser.view.executeJavaScript(`(() => { const input = document.querySelector('#textarea'); input.focus(); input.select(); })()`);
  await randomiser.view.insertText(names);
  await until('choices typed', () => randomiser.view.executeJavaScript(`document.querySelector('#textarea')?.value.split('\\n').length === 30`));
  await clickIn(randomiser.view, buttonEndingWith('Save'));
  await until('randomiser ready', () => randomiser.view.executeJavaScript(`!!(${buttonEndingWith('Randomise!!')}) && !document.querySelector('#textarea')`));
  await delay(800);
  await cpuOver('cpu-randomiser-spin', 4200, () => clickIn(randomiser.view, buttonEndingWith('Randomise!!')));
  await until('spin finished', () => randomiser.view.executeJavaScript(`!!(${buttonEndingWith('Again!')})`), 10000);
  await delay(800);
  result.samples['frames-randomiser-spin'] = await framesDuring(randomiser.view, () => clickIn(randomiser.view, buttonEndingWith('Again!')), 4200);
  result.samples['frames-timer-running'] = await framesDuring(timer.view, async () => {}, 3000);
}

async function runScenario() {
  await startupPhase();
  if (scenario === 'panels') await panelsPhase();
  else await delay(1000);
}

let finished = false;
function finish() {
  if (finished) return;
  finished = true;
  result.marks.sort((a, b) => a.t - b.t);
  writeFileSync(out, JSON.stringify(result));
  if (tracing) {
    tracing.then(() => contentTracing.stopRecording(process.env.BENCH_TRACE)).finally(quit);
    return;
  }
  quit();
}
function quit() {
  // Quit through the shell's own path so profile data (code cache, settings)
  // is flushed the way a user quitting would flush it.
  setTimeout(() => app.exit(0), 8000).unref();
  app.quit();
}
setTimeout(() => {
  result.errors.push('benchmark watchdog');
  finish();
}, 180000).unref();
