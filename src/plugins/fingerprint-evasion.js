/**
 * Advanced fingerprinting evasion plugin
 * Provides specialized techniques to avoid browser fingerprinting detection
 */

const logger = require('../utils/logger');
const { randomInteger, randomItem, randomFloat } = require('../utils/helpers');
const { FINGERPRINT } = require('../config');

/**
 * Provides methods to avoid browser fingerprinting techniques
 */
class FingerprintEvasion {
  constructor() {
    // Common WebGL fingerprinting constants
    this.WEBGL_VENDOR_OVERRIDE = FINGERPRINT.WEBGL_VENDORS;
    this.WEBGL_RENDERER_OVERRIDE = FINGERPRINT.WEBGL_RENDERERS;
  }
  
  /**
   * Apply comprehensive fingerprint evasion to a page
   * @param {Object} page - Puppeteer page object
   * @param {string} accountId - Account identifier
   */
  async applyEvasionTechniques(page, accountId) {
    try {
      // Apply all evasion techniques in parallel
      await Promise.all([
        this.evadeCanvasFingerprinting(page, accountId),
        this.evadeWebGLFingerprinting(page, accountId),
        this.evadeAudioFingerprinting(page, accountId),
        this.evadeFontFingerprinting(page, accountId),
        this.evadeHardwareFingerprinting(page, accountId),
        this.evadeTimingAttacks(page, accountId),
        this.evadeBotDetectionAPIs(page, accountId),
        this.evadePermissionFingerprinting(page, accountId),
        this.evadeFeatureDetectionFingerprinting(page, accountId)
      ]);
      
      logger.info(`Applied comprehensive fingerprint evasion techniques`, accountId);
    } catch (error) {
      logger.error(`Error applying fingerprint evasion: ${error.message}`, accountId, error);
    }
  }
  
  /**
   * Evade canvas fingerprinting techniques
   * @param {Object} page - Puppeteer page object
   * @param {string} accountId - Account identifier
   */
  async evadeCanvasFingerprinting(page, accountId) {
    try {
      await page.evaluateOnNewDocument(() => {
        // Advanced canvas fingerprinting protection
        const originalGetContext = HTMLCanvasElement.prototype.getContext;
        const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
        const originalToBlob = HTMLCanvasElement.prototype.toBlob;
        const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
        
        // Function to add consistent noise to canvas
        const addCanvasNoise = (data) => {
          // Use deterministic noise based on canvas dimensions and content
          // This ensures the same canvas will get the same noise pattern
          // but different canvases will get different patterns
          const canvasKey = data.width + "x" + data.height + ":" + 
                            data.data.reduce((sum, val, i) => i % 64 === 0 ? sum + val : sum, 0);
          
          // Generate a pseudo-random seed for this canvas
          let seed = 0;
          for (let i = 0; i < canvasKey.length; i++) {
            seed = ((seed << 5) - seed) + canvasKey.charCodeAt(i);
            seed = seed & seed; // Convert to 32bit integer
          }
          
          // Add subtle, deterministic noise
          const seedRandom = (input) => {
            const x = Math.sin(input++) * 10000;
            return x - Math.floor(x);
          };
          
          for (let i = 0; i < data.data.length; i += 4) {
            // Only modify a small subset of pixels (1%)
            if (seedRandom(seed + i) < 0.01) {
              // Get deterministic noise value (-1, 0, or 1)
              const noise = Math.floor(seedRandom(seed + i + 1) * 3) - 1;
              
              // Apply consistent noise to RGB channels
              data.data[i] = Math.max(0, Math.min(255, data.data[i] + noise)); // Red
              data.data[i+1] = Math.max(0, Math.min(255, data.data[i+1] + noise)); // Green
              data.data[i+2] = Math.max(0, Math.min(255, data.data[i+2] + noise)); // Blue
              
              // Don't modify alpha channel
            }
          }
          
          return data;
        };
        
        // Override getContext
        HTMLCanvasElement.prototype.getContext = function(type, ...args) {
          const context = originalGetContext.apply(this, [type, ...args]);
          
          if (context && type === '2d') {
            // Capture draw methods that might be used for fingerprinting
            const originalFillText = context.fillText;
            context.fillText = function(...args) {
              // Check if this appears to be fingerprinting
              if (args[0]?.includes && (
                  args[0].includes('Cwm fjordbank') || // Common fingerprinting text
                  args[0].includes('Sphinx') ||
                  args[0].includes('@') ||
                  args[0].length > 20 && /[A-Za-z0-9]/.test(args[0])
                )) {
                // Modify the text slightly to change fingerprint
                args[0] = args[0].split('').map(c => 
                  Math.random() < 0.1 ? 
                  String.fromCharCode(c.charCodeAt(0) + (Math.random() > 0.5 ? 1 : -1)) : 
                  c
                ).join('');
              }
              return originalFillText.apply(this, args);
            };
          }
          
          return context;
        };
        
        // Override toDataURL
        HTMLCanvasElement.prototype.toDataURL = function(...args) {
          // Only modify if this is likely a fingerprinting attempt
          if (this.width === 16 && this.height === 16 ||       // FingerprintJS size
              this.width < 300 && this.height < 100 ||        // Likely fingerprinting sizes
              args[0] === 'image/webp' && args[1] === 0.00001) { // Specific fingerprinting technique
            
            const context = this.getContext('2d');
            if (context) {
              // Get the image data, modify it, and put it back
              const imageData = context.getImageData(0, 0, this.width, this.height);
              const noisyData = addCanvasNoise(imageData);
              context.putImageData(noisyData, 0, 0);
            }
          }
          
          return originalToDataURL.apply(this, args);
        };
        
        // Override toBlob
        HTMLCanvasElement.prototype.toBlob = function(callback, ...args) {
          // Get the original image as DataURL
          const dataURL = originalToDataURL.apply(this, args);
          
          // Only modify if this is likely a fingerprinting attempt
          if (this.width === 16 && this.height === 16 || 
              this.width < 300 && this.height < 100) {
            
            const context = this.getContext('2d');
            if (context) {
              // Get the image data, modify it, and put it back
              const imageData = context.getImageData(0, 0, this.width, this.height);
              const noisyData = addCanvasNoise(imageData);
              context.putImageData(noisyData, 0, 0);
            }
          }
          
          // Create and return the modified blob
          return originalToBlob.apply(this, [callback, ...args]);
        };
        
        // Override getImageData
        CanvasRenderingContext2D.prototype.getImageData = function(...args) {
          const imageData = originalGetImageData.apply(this, args);
          
          // Only modify small imageData that might be for fingerprinting
          if (imageData.width === 16 && imageData.height === 16 || 
              imageData.width < 300 && imageData.height < 100) {
            return addCanvasNoise(imageData);
          }
          
          return imageData;
        };
      });
      
      logger.debug(`Applied canvas fingerprinting evasion`, accountId);
    } catch (error) {
      logger.error(`Error setting up canvas fingerprinting evasion: ${error.message}`, accountId, error);
    }
  }
  
  /**
   * Evade WebGL fingerprinting techniques
   * @param {Object} page - Puppeteer page object
   * @param {string} accountId - Account identifier
   */
  async evadeWebGLFingerprinting(page, accountId) {
    try {
      await page.evaluateOnNewDocument((config) => {
        // Get the WebGL rendering contexts
        const getParameterProxyGL1 = WebGLRenderingContext.prototype.getParameter;
        const getParameterProxyGL2 = WebGL2RenderingContext?.prototype?.getParameter;
        
        // Function to create a custom WebGL parameter override function
        const createWebGLProxy = (original, vendorOptions, rendererOptions) => {
          // Select random but consistent vendor and renderer
          // Use a seed based on day to keep consistent across page refreshes
          const dateKey = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
          let seed = 0;
          for (let i = 0; i < dateKey.length; i++) {
            seed = ((seed << 5) - seed) + dateKey.charCodeAt(i);
            seed = seed & seed;
          }
          
          const seededRandom = (max) => {
            seed = (seed * 9301 + 49297) % 233280;
            return seed / 233280 * max;
          };
          
          const vendorIndex = Math.floor(seededRandom(vendorOptions.length));
          const rendererIndex = Math.floor(seededRandom(rendererOptions.length));
          
          const selectedVendor = vendorOptions[vendorIndex];
          const selectedRenderer = rendererOptions[rendererIndex];
          
          // Create and return the proxy function
          return function(parameter) {
            // Override WebGL vendor/renderer info
            if (parameter === 0x1F00) {         // VENDOR
              return selectedVendor;
            } else if (parameter === 0x1F01) {  // RENDERER
              return selectedRenderer;
            } else if (parameter === 0x9245) {  // UNMASKED_VENDOR_WEBGL (WebGL 2)
              return selectedVendor;
            } else if (parameter === 0x9246) {  // UNMASKED_RENDERER_WEBGL (WebGL 2)
              return selectedRenderer;
            } else if (parameter === 37445) {   // UNMASKED_VENDOR_WEBGL (non-standard)
              return selectedVendor;
            } else if (parameter === 37446) {   // UNMASKED_RENDERER_WEBGL (non-standard)
              return selectedRenderer;
            }
            
            // Add small variations to other parameters that might be used for fingerprinting
            if (parameter === 0x8B8D || // MAX_VERTEX_UNIFORM_VECTORS
                parameter === 0x8DFD || // MAX_TEXTURE_MAX_ANISOTROPY_EXT
                parameter === 0x8073 || // MAX_COMBINED_TEXTURE_IMAGE_UNITS
                parameter === 0x8B4B || // MAX_VERTEX_TEXTURE_IMAGE_UNITS
                parameter === 0x8D57) { // MAX_CUBE_MAP_TEXTURE_SIZE
              
              // Get the original value and add a small offset
              const originalValue = original.apply(this, arguments);
              if (typeof originalValue === 'number') {
                // Add consistent noise (-1, 0, or +1) to specific parameters
                const noiseOffset = Math.floor(seededRandom(3)) - 1;
                return originalValue + noiseOffset;
              }
            }
            
            return original.apply(this, arguments);
          };
        };
        
        // Apply the proxy to WebGL1
        WebGLRenderingContext.prototype.getParameter = 
          createWebGLProxy(getParameterProxyGL1, config.vendors, config.renderers);
        
        // Apply the proxy to WebGL2 if it exists
        if (getParameterProxyGL2) {
          WebGL2RenderingContext.prototype.getParameter = 
            createWebGLProxy(getParameterProxyGL2, config.vendors, config.renderers);
        }
        
        // Also modify WebGL fingerprinting via canvas
        const getContextProxy = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(contextType, ...args) {
          const context = getContextProxy.apply(this, [contextType, ...args]);
          
          if (contextType === 'webgl' || contextType === 'experimental-webgl' || 
              contextType === 'webgl2') {
            
            // Add randomness to WebGL readPixels to affect fingerprinting
            const originalReadPixels = context.readPixels;
            context.readPixels = function(...args) {
              originalReadPixels.apply(this, args);
              
              // Small chance of modifying the data (only for likely fingerprinting sizes)
              if (args[2] < 64 && args[3] < 64 && args[4] instanceof Uint8Array) {
                const data = args[4];
                
                // Generate a consistent but unique key for this canvas
                const canvasKey = this.canvas.width + "x" + this.canvas.height + ":" + 
                                args[0] + "," + args[1] + "," + args[2] + "," + args[3];
                
                let pixelSeed = 0;
                for (let i = 0; i < canvasKey.length; i++) {
                  pixelSeed = ((pixelSeed << 5) - pixelSeed) + canvasKey.charCodeAt(i);
                  pixelSeed = pixelSeed & pixelSeed;
                }
                
                // Modify a small subset of pixels
                for (let i = 0; i < data.length; i += 4) {
                  // Deterministic noise based on position and canvas key
                  const shouldModify = (pixelSeed + i) % 256 < 3; // ~1% chance
                  
                  if (shouldModify) {
                    // Small consistent modification to RGB channels
                    const mod = ((pixelSeed + i) % 3) - 1; // -1, 0, or 1
                    data[i] = Math.max(0, Math.min(255, data[i] + mod));
                    data[i+1] = Math.max(0, Math.min(255, data[i+1] + mod));
                    data[i+2] = Math.max(0, Math.min(255, data[i+2] + mod));
                    // Don't modify alpha
                  }
                }
              }
            };
          }
          
          return context;
        };
      }, { 
        vendors: this.WEBGL_VENDOR_OVERRIDE, 
        renderers: this.WEBGL_RENDERER_OVERRIDE 
      });
      
      logger.debug(`Applied WebGL fingerprinting evasion`, accountId);
    } catch (error) {
      logger.error(`Error setting up WebGL fingerprinting evasion: ${error.message}`, accountId, error);
    }
  }
  
  /**
   * Evade audio fingerprinting techniques
   * @param {Object} page - Puppeteer page object
   * @param {string} accountId - Account identifier
   */
  async evadeAudioFingerprinting(page, accountId) {
    try {
      await page.evaluateOnNewDocument(() => {
        // Generate a consistent but random audio fingerprint
        const generateConsistentAudioFingerprint = () => {
          // Use the date as a seed to keep consistent during the same day
          const dateKey = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
          let seed = 0;
          for (let i = 0; i < dateKey.length; i++) {
            seed = ((seed << 5) - seed) + dateKey.charCodeAt(i);
            seed = seed & seed;
          }
          
          // Seeded random function
          const seededRandom = () => {
            seed = (seed * 9301 + 49297) % 233280;
            return seed / 233280;
          };
          
          // Create a consistent audio fingerprint
          return {
            channelCount: 2,
            maxChannelCount: 2,
            supportedNoiseTypes: ['white', 'pink', 'brown'],
            maxFrameCount: Math.floor(seededRandom() * 3000) + 20000,
            minFrameCount: Math.floor(seededRandom() * 500) + 500,
            sampleRate: [44100, 48000, 96000, 192000][Math.floor(seededRandom() * 4)],
            noise: Array.from({ length: 20 }, () => seededRandom() * 0.0001)
          };
        };
        
        // Get the consistent audio fingerprint
        const audioFingerprint = generateConsistentAudioFingerprint();
        
        // Protect the AudioContext creation and analysis
        if (window.AudioContext || window.webkitAudioContext) {
          const OriginalAudioContext = window.AudioContext || window.webkitAudioContext;
          
          // Create a modified AudioContext constructor
          window.AudioContext = window.webkitAudioContext = function(...args) {
            const audioContext = new OriginalAudioContext(...args);
            
            // Override createOscillator - used in fingerprinting
            const originalCreateOscillator = audioContext.createOscillator;
            audioContext.createOscillator = function(...oscArgs) {
              const oscillator = originalCreateOscillator.apply(this, oscArgs);
              // Modify subtle properties to affect fingerprinting
              Object.defineProperty(oscillator, 'frequency', {
                get: function() {
                  return this._frequency || { 
                    value: 440, 
                    defaultValue: 440,
                    automationRate: "a-rate",
                    minValue: 0,
                    maxValue: audioFingerprint.sampleRate / 2,
                    setValueAtTime: function() {}
                  };
                },
                set: function(value) {
                  this._frequency = value;
                }
              });
              return oscillator;
            };
            
            // Override createAnalyser - used in fingerprinting
            const originalCreateAnalyser = audioContext.createAnalyser;
            audioContext.createAnalyser = function(...analyserArgs) {
              const analyser = originalCreateAnalyser.apply(this, analyserArgs);
              
              // Override getFloatFrequencyData to add subtle noise
              const originalGetFloatFrequencyData = analyser.getFloatFrequencyData;
              analyser.getFloatFrequencyData = function(array) {
                originalGetFloatFrequencyData.call(this, array);
                
                // Add subtle noise to frequency data
                for (let i = 0; i < array.length; i++) {
                  // Add very small consistent noise
                  const noiseIndex = i % audioFingerprint.noise.length;
                  array[i] += audioFingerprint.noise[noiseIndex];
                }
              };
              
              // Override getByteFrequencyData to add subtle noise
              const originalGetByteFrequencyData = analyser.getByteFrequencyData;
              analyser.getByteFrequencyData = function(array) {
                originalGetByteFrequencyData.call(this, array);
                
                // Add subtle noise to frequency data
                for (let i = 0; i < array.length; i++) {
                  // Add very small consistent noise
                  const noiseIndex = i % audioFingerprint.noise.length;
                  array[i] = Math.max(0, Math.min(255, 
                    array[i] + Math.floor(audioFingerprint.noise[noiseIndex] * 10)
                  ));
                }
              };
              
              return analyser;
            };
            
            // Override sampleRate property
            Object.defineProperty(audioContext, 'sampleRate', {
              get: () => audioFingerprint.sampleRate
            });
            
            return audioContext;
          };
        }
      });
      
      logger.debug(`Applied audio fingerprinting evasion`, accountId);
    } catch (error) {
      logger.error(`Error setting up audio fingerprinting evasion: ${error.message}`, accountId, error);
    }
  }
  
  /**
   * Evade font enumeration and detection
   * @param {Object} page - Puppeteer page object
   * @param {string} accountId - Account identifier
   */
  async evadeFontFingerprinting(page, accountId) {
    try {
      await page.evaluateOnNewDocument(() => {
        // Common system fonts that most systems have
        const commonFonts = [
          'Arial', 'Calibri', 'Helvetica', 'Tahoma', 'Verdana', 'Times New Roman', 
          'Georgia', 'Trebuchet MS', 'Courier New', 'Courier'
        ];
        
        // Create a consistent but random selection of fonts
        // Use the date as a seed to keep consistent during the same day
        const dateKey = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        let seed = 0;
        for (let i = 0; i < dateKey.length; i++) {
          seed = ((seed << 5) - seed) + dateKey.charCodeAt(i);
          seed = seed & seed;
        }
        
        // Seeded random function
        const seededRandom = () => {
          seed = (seed * 9301 + 49297) % 233280;
          return seed / 233280;
        };
        
        // Get a consistent subset of fonts
        const availableFonts = [...commonFonts].sort(() => seededRandom() - 0.5).slice(0, 7);
        
        // Function to check if target is a font enumeration technique
        const isFontEnumeration = (prop, args) => {
          // Common font detection CSS properties
          if (['fontFamily', 'font-family', 'font'].includes(prop)) {
            return true;
          }
          
          // Detect font enumeration in CSS rules
          if (args && args[0] && typeof args[0] === 'string') {
            const str = args[0].toLowerCase();
            if (str.includes('@font-face') || str.includes('font-family:')) {
              return true;
            }
          }
          
          return false;
        };
        
        // Override font detection mechanisms
        
        // 1. Element style property access
        const originalGetPropertyValue = window.getComputedStyle(document.createElement('div')).getPropertyValue;
        window.CSSStyleDeclaration.prototype.getPropertyValue = function(prop) {
          if (isFontEnumeration(prop)) {
            // Return only fonts that we've decided are "installed"
            const fontFamily = originalGetPropertyValue.call(this, prop);
            
            if (fontFamily && typeof fontFamily === 'string') {
              // Parse the font family string into individual font names
              const fonts = fontFamily.split(',').map(f => f.trim().replace(/["']/g, ''));
              
              // Filter to only include fonts in our available list plus generic families
              const genericFamilies = ['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy'];
              const filteredFonts = fonts.filter(font => 
                availableFonts.includes(font) || genericFamilies.includes(font.toLowerCase())
              );
              
              // Return the filtered font list or a fallback if empty
              return filteredFonts.length > 0 ? filteredFonts.join(', ') : 'sans-serif';
            }
          }
          
          return originalGetPropertyValue.call(this, prop);
        };
        
        // 2. Override document.fonts API
        if (document.fonts) {
          // Override fonts.check method
          const originalCheck = document.fonts.check;
          document.fonts.check = function(font, text) {
            // Parse the font family from the font string
            const fontFamily = (font.match(/['"]?([^'"]+)['"]?/) || [])[1];
            
            if (fontFamily) {
              // Only return true for fonts in our available list
              return availableFonts.includes(fontFamily) || 
                ['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy'].includes(fontFamily.toLowerCase());
            }
            
            return originalCheck.apply(this, arguments);
          };
          
          // Create a custom font iterator
          const fontIterator = {
            next: function() {
              if (this._index >= availableFonts.length) {
                return { done: true };
              }
              
              return { 
                value: { family: availableFonts[this._index++] },
                done: false
              };
            },
            _index: 0
          };
          
          // Override fonts iterator
          document.fonts[Symbol.iterator] = function() {
            return fontIterator;
          };
        }
        
        // 3. Override canvas font measurements
        const originalMeasureText = CanvasRenderingContext2D.prototype.measureText;
        CanvasRenderingContext2D.prototype.measureText = function(text) {
          // Call original method
          const metrics = originalMeasureText.apply(this, arguments);
          
          // Check if this appears to be a font detection technique
          if (text === 'mmmmmmmmmmlli' || text.length === 1 || text === '!') {
            // Get the current font
            const fontFamily = this.font.split(' ').pop().replace(/["']/g, '');
            
            // If the font isn't in our available list, simulate fallback metrics
            if (!availableFonts.includes(fontFamily) && 
                !['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy'].includes(fontFamily.toLowerCase())) {
              
              // Modify width with consistent randomness based on the font name
              let fontSeed = 0;
              for (let i = 0; i < fontFamily.length; i++) {
                fontSeed = ((fontSeed << 5) - fontSeed) + fontFamily.charCodeAt(i);
                fontSeed = fontSeed & fontSeed;
              }
              
              // Generate a consistent offset (±3%)
              const widthOffset = (fontSeed % 60 - 30) / 1000;
              
              // Apply small modifications to metrics
              Object.defineProperty(metrics, 'width', {
                get: function() {
                  return this._width * (1 + widthOffset);
                },
                set: function(val) {
                  this._width = val;
                }
              });
              metrics._width = metrics.width;
            }
          }
          
          return metrics;
        };
      });
      
      logger.debug(`Applied font fingerprinting evasion`, accountId);
    } catch (error) {
      logger.error(`Error setting up font fingerprinting evasion: ${error.message}`, accountId, error);
    }
  }
  
  /**
   * Evade hardware information fingerprinting
   * @param {Object} page - Puppeteer page object
   * @param {string} accountId - Account identifier
   */
  async evadeHardwareFingerprinting(page, accountId) {
    try {
      // Choose a consistent but random value for hardware info
      const dateKey = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      let seed = 0;
      for (let i = 0; i < dateKey.length; i++) {
        seed = ((seed << 5) - seed) + dateKey.charCodeAt(i);
        seed = seed & seed;
      }
      
      // Generate CPU cores (4-16)
      const cpuCores = 4 + (seed % 13);
      
      // Generate device memory (2-16 in powers of 2)
      const memoryOptions = [2, 4, 8, 16];
      const deviceMemory = memoryOptions[(seed >> 8) % 4];
      
      await page.evaluateOnNewDocument(({ cpuCores, deviceMemory }) => {
        // Override navigator.hardwareConcurrency (CPU cores)
        if (navigator.hardwareConcurrency) {
          Object.defineProperty(navigator, 'hardwareConcurrency', {
            get: () => cpuCores
          });
        }
        
        // Override navigator.deviceMemory (RAM in GB)
        if (navigator.deviceMemory) {
          Object.defineProperty(navigator, 'deviceMemory', {
            get: () => deviceMemory
          });
        }
        
        // Override battery API
        if (navigator.getBattery) {
          navigator.getBattery = function() {
            // Return a fake battery object
            return Promise.resolve({
              charging: Math.random() > 0.2, // 80% chance of charging
              chargingTime: Math.random() > 0.5 ? Infinity : Math.floor(Math.random() * 3600),
              dischargingTime: Math.random() > 0.5 ? Infinity : Math.floor(Math.random() * 7200),
              level: 0.5 + Math.random() * 0.5, // 50-100% battery
              addEventListener: () => {},
              removeEventListener: () => {}
            });
          };
        }
        
        // Override performance information
        if (window.performance) {
          // Memory info override
          if (performance.memory) {
            Object.defineProperty(performance, 'memory', {
              get: () => ({
                jsHeapSizeLimit: deviceMemory * 1073741824, // Convert GB to bytes
                totalJSHeapSize: deviceMemory * 0.6 * 1073741824,
                usedJSHeapSize: deviceMemory * 0.4 * 1073741824
              })
            });
          }
          
          // Override timing functions for consistent behavior
          const originalGetEntries = performance.getEntries;
          performance.getEntries = function() {
            const entries = originalGetEntries.apply(this, arguments);
            
            // Filter out entries that might reveal fingerprinting information
            return entries.filter(entry => 
              !(entry.name && (
                entry.name.includes('captcha') || 
                entry.name.includes('fingerprint') || 
                entry.name.includes('beacon')
              ))
            );
          };
        }
      }, { cpuCores, deviceMemory });
      
      logger.debug(`Applied hardware fingerprinting evasion`, accountId);
    } catch (error) {
      logger.error(`Error setting up hardware fingerprinting evasion: ${error.message}`, accountId, error);
    }
  }
  
  /**
   * Evade timing attack fingerprinting
   * @param {Object} page - Puppeteer page object
   * @param {string} accountId - Account identifier
   */
  async evadeTimingAttacks(page, accountId) {
    try {
      await page.evaluateOnNewDocument(() => {
        // Override timing functions with reduced precision
        const originalDateNow = Date.now;
        const originalPerformanceNow = performance.now;
        
        // Function to add controlled noise to timestamps
        const addTimingNoise = (timestamp, factor = 10) => {
          // Round to reduce precision
          return Math.floor(timestamp / factor) * factor;
        };
        
        // Override Date.now with reduced precision
        Date.now = function() {
          return addTimingNoise(originalDateNow.call(this), 10);
        };
        
        // Override performance.now with reduced precision
        performance.now = function() {
          return addTimingNoise(originalPerformanceNow.call(this), 10);
        };
        
        // Override requestAnimationFrame to reduce detection by timing patterns
        const originalRequestAnimationFrame = window.requestAnimationFrame;
        window.requestAnimationFrame = function(callback) {
          const wrappedCallback = (timestamp) => {
            const noisyTimestamp = addTimingNoise(timestamp, 10);
            return callback(noisyTimestamp);
          };
          return originalRequestAnimationFrame.call(this, wrappedCallback);
        };
        
        // Patch for high-resolution time conversion API
        if (Intl.DateTimeFormat) {
          const originalFormat = Intl.DateTimeFormat.prototype.format;
          Intl.DateTimeFormat.prototype.format = function(...args) {
            // For high-resolution formatter (with milliseconds/microseconds)
            if (this.resolvedOptions && this.resolvedOptions().fractionalSecondDigits > 0) {
              const date = args[0] || new Date();
              
              // Create a new date with milliseconds rounded
              const roundedDate = new Date(addTimingNoise(date.getTime(), 10));
              args[0] = roundedDate;
            }
            
            return originalFormat.apply(this, args);
          };
        }
      });
      
      logger.debug(`Applied timing attack evasion`, accountId);
    } catch (error) {
      logger.error(`Error setting up timing attack evasion: ${error.message}`, accountId, error);
    }
  }
  
  /**
   * Evade specific bot detection APIs and properties
   * @param {Object} page - Puppeteer page object
   * @param {string} accountId - Account identifier
   */
  async evadeBotDetectionAPIs(page, accountId) {
    try {
      await page.evaluateOnNewDocument(() => {
        // 1. Override navigator.webdriver
        // This is the most obvious automation flag
        if (navigator.webdriver !== undefined) {
          Object.defineProperty(navigator, 'webdriver', {
            get: () => false
          });
        }
        
        // 2. Override Automation-specific objects
        // Ensure these values appear to be undefined as in a normal browser
        for (const prop of ['__webdriver_script_fn', '__driver_evaluate', '__webdriver_evaluate', 
                            '__selenium_evaluate', '__fxdriver_evaluate', '__driver_unwrapped',
                            '__webdriver_unwrapped', '__selenium_unwrapped', '__fxdriver_unwrapped',
                            '_Selenium_IDE_Recorder', '_selenium', 'calledSelenium',
                            '_WEBDRIVER_ELEM_CACHE', 'ChromeDriverw', 'driver-evaluate',
                            'webdriver-evaluate']) {
          // Delete from window
          if (window[prop]) {
            delete window[prop];
          }
          
          // Also prevent setting these props
          Object.defineProperty(window, prop, {
            get: () => undefined,
            set: () => {},
            configurable: false
          });
        }
        
        // 3. Override document.$cdc_asdjflasutopfhvcZLmcfl_ used by ChromeDriver
        for (const prop in document) {
          if (prop.includes('$cdc_') || prop.includes('$chrome_') || prop.includes('__webdriver')) {
            delete document[prop];
          }
        }
        
        // 4. Handle automated Chrome DevTools detection
        if (window.chrome) {
          // Make it seem like Chrome DevTools is not open by default
          window.chrome.csi = function() { return {}; };
          window.chrome.loadTimes = function() { return {}; };
          
          // Ensure chrome.runtime appears normal
          if (window.chrome.runtime) {
            // The original sendMessage function
            const originalSendMessage = window.chrome.runtime.sendMessage;
            
            // Override to catch automated detection messages
            window.chrome.runtime.sendMessage = function(...args) {
              if (args[0] && typeof args[0] === 'object' && args[0].type) {
                const msgType = args[0].type;
                if (msgType.includes('automation') || msgType.includes('bot') || 
                    msgType.includes('detect') || msgType.includes('check')) {
                  // Block known detection messages
                  return;
                }
              }
              return originalSendMessage.apply(this, args);
            };
          }
        }
        
        // 5. Override Permissions API used for bot detection
        if (navigator.permissions) {
          const originalQuery = navigator.permissions.query;
          
          navigator.permissions.query = function(parameters) {
            // Specifically target permission queries for automation detection
            if (parameters.name === 'notifications' || 
                parameters.name === 'clipboard-read' || 
                parameters.name === 'clipboard-write') {
              
              return Promise.resolve({
                state: "prompt",
                onchange: null
              });
            }
            
            return originalQuery.call(this, parameters);
          };
        }
        
        // 6. Functions often used to debug and detect bots
        // Make console.debug do nothing when called with certain patterns
        const originalConsoleDebug = console.debug;
        console.debug = function(...args) {
          // Filter out common bot detection console calls
          if (args.length > 0 && typeof args[0] === 'string') {
            if (args[0].includes('WebDriver') || 
                args[0].includes('automation') || 
                args[0].includes('driver') || 
                args[0].includes('bot') || 
                args[0].includes('phantom') || 
                args[0].includes('selenium')) {
              return; // Block these calls
            }
          }
          return originalConsoleDebug.apply(this, args);
        };
        
        // 7. Make it appear like no extensions are installed
        if (typeof chrome === 'object' && chrome.runtime) {
          chrome.runtime.sendMessage = function() {
            return { caught: true };
          };
        }
      });
      
      logger.debug(`Applied bot detection API evasion`, accountId);
    } catch (error) {
      logger.error(`Error setting up bot detection API evasion: ${error.message}`, accountId, error);
    }
  }
  
  /**
   * Evade permission-based fingerprinting
   * @param {Object} page - Puppeteer page object
   * @param {string} accountId - Account identifier
   */
  async evadePermissionFingerprinting(page, accountId) {
    try {
      await page.evaluateOnNewDocument(() => {
        // Override navigator Permissions API
        if (navigator.permissions) {
          const originalQuery = navigator.permissions.query;
          
          navigator.permissions.query = function(parameters) {
            // Return consistent values for common permission requests
            const standardPermissions = [
              'geolocation', 'notifications', 'push', 'midi', 'camera', 'microphone',
              'background-sync', 'ambient-light-sensor', 'accelerometer', 'gyroscope',
              'magnetometer', 'clipboard-read', 'clipboard-write', 'payment-handler',
              'persistent-storage', 'idle-detection'
            ];
            
            if (parameters && parameters.name && standardPermissions.includes(parameters.name)) {
              // Create a response object with a specific state based on permission type
              let state;
              
              // Determine state based on permission type
              if (['geolocation', 'notifications', 'push', 'persistent-storage'].includes(parameters.name)) {
                state = 'prompt'; // Ask for these common permissions
              } else if (['camera', 'microphone'].includes(parameters.name)) {
                state = 'prompt'; // Also ask for media permissions
              } else {
                state = 'denied'; // Deny other permissions by default
              }
              
              // Return a consistent response object
              const result = {
                state: state,
                status: state,
                onchange: null
              };
              
              // Make the promise resolve with our custom result
              return Promise.resolve(result);
            }
            
            // Default to the original behavior for non-standard permissions
            return originalQuery.apply(this, arguments);
          };
        }
        
        // Override media devices
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
          const originalEnumerateDevices = navigator.mediaDevices.enumerateDevices;
          
          navigator.mediaDevices.enumerateDevices = async function() {
            // Get real devices first
            const devices = await originalEnumerateDevices.apply(this, arguments);
            
            // Generate device IDs based on current date (changes daily but consistent within a day)
            const dateKey = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            
            // Function to generate a consistent device ID based on type and index
            const generateDeviceId = (type, index) => {
              const seed = `${dateKey}-${type}-${index}`;
              let hash = 0;
              for (let i = 0; i < seed.length; i++) {
                hash = ((hash << 5) - hash) + seed.charCodeAt(i);
                hash = hash & hash;
              }
              return `${type}-${Math.abs(hash).toString(16).padStart(8, '0')}`;
            };
            
            // Create a limited set of consistent devices
            const videoDevices = [{ 
              deviceId: generateDeviceId('videoinput', 0),
              kind: 'videoinput',
              label: '',
              groupId: generateDeviceId('group', 0)
            }];
            
            const audioDevices = [
              { 
                deviceId: generateDeviceId('audioinput', 0),
                kind: 'audioinput',
                label: '',
                groupId: generateDeviceId('group', 0)
              },
              { 
                deviceId: generateDeviceId('audiooutput', 0),
                kind: 'audiooutput',
                label: '',
                groupId: generateDeviceId('group', 0)
              }
            ];
            
            // Replace the real device list with our consistent one
            return [...videoDevices, ...audioDevices];
          };
        }
      });
      
      logger.debug(`Applied permission fingerprinting evasion`, accountId);
    } catch (error) {
      logger.error(`Error setting up permission fingerprinting evasion: ${error.message}`, accountId, error);
    }
  }
  
  /**
   * Evade feature detection based fingerprinting
   * @param {Object} page - Puppeteer page object
   * @param {string} accountId - Account identifier
   */
  async evadeFeatureDetectionFingerprinting(page, accountId) {
    try {
      await page.evaluateOnNewDocument(() => {
        // Get a consistent but random set of features to support
        // Use the date as a seed to keep consistent during the same day
        const dateKey = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        let seed = 0;
        for (let i = 0; i < dateKey.length; i++) {
          seed = ((seed << 5) - seed) + dateKey.charCodeAt(i);
          seed = seed & seed;
        }
        
        // Function to get deterministic boolean based on feature name
        const shouldSupportFeature = (featureName) => {
          let featureSeed = seed;
          for (let i = 0; i < featureName.length; i++) {
            featureSeed = ((featureSeed << 5) - featureSeed) + featureName.charCodeAt(i);
            featureSeed = featureSeed & featureSeed;
          }
          
          // Common features should be more likely to be supported
          const commonFeatures = [
            'Notification', 'geolocation', 'persistent-storage',
            'ambient-light-sensor', 'accelerometer', 'gyroscope',
            'magnetometer', 'midi', 'payment-handler', 'background-sync'
          ];
          
          const isCommon = commonFeatures.some(f => featureName.includes(f));
          const threshold = isCommon ? 0.1 : 0.3; // 90% for common, 70% for others
          
          return (featureSeed / 2147483647) > threshold;
        };
        
        // Override specific feature detection APIs
        
        // 1. Feature checking using 'in' operator
        // Create a proxy for window to intercept property access for feature detection
        const windowProxy = new Proxy(window, {
          has: function(target, property) {
            // Common feature detection properties
            const featureProps = [
              'WebAssembly', 'SharedArrayBuffer', 'Atomics', 'BigInt',
              'WebGL2RenderingContext', 'RTCPeerConnection', 'RTCSessionDescription',
              'WebAuthentication', 'TouchEvent', 'SpeechRecognition', 'SpeechSynthesis',
              'PaymentRequest', 'Bluetooth', 'Credential', 'FaceDetector', 'Gamepad'
            ];
            
            if (featureProps.includes(property)) {
              // Consistent decision for each feature
              return shouldSupportFeature(property);
            }
            
            // Default behavior
            return property in target;
          }
        });
        
        // 2. Feature detection of CSS properties
        if (window.CSS && window.CSS.supports) {
          const originalCssSupports = window.CSS.supports;
          window.CSS.supports = function(property, value) {
            // Common CSS feature checks
            if (property.includes('backdrop-filter') ||
                property.includes('initial-letter') ||
                property.includes('sticky') ||
                property.includes('font-variation')) {
              
              return shouldSupportFeature(property);
            }
            
            // Default to original behavior
            return originalCssSupports.apply(this, arguments);
          };
        }
        
        // 3. Navigator property access for feature detection
        const navigatorProps = [
          'hardwareConcurrency', 'serviceWorker', 'bluetooth',
          'storage', 'wakeLock', 'geolocation', 'credentials',
          'keyboard', 'usb', 'xr', 'clipboard', 'share'
        ];
        
        for (const prop of navigatorProps) {
          // Only replace if it exists
          if (prop in navigator) {
            // Get the original value
            const originalValue = navigator[prop];
            
            // Override with a property that may return null based on our decision
            Object.defineProperty(navigator, prop, {
              get: function() {
                return shouldSupportFeature(`navigator.${prop}`) ? originalValue : null;
              }
            });
          }
        }
      });
      
      logger.debug(`Applied feature detection fingerprinting evasion`, accountId);
    } catch (error) {
      logger.error(`Error setting up feature detection fingerprinting evasion: ${error.message}`, accountId, error);
    }
  }
}

module.exports = new FingerprintEvasion();