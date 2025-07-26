// Error Service - Centralized error handling and reporting

import { useCallback } from 'react';
import { AppError } from '../shared/types';

export enum ErrorCode {
  // Widget errors
  WIDGET_LOAD_FAILED = 'WIDGET_LOAD_FAILED',
  WIDGET_RENDER_ERROR = 'WIDGET_RENDER_ERROR',
  WIDGET_STATE_ERROR = 'WIDGET_STATE_ERROR',
  WIDGET_NOT_FOUND = 'WIDGET_NOT_FOUND',
  
  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  SOCKET_CONNECTION_FAILED = 'SOCKET_CONNECTION_FAILED',
  API_ERROR = 'API_ERROR',
  
  // Storage errors
  STORAGE_QUOTA_EXCEEDED = 'STORAGE_QUOTA_EXCEEDED',
  STORAGE_ACCESS_DENIED = 'STORAGE_ACCESS_DENIED',
  
  // General errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR'
}

export class ErrorService {
  private static instance: ErrorService;
  private errorHandlers: Map<string, (error: AppError) => void> = new Map();
  private errorLog: AppError[] = [];
  private maxLogSize = 100;
  
  private constructor() {}
  
  static getInstance(): ErrorService {
    if (!ErrorService.instance) {
      ErrorService.instance = new ErrorService();
    }
    return ErrorService.instance;
  }
  
  // Create a structured error
  createError(code: ErrorCode, message: string, details?: any): AppError {
    return {
      code,
      message,
      details,
      timestamp: Date.now()
    };
  }
  
  // Log an error
  logError(error: AppError): void {
    // Add to log
    this.errorLog.push(error);
    
    // Trim log if too large
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog.shift();
    }
    
    // Console output in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`[${error.code}] ${error.message}`, error.details);
    }
    
    // Notify handlers
    this.notifyHandlers(error);
    
    // Send to monitoring service (if configured)
    this.sendToMonitoring(error);
  }
  
  // Handle an error with context
  handleError(error: Error | AppError, context?: string): void {
    let appError: AppError;
    
    if ('code' in error && 'timestamp' in error) {
      appError = error as AppError;
    } else {
      appError = this.createError(
        ErrorCode.UNKNOWN_ERROR,
        error.message || 'An unknown error occurred',
        {
          stack: error.stack,
          context
        }
      );
    }
    
    this.logError(appError);
  }
  
  // Register an error handler
  addErrorHandler(id: string, handler: (error: AppError) => void): void {
    this.errorHandlers.set(id, handler);
  }
  
  // Remove an error handler
  removeErrorHandler(id: string): void {
    this.errorHandlers.delete(id);
  }
  
  // Get recent errors
  getRecentErrors(count: number = 10): AppError[] {
    return this.errorLog.slice(-count);
  }
  
  // Clear error log
  clearErrors(): void {
    this.errorLog = [];
  }
  
  // Widget-specific error handling
  handleWidgetError(widgetId: string, widgetType: string, error: Error): void {
    const appError = this.createError(
      ErrorCode.WIDGET_RENDER_ERROR,
      `Widget ${widgetType} (${widgetId}) encountered an error`,
      {
        widgetId,
        widgetType,
        originalError: error.message,
        stack: error.stack
      }
    );
    
    this.logError(appError);
  }
  
  // Network error handling
  handleNetworkError(url: string, error: Error): void {
    const appError = this.createError(
      ErrorCode.NETWORK_ERROR,
      `Network request to ${url} failed`,
      {
        url,
        originalError: error.message
      }
    );
    
    this.logError(appError);
  }
  
  // Storage error handling
  handleStorageError(operation: string, error: Error): void {
    let code = ErrorCode.UNKNOWN_ERROR;
    
    if (error.name === 'QuotaExceededError') {
      code = ErrorCode.STORAGE_QUOTA_EXCEEDED;
    } else if (error.name === 'SecurityError') {
      code = ErrorCode.STORAGE_ACCESS_DENIED;
    }
    
    const appError = this.createError(
      code,
      `Storage operation '${operation}' failed`,
      {
        operation,
        originalError: error.message
      }
    );
    
    this.logError(appError);
  }
  
  // Private methods
  private notifyHandlers(error: AppError): void {
    this.errorHandlers.forEach(handler => {
      try {
        handler(error);
      } catch (e) {
        console.error('Error in error handler:', e);
      }
    });
  }
  
  private sendToMonitoring(error: AppError): void {
    // TODO: Integrate with monitoring service (e.g., Sentry)
    // For now, just log to console in production
    if (process.env.NODE_ENV === 'production') {
      console.error('Production error:', error);
    }
  }
}

// Export singleton instance
export const errorService = ErrorService.getInstance();

// React hook for using error service
export function useErrorHandler() {
  const handleError = useCallback((error: Error, context?: string) => {
    errorService.handleError(error, context);
  }, []);
  
  const handleWidgetError = useCallback((widgetId: string, widgetType: string, error: Error) => {
    errorService.handleWidgetError(widgetId, widgetType, error);
  }, []);
  
  return {
    handleError,
    handleWidgetError,
    logError: errorService.logError.bind(errorService),
    getRecentErrors: errorService.getRecentErrors.bind(errorService)
  };
}

