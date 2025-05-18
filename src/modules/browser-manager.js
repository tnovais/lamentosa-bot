const fs = require('fs');
const path = require('path');
const { FINGERPRINT, RETRY } = require('../config');
const logger = require('../utils/logger');
const { randomItem, randomInteger, retry } = require('../utils/helpers');

// Função para carregar dinamicamente as dependências necessárias
const loadDependencies = () => {
  try {
    // Primeiro tente carregar puppeteer-extra com plugin de stealth
    const puppeteerExtra = require('puppeteer-extra');
    const StealthPlugin = require('puppeteer-extra-plugin-stealth');
    puppeteerExtra.use(StealthPlugin());
    
    logger.info('Usando puppeteer-extra com plugin stealth');
    return { 
      puppeteer: puppeteerExtra, 
      isPuppeteerExtra: true,
      isCore: false 
    };
  } catch (e) {
    // Se falhar, tente carregar puppeteer padrão
    try {
      const puppeteer = require('puppeteer');
      logger.info('Usando puppeteer padrão');
      return { 
        puppeteer,
        isPuppeteerExtra: false,
        isCore: false
      };
    } catch (e2) {
      // Se também falhar, tente puppeteer-core (precisa de executablePath)
      try {
        const puppeteerCore = require('puppeteer-core');
        logger.info('Usando puppeteer-core (requer path para o Chrome)');
        return { 
          puppeteer: puppeteerCore,
          isPuppeteerExtra: false,
          isCore: true
        };
      } catch (e3) {
        // Não foi possível carregar nenhuma versão do puppeteer
        logger.error('Falha ao carregar qualquer versão do puppeteer', null, e3);
        throw new Error(`Nenhuma versão do puppeteer disponível: ${e3.message}`);
      }
    }
  }
};

// Carrega puppeteer de forma dinâmica
const { puppeteer, isPuppeteerExtra, isCore } = loadDependencies();

/**
 * Manages browser instances and provides enhanced browser functionality
 */
class BrowserManager {
  constructor(options = {}) {
    this.options = {
      headless: true,
      defaultViewport: null,
      ...options
    };
    this.activeBrowsers = new Map(); // accountId -> browser
    this.lastActivity = new Map(); // accountId -> timestamp
  }

  /**
   * Launch a new browser instance with randomized properties
   * @param {Object} options - Browser launch options
   * @returns {Promise<Object>} - Browser instance
   */
  async launchBrowser(options = {}) {
    const mergedOptions = { ...this.options, ...options };
    
    // Seleção de valores de fingerprint aleatórios com métodos avançados
    // Usa números aleatórios com seed para consistência por sessão
    const sessionSeed = Date.now() % 10000;
    const rng = (max, min = 0) => min + Math.floor(Math.abs(Math.sin(sessionSeed * 9999)) * (max - min));
    
    // Seleciona fingerprint com bias para navegadores comuns mais recentes
    const userAgentGroups = {
      chrome: FINGERPRINT.USER_AGENTS.filter(ua => ua.includes('Chrome')),
      firefox: FINGERPRINT.USER_AGENTS.filter(ua => ua.includes('Firefox')),
      edge: FINGERPRINT.USER_AGENTS.filter(ua => ua.includes('Edge')),
      safari: FINGERPRINT.USER_AGENTS.filter(ua => ua.includes('Safari') && !ua.includes('Chrome')),
      mobile: FINGERPRINT.USER_AGENTS.filter(ua => ua.includes('Mobile') || ua.includes('Android'))
    };
    
    // Escolha o grupo com bias para navegadores desktop mais comuns
    const uaGroupType = Math.random() < 0.8 
      ? ['chrome', 'firefox', 'edge'][rng(3)] // 80% chance para browsers desktop comuns
      : Math.random() < 0.5 ? 'safari' : 'mobile'; // 20% divididos entre Safari e mobile
    
    const userAgents = userAgentGroups[uaGroupType] || FINGERPRINT.USER_AGENTS;
    const userAgent = userAgents[rng(userAgents.length)];
    
    // Seleciona idioma com distribuição mais realista
    // Privilegia os idiomas mais comuns
    const languageWeights = {
      0: 0.6, // pt-BR (60% chance para o idioma principal)
      1: 0.25, // en-US (25% chance para o segundo idioma mais comum)
      2: 0.1, // es-ES (10% chance)
      3: 0.05 // fr-FR (5% chance)
    };
    
    const langIndex = (() => {
      const rand = Math.random();
      let cumulativeWeight = 0;
      for (let i = 0; i < FINGERPRINT.LANGUAGES.length; i++) {
        cumulativeWeight += languageWeights[i] || 0;
        if (rand <= cumulativeWeight) return i;
      }
      return 0;
    })();
    
    const languages = FINGERPRINT.LANGUAGES[langIndex];
    
    // Seleciona resolução com distribuição mais realista para desktops
    // Privilegia resoluções comuns
    const resolutionGroups = {
      desktop: FINGERPRINT.RESOLUTIONS.filter(r => r.width >= 1024),
      mobile: FINGERPRINT.RESOLUTIONS.filter(r => r.width < 1024)
    };
    
    // Seleciona grupo de resolução baseado no tipo de user agent
    const resGroup = uaGroupType === 'mobile' ? 'mobile' : 'desktop';
    const resolutions = resolutionGroups[resGroup];
    
    // Seleciona resolução do grupo escolhido
    const resolution = resolutions[rng(resolutions.length)];
    
    // Argumentos base críticos para funcionalidade
    const baseArgs = [
      `--user-agent=${userAgent}`,
      `--window-size=${resolution.width},${resolution.height}`,
      `--lang=${languages[0]}`,
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ];
    
    // Argumentos que ajudam a evitar detecção
    const antiDetectionArgs = [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-infobars'
    ];
    
    // Argumentos para performance/estabilidade (pode variar por ambiente)
    const performanceArgs = [
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ];
    
    // Argumentos adicionais para evasão de detecção melhorada
    const enhancedArgs = [
      '--disable-web-security',
      '--ignore-certificate-errors',
      '--disable-site-isolation-trials',
      '--disable-features=ScriptStreaming',
      '--disable-accelerated-2d-canvas',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--disable-ipc-flooding-protection'
    ];
    
    // Adiciona argumentos aleatórios com probabilidade variável
    const randomArgs = [];
    if (Math.random() > 0.3) randomArgs.push('--no-zygote');
    if (Math.random() > 0.5) randomArgs.push('--disable-notifications');
    if (Math.random() > 0.7) randomArgs.push('--autoplay-policy=user-gesture-required');
    if (Math.random() > 0.6) randomArgs.push('--disable-extensions');
    if (Math.random() > 0.8) randomArgs.push('--disable-popup-blocking');
    
    // Combina argumentos com ordem variável para fingerprint mais única
    const combinedArgs = [...baseArgs, ...antiDetectionArgs, ...performanceArgs];
    
    // Adiciona argumentos avançados aleatoriamente com probabilidades diferentes
    for (const arg of enhancedArgs) {
      if (Math.random() > 0.3) {
        const position = Math.floor(Math.random() * (combinedArgs.length + 1));
        combinedArgs.splice(position, 0, arg);
      }
    }
    
    // Adiciona argumentos aleatórios (se houver)
    if (randomArgs.length > 0) {
      for (const arg of randomArgs) {
        const position = Math.floor(Math.random() * (combinedArgs.length + 1));
        combinedArgs.splice(position, 0, arg);
      }
    }
    
    logger.info(`Launching browser with ${uaGroupType} fingerprint (${resolution.width}x${resolution.height})`);
    
    // Lista para armazenar todos os executáveis do Chrome que tentaremos
    const chromePaths = [
      process.env.CHROME_PATH, // Variável de ambiente personalizada
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
    ].filter(Boolean); // Remove valores nulos/undefined
    
    // Estratégias de lançamento que tentaremos em sequência
    const strategies = [
      // Estratégia 1: Usar puppeteer-extra com todas as opções avançadas
      async () => {
        if (!isPuppeteerExtra) throw new Error('puppeteer-extra não disponível');
        
        const launchOptions = {
          ...mergedOptions,
          ignoreHTTPSErrors: true,
          args: [...combinedArgs, ...(mergedOptions.args || [])],
        };
        
        logger.info('Tentando com puppeteer-extra e configurações avançadas');
        return await puppeteer.launch(launchOptions);
      },
      
      // Estratégia 2: Usar puppeteer padrão com opções avançadas
      async () => {
        const launchOptions = {
          ...mergedOptions,
          ignoreHTTPSErrors: true,
          args: [...combinedArgs, ...(mergedOptions.args || [])],
        };
        
        logger.info('Tentando com puppeteer e configurações avançadas');
        return await puppeteer.launch(launchOptions);
      },
      
      // Estratégia 3: Se for puppeteer-core, tente encontrar o Chrome instalado
      ...chromePaths.map(executablePath => async () => {
        if (!isCore && !executablePath) throw new Error('puppeteer-core precisa de executablePath');
        
        const launchOptions = {
          ...mergedOptions,
          ignoreHTTPSErrors: true,
          args: [...baseArgs, ...antiDetectionArgs, ...performanceArgs],
          executablePath
        };
        
        logger.info(`Tentando com chromium em: ${executablePath}`);
        return await puppeteer.launch(launchOptions);
      }),
      
      // Estratégia 4: Configuração mínima com sandbox desativado
      async () => {
        const minimalOptions = {
          headless: mergedOptions.headless,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--disable-dev-shm-usage',
            `--user-agent=${userAgent}`
          ]
        };
        
        logger.info('Tentando com configuração mínima');
        return await puppeteer.launch(minimalOptions);
      },
      
      // Estratégia 5: Tente conectar-se a uma instância de Chrome em execução (em contextos avançados)
      async () => {
        // Esta estratégia é útil em ambientes onde o Chrome já está em execução
        // ou quando estamos em um ambiente restrito
        
        logger.info('Tentando conectar a uma instância existente do Chrome');
        
        // A URL padrão para depuração do Chrome
        const browserURL = process.env.CHROME_WS_ENDPOINT || 'http://localhost:9222';
        
        return await puppeteer.connect({
          browserURL,
          ignoreHTTPSErrors: true
        });
      }
    ];
    
    // Tenta cada estratégia em sequência até que uma funcione
    for (let i = 0; i < strategies.length; i++) {
      try {
        this.browser = await strategies[i]();
        logger.info(`Navegador iniciado com sucesso (estratégia ${i+1})`);
        return this.browser;
      } catch (error) {
        logger.warn(`Estratégia ${i+1} falhou: ${error.message}`);
        
        // Se esta foi a última estratégia, propague o erro
        if (i === strategies.length - 1) {
          logger.error('Todas as estratégias falharam ao iniciar o navegador', null, error);
          throw new Error(`Não foi possível iniciar o navegador: ${error.message}`);
        }
      }
    }
  }

  /**
   * Create a new page with enhanced capabilities
   * @param {Object} browser - Browser instance
   * @param {string} accountId - Account identifier
   * @returns {Promise<Object>} - Page instance
   */
  async createPage(browser, accountId) {
    try {
      const page = await browser.newPage();
      
      // Set extra headers
      await page.setExtraHTTPHeaders({
        'Accept': randomItem(FINGERPRINT.ACCEPT_HEADERS),
        'Accept-Language': randomItem(FINGERPRINT.LANGUAGES)[0] + ';q=0.9',
        'sec-ch-ua': '"Chromium";v="110", "Not A(Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'DNT': '1'
      });
      
      // Modify viewport to make detection harder
      await page.setViewport({
        width: randomInteger(1024, 1920),
        height: randomInteger(768, 1080),
        deviceScaleFactor: randomInteger(1, 2),
        hasTouch: Math.random() > 0.9, // 10% chance to have touch
        isLandscape: true,
        isMobile: false
      });
      
      // Apply evasion techniques
      await this._applyEvasionTechniques(page, accountId);
      
      logger.info(`Page created with enhanced anti-detection (account ${accountId})`);
      return page;
    } catch (error) {
      logger.error(`Failed to create enhanced page for account ${accountId}`, null, error);
      throw error;
    }
  }
  
  /**
   * Apply advanced evasion techniques to a page
   * @param {Object} page - Page instance
   * @param {string} accountId - Account identifier
   * @private
   */
  async _applyEvasionTechniques(page, accountId) {
    // Override navigator properties to defeat detection
    await page.evaluateOnNewDocument(() => {
      // Make WebDriver properties undetectable
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
        configurable: true
      });
      
      // Remove webdriver-related properties from navigator
      delete navigator.__proto__.webdriver;
      
      // Override user-agent data for consistent reporting
      if (navigator.userAgentData) {
        Object.defineProperty(navigator, 'userAgentData', {
          get: () => {
            const original = Object.getOwnPropertyDescriptor(
              Navigator.prototype, 'userAgentData'
            ).get.call(this);
            
            original.mobile = false;
            original.brands = original.brands || [
              { brand: 'Chromium', version: '110' },
              { brand: 'Not A(Brand', version: '24' },
              { brand: 'Google Chrome', version: '110' }
            ];
            
            return original;
          },
          configurable: true
        });
      }
      
      // Override automation-related functions
      const originalFunctions = {
        // Store the original toString methods of key objects
        functionToString: Function.prototype.toString,
        objectToString: Object.prototype.toString
      };
      
      // Override Function.prototype.toString to hide signs of tampering
      Function.prototype.toString = function() {
        // Get the original function name without any automation markers
        const fnString = originalFunctions.functionToString.call(this);
        
        // Target driver-related and stealth-plugin-related syntax for replacement
        if (fnString.includes('webdriver') || 
            fnString.includes('puppeteer') || 
            fnString.includes('selenium') ||
            fnString.includes('chrome') && fnString.includes('driver') ||
            fnString.includes('__puppeteer_evaluation_script') ||
            fnString.includes('CDP') ||
            /\[native code\]\s*}\s*}\s*catch/.test(fnString)) {
              
          // Reconstruct the function signature without revealing tampering
          const funcName = this.name || 'anonymous';
          return `function ${funcName}() { [native code] }`;
        }
        
        // Return the original string for non-targeted functions
        return fnString;
      };
      
      // Override chrome.runtime to appear as a regular Chrome browser
      window.chrome = window.chrome || {};
      window.chrome.runtime = window.chrome.runtime || {};
      
      // Implement a convincing sendMessage method if missing
      if (!window.chrome.runtime.sendMessage) {
        window.chrome.runtime.sendMessage = function() {
          return {
            then: function() {
              return {
                catch: function() {}
              };
            }
          };
        };
      }
      
      // Override Permissions API to avoid detection
      if (navigator.permissions) {
        const originalQuery = navigator.permissions.query;
        navigator.permissions.query = function(parameters) {
          if (parameters.name === 'notifications') {
            return Promise.resolve({ state: "denied" });
          }
          return originalQuery.call(this, parameters);
        };
      }
    });
    
    logger.debug(`Applied advanced evasion techniques for account ${accountId}`);
  }
  
  /**
   * Save cookies for an account
   * @param {Object} page - Page instance
   * @param {string} accountId - Account identifier
   */
  async saveCookies(page, accountId) {
    try {
      const cookies = await page.cookies();
      const cookiesDir = path.resolve('browser-data', 'cookies');
      
      // Ensure cookies directory exists
      if (!fs.existsSync(cookiesDir)) {
        fs.mkdirSync(cookiesDir, { recursive: true });
      }
      
      const cookiesPath = path.join(cookiesDir, `${accountId}.json`);
      fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
      
      logger.info(`Cookies saved for account ${accountId}`);
    } catch (error) {
      logger.error(`Failed to save cookies for account ${accountId}`, null, error);
    }
  }
  
  /**
   * Load cookies for an account
   * @param {Object} page - Page instance
   * @param {string} accountId - Account identifier
   * @returns {Promise<boolean>} - Whether cookies were loaded successfully
   */
  async loadCookies(page, accountId) {
    try {
      const cookiesDir = path.resolve('browser-data', 'cookies');
      const cookiesPath = path.join(cookiesDir, `${accountId}.json`);
      
      if (fs.existsSync(cookiesPath)) {
        const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
        await page.setCookie(...cookies);
        logger.info(`Cookies loaded for account ${accountId}`);
        return true;
      } else {
        logger.warn(`No cookies file found for account ${accountId}`);
        return false;
      }
    } catch (error) {
      logger.error(`Failed to load cookies for account ${accountId}`, null, error);
      return false;
    }
  }
  
  /**
   * Register browser with account for tracking
   * @param {Object} browser - Browser instance
   * @param {string} accountId - Account identifier
   */
  registerBrowser(browser, accountId) {
    this.activeBrowsers.set(accountId, browser);
    this.updateLastActivity(accountId);
    logger.debug(`Browser registered for account ${accountId}`);
  }
  
  /**
   * Update last activity time for a browser
   * @param {string} accountId - Account identifier
   */
  updateLastActivity(accountId) {
    this.lastActivity.set(accountId, Date.now());
  }
  
  /**
   * Close a browser for an account
   * @param {string} accountId - Account identifier
   */
  async closeBrowser(accountId) {
    const browser = this.activeBrowsers.get(accountId);
    if (browser) {
      try {
        await browser.close();
        this.activeBrowsers.delete(accountId);
        this.lastActivity.delete(accountId);
        logger.info(`Browser closed for account ${accountId}`);
      } catch (error) {
        logger.error(`Error closing browser for account ${accountId}`, null, error);
      }
    }
  }
  
  /**
   * Close all active browsers
   */
  async closeAllBrowsers() {
    const accountIds = Array.from(this.activeBrowsers.keys());
    logger.info(`Closing all browsers (${accountIds.length} active)`);
    
    for (const accountId of accountIds) {
      await this.closeBrowser(accountId);
    }
    
    logger.info('All browsers closed');
  }
  
  /**
   * Ensure the page navigates to the desired URL
   * @param {Object} page - Page instance
   * @param {string} targetUrl - URL to navigate to
   * @param {string} waitUntil - Navigation wait condition
   * @param {string} accountId - Account identifier
   */
  async ensurePageNavigation(page, targetUrl, waitUntil = 'domcontentloaded', accountId) {
    try {
      // First try with standard navigation
      await retry(async () => {
        const response = await page.goto(targetUrl, {
          waitUntil,
          timeout: 30000
        });
        
        if (!response) {
          throw new Error('No response received from navigation');
        }
        
        const status = response.status();
        if (status >= 400) {
          throw new Error(`Navigation failed with status ${status}`);
        }
        
        return response;
      }, {
        retries: RETRY.NAVIGATION,
        minDelay: 1000,
        maxDelay: 5000,
        onRetry: (error, attempt) => {
          logger.warn(`Navigation retry ${attempt} for account ${accountId}: ${error.message}`);
        }
      });
      
      logger.info(`Navigated to ${targetUrl} (account ${accountId})`);
      this.updateLastActivity(accountId);
    } catch (error) {
      logger.error(`Failed to navigate to ${targetUrl} for account ${accountId}`, null, error);
      
      // Fallback: try with direct URL evaluation method
      try {
        logger.info(`Trying fallback navigation method for account ${accountId}`);
        await page.evaluate((url) => window.location.href = url, targetUrl);
        await page.waitForNavigation({ waitUntil, timeout: 30000 });
        logger.info(`Fallback navigation successful to ${targetUrl} (account ${accountId})`);
        this.updateLastActivity(accountId);
      } catch (fallbackError) {
        logger.error(`Fallback navigation also failed for account ${accountId}`, null, fallbackError);
        throw fallbackError;
      }
    }
  }
}

module.exports = BrowserManager;