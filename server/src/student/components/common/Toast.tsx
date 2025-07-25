import React, { useEffect } from 'react';
import { FaCheckCircle, FaExclamationCircle, FaInfoCircle, FaExclamationTriangle, FaTimes } from 'react-icons/fa';
import { Toast as ToastType } from '../../types/ui.types';
import { useUIStore } from '../../store/uiStore';

const Toast: React.FC = () => {
  const { toasts, removeToast } = useUIStore();
  
  if (toasts.length === 0) return null;
  
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
};

interface ToastItemProps {
  toast: ToastType;
  onClose: () => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onClose }) => {
  const icons = {
    success: FaCheckCircle,
    error: FaExclamationCircle,
    info: FaInfoCircle,
    warning: FaExclamationTriangle
  };
  
  const colors = {
    success: 'bg-sage-50 dark:bg-sage-900/30 text-sage-800 dark:text-sage-200 border-sage-200 dark:border-sage-700',
    error: 'bg-dusty-rose-50 dark:bg-dusty-rose-900/30 text-dusty-rose-800 dark:text-dusty-rose-200 border-dusty-rose-200 dark:border-dusty-rose-700',
    info: 'bg-sky-50 dark:bg-sky-900/30 text-sky-800 dark:text-sky-200 border-sky-200 dark:border-sky-700',
    warning: 'bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-700'
  };
  
  const Icon = icons[toast.type];
  
  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(onClose, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.duration, onClose]);
  
  return (
    <div
      className={`
        flex items-center gap-3 p-4 rounded-lg border shadow-lg
        ${colors[toast.type]}
        animate-slideIn
        min-w-[300px] max-w-[500px]
      `}
      role="alert"
    >
      <Icon className="text-lg flex-shrink-0" />
      <p className="flex-1 text-sm">{toast.message}</p>
      <button
        onClick={onClose}
        className="flex-shrink-0 p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        aria-label="Close notification"
      >
        <FaTimes className="text-sm" />
      </button>
    </div>
  );
};

export default Toast;