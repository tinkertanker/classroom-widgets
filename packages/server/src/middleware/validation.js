const { LIMITS, SAFE_CHARACTERS } = require('../config/constants');

/**
 * Input validation middleware
 */

const SESSION_CODE_PATTERN = new RegExp(`^[${SAFE_CHARACTERS}]{${LIMITS.ROOM_CODE_LENGTH}}$`);

/**
 * Validate session code format
 */
const isValidSessionCode = (code) => {
  return typeof code === 'string' && SESSION_CODE_PATTERN.test(code);
};

module.exports = {
  isValidSessionCode
};