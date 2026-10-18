// Error Service - reports errors caught by the global error boundary

import { AppError } from '@shared/types';

export enum ErrorCode {
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

class ErrorService {
  logError(error: AppError): void {
    // Console output in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`[${error.code}] ${error.message}`, error.details);
    }

    if (import.meta.env.PROD) {
      console.error('[Production Error]', error.message, {
        code: error.code,
        details: error.details,
        timestamp: new Date(error.timestamp).toISOString()
      });
    }
  }
}

export const errorService = new ErrorService();
