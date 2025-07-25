import React from 'react';
import { InputProps } from '../../types/ui.types';

const Input: React.FC<InputProps> = ({
  type = 'text',
  value,
  onChange,
  placeholder,
  disabled = false,
  error,
  label,
  required = false,
  maxLength,
  className = '',
  ...props
}) => {
  const baseStyles = `
    w-full py-2 px-3 border rounded-md text-sm 
    bg-white dark:bg-warm-gray-700 
    text-warm-gray-800 dark:text-warm-gray-200 
    focus:outline-none focus:shadow-[0_0_0_2px_rgba(94,139,94,0.2)]
    disabled:opacity-50 disabled:cursor-not-allowed
    transition-colors duration-200
  `;
  
  const errorStyles = error 
    ? 'border-dusty-rose-500 dark:border-dusty-rose-400 focus:border-dusty-rose-500 dark:focus:border-dusty-rose-400' 
    : 'border-warm-gray-300 dark:border-warm-gray-600 focus:border-sage-500 dark:focus:border-sage-400';
  
  const combinedStyles = `${baseStyles} ${errorStyles} ${className}`;
  
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300 mb-1">
          {label}
          {required && <span className="text-dusty-rose-500 ml-1">*</span>}
        </label>
      )}
      
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        maxLength={maxLength}
        className={combinedStyles}
        aria-invalid={!!error}
        aria-describedby={error ? `${props.id || 'input'}-error` : undefined}
        {...props}
      />
      
      {maxLength && (
        <div className="mt-1 text-xs text-warm-gray-500 dark:text-warm-gray-400 text-right">
          {value.length}/{maxLength}
        </div>
      )}
      
      {error && (
        <div 
          id={`${props.id || 'input'}-error`}
          className="mt-1 text-xs text-dusty-rose-600 dark:text-dusty-rose-400"
        >
          {error}
        </div>
      )}
    </div>
  );
};

export default Input;