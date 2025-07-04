import React from 'react';

const ReusableButton = ({ colorScheme, size, width, height, children, ...props }) => {
  // Map colorScheme to Tailwind classes
  const colorClasses = {
    teal: 'bg-teal-500 hover:bg-teal-600 text-white',
    red: 'bg-red-500 hover:bg-red-600 text-white',
    yellow: 'bg-yellow-500 hover:bg-yellow-600 text-white',
    green: 'bg-green-500 hover:bg-green-600 text-white',
    blue: 'bg-blue-500 hover:bg-blue-600 text-white',
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
