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
    // Start rooms as paused/inactive by default
    // This ensures teachers have time to configure the widget before students can interact
    // and maintains consistency between server state and client UI expectations
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
   * Get the room type - must be implemented by subclasses
   */
  getType() {
    throw new Error('getType() must be implemented by subclass');
  }

  /**
   * Generate a unique id for a list entry (question, submission, handout item, ...)
   */
  _generateId() {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Push an entry onto a capacity-checked list and mark activity.
   * @param {Array} list - The list to append to
   * @param {Object} entry - The fully-built entry to add
   * @param {number} [maxLimit] - Optional cap; when reached, the add is rejected
   * @returns {Object|null} The added entry, or null if the list is at capacity
   */
  _addToList(list, entry, maxLimit) {
    if (typeof maxLimit === 'number' && list.length >= maxLimit) {
      return null;
    }
    list.push(entry);
    this.updateActivity();
    return entry;
  }

  /**
   * Remove an entry with the given id from a list and mark activity.
   * @param {Array} list - The list to remove from
   * @param {string} id - The id of the entry to remove
   * @returns {boolean} Whether an entry was found and removed
   */
  _removeFromList(list, id) {
    const index = list.findIndex(entry => entry.id === id);
    if (index === -1) {
      return false;
    }
    list.splice(index, 1);
    this.updateActivity();
    return true;
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