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
 * Generate a session code
 * @param {Map} sessions - Existing sessions
 * @returns {string} Generated session code
 */
function generateSessionCode(sessions) {
  const existingCodes = new Set(sessions.keys());

  return generateCode(LIMITS.ROOM_CODE_LENGTH, existingCodes);
}

module.exports = {
  generateCode,
  generateSessionCode
};