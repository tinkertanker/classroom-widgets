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

  // Common file extensions to exclude from being treated as TLDs
  _fileExtensions: ['txt', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'mp3', 'mp4', 'wav', 'avi', 'mov', 'zip', 'rar', 'tar', 'gz', 'json', 'xml', 'csv', 'html', 'css', 'js', 'ts', 'py', 'java', 'cpp', 'md', 'log'],

  /**
   * Normalize a URL by adding https:// if it looks like a domain without protocol.
   * Uses a simple heuristic: if adding https:// makes it a valid URL, do it.
   * @param {string} text - Text to normalize
   * @returns {string} - Normalized text (with https:// if applicable)
   */
  normalizeUrl: (text) => {
    if (!text || typeof text !== 'string') return text;
    const trimmed = text.trim();

    // Already has a protocol
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }

    // Quick check: must contain a dot and start with alphanumeric
    if (!/^[a-zA-Z0-9]/.test(trimmed) || !trimmed.includes('.')) {
      return trimmed;
    }

    // Don't treat things that have spaces
    if (trimmed.includes(' ') || trimmed.length > 2000) {
      return trimmed;
    }

    // Try adding https:// and see if it's a valid URL
    const withProtocol = `https://${trimmed}`;
    try {
      const url = new URL(withProtocol);
      // Check: hostname should have at least one dot and valid TLD-like ending
      if (url.hostname.includes('.') && /\.[a-zA-Z]{2,}$/.test(url.hostname)) {
        // Exclude common file extensions from being treated as domains
        // e.g., "file.txt" should not become "https://file.txt"
        // but "domain.com/file.txt" is fine (the hostname is "domain.com")
        const hostnameParts = url.hostname.split('.');
        const hostnameExt = hostnameParts[hostnameParts.length - 1].toLowerCase();
        if (validators._fileExtensions.includes(hostnameExt)) {
          return trimmed;
        }
        return withProtocol;
      }
    } catch {
      // Not a valid URL, return as-is
    }

    return trimmed;
  },

  /**
   * Check if a string looks like a URL (after normalization)
   * @param {string} text - Text to check
   * @returns {boolean}
   */
  isLink: (text) => {
    if (!text || typeof text !== 'string') return false;
    // Normalize first to catch domains without protocol
    const normalized = validators.normalizeUrl(text);
    try {
      new URL(normalized);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Validate text submission (for Drop Box)
   * @param {string} text - Text to validate
   * @returns {ValidationResult}
   */
  textSubmission: (text) => {
    if (!text || typeof text !== 'string') {
      return { valid: false, error: 'Text is required' };
    }
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      return { valid: false, error: 'Text cannot be empty' };
    }
    if (trimmed.length > 280) {
      return { valid: false, error: 'Text must be 280 characters or less' };
    }
    return { valid: true };
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
   * Validate feedback value (1-5 scale, allows decimals)
   * @param {number} val - Feedback value to validate
   * @returns {ValidationResult}
   */
  feedbackValue: (val) => {
    if (val === undefined || val === null) {
      return { valid: false, error: 'Feedback value is required' };
    }
    if (typeof val !== 'number' || isNaN(val)) {
      return { valid: false, error: 'Feedback value must be a number' };
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
    const codeResult = validators.sessionCode(data.sessionCode);
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
