const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { PATHS } = require('../config');

/**
 * Manages account data and operations
 */
class AccountManager {
  constructor() {
    this.accounts = new Map();
    this.accountsFilePath = path.join(PATHS.ACCOUNTS_DIR, PATHS.ACCOUNTS_FILE);
    this.initialize();
  }
  
  /**
   * Initialize the account manager
   */
  initialize() {
    try {
      // Create accounts directory if it doesn't exist
      if (!fs.existsSync(PATHS.ACCOUNTS_DIR)) {
        fs.mkdirSync(PATHS.ACCOUNTS_DIR, { recursive: true });
        logger.info(`Created accounts directory: ${PATHS.ACCOUNTS_DIR}`);
      }
      
      // Load accounts data if file exists
      if (fs.existsSync(this.accountsFilePath)) {
        this.loadAccounts();
      } else {
        logger.info(`No accounts file found at ${this.accountsFilePath}`);
      }
    } catch (error) {
      logger.error(`Failed to initialize account manager: ${error.message}`, null, error);
    }
  }
  
  /**
   * Load accounts from file
   */
  loadAccounts() {
    try {
      const accountsData = JSON.parse(fs.readFileSync(this.accountsFilePath, 'utf8'));
      
      this.accounts.clear();
      for (const account of accountsData) {
        this.accounts.set(account.id, {
          ...account,
          lastLogin: account.lastLogin ? new Date(account.lastLogin) : null,
          lastLogout: account.lastLogout ? new Date(account.lastLogout) : null,
          lastActivity: account.lastActivity ? new Date(account.lastActivity) : null,
          captchaLockoutUntil: account.captchaLockoutUntil ? new Date(account.captchaLockoutUntil) : null
        });
      }
      
      logger.info(`Loaded ${this.accounts.size} accounts from ${this.accountsFilePath}`);
    } catch (error) {
      logger.error(`Failed to load accounts: ${error.message}`, null, error);
    }
  }
  
  /**
   * Save accounts to file
   */
  saveAccounts() {
    try {
      const accountsData = Array.from(this.accounts.values());
      fs.writeFileSync(this.accountsFilePath, JSON.stringify(accountsData, null, 2));
      logger.info(`Saved ${accountsData.length} accounts to ${this.accountsFilePath}`);
    } catch (error) {
      logger.error(`Failed to save accounts: ${error.message}`, null, error);
    }
  }
  
  /**
   * Get all accounts
   * @returns {Array} - Array of account objects
   */
  getAllAccounts() {
    return Array.from(this.accounts.values());
  }
  
  /**
   * Get account by ID
   * @param {string} accountId - Account identifier
   * @returns {Object|null} - Account object or null if not found
   */
  getAccount(accountId) {
    return this.accounts.get(accountId) || null;
  }
  
  /**
   * Add or update an account
   * @param {Object} accountData - Account data
   * @returns {Object} - Updated account object
   */
  updateAccount(accountData) {
    // Ensure the account has an ID
    if (!accountData.id) {
      throw new Error('Account data must include an id field');
    }
    
    // Merge with existing account data if it exists
    const existingAccount = this.accounts.get(accountData.id) || {};
    const updatedAccount = {
      ...existingAccount,
      ...accountData,
      lastUpdated: new Date()
    };
    
    this.accounts.set(accountData.id, updatedAccount);
    this.saveAccounts();
    
    logger.info(`Updated account: ${accountData.id}`);
    return updatedAccount;
  }
  
  /**
   * Remove an account
   * @param {string} accountId - Account identifier
   * @returns {boolean} - Whether the account was removed
   */
  removeAccount(accountId) {
    const wasRemoved = this.accounts.delete(accountId);
    
    if (wasRemoved) {
      this.saveAccounts();
      logger.info(`Removed account: ${accountId}`);
    } else {
      logger.warn(`Failed to remove account (not found): ${accountId}`);
    }
    
    return wasRemoved;
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
      logger.warn(`Cannot update status for unknown account: ${accountId}`);
      return null;
    }
    
    const updatedAccount = {
      ...account,
      ...statusUpdate,
      lastActivity: new Date()
    };
    
    this.accounts.set(accountId, updatedAccount);
    this.saveAccounts();
    
    logger.debug(`Updated status for account: ${accountId}`, accountId);
    return updatedAccount;
  }
  
  /**
   * Record login event for account
   * @param {string} accountId - Account identifier
   * @param {boolean} success - Whether login was successful
   * @param {string} [failReason] - Reason for login failure
   */
  recordLogin(accountId, success, failReason = null) {
    const account = this.getAccount(accountId);
    
    if (!account) {
      logger.warn(`Cannot record login for unknown account: ${accountId}`);
      return;
    }
    
    const statusUpdate = {
      lastLogin: new Date(),
      loginAttempts: (account.loginAttempts || 0) + 1,
      successfulLogins: success ? (account.successfulLogins || 0) + 1 : (account.successfulLogins || 0)
    };
    
    if (!success) {
      statusUpdate.lastLoginFailReason = failReason;
      statusUpdate.failedLogins = (account.failedLogins || 0) + 1;
    }
    
    this.updateAccountStatus(accountId, statusUpdate);
    
    logger.info(`Recorded ${success ? 'successful' : 'failed'} login for account: ${accountId}`, accountId);
  }
  
  /**
   * Record logout event for account
   * @param {string} accountId - Account identifier
   */
  recordLogout(accountId) {
    const account = this.getAccount(accountId);
    
    if (!account) {
      logger.warn(`Cannot record logout for unknown account: ${accountId}`);
      return;
    }
    
    this.updateAccountStatus(accountId, {
      lastLogout: new Date(),
      logoutCount: (account.logoutCount || 0) + 1
    });
    
    logger.info(`Recorded logout for account: ${accountId}`, accountId);
  }
  
  /**
   * Get accounts eligible for login (not locked out)
   * @returns {Array} - Array of eligible account objects
   */
  getEligibleAccounts() {
    const now = new Date();
    
    return this.getAllAccounts().filter(account => {
      // Skip accounts with captcha lockout
      if (account.captchaLockoutUntil && account.captchaLockoutUntil > now) {
        const minutesRemaining = Math.ceil((account.captchaLockoutUntil - now) / (60 * 1000));
        logger.debug(`Account ${account.id} in captcha lockout for ${minutesRemaining} more minutes`);
        return false;
      }
      
      // Skip accounts marked as disabled
      if (account.disabled) {
        logger.debug(`Account ${account.id} is disabled`);
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
    const account = this.getAccount(accountId);
    
    if (!account) {
      logger.warn(`Cannot set captcha lockout for unknown account: ${accountId}`);
      return;
    }
    
    const lockoutUntil = new Date();
    lockoutUntil.setMinutes(lockoutUntil.getMinutes() + minutes);
    
    this.updateAccountStatus(accountId, {
      captchaLockoutUntil: lockoutUntil,
      captchaLockoutCount: (account.captchaLockoutCount || 0) + 1
    });
    
    logger.warn(`Set captcha lockout for account ${accountId} until ${lockoutUntil.toISOString()}`, accountId);
  }
  
  /**
   * Record captcha encounter for an account
   * @param {string} accountId - Account identifier
   * @param {boolean} solved - Whether captcha was solved successfully
   */
  recordCaptchaEncounter(accountId, solved) {
    const account = this.getAccount(accountId);
    
    if (!account) {
      logger.warn(`Cannot record captcha for unknown account: ${accountId}`);
      return;
    }
    
    this.updateAccountStatus(accountId, {
      captchaEncounters: (account.captchaEncounters || 0) + 1,
      captchaSolved: solved ? (account.captchaSolved || 0) + 1 : (account.captchaSolved || 0),
      captchaFailed: !solved ? (account.captchaFailed || 0) + 1 : (account.captchaFailed || 0),
      lastCaptchaEncounter: new Date(),
      lastCaptchaSuccess: solved ? new Date() : account.lastCaptchaSuccess
    });
    
    logger.info(`Recorded captcha encounter (${solved ? 'solved' : 'failed'}) for account: ${accountId}`, accountId);
  }
}

module.exports = new AccountManager();
