import { useUIStore } from '../store/uiStore';

export enum ErrorType {
  NETWORK = 'NETWORK',
  VALIDATION = 'VALIDATION',
  SESSION = 'SESSION',
  ACTIVITY = 'ACTIVITY',
  UNKNOWN = 'UNKNOWN'
}

export interface AppError {
  type: ErrorType;
  message: string;
  code?: string;
  details?: any;
  timestamp: Date;
  retry?: () => void;
}

export class ErrorService {
  private static instance: ErrorService;
  private errorHandlers: Map<ErrorType, (error: AppError) => void> = new Map();
  
  private constructor() {
    this.setupDefaultHandlers();
  }
  
  static getInstance(): ErrorService {
    if (!ErrorService.instance) {
      ErrorService.instance = new ErrorService();
    }
    return ErrorService.instance;
  }
  
  // Setup default error handlers
  private setupDefaultHandlers() {
    // Network errors
    this.errorHandlers.set(ErrorType.NETWORK, (error) => {
      const uiStore = useUIStore.getState();
      uiStore.addToast({
        type: 'error',
        message: error.message || 'Network connection error. Please check your internet.',
        duration: 5000
      });
    });
    
    // Validation errors
    this.errorHandlers.set(ErrorType.VALIDATION, (error) => {
      const uiStore = useUIStore.getState();
      uiStore.addToast({
        type: 'warning',
        message: error.message || 'Please check your input and try again.',
        duration: 4000
      });
    });
    
    // Session errors
    this.errorHandlers.set(ErrorType.SESSION, (error) => {
      const uiStore = useUIStore.getState();
      uiStore.addToast({
        type: 'error',
        message: error.message || 'Session error. Please rejoin.',
        duration: 0 // Don't auto-dismiss
      });
    });
    
    // Activity errors
    this.errorHandlers.set(ErrorType.ACTIVITY, (error) => {
      const uiStore = useUIStore.getState();
      uiStore.addToast({
        type: 'error',
        message: error.message || 'Activity error occurred.',
        duration: 5000
      });
    });
    
    // Unknown errors
    this.errorHandlers.set(ErrorType.UNKNOWN, (error) => {
      console.error('Unknown error:', error);
      const uiStore = useUIStore.getState();
      uiStore.addToast({
        type: 'error',
        message: 'An unexpected error occurred. Please try again.',
        duration: 5000
      });
    });
  }
  
  // Register custom error handler
  registerHandler(type: ErrorType, handler: (error: AppError) => void) {
    this.errorHandlers.set(type, handler);
  }
  
  // Handle error
  handleError(error: Error | AppError, type?: ErrorType) {
    const appError: AppError = this.normalizeError(error, type);
    
    const handler = this.errorHandlers.get(appError.type) || 
                   this.errorHandlers.get(ErrorType.UNKNOWN);
    
    if (handler) {
      handler(appError);
    }
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`[${appError.type}]`, appError.message, appError.details);
    }
  }
  
  // Normalize errors to AppError format
  private normalizeError(error: Error | AppError, type?: ErrorType): AppError {
    if ('type' in error && error.type) {
      return error;
    }
    
    // Try to determine error type
    const errorType = type || this.detectErrorType(error);
    
    return {
      type: errorType,
      message: error.message || 'An error occurred',
      timestamp: new Date(),
      details: error
    };
  }
  
  // Detect error type from error object
  private detectErrorType(error: Error): ErrorType {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return ErrorType.NETWORK;
    }
    
    if (message.includes('invalid') || message.includes('required')) {
      return ErrorType.VALIDATION;
    }
    
    if (message.includes('session') || message.includes('code')) {
      return ErrorType.SESSION;
    }
    
    if (message.includes('activity') || message.includes('poll') || message.includes('feedback')) {
      return ErrorType.ACTIVITY;
    }
    
    return ErrorType.UNKNOWN;
  }
  
  // Create typed errors
  static createError(
    type: ErrorType,
    message: string,
    code?: string,
    details?: any,
    retry?: () => void
  ): AppError {
    return {
      type,
      message,
      code,
      details,
      timestamp: new Date(),
      retry
    };
  }
}

// Export singleton instance
export const errorService = ErrorService.getInstance();

// Error boundary hook
export function useErrorHandler() {
  const handleError = (error: Error | AppError, type?: ErrorType) => {
    errorService.handleError(error, type);
  };
  
  return { handleError };
}