const PollRoom = require('./PollRoom');
const LinkShareRoom = require('./LinkShareRoom');
const RTFeedbackRoom = require('./RTFeedbackRoom');
const QuestionsRoom = require('./QuestionsRoom');

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
   * Update the last activity timestamp
   */
  updateActivity() {
    this.lastActivity = Date.now();
  }

  /**
   * Check if a socket is the host
   */
  isHost(socketId) {
    return this.hostSocketId === socketId;
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
    const roomId = widgetId ? `${roomType}:${widgetId}` : roomType;
    
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
    const roomId = widgetId ? `${roomType}:${widgetId}` : roomType;
    return this.activeRooms.get(roomId);
  }

  /**
   * Close a room
   */
  closeRoom(roomType, widgetId) {
    const roomId = widgetId ? `${roomType}:${widgetId}` : roomType;
    const deleted = this.activeRooms.delete(roomId);
    if (deleted) {
      this.updateActivity();
    }
    return deleted;
  }

  /**
   * Check if session has any active rooms
   */
  hasActiveRooms() {
    return this.activeRooms.size > 0;
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
   * Get active room types/IDs
   */
  getActiveRoomTypes() {
    return Array.from(this.activeRooms.keys());
  }

  /**
   * Get all active rooms
   */
  getActiveRooms() {
    const rooms = [];
    this.activeRooms.forEach((room, roomId) => {
      const [roomType, widgetId] = roomId.includes(':') ? roomId.split(':') : [roomId, undefined];
      rooms.push({
        roomType,
        widgetId,
        room: room.toJSON()
      });
    });
    return rooms;
  }

  /**
   * Check if the session is expired
   */
  isExpired(maxAge = 12 * 60 * 60 * 1000) {
    return Date.now() - this.createdAt > maxAge;
  }

  /**
   * Check if the session is inactive
   */
  isInactive(inactivityTimeout = 2 * 60 * 60 * 1000) {
    return Date.now() - this.lastActivity > inactivityTimeout && this.getParticipantCount() === 0;
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