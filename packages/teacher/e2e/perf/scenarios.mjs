// Benchmark scenarios. Each one opens a fresh browser context (cold: empty
// HTTP cache and storage unless the scenario seeds storage), drives the app
// the way a teacher or a desktop shell does, and returns flat numeric
// metrics. Times are milliseconds from navigation start (loads) or from the
// in-page click (interactions).
import { perfProbe } from './probe.mjs';
import {
  HISTORY_ROOMS, SEEN_LANDING_KEY, STORAGE_KEY, WidgetType, historyBoard, panelSnapshot, randomiserBoard,
  randomiserState, restoredBoard, timerBoard, timerState,
} from './fixtures.mjs';
import { join, once } from './liveSession.mjs';

const BOARD_VIEWPORT = { width: 1366, height: 768 };
const TOOLBAR = 'button[title^="More widgets"]';
const timerFaces = () => document.querySelectorAll('[data-testid="timer-face"]').length;
const randomiseButtons = () => [...document.querySelectorAll('button')]
  .filter((button) => /Randomise!!/.test(button.textContent || '')).length;

// ---------------------------------------------------------------- helpers

export async function openPage(env, { probe = {}, viewport = BOARD_VIEWPORT, localStorage } = {}) {
  const context = await env.browser.newContext({ viewport, deviceScaleFactor: 1 });
  await env.installFonts(context);
  const config = { ...probe, localStorage: { [SEEN_LANDING_KEY]: '1', ...(localStorage || {}) } };
  await context.addInitScript(perfProbe, config);
  const page = await context.newPage();
  page.on('pageerror', (error) => env.errors.push(error.message));
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  if (env.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: env.cpu });
  if (env.network) {
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: env.network.rttMs,
      downloadThroughput: (env.network.downKbps * 1000) / 8,
      uploadThroughput: (env.network.upKbps * 1000) / 8,
    });
  }
  return { context, page, cdp };
}

const METRIC_NAMES = {
  TaskDuration: 'taskMs', ScriptDuration: 'scriptMs', LayoutDuration: 'layoutMs', RecalcStyleDuration: 'styleMs',
  LayoutCount: 'layouts', RecalcStyleCount: 'styleRecalcs', JSHeapUsedSize: 'heapKB', Nodes: 'domNodes',
};

export async function cdpMetrics(cdp) {
  const { metrics } = await cdp.send('Performance.getMetrics');
  const out = {};
  for (const { name, value } of metrics) {
    const key = METRIC_NAMES[name];
    if (!key) continue;
    out[key] = name.endsWith('Duration') ? value * 1000 : name === 'JSHeapUsedSize' ? value / 1024 : value;
  }
  return out;
}

export const delta = (after, before, prefix = '') => Object.fromEntries(
  Object.entries(after).filter(([key]) => !['heapKB', 'domNodes'].includes(key))
    .map(([key, value]) => [`${prefix}${key}`, value - (before[key] ?? 0)]));

export const longTaskStats = (tasks, from, to, prefix = '') => {
  const inside = tasks.filter(([start]) => start >= from && start < to);
  return {
    [`${prefix}longTasks`]: inside.length,
    [`${prefix}longTaskMs`]: inside.reduce((sum, [, duration]) => sum + duration, 0),
    [`${prefix}blockingMs`]: inside.reduce((sum, [, duration]) => sum + Math.max(0, duration - 50), 0),
  };
};

export async function readPerf(page) {
  return page.evaluate(() => {
    const perf = window.__perf;
    const resources = performance.getEntriesByType('resource').map((entry) => ({
      name: entry.name, type: entry.initiatorType, start: entry.startTime, end: entry.responseEnd,
      transfer: entry.transferSize, decoded: entry.decodedBodySize,
    }));
    return { marks: perf.marks, fcp: perf.fcp, lcp: perf.lcp, lcpSize: perf.lcpSize, lcpTag: perf.lcpTag, longTasks: perf.longTasks, resources };
  });
}

// Requests the page started before `ready`: what the visible result waited on.
// Resource Timing has no entries for the font files that fonts.mjs answers on
// fonts.gstatic.com, so fontRequests counts same-origin font files only.
function resourceStats(resources, ready) {
  const out = { jsRequests: 0, jsKB: 0, jsTransferKB: 0, cssRequests: 0, cssKB: 0, fontRequests: 0, thirdPartyRequests: 0, requests: 0, criticalPathEndMs: 0 };
  for (const resource of resources) {
    if (resource.start > ready) continue;
    out.requests++;
    const url = new URL(resource.name);
    if (!/^(127\.0\.0\.1|localhost)$/.test(url.hostname)) out.thirdPartyRequests++;
    if (url.pathname.endsWith('.js')) {
      out.jsRequests++;
      out.jsKB += resource.decoded / 1024;
      out.jsTransferKB += resource.transfer / 1024;
    } else if (url.pathname.endsWith('.css') || url.hostname === 'fonts.googleapis.com') {
      out.cssRequests++;
      out.cssKB += resource.decoded / 1024;
    } else if (/\.(woff2?|ttf)$/.test(url.pathname) || url.hostname === 'fonts.gstatic.com') {
      out.fontRequests++;
    }
    if (/\.(js|css)$/.test(url.pathname)) out.criticalPathEndMs = Math.max(out.criticalPathEndMs, resource.end);
  }
  return out;
}

export const waitForMark = (page, mark, timeout = 60000) =>
  page.waitForFunction((name) => window.__perf?.marks?.[name] != null, mark, { timeout, polling: 20 });

// Navigates, waits for `readyMark`, lets late work (LCP, idle callbacks)
// settle, and summarises the load.
export async function measureLoad(env, session, url, readyMark, extraMarks = []) {
  const { page, cdp } = session;
  await page.goto(url, { waitUntil: 'commit' });
  await waitForMark(page, readyMark);
  await page.waitForTimeout(env.settleMs);
  const perf = await readPerf(page);
  const ready = perf.marks[readyMark];
  const metrics = await cdpMetrics(cdp);
  const result = {
    readyMs: ready,
    fcpMs: perf.fcp,
    lcpMs: perf.lcp,
    ...Object.fromEntries(extraMarks.map((mark) => [`${mark}Ms`, perf.marks[mark] ?? null])),
    ...longTaskStats(perf.longTasks, 0, ready + env.settleMs),
    ...resourceStats(perf.resources, ready),
    ...metrics,
  };
  return { result, perf };
}

// ---------------------------------------------------------------- board loads

const toolbarWatch = { name: 'toolbar', test: `() => document.querySelector('${TOOLBAR}')` };

async function boardEmpty(env) {
  const session = await openPage(env, { probe: { watch: [toolbarWatch] } });
  try {
    const { result } = await measureLoad(env, session, `${env.baseUrl}/`, 'toolbar');
    const warm = await reloadWarm(env, session, 'toolbar');
    return { ...result, ...warm };
  } finally {
    await session.context.close();
  }
}

// Second load in the same context. HTTP and code caches are warm only with
// --fonts none: Playwright disables the HTTP cache while a route is installed.
export async function reloadWarm(env, session, readyMark) {
  const { page } = session;
  await page.reload({ waitUntil: 'commit' });
  await waitForMark(page, readyMark);
  await page.waitForTimeout(Math.min(env.settleMs, 1000));
  const perf = await readPerf(page);
  const ready = perf.marks[readyMark];
  return { warmReadyMs: ready, warmFcpMs: perf.fcp, ...longTaskStats(perf.longTasks, 0, ready, 'warm_') };
}

const restoredWatch = [
  toolbarWatch,
  { name: 'timer', test: `() => document.querySelector('[data-testid="timer-face"]')` },
  { name: 'randomiser', test: `() => document.querySelector('.backdrop-blur-sm') && [...document.querySelectorAll('button')].some((b) => /Randomise!!/.test(b.textContent))` },
  { name: 'allWidgets', test: `() => document.querySelector('[data-testid="timer-face"]') && document.querySelector('.backdrop-blur-sm') && !document.body.textContent.includes('Loading widget...') && document.querySelectorAll('.react-draggable').length >= 6` },
];

async function boardRestored(env) {
  const session = await openPage(env, {
    probe: { watch: restoredWatch },
    localStorage: { [STORAGE_KEY]: JSON.stringify(restoredBoard()) },
  });
  try {
    const { result } = await measureLoad(env, session, `${env.baseUrl}/`, 'allWidgets', ['toolbar', 'timer', 'randomiser']);
    const warm = await reloadWarm(env, session, 'allWidgets');
    return { ...result, ...warm };
  } finally {
    await session.context.close();
  }
}

// A teacher reloads mid-lesson: the board reclaims its live session and the
// Questions and Drop Box widgets render their whole history from the
// recovery reply (bench.mjs starts the server; see --history). Then two new
// questions and two new links arrive: what each costs the page.
async function boardHistory(env) {
  const { history } = env;
  if (!history) throw new Error('board-history needs the session server bench.mjs starts for it');
  const session = await openPage(env, {
    probe: {
      watch: [toolbarWatch, {
        name: 'history',
        // Every entry of both lists on screen (earlier runs' arrivals add a few).
        test: `() => document.querySelectorAll('button[title="Delete submission"]').length >= ${history.questions + history.submissions}`,
      }],
    },
    localStorage: {
      [STORAGE_KEY]: JSON.stringify(historyBoard(history)),
      'classroom-widgets:hostToken': history.hostToken,
      'classroom-widgets:hostTokenCode': history.code,
    },
  });
  const { page, cdp } = session;
  let student = null;
  try {
    const { result } = await measureLoad(env, session, `${env.baseUrl}/`, 'history', ['toolbar']);
    ({ socket: student } = await join(history.serverUrl, history.code, `Arrival ${Date.now()}`));
    await page.waitForTimeout(500);
    const arrivals = {};
    for (const [kind, send] of [
      ['question', (i) => {
        const done = once(student, 'session:questions:submitted');
        student.emit('session:questions:submit', { sessionCode: history.code, widgetId: HISTORY_ROOMS.questionsRoom, question: `Late question ${i}: what happens to the glucose afterwards?` });
        return done;
      }],
      ['link', (i) => {
        const done = once(student, 'session:linkShare:submitted');
        student.emit('session:linkShare:submit', { sessionCode: history.code, widgetId: HISTORY_ROOMS.dropBox, content: `https://example.com/late/${Date.now()}-${i}` });
        return done;
      }],
    ]) {
      const before = await cdpMetrics(cdp);
      const from = await page.evaluate(() => performance.now());
      for (let i = 0; i < 2; i++) {
        const reply = await send(i);
        if (!reply?.success) throw new Error(`${kind} rejected: ${reply?.error}`);
        await page.waitForTimeout(400);
      }
      await page.waitForTimeout(400);
      const after = await cdpMetrics(cdp);
      const perf = await readPerf(page);
      arrivals[`${kind}ArrivalTaskMs`] = (after.taskMs - before.taskMs) / 2;
      arrivals[`${kind}ArrivalScriptMs`] = (after.scriptMs - before.scriptMs) / 2;
      Object.assign(arrivals, longTaskStats(perf.longTasks, from, from + 1e6, `${kind}Arrival_`));
    }
    return { ...result, ...arrivals };
  } finally {
    student?.disconnect();
    // A reclaim rotates the host token; the next run presents the new one.
    history.hostToken = await page.evaluate(() => localStorage.getItem('classroom-widgets:hostToken')).catch(() => null) || history.hostToken;
    await session.context.close();
  }
}

// ---------------------------------------------------------------- desktop surfaces

async function launcher(env) {
  const session = await openPage(env, {
    viewport: { width: 900, height: 700 },
    probe: {
      native: true,
      watch: [{ name: 'tiles', test: `() => [...document.querySelectorAll('main button')].some((b) => /Timer/.test(b.textContent)) && [...document.querySelectorAll('main button')].some((b) => /Randomiser/.test(b.textContent))` }],
    },
  });
  try {
    const { result } = await measureLoad(env, session, `${env.baseUrl}/?surface=widget-launcher`, 'tiles');
    const warm = await reloadWarm(env, session, 'tiles');
    return { ...result, ...warm };
  } finally {
    await session.context.close();
  }
}

// The hidden host page every desktop shell loads first (the full app with
// dashboard=1, as the Linux shell's hostController builds it). The shell can
// show the launcher's widget list once the host posts its inventory.
async function desktopHost(env, storage) {
  const session = await openPage(env, {
    viewport: { width: 900, height: 700 },
    probe: { native: true },
    localStorage: storage ? { [STORAGE_KEY]: JSON.stringify(storage) } : undefined,
  });
  try {
    const url = `${env.baseUrl}/?dashboard=1&visible=0&mode=compact&backgroundOpacity=1`;
    const { result } = await measureLoad(env, session, url, 'widget-panels-changed');
    const warm = await reloadWarm(env, session, 'widget-panels-changed');
    return { ...result, ...warm };
  } finally {
    await session.context.close();
  }
}

// The widget-panel URL a desktop shell loads. With --panel-widget-type it also
// names the widget's type, for a build that starts loading that widget early.
const panelUrl = (env, snapshot) => `${env.baseUrl}/?surface=widget-panel&widgetId=${encodeURIComponent(snapshot.widgetId)}&backgroundOpacity=1`
  + (env.panelWidgetType ? `&widgetType=${snapshot.widgetType}` : '');

async function panel(env, type, state, watch, viewport) {
  const snapshot = panelSnapshot(type, state);
  const session = await openPage(env, {
    viewport,
    probe: { native: true, snapshot, watch: [{ name: 'content', test: watch }] },
  });
  try {
    const url = panelUrl(env, snapshot);
    const { result } = await measureLoad(env, session, url, 'content', ['panel-ready', 'panel-content-ready', 'panel-content-painted']);
    const warm = await reloadWarm(env, session, 'content');
    return { ...result, ...warm };
  } finally {
    await session.context.close();
  }
}

const panelTimer = (env) => panel(env, WidgetType.TIMER, timerState({ seconds: 300 }),
  `() => document.querySelector('[data-testid="timer-face"]')`, { width: 350, height: 415 });
const panelRandomiser = (env) => panel(env, WidgetType.RANDOMISER, randomiserState(30),
  `() => document.querySelector('.backdrop-blur-sm') && [...document.querySelectorAll('button')].some((b) => /Randomise!!/.test(b.textContent))`,
  { width: 350, height: 250 });

// ---------------------------------------------------------------- opening widgets on the board

// Loads an empty board, then opens the widget twice from its toolbar button:
// the first open fetches the widget's code, the repeat open does not.
async function openFromToolbar(env, name, countTest) {
  const session = await openPage(env, { probe: { watch: [toolbarWatch] } });
  const { page, cdp } = session;
  try {
    await page.goto(`${env.baseUrl}/`, { waitUntil: 'commit' });
    await waitForMark(page, 'toolbar');
    await page.waitForTimeout(env.settleMs);
    const out = {};
    for (const [label, count] of [['first', 1], ['repeat', 2]]) {
      const before = await cdpMetrics(cdp);
      const timing = await page.evaluate(({ selector, label: mark, test, count: target }) => {
        // eslint-disable-next-line no-new-func
        const counter = new Function(`return (${test})`)();
        return window.__perf.clickAndWait(selector, mark, () => counter() >= target);
      }, { selector: `button[title="Add ${name}"]`, label, test: countTest.toString(), count });
      await page.waitForTimeout(300);
      const after = await cdpMetrics(cdp);
      const perf = await readPerf(page);
      out[`${label}Ms`] = timing.painted - timing.start;
      out[`${label}DomMs`] = timing.dom - timing.start;
      Object.assign(out, delta(after, before, `${label}_`), longTaskStats(perf.longTasks, timing.start, timing.painted + 300, `${label}_`));
      out[`${label}_jsRequests`] = perf.resources.filter((r) => r.start >= timing.start && r.name.endsWith('.js')).length;
      await page.waitForTimeout(700);
    }
    return out;
  } finally {
    await session.context.close();
  }
}

// Opens the widget through the "More widgets" launchpad dialog.
async function openFromLaunchpad(env, name, countTest) {
  const session = await openPage(env, { probe: { watch: [toolbarWatch] } });
  const { page } = session;
  try {
    await page.goto(`${env.baseUrl}/`, { waitUntil: 'commit' });
    await waitForMark(page, 'toolbar');
    await page.waitForTimeout(env.settleMs);
    const dialog = await page.evaluate((selector) => window.__perf.clickAndWait(selector, 'launchpad',
      () => [...document.querySelectorAll('[role="dialog"] button')].some((b) => /Timer/.test(b.textContent))), TOOLBAR);
    await page.waitForTimeout(300);
    const open = await page.evaluate(({ widget, test }) => {
      // eslint-disable-next-line no-new-func
      const counter = new Function(`return (${test})`)();
      const tile = () => [...document.querySelectorAll('[role="dialog"] button')]
        .find((b) => b.textContent.trim() === widget || b.querySelector('span')?.textContent.trim() === widget);
      return window.__perf.clickAndWait(tile, 'launchpadOpen', () => counter() >= 1);
    }, { widget: name, test: countTest.toString() });
    return { launchpadMs: dialog.painted - dialog.start, openMs: open.painted - open.start };
  } finally {
    await session.context.close();
  }
}

// ---------------------------------------------------------------- in use

async function frameStats(page, cdp, ms, action) {
  const before = await cdpMetrics(cdp);
  const record = page.evaluate((duration) => window.__perf.recordFrames(duration), ms);
  if (action) await action();
  const frames = await record;
  const after = await cdpMetrics(cdp);
  const perf = await readPerf(page);
  const intervals = frames.stamps.slice(1).map((stamp, index) => stamp - frames.stamps[index]).sort((a, b) => a - b);
  const pick = (q) => intervals[Math.min(intervals.length - 1, Math.floor(q * intervals.length))] ?? null;
  const seconds = (frames.end - frames.start) / 1000;
  return {
    frames: intervals.length,
    fps: intervals.length / seconds,
    frameP50Ms: pick(0.5),
    frameP95Ms: pick(0.95),
    frameMaxMs: intervals[intervals.length - 1] ?? null,
    jankyFrames: intervals.filter((interval) => interval > 25).length,
    ...longTaskStats(perf.longTasks, frames.start, frames.end),
    ...Object.fromEntries(Object.entries(delta(after, before)).map(([key, value]) => [`${key}PerSec`, value / seconds])),
  };
}

async function timerRunning(env, surface) {
  const now = Date.now();
  const state = timerState({ seconds: 3600, running: true, now });
  const isPanel = surface === 'panel';
  const snapshot = isPanel ? panelSnapshot(WidgetType.TIMER, state) : null;
  const session = await openPage(env, {
    viewport: isPanel ? { width: 350, height: 415 } : BOARD_VIEWPORT,
    probe: { native: isPanel, snapshot, watch: [{ name: 'timer', test: `() => document.querySelector('[data-testid="timer-face"]')` }] },
    localStorage: isPanel ? {} : { [STORAGE_KEY]: JSON.stringify(timerBoard({ seconds: 3600, running: true, now })) },
  });
  const { page, cdp } = session;
  try {
    const url = isPanel
      ? panelUrl(env, snapshot)
      : `${env.baseUrl}/`;
    await page.goto(url, { waitUntil: 'commit' });
    await waitForMark(page, 'timer');
    await page.waitForTimeout(env.settleMs + 1000);
    return await frameStats(page, cdp, env.windowMs);
  } finally {
    await session.context.close();
  }
}

async function randomiserSpin(env, count, surface = 'board') {
  const isPanel = surface === 'panel';
  const snapshot = isPanel ? panelSnapshot(WidgetType.RANDOMISER, randomiserState(count)) : null;
  const session = await openPage(env, {
    viewport: isPanel ? { width: 350, height: 250 } : BOARD_VIEWPORT,
    probe: { native: isPanel, snapshot, watch: [{ name: 'ready', test: `() => document.querySelector('.backdrop-blur-sm')` }] },
    localStorage: isPanel ? {} : { [STORAGE_KEY]: JSON.stringify(randomiserBoard(count)) },
  });
  const { page, cdp } = session;
  try {
    const url = isPanel
      ? panelUrl(env, snapshot)
      : `${env.baseUrl}/`;
    await page.goto(url, { waitUntil: 'commit' });
    await waitForMark(page, 'ready');
    await page.waitForTimeout(env.settleMs);
    // Event Timing: how long the Randomise click took to produce a frame.
    await page.evaluate(() => {
      window.__perf.events = [];
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) window.__perf.events.push([entry.name, entry.duration, entry.processingEnd - entry.processingStart]);
      }).observe({ type: 'event', durationThreshold: 16, buffered: false });
    });
    const stats = await frameStats(page, cdp, 4200, () => page.evaluate(() => {
      const button = [...document.querySelectorAll('button')].find((b) => /Randomise!!/.test(b.textContent));
      button.click();
    }));
    const events = await page.evaluate(() => window.__perf.events);
    const click = events.filter(([name]) => name === 'click');
    return { ...stats, clickEventMs: click.length ? Math.max(...click.map(([, duration]) => duration)) : 0 };
  } finally {
    await session.context.close();
  }
}

// Opens the Randomiser settings with a long list, types into it and
// scrolls it. Event Timing gives each keystroke's input-to-paint duration.
async function randomiserEdit(env, count) {
  const session = await openPage(env, {
    probe: { watch: [{ name: 'ready', test: `() => document.querySelector('.backdrop-blur-sm')` }] },
    localStorage: { [STORAGE_KEY]: JSON.stringify(randomiserBoard(count)) },
  });
  const { page, cdp } = session;
  try {
    await page.goto(`${env.baseUrl}/`, { waitUntil: 'commit' });
    await waitForMark(page, 'ready');
    await page.waitForTimeout(env.settleMs);
    const open = await page.evaluate(() => window.__perf.clickAndWait('button[title="Settings"]', 'settings',
      () => document.querySelector('textarea#textarea')));
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      window.__perf.events = [];
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) window.__perf.events.push([entry.name, entry.duration, entry.processingEnd - entry.processingStart, entry.startTime]);
      }).observe({ type: 'event', durationThreshold: 16, buffered: false });
      const textarea = document.querySelector('textarea#textarea');
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    });
    const before = await cdpMetrics(cdp);
    const typed = 'Zara Lim';
    for (const character of `\n${typed}`) {
      await page.keyboard.press(character === '\n' ? 'Enter' : character);
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(500);
    const after = await cdpMetrics(cdp);
    const events = await page.evaluate(() => window.__perf.events);
    const keyDurations = events.filter(([name]) => name === 'keydown' || name === 'keypress' || name === 'input')
      .map(([, duration]) => duration).sort((a, b) => a - b);
    const box = await page.locator('textarea#textarea').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    const scroll = await frameStats(page, cdp, 1500, async () => {
      for (let i = 0; i < 10; i++) {
        await page.mouse.wheel(0, 240);
        await page.waitForTimeout(100);
      }
    });
    const keystrokes = typed.length + 1;
    return {
      openSettingsMs: open.painted - open.start,
      keyEventsOver16ms: keyDurations.length,
      keyMaxMs: keyDurations[keyDurations.length - 1] ?? 0,
      keyP50Ms: keyDurations[Math.floor(keyDurations.length / 2)] ?? 0,
      typingTaskMsPerKey: (after.taskMs - before.taskMs) / keystrokes,
      typingScriptMsPerKey: (after.scriptMs - before.scriptMs) / keystrokes,
      scrollFrameP95Ms: scroll.frameP95Ms,
      scrollJankyFrames: scroll.jankyFrames,
      scrollTaskMsPerSec: scroll.taskMsPerSec,
    };
  } finally {
    await session.context.close();
  }
}

export const SCENARIOS = {
  'board-empty': boardEmpty,
  'board-restored': boardRestored,
  'board-history': boardHistory,
  launcher,
  'desktop-host': (env) => desktopHost(env, null),
  'desktop-host-restored': (env) => desktopHost(env, restoredBoard()),
  'panel-timer': panelTimer,
  'panel-randomiser': panelRandomiser,
  'open-timer': (env) => openFromToolbar(env, 'Timer', timerFaces),
  'open-randomiser': (env) => openFromToolbar(env, 'Randomiser', randomiseButtons),
  'launchpad-timer': (env) => openFromLaunchpad(env, 'Timer', timerFaces),
  'timer-running': (env) => timerRunning(env, 'board'),
  'panel-timer-running': (env) => timerRunning(env, 'panel'),
  'randomiser-spin': (env) => randomiserSpin(env, 30),
  'randomiser-spin-200': (env) => randomiserSpin(env, 200),
  'panel-randomiser-spin': (env) => randomiserSpin(env, 30, 'panel'),
  'randomiser-edit-200': (env) => randomiserEdit(env, 200),
};

export const HEADLINE = ['board-empty', 'board-restored', 'launcher', 'panel-timer', 'panel-randomiser', 'open-timer', 'open-randomiser'];
export const IN_USE = ['timer-running', 'panel-timer-running', 'randomiser-spin', 'randomiser-spin-200', 'randomiser-edit-200'];
