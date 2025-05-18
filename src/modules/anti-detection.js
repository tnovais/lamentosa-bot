/**
 * Módulo de Anti-Detecção para o Bot
 * Implementa técnicas avançadas para evitar detecção por sistemas anti-bot
 */
const logger = require('../utils/logger');
const { delay, randomInteger, randomChoice, randomFloat } = require('../utils/helpers');
const { FINGERPRINT } = require('../config');

class AntiDetection {
  constructor() {
    logger.info('Inicializando módulo AntiDetection');
  }

  /**
   * Aplica todas as medidas anti-detecção a uma página
   * @param {Object} page - Objeto de página do Puppeteer
   * @param {string} accountId - Identificador da conta
   */
  async applyAllMeasures(page, accountId) {
    try {
      logger.info(`Aplicando medidas anti-detecção para ${accountId}`, accountId);
      
      // Sequência de aplicação de técnicas
      await this.randomizeBrowserProperties(page, accountId);
      await this.spoofTelemetry(page, accountId);
      await this.injectEvasionScripts(page, accountId);
      await this.hideAutomationFlags(page, accountId);
      await this.addRandomBehavior(page, accountId);
      
      logger.info(`[${accountId}] Medidas anti-detecção aplicadas com sucesso`, accountId);
    } catch (error) {
      logger.error(`[${accountId}] Erro ao aplicar medidas anti-detecção: ${error.message}`, accountId, error);
    }
  }

  /**
   * Randomiza propriedades do navegador
   * @param {Object} page - Objeto de página do Puppeteer
   * @param {string} accountId - Identificador da conta
   */
  async randomizeBrowserProperties(page, accountId) {
    try {
      logger.info(`[${accountId}] Randomizando propriedades do navegador`, accountId);
      
      await page.evaluateOnNewDocument(() => {
        // Randomizar navigator.plugins
        const plugins = [
          { name: 'PDF Viewer', filename: 'pdf-viewer.js' },
          { name: 'Chrome PDF Plugin', filename: 'chrome-pdf.js' },
          { name: 'Widevine Content Decryption Module', filename: 'widevinecdm.dll' },
          { name: 'Native Client', filename: 'nacl_irt.nexe' },
          { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer' }
        ].slice(0, Math.floor(Math.random() * 3 + 2));
        
        // Sobreescrever plugins
        Object.defineProperty(navigator, 'plugins', {
          get: () => {
            const pluginArray = plugins.map(p => ({
              name: p.name,
              filename: p.filename,
              description: p.name,
              length: 1
            }));
            
            // Adicionar métodos e propriedades do PluginArray
            pluginArray.item = index => pluginArray[index];
            pluginArray.namedItem = name => pluginArray.find(p => p.name === name);
            pluginArray.refresh = () => {};
            
            return pluginArray;
          }
        });

        // Randomizar navigator.languages
        const languages = [
          ['pt-BR', 'pt'],
          ['en-US', 'en'],
          ['es-ES', 'es'],
          ['fr-FR', 'fr']
        ][Math.floor(Math.random() * 4)];
        
        Object.defineProperty(navigator, 'languages', { get: () => languages });

        // Randomizar WebGL
        const originalGetContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(contextType, contextAttributes) {
          const context = originalGetContext.call(this, contextType, contextAttributes);
          
          if (contextType === 'webgl' || contextType === 'webgl2' || contextType === 'experimental-webgl') {
            const vendors = ['Intel Inc.', 'NVIDIA Corporation', 'AMD', 'Google Inc.'];
            const renderers = [
              'Intel Iris OpenGL Engine', 
              'GeForce GTX 1650/PCIe/SSE2', 
              'Radeon RX 580 Series',
              'ANGLE (Intel HD Graphics 630 Direct3D11 vs_5_0 ps_5_0)'
            ];
            
            const vendor = vendors[Math.floor(Math.random() * vendors.length)];
            const renderer = renderers[Math.floor(Math.random() * renderers.length)];
            
            const getParameterOriginal = context.getParameter;
            context.getParameter = function(parameter) {
              // UNMASKED_VENDOR_WEBGL
              if (parameter === 37445) return vendor;
              // UNMASKED_RENDERER_WEBGL
              if (parameter === 37446) return renderer;
              // VENDOR
              if (parameter === 0x1F00) return vendor;
              // RENDERER
              if (parameter === 0x1F01) return renderer;
              
              return getParameterOriginal.call(this, parameter);
            };
          }
          
          return context;
        };

        // Reduzir precisão temporal para evitar fingerprinting
        const originalPerformanceNow = window.performance.now;
        window.performance.now = function() {
          return Math.floor(originalPerformanceNow.call(performance) * 10) / 10; // Redução de precisão
        };
        
        const originalDateNow = Date.now;
        Date.now = function() {
          return Math.floor(originalDateNow() / 10) * 10; // Redução de precisão
        };
        
        // Mentir sobre recursos de hardware
        Object.defineProperty(navigator, 'hardwareConcurrency', {
          get: () => Math.floor(Math.random() * 8) + 2 // Entre 2 e 10 núcleos
        });
        
        Object.defineProperty(navigator, 'deviceMemory', {
          get: () => [2, 4, 8][Math.floor(Math.random() * 3)] // 2, 4 ou 8 GB
        });
        
        // Randomizar platform
        const platforms = ['Win32', 'MacIntel', 'Linux x86_64'];
        Object.defineProperty(navigator, 'platform', {
          get: () => platforms[Math.floor(Math.random() * platforms.length)]
        });
      });
      
      logger.info(`[${accountId}] Propriedades do navegador randomizadas`, accountId);
    } catch (error) {
      logger.error(`[${accountId}] Erro ao randomizar propriedades do navegador: ${error.message}`, accountId, error);
    }
  }

  /**
   * Falsifica dados de telemetria
   * @param {Object} page - Objeto de página do Puppeteer
   * @param {string} accountId - Identificador da conta
   */
  async spoofTelemetry(page, accountId) {
    try {
      logger.info(`[${accountId}] Spoofando telemetria`, accountId);
      
      await page.evaluateOnNewDocument(() => {
        // Modificar a assinatura do canvas
        const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
        const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
        
        // Modificar sutilmente os dados do canvas para evitar fingerprinting
        HTMLCanvasElement.prototype.toDataURL = function(type, quality) {
          const dataUrl = originalToDataURL.call(this, type, quality);
          
          // Se for um canvas pequeno (provavelmente usado para fingerprinting), modifique-o
          if (this.width <= 500 && this.height <= 200) {
            return dataUrl.replace(/.$/, Math.floor(Math.random() * 10).toString());
          }
          
          return dataUrl;
        };
        
        CanvasRenderingContext2D.prototype.getImageData = function(sx, sy, sw, sh) {
          const imageData = originalGetImageData.call(this, sx, sy, sw, sh);
          
          // Se for uma área pequena (provavelmente usada para fingerprinting), modifique-a
          if (sw <= 200 && sh <= 200) {
            // Modifica levemente alguns pixels para alterar a assinatura
            for (let i = 0; i < imageData.data.length; i += 50) {
              if (Math.random() < 0.05) { // Alterar apenas 5% dos pixels
                imageData.data[i] = (imageData.data[i] + 1) % 256;
              }
            }
          }
          
          return imageData;
        };

        // Simular eventos aleatórios de teclado e mouse em intervalos irregulares
        const simulateRandomEvents = () => {
          // Eventos de teclado
          if (Math.random() < 0.2) {
            document.dispatchEvent(new KeyboardEvent('keydown', {
              key: ['Tab', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'][Math.floor(Math.random() * 5)],
              bubbles: true
            }));
            
            setTimeout(() => {
              document.dispatchEvent(new KeyboardEvent('keyup', {
                key: ['Tab', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'][Math.floor(Math.random() * 5)],
                bubbles: true
              }));
            }, Math.random() * 100 + 30);
          }
          
          // Eventos de mouse
          if (Math.random() < 0.3) {
            const x = Math.random() * window.innerWidth;
            const y = Math.random() * window.innerHeight;
            
            document.dispatchEvent(new MouseEvent('mousemove', {
              bubbles: true,
              clientX: x,
              clientY: y
            }));
          }
          
          // Agendar próximo evento
          setTimeout(simulateRandomEvents, Math.random() * 15000 + 5000);
        };
        
        // Iniciar simulação aleatória
        simulateRandomEvents();
        
        // Retornar fingerprints aleatórios para APIs comuns de impressão digital
        if (window.OfflineAudioContext || window.AudioContext) {
          const getAudioFingerprint = () => {
            const audioValues = new Float32Array(5).map(() => Math.random());
            return audioValues.join(',');
          };
          
          const audioProto = (window.OfflineAudioContext || window.AudioContext).prototype;
          const originalGetChannelData = audioProto.getChannelData;
          
          audioProto.getChannelData = function(channel) {
            const audioData = originalGetChannelData.call(this, channel);
            
            // Modificar apenas para contextos de fingerprinting (pequenos buffers)
            if (this.length < 100) {
              for (let i = 0; i < audioData.length; i += 500) {
                if (Math.random() < 0.01) {
                  audioData[i] = audioData[i] + Math.random() * 0.0001;
                }
              }
            }
            
            return audioData;
          };
        }
      });
      
      logger.info(`[${accountId}] Telemetria spoofada`, accountId);
    } catch (error) {
      logger.error(`[${accountId}] Erro ao spoofar telemetria: ${error.message}`, accountId, error);
    }
  }

  /**
   * Injetar scripts de evasão para contornar detecção
   * @param {Object} page - Objeto de página do Puppeteer
   * @param {string} accountId - Identificador da conta
   */
  async injectEvasionScripts(page, accountId) {
    try {
      logger.info(`[${accountId}] Injetando scripts de evasão`, accountId);
      
      await page.evaluateOnNewDocument(() => {
        // Ocultar rastreamento da pilha
        // Esta técnica modifica Error.captureStackTrace para esconder traços de automação
        const originalCaptureStackTrace = Error.captureStackTrace;
        if (originalCaptureStackTrace) {
          Error.captureStackTrace = function(target, constructorOpt) {
            originalCaptureStackTrace(target, constructorOpt);
            if (target.stack) {
              const stackLines = target.stack.split('\n');
              const cleanedLines = stackLines.filter(line => 
                !line.includes('puppeteer') && 
                !line.includes('DevTools') && 
                !line.includes('at Object.newPage') &&
                !line.includes('ExecutionContext')
              );
              target.stack = cleanedLines.join('\n');
            }
          };
        }
        
        // Prevenir detecção de automação
        // Ocultar propriedades que podem indicar automação
        const protectProperty = (obj, prop, value) => {
          Object.defineProperty(obj, prop, {
            get: function() { return value; },
            set: function() { return true; },
            configurable: false
          });
        };
        
        // Prevenir detecção através de webdriver
        protectProperty(navigator, 'webdriver', false);
        
        // Esconder propriedades do Chrome DevTools Protocol
        for (const prop of ['__webdriver_script_fn', '__driver_evaluate', '__webdriver_evaluate',
                            '__selenium_evaluate', '__driver_unwrapped', '__webdriver_unwrapped',
                            '__selenium_unwrapped', '__webdriver_script_func', '__webdriver_script_function']) {
          protectProperty(window, prop, undefined);
        }
        
        // Emular o comportamento de um navegador real em relação a permissões
        const originalPermissionsQuery = navigator.permissions?.query;
        if (originalPermissionsQuery) {
          navigator.permissions.query = function(parameters) {
            // Emular navegador real para permissões de notificação (usado em detecção)
            if (parameters.name === 'notifications') {
              return Promise.resolve({ 
                state: Math.random() < 0.5 ? 'denied' : 'prompt', 
                onchange: null 
              });
            }
            
            return originalPermissionsQuery.call(this, parameters);
          };
        }
        
        // Modificar comportamento para o Recaptcha
        window.addEventListener = (function(originalAddEventListener) {
          return function(type, listener, options) {
            if (type === 'challenge' || type === 'error') {
              // Evento relacionado ao reCAPTCHA - modificamos o comportamento
              return originalAddEventListener.call(this, type, function(e) {
                e.preventDefault();
                setTimeout(() => listener(e), Math.random() * 500 + 100);
              }, options);
            }
            return originalAddEventListener.call(this, type, listener, options);
          };
        })(window.addEventListener);
      });
      
      logger.info(`[${accountId}] Scripts de evasão injetados`, accountId);
    } catch (error) {
      logger.error(`[${accountId}] Erro ao injetar scripts de evasão: ${error.message}`, accountId, error);
    }
  }

  /**
   * Esconder flags de automação
   * @param {Object} page - Objeto de página do Puppeteer
   * @param {string} accountId - Identificador da conta
   */
  async hideAutomationFlags(page, accountId) {
    try {
      logger.info(`[${accountId}] Ocultando flags de automação`, accountId);
      
      // Remover WebDriver
      await page.evaluateOnNewDocument(() => {
        delete Object.getPrototypeOf(navigator).webdriver;
      });
      
      // Ocultar Chrome Automation Extension
      const cdpSession = await page.target().createCDPSession();
      await cdpSession.send('Page.addScriptToEvaluateOnNewDocument', {
        source: `
          (() => {
            window.chrome = {
              app: {
                isInstalled: false,
                InstallState: {
                  DISABLED: 'disabled',
                  INSTALLED: 'installed',
                  NOT_INSTALLED: 'not_installed'
                },
                getDetails: function() { return {}; },
                getIsInstalled: function() { return false; },
                runningState: function() { return 'cannot_run'; }
              },
              runtime: {
                OnInstalledReason: {
                  CHROME_UPDATE: 'chrome_update',
                  INSTALL: 'install',
                  SHARED_MODULE_UPDATE: 'shared_module_update',
                  UPDATE: 'update'
                },
                OnRestartRequiredReason: {
                  APP_UPDATE: 'app_update',
                  OS_UPDATE: 'os_update',
                  PERIODIC: 'periodic'
                },
                PlatformArch: {
                  ARM: 'arm',
                  ARM64: 'arm64',
                  MIPS: 'mips',
                  MIPS64: 'mips64',
                  X86_32: 'x86-32',
                  X86_64: 'x86-64'
                },
                PlatformNaclArch: {
                  ARM: 'arm',
                  MIPS: 'mips',
                  MIPS64: 'mips64',
                  X86_32: 'x86-32',
                  X86_64: 'x86-64'
                },
                PlatformOs: {
                  ANDROID: 'android',
                  CROS: 'cros',
                  LINUX: 'linux',
                  MAC: 'mac',
                  OPENBSD: 'openbsd',
                  WIN: 'win'
                },
                RequestUpdateCheckStatus: {
                  NO_UPDATE: 'no_update',
                  THROTTLED: 'throttled',
                  UPDATE_AVAILABLE: 'update_available'
                }
              }
            };
            
            // Fingir que a função ChromiumPDF não existe
            if (window.navigator.mimeTypes) {
              const mimeTypes = [
                { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' },
                { type: 'text/pdf', suffixes: 'pdf', description: 'Portable Document Format' }
              ];

              Object.defineProperty(window.navigator, 'mimeTypes', {
                get: () => {
                  return {
                    length: mimeTypes.length,
                    item: index => mimeTypes[index],
                    namedItem: name => mimeTypes.find(mt => mt.type === name)
                  };
                }
              });
            }
          })();
        `
      });
      
      // Implementar outros métodos de ocultação aqui
      
      logger.info(`[${accountId}] Flags de automação ocultadas`, accountId);
    } catch (error) {
      logger.error(`[${accountId}] Erro ao ocultar flags de automação: ${error.message}`, accountId, error);
    }
  }

  /**
   * Adicionar comportamentos aleatórios para parecer mais humano
   * @param {Object} page - Objeto de página do Puppeteer
   * @param {string} accountId - Identificador da conta
   */
  async addRandomBehavior(page, accountId) {
    try {
      logger.info(`[${accountId}] Adicionando comportamentos aleatórios`, accountId);
      
      // Configurar interceptação de requisições para adicionar headers realistas
      await page.setRequestInterception(true);
      
      page.on('request', request => {
        // Não modificar solicitações de recursos
        if (['image', 'font', 'stylesheet'].includes(request.resourceType())) {
          request.continue();
          return;
        }
        
        // Headers originais
        const headers = request.headers();
        
        // Adicionar headers realistas aleatórios
        const modifiedHeaders = {
          ...headers,
          'Accept': randomChoice(FINGERPRINT.ACCEPT_HEADERS),
          'Accept-Language': randomChoice(FINGERPRINT.LANGUAGES)[0] + ',en-US;q=0.9,en;q=0.8',
          'Cache-Control': Math.random() < 0.3 ? 'max-age=0' : 'no-cache',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'same-origin',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
          'sec-ch-ua': `"Google Chrome";v="${Math.floor(Math.random() * 10 + 120)}", "Not;A=Brand";v="${Math.floor(Math.random() * 10 + 8)}"`,
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': randomChoice(['"Windows"', '"macOS"', '"Linux"']),
        };
        
        // Continuar com os headers modificados
        request.continue({ headers: modifiedHeaders });
      });
      
      // Simular rolagens aleatórias ocasionalmente
      const randomScrollInterval = setInterval(async () => {
        if (Math.random() < 0.3) {
          await this.randomScroll(page, accountId);
        }
      }, randomInteger(10000, 30000));
      
      // Limpar interval quando a página for fechada
      page.once('close', () => {
        clearInterval(randomScrollInterval);
      });
      
      logger.info(`[${accountId}] Comportamentos aleatórios adicionados`, accountId);
    } catch (error) {
      logger.error(`[${accountId}] Erro ao adicionar comportamentos aleatórios: ${error.message}`, accountId, error);
    }
  }

  /**
   * Rolar a página aleatoriamente para simular comportamento humano
   * @param {Object} page - Objeto de página do Puppeteer
   * @param {string} accountId - Identificador da conta
   */
  async randomScroll(page, accountId) {
    try {
      // Obter a altura da página
      const pageHeight = await page.evaluate(() => document.body.scrollHeight);
      
      if (pageHeight <= 0) return;
      
      // Número de rolagens
      const scrollCount = randomInteger(1, 3);
      
      for (let i = 0; i < scrollCount; i++) {
        // Distância da rolagem (entre 100px e 40% da altura da página)
        const scrollDistance = randomInteger(100, Math.floor(pageHeight * 0.4));
        
        // Direção da rolagem (70% para baixo, 30% para cima)
        const direction = Math.random() < 0.7 ? 1 : -1;
        
        // Executar rolagem com velocidade variável
        await page.evaluate((distance, dir) => {
          const duration = Math.floor(Math.random() * 600 + 400); // 400-1000ms
          const start = window.pageYOffset;
          const startTime = Date.now();
          
          function scrollStep() {
            const now = Date.now();
            const elapsed = now - startTime;
            
            if (elapsed >= duration) {
              window.scrollTo(0, start + (distance * dir));
              return;
            }
            
            // Easing function para uma rolagem mais natural
            const easeOutCubic = t => (--t) * t * t + 1;
            const time = elapsed / duration;
            
            window.scrollTo(0, start + (distance * dir * easeOutCubic(time)));
            requestAnimationFrame(scrollStep);
          }
          
          scrollStep();
        }, scrollDistance, direction);
        
        // Esperar entre rolagens
        await delay(randomInteger(300, 1200));
      }
      
      // Pausa após sequência de rolagens
      await delay(randomInteger(500, 2000));
    } catch (error) {
      logger.error(`[${accountId}] Erro ao rolar página aleatoriamente: ${error.message}`, accountId, error);
    }
  }

  /**
   * Verificar se a página contém marcadores de detecção de bot
   * @param {Object} page - Objeto de página do Puppeteer
   * @param {string} accountId - Identificador da conta
   * @returns {Promise<boolean>} - True se detectou indicadores de detecção de bot
   */
  async checkForDetection(page, accountId) {
    try {
      logger.info(`[${accountId}] Verificando indicadores de detecção de bot`, accountId);
      
      const detectionIndicators = await page.evaluate(() => {
        const indicators = [];
        
        // 1. Verificar elementos de captcha
        if (document.querySelector('.captcha, #captcha, .g-recaptcha, iframe[src*="recaptcha"], iframe[src*="captcha"]')) {
          indicators.push('captcha_detected');
        }
        
        // 2. Verificar mensagens de erro comuns em bloqueios
        const bodyText = document.body.innerText.toLowerCase();
        const errorMessages = [
          'suspicious activity',
          'automated access',
          'bot detected',
          'unusual traffic',
          'acesso suspeito',
          'atividade suspeita',
          'comportamento anormal',
          'blocked',
          'banned',
          'blocked access',
          'acesso bloqueado',
          'firewall',
          'cloudflare'
        ];
        
        for (const message of errorMessages) {
          if (bodyText.includes(message)) {
            indicators.push(`error_message_detected: ${message}`);
          }
        }
        
        // 3. Verificar redirecionamentos para páginas de verificação
        if (window.location.href.includes('captcha') || 
            window.location.href.includes('challenge') || 
            window.location.href.includes('verify') || 
            window.location.href.includes('check')) {
          indicators.push('verification_redirect');
        }
        
        // 4. Verificar fingerprinting JavaScript
        const fingerprintScripts = [
          'fingerprint',
          'botdetect',
          'datadome',
          'imperva',
          'distil',
          'cloudflare',
          'recaptcha',
          'hcaptcha',
          'perimeterx'
        ];
        
        const scripts = Array.from(document.getElementsByTagName('script'));
        for (const script of scripts) {
          const src = script.src.toLowerCase();
          const content = script.innerText.toLowerCase();
          
          for (const fp of fingerprintScripts) {
            if (src.includes(fp) || content.includes(fp)) {
              indicators.push(`fingerprinting_script: ${fp}`);
            }
          }
        }
        
        return indicators;
      });
      
      if (detectionIndicators.length > 0) {
        logger.warn(`[${accountId}] Detectou indicadores de sistemas anti-bot: ${detectionIndicators.join(', ')}`, accountId);
        return true;
      }
      
      logger.info(`[${accountId}] Nenhum indicador de detecção de bot encontrado`, accountId);
      return false;
    } catch (error) {
      logger.error(`[${accountId}] Erro ao verificar detecção de bot: ${error.message}`, accountId, error);
      return false;
    }
  }
}

module.exports = AntiDetection;