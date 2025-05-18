/**
 * Enhanced logger with multiple log levels and formatting
 */
class Logger {
  constructor(options = {}) {
    this.options = {
      enableTimestamp: true,
      colorize: true,
      logLevel: 'info', // debug, info, warn, error
      ...options
    };
    
    this.logLevels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
    
    this.colors = {
      reset: '\x1b[0m',
      debug: '\x1b[36m', // Cyan
      info: '\x1b[32m',  // Green
      warn: '\x1b[33m',  // Yellow
      error: '\x1b[31m', // Red
      time: '\x1b[90m'   // Gray
    };
  }
  
  shouldLog(level) {
    return this.logLevels[level] >= this.logLevels[this.options.logLevel];
  }
  
  formatMessage(level, message, accountId) {
    let formattedMessage = '';
    
    // Add timestamp if enabled
    if (this.options.enableTimestamp) {
      const timestamp = new Date().toISOString();
      if (this.options.colorize) {
        formattedMessage += `${this.colors.time}[${timestamp}]${this.colors.reset} `;
      } else {
        formattedMessage += `[${timestamp}] `;
      }
    }
    
    // Add log level
    if (this.options.colorize) {
      formattedMessage += `${this.colors[level]}[${level.toUpperCase()}]${this.colors.reset} `;
    } else {
      formattedMessage += `[${level.toUpperCase()}] `;
    }
    
    // Add account ID if provided
    if (accountId) {
      formattedMessage += `[${accountId}] `;
    }
    
    // Add the message
    formattedMessage += message;
    
    return formattedMessage;
  }
  
  debug(message, accountId) {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message, accountId));
    }
  }
  
  info(message, accountId) {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message, accountId));
    }
  }
  
  warn(message, accountId) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, accountId));
    }
  }
  
  error(message, accountId, error) {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, accountId));
      if (error && error.stack) {
        console.error(error.stack);
      }
    }
  }
  
  // Simple backwards compatibility with older code
  log(message, accountId) {
    this.info(message, accountId);
  }
}

// Create and export a singleton instance for app-wide usage
const logger = new Logger();

module.exports = logger;
