import React from 'react';

type ColorScheme = 'teal' | 'sage' | 'red' | 'yellow' | 'green' | 'blue';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ReusableButtonProps {
  colorScheme: ColorScheme;
  size: ButtonSize;
  width?: string;
  height?: string;
  children: React.ReactNode;
  [key: string]: any;
}

const ReusableButton: React.FC<ReusableButtonProps> = ({ colorScheme, size, width, height, children, ...props }) => {
  // Map colorScheme to Tailwind classes
  const colorClasses = {
    teal: 'bg-sage-500 hover:bg-sage-600 dark:bg-sage-600 dark:hover:bg-sage-700 text-white',
    sage: 'bg-sage-500 hover:bg-sage-600 dark:bg-sage-600 dark:hover:bg-sage-700 text-white',
    red: 'bg-dusty-rose-500 hover:bg-dusty-rose-600 dark:bg-dusty-rose-600 dark:hover:bg-dusty-rose-700 text-white',
    yellow: 'bg-terracotta-500 hover:bg-terracotta-600 dark:bg-terracotta-600 dark:hover:bg-terracotta-700 text-white',
    green: 'bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 text-white',
    blue: 'bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white',
  };

  // Map size to Tailwind classes
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg',
  };

  const buttonColorClass = colorClasses[colorScheme] || colorClasses.teal;
  const buttonSizeClass = sizeClasses[size] || sizeClasses.md;

  return (
    <button
      className={`${buttonColorClass} ${buttonSizeClass} rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed`}
      style={{ width: width || '100%', height }}
      {...props}
    >
      {children}
    </button>
  );
};

export default ReusableButton;
