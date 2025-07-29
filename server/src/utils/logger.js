const fs = require('fs');
const path = require('path');
const util = require('util');

/**
 * Simple logging system with different log levels
 */
class Logger {
  constructor(options = {}) {
    this.options = {
      level: process.env.LOG_LEVEL || 'info',
      writeToFile: process.env.NODE_ENV === 'production',
      logDir: path.join(__dirname, '../../logs'),
      maxFileSize: 10 * 1024 * 1024, // 10MB
      ...options
    };

    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };

    this.colors = {
      error: '\x1b[31m', // Red
      warn: '\x1b[33m',  // Yellow
      info: '\x1b[36m',  // Cyan
      debug: '\x1b[90m', // Gray
      reset: '\x1b[0m'
    };

    // Ensure log directory exists
    if (this.options.writeToFile) {
      this.ensureLogDirectory();
    }
  }

  /**
   * Ensure log directory exists
   */
  ensureLogDirectory() {
    if (!fs.existsSync(this.options.logDir)) {
      fs.mkdirSync(this.options.logDir, { recursive: true });
    }
  }

  /**
   * Get current log file path
   */
  getLogFilePath(level) {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.options.logDir, `${level}-${date}.log`);
  }

  /**
   * Format log message
   */
  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const formattedMeta = Object.keys(meta).length > 0 
      ? ` ${util.inspect(meta, { depth: 3, colors: false })}` 
      : '';
    
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${formattedMeta}`;
  }

  /**
   * Write to file
   */
  writeToFile(level, formattedMessage) {
    if (!this.options.writeToFile) return;

    const logFile = this.getLogFilePath(level);
    
    // Check file size and rotate if necessary
    try {
      const stats = fs.statSync(logFile);
      if (stats.size > this.options.maxFileSize) {
        const archiveFile = logFile.replace('.log', `-${Date.now()}.log`);
        fs.renameSync(logFile, archiveFile);
      }
    } catch (error) {
      // File doesn't exist yet
    }

    // Append to log file
    fs.appendFileSync(logFile, formattedMessage + '\n');
  }

  /**
   * Log method
   */
  log(level, message, meta = {}) {
    // Check if we should log this level
    if (this.levels[level] > this.levels[this.options.level]) {
      return;
    }

    const formattedMessage = this.formatMessage(level, message, meta);

    // Console output with colors
    if (process.env.NODE_ENV !== 'production') {
      const color = this.colors[level] || this.colors.reset;
      console.log(`${color}${formattedMessage}${this.colors.reset}`);
    } else {
      console.log(formattedMessage);
    }

    // File output
    this.writeToFile(level, formattedMessage);
  }

  /**
   * Log level methods
   */
  error(message, meta) {
    this.log('error', message, meta);
  }

  warn(message, meta) {
    this.log('warn', message, meta);
  }

  info(message, meta) {
    this.log('info', message, meta);
  }

  debug(message, meta) {
    this.log('debug', message, meta);
  }

  /**
   * Log socket events
   */
  logSocketEvent(eventName, socketId, data = {}) {
    this.debug(`Socket Event: ${eventName}`, {
      socketId,
      event: eventName,
      data: data.sessionCode || data.code || data.roomType || 'N/A'
    });
  }

  /**
   * Log API requests
   */
  logRequest(req) {
    this.info(`API Request: ${req.method} ${req.path}`, {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
  }

  /**
   * Log errors with stack trace
   */
  logError(error, context = {}) {
    this.error(error.message, {
      ...context,
      stack: error.stack,
      code: error.code
    });
  }

  /**
   * Create child logger with context
   */
  child(context) {
    const childLogger = Object.create(this);
    childLogger.defaultContext = context;
    
    // Override log method to include context
    childLogger.log = (level, message, meta = {}) => {
      this.log(level, message, { ...this.defaultContext, ...context, ...meta });
    };
    
    return childLogger;
  }
}

// Create singleton instance
const logger = new Logger();

// Express middleware for request logging
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path} ${res.statusCode}`, {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip
    });
  });
  
  next();
};

// Socket.IO middleware for event logging
const socketLogger = (socket, next) => {
  const originalEmit = socket.emit;
  const originalOn = socket.on;
  
  // Log outgoing events
  socket.emit = function(event, ...args) {
    logger.logSocketEvent(`EMIT: ${event}`, socket.id);
    return originalEmit.apply(socket, [event, ...args]);
  };
  
  // Log incoming events
  socket.on = function(event, handler) {
    const wrappedHandler = (...args) => {
      logger.logSocketEvent(`ON: ${event}`, socket.id);
      return handler(...args);
    };
    return originalOn.apply(socket, [event, wrappedHandler]);
  };
  
  next();
};

module.exports = {
  logger,
  requestLogger,
  socketLogger
};