const { EVENTS } = require('../config/constants');

// Track host disconnect timeouts (sessionCode -> timeoutId)
const hostDisconnectTimeouts = new Map();

// Time to wait before closing session after host disconnects (5 minutes)
const HOST_DISCONNECT_TIMEOUT = 5 * 60 * 1000;

/**
 * Start a timeout to close session if host doesn't reconnect
 */
function startHostDisconnectTimeout(io, sessionManager, sessionCode) {
  // Clear any existing timeout
  clearHostDisconnectTimeout(sessionCode);

  const timeoutId = setTimeout(() => {
    const session = sessionManager.getSession(sessionCode);
    if (session && session.isHostDisconnected()) {
      console.log(`Host reconnect timeout expired for session ${sessionCode}, closing session`);

      // Notify all students that session is closed
      io.to(`session:${sessionCode}`).emit(EVENTS.SESSION.CLOSED);

      // Clean up the session
      sessionManager.deleteSession(sessionCode);
    }
    hostDisconnectTimeouts.delete(sessionCode);
  }, HOST_DISCONNECT_TIMEOUT);

  hostDisconnectTimeouts.set(sessionCode, timeoutId);
  console.log(`Started ${HOST_DISCONNECT_TIMEOUT / 1000}s timeout for session ${sessionCode}`);
}

/**
 * Cancel host disconnect timeout (called when host reconnects)
 */
function clearHostDisconnectTimeout(sessionCode) {
  const timeoutId = hostDisconnectTimeouts.get(sessionCode);
  if (timeoutId) {
    clearTimeout(timeoutId);
    hostDisconnectTimeouts.delete(sessionCode);
    console.log(`Cleared host disconnect timeout for session ${sessionCode}`);
  }
}

module.exports = {
  startHostDisconnectTimeout,
  clearHostDisconnectTimeout
};
