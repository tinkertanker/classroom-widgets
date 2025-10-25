/**
 * Error handling middleware and utilities
 */

/**
 * Custom error classes
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, errors = {}) {
    super(message, 400, 'VALIDATION_ERROR');
    this.errors = errors;
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401, 'AUTH_ERROR');
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Not authorized') {
    super(message, 403, 'FORBIDDEN');
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT');
  }
}

/**
 * Socket error handler wrapper
 */
const handleSocketError = (handler) => {
  return async (...args) => {
    const socket = this;
    const callback = args[args.length - 1];
    const hasCallback = typeof callback === 'function';
    
    try {
      await handler.apply(socket, args);
    } catch (error) {
      console.error(`Socket error in ${handler.name}:`, error);
      
      // Send error response
      const errorResponse = {
        success: false,
        error: error.isOperational ? error.message : 'An error occurred',
        code: error.code || 'ERROR'
      };
      
      if (error instanceof ValidationError && error.errors) {
        errorResponse.errors = error.errors;
      }
      
      if (hasCallback) {
        callback(errorResponse);
      } else {
        // Emit error event if no callback
        socket.emit('error', errorResponse);
      }
      
      // Log non-operational errors
      if (!error.isOperational) {
        logError(error, { socketId: socket.id, event: handler.name });
      }
    }
  };
};

/**
 * Express error handler middleware
 */
const expressErrorHandler = (err, req, res, next) => {
  const { statusCode = 500, message, code = 'INTERNAL_ERROR' } = err;
  
  // Log error
  if (!err.isOperational) {
    logError(err, { 
      method: req.method, 
      url: req.url, 
      ip: req.ip 
    });
  }
  
  // Send error response
  res.status(statusCode).json({
    success: false,
    error: {
      message: err.isOperational ? message : 'Internal server error',
      code
    }
  });
};

/**
 * Socket.io error handler
 */
const socketErrorHandler = (socket) => {
  socket.on('error', (error) => {
    console.error(`Socket error for ${socket.id}:`, error);
    
    // Disconnect socket on critical errors
    if (error.code === 'TRANSPORT_ERROR' || error.code === 'PARSE_ERROR') {
      socket.disconnect(true);
    }
  });
  
  // Handle disconnection errors
  socket.on('disconnect', (reason) => {
    if (reason === 'io server disconnect' || reason === 'io client disconnect') {
      return; // Normal disconnect
    }
    
    console.warn(`Socket ${socket.id} disconnected abnormally:`, reason);
  });
};

/**
 * Global uncaught exception handler
 */
const setupGlobalErrorHandlers = () => {
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    logError(error, { type: 'uncaughtException' });
    
    // Exit process after logging
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    logError(new Error(reason), { type: 'unhandledRejection' });
  });
};

/**
 * Error logging utility
 */
const logError = (error, context = {}) => {
  const errorLog = {
    timestamp: new Date().toISOString(),
    message: error.message,
    stack: error.stack,
    code: error.code,
    context,
    ...( error.isOperational ? { operational: true } : {})
  };
  
  // In production, send to logging service
  if (process.env.NODE_ENV === 'production') {
    // Integration point for logging services (Sentry, LogRocket, etc.)
    // To integrate:
    // 1. Install: npm install @sentry/node
    // 2. Initialize in server.js
    // 3. Uncomment below:
    // if (global.errorLogger) {
    //   global.errorLogger.log(errorLog);
    // }
    console.error('Error Log:', JSON.stringify(errorLog));
  } else {
    console.error('Error Log:', errorLog);
  }
};

/**
 * Async error wrapper for Express routes
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  // Error classes
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  
  // Handlers
  handleSocketError,
  expressErrorHandler,
  socketErrorHandler,
  setupGlobalErrorHandlers,
  
  // Utilities
  logError,
  asyncHandler
};