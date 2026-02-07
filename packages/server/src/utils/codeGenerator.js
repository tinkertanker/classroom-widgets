const { SAFE_CHARACTERS, LIMITS } = require('../config/constants');

/**
 * Generate a random code using safe characters
 * @param {number} length - Length of the code to generate
 * @param {Set} existingCodes - Set of existing codes to avoid duplicates
 * @returns {string} Generated code
 */
function generateCode(length = LIMITS.ROOM_CODE_LENGTH, existingCodes = new Set()) {
  let code;
  let attempts = 0;
  const maxAttempts = 1000; // Prevent infinite loop
  
  do {
    code = '';
    for (let i = 0; i < length; i++) {
      code += SAFE_CHARACTERS[Math.floor(Math.random() * SAFE_CHARACTERS.length)];
    }
    attempts++;
    
    if (attempts > maxAttempts) {
      throw new Error('Unable to generate unique code after maximum attempts');
    }
  } while (existingCodes.has(code));
  
  return code;
}

/**
 * Generate a room code
 * @param {Map|Set} existingRooms - Existing rooms to check against
 * @returns {string} Generated room code
 */
function generateRoomCode(existingRooms) {
  const existingCodes = existingRooms instanceof Map 
    ? new Set(existingRooms.keys())
    : existingRooms;
    
  return generateCode(LIMITS.ROOM_CODE_LENGTH, existingCodes);
}

/**
 * Generate a session code
 * @param {Map} sessions - Existing sessions
 * @param {Map} rooms - Existing rooms (to avoid conflicts with legacy rooms)
 * @returns {string} Generated session code
 */
function generateSessionCode(sessions, rooms = new Map()) {
  const existingCodes = new Set([
    ...sessions.keys(),
    ...rooms.keys()
  ]);
  
  return generateCode(LIMITS.ROOM_CODE_LENGTH, existingCodes);
}

module.exports = {
  generateCode,
  generateRoomCode,
  generateSessionCode
};