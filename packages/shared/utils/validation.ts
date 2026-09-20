// Validation utilities for the student app
import sessionCode from '../constants/sessionCode.json';

export const SESSION_CODE_ALPHABET: string = sessionCode.alphabet;
export const SESSION_CODE_LENGTH: number = sessionCode.length;

/** Regex source matching exactly one session code, for use in HTML `pattern` attributes. */
export const SESSION_CODE_PATTERN_SOURCE = `[${SESSION_CODE_ALPHABET}]{${SESSION_CODE_LENGTH}}`;

const SESSION_CODE_REGEX = new RegExp(`^${SESSION_CODE_PATTERN_SOURCE}$`, 'i');

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
 * Valid codes use the server's safe-character alphabet (no 0/O, 1/I/l, etc.)
 */
export const isValidSessionCode = (code: string): boolean => {
  return SESSION_CODE_REGEX.test(code);
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