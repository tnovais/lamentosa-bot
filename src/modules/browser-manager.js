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
    
    logger.info('Utilizando puppeteer-extra com stealth plugin');
    return { puppeteer: puppeteerExtra, isPuppeteerExtra: true };
  } catch (error) {
    logger.warn(`Erro ao carregar puppeteer-extra: ${error.message}. Tentando puppeteer padrão...`);
    
    try {
      // Tente carregar o puppeteer padrão
      const puppeteerStandard = require('puppeteer');
      logger.info('Utilizando puppeteer padrão');
      return { puppeteer: puppeteerStandard, isPuppeteerExtra: false };
    } catch (stdError) {
      logger.warn(`Erro ao carregar puppeteer padrão: ${stdError.message}. Tentando puppeteer-core...`);
      
      try {
        // Como último recurso, tente puppeteer-core
        const puppeteerCore = require('puppeteer-core');
        logger.info('Utilizando puppeteer-core');
        return { puppeteer: puppeteerCore, isPuppeteerExtra: false, isCore: true };
      } catch (coreError) {
        logger.error(`Não foi possível carregar nenhuma versão do puppeteer: ${coreError.message}`);
        throw new Error('Falha ao carregar dependências de navegador');
      }
    }
  }
};

// Carrega as dependências de forma dinâmica
const { puppeteer, isPuppeteerExtra, isCore } = loadDependencies();

/**
 * Manages browser instances and provides enhanced browser functionality
 */
class BrowserManager {
  constructor(options = {}) {
    this.options = {
      headless: 'new',
      userDataDir: './browser-data',
      defaultViewport: null,
      ...options
    };
    this.browser = null;
    this.activeBrowsers = new Map();
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
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1'
      });
      
      // Apply advanced evasion techniques
      await this._applyAdvancedEvasion(page, accountId);
      
      // Set viewport
      const resolution = randomItem(FINGERPRINT.RESOLUTIONS);
      await page.setViewport({
        width: resolution.width,
        height: resolution.height,
        deviceScaleFactor: 1,
        hasTouch: randomInteger(1, 10) > 8, // 20% chance of touch capability
        isLandscape: true,
        isMobile: resolution.width < 800
      });
      
      logger.info(`Created page with resolution ${resolution.width}x${resolution.height}`, accountId);
      return page;
    } catch (error) {
      logger.error('Failed to create page', accountId, error);
      throw error;
    }
  }
  
  /**
   * Apply advanced evasion techniques to a page
   * @param {Object} page - Page instance
   * @param {string} accountId - Account identifier
   * @private
   */
  async _applyAdvancedEvasion(page, accountId) {
    try {
      await page.evaluateOnNewDocument(() => {
        // Override navigator properties
        const newProto = navigator.__proto__;
        delete newProto.webdriver;
        navigator.__proto__ = newProto;
        
        // Override permissions
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' || 
          parameters.name === 'clipboard-read' || 
          parameters.name === 'clipboard-write' || 
          parameters.name === 'geolocation'
        ) 
          ? Promise.resolve({ state: 'prompt', onchange: null }) 
          : originalQuery(parameters);
        
        // Add WebDriver delay
        Object.defineProperty(navigator, 'webdriver', {
          get: () => {
            if (Math.random() < 0.99) return false;
            return undefined;
          }
        });
        
        // Randomize plugins
        const pluginLength = Math.floor(Math.random() * 3) + 2;
        const pluginArray = Array.from({ length: pluginLength });
        
        // Override plugins
        Object.defineProperty(navigator, 'plugins', {
          get: () => pluginArray
        });
        
        // Override Chrome
        Object.defineProperty(window, 'chrome', {
          get: () => ({
            runtime: {},
            app: {
              InstallState: { INSTALLED: 'INSTALLED', DISABLED: 'DISABLED' },
              RunningState: { RUNNING: 'RUNNING', UNABLE_TO_RUN: 'UNABLE_TO_RUN' },
              getDetails: () => { return {}; },
              getIsInstalled: () => { return Math.random() > 0.5; }
            }
          })
        });
        
        // WebGL fingerprinting protection
        const getParameterProto = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
          // UNMASKED_VENDOR_WEBGL
          if (parameter === 37445) {
            return ['Intel Inc.', 'NVIDIA Corporation', 'AMD'][Math.floor(Math.random() * 3)];
          }
          // UNMASKED_RENDERER_WEBGL
          if (parameter === 37446) {
            return ['Intel Iris OpenGL Engine', 'GeForce GTX 1650/PCIe/SSE2', 'Radeon RX 580 Series'][Math.floor(Math.random() * 3)];
          }
          return getParameterProto.apply(this, arguments);
        };
        
        // Prevent detection through iframe focus
        const originalFocus = HTMLIFrameElement.prototype.focus;
        HTMLIFrameElement.prototype.focus = function() {
          setTimeout(() => {
            originalFocus.apply(this, arguments);
          }, Math.floor(Math.random() * 100));
        };
        
        // Hardware concurrency
        Object.defineProperty(navigator, 'hardwareConcurrency', {
          get: () => Math.floor(Math.random() * 6) + 4
        });
      });
      
      logger.debug('Applied advanced browser evasion techniques', accountId);
    } catch (error) {
      logger.error('Failed to apply evasion techniques', accountId, error);
    }
  }
  
  /**
   * Save cookies for an account
   * @param {Object} page - Page instance
   * @param {string} accountId - Account identifier
   */
  async saveCookies(page, accountId) {
    try {
      const cookies = await page.cookies();
      const cookiesDir = path.join(this.options.userDataDir, 'cookies');
      
      if (!fs.existsSync(cookiesDir)) {
        fs.mkdirSync(cookiesDir, { recursive: true });
      }
      
      const cookiesPath = path.join(cookiesDir, `${accountId}.json`);
      fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
      
      logger.info(`Saved ${cookies.length} cookies for account ${accountId}`, accountId);
    } catch (error) {
      logger.error(`Failed to save cookies for account ${accountId}`, accountId, error);
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
      const cookiesPath = path.join(this.options.userDataDir, 'cookies', `${accountId}.json`);
      
      if (!fs.existsSync(cookiesPath)) {
        logger.info(`No cookies found for account ${accountId}`, accountId);
        return false;
      }
      
      const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
      await page.setCookie(...cookies);
      
      logger.info(`Loaded ${cookies.length} cookies for account ${accountId}`, accountId);
      return true;
    } catch (error) {
      logger.error(`Failed to load cookies for account ${accountId}`, accountId, error);
      return false;
    }
  }
  
  /**
   * Register browser with account for tracking
   * @param {Object} browser - Browser instance
   * @param {string} accountId - Account identifier
   */
  registerBrowser(browser, accountId) {
    this.activeBrowsers.set(accountId, {
      browser,
      createdAt: new Date(),
      lastActivity: new Date()
    });
    
    logger.debug(`Registered browser for account ${accountId}`, accountId);
  }
  
  /**
   * Update last activity time for a browser
   * @param {string} accountId - Account identifier
   */
  updateActivity(accountId) {
    const browserData = this.activeBrowsers.get(accountId);
    if (browserData) {
      browserData.lastActivity = new Date();
      this.activeBrowsers.set(accountId, browserData);
    }
  }
  
  /**
   * Close a browser for an account
   * @param {string} accountId - Account identifier
   */
  async closeBrowser(accountId) {
    try {
      const browserData = this.activeBrowsers.get(accountId);
      if (browserData && browserData.browser) {
        await browserData.browser.close();
        this.activeBrowsers.delete(accountId);
        logger.info(`Closed browser for account ${accountId}`, accountId);
      }
    } catch (error) {
      logger.error(`Error closing browser for account ${accountId}`, accountId, error);
    }
  }
  
  /**
   * Close all active browsers
   */
  async closeAllBrowsers() {
    try {
      const promises = [];
      for (const accountId of this.activeBrowsers.keys()) {
        promises.push(this.closeBrowser(accountId));
      }
      await Promise.all(promises);
      logger.info('Closed all browsers');
    } catch (error) {
      logger.error('Error closing all browsers', null, error);
    }
  }
  
  /**
   * Ensure the page navigates to the desired URL
   * @param {Object} page - Page instance
   * @param {string} targetUrl - URL to navigate to
   * @param {string} waitUntil - Navigation wait condition
   * @param {string} accountId - Account identifier
   */
  async ensurePage(page, targetUrl, waitUntil = 'domcontentloaded', accountId) {
    const currentUrl = page.url();
    if (!currentUrl.includes(targetUrl)) {
      logger.info(`Navigating to ${targetUrl} (current: ${currentUrl})`, accountId);
      try {
        await retry(
          async () => await page.goto(targetUrl, { waitUntil, timeout: 30000 }),
          RETRY.MAX_ATTEMPTS,
          1000,
          (error, attempt, delay) => {
            logger.warn(`Navigation retry ${attempt}/${RETRY.MAX_ATTEMPTS} after ${delay}ms: ${error.message}`, accountId);
          }
        );
        logger.info(`Successfully navigated to: ${page.url()}`, accountId);
      } catch (error) {
        logger.error(`Failed to navigate to ${targetUrl}`, accountId, error);
        await page.reload({ waitUntil, timeout: 30000 }).catch(() => {
          logger.error(`Failed to reload page`, accountId);
        });
        throw error;
      }
    }
  }
}

module.exports = new BrowserManager();
