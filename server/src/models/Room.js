/**
 * Base Room class that all room types extend from
 */
class Room {
  constructor(code, widgetId = null) {
    this.code = code;
    this.widgetId = widgetId;
    this.hostSocketId = null;
    this.participants = new Map();
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
    this.isActive = false;
  }

  /**
   * Update the last activity timestamp
   */
  updateActivity() {
    this.lastActivity = Date.now();
  }

  /**
   * Add a participant to the room
   */
  addParticipant(socketId, participantData) {
    this.participants.set(socketId, {
      id: socketId,
      ...participantData,
      joinedAt: Date.now()
    });
    this.updateActivity();
  }

  /**
   * Remove a participant from the room
   */
  removeParticipant(socketId) {
    const removed = this.participants.delete(socketId);
    if (removed) {
      this.updateActivity();
    }
    return removed;
  }

  /**
   * Get the count of participants
   */
  getParticipantCount() {
    return this.participants.size;
  }

  /**
   * Check if the room is expired based on age
   */
  isExpired(maxAge = 12 * 60 * 60 * 1000) {
    return Date.now() - this.createdAt > maxAge;
  }

  /**
   * Check if the room is inactive
   */
  isInactive(inactivityTimeout = 2 * 60 * 60 * 1000) {
    return Date.now() - this.lastActivity > inactivityTimeout;
  }

  /**
   * Get the room namespace for socket.io
   */
  getNamespace() {
    const roomId = this.widgetId ? `${this.getType()}:${this.widgetId}` : this.getType();
    return `${this.code}:${roomId}`;
  }

  /**
   * Get the room type - must be implemented by subclasses
   */
  getType() {
    throw new Error('getType() must be implemented by subclass');
  }

  /**
   * Convert room to JSON representation
   */
  toJSON() {
    return {
      code: this.code,
      widgetId: this.widgetId,
      type: this.getType(),
      isActive: this.isActive,
      participantCount: this.getParticipantCount(),
      createdAt: this.createdAt,
      lastActivity: this.lastActivity
    };
  }
}

module.exports = Room;