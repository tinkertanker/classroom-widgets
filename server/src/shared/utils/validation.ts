// Validation utilities for the student app

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