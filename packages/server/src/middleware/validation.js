/**
 * Input validation middleware
 */

/**
 * Validate session code format
 */
const isValidSessionCode = (code) => {
  return typeof code === 'string' && /^[A-Z0-9]{5}$/.test(code);
};

/**
 * Validate room code format (legacy)
 */
const isValidRoomCode = (code) => {
  return typeof code === 'string' && /^[A-Z0-9]{4}$/.test(code);
};

module.exports = {
  isValidSessionCode,
  isValidRoomCode
};