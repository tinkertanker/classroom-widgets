/**
 * Input validation utilities for socket events
 */

const { LIMITS } = require('../config/constants');

/**
 * Validation result type
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {string} [error] - Error message if validation failed
 */

const validators = {
  /**
   * Validate session code format
   * @param {string} code - Session code to validate
   * @returns {ValidationResult}
   */
  sessionCode: (code) => {
    if (!code || typeof code !== 'string') {
      return { valid: false, error: 'Session code is required' };
    }
    if (!/^[A-Z0-9]{4,6}$/i.test(code)) {
      return { valid: false, error: 'Invalid session code format' };
    }
    return { valid: true };
  },

  /**
   * Validate widget ID
   * @param {string} id - Widget ID to validate
   * @returns {ValidationResult}
   */
  widgetId: (id) => {
    if (!id || typeof id !== 'string') {
      return { valid: false, error: 'Widget ID is required' };
    }
    if (id.length === 0 || id.length > 100) {
      return { valid: false, error: 'Invalid widget ID' };
    }
    return { valid: true };
  },

  /**
   * Validate URL format
   * @param {string} url - URL to validate
   * @returns {ValidationResult}
   */
  link: (url) => {
    if (!url || typeof url !== 'string') {
      return { valid: false, error: 'Link is required' };
    }
    if (url.length > LIMITS.MAX_LINK_LENGTH) {
      return { valid: false, error: `Link must be less than ${LIMITS.MAX_LINK_LENGTH} characters` };
    }
    try {
      new URL(url);
      return { valid: true };
    } catch {
      return { valid: false, error: 'Invalid URL format' };
    }
  },

  /**
   * Validate question text
   * @param {string} text - Question text to validate
   * @returns {ValidationResult}
   */
  question: (text) => {
    if (!text || typeof text !== 'string') {
      return { valid: false, error: 'Question is required' };
    }
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      return { valid: false, error: 'Question cannot be empty' };
    }
    if (trimmed.length > LIMITS.MAX_QUESTION_LENGTH) {
      return { valid: false, error: `Question must be less than ${LIMITS.MAX_QUESTION_LENGTH} characters` };
    }
    return { valid: true };
  },

  /**
   * Validate feedback value (1-5 scale)
   * @param {number} val - Feedback value to validate
   * @returns {ValidationResult}
   */
  feedbackValue: (val) => {
    if (val === undefined || val === null) {
      return { valid: false, error: 'Feedback value is required' };
    }
    if (!Number.isInteger(val)) {
      return { valid: false, error: 'Feedback value must be an integer' };
    }
    if (val < LIMITS.FEEDBACK_MIN_VALUE || val > LIMITS.FEEDBACK_MAX_VALUE) {
      return { valid: false, error: `Feedback value must be between ${LIMITS.FEEDBACK_MIN_VALUE} and ${LIMITS.FEEDBACK_MAX_VALUE}` };
    }
    return { valid: true };
  },

  /**
   * Validate student name
   * @param {string} name - Student name to validate
   * @returns {ValidationResult}
   */
  studentName: (name) => {
    if (!name || typeof name !== 'string') {
      return { valid: false, error: 'Student name is required' };
    }
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      return { valid: false, error: 'Student name cannot be empty' };
    }
    if (trimmed.length > LIMITS.MAX_STUDENT_NAME_LENGTH) {
      return { valid: false, error: `Student name must be less than ${LIMITS.MAX_STUDENT_NAME_LENGTH} characters` };
    }
    return { valid: true };
  },

  /**
   * Validate poll option index
   * @param {number} index - Option index to validate
   * @param {number} maxOptions - Maximum number of options in the poll
   * @returns {ValidationResult}
   */
  pollOption: (index, maxOptions) => {
    if (index === undefined || index === null) {
      return { valid: false, error: 'Option index is required' };
    }
    if (!Number.isInteger(index)) {
      return { valid: false, error: 'Option index must be an integer' };
    }
    if (index < 0 || index >= maxOptions) {
      return { valid: false, error: 'Invalid poll option' };
    }
    return { valid: true };
  },

  /**
   * Validate request state data format
   * All widgets should use the same format
   * @param {Object} data - Request state data
   * @returns {ValidationResult}
   */
  requestStateData: (data) => {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'Request data is required' };
    }
    // Support both 'sessionCode' (new) and 'code' (legacy)
    const sessionCode = data.sessionCode || data.code;
    const codeResult = validators.sessionCode(sessionCode);
    if (!codeResult.valid) {
      return codeResult;
    }
    const widgetResult = validators.widgetId(data.widgetId);
    if (!widgetResult.valid) {
      return widgetResult;
    }
    return { valid: true };
  }
};

/**
 * Run validation and return standardized result
 * @param {string} validatorName - Name of the validator to use
 * @param {any} value - Value to validate
 * @param {any} [extra] - Extra parameter for some validators (e.g., maxOptions for pollOption)
 * @returns {ValidationResult}
 */
function validate(validatorName, value, extra) {
  const validator = validators[validatorName];
  if (!validator) {
    return { valid: false, error: `Unknown validator: ${validatorName}` };
  }
  return validator(value, extra);
}

module.exports = {
  validators,
  validate
};
