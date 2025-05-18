const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const { FINGERPRINT, RETRY } = require('../config');
const logger = require('../utils/logger');
const { randomItem, randomInteger, retry } = require('../utils/helpers');

// Initialize puppeteer with stealth plugin
puppeteer.use(StealthPlugin());

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
    
    // Select random fingerprint values
    const userAgent = randomItem(FINGERPRINT.USER_AGENTS);
    const languages = randomItem(FINGERPRINT.LANGUAGES);
    const resolution = randomItem(FINGERPRINT.RESOLUTIONS);
    
    // Customize launch arguments
    const args = [
      `--user-agent=${userAgent}`,
      `--window-size=${resolution.width},${resolution.height}`,
      `--lang=${languages[0]}`,
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--disable-breakpad',
      '--disable-translate',
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ];
    
    try {
      logger.info('Launching browser with randomized fingerprint');
      this.browser = await puppeteer.launch({
        ...mergedOptions,
        args: [...args, ...(mergedOptions.args || [])]
      });
      
      logger.info('Browser launched successfully');
      return this.browser;
    } catch (error) {
      logger.error('Failed to launch browser', null, error);
      throw error;
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
