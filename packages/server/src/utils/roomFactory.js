const PollRoom = require('../models/PollRoom');
const LinkShareRoom = require('../models/LinkShareRoom');
const RTFeedbackRoom = require('../models/RTFeedbackRoom');
const QuestionsRoom = require('../models/QuestionsRoom');
const { ROOM_TYPES } = require('../config/constants');

/**
 * Factory for creating room instances
 */
class RoomFactory {
  static roomTypes = {
    [ROOM_TYPES.POLL]: PollRoom,
    [ROOM_TYPES.LINK_SHARE]: LinkShareRoom,
    [ROOM_TYPES.RT_FEEDBACK]: RTFeedbackRoom,
    [ROOM_TYPES.QUESTIONS]: QuestionsRoom
  };

  /**
   * Create a room instance based on type
   * @param {string} type - Room type
   * @param {string} code - Room/session code
   * @param {string} widgetId - Optional widget ID
   * @returns {Room} Room instance
   */
  static createRoom(type, code, widgetId = null) {
    const RoomClass = this.roomTypes[type];
    
    if (!RoomClass) {
      throw new Error(`Unknown room type: ${type}`);
    }
    
    return new RoomClass(code, widgetId);
  }

  /**
   * Check if a room type is valid
   * @param {string} type - Room type to check
   * @returns {boolean} Whether the room type is valid
   */
  static isValidRoomType(type) {
    return type in this.roomTypes;
  }

  /**
   * Get all valid room types
   * @returns {string[]} Array of valid room types
   */
  static getValidRoomTypes() {
    return Object.keys(this.roomTypes);
  }
}

module.exports = RoomFactory;