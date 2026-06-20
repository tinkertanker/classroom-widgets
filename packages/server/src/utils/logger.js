const fs = require('fs');
const path = require('path');
const util = require('util');

class Logger {
  constructor(options = {}) {
    this.options = {
      level: process.env.LOG_LEVEL || 'info',
      writeToFile: process.env.NODE_ENV === 'production',
      logDir: path.join(__dirname, '../../logs'),
      maxFileSize: 10 * 1024 * 1024, // 10MB
      rotationCheckIntervalMs: 60 * 1000,
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

    this.lastRotationCheck = new Map();

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
   * Write to file (async; rotation check throttled to avoid per-log fs.stat).
   */
  writeToFile(level, formattedMessage) {
    if (!this.options.writeToFile) return;

    const logFile = this.getLogFilePath(level);

    const appendMessage = () => {
      fs.appendFile(logFile, formattedMessage + '\n', (error) => {
        if (error) {
          console.error(`Failed to write log file ${logFile}:`, error.message);
        }
      });
    };

    const now = Date.now();
    const lastCheck = this.lastRotationCheck.get(level) || 0;
    if (now - lastCheck < this.options.rotationCheckIntervalMs) {
      appendMessage();
      return;
    }

    this.lastRotationCheck.set(level, now);

    fs.stat(logFile, (statError, stats) => {
      if (statError || !stats) {
        appendMessage();
        return;
      }

      if (stats.size <= this.options.maxFileSize) {
        appendMessage();
        return;
      }

      const archiveFile = logFile.replace('.log', `-${Date.now()}.log`);
      fs.rename(logFile, archiveFile, (renameError) => {
        if (renameError && renameError.code !== 'ENOENT') {
          console.error(`Failed to rotate log file ${logFile}:`, renameError.message);
        }
        appendMessage();
      });
    });
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
   * Log errors with stack trace
   */
  logError(error, context = {}) {
    this.error(error.message, {
      ...context,
      stack: error.stack,
      code: error.code
    });
  }
}

// Create singleton instance
const logger = new Logger();

module.exports = {
  logger
};