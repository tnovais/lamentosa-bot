const logger = require('../utils/logger');
const browserManager = require('../modules/browser-manager');
const humanInteraction = require('../modules/human-interaction');
const antiDetection = require('../modules/anti-detection');
const captchaSolver = require('../modules/captcha-solver');
const accountManager = require('../modules/account-manager');
const { URLS, GAME, RETRY, TIMING } = require('../config');
const { delay, randomInteger, retry, randomItem, normalDistributionDelay } = require('../utils/helpers');

/**
 * Provides game-specific task interactions
 */
class GameTasks {
  /**
   * Perform PVP battle tasks
   * @param {Object} page - Puppeteer page
   * @param {string} accountId - Account identifier
   * @returns {Promise<Object>} - Battle results
   */
  async performPvpBattle(page, accountId) {
    try {
      logger.info('Starting PVP battle task', accountId);
      
      // Navigate to PVP page
      await browserManager.ensurePage(page, URLS.PVP, 'domcontentloaded', accountId);
      
      // Add some natural browsing behavior
      await humanInteraction.simulateScrolling(page, {
        direction: 'down',
        distance: 'medium',
        speed: 'medium'
      }, accountId);
      
      // Check for captcha before proceeding
      const hasCaptcha = await this._checkForCaptcha(page, accountId);
      if (hasCaptcha) {
        logger.warn('Captcha detected during PVP battle', accountId);
        const captchaSolved = await this._handleGameCaptcha(page, accountId);
        
        if (!captchaSolved) {
          logger.error('Failed to solve captcha during PVP battle', accountId);
          return { success: false, reason: 'captcha_failed' };
        }
      }
      
      // Look for opponent selection
      const enemyElements = await page.$$('.enemy-card, .opponent, .pvp-target');
      
      if (!enemyElements || enemyElements.length === 0) {
        logger.warn('No opponents found on PVP page', accountId);
        return { success: false, reason: 'no_opponents' };
      }
      
      // Select a random opponent with human-like behavior
      const randomIndex = Math.floor(Math.random() * enemyElements.length);
      const selectedEnemy = enemyElements[randomIndex];
      
      // Get enemy details before clicking
      const enemyDetails = await page.evaluate(el => {
        const nameEl = el.querySelector('.enemy-name, .name, .player-name');
        const levelEl = el.querySelector('.enemy-level, .level, .player-level');
        
        return {
          name: nameEl ? nameEl.textContent.trim() : 'Unknown',
          level: levelEl ? parseInt(levelEl.textContent.match(/\d+/)?.[0] || 0) : 0
        };
      }, selectedEnemy);
      
      logger.info(`Selected opponent: ${enemyDetails.name} (Level ${enemyDetails.level})`, accountId);
      
      // Click on the enemy with human-like interaction
      await humanInteraction.simulateClick(page, selectedEnemy, {}, accountId);
      
      // Wait for battle page to load
      await Promise.race([
        page.waitForNavigation({ timeout: 15000, waitUntil: 'domcontentloaded' }),
        page.waitForSelector('.battle-container, .combat-area, .fight-scene', { timeout: 15000 })
      ]).catch(() => logger.warn('Battle page navigation timeout', accountId));
      
      // Check for attack button
      const attackButton = await page.$('.attack-button, .fight-button, button[data-action="attack"]');
      
      if (!attackButton) {
        logger.warn('Attack button not found', accountId);
        return { success: false, reason: 'attack_button_not_found' };
      }
      
      // Use potions if needed and if available
      await this._useHastePotionsIfNeeded(page, accountId);
      
      // Fight until battle is complete
      const battleResult = await this._completeBattle(page, accountId);
      
      // Record battle result in account manager
      accountManager.updateAccountStatus(accountId, {
        lastPvpBattle: new Date(),
        pvpBattlesTotal: (accountManager.getAccount(accountId)?.pvpBattlesTotal || 0) + 1,
        pvpBattlesWon: battleResult.victory ? 
          (accountManager.getAccount(accountId)?.pvpBattlesWon || 0) + 1 : 
          (accountManager.getAccount(accountId)?.pvpBattlesWon || 0)
      });
      
      return {
        success: true,
        opponent: enemyDetails,
        result: battleResult
      };
    } catch (error) {
      logger.error(`PVP battle error: ${error.message}`, accountId, error);
      return { success: false, reason: 'error', message: error.message };
    }
  }
  
  /**
   * Perform temple tasks
   * @param {Object} page - Puppeteer page
   * @param {string} accountId - Account identifier
   * @returns {Promise<Object>} - Temple results
   */
  async performTempleTask(page, accountId) {
    try {
      logger.info('Starting temple task', accountId);
      
      // Navigate to temple page
      await browserManager.ensurePage(page, URLS.TEMPLE, 'domcontentloaded', accountId);
      
      // Add some natural browsing behavior
      await humanInteraction.simulateScrolling(page, {
        direction: 'down',
        distance: 'short',
        speed: 'medium'
      }, accountId);
      
      // Check for captcha
      const hasCaptcha = await this._checkForCaptcha(page, accountId);
      if (hasCaptcha) {
        logger.warn('Captcha detected during temple task', accountId);
        const captchaSolved = await this._handleGameCaptcha(page, accountId);
        
        if (!captchaSolved) {
          logger.error('Failed to solve captcha during temple task', accountId);
          return { success: false, reason: 'captcha_failed' };
        }
      }
      
      // Wait for temple options to be visible
      await page.waitForSelector('.temple-options, .prayer-options, .ritual-buttons', { 
        timeout: 10000 
      }).catch(() => logger.warn('Temple options not found', accountId));
      
      // Look for prayer or ritual buttons
      const templeActions = await page.$$('.temple-action, .prayer-button, .ritual-button, button[data-action="pray"]');
      
      if (!templeActions || templeActions.length === 0) {
        logger.warn('No temple actions found', accountId);
        return { success: false, reason: 'no_actions_available' };
      }
      
      // Select a random temple action
      const randomAction = templeActions[Math.floor(Math.random() * templeActions.length)];
      
      // Get action details
      const actionDetails = await page.evaluate(el => {
        return {
          name: el.textContent.trim(),
          type: el.classList.contains('prayer-button') ? 'prayer' : 'ritual'
        };
      }, randomAction);
      
      logger.info(`Selected temple action: ${actionDetails.name} (${actionDetails.type})`, accountId);
      
      // Click on the action with human-like behavior
      await humanInteraction.simulateClick(page, randomAction, {}, accountId);
      
      // Wait for result
      await delay(randomInteger(3000, 8000));
      
      // Check for confirmation or result message
      const resultMessages = await page.$$('.result-message, .prayer-result, .ritual-result, .temple-message');
      let resultDetails = null;
      
      if (resultMessages && resultMessages.length > 0) {
        // Extract message text
        resultDetails = await page.evaluate(el => el.textContent.trim(), resultMessages[0]);
        logger.info(`Temple action result: ${resultDetails}`, accountId);
      }
      
      // Record temple activity
      accountManager.updateAccountStatus(accountId, {
        lastTempleActivity: new Date(),
        templeActivitiesTotal: (accountManager.getAccount(accountId)?.templeActivitiesTotal || 0) + 1
      });
      
      return {
        success: true,
        action: actionDetails,
        result: resultDetails
      };
    } catch (error) {
      logger.error(`Temple task error: ${error.message}`, accountId, error);
      return { success: false, reason: 'error', message: error.message };
    }
  }
  
  /**
   * Perform job/cemetery tasks
   * @param {Object} page - Puppeteer page
   * @param {string} accountId - Account identifier
   * @returns {Promise<Object>} - Job results
   */
  async performJobTask(page, accountId) {
    try {
      logger.info('Starting job task', accountId);
      
      // Navigate to jobs page
      await browserManager.ensurePage(page, URLS.JOBS, 'domcontentloaded', accountId);
      
      // Add natural browsing behavior
      await humanInteraction.simulateScrolling(page, {
        direction: 'down',
        distance: 'medium',
        speed: 'medium'
      }, accountId);
      
      // Check for captcha
      const hasCaptcha = await this._checkForCaptcha(page, accountId);
      if (hasCaptcha) {
        logger.warn('Captcha detected during job task', accountId);
        const captchaSolved = await this._handleGameCaptcha(page, accountId);
        
        if (!captchaSolved) {
          logger.error('Failed to solve captcha during job task', accountId);
          return { success: false, reason: 'captcha_failed' };
        }
      }
      
      // Find available jobs
      const jobElements = await page.$$('.job-card, .job-option, .cemetery-job, .job-item');
      
      if (!jobElements || jobElements.length === 0) {
        logger.warn('No jobs found', accountId);
        return { success: false, reason: 'no_jobs_available' };
      }
      
      // Filter jobs to find those that can be completed
      const availableJobs = [];
      
      for (const jobElement of jobElements) {
        const isAvailable = await page.evaluate(el => {
          return !el.classList.contains('disabled') && 
                 !el.classList.contains('in-progress') &&
                 !el.classList.contains('locked');
        }, jobElement);
        
        if (isAvailable) {
          availableJobs.push(jobElement);
        }
      }
      
      if (availableJobs.length === 0) {
        logger.info('No available jobs to complete', accountId);
        return { success: false, reason: 'all_jobs_unavailable' };
      }
      
      // Select a random available job
      const selectedJob = availableJobs[Math.floor(Math.random() * availableJobs.length)];
      
      // Get job details
      const jobDetails = await page.evaluate(el => {
        const nameEl = el.querySelector('.job-name, .name, .title');
        const rewardEl = el.querySelector('.job-reward, .reward, .gold-reward');
        const timeEl = el.querySelector('.job-time, .duration, .time-required');
        
        return {
          name: nameEl ? nameEl.textContent.trim() : 'Unknown Job',
          reward: rewardEl ? rewardEl.textContent.trim() : 'Unknown Reward',
          duration: timeEl ? timeEl.textContent.trim() : 'Unknown Duration'
        };
      }, selectedJob);
      
      logger.info(`Selected job: ${jobDetails.name} (${jobDetails.reward}, ${jobDetails.duration})`, accountId);
      
      // Click on the job with human-like behavior
      await humanInteraction.simulateClick(page, selectedJob, {}, accountId);
      
      // Look for start button or confirmation
      const startButton = await page.$('.start-button, .accept-job, button[data-action="start-job"]');
      
      if (startButton) {
        // Add small delay before clicking
        await delay(randomInteger(1000, 3000));
        
        await humanInteraction.simulateClick(page, startButton, {}, accountId);
        
        // Wait for confirmation
        await delay(randomInteger(2000, 5000));
      }
      
      // Check for job in progress message or busy timer
      const busyTimer = await page.$('.busy-timer, .job-timer, .progress-bar');
      const jobStarted = !!busyTimer;
      
      if (jobStarted) {
        logger.info(`Job "${jobDetails.name}" started successfully`, accountId);
        
        // Record job start
        accountManager.updateAccountStatus(accountId, {
          lastJobStarted: new Date(),
          jobsStartedTotal: (accountManager.getAccount(accountId)?.jobsStartedTotal || 0) + 1,
          currentJob: jobDetails
        });
        
        return {
          success: true,
          job: jobDetails,
          status: 'started'
        };
      } else {
        logger.warn(`Failed to start job "${jobDetails.name}"`, accountId);
        return { 
          success: false, 
          reason: 'job_start_failed',
          job: jobDetails
        };
      }
    } catch (error) {
      logger.error(`Job task error: ${error.message}`, accountId, error);
      return { success: false, reason: 'error', message: error.message };
    }
  }
  
  /**
   * Check market for items
   * @param {Object} page - Puppeteer page
   * @param {string} accountId - Account identifier
   * @returns {Promise<Object>} - Market results
   */
  async checkMarket(page, accountId) {
    try {
      logger.info('Checking market', accountId);
      
      // Navigate to market page
      await browserManager.ensurePage(page, URLS.MARKET, 'domcontentloaded', accountId);
      
      // Add natural browsing behavior
      await humanInteraction.simulateScrolling(page, {
        direction: 'down',
        distance: 'medium',
        speed: 'medium'
      }, accountId);
      
      // Check for captcha
      const hasCaptcha = await this._checkForCaptcha(page, accountId);
      if (hasCaptcha) {
        logger.warn('Captcha detected during market check', accountId);
        const captchaSolved = await this._handleGameCaptcha(page, accountId);
        
        if (!captchaSolved) {
          logger.error('Failed to solve captcha during market check', accountId);
          return { success: false, reason: 'captcha_failed' };
        }
      }
      
      // Find market items
      const marketItems = await page.$$('.market-item, .item-card, .shop-item');
      
      if (!marketItems || marketItems.length === 0) {
        logger.warn('No market items found', accountId);
        return { success: false, reason: 'no_items_found' };
      }
      
      // Extract market item details
      const itemDetails = [];
      
      for (let i = 0; i < Math.min(marketItems.length, 10); i++) {
        const details = await page.evaluate(el => {
          const nameEl = el.querySelector('.item-name, .name, .title');
          const priceEl = el.querySelector('.item-price, .price, .cost');
          const typeEl = el.querySelector('.item-type, .type, .category');
          
          return {
            name: nameEl ? nameEl.textContent.trim() : 'Unknown Item',
            price: priceEl ? priceEl.textContent.trim() : 'Unknown Price',
            type: typeEl ? typeEl.textContent.trim() : 'Unknown Type'
          };
        }, marketItems[i]);
        
        itemDetails.push(details);
      }
      
      logger.info(`Found ${itemDetails.length} market items`, accountId);
      
      // Look for haste potions if needed
      const account = accountManager.getAccount(accountId);
      const shouldBuyHastePotions = account?.profileData?.hasOwnProperty('hasHastePotions') && 
                                    account.profileData.hasHastePotions < GAME.MAX_HASTE_POTIONS;
      
      if (shouldBuyHastePotions) {
        logger.info('Looking for haste potions to buy', accountId);
        
        // Find haste potions in market
        for (let i = 0; i < marketItems.length; i++) {
          const isHastePotion = await page.evaluate(el => {
            const text = el.textContent.toLowerCase();
            return text.includes('haste potion') || 
                   text.includes('speed potion') || 
                   text.includes('agility potion');
          }, marketItems[i]);
          
          if (isHastePotion) {
            // Get potion price
            const potionPrice = await page.evaluate(el => {
              const priceEl = el.querySelector('.item-price, .price, .cost');
              if (!priceEl) return null;
              
              const priceText = priceEl.textContent.trim();
              const priceMatch = priceText.match(/(\d+)/);
              
              return priceMatch ? parseInt(priceMatch[1]) : null;
            }, marketItems[i]);
            
            if (potionPrice && account?.profileData?.gold >= potionPrice) {
              logger.info(`Found haste potion for ${potionPrice} gold`, accountId);
              
              // Buy the potion
              await humanInteraction.simulateClick(page, marketItems[i], {}, accountId);
              
              // Look for buy button
              const buyButton = await page.$('.buy-button, button[data-action="buy"], .purchase-button');
              
              if (buyButton) {
                await humanInteraction.simulateClick(page, buyButton, {}, accountId);
                
                // Wait for purchase confirmation
                await delay(randomInteger(2000, 5000));
                
                // Check for purchase confirmation
                const confirmationElement = await page.$('.purchase-confirmation, .success-message');
                
                if (confirmationElement) {
                  logger.info('Successfully purchased haste potion', accountId);
                  
                  // Update account data
                  accountManager.updateAccountStatus(accountId, {
                    lastPotionPurchase: new Date(),
                    potionsPurchased: (account?.potionsPurchased || 0) + 1,
                    profileData: {
                      ...account?.profileData,
                      hasHastePotions: (account?.profileData?.hasHastePotions || 0) + 1,
                      gold: account?.profileData?.gold - potionPrice
                    }
                  });
                }
              }
              
              break;
            }
          }
        }
      }
      
      // Record market check
      accountManager.updateAccountStatus(accountId, {
        lastMarketCheck: new Date(),
        marketChecksTotal: (accountManager.getAccount(accountId)?.marketChecksTotal || 0) + 1
      });
      
      return {
        success: true,
        items: itemDetails
      };
    } catch (error) {
      logger.error(`Market check error: ${error.message}`, accountId, error);
      return { success: false, reason: 'error', message: error.message };
    }
  }
  
  /**
   * Check inventory
   * @param {Object} page - Puppeteer page
   * @param {string} accountId - Account identifier
   * @returns {Promise<Object>} - Inventory results
   */
  async checkInventory(page, accountId) {
    try {
      logger.info('Checking inventory', accountId);
      
      // Navigate to inventory page
      await browserManager.ensurePage(page, URLS.INVENTORY, 'domcontentloaded', accountId);
      
      // Add natural browsing behavior
      await humanInteraction.simulateScrolling(page, {
        direction: 'down',
        distance: 'medium',
        speed: 'medium'
      }, accountId);
      
      // Check for captcha
      const hasCaptcha = await this._checkForCaptcha(page, accountId);
      if (hasCaptcha) {
        logger.warn('Captcha detected during inventory check', accountId);
        const captchaSolved = await this._handleGameCaptcha(page, accountId);
        
        if (!captchaSolved) {
          logger.error('Failed to solve captcha during inventory check', accountId);
          return { success: false, reason: 'captcha_failed' };
        }
      }
      
      // Extract inventory data
      const inventoryItems = await page.$$('.inventory-item, .item-card, .item-slot');
      
      if (!inventoryItems || inventoryItems.length === 0) {
        logger.info('No inventory items found', accountId);
        return { success: true, items: [] };
      }
      
      // Get inventory details
      const itemDetails = [];
      let hasteCount = 0;
      
      for (const item of inventoryItems) {
        const details = await page.evaluate(el => {
          const nameEl = el.querySelector('.item-name, .name, .title');
          const quantityEl = el.querySelector('.item-quantity, .quantity, .amount');
          const typeEl = el.querySelector('.item-type, .type, .category');
          
          return {
            name: nameEl ? nameEl.textContent.trim() : 'Unknown Item',
            quantity: quantityEl ? parseInt(quantityEl.textContent.match(/\d+/)?.[0] || 1) : 1,
            type: typeEl ? typeEl.textContent.trim() : 'Unknown Type'
          };
        }, item);
        
        itemDetails.push(details);
        
        // Count haste potions
        if (details.name.toLowerCase().includes('haste') || 
            details.name.toLowerCase().includes('speed') || 
            details.name.toLowerCase().includes('agility')) {
          hasteCount += details.quantity;
        }
      }
      
      logger.info(`Found ${itemDetails.length} inventory items (${hasteCount} haste potions)`, accountId);
      
      // Update account with haste potion count
      accountManager.updateAccountStatus(accountId, {
        lastInventoryCheck: new Date(),
        inventoryChecksTotal: (accountManager.getAccount(accountId)?.inventoryChecksTotal || 0) + 1,
        profileData: {
          ...accountManager.getAccount(accountId)?.profileData,
          hasHastePotions: hasteCount
        },
        inventoryItems: itemDetails
      });
      
      return {
        success: true,
        items: itemDetails,
        hasteCount
      };
    } catch (error) {
      logger.error(`Inventory check error: ${error.message}`, accountId, error);
      return { success: false, reason: 'error', message: error.message };
    }
  }
  
  /**
   * Check for captcha during game tasks
   * @param {Object} page - Puppeteer page
   * @param {string} accountId - Account identifier
   * @returns {Promise<boolean>} - Whether captcha is present
   * @private
   */
  async _checkForCaptcha(page, accountId) {
    try {
      // Check if the page URL contains captcha-related paths
      const url = page.url();
      if (url.includes('captcha') || url.includes('anti-bot') || url.includes('verification')) {
        logger.warn(`Captcha detected in URL: ${url}`, accountId);
        return true;
      }
      
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
      
      // Check page content for captcha-related text
      const captchaText = await page.evaluate(() => {
        const bodyText = document.body.innerText.toLowerCase();
        return bodyText.includes('captcha') || 
               bodyText.includes('verification') || 
               bodyText.includes('prove you are human') ||
               bodyText.includes('prove you\'re human') ||
               bodyText.includes('bot detection') ||
               bodyText.includes('security check');
      });
      
      if (captchaText) {
        logger.warn('Captcha detected in page text', accountId);
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error(`Error checking for captcha: ${error.message}`, accountId);
      return false;
    }
  }
  
  /**
   * Handle game captcha
   * @param {Object} page - Puppeteer page
   * @param {string} accountId - Account identifier
   * @returns {Promise<boolean>} - Whether captcha was solved
   * @private
   */
  async _handleGameCaptcha(page, accountId) {
    return await captchaSolver.handleCaptcha(
      page,
      // Extract captcha function
      async (page) => {
        try {
          // First check if we're on a dedicated captcha page
          const isOnCaptchaPage = page.url().includes('anti-bot') || page.url().includes('captcha');
          
          // Check for image captcha (most common in this game)
          let captchaImageElements;
          
          if (isOnCaptchaPage) {
            // Handle the 4-image captcha specific to this game
            captchaImageElements = await page.$$('img[src*="captcha"], .captcha-image img');
            
            if (captchaImageElements && captchaImageElements.length === 4) {
              // This is the 4-image captcha case
              const imageBuffers = [];
              
              for (const imgElement of captchaImageElements) {
                const buffer = await imgElement.screenshot();
                imageBuffers.push(buffer);
              }
              
              // Combine the images
              const combinedImage = await antiDetection.combineImages(imageBuffers);
              
              return { type: 'image', data: combinedImage };
            }
          }
          
          // Check for standard single image captcha
          const standardCaptchaImg = await page.$('img[src*="captcha"]');
          if (standardCaptchaImg) {
            const imageBuffer = await standardCaptchaImg.screenshot();
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
          
          // Check for hCaptcha
          const hcaptchaElement = await page.$('.h-captcha');
          if (hcaptchaElement) {
            const siteKey = await page.evaluate(el => el.getAttribute('data-sitekey'), hcaptchaElement);
            return { 
              type: 'hcaptcha',
              siteKey,
              url: page.url()
            };
          }
          
          logger.warn('Unknown captcha type or no captcha found', accountId);
          return null;
        } catch (error) {
          logger.error(`Error extracting captcha: ${error.message}`, accountId);
          return null;
        }
      },
      // Submit captcha function
      async (page, solution) => {
        try {
          // For image captcha
          const captchaInput = await page.$('input[name="captcha"], #captcha, .captcha-input');
          if (captchaInput) {
            await humanInteraction.simulateTyping(page, captchaInput, solution, accountId);
            
            // Find and click submit button
            const submitButton = await page.$(
              'button[type="submit"], input[type="submit"], .submit-button, .captcha-submit, .verify-button'
            );
            
            if (submitButton) {
              await humanInteraction.simulateClick(page, submitButton, {}, accountId);
              
              // Wait for result
              await Promise.race([
                page.waitForNavigation({ timeout: 10000, waitUntil: 'domcontentloaded' }),
                page.waitForSelector('.success-message, .error-message', { timeout: 10000 })
              ]).catch(() => logger.warn('Captcha submission timeout', accountId));
              
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
              page.waitForSelector('.success-message, .error-message', { timeout: 10000 })
            ]).catch(() => logger.warn('reCAPTCHA submission timeout', accountId));
            
            return true;
          } else if (await page.$('.h-captcha')) {
            // Handle hCaptcha
            await page.evaluate((solution) => {
              window.hcaptcha.getResponse = () => solution;
              const form = document.querySelector('form');
              if (form) form.submit();
            }, solution);
            
            // Wait for result
            await Promise.race([
              page.waitForNavigation({ timeout: 10000, waitUntil: 'domcontentloaded' }),
              page.waitForSelector('.success-message, .error-message', { timeout: 10000 })
            ]).catch(() => logger.warn('hCaptcha submission timeout', accountId));
            
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
        // If we're no longer on a captcha/anti-bot page, consider it solved
        const currentUrl = page.url();
        if (!currentUrl.includes('captcha') && !currentUrl.includes('anti-bot')) {
          return true;
        }
        
        // Check for success messages
        const successElement = await page.$('.success-message, .captcha-success');
        if (successElement) {
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
        
        // Check if captcha elements are still present
        const stillHasCaptcha = await this._checkForCaptcha(page, accountId);
        return !stillHasCaptcha;
      },
      accountId
    );
  }
  
  /**
   * Use haste potions if needed
   * @param {Object} page - Puppeteer page
   * @param {string} accountId - Account identifier
   * @returns {Promise<boolean>} - Whether potions were used
   * @private
   */
  async _useHastePotionsIfNeeded(page, accountId) {
    try {
      // Check account for haste potion count
      const account = accountManager.getAccount(accountId);
      const hastePotionCount = account?.profileData?.hasHastePotions || 0;
      
      if (hastePotionCount < GAME.HASTE_POTIONS_PER_USE) {
        logger.info(`Not enough haste potions (${hastePotionCount}/${GAME.HASTE_POTIONS_PER_USE})`, accountId);
        return false;
      }
      
      // Look for potion button
      const potionButton = await page.$('.use-potion, .potion-button, button[data-action="use-potion"]');
      
      if (!potionButton) {
        logger.warn('Potion button not found', accountId);
        return false;
      }
      
      // Click potion button
      await humanInteraction.simulateClick(page, potionButton, {}, accountId);
      
      // Wait for potion menu if needed
      const potionMenu = await page.$('.potion-menu, .potion-list, .item-menu');
      
      if (potionMenu) {
        // Find haste potion in menu
        const hastePotionOption = await page.$('.haste-potion, .speed-potion, [data-item="haste-potion"]');
        
        if (hastePotionOption) {
          await humanInteraction.simulateClick(page, hastePotionOption, {}, accountId);
        } else {
          logger.warn('Haste potion option not found in menu', accountId);
          return false;
        }
      }
      
      // Check for confirmation dialog
      const confirmButton = await page.$('.confirm-button, .yes-button, button[data-action="confirm"]');
      
      if (confirmButton) {
        await humanInteraction.simulateClick(page, confirmButton, {}, accountId);
      }
      
      // Wait for potion effect
      await delay(randomInteger(1000, 3000));
      
      // Check for success message
      const successMessage = await page.$('.success-message, .potion-used');
      
      if (successMessage) {
        logger.info(`Used ${GAME.HASTE_POTIONS_PER_USE} haste potions successfully`, accountId);
        
        // Update account
        accountManager.updateAccountStatus(accountId, {
          lastPotionUse: new Date(),
          potionsUsed: (account?.potionsUsed || 0) + GAME.HASTE_POTIONS_PER_USE,
          profileData: {
            ...account?.profileData,
            hasHastePotions: hastePotionCount - GAME.HASTE_POTIONS_PER_USE
          }
        });
        
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error(`Error using haste potions: ${error.message}`, accountId);
      return false;
    }
  }
  
  /**
   * Complete a battle
   * @param {Object} page - Puppeteer page
   * @param {string} accountId - Account identifier
   * @returns {Promise<Object>} - Battle results
   * @private
   */
  async _completeBattle(page, accountId) {
    try {
      let battleComplete = false;
      let battleIterations = 0;
      let attacksPerformed = 0;
      const maxIterations = 20; // Safety limit
      
      logger.info('Starting battle sequence', accountId);
      
      while (!battleComplete && battleIterations < maxIterations) {
        battleIterations++;
        
        // Check for battle end
        const battleResultElement = await page.$('.battle-result, .victory-message, .defeat-message, .battle-over');
        
        if (battleResultElement) {
          battleComplete = true;
          const resultText = await page.evaluate(el => el.textContent.trim(), battleResultElement);
          const victory = resultText.toLowerCase().includes('victory') || 
                          resultText.toLowerCase().includes('won') || 
                          resultText.toLowerCase().includes('success');
          
          logger.info(`Battle complete: ${resultText}`, accountId);
          
          // Extract rewards if available
          let rewards = null;
          const rewardElement = await page.$('.battle-rewards, .rewards, .loot');
          
          if (rewardElement) {
            rewards = await page.evaluate(el => el.textContent.trim(), rewardElement);
            logger.info(`Battle rewards: ${rewards}`, accountId);
          }
          
          return {
            victory,
            result: resultText,
            rewards,
            attacksPerformed
          };
        }
        
        // Find attack button
        const attackButton = await page.$('.attack-button, .fight-button, button[data-action="attack"]');
        
        if (!attackButton) {
          logger.warn('Attack button not found during battle', accountId);
          await delay(randomInteger(1000, 3000));
          continue;
        }
        
        // Check if button is disabled
        const isDisabled = await page.evaluate(el => {
          return el.disabled || 
                 el.classList.contains('disabled') || 
                 el.getAttribute('disabled') === 'disabled';
        }, attackButton);
        
        if (isDisabled) {
          logger.debug('Attack button disabled, waiting...', accountId);
          await delay(randomInteger(1000, 3000));
          continue;
        }
        
        // Perform attack with human-like behavior
        await humanInteraction.simulateClick(page, attackButton, {}, accountId);
        attacksPerformed++;
        
        // Wait for attack animation and result
        await delay(normalDistributionDelay(2000, 1000));
        
        // Check for hit/miss message
        const hitMessage = await page.$('.hit-message, .attack-result, .damage-dealt');
        
        if (hitMessage) {
          const hitText = await page.evaluate(el => el.textContent.trim(), hitMessage);
          logger.debug(`Attack result: ${hitText}`, accountId);
        }
      }
      
      // If we reached max iterations without battle end
      if (!battleComplete) {
        logger.warn(`Battle did not complete after ${maxIterations} iterations`, accountId);
        return {
          victory: false,
          result: 'Battle timeout',
          attacksPerformed
        };
      }
      
      return {
        victory: false,
        result: 'Unknown',
        attacksPerformed
      };
    } catch (error) {
      logger.error(`Error completing battle: ${error.message}`, accountId);
      return {
        victory: false,
        result: `Error: ${error.message}`,
        attacksPerformed: 0
      };
    }
  }
}

module.exports = new GameTasks();
