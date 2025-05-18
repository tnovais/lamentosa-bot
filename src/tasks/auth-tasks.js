const logger = require('../utils/logger');
const browserManager = require('../modules/browser-manager');
const antiDetection = require('../modules/anti-detection');
const humanInteraction = require('../modules/human-interaction');
const captchaSolver = require('../modules/captcha-solver');
const accountManager = require('../modules/account-manager');
const { URLS, TIMING, RETRY } = require('../config');
const { delay, randomInteger, retry } = require('../utils/helpers');

/**
 * Provides authentication-related tasks
 */
class AuthTasks {
  /**
   * Login to the game
   * @param {Object} page - Puppeteer page
   * @param {string} username - Username
   * @param {string} password - Password
   * @param {string} accountId - Account identifier
   * @returns {Promise<boolean>} - Whether login was successful
   */
  async login(page, username, password, accountId) {
    try {
      logger.info(`Attempting to login for account ${accountId}`, accountId);
      
      // Navigate to login page
      await browserManager.ensurePage(page, URLS.LOGIN, 'domcontentloaded', accountId);
      
      // Wait for page to load
      await page.waitForSelector('#username, .username, input[name="username"]', { timeout: 10000 })
        .catch(() => logger.warn('Username field not found, page may have changed', accountId));
      
      // Check if already logged in
      const loggedInElement = await page.$('.user-menu, .logged-in, .user-profile');
      if (loggedInElement) {
        logger.info('Already logged in', accountId);
        accountManager.recordLogin(accountId, true);
        return true;
      }
      
      // Add random delay before starting to fill the form
      await delay(randomInteger(1000, 3000));
      
      // Fill the login form with human-like interaction
      const usernameSelector = '#username, .username, input[name="username"]';
      const passwordSelector = '#password, .password, input[name="password"], input[type="password"]';
      const submitSelector = 'button[type="submit"], input[type="submit"], .login-button, .submit-button';
      
      // Find form elements
      const usernameField = await page.$(usernameSelector);
      const passwordField = await page.$(passwordSelector);
      const submitButton = await page.$(submitSelector);
      
      if (!usernameField || !passwordField || !submitButton) {
        logger.error('Login form elements not found', accountId);
        accountManager.recordLogin(accountId, false, 'Form elements not found');
        return false;
      }
      
      // Fill username
      await humanInteraction.simulateTyping(page, usernameField, username, accountId);
      await delay(randomInteger(500, 1500));
      
      // Fill password
      await humanInteraction.simulateTyping(page, passwordField, password, accountId);
      await delay(randomInteger(500, 1500));
      
      // Click login button
      await humanInteraction.simulateClick(page, submitButton, {}, accountId);
      
      // Wait for navigation
      await Promise.race([
        page.waitForNavigation({ timeout: 30000, waitUntil: 'domcontentloaded' }),
        page.waitForSelector('.user-menu, .logged-in, .user-profile', { timeout: 30000 })
      ]).catch(() => logger.warn('Navigation or profile element timeout after login', accountId));
      
      // Check for captcha
      const hasCaptcha = await this._checkForCaptcha(page, accountId);
      if (hasCaptcha) {
        logger.warn('Captcha detected during login', accountId);
        const captchaSolved = await this._handleLoginCaptcha(page, accountId);
        
        if (!captchaSolved) {
          logger.error('Failed to solve captcha during login', accountId);
          accountManager.recordLogin(accountId, false, 'Captcha not solved');
          return false;
        }
      }
      
      // Verify login success
      const isLoggedIn = await this._verifyLogin(page, accountId);
      
      if (isLoggedIn) {
        logger.info('Login successful', accountId);
        accountManager.recordLogin(accountId, true);
        
        // Save cookies for future use
        await browserManager.saveCookies(page, accountId);
        
        return true;
      } else {
        logger.error('Login failed', accountId);
        accountManager.recordLogin(accountId, false, 'Verification failed');
        return false;
      }
    } catch (error) {
      logger.error(`Login error: ${error.message}`, accountId, error);
      accountManager.recordLogin(accountId, false, error.message);
      return false;
    }
  }
  
  /**
   * Logout from the game
   * @param {Object} page - Puppeteer page
   * @param {string} accountId - Account identifier
   * @returns {Promise<boolean>} - Whether logout was successful
   */
  async logout(page, accountId) {
    try {
      logger.info('Attempting to logout', accountId);
      
      // Navigate to logout page
      await browserManager.ensurePage(page, URLS.LOGOUT, 'domcontentloaded', accountId);
      
      // Wait for logout to complete
      await Promise.race([
        page.waitForNavigation({ timeout: 10000, waitUntil: 'domcontentloaded' }),
        page.waitForSelector('#username, .username, input[name="username"]', { timeout: 10000 })
      ]).catch(() => logger.warn('Logout navigation timeout', accountId));
      
      // Verify logout
      const isLoggedOut = await page.$('#username, .username, input[name="username"], .login-form');
      
      if (isLoggedOut) {
        logger.info('Logout successful', accountId);
        accountManager.recordLogout(accountId);
        return true;
      } else {
        logger.warn('Logout verification failed', accountId);
        return false;
      }
    } catch (error) {
      logger.error(`Logout error: ${error.message}`, accountId, error);
      return false;
    }
  }
  
  /**
   * Check user profile/status
   * @param {Object} page - Puppeteer page
   * @param {string} accountId - Account identifier
   * @returns {Promise<Object|null>} - Profile data or null if failed
   */
  async checkProfile(page, accountId) {
    try {
      logger.info('Checking profile', accountId);
      
      await browserManager.ensurePage(page, URLS.PROFILE, 'domcontentloaded', accountId);
      
      // Wait for profile data to load
      await page.waitForSelector('.profile-container, .status-container, .character-stats', { 
        timeout: 10000 
      }).catch(() => logger.warn('Profile container not found', accountId));
      
      // Extract profile information
      const profileData = await page.evaluate(() => {
        // This function extracts profile data based on various possible selectors
        const getTextContent = (selector) => {
          const element = document.querySelector(selector);
          return element ? element.textContent.trim() : null;
        };
        
        const extractNumber = (text) => {
          if (!text) return null;
          const match = text.match(/[\d,]+/);
          return match ? parseInt(match[0].replace(/,/g, '')) : null;
        };
        
        return {
          level: extractNumber(getTextContent('.level, .character-level, .player-level')),
          health: extractNumber(getTextContent('.health, .hp, .life')),
          energy: extractNumber(getTextContent('.energy, .mana, .mp')),
          strength: extractNumber(getTextContent('.strength, .str, .power')),
          defense: extractNumber(getTextContent('.defense, .def, .armor')),
          agility: extractNumber(getTextContent('.agility, .agi, .dexterity')),
          gold: extractNumber(getTextContent('.gold, .money, .currency')),
          gems: extractNumber(getTextContent('.gems, .premium, .diamonds')),
          experience: extractNumber(getTextContent('.experience, .exp, .xp')),
          clan: getTextContent('.clan, .guild, .faction'),
          rank: getTextContent('.rank, .title, .status'),
          lastUpdated: new Date().toISOString()
        };
      });
      
      logger.info(`Profile data retrieved for ${accountId}: Level ${profileData.level}`, accountId);
      
      // Update account profile data
      accountManager.updateAccountStatus(accountId, { 
        profileData,
        lastProfileCheck: new Date()
      });
      
      return profileData;
    } catch (error) {
      logger.error(`Profile check error: ${error.message}`, accountId, error);
      return null;
    }
  }
  
  /**
   * Verify login was successful
   * @param {Object} page - Puppeteer page
   * @param {string} accountId - Account identifier
   * @returns {Promise<boolean>} - Whether login is verified
   * @private
   */
  async _verifyLogin(page, accountId) {
    try {
      // Try different selectors that indicate logged-in state
      const loggedInSelectors = [
        '.user-menu', 
        '.logged-in', 
        '.user-profile',
        '.character-name',
        '.logout-button',
        '.player-stats'
      ];
      
      // Check each selector
      for (const selector of loggedInSelectors) {
        const element = await page.$(selector);
        if (element) {
          logger.debug(`Login verified via selector: ${selector}`, accountId);
          return true;
        }
      }
      
      // Check URL as a fallback
      const currentUrl = page.url();
      const loggedInUrls = ['/status/', '/profile/', '/dashboard/'];
      
      for (const urlPart of loggedInUrls) {
        if (currentUrl.includes(urlPart)) {
          logger.debug(`Login verified via URL: ${urlPart}`, accountId);
          return true;
        }
      }
      
      // Check for login failure messages
      const errorSelectors = [
        '.error-message',
        '.login-error',
        '.alert-danger',
        '[class*="error"]'
      ];
      
      for (const selector of errorSelectors) {
        const element = await page.$(selector);
        if (element) {
          const errorText = await page.evaluate(el => el.textContent.trim(), element);
          logger.warn(`Login error message found: "${errorText}"`, accountId);
          return false;
        }
      }
      
      logger.warn('Could not verify login status', accountId);
      return false;
    } catch (error) {
      logger.error(`Login verification error: ${error.message}`, accountId);
      return false;
    }
  }
  
  /**
   * Check if page has captcha
   * @param {Object} page - Puppeteer page
   * @param {string} accountId - Account identifier
   * @returns {Promise<boolean>} - Whether captcha is present
   * @private
   */
  async _checkForCaptcha(page, accountId) {
    try {
      // Check for common captcha elements
      const captchaSelectors = [
        '.captcha-container',
        '.g-recaptcha',
        '.h-captcha',
        'img[src*="captcha"]',
        'iframe[src*="captcha"]',
        'iframe[src*="recaptcha"]',
        'iframe[src*="hcaptcha"]',
        '.captcha-image',
        '#captcha'
      ];
      
      for (const selector of captchaSelectors) {
        const element = await page.$(selector);
        if (element) {
          logger.warn(`Captcha detected via selector: ${selector}`, accountId);
          return true;
        }
      }
      
      // Check URL for captcha indicators
      const currentUrl = page.url();
      if (currentUrl.includes('captcha') || 
          currentUrl.includes('anti-bot') || 
          currentUrl.includes('verification')) {
        logger.warn(`Captcha detected via URL: ${currentUrl}`, accountId);
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error(`Captcha check error: ${error.message}`, accountId);
      return false;
    }
  }
  
  /**
   * Handle login captcha
   * @param {Object} page - Puppeteer page
   * @param {string} accountId - Account identifier
   * @returns {Promise<boolean>} - Whether captcha was solved
   * @private
   */
  async _handleLoginCaptcha(page, accountId) {
    return await captchaSolver.handleCaptcha(
      page,
      // Extract captcha function
      async (page) => {
        try {
          // Check for image captcha
          const captchaImg = await page.$('img[src*="captcha"]');
          if (captchaImg) {
            const imageBuffer = await captchaImg.screenshot();
            return { type: 'image', data: imageBuffer };
          }
          
          // Check for reCAPTCHA
          const recaptchaElement = await page.$('.g-recaptcha');
          if (recaptchaElement) {
            const siteKey = await page.evaluate(el => el.getAttribute('data-sitekey'), recaptchaElement);
            return { 
              type: 'recaptcha',
              siteKey,
              url: page.url()
            };
          }
          
          logger.warn('Unknown captcha type', accountId);
          return null;
        } catch (error) {
          logger.error(`Error extracting captcha: ${error.message}`, accountId);
          return null;
        }
      },
      // Submit captcha function
      async (page, solution) => {
        try {
          // Find captcha input field
          const captchaInput = await page.$('input[name="captcha"], #captcha, .captcha-input');
          if (captchaInput) {
            await humanInteraction.simulateTyping(page, captchaInput, solution, accountId);
            
            // Find and click submit button
            const submitButton = await page.$(
              'button[type="submit"], input[type="submit"], .submit-button, .captcha-submit'
            );
            
            if (submitButton) {
              await humanInteraction.simulateClick(page, submitButton, {}, accountId);
              
              // Wait for result
              await Promise.race([
                page.waitForNavigation({ timeout: 10000, waitUntil: 'domcontentloaded' }),
                page.waitForSelector('.user-menu, .logged-in, .user-profile', { timeout: 10000 })
              ]).catch(() => logger.warn('Captcha submission navigation timeout', accountId));
              
              return true;
            } else {
              logger.warn('Captcha submit button not found', accountId);
            }
          } else if (await page.$('.g-recaptcha')) {
            // Handle reCAPTCHA
            await page.evaluate((solution) => {
              window.grecaptcha.getResponse = () => solution;
              const form = document.querySelector('form');
              if (form) form.submit();
            }, solution);
            
            // Wait for result
            await Promise.race([
              page.waitForNavigation({ timeout: 10000, waitUntil: 'domcontentloaded' }),
              page.waitForSelector('.user-menu, .logged-in, .user-profile', { timeout: 10000 })
            ]).catch(() => logger.warn('reCAPTCHA submission navigation timeout', accountId));
            
            return true;
          }
          
          logger.warn('Could not find captcha input field', accountId);
          return false;
        } catch (error) {
          logger.error(`Error submitting captcha: ${error.message}`, accountId);
          return false;
        }
      },
      // Verify captcha function
      async (page) => {
        // If we're no longer on a captcha page, consider it solved
        const stillHasCaptcha = await this._checkForCaptcha(page, accountId);
        if (!stillHasCaptcha) {
          return true;
        }
        
        // Check for error messages
        const errorSelectors = [
          '.captcha-error',
          '.error-message',
          '.alert-danger',
          '[class*="error"]'
        ];
        
        for (const selector of errorSelectors) {
          const element = await page.$(selector);
          if (element) {
            const errorText = await page.evaluate(el => el.textContent.trim(), element);
            logger.warn(`Captcha error message: "${errorText}"`, accountId);
            return false;
          }
        }
        
        // Check if we're logged in
        return await this._verifyLogin(page, accountId);
      },
      accountId
    );
  }
  
  /**
   * Login with cookie persistence
   * @param {Object} page - Puppeteer page
   * @param {string} username - Username
   * @param {string} password - Password
   * @param {string} accountId - Account identifier
   * @returns {Promise<boolean>} - Whether login was successful
   */
  async loginWithCookiePersistence(page, username, password, accountId) {
    try {
      // Try to load cookies first
      const cookiesLoaded = await browserManager.loadCookies(page, accountId);
      
      if (cookiesLoaded) {
        // Navigate to profile page to check if cookies are valid
        await browserManager.ensurePage(page, URLS.PROFILE, 'domcontentloaded', accountId);
        
        // Check if we're logged in
        const isLoggedIn = await this._verifyLogin(page, accountId);
        
        if (isLoggedIn) {
          logger.info('Successfully logged in using cookies', accountId);
          accountManager.recordLogin(accountId, true);
          return true;
        }
        
        logger.warn('Cookies invalid or expired, will try normal login', accountId);
      }
      
      // Fall back to normal login
      return await this.login(page, username, password, accountId);
    } catch (error) {
      logger.error(`Login with cookie persistence error: ${error.message}`, accountId, error);
      return await this.login(page, username, password, accountId);
    }
  }
}

module.exports = new AuthTasks();
