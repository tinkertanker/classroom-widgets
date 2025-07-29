const Session = require('../models/Session');
const { generateSessionCode, generateRoomCode } = require('../utils/codeGenerator');
const { TIME, LIMITS } = require('../config/constants');

/**
 * Manages sessions and rooms
 */
class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.rooms = new Map(); // Legacy room support
    
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
    const now = Date.now();
    let cleanedCount = 0;

    // Clean up sessions
    for (const [code, session] of this.sessions) {
      if (now - session.lastActivity > TIME.SESSION_IDLE_TIMEOUT) {
        console.log(`Cleaning up inactive session: ${code}`);
        this.sessions.delete(code);
        cleanedCount++;
      }
    }

    // Clean up legacy rooms
    for (const [code, room] of this.rooms) {
      if (now - room.lastActivity > TIME.ROOM_IDLE_TIMEOUT) {
        console.log(`Cleaning up inactive legacy room: ${code}`);
        this.rooms.delete(code);
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
    setInterval(() => {
      this.cleanupInactiveSessions();
    }, TIME.CLEANUP_INTERVAL);
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
      legacyRooms: this.rooms.size,
      totalParticipants,
      totalRooms
    };
  }

  /**
   * Check if room code is available
   */
  isRoomCodeAvailable(code) {
    return !this.rooms.has(code) && !this.sessions.has(code);
  }

  /**
   * Create a legacy room (for backward compatibility)
   */
  createLegacyRoom(type, hostSocketId) {
    const code = generateRoomCode(this.sessions, this.rooms);
    let room;

    switch (type) {
      case 'poll':
        const PollRoom = require('../models/PollRoom');
        room = new PollRoom(code);
        break;
      case 'linkShare':
        const LinkShareRoom = require('../models/LinkShareRoom');
        room = new LinkShareRoom(code);
        break;
      case 'rtfeedback':
        const RTFeedbackRoom = require('../models/RTFeedbackRoom');
        room = new RTFeedbackRoom(code);
        break;
      case 'questions':
        const QuestionsRoom = require('../models/QuestionsRoom');
        room = new QuestionsRoom(code);
        break;
      default:
        throw new Error(`Unknown room type: ${type}`);
    }

    room.hostSocketId = hostSocketId;
    this.rooms.set(code, room);
    return room;
  }
}

module.exports = SessionManager;