const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger');
const { delay, randomInteger, randomFloat, randomItem } = require('./utils/helpers');
const BrowserManager = require('./modules/browser-manager');
const AntiDetection = require('./modules/anti-detection');
const HumanInteraction = require('./modules/human-interaction');
const CaptchaSolver = require('./modules/captcha-solver-simplified');
const AccountManager = require('./modules/account-manager');
const authTasks = require('./tasks/auth-tasks');
const gameTasks = require('./tasks/game-tasks');
const { TIMING, FINGERPRINT, RETRY, PATHS } = require('./config');

// Initialize puppeteer with stealth plugin
puppeteer.use(StealthPlugin());

/**
 * Main bot class for controlling the automation workflow
 */
class Bot {
  constructor() {
    this.activeSessions = new Map();
    this.taskQueue = [];
    this.isProcessingQueue = false;
    
    // Instanciar os gerenciadores
    this.browserManager = new BrowserManager();
    this.antiDetection = new AntiDetection();
    this.humanInteraction = new HumanInteraction();
    this.captchaSolver = new CaptchaSolver();
    this.accountManager = new AccountManager();
  }
  
  /**
   * Initialize the bot
   */
  async initialize() {
    try {
      logger.info('Initializing bot...');
      
      // Create necessary directories
      const requiredDirs = [
        'browser-data',
        'logs',
        PATHS.ACCOUNTS_DIR,
        'captcha-images'
      ];
      
      for (const dir of requiredDirs) {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
          logger.info(`Created directory: ${dir}`);
        }
      }
      
      logger.info('Bot initialized successfully');
    } catch (error) {
      logger.error(`Bot initialization error: ${error.message}`, null, error);
      throw error;
    }
  }
  
  /**
   * Start a session for an account
   * @param {Object} account - Account object with id, username, password
   * @returns {Promise<boolean>} - Whether session was started successfully
   */
  async startSession(account) {
    if (!account || !account.id || !account.username || !account.password) {
      logger.error('Invalid account data provided');
      return false;
    }
    
    const accountId = account.id;
    
    // Check if session already exists
    if (this.activeSessions.has(accountId)) {
      logger.warn(`Session already exists for account ${accountId}`, accountId);
      return false;
    }
    
    try {
      logger.info(`Starting session for account ${accountId}`, accountId);
      
      // Select random fingerprint values
      const userAgent = randomItem(FINGERPRINT.USER_AGENTS);
      const resolution = randomItem(FINGERPRINT.RESOLUTIONS);
      
      // Launch browser with random properties
      const browser = await this.browserManager.launchBrowser({
        headless: 'new',
        args: [
          `--user-agent=${userAgent}`,
          `--window-size=${resolution.width},${resolution.height}`
        ],
        userDataDir: path.join('browser-data', accountId)
      });
      
      // Create page with enhanced capabilities
      const page = await this.browserManager.createPage(browser, accountId);
      
      // Apply anti-detection measures
      await this.antiDetection.applyAllMeasures(page, accountId);
      
      // Store session data
      this.activeSessions.set(accountId, {
        browser,
        page,
        account,
        startTime: new Date(),
        lastActivity: new Date(),
        loggedIn: false
      });
      
      logger.info(`Session started for account ${accountId}`, accountId);
      return true;
    } catch (error) {
      logger.error(`Failed to start session for account ${accountId}: ${error.message}`, accountId, error);
      return false;
    }
  }
  
  /**
   * End a session for an account
   * @param {string} accountId - Account identifier
   * @returns {Promise<boolean>} - Whether session was ended successfully
   */
  async endSession(accountId) {
    if (!this.activeSessions.has(accountId)) {
      logger.warn(`No active session found for account ${accountId}`, accountId);
      return false;
    }
    
    try {
      const session = this.activeSessions.get(accountId);
      
      // Perform logout if logged in
      if (session.loggedIn) {
        try {
          logger.info(`Logging out account ${accountId}`, accountId);
          await authTasks.performLogout(session.page, accountId);
        } catch (error) {
          logger.warn(`Error during logout: ${error.message}`, accountId);
        }
      }
      
      // Close browser
      if (session.browser) {
        await this.browserManager.closeBrowser(accountId);
      }
      
      // Remove session
      this.activeSessions.delete(accountId);
      
      logger.info(`Session ended for account ${accountId}`, accountId);
      return true;
    } catch (error) {
      logger.error(`Error ending session for account ${accountId}: ${error.message}`, accountId, error);
      
      // Force close browser in case of error
      try {
        await this.browserManager.closeBrowser(accountId);
      } catch (e) {
        logger.error(`Error force closing browser: ${e.message}`, accountId);
      }
      
      // Remove session regardless of errors
      this.activeSessions.delete(accountId);
      return false;
    }
  }
  
  /**
   * End all active sessions
   */
  async endAllSessions() {
    logger.info(`Ending all ${this.activeSessions.size} active sessions`);
    
    const promises = [];
    for (const accountId of this.activeSessions.keys()) {
      promises.push(this.endSession(accountId));
    }
    
    await Promise.all(promises);
    logger.info('All sessions ended');
  }
  
  /**
   * Perform login for an account
   * @param {string} accountId - Account identifier
   * @returns {Promise<boolean>} - Whether login was successful
   */
  async performLogin(accountId) {
    if (!this.activeSessions.has(accountId)) {
      logger.error(`No active session found for account ${accountId}`, accountId);
      return false;
    }
    
    try {
      const session = this.activeSessions.get(accountId);
      const { page, account } = session;
      
      // Perform login with cookie persistence
      const loginSuccess = await authTasks.loginWithCookiePersistence(
        page,
        account.username,
        account.password,
        accountId
      );
      
      if (loginSuccess) {
        // Update session data
        session.lastActivity = new Date();
        session.loggedIn = true;
        this.activeSessions.set(accountId, session);
        
        // Check profile data
        await authTasks.checkProfile(page, accountId);
        
        logger.info(`Successfully logged in for account ${accountId}`, accountId);
        return true;
      } else {
        logger.error(`Login failed for account ${accountId}`, accountId);
        return false;
      }
    } catch (error) {
      logger.error(`Error during login for account ${accountId}: ${error.message}`, accountId, error);
      return false;
    }
  }
  
  /**
   * Execute a task sequence for an account
   * @param {string} accountId - Account identifier
   * @returns {Promise<Object>} - Task results
   */
  async executeTaskSequence(accountId) {
    if (!this.activeSessions.has(accountId)) {
      return { success: false, reason: 'no_active_session' };
    }
    
    const session = this.activeSessions.get(accountId);
    
    if (!session.loggedIn) {
      // Try to login first
      const loginSuccess = await this.performLogin(accountId);
      if (!loginSuccess) {
        return { success: false, reason: 'login_failed' };
      }
    }
    
    try {
      const { page } = session;
      
      // Generate a task sequence
      const tasks = this._generateRandomTaskSequence();
      logger.info(`Executing task sequence for account ${accountId}: ${tasks.join(', ')}`, accountId);
      
      const results = {
        success: true,
        completedTasks: [],
        failedTasks: [],
        rewards: {
          xp: 0,
          currency: 0,
          items: []
        }
      };
      
      // Execute each task in sequence
      for (const task of tasks) {
        try {
          logger.info(`Executing task ${task} for account ${accountId}`, accountId);
          const taskResult = await gameTasks[task](page, accountId);
          
          if (taskResult.success) {
            results.completedTasks.push(task);
            
            // Accumulate rewards
            if (taskResult.rewards) {
              results.rewards.xp += taskResult.rewards.xp || 0;
              results.rewards.currency += taskResult.rewards.currency || 0;
              if (taskResult.rewards.items && taskResult.rewards.items.length > 0) {
                results.rewards.items = [...results.rewards.items, ...taskResult.rewards.items];
              }
            }
            
            logger.info(`Task ${task} completed successfully for account ${accountId}`, accountId);
          } else {
            results.failedTasks.push(task);
            logger.warn(`Task ${task} failed for account ${accountId}: ${taskResult.reason}`, accountId);
          }
          
          // Random delay between tasks
          await delay(randomInteger(TIMING.MIN_TASK_DELAY, TIMING.MAX_TASK_DELAY));
        } catch (taskError) {
          results.failedTasks.push(task);
          logger.error(`Error executing task ${task} for account ${accountId}: ${taskError.message}`, accountId, taskError);
        }
      }
      
      // Update session last activity
      session.lastActivity = new Date();
      this.activeSessions.set(accountId, session);
      
      logger.info(`Task sequence completed for account ${accountId}: ${results.completedTasks.length} succeeded, ${results.failedTasks.length} failed`, accountId);
      return results;
    } catch (error) {
      logger.error(`Error executing task sequence for account ${accountId}: ${error.message}`, accountId, error);
      return { success: false, reason: 'error', error: error.message };
    }
  }
  
  /**
   * Run the bot for multiple accounts
   * @param {Array<Object>} accounts - Array of account objects
   * @param {Object} options - Run options
   * @returns {Promise<void>}
   */
  async run(accounts, options = {}) {
    if (!Array.isArray(accounts) || accounts.length === 0) {
      logger.error('No accounts provided for bot run');
      return;
    }
    
    const maxConcurrent = options.maxConcurrent || 1;
    logger.info(`Starting bot run with ${accounts.length} accounts (max concurrent: ${maxConcurrent})`);
    
    // Clear the task queue
    this.taskQueue = [];
    
    // Add each account to the task queue
    for (const account of accounts) {
      this.queueTask({
        type: 'process_account',
        account,
        options
      });
    }
    
    // Start processing the queue
    this._processTaskQueue(maxConcurrent);
    
    logger.info(`Bot running with ${accounts.length} accounts`);
  }
  
  /**
   * Queue a task for processing
   * @param {Object} task - Task object
   */
  queueTask(task) {
    this.taskQueue.push(task);
    logger.debug(`Task queued: ${task.type}`);
    
    // Start processing if not already processing
    if (!this.isProcessingQueue) {
      this._processTaskQueue();
    }
  }
  
  /**
   * Process the task queue
   * @param {number} maxConcurrent - Maximum number of concurrent tasks
   * @private
   */
  async _processTaskQueue(maxConcurrent = 1) {
    if (this.isProcessingQueue) {
      return;
    }
    
    this.isProcessingQueue = true;
    logger.debug(`Processing task queue: ${this.taskQueue.length} tasks`);
    
    try {
      // Keep processing tasks until the queue is empty
      while (this.taskQueue.length > 0) {
        // Get the current number of active sessions
        const activeSessions = this.activeSessions.size;
        
        // Check if we can process more tasks
        if (activeSessions < maxConcurrent) {
          // Get the next task
          const task = this.taskQueue.shift();
          
          // Execute the task in the background
          this._executeTask(task).catch(error => {
            logger.error(`Error executing task ${task.type}: ${error.message}`, null, error);
          });
        } else {
          // Wait for some sessions to complete
          await delay(1000);
        }
      }
      
      logger.debug('Task queue processing completed');
    } catch (error) {
      logger.error(`Error processing task queue: ${error.message}`, null, error);
    } finally {
      this.isProcessingQueue = false;
    }
  }
  
  /**
   * Execute a task
   * @param {Object} task - Task object
   * @private
   */
  async _executeTask(task) {
    logger.debug(`Executing task: ${task.type}`);
    
    switch (task.type) {
      case 'process_account':
        await this._processAccount(task.account, task.options);
        break;
      case 'end_session':
        await this.endSession(task.accountId);
        break;
      default:
        logger.warn(`Unknown task type: ${task.type}`);
    }
  }
  
  /**
   * Process an account (internal implementation)
   * @param {Object} account - Account object
   * @param {Object} options - Processing options
   * @private
   */
  async _processAccount(account, options = {}) {
    const accountId = account.id;
    logger.info(`Processing account ${accountId}`, accountId);
    
    try {
      // Start session
      const sessionSuccess = await this.startSession(account);
      if (!sessionSuccess) {
        logger.error(`Failed to start session for account ${accountId}`, accountId);
        return;
      }
      
      // Perform login
      const loginSuccess = await this.performLogin(accountId);
      if (!loginSuccess) {
        logger.error(`Failed to login for account ${accountId}`, accountId);
        await this.endSession(accountId);
        return;
      }
      
      // Execute task sequence
      const taskResults = await this.executeTaskSequence(accountId);
      
      // If random ending is enabled, randomly decide whether to end the session
      if (options.randomEnding && Math.random() < 0.5) {
        logger.info(`Randomly ending session for account ${accountId}`, accountId);
        await this.endSession(accountId);
      } else if (!options.keepSessionsAlive) {
        // End session if not keeping sessions alive
        await this.endSession(accountId);
      }
      
      // Schedule next run if interval is specified
      if (options.runInterval && options.runInterval > 0) {
        const nextRunDelay = randomInteger(
          options.runInterval * 0.8,
          options.runInterval * 1.2
        );
        
        logger.info(`Scheduling next run for account ${accountId} in ${Math.round(nextRunDelay / 1000)} seconds`, accountId);
        
        setTimeout(() => {
          this.queueTask({
            type: 'process_account',
            account,
            options
          });
        }, nextRunDelay);
      }
    } catch (error) {
      logger.error(`Error processing account ${accountId}: ${error.message}`, accountId, error);
      
      // End session in case of error
      await this.endSession(accountId).catch(() => {});
    }
  }
  
  /**
   * Generate a random task sequence
   * @returns {Array<string>} - Array of task names
   * @private
   */
  _generateRandomTaskSequence() {
    // Available tasks
    const availableTasks = [
      'collectDailyReward',
      'checkActivity',
      'trainSkills',
      'completeQuests',
      'gatherResources',
      'craftItems',
      'participateEvent'
    ];
    
    // Select a random number of tasks (2-4)
    const numTasks = randomInteger(2, 4);
    
    // Randomly select tasks
    const selectedTasks = [];
    while (selectedTasks.length < numTasks && availableTasks.length > 0) {
      const randomIndex = randomInteger(0, availableTasks.length - 1);
      const task = availableTasks.splice(randomIndex, 1)[0];
      selectedTasks.push(task);
    }
    
    return selectedTasks;
  }
  
  /**
   * Reset cookies for all sessions periodically
   * @param {number} interval - Interval in milliseconds
   */
  startCookieResetTimer(interval = 3600000) { // Default 1 hour
    setInterval(async () => {
      logger.info('Periodic cookie reset triggered');
      
      for (const [accountId, session] of this.activeSessions.entries()) {
        try {
          // Use try-catch for each account to prevent one failure affecting others
          try {
            if (session.page) {
              await session.page.deleteCookie();
              logger.info(`Cookies reset for account ${accountId}`, accountId);
            }
          } catch (error) {
            logger.error(`Error resetting cookies for account ${accountId}: ${error.message}`, accountId, error);
          }
        } catch (error) {
          logger.error(`Error in cookie reset timer for account ${accountId}`, accountId, error);
        }
      }
    }, interval);
    
    logger.info(`Cookie reset timer started with interval of ${interval / 1000} seconds`);
  }
  
  /**
   * Cleanup and shutdown
   */
  async shutdown() {
    logger.info('Bot shutting down...');
    
    // End all active sessions
    await this.endAllSessions();
    
    logger.info('Bot shutdown complete');
  }
}

module.exports = Bot;