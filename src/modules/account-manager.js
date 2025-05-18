const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { PATHS } = require('../config');

/**
 * Manages account data and operations
 */
class AccountManager {
  constructor() {
    this.accounts = [];
    this.accountStatuses = new Map(); // accountId -> status object
  }

  /**
   * Initialize the account manager
   */
  initialize() {
    this.loadAccounts();
  }

  /**
   * Load accounts from file
   */
  loadAccounts() {
    try {
      // Ensure accounts directory exists
      if (!fs.existsSync(PATHS.ACCOUNTS_DIR)) {
        fs.mkdirSync(PATHS.ACCOUNTS_DIR, { recursive: true });
      }
      
      // Check for accounts.json file
      const accountsPath = path.join(PATHS.ACCOUNTS_DIR, 'accounts.json');
      
      if (!fs.existsSync(accountsPath)) {
        logger.warn(`Accounts file not found: ${accountsPath}`);
        return;
      }
      
      // Read and parse accounts file
      const accountsData = fs.readFileSync(accountsPath, 'utf8');
      const accounts = JSON.parse(accountsData);
      
      if (!Array.isArray(accounts)) {
        logger.error('Invalid accounts file format');
        return;
      }
      
      this.accounts = accounts.map(account => ({
        ...account,
        id: account.id || account.username,
      }));
      
      logger.info(`Loaded ${this.accounts.length} accounts`);
    } catch (error) {
      logger.error(`Error loading accounts: ${error.message}`, null, error);
    }
  }

  /**
   * Save accounts to file
   */
  saveAccounts() {
    try {
      // Ensure accounts directory exists
      if (!fs.existsSync(PATHS.ACCOUNTS_DIR)) {
        fs.mkdirSync(PATHS.ACCOUNTS_DIR, { recursive: true });
      }
      
      // Write accounts to file
      const accountsPath = path.join(PATHS.ACCOUNTS_DIR, 'accounts.json');
      fs.writeFileSync(accountsPath, JSON.stringify(this.accounts, null, 2));
      
      logger.info(`Saved ${this.accounts.length} accounts to ${accountsPath}`);
    } catch (error) {
      logger.error(`Error saving accounts: ${error.message}`, null, error);
    }
  }

  /**
   * Get all accounts
   * @returns {Array} - Array of account objects
   */
  getAllAccounts() {
    return [...this.accounts];
  }

  /**
   * Get account by ID
   * @param {string} accountId - Account identifier
   * @returns {Object|null} - Account object or null if not found
   */
  getAccount(accountId) {
    return this.accounts.find(account => account.id === accountId) || null;
  }

  /**
   * Add or update an account
   * @param {Object} accountData - Account data
   * @returns {Object} - Updated account object
   */
  updateAccount(accountData) {
    if (!accountData.id && !accountData.username) {
      throw new Error('Account must have an ID or username');
    }
    
    const accountId = accountData.id || accountData.username;
    const existingIndex = this.accounts.findIndex(account => account.id === accountId);
    
    if (existingIndex >= 0) {
      // Update existing account
      this.accounts[existingIndex] = {
        ...this.accounts[existingIndex],
        ...accountData,
        id: accountId
      };
      
      logger.info(`Updated account ${accountId}`);
      return this.accounts[existingIndex];
    } else {
      // Add new account
      const newAccount = {
        ...accountData,
        id: accountId
      };
      
      this.accounts.push(newAccount);
      logger.info(`Added new account ${accountId}`);
      return newAccount;
    }
  }

  /**
   * Remove an account
   * @param {string} accountId - Account identifier
   * @returns {boolean} - Whether the account was removed
   */
  removeAccount(accountId) {
    const initialLength = this.accounts.length;
    this.accounts = this.accounts.filter(account => account.id !== accountId);
    
    if (this.accounts.length < initialLength) {
      logger.info(`Removed account ${accountId}`);
      return true;
    }
    
    logger.warn(`Account ${accountId} not found, nothing removed`);
    return false;
  }

  /**
   * Update account status
   * @param {string} accountId - Account identifier
   * @param {Object} statusUpdate - Status data to update
   * @returns {Object|null} - Updated account object or null if not found
   */
  updateAccountStatus(accountId, statusUpdate) {
    const account = this.getAccount(accountId);
    if (!account) {
      logger.warn(`Account ${accountId} not found, status not updated`);
      return null;
    }
    
    const currentStatus = this.accountStatuses.get(accountId) || {};
    const updatedStatus = {
      ...currentStatus,
      ...statusUpdate,
      lastUpdated: new Date()
    };
    
    this.accountStatuses.set(accountId, updatedStatus);
    
    return {
      ...account,
      status: updatedStatus
    };
  }

  /**
   * Record login event for account
   * @param {string} accountId - Account identifier
   * @param {boolean} success - Whether login was successful
   * @param {string} [failReason] - Reason for login failure
   */
  recordLogin(accountId, success, failReason = null) {
    const currentStatus = this.accountStatuses.get(accountId) || {};
    const loginAttempts = currentStatus.loginAttempts || [];
    
    loginAttempts.push({
      timestamp: new Date(),
      success,
      failReason
    });
    
    // Keep only the last 10 login attempts
    const recentLoginAttempts = loginAttempts.slice(-10);
    
    this.updateAccountStatus(accountId, {
      lastLoginAttempt: new Date(),
      lastLoginSuccess: success ? new Date() : currentStatus.lastLoginSuccess,
      loginAttempts: recentLoginAttempts,
      consecutiveFailures: success ? 0 : (currentStatus.consecutiveFailures || 0) + 1
    });
    
    if (success) {
      logger.info(`Login recorded as successful for account ${accountId}`);
    } else {
      logger.warn(`Login recorded as failed for account ${accountId}: ${failReason}`);
      
      // Check for too many failures
      const consecutiveFailures = this.accountStatuses.get(accountId).consecutiveFailures;
      if (consecutiveFailures >= 5) {
        logger.error(`Account ${accountId} has ${consecutiveFailures} consecutive login failures`);
      }
    }
  }

  /**
   * Record logout event for account
   * @param {string} accountId - Account identifier
   */
  recordLogout(accountId) {
    this.updateAccountStatus(accountId, {
      lastLogout: new Date()
    });
    
    logger.info(`Logout recorded for account ${accountId}`);
  }

  /**
   * Get accounts eligible for login (not locked out)
   * @returns {Array} - Array of eligible account objects
   */
  getEligibleAccounts() {
    return this.accounts.filter(account => {
      const status = this.accountStatuses.get(account.id);
      
      // If no status, account is eligible
      if (!status) return true;
      
      // Check for lockout
      if (status.lockedUntil && new Date() < new Date(status.lockedUntil)) {
        return false;
      }
      
      // Check for too many consecutive failures
      if (status.consecutiveFailures >= 5) {
        return false;
      }
      
      return true;
    });
  }

  /**
   * Set captcha lockout for an account
   * @param {string} accountId - Account identifier
   * @param {number} minutes - Lockout duration in minutes
   */
  setCaptchaLockout(accountId, minutes) {
    const lockedUntil = new Date(Date.now() + minutes * 60 * 1000);
    
    this.updateAccountStatus(accountId, {
      lockedUntil,
      lockReason: 'captcha_failures'
    });
    
    logger.warn(`Account ${accountId} locked out until ${lockedUntil.toISOString()} due to captcha failures`);
  }

  /**
   * Record captcha encounter for an account
   * @param {string} accountId - Account identifier
   * @param {boolean} solved - Whether captcha was solved successfully
   */
  recordCaptchaEncounter(accountId, solved) {
    const currentStatus = this.accountStatuses.get(accountId) || {};
    const captchaEncounters = currentStatus.captchaEncounters || [];
    
    captchaEncounters.push({
      timestamp: new Date(),
      solved
    });
    
    // Keep only the last 20 captcha encounters
    const recentCaptchaEncounters = captchaEncounters.slice(-20);
    
    // Calculate captcha encounter rate (last 10 visits)
    const captchaRate = this._calculateCaptchaRate(accountId, recentCaptchaEncounters);
    
    this.updateAccountStatus(accountId, {
      lastCaptchaEncounter: new Date(),
      captchaEncounters: recentCaptchaEncounters,
      captchaRate
    });
    
    if (solved) {
      logger.info(`Captcha solved successfully for account ${accountId}`);
    } else {
      logger.warn(`Captcha failed for account ${accountId}`);
    }
  }
  
  /**
   * Calculate captcha encounter rate for an account
   * @param {string} accountId - Account identifier
   * @param {Array} encounters - Captcha encounters
   * @returns {number} - Captcha encounter rate (0 to 1)
   * @private
   */
  _calculateCaptchaRate(accountId, encounters) {
    if (!encounters || encounters.length === 0) return 0;
    
    const lastTen = encounters.slice(-10);
    const encounterCount = lastTen.length;
    
    return encounterCount / 10; // Normalized to 0-1 range
  }
}

module.exports = AccountManager;