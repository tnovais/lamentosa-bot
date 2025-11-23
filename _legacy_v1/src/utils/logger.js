const fs = require('fs');
const path = require('path');
const { formatDate } = require('./helpers');

// Ensure logs directory exists
const logsDir = path.resolve('logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Generate log filename with date
const getLogFilename = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return path.join(logsDir, `bot_${year}-${month}-${day}.log`);
};

/**
 * Log levels
 */
const LOG_LEVELS = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR'
};

/**
 * Format log message
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {string} [accountId] - Account identifier
 * @param {Error} [error] - Error object
 * @returns {string} - Formatted log message
 */
function formatLogMessage(level, message, accountId, error) {
  const timestamp = formatDate ? formatDate() : new Date().toISOString();
  let logMessage = `[${timestamp}] [${level}]`;
  
  if (accountId) {
    logMessage += ` [${accountId}]`;
  }
  
  logMessage += ` ${message}`;
  
  if (error) {
    logMessage += `\nError: ${error.message}`;
    if (error.stack) {
      logMessage += `\nStack: ${error.stack}`;
    }
  }
  
  return logMessage;
}

/**
 * Write log to file
 * @param {string} message - Log message
 */
function writeToFile(message) {
  const logFilename = getLogFilename();
  fs.appendFileSync(logFilename, message + '\n');
}

/**
 * Log message
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {string} [accountId] - Account identifier
 * @param {Error} [error] - Error object
 */
function log(level, message, accountId, error) {
  const formattedMessage = formatLogMessage(level, message, accountId, error);
  
  // Log to console
  switch (level) {
    case LOG_LEVELS.DEBUG:
      console.debug(formattedMessage);
      break;
    case LOG_LEVELS.INFO:
      console.info(formattedMessage);
      break;
    case LOG_LEVELS.WARN:
      console.warn(formattedMessage);
      break;
    case LOG_LEVELS.ERROR:
      console.error(formattedMessage);
      break;
    default:
      console.log(formattedMessage);
  }
  
  // Log to file
  writeToFile(formattedMessage);
}

/**
 * Log debug message
 * @param {string} message - Log message
 * @param {string} [accountId] - Account identifier
 * @param {Error} [error] - Error object
 */
function debug(message, accountId, error) {
  log(LOG_LEVELS.DEBUG, message, accountId, error);
}

/**
 * Log info message
 * @param {string} message - Log message
 * @param {string} [accountId] - Account identifier
 * @param {Error} [error] - Error object
 */
function info(message, accountId, error) {
  log(LOG_LEVELS.INFO, message, accountId, error);
}

/**
 * Log warning message
 * @param {string} message - Log message
 * @param {string} [accountId] - Account identifier
 * @param {Error} [error] - Error object
 */
function warn(message, accountId, error) {
  log(LOG_LEVELS.WARN, message, accountId, error);
}

/**
 * Log error message
 * @param {string} message - Log message
 * @param {string} [accountId] - Account identifier
 * @param {Error} [error] - Error object
 */
function error(message, accountId, error) {
  log(LOG_LEVELS.ERROR, message, accountId, error);
}

module.exports = {
  debug,
  info,
  warn,
  error
};