const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { logger } = require('../utils/logger');

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_FILE = /^(\d{4}-\d{2}-\d{2})\.jsonl$/;

// Events the teacher app may report. Server-side events (session_start,
// student_join) are recorded directly and never accepted from clients.
const CLIENT_EVENTS = new Set(['app_open', 'widget_add']);
const SURFACES = new Set(['web', 'desktop']);
// Random IDs minted by the teacher app; the pattern also keeps them inert in a JSON line.
const ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;
// WidgetType enum keys, e.g. POLL or TRAFFIC_LIGHT.
const WIDGET_PATTERN = /^[A-Z][A-Z0-9_]{0,39}$/;

/**
 * Reduce a client `usage:track` payload to the fields the log stores, or
 * null if it is malformed. Anything else in the payload is discarded.
 */
function normaliseClientEvent(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const { event, clientId, visitId, widget, surface } = payload;
  if (!CLIENT_EVENTS.has(event)) return null;
  if (typeof clientId !== 'string' || !ID_PATTERN.test(clientId)) return null;
  if (typeof visitId !== 'string' || !ID_PATTERN.test(visitId)) return null;

  const normalised = { e: event, c: clientId, v: visitId };
  if (event === 'widget_add') {
    if (typeof widget !== 'string' || !WIDGET_PATTERN.test(widget)) return null;
    normalised.w = widget;
  }
  if (SURFACES.has(surface)) normalised.s = surface;
  return normalised;
}

const shiftDay = (dayKey, days) =>
  new Date(Date.parse(`${dayKey}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

const emptyDay = (date) => ({
  date,
  appOpens: 0,
  widgetAdds: 0,
  sessions: 0,
  studentJoins: 0,
  clients: new Set(),
  visits: new Set(),
  surfaces: { web: new Set(), desktop: new Set() },
  widgets: new Map()
});

function addEvent(day, event) {
  switch (event.e) {
    case 'session_start':
      day.sessions++;
      return;
    case 'student_join':
      day.studentJoins++;
      return;
    case 'app_open':
      day.appOpens++;
      if (SURFACES.has(event.s)) day.surfaces[event.s].add(event.c);
      break;
    case 'widget_add': {
      day.widgetAdds++;
      const widget = day.widgets.get(event.w) || { adds: 0, clients: new Set() };
      widget.adds++;
      widget.clients.add(event.c);
      day.widgets.set(event.w, widget);
      break;
    }
    default:
      return;
  }
  day.clients.add(event.c);
  day.visits.add(event.v);
}

/**
 * Append-only usage log: one JSON line per event in a file per local day.
 *
 * Deliberately small so it runs on a free-tier VM with no database: past
 * days are immutable, so each is read once and its aggregate cached, and
 * only today's file is re-read per summary. Logging is off unless a
 * directory is configured (USAGE_LOG_DIR).
 */
class UsageLog {
  constructor({ dir, timeZone = 'UTC', retentionDays = 400, now = Date.now } = {}) {
    this.dir = dir || null;
    this.enabled = Boolean(this.dir);
    this.retentionDays = Math.max(1, Math.floor(retentionDays) || 400);
    this.now = now;
    try {
      this.dayFormat = new Intl.DateTimeFormat('en-CA', {
        timeZone, year: 'numeric', month: '2-digit', day: '2-digit'
      });
      this.timeZone = timeZone;
    } catch {
      // A typo in an analytics setting must not stop the classroom server.
      logger.warn('usageLog', `Unknown time zone "${timeZone}"; using UTC`);
      this.dayFormat = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit'
      });
      this.timeZone = 'UTC';
    }
    this.writeChain = Promise.resolve();
    this.dirReady = null;
    this.pastDays = new Map();
    this.pruneHandle = null;
  }

  dayKey(timestamp) {
    const parts = Object.fromEntries(this.dayFormat.formatToParts(timestamp).map(p => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  fileFor(dayKey) {
    return path.join(this.dir, `${dayKey}.jsonl`);
  }

  ensureDir() {
    this.dirReady = this.dirReady || fs.promises.mkdir(this.dir, { recursive: true }).catch((error) => {
      this.dirReady = null;
      throw error;
    });
    return this.dirReady;
  }

  /** Queue an event for writing. Never throws; failures are logged. */
  record(event) {
    if (!this.enabled) return;
    const t = this.now();
    const line = `${JSON.stringify({ t, ...event })}\n`;
    const file = this.fileFor(this.dayKey(t));
    this.writeChain = this.writeChain
      .then(() => this.ensureDir())
      .then(() => fs.promises.appendFile(file, line))
      .catch((error) => logger.error('usageLog', 'Failed to write usage event', { message: error.message }));
  }

  flush() {
    return this.writeChain;
  }

  async readDay(dayKey) {
    const day = emptyDay(dayKey);
    let stream;
    try {
      stream = fs.createReadStream(this.fileFor(dayKey), { encoding: 'utf8' });
      for await (const line of readline.createInterface({ input: stream, crlfDelay: Infinity })) {
        let event;
        try {
          event = JSON.parse(line);
        } catch {
          continue; // A line cut short by a crash.
        }
        if (event && typeof event === 'object') addEvent(day, event);
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.error('usageLog', 'Failed to read usage log', { dayKey, message: error.message });
      }
    } finally {
      stream?.destroy();
    }
    return day;
  }

  async getDay(dayKey, today) {
    if (dayKey === today) return this.readDay(dayKey);
    if (!this.pastDays.has(dayKey)) {
      this.pastDays.set(dayKey, await this.readDay(dayKey));
    }
    return this.pastDays.get(dayKey);
  }

  /** Aggregate the last `days` local days, ending today. */
  async summarise({ days } = {}) {
    const requested = Number.parseInt(days, 10);
    const span = Number.isNaN(requested)
      ? this.retentionDays
      : Math.min(this.retentionDays, Math.max(1, requested));
    const today = this.dayKey(this.now());
    const from = shiftDay(today, -(span - 1));
    const base = { enabled: this.enabled, timeZone: this.timeZone, retentionDays: this.retentionDays, from, to: today };
    if (!this.enabled) return base;

    await this.flush();
    const dayKeys = Array.from({ length: span }, (_, i) => shiftDay(from, i));
    const dayData = [];
    for (const key of dayKeys) {
      dayData.push(await this.getDay(key, today));
    }

    const clients = new Set();
    const visits = new Set();
    const surfaces = { web: new Set(), desktop: new Set() };
    const widgets = new Map();
    const totals = { appOpens: 0, widgetAdds: 0, sessions: 0, studentJoins: 0 };

    for (const day of dayData) {
      for (const key of Object.keys(totals)) totals[key] += day[key];
      day.clients.forEach(c => clients.add(c));
      day.visits.forEach(v => visits.add(v));
      day.surfaces.web.forEach(c => surfaces.web.add(c));
      day.surfaces.desktop.forEach(c => surfaces.desktop.add(c));
      day.widgets.forEach(({ adds, clients: widgetClients }, name) => {
        const widget = widgets.get(name) || { adds: 0, clients: new Set() };
        widget.adds += adds;
        widgetClients.forEach(c => widget.clients.add(c));
        widgets.set(name, widget);
      });
    }

    return {
      ...base,
      days: dayData.map(day => ({
        date: day.date,
        appOpens: day.appOpens,
        visits: day.visits.size,
        uniqueClients: day.clients.size,
        widgetAdds: day.widgetAdds,
        sessions: day.sessions,
        studentJoins: day.studentJoins
      })),
      totals: {
        appOpens: totals.appOpens,
        visits: visits.size,
        uniqueClients: clients.size,
        webClients: surfaces.web.size,
        desktopClients: surfaces.desktop.size,
        widgetAdds: totals.widgetAdds,
        sessions: totals.sessions,
        studentJoins: totals.studentJoins
      },
      widgets: Array.from(widgets, ([widget, { adds, clients: widgetClients }]) => ({
        widget, adds, uniqueClients: widgetClients.size
      })).sort((a, b) => b.adds - a.adds || a.widget.localeCompare(b.widget))
    };
  }

  /** Delete day files older than the retention window. */
  async prune() {
    if (!this.enabled) return;
    const oldestKept = shiftDay(this.dayKey(this.now()), -(this.retentionDays - 1));
    for (const key of this.pastDays.keys()) {
      if (key < oldestKept) this.pastDays.delete(key);
    }
    let names;
    try {
      names = await fs.promises.readdir(this.dir);
    } catch (error) {
      if (error.code !== 'ENOENT') logger.error('usageLog', 'Failed to list usage logs', { message: error.message });
      return;
    }
    for (const name of names) {
      const match = DAY_FILE.exec(name);
      if (match && match[1] < oldestKept) {
        await fs.promises.unlink(path.join(this.dir, name)).catch((error) =>
          logger.error('usageLog', 'Failed to delete expired usage log', { name, message: error.message }));
      }
    }
  }

  startPruning() {
    if (!this.enabled || this.pruneHandle) return;
    this.prune();
    this.pruneHandle = setInterval(() => this.prune(), DAY_MS);
    this.pruneHandle.unref?.();
  }

  stopPruning() {
    clearInterval(this.pruneHandle);
    this.pruneHandle = null;
  }
}

// Shared instance configured from the environment, like the logger.
const usageLog = new UsageLog({
  dir: process.env.USAGE_LOG_DIR?.trim(),
  timeZone: process.env.USAGE_TIMEZONE?.trim() || 'UTC',
  retentionDays: Number(process.env.USAGE_RETENTION_DAYS) || 400
});

module.exports = { UsageLog, usageLog, normaliseClientEvent };
