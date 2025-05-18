const logger = require('../utils/logger');
const { delay, randomInteger, getBezierPoints, naturalDelay, randomFloat } = require('../utils/helpers');

/**
 * Provides human-like interaction patterns for browser automation
 */
class HumanInteraction {
  /**
   * Simulate realistic mouse movement using Bezier curves
   * @param {Object} page - Puppeteer page object
   * @param {Object} element - Element to move to
   * @param {string} accountId - Account identifier
   */
  async simulateMouseMove(page, element, accountId) {
    try {
      const box = await element.boundingBox();
      if (!box) {
        logger.warn(`Bounding box not found for element`, accountId);
        return;
      }
      
      // Starting point with some randomization
      const viewportSize = await page.viewport();
      const startX = randomInteger(100, viewportSize.width - 200);
      const startY = randomInteger(100, viewportSize.height - 200);
      
      // Target point within the element with some randomization
      const targetX = box.x + randomFloat(0.3, 0.7) * box.width;
      const targetY = box.y + randomFloat(0.3, 0.7) * box.height;
      
      // Generate Bezier curve points with more steps for smoother movement
      const steps = randomInteger(15, 35);
      const bezierPoints = getBezierPoints(startX, startY, targetX, targetY, steps);
      
      // Move to start position
      await page.mouse.move(startX, startY);
      await delay(randomInteger(50, 150));
      
      // Execute the mouse movement with variable speed
      for (let i = 0; i < bezierPoints.length; i++) {
        const { x, y } = bezierPoints[i];
        
        // Non-linear delay for more human-like movement
        // Slower at start and end, faster in the middle
        const progress = i / bezierPoints.length;
        const speedFactor = 1 - 4 * Math.pow(progress - 0.5, 2); // Parabolic speed curve
        const pointDelay = randomInteger(5, 15) + (1 - speedFactor) * randomInteger(30, 70);
        
        await page.mouse.move(x, y);
        await delay(pointDelay);
      }
      
      // Final small adjustment to target
      await page.mouse.move(
        targetX + randomFloat(-5, 5), 
        targetY + randomFloat(-5, 5),
        { steps: randomInteger(2, 5) }
      );
      
      // Small pause before clicking to simulate human behavior
      await delay(randomInteger(50, 350));
      
      logger.debug(`Mouse moved to element at (${targetX}, ${targetY})`, accountId);
    } catch (error) {
      logger.error(`Error simulating mouse movement`, accountId, error);
    }
  }
  
  /**
   * Simulate realistic typing with variable speed
   * @param {Object} page - Puppeteer page object
   * @param {Object} element - Element to type into
   * @param {string} text - Text to type
   * @param {string} accountId - Account identifier
   */
  async simulateTyping(page, element, text, accountId) {
    try {
      // Focus the element first
      await this.simulateMouseMove(page, element, accountId);
      await element.click({ delay: randomInteger(30, 100) });
      await delay(randomInteger(200, 600));
      
      // Type with variable speed
      for (let i = 0; i < text.length; i++) {
        // Simulate more typing errors and corrections for longer text
        const makeTypingError = text.length > 10 && Math.random() < 0.05;
        
        if (makeTypingError) {
          // Type a wrong character
          const wrongChar = String.fromCharCode(
            text.charCodeAt(i) + randomInteger(-2, 2)
          );
          await element.type(wrongChar, { delay: randomInteger(100, 250) });
          await delay(randomInteger(200, 500));
          
          // Delete the wrong character
          await page.keyboard.press('Backspace');
          await delay(randomInteger(300, 700));
        }
        
        // Determine typing speed with occasional pauses
        let typingDelay;
        
        // Occasional longer pause (like thinking)
        if (Math.random() < 0.1) {
          await delay(randomInteger(500, 2000));
          typingDelay = randomInteger(50, 150);
        } else {
          // Normal typing speed with variation
          typingDelay = randomInteger(80, 250);
        }
        
        // Type the character
        await element.type(text.charAt(i), { delay: typingDelay });
      }
      
      // Small pause after typing
      await delay(randomInteger(300, 800));
      
      logger.debug(`Typed text "${text}" in element`, accountId);
    } catch (error) {
      logger.error(`Error simulating typing`, accountId, error);
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
      // First scan the form to "evaluate" it (like a human would)
      const selectors = Object.keys(formData);
      
      // Look at each field before filling anything
      for (const selector of selectors) {
        const element = await page.$(selector);
        if (element) {
          await this.simulateMouseMove(page, element, accountId);
          await delay(randomInteger(200, 800));
        }
      }
      
      // Now fill the form with some randomized order
      const shuffledSelectors = [...selectors].sort(() => Math.random() - 0.5);
      
      for (const selector of shuffledSelectors) {
        const value = formData[selector];
        const element = await page.$(selector);
        
        if (!element) {
          logger.warn(`Element with selector "${selector}" not found`, accountId);
          continue;
        }
        
        // Check element type
        const tagName = await page.evaluate(el => el.tagName.toLowerCase(), element);
        const type = await page.evaluate(el => el.type?.toLowerCase(), element);
        
        // Handle different input types
        if (tagName === 'select') {
          await this.simulateMouseMove(page, element, accountId);
          await element.click();
          await delay(randomInteger(300, 800));
          
          // Select option
          await page.select(selector, value);
          await delay(randomInteger(500, 1200));
        } else if (type === 'checkbox' || type === 'radio') {
          const isChecked = await page.evaluate(el => el.checked, element);
          const shouldBeChecked = !!value;
          
          if (isChecked !== shouldBeChecked) {
            await this.simulateMouseMove(page, element, accountId);
            await element.click({ delay: randomInteger(30, 100) });
            await delay(randomInteger(300, 800));
          }
        } else {
          // Clear existing value first
          await this.simulateMouseMove(page, element, accountId);
          await element.click({ clickCount: 3, delay: randomInteger(30, 100) });
          await delay(randomInteger(200, 500));
          
          // Type new value
          await this.simulateTyping(page, element, value, accountId);
        }
        
        // Pause between fields
        await delay(randomInteger(500, 1500));
      }
      
      logger.info(`Form filled with ${selectors.length} fields`, accountId);
    } catch (error) {
      logger.error(`Error filling form`, accountId, error);
    }
  }
  
  /**
   * Simulate clicking with realistic behavior
   * @param {Object} page - Puppeteer page object
   * @param {Object} element - Element to click
   * @param {Object} options - Click options
   * @param {string} accountId - Account identifier
   */
  async simulateClick(page, element, options = {}, accountId) {
    try {
      // Define default options
      const defaultOptions = {
        moveBeforeClick: true,
        doubleClick: false,
        rightClick: false,
        clickDelay: randomInteger(30, 100)
      };
      
      const mergedOptions = { ...defaultOptions, ...options };
      
      // Move mouse to element first if specified
      if (mergedOptions.moveBeforeClick) {
        await this.simulateMouseMove(page, element, accountId);
      }
      
      // Perform the actual click with variations
      if (mergedOptions.doubleClick) {
        await element.click({ delay: mergedOptions.clickDelay, clickCount: 2 });
        logger.debug(`Double-clicked element`, accountId);
      } else if (mergedOptions.rightClick) {
        await element.click({ delay: mergedOptions.clickDelay, button: 'right' });
        logger.debug(`Right-clicked element`, accountId);
      } else {
        await element.click({ delay: mergedOptions.clickDelay });
        logger.debug(`Clicked element`, accountId);
      }
      
      // Pause after clicking
      await delay(randomInteger(200, 800));
      
      // Sometimes move mouse away after clicking
      if (Math.random() < 0.3) {
        const viewportSize = await page.viewport();
        await page.mouse.move(
          randomInteger(0, viewportSize.width),
          randomInteger(0, viewportSize.height),
          { steps: randomInteger(3, 8) }
        );
        await delay(randomInteger(100, 400));
      }
    } catch (error) {
      logger.error(`Error simulating click`, accountId, error);
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
      // Define default options
      const defaultOptions = {
        direction: 'down', // 'up', 'down', 'random'
        distance: 'medium', // 'short', 'medium', 'long', 'page', 'random'
        speed: 'medium', // 'slow', 'medium', 'fast', 'random'
        scrollCount: 1
      };
      
      const mergedOptions = { ...defaultOptions, ...options };
      
      // Calculate scroll distance
      let scrollDistance;
      switch (mergedOptions.distance) {
        case 'short':
          scrollDistance = randomInteger(100, 300);
          break;
        case 'medium':
          scrollDistance = randomInteger(300, 600);
          break;
        case 'long':
          scrollDistance = randomInteger(600, 1000);
          break;
        case 'page':
          scrollDistance = await page.evaluate(() => window.innerHeight * 0.9);
          break;
        case 'random':
          scrollDistance = randomInteger(100, 1000);
          break;
        default:
          scrollDistance = randomInteger(300, 600);
      }
      
      // Determine scroll direction
      if (mergedOptions.direction === 'random') {
        mergedOptions.direction = Math.random() < 0.7 ? 'down' : 'up'; // Bias toward scrolling down
      }
      
      if (mergedOptions.direction === 'up') {
        scrollDistance = -scrollDistance;
      }
      
      // Calculate scroll speed (interval between steps in ms)
      let scrollStepInterval;
      switch (mergedOptions.speed) {
        case 'slow':
          scrollStepInterval = randomInteger(60, 120);
          break;
        case 'medium':
          scrollStepInterval = randomInteger(30, 60);
          break;
        case 'fast':
          scrollStepInterval = randomInteger(10, 30);
          break;
        case 'random':
          scrollStepInterval = randomInteger(10, 120);
          break;
        default:
          scrollStepInterval = randomInteger(30, 60);
      }
      
      // Perform scrolling
      for (let i = 0; i < mergedOptions.scrollCount; i++) {
        // Break scrolling into steps for more natural behavior
        const totalSteps = randomInteger(5, 15);
        const scrollStep = scrollDistance / totalSteps;
        
        for (let step = 0; step < totalSteps; step++) {
          const currentStep = Math.round(scrollStep * (1 + (Math.random() - 0.5) * 0.3)); // Add some variance
          
          await page.evaluate((y) => {
            window.scrollBy({
              top: y,
              left: 0,
              behavior: 'smooth'
            });
          }, currentStep);
          
          await delay(scrollStepInterval);
        }
        
        // Pause between scrolls
        if (i < mergedOptions.scrollCount - 1) {
          await delay(randomInteger(500, 2000));
        }
      }
      
      // Sometimes pause to "read" content after scrolling
      if (Math.random() < 0.7) {
        const readingTime = randomInteger(1000, 5000);
        logger.debug(`Pausing for ${readingTime}ms to "read" content`, accountId);
        await delay(readingTime);
      }
      
      logger.debug(`Scrolled ${mergedOptions.direction} by ~${Math.abs(scrollDistance)}px`, accountId);
    } catch (error) {
      logger.error(`Error simulating scrolling`, accountId, error);
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
      const endTime = startTime + duration;
      
      logger.info(`Starting natural browsing simulation for ${duration}ms`, accountId);
      
      while (Date.now() < endTime) {
        // Choose a random action
        const actions = [
          { name: 'scroll', weight: 0.4 },
          { name: 'mousemove', weight: 0.3 },
          { name: 'click', weight: 0.15 },
          { name: 'wait', weight: 0.15 }
        ];
        
        // Select action based on weight
        const randomValue = Math.random();
        let cumulativeWeight = 0;
        let selectedAction;
        
        for (const action of actions) {
          cumulativeWeight += action.weight;
          if (randomValue <= cumulativeWeight) {
            selectedAction = action.name;
            break;
          }
        }
        
        // Execute selected action
        switch (selectedAction) {
          case 'scroll':
            await this.simulateScrolling(page, {
              direction: Math.random() < 0.8 ? 'down' : 'up',
              distance: 'random',
              speed: 'random'
            }, accountId);
            break;
            
          case 'mousemove':
            const viewportSize = await page.viewport();
            await page.mouse.move(
              randomInteger(0, viewportSize.width),
              randomInteger(0, viewportSize.height),
              { steps: randomInteger(5, 15) }
            );
            await delay(randomInteger(100, 500));
            break;
            
          case 'click':
            // Try to find clickable elements
            const clickableElements = await page.$$('a, button, [role="button"], input[type="submit"]');
            
            if (clickableElements.length > 0) {
              // Filter to only visible elements
              const visibleElements = [];
              for (const element of clickableElements) {
                const isVisible = await page.evaluate(el => {
                  const rect = el.getBoundingClientRect();
                  return rect.width > 0 && 
                         rect.height > 0 && 
                         rect.top >= 0 && 
                         rect.left >= 0 && 
                         rect.bottom <= window.innerHeight && 
                         rect.right <= window.innerWidth;
                }, element);
                
                if (isVisible) {
                  visibleElements.push(element);
                }
              }
              
              // Only click if we found visible elements and it's safe to do so
              // (avoid clicking random links that might navigate away)
              if (visibleElements.length > 0 && Math.random() < 0.3) {
                const randomElement = visibleElements[Math.floor(Math.random() * visibleElements.length)];
                
                // Check if this is a safe element to click
                const isLinkOutside = await page.evaluate(el => {
                  return el.tagName === 'A' && 
                         el.href && 
                         !el.href.includes(window.location.hostname);
                }, randomElement);
                
                if (!isLinkOutside) {
                  await this.simulateClick(page, randomElement, {}, accountId);
                }
              }
            }
            break;
            
          case 'wait':
            const waitTime = randomInteger(1000, 5000);
            logger.debug(`Waiting for ${waitTime}ms`, accountId);
            await delay(waitTime);
            break;
        }
        
        // Check if we should continue
        if (Date.now() >= endTime) break;
        
        // Small delay between actions
        await delay(randomInteger(500, 2000));
      }
      
      logger.info(`Completed natural browsing simulation (${Math.round((Date.now() - startTime) / 1000)}s)`, accountId);
    } catch (error) {
      logger.error(`Error during browsing simulation`, accountId, error);
    }
  }
}

module.exports = new HumanInteraction();
