const { LIMITS } = require('../config/constants');

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

/**
 * Validate participant name
 */
const isValidParticipantName = (name) => {
  if (typeof name !== 'string') return false;
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= LIMITS.MAX_NAME_LENGTH;
};

/**
 * Validate widget ID
 */
const isValidWidgetId = (widgetId) => {
  if (!widgetId) return true; // Optional
  return typeof widgetId === 'string' && widgetId.length <= 100;
};

/**
 * Validate poll data
 */
const validatePollData = (pollData) => {
  const errors = [];
  
  if (!pollData) {
    errors.push('Poll data is required');
    return { valid: false, errors };
  }
  
  // Validate question
  if (!pollData.question || typeof pollData.question !== 'string') {
    errors.push('Question is required');
  } else if (pollData.question.length > LIMITS.MAX_POLL_QUESTION_LENGTH) {
    errors.push(`Question must be less than ${LIMITS.MAX_POLL_QUESTION_LENGTH} characters`);
  }
  
  // Validate options
  if (!Array.isArray(pollData.options)) {
    errors.push('Options must be an array');
  } else {
    if (pollData.options.length < 2) {
      errors.push('At least 2 options are required');
    }
    if (pollData.options.length > LIMITS.MAX_POLL_OPTIONS) {
      errors.push(`Maximum ${LIMITS.MAX_POLL_OPTIONS} options allowed`);
    }
    
    pollData.options.forEach((option, index) => {
      if (!option || typeof option !== 'string') {
        errors.push(`Option ${index + 1} is invalid`);
      } else if (option.length > LIMITS.MAX_POLL_OPTION_LENGTH) {
        errors.push(`Option ${index + 1} is too long`);
      }
    });
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Validate link submission
 */
const validateLinkSubmission = (link) => {
  if (!link || typeof link !== 'string') {
    return { valid: false, error: 'Link is required' };
  }
  
  const trimmed = link.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Link cannot be empty' };
  }
  
  if (trimmed.length > LIMITS.MAX_LINK_LENGTH) {
    return { valid: false, error: 'Link is too long' };
  }
  
  // Basic URL validation
  try {
    // Add protocol if missing
    const urlString = trimmed.match(/^https?:\/\//) ? trimmed : `https://${trimmed}`;
    new URL(urlString);
    return { valid: true, link: trimmed };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
};

/**
 * Validate question submission
 */
const validateQuestionSubmission = (question) => {
  if (!question || typeof question !== 'string') {
    return { valid: false, error: 'Question is required' };
  }
  
  const trimmed = question.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Question cannot be empty' };
  }
  
  if (trimmed.length > LIMITS.MAX_QUESTION_LENGTH) {
    return { valid: false, error: `Question must be less than ${LIMITS.MAX_QUESTION_LENGTH} characters` };
  }
  
  return { valid: true, question: trimmed };
};

/**
 * Validate feedback value
 */
const validateFeedbackValue = (value) => {
  if (typeof value !== 'number') {
    return { valid: false, error: 'Feedback value must be a number' };
  }
  
  if (value < 1 || value > 5) {
    return { valid: false, error: 'Feedback value must be between 1 and 5' };
  }
  
  // Allow half values (1, 1.5, 2, 2.5, etc.)
  if (value % 0.5 !== 0) {
    return { valid: false, error: 'Feedback value must be in increments of 0.5' };
  }
  
  return { valid: true, value };
};

/**
 * Sanitize user input
 */
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  // Remove any HTML tags
  return input.replace(/<[^>]*>/g, '')
    // Remove excess whitespace
    .replace(/\s+/g, ' ')
    // Trim
    .trim();
};

/**
 * Create validation middleware for socket events
 */
const createValidator = (validationRules) => {
  return (data, callback) => {
    const errors = {};
    
    for (const [field, validator] of Object.entries(validationRules)) {
      const result = validator(data[field]);
      if (!result.valid) {
        errors[field] = result.error || result.errors;
      }
    }
    
    if (Object.keys(errors).length > 0) {
      if (typeof callback === 'function') {
        callback({ success: false, errors });
      }
      return false;
    }
    
    return true;
  };
};

module.exports = {
  isValidSessionCode,
  isValidRoomCode,
  isValidParticipantName,
  isValidWidgetId,
  validatePollData,
  validateLinkSubmission,
  validateQuestionSubmission,
  validateFeedbackValue,
  sanitizeInput,
  createValidator
};