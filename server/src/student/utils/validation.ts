import { ValidationRule } from '../types/ui.types';

export const validateSessionCode = (code: string): boolean => {
  return /^[23456789ACDEFHJKMNPQRTUWXY]{5}$/i.test(code);
};

export const validateUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const validateField = (value: any, rules?: ValidationRule): string | null => {
  if (!rules) return null;
  
  if (rules.required && !value) {
    return 'This field is required';
  }
  
  if (rules.minLength && value.length < rules.minLength) {
    return `Minimum length is ${rules.minLength} characters`;
  }
  
  if (rules.maxLength && value.length > rules.maxLength) {
    return `Maximum length is ${rules.maxLength} characters`;
  }
  
  if (rules.pattern && !rules.pattern.test(value)) {
    return 'Invalid format';
  }
  
  if (rules.validate) {
    const result = rules.validate(value);
    if (typeof result === 'string') {
      return result;
    }
    if (!result) {
      return 'Invalid value';
    }
  }
  
  return null;
};

export const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>]/g, '');
};