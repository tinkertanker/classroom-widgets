const Session = require('../models/Session');
const { generateSessionCode } = require('../utils/codeGenerator');
const { TIME, LIMITS } = require('../config/constants');

/**
 * Manages sessions and rooms
 */
class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.cleanupIntervalHandle = null;
    // Closes an idle room and tells its clients; the socket layer installs one
    // with setRoomExpiryHandler. Without it the room is closed silently.
    this.roomExpiryHandler = (session, roomType, widgetId) => session.closeRoom(roomType, widgetId);

    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Create a new session
   */
  createSession(existingCode = null) {
    if (existingCode && this.sessions.has(existingCode)) {
      return this.sessions.get(existingCode);
    }

    if (this.sessions.size >= LIMITS.MAX_SESSIONS) {
      throw new Error('Server is at capacity. Please try again later.');
    }

    const code = generateSessionCode(this.sessions);
    const session = new Session(code);
    this.sessions.set(code, session);
    return session;
  }

  /**
   * Get a session by code
   */
  getSession(code) {
    return this.sessions.get(code);
  }

  /**
   * Delete a session
   */
  deleteSession(code) {
    return this.sessions.delete(code);
  }

  /**
   * Find session by host socket ID
   */
  findSessionByHost(socketId) {
    for (const [code, session] of this.sessions) {
      if (session.hostSocketId === socketId) {
        return session;
      }
    }
    return null;
  }

  /**
   * Clean up inactive sessions
   */
  cleanupInactiveSessions() {
    let cleanedCount = 0;

    // Clean up sessions
    for (const [code, session] of this.sessions) {
      if (session.isInactive(TIME.INACTIVITY_TIMEOUT)) {
        console.log(`Cleaning up inactive session: ${code}`);
        this.sessions.delete(code);
        cleanedCount++;
      }
    }


    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} inactive sessions/rooms`);
    }
  }

  /**
   * Set how an idle room is closed: (session, roomType, widgetId) => void
   */
  setRoomExpiryHandler(handler) {
    this.roomExpiryHandler = handler;
  }

  /**
   * Close rooms that have had no host or student activity for ROOM_IDLE_TIMEOUT
   */
  closeIdleRooms() {
    // This runs on a timer, outside the socket error guards: an exception here
    // would reach the uncaughtException handler and exit the process. Each
    // close is isolated so one bad room cannot stop the rest of the sweep; it
    // is retried on the next sweep.
    for (const session of Array.from(this.sessions.values())) {
      let idleRooms = [];
      try {
        idleRooms = session.getIdleRoomEntries(TIME.ROOM_IDLE_TIMEOUT);
      } catch (error) {
        console.error(`Failed to check idle rooms in session ${session.code}:`, error);
      }
      for (const { roomType, widgetId } of idleRooms) {
        try {
          console.log(`Closing idle room ${roomType}:${widgetId} in session ${session.code}`);
          this.roomExpiryHandler(session, roomType, widgetId);
        } catch (error) {
          console.error(`Failed to close idle room ${roomType}:${widgetId} in session ${session.code}:`, error);
        }
      }
    }
  }

  /**
   * Start periodic cleanup of inactive sessions and idle rooms
   */
  startCleanupInterval() {
    if (this.cleanupIntervalHandle) return;
    this.cleanupIntervalHandle = setInterval(() => {
      try {
        this.cleanupInactiveSessions();
      } catch (error) {
        console.error('Inactive session cleanup failed:', error);
      }
      this.closeIdleRooms();
    }, TIME.CLEANUP_INTERVAL);
    // Don't keep the event loop alive just for the cleanup timer.
    if (this.cleanupIntervalHandle.unref) this.cleanupIntervalHandle.unref();
  }

  /**
   * Stop periodic cleanup - call on graceful shutdown.
   */
  stopCleanupInterval() {
    if (this.cleanupIntervalHandle) {
      clearInterval(this.cleanupIntervalHandle);
      this.cleanupIntervalHandle = null;
    }
  }

  /**
   * Get stats about current sessions
   */
  getStats() {
    let totalParticipants = 0;
    let totalRooms = 0;

    for (const session of this.sessions.values()) {
      totalParticipants += session.getParticipantCount();
      totalRooms += session.activeRooms.size;
    }

    return {
      activeSessions: this.sessions.size,
      totalParticipants,
      totalRooms
    };
  }

}

module.exports = SessionManager;
