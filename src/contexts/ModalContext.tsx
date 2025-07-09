import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

interface ModalOptions {
  title?: string;
  content: ReactNode;
  showCloseButton?: boolean;
  onClose?: () => void;
  className?: string;
  overlayClassName?: string;
}

interface ModalContextType {
  showModal: (options: ModalOptions) => void;
  hideModal: () => void;
  isOpen: boolean;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};

export const ModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [modalOptions, setModalOptions] = useState<ModalOptions | null>(null);
  const modalContentRef = useRef<HTMLDivElement>(null);

  const showModal = useCallback((options: ModalOptions) => {
    setModalOptions(options);
    setIsOpen(true);
  }, []);

  const hideModal = useCallback(() => {
    setIsOpen(false);
    if (modalOptions?.onClose) {
      modalOptions.onClose();
    }
    // Clear modal options after animation
    setTimeout(() => setModalOptions(null), 200);
  }, [modalOptions]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      hideModal();
    }
  };

  // Global click handler to close modal when clicking outside
  useEffect(() => {
    const handleGlobalClick = (event: MouseEvent) => {
      if (isOpen && modalContentRef.current && !modalContentRef.current.contains(event.target as Node)) {
        hideModal();
      }
    };

    if (isOpen) {
      // Use capture phase to catch clicks before they're stopped
      document.addEventListener('mousedown', handleGlobalClick, true);
      return () => document.removeEventListener('mousedown', handleGlobalClick, true);
    }
  }, [isOpen, hideModal]);

  return (
    <ModalContext.Provider value={{ showModal, hideModal, isOpen }}>
      {children}
      {isOpen && modalOptions && ReactDOM.createPortal(
        <div 
          className={modalOptions.overlayClassName || "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1100]"}
          onClick={handleOverlayClick}
        >
          <div 
            ref={modalContentRef}
            className={modalOptions.className || "bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-xl max-w-2xl max-h-[80vh] overflow-auto"}
            onClick={(e) => e.stopPropagation()}
          >
            {modalOptions.title && (
              <div className="flex justify-between items-center px-6 py-4 border-b border-warm-gray-200 dark:border-warm-gray-700">
                <h2 className="text-xl font-semibold text-warm-gray-800 dark:text-warm-gray-100">
                  {modalOptions.title}
                </h2>
                {modalOptions.showCloseButton !== false && (
                  <button
                    onClick={hideModal}
                    className="text-warm-gray-500 hover:text-warm-gray-700 dark:text-warm-gray-400 dark:hover:text-warm-gray-200 text-2xl leading-none"
                  >
                    ×
                  </button>
                )}
              </div>
            )}
            <div className={modalOptions.title ? '' : 'relative'}>
              {!modalOptions.title && modalOptions.showCloseButton !== false && (
                <button
                  onClick={hideModal}
                  className="absolute top-4 right-4 text-warm-gray-500 hover:text-warm-gray-700 dark:text-warm-gray-400 dark:hover:text-warm-gray-200 text-2xl leading-none z-10"
                >
                  ×
                </button>
              )}
              {modalOptions.content}
            </div>
          </div>
        </div>,
        document.body
      )}
    </ModalContext.Provider>
  );
};