/**
 * Utility functions for the bot
 */

/**
 * Returns a promise that resolves after the specified milliseconds
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Returns a random delay with exponential distribution
 * @param {number} minDelay - Minimum delay in milliseconds
 * @param {number} maxDelay - Maximum delay in milliseconds
 * @returns {Promise<void>}
 */
const naturalDelay = async (minDelay = 2000, maxDelay = 7000) => {
  const delayMs = Math.pow(Math.random(), 2) * (maxDelay - minDelay) + minDelay;
  await delay(delayMs);
};

/**
 * Returns a random integer between min and max (inclusive)
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number}
 */
const randomInteger = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

/**
 * Returns a random item from an array
 * @param {Array} array - The array to pick from
 * @returns {*}
 */
const randomItem = (array) => {
  return array[Math.floor(Math.random() * array.length)];
};

/**
 * Formats a timestamp for filenames
 * @returns {string}
 */
const getTimestamp = () => {
  return new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
};

/**
 * Shuffles an array using Fisher-Yates algorithm
 * @param {Array} array - The array to shuffle
 * @returns {Array}
 */
const shuffleArray = (array) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

/**
 * Returns a random float between min and max
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number}
 */
const randomFloat = (min, max) => {
  return Math.random() * (max - min) + min;
};

/**
 * Returns a random boolean with given probability of true
 * @param {number} probability - Probability of returning true (0-1)
 * @returns {boolean}
 */
const randomBoolean = (probability = 0.5) => {
  return Math.random() < probability;
};

/**
 * Generate a delay with normal distribution (bell curve)
 * @param {number} mean - Mean value
 * @param {number} stdDev - Standard deviation
 * @returns {number}
 */
const normalDistributionDelay = (mean, stdDev) => {
  // Box-Muller transform for normal distribution
  const u1 = 1 - Math.random();
  const u2 = 1 - Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  // Convert to desired mean and standard deviation
  return Math.max(0, Math.round(z * stdDev + mean));
};

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in ms
 * @param {Function} onRetry - Function to call on retry
 * @returns {Promise<*>}
 */
const retry = async (fn, maxRetries = 3, baseDelay = 1000, onRetry = null) => {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const delayMs = baseDelay * Math.pow(2, attempt) * (0.5 + Math.random());
        if (onRetry) onRetry(error, attempt, delayMs);
        await delay(delayMs);
      }
    }
  }
  throw lastError;
};

/**
 * Format a number with commas as thousands separators
 * @param {number} number - Number to format
 * @returns {string}
 */
const formatNumber = (number) => {
  return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

/**
 * Calculate Bezier points for mouse movement
 * @param {number} startX - Starting X position
 * @param {number} startY - Starting Y position
 * @param {number} endX - Ending X position
 * @param {number} endY - Ending Y position
 * @param {number} steps - Number of steps
 * @returns {Array<{x: number, y: number}>}
 */
const getBezierPoints = (startX, startY, endX, endY, steps) => {
  const cp1x = startX + (endX - startX) * (0.3 + Math.random() * 0.4);
  const cp1y = startY + (endY - startY) * (0.3 + Math.random() * 0.4);
  const cp2x = startX + (endX - startX) * (0.6 + Math.random() * 0.4);
  const cp2y = startY + (endY - startY) * (0.6 + Math.random() * 0.4);
  const points = [];
  for (let t = 0; t <= 1; t += 1 / steps) {
    const x = (1 - t) ** 3 * startX + 3 * (1 - t) ** 2 * t * cp1x + 3 * (1 - t) * t ** 2 * cp2x + t ** 3 * endX;
    const y = (1 - t) ** 3 * startY + 3 * (1 - t) ** 2 * t * cp1y + 3 * (1 - t) * t ** 2 * cp2y + t ** 3 * endY;
    points.push({ x, y });
  }
  return points;
};

module.exports = {
  delay,
  naturalDelay,
  randomInteger,
  randomItem,
  getTimestamp,
  shuffleArray,
  randomFloat,
  randomBoolean,
  normalDistributionDelay,
  retry,
  formatNumber,
  getBezierPoints
};
