const logger = require('../utils/logger');
const { delay, randomInteger, getBezierPoints, naturalDelay, randomFloat } = require('../utils/helpers');
const mousePatterns = require('../plugins/mouse-patterns');
const keyboardPatterns = require('../plugins/keyboard-patterns');

/**
 * Provides human-like interaction patterns for browser automation
 */
class HumanInteraction {
  /**
   * Simulate realistic mouse movement using advanced patterns
   * @param {Object} page - Puppeteer page object
   * @param {Object} element - Element to move to
   * @param {string} accountId - Account identifier
   * @param {Object} options - Optional movement configuration
   */
  async simulateMouseMove(page, element, accountId, options = {}) {
    try {
      const box = await element.boundingBox();
      if (!box) {
        logger.warn(`Bounding box not found for element`, accountId);
        return;
      }
      
      // Get viewport size
      const viewportSize = await page.viewport();
      
      // Current mouse position or default starting point if not available
      let currentPosition;
      try {
        currentPosition = await page.evaluate(() => ({ 
          x: window.mouseX || 0, 
          y: window.mouseY || 0 
        }));
        
        // If position is 0,0 (likely not tracked yet), use a reasonable starting point
        if (currentPosition.x === 0 && currentPosition.y === 0) {
          currentPosition = {
            x: randomInteger(viewportSize.width * 0.2, viewportSize.width * 0.8),
            y: randomInteger(viewportSize.height * 0.2, viewportSize.height * 0.8)
          };
        }
      } catch (e) {
        // Fallback to a random starting point if we can't get current position
        currentPosition = {
          x: randomInteger(viewportSize.width * 0.2, viewportSize.width * 0.8),
          y: randomInteger(viewportSize.height * 0.2, viewportSize.height * 0.8)
        };
      }
      
      // Target point within the element with some randomization
      const targetX = Math.round(box.x + randomFloat(0.3, 0.7) * box.width);
      const targetY = Math.round(box.y + randomFloat(0.3, 0.7) * box.height);
      
      // Tracking first move for starting point
      let firstMove = true;
      
      // Merge default options with provided options
      const movementOptions = {
        ...options,
        // Dynamically determine movement type based on context
        movementType: options.movementType || (() => {
          // If element is small or requires precision, use correction movement
          if (box.width < 50 || box.height < 50) {
            return 'correction';
          }
          
          // For longer distances, more likely to use bezier
          const distance = Math.sqrt(
            Math.pow(targetX - currentPosition.x, 2) + 
            Math.pow(targetY - currentPosition.y, 2)
          );
          
          if (distance > 500) {
            // More likely to have tremors or overshoot in long movements
            return Math.random() < 0.6 ? 'overshoot' : 'tremor';
          }
          
          // Otherwise use weighted random
          return mousePatterns.getRandomMovementType();
        })()
      };
      
      // Generate movement points with advanced patterns
      const movementPoints = mousePatterns.getMovementPoints(
        currentPosition.x,
        currentPosition.y,
        targetX,
        targetY,
        movementOptions.movementType,
        movementOptions
      );
      
      // Check if there are points to move to
      if (!movementPoints || movementPoints.length === 0) {
        logger.warn(`No movement points generated`, accountId);
        return;
      }
      
      // Execute the mouse movement with the calculated points and timing
      for (const point of movementPoints) {
        if (firstMove) {
          // First point - just move there instantly (simulates picking up mouse)
          await page.mouse.move(point.x, point.y);
          firstMove = false;
          await delay(randomInteger(30, 100));
          continue;
        }
        
        // Move to the point
        await page.mouse.move(point.x, point.y);
        
        // Wait according to the calculated delay
        await delay(point.delay);
      }
      
      // Sometimes look around the target before clicking (human attention)
      if (Math.random() < 0.15) {
        const focusPoints = mousePatterns.generateFocusPoints(targetX, targetY, 20, 2);
        for (const point of focusPoints) {
          await page.mouse.move(point.x, point.y);
          await delay(randomInteger(30, 150));
        }
        
        // Move back to target
        await page.mouse.move(targetX, targetY);
        await delay(randomInteger(30, 80));
      }
      
      // Track mouse position in page context for future movements
      await page.evaluate(({ x, y }) => {
        window.mouseX = x;
        window.mouseY = y;
      }, { x: targetX, y: targetY });
      
      logger.debug(`Mouse moved to element at (${targetX}, ${targetY}) using ${movementOptions.movementType} pattern`, accountId);
    } catch (error) {
      logger.error(`Error simulating mouse movement`, accountId, error);
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
      // Default options
      const typingOptions = {
        // Base typing speed in ms
        baseSpeed: options.baseSpeed || randomInteger(70, 130),
        // Error probability
        errorProbability: options.errorProbability || (text.length > 20 ? 0.08 : 0.04),
        // Whether to clear existing content first
        clearExisting: options.hasOwnProperty('clearExisting') ? options.clearExisting : true,
        // Thinking frequency (pausing to think)
        thinkingFrequency: options.thinkingFrequency || 0.12,
        // Typing style (experienced/novice)
        typingStyle: options.typingStyle || (Math.random() < 0.7 ? 'experienced' : 'novice'),
        ...options
      };
      
      // Focus the element first with realistic mouse movement
      await this.simulateMouseMove(page, element, accountId);
      
      // Realistic click with variable press duration
      const clickTimings = mousePatterns.generateClickTimings('single');
      await element.click({ delay: clickTimings[1] - clickTimings[0] });
      
      // Short pause after clicking
      await delay(randomInteger(200, 500));
      
      // Clear existing text if needed
      if (typingOptions.clearExisting) {
        // Check if element has any value (only for input or textarea)
        const hasExistingValue = await page.evaluate(el => {
          return el.value && el.value.length > 0;
        }, element).catch(() => false);
        
        if (hasExistingValue) {
          // Triple click to select all (commonly used by humans)
          await element.click({ clickCount: 3, delay: randomInteger(30, 70) });
          await delay(randomInteger(100, 300));
          
          // Occasional different way to clear (more human variation)
          if (Math.random() < 0.3) {
            // Press Delete key
            await page.keyboard.press('Delete');
          } else {
            // Type over selected text (most common human behavior)
          }
          
          await delay(randomInteger(200, 500));
        }
      }
      
      // Sometimes take a moment before starting to type (thinking)
      if (Math.random() < 0.25) {
        await delay(randomInteger(500, 1800));
      }
      
      let prevChar = null;
      
      // Type each character with realistic timing patterns
      for (let i = 0; i < text.length; i++) {
        const currentChar = text.charAt(i);
        
        // Check for natural typing mistakes
        const mistakeDetails = keyboardPatterns.generateMistake(text, i);
        
        if (mistakeDetails) {
          switch (mistakeDetails.type) {
            case 'adjacent':
              // Type wrong adjacent key
              await element.type(mistakeDetails.mistakeChar, { 
                delay: keyboardPatterns.getTypingDelay(prevChar, mistakeDetails.mistakeChar, typingOptions.baseSpeed) 
              });
              await delay(randomInteger(150, 400));
              
              // Delete wrong character
              await page.keyboard.press('Backspace');
              await delay(randomInteger(200, 500));
              break;
              
            case 'transposition':
              // Type two characters in wrong order
              await element.type(mistakeDetails.char2, { 
                delay: keyboardPatterns.getTypingDelay(prevChar, mistakeDetails.char2, typingOptions.baseSpeed) 
              });
              prevChar = mistakeDetails.char2;
              
              await delay(randomInteger(60, 150));
              
              await element.type(mistakeDetails.char1, { 
                delay: keyboardPatterns.getTypingDelay(prevChar, mistakeDetails.char1, typingOptions.baseSpeed) 
              });
              prevChar = mistakeDetails.char1;
              
              await delay(randomInteger(200, 500));
              
              // Delete both wrong characters
              await page.keyboard.press('Backspace');
              await delay(randomInteger(70, 200));
              await page.keyboard.press('Backspace');
              await delay(randomInteger(150, 400));
              
              // Type correctly (will be done in the main loop)
              continue;
              
            case 'insertion':
              // Type an extra character
              await element.type(mistakeDetails.insertedChar, { 
                delay: keyboardPatterns.getTypingDelay(prevChar, mistakeDetails.insertedChar, typingOptions.baseSpeed) 
              });
              prevChar = mistakeDetails.insertedChar;
              
              await delay(randomInteger(150, 350));
              
              // Delete the extra character
              await page.keyboard.press('Backspace');
              await delay(randomInteger(200, 500));
              break;
              
            case 'omission':
              // Skip this character (the next one will be typed instead)
              // Will be corrected after
              i++; // Skip to next character
              
              if (i < text.length) {
                const skippedChar = currentChar;
                const nextChar = text.charAt(i);
                
                // Type the next character
                await element.type(nextChar, { 
                  delay: keyboardPatterns.getTypingDelay(prevChar, nextChar, typingOptions.baseSpeed) 
                });
                prevChar = nextChar;
                
                // Realize mistake and go back
                await delay(randomInteger(300, 800));
                await page.keyboard.press('Backspace');
                await delay(randomInteger(200, 400));
                
                // Type the skipped character
                await element.type(skippedChar, { 
                  delay: keyboardPatterns.getTypingDelay(prevChar, skippedChar, typingOptions.baseSpeed) 
                });
                prevChar = skippedChar;
                
                // Then type the next character again
                await delay(randomInteger(100, 300));
                await element.type(nextChar, { 
                  delay: keyboardPatterns.getTypingDelay(prevChar, nextChar, typingOptions.baseSpeed) 
                });
                prevChar = nextChar;
                
                continue;
              }
              break;
          }
        }
        
        // Check for thinking pause (more frequent at punctuation)
        const isThinkingPoint = /[.,;:!?]/.test(currentChar) ? 0.35 : typingOptions.thinkingFrequency;
        if (Math.random() < isThinkingPoint) {
          const thinkingTime = (/[.,;:!?]/.test(currentChar))
            ? randomInteger(800, 2000)  // Longer pause at punctuation
            : randomInteger(400, 1200); // Regular thinking pause
            
          await delay(thinkingTime);
        }
        
        // Calculate typing delay based on character transition
        const typingDelay = keyboardPatterns.getTypingDelay(
          prevChar, 
          currentChar, 
          typingOptions.baseSpeed
        );
        
        // Type the character with calculated delay
        await element.type(currentChar, { delay: typingDelay });
        
        // Update previous character
        prevChar = currentChar;
      }
      
      // Occasionally add a period and then delete it (common human error on completion)
      if (Math.random() < 0.05 && !text.endsWith('.')) {
        await delay(randomInteger(200, 500));
        await element.type('.', { delay: randomInteger(80, 120) });
        await delay(randomInteger(300, 700));
        await page.keyboard.press('Backspace');
        await delay(randomInteger(200, 400));
      }
      
      // Small pause after finishing typing
      await delay(randomInteger(300, 800));
      
      logger.debug(`Typed text "${text}" in element using realistic human patterns`, accountId);
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
   * Simulate clicking with advanced realistic behavior
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
        clickType: 'single', // single, double, triple, right, drag
        contextBasedMovement: true, // adjust movement based on element type
        postClickNavigation: 'auto', // auto, none, wait
        postClickPause: [200, 800], // min and max ms for pause after clicking
        movementOptions: {}, // options for mouse movement
        checkChangeAfterClick: true // check if click caused any DOM changes
      };
      
      const mergedOptions = { ...defaultOptions, ...options };
      
      // Get element metadata for context-based behavior
      const elementInfo = await page.evaluate(el => {
        // Extract tag name, role, classes, and dimensions
        return {
          tagName: el.tagName?.toLowerCase() || '',
          type: el.type?.toLowerCase() || '',
          role: el.getAttribute('role') || '',
          className: el.className || '',
          width: el.offsetWidth || 0,
          height: el.offsetHeight || 0,
          isVisible: el.offsetWidth > 0 && el.offsetHeight > 0,
          hasChildren: el.childElementCount > 0,
          text: el.textContent?.trim() || '',
          isInteractive: (
            el.tagName === 'BUTTON' || 
            el.tagName === 'A' || 
            el.tagName === 'INPUT' || 
            el.tagName === 'SELECT' || 
            el.getAttribute('role') === 'button' ||
            el.getAttribute('role') === 'link' ||
            el.onclick !== null
          )
        };
      }, element).catch(() => ({}));
      
      // Refine click behavior based on element context
      const refinedOptions = { ...mergedOptions };
      
      // Adjust click type based on element
      if (mergedOptions.clickType === 'auto') {
        if (elementInfo.tagName === 'input' && elementInfo.type === 'text') {
          // Triple click often used by humans to select all text
          refinedOptions.clickType = Math.random() < 0.7 ? 'single' : 'triple';
        } else if (elementInfo.tagName === 'a' || elementInfo.role === 'link') {
          // Links are almost always single clicked
          refinedOptions.clickType = 'single';
        } else if (elementInfo.width < 20 || elementInfo.height < 20) {
          // Small targets get extra attention (more precise movement)
          refinedOptions.movementOptions.movementType = 'correction';
        }
      }
      
      // Move mouse to element with context-based movement
      if (refinedOptions.moveBeforeClick) {
        // Adjust movement pattern based on element context
        if (refinedOptions.contextBasedMovement) {
          if (elementInfo.isInteractive) {
            // Interactive elements get more deliberate movement
            await this.simulateMouseMove(page, element, accountId, {
              movementType: 'correction',
              ...refinedOptions.movementOptions
            });
          } else {
            // Non-interactive elements get more natural varied movement
            await this.simulateMouseMove(page, element, accountId, {
              ...refinedOptions.movementOptions
            });
          }
        } else {
          // Use default movement without context
          await this.simulateMouseMove(page, element, accountId, refinedOptions.movementOptions);
        }
      }
      
      // Occasionally add pre-click hesitation (human behavior)
      if (Math.random() < 0.15) {
        await delay(randomInteger(200, 800));
      }
      
      // Get click timings based on click type
      const clickTimings = mousePatterns.generateClickTimings(refinedOptions.clickType);
      const clickDelay = clickTimings[1] - clickTimings[0]; // Time between down and up
      
      // Determine click count
      let clickCount = 1;
      if (refinedOptions.clickType === 'double') clickCount = 2;
      if (refinedOptions.clickType === 'triple') clickCount = 3;
      
      // Determine button type
      const button = refinedOptions.clickType === 'right' ? 'right' : 'left';
      
      // Perform the click with realistic timing
      await element.click({ 
        delay: clickDelay, 
        clickCount: clickCount,
        button: button
      });
      
      // Record whether we expect navigation
      const mightCauseNavigation = (
        elementInfo.tagName === 'a' || 
        elementInfo.role === 'link' || 
        elementInfo.text.toLowerCase().includes('submit') ||
        elementInfo.className.toLowerCase().includes('submit') ||
        elementInfo.type === 'submit'
      );
      
      // Log what we did
      logger.debug(
        `${refinedOptions.clickType.charAt(0).toUpperCase() + refinedOptions.clickType.slice(1)}-clicked` +
        ` element (${elementInfo.tagName}${elementInfo.type ? `, type=${elementInfo.type}` : ''})`,
        accountId
      );
      
      // Post-click behavior
      if (refinedOptions.postClickNavigation === 'auto' && mightCauseNavigation) {
        // If element might cause navigation, wait for it
        try {
          logger.debug(`Waiting for possible navigation after clicking ${elementInfo.tagName}`, accountId);
          await Promise.race([
            page.waitForNavigation({ timeout: 10000 }),
            delay(5000) // Fallback timeout
          ]);
        } catch (e) {
          // Navigation might not have happened, which is fine
          logger.debug(`No navigation occurred after clicking ${elementInfo.tagName}`, accountId);
        }
      } else if (refinedOptions.postClickNavigation === 'wait') {
        // Explicitly wait for navigation
        try {
          await page.waitForNavigation({ timeout: 10000 });
        } catch (e) {
          logger.warn(`Expected navigation did not occur after clicking ${elementInfo.tagName}`, accountId);
        }
      } else {
        // Standard pause after clicking
        const [minPause, maxPause] = refinedOptions.postClickPause;
        await delay(randomInteger(minPause, maxPause));
      }
      
      // Check for DOM changes if requested (common human validation behavior)
      if (refinedOptions.checkChangeAfterClick) {
        try {
          // Wait briefly for any changes to happen
          await delay(randomInteger(100, 300));
          
          // Check if clicking caused any visible changes (dialogs, dropdowns, etc.)
          const visibleChanges = await page.evaluate(() => {
            // Look for various types of UI changes
            return {
              hasNewDialogs: document.querySelectorAll('[role="dialog"]:not([hidden]), .modal:not(.hide):not(.hidden)').length > 0,
              hasNewDropdowns: document.querySelectorAll('.dropdown-menu:not(.hide):not(.hidden), [role="menu"]:not([hidden])').length > 0,
              hasNewToasts: document.querySelectorAll('.toast:not(.hide):not(.hidden), .notification:not(.hide):not(.hidden)').length > 0
            };
          });
          
          // If changes happened, wait a bit longer and possibly interact
          if (visibleChanges.hasNewDialogs || visibleChanges.hasNewDropdowns || visibleChanges.hasNewToasts) {
            logger.debug(`Click caused UI changes: ${JSON.stringify(visibleChanges)}`, accountId);
            
            // Pause to look at the new content
            await delay(randomInteger(500, 1500));
          }
        } catch (e) {
          // Ignore errors in the post-click validation
        }
      }
      
      // Sometimes move mouse away after clicking (like a human would)
      if (Math.random() < 0.25) {
        const viewportSize = await page.viewport();
        
        // Use more natural mouse movement away from click
        const movementPoints = mousePatterns.getMovementPoints(
          page.mouse._x,
          page.mouse._y,
          randomInteger(viewportSize.width * 0.2, viewportSize.width * 0.8),
          randomInteger(viewportSize.height * 0.2, viewportSize.height * 0.8),
          'gradual', // More like a human's idle movement
          { steps: randomInteger(5, 12) }
        );
        
        // Perform the movement
        for (const point of movementPoints) {
          await page.mouse.move(point.x, point.y);
          await delay(point.delay);
        }
      }
    } catch (error) {
      logger.error(`Error simulating click: ${error.message}`, accountId, error);
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
