import React, { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const Card: React.FC<CardProps> = ({
  children,
  className = '',
  onClick,
  hoverable = false,
  padding = 'md'
}) => {
  const baseStyles = `
    bg-soft-white dark:bg-warm-gray-800 
    rounded-lg shadow-sm 
    border border-warm-gray-200 dark:border-warm-gray-700
    transition-all duration-300
  `;
  
  const hoverStyles = hoverable 
    ? 'hover:shadow-md hover:border-warm-gray-300 dark:hover:border-warm-gray-600 cursor-pointer' 
    : '';
  
  const paddingStyles = {
    none: '',
    sm: 'p-2',
    md: 'p-4',
    lg: 'p-6'
  };
  
  const combinedStyles = `${baseStyles} ${hoverStyles} ${paddingStyles[padding]} ${className}`;
  
  return (
    <div 
      className={combinedStyles}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
};

export default Card;