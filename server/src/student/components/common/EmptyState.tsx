import React, { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = ''
}) => {
  return (
    <div className={`flex flex-col items-center justify-center min-h-[250px] text-center ${className}`}>
      {icon && (
        <div className="text-warm-gray-400 dark:text-warm-gray-500 mb-4">
          {icon}
        </div>
      )}
      
      <h3 className="text-lg font-semibold text-warm-gray-700 dark:text-warm-gray-300 mb-2">
        {title}
      </h3>
      
      {description && (
        <p className="text-sm text-warm-gray-500 dark:text-warm-gray-400 mb-4 max-w-sm">
          {description}
        </p>
      )}
      
      {action && (
        <div className="mt-2">
          {action}
        </div>
      )}
    </div>
  );
};

export default EmptyState;