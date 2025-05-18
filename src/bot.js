const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger');
const { delay, randomInteger, randomFloat, randomItem } = require('./utils/helpers');
const BrowserManager = require('./modules/browser-manager');
const AntiDetection = require('./modules/anti-detection');
const HumanInteraction = require('./modules/human-interaction');
const CaptchaSolver = require('./modules/captcha-solver');
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
        tasks: {
          completed: 0,
          failed: 0
        }
      });
      
      // Register browser with account
      browserManager.registerBrowser(browser, accountId);
      
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
      
      // Perform logout if needed
      if (session.page) {
        try {
          await authTasks.logout(session.page, accountId);
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
      const loginSuccess = await this.performLogin(accountId);
      if (!loginSuccess) {
        return { success: false, reason: 'login_failed' };
      }
    }
    
    try {
      const { page } = session;
      
      // Update session activity time
      session.lastActivity = new Date();
      this.activeSessions.set(accountId, session);
      
      // Randomize task sequence
      const taskSequence = this._generateRandomTaskSequence();
      logger.info(`Executing task sequence: ${taskSequence.join(' → ')}`, accountId);
      
      const results = {};
      
      // Execute each task
      for (const taskName of taskSequence) {
        // Add natural delay between tasks
        if (Object.keys(results).length > 0) {
          const taskDelay = randomInteger(
            TIMING.PAUSE.MIN_SECONDS * 1000, 
            TIMING.PAUSE.MAX_SECONDS * 1000
          );
          
          logger.info(`Waiting ${taskDelay/1000}s before next task...`, accountId);
          await delay(taskDelay);
        }
        
        // Add random behavior before each task
        await antiDetection.addRandomBehavior(page, accountId);
        
        switch (taskName) {
          case 'pvp':
            results.pvp = await gameTasks.performPvpBattle(page, accountId);
            break;
            
          case 'temple':
            results.temple = await gameTasks.performTempleTask(page, accountId);
            break;
            
          case 'job':
            results.job = await gameTasks.performJobTask(page, accountId);
            break;
            
          case 'market':
            results.market = await gameTasks.checkMarket(page, accountId);
            break;
            
          case 'inventory':
            results.inventory = await gameTasks.checkInventory(page, accountId);
            break;
            
          case 'profile':
            results.profile = await authTasks.checkProfile(page, accountId);
            break;
        }
        
        // Add human-like browsing behavior
        const shouldBrowse = Math.random() < 0.3; // 30% chance
        if (shouldBrowse) {
          const browseTime = randomInteger(10000, 30000);
          logger.info(`Performing random browsing for ${browseTime/1000}s`, accountId);
          await humanInteraction.simulateBrowsing(page, browseTime, accountId);
        }
      }
      
      // Update session task stats
      session.tasks.completed++;
      this.activeSessions.set(accountId, session);
      
      logger.info(`Task sequence completed for account ${accountId}`, accountId);
      return { success: true, results };
    } catch (error) {
      logger.error(`Error during task sequence for account ${accountId}: ${error.message}`, accountId, error);
      
      // Update session task stats
      session.tasks.failed++;
      this.activeSessions.set(accountId, session);
      
      return { success: false, reason: 'task_error', error: error.message };
    }
  }
  
  /**
   * Run the bot for multiple accounts
   * @param {Array<Object>} accounts - Array of account objects
   * @param {Object} options - Run options
   * @returns {Promise<void>}
   */
  async run(accounts, options = {}) {
    try {
      const defaultOptions = {
        maxConcurrentSessions: 1,
        maxSessionDuration: 3600, // 1 hour in seconds
        randomizeLogout: true,
        taskSequences: 3
      };
      
      const runOptions = { ...defaultOptions, ...options };
      
      logger.info(`Starting bot run with ${accounts.length} accounts (max concurrent: ${runOptions.maxConcurrentSessions})`);
      
      // Queue accounts for processing
      for (const account of accounts) {
        this.queueTask({
          type: 'process_account',
          data: {
            account,
            options: runOptions
          }
        });
      }
      
      // Start processing queue if not already running
      if (!this.isProcessingQueue) {
        this._processTaskQueue();
      }
    } catch (error) {
      logger.error(`Error during bot run: ${error.message}`, null, error);
    }
  }
  
  /**
   * Queue a task for processing
   * @param {Object} task - Task object
   */
  queueTask(task) {
    this.taskQueue.push({
      ...task,
      queuedAt: new Date()
    });
    
    logger.debug(`Task queued: ${task.type} (queue size: ${this.taskQueue.length})`);
  }
  
  /**
   * Process the task queue
   * @private
   */
  async _processTaskQueue() {
    if (this.isProcessingQueue) return;
    
    this.isProcessingQueue = true;
    logger.debug('Started processing task queue');
    
    try {
      while (this.taskQueue.length > 0) {
        const task = this.taskQueue.shift();
        await this._executeTask(task);
      }
    } catch (error) {
      logger.error(`Error processing task queue: ${error.message}`, null, error);
    } finally {
      this.isProcessingQueue = false;
      logger.debug('Finished processing task queue');
      
      // If new tasks were added while processing, start again
      if (this.taskQueue.length > 0) {
        this._processTaskQueue();
      }
    }
  }
  
  /**
   * Execute a task
   * @param {Object} task - Task object
   * @private
   */
  async _executeTask(task) {
    try {
      switch (task.type) {
        case 'process_account':
          await this._processAccount(task.data.account, task.data.options);
          break;
          
        case 'end_session':
          await this.endSession(task.data.accountId);
          break;
          
        default:
          logger.warn(`Unknown task type: ${task.type}`);
      }
    } catch (error) {
      logger.error(`Error executing task ${task.type}: ${error.message}`, null, error);
    }
  }
  
  /**
   * Process an account (internal implementation)
   * @param {Object} account - Account object
   * @param {Object} options - Processing options
   * @private
   */
  async _processAccount(account, options) {
    const accountId = account.id;
    
    try {
      // Check if we can start a new session (concurrent limit)
      if (this.activeSessions.size >= options.maxConcurrentSessions) {
        logger.info(`Maximum concurrent sessions reached, requeueing account ${accountId}`);
        
        // Requeue the task for later
        this.queueTask({
          type: 'process_account',
          data: { account, options }
        });
        
        // Wait before processing more tasks to prevent CPU spinning
        await delay(5000);
        return;
      }
      
      // Start session
      const sessionStarted = await this.startSession(account);
      
      if (!sessionStarted) {
        logger.error(`Failed to start session for account ${accountId}`, accountId);
        return;
      }
      
      // Login
      const loginSuccess = await this.performLogin(accountId);
      
      if (!loginSuccess) {
        logger.error(`Login failed for account ${accountId}, ending session`, accountId);
        await this.endSession(accountId);
        return;
      }
      
      // Calculate session duration
      let sessionDuration;
      if (options.randomizeLogout) {
        sessionDuration = randomInteger(
          TIMING.LOGOUT_INTERVAL.MIN_SECONDS,
          TIMING.LOGOUT_INTERVAL.MAX_SECONDS
        );
      } else {
        sessionDuration = options.maxSessionDuration;
      }
      
      logger.info(`Session will run for ${Math.round(sessionDuration/60)} minutes for account ${accountId}`, accountId);
      
      // Schedule session end
      const sessionEndTime = Date.now() + (sessionDuration * 1000);
      
      // Execute task sequences
      let sequencesCompleted = 0;
      
      while (Date.now() < sessionEndTime && sequencesCompleted < options.taskSequences) {
        // Execute a task sequence
        const result = await this.executeTaskSequence(accountId);
        
        if (result.success) {
          sequencesCompleted++;
          logger.info(`Completed task sequence ${sequencesCompleted}/${options.taskSequences} for account ${accountId}`, accountId);
          
          // Add pause between sequences
          if (sequencesCompleted < options.taskSequences && Date.now() < sessionEndTime) {
            const pauseDuration = randomInteger(
              TIMING.PAUSE.INTERVAL_MIN_SECONDS * 1000,
              TIMING.PAUSE.INTERVAL_MAX_SECONDS * 1000
            );
            
            logger.info(`Pausing for ${Math.round(pauseDuration/1000)} seconds before next sequence`, accountId);
            await delay(pauseDuration);
          }
        } else {
          logger.warn(`Task sequence failed for account ${accountId}: ${result.reason}`, accountId);
          
          // If login failed, end session immediately
          if (result.reason === 'login_failed') {
            break;
          }
          
          // Add shorter pause after failure
          await delay(randomInteger(30000, 60000));
        }
      }
      
      // End session
      logger.info(`Ending session for account ${accountId} after ${sequencesCompleted} task sequences`, accountId);
      await this.endSession(accountId);
    } catch (error) {
      logger.error(`Error processing account ${accountId}: ${error.message}`, accountId, error);
      
      // Make sure to end session in case of error
      if (this.activeSessions.has(accountId)) {
        await this.endSession(accountId);
      }
    }
  }
  
  /**
   * Generate a random task sequence
   * @returns {Array<string>} - Array of task names
   * @private
   */
  _generateRandomTaskSequence() {
    const allTasks = ['pvp', 'temple', 'job', 'market', 'inventory', 'profile'];
    const shuffledTasks = [...allTasks].sort(() => Math.random() - 0.5);
    
    // Always include profile check
    if (!shuffledTasks.includes('profile')) {
      shuffledTasks.push('profile');
    }
    
    // Limit sequence length (3-5 tasks)
    const sequenceLength = Math.floor(Math.random() * 3) + 3; // 3 to 5
    return shuffledTasks.slice(0, sequenceLength);
  }
  
  /**
   * Reset cookies for all sessions periodically
   * @param {number} interval - Interval in milliseconds
   */
  startCookieResetTimer(interval = 3600000) { // Default 1 hour
    setInterval(() => {
      for (const [accountId, session] of this.activeSessions.entries()) {
        if (Math.random() < 0.3) { // 30% chance for each session
          logger.info(`Scheduling cookie reset for account ${accountId}`, accountId);
          
          // Schedule cookie reset task
          this.queueTask({
            type: 'cookie_reset',
            data: { accountId }
          });
        }
      }
    }, interval);
  }
  
  /**
   * Cleanup and shutdown
   */
  async shutdown() {
    logger.info('Bot shutdown initiated');
    
    try {
      // End all active sessions
      await this.endAllSessions();
      
      logger.info('Bot shutdown completed');
    } catch (error) {
      logger.error(`Error during shutdown: ${error.message}`, null, error);
    }
  }
}

module.exports = new Bot();
