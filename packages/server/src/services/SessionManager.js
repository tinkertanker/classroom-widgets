const Session = require('../models/Session');
const { generateSessionCode, generateRoomCode } = require('../utils/codeGenerator');
const { TIME, LIMITS } = require('../config/constants');

/**
 * Manages sessions and rooms
 */
class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.cleanupIntervalHandle = null;

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

    const code = generateSessionCode(this.sessions, this.rooms);
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
   * Start periodic cleanup of inactive sessions
   */
  startCleanupInterval() {
    if (this.cleanupIntervalHandle) return;
    this.cleanupIntervalHandle = setInterval(() => {
      this.cleanupInactiveSessions();
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

  /**
   * Check if room code is available
   */
  isRoomCodeAvailable(code) {
    return !this.sessions.has(code);
  }

}

module.exports = SessionManager;
