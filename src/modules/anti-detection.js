const { FINGERPRINT } = require('../config');
const logger = require('../utils/logger');
const imageProcessor = require('../utils/image-processor');
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
    try {
      // Import fingerprint evasion plugin
      const fingerprintEvasion = require('../plugins/fingerprint-evasion');
      
      logger.info(`Applying comprehensive anti-detection measures for ${accountId}`, accountId);
      
      // Apply measures in sequence with natural delays between them to avoid detection
      
      // 1. First, apply basic browser property randomization
      await this.randomizeBrowserProperties(page, accountId);
      await delay(randomInteger(100, 300));
      
      // 2. Apply advanced fingerprint evasion techniques
      await fingerprintEvasion.applyEvasionTechniques(page, accountId);
      await delay(randomInteger(100, 300));
      
      // 3. Apply telemetry spoofing
      await this.spoofTelemetry(page, accountId);
      await delay(randomInteger(100, 300));
      
      // 4. Inject scripts to evade bot detection
      await this.injectEvasionScripts(page, accountId);
      await delay(randomInteger(100, 300));
      
      // 5. Apply game-specific evasion (new)
      await this.applyGameSpecificEvasion(page, accountId);
      
      logger.info(`All anti-detection measures applied successfully for ${accountId}`, accountId);
    } catch (error) {
      logger.error(`Error applying anti-detection measures: ${error.message}`, accountId, error);
    }
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
        // Técnicas avançadas de evasão de detecção de bots
        
        // ==========================================
        // 1. Proteção contra detecção de Puppeteer
        // ==========================================
        
        // Oculta o objeto de comunicação Puppeteer do DOM global
        delete window.chrome.csi;
        delete window.chrome.loadTimes;
        
        // Override da propriedade webdriver com armadilha para detecção
        Object.defineProperty(navigator, 'webdriver', {
          get: function() {
            // Detector de chamada de propriedade (stack trace evasion)
            const stack = new Error().stack;
            if (stack.includes('detect') || stack.includes('test') || stack.includes('check') || stack.includes('isBot')) {
              // Se parecer uma verificação de bot, retorne falso
              return false;
            }
            
            // Comportamento probabilístico para evitar consistência detectável
            return Math.random() < 0.01 ? undefined : false;
          },
          configurable: true,
          enumerable: true
        });
        
        // Override toString para funções sensíveis
        const _toString = Function.prototype.toString;
        Function.prototype.toString = function() {
          // Lista de objetos sensíveis que precisam parecer "nativos"
          const sensitiveObjects = [
            navigator.permissions.query,
            navigator.webdriver,
            navigator.plugins,
            navigator.languages,
            navigator.getBattery,
            navigator.getGamepads,
            navigator.vibrate,
            CanvasRenderingContext2D.prototype.getImageData,
            HTMLCanvasElement.prototype.toDataURL,
            WebGLRenderingContext.prototype.getParameter,
            WebGL2RenderingContext.prototype.getParameter
          ];
          
          // Se este for um objeto sensível, retorne código nativo
          if (this && sensitiveObjects.includes(this)) {
            return 'function () { [native code] }';
          }
          
          // Se a stack trace indicia detecção, retorne código nativo
          const stack = new Error().stack || '';
          if (stack.includes('checkDriver') || 
              stack.includes('detect') || 
              stack.includes('selenium') || 
              stack.includes('webdriver') || 
              stack.includes('automation')) {
            return 'function () { [native code] }';
          }
          
          // Caso contrário, comportamento original
          return _toString.apply(this, arguments);
        };
        
        // ==========================================
        // 2. Evasão avançada de fingerprinting
        // ==========================================
        
        // Proteção contra fingerprinting de Canvas - muito mais sutil
        const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
        const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
        
        // Gera uma perturbação consistente mas única por sessão
        const sessionNoise = new Uint8Array(4);
        for (let i = 0; i < 4; i++) {
          sessionNoise[i] = Math.floor(Math.random() * 3) - 1; // -1, 0, ou 1
        }
        
        // Função para aplicar ruído sutil aos dados de imagem
        const applySubtleNoise = (imageData) => {
          // Para hashes de canvas, o ruído deve ser reproduzível 
          // mas único por sessão para evitar múltiplas identidades
          const data = imageData.data;
          
          // Encontra áreas não uniformes da imagem para modificar 
          // (evita modificar áreas de cores sólidas que possam ser detectadas)
          for (let i = 0; i < data.length; i += 4) {
            // Verifica se estamos em uma área de fronteira/gradiente
            const isEdge = i > 4 && i < data.length - 4 && (
              Math.abs(data[i] - data[i-4]) > 5 || 
              Math.abs(data[i] - data[i+4]) > 5
            );
            
            // Só modifica pixels em áreas de fronteira e com baixa probabilidade
            if (isEdge && Math.random() < 0.03) {
              // Aplica o ruído da sessão
              data[i] += sessionNoise[0];     // R
              data[i + 1] += sessionNoise[1]; // G
              data[i + 2] += sessionNoise[2]; // B
              // Alpha permanece intacto para maior sutileza
            }
          }
        };
        
        // Override para Canvas toDataURL
        HTMLCanvasElement.prototype.toDataURL = function() {
          // Se parece ser um fingerprinting, aplique a técnica de evasão
          const isLikelyFingerprinting = 
            this.width === 16 && this.height === 16 || 
            this.width === 1 && this.height === 1 ||
            (this.width <= 500 && this.height <= 200 && document.hidden);
            
          if (isLikelyFingerprinting) {
            const context = this.getContext('2d');
            if (context) {
              const imageData = context.getImageData(0, 0, this.width, this.height);
              applySubtleNoise(imageData);
              context.putImageData(imageData, 0, 0);
            }
          }
          
          return originalToDataURL.apply(this, arguments);
        };
        
        // Override para Canvas getImageData
        CanvasRenderingContext2D.prototype.getImageData = function() {
          const imageData = originalGetImageData.apply(this, arguments);
          
          // Se parece ser um fingerprinting, aplique a técnica de evasão
          const canvas = this.canvas;
          const isLikelyFingerprinting = 
            canvas && (
              canvas.width === 16 && canvas.height === 16 || 
              canvas.width === 1 && canvas.height === 1 ||
              arguments[2] <= 16 && arguments[3] <= 16 // Pequena área de leitura
            );
            
          if (isLikelyFingerprinting) {
            applySubtleNoise(imageData);
          }
          
          return imageData;
        };
        
        // ==========================================
        // 3. Evasão avançada WebGL fingerprinting 
        // ==========================================
        
        // Evasão mais sofisticada para fingerprinting de WebGL
        if (window.WebGLRenderingContext) {
          const vendorMap = {
            'Intel Inc.': ['Intel Iris OpenGL Engine', 'Intel HD Graphics', 'Intel(R) UHD Graphics'],
            'NVIDIA Corporation': ['GeForce GTX 1650/PCIe/SSE2', 'NVIDIA GeForce RTX 3060', 'NVIDIA RTX A2000'],
            'AMD': ['Radeon RX 580 Series', 'AMD Radeon Pro 5500M', 'AMD RENOIR']
          };
          
          // Seleciona um vendor e renderer aleatório, mas mantém consistente durante a sessão
          const randomVendor = Object.keys(vendorMap)[Math.floor(Math.random() * Object.keys(vendorMap).length)];
          const possibleRenderers = vendorMap[randomVendor];
          const randomRenderer = possibleRenderers[Math.floor(Math.random() * possibleRenderers.length)];
          
          // Variações sutis nos parâmetros de WebGL que ainda parecem realistas
          const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
          WebGLRenderingContext.prototype.getParameter = function(parameter) {
            // UNMASKED_VENDOR_WEBGL
            if (parameter === 37445) {
              return randomVendor;
            }
            
            // UNMASKED_RENDERER_WEBGL
            if (parameter === 37446) {
              return randomRenderer;
            }
            
            // Outros parâmetros com valores plausíveis que variam sutilmente
            const highPrecisionValues = {
              36338: Math.random() < 0.5 ? 36338 : 36337, // VERTEX_SHADER_HIGH_FLOAT precision
              36339: Math.random() < 0.6 ? 23 : 24,       // VERTEX_SHADER_HIGH_FLOAT precision bits
              36340: Math.random() < 0.7 ? 127 : 128,     // VERTEX_SHADER_MEDIUM_FLOAT precision range
              36341: Math.random() < 0.5 ? 23 : 22,       // VERTEX_SHADER_MEDIUM_FLOAT precision bits
              36373: Math.random() < 0.5 ? 36338 : 36337, // FRAGMENT_SHADER_HIGH_FLOAT precision
              36374: Math.random() < 0.6 ? 23 : 24,       // FRAGMENT_SHADER_HIGH_FLOAT precision bits
              36375: Math.random() < 0.7 ? 127 : 128,     // FRAGMENT_SHADER_MEDIUM_FLOAT precision range
              36376: Math.random() < 0.5 ? 23 : 22,       // FRAGMENT_SHADER_MEDIUM_FLOAT precision bits
            };
            
            if (parameter in highPrecisionValues) {
              return highPrecisionValues[parameter];
            }
            
            return originalGetParameter.apply(this, arguments);
          };
          
          // Se WebGL2 estiver disponível
          if (window.WebGL2RenderingContext) {
            const originalWebGL2GetParameter = WebGL2RenderingContext.prototype.getParameter;
            WebGL2RenderingContext.prototype.getParameter = WebGLRenderingContext.prototype.getParameter;
          }
        }
        
        // ==========================================
        // 4. Evasão de detecção de bots por timing
        // ==========================================
        
        // Adiciona variabilidade sutil nos timings de API
        const addNonDeterministicLag = (obj, methodNames) => {
          methodNames.forEach(methodName => {
            if (obj && obj[methodName]) {
              const originalMethod = obj[methodName];
              obj[methodName] = function(...args) {
                // Adiciona pequenos atrasos aleatórios e não determinísticos
                // para funções sensíveis à detecção de timing
                if (Math.random() < 0.25) { // 25% de chance de adicionar lag
                  const lagTime = Math.random() * 1.5 + 0.5; // 0.5-2ms de lag
                  return new Promise(resolve => {
                    setTimeout(() => {
                      resolve(originalMethod.apply(this, args));
                    }, lagTime);
                  });
                }
                
                // Comportamento normal na maioria das chamadas
                return originalMethod.apply(this, args);
              };
            }
          });
        };
        
        // Lista de métodos do DOM frequentemente monitorados para detecção de bots
        addNonDeterministicLag(document, [
          'querySelectorAll', 'querySelector', 'getElementById', 'getElementsByTagName',
          'getElementsByClassName', 'getElementsByName', 'createEvent', 'createElement'
        ]);
        
        addNonDeterministicLag(window, [
          'getComputedStyle', 'getSelection', 'matchMedia', 'setTimeout'
        ]);
        
        // ==========================================
        // 5. Emulação de comportamento humano
        // ==========================================
        
        // Padrões de comportamento humano em intervalos aleatórios
        
        // Simula movimentos ocasionais e naturais do mouse
        if (Math.random() < 0.3) { // 30% de chance de ativar
          let lastX = Math.random() * window.innerWidth;
          let lastY = Math.random() * window.innerHeight;
          
          setInterval(() => {
            try {
              if (Math.random() < 0.1) { // Movimento ocasional
                // Movimento suave em direção a um ponto aleatório da tela
                const targetX = Math.random() * window.innerWidth;
                const targetY = Math.random() * window.innerHeight;
                
                // Calcula uma posição intermediária para movimento mais natural
                const newX = lastX + (targetX - lastX) * 0.3;
                const newY = lastY + (targetY - lastY) * 0.3;
                
                // Adiciona pequena variação aleatória para mais naturalidade
                const mouseEvent = new MouseEvent('mousemove', {
                  bubbles: true,
                  cancelable: true,
                  clientX: newX + (Math.random() * 2 - 1),
                  clientY: newY + (Math.random() * 2 - 1),
                  screenX: newX + (Math.random() * 2 - 1),
                  screenY: newY + (Math.random() * 2 - 1),
                  movementX: newX - lastX,
                  movementY: newY - lastY
                });
                
                document.dispatchEvent(mouseEvent);
                
                lastX = newX;
                lastY = newY;
              }
            } catch (e) {
              // Ignora erros
            }
          }, 1000 + Math.random() * 4000); // 1-5s de intervalo
        }
      });
      
      logger.info(`Evasion scripts avançados injetados para account ${accountId}`, accountId);
    } catch (error) {
      logger.error(`Error injecting evasion scripts`, accountId, error);
    }
  }

  /**
   * Combine captcha images for solving
   * @param {Array<Buffer>} imageBuffers - Array of image buffers
   * @returns {Promise<Buffer|Array<Buffer>>} - Combined image buffer or array of original buffers
   */
  async combineImages(imageBuffers) {
    try {
      // Use our cross-platform image processor
      return await imageProcessor.combineImages(imageBuffers);
    } catch (error) {
      logger.error('Error combining images', null, error);
      // Return original buffers as fallback if combining fails
      return imageBuffers;
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
