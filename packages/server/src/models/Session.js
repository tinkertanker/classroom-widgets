const crypto = require('crypto');
const { TIME } = require('../config/constants');
const PollRoom = require('./PollRoom');
const LinkShareRoom = require('./LinkShareRoom');
const RTFeedbackRoom = require('./RTFeedbackRoom');
const QuestionsRoom = require('./QuestionsRoom');
const HandoutRoom = require('./HandoutRoom');
const ActivityRoom = require('./ActivityRoom');

/**
 * Session class to manage multiple room types under one code
 */
class Session {
  constructor(code) {
    this.code = code;
    this.hostSocketId = null;
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
    this.hostDisconnectedAt = null; // Timestamp when host disconnected
    this.previousHostToken = null; // Last token, until the host shows it got the new one
    this.previousHostTokenExpiresAt = null; // null while held: see holdPreviousHostToken
    this.hostToken = this.rotateHostToken(); // Secret token for host reclaim
    this.activeRooms = new Map(); // roomType -> room instance
    this.participants = new Map(); // socketId -> { name, studentId, joinedAt }
  }

  /**
   * Check if the host is currently disconnected
   */
  isHostDisconnected() {
    return this.hostDisconnectedAt !== null;
  }

  /**
   * Check if a teacher socket currently holds this session
   */
  hasConnectedHost() {
    return Boolean(this.hostSocketId) && !this.isHostDisconnected();
  }

  /**
   * Update the last activity timestamp
   */
  updateActivity() {
    this.lastActivity = Date.now();
  }

  /**
   * Issue a fresh host token, replacing the current one and any previous one.
   */
  rotateHostToken() {
    this.retirePreviousHostToken();
    this.hostToken = crypto.randomBytes(24).toString('base64url');
    return this.hostToken;
  }

  /**
   * Constant-time comparison of a presented token with a stored one.
   */
  static _tokenMatches(candidate, expected) {
    if (typeof candidate !== 'string' || typeof expected !== 'string') {
      return false;
    }
    const a = Buffer.from(candidate);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  _previousHostTokenLive() {
    return this.previousHostToken !== null
      && (this.previousHostTokenExpiresAt === null || Date.now() < this.previousHostTokenExpiresAt);
  }

  /**
   * Check whether a presented token allows reclaiming the host role: the
   * current token, or the previous one while delivery of the current one is
   * unconfirmed. Never leaks either token.
   */
  isValidHostToken(token) {
    // Evaluate both so timing does not reveal which one matched
    const current = Session._tokenMatches(token, this.hostToken);
    const previous = Session._tokenMatches(token, this.previousHostToken);
    return current || (previous && this._previousHostTokenLive());
  }

  /**
   * Reclaim the host role with a presented token.
   *
   * A reclaim rotates the token, and the new one reaches the host only in the
   * acknowledgement, which can be lost or ignored (a Wi-Fi flap mid-reclaim).
   * So the presented token stays valid as the previous one until delivery of
   * the new one is confirmed (confirmHostTokenDelivery), for at most
   * PREVIOUS_HOST_TOKEN_MAX_AGE while the reclaiming socket stays connected.
   * At most one stale token is ever accepted.
   *
   * @returns {boolean} Whether the token was accepted
   */
  reclaimHost(token) {
    const current = Session._tokenMatches(token, this.hostToken);
    const previous = Session._tokenMatches(token, this.previousHostToken) && this._previousHostTokenLive();
    if (current) {
      this.previousHostToken = this.hostToken;
      this.hostToken = crypto.randomBytes(24).toString('base64url');
    } else if (!previous) {
      return false;
    }
    // Either way the reclaiming socket has yet to confirm the current token;
    // with the previous one the host is handed the current token it missed.
    this.previousHostTokenExpiresAt = Date.now() + TIME.PREVIOUS_HOST_TOKEN_MAX_AGE;
    return true;
  }

  /**
   * The host has received the current token: the previous one stops working.
   */
  retirePreviousHostToken() {
    this.previousHostToken = null;
    this.previousHostTokenExpiresAt = null;
  }

  /**
   * The reclaiming socket dropped before delivery of the current token was
   * confirmed, so the previous token may be the only one the host holds: keep
   * it valid (no expiry) until the next reclaim.
   */
  holdPreviousHostToken() {
    if (this._previousHostTokenLive()) {
      this.previousHostTokenExpiresAt = null;
    } else {
      this.retirePreviousHostToken();
    }
  }

  /**
   * Check if a socket is the host
   */
  isHost(socketId) {
    const isHost = this.hostSocketId === socketId;
    // A host event from the reclaiming socket shows it holds the current token
    if (isHost && this.previousHostToken !== null) {
      this.retirePreviousHostToken();
    }
    return isHost;
  }

  /**
   * Build the internal room key from a room type and optional widget ID
   */
  _roomKey(roomType, widgetId) {
    return widgetId ? `${roomType}:${widgetId}` : roomType;
  }

  /**
   * Add a participant to the session
   */
  addParticipant(socketId, name, studentId) {
    this.participants.set(socketId, {
      name,
      studentId: studentId || socketId,
      joinedAt: Date.now(),
      socketId
    });
    this.updateActivity();
  }

  /**
   * Remove a participant from the session
   */
  removeParticipant(socketId) {
    const removed = this.participants.delete(socketId);
    
    // Also remove from all active rooms
    this.activeRooms.forEach(room => {
      if (room.participants && room.participants.has) {
        room.removeParticipant(socketId);
      }
    });
    
    this.updateActivity();
    return removed;
  }

  /**
   * Get a participant by socket ID
   */
  getParticipant(socketId) {
    return this.participants.get(socketId);
  }

  /**
   * Create a new room within the session
   */
  createRoom(roomType, widgetId) {
    // Create room identifier
    const roomId = this._roomKey(roomType, widgetId);
    
    // Check if room already exists
    if (this.activeRooms.has(roomId)) {
      throw new Error('Room already exists');
    }
    
    let room;
    switch (roomType) {
      case 'poll':
        room = new PollRoom(this.code, widgetId);
        break;
      case 'linkShare':
        room = new LinkShareRoom(this.code, widgetId);
        break;
      case 'rtfeedback':
        room = new RTFeedbackRoom(this.code, widgetId);
        break;
      case 'questions':
        room = new QuestionsRoom(this.code, widgetId);
        break;
      case 'handout':
        room = new HandoutRoom(this.code, widgetId);
        break;
      case 'activity':
        room = new ActivityRoom(this.code, widgetId);
        break;
      default:
        throw new Error(`Unknown room type: ${roomType}`);
    }
    
    room.hostSocketId = this.hostSocketId;
    this.activeRooms.set(roomId, room);
    this.updateActivity();
    return room;
  }

  /**
   * Get a room by type and optional widget ID
   */
  getRoom(roomType, widgetId) {
    const roomId = this._roomKey(roomType, widgetId);
    return this.activeRooms.get(roomId);
  }

  /**
   * Close a room
   */
  closeRoom(roomType, widgetId) {
    const roomId = this._roomKey(roomType, widgetId);
    const deleted = this.activeRooms.delete(roomId);
    if (deleted) {
      this.updateActivity();
    }
    return deleted;
  }

  /**
   * Get participant count
   */
  getParticipantCount() {
    return this.participants.size;
  }

  /**
   * Get all participants
   */
  getParticipants() {
    return Array.from(this.participants.values());
  }

  /**
   * Get active room entries as { roomType, widgetId, room } without serializing
   */
  getActiveRoomEntries() {
    const entries = [];
    this.activeRooms.forEach((room, roomId) => {
      // Split on the first ':' only - widget IDs may themselves contain ':'
      const separatorIndex = roomId.indexOf(':');
      const roomType = separatorIndex === -1 ? roomId : roomId.slice(0, separatorIndex);
      const widgetId = separatorIndex === -1 ? undefined : roomId.slice(separatorIndex + 1);
      entries.push({ roomType, widgetId, room });
    });
    return entries;
  }

  /**
   * Get all active rooms
   */
  getActiveRooms() {
    return this.getActiveRoomEntries().map(({ roomType, widgetId, room }) => ({
      roomType,
      widgetId,
      room: room.toJSON()
    }));
  }

  /**
   * Check if the session is inactive. A session held by a connected teacher
   * never is: its rooms live until the teacher closes them (or they go idle),
   * and a disconnected teacher is handled by the reconnect grace period.
   */
  isInactive(inactivityTimeout = 2 * 60 * 60 * 1000) {
    return Date.now() - this.lastActivity > inactivityTimeout
      && this.getParticipantCount() === 0
      && !this.hasConnectedHost();
  }

  /**
   * Rooms with no host or student activity for longer than `idleTimeout`
   */
  getIdleRoomEntries(idleTimeout) {
    return this.getActiveRoomEntries().filter(({ room }) => room.isInactive(idleTimeout));
  }

  /**
   * Convert session to JSON representation
   */
  toJSON() {
    return {
      code: this.code,
      createdAt: this.createdAt,
      lastActivity: this.lastActivity,
      participantCount: this.getParticipantCount(),
      activeRooms: this.getActiveRooms(),
      hasHost: !!this.hostSocketId
    };
  }
}

module.exports = Session;