/**
 * What is happening right now, read from the server's in-memory state for the
 * admin dashboard. Nothing here is stored.
 *
 * A teacher is "online" while a socket that reported app_open (see
 * usageHandler) is connected; several tabs on one device count once.
 */
function getLiveStats(io, sessionManager, { history, usageLog } = {}) {
  const teacherDevices = new Set();
  let teacherApps = 0;
  if (io) {
    for (const socket of io.sockets.sockets.values()) {
      if (socket.data.usageClientId) {
        teacherApps++;
        teacherDevices.add(socket.data.usageClientId);
      }
    }
  }

  let activeSessions = 0;
  let studentsConnected = 0;
  const rooms = new Map();
  for (const session of sessionManager.sessions.values()) {
    if (session.hasConnectedHost()) activeSessions++;
    studentsConnected += session.getParticipantCount();
    for (const { roomType } of session.getActiveRoomEntries()) {
      rooms.set(roomType, (rooms.get(roomType) || 0) + 1);
    }
  }

  const stats = {
    at: Date.now(),
    teachersOnline: teacherDevices.size,
    teacherApps,
    activeSessions,
    // Sessions kept open while their teacher reconnects (reload, Wi-Fi drop).
    waitingSessions: sessionManager.sessions.size - activeSessions,
    studentsConnected,
    rooms: Array.from(rooms, ([roomType, count]) => ({ roomType, count }))
      .sort((a, b) => b.count - a.count || a.roomType.localeCompare(b.roomType)),
    uptimeSeconds: Math.round(process.uptime())
  };
  if (history) {
    history.sample(stats);
    stats.lastHour = history.points();
  }
  if (usageLog) stats.recent = usageLog.recent();
  return stats;
}

const MINUTE_MS = 60_000;

/**
 * Per-minute samples of the live figures for the last hour, in memory, so
 * the dashboard can show a short trend. Each minute keeps the most seen at
 * once during it, so a short visit still shows. Lost on restart, which is
 * fine for a "right now" view.
 */
class LiveHistory {
  constructor({ minutes = 60, now = Date.now } = {}) {
    this.minutes = minutes;
    this.now = now;
    this.samples = [];
  }

  sample({ teachersOnline, studentsConnected }) {
    const t = Math.floor(this.now() / MINUTE_MS) * MINUTE_MS;
    const current = this.samples.at(-1);
    if (current?.t === t) {
      current.teachersOnline = Math.max(current.teachersOnline, teachersOnline);
      current.studentsConnected = Math.max(current.studentsConnected, studentsConnected);
    } else {
      this.samples.push({ t, teachersOnline, studentsConnected });
    }
    this.drop();
  }

  points() {
    this.drop();
    return this.samples.slice();
  }

  drop() {
    const oldest = Math.floor(this.now() / MINUTE_MS) * MINUTE_MS - (this.minutes - 1) * MINUTE_MS;
    while (this.samples.length && this.samples[0].t < oldest) this.samples.shift();
  }
}

module.exports = { getLiveStats, LiveHistory };
