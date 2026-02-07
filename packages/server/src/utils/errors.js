/**
 * Standardized error codes and response helpers for socket events
 */

/**
 * Error codes for socket events
 * Format: { code: string, message: string }
 */
const ERROR_CODES = {
  // Session errors
  INVALID_SESSION: {
    code: 'INVALID_SESSION',
    message: 'Session not found or expired'
  },
  SESSION_FULL: {
    code: 'SESSION_FULL',
    message: 'Session has reached maximum participants'
  },
  NOT_HOST: {
    code: 'NOT_HOST',
    message: 'Only the host can perform this action'
  },

  // Room errors
  ROOM_NOT_FOUND: {
    code: 'ROOM_NOT_FOUND',
    message: 'Widget room not found'
  },
  ROOM_FULL: {
    code: 'ROOM_FULL',
    message: 'Widget has reached maximum participants'
  },
  WIDGET_PAUSED: {
    code: 'WIDGET_PAUSED',
    message: 'Widget is currently paused'
  },
  MAX_ROOMS_REACHED: {
    code: 'MAX_ROOMS_REACHED',
    message: 'Maximum rooms limit reached'
  },

  // Input errors
  INVALID_INPUT: {
    code: 'INVALID_INPUT',
    message: 'Invalid input provided'
  },
  MISSING_REQUIRED_FIELD: {
    code: 'MISSING_REQUIRED_FIELD',
    message: 'Required field is missing'
  },

  // Rate limiting
  RATE_LIMITED: {
    code: 'RATE_LIMITED',
    message: 'Too many requests, please slow down'
  },

  // Participant errors
  NOT_PARTICIPANT: {
    code: 'NOT_PARTICIPANT',
    message: 'Not a valid participant'
  },
  ALREADY_VOTED: {
    code: 'ALREADY_VOTED',
    message: 'Already voted in this poll'
  },

  // Server errors
  INTERNAL_ERROR: {
    code: 'INTERNAL_ERROR',
    message: 'An internal error occurred'
  }
};

/**
 * Create a standardized error response
 * @param {string} errorCode - Error code from ERROR_CODES
 * @param {string} [customMessage] - Optional custom message to override default
 * @param {Object} [details] - Optional additional details
 * @returns {Object} Standardized error response
 */
function createErrorResponse(errorCode, customMessage, details) {
  const errorDef = ERROR_CODES[errorCode] || ERROR_CODES.INTERNAL_ERROR;

  return {
    success: false,
    error: {
      code: errorDef.code,
      message: customMessage || errorDef.message,
      ...(details && { details })
    }
  };
}

/**
 * Create a standardized success response
 * @param {Object} [data] - Response data
 * @returns {Object} Standardized success response
 */
function createSuccessResponse(data = {}) {
  return {
    success: true,
    ...data
  };
}

/**
 * Create a rate limit error response with retry information
 * @param {number} retryAfterMs - Milliseconds until the user can retry
 * @returns {Object} Rate limit error response
 */
function createRateLimitResponse(retryAfterMs) {
  return {
    success: false,
    error: {
      code: ERROR_CODES.RATE_LIMITED.code,
      message: ERROR_CODES.RATE_LIMITED.message,
      retryAfter: retryAfterMs
    }
  };
}

/**
 * Create an input validation error response
 * @param {string} fieldName - Name of the invalid field
 * @param {string} validationMessage - Validation error message
 * @returns {Object} Validation error response
 */
function createValidationErrorResponse(fieldName, validationMessage) {
  return {
    success: false,
    error: {
      code: ERROR_CODES.INVALID_INPUT.code,
      message: validationMessage,
      field: fieldName
    }
  };
}

module.exports = {
  ERROR_CODES,
  createErrorResponse,
  createSuccessResponse,
  createRateLimitResponse,
  createValidationErrorResponse
};
