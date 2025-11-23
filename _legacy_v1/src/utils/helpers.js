/**
 * Helper utility functions
 */

/**
 * Delay execution for a specified time
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise} - Promise that resolves after the delay
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a random integer between min and max (inclusive)
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} - Random integer
 */
function randomInteger(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate a random float between min and max
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} - Random float
 */
function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

/**
 * Select a random item from an array
 * @param {Array} array - Input array
 * @returns {*} - Random item from the array
 */
function randomItem(array) {
  if (!array || array.length === 0) return null;
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Shuffles an array in place
 * @param {Array} array - Array to shuffle
 * @returns {Array} - Shuffled array (same reference)
 */
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Format a date as YYYY-MM-DD HH:MM:SS
 * @param {Date} date - Date to format
 * @returns {string} - Formatted date string
 */
function formatDate(date) {
  const d = date || new Date();
  
  const pad = (num) => num.toString().padStart(2, '0');
  
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry options
 * @param {number} options.retries - Number of retries
 * @param {number} options.minDelay - Minimum delay in ms
 * @param {number} options.maxDelay - Maximum delay in ms
 * @param {number} options.factor - Exponential factor
 * @param {Function} options.onRetry - Called on retry
 * @returns {Promise} - Promise resolving to the function result
 */
async function retry(fn, options = {}) {
  const {
    retries = 3,
    minDelay = 500,
    maxDelay = 5000,
    factor = 2,
    onRetry = () => {}
  } = options;
  
  let attempt = 0;
  
  async function attempt_fn() {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      
      if (attempt >= retries) {
        throw error;
      }
      
      const delay = Math.min(
        Math.max(minDelay * Math.pow(factor, attempt), minDelay),
        maxDelay
      );
      
      onRetry(error, attempt + 1, delay);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return attempt_fn();
    }
  }
  
  return attempt_fn();
}

/**
 * Sleep for a random amount of time within a range
 * @param {number} minMs - Minimum milliseconds
 * @param {number} maxMs - Maximum milliseconds
 * @returns {Promise} - Promise that resolves after the delay
 */
function randomSleep(minMs, maxMs) {
  const ms = randomInteger(minMs, maxMs);
  return delay(ms);
}

/**
 * Checks if a string is valid JSON
 * @param {string} str - String to check
 * @returns {boolean} - Whether the string is valid JSON
 */
function isValidJson(str) {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Safe JSON parse with fallback
 * @param {string} str - String to parse
 * @param {*} fallback - Fallback value if parsing fails
 * @returns {*} - Parsed JSON or fallback
 */
function safeJsonParse(str, fallback = {}) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return fallback;
  }
}

module.exports = {
  delay,
  randomInteger,
  randomFloat,
  randomItem,
  shuffleArray,
  formatDate,
  retry,
  randomSleep,
  isValidJson,
  safeJsonParse
};