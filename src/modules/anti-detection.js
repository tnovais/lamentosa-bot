const { createCanvas, loadImage } = require('canvas');
const { FINGERPRINT } = require('../config');
const logger = require('../utils/logger');
const { randomInteger, randomItem, randomFloat, delay } = require('../utils/helpers');

/**
 * Provides advanced anti-detection mechanisms for the bot
 */
class AntiDetection {
  /**
   * Apply all anti-detection measures to a page
   * @param {Object} page - Puppeteer page object
   * @param {string} accountId - Account identifier
   */
  async applyAllMeasures(page, accountId) {
    await Promise.all([
      this.randomizeBrowserProperties(page, accountId),
      this.spoofTelemetry(page, accountId),
      this.injectEvasionScripts(page, accountId)
    ]);
  }

  /**
   * Randomize browser properties
   * @param {Object} page - Puppeteer page object
   * @param {string} accountId - Account identifier
   */
  async randomizeBrowserProperties(page, accountId) {
    try {
      await page.evaluateOnNewDocument(() => {
        // Import fingerprint options from config module
        const vendors = ['Intel Inc.', 'NVIDIA Corporation', 'AMD'];
        const renderers = ['Intel Iris OpenGL Engine', 'GeForce GTX 1650/PCIe/SSE2', 'Radeon RX 580 Series'];
        const pluginsOptions = [
          { name: 'PDF Viewer', filename: 'pdf-viewer.js' },
          { name: 'Chrome PDF Plugin', filename: 'chrome-pdf.js' },
          { name: 'Widevine Content Decryption Module', filename: 'widevinecdm.dll' },
          { name: 'Native Client', filename: 'nacl_irt.nexe' }
        ];
        
        // Randomize navigator.plugins
        const plugins = pluginsOptions.slice(0, Math.floor(Math.random() * 3 + 2));
        Object.defineProperty(navigator, 'plugins', {
          get: () => plugins.map(p => ({ name: p.name, filename: p.filename }))
        });

        // Randomize navigator.languages
        const languages = [
          ['pt-BR', 'pt'],
          ['en-US', 'en'],
          ['es-ES', 'es'],
          ['fr-FR', 'fr']
        ][Math.floor(Math.random() * 4)];
        Object.defineProperty(navigator, 'languages', { get: () => languages });

        // Randomize WebGL
        const gl = document.createElement('canvas').getContext('webgl');
        if (gl) {
          gl.getParameter = (function(original) {
            return function(param) {
              if (param === 0x1F00) return vendors[Math.floor(Math.random() * vendors.length)]; // VENDOR
              if (param === 0x1F01) return renderers[Math.floor(Math.random() * renderers.length)]; // RENDERER
              return original.call(this, param);
            };
          })(gl.getParameter);
        }

        // Reduce precision temporal
        const originalNow = Date.now;
        Date.now = () => Math.round(originalNow() / 10) * 10;
        performance.now = () => Math.round(performance.now() / 10) * 10;
        
        // Override platform
        const platforms = ['Win32', 'MacIntel', 'Linux x86_64'];
        Object.defineProperty(navigator, 'platform', {
          get: () => platforms[Math.floor(Math.random() * platforms.length)]
        });
        
        // Override hardware concurrency
        Object.defineProperty(navigator, 'hardwareConcurrency', {
          get: () => Math.floor(Math.random() * 8) + 2
        });
        
        // Override device memory
        Object.defineProperty(navigator, 'deviceMemory', {
          get: () => [2, 4, 8, 16][Math.floor(Math.random() * 4)]
        });
      });
      
      logger.info(`Browser properties randomized for account ${accountId}`, accountId);
    } catch (error) {
      logger.error(`Error randomizing browser properties`, accountId, error);
    }
  }

  /**
   * Spoof telemetry data
   * @param {Object} page - Puppeteer page object
   * @param {string} accountId - Account identifier
   */
  async spoofTelemetry(page, accountId) {
    try {
      await page.evaluateOnNewDocument(() => {
        // Randomize canvas fingerprint
        const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
        const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
        
        HTMLCanvasElement.prototype.toDataURL = function(type, quality) {
          const data = originalToDataURL.call(this, type, quality);
          
          // Only modify if it's likely being used for fingerprinting
          if (this.width === 16 && this.height === 16 || 
              this.width > 100 && this.height > 50) {
            
            // Clone the canvas and modify it slightly
            const canvas = document.createElement('canvas');
            canvas.width = this.width;
            canvas.height = this.height;
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.src = data;
            ctx.drawImage(img, 0, 0);
            
            // Get image data
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            
            // Modify image data slightly
            for (let i = 0; i < imageData.data.length; i += 4) {
              if (Math.random() < 0.01) { // Only modify 1% of pixels
                imageData.data[i] += Math.floor(Math.random() * 3) - 1;     // R
                imageData.data[i + 1] += Math.floor(Math.random() * 3) - 1; // G
                imageData.data[i + 2] += Math.floor(Math.random() * 3) - 1; // B
              }
            }
            
            ctx.putImageData(imageData, 0, 0);
            return canvas.toDataURL(type, quality);
          }
          
          return data;
        };
        
        CanvasRenderingContext2D.prototype.getImageData = function(sx, sy, sw, sh) {
          const imageData = originalGetImageData.call(this, sx, sy, sw, sh);
          
          // Only modify if it's likely being used for fingerprinting
          if ((sw === 16 && sh === 16) || (sw > 100 && sh > 50)) {
            for (let i = 0; i < imageData.data.length; i += 4) {
              if (Math.random() < 0.01) { // Only modify 1% of pixels
                imageData.data[i] += Math.floor(Math.random() * 3) - 1;     // R
                imageData.data[i + 1] += Math.floor(Math.random() * 3) - 1; // G
                imageData.data[i + 2] += Math.floor(Math.random() * 3) - 1; // B
              }
            }
          }
          
          return imageData;
        };

        // Simulate mouse movement
        setInterval(() => {
          try {
            const event = new MouseEvent('mousemove', {
              bubbles: true,
              cancelable: true,
              clientX: Math.random() * window.innerWidth,
              clientY: Math.random() * window.innerHeight,
              movementX: Math.random() * 5 - 2.5,
              movementY: Math.random() * 5 - 2.5
            });
            document.dispatchEvent(event);
          } catch (e) {
            // Ignore errors
          }
        }, 2000 + Math.random() * 5000);

        // Simulate keyboard events
        if (Math.random() < 0.3) { // 30% chance to enable keyboard events
          setInterval(() => {
            try {
              const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Escape'];
              const key = keys[Math.floor(Math.random() * keys.length)];
              const event = new KeyboardEvent('keydown', { key, bubbles: true });
              document.dispatchEvent(event);
              
              setTimeout(() => {
                const upEvent = new KeyboardEvent('keyup', { key, bubbles: true });
                document.dispatchEvent(upEvent);
              }, 100 + Math.random() * 200);
            } catch (e) {
              // Ignore errors
            }
          }, 10000 + Math.random() * 30000);
        }
        
        // Randomize media capabilities
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
          const originalEnumerateDevices = navigator.mediaDevices.enumerateDevices;
          navigator.mediaDevices.enumerateDevices = async function() {
            const devices = await originalEnumerateDevices.apply(this, arguments);
            
            // Filter randomly some devices
            return devices.filter(() => Math.random() > 0.2);
          };
        }
      });
      
      logger.info(`Telemetry spoofed for account ${accountId}`, accountId);
    } catch (error) {
      logger.error(`Error spoofing telemetry`, accountId, error);
    }
  }

  /**
   * Inject evasion scripts to bypass detection
   * @param {Object} page - Puppeteer page object
   * @param {string} accountId - Account identifier
   */
  async injectEvasionScripts(page, accountId) {
    try {
      await page.evaluateOnNewDocument(() => {
        // Override common detection methods
        
        // Override toString methods
        Function.prototype.toString = new Proxy(Function.prototype.toString, {
          apply(target, thisArg, args) {
            // Make puppeteer navigator functions look normal
            if (thisArg && 
                (thisArg === navigator.permissions.query || 
                thisArg === navigator.webdriver || 
                thisArg === navigator.plugins || 
                thisArg === navigator.languages)) {
              return 'function () { [native code] }';
            }
            // Default behavior for everything else
            return target.apply(thisArg, args);
          }
        });
        
        // Override navigator behavior
        const newProto = navigator.__proto__;
        delete newProto.webdriver;
        navigator.__proto__ = newProto;
        
        // Override permissions API
        if (navigator.permissions) {
          const originalQuery = navigator.permissions.query;
          navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ||
            parameters.name === 'clipboard-read' ||
            parameters.name === 'clipboard-write' ||
            parameters.name === 'geolocation'
          )
            ? Promise.resolve({ state: 'prompt', onchange: null })
            : originalQuery(parameters);
        }
        
        // Add some lag to functions often used for bot detection
        const addLag = (obj, methodName) => {
          const original = obj[methodName];
          obj[methodName] = function(...args) {
            if (Math.random() < 0.1) { // 10% chance to add lag
              const delay = Math.random() * 20 + 5;
              return new Promise(resolve => {
                setTimeout(() => {
                  resolve(original.apply(this, args));
                }, delay);
              });
            }
            return original.apply(this, args);
          };
        };
        
        // Add lag to common detection methods
        if (document.querySelectorAll) addLag(document, 'querySelectorAll');
        if (document.getElementById) addLag(document, 'getElementById');
        if (document.getElementsByTagName) addLag(document, 'getElementsByTagName');
        
        // Override WebGL fingerprinting
        const getParameterProxy = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
          // Add some inconsistencies in WebGL parameters
          if (parameter === 3415) return 0;  // MAX_VERTEX_UNIFORM_VECTORS
          if (parameter === 3414) return 0;  // MAX_FRAGMENT_UNIFORM_VECTORS
          if (parameter === 35661) return 32; // MAX_VERTEX_TEXTURE_IMAGE_UNITS
          if (parameter === 34930) return 16; // MAX_VARYING_VECTORS
          if (parameter === 3379) return 16384; // MAX_TEXTURE_SIZE
          
          return getParameterProxy.apply(this, arguments);
        };
      });
      
      logger.info(`Evasion scripts injected for account ${accountId}`, accountId);
    } catch (error) {
      logger.error(`Error injecting evasion scripts`, accountId, error);
    }
  }

  /**
   * Combine captcha images for solving
   * @param {Array<Buffer>} imageBuffers - Array of image buffers
   * @returns {Promise<Buffer>} - Combined image buffer
   */
  async combineImages(imageBuffers) {
    try {
      const canvas = createCanvas(400, 100);
      const ctx = canvas.getContext('2d');
      
      for (let i = 0; i < 4; i++) {
        const img = await loadImage(imageBuffers[i]);
        ctx.drawImage(img, i * 100, 0, 100, 100);
      }
      
      return canvas.toBuffer();
    } catch (error) {
      logger.error('Error combining images', null, error);
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
      // Chance to scroll randomly
      if (Math.random() < 0.7) {
        await page.evaluate(() => {
          window.scrollBy({
            top: (Math.random() * 200) - 100,
            behavior: 'smooth'
          });
        });
        
        await delay(randomInteger(300, 1200));
      }
      
      // Chance to move mouse randomly
      if (Math.random() < 0.5) {
        const x = randomInteger(0, page.viewport().width);
        const y = randomInteger(0, page.viewport().height);
        
        await page.mouse.move(x, y, { steps: randomInteger(2, 5) });
        await delay(randomInteger(100, 800));
      }
      
      // Chance to pause briefly
      if (Math.random() < 0.3) {
        await delay(randomInteger(1000, 5000));
      }
      
      logger.debug(`Added random behavior`, accountId);
    } catch (error) {
      logger.error(`Error adding random behavior`, accountId, error);
    }
  }

  /**
   * Randomize scroll behavior
   * @param {Object} page - Puppeteer page object
   * @param {string} accountId - Account identifier
   */
  async randomScroll(page, accountId) {
    try {
      await page.evaluate(() => {
        const scrollAmount = Math.random() * 200 - 100;
        window.scrollBy({
          top: scrollAmount,
          left: 0,
          behavior: 'smooth'
        });
      });
      
      logger.debug(`Page scrolled randomly by ${accountId}`, accountId);
      await delay(randomInteger(500, 2000));
    } catch (error) {
      logger.error(`Error during random scroll`, accountId, error);
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
      // Check for common bot detection patterns
      const detectionMarkers = await page.evaluate(() => {
        const results = [];
        
        // Check for recaptcha
        if (document.querySelector('.g-recaptcha') || 
            document.querySelector('iframe[src*="recaptcha"]') ||
            document.querySelector('.recaptcha-checkbox')) {
          results.push('reCAPTCHA detected');
        }
        
        // Check for hCaptcha
        if (document.querySelector('.h-captcha') || 
            document.querySelector('iframe[src*="hcaptcha"]')) {
          results.push('hCaptcha detected');
        }
        
        // Check for Cloudflare protection
        if (document.querySelector('#cf-error-details') || 
            document.querySelector('.cf-error-code') || 
            document.querySelector('iframe[src*="cloudflare"]')) {
          results.push('Cloudflare protection detected');
        }
        
        // Check for common bot detection message patterns
        const pageText = document.body.innerText.toLowerCase();
        const detectionPhrases = [
          'automated access', 'bot detected', 'unusual activity',
          'suspicious activity', 'automated software', 'prove you are human'
        ];
        
        for (const phrase of detectionPhrases) {
          if (pageText.includes(phrase)) {
            results.push(`Detection phrase found: "${phrase}"`);
          }
        }
        
        return results;
      });
      
      if (detectionMarkers.length > 0) {
        logger.warn(`Bot detection markers found: ${detectionMarkers.join(', ')}`, accountId);
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error(`Error checking for bot detection`, accountId, error);
      return true; // Assume detection is present if there's an error
    }
  }
}

module.exports = new AntiDetection();
