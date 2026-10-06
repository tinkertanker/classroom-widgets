/**
 * What is happening right now, read from the server's in-memory state for the
 * admin dashboard. Nothing here is stored.
 *
 * A teacher is "online" while a socket that reported app_open (see
 * usageHandler) is connected; several tabs on one device count once.
 */
function getLiveStats(io, sessionManager) {
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

  return {
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
}

module.exports = { getLiveStats };
