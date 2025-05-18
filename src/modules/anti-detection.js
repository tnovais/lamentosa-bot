const { FINGERPRINT } = require('../config');
const logger = require('../utils/logger');
const { randomInteger, randomItem, randomFloat, delay } = require('../utils/helpers');

/**
 * Provides advanced anti-detection mechanisms for the bot
 */
class AntiDetection {
  constructor() {
    // Pode inicializar algumas configurações aqui se necessário
  }

  /**
   * Apply all anti-detection measures to a page
   * @param {Object} page - Puppeteer page object
   * @param {string} accountId - Account identifier
   */
  async applyAllMeasures(page, accountId) {
    try {
      logger.info(`Applying comprehensive anti-detection measures for ${accountId}`, accountId);
      
      // Apply measures in sequence with natural delays between them to avoid detection
      
      // 1. First, apply basic browser property randomization
      await this.randomizeBrowserProperties(page, accountId);
      await delay(randomInteger(100, 300));
      
      // 2. Apply advanced fingerprint techniques
      await this.spoofTelemetry(page, accountId);
      await delay(randomInteger(100, 300));
      
      // 3. Apply evasion scripts
      await this.injectEvasionScripts(page, accountId);
      await delay(randomInteger(100, 300));
      
      // 4. Add random behavior patterns
      await this.addRandomBehavior(page, accountId);
      
      logger.info(`Anti-detection measures applied successfully for ${accountId}`, accountId);
    } catch (error) {
      logger.error(`Error applying anti-detection measures for ${accountId}: ${error.message}`, accountId, error);
      throw error;
    }
  }

  /**
   * Randomize browser properties
   * @param {Object} page - Puppeteer page object
   * @param {string} accountId - Account identifier
   */
  async randomizeBrowserProperties(page, accountId) {
    try {
      logger.debug(`Randomizing browser properties for ${accountId}`, accountId);
      
      // Override navigator properties to defeat detection
      await page.evaluateOnNewDocument(() => {
        // Make WebDriver properties undetectable
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
          configurable: true
        });
        
        // Remove webdriver-related properties from navigator
        delete navigator.__proto__.webdriver;
        
        // Override languages with a realistic set
        Object.defineProperty(navigator, 'languages', {
          get: () => ['pt-BR', 'pt', 'en-US', 'en'],
          configurable: true
        });
        
        // Override plugins to have a realistic count
        const numPlugins = Math.floor(Math.random() * 8) + 1;
        Object.defineProperty(navigator, 'plugins', {
          get: () => {
            const plugins = {
              length: numPlugins,
              refresh: () => {},
              item: (i) => null
            };
            for (let i = 0; i < numPlugins; i++) {
              plugins[i] = {
                name: `Plugin ${i}`,
                filename: `plugin${i}.dll`,
                description: `Plugin ${i} Description`,
                length: 1
              };
            }
            return plugins;
          },
          configurable: true
        });
        
        // Override hardware concurrency with a realistic value
        Object.defineProperty(navigator, 'hardwareConcurrency', {
          get: () => 4 + Math.floor(Math.random() * 4),
          configurable: true
        });
        
        // Override platform with a realistic value
        Object.defineProperty(navigator, 'platform', {
          get: () => ['Win32', 'MacIntel', 'Linux x86_64'][Math.floor(Math.random() * 3)],
          configurable: true
        });
      });
      
      logger.debug(`Browser properties randomized for ${accountId}`, accountId);
    } catch (error) {
      logger.error(`Error randomizing browser properties for ${accountId}: ${error.message}`, accountId, error);
      throw error;
    }
  }

  /**
   * Spoof telemetry data
   * @param {Object} page - Puppeteer page object
   * @param {string} accountId - Account identifier
   */
  async spoofTelemetry(page, accountId) {
    try {
      logger.debug(`Spoofing telemetry for ${accountId}`, accountId);
      
      // Override performance API to add jitter to timing measurements
      await page.evaluateOnNewDocument(() => {
        // Keep a reference to the original performance methods
        const originalNow = performance.now;
        const originalTimeOrigin = performance.timeOrigin;
        
        // Add jitter to performance.now() to defeat timing-based fingerprinting
        performance.now = function() {
          return originalNow.call(performance) + (Math.random() * 0.1);
        };
        
        // Also randomize the time origin slightly
        performance.timeOrigin = originalTimeOrigin + (Math.random() * 2 - 1);
        
        // Override Date to add small jitter for timing consistency with performance.now
        const originalDateNow = Date.now;
        Date.now = function() {
          return originalDateNow() + (Math.random() * 0.2);
        };
        
        // Override requestAnimationFrame with jitter
        const originalRAF = window.requestAnimationFrame;
        window.requestAnimationFrame = function(callback) {
          const wrappedCallback = (timestamp) => {
            // Add 0-0.1ms of jitter to timestamp
            timestamp += Math.random() * 0.1;
            callback(timestamp);
          };
          return originalRAF(wrappedCallback);
        };
      });
      
      // Canvas fingerprinting protection
      await page.evaluateOnNewDocument(() => {
        // Get a reference to the original canvas context methods
        const originalGetContext = HTMLCanvasElement.prototype.getContext;
        const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
        const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
        const originalToBlob = HTMLCanvasElement.prototype.toBlob;
        
        // Override getContext to capture 2d context creation
        HTMLCanvasElement.prototype.getContext = function(contextType, ...rest) {
          const context = originalGetContext.call(this, contextType, ...rest);
          
          // If it's a 2d context, we'll modify its methods to add noise to fingerprinting
          if (contextType === '2d' && context) {
            // Keep track of text that has been drawn
            context._hasText = false;
            
            // Override fillText and strokeText to track text drawing
            const originalFillText = context.fillText;
            context.fillText = function(...args) {
              context._hasText = true;
              return originalFillText.apply(this, args);
            };
            
            const originalStrokeText = context.strokeText;
            context.strokeText = function(...args) {
              context._hasText = true;
              return originalStrokeText.apply(this, args);
            };
          }
          
          return context;
        };
        
        // Override getImageData to add subtle noise if the canvas has text
        CanvasRenderingContext2D.prototype.getImageData = function(...args) {
          const imageData = originalGetImageData.apply(this, args);
          
          // Only modify if this context has had text drawn to it (likely fingerprinting)
          if (this._hasText) {
            const pixels = imageData.data;
            // Modify 1 out of every 100 pixels slightly (preserves most visual content)
            for (let i = 0; i < pixels.length; i += 4) {
              if (Math.random() < 0.01) {
                // Modify pixel values very subtly (+/- 1)
                pixels[i] = Math.max(0, Math.min(255, pixels[i] + (Math.random() > 0.5 ? 1 : -1)));
                pixels[i+1] = Math.max(0, Math.min(255, pixels[i+1] + (Math.random() > 0.5 ? 1 : -1)));
                pixels[i+2] = Math.max(0, Math.min(255, pixels[i+2] + (Math.random() > 0.5 ? 1 : -1)));
                // Don't modify alpha to avoid visual glitches
              }
            }
          }
          
          return imageData;
        };
        
        // Override toDataURL to add noise if the canvas has text
        HTMLCanvasElement.prototype.toDataURL = function(...args) {
          const context = this.getContext('2d');
          if (context && context._hasText) {
            // Add subtle noise to the canvas before converting to data URL
            const imageData = context.getImageData(0, 0, this.width, this.height);
            context.putImageData(imageData, 0, 0);
          }
          return originalToDataURL.apply(this, args);
        };
        
        // Override toBlob similarly
        HTMLCanvasElement.prototype.toBlob = function(callback, ...rest) {
          const context = this.getContext('2d');
          if (context && context._hasText) {
            // Add subtle noise to the canvas before converting to blob
            const imageData = context.getImageData(0, 0, this.width, this.height);
            context.putImageData(imageData, 0, 0);
          }
          return originalToBlob.call(this, callback, ...rest);
        };
      });
      
      logger.debug(`Telemetry spoofed for ${accountId}`, accountId);
    } catch (error) {
      logger.error(`Error spoofing telemetry for ${accountId}: ${error.message}`, accountId, error);
      throw error;
    }
  }

  /**
   * Inject evasion scripts to bypass detection
   * @param {Object} page - Puppeteer page object
   * @param {string} accountId - Account identifier
   */
  async injectEvasionScripts(page, accountId) {
    try {
      logger.debug(`Injecting evasion scripts for ${accountId}`, accountId);
      
      await page.evaluateOnNewDocument(() => {
        // Override toString methods to hide instrumentation
        const originalFunctionToString = Function.prototype.toString;
        
        Function.prototype.toString = function() {
          // For native methods, show native code
          if (this.name === 'toString' || 
              this === Function.prototype.toString || 
              this === Object.getOwnPropertyDescriptor ||
              this === Object.getOwnPropertyDescriptors ||
              /^[A-Z].*Constructor$/.test(this.name)) {
            return 'function ' + this.name + '() { [native code] }';
          }
          
          const result = originalFunctionToString.call(this);
          
          // Hide Puppeteer/Selenium traces
          if (result.includes('__puppeteer_evaluation_script__') ||
              result.includes('window.navigator.webdriver') ||
              result.includes('ChromeDriver')) {
            return result.replace(/__puppeteer_evaluation_script__|window\.navigator\.webdriver|ChromeDriver/g, '');
          }
          
          return result;
        };
        
        // Override Error behavior to hide puppeteer stack traces
        const originalStackGetter = Object.getOwnPropertyDescriptor(Error.prototype, 'stack').get;
        Object.defineProperty(Error.prototype, 'stack', {
          get: function() {
            const stack = originalStackGetter.call(this);
            return stack
              .replace(/puppeteer_evaluation_script/g, 'script')
              .replace(/at Object\.apply \(native\)/g, '')
              .replace(/at \[object Object\]\.apply/g, 'at apply');
          },
          configurable: true
        });
        
        // Add dummy browser features that are expected in normal browsers
        if (!window.chrome) {
          window.chrome = {
            runtime: {
              connect: () => ({
                disconnect: () => {},
                onMessage: {
                  addListener: () => {},
                  removeListener: () => {}
                },
                postMessage: () => {}
              }),
              sendMessage: (message, callback) => {
                if (callback) {
                  setTimeout(callback, 0);
                }
                return true;
              }
            },
            webstore: {
              onInstallStageChanged: {
                addListener: () => {}
              },
              onDownloadProgress: {
                addListener: () => {}
              }
            },
            app: {
              isInstalled: false,
              getDetails: () => {}
            }
          };
        }
        
        // Override navigator.permissions to avoid detection
        if (navigator.permissions) {
          const originalQuery = navigator.permissions.query;
          navigator.permissions.query = function(parameters) {
            // Handle special cases for notification/plugins that trigger fingerprinting detection
            if (parameters.name === 'notifications' || 
                parameters.name === 'midi' ||
                parameters.name === 'plugins') {
              return Promise.resolve({
                state: "prompt", // Use prompt as it's the most common value
                onchange: null
              });
            }
            
            return originalQuery.apply(navigator.permissions, arguments);
          };
        }
        
        // Add more realistic media devices behavior
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
          const originalEnumerateDevices = navigator.mediaDevices.enumerateDevices;
          navigator.mediaDevices.enumerateDevices = async function() {
            const devices = await originalEnumerateDevices.apply(navigator.mediaDevices);
            
            // If no devices or very few, add some fictitious ones
            if (devices.length < 3) {
              const fakeDevices = [
                {
                  deviceId: 'default',
                  kind: 'audioinput',
                  label: '',
                  groupId: Math.random().toString(36).substring(2, 15)
                },
                {
                  deviceId: 'default',
                  kind: 'audiooutput',
                  label: '',
                  groupId: Math.random().toString(36).substring(2, 15)
                },
                {
                  deviceId: 'default',
                  kind: 'videoinput',
                  label: '',
                  groupId: Math.random().toString(36).substring(2, 15)
                }
              ];
              
              return [...devices, ...fakeDevices.slice(0, 3 - devices.length)];
            }
            
            return devices;
          };
        }
      });
      
      logger.debug(`Evasion scripts injected for ${accountId}`, accountId);
    } catch (error) {
      logger.error(`Error injecting evasion scripts for ${accountId}: ${error.message}`, accountId, error);
      throw error;
    }
  }

  /**
   * Add random delays and behaviors between actions
   * @param {Object} page - Puppeteer page object
   * @param {string} accountId - Account identifier
   */
  async addRandomBehavior(page, accountId) {
    try {
      logger.debug(`Adding random behavior for ${accountId}`, accountId);
      
      // Randomize scroll behavior
      await this.randomScroll(page, accountId);
      
      logger.debug(`Random behavior added for ${accountId}`, accountId);
    } catch (error) {
      logger.error(`Error adding random behavior for ${accountId}: ${error.message}`, accountId, error);
      throw error;
    }
  }

  /**
   * Randomize scroll behavior
   * @param {Object} page - Puppeteer page object
   * @param {string} accountId - Account identifier
   */
  async randomScroll(page, accountId) {
    try {
      logger.debug(`Performing random scroll for ${accountId}`, accountId);
      
      await page.evaluate(() => {
        const randomScrollAmount = () => Math.floor(Math.random() * 100) + 50;
        const randomDelay = () => Math.floor(Math.random() * 500) + 100;
        
        const performScroll = () => {
          // Determine if we scroll up or down (80% chance of down)
          const scrollDown = Math.random() < 0.8;
          const scrollAmount = scrollDown ? randomScrollAmount() : -randomScrollAmount();
          
          // Smooth scroll with natural easing
          const duration = randomDelay();
          const startTime = Date.now();
          const startScroll = window.scrollY;
          
          const scroll = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Use easing function for natural movement
            const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
            const easedProgress = easeOutCubic(progress);
            
            window.scrollTo(0, startScroll + scrollAmount * easedProgress);
            
            if (progress < 1) {
              requestAnimationFrame(scroll);
            }
          };
          
          requestAnimationFrame(scroll);
        };
        
        // Perform 1-3 random scrolls
        const scrollCount = Math.floor(Math.random() * 3) + 1;
        
        for (let i = 0; i < scrollCount; i++) {
          setTimeout(performScroll, i * (randomDelay() + 500));
        }
      });
      
      await delay(randomInteger(1000, 3000)); // Wait for scrolling to complete
      
      logger.debug(`Random scroll completed for ${accountId}`, accountId);
    } catch (error) {
      logger.error(`Error during random scroll for ${accountId}: ${error.message}`, accountId, error);
      throw error;
    }
  }

  /**
   * Check if a page contains bot detection markers
   * @param {Object} page - Puppeteer page object
   * @param {string} accountId - Account identifier
   * @returns {Promise<boolean>} - True if bot detection is present
   */
  async checkForDetection(page, accountId) {
    try {
      logger.debug(`Checking for bot detection markers for ${accountId}`, accountId);
      
      const detectionMarkers = await page.evaluate(() => {
        const markers = [];
        
        // Check for common detection libraries
        if (window.__bot_detector || 
            window.__anti_bot || 
            window.__cf || 
            window.botDetection ||
            window.Perimeter_X || 
            window._px || 
            window.__ba) {
          markers.push('detection_library');
        }
        
        // Check for suspicious element attributes
        const suspiciousAttributes = [
          'data-automation',
          'data-testid',
          'data-bot-check',
          'recaptcha',
          'captcha'
        ];
        
        for (const attr of suspiciousAttributes) {
          if (document.querySelector(`[${attr}]`)) {
            markers.push(`suspicious_attr_${attr}`);
          }
        }
        
        // Check for text indicating bot detection
        const bodyText = document.body.innerText.toLowerCase();
        const suspiciousTexts = [
          'bot detected',
          'automated access',
          'suspicious activity',
          'unusual traffic',
          'recaptcha',
          'captcha',
          'please verify you are human',
          'confirm you are not a robot'
        ];
        
        for (const text of suspiciousTexts) {
          if (bodyText.includes(text)) {
            markers.push(`suspicious_text_${text.replace(/\s+/g, '_')}`);
          }
        }
        
        return markers;
      });
      
      if (detectionMarkers.length > 0) {
        logger.warn(`Bot detection markers found for ${accountId}: ${detectionMarkers.join(', ')}`, accountId);
        return true;
      }
      
      logger.debug(`No bot detection markers found for ${accountId}`, accountId);
      return false;
    } catch (error) {
      logger.error(`Error checking for bot detection for ${accountId}: ${error.message}`, accountId, error);
      return false;
    }
  }
}

module.exports = AntiDetection;