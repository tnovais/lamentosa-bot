const { TIMING } = require('../config');
const logger = require('../utils/logger');
const { randomInteger, randomFloat, delay } = require('../utils/helpers');

/**
 * Provides human-like interaction patterns for browser automation
 */
class HumanInteraction {
  constructor() {
    // Pode inicializar algumas configurações aqui se necessário
  }
  
  /**
   * Simulate realistic mouse movement using advanced patterns
   * @param {Object} page - Puppeteer page object
   * @param {Object} element - Element to move to
   * @param {string} accountId - Account identifier
   * @param {Object} options - Optional movement configuration
   */
  async simulateMouseMove(page, element, accountId, options = {}) {
    try {
      const { deterministicMode = false, jitter = true } = options;
      
      logger.debug(`Simulating human-like mouse movement for ${accountId}`);
      
      // Get element position and dimensions
      const elementHandle = await element.boundingBox();
      
      if (!elementHandle) {
        logger.warn(`Could not get bounding box for element (account ${accountId})`);
        return;
      }
      
      // Get current mouse position
      const currentPosition = await page.evaluate(() => ({
        x: window.mouseX || 0,
        y: window.mouseY || 0
      }));
      
      // Calculate target position (slightly randomized within element bounds)
      const targetX = elementHandle.x + elementHandle.width * (deterministicMode ? 0.5 : randomFloat(0.3, 0.7));
      const targetY = elementHandle.y + elementHandle.height * (deterministicMode ? 0.5 : randomFloat(0.3, 0.7));
      
      // Calculate a curved path using Bézier curves for natural movement
      const points = this._getBezierCurvePoints(
        currentPosition.x, 
        currentPosition.y, 
        targetX, 
        targetY, 
        deterministicMode ? 5 : randomInteger(3, 7) // Number of control points
      );
      
      // Add small random jitter to each point for even more realism
      if (jitter && !deterministicMode) {
        points.forEach((point, index) => {
          if (index > 0 && index < points.length - 1) { // Don't modify start/end points
            const jitterAmount = 5;
            point.x += randomInteger(-jitterAmount, jitterAmount);
            point.y += randomInteger(-jitterAmount, jitterAmount);
          }
        });
      }
      
      // Move through each point with realistic acceleration and deceleration
      for (let i = 0; i < points.length; i++) {
        const point = points[i];
        
        // More points near the beginning and end of the movement for acceleration/deceleration
        const pointIndex = i / (points.length - 1);
        let moveDelay;
        
        if (pointIndex < 0.2) {
          // Acceleration phase - slower at start
          moveDelay = randomInteger(TIMING.MOUSE_MOVE_MIN * 1.5, TIMING.MOUSE_MOVE_MAX * 1.5);
        } else if (pointIndex > 0.8) {
          // Deceleration phase - slowing down as approaching target
          moveDelay = randomInteger(TIMING.MOUSE_MOVE_MIN * 1.3, TIMING.MOUSE_MOVE_MAX * 1.3);
        } else {
          // Cruising phase - normal movement speed
          moveDelay = randomInteger(TIMING.MOUSE_MOVE_MIN, TIMING.MOUSE_MOVE_MAX);
        }
        
        // Move to this point
        await page.mouse.move(point.x, point.y);
        
        // Update window variables to track the mouse position
        await page.evaluate(({x, y}) => {
          window.mouseX = x;
          window.mouseY = y;
        }, {x: point.x, y: point.y});
        
        // Delay between moves with some randomness
        if (i < points.length - 1) {
          await delay(moveDelay);
        }
      }
      
      logger.debug(`Mouse movement completed for ${accountId}`);
    } catch (error) {
      logger.error(`Error simulating mouse movement for ${accountId}: ${error.message}`, accountId, error);
      // Fallback to direct move in case of error
      try {
        await element.hover();
        logger.debug(`Fallback to direct hover for ${accountId}`);
      } catch (fallbackError) {
        logger.error(`Even fallback hover failed for ${accountId}: ${fallbackError.message}`, accountId, fallbackError);
        throw fallbackError;
      }
    }
  }
  
  /**
   * Simulate realistic typing with variable speed and natural mistakes
   * @param {Object} page - Puppeteer page object
   * @param {Object} element - Element to type into
   * @param {string} text - Text to type
   * @param {string} accountId - Account identifier
   * @param {Object} options - Optional typing configuration
   */
  async simulateTyping(page, element, text, accountId, options = {}) {
    try {
      const { 
        deterministicMode = false, 
        makeErrors = true, 
        minDelay = TIMING.TYPE_MIN,
        maxDelay = TIMING.TYPE_MAX
      } = options;
      
      logger.debug(`Simulating human-like typing for ${accountId}`);
      
      // First, click on the element to focus it
      await element.click();
      
      // For each character in the text
      let index = 0;
      while (index < text.length) {
        // Determine whether to make a typo (5% chance if makeErrors is true)
        const makeTypo = makeErrors && !deterministicMode && Math.random() < 0.05;
        
        if (makeTypo) {
          // Type an incorrect character (adjacent key on keyboard)
          const correctChar = text[index];
          const typoChar = this._getAdjacentKey(correctChar);
          
          await page.keyboard.press(typoChar);
          
          // Short delay after typo
          await delay(randomInteger(minDelay, maxDelay));
          
          // Delete the typo
          await page.keyboard.press('Backspace');
          
          // Another short delay
          await delay(randomInteger(minDelay * 1.5, maxDelay * 1.5));
          
          // Now type the correct character
          await page.keyboard.press(correctChar);
        } else {
          // Type the correct character
          await page.keyboard.press(text[index]);
          index++;
        }
        
        // Variable delay between keypresses
        const isSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(text[index - 1]);
        const isSpace = text[index - 1] === ' ';
        
        let typingDelay;
        if (isSpace) {
          // Slightly longer delay after spaces (word boundaries)
          typingDelay = randomInteger(minDelay * 1.2, maxDelay * 1.5);
        } else if (isSpecialChar) {
          // Longer delay for special characters (harder to type)
          typingDelay = randomInteger(minDelay * 1.5, maxDelay * 2);
        } else {
          // Normal delay for regular characters
          typingDelay = randomInteger(minDelay, maxDelay);
        }
        
        // Occasional longer pause (3% chance)
        if (!deterministicMode && Math.random() < 0.03) {
          typingDelay += randomInteger(300, 800);
        }
        
        await delay(typingDelay);
      }
      
      logger.debug(`Typing completed for ${accountId}`);
    } catch (error) {
      logger.error(`Error simulating typing for ${accountId}: ${error.message}`, accountId, error);
      
      // Fallback to direct typing
      try {
        await element.type(text, { delay: randomInteger(TIMING.TYPE_MIN, TIMING.TYPE_MAX) });
        logger.debug(`Fallback to direct typing for ${accountId}`);
      } catch (fallbackError) {
        logger.error(`Even fallback typing failed for ${accountId}: ${fallbackError.message}`, accountId, fallbackError);
        throw fallbackError;
      }
    }
  }
  
  /**
   * Simulate realistic form filling
   * @param {Object} page - Puppeteer page object
   * @param {Object} formData - Data to fill in form {selector: value}
   * @param {string} accountId - Account identifier
   */
  async simulateFormFilling(page, formData, accountId) {
    try {
      logger.debug(`Simulating form filling for ${accountId}`);
      
      // Get all form fields
      const fields = Object.entries(formData);
      
      // Fill fields in a natural order (not always sequential)
      // Sometimes humans jump around forms slightly
      for (let i = 0; i < fields.length; i++) {
        const [selector, value] = fields[i];
        
        // Find the element
        const element = await page.$(selector);
        if (!element) {
          logger.warn(`Could not find form field with selector: ${selector} (account ${accountId})`);
          continue;
        }
        
        // Check element type
        const tagName = await page.evaluate(el => el.tagName.toLowerCase(), element);
        const type = await page.evaluate(el => el.type?.toLowerCase(), element);
        
        // Simulate human-like interaction based on element type
        if (tagName === 'select') {
          // Select elements
          await this.simulateMouseMove(page, element, accountId);
          await element.click();
          await delay(randomInteger(300, 700));
          
          // Select the option
          await page.select(selector, value);
          
          // Wait as if reading the dropdown
          await delay(randomInteger(500, 1200));
        } else if (type === 'checkbox' || type === 'radio') {
          // Checkboxes and radio buttons
          if ((type === 'checkbox' && value === true) || type === 'radio') {
            await this.simulateMouseMove(page, element, accountId);
            await delay(randomInteger(200, 500));
            await element.click();
            await delay(randomInteger(300, 800));
          }
        } else if (type === 'file') {
          // File inputs
          await element.uploadFile(value);
          await delay(randomInteger(800, 1500));
        } else {
          // Text inputs, textareas, etc.
          await this.simulateMouseMove(page, element, accountId);
          await delay(randomInteger(200, 400));
          
          // Clear existing value if any
          await page.evaluate(el => el.value = '', element);
          
          // Type the value with human-like typing
          await this.simulateTyping(page, element, value.toString(), accountId);
          
          // Sometimes we press Tab to move to next field
          if (i < fields.length - 1 && Math.random() < 0.7) {
            await page.keyboard.press('Tab');
            await delay(randomInteger(400, 900));
          }
        }
        
        // Random delay between filling fields
        await delay(randomInteger(500, 1500));
      }
      
      logger.debug(`Form filling completed for ${accountId}`);
    } catch (error) {
      logger.error(`Error simulating form filling for ${accountId}: ${error.message}`, accountId, error);
      throw error;
    }
  }
  
  /**
   * Simulate clicking with advanced realistic behavior
   * @param {Object} page - Puppeteer page object
   * @param {Object} element - Element to click
   * @param {Object} options - Click options
   * @param {string} accountId - Account identifier
   */
  async simulateClick(page, element, options = {}, accountId) {
    try {
      const { doubleClick = false, rightClick = false, holdTime = 0 } = options;
      
      logger.debug(`Simulating ${rightClick ? 'right' : (doubleClick ? 'double' : 'single')} click for ${accountId}`);
      
      // First, move the mouse to the element
      await this.simulateMouseMove(page, element, accountId);
      
      // Small delay before clicking (as humans do)
      await delay(randomInteger(100, 300));
      
      if (rightClick) {
        // Right click
        await page.mouse.click(
          await page.evaluate(el => {
            const rect = el.getBoundingClientRect();
            return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
          }, element),
          { button: 'right' }
        );
      } else if (doubleClick) {
        // Double click
        await element.click({ clickCount: 2 });
      } else if (holdTime > 0) {
        // Click and hold
        const elementHandle = await element.boundingBox();
        
        if (!elementHandle) {
          throw new Error('Could not get element bounding box');
        }
        
        const x = elementHandle.x + elementHandle.width / 2;
        const y = elementHandle.y + elementHandle.height / 2;
        
        await page.mouse.move(x, y);
        await page.mouse.down();
        await delay(holdTime);
        await page.mouse.up();
      } else {
        // Regular click
        await element.click();
      }
      
      logger.debug(`Click completed for ${accountId}`);
    } catch (error) {
      logger.error(`Error simulating click for ${accountId}: ${error.message}`, accountId, error);
      
      // Fallback to direct click
      try {
        await element.click();
        logger.debug(`Fallback to direct click for ${accountId}`);
      } catch (fallbackError) {
        logger.error(`Even fallback click failed for ${accountId}: ${fallbackError.message}`, accountId, fallbackError);
        throw fallbackError;
      }
    }
  }
  
  /**
   * Simulate scrolling with realistic behavior
   * @param {Object} page - Puppeteer page object
   * @param {Object} options - Scroll options
   * @param {string} accountId - Account identifier
   */
  async simulateScrolling(page, options = {}, accountId) {
    try {
      const { direction = 'down', distance = 'medium', target = null } = options;
      
      logger.debug(`Simulating scrolling (${direction}) for ${accountId}`);
      
      if (target) {
        // Scroll to specific element with smooth behavior
        await page.evaluate(el => {
          el.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }, target);
        
        await delay(randomInteger(800, 1500));
      } else {
        // Scroll based on direction and distance
        const scrollAmount = (() => {
          switch (distance) {
            case 'small': return randomInteger(100, 300);
            case 'medium': return randomInteger(300, 600);
            case 'large': return randomInteger(600, 1000);
            case 'page': return randomInteger(800, 1200);
            default: return randomInteger(300, 600);
          }
        })();
        
        const finalScrollAmount = direction === 'up' ? -scrollAmount : scrollAmount;
        
        // Simulate smooth scrolling with acceleration and deceleration
        await page.evaluate(scrollAmount => {
          const duration = 500 + Math.random() * 500; // 500-1000ms
          const startTime = Date.now();
          const startScrollY = window.scrollY;
          
          function ease(t) {
            // Cubic easing function - slow start, fast middle, slow end
            return t < 0.5
              ? 4 * t * t * t
              : 1 - Math.pow(-2 * t + 2, 3) / 2;
          }
          
          function scroll() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easedProgress = ease(progress);
            
            window.scrollTo(0, startScrollY + scrollAmount * easedProgress);
            
            if (progress < 1) {
              requestAnimationFrame(scroll);
            }
          }
          
          requestAnimationFrame(scroll);
        }, finalScrollAmount);
        
        // Wait for scrolling to complete
        await delay(randomInteger(800, 1500));
      }
      
      logger.debug(`Scrolling completed for ${accountId}`);
    } catch (error) {
      logger.error(`Error simulating scrolling for ${accountId}: ${error.message}`, accountId, error);
      
      // Fallback to direct scroll
      try {
        if (options.target) {
          await options.target.scrollIntoView();
        } else {
          const amount = options.direction === 'up' ? -300 : 300;
          await page.evaluate(amount => window.scrollBy(0, amount), amount);
        }
        logger.debug(`Fallback to direct scroll for ${accountId}`);
      } catch (fallbackError) {
        logger.error(`Even fallback scroll failed for ${accountId}: ${fallbackError.message}`, accountId, fallbackError);
        throw fallbackError;
      }
    }
  }
  
  /**
   * Simulate natural page browsing behavior
   * @param {Object} page - Puppeteer page object
   * @param {number} duration - Duration in milliseconds
   * @param {string} accountId - Account identifier
   */
  async simulateBrowsing(page, duration = 30000, accountId) {
    try {
      const startTime = Date.now();
      logger.debug(`Simulating natural browsing for ${accountId} (duration: ${duration}ms)`);
      
      while (Date.now() - startTime < duration) {
        // Choose a random action
        const action = Math.random();
        
        if (action < 0.6) {
          // 60% chance: Scroll down or up
          const direction = Math.random() < 0.8 ? 'down' : 'up'; // More likely to scroll down
          
          await this.simulateScrolling(page, { direction }, accountId);
          await delay(randomInteger(1000, 3000));
        } else if (action < 0.8) {
          // 20% chance: Find and click on a random link or button
          const elements = await page.$$('a, button');
          
          if (elements.length > 0) {
            const randIndex = Math.floor(Math.random() * elements.length);
            const element = elements[randIndex];
            
            // Check if element is visible and in viewport
            const isVisible = await page.evaluate(el => {
              const rect = el.getBoundingClientRect();
              return (
                rect.top >= 0 &&
                rect.left >= 0 &&
                rect.bottom <= window.innerHeight &&
                rect.right <= window.innerWidth &&
                window.getComputedStyle(el).visibility !== 'hidden' &&
                window.getComputedStyle(el).display !== 'none'
              );
            }, element);
            
            if (isVisible) {
              // Get the element URL if it's a link
              const isLink = await page.evaluate(el => el.tagName.toLowerCase() === 'a', element);
              const url = isLink ? await page.evaluate(el => el.href, element) : null;
              
              // Only click if it's not an external link
              const isExternal = url && !url.includes(page.url());
              
              if (!isExternal) {
                await this.simulateClick(page, element, {}, accountId);
                await delay(randomInteger(2000, 5000));
              }
            }
          }
        } else {
          // 20% chance: Pause to read
          await delay(randomInteger(3000, 7000));
        }
        
        // Short delay between actions
        await delay(randomInteger(500, 1500));
      }
      
      logger.debug(`Browsing simulation completed for ${accountId}`);
    } catch (error) {
      logger.error(`Error simulating browsing for ${accountId}: ${error.message}`, accountId, error);
    }
  }
  
  /**
   * Get Bézier curve points for natural mouse movement
   * @param {number} startX - Starting X coordinate
   * @param {number} startY - Starting Y coordinate
   * @param {number} endX - Ending X coordinate
   * @param {number} endY - Ending Y coordinate
   * @param {number} numPoints - Number of control points
   * @returns {Array<{x: number, y: number}>} - Array of points along the curve
   * @private
   */
  _getBezierCurvePoints(startX, startY, endX, endY, numPoints) {
    const points = [];
    
    // Create control points for the Bézier curve
    const cp1x = startX + (endX - startX) * (1/3) + randomInteger(-50, 50);
    const cp1y = startY + (endY - startY) * (1/3) + randomInteger(-50, 50);
    const cp2x = startX + (endX - startX) * (2/3) + randomInteger(-50, 50);
    const cp2y = startY + (endY - startY) * (2/3) + randomInteger(-50, 50);
    
    // Calculate points along the curve
    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      
      // Cubic Bézier curve formula
      const x = Math.pow(1 - t, 3) * startX + 
                3 * Math.pow(1 - t, 2) * t * cp1x + 
                3 * (1 - t) * Math.pow(t, 2) * cp2x + 
                Math.pow(t, 3) * endX;
                
      const y = Math.pow(1 - t, 3) * startY + 
                3 * Math.pow(1 - t, 2) * t * cp1y + 
                3 * (1 - t) * Math.pow(t, 2) * cp2y + 
                Math.pow(t, 3) * endY;
      
      points.push({ x: Math.round(x), y: Math.round(y) });
    }
    
    return points;
  }
  
  /**
   * Get an adjacent key on the keyboard for realistic typos
   * @param {string} key - Original key
   * @returns {string} - Adjacent key
   * @private
   */
  _getAdjacentKey(key) {
    const keyboardLayout = {
      'q': ['w', '1', 'a'],
      'w': ['q', 'e', '2', 's', 'a'],
      'e': ['w', 'r', '3', 'd', 's'],
      'r': ['e', 't', '4', 'f', 'd'],
      't': ['r', 'y', '5', 'g', 'f'],
      'y': ['t', 'u', '6', 'h', 'g'],
      'u': ['y', 'i', '7', 'j', 'h'],
      'i': ['u', 'o', '8', 'k', 'j'],
      'o': ['i', 'p', '9', 'l', 'k'],
      'p': ['o', '0', '[', 'l'],
      'a': ['q', 'w', 's', 'z'],
      's': ['a', 'w', 'e', 'd', 'x', 'z'],
      'd': ['s', 'e', 'r', 'f', 'c', 'x'],
      'f': ['d', 'r', 't', 'g', 'v', 'c'],
      'g': ['f', 't', 'y', 'h', 'b', 'v'],
      'h': ['g', 'y', 'u', 'j', 'n', 'b'],
      'j': ['h', 'u', 'i', 'k', 'm', 'n'],
      'k': ['j', 'i', 'o', 'l', ',', 'm'],
      'l': ['k', 'o', 'p', ';', '.', ','],
      'z': ['a', 's', 'x'],
      'x': ['z', 's', 'd', 'c'],
      'c': ['x', 'd', 'f', 'v'],
      'v': ['c', 'f', 'g', 'b'],
      'b': ['v', 'g', 'h', 'n'],
      'n': ['b', 'h', 'j', 'm'],
      'm': ['n', 'j', 'k', ','],
      ',': ['m', 'k', 'l', '.'],
      '.': [',', 'l', '/'],
      '1': ['2', 'q'],
      '2': ['1', '3', 'q', 'w'],
      '3': ['2', '4', 'w', 'e'],
      '4': ['3', '5', 'e', 'r'],
      '5': ['4', '6', 'r', 't'],
      '6': ['5', '7', 't', 'y'],
      '7': ['6', '8', 'y', 'u'],
      '8': ['7', '9', 'u', 'i'],
      '9': ['8', '0', 'i', 'o'],
      '0': ['9', '-', 'o', 'p'],
      ' ': ['c', 'v', 'b', 'n', 'm']
    };
    
    // Convert to lowercase for lookup
    const lowercaseKey = key.toLowerCase();
    
    // If the key is in our layout, return a random adjacent key
    if (keyboardLayout[lowercaseKey]) {
      const adjacentKeys = keyboardLayout[lowercaseKey];
      const randomKey = adjacentKeys[Math.floor(Math.random() * adjacentKeys.length)];
      
      // Preserve case
      return key === key.toUpperCase() ? randomKey.toUpperCase() : randomKey;
    }
    
    // If the key is not in our layout, return the original key
    return key;
  }
}

module.exports = HumanInteraction;