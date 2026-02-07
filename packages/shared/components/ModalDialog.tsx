// ModalDialog - Shared modal dialog component with consistent styling
// Renders as a portal to document.body with full-screen overlay

import React, { ReactNode, useEffect } from 'react';
import ReactDOM from 'react-dom';

interface ModalDialogProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
  subtitle?: ReactNode;
  showCloseButton?: boolean;
  contentClassName?: string;
  maxHeight?: string;
}

const ModalDialog: React.FC<ModalDialogProps> = ({
  title,
  onClose,
  children,
  className = '',
  footer,
  subtitle,
  showCloseButton = true,
  contentClassName = '',
  maxHeight = '80vh',
}) => {
  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Handle click outside to close
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleOverlayClick}
    >
      <div
        className={`flex flex-col bg-white dark:bg-warm-gray-800 rounded-lg shadow-xl animate-in zoom-in-95 duration-200 ${className}`}
        style={{ maxHeight }}
        onClick={(e) => e.stopPropagation()}
      >
      {/* Header */}
      <div className="px-6 py-4 border-b border-warm-gray-200 dark:border-warm-gray-700 bg-warm-gray-50 dark:bg-warm-gray-900 rounded-t-lg">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-semibold text-warm-gray-800 dark:text-warm-gray-100">
            {title}
          </h2>
          {showCloseButton && (
            <button
              onClick={onClose}
              className="text-warm-gray-500 hover:text-warm-gray-700 dark:text-warm-gray-400 dark:hover:text-warm-gray-200 text-2xl leading-none"
              aria-label="Close dialog"
            >
              ×
            </button>
          )}
        </div>
        {subtitle && (
          <div>
            {subtitle}
          </div>
        )}
      </div>
      
      {/* Content */}
      <div className={`flex-1 overflow-y-auto ${contentClassName}`}>
        {children}
      </div>
      
      {/* Footer */}
      {footer && (
        <div className="px-6 py-4 border-t border-warm-gray-200 dark:border-warm-gray-700 bg-warm-gray-50 dark:bg-warm-gray-900 rounded-b-lg">
          {footer}
        </div>
      )}
      </div>
    </div>,
    document.body
  );
};

export default ModalDialog;