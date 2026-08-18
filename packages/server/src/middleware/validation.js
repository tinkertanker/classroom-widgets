/**
 * Input validation middleware
 */

/**
 * Validate session code format
 */
const isValidSessionCode = (code) => {
  return typeof code === 'string' && /^[A-Z0-9]{5}$/.test(code);
};

module.exports = {
  isValidSessionCode
};