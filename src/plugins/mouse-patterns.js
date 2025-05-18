/**
 * Advanced mouse movement patterns for human-like behavior
 * This plugin creates highly realistic mouse movements to avoid detection
 */

const { randomInteger, randomFloat } = require('../utils/helpers');
const logger = require('../utils/logger');

/**
 * Provides natural mouse movement simulation using various algorithms
 */
class MousePatterns {
  constructor() {
    // Gravity constants for mouse movement
    this.GRAVITY = 9.8;
    this.MASS = 15;
    
    // Default deviation values
    this.defaultDeviation = 0.08;
    
    // Types of mouse movement patterns
    this.movementTypes = [
      'bezier', // Smooth bezier curve movement (most common)
      'overshoot', // Overshoot target and correct (common for humans)
      'gradual', // Gradual acceleration/deceleration (deliberate movement)
      'tremor', // Slight tremors during movement (indicates human nervousness)
      'correction' // Makes small corrections at the end (very human-like)
    ];
  }
  
  /**
   * Get random movement pattern type with weighted distribution
   * @returns {string} - Movement pattern type
   */
  getRandomMovementType() {
    // Weighted distribution - bezier is most common
    const weights = {
      'bezier': 0.6,
      'overshoot': 0.15,
      'gradual': 0.1,
      'tremor': 0.05,
      'correction': 0.1
    };
    
    const random = Math.random();
    let cumulativeWeight = 0;
    
    for (const type in weights) {
      cumulativeWeight += weights[type];
      if (random <= cumulativeWeight) {
        return type;
      }
    }
    
    return 'bezier'; // Default fallback
  }
  
  /**
   * Get mouse movement points based on specified or random pattern
   * @param {number} startX - Start X coordinate
   * @param {number} startY - Start Y coordinate
   * @param {number} endX - End X coordinate
   * @param {number} endY - End Y coordinate
   * @param {string} [type] - Movement pattern type (optional, random if not specified)
   * @param {Object} [options] - Additional options for the movement
   * @returns {Array<{x: number, y: number, delay: number}>} - Movement points with timing
   */
  getMovementPoints(startX, startY, endX, endY, type = null, options = {}) {
    // Use provided type or get random one
    const movementType = type || this.getRandomMovementType();
    
    // Default options
    const defaultOptions = {
      steps: randomInteger(25, 40),
      deviation: this.defaultDeviation,
      overshootMultiplier: 1.1,
      targetPrecision: randomInteger(1, 5),
      tremor: randomFloat(0.5, 2.0)
    };
    
    const mergedOptions = { ...defaultOptions, ...options };
    
    // Generate points based on movement type
    switch (movementType) {
      case 'bezier':
        return this._generateBezierMovement(startX, startY, endX, endY, mergedOptions);
      case 'overshoot':
        return this._generateOvershootMovement(startX, startY, endX, endY, mergedOptions);
      case 'gradual':
        return this._generateGradualMovement(startX, startY, endX, endY, mergedOptions);
      case 'tremor':
        return this._generateTremorMovement(startX, startY, endX, endY, mergedOptions);
      case 'correction':
        return this._generateCorrectionMovement(startX, startY, endX, endY, mergedOptions);
      default:
        return this._generateBezierMovement(startX, startY, endX, endY, mergedOptions);
    }
  }
  
  /**
   * Generate Bezier curve mouse movement (smooth and natural)
   * @param {number} startX - Start X coordinate
   * @param {number} startY - Start Y coordinate
   * @param {number} endX - End X coordinate
   * @param {number} endY - End Y coordinate
   * @param {Object} options - Movement options
   * @returns {Array<{x: number, y: number, delay: number}>} - Movement points with timing
   * @private
   */
  _generateBezierMovement(startX, startY, endX, endY, options) {
    const points = [];
    const { steps, deviation } = options;
    
    // Calculate distance for delay scaling
    const distance = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
    
    // Generate control points with some randomness
    const cp1x = startX + (endX - startX) * (0.3 + randomFloat(-0.1, 0.1));
    const cp1y = startY + (endY - startY) * (0.1 + randomFloat(-0.1, 0.1));
    const cp2x = startX + (endX - startX) * (0.7 + randomFloat(-0.1, 0.1));
    const cp2y = startY + (endY - startY) * (0.9 + randomFloat(-0.1, 0.1));
    
    // Calculate points along the Bezier curve
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      
      // Cubic Bezier formula
      const x = Math.pow(1 - t, 3) * startX +
                3 * Math.pow(1 - t, 2) * t * cp1x +
                3 * (1 - t) * Math.pow(t, 2) * cp2x +
                Math.pow(t, 3) * endX;
                
      const y = Math.pow(1 - t, 3) * startY +
                3 * Math.pow(1 - t, 2) * t * cp1y +
                3 * (1 - t) * Math.pow(t, 2) * cp2y +
                Math.pow(t, 3) * endY;
      
      // Add small random deviation to simulate human imprecision
      const deviationX = distance * deviation * (Math.random() - 0.5);
      const deviationY = distance * deviation * (Math.random() - 0.5);
      
      // Calculate speed - slower at start and end, faster in the middle
      const speedFactor = 1 - 4 * Math.pow(t - 0.5, 2); // Parabolic speed profile
      const baseDelay = distance / 1000 * (50 + randomFloat(-20, 20));
      const delay = baseDelay * (1 - speedFactor * 0.5);
      
      points.push({
        x: Math.round(x + deviationX),
        y: Math.round(y + deviationY),
        delay: Math.max(5, Math.round(delay))
      });
    }
    
    return points;
  }
  
  /**
   * Generate overshoot movement (goes past target and then corrects)
   * @param {number} startX - Start X coordinate
   * @param {number} startY - Start Y coordinate
   * @param {number} endX - End X coordinate
   * @param {number} endY - End Y coordinate
   * @param {Object} options - Movement options
   * @returns {Array<{x: number, y: number, delay: number}>} - Movement points with timing
   * @private
   */
  _generateOvershootMovement(startX, startY, endX, endY, options) {
    const { steps, overshootMultiplier } = options;
    
    // Calculate overshoot point (beyond the target)
    const overshootX = startX + (endX - startX) * overshootMultiplier;
    const overshootY = startY + (endY - startY) * overshootMultiplier;
    
    // First movement to overshoot point (using about 2/3 of the steps)
    const firstMovement = this._generateBezierMovement(
      startX, startY, overshootX, overshootY, { steps: Math.floor(steps * 0.6) }
    );
    
    // Second movement to correct back to target (using remaining steps)
    const secondMovement = this._generateBezierMovement(
      overshootX, overshootY, endX, endY, { steps: Math.floor(steps * 0.4) }
    );
    
    // Combine movements (remove duplicate point)
    return [...firstMovement, ...secondMovement.slice(1)];
  }
  
  /**
   * Generate gradual movement (slow start, fast middle, slow end)
   * @param {number} startX - Start X coordinate
   * @param {number} startY - Start Y coordinate
   * @param {number} endX - End X coordinate
   * @param {number} endY - End Y coordinate
   * @param {Object} options - Movement options
   * @returns {Array<{x: number, y: number, delay: number}>} - Movement points with timing
   * @private
   */
  _generateGradualMovement(startX, startY, endX, endY, options) {
    const points = [];
    const { steps } = options;
    
    // Calculate distance for delay scaling
    const distance = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
    
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      
      // Use an ease-in-out function for more pronounced acceleration/deceleration
      const easedT = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      
      // Linear interpolation with easing
      const x = startX + (endX - startX) * easedT;
      const y = startY + (endY - startY) * easedT;
      
      // Calculate delay - much slower at endpoints
      const speedProfile = 0.3 + 1.4 * Math.sin(t * Math.PI); // Slower at endpoints
      const baseDelay = distance / 2000 * (80 + randomFloat(-10, 10));
      const delay = baseDelay / speedProfile;
      
      points.push({
        x: Math.round(x),
        y: Math.round(y),
        delay: Math.max(5, Math.round(delay))
      });
    }
    
    return points;
  }
  
  /**
   * Generate tremor movement (slight shaking during movement)
   * @param {number} startX - Start X coordinate
   * @param {number} startY - Start Y coordinate
   * @param {number} endX - End X coordinate
   * @param {number} endY - End Y coordinate
   * @param {Object} options - Movement options
   * @returns {Array<{x: number, y: number, delay: number}>} - Movement points with timing
   * @private
   */
  _generateTremorMovement(startX, startY, endX, endY, options) {
    const { steps, tremor } = options;
    
    // Get base movement using bezier
    const baseMovement = this._generateBezierMovement(startX, startY, endX, endY, options);
    
    // Add tremors to the base movement
    return baseMovement.map(point => {
      // Amplitude of tremor increases in the middle of the movement
      const progress = baseMovement.indexOf(point) / baseMovement.length;
      const tremorFactor = tremor * Math.sin(progress * Math.PI); // Peak in the middle
      
      // Add tremor using perlin-like noise (approximated with sin)
      const tremorX = tremorFactor * Math.sin(progress * 10) * randomFloat(-3, 3);
      const tremorY = tremorFactor * Math.sin(progress * 15) * randomFloat(-3, 3);
      
      return {
        x: Math.round(point.x + tremorX),
        y: Math.round(point.y + tremorY),
        delay: point.delay
      };
    });
  }
  
  /**
   * Generate correction movement (makes small adjustments near the target)
   * @param {number} startX - Start X coordinate
   * @param {number} startY - Start Y coordinate
   * @param {number} endX - End X coordinate
   * @param {number} endY - End Y coordinate
   * @param {Object} options - Movement options
   * @returns {Array<{x: number, y: number, delay: number}>} - Movement points with timing
   * @private
   */
  _generateCorrectionMovement(startX, startY, endX, endY, options) {
    const { steps, targetPrecision } = options;
    
    // Get base movement using bezier (using 3/4 of the steps)
    const baseMovement = this._generateBezierMovement(
      startX, startY, endX, endY, 
      { ...options, steps: Math.floor(steps * 0.75) }
    );
    
    // Last point of the base movement
    const lastPoint = baseMovement[baseMovement.length - 1];
    
    // Generate correction points (small adjustments towards the target)
    const correctionPoints = [];
    let currentX = lastPoint.x;
    let currentY = lastPoint.y;
    
    // Number of correction points
    const numCorrections = randomInteger(2, 4);
    
    for (let i = 0; i < numCorrections; i++) {
      // Move closer to target with each correction
      const progress = (i + 1) / numCorrections;
      const correctionX = currentX + (endX - currentX) * progress;
      const correctionY = currentY + (endY - currentY) * progress;
      
      // Add small random deviation
      const precisionFactor = progress * targetPrecision; // Increases precision as we get closer
      const maxDeviation = Math.max(1, 10 - precisionFactor);
      
      correctionPoints.push({
        x: Math.round(correctionX + randomFloat(-maxDeviation, maxDeviation)),
        y: Math.round(correctionY + randomFloat(-maxDeviation, maxDeviation)),
        delay: randomInteger(60, 150) // Slower for corrections
      });
      
      currentX = correctionX;
      currentY = correctionY;
    }
    
    // Final exact point
    correctionPoints.push({
      x: endX,
      y: endY,
      delay: randomInteger(30, 80)
    });
    
    return [...baseMovement, ...correctionPoints];
  }
  
  /**
   * Simulates human attention patterns by generating focus points around a target
   * @param {number} targetX - Target X coordinate
   * @param {number} targetY - Target Y coordinate
   * @param {number} radius - Radius around target to consider
   * @param {number} numPoints - Number of focus points to generate
   * @returns {Array<{x: number, y: number}>} - Focus points
   */
  generateFocusPoints(targetX, targetY, radius = 50, numPoints = 5) {
    const points = [];
    
    // Generate points with higher concentration closer to target
    for (let i = 0; i < numPoints; i++) {
      // Use square root to bias towards the center
      const distance = radius * Math.sqrt(Math.random());
      const angle = Math.random() * Math.PI * 2;
      
      const x = Math.round(targetX + distance * Math.cos(angle));
      const y = Math.round(targetY + distance * Math.sin(angle));
      
      points.push({ x, y });
    }
    
    return points;
  }
  
  /**
   * Generate mouse click timings (down and up events)
   * @param {string} clickType - Type of click ('single', 'double', 'triple', 'right')
   * @returns {Array<number>} - Array of timings for mouse events
   */
  generateClickTimings(clickType = 'single') {
    const timings = [];
    
    switch (clickType) {
      case 'single':
        // Down timing
        timings.push(0);
        // Up timing (typical human click is 70-150ms)
        timings.push(randomInteger(70, 150));
        break;
        
      case 'double':
        // First click
        timings.push(0); // First down
        timings.push(randomInteger(60, 120)); // First up
        
        // Interval between clicks (typically 70-200ms)
        const interval = randomInteger(70, 200);
        
        // Second click
        timings.push(timings[1] + interval); // Second down
        timings.push(timings[2] + randomInteger(60, 120)); // Second up
        break;
        
      case 'triple':
        // First click
        timings.push(0); // First down
        timings.push(randomInteger(60, 120)); // First up
        
        // Intervals between clicks
        const interval1 = randomInteger(70, 150);
        const interval2 = randomInteger(70, 150);
        
        // Second click
        timings.push(timings[1] + interval1); // Second down
        timings.push(timings[2] + randomInteger(60, 120)); // Second up
        
        // Third click
        timings.push(timings[3] + interval2); // Third down
        timings.push(timings[4] + randomInteger(60, 120)); // Third up
        break;
        
      case 'right':
        // Right clicks tend to be slightly longer
        timings.push(0); // Down
        timings.push(randomInteger(100, 180)); // Up
        break;
        
      case 'drag':
        // Down timing
        timings.push(0);
        // For drag, up timing happens after movement (300-2000ms)
        timings.push(randomInteger(300, 2000));
        break;
    }
    
    return timings;
  }
}

module.exports = new MousePatterns();