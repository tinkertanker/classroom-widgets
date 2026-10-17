// Saved data the benchmarks restore: a teacher's workspace in the app's V2
// localStorage format (packages/shared/types/storage.ts) and the snapshots a
// desktop shell pushes into a widget panel (CompactWidgetSnapshot). Times are
// fixed so every run restores the same thing.
export const STORAGE_KEY = 'classroom-widgets-storage-v2';
export const SEEN_LANDING_KEY = 'classroom-widgets:seen-landing';

const WidgetType = { RANDOMISER: 0, TIMER: 1, LIST: 2, TASK_CUE: 3, TRAFFIC_LIGHT: 4, TEXT_BANNER: 7, LINK_SHARE: 13, QUESTIONS: 17 };
const T0 = 1760000000000;

export function classNames(count) {
  const first = ['Aisha', 'Ben', 'Chloe', 'Dev', 'Ethan', 'Farah', 'Gabriel', 'Hui Min', 'Isaac', 'Jia Hui',
    'Kai', 'Lina', 'Marcus', 'Nur', 'Oliver', 'Priya', 'Qi Wei', 'Rahul', 'Sofia', 'Tan Wei'];
  const last = ['Tan', 'Lim', 'Lee', 'Ng', 'Wong', 'Kumar', 'Rahman', 'Ong', 'Chua', 'Goh'];
  return Array.from({ length: count }, (_, index) =>
    `${first[index % first.length]} ${last[Math.floor(index / first.length) % last.length]}${index >= 200 ? ` ${index}` : ''}`);
}

export const randomiserState = (count) => {
  const choices = classNames(count);
  return { input: choices.join('\n'), choices, removedChoices: [] };
};

// running: the timer has `seconds` left from page load; otherwise paused there.
export const timerState = ({ seconds = 300, running = false, now = Date.now() } = {}) => ({
  timer: {
    endTime: running ? now + seconds * 1000 : null,
    initialTime: seconds,
    originalTime: seconds,
    isRunning: running,
    isPaused: !running,
    pausedTimeRemaining: seconds,
    timerFinished: false,
  },
  soundMode: 'short',
  muted: true,
  segmentValues: ['00', String(Math.floor(seconds / 60)).padStart(2, '0'), String(seconds % 60).padStart(2, '0')],
});

const listState = (count) => {
  const items = Array.from({ length: count }, (_, index) => ({ id: `item-${index}`, text: `Task ${index + 1}: ${classNames(1)[0]} checks question ${index + 1}`, status: index % 3 }));
  return { items, inputs: items.map((item) => item.text), statuses: items.map((item) => item.status) };
};

// widgets: [{ type, state, position, size }]
export function workspaceStorage(widgets, { theme = 'light', randomiserLists = 0 } = {}) {
  const workspaceId = 'workspace-perf';
  const stored = widgets.map((widget, index) => ({
    id: `${T0 + index}-perf${index}`,
    type: widget.type,
    position: widget.position ?? { x: 40 + (index % 3) * 420, y: 40 + Math.floor(index / 3) * 460 },
    size: widget.size,
    zIndex: index + 1,
  }));
  const savedLists = Object.fromEntries(Array.from({ length: randomiserLists }, (_, index) => [`list-${index}`, {
    id: `list-${index}`, type: 'randomiser', name: `Class ${index + 1}`, choices: classNames(30), createdAt: T0, updatedAt: T0 + index,
  }]));
  return {
    version: 2,
    currentWorkspaceId: workspaceId,
    workspaces: {
      [workspaceId]: {
        id: workspaceId,
        name: 'My Workspace',
        createdAt: T0,
        updatedAt: T0,
        widgets: stored,
        background: 'lowpoly',
        scale: 1,
        scrollPosition: { x: 0, y: 0 },
        widgetStates: widgets.flatMap((widget, index) => (widget.state ? [[stored[index].id, widget.state]] : [])),
        layoutFormat: 'canvas',
      },
    },
    globalSettings: {
      theme,
      linkShortener: { provider: 'tinyurl', shortioApiKey: '', shortioDomain: '' },
      bottomBar: {
        visibleWidgets: [0, 1, 2, 3, 4, 11],
        pinnedWidgets: [],
        showClock: true,
        showConnectionStatus: true,
        voiceControlEnabled: false,
        recentWidgets: [0, 1, 2, 3, 4],
        recentWidgetsLimit: 5,
      },
    },
    session: { code: null, createdAt: null },
    savedCollections: { randomiserLists: savedLists, questionBanks: {}, pollQuestions: {} },
  };
}

// A teacher's usual board: Timer and Randomiser plus four other offline widgets.
export const restoredBoard = () => workspaceStorage([
  { type: WidgetType.TIMER, size: { width: 350, height: 415 }, state: timerState({ seconds: 300 }) },
  { type: WidgetType.RANDOMISER, size: { width: 350, height: 250 }, state: randomiserState(30) },
  { type: WidgetType.LIST, size: { width: 350, height: 400 }, state: listState(8) },
  { type: WidgetType.TASK_CUE, size: { width: 350, height: 300 } },
  { type: WidgetType.TRAFFIC_LIGHT, size: { width: 200, height: 380 } },
  { type: WidgetType.TEXT_BANNER, size: { width: 500, height: 200 } },
]);

// A board mid-lesson: Questions and Drop Box in a live session. The rooms on
// the server use these widgets' ids (HISTORY_ROOMS).
export const HISTORY_ROOMS = { questionsRoom: `${T0}-perf0`, dropBox: `${T0 + 1}-perf1` };
export function historyBoard({ code, createdAt }) {
  const storage = workspaceStorage([
    { type: WidgetType.QUESTIONS, size: { width: 420, height: 600 }, position: { x: 40, y: 40 } },
    { type: WidgetType.LINK_SHARE, size: { width: 420, height: 600 }, position: { x: 500, y: 40 } },
  ]);
  return { ...storage, session: { code, createdAt } };
}

export const timerBoard = (options) => workspaceStorage([
  { type: WidgetType.TIMER, size: { width: 350, height: 415 }, state: timerState(options) },
]);

export const randomiserBoard = (count) => workspaceStorage([
  { type: WidgetType.RANDOMISER, size: { width: 350, height: 250 }, state: randomiserState(count) },
]);

const PANEL_DEFAULTS = {
  [WidgetType.TIMER]: { title: 'Timer', preferredSize: { width: 350, height: 415 }, minimumSize: { width: 250, height: 306 }, maintainsAspectRatio: true },
  [WidgetType.RANDOMISER]: { title: 'Randomiser', preferredSize: { width: 350, height: 300 }, minimumSize: { width: 250, height: 260 }, maintainsAspectRatio: false },
};

export function panelSnapshot(type, state, widgetId = `${T0}-panel`) {
  const defaults = PANEL_DEFAULTS[type];
  return {
    schemaVersion: 1,
    workspaceId: 'workspace-perf',
    revision: 1,
    stateRevision: 1,
    widgetId,
    widgetType: type,
    title: defaults.title,
    preferredSize: defaults.preferredSize,
    minimumSize: defaults.minimumSize,
    maximumSize: null,
    isResizable: true,
    maintainsAspectRatio: defaults.maintainsAspectRatio,
    hidden: false,
    keepAliveWhenHidden: type === WidgetType.TIMER,
    state,
    theme: 'light',
    savedRandomiserLists: [],
  };
}

export { WidgetType };
