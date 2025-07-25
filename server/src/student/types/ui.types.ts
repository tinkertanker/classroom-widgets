import { ReactNode } from 'react';
import { IconType } from 'react-icons';

// UI Component Props
export interface ActivityCardProps {
  title: string;
  description: string;
  icon: IconType;
  isMinimized: boolean;
  onToggleMinimize: () => void;
  children: ReactNode;
  variant: 'poll' | 'linkShare' | 'rtfeedback' | 'questions';
}

export interface ConnectionIndicatorProps {
  isConnected: boolean;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export interface LoadingStateProps {
  message?: string;
  fullScreen?: boolean;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}

export interface InputProps {
  type?: 'text' | 'url' | 'number';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  label?: string;
  required?: boolean;
  maxLength?: number;
  className?: string;
}

// Animation states
export interface AnimationState {
  entering: Set<string>;
  leaving: Set<string>;
}

// Theme
export interface Theme {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

// Modal
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

// Toast notifications
export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
}

// Form validation
export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  validate?: (value: any) => boolean | string;
}

export interface FormField {
  name: string;
  value: any;
  error?: string;
  touched: boolean;
  rules?: ValidationRule;
}