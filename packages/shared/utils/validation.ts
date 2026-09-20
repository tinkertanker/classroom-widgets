// Validation utilities for the student app

const SAFE_URL_PROTOCOLS = new Set(['http:', 'https:']);

/** True only for absolute http(s) URLs — safe to bind to an anchor href. */
export const isSafeHttpUrl = (url: string): boolean => {
  try {
    return SAFE_URL_PROTOCOLS.has(new URL(url).protocol);
  } catch {
    return false;
  }
};

/**
 * Validates a session code format
 * Valid codes are 5 characters using specific letters/numbers to avoid confusion
 */
export const isValidSessionCode = (code: string): boolean => {
  return /^[23456789ACDEFHJKMNPQRTUWXY]{5}$/i.test(code);
};

/**
 * Validates a student name
 * Currently just checks if not empty after trimming
 */
export const isValidStudentName = (name: string): boolean => {
  return name.trim().length > 0;
};

/**
 * Sanitizes a student name by trimming whitespace
 * Returns 'Anonymous' if empty
 */
export const sanitizeStudentName = (name: string): string => {
  const trimmed = name.trim();
  return trimmed || 'Anonymous';
};